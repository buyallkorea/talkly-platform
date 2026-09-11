import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import CompleteClassButton from "./CompleteClassButton";
import TeacherNoteForm from "./TeacherNoteForm";
import EvaluationForm from "./EvaluationForm";

type PageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function TeacherClassDetailPage({
  params,
}: PageProps) {
  const { sessionId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "teacher") {
    redirect("/");
  }

  const { data: session, error: sessionError } =
    await supabase
      .from("class_sessions")
      .select(`
        id,
        enrollment_id,
        lesson_number,
        scheduled_start,
        scheduled_end,
        status,
        meeting_provider,
        meeting_url,
        teacher_notes,
        class_feedback
      `)
      .eq("id", Number(sessionId))
      .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session) {
    notFound();
  }

  const { data: enrollment, error: enrollmentError } =
    await supabase
      .from("enrollments")
      .select(`
        id,
        student_user_id,
        child_id,
        course_id,
        teacher_user_id,
        status,
        total_lessons
      `)
      .eq("id", session.enrollment_id)
      .eq("teacher_user_id", user.id)
      .maybeSingle();

  if (enrollmentError) {
    throw new Error(enrollmentError.message);
  }

  if (!enrollment) {
    notFound();
  }

  let studentName = "Student";

  if (enrollment.child_id) {
    const { data: child } = await supabase
      .from("children")
      .select("name")
      .eq("id", enrollment.child_id)
      .maybeSingle();

    if (child?.name) {
      studentName = child.name;
    }
  } else if (enrollment.student_user_id) {
    const { data: student } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", enrollment.student_user_id)
      .maybeSingle();

    if (student?.name) {
      studentName = student.name;
    }
  }

  const { data: course } = await supabase
    .from("courses")
    .select("name")
    .eq("id", enrollment.course_id)
    .maybeSingle();

  const { data: attendance, error: attendanceError } =
    await supabase
      .from("attendance")
      .select(`
        id,
        status,
        attended_at,
        note,
        created_at,
        updated_at
      `)
      .eq("class_session_id", session.id)
      .maybeSingle();

  if (attendanceError) {
    throw new Error(attendanceError.message);
  }

  const { data: hold, error: holdError } =
    await supabase
      .from("class_holds")
      .select(`
        id,
        status,
        reason,
        requested_at,
        reviewed_at,
        admin_note
      `)
      .eq("class_session_id", session.id)
      .order("requested_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  if (holdError) {
    throw new Error(holdError.message);
  }

  const { data: lastSessionData, error: lastSessionError } =
    await supabase
      .from("class_sessions")
      .select("lesson_number")
      .eq("enrollment_id", enrollment.id)
      .order("lesson_number", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (lastSessionError) {
    throw new Error(lastSessionError.message);
  }

  const finalLessonNumber =
    typeof enrollment.total_lessons === "number" &&
    enrollment.total_lessons > 0
      ? enrollment.total_lessons
      : lastSessionData?.lesson_number ?? null;

  const isFinalLesson =
    finalLessonNumber !== null &&
    session.lesson_number === finalLessonNumber;

  let evaluation: {
    id: number;
    participation_score: number | null;
    comprehension_score: number | null;
    speaking_score: number | null;
    pronunciation_score: number | null;
    strengths: string | null;
    improvements: string | null;
    homework: string | null;
    teacher_comment: string | null;
  } | null = null;

  if (isFinalLesson) {
    const { data: evaluationData, error: evaluationError } =
      await supabase
        .from("evaluations")
        .select(`
          id,
          participation_score,
          comprehension_score,
          speaking_score,
          pronunciation_score,
          strengths,
          improvements,
          homework,
          teacher_comment
        `)
        .eq("class_session_id", session.id)
        .maybeSingle();

    if (evaluationError) {
      throw new Error(evaluationError.message);
    }

    evaluation = evaluationData;
  }

  function getSessionStatus(status: string) {
    switch (status) {
      case "scheduled":
        return {
          en: "Scheduled",
          ko: "예정",
        };

      case "completed":
        return {
          en: "Completed",
          ko: "수업 완료",
        };

      case "cancelled":
        return {
          en: "Cancelled",
          ko: "수업 취소",
        };

      case "no_show":
        return {
          en: "No Show",
          ko: "무단결석",
        };

      case "held":
        return {
          en: "Class Hold",
          ko: "결석 승인",
        };

      default:
        return {
          en: status,
          ko: "",
        };
    }
  }

  function getAttendanceStatus(status: string) {
    switch (status) {
      case "present":
        return {
          en: "Present",
          ko: "출석",
        };

      case "late":
        return {
          en: "Late",
          ko: "지각",
        };

      case "absent":
        return {
          en: "Absent",
          ko: "결석",
        };

      case "excused":
        return {
          en: "Excused Absence",
          ko: "인정결석",
        };

      case "teacher_absent":
        return {
          en: "Teacher Absent",
          ko: "강사결석",
        };

      default:
        return {
          en: status,
          ko: "",
        };
    }
  }

  function getHoldStatus(status: string) {
    switch (status) {
      case "requested":
        return {
          en: "Pending Review",
          ko: "확인 대기중",
        };

      case "approved":
        return {
          en: "Approved",
          ko: "승인 완료",
        };

      case "rejected":
        return {
          en: "Rejected",
          ko: "거절",
        };

      case "cancelled":
        return {
          en: "Cancelled",
          ko: "신청 취소",
        };

      default:
        return {
          en: status,
          ko: "",
        };
    }
  }

  function formatEnglishDateTime(value: string | null) {
    if (!value) {
      return "-";
    }

    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(value));
  }

  function formatKoreanDateTime(value: string | null) {
    if (!value) {
      return "-";
    }

    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  }

  function getDurationMinutes(
    start: string,
    end: string
  ) {
    return Math.round(
      (new Date(end).getTime() -
        new Date(start).getTime()) /
        60000
    );
  }

  const sessionStatus =
    getSessionStatus(session.status);

  const attendanceStatus = attendance
    ? getAttendanceStatus(attendance.status)
    : null;

  const holdStatus = hold
    ? getHoldStatus(hold.status)
    : null;

  const now = new Date();

  const scheduledStart =
    new Date(session.scheduled_start);

  const isClassStarted =
    now.getTime() >=
    scheduledStart.getTime();

  const isAttendanceBlocked =
    session.status === "held" ||
    session.status === "cancelled";

  const canEditAttendance =
    Boolean(attendance) &&
    !isAttendanceBlocked;

  const canRecordAttendance =
    !attendance &&
    isClassStarted &&
    !isAttendanceBlocked;

  const canManageAttendance =
    canEditAttendance ||
    canRecordAttendance;

  const currentSessionStatus = session.status;

  function getAttendanceUnavailableMessage() {
    if (currentSessionStatus === "held") {
      return {
        en: "Attendance is not required for an approved Class Hold.",
        ko: "결석 승인이 완료된 수업은 출석 등록이 필요하지 않습니다.",
      };
    }

    if (currentSessionStatus === "cancelled") {
      return {
        en: "Attendance cannot be recorded for a cancelled class.",
        ko: "취소된 수업은 출석을 등록할 수 없습니다.",
      };
    }

    if (!isClassStarted) {
      return {
        en: "Attendance will be available after the class starts.",
        ko: "수업 시작 이후 출석을 등록할 수 있습니다.",
      };
    }

    return {
      en: "Attendance is currently unavailable.",
      ko: "현재 출석 등록을 사용할 수 없습니다.",
    };
  }

  const attendanceUnavailable =
    getAttendanceUnavailableMessage();

  return (
    <main
      style={{
        padding: "40px",
        maxWidth: "950px",
        margin: "0 auto",
      }}
    >
      <Link
        href="/teacher"
        style={{
          textDecoration: "none",
        }}
      >
        ← My Classes

        <div
          style={{
            marginTop: "3px",
            fontSize: "12px",
            opacity: 0.55,
          }}
        >
          내 수업
        </div>
      </Link>

      <div
        style={{
          marginTop: "32px",
        }}
      >
        <h1
          style={{
            marginBottom: "4px",
            fontSize: "32px",
          }}
        >
          Lesson {session.lesson_number}
        </h1>

        <div
          style={{
            fontSize: "13px",
            opacity: 0.6,
          }}
        >
          {session.lesson_number}회차 수업
        </div>
      </div>

      <section
        style={{
          marginTop: "32px",
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
          Class Details
        </h2>

        <div
          style={{
            fontSize: "13px",
            opacity: 0.6,
            marginBottom: "22px",
          }}
        >
          수업 상세
        </div>

        <p>
          <strong>Student:</strong>{" "}
          {studentName}
        </p>

        <div
          style={{
            marginTop: "-8px",
            marginBottom: "16px",
            fontSize: "12px",
            opacity: 0.55,
          }}
        >
          학생
        </div>

        <p>
          <strong>Course:</strong>{" "}
          {course?.name || "-"}
        </p>

        <div
          style={{
            marginTop: "-8px",
            marginBottom: "16px",
            fontSize: "12px",
            opacity: 0.55,
          }}
        >
          과정
        </div>

        <p>
          <strong>Schedule:</strong>{" "}
          {formatEnglishDateTime(
            session.scheduled_start
          )}
        </p>

        <div
          style={{
            marginTop: "-8px",
            marginBottom: "16px",
            fontSize: "12px",
            opacity: 0.55,
          }}
        >
          {formatKoreanDateTime(
            session.scheduled_start
          )}
        </div>

        <p>
          <strong>Duration:</strong>{" "}
          {getDurationMinutes(
            session.scheduled_start,
            session.scheduled_end
          )}{" "}
          min
        </p>

        <div
          style={{
            marginTop: "-8px",
            marginBottom: "16px",
            fontSize: "12px",
            opacity: 0.55,
          }}
        >
          수업시간
        </div>

        <p>
          <strong>Status:</strong>{" "}
          {sessionStatus.en}
        </p>

        <div
          style={{
            marginTop: "-8px",
            marginBottom: "16px",
            fontSize: "12px",
            opacity: 0.55,
          }}
        >
          {sessionStatus.ko}
        </div>

        <p>
          <strong>Platform:</strong>{" "}
          {session.meeting_provider || "-"}
        </p>

        <div
          style={{
            marginTop: "-8px",
            marginBottom: "16px",
            fontSize: "12px",
            opacity: 0.55,
          }}
        >
          화상수업 플랫폼
        </div>

        <div>
          <strong>Meeting:</strong>{" "}
          {session.meeting_url ? (
            <a
              href={session.meeting_url}
              target="_blank"
              rel="noreferrer"
            >
              Join Class
            </a>
          ) : (
            "Not available yet"
          )}

          <div
            style={{
              marginTop: "3px",
              fontSize: "12px",
              opacity: 0.55,
            }}
          >
            수업 입장
          </div>
        </div>
      </section>

      {hold && (
        <section
          style={{
            marginTop: "24px",
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
            Class Hold
          </h2>

          <div
            style={{
              fontSize: "13px",
              opacity: 0.6,
              marginBottom: "22px",
            }}
          >
            결석신청
          </div>

          <p>
            <strong>Status:</strong>{" "}
            {holdStatus?.en}
          </p>

          <div
            style={{
              marginTop: "-8px",
              marginBottom: "16px",
              fontSize: "12px",
              opacity: 0.55,
            }}
          >
            {holdStatus?.ko}
          </div>

          <p>
            <strong>Reason:</strong>
          </p>

          <div
            style={{
              padding: "14px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              whiteSpace: "pre-wrap",
            }}
          >
            {hold.reason || "-"}
          </div>

          <div
            style={{
              marginTop: "5px",
              fontSize: "12px",
              opacity: 0.55,
            }}
          >
            신청사유
          </div>

          {hold.admin_note && (
            <>
              <p
                style={{
                  marginTop: "20px",
                }}
              >
                <strong>
                  Admin Note:
                </strong>
              </p>

              <div
                style={{
                  padding: "14px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  whiteSpace: "pre-wrap",
                }}
              >
                {hold.admin_note}
              </div>

              <div
                style={{
                  marginTop: "5px",
                  fontSize: "12px",
                  opacity: 0.55,
                }}
              >
                관리자 안내
              </div>
            </>
          )}
        </section>
      )}
            <section
        style={{
          marginTop: "24px",
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
          Attendance
        </h2>

        <div
          style={{
            fontSize: "13px",
            opacity: 0.6,
            marginBottom: "22px",
          }}
        >
          출석 관리
        </div>

        {attendance ? (
          <>
            <p>
              <strong>
                Current Status:
              </strong>{" "}
              {attendanceStatus?.en}
            </p>

            <div
              style={{
                marginTop: "-8px",
                marginBottom: "16px",
                fontSize: "12px",
                opacity: 0.55,
              }}
            >
              {attendanceStatus?.ko}
            </div>

            <p>
              <strong>
                Checked At:
              </strong>{" "}
              {formatEnglishDateTime(
                attendance.attended_at
              )}
            </p>

            <div
              style={{
                marginTop: "-8px",
                marginBottom: "16px",
                fontSize: "12px",
                opacity: 0.55,
              }}
            >
              {formatKoreanDateTime(
                attendance.attended_at
              )}
            </div>

            {attendance.note && (
              <>
                <p>
                  <strong>
                    Attendance Note:
                  </strong>
                </p>

                <div
                  style={{
                    padding: "14px",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {attendance.note}
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "12px",
                    opacity: 0.55,
                  }}
                >
                  출석 메모
                </div>
              </>
            )}
          </>
        ) : (
          <div
            style={{
              padding: "20px",
              border: "1px dashed #ccc",
              borderRadius: "8px",
            }}
          >
            <strong>
              Attendance has not been recorded yet.
            </strong>

            <div
              style={{
                marginTop: "5px",
                fontSize: "12px",
                opacity: 0.55,
              }}
            >
              아직 출석정보가 등록되지 않았습니다.
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: "22px",
          }}
        >
          {canManageAttendance ? (
            <Link
              href={`/teacher/classes/${session.id}/attendance`}
              style={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "12px 18px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                textDecoration: "none",
                color: "inherit",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <span>
                {attendance
                  ? "Edit Attendance"
                  : "Record Attendance"}
              </span>

              <span
                style={{
                  marginTop: "3px",
                  fontSize: "11px",
                  opacity: 0.55,
                  fontWeight: 400,
                }}
              >
                {attendance
                  ? "출석 수정"
                  : "출석 등록"}
              </span>
            </Link>
          ) : (
            <div
              style={{
                padding: "14px 16px",
                border: "1px dashed #ccc",
                borderRadius: "8px",
              }}
            >
              <strong>
                {attendanceUnavailable.en}
              </strong>

              <div
                style={{
                  marginTop: "5px",
                  fontSize: "12px",
                  opacity: 0.6,
                }}
              >
                {attendanceUnavailable.ko}
              </div>
            </div>
          )}
        </div>

        <CompleteClassButton
          sessionId={session.id}
          currentStatus={session.status}
          attendanceStatus={
            attendance?.status ?? null
          }
        />
      </section>

      <section
        style={{
          marginTop: "24px",
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
          Teacher Note
        </h2>

        <div
          style={{
            fontSize: "13px",
            opacity: 0.6,
          }}
        >
          강사 내부 메모
        </div>

        <TeacherNoteForm
          sessionId={session.id}
          initialNote={
            session.teacher_notes
          }
        />
      </section>



      <section
        style={{
          marginTop: "24px",
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
          {isFinalLesson
            ? "Final Teacher Evaluation"
            : "AI Lesson Evaluation"}
        </h2>

        <div
          style={{
            fontSize: "13px",
            opacity: 0.6,
          }}
        >
          {isFinalLesson
            ? "최종 강사 종합평가"
            : "회차별 평가는 TALKLY AI가 분석합니다."}
        </div>

        {!isFinalLesson ? (
          <div
            style={{
              marginTop: "20px",
              padding: "18px",
              border: "1px dashed #cbd5e1",
              borderRadius: "10px",
              background: "#f8fbff",
              lineHeight: 1.7,
            }}
          >
            <strong>
              No teacher evaluation is required for this lesson.
            </strong>
            <div
              style={{
                marginTop: "6px",
                fontSize: "12px",
                opacity: 0.65,
              }}
            >
              매 회차 수업은 TALKLY AI가 문법·어휘·표현·발음·유창성 등을
              분석합니다. 강사의 학생 종합평가는 마지막 수업 종료 후 한 번만
              작성합니다.
            </div>
          </div>
        ) : session.status !== "completed" ? (
          <div
            style={{
              marginTop: "20px",
              padding: "18px",
              border: "1px dashed #cbd5e1",
              borderRadius: "10px",
              background: "#fffdf7",
              lineHeight: 1.7,
            }}
          >
            <strong>
              Final evaluation will be available after the last class is completed.
            </strong>
            <div
              style={{
                marginTop: "6px",
                fontSize: "12px",
                opacity: 0.65,
              }}
            >
              마지막 수업을 완료한 뒤 전체 수강기간을 기준으로 종합평가를
              작성해 주세요.
            </div>
          </div>
        ) : (
          <EvaluationForm
            sessionId={session.id}
            initialEvaluation={evaluation}
          />
        )}
      </section>
    </main>
  );
}