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

    return (
    <>
      <style>{`
        .talkly-chat {
          max-width: 1500px;
          width: 100%;
          margin: 10px auto 0;
          padding: 8px 10px 9px;
          border: 1px solid rgba(255,255,255,.11);
          border-radius: 14px;
          background:
            linear-gradient(180deg, rgba(20,22,27,.97), rgba(14,16,20,.97));
          box-sizing: border-box;
          flex: 0 0 auto;
          box-shadow: 0 12px 30px rgba(0,0,0,.16);
        }

        .talkly-chat-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 6px;
        }

        .talkly-chat-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .talkly-chat-live {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #35d07f;
          box-shadow: 0 0 0 4px rgba(53,208,127,.09);
        }

        .talkly-chat-title-copy strong {
          display: block;
          font-size: 11px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: .08em;
        }

        .talkly-chat-title-copy small {
          display: block;
          margin-top: 3px;
          font-size: 9px;
          color: rgba(255,255,255,.42);
        }

        .talkly-chat-hint {
          font-size: 9px;
          color: rgba(255,255,255,.36);
        }

        .talkly-chat-list {
          height: 54px;
          overflow-y: auto;
          padding: 4px 7px;
          border-radius: 9px;
          background: rgba(255,255,255,.025);
          border: 1px solid rgba(255,255,255,.04);
          box-sizing: border-box;
          scrollbar-width: thin;
        }

        .talkly-chat-empty {
          padding: 13px 4px 0;
          font-size: 10px;
          color: rgba(255,255,255,.42);
        }

        .talkly-chat-row {
          display: grid;
          grid-template-columns: minmax(72px, auto) minmax(0,1fr) auto;
          align-items: baseline;
          gap: 8px;
          padding: 2px 3px;
          font-size: 10px;
          line-height: 1.35;
        }

        .talkly-chat-name {
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .talkly-chat-message {
          color: rgba(255,255,255,.80);
          overflow-wrap: anywhere;
        }

        .talkly-chat-time {
          font-size: 8px;
          color: rgba(255,255,255,.28);
          white-space: nowrap;
        }

        .talkly-chat-form {
          display: grid;
          grid-template-columns: minmax(0,1fr) auto;
          gap: 8px;
          margin-top: 7px;
        }

        .talkly-chat-input {
          width: 100%;
          height: 34px;
          box-sizing: border-box;
          padding: 0 11px;
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 9px;
          background: rgba(255,255,255,.045);
          color: #f8fafc;
          outline: none;
          font-size: 10px;
        }

        .talkly-chat-input:focus {
          border-color: rgba(96,165,250,.55);
          box-shadow: 0 0 0 3px rgba(37,99,235,.08);
        }

        .talkly-chat-send {
          height: 34px;
          min-width: 70px;
          padding: 0 14px;
          border: 1px solid rgba(96,165,250,.35);
          border-radius: 9px;
          background: #2563eb;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .talkly-chat-send:disabled {
          background: #26303f;
          cursor: default;
          opacity: .75;
        }

        .talkly-chat-error {
          margin-top: 5px;
          color: #fca5a5;
          font-size: 9px;
        }

        @media (max-width: 900px) {
          .talkly-chat {
            margin-top: 8px;
            border-radius: 12px;
          }
        }

        @media (max-width: 600px) {
          .talkly-chat {
            padding: 7px 8px 8px;
          }

          .talkly-chat-list {
            height: 44px;
          }

          .talkly-chat-row {
            grid-template-columns: 64px minmax(0,1fr);
            gap: 6px;
          }

          .talkly-chat-time,
          .talkly-chat-hint {
            display: none;
          }

          .talkly-chat-form {
            margin-top: 6px;
            gap: 6px;
          }

          .talkly-chat-send {
            min-width: 58px;
            padding: 0 10px;
          }
        }
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
            Enter to send · 실시간 메시지
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

        <form onSubmit={handleSubmit} className="talkly-chat-form">
          <input
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

        {errorMessage && (
          <div className="talkly-chat-error">
            {errorMessage}
          </div>
        )}
      </section>
    </>
  );
}