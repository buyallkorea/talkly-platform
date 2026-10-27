"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CONSENT_VERSION, TUTORS, PLAN, Turn, normalizeTutorId } from "@/lib/talkly-ai/config";
import {
  CancelledConnection,
  ConnectionEpoch,
  leaseMilliseconds,
} from "@/lib/talkly-ai/client-connection";
import { CheckpointQueue } from "@/lib/talkly-ai/checkpoint-queue";
import { TurnCoordinator } from "@/lib/talkly-ai/turn-coordinator";
type Account = {
  needsAdultConsent: boolean;
  latestReport: null | { month: string; published_at: string };
  activePass: boolean;
  trialRemaining: number;
  canTestAccess: boolean;
  paymentsEnabled: boolean;
  member: null | {
    status: string;
    valid_until: string | null;
    last_tutor_id: string | null;
  };
  remaining: number;
  payments: {
    order_id: string;
    amount: number;
    status: string;
    created_at: string;
  }[];
};
type Widgets = {
  setAmount: (a: { value: number; currency: "KRW" }) => Promise<void>;
  renderPaymentWindow: () => Promise<{
    on: (event: "cancel" | "paymentRequest", cb: () => void) => void;
    destroy: () => void;
  }>;
  requestPayment: (p: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
  }) => Promise<void>;
};
async function api(path: string, data?: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);
  try {
    const r = await fetch("/api/talkly-ai/" + path, {
      method: data === undefined ? "GET" : "POST",
      headers: data === undefined ? {} : { "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
      cache: "no-store",
      signal: controller.signal,
    });
    const result = await r.json();
    if (!r.ok)
      throw Object.assign(
        new Error(result.error || "요청을 처리하지 못했어요."),
        { terminal: result.terminal === true },
      );
    return result;
  } catch (e) {
    if (controller.signal.aborted)
      throw new Error(
        "응답이 지연되고 있어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.",
      );
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
function clock(s: number) {
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}
export default function AiStudio() {
  const [account, setAccount] = useState<Account | null>(null),
    [error, setError] = useState(""),
    [consent, setConsent] = useState(false),
    [adultConfirmed, setAdultConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [tutor, setTutor] = useState("lively-female"),
    [state, setState] = useState<"idle" | "connecting" | "live" | "paused">(
      "idle",
    ),
    [remaining, setRemaining] = useState(600),
    [turns, setTurns] = useState<Turn[]>([]),
    [input, setInput] = useState(""),
    [connectionBusy, setConnectionBusy] = useState(false),
    [paymentMessage, setPaymentMessage] = useState(""),
    [pendingMemoryRetry, setPendingMemoryRetry] = useState(false),
    [memoryRetryBusy, setMemoryRetryBusy] = useState(false);
  const connectionEpoch = useRef(new ConnectionEpoch());
  const audio = useRef<HTMLAudioElement>(null),
    pc = useRef<RTCPeerConnection | null>(null),
    dc = useRef<RTCDataChannel | null>(null),
    stream = useRef<MediaStream | null>(null),
    session = useRef<string | null>(null),
    history = useRef<Turn[]>([]),
    segmentTurns = useRef<Turn[]>([]),
    timer = useRef<ReturnType<typeof setInterval> | null>(null),
    turnCoordinator = useRef(new TurnCoordinator()),
    replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    disconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    busyRef = useRef(false),
    stopping = useRef(false),
    renewing = useRef(false),
    active = useRef(false),
    deadline = useRef(0),
    dailyStart = useRef(600),
    started = useRef(0);
  const refresh = useCallback(async () => {
    const result = (await api("account")) as Account;
    setAccount(result);
    setRemaining(result.remaining);
    return result;
  }, []);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve()
      .then(() => (cancelled ? null : api("account")))
      .then((a) => {
        if (cancelled || !a) return;
        setAccount(a as Account);
        setRemaining(a.remaining);
        if (a.member?.last_tutor_id) setTutor(normalizeTutorId(a.member.last_tutor_id));
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  function localClose() {
    connectionEpoch.current.cancel();
    active.current = false;
    if (disconnectTimer.current) clearTimeout(disconnectTimer.current);
    disconnectTimer.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    dc.current?.close();
    pc.current?.close();
    stream.current?.getTracks().forEach((t) => t.stop());
    dc.current = null;
    pc.current = null;
    stream.current = null;
    if (audio.current) audio.current.srcObject = null;
    if (replyTimer.current) clearTimeout(replyTimer.current);
    replyTimer.current = null;
    turnCoordinator.current.reset();
  }
  const saveQueue = useRef<CheckpointQueue | null>(null);
  const failedMemory = useRef<{ id: string; turns: Turn[]; version: number } | null>(null);
  const memoryVersion = useRef(0);
  const checkpointWriter = useRef<string | null>(null);
  function writerId() {
    if (!checkpointWriter.current) checkpointWriter.current = crypto.randomUUID();
    return checkpointWriter.current;
  }
  async function checkpoint(id: string) {
    if (!saveQueue.current)
      saveQueue.current = new CheckpointQueue((sessionId, turns, version) =>
        api("session/checkpoint", { sessionId, turns, version, writerId: writerId() }),
      );
    const snapshot = history.current.slice(-20).map((turn) => ({ ...turn }));
    const version = ++memoryVersion.current;
    try {
      await saveQueue.current.save(id, snapshot, version);
      if (failedMemory.current?.id === id && failedMemory.current.version <= version) {
        failedMemory.current = null;
        setPendingMemoryRetry(false);
      }
    } catch (error) {
      if (error && typeof error === "object" && "terminal" in error && error.terminal === true) {
        // The server rejected ownership or ordering. Do not offer a retry that cannot succeed.
        if (failedMemory.current?.id === id) failedMemory.current = null;
        setPendingMemoryRetry(Boolean(failedMemory.current));
        throw error;
      }
      const previous = failedMemory.current;
      if (!previous || previous.version <= version) {
        failedMemory.current = { id, turns: snapshot, version };
        setPendingMemoryRetry(true);
      }
      throw error;
    }
  }
  async function retryMemory() {
    const pending = failedMemory.current;
    if (!pending || memoryRetryBusy) return;
    setMemoryRetryBusy(true);
    try {
      if (!saveQueue.current) throw new Error("대화 저장 기능을 사용할 수 없어요.");
      const latest = session.current === pending.id
        ? history.current.slice(-20).map((turn) => ({ ...turn }))
        : pending.turns;
      await saveQueue.current.save(pending.id, latest, session.current === pending.id ? ++memoryVersion.current : pending.version);
      if (failedMemory.current === pending) {
        failedMemory.current = null;
        setPendingMemoryRetry(false);
      }
      setError("대화 기억을 다시 저장했습니다.");
    } catch (error) {
      const terminal = error && typeof error === "object" && "terminal" in error && error.terminal === true;
      if (terminal) {
        if (failedMemory.current === pending) {
          failedMemory.current = null;
          setPendingMemoryRetry(false);
        }
        setError("서버에서 이 대화의 저장을 거부했어요. 저장 권한이나 순번이 변경되어 반복 저장할 수 없습니다.");
      } else {
        setError("대화 기억 재저장에 실패했어요. 현재 화면을 유지하고 연결을 확인한 후 다시 시도해 주세요.");
      }
    } finally {
      setMemoryRetryBusy(false);
    }
  }
  async function stop(paused = true) {
    if (stopping.current) return;
    stopping.current = true;
    localClose();
    const id = session.current;
    session.current = null;
    const summarySnapshot = [...segmentTurns.current];
    segmentTurns.current = [];
    setState(paused ? "paused" : "idle");
    try {
      if (id) {
        const result = await Promise.allSettled([
          checkpoint(id),
          api("session/stop", { sessionId: id }),
        ]);
        if (result[1].status === "rejected")
          throw new Error("수업 종료 확인에 실패했어요. 이용시간이 정산됐는지 확인할 수 없으므로 상태를 새로고침해 확인해 주세요.");
        // Settlement and memory status determine the primary message.
        // Summary recording is optional and must not hold up renewal or account refresh.
        if (summarySnapshot.length) {
          void api("session/summary", {
            sessionId: id,
            turns: summarySnapshot,
          }).then((summary) => {
            // "not_saved" is a valid HTTP response but not a successful report write.
            if (summary?.status === "not_saved")
              throw new Error("Learning summary not persisted");
          }).catch(() => {
            // Preserve more important transcript, settlement and subsequent lesson warnings.
            if (result[0].status === "fulfilled")
              setError((current) => current || "수업은 종료됐지만 학습 요약 저장에 실패했어요. 월간 리포트에 일부 기록이 빠질 수 있어요.");
          });
        }
        if (result[0].status === "rejected") {
          const reason = result[0].reason;
          const terminal = reason && typeof reason === "object" && "terminal" in reason && reason.terminal === true;
          setError(terminal
            ? "수업 종료 요청은 처리됐지만 대화 기억 저장은 서버에서 거부됐어요. 저장 순번이나 작성자 권한을 확인해야 합니다. 재시도해도 해결되지 않을 수 있어요."
            : "수업 종료 요청은 처리됐지만 대화 기억 저장에 실패했어요. 현재 화면을 유지하고 다시 저장해 주세요. 페이지를 떠나면 복구하지 못할 수 있어요.");
        }
      }
      return await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "종료를 확인하지 못했어요.");
    } finally {
      stopping.current = false;
    }
  }
  // pagehide uses keepalive; server watchdog independently expires abandoned calls.
  useEffect(() => {
    const leave = () => {
      connectionEpoch.current.cancel();
      active.current = false;
      if (disconnectTimer.current) clearTimeout(disconnectTimer.current);
      disconnectTimer.current = null;
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      stream.current?.getTracks().forEach((t) => t.stop());
      pc.current?.close();
      if (session.current) {
        const headers = { "Content-Type": "application/json" };
        void fetch("/api/talkly-ai/session/checkpoint", {
          method: "POST",
          headers,
          body: JSON.stringify({
            sessionId: session.current,
            turns: history.current.slice(-20),
            version: ++memoryVersion.current,
            writerId: writerId(),
          }),
          keepalive: true,
        });
        void fetch("/api/talkly-ai/session/stop", {
          method: "POST",
          headers,
          body: JSON.stringify({ sessionId: session.current }),
          keepalive: true,
        });
      }
    };
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      session.current = null;
      localClose();
      setState("paused");
      void refresh().catch((e) => setError(e.message));
    };
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", restore);
    return () => {
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", restore);
      leave();
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh]);
  function add(role: Turn["role"], text: string) {
    if (!text) return;
    history.current = [...history.current, { role, text }].slice(-100);
    segmentTurns.current = [...segmentTurns.current, { role, text }].slice(
      -100,
    );
    setTurns([...history.current]);
    if (session.current)
      void checkpoint(session.current).catch(() =>
        setError("대화 기억을 저장하지 못했어요. 현재 화면에는 대화가 남아 있지만 페이지를 떠나면 복구되지 않을 수 있어요. 연결 상태를 확인해 주세요."),
      );
  }
  function replyWhenReady() {
    if (replyTimer.current) clearTimeout(replyTimer.current);
    replyTimer.current = null;
    if (!active.current || dc.current?.readyState !== "open") return;
    if (turnCoordinator.current.takeResponse()) {
      try {
        dc.current.send(JSON.stringify({ type: "response.create" }));
      } catch {
        setError("응답 연결이 끊어졌어요. 다시 시작해 주세요.");
        void stop(true);
      }
    } else {
      const delay = turnCoordinator.current.responseDelay();
      if (delay !== null)
        replyTimer.current = setTimeout(replyWhenReady, Math.max(1, delay));
    }
  }
  async function renew() {
    if (renewing.current || stopping.current) return;
    renewing.current = true;
    try {
      const queued = turnCoordinator.current.queued;
      const a = await stop(true);
      if (a && a.remaining > 0) await start(true, true, queued);
    } finally {
      renewing.current = false;
    }
  }
  async function start(
    continuation = false,
    automatic = false,
    queued = false,
  ) {
    if (busyRef.current || active.current || stopping.current) return;
    busyRef.current = true;
    setConnectionBusy(true);
    const attempt = connectionEpoch.current.begin();
    turnCoordinator.current.reset();
    if (queued) turnCoordinator.current.restoreQueued();
    setError("");
    setState("connecting");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "마이크를 사용할 수 없어요. 최신 Chrome 또는 Safari에서 열어 주세요.",
        );
      stream.current = await connectionEpoch.current.microphone(
        attempt,
        navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        }),
      );
      if (!connectionEpoch.current.current(attempt)) {
        stream.current.getTracks().forEach((t) => t.stop());
        stream.current = null;
        throw new CancelledConnection();
      }
      const peer = new RTCPeerConnection();
      pc.current = peer;
      function failConnection(message: string, allowRenew = false) {
        if (pc.current !== peer || !connectionEpoch.current.current(attempt))
          return;
        if (
          allowRenew &&
          active.current &&
          deadline.current > 0 &&
          deadline.current - performance.now() <= 1500
        ) {
          void renew();
          return;
        }
        setError(message);
        void stop(true);
      }
      const microphone = stream.current;
      if (
        !microphone.getAudioTracks().length ||
        microphone.getAudioTracks().some((track) => track.readyState !== "live")
      ) {
        throw new Error("마이크 연결을 확인한 뒤 다시 시작해 주세요.");
      }
      microphone.getAudioTracks().forEach((track) => {
        track.onended = () =>
          failConnection(
            "마이크 연결이 끊어졌어요. 입력 장치를 확인한 뒤 다시 시작해 주세요.",
          );
      });
      stream.current
        .getTracks()
        .forEach((t) => peer.addTrack(t, stream.current!));
      peer.ontrack = (e) => {
        if (pc.current !== peer || !connectionEpoch.current.current(attempt))
          return;
        if (audio.current) {
          audio.current.srcObject = e.streams[0];
          void audio.current
            .play()
            .catch(() =>
              failConnection(
                "소리를 재생하지 못했어요. 사이트의 소리 재생을 허용한 뒤 다시 시작해 주세요.",
              ),
            );
        }
      };
      peer.onconnectionstatechange = () => {
        if (pc.current !== peer || !connectionEpoch.current.current(attempt))
          return;
        if (peer.connectionState === "disconnected") {
          // Brief transport loss can recover without another paid API call.
          // Repeated events must not extend the grace period or lease deadline.
          if (!disconnectTimer.current)
            disconnectTimer.current = setTimeout(() => {
              disconnectTimer.current = null;
              if (peer.connectionState !== "connected")
                failConnection("연결이 끊어졌어요. 다시 시작해 주세요.", true);
            }, 3000);
          return;
        }
        if (peer.connectionState === "connected") {
          if (disconnectTimer.current) clearTimeout(disconnectTimer.current);
          disconnectTimer.current = null;
          return;
        }
        if (
          peer.connectionState === "failed" ||
          peer.connectionState === "closed"
        ) {
          failConnection("연결이 끊어졌어요. 다시 시작해 주세요.", true);
        }
      };
      const channel = peer.createDataChannel("oai-events");
      dc.current = channel;
      channel.onmessage = (e) => {
        if (dc.current !== channel || !connectionEpoch.current.current(attempt))
          return;
        let d;
        try {
          d = JSON.parse(e.data);
        } catch {
          return;
        }
        if (!d || typeof d.type !== "string") return;
        turnCoordinator.current.event(d);
        if (d.type === "conversation.item.input_audio_transcription.completed")
          add("user", d.transcript);
        if (
          d.type === "response.output_audio_transcript.done" ||
          d.type === "response.audio_transcript.done"
        )
          add("assistant", d.transcript);
        if (
          d.type === "response.function_call_arguments.done" &&
          d.name === "end_session"
        ) {
          setError("안전한 학습 주제로 다시 시작해 주세요.");
          void stop(false);
        }
        if (d.type === "error") {
          setError("AI 응답을 처리하지 못했어요. 잠시 후 다시 시작해 주세요.");
          void stop(true);
          return;
        }
        replyWhenReady();
      };
      const opened = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("음성 연결 시간이 초과됐어요.")),
          25000,
        );
        channel.onopen = () => {
          clearTimeout(timeout);
          resolve();
        };
        channel.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("음성 연결에 실패했어요."));
          failConnection("음성 통신에 오류가 생겼어요. 다시 시작해 주세요.");
        };
        channel.onclose = () => {
          clearTimeout(timeout);
          reject(new Error("음성 연결이 닫혔어요."));
          failConnection("음성 연결이 끊어졌어요. 다시 시작해 주세요.", true);
        };
      });
      // Attach a handler immediately: negotiation may fail before opened is awaited.
      void opened.catch(() => {});
      const offer = await peer.createOffer();
      connectionEpoch.current.assert(attempt);
      await peer.setLocalDescription(offer);
      connectionEpoch.current.assert(attempt);
      const result = await api("session", {
        sdp: offer.sdp,
        tutorId: tutor,
        writerId: writerId(),
      });
      if (!connectionEpoch.current.current(attempt)) {
        await api("session/stop", { sessionId: result.sessionId });
        throw new CancelledConnection();
      }
      segmentTurns.current = [];
      session.current = result.sessionId;
      deadline.current =
        performance.now() +
        leaseMilliseconds(result.deadline, result.serverNow, result.seconds);
      await peer.setRemoteDescription({ type: "answer", sdp: result.sdp });
      await opened;
      connectionEpoch.current.assert(attempt);
      if (!continuation) {
        history.current = [];
        setTurns([]);
      }
      const a = await refresh();
      connectionEpoch.current.assert(attempt);
      dailyStart.current =
        a.remaining +
        Math.max(0, Math.floor((deadline.current - performance.now()) / 1000));
      setRemaining(dailyStart.current);
      started.current = performance.now();
      active.current = true;
      setState("live");
      if (
        !automatic &&
        !turnCoordinator.current.queued &&
        turnCoordinator.current.beginResponse()
      )
        channel.send(
          JSON.stringify({
            type: "response.create",
            response: {
              instructions: continuation
                ? "The connection was refreshed. Briefly continue the last topic without a new greeting or repeating an already answered question."
                : "Greet warmly in one short sentence. If there is previous conversation, ask whether to continue its last topic; otherwise ask one simple open-ended question about today.",
            },
          }),
        );
      replyWhenReady();
      timer.current = setInterval(() => {
        const left = Math.max(
          0,
          dailyStart.current -
            Math.floor((performance.now() - started.current) / 1000),
        );
        setRemaining(left);
        if (performance.now() >= deadline.current) {
          void renew();
        }
      }, 500);
    } catch (e) {
      if (
        e instanceof CancelledConnection ||
        !connectionEpoch.current.current(attempt)
      )
        return;
      await stop(true);
      setError(
        e instanceof DOMException && e.name === "NotFoundError"
          ? "마이크가 있는 헤드셋을 연결하고 PC 설정 → 소리 → 입력 장치를 확인해 주세요."
          : e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "PermissionDeniedError")
            ? "마이크 권한이 거부됐어요. 주소창의 사이트 설정에서 마이크를 허용한 후 다시 시작해 주세요."
            : e instanceof DOMException && (e.name === "NotReadableError" || e.name === "TrackStartError")
              ? "마이크가 다른 프로그램에서 사용 중이거나 입력 장치에 문제가 있어요. 다른 앱을 닫고 다시 시도해 주세요."
              : e instanceof DOMException && e.name === "OverconstrainedError"
                ? "선택한 마이크 설정을 사용할 수 없어요. 다른 입력 장치를 연결해 주세요."
                : e instanceof Error
              ? e.message
              : "음성 연결에 실패했어요.",
      );
    } finally {
      busyRef.current = false;
      setConnectionBusy(false);
    }
  }
  async function join() {
    setBusy(true);
    setError("");
    try {
      await api("join", { consent, adultConfirmed, version: CONSENT_VERSION });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function testAccess() {
    setBusy(true);
    setError("");
    try {
      await api("test-access", {});
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function purchase() {
    setBusy(true);
    setError("");
    try {
      const key = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!key) throw new Error("결제 설정을 준비 중이에요.");
      const w = window as unknown as {
        TossPayments?: (key: string) => {
          widgets: (p: { customerKey: string }) => Widgets;
        };
      };
      if (!w.TossPayments)
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://js.tosspayments.com/v2/standard";
          script.onload = () => resolve();
          script.onerror = () =>
            reject(new Error("결제창을 불러오지 못했어요."));
          document.head.append(script);
        });
      if (!w.TossPayments) throw new Error("결제창을 열지 못했어요.");
      const order = await api("payment/prepare", {});
      const widgets = w
        .TossPayments(key)
        .widgets({ customerKey: order.customerKey });
      await widgets.setAmount({ value: PLAN.amount, currency: "KRW" });
      const paymentWindow = await widgets.renderPaymentWindow();
      paymentWindow.on("cancel", () => {
        paymentWindow.destroy();
        setBusy(false);
      });
      paymentWindow.on("paymentRequest", () => {
        void widgets
          .requestPayment({
            orderId: order.orderId,
            orderName: order.orderName,
            successUrl: location.origin + "/talkly-ai/payment/success",
            failUrl: location.origin + "/talkly-ai/payment/fail",
          })
          .catch((e) => {
            setError(e.message);
            paymentWindow.destroy();
            setBusy(false);
          });
      });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function recoverPayment(orderId: string) {
    if (
      busy ||
      busyRef.current ||
      active.current ||
      stopping.current ||
      connectionBusy
    )
      return;
    busyRef.current = true;
    setBusy(true);
    setPaymentMessage("기존 주문의 승인 여부를 조회 중이에요.");
    let confirmed = false;
    try {
      const result = await api("payment/confirm", {
        orderId,
        amount: PLAN.amount,
        lookupOnly: true,
      });
      if (result.success !== true)
        throw new Error("결제 상태를 확인하지 못했어요.");
      confirmed = true;
      await refresh();
      setPaymentMessage(
        result.alreadyActivated
          ? "이미 이용권에 반영된 주문입니다."
          : "승인된 결제를 확인해 이용권에 반영했어요.",
      );
    } catch (error) {
      if (
        error instanceof Error &&
        "terminal" in error &&
        error.terminal === true
      ) {
        try {
          await refresh();
          setPaymentMessage(error.message);
        } catch {
          setPaymentMessage(
            error.message + " 내역은 새로고침해 확인해 주세요.",
          );
        }
        return;
      }
      setPaymentMessage(
        confirmed
          ? "이용권 반영은 확인했지만 내역을 새로 불러오지 못했어요. 페이지를 새로고침해 주세요."
          : error instanceof Error
            ? error.message
            : "같은 주문의 결제 상태를 확인하지 못했어요.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const paid = account?.activePass ?? false;
  return (
    <>
      <div className="tai-error" role="status" aria-live="polite">
        {error}
      </div>
      {pendingMemoryRetry && (
        <div className="tai-card" role="status">
          <p>대화 기록 일부가 서버에 저장되지 않았어요. 페이지를 닫기 전에 다시 저장할 수 있습니다.</p>
          <button disabled={memoryRetryBusy} onClick={retryMemory}>
            {memoryRetryBusy ? "대화 기억 저장 중…" : "대화 기억 다시 저장"}
          </button>
        </div>
      )}
      {!account ? (
        <section className="tai-card">
          <h2>TALKLY 계정으로 시작해요</h2>
          <p>
            AI 가입을 완료하면 결제 없이 계정당 3분 무료 체험이 제공돼요. TALKLY
            로그인은 함께 사용해요.
          </p>
          <Link className="tai-button" href="/login?next=/talkly-ai">
            로그인
          </Link>{" "}
          <Link href="/signup">회원가입</Link>
          <button onClick={() => refresh().catch((e) => setError(e.message))}>
            상태 다시 확인
          </button>
        </section>
      ) : !account.member || account.needsAdultConsent ? (
        <section className="tai-card">
          <h2>{account.member ? "AI 이용 대상 확인" : "AI 회화에 가입하기"}</h2>
          <p>
            초기 TALKLY AI는 만 19세 이상 성인에게 제공합니다. 미성년자와 자녀의
            AI 이용은 아직 지원하지 않아요.
          </p>
          <p>
            AI 음성·자막은 OpenAI에서 처리돼요. 녹음 파일은 저장하지 않으며,
            다음 대화를 이어가기 위해 마지막 대화 최대 20개 발언을 저장해요.
            관리자는 AI 가입·결제·사용량을 확인할 수 있어요.
          </p>
          <p>
            이용권은 결제 승인 후 30일 동안 하루 10분 사용할 수 있고 자동
            갱신되지 않아요. 생각하는 시간도 포함되며 일시정지하면 연결과 차감이
            중단돼요.
          </p>
          <label>
            <input
              type="checkbox"
              checked={adultConfirmed}
              onChange={(e) => setAdultConfirmed(e.target.checked)}
            />{" "}
            저는 만 19세 이상이며, 제 계정으로 직접 이용합니다.
          </label>
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{" "}
            위 AI 이용·정보 처리 안내와{" "}
            <Link href="/talkly-ai/terms">AI 이용 안내</Link>,{" "}
            <Link href="/talkly-ai/privacy">AI 정보 처리 안내</Link>을 확인하고
            동의합니다.
          </label>
          <button disabled={!consent || !adultConfirmed || busy} onClick={join}>
            {account.member
              ? "확인하고 회화로 돌아가기"
              : "가입하고 3분 무료 체험"}
          </button>
        </section>
      ) : (
        <>
          {account.canTestAccess && (
            <section className="tai-card">
              <b>관리자 전용 음성 테스트</b>
              <p>
                결제 없이 본인 계정에 24시간 테스트 이용권을 활성화해요. 하루
                10분 한도는 유지돼요.
              </p>
              <button
                disabled={busy || state === "live" || state === "connecting"}
                onClick={testAccess}
              >
                24시간 테스트 이용권 활성화
              </button>
            </section>
          )}
          {!paid && remaining === 0 && (
            <section className="tai-card tai-trial-complete" aria-live="polite">
              <h2>3분 무료 체험을 완료했어요!</h2>
              <p>방금 나눈 대화를 이어가고 싶으신가요? 30일 이용권으로 한국시간 기준 하루 10분씩 대화할 수 있어요.</p>
              <p><strong>30일 13,900원 · 자동결제 없음</strong></p>
              <button className="tai-trial-cta" disabled={!account.paymentsEnabled || busy || state === "live" || state === "connecting"} onClick={purchase}>
                {account.paymentsEnabled ? "30일 이용권 구매하고 계속하기" : "정식 결제 오픈 준비 중"}
              </button>
              <p><a href="/talkly-ai/reports">지금까지의 학습 기록 보기</a></p>
              {!account.paymentsEnabled && <p>현재 결제는 비활성화되어 있어 청구되지 않습니다.</p>}
            </section>
          )}
          <section className="tai-account">
            <div>
              <b>
                {paid
                  ? "이용권 사용 중"
                  : remaining > 0
                    ? "가입 혜택 · 3분 무료 체험"
                    : "무료 체험 완료"}
              </b>
              <p>
                {paid
                  ? `만료: ${new Date(account.member.valid_until!).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`
                  : remaining > 0
                    ? "결제 없이 체험하세요. 일시정지 후 남은 시간을 이어 쓸 수 있어요."
                    : "무료 체험을 마쳤어요! 30일 이용권으로 하루 10분씩 회화를 이어갈 수 있어요."}
              </p>
            </div>
            {(paid || remaining > 0) && (
              <button
                disabled={
                  !account.paymentsEnabled ||
                  busy ||
                  state === "live" ||
                  state === "connecting"
                }
                onClick={purchase}
              >
                {!account.paymentsEnabled
                  ? "유료 결제 비활성화"
                  : paid
                    ? "30일 추가 구매"
                    : "30일 이용권 · 13,900원"}
              </button>
            )}
            <div>
              <b>
                {paid ? "오늘 남은 시간" : "무료 체험 남은 시간"}{" "}
                {clock(remaining)}
              </b>
              <p>
                {paid
                  ? "사용하지 않은 시간은 이월되지 않아요."
                  : "무료 체험은 매일 초기화되지 않아요."}
              </p>
            </div>
            {!paid && !account.paymentsEnabled && (
              <p role="status">
                정식 결제 오픈 전입니다. 결제 기능이 활성화되기 전에는 청구되지 않아요.
              </p>
            )}
          </section>
          <div className="tai-grid">
            <section className="tai-card">
              <p className="tai-kicker">YOUR CONVERSATION PARTNER</p>
              <h2>나의 AI 튜터</h2>
              <p>성격에 맞는 AI 강사를 선택하세요. 강사를 바꿔도 학습기록은 이어집니다.</p>
              <div className="tai-tutors">
                {TUTORS.map((t) => (
                  <button
                    key={t.id}
                    className={tutor === t.id ? "selected" : ""}
                    aria-pressed={tutor === t.id}
                    disabled={state === "live" || state === "connecting"}
                    onClick={() => setTutor(t.id)}
                  >
                    <b>{t.name}</b>
                    <small>
                      {t.style} · {t.gender}
                    </small>
                  </button>
                ))}
              </div>
            </section>
            <section className="tai-card tai-studio" data-state={state}>
              <div className="tai-studio-top">
                <span>
                  {state === "live"
                    ? "천천히, 편하게 이야기해 주세요"
                    : state === "connecting"
                      ? "음성 연결 중…"
                      : state === "paused"
                        ? "일시정지 · 차감 중단"
                        : "대화 준비"}
                </span>
                <b>{clock(remaining)}</b>
              </div>
              <div className="tai-orb" aria-hidden="true">
                〰
              </div>
              <h2>
                {TUTORS.find((t) => t.id === tutor)?.name}와 오늘의 이야기
              </h2>
              <p>
                잠깐 멈춰도 괜찮아요. 막히면 짧은 한국어로 도움을 요청해 보세요.
              </p>
              <details className="tai-mic-help">
                <summary>마이크 연결 안내</summary>
                <p>PC는 마이크가 있는 헤드셋·입력 장치를 먼저 연결해 주세요. 대화를 시작하면 마이크 권한을 허용해 주세요.</p>
              </details>
              <div className="tai-controls tai-primary-controls">
                {state === "live" ? (
                  <>
                    <button onClick={() => stop(true)}>일시정지</button>
                    <button onClick={() => stop(false)}>대화 종료</button>
                  </>
                ) : state === "connecting" ? (
                  <button onClick={() => stop(true)}>연결 취소</button>
                ) : (
                  <button
                    disabled={
                      busy ||
                      connectionBusy ||
                      remaining < 1 ||
                      account.member.status !== "active"
                    }
                    onClick={() => start(state === "paused")}
                  >
                    {connectionBusy
                      ? "연결 정리 중…"
                      : state === "paused"
                        ? "이어서 대화"
                        : !paid
                          ? "3분 무료 체험 시작"
                          : "대화 시작"}
                  </button>
                )}
              </div>
              <small>
                잠깐 멈추면 자동으로 기다려요. 연결된 동안에는 시간이 차감되며,
                쉬어 갈 때는 ‘일시정지’를 눌러 주세요.
              </small>
              <audio ref={audio} autoPlay />
              <div className="tai-transcript" aria-live="polite">
                {turns.length ? (
                  turns.map((t, i) => (
                    <p key={i} className={`tai-turn-${t.role}`}>
                      <b>
                        {t.role === "user"
                          ? "나"
                          : TUTORS.find((x) => x.id === tutor)?.name}
                      </b>
                      {t.text}
                    </p>
                  ))
                ) : (
                  <p>대화를 시작하면 여기에 자막이 표시돼요.</p>
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (
                    !input.trim() ||
                    state !== "live" ||
                    turnCoordinator.current.pending ||
                    turnCoordinator.current.speaking ||
                    turnCoordinator.current.awaitingCommit ||
                    dc.current?.readyState !== "open"
                  )
                    return;
                  const text = input.trim();
                  dc.current.send(
                    JSON.stringify({
                      type: "conversation.item.create",
                      item: {
                        type: "message",
                        role: "user",
                        content: [{ type: "input_text", text }],
                      },
                    }),
                  );
                  turnCoordinator.current.queueText();
                  replyWhenReady();
                  add("user", text);
                  setInput("");
                }}
              >
                <input
                  aria-label="텍스트로 답하기"
                  placeholder="필요하면 텍스트로 답해도 돼요"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={state !== "live"}
                />
                <button disabled={state !== "live"}>보내기</button>
              </form>
            </section>
          </div>
          <details className="tai-card">
            <summary>학습 리포트 · 알림 · 지원 메뉴</summary>
          {account.latestReport && (
            <section className="tai-card" aria-label="월말 리포트 발행 안내">
              <b>
                {account.latestReport.month.slice(0, 7)} 리포트가 준비됐어요.
              </b>
              <p>한 달 동안 이야기한 주제와 연습 표현을 확인해 보세요.</p>
              <Link
                href={`/talkly-ai/reports?month=${account.latestReport.month.slice(0, 7)}`}
              >
                월말 리포트 확인 →
              </Link>
            </section>
          )}
          <section className="tai-card">
            <Link href="/talkly-ai/reports">나의 월간 학습 리포트 →</Link>
            <p>
              <Link href="/talkly-ai/refunds">결제·환불 문의 →</Link>
            </p>
            <p>
              <Link href="/talkly-ai/notifications">
                카카오톡·이메일 안내 수신 설정 →
              </Link>
            </p>
            <p>
              학습 요약 저장에 동의하면 다음 회화부터 복습 기록을 모을 수
              있어요.
            </p>
          </section>
          </details>
          <details className="tai-card">
            <summary>내 AI 결제 내역</summary>
            {account.payments.length ? (
              account.payments.map((p) => (
                <p key={p.order_id}>
                  {new Date(p.created_at).toLocaleDateString("ko-KR")} ·{" "}
                  {p.amount.toLocaleString()}원 ·{" "}
                  {p.status === "paid"
                    ? "승인 완료"
                    : p.status === "ready"
                      ? "결제 대기"
                      : p.status === "confirming"
                        ? "확인 중"
                        : p.status === "failed"
                          ? "승인 실패·만료"
                          : p.status === "cancelled"
                            ? "취소됨"
                            : p.status}
                  {p.status === "confirming" && (
                    <>
                      {" "}
                      ·{" "}
                      <button
                        disabled={
                          busy ||
                          connectionBusy ||
                          state === "live" ||
                          state === "connecting"
                        }
                        onClick={() => recoverPayment(p.order_id)}
                      >
                        승인 여부 다시 확인
                      </button>
                    </>
                  )}
                </p>
              ))
            ) : (
              <p>아직 결제 내역이 없어요.</p>
            )}
          </details>
          <p role="status" aria-live="polite">
            {paymentMessage}
          </p>
        </>
      )}
    </>
  );
}
