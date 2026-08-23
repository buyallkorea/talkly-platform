import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TalklyUserHeader from "@/components/TalklyUserHeader";

type PageProps = {
  params: Promise<{
    id: string;
    sessionId: string;
  }>;
};

export default async function ParentClassSessionPage({
  params,
}: PageProps) {
  const { id, sessionId } = await params;

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

  if (!profile || profile.role !== "parent") {
    redirect("/");
  }

  const { data: child, error: childError } =
    await supabase
      .from("children")
      .select(`
        id,
        name,
        parent_user_id,
        is_active
      `)
      .eq("id", Number(id))
      .eq("parent_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

  if (childError) {
    throw new Error(childError.message);
  }

  if (!child) {
    notFound();
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
        child_id,
        course_id,
        teacher_user_id,
        status
      `)
      .eq("id", session.enrollment_id)
      .eq("child_id", child.id)
      .maybeSingle();

  if (enrollmentError) {
    throw new Error(enrollmentError.message);
  }

  if (!enrollment) {
    notFound();
  }

  const { data: course } = await supabase
    .from("courses")
    .select("name")
    .eq("id", enrollment.course_id)
    .maybeSingle();

  let teacherName = "미배정";

  if (enrollment.teacher_user_id) {
    const { data: teacher } = await supabase
      .from("teacher_profiles")
      .select("display_name")
      .eq("user_id", enrollment.teacher_user_id)
      .maybeSingle();

    if (teacher?.display_name) {
      teacherName = teacher.display_name;
    }
  }

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
        reason,
        status,
        requested_at,
        reviewed_at,
        admin_note
      `)
      .eq("class_session_id", session.id)
      .eq("requested_by", user.id)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (holdError) {
    throw new Error(holdError.message);
  }

  function getSessionStatusLabel(status: string) {
    switch (status) {
      case "scheduled":
        return "예정";
      case "completed":
        return "수업 완료";
      case "cancelled":
        return "수업 취소";
      case "no_show":
        return "무단결석";
      case "held":
        return "수업 연기";
      default:
        return status;
    }
  }

  function getAttendanceStatusLabel(status: string) {
    switch (status) {
      case "present":
        return "출석";
      case "late":
        return "지각";
      case "absent":
        return "결석";
      case "excused":
        return "인정결석";
      case "teacher_absent":
        return "강사결석";
      default:
        return status;
    }
  }

  function getHoldStatusLabel(status: string) {
    switch (status) {
      case "requested":
        return "확인 대기중";
      case "approved":
        return "승인 완료";
      case "rejected":
        return "거절";
      case "cancelled":
        return "신청 취소";
      default:
        return status;
    }
  }

  function formatDateTime(value: string | null) {
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

  function getDurationMinutes(start: string, end: string) {
    return Math.round(
      (new Date(end).getTime() - new Date(start).getTime()) / 60000
    );
  }

  const canRequestHold =
    session.status === "scheduled" &&
    !hold;

  function getSessionBadgeClass(status: string) {
    if (status === "completed") {
      return "talkly-badge talkly-badge-success";
    }

    if (status === "scheduled") {
      return "talkly-badge talkly-badge-blue";
    }

    return "talkly-badge talkly-badge-neutral";
  }

  function getAttendanceBadgeClass(status: string) {
    if (status === "present") {
      return "talkly-badge talkly-badge-success";
    }

    if (status === "late" || status === "excused") {
      return "talkly-badge talkly-badge-blue";
    }

    return "talkly-badge talkly-badge-neutral";
  }

  return (
    <div className="talkly-dashboard">
      <TalklyUserHeader
        role="parent"
        userName={profile.name}
      />

      <main className="talkly-dashboard-main">
        <div style={{ marginBottom: "20px" }}>
          <Link
            href={`/parent/children/${child.id}/classes`}
            style={{
              color: "var(--talkly-blue)",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 800,
            }}
          >
            ← 수업 목록
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
              alignItems: "center",
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
                {session.lesson_number}회차 수업
              </h1>

              <p className="talkly-dashboard-subtitle">
                {child.name} 학생의 수업 상세정보입니다.
              </p>
            </div>

            <span className={getSessionBadgeClass(session.status)}>
              {getSessionStatusLabel(session.status)}
            </span>
          </div>
        </section>

        <section
          style={{
            marginTop: "22px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
          }}
        >
          {[
            ["학생", child.name],
            ["과정", course?.name || "-"],
            ["담당 강사", teacherName],
            ["수업 시작", formatDateTime(session.scheduled_start)],
            [
              "수업시간",
              `${getDurationMinutes(
                session.scheduled_start,
                session.scheduled_end
              )}분`,
            ],
            ["화상수업", session.meeting_provider || "-"],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="talkly-card"
              style={{ padding: "19px" }}
            >
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: "12px",
                  fontWeight: 800,
                }}
              >
                {label}
              </div>

              <div
                style={{
                  marginTop: "7px",
                  color: "var(--talkly-navy)",
                  fontSize: "15px",
                  fontWeight: 800,
                  lineHeight: 1.5,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </section>

        {session.meeting_url && session.status === "scheduled" && (
          <section
            className="talkly-card"
            style={{
              marginTop: "18px",
              padding: "22px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "18px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong
                style={{
                  color: "var(--talkly-navy)",
                  fontSize: "16px",
                }}
              >
                화상수업 입장
              </strong>

              <div
                style={{
                  marginTop: "5px",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                }}
              >
                수업 시간이 되면 아래 버튼으로 입장할 수 있습니다.
              </div>
            </div>

            <a
              href={session.meeting_url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "44px",
                padding: "0 20px",
                borderRadius: "10px",
                background: "var(--talkly-blue)",
                color: "#ffffff",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 900,
              }}
            >
              화상수업 입장 →
            </a>
          </section>
        )}

        <section
          className="talkly-card"
          style={{
            marginTop: "24px",
            padding: "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="talkly-section-label">
                ATTENDANCE
              </div>

              <h2
                style={{
                  margin: "5px 0 0",
                  color: "var(--talkly-navy)",
                  fontSize: "22px",
                }}
              >
                출석정보
              </h2>
            </div>

            {attendance && (
              <span
                className={getAttendanceBadgeClass(
                  attendance.status
                )}
              >
                {getAttendanceStatusLabel(attendance.status)}
              </span>
            )}
          </div>

          {attendance ? (
            <div style={{ marginTop: "20px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "10px",
                    background: "var(--talkly-blue-soft)",
                    border: "1px solid #e5ecf6",
                  }}
                >
                  <div
                    style={{
                      color: "var(--text-muted)",
                      fontSize: "12px",
                      fontWeight: 800,
                    }}
                  >
                    출석 상태
                  </div>
                  <div
                    style={{
                      marginTop: "6px",
                      color: "var(--talkly-navy)",
                      fontWeight: 900,
                    }}
                  >
                    {getAttendanceStatusLabel(attendance.status)}
                  </div>
                </div>

                <div
                  style={{
                    padding: "16px",
                    borderRadius: "10px",
                    background: "var(--talkly-blue-soft)",
                    border: "1px solid #e5ecf6",
                  }}
                >
                  <div
                    style={{
                      color: "var(--text-muted)",
                      fontSize: "12px",
                      fontWeight: 800,
                    }}
                  >
                    출석 확인일
                  </div>
                  <div
                    style={{
                      marginTop: "6px",
                      color: "var(--talkly-navy)",
                      fontWeight: 800,
                    }}
                  >
                    {formatDateTime(attendance.attended_at)}
                  </div>
                </div>
              </div>

              {attendance.note && (
                <div
                  style={{
                    marginTop: "14px",
                    padding: "17px",
                    borderRadius: "10px",
                    background: "#f9fbfe",
                    border: "1px solid var(--border-light)",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.7,
                    color: "var(--text-secondary)",
                  }}
                >
                  {attendance.note}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                marginTop: "20px",
                padding: "22px",
                border: "1px dashed var(--border)",
                borderRadius: "10px",
                color: "var(--text-muted)",
              }}
            >
              아직 등록된 출석정보가 없습니다.
            </div>
          )}
        </section>

        <section
          className="talkly-card"
          style={{
            marginTop: "24px",
            padding: "28px",
          }}
        >
          <div className="talkly-section-label">
            CLASS FEEDBACK
          </div>

          <h2
            style={{
              margin: "5px 0 0",
              color: "var(--talkly-navy)",
              fontSize: "22px",
            }}
          >
            수업 피드백
          </h2>

          <p
            style={{
              margin: "7px 0 0",
              color: "var(--text-muted)",
              fontSize: "13px",
            }}
          >
            담당 강사가 작성한 수업 피드백입니다.
          </p>

          {session.class_feedback ? (
            <div
              style={{
                marginTop: "18px",
                padding: "18px",
                borderRadius: "10px",
                background: "#f9fbfe",
                border: "1px solid var(--border-light)",
                whiteSpace: "pre-wrap",
                lineHeight: 1.8,
                color: "var(--text-secondary)",
              }}
            >
              {session.class_feedback}
            </div>
          ) : (
            <div
              style={{
                marginTop: "18px",
                padding: "22px",
                border: "1px dashed var(--border)",
                borderRadius: "10px",
                color: "var(--text-muted)",
              }}
            >
              아직 등록된 수업 피드백이 없습니다.
            </div>
          )}
        </section>

        <section
          className="talkly-card"
          style={{
            marginTop: "24px",
            padding: "28px",
          }}
        >
          <div className="talkly-section-label">
            ABSENCE REQUEST
          </div>

          <h2
            style={{
              margin: "5px 0 0",
              color: "var(--talkly-navy)",
              fontSize: "22px",
            }}
          >
            결석신청
          </h2>

          {hold ? (
            <div style={{ marginTop: "20px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <strong
                  style={{ color: "var(--talkly-navy)" }}
                >
                  신청 상태
                </strong>

                <span className="talkly-badge talkly-badge-blue">
                  {getHoldStatusLabel(hold.status)}
                </span>
              </div>

              <div
                style={{
                  marginTop: "15px",
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    padding: "15px",
                    borderRadius: "10px",
                    background: "var(--talkly-blue-soft)",
                  }}
                >
                  <div
                    style={{
                      color: "var(--text-muted)",
                      fontSize: "11px",
                      fontWeight: 800,
                    }}
                  >
                    신청일
                  </div>
                  <div
                    style={{
                      marginTop: "5px",
                      color: "var(--talkly-navy)",
                      fontWeight: 800,
                    }}
                  >
                    {formatDateTime(hold.requested_at)}
                  </div>
                </div>

                {hold.reviewed_at && (
                  <div
                    style={{
                      padding: "15px",
                      borderRadius: "10px",
                      background: "var(--talkly-blue-soft)",
                    }}
                  >
                    <div
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "11px",
                        fontWeight: 800,
                      }}
                    >
                      처리일
                    </div>
                    <div
                      style={{
                        marginTop: "5px",
                        color: "var(--talkly-navy)",
                        fontWeight: 800,
                      }}
                    >
                      {formatDateTime(hold.reviewed_at)}
                    </div>
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: "15px",
                  padding: "17px",
                  borderRadius: "10px",
                  background: "#f9fbfe",
                  border: "1px solid var(--border-light)",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.7,
                }}
              >
                <strong
                  style={{
                    display: "block",
                    marginBottom: "7px",
                    color: "var(--talkly-navy)",
                  }}
                >
                  신청사유
                </strong>
                {hold.reason || "사유 미입력"}
              </div>

              {hold.admin_note && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "17px",
                    borderRadius: "10px",
                    background: "var(--talkly-blue-soft)",
                    border: "1px solid #e5ecf6",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.7,
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      marginBottom: "7px",
                      color: "var(--talkly-navy)",
                    }}
                  >
                    관리자 안내
                  </strong>
                  {hold.admin_note}
                </div>
              )}
            </div>
          ) : canRequestHold ? (
            <div style={{ marginTop: "20px" }}>
              <p
                style={{
                  margin: "0 0 16px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.7,
                }}
              >
            
                수업 참여가 어려운 경우 수업 연기를 신청할 수 있습니다.
                월 최대 2회, 수업 시작 2시간 전까지 신청 가능하며
                조건을 충족하면 자동 승인됩니다.
              </p>

              <Link
                href={`/parent/children/${child.id}/classes/${session.id}/hold`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "44px",
                  padding: "0 20px",
                  borderRadius: "10px",
                  background: "var(--talkly-blue)",
                  color: "#ffffff",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: 900,
                }}
              >
                수업 연기 신청
              </Link>
            </div>
          ) : (
            <div
              style={{
                marginTop: "18px",
                padding: "20px",
                border: "1px dashed var(--border)",
                borderRadius: "10px",
                color: "var(--text-muted)",
              }}
            >
              현재 이 수업은 결석신청이 불가능합니다.
            </div>
          )}
        </section>
      </main>

      <style>{`
        @media (max-width: 560px) {
          .talkly-dashboard-main {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}