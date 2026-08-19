"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Props = {
  sessionId: number;
  initialNote: string | null;
};

export default function TeacherNoteForm({
  sessionId,
  initialNote,
}: Props) {
  const router = useRouter();

  const [note, setNote] = useState(
    initialNote || ""
  );

  const [loading, setLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

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
        .eq(
          "id",
          session.enrollment_id
        )
        .eq(
          "teacher_user_id",
          user.id
        )
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

      const now =
        new Date().toISOString();

      const {
        data: updatedSession,
        error: updateError,
      } = await supabase
        .from("class_sessions")
        .update({
          teacher_notes:
            note.trim() || null,
          updated_at: now,
        })
        .eq("id", sessionId)
        .select("id");

      if (updateError) {
        setErrorMessage(
          `Teacher note save failed: ${updateError.message} / code: ${updateError.code}`
        );
        setLoading(false);
        return;
      }

      if (
        !updatedSession ||
        updatedSession.length === 0
      ) {
        setErrorMessage(
          "Teacher note was not saved. / 강사 메모가 저장되지 않았습니다."
        );
        setLoading(false);
        return;
      }

      setSuccessMessage(
        "Teacher note saved. / 강사 메모가 저장되었습니다."
      );

      router.refresh();
    } catch (error) {
      console.error(
        "TEACHER NOTE SAVE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `Teacher note error: ${error.message}`
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
        htmlFor="teacherNote"
        style={{
          display: "block",
          marginBottom: "8px",
          fontWeight: 700,
        }}
      >
        Class Note
      </label>

      <div
        style={{
          marginBottom: "10px",
          fontSize: "12px",
          opacity: 0.55,
        }}
      >
        수업 메모
      </div>

      <textarea
        id="teacherNote"
        value={note}
        onChange={(event) =>
          setNote(
            event.target.value
          )
        }
        rows={7}
        maxLength={3000}
        placeholder="Add class notes, student progress, homework, or anything the next teacher should know. / 수업내용, 학습진도, 숙제, 특이사항 등을 입력하세요."
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
        {note.length} / 3000
      </div>

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

      {successMessage && (
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            border:
              "1px solid #ddd",
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
          : "Save Teacher Note"}

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
            : "강사 메모 저장"}
        </div>
      </button>
    </form>
  );
}