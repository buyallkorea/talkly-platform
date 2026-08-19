import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import CompleteClassButton from "./CompleteClassButton";
import TeacherNoteForm from "./TeacherNoteForm";
import EvaluationForm from "./EvaluationForm";
import TalklyUserHeader from "@/components/TalklyUserHeader";

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
        started_at,
        ended_at,
        status,
        meeting_provider,
        meeting_url,
        teacher_notes
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
        status
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

  const { data: evaluation, error: evaluationError } =
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

  function getSessionStatus(status: string) {
    switch (status) {
      case "scheduled":
        return {
          en: "Scheduled",
          ko: "예정",
        };

      case "in_progress":
        return {
          en: "In Progress",
          ko: "수업 진행 중",
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

  const actualDurationMinutes =
    session.started_at && session.ended_at
      ? getDurationMinutes(
          session.started_at,
          session.ended_at
        )
      : null;

  const isClassStarted =
    now.getTime() >= scheduledStart.getTime();

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

  function getAttendanceUnavailableMessage(
    status: string
  ) {
    if (status === "held") {
      return {
        en: "Attendance is not required for an approved Class Hold.",
        ko: "결석 승인이 완료된 수업은 출석 등록이 필요하지 않습니다.",
      };
    }

    if (status === "cancelled") {
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
    getAttendanceUnavailableMessage(
      session.status
    );

  return (
    <div className="talkly-dashboard">
      <TalklyUserHeader
        role="teacher"
        userName={profile.name}
      />

      <main className="talkly-dashboard-main">
        <div style={{ marginBottom: "20px" }}>
          <Link
            href="/teacher"
            style={{
              color: "var(--talkly-blue)",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 800,
            }}
          >
            ← 내 수업
          </Link>
        </div>

        <section
          style={{
            position: "relative",
            overflow: "hidden",
            padding: "32px",
            borderRadius: "22px",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f1f6ff 65%, #e8f1ff 100%)",
            border: "1px solid #e1e9f5",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "24px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="talkly-section-label">
                CLASS DETAIL
              </div>

              <h1
                className="talkly-dashboard-title"
                style={{ marginTop: "6px" }}
              >
                {studentName} · {session.lesson_number}회차
              </h1>

              <p
                style={{
                  margin: "8px 0 0",
                  color: "var(--text-secondary)",
                  fontSize: "15px",
                }}
              >
                {course?.name || "-"} ·{" "}
                {formatKoreanDateTime(session.scheduled_start)}
              </p>
            </div>

            <span
              className={
                session.status === "completed"
                  ? "talkly-badge talkly-badge-success"
                  : session.status === "scheduled" ||
                      session.status === "in_progress"
                    ? "talkly-badge talkly-badge-blue"
                    : "talkly-badge talkly-badge-neutral"
              }
            >
              {sessionStatus.ko || sessionStatus.en}
            </span>
          </div>

          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              width: "220px",
              height: "220px",
              right: "-60px",
              bottom: "-105px",
              borderRadius: "50%",
              background: "rgba(63,117,220,0.08)",
            }}
          />
        </section>

        <section
          className="talkly-card"
          style={{
            marginTop: "24px",
            padding: "28px",
          }}
        >
          <div className="talkly-section-label">
            CLASS INFORMATION
          </div>

          <h2
            style={{
              margin: "5px 0 20px",
              color: "var(--talkly-navy)",
              fontSize: "23px",
            }}
          >
            수업 정보
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "12px",
            }}
          >
            {[
              ["학생", studentName],
              ["과정", course?.name || "-"],
              [
                "예정 일시",
                formatKoreanDateTime(session.scheduled_start),
              ],
              [
                "예정 수업시간",
                `${getDurationMinutes(
                  session.scheduled_start,
                  session.scheduled_end
                )}분`,
              ],
              [
                "실제 시작",
                formatKoreanDateTime(session.started_at),
              ],
              [
                "실제 종료",
                formatKoreanDateTime(session.ended_at),
              ],
              [
                "실제 수업시간",
                actualDurationMinutes !== null
                  ? `${actualDurationMinutes}분`
                  : "-",
              ],
              [
                "학생 입장시간",
                formatKoreanDateTime(
                  attendance?.attended_at ?? null
                ),
              ],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                style={{
                  padding: "16px",
                  borderRadius: "11px",
                  background: "var(--talkly-blue-soft)",
                  border: "1px solid #e5ecf6",
                }}
              >
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  {label}
                </div>

                <div
                  style={{
                    marginTop: "6px",
                    color: "var(--talkly-navy)",
                    fontSize: "15px",
                    fontWeight: 800,
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            marginTop: "24px",
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1.3fr) minmax(300px, 0.7fr)",
            gap: "18px",
          }}
        >
          <div
            className="talkly-card"
            style={{
              padding: "28px",
            }}
          >
            <div className="talkly-section-label">
              TALKLY CLASSROOM
            </div>

            <h2
              style={{
                margin: "5px 0 0",
                color: "var(--talkly-navy)",
                fontSize: "23px",
              }}
            >
              Classroom
            </h2>

            <p
              style={{
                margin: "10px 0 0",
                color: "var(--text-muted)",
                lineHeight: 1.7,
                fontSize: "14px",
              }}
            >
              화상수업과 교재가 연결된 TALKLY 수업화면으로 이동합니다.
            </p>

            <div style={{ marginTop: "20px" }}>
              {session.meeting_provider === "zoom" ? (
                <Link
                  href={`/classroom/${session.id}`}
                  className="talkly-button talkly-button-primary"
                >
                  TALKLY Classroom 입장 →
                </Link>
              ) : (
                <div
                  style={{
                    padding: "16px",
                    border: "1px dashed var(--border)",
                    borderRadius: "10px",
                    color: "var(--text-muted)",
                  }}
                >
                  현재 사용할 수 있는 화상수업 플랫폼이 없습니다.
                </div>
              )}
            </div>
          </div>

          <div
            className="talkly-card"
            style={{
              padding: "28px",
              background:
                "linear-gradient(145deg, #0a1f44 0%, #15386f 100%)",
              color: "#ffffff",
              border: "none",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 900,
                letterSpacing: "0.08em",
                opacity: 0.7,
              }}
            >
              CLASS STATUS
            </div>

            <h2
              style={{
                margin: "8px 0 0",
                fontSize: "23px",
              }}
            >
              {sessionStatus.ko || sessionStatus.en}
            </h2>

            <p
              style={{
                margin: "12px 0 0",
                color: "rgba(255,255,255,0.72)",
                fontSize: "14px",
                lineHeight: 1.7,
              }}
            >
              플랫폼: {session.meeting_provider || "-"}
              <br />
              회차: {session.lesson_number}회차
            </p>
          </div>
        </section>

        {hold && (
          <section
            className="talkly-card"
            style={{
              marginTop: "24px",
              padding: "28px",
            }}
          >
            <div className="talkly-section-label">
              CLASS HOLD
            </div>

            <h2
              style={{
                margin: "5px 0 0",
                color: "var(--talkly-navy)",
                fontSize: "23px",
              }}
            >
              결석신청
            </h2>

            <div
              style={{
                marginTop: "18px",
                display: "flex",
                gap: "10px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span className="talkly-badge talkly-badge-neutral">
                {holdStatus?.ko || holdStatus?.en}
              </span>
            </div>

            <div
              style={{
                marginTop: "18px",
                padding: "16px",
                borderRadius: "10px",
                background: "var(--talkly-blue-soft)",
                border: "1px solid #e5ecf6",
                whiteSpace: "pre-wrap",
                color: "var(--text-secondary)",
                lineHeight: 1.7,
              }}
            >
              <strong
                style={{
                  color: "var(--talkly-navy)",
                }}
              >
                신청사유
              </strong>

              <div style={{ marginTop: "6px" }}>
                {hold.reason || "-"}
              </div>
            </div>

            {hold.admin_note && (
              <div
                style={{
                  marginTop: "14px",
                  padding: "16px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  whiteSpace: "pre-wrap",
                  color: "var(--text-secondary)",
                  lineHeight: 1.7,
                }}
              >
                <strong
                  style={{
                    color: "var(--talkly-navy)",
                  }}
                >
                  관리자 안내
                </strong>

                <div style={{ marginTop: "6px" }}>
                  {hold.admin_note}
                </div>
              </div>
            )}
          </section>
        )}

        <section
          className="talkly-card"
          style={{
            marginTop: "24px",
            padding: "28px",
          }}
        >
          <div className="talkly-section-label">
            ATTENDANCE
          </div>

          <h2
            style={{
              margin: "5px 0 0",
              color: "var(--talkly-navy)",
              fontSize: "23px",
            }}
          >
            출석 관리
          </h2>

          {attendance ? (
            <div
              style={{
                marginTop: "20px",
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(190px, 1fr))",
                gap: "12px",
              }}
            >
              <div
                style={{
                  padding: "16px",
                  borderRadius: "11px",
                  background: "var(--talkly-blue-soft)",
                  border: "1px solid #e5ecf6",
                }}
              >
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  현재 상태
                </div>

                <div
                  style={{
                    marginTop: "6px",
                    color: "var(--talkly-navy)",
                    fontSize: "16px",
                    fontWeight: 900,
                  }}
                >
                  {attendanceStatus?.ko || attendanceStatus?.en}
                </div>
              </div>

              <div
                style={{
                  padding: "16px",
                  borderRadius: "11px",
                  background: "var(--talkly-blue-soft)",
                  border: "1px solid #e5ecf6",
                }}
              >
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  등록시간
                </div>

                <div
                  style={{
                    marginTop: "6px",
                    color: "var(--talkly-navy)",
                    fontSize: "15px",
                    fontWeight: 800,
                  }}
                >
                  {formatKoreanDateTime(attendance.attended_at)}
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                marginTop: "20px",
                padding: "20px",
                border: "1px dashed var(--border)",
                borderRadius: "10px",
                color: "var(--text-muted)",
              }}
            >
              아직 출석정보가 등록되지 않았습니다.
            </div>
          )}

          {attendance?.note && (
            <div
              style={{
                marginTop: "14px",
                padding: "16px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                whiteSpace: "pre-wrap",
                color: "var(--text-secondary)",
              }}
            >
              <strong
                style={{
                  color: "var(--talkly-navy)",
                }}
              >
                출석 메모
              </strong>

              <div style={{ marginTop: "6px" }}>
                {attendance.note}
              </div>
            </div>
          )}

          <div style={{ marginTop: "20px" }}>
            {canManageAttendance ? (
              <Link
                href={`/teacher/classes/${session.id}/attendance`}
                className="talkly-button talkly-button-secondary"
              >
                {attendance ? "출석 수정" : "출석 등록"}
              </Link>
            ) : (
              <div
                style={{
                  padding: "16px",
                  border: "1px dashed var(--border)",
                  borderRadius: "10px",
                  color: "var(--text-muted)",
                }}
              >
                <strong>
                  {attendanceUnavailable.ko}
                </strong>

                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "12px",
                  }}
                >
                  {attendanceUnavailable.en}
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: "22px",
              paddingTop: "20px",
              borderTop: "1px solid var(--border-light)",
            }}
          >
            <CompleteClassButton
              sessionId={session.id}
              currentStatus={session.status}
              attendanceStatus={
                attendance?.status ?? null
              }
            />
          </div>
        </section>

        <section
          className="talkly-card"
          style={{
            marginTop: "24px",
            padding: "28px",
          }}
        >
          <div className="talkly-section-label">
            TEACHER NOTE
          </div>

          <h2
            style={{
              margin: "5px 0 0",
              color: "var(--talkly-navy)",
              fontSize: "23px",
            }}
          >
            강사 내부 메모
          </h2>

          <p
            style={{
              margin: "8px 0 0",
              color: "var(--text-muted)",
              fontSize: "13px",
            }}
          >
            학생과 학부모에게 공개되지 않는 내부 메모입니다.
          </p>

          <TeacherNoteForm
            sessionId={session.id}
            initialNote={session.teacher_notes}
          />
        </section>

        <section
          className="talkly-card"
          style={{
            marginTop: "24px",
            padding: "28px",
          }}
        >
          <div className="talkly-section-label">
            EVALUATION
          </div>

          <h2
            style={{
              margin: "5px 0 0",
              color: "var(--talkly-navy)",
              fontSize: "23px",
            }}
          >
            학습 평가
          </h2>

          <p
            style={{
              margin: "8px 0 0",
              color: "var(--text-muted)",
              fontSize: "13px",
            }}
          >
            참여도, 이해도, 말하기, 발음 및 회차별 피드백을 기록합니다.
          </p>

          {session.ended_at ? (
            <EvaluationForm
              sessionId={session.id}
              teacherUserId={user.id}
              initialEvaluation={evaluation}
            />
          ) : (
            <div
              style={{
                marginTop: "20px",
                padding: "18px",
                border: "1px dashed var(--border)",
                borderRadius: "10px",
                background: "var(--talkly-blue-soft)",
              }}
            >
              <strong
                style={{
                  color: "var(--talkly-navy)",
                }}
              >
                학습 평가는 수업 종료 후 작성할 수 있습니다.
              </strong>

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                }}
              >
                Evaluation will be available after the class ends.
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}