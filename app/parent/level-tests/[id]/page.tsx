import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import LevelTestStartPanel from "./LevelTestStartPanel";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ChildRow = {
  id: number;
  name: string;
  grade: string | null;
  school_name: string | null;
};

export default async function ParentLevelTestDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const levelTestId =
    Number(id);

  if (
    !Number.isInteger(levelTestId) ||
    levelTestId <= 0
  ) {
    notFound();
  }

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

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
    profile.role !== "parent"
  ) {
    redirect("/");
  }

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

      student_name,
      student_birth_date,
      student_age,
      school_name,
      grade,
      learning_history,
      learning_goal,

      status,
      test_type,
      target_group,

      ai_status,
      ai_suggested_level,
      ai_confidence,

      interview_required,
      interview_status,

      final_level,

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
   * 다른 학부모의 레벨테스트에는
   * 접근할 수 없습니다.
   */
  if (
    levelTest.parent_user_id !==
    user.id
  ) {
    redirect("/parent");
  }

  /*
   * 기존 TALKLY 자녀와 연결된
   * 레벨테스트라면 children 정보도
   * 보조적으로 불러옵니다.
   *
   * 직접 입력 신청인 경우
   * child_id가 null이므로 조회하지 않습니다.
   */
  let child: ChildRow | null =
    null;

  if (levelTest.child_id) {
    const {
      data: childData,
      error: childError,
    } = await supabase
      .from("children")
      .select(`
        id,
        name,
        grade,
        school_name
      `)
      .eq(
        "id",
        levelTest.child_id
      )
      .eq(
        "parent_user_id",
        user.id
      )
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
   * 레벨테스트 신청 당시 저장된 정보를
   * 우선 사용합니다.
   *
   * 과거 데이터처럼 student_name 등이
   * 없는 경우에만 children 정보를
   * fallback으로 사용합니다.
   */
  const studentName =
    levelTest.student_name ||
    child?.name ||
    "학생";

  const studentGrade =
    levelTest.grade ||
    child?.grade ||
    "-";

  const studentSchool =
    levelTest.school_name ||
    child?.school_name ||
    "-";

  const studentAge =
    levelTest.student_age
      ? `${levelTest.student_age}세`
      : levelTest.student_birth_date
      ? `${calculateAge(
          levelTest.student_birth_date
        )}세`
      : "-";

  /*
   * 가장 최근 응시 기록을 확인합니다.
   */
  const {
    data: attemptsData,
    error: attemptsError,
  } = await supabase
    .from("level_test_attempts")
    .select(`
      id,
      status,
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
      `레벨테스트 응시 기록을 불러오지 못했습니다: ${attemptsError.message}`
    );
  }

  const latestAttempt =
    attemptsData &&
    attemptsData.length > 0
      ? attemptsData[0]
      : null;

  const completed =
    levelTest.ai_status ===
      "completed" ||
    levelTest.status ===
      "admin_review" ||
    levelTest.status ===
      "interview_required" ||
    levelTest.status ===
      "interview_scheduled" ||
    levelTest.status ===
      "interview_completed" ||
    levelTest.status ===
      "completed";

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "900px",
        margin: "0 auto",
        padding:
          "54px 32px 90px",
      }}
    >
      <Link
        href="/parent"
        style={{
          color: "#667085",
          textDecoration:
            "none",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        ← 대시보드
      </Link>

      <div
        style={{
          marginTop: "24px",
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
            TALKLY LEVEL TEST
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
            AI 레벨테스트
          </h1>

          <p
            style={{
              margin:
                "14px 0 0",
              color: "#667085",
              fontSize: "14px",
              lineHeight: 1.8,
            }}
          >
            문법과 리스닝을
            중심으로 현재 영어
            수준을 확인합니다.
          </p>
        </div>

        <StatusBadge
          label={getParentStatusLabel(
            levelTest.status,
            levelTest.ai_status
          )}
        />
      </div>

      {/* 학생 정보 */}
      <section
        style={{
          marginTop: "28px",
          padding: "24px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "16px",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#101828",
              fontSize: "19px",
            }}
          >
            테스트 대상
          </h2>

          <span
            style={{
              padding:
                "5px 9px",
              borderRadius:
                "999px",
              background:
                "#f2f4f7",
              color: "#667085",
              fontSize: "10px",
              fontWeight: 800,
            }}
          >
            {levelTest.child_id
              ? "등록 자녀"
              : "레벨테스트 신청자"}
          </span>
        </div>

        <div
          style={{
            marginTop: "20px",
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "16px",
          }}
        >
          <InfoItem
            label="학생"
            value={studentName}
          />

          <InfoItem
            label="학년"
            value={studentGrade}
          />

          <InfoItem
            label="나이"
            value={studentAge}
          />

          <InfoItem
            label="학교"
            value={studentSchool}
          />
        </div>

        <div
          style={{
            marginTop: "18px",
            paddingTop: "18px",
            borderTop:
              "1px solid #eaecf0",
          }}
        >
          <InfoItem
            label="테스트 유형"
            value={getTargetGroupLabel(
              levelTest.target_group
            )}
          />
        </div>
      </section>

      {/* 선택 입력 정보 */}
      {(levelTest.learning_history ||
        levelTest.learning_goal) && (
        <section
          style={{
            marginTop: "22px",
            padding: "24px",
            border:
              "1px solid #e4e7ec",
            borderRadius:
              "16px",
            background:
              "#ffffff",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#101828",
              fontSize: "19px",
            }}
          >
            학습 정보
          </h2>

          {levelTest.learning_history && (
            <TextInfo
              label="영어 학습경력"
              value={
                levelTest.learning_history
              }
            />
          )}

          {levelTest.learning_goal && (
            <TextInfo
              label="영어 학습 목표"
              value={
                levelTest.learning_goal
              }
            />
          )}
        </section>
      )}

      {/* 응시 전 안내 */}
      {!completed && (
        <section
          style={{
            marginTop: "22px",
            padding: "22px",
            border:
              "1px solid #dbe7ff",
            borderRadius:
              "14px",
            background:
              "#f5f8ff",
          }}
        >
          <div
            style={{
              color: "#2f6fed",
              fontSize: "13px",
              fontWeight: 900,
            }}
          >
            테스트 전 확인해주세요
          </div>

          <div
            style={{
              marginTop: "12px",
              display: "flex",
              flexDirection:
                "column",
              gap: "8px",
              color: "#667085",
              fontSize: "12px",
              lineHeight: 1.7,
            }}
          >
            <div>
              • 실제 테스트를 받을
              학생이 직접 문제를
              풀어주세요.
            </div>

            <div>
              • 조용한 장소에서
              테스트를 진행해주세요.
            </div>

            <div>
              • 리스닝 문제가 있으므로
              스피커 또는 이어폰을
              준비해주세요.
            </div>

            <div>
              • 다른 사람의 도움이나
              번역기를 사용하면 정확한
              레벨 판단이 어렵습니다.
            </div>

            <div>
              • 테스트 결과는 TALKLY
              내부 레벨 판단과 상담
              자료로 사용합니다.
            </div>
          </div>
        </section>
      )}

      {/* 테스트 시작 */}
      <LevelTestStartPanel
        levelTestId={
          levelTest.id
        }
        parentUserId={
          user.id
        }
        childId={
          levelTest.child_id
        }
        targetGroup={
          levelTest.target_group
        }
        aiStatus={
          levelTest.ai_status
        }
        status={
          levelTest.status
        }
        latestAttempt={
          latestAttempt
            ? {
                id:
                  latestAttempt.id,
                status:
                  latestAttempt.status,
              }
            : null
        }
      />

      {/* 완료 후 안내 */}
      {completed && (
        <section
          style={{
            marginTop: "22px",
            padding: "24px",
            border:
              "1px solid #e4e7ec",
            borderRadius:
              "16px",
            background:
              "#ffffff",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#101828",
              fontSize: "19px",
            }}
          >
            테스트가 완료되었습니다
          </h2>

          <p
            style={{
              margin:
                "10px 0 0",
              color: "#667085",
              fontSize: "13px",
              lineHeight: 1.8,
            }}
          >
            TALKLY에서 AI
            레벨테스트 결과를
            검토합니다. 추가 확인이
            필요한 경우 보호자에게
            전화 또는 SNS로 연락하여
            원어민 화상 레벨테스트를
            안내드립니다.
          </p>

          <div
            style={{
              marginTop: "18px",
              padding: "18px",
              border:
                "1px solid #e4e7ec",
              borderRadius:
                "12px",
              background:
                "#f9fafb",
              color: "#667085",
              fontSize: "12px",
              lineHeight: 1.7,
            }}
          >
            AI 점수, 추천 레벨,
            신뢰도 및 내부 평가 내용은
            TALKLY 운영진의 레벨 판단을
            위한 자료이므로 화면에
            표시되지 않습니다.
          </div>
        </section>
      )}

      <div
        style={{
          marginTop: "24px",
        }}
      >
        <Link
          href="/parent"
          style={
            secondaryButtonStyle
          }
        >
          ← 대시보드로
        </Link>
      </div>
    </main>
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
          lineHeight: 1.6,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TextInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        marginTop: "18px",
        padding: "16px",
        border:
          "1px solid #eaecf0",
        borderRadius: "11px",
        background: "#f9fafb",
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
          color: "#344054",
          fontSize: "13px",
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
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

function getParentStatusLabel(
  status: string,
  aiStatus: string
) {
  if (aiStatus === "pending") {
    return "테스트 대기";
  }

  if (
    aiStatus === "in_progress"
  ) {
    return "테스트 진행 중";
  }

  if (
    status ===
      "interview_required" ||
    status ===
      "interview_scheduled"
  ) {
    return "추가 확인 중";
  }

  if (
    aiStatus === "completed" ||
    status === "admin_review"
  ) {
    return "TALKLY 검토 중";
  }

  if (
    status === "completed"
  ) {
    return "검토 완료";
  }

  return "신청 완료";
}

function getTargetGroupLabel(
  value: string | null
) {
  switch (value) {
    case "elementary":
      return "초등 영어";

    case "middle":
      return "중등 영어";

    case "high":
      return "고등 영어";

    case "adult":
      return "대학생·성인 영어";

    default:
      return value || "-";
  }
}

function calculateAge(
  birthDate: string
) {
  const today = new Date();

  const birth = new Date(
    `${birthDate}T00:00:00`
  );

  let age =
    today.getFullYear() -
    birth.getFullYear();

  const monthDifference =
    today.getMonth() -
    birth.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 &&
      today.getDate() <
        birth.getDate())
  ) {
    age -= 1;
  }

  return age;
}

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