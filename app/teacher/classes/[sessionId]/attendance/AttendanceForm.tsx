"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type ExistingAttendance = {
  id: number;
  status: string;
  note: string | null;
};

type Props = {
  sessionId: number;
  existingAttendance: ExistingAttendance | null;
};

const ATTENDANCE_OPTIONS = [
  {
    value: "present",
    en: "Present",
    ko: "출석",
  },
  {
    value: "late",
    en: "Late",
    ko: "지각",
  },
  {
    value: "absent",
    en: "Absent",
    ko: "결석",
  },
  {
    value: "excused",
    en: "Excused Absence",
    ko: "인정결석",
  },
  {
    value: "teacher_absent",
    en: "Teacher Absent",
    ko: "강사결석",
  },
];

export default function AttendanceForm({
  sessionId,
  existingAttendance,
}: Props) {
  const router = useRouter();

  const [status, setStatus] = useState(
    existingAttendance?.status || "present"
  );

  const [note, setNote] = useState(
    existingAttendance?.note || ""
  );

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setLoading(true);

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

      if (existingAttendance) {
        const {
          data: updatedAttendance,
          error: updateError,
        } = await supabase
          .from("attendance")
          .update({
            status,
            note: note.trim() || null,
            updated_at: now,
          })
          .eq("id", existingAttendance.id)
          .eq("class_session_id", sessionId)
          .select("id");

        if (updateError) {
          setErrorMessage(
            `Attendance update failed: ${updateError.message} / code: ${updateError.code}`
          );
          setLoading(false);
          return;
        }

        if (
          !updatedAttendance ||
          updatedAttendance.length === 0
        ) {
          setErrorMessage(
            "Attendance was not updated. / 출석정보가 수정되지 않았습니다."
          );
          setLoading(false);
          return;
        }
      } else {
        const {
          data: insertedAttendance,
          error: insertError,
        } = await supabase
          .from("attendance")
          .insert({
            class_session_id: sessionId,
            status,
            attended_at: now,
            note: note.trim() || null,
            created_at: now,
            updated_at: now,
          })
          .select("id")
          .single();

        if (insertError) {
          setErrorMessage(
            `Attendance save failed: ${insertError.message} / code: ${insertError.code}`
          );
          setLoading(false);
          return;
        }

        if (!insertedAttendance) {
          setErrorMessage(
            "Attendance could not be saved. / 출석정보를 저장하지 못했습니다."
          );
          setLoading(false);
          return;
        }
      }

      router.push(
        `/teacher/classes/${sessionId}`
      );

      router.refresh();
    } catch (error) {
      console.error(
        "ATTENDANCE SAVE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `Attendance error: ${error.message}`
          : "An unknown attendance error occurred."
      );

      setLoading(false);
    }
  }

  return (
    <section
      style={{
        padding: "28px",
        border: "1px solid #ddd",
        borderRadius: "14px",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          marginBottom: "4px",
        }}
      >
        Attendance Status
      </h2>

      <div
        style={{
          fontSize: "13px",
          opacity: 0.6,
          marginBottom: "24px",
        }}
      >
        출석 상태
      </div>

      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {ATTENDANCE_OPTIONS.map(
            (option) => (
              <label
                key={option.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "14px 16px",
                  border: "1px solid #ddd",
                  borderRadius: "9px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="attendance"
                  value={option.value}
                  checked={
                    status === option.value
                  }
                  onChange={(event) =>
                    setStatus(
                      event.target.value
                    )
                  }
                />

                <div>
                  <strong
                    style={{
                      fontSize: "16px",
                    }}
                  >
                    {option.en}
                  </strong>

                  <div
                    style={{
                      marginTop: "3px",
                      fontSize: "12px",
                      opacity: 0.55,
                    }}
                  >
                    {option.ko}
                  </div>
                </div>
              </label>
            )
          )}
        </div>

        <div
          style={{
            marginTop: "28px",
          }}
        >
          <label
            htmlFor="attendanceNote"
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: 700,
            }}
          >
            Attendance Note
          </label>

          <div
            style={{
              marginBottom: "10px",
              fontSize: "12px",
              opacity: 0.55,
            }}
          >
            출석 메모
          </div>

          <textarea
            id="attendanceNote"
            value={note}
            onChange={(event) =>
              setNote(event.target.value)
            }
            rows={6}
            maxLength={1000}
            placeholder="Add a note if needed. / 필요한 경우 메모를 입력하세요."
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
        </div>

        {errorMessage && (
          <div
            style={{
              marginTop: "18px",
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
            marginTop: "26px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "14px 22px",
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
              ? "Saving..."
              : existingAttendance
              ? "Update Attendance"
              : "Save Attendance"}

            <div
              style={{
                marginTop: "3px",
                fontSize: "11px",
                fontWeight: 400,
                opacity: 0.6,
              }}
            >
              {existingAttendance
                ? "출석 수정"
                : "출석 저장"}
            </div>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              router.push(
                `/teacher/classes/${sessionId}`
              )
            }
            style={{
              padding: "14px 22px",
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
            Cancel

            <div
              style={{
                marginTop: "3px",
                fontSize: "11px",
                fontWeight: 400,
                opacity: 0.6,
              }}
            >
              취소
            </div>
          </button>
        </div>
      </form>
    </section>
  );
}