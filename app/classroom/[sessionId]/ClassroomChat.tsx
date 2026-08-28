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
          ascending: true,
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
        (data ?? []) as MessageRow[]
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

  async function sendMessage() {
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
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <section
      style={{
        maxWidth: "1500px",
        width: "100%",
        margin: "10px auto 0",
        padding: "8px 10px 9px",
        border:
          "1px solid rgba(255,255,255,0.12)",
        borderRadius: "12px",
        background: "#111216",
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          gap: "12px",
          marginBottom: "6px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 900,
              letterSpacing:
                "0.06em",
            }}
          >
            CHAT
          </div>

          <div
            style={{
              marginTop: "1px",
              fontSize: "10px",
              opacity: 0.48,
            }}
          >
            채팅
          </div>
        </div>

        <div
          style={{
            fontSize: "10px",
            opacity: 0.45,
          }}
        >
          Enter to send
        </div>
      </div>

      <div
        ref={listRef}
        style={{
          height: "54px",
          overflowY: "auto",
          padding: "4px 6px",
          borderRadius: "8px",
          background:
            "rgba(255,255,255,0.03)",
          boxSizing: "border-box",
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              padding: "14px 4px 0",
              fontSize: "11px",
              opacity: 0.45,
            }}
          >
            No messages yet.
            <span
              style={{
                marginLeft: "7px",
                fontSize: "10px",
              }}
            >
              아직 메시지가 없습니다.
            </span>
          </div>
        ) : (
          messages.map(
            (item) => {
              const mine =
                item.sender_user_id ===
                currentUserId;

              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems:
                      "baseline",
                    gap: "7px",
                    padding: "2px 3px",
                    fontSize: "11px",
                    lineHeight: 1.35,
                  }}
                >
                  <span
                    style={{
                      minWidth: "74px",
                      color: mine
                        ? "#93c5fd"
                        : "#f7f7f8",
                      fontWeight: 800,
                    }}
                  >
                    {item.sender_name}
                  </span>

                  <span
                    style={{
                      flex: 1,
                      color:
                        "rgba(255,255,255,0.82)",
                      overflowWrap:
                        "anywhere",
                    }}
                  >
                    {item.message}
                  </span>

                  <span
                    style={{
                      fontSize: "9px",
                      opacity: 0.35,
                      whiteSpace:
                        "nowrap",
                    }}
                  >
                    {formatTime(
                      item.created_at
                    )}
                  </span>
                </div>
              );
            }
          )
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1fr) auto",
          gap: "8px",
          marginTop: "7px",
        }}
      >
        <input
          value={message}
          onChange={(event) => {
            setMessage(
              event.target.value
            );
            setErrorMessage("");
          }}
          onKeyDown={handleKeyDown}
          maxLength={1000}
          disabled={loading}
          placeholder="Type a message... / 메시지를 입력하세요"
          style={{
            width: "100%",
            height: "34px",
            boxSizing:
              "border-box",
            padding: "0 11px",
            border:
              "1px solid rgba(255,255,255,0.12)",
            borderRadius: "8px",
            background: "#191b20",
            color: "#f7f7f8",
            outline: "none",
            fontSize: "11px",
          }}
        />

        <button
          type="submit"
          disabled={
            loading ||
            !message.trim()
          }
          style={{
            height: "34px",
            minWidth: "72px",
            padding: "0 14px",
            border:
              "1px solid rgba(96,165,250,0.35)",
            borderRadius: "8px",
            background:
              loading ||
              !message.trim()
                ? "#26303f"
                : "#2563eb",
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: 900,
            cursor:
              loading ||
              !message.trim()
                ? "default"
                : "pointer",
          }}
        >
          {loading
            ? "Sending..."
            : "Send"}
        </button>
      </form>

      {errorMessage && (
        <div
          style={{
            marginTop: "5px",
            color: "#fca5a5",
            fontSize: "10px",
          }}
        >
          {errorMessage}
        </div>
      )}
    </section>
  );
}