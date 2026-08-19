"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Props = {
  holdId: number;
  sessionId: number;
};

export default function ClassHoldReviewForm({
  holdId,
  sessionId,
}: Props) {
  const router = useRouter();

  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState<
    "approved" | "rejected" | null
  >(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  async function reviewHold(
    status: "approved" | "rejected"
  ) {
    setErrorMessage("");
    setLoading(status);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage(
          "로그인 정보를 확인할 수 없습니다."
        );
        setLoading(null);
        return;
      }

      // 관리자 권한 확인
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
        profile.role !== "admin"
      ) {
        setErrorMessage(
          "관리자 권한을 확인할 수 없습니다."
        );
        setLoading(null);
        return;
      }

      // 현재 신청상태 확인
      const {
        data: currentHold,
        error: holdReadError,
      } = await supabase
        .from("class_holds")
        .select(`
          id,
          status
        `)
        .eq("id", holdId)
        .maybeSingle();

      if (holdReadError) {
        setErrorMessage(
          `결석신청 확인 실패: ${holdReadError.message}`
        );
        setLoading(null);
        return;
      }

      if (!currentHold) {
        setErrorMessage(
          "결석신청 정보를 찾을 수 없습니다."
        );
        setLoading(null);
        return;
      }

      if (
        currentHold.status !== "requested"
      ) {
        setErrorMessage(
          "이미 처리된 결석신청입니다."
        );
        setLoading(null);
        return;
      }

      const now =
        new Date().toISOString();

      // 결석신청 승인 / 거절
      const {
        data: updatedHold,
        error: holdUpdateError,
      } = await supabase
        .from("class_holds")
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: now,
          admin_note:
            adminNote.trim() || null,
          updated_at: now,
        })
        .eq("id", holdId)
        .eq("status", "requested")
        .select("id");

      if (holdUpdateError) {
        setErrorMessage(
          `결석신청 처리 실패: ${holdUpdateError.message} / code: ${holdUpdateError.code}`
        );
        setLoading(null);
        return;
      }

      if (
        !updatedHold ||
        updatedHold.length === 0
      ) {
        setErrorMessage(
          "결석신청 상태가 변경되어 처리할 수 없습니다."
        );
        setLoading(null);
        return;
      }

      /*
        Class Hold 승인 시
        class_sessions.status = held

        기존 TALKLY DB의 class_sessions 상태:
        scheduled
        completed
        cancelled
        no_show
        held
      */
      if (status === "approved") {
        const {
          data: updatedSession,
          error: sessionUpdateError,
        } = await supabase
          .from("class_sessions")
          .update({
            status: "held",
            updated_at: now,
          })
          .eq("id", sessionId)
          .select("id");

        if (sessionUpdateError) {
          setErrorMessage(
            `결석신청은 승인되었지만 수업 상태 변경에 실패했습니다: ${sessionUpdateError.message}`
          );
          setLoading(null);
          return;
        }

        if (
          !updatedSession ||
          updatedSession.length === 0
        ) {
          setErrorMessage(
            "결석신청은 승인되었지만 대상 수업의 상태를 변경하지 못했습니다."
          );
          setLoading(null);
          return;
        }
      }

      router.refresh();
    } catch (error) {
      console.error(
        "CLASS HOLD REVIEW ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `결석신청 처리 오류: ${error.message}`
          : "결석신청 처리 중 오류가 발생했습니다."
      );

      setLoading(null);
    }
  }

  return (
    <div
      style={{
        marginTop: "24px",
      }}
    >
      <label
        htmlFor="adminNote"
        style={{
          display: "block",
          marginBottom: "8px",
          fontWeight: 700,
        }}
      >
        관리자 메모
      </label>

      <textarea
        id="adminNote"
        value={adminNote}
        onChange={(event) =>
          setAdminNote(
            event.target.value
          )
        }
        rows={5}
        placeholder="승인 또는 거절 사유, 안내사항 등을 입력해주세요."
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "12px 14px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          fontSize: "16px",
          resize: "vertical",
        }}
      />

      {errorMessage && (
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            border:
              "1px solid #d93025",
            borderRadius: "8px",
            color: "#d93025",
          }}
        >
          {errorMessage}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "12px",
          marginTop: "20px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          disabled={loading !== null}
          onClick={() =>
            reviewHold("approved")
          }
          style={{
            padding: "13px 22px",
            border: "none",
            borderRadius: "8px",
            fontWeight: 700,
            cursor:
              loading !== null
                ? "default"
                : "pointer",
          }}
        >
          {loading === "approved"
            ? "승인 처리 중..."
            : "결석신청 승인"}
        </button>

        <button
          type="button"
          disabled={loading !== null}
          onClick={() =>
            reviewHold("rejected")
          }
          style={{
            padding: "13px 22px",
            border:
              "1px solid #ddd",
            borderRadius: "8px",
            fontWeight: 700,
            cursor:
              loading !== null
                ? "default"
                : "pointer",
          }}
        >
          {loading === "rejected"
            ? "거절 처리 중..."
            : "결석신청 거절"}
        </button>
      </div>
    </div>
  );
}