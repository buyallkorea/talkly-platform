"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Props = {
  childId: number;
  sessionId: number;
};

export default function HoldRequestForm({
  childId,
  sessionId,
}: Props) {
  const router = useRouter();

  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (!reason.trim()) {
      setErrorMessage("결석 사유를 입력해주세요.");
      return;
    }

    if (reason.trim().length < 2) {
      setErrorMessage(
        "결석 사유를 조금 더 자세히 입력해주세요."
      );
      return;
    }

    const confirmed = window.confirm(
      "이 수업에 대한 결석신청을 접수하시겠습니까?"
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);

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
        setLoading(false);
        return;
      }

      // 학부모 계정 확인
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
        profile.role !== "parent"
      ) {
        setErrorMessage(
          "학부모 계정에서만 결석신청을 할 수 있습니다."
        );
        setLoading(false);
        return;
      }

      // 본인의 자녀인지 다시 확인
      const {
        data: child,
        error: childError,
      } = await supabase
        .from("children")
        .select("id")
        .eq("id", childId)
        .eq("parent_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (childError) {
        setErrorMessage(
          `자녀 정보 확인 실패: ${childError.message}`
        );
        setLoading(false);
        return;
      }

      if (!child) {
        setErrorMessage(
          "결석신청 권한이 없는 학생입니다."
        );
        setLoading(false);
        return;
      }

      // 대상 수업 확인
      const {
        data: session,
        error: sessionError,
      } = await supabase
        .from("class_sessions")
        .select(`
          id,
          enrollment_id,
          status
        `)
        .eq("id", sessionId)
        .maybeSingle();

      if (sessionError) {
        setErrorMessage(
          `수업정보 확인 실패: ${sessionError.message}`
        );
        setLoading(false);
        return;
      }

      if (!session) {
        setErrorMessage(
          "해당 수업을 찾을 수 없습니다."
        );
        setLoading(false);
        return;
      }

      if (session.status !== "scheduled") {
        setErrorMessage(
          "현재 결석신청이 가능한 수업이 아닙니다."
        );
        setLoading(false);
        return;
      }

      // 이 수업이 해당 자녀의 수강인지 확인
      const {
        data: enrollment,
        error: enrollmentError,
      } = await supabase
        .from("enrollments")
        .select("id")
        .eq("id", session.enrollment_id)
        .eq("child_id", childId)
        .maybeSingle();

      if (enrollmentError) {
        setErrorMessage(
          `수강정보 확인 실패: ${enrollmentError.message}`
        );
        setLoading(false);
        return;
      }

      if (!enrollment) {
        setErrorMessage(
          "해당 학생의 수업이 아닙니다."
        );
        setLoading(false);
        return;
      }

      // 중복 신청 확인
      const {
        data: existingHold,
        error: existingHoldError,
      } = await supabase
        .from("class_holds")
        .select(`
          id,
          status
        `)
        .eq("class_session_id", sessionId)
        .eq("requested_by", user.id)
        .in("status", [
          "requested",
          "approved",
        ])
        .limit(1)
        .maybeSingle();

      if (existingHoldError) {
        setErrorMessage(
          `기존 신청 확인 실패: ${existingHoldError.message}`
        );
        setLoading(false);
        return;
      }

      if (existingHold) {
        setErrorMessage(
          existingHold.status === "requested"
            ? "이미 확인 대기중인 결석신청이 있습니다."
            : "이미 승인된 결석신청이 있습니다."
        );
        setLoading(false);
        return;
      }

      const now = new Date().toISOString();

      // 실제 Class Hold 신청 생성
      const {
        data: insertedHold,
        error: insertError,
      } = await supabase
        .from("class_holds")
        .insert({
          class_session_id: sessionId,
          requested_by: user.id,
          reason: reason.trim(),
          requested_at: now,
          status: "requested",
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();

      if (insertError) {
        setErrorMessage(
          `결석신청 실패: ${insertError.message} / code: ${insertError.code}`
        );
        setLoading(false);
        return;
      }

      if (!insertedHold) {
        setErrorMessage(
          "결석신청 저장 결과를 확인할 수 없습니다."
        );
        setLoading(false);
        return;
      }

      router.push(
        `/parent/children/${childId}/classes/${sessionId}`
      );

      router.refresh();
    } catch (error) {
      console.error(
        "CLASS HOLD REQUEST ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `결석신청 오류: ${error.message}`
          : "결석신청 중 알 수 없는 오류가 발생했습니다."
      );

      setLoading(false);
    }
  }

  function handleCancel() {
    router.push(
      `/parent/children/${childId}/classes/${sessionId}`
    );
  }

  return (
    <section
      style={{
        padding: "28px",
        border: "1px solid #ddd",
        borderRadius: "12px",
      }}
    >
      <h2
        style={{
          marginTop: 0,
        }}
      >
        결석 사유
      </h2>

      <p
        style={{
          marginTop: 0,
          marginBottom: "20px",
          opacity: 0.75,
        }}
      >
        결석 사유를 입력하여 신청해주세요.
        신청 후 관리자가 내용을 확인하여 승인 또는
        거절합니다.
      </p>

      <form onSubmit={handleSubmit}>
        <label
          htmlFor="reason"
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: 700,
          }}
        >
          신청 사유
        </label>

        <textarea
          id="reason"
          value={reason}
          onChange={(event) =>
            setReason(event.target.value)
          }
          disabled={loading}
          rows={7}
          maxLength={1000}
          placeholder="예: 가족 일정으로 인해 해당 수업 참석이 어렵습니다."
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "14px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            fontSize: "16px",
            lineHeight: 1.6,
            resize: "vertical",
          }}
        />

        <div
          style={{
            marginTop: "6px",
            textAlign: "right",
            fontSize: "13px",
            opacity: 0.65,
          }}
        >
          {reason.length} / 1000
        </div>

        {errorMessage && (
          <div
            style={{
              marginTop: "16px",
              padding: "14px",
              border: "1px solid #d93025",
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
            marginTop: "24px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "13px 22px",
              border: "none",
              borderRadius: "8px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: loading
                ? "default"
                : "pointer",
            }}
          >
            {loading
              ? "결석신청 접수 중..."
              : "결석신청"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={handleCancel}
            style={{
              padding: "13px 22px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: loading
                ? "default"
                : "pointer",
            }}
          >
            취소
          </button>
        </div>
      </form>
    </section>
  );
}