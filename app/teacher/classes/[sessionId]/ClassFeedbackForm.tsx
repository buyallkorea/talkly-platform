"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Props = {
  sessionId: number;
  initialFeedback: string | null;
};

export default function ClassFeedbackForm({
  sessionId,
  initialFeedback,
}: Props) {
  const router = useRouter();

  const [feedback, setFeedback] = useState(
    initialFeedback || ""
  );

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

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

      const {
        data: session,
        error: sessionError,
      } = await supabase
        .from("class_sessions")
        .select(`
          id,
          enrollment_id
        `)
        .eq("id", sessionId)
        .maybeSingle();

      if (sessionError) {
        setErrorMessage(
          `Unable to verify class: ${sessionError.message}`
        );
        setLoading(false);
        return;
      }

      if (!session) {
        setErrorMessage(
          "Class not found. / 수업정보를 찾을 수 없습니다."
        );
        setLoading(false);
        return;
      }

      const {
        data: enrollment,
        error: enrollmentError,
      } = await supabase
        .from("enrollments")
        .select("id")
        .eq("id", session.enrollment_id)
        .eq("teacher_user_id", user.id)
        .maybeSingle();

      if (enrollmentError) {
        setErrorMessage(
          `Unable to verify assignment: ${enrollmentError.message}`
        );
        setLoading(false);
        return;
      }

      if (!enrollment) {
        setErrorMessage(
          "This class is not assigned to you. / 본인에게 배정된 수업이 아닙니다."
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
          class_feedback:
            feedback.trim() || null,
          updated_at: now,
        })
        .eq("id", sessionId)
        .select("id");

      if (updateError) {
        setErrorMessage(
          `Class feedback save failed: ${updateError.message} / code: ${updateError.code}`
        );
        setLoading(false);
        return;
      }

      if (
        !updatedSession ||
        updatedSession.length === 0
      ) {
        setErrorMessage(
          "Class feedback was not saved. / 수업 피드백이 저장되지 않았습니다."
        );
        setLoading(false);
        return;
      }

      setSuccessMessage(
        "Class feedback saved. / 수업 피드백이 저장되었습니다."
      );

      router.refresh();
    } catch (error) {
      console.error(
        "CLASS FEEDBACK SAVE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `Class feedback error: ${error.message}`
          : "An unknown error occurred."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: "18px",
      }}
    >
      <label
        htmlFor="classFeedback"
        style={{
          display: "block",
          marginBottom: "8px",
          fontWeight: 700,
        }}
      >
        Feedback for Student / Parent
      </label>

      <div
        style={{
          marginBottom: "10px",
          fontSize: "12px",
          opacity: 0.55,
        }}
      >
        학생·학부모 공개용 수업 피드백
      </div>

      <textarea
        id="classFeedback"
        value={feedback}
        onChange={(event) =>
          setFeedback(event.target.value)
        }
        rows={7}
        maxLength={3000}
        placeholder="Write feedback that can be shared with the student and parent. / 학생과 학부모에게 공개할 수업 피드백을 입력하세요."
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "14px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          fontSize: "15px",
          lineHeight: 1.6,
          resize: "vertical",
        }}
      />

      <div
        style={{
          marginTop: "6px",
          fontSize: "11px",
          opacity: 0.5,
          textAlign: "right",
        }}
      >
        {feedback.length} / 3000
      </div>

      <div
        style={{
          marginTop: "14px",
          padding: "14px",
          border: "1px dashed #ccc",
          borderRadius: "8px",
          fontSize: "13px",
          lineHeight: 1.6,
        }}
      >
        <strong>
          This feedback will be visible to the student and parent.
        </strong>

        <div
          style={{
            marginTop: "4px",
            fontSize: "12px",
            opacity: 0.6,
          }}
        >
          이 내용은 학생과 학부모에게 공개됩니다.
        </div>
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

      {successMessage && (
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            border: "1px solid #ddd",
            borderRadius: "8px",
          }}
        >
          {successMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          marginTop: "18px",
          padding: "13px 20px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          background: "transparent",
          color: "inherit",
          fontSize: "15px",
          fontWeight: 700,
          cursor: loading
            ? "default"
            : "pointer",
        }}
      >
        {loading
          ? "Saving..."
          : "Save Class Feedback"}

        <div
          style={{
            marginTop: "3px",
            fontSize: "11px",
            opacity: 0.55,
            fontWeight: 400,
          }}
        >
          {loading
            ? "저장 중..."
            : "수업 피드백 저장"}
        </div>
      </button>
    </form>
  );
}