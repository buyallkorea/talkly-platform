import AssessmentEntry from "@/components/assessments/AssessmentEntry";
import TeacherClassroomLink from "@/components/teacher/TeacherClassroomLink";
import { getCurrentUser } from "@/lib/server-user";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import CompleteClassButton from "./CompleteClassButton";
import TeacherNoteForm from "./TeacherNoteForm";
import EvaluationForm from "./EvaluationForm";
import {
  getTeacherEvaluationRequirementForSession,
  getTeacherEvaluationLabel,
  type TeacherEvaluationSession,
  type ExistingTeacherEvaluation,
} from "@/lib/teacher-evaluations";

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
  } = await getCurrentUser();

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
        ended_at,
        meeting_provider,
        meeting_id,
        meeting_url,
        teacher_user_id,
        is_external_teacher,
        is_test,
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
        is_test,
        status,
        total_lessons,
        start_date
      `)
      .eq("id", session.enrollment_id)
      .maybeSingle();

  if (enrollmentError) {
    throw new Error(enrollmentError.message);
  }

  if (!enrollment) {
    notFound();
  }

  const assignedTeacherId =
    session.teacher_user_id ?? enrollment.teacher_user_id;

  const isAssignedTeacher =
    session.is_external_teacher !== true &&
    assignedTeacherId === user.id;

  const isRegularTeacher =
    enrollment.teacher_user_id === user.id;

  if (!isAssignedTeacher && !isRegularTeacher) {
    notFound();
  }

  const isTestClass = session.is_test === true || enrollment.is_test === true;

  let studentName = isTestClass ? "Admin (Test Student)" : "Student";

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

  const { data: allSessions, error: allSessionsError } = await supabase
    .from("class_sessions")
    .select("id, enrollment_id, lesson_number, scheduled_start, status")
    .eq("enrollment_id", enrollment.id)
    .order("scheduled_start", { ascending: true });

  if (allSessionsError) {
    throw new Error(allSessionsError.message);
  }

  const evaluationSessions = (allSessions ?? []) as TeacherEvaluationSession[];
  const evaluationSessionIds = evaluationSessions.map((item) => item.id);

  let existingEvaluations: ExistingTeacherEvaluation[] = [];

  if (evaluationSessionIds.length > 0) {
    const { data: evaluationMetadata, error: evaluationMetadataError } =
      await supabase
        .from("evaluations")
        .select("class_session_id, evaluation_type, period_number")
        .in("class_session_id", evaluationSessionIds);

    if (evaluationMetadataError) {
      throw new Error(evaluationMetadataError.message);
    }

    existingEvaluations = (evaluationMetadata ?? []) as ExistingTeacherEvaluation[];
  }

  const evaluationRequirement = isTestClass ? null : getTeacherEvaluationRequirementForSession({
    sessionId: session.id,
    enrollmentId: enrollment.id,
    startDate: enrollment.start_date,
    totalLessons: enrollment.total_lessons,
    sessions: evaluationSessions,
    existingEvaluations,
  });

  const evaluationLabel = evaluationRequirement
    ? getTeacherEvaluationLabel(evaluationRequirement)
    : null;

  const finalLessonNumber =
  typeof enrollment.total_lessons === "number" &&
  Number.isInteger(enrollment.total_lessons) &&
  enrollment.total_lessons > 0
    ? enrollment.total_lessons
    : null;

  const isFinalLesson =
    finalLessonNumber !== null && session.lesson_number === finalLessonNumber;

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

  if (evaluationRequirement) {
    const { data: evaluationData, error: evaluationError } = await supabase
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
          ko: "Scheduled",
        };

      case "completed":
        return {
          en: "Completed",
          ko: "Completed",
        };

      case "cancelled":
        return {
          en: "Cancelled",
          ko: "Cancelled",
        };

      case "no_show":
        return {
          en: "No Show",
          ko: "No-show",
        };

      case "held":
        return {
          en: "Class Hold",
          ko: "Excused",
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
          ko: "Present",
        };

      case "late":
        return {
          en: "Late",
          ko: "Late",
        };

      case "absent":
        return {
          en: "Absent",
          ko: "Absent",
        };

      case "excused":
        return {
          en: "Excused Absence",
          ko: "Excused absence",
        };

      case "teacher_absent":
        return {
          en: "Teacher Absent",
          ko: "Teacher absent",
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
          ko: "Pending",
        };

      case "approved":
        return {
          en: "Approved",
          ko: "Approved",
        };

      case "rejected":
        return {
          en: "Rejected",
          ko: "Rejected",
        };

      case "cancelled":
        return {
          en: "Cancelled",
          ko: "Withdrawn",
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

    return new Intl.DateTimeFormat("en-US", {
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
        ko: "No attendance record is needed for an excused lesson.",
      };
    }

    if (currentSessionStatus === "cancelled") {
      return {
        en: "Attendance cannot be recorded for a cancelled class.",
        ko: "Attendance cannot be recorded for a cancelled lesson.",
      };
    }

    if (!isClassStarted) {
      return {
        en: "Attendance will be available after the class starts.",
        ko: "Attendance is available after the lesson starts.",
      };
    }

    return {
      en: "Attendance is currently unavailable.",
      ko: "Attendance is currently unavailable.",
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
          My classes
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
          {isTestClass && (
            <span style={{ marginLeft: "12px", fontSize: "14px", color: "#b54708", fontWeight: 800 }}>
              TEST CLASS
            </span>
          )}
        </h1>

        <div
          style={{
            fontSize: "13px",
            opacity: 0.6,
          }}
        >
          Lesson {session.lesson_number} overview
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
          Lesson details
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
          Student
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
          Course
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
          Lesson duration
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
          Video platform
        </div>

        <div style={{ padding: 18, border: "2px solid #2563eb", borderRadius: 12, background: "#eff6ff" }}>
          <strong style={{ display: "block", marginBottom: 12 }}>Enter Classroom</strong>
          {session.meeting_provider === "zoom" ? <TeacherClassroomLink sessionId={session.id}
            enabled={Boolean(session.meeting_id || session.meeting_url) && ["scheduled", "in_progress"].includes(session.status) && !session.ended_at && new Date(session.scheduled_end).getTime() > new Date().getTime()} />
            : session.meeting_url ? <a href={session.meeting_url} target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", fontWeight: 800 }}>Open external class ↗</a> : <p>Meeting is not available yet.</p>}
          <p style={{ marginTop: 10, fontSize: 13, color: "#334155" }}>Choose the lesson materials, then enter the classroom.</p>
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
            Excused absence request
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
            Reason for request
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
                Administrator note
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
          Attendance
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
                  Attendance note
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
              No attendance has been recorded yet.
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: "22px",
          }}
        >
          {isAssignedTeacher && canManageAttendance ? (
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
                  ? "Edit attendance"
                  : "Record attendance"}
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

        {isAssignedTeacher && session.meeting_provider !== "zoom" && (
          <CompleteClassButton
            sessionId={session.id}
            currentStatus={session.status}
            attendanceStatus={attendance?.status ?? null}
          />
        )}
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
          Private teacher notes
        </div>

        {isAssignedTeacher ? (
          <TeacherNoteForm
            sessionId={session.id}
            initialNote={session.teacher_notes}
          />
        ) : (
          <div style={{ whiteSpace: "pre-wrap", marginTop: "18px" }}>
            {session.teacher_notes || "No lesson notes have been recorded."}
          </div>
        )}
      </section>



      {!isTestClass && (
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
          {process.env.TALKLY_ASSESSMENTS_ENABLED === "true" ? "Student Progress Evaluation" : evaluationLabel?.en ?? (isFinalLesson ? "Final Teacher Evaluation" : "AI Lesson Evaluation")}
        </h2>

        <div style={{ fontSize: "13px", opacity: 0.6 }}>
          {process.env.TALKLY_ASSESSMENTS_ENABLED === "true" ? "Write or review monthly observation" : evaluationLabel?.en ?? (isFinalLesson
            ? "Final teacher evaluation"
            : "Individual lessons are evaluated by TALKLY AI.")}
        </div>

        {process.env.TALKLY_ASSESSMENTS_ENABLED === "true" ? (
          isRegularTeacher ? <><AssessmentEntry kind="monthly" sourceId={enrollment.id} period={evaluationRequirement ? (evaluationRequirement.type === "final" ? "final" : `period-${evaluationRequirement.periodNumber}`) : undefined} />
            {evaluation && <details className="mt-4"><summary>Previous score evaluation — read only</summary><p>Participation {evaluation.participation_score ?? "—"} · Comprehension {evaluation.comprehension_score ?? "—"} · Speaking {evaluation.speaking_score ?? "—"} · Pronunciation {evaluation.pronunciation_score ?? "—"}</p><p>{evaluation.strengths}</p><p>{evaluation.improvements}</p><p>{evaluation.homework}</p><p>{evaluation.teacher_comment}</p></details>}
          </>
            : <p>Only the regular assigned teacher can write the monthly observation review.</p>
        ) : isRegularTeacher && evaluationRequirement && session.status === "completed" ? (
          <EvaluationForm
            sessionId={session.id}
            evaluationType={evaluationRequirement.type}
            periodNumber={evaluationRequirement.periodNumber}
            initialEvaluation={evaluation}
          />
        ) : (
          <div
            style={{
              marginTop: "20px",
              padding: "18px",
              border: "1px dashed #cbd5e1",
              borderRadius: "10px",
              background: isFinalLesson ? "#fffdf7" : "#f8fbff",
              lineHeight: 1.7,
            }}
          >
            <strong>
              {isFinalLesson && session.status !== "completed"
                ? "Final evaluation will be available after the last class is completed."
                : "No teacher evaluation is required for this lesson."}
            </strong>
            <div style={{ marginTop: "6px", fontSize: "12px", opacity: 0.65 }}>
              {isFinalLesson && session.status !== "completed"
                ? "Please complete the final evaluation after the last lesson."
                : "TALKLY AI evaluates each lesson. Teachers submit evaluations every four weeks and after the final lesson."}
            </div>
          </div>
        )}
      </section>
      )}
    </main>
  );
}