import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type InterviewRow = {
  id: number;
  level_test_id: number;
  status: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  meeting_provider: string | null;
  meeting_url: string | null;
  started_at: string | null;
  completed_at: string | null;
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

export default async function TeacherLevelTestsPage() {
  const supabase = await createClient();

  /*
   * =====================================================
   * Authentication
   * =====================================================
   */

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/teacher/level-tests"
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

  /*
   * =====================================================
   * Assigned Level Tests
   *
   * service role은 서버에서만 사용하며,
   * tester_user_id를 로그인 강사 ID로
   * 반드시 고정합니다.
   * =====================================================
   */

  const admin = createAdminClient();

  const {
    data: interviewData,
    error: interviewError,
  } = await admin
    .from("level_test_interviews")
    .select(`
      id,
      level_test_id,
      status,
      scheduled_at,
      duration_minutes,
      meeting_provider,
      meeting_url,
      started_at,
      completed_at
    `)
    .eq("tester_user_id", user.id)
    .order("scheduled_at", {
      ascending: true,
    });

  if (interviewError) {
    throw new Error(
      `Unable to load level tests: ${interviewError.message}`
    );
  }

  const interviews =
    (interviewData ?? []) as InterviewRow[];

  const levelTestIds = Array.from(
    new Set(
      interviews.map(
        (item) => item.level_test_id
      )
    )
  );

  let levelTests: LevelTestRow[] = [];

  if (levelTestIds.length > 0) {
    const {
      data,
      error,
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
      .in("id", levelTestIds);

    if (error) {
      throw new Error(
        `Unable to load student information: ${error.message}`
      );
    }

    levelTests =
      (data ?? []) as LevelTestRow[];
  }

  /*
   * =====================================================
   * Helpers
   * =====================================================
   */

  function getLevelTest(
    levelTestId: number
  ) {
    return levelTests.find(
      (item) => item.id === levelTestId
    );
  }

  function getStudentName(
    levelTestId: number
  ) {
    return (
      getLevelTest(levelTestId)
        ?.student_name || "Student"
    );
  }

  function getStudentInfo(
    levelTestId: number
  ) {
    const item =
      getLevelTest(levelTestId);

    if (!item) {
      return "-";
    }

    const parts = [
      item.target_group,
      item.grade,
    ].filter(Boolean);

    return parts.length > 0
      ? parts.join(" · ")
      : "-";
  }

  function formatEnglishDateTime(
    value: string
  ) {
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
    value: string
  ) {
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

  function getStatus(
    status: string
  ) {
    switch (status) {
      case "scheduling":
        return {
          en: "Scheduling",
          ko: "일정 조율 중",
          background: "#fff8e7",
          color: "#b54708",
          border: "#fedf89",
        };

      case "scheduled":
        return {
          en: "Scheduled",
          ko: "예정",
          background: "#eef4ff",
          color: "#175cd3",
          border: "#b2ccff",
        };

      case "in_progress":
        return {
          en: "In Progress",
          ko: "진행 중",
          background: "#ecfdf3",
          color: "#027a48",
          border: "#abefc6",
        };

      case "completed":
        return {
          en: "Completed",
          ko: "완료",
          background: "#f2f4f7",
          color: "#344054",
          border: "#d0d5dd",
        };

      case "cancelled":
      case "canceled":
        return {
          en: "Cancelled",
          ko: "취소",
          background: "#fff1f0",
          color: "#b42318",
          border: "#fecdca",
        };

      default:
        return {
          en: status,
          ko: "",
          background: "#f9fafb",
          color: "#475467",
          border: "#e4e7ec",
        };
    }
  }

  const now = Date.now();

  const upcoming = interviews.filter(
    (item) =>
      item.scheduled_at &&
      ["scheduling", "scheduled", "in_progress"].includes(
        item.status
      ) &&
      new Date(
        item.scheduled_at
      ).getTime() >= now
  );

  const completed = interviews.filter(
    (item) =>
      item.status === "completed"
  );

  const other = interviews.filter(
    (item) =>
      !upcoming.some(
        (upcomingItem) =>
          upcomingItem.id === item.id
      ) &&
      !completed.some(
        (completedItem) =>
          completedItem.id === item.id
      )
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f6f9ff 0%, #ffffff 320px)",
        color: "#101828",
      }}
    >
      <div
        style={{
          maxWidth: "1050px",
          margin: "0 auto",
          padding: "32px 24px 64px",
        }}
      >
        {/* NAVIGATION */}
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
            href="/teacher"
            style={{
              padding: "9px 13px",
              border:
                "1px solid #d0d5dd",
              borderRadius: "9px",
              background: "#ffffff",
              color: "#344054",
              textDecoration: "none",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            ← Back
          </Link>

          <Link
            href="/teacher"
            style={{
              padding: "9px 13px",
              border:
                "1px solid #b2ccff",
              borderRadius: "9px",
              background: "#eef4ff",
              color: "#175cd3",
              textDecoration: "none",
              fontSize: "12px",
              fontWeight: 900,
            }}
          >
            Teacher Home
          </Link>

          <span
            style={{
              fontSize: "11px",
              color: "#98a2b3",
            }}
          >
            이전으로 · 강사 메인
          </span>
        </nav>

        {/* HERO */}
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
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing: "0.14em",
              color: "#a9c7ff",
            }}
          >
            TALKLY LEVEL TEST
          </div>

          <h1
            style={{
              margin: "8px 0 0",
              fontSize: "32px",
            }}
          >
            My Level Tests
          </h1>

          <div
            style={{
              marginTop: "5px",
              fontSize: "13px",
              color:
                "rgba(255,255,255,0.72)",
            }}
          >
            나에게 배정된 원어민
            레벨테스트
          </div>

          <p
            style={{
              maxWidth: "650px",
              margin: "18px 0 0",
              lineHeight: 1.7,
              fontSize: "14px",
              color:
                "rgba(255,255,255,0.88)",
            }}
          >
            Review your upcoming TALKLY
            level tests and join the
            scheduled interview.
          </p>

          <div
            style={{
              marginTop: "3px",
              fontSize: "11px",
              color:
                "rgba(255,255,255,0.6)",
            }}
          >
            예정된 레벨테스트 일정과
            화상 접속 정보를 확인할 수
            있습니다.
          </div>
        </section>

        {/* SUMMARY */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            marginTop: "18px",
          }}
        >
          <SummaryCard
            label="UPCOMING"
            title="Upcoming"
            korean="예정 테스트"
            value={upcoming.length}
          />

          <SummaryCard
            label="COMPLETED"
            title="Completed"
            korean="완료 테스트"
            value={completed.length}
          />

          <SummaryCard
            label="TOTAL"
            title="All Tests"
            korean="전체 테스트"
            value={interviews.length}
          />
        </section>

        {/* UPCOMING */}
        <section
          style={{
            marginTop: "28px",
          }}
        >
          <div
            style={{
              marginBottom: "13px",
            }}
          >
            <div
              style={{
                color: "#2f6fed",
                fontSize: "11px",
                fontWeight: 900,
                letterSpacing: "0.1em",
              }}
            >
              UPCOMING
            </div>

            <h2
              style={{
                margin: "5px 0 0",
                fontSize: "24px",
              }}
            >
              Upcoming Level Tests
            </h2>

            <div
              style={{
                marginTop: "4px",
                fontSize: "12px",
                color: "#667085",
              }}
            >
              예정된 레벨테스트
            </div>
          </div>

          {upcoming.length === 0 ? (
            <EmptyCard
              english="No upcoming level tests."
              korean="현재 예정된 레벨테스트가 없습니다."
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "13px",
              }}
            >
              {upcoming.map(
                (interview) => (
                  <LevelTestCard
                    key={interview.id}
                    interview={interview}
                    studentName={getStudentName(
                      interview.level_test_id
                    )}
                    studentInfo={getStudentInfo(
                      interview.level_test_id
                    )}
                    formatEnglishDateTime={
                      formatEnglishDateTime
                    }
                    formatKoreanDateTime={
                      formatKoreanDateTime
                    }
                    statusInfo={getStatus(
                      interview.status
                    )}
                  />
                )
              )}
            </div>
          )}
        </section>

        {/* COMPLETED */}
        {completed.length > 0 && (
          <section
            style={{
              marginTop: "34px",
            }}
          >
            <div
              style={{
                marginBottom: "13px",
              }}
            >
              <div
                style={{
                  color: "#667085",
                  fontSize: "11px",
                  fontWeight: 900,
                  letterSpacing: "0.1em",
                }}
              >
                COMPLETED
              </div>

              <h2
                style={{
                  margin: "5px 0 0",
                  fontSize: "23px",
                }}
              >
                Completed Tests
              </h2>

              <div
                style={{
                  marginTop: "4px",
                  fontSize: "12px",
                  color: "#667085",
                }}
              >
                완료된 레벨테스트
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {completed.map(
                (interview) => (
                  <LevelTestCard
                    key={interview.id}
                    interview={interview}
                    studentName={getStudentName(
                      interview.level_test_id
                    )}
                    studentInfo={getStudentInfo(
                      interview.level_test_id
                    )}
                    formatEnglishDateTime={
                      formatEnglishDateTime
                    }
                    formatKoreanDateTime={
                      formatKoreanDateTime
                    }
                    statusInfo={getStatus(
                      interview.status
                    )}
                  />
                )
              )}
            </div>
          </section>
        )}

        {/* OTHER */}
        {other.length > 0 && (
          <section
            style={{
              marginTop: "34px",
            }}
          >
            <div
              style={{
                marginBottom: "13px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "22px",
                }}
              >
                Other Tests
              </h2>

              <div
                style={{
                  marginTop: "4px",
                  fontSize: "12px",
                  color: "#667085",
                }}
              >
                기타 테스트
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {other.map(
                (interview) => (
                  <LevelTestCard
                    key={interview.id}
                    interview={interview}
                    studentName={getStudentName(
                      interview.level_test_id
                    )}
                    studentInfo={getStudentInfo(
                      interview.level_test_id
                    )}
                    formatEnglishDateTime={
                      formatEnglishDateTime
                    }
                    formatKoreanDateTime={
                      formatKoreanDateTime
                    }
                    statusInfo={getStatus(
                      interview.status
                    )}
                  />
                )
              )}
            </div>
          </section>
        )}

        {/* FOOT NAV */}
        <div
          style={{
            marginTop: "32px",
            paddingTop: "22px",
            borderTop:
              "1px solid #e4e7ec",
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/teacher"
            style={{
              padding: "11px 16px",
              border:
                "1px solid #d0d5dd",
              borderRadius: "9px",
              background: "#ffffff",
              color: "#344054",
              textDecoration: "none",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            ← Back to Teacher Home
          </Link>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: "11px",
              color: "#98a2b3",
            }}
          >
            강사 메인으로 돌아가기
          </div>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  title,
  korean,
  value,
}: {
  label: string;
  title: string;
  korean: string;
  value: number;
}) {
  return (
    <div
      style={{
        padding: "18px",
        border:
          "1px solid #e4e7ec",
        borderRadius: "14px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          fontWeight: 900,
          letterSpacing: "0.08em",
          color: "#2f6fed",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "7px",
          fontSize: "17px",
          fontWeight: 800,
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: "2px",
          fontSize: "11px",
          color: "#98a2b3",
        }}
      >
        {korean}
      </div>

      <div
        style={{
          marginTop: "13px",
          fontSize: "29px",
          fontWeight: 900,
          color: "#0A1F44",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyCard({
  english,
  korean,
}: {
  english: string;
  korean: string;
}) {
  return (
    <div
      style={{
        padding: "34px",
        border:
          "1px dashed #d0d5dd",
        borderRadius: "14px",
        background: "#ffffff",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "17px",
          fontWeight: 800,
        }}
      >
        {english}
      </div>

      <div
        style={{
          marginTop: "5px",
          fontSize: "12px",
          color: "#98a2b3",
        }}
      >
        {korean}
      </div>
    </div>
  );
}

function LevelTestCard({
  interview,
  studentName,
  studentInfo,
  formatEnglishDateTime,
  formatKoreanDateTime,
  statusInfo,
}: {
  interview: InterviewRow;
  studentName: string;
  studentInfo: string;
  formatEnglishDateTime: (
    value: string
  ) => string;
  formatKoreanDateTime: (
    value: string
  ) => string;
  statusInfo: {
    en: string;
    ko: string;
    background: string;
    color: string;
    border: string;
  };
}) {
  return (
    <article
      style={{
        padding: "21px",
        border:
          "1px solid #e4e7ec",
        borderRadius: "15px",
        background: "#ffffff",
        boxShadow:
          "0 5px 18px rgba(16,24,40,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
          gap: "15px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 900,
              color: "#2f6fed",
              letterSpacing: "0.08em",
            }}
          >
            LEVEL TEST #
            {interview.level_test_id}
          </div>

          <h3
            style={{
              margin: "6px 0 0",
              fontSize: "21px",
            }}
          >
            {studentName}
          </h3>

          <div
            style={{
              marginTop: "4px",
              fontSize: "12px",
              color: "#667085",
            }}
          >
            {studentInfo}
          </div>
        </div>

        <div
          style={{
            padding: "7px 10px",
            border: `1px solid ${statusInfo.border}`,
            borderRadius: "999px",
            background:
              statusInfo.background,
            color: statusInfo.color,
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 900,
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

      <div
        style={{
          marginTop: "18px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "10px",
        }}
      >
        <InfoBox
          label="DATE & TIME"
          korean="테스트 일시"
          value={
            interview.scheduled_at
              ? formatEnglishDateTime(
                  interview.scheduled_at
                )
              : "Not scheduled"
          }
          subValue={
            interview.scheduled_at
              ? `${formatKoreanDateTime(
                  interview.scheduled_at
                )} · KST`
              : "일정 미정"
          }
        />

        <InfoBox
          label="DURATION"
          korean="테스트 시간"
          value={`${
            interview.duration_minutes ??
            20
          } min`}
          subValue={`${
            interview.duration_minutes ??
            20
          }분`}
        />

        <InfoBox
          label="MEETING"
          korean="화상 시스템"
          value={
            interview.meeting_provider ||
            "TALKLY"
          }
          subValue={
            interview.meeting_url
              ? "Meeting link ready"
              : "Link not registered"
          }
        />
      </div>

      <div
        style={{
          marginTop: "18px",
          paddingTop: "16px",
          borderTop:
            "1px solid #f0f2f5",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 800,
              color: "#667085",
            }}
          >
            Teacher Action
          </div>

          <div
            style={{
              marginTop: "2px",
              fontSize: "10px",
              color: "#98a2b3",
            }}
          >
            강사 작업
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {interview.meeting_url &&
            interview.status !==
              "completed" && (
              <a
                href={
                  interview.meeting_url
                }
                target="_blank"
                rel="noreferrer"
                style={{
                  padding:
                    "10px 15px",
                  borderRadius:
                    "9px",
                  background:
                    "#0A1F44",
                  color: "#ffffff",
                  textDecoration:
                    "none",
                  fontSize: "12px",
                  fontWeight: 900,
                }}
              >
                Enter Level Test ↗
              </a>
            )}

          <div
            style={{
              padding: "10px 14px",
              border:
                "1px solid #e4e7ec",
              borderRadius: "9px",
              background: "#f9fafb",
              color: "#98a2b3",
              fontSize: "11px",
              fontWeight: 800,
            }}
          >
            Details & Evaluation
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: "9px",
          fontSize: "10px",
          color: "#98a2b3",
          textAlign: "right",
        }}
      >
        상세 및 평가 기능은 다음 단계에서
        연결됩니다.
      </div>
    </article>
  );
}

function InfoBox({
  label,
  korean,
  value,
  subValue,
}: {
  label: string;
  korean: string;
  value: string;
  subValue: string;
}) {
  return (
    <div
      style={{
        padding: "14px",
        border:
          "1px solid #edf0f5",
        borderRadius: "10px",
        background: "#fafbfc",
      }}
    >
      <div
        style={{
          fontSize: "9px",
          fontWeight: 900,
          letterSpacing: "0.07em",
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
          marginTop: "8px",
          fontSize: "13px",
          fontWeight: 800,
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
        {subValue}
      </div>
    </div>
  );
}