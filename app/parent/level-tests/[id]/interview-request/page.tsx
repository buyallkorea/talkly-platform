import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import InterviewRequestForm from "./InterviewRequestForm";

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

type AttemptRow = {
  id: number;
  status: string;
  grammar_score: number | null;
  listening_score: number | null;
  total_score: number | null;
  suggested_level: string | null;
  confidence: number | null;
};

export default async function InterviewRequestPage({
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

  /*
   * =====================================================
   * 1. 로그인 확인
   * =====================================================
   */
  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /*
   * =====================================================
   * 2. 학부모 계정 확인
   *
   * 현재 화상레벨테스트 신청은
   * 학부모 신청 흐름부터 구현합니다.
   *
   * 성인 / 학생 직접 신청은 이후 같은 구조를
   * 확장하여 연결할 수 있습니다.
   * =====================================================
   */
  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select(`
      role,
      name,
      phone
    `)
    .eq(
      "id",
      user.id
    )
    .maybeSingle();

  if (profileError) {
    throw new Error(
      `회원 정보를 불러오지 못했습니다: ${profileError.message}`
    );
  }

  if (
    !profile ||
    profile.role !== "parent"
  ) {
    redirect("/");
  }

  /*
   * =====================================================
   * 3. 레벨테스트 조회
   * =====================================================
   */
  const {
    data: levelTest,
    error: levelTestError,
  } = await supabase
    .from("level_tests")
    .select(`
      id,
      parent_user_id,
      student_user_id,
      child_id,

      student_name,
      student_birth_date,
      student_age,
      school_name,
      grade,

      learning_history,
      learning_goal,

      target_group,
      status,

      score,

      ai_status,
      ai_suggested_level,
      ai_confidence,

      interview_required,
      interview_status,

      created_at
    `)
    .eq(
      "id",
      levelTestId
    )
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
   * 본인이 신청한 레벨테스트인지 확인
   */
  if (
    levelTest.parent_user_id !==
    user.id
  ) {
    redirect("/parent");
  }

  /*
   * =====================================================
   * 4. 온라인 레벨테스트 완료 여부
   *
   * 온라인 테스트가 완료된 뒤에만
   * 화상레벨테스트 신청 가능
   * =====================================================
   */
  const onlineTestCompleted =
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

  if (!onlineTestCompleted) {
    redirect(
      `/parent/level-tests/${levelTestId}`
    );
  }

  /*
   * =====================================================
   * 5. 자녀 정보
   * =====================================================
   */
  let child:
    ChildRow | null = null;

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
      .eq(
        "is_active",
        true
      )
      .maybeSingle();

    if (childError) {
      throw new Error(
        `학생 정보를 불러오지 못했습니다: ${childError.message}`
      );
    }

    child =
      childData as
        ChildRow | null;
  }

  /*
   * 신청 당시 저장된 정보를 우선 사용
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

  /*
   * =====================================================
   * 6. 최신 온라인 테스트 결과
   * =====================================================
   */
  const {
    data: attemptData,
    error: attemptError,
  } = await supabase
    .from("level_test_attempts")
    .select(`
      id,
      status,
      grammar_score,
      listening_score,
      total_score,
      suggested_level,
      confidence
    `)
    .eq(
      "level_test_id",
      levelTestId
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(1)
    .maybeSingle();

  if (attemptError) {
    throw new Error(
      `온라인 테스트 결과를 불러오지 못했습니다: ${attemptError.message}`
    );
  }

  const latestAttempt =
    attemptData as
      AttemptRow | null;

  const grammarScore =
    latestAttempt
      ?.grammar_score ??
    null;

  const listeningScore =
    latestAttempt
      ?.listening_score ??
    null;

  const totalScore =
    latestAttempt
      ?.total_score ??
    levelTest.score ??
    null;

  const suggestedLevel =
    latestAttempt
      ?.suggested_level ||
    levelTest.ai_suggested_level ||
    "-";

  const confidence =
    latestAttempt
      ?.confidence ??
    levelTest.ai_confidence ??
    null;

  /*
   * =====================================================
   * 7. 기존 화상레벨테스트 신청 확인
   *
   * 한 레벨테스트에 신청 계획은
   * 한 건을 기준으로 운영합니다.
   * =====================================================
   */
  const {
    data: existingPreference,
    error: preferenceError,
  } = await supabase
    .from(
      "level_test_class_preferences"
    )
    .select("*")
    .eq(
      "level_test_id",
      levelTestId
    )
    .maybeSingle();

  /*
   * RLS가 아직 다음 작업에서 정리될 예정이므로
   * 조회 오류만으로 페이지 전체를 깨뜨리지는 않습니다.
   */
  const existingRequest =
    !preferenceError
      ? existingPreference
      : null;

  /*
   * =====================================================
   * 8. 화면
   * =====================================================
   */
  return (
    <main
      style={{
        width: "100%",
        maxWidth: "920px",
        margin: "0 auto",
        padding:
          "54px 32px 90px",
      }}
    >
      {/* 뒤로가기 */}

      <Link
        href={`/parent/level-tests/${levelTestId}`}
        style={{
          color: "#667085",
          textDecoration:
            "none",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        ← 온라인 레벨테스트 결과
      </Link>

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <section
        style={{
          marginTop: "24px",
          padding: "30px",
          borderRadius: "20px",
          border:
            "1px solid #dbe7ff",
          background:
            "linear-gradient(135deg, #ffffff 0%, #f3f7ff 100%)",
          boxShadow:
            "0 12px 34px rgba(47,111,237,0.07)",
        }}
      >
        <div
          style={{
            color: "#2f6fed",
            fontSize: "11px",
            fontWeight: 900,
            letterSpacing:
              "0.08em",
          }}
        >
          VIDEO LEVEL TEST
        </div>

        <h1
          style={{
            margin: "9px 0 0",
            color: "#101828",
            fontSize: "32px",
            lineHeight: 1.25,
            letterSpacing:
              "-0.04em",
          }}
        >
          무료 원어민 화상레벨테스트 신청
        </h1>

        <p
          style={{
            margin: "13px 0 0",
            maxWidth: "720px",
            color: "#667085",
            fontSize: "14px",
            lineHeight: 1.8,
          }}
        >
          온라인 테스트에서 확인하기 어려운
          Speaking, Pronunciation,
          Listening 및 실제 의사소통 능력을
          원어민 강사가 확인합니다.
        </p>

        <div
          style={{
            marginTop: "18px",
            padding: "14px 16px",
            borderRadius: "11px",
            background:
              "rgba(47,111,237,0.07)",
            color: "#344054",
            fontSize: "12px",
            lineHeight: 1.75,
          }}
        >
          화상레벨테스트는 기본적으로
          <strong>
            {" "}
            필리핀 원어민 강사
          </strong>
          가 진행합니다. 아래에서 선택하는
          강사 국적은 화상레벨테스트 강사의
          국적이 아니라
          <strong>
            {" "}
            향후 정규수업에서 희망하는
            담당강사의 국적
          </strong>
          입니다.
        </div>
      </section>

      {/* ================================================= */}
      {/* 학생 + 온라인 결과 */}
      {/* ================================================= */}

      <section
        style={{
          marginTop: "22px",
          padding: "26px",
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
            alignItems:
              "flex-start",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color: "#98a2b3",
                fontSize: "11px",
                fontWeight: 800,
              }}
            >
              STUDENT
            </div>

            <h2
              style={{
                margin: "6px 0 0",
                color: "#101828",
                fontSize: "22px",
              }}
            >
              {studentName}
            </h2>
          </div>

          <div
            style={{
              padding:
                "9px 13px",
              borderRadius:
                "999px",
              background:
                "#eef4ff",
              color: "#2f6fed",
              fontSize: "12px",
              fontWeight: 900,
            }}
          >
            {suggestedLevel}
          </div>
        </div>

        <div
          style={{
            marginTop: "22px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(140px, 1fr))",
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
            label="학교"
            value={studentSchool}
          />

          <InfoItem
            label="온라인 추천 레벨"
            value={suggestedLevel}
          />
        </div>

        <div
          style={{
            marginTop: "22px",
            paddingTop: "20px",
            borderTop:
              "1px solid #eaecf0",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "12px",
          }}
        >
          <ScoreItem
            label="Grammar"
            value={grammarScore}
          />

          <ScoreItem
            label="Listening"
            value={listeningScore}
          />

          <ScoreItem
            label="Overall"
            value={totalScore}
          />

          <ScoreItem
            label="Confidence"
            value={confidence}
            suffix="%"
          />
        </div>
      </section>

      {/* ================================================= */}
      {/* 신청 진행 안내 */}
      {/* ================================================= */}

      <section
        style={{
          marginTop: "22px",
          padding: "22px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "14px",
          background: "#f9fafb",
        }}
      >
        <div
          style={{
            color: "#101828",
            fontSize: "15px",
            fontWeight: 900,
          }}
        >
          신청 후 진행 순서
        </div>

        <div
          style={{
            marginTop: "14px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "10px",
          }}
        >
          <StepCard
            number="1"
            text="희망 정규수업 조건 입력"
          />

          <StepCard
            number="2"
            text="TALKLY 관리자 확인 및 상담"
          />

          <StepCard
            number="3"
            text="필리핀 원어민 테스트 강사 배정"
          />

          <StepCard
            number="4"
            text="테스트 일정 및 강의실 안내"
          />

          <StepCard
            number="5"
            text="무료 화상레벨테스트 진행"
          />

          <StepCard
            number="6"
            text="최종 레벨 및 수강 안내"
          />
        </div>
      </section>

      {/* ================================================= */}
      {/* 실제 신청 Form */}
      {/* ================================================= */}

      <InterviewRequestForm
        levelTestId={
          levelTestId
        }
        childId={
          levelTest.child_id
        }
        studentName={
          studentName
        }
        grade={
          studentGrade
        }
        parentName={
          profile.name ?? ""
        }
        parentPhone={
          profile.phone ?? ""
        }
        learningGoal={
          levelTest.learning_goal ??
          ""
        }
        existingRequest={
          existingRequest
        }
      />

      {/* ================================================= */}
      {/* 하단 안내 */}
      {/* ================================================= */}

      <section
        style={{
          marginTop: "22px",
          padding: "20px",
          border:
            "1px solid #fedf89",
          borderRadius: "13px",
          background: "#fffaeb",
          color: "#93370d",
          fontSize: "12px",
          lineHeight: 1.75,
        }}
      >
        <strong>
          수업 일정에 대한 안내
        </strong>

        <div
          style={{
            marginTop: "7px",
          }}
        >
          신청 단계에서 입력하는 일정은
          정규수업을 위한 희망 조건입니다.
          TALKLY 관리자가 강사 일정과
          수업 가능 여부를 확인한 후
          상담을 통해 최종 확정합니다.
        </div>

        <div
          style={{
            marginTop: "7px",
          }}
        >
          정규수업이 시작되면 원칙적으로
          선택한 수업시간은 모든 수업요일과
          전체 수강기간 동안 동일하게
          운영됩니다. 이후 일정 변경이
          필요한 경우 TALKLY와 별도로
          협의할 수 있습니다.
        </div>

        <div
          style={{
            marginTop: "7px",
          }}
        >
          화상레벨테스트를 진행한 강사를
          정규수업 담당강사로 우선 연결할 수
          있도록 운영하되, 희망 국적이나
          수업시간 및 강사 일정에 따라
          담당강사가 달라질 수 있습니다.
        </div>
      </section>

      <div
        style={{
          marginTop: "24px",
        }}
      >
        <Link
          href={`/parent/level-tests/${levelTestId}`}
          style={{
            minHeight: "46px",
            padding: "0 18px",
            display:
              "inline-flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            border:
              "1px solid #d0d5dd",
            borderRadius:
              "10px",
            background:
              "#ffffff",
            color: "#344054",
            textDecoration:
              "none",
            fontSize: "13px",
            fontWeight: 800,
          }}
        >
          ← 온라인 레벨테스트 결과
        </Link>
      </div>
    </main>
  );
}

/*
 * =========================================================
 * 화면 보조 컴포넌트
 * =========================================================
 */

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
          fontSize: "10px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "6px",
          color: "#101828",
          fontSize: "14px",
          fontWeight: 900,
        }}
      >
        {value || "-"}
      </div>
    </div>
  );
}

function ScoreItem({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number | null;
  suffix?: string;
}) {
  return (
    <div
      style={{
        padding: "15px",
        border:
          "1px solid #eaecf0",
        borderRadius: "11px",
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          color: "#98a2b3",
          fontSize: "10px",
          fontWeight: 800,
          textTransform:
            "uppercase",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "6px",
          color: "#101828",
          fontSize: "21px",
          fontWeight: 900,
        }}
      >
        {value !== null
          ? `${value}${suffix}`
          : "-"}
      </div>
    </div>
  );
}

function StepCard({
  number,
  text,
}: {
  number: string;
  text: string;
}) {
  return (
    <div
      style={{
        padding: "15px",
        border:
          "1px solid #e4e7ec",
        borderRadius: "11px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          width: "26px",
          height: "26px",
          display: "flex",
          alignItems: "center",
          justifyContent:
            "center",
          borderRadius: "50%",
          background: "#eef4ff",
          color: "#2f6fed",
          fontSize: "11px",
          fontWeight: 900,
        }}
      >
        {number}
      </div>

      <div
        style={{
          marginTop: "10px",
          color: "#344054",
          fontSize: "12px",
          fontWeight: 800,
          lineHeight: 1.6,
        }}
      >
        {text}
      </div>
    </div>
  );
}