"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  sessionId: number;
  disabled?: boolean;
};

export default function ZoomConnectButton({
  sessionId,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleConnect() {
    if (disabled || loading) {
      return;
    }

    const confirmed = window.confirm(
      "이 수업 1건에만 Zoom 회의를 생성하고 연결하시겠습니까?"
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/zoom/connect-session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({ sessionId }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorText =
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error ?? {});

        throw new Error(
          errorText || "Zoom 연결에 실패했습니다."
        );
      }

      setMessage("Zoom 회의 연결이 완료되었습니다.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Zoom 연결 실패: ${error.message}`
          : "Zoom 연결 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={handleConnect}
        style={{
          padding: "12px 18px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          fontWeight: 700,
          cursor:
            disabled || loading
              ? "default"
              : "pointer",
          opacity:
            disabled || loading ? 0.55 : 1,
        }}
      >
        {loading ? "Zoom 연결 중..." : "Zoom 연결"}
      </button>

      {message && (
        <p
          style={{
            marginTop: "10px",
            marginBottom: 0,
            fontSize: "13px",
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}