import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import LevelTestEvaluationForm from "./LevelTestEvaluationForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type InterviewRow = {
  id: number;
  level_test_id: number;
  tester_user_id: string | null;
  status: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  meeting_provider: string | null;
  meeting_url: string | null;
  started_at: string | null;
  completed_at: string | null;
  speaking_level: number | null;
  listening_level: number | null;
  pronunciation_level: number | null;
  comprehension_level: number | null;
  suggested_level: string | null;
  strengths: string | null;
  weaknesses: string | null;
  teacher_comment: string | null;
  created_at: string;
};

type LevelTestRow = {
  id: number;
  student_name: string | null;
  grade: string | null;
  target_group: string | null;
  status: string;
  interview_status: string | null;
  teacher_suggested_level: string | null;
};

export default async function TeacherLevelTestDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const interviewId = Number(id);

  if (
    !Number.isInteger(interviewId) ||
    interviewId <= 0
  ) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=/teacher/level-tests/${interviewId}`
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "teacher"
  ) {
    redirect("/");
  }

  const admin = createAdminClient();

  /*
   * 상세 URL의 id는
   * level_test_interviews.id 입니다.
   */
  const {
    data: interviewData,
    error: interviewError,
  } = await admin
    .from("level_test_interviews")
    .select(`
      id,
      level_test_id,
      tester_user_id,
      status,
      scheduled_at,
      duration_minutes,
      meeting_provider,
      meeting_url,
      started_at,
      completed_at,
      speaking_level,
      listening_level,
      pronunciation_level,
      comprehension_level,
      suggested_level,
      strengths,
      weaknesses,
      teacher_comment,
      created_at
    `)
    .eq("id", interviewId)
    .maybeSingle();

  if (interviewError) {
    throw new Error(
      `Unable to load level test: ${interviewError.message}`
    );
  }

  if (!interviewData) {
    notFound();
  }

  const interview =
    interviewData as InterviewRow;

  /*
   * 매우 중요:
   * URL을 직접 변경하더라도
   * 다른 강사의 인터뷰는 볼 수 없습니다.
   */
  if (
    interview.tester_user_id !==
    user.id
  ) {
    redirect("/teacher/level-tests");
  }

  const {
    data: levelTestData,
    error: levelTestError,
  } = await admin
    .from("level_tests")
    .select(`
      id,
      student_name,
      grade,
      target_group,
      status,
      interview_status,
      teacher_suggested_level
    `)
    .eq(
      "id",
      interview.level_test_id
    )
    .maybeSingle();

  if (levelTestError) {
    throw new Error(
      `Unable to load student information: ${levelTestError.message}`
    );
  }

  if (!levelTestData) {
    notFound();
  }

  const levelTest =
    levelTestData as LevelTestRow;

  /*
   * 같은 level_test_id에 과거 인터뷰가 여러 개
   * 존재할 수 있으므로 현재 유효한 인터뷰를 확인합니다.
   *
   * 취소된 인터뷰를 제외한 가장 최근 row가
   * 현재 작업 대상입니다.
   */
  const {
    data: currentInterview,
    error: currentInterviewError,
  } = await admin
    .from("level_test_interviews")
    .select("id")
    .eq(
      "level_test_id",
      interview.level_test_id
    )
    .not(
      "status",
      "in",
      '("cancelled","canceled")'
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (currentInterviewError) {
    throw new Error(
      `Unable to verify the current interview: ${currentInterviewError.message}`
    );
  }

  const isCurrentInterview =
    currentInterview?.id ===
    interview.id;

  const isCancelled =
    interview.status === "cancelled" ||
    interview.status === "canceled";

  function formatEnglishDateTime(
    value: string | null
  ) {
    if (!value) {
      return "Not scheduled";
    }

    return new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "short",
        day: "numeric",
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }
    ).format(new Date(value));
  }

  function formatKoreanDateTime(
    value: string | null
  ) {
    if (!value) {
      return "일정 미정";
    }

    return new Intl.DateTimeFormat(
      "ko-KR",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    ).format(new Date(value));
  }

  function getStatusLabel(
    status: string
  ) {
    switch (status) {
      case "scheduled":
        return {
          en: "Scheduled",
          ko: "예정",
          color: "#175cd3",
          background: "#eef4ff",
          border: "#b2ccff",
        };

      case "in_progress":
        return {
          en: "In Progress",
          ko: "진행 중",
          color: "#027a48",
          background: "#ecfdf3",
          border: "#abefc6",
        };

      case "completed":
        return {
          en: "Completed",
          ko: "완료",
          color: "#344054",
          background: "#f2f4f7",
          border: "#d0d5dd",
        };

      case "cancelled":
      case "canceled":
        return {
          en: "Cancelled",
          ko: "취소",
          color: "#b42318",
          background: "#fff1f0",
          border: "#fecdca",
        };

      default:
        return {
          en: status,
          ko: "",
          color: "#475467",
          background: "#f9fafb",
          border: "#e4e7ec",
        };
    }
  }

  const statusInfo =
    getStatusLabel(
      interview.status
    );

  const studentInfo = [
    levelTest.target_group,
    levelTest.grade,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f6f9ff 0%, #ffffff 360px)",
        color: "#101828",
      }}
    >
      <div
        style={{
          maxWidth: "980px",
          margin: "0 auto",
          padding: "32px 24px 64px",
        }}
      >
        {/* Navigation */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          <Link
            href="/teacher/level-tests"
            style={backStyle}
          >
            ← Back to Level Tests
          </Link>

          <Link
            href="/teacher"
            style={homeStyle}
          >
            Teacher Home
          </Link>

          <span
            style={{
              fontSize: "11px",
              color: "#98a2b3",
            }}
          >
            레벨테스트 목록 · 강사 메인
          </span>
        </nav>

        {/* Hero */}
        <section
          style={{
            padding: "30px",
            borderRadius: "20px",
            background:
              "linear-gradient(135deg, #0A1F44 0%, #174486 100%)",
            color: "#ffffff",
            boxShadow:
              "0 16px 42px rgba(10,31,68,0.13)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "flex-start",
              gap: "18px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  color: "#a9c7ff",
                  fontSize: "11px",
                  fontWeight: 900,
                  letterSpacing: "0.13em",
                }}
              >
                LEVEL TEST #
                {levelTest.id}
              </div>

              <h1
                style={{
                  margin: "8px 0 0",
                  fontSize: "32px",
                }}
              >
                {levelTest.student_name ||
                  "Student"}
              </h1>

              <div
                style={{
                  marginTop: "5px",
                  color:
                    "rgba(255,255,255,0.7)",
                  fontSize: "13px",
                }}
              >
                {studentInfo || "-"}
              </div>
            </div>

            <div
              style={{
                padding: "8px 12px",
                border: `1px solid ${statusInfo.border}`,
                borderRadius: "999px",
                background:
                  statusInfo.background,
                color: statusInfo.color,
              }}
            >
              <div
                style={{
                  fontWeight: 900,
                  fontSize: "12px",
                }}
              >
                {statusInfo.en}
              </div>

              {statusInfo.ko && (
                <div
                  style={{
                    marginTop: "1px",
                    fontSize: "9px",
                    opacity: 0.75,
                  }}
                >
                  {statusInfo.ko}
                </div>
              )}
            </div>
          </div>

          <p
            style={{
              margin: "20px 0 0",
              maxWidth: "650px",
              fontSize: "14px",
              lineHeight: 1.7,
              color:
                "rgba(255,255,255,0.86)",
            }}
          >
            Conduct the assigned video level
            test and submit your evaluation
            after the interview.
          </p>

          <div
            style={{
              marginTop: "3px",
              fontSize: "11px",
              color:
                "rgba(255,255,255,0.58)",
            }}
          >
            배정된 화상 레벨테스트를 진행한 뒤
            강사 평가를 작성합니다.
          </div>
        </section>

        {/* Archive warning */}
        {(!isCurrentInterview ||
          isCancelled) && (
          <div
            style={{
              marginTop: "18px",
              padding: "16px 18px",
              border:
                "1px solid #fedf89",
              borderRadius: "12px",
              background: "#fffaeb",
              color: "#93370d",
            }}
          >
            <div
              style={{
                fontWeight: 900,
                fontSize: "13px",
              }}
            >
              Archived Interview Record
            </div>

            <div
              style={{
                marginTop: "4px",
                fontSize: "11px",
                lineHeight: 1.6,
              }}
            >
              이 인터뷰는 현재 진행 대상이 아닌
              과거 또는 취소된 기록입니다.
              입장 및 평가 저장은 할 수 없습니다.
            </div>
          </div>
        )}

        {/* Schedule */}
        <section
          style={sectionStyle}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 900,
              color: "#2f6fed",
              letterSpacing: "0.08em",
            }}
          >
            TEST INFORMATION
          </div>

          <h2
            style={{
              margin: "6px 0 0",
              fontSize: "23px",
            }}
          >
            Level Test Details
          </h2>

          <div
            style={{
              marginTop: "3px",
              color: "#667085",
              fontSize: "11px",
            }}
          >
            레벨테스트 상세정보
          </div>

          <div
            style={{
              marginTop: "20px",
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "11px",
            }}
          >
            <InfoCard
              label="DATE & TIME"
              korean="테스트 일시"
              value={formatEnglishDateTime(
                interview.scheduled_at
              )}
              sub={`${formatKoreanDateTime(
                interview.scheduled_at
              )} · KST`}
            />

            <InfoCard
              label="DURATION"
              korean="테스트 시간"
              value={`${
                interview.duration_minutes ??
                20
              } min`}
              sub={`${
                interview.duration_minutes ??
                20
              }분`}
            />

            <InfoCard
              label="MEETING"
              korean="화상 시스템"
              value={
                interview.meeting_provider ||
                "TALKLY"
              }
              sub={
                interview.meeting_url
                  ? "Meeting link registered"
                  : "Meeting link not registered"
              }
            />
          </div>

          {!interview.meeting_url &&
            interview.status ===
              "scheduled" &&
            isCurrentInterview && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "14px 16px",
                  border:
                    "1px solid #fedf89",
                  borderRadius: "10px",
                  background: "#fffaeb",
                  color: "#93370d",
                  fontSize: "11px",
                  lineHeight: 1.65,
                }}
              >
                <strong>
                  Meeting link is not
                  registered yet.
                </strong>
                <br />
                화상 접속 링크가 아직 등록되지
                않았습니다. 관리자가 링크를 등록한
                뒤 테스트에 입장할 수 있습니다.
              </div>
            )}
        </section>

        <LevelTestEvaluationForm
          interviewId={interview.id}
          initialStatus={
            interview.status
          }
          scheduledAt={
            interview.scheduled_at
          }
          meetingUrl={
            interview.meeting_url
          }
          isCurrentInterview={
            isCurrentInterview
          }
          interview={{
            speaking_level:
              interview.speaking_level,
            listening_level:
              interview.listening_level,
            pronunciation_level:
              interview.pronunciation_level,
            comprehension_level:
              interview.comprehension_level,
            suggested_level:
              interview.suggested_level,
            strengths:
              interview.strengths,
            weaknesses:
              interview.weaknesses,
            teacher_comment:
              interview.teacher_comment,
          }}
        />

        <div
          style={{
            marginTop: "30px",
            paddingTop: "22px",
            borderTop:
              "1px solid #e4e7ec",
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/teacher/level-tests"
            style={backStyle}
          >
            ← Back to Level Tests
          </Link>

          <Link
            href="/teacher"
            style={homeStyle}
          >
            Teacher Home
          </Link>
        </div>
      </div>
    </main>
  );
}

function InfoCard({
  label,
  korean,
  value,
  sub,
}: {
  label: string;
  korean: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      style={{
        padding: "16px",
        border:
          "1px solid #e4e7ec",
        borderRadius: "11px",
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          fontSize: "9px",
          fontWeight: 900,
          letterSpacing: "0.08em",
          color: "#667085",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "2px",
          fontSize: "9px",
          color: "#98a2b3",
        }}
      >
        {korean}
      </div>

      <div
        style={{
          marginTop: "9px",
          fontSize: "14px",
          fontWeight: 900,
          lineHeight: 1.5,
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: "3px",
          fontSize: "10px",
          color: "#98a2b3",
        }}
      >
        {sub}
      </div>
    </div>
  );
}

const sectionStyle = {
  marginTop: "20px",
  padding: "25px",
  border: "1px solid #e4e7ec",
  borderRadius: "16px",
  background: "#ffffff",
};

const backStyle = {
  padding: "9px 13px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#344054",
  textDecoration: "none",
  fontSize: "12px",
  fontWeight: 800,
};

const homeStyle = {
  padding: "9px 13px",
  border: "1px solid #b2ccff",
  borderRadius: "9px",
  background: "#eef4ff",
  color: "#175cd3",
  textDecoration: "none",
  fontSize: "12px",
  fontWeight: 900,
};