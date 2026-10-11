"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { RealtimeChannel } from "@supabase/supabase-js";
import ClassroomTextbookSelector from "./ClassroomTextbookSelector";

type TextbookOption = { id: number; title: string };
type Props = {
  sessionId: number;
  selectedTextbookId: number | null;
  textbooks: TextbookOption[];
  canControl: boolean;
};
type TextbookChangedMessage = {
  sessionId: number;
  textbookId: number;
  sentAt: number;
};

// Realtime broadcast는 알림 용도입니다. 실제 선택 교재는 서버의
// class_sessions.selected_textbook_id가 최종 기준입니다.
const RECHECK_INTERVAL_MS = 15000;

export default function ClassroomTextbookSelectorRefresh({
  sessionId,
  selectedTextbookId,
  textbooks,
  canControl,
}: Props) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [currentId, setCurrentId] = useState<number | null>(selectedTextbookId);
  const [isPending, startTransition] = useTransition();
  const [connected, setConnected] = useState(false);

  const currentIdRef = useRef<number | null>(selectedTextbookId);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const lastRefreshAtRef = useRef(0);
  const lastMessageAtRef = useRef(0);
  const mountedRef = useRef(true);

  const requestServerRefresh = useCallback(() => {
    // 짧은 시간에 들어온 중복 알림만 제한합니다.
    const now = Date.now();
    if (now - lastRefreshAtRef.current < 800) return;
    lastRefreshAtRef.current = now;
    startTransition(() => router.refresh());
  }, [router]);

  // 서버 렌더링이 끝나 props가 갱신되면 서버 값을 최종 상태로 사용합니다.
  useEffect(() => {
    currentIdRef.current = selectedTextbookId;
    setCurrentId(selectedTextbookId);
  }, [selectedTextbookId]);

  useEffect(() => {
    mountedRef.current = true;
    const channel = supabase.channel(`classroom-textbook-selection-${sessionId}`, {
      config: { broadcast: { ack: true, self: false } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "talkly-textbook-changed" }, ({ payload }) => {
      const message = payload as Partial<TextbookChangedMessage>;
      if (Number(message.sessionId) !== sessionId) return;
      const nextId = Number(message.textbookId);
      const sentAt = Number(message.sentAt);
      if (!Number.isSafeInteger(nextId) || nextId <= 0) return;
      if (!Number.isFinite(sentAt) || sentAt <= 0) return;
      // 오래된 알림은 무시합니다. 서버 조회가 최종 기준입니다.
      if (sentAt < lastMessageAtRef.current) return;
      lastMessageAtRef.current = sentAt;
      requestServerRefresh();
    });

    channel.subscribe((status) => {
      const ready = status === "SUBSCRIBED";
      subscribedRef.current = ready;
      if (mountedRef.current) setConnected(ready);
      if (ready) requestServerRefresh();
    });

    const recheck = window.setInterval(() => {
      if (document.visibilityState === "visible") requestServerRefresh();
    }, RECHECK_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") requestServerRefresh();
    };
    const handleOnline = () => requestServerRefresh();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);

    return () => {
      mountedRef.current = false;
      subscribedRef.current = false;
      if (channelRef.current === channel) channelRef.current = null;
      window.clearInterval(recheck);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      void supabase.removeChannel(channel);
    };
  }, [sessionId, supabase, requestServerRefresh]);

  const handleSelected = async (textbookId: number) => {
    // ClassroomTextbookSelector에서 저장 API 성공 후 호출됩니다.
    // 화면 상태는 서버 refresh 후 확정합니다.
    currentIdRef.current = textbookId;
    setCurrentId(textbookId);
    requestServerRefresh();

    const channel = channelRef.current;
    if (!channel || !subscribedRef.current) {
      console.warn("[TALKLY] 교재 변경 알림 채널 미연결: 서버 저장은 완료됨");
      return;
    }

    try {
      const result = await channel.send({
        type: "broadcast",
        event: "talkly-textbook-changed",
        payload: {
          sessionId,
          textbookId,
          sentAt: Date.now(),
        } satisfies TextbookChangedMessage,
      });
      if (result !== "ok") {
        console.warn("[TALKLY] 교재 변경 알림 전송 결과:", result);
      }
    } catch (error) {
      console.error("[TALKLY] 교재 변경 알림 전송 실패:", error);
    }
  };

  return (
    <div className="mb-3">
      <ClassroomTextbookSelector
        sessionId={sessionId}
        selectedTextbookId={currentId}
        textbooks={textbooks}
        canControl={canControl}
        onSelected={(id) => { void handleSelected(id); }}
      />
      {isPending && (
        <p className="mt-2 text-xs text-slate-500">교재 화면을 갱신하고 있습니다.</p>
      )}
      {!connected && (
        <p className="mt-1 text-xs text-amber-600">
          실시간 연결을 확인하는 중입니다. 교재 상태는 자동으로 다시 확인합니다.
        </p>
      )}
    </div>
  );
}

