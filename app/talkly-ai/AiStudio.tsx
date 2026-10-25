"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CONSENT_VERSION, TUTORS, PLAN, Turn } from "@/lib/talkly-ai/config";
import {
  CancelledConnection,
  ConnectionEpoch,
  leaseMilliseconds,
} from "@/lib/talkly-ai/client-connection";
import { TurnCoordinator } from "@/lib/talkly-ai/turn-coordinator";
type Account = {
  latestReport: null | { month: string; published_at: string };
  activePass: boolean;
  trialRemaining: number;
  canTestAccess: boolean;
  paymentsEnabled: boolean;
  member: null | {
    status: string;
    valid_until: string | null;
    last_tutor_id: string | null;
    memory: Turn[];
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
    if (!r.ok) throw new Error(result.error || "요청을 처리하지 못했어요.");
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
    [busy, setBusy] = useState(false),
    [tutor, setTutor] = useState("us-female"),
    [state, setState] = useState<"idle" | "connecting" | "live" | "paused">(
      "idle",
    ),
    [remaining, setRemaining] = useState(600),
    [turns, setTurns] = useState<Turn[]>([]),
    [input, setInput] = useState(""),
    [connectionBusy, setConnectionBusy] = useState(false);
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
    busyRef = useRef(false),
    stopping = useRef(false),
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
    refresh()
      .then((a) => {
        if (a.member?.last_tutor_id) setTutor(a.member.last_tutor_id);
      })
      .catch((e) => setError(e.message));
  }, [refresh]);
  function localClose() {
    connectionEpoch.current.cancel();
    active.current = false;
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
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  async function checkpoint(id: string) {
    const snapshot = history.current.slice(-20);
    const save = saveQueue.current
      .catch(() => {})
      .then(() =>
        api("session/checkpoint", { sessionId: id, turns: snapshot }),
      );
    saveQueue.current = save;
    await save;
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
          api("session/stop", { sessionId: id }).then(() => {
            // Summary must not delay lease renewal or settlement.
            void api("session/summary", {
              sessionId: id,
              turns: summarySnapshot,
            }).catch(() =>
              setError(
                "회화는 종료됐지만 학습 요약을 저장하지 못했어요. 리포트에 일부 기록이 빠질 수 있어요.",
              ),
            );
          }),
        ]);
        if (result.some((r) => r.status === "rejected"))
          throw new Error(
            "대화 저장 또는 종료 확인에 실패했어요. 새로고침 후 이용 상태를 확인해 주세요.",
          );
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
        setError("대화 기억을 저장하지 못했어요. 연결 상태를 확인해 주세요."),
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
    const queued = turnCoordinator.current.queued;
    const a = await stop(true);
    if (a && a.remaining > 0) await start(true, true, queued);
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
            .catch(() => setError("소리 재생을 허용해 주세요."));
        }
      };
      peer.onconnectionstatechange = () => {
        if (pc.current !== peer || !connectionEpoch.current.current(attempt))
          return;
        if (
          peer.connectionState === "failed" ||
          peer.connectionState === "disconnected"
        ) {
          if (active.current) {
            if (
              deadline.current > 0 &&
              deadline.current - performance.now() <= 1500
            ) {
              void renew();
            } else {
              setError("연결이 끊어졌어요. 다시 시작해 주세요.");
              void stop();
            }
          }
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
          : e instanceof DOMException && e.name === "NotAllowedError"
            ? "주소창의 사이트 설정에서 마이크를 허용해 주세요."
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
      await api("join", { consent, version: CONSENT_VERSION });
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
  const paid = account?.activePass ?? false;
  return (
    <>
      <div className="tai-error" role="status" aria-live="polite">
        {error}
      </div>
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
      ) : !account.member ? (
        <section className="tai-card">
          <h2>AI 회화에 가입하기</h2>
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
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{" "}
            위 AI 이용·정보 처리 안내와{" "}
            <Link href="/talkly-ai/terms">AI 이용 안내</Link>,{" "}
            <Link href="/talkly-ai/privacy">AI 정보 처리 안내</Link>을 확인하고
            동의합니다.
          </label>
          <button disabled={!consent || busy} onClick={join}>
            가입하고 3분 무료 체험
          </button>
        </section>
      ) : (
        <>
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
              학습 요약 저장에 동의하면 다음 회화부터 복습 기록을 모을 수
              있어요.
            </p>
          </section>
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
                    : "계정당 1회 제공되는 3분 체험을 모두 사용했어요."}
              </p>
            </div>
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
                  : "이용권 구매"}
            </button>
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
          </section>
          <div className="tai-grid">
            <section className="tai-card">
              <p className="tai-kicker">YOUR CONVERSATION PARTNER</p>
              <h2>나의 AI 튜터</h2>
              <p>국가별 억양·표현을 사용하는 AI예요.</p>
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
                      {t.country} · {t.gender}
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
              <p className="tai-guide">
                PC는 마이크가 있는 헤드셋·입력 장치를 먼저 연결해 주세요. 대화를
                시작하면 마이크 권한을 허용해 주세요.
              </p>
              <div className="tai-controls">
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
                        : p.status}
                </p>
              ))
            ) : (
              <p>아직 결제 내역이 없어요.</p>
            )}
          </details>
        </>
      )}
    </>
  );
}
