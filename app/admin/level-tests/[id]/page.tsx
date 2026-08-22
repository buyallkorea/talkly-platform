import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import LevelTestAdminForm from "./LevelTestAdminForm";
import InterviewScheduleForm from "./InterviewScheduleForm";
import InterviewResultForm from "./InterviewResultForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ChildRow = {
  id: number;
  name: string;
  birth_date: string | null;
  school_name: string | null;
  grade: string | null;
  learning_goal: string | null;
};

type ParentProfile = {
  id: string;
  name: string | null;
  phone: string | null;
};

type AttemptRow = {
  id: number;
  status: string;
  current_difficulty: number;
  grammar_score: number | null;
  listening_score: number | null;
  total_score: number | null;
  grammar_level: number | null;
  listening_level: number | null;
  suggested_level: string | null;
  confidence: number | null;
  started_at: string;
  completed_at: string | null;
};

type InterviewRow = {
  id: number;
  tester_user_id: string | null;
  status: string;
  scheduled_at: string | null;
  duration_minutes: number;
  meeting_provider: string | null;
  meeting_url: string | null;
  speaking_level: number | null;
  listening_level: number | null;
  pronunciation_level: number | null;
  comprehension_level: number | null;
  suggested_level: string | null;
  strengths: string | null;
  weaknesses: string | null;
  teacher_comment: string | null;
  completed_at: string | null;
};

type TeacherRow = {
  user_id: string;
  display_name: string | null;
};

