"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase-browser";

type MessageRow = {
  id: number;
  class_session_id: number;
  sender_user_id: string;
  sender_role: string;
  sender_name: string;
  message: string;
  created_at: string;
};

type Props = {
  sessionId: number;
  currentUserId: string;
  currentUserRole: string;
  currentUserName: string;
  testStudentMode?: boolean;
  classInProgress?: boolean;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export default function ClassroomChat({
  sessionId,
  currentUserId,
  currentUserRole,
  currentUserName,
  testStudentMode = false,
  classInProgress = true,
}: Props) {
  const [messages, setMessages] =
    useState<MessageRow[]>([]);
  const [message, setMessage] =
    useState("");
  const [loading, setLoading] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  const listRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const supabase =
      createClient();

    let mounted = true;

    async function loadMessages() {
      const {
        data,
        error,
      } = await supabase
        .from("classroom_messages")
        .select(`
          id,
          class_session_id,
          sender_user_id,
          sender_role,
          sender_name,
          message,
          created_at
        `)
        .eq(
          "class_session_id",
          sessionId
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(100);

      if (!mounted) {
        return;
      }

      if (error) {
        setErrorMessage(
          `Chat history could not be loaded. ${error.message}`
        );
        return;
      }

      setMessages(
        ((data ?? []) as MessageRow[]).reverse()
      );
    }

    void loadMessages();

    const channel =
      supabase
        .channel(
          `classroom-chat-${sessionId}`
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table:
              "classroom_messages",
            filter:
              `class_session_id=eq.${sessionId}`,
          },
          (payload) => {
            const newMessage =
              payload.new as MessageRow;

            setMessages(
              (current) => {
                if (
                  current.some(
                    (item) =>
                      item.id ===
                      newMessage.id
                  )
                ) {
                  return current;
                }

                return [
                  ...current,
                  newMessage,
                ].slice(-100);
              }
            );
          }
        )
        .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(
        channel
      );
    };
  }, [sessionId]);

  useEffect(() => {
    const list =
      listRef.current;

    if (!list) {
      return;
    }

    list.scrollTop =
      list.scrollHeight;
  }, [messages]);

  const canSend = (currentUserRole !== "admin" || testStudentMode) && (!testStudentMode || classInProgress);

  async function sendMessage() {
    if (!canSend) return;
    const trimmed =
      message.trim();

    if (
      !trimmed ||
      loading
    ) {
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const supabase =
        createClient();

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user ||
        user.id !== currentUserId
      ) {
        throw new Error(
          "Your login session could not be verified."
        );
      }

      if (currentUserRole === "admin" && testStudentMode) {
        const response = await fetch("/api/admin/test-classroom/chat", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: trimmed }),
        });
        const result: { success?: boolean; error?: string } = await response.json();
        if (!response.ok || result.success !== true) {
          throw new Error(result.error || "테스트 학생 메시지를 보낼 수 없습니다.");
        }
        setMessage("");
        return;
      }

      const {
        error,
      } = await supabase
        .from("classroom_messages")
        .insert({
          class_session_id:
            sessionId,
          sender_user_id:
            currentUserId,
          sender_role:
            currentUserRole,
          sender_name:
            currentUserName,
          message:
            trimmed,
        });

      if (error) {
        throw new Error(
          error.message
        );
      }

      setMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The message could not be sent."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    await sendMessage();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (
      event.key === "Enter" && !event.nativeEvent.isComposing &&
      !event.shiftKey
    ) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <>
      <style>{`
        .talkly-chat { min-width: 0; min-height: 0; height: 100%; display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid #303744; border-radius: 16px; background: #111318; color: #f8fafc; box-sizing: border-box; }
        .talkly-chat-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; }
        .talkly-chat-title { display: flex; align-items: center; gap: 8px; }
        .talkly-chat-live { width: 8px; height: 8px; border-radius: 50%; background: #35d07f; }
        .talkly-chat-title-copy strong { font-size: 16px; }
        .talkly-chat-title-copy small { margin-left: 8px; color: #94a3b8; font-size: 13px; }
        .talkly-chat-hint { font-size: 12px; color: #94a3b8; }
        .talkly-chat-list { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
        .talkly-chat-empty { font-size: 15px; line-height: 1.7; color: #94a3b8; }
        .talkly-chat-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 8px; padding: 12px 0; border-bottom: 1px solid #26303f; }
        .talkly-chat-name { font-size: 13px; font-weight: 700; overflow-wrap: anywhere; }
        .talkly-chat-message { grid-column: 1 / -1; grid-row: 2; font-size: 16px; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
        .talkly-chat-time { font-size: 11px; color: #94a3b8; }
        .talkly-chat-form { display: flex; flex-wrap: wrap; gap: 8px; }
        .talkly-chat-input { flex: 1 1 140px; width: 100%; min-width: 0; height: 44px; padding: 10px; border: 1px solid #475569; border-radius: 8px; background: #1e293b; color: #fff; font-size: 16px; }
        .talkly-chat-input:focus-visible { outline: 2px solid #60a5fa; }
        .talkly-chat-send { min-height: 44px; padding: 8px 14px; border-radius: 8px; background: #2563eb; color: white; font-size: 15px; cursor: pointer; }
        .talkly-chat-send:disabled { opacity: .5; cursor: default; }
        .talkly-chat-error { color: #fca5a5; font-size: 14px; }
      `}</style>

      <section className="talkly-chat">
        <div className="talkly-chat-head">
          <div className="talkly-chat-title">
            <span className="talkly-chat-live" />

            <div className="talkly-chat-title-copy">
              <strong>CHAT</strong>
              <small>채팅</small>
            </div>
          </div>

          <div className="talkly-chat-hint">
            {currentUserRole === "admin" && !testStudentMode
              ? "관리자 참관 · 채팅 읽기 전용"
              : testStudentMode
                ? classInProgress ? "테스트 학생 · 실시간 메시지" : "강사가 수업을 시작하면 채팅할 수 있습니다."
                : "Enter to send · 실시간 메시지"}
          </div>
        </div>

        <div ref={listRef} className="talkly-chat-list">
          {messages.length === 0 ? (
            <div className="talkly-chat-empty">
              No messages yet. · 아직 메시지가 없습니다.
            </div>
          ) : (
            messages.map((item) => {
              const mine =
                item.sender_user_id === currentUserId;

              return (
                <div key={item.id} className="talkly-chat-row">
                  <span
                    className="talkly-chat-name"
                    style={{
                      color: mine ? "#93c5fd" : "#f8fafc",
                    }}
                  >
                    {item.sender_name}
                  </span>

                  <span className="talkly-chat-message">
                    {item.message}
                  </span>

                  <span className="talkly-chat-time">
                    {formatTime(item.created_at)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {canSend && (
        <form onSubmit={handleSubmit} className="talkly-chat-form">
          <input
            aria-label="수업 채팅 메시지"
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setErrorMessage("");
            }}
            onKeyDown={handleKeyDown}
            maxLength={1000}
            disabled={loading}
            placeholder="Type a message... / 메시지를 입력하세요"
            className="talkly-chat-input"
          />

          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="talkly-chat-send"
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </form>
        )}

        {errorMessage && (
          <div className="talkly-chat-error">
            {errorMessage}
          </div>
        )}
      </section>
    </>
  );
}
