"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Props = {
  sessionId: number;
  currentStatus: string;
  attendanceStatus: string | null;
};

export default function CompleteClassButton({
  sessionId,
  currentStatus,
  attendanceStatus,
}: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  const canComplete =
    currentStatus === "scheduled" &&
    (attendanceStatus === "present" ||
      attendanceStatus === "late");

  if (!canComplete) {
    return null;
  }

  async function handleCompleteClass() {
    const confirmed = window.confirm(
      "Mark this class as completed?\n이 수업을 완료 처리하시겠습니까?"
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage(
          "Unable to verify your login. / 로그인 정보를 확인할 수 없습니다."
        );
        setLoading(false);
        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (
        profileError ||
        !profile ||
        profile.role !== "teacher"
      ) {
        setErrorMessage(
          "Teacher access is required. / 강사 권한이 필요합니다."
        );
        setLoading(false);
        return;
      }

      const now = new Date().toISOString();

      const {
        data: updatedSession,
        error: updateError,
      } = await supabase
        .from("class_sessions")
        .update({
          status: "completed",
          updated_at: now,
        })
        .eq("id", sessionId)
        .eq("status", "scheduled")
        .select("id");

      if (updateError) {
        setErrorMessage(
          `Class completion failed: ${updateError.message} / code: ${updateError.code}`
        );
        setLoading(false);
        return;
      }

      if (
        !updatedSession ||
        updatedSession.length === 0
      ) {
        setErrorMessage(
          "The class could not be completed. Please refresh and try again. / 수업 완료 처리에 실패했습니다."
        );
        setLoading(false);
        return;
      }

      router.refresh();
    } catch (error) {
      console.error(
        "COMPLETE CLASS ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `Class completion error: ${error.message}`
          : "An unknown error occurred."
      );

      setLoading(false);
    }
  }

  return (
    <div
      style={{
        marginTop: "24px",
      }}
    >
      <button
        type="button"
        onClick={handleCompleteClass}
        disabled={loading}
        style={{
          padding: "14px 22px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          background: "transparent",
          color: "inherit",
          cursor: loading
            ? "default"
            : "pointer",
          fontSize: "16px",
          fontWeight: 700,
        }}
      >
        {loading
          ? "Completing..."
          : "Complete Class"}

        <div
          style={{
            marginTop: "4px",
            fontSize: "11px",
            opacity: 0.6,
            fontWeight: 400,
          }}
        >
          {loading
            ? "처리 중..."
            : "수업 완료"}
        </div>
      </button>

      {errorMessage && (
        <div
          style={{
            marginTop: "14px",
            padding: "14px",
            border: "1px solid #d93025",
            borderRadius: "8px",
            color: "#d93025",
          }}
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}