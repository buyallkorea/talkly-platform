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
          "Unable to verify your login."
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
          "Teacher access is required."
        );
        setLoading(false);
        return;
      }

      const {
        data: session,
        error: sessionError,
      } = await supabase
        .from("class_sessions")
        .select("id, enrollment_id, teacher_user_id, is_external_teacher")
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
          "Class not found."
        );
        setLoading(false);
        return;
      }

      const {
        data: enrollment,
        error: enrollmentError,
      } = await supabase
        .from("enrollments")
        .select("id, teacher_user_id")
        .eq("id", session.enrollment_id)
        .maybeSingle();

      if (enrollmentError) {
        setErrorMessage(
          `Unable to verify assignment: ${enrollmentError.message}`
        );
        setLoading(false);
        return;
      }

      if (
        !enrollment ||
        session.is_external_teacher === true ||
        (session.teacher_user_id ?? enrollment.teacher_user_id) !== user.id
      ) {
        setErrorMessage(
          "This class is not assigned to you."
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
          "Class feedback was not saved."
        );
        setLoading(false);
        return;
      }

      setSuccessMessage(
        "Class feedback saved."
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
        Shareable class feedback
      </div>

      <textarea
        id="classFeedback"
        value={feedback}
        onChange={(event) =>
          setFeedback(event.target.value)
        }
        rows={7}
        maxLength={3000}
        placeholder="Write feedback that can be shared with the student and parent."
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
          Your student and their parent can read this feedback.
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
            ? "Saving..."
            : "Save class feedback"}
        </div>
      </button>
    </form>
  );
}