export default async function AdminLevelTestDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const levelTestId = Number(id);

  if (
    !Number.isInteger(levelTestId) ||
    levelTestId <= 0
  ) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  /*
   * 레벨테스트 기본 정보
   */
  const {
    data: levelTest,
    error: levelTestError,
  } = await supabase
    .from("level_tests")
    .select(`
      id,
      child_id,
      student_user_id,
      parent_user_id,
      status,
      test_type,
      target_group,
      grade,
      ai_status,
      ai_suggested_level,
      ai_confidence,
      ai_review_note,
      interview_required,
      interview_status,
      teacher_suggested_level,
      final_level,
      result_level,
      score,
      strengths,
      weaknesses,
      recommendation,
      admin_note,
      scheduled_at,
      tester_user_id,
      finalized_at,
      created_at,
      updated_at
    `)
    .eq("id", levelTestId)
    .maybeSingle();

  if (levelTestError) {
    throw new Error(
      `레벨테스트 정보를 불러오지 못했습니다: ${levelTestError.message}`
    );
  }

  if (!levelTest) {
    notFound();
  }

  /*
   * 학생 정보
   */
  let child: ChildRow | null = null;

  if (levelTest.child_id) {
    const {
      data: childData,
      error: childError,
    } = await supabase
      .from("children")
      .select(`
        id,
        name,
        birth_date,
        school_name,
        grade,
        learning_goal
      `)
      .eq("id", levelTest.child_id)
      .maybeSingle();

    if (childError) {
      throw new Error(
        `학생 정보를 불러오지 못했습니다: ${childError.message}`
      );
    }

    child =
      childData as ChildRow | null;
  }

  /*
   * 학부모 정보
   */
  let parent: ParentProfile | null =
    null;

  if (levelTest.parent_user_id) {
    const {
      data: parentData,
      error: parentError,
    } = await supabase
      .from("profiles")
      .select(`
        id,
        name,
        phone
      `)
      .eq(
        "id",
        levelTest.parent_user_id
      )
      .maybeSingle();

    if (parentError) {
      throw new Error(
        `학부모 정보를 불러오지 못했습니다: ${parentError.message}`
      );
    }

    parent =
      parentData as ParentProfile | null;
  }

  /*
   * AI 테스트 응시 기록
   */
  const {
    data: attemptsData,
    error: attemptsError,
  } = await supabase
    .from("level_test_attempts")
    .select(`
      id,
      status,
      current_difficulty,
      grammar_score,
      listening_score,
      total_score,
      grammar_level,
      listening_level,
      suggested_level,
      confidence,
      started_at,
      completed_at
    `)
    .eq(
      "level_test_id",
      levelTestId
    )
    .order("created_at", {
      ascending: false,
    });

  if (attemptsError) {
    throw new Error(
      `AI 테스트 기록을 불러오지 못했습니다: ${attemptsError.message}`
    );
  }

  const attempts =
    (attemptsData ??
      []) as AttemptRow[];

  const latestAttempt =
    attempts.length > 0
      ? attempts[0]
      : null;

  /*
   * 원어민 화상 테스트 기록
   */
  const {
    data: interviewsData,
    error: interviewsError,
  } = await supabase
    .from(
      "level_test_interviews"
    )
    .select(`
      id,
      tester_user_id,
      status,
      scheduled_at,
      duration_minutes,
      meeting_provider,
      meeting_url,
      speaking_level,
      listening_level,
      pronunciation_level,
      comprehension_level,
      suggested_level,
      strengths,
      weaknesses,
      teacher_comment,
      completed_at
    `)
    .eq(
      "level_test_id",
      levelTestId
    )
    .order("created_at", {
      ascending: false,
    });

  if (interviewsError) {
    throw new Error(
      `원어민 테스트 기록을 불러오지 못했습니다: ${interviewsError.message}`
    );
  }

  const interviews =
    (interviewsData ??
      []) as InterviewRow[];

  const latestInterview =
    interviews.length > 0
      ? interviews[0]
      : null;

  /*
   * 활성 강사 목록
   */
  const {
    data: teachersData,
    error: teachersError,
  } = await supabase
    .from("teacher_profiles")
    .select(`
      user_id,
      display_name
    `)
    .eq("is_active", true)
    .order("display_name", {
      ascending: true,
    });

  if (teachersError) {
    throw new Error(
      `강사 목록을 불러오지 못했습니다: ${teachersError.message}`
    );
  }

  const teachers =
    (teachersData ??
      []) as TeacherRow[];

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1050px",
        margin: "0 auto",
        padding:
          "54px 42px 90px",
      }}
    >
      <Link
        href="/admin/level-tests"
        style={{
          color: "#667085",
          textDecoration: "none",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        ← 레벨테스트 관리
      </Link>

      <div
        style={{
          marginTop: "22px",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: "#2f6fed",
              fontSize: "12px",
              fontWeight: 900,
              letterSpacing:
                "0.08em",
            }}
          >
            LEVEL TEST DETAIL
          </div>

          <h1
            style={{
              margin:
                "10px 0 0",
              color: "#101828",
              fontSize: "36px",
              lineHeight: 1.2,
              letterSpacing:
                "-0.04em",
            }}
          >
            {child?.name ??
              "레벨테스트 상세"}
          </h1>

          <p
            style={{
              margin:
                "13px 0 0",
              color: "#667085",
              fontSize: "14px",
              lineHeight: 1.7,
            }}
          >
            AI 진단 결과를
            확인하고 필요 시
            원어민 화상 테스트를
            거쳐 최종 레벨을
            확정합니다.
          </p>
        </div>

        <StatusBadge
          label={getStatusLabel(
            levelTest.status
          )}
        />
      </div>

      <section
        style={sectionStyle}
      >
        <SectionTitle
          title="학생 및 신청 정보"
          description="레벨테스트 대상 학생과 학부모 연락 정보를 확인합니다."
        />

        <div
          style={infoGridStyle}
        >
          <InfoItem
            label="학생"
            value={
              child?.name ??
              "학생 정보 없음"
            }
          />

          <InfoItem
            label="학년"
            value={
              levelTest.grade ??
              child?.grade ??
              "-"
            }
          />

          <InfoItem
            label="대상"
            value={
              levelTest.target_group ??
              "-"
            }
          />

          <InfoItem
            label="학교"
            value={
              child?.school_name ??
              "-"
            }
          />

          <InfoItem
            label="학부모"
            value={
              parent?.name ?? "-"
            }
          />

          <InfoItem
            label="연락처"
            value={
              parent?.phone ?? "-"
            }
          />

          <InfoItem
            label="신청일"
            value={formatDateTime(
              levelTest.created_at
            )}
          />

          <InfoItem
            label="현재 상태"
            value={getStatusLabel(
              levelTest.status
            )}
          />
        </div>

        {child?.learning_goal && (
          <NoteBox
            label="학습 목표"
            value={
              child.learning_goal
            }
          />
        )}
      </section>

      <section
        style={sectionStyle}
      >
        <SectionTitle
          title="AI 레벨테스트"
          description="문법과 리스닝 중심의 1차 온라인 진단 결과입니다."
        />

        <div
          style={infoGridStyle}
        >
          <InfoItem
            label="AI 상태"
            value={getAiStatusLabel(
              levelTest.ai_status
            )}
          />

          <InfoItem
            label="AI 예상 레벨"
            value={
              levelTest.ai_suggested_level ??
              latestAttempt?.suggested_level ??
              "-"
            }
          />

          <InfoItem
            label="신뢰도"
            value={
              levelTest.ai_confidence !==
              null
                ? `${levelTest.ai_confidence}%`
                : latestAttempt?.confidence !==
                    null &&
                  latestAttempt?.confidence !==
                    undefined
                ? `${latestAttempt.confidence}%`
                : "-"
            }
          />

          <InfoItem
            label="응시 횟수"
            value={`${attempts.length}회`}
          />

          <InfoItem
            label="Grammar 점수"
            value={
              latestAttempt?.grammar_score !==
                null &&
              latestAttempt?.grammar_score !==
                undefined
                ? `${latestAttempt.grammar_score}`
                : "-"
            }
          />

          <InfoItem
            label="Listening 점수"
            value={
              latestAttempt?.listening_score !==
                null &&
              latestAttempt?.listening_score !==
                undefined
                ? `${latestAttempt.listening_score}`
                : "-"
            }
          />

          <InfoItem
            label="총점"
            value={
              latestAttempt?.total_score !==
                null &&
              latestAttempt?.total_score !==
                undefined
                ? `${latestAttempt.total_score}`
                : "-"
            }
          />

          <InfoItem
            label="최근 완료"
            value={formatDateTime(
              latestAttempt?.completed_at ??
                null
            )}
          />
        </div>

        <NoteBox
          label="AI 관리자 분석"
          value={
            levelTest.ai_review_note ||
            "아직 AI 분석 내용이 없습니다."
          }
        />
      </section>

      <section
        style={sectionStyle}
      >
        <SectionTitle
          title="현재 관리자 판단"
          description="현재 저장되어 있는 관리자 검토 상태입니다."
        />

        <div
          style={{
            marginTop: "20px",
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: "14px",
          }}
        >
          <DecisionCard
            label="원어민 추가 테스트"
            value={
              levelTest.interview_required
                ? "필요"
                : "미요청"
            }
            active={
              levelTest.interview_required
            }
          />

          <DecisionCard
            label="최종 레벨"
            value={
              levelTest.final_level ??
              "미확정"
            }
            active={
              !!levelTest.final_level
            }
          />
        </div>

        <NoteBox
          label="관리자 메모"
          value={
            levelTest.admin_note ||
            "등록된 관리자 메모가 없습니다."
          }
        />
      </section>

      <LevelTestAdminForm
        levelTest={{
          id: levelTest.id,

          status:
            levelTest.status,

          interview_required:
            levelTest.interview_required,

          final_level:
            levelTest.final_level,

          admin_note:
            levelTest.admin_note,
        }}
      />

      <InterviewScheduleForm
        levelTestId={
          levelTest.id
        }
        interviewRequired={
          levelTest.interview_required
        }
        interview={
          latestInterview
            ? {
                id:
                  latestInterview.id,

                status:
                  latestInterview.status,

                tester_user_id:
                  latestInterview.tester_user_id,

                scheduled_at:
                  latestInterview.scheduled_at,

                duration_minutes:
                  latestInterview.duration_minutes,

                meeting_provider:
                  latestInterview.meeting_provider,

                meeting_url:
                  latestInterview.meeting_url,
              }
            : null
        }
        teachers={teachers}
      />

      <InterviewResultForm
        levelTestId={
          levelTest.id
        }
        interview={
          latestInterview
            ? {
                id:
                  latestInterview.id,

                status:
                  latestInterview.status,

                speaking_level:
                  latestInterview.speaking_level,

                listening_level:
                  latestInterview.listening_level,

                pronunciation_level:
                  latestInterview.pronunciation_level,

                comprehension_level:
                  latestInterview.comprehension_level,

                suggested_level:
                  latestInterview.suggested_level,

                strengths:
                  latestInterview.strengths,

                weaknesses:
                  latestInterview.weaknesses,

                teacher_comment:
                  latestInterview.teacher_comment,
              }
            : null
        }
      />

      <section
        style={sectionStyle}
      >
        <SectionTitle
          title="원어민 화상 레벨테스트"
          description="관리자가 추가 확인이 필요하다고 판단한 경우에만 진행합니다."
        />

        {!levelTest.interview_required &&
        !latestInterview ? (
          <div
            style={{
              marginTop: "20px",
              padding: "22px",
              border:
                "1px solid #e4e7ec",
              borderRadius: "12px",
              background: "#f9fafb",
              color: "#667085",
              fontSize: "13px",
              lineHeight: 1.7,
            }}
          >
            현재 원어민 추가
            테스트가 요청되지
            않았습니다.
          </div>
        ) : (
          <>
            <div
              style={infoGridStyle}
            >
              <InfoItem
                label="진행 상태"
                value={getInterviewStatusLabel(
                  latestInterview?.status ??
                    levelTest.interview_status
                )}
              />

              <InfoItem
                label="예정 일시"
                value={formatDateTime(
                  latestInterview?.scheduled_at ??
                    levelTest.scheduled_at
                )}
              />

              <InfoItem
                label="테스트 시간"
                value={
                  latestInterview
                    ? `${latestInterview.duration_minutes}분`
                    : "-"
                }
              />

              <InfoItem
                label="강사 제안 레벨"
                value={
                  latestInterview?.suggested_level ??
                  levelTest.teacher_suggested_level ??
                  "-"
                }
              />

              <InfoItem
                label="Speaking"
                value={formatLevelScore(
                  latestInterview?.speaking_level
                )}
              />

              <InfoItem
                label="Listening"
                value={formatLevelScore(
                  latestInterview?.listening_level
                )}
              />

              <InfoItem
                label="Pronunciation"
                value={formatLevelScore(
                  latestInterview?.pronunciation_level
                )}
              />

              <InfoItem
                label="Comprehension"
                value={formatLevelScore(
                  latestInterview?.comprehension_level
                )}
              />
            </div>

            <NoteBox
              label="강점"
              value={
                latestInterview?.strengths ||
                "아직 평가 내용이 없습니다."
              }
            />

            <NoteBox
              label="보완점"
              value={
                latestInterview?.weaknesses ||
                "아직 평가 내용이 없습니다."
              }
            />

            <NoteBox
              label="강사 의견"
              value={
                latestInterview?.teacher_comment ||
                "아직 강사 의견이 없습니다."
              }
            />
          </>
        )}
      </section>

      <section
        style={sectionStyle}
      >
        <SectionTitle
          title="최종 레벨"
          description="AI 결과와 필요한 경우 원어민 테스트 결과를 참고하여 관리자가 최종 확정합니다."
        />

        <div
          style={{
            marginTop: "20px",
            padding: "24px",

            border:
              levelTest.final_level
                ? "1px solid #abefc6"
                : "1px solid #e4e7ec",

            borderRadius: "14px",

            background:
              levelTest.final_level
                ? "#ecfdf3"
                : "#f9fafb",
          }}
        >
          <div
            style={{
              color: "#667085",
              fontSize: "11px",
              fontWeight: 900,
            }}
          >
            FINAL LEVEL
          </div>

          <div
            style={{
              marginTop: "8px",

              color:
                levelTest.final_level
                  ? "#027a48"
                  : "#98a2b3",

              fontSize: "28px",
              fontWeight: 900,
            }}
          >
            {levelTest.final_level ??
              "아직 최종 레벨이 확정되지 않았습니다."}
          </div>

          {levelTest.finalized_at && (
            <div
              style={{
                marginTop: "8px",
                color: "#667085",
                fontSize: "12px",
              }}
            >
              확정일:{" "}
              {formatDateTime(
                levelTest.finalized_at
              )}
            </div>
          )}
        </div>

        <NoteBox
          label="추천 및 배정 참고사항"
          value={
            levelTest.recommendation ||
            "등록된 추천 내용이 없습니다."
          }
        />
      </section>

      <div
        style={{
          marginTop: "24px",
        }}
      >
        <Link
          href="/admin/level-tests"
          style={
            secondaryButtonStyle
          }
        >
          ← 레벨테스트 목록으로
        </Link>
      </div>
    </main>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2
        style={{
          margin: 0,
          color: "#101828",
          fontSize: "19px",
        }}
      >
        {title}
      </h2>

      <p
        style={{
          margin:
            "6px 0 0",
          color: "#98a2b3",
          fontSize: "12px",
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          color: "#98a2b3",
          fontSize: "11px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "7px",
          color: "#101828",
          fontSize: "14px",
          fontWeight: 900,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function NoteBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        marginTop: "22px",
        padding: "18px",
        border:
          "1px solid #e4e7ec",
        borderRadius: "12px",
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "11px",
          fontWeight: 900,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "8px",
          color: "#344054",
          fontSize: "13px",
          lineHeight: 1.8,
          whiteSpace: "pre-wrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DecisionCard({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div
      style={{
        padding: "18px",

        border: active
          ? "1px solid #b2ccff"
          : "1px solid #e4e7ec",

        borderRadius: "12px",

        background: active
          ? "#f5f8ff"
          : "#f9fafb",
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "11px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "7px",

          color: active
            ? "#2f6fed"
            : "#667085",

          fontSize: "15px",
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  label,
}: {
  label: string;
}) {
  return (
    <span
      style={{
        minHeight: "30px",
        padding: "0 11px",
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        background: "#eef4ff",
        color: "#2f6fed",
        fontSize: "11px",
        fontWeight: 900,
      }}
    >
      {label}
    </span>
  );
}

function getStatusLabel(
  status: string
) {
  switch (status) {
    case "requested":
      return "신청";

    case "ai_in_progress":
      return "AI 테스트 진행 중";

    case "ai_completed":
      return "AI 테스트 완료";

    case "admin_review":
      return "관리자 검토";

    case "interview_required":
      return "원어민 테스트 필요";

    case "interview_scheduled":
      return "원어민 테스트 예정";

    case "interview_completed":
      return "원어민 테스트 완료";

    case "completed":
      return "최종 완료";

    default:
      return status;
  }
}

function getAiStatusLabel(
  status: string
) {
  switch (status) {
    case "pending":
      return "대기";

    case "in_progress":
      return "진행 중";

    case "completed":
      return "완료";

    default:
      return status;
  }
}

function getInterviewStatusLabel(
  status: string | null
) {
  if (!status) {
    return "일정 미정";
  }

  switch (status) {
    case "scheduling":
      return "일정 협의 중";

    case "scheduled":
      return "예정";

    case "in_progress":
      return "진행 중";

    case "completed":
      return "완료";

    case "cancelled":
      return "취소";

    case "no_show":
      return "불참";

    default:
      return status;
  }
}

function formatLevelScore(
  value:
    | number
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "-";
  }

  return `${value} / 10`;
}

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(
    new Date(value)
  );
}

const sectionStyle = {
  marginTop: "22px",
  padding: "24px",
  border:
    "1px solid #e4e7ec",
  borderRadius: "16px",
  background: "#ffffff",
};

const infoGridStyle = {
  marginTop: "22px",
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",
  gap: "22px",
};

const secondaryButtonStyle = {
  minHeight: "46px",
  padding: "0 18px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border:
    "1px solid #d0d5dd",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#344054",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 800,
};