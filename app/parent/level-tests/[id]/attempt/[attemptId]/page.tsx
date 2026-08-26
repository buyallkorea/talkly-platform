import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import LevelTestQuestionPanel from "./LevelTestQuestionPanel";

type PageProps = {
  params: Promise<{
    id: string;
    attemptId: string;
  }>;
};

type QuestionRow = {
  id: number;
  target_group: string;
  category: string;
  difficulty: number;
  question_text: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  audio_url: string | null;
  grammar_topic: string | null;
  listening_topic: string | null;
};

function normalizeDifficulty(
  value: unknown
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return 1;
  }

  return Math.max(
    1,
    Math.min(
      5,
      Math.round(number)
    )
  );
}

export default async function ParentLevelTestAttemptPage({
  params,
}: PageProps) {
  const {
    id,
    attemptId,
  } = await params;

  const levelTestId =
    Number(id);

  const parsedAttemptId =
    Number(attemptId);

  if (
    !Number.isInteger(levelTestId) ||
    levelTestId <= 0 ||
    !Number.isInteger(parsedAttemptId) ||
    parsedAttemptId <= 0
  ) {
    notFound();
  }

  const supabase =
    await createClient();

  /*
   * 로그인 확인
   */
  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /*
   * 학부모 / 학생 권한 확인
   */
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
    (
      profile.role !== "parent" &&
      profile.role !== "student"
    )
  ) {
    redirect("/");
  }

  const isStudent =
    profile.role === "student";

  /*
   * 레벨테스트 확인
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
      target_group,
      ai_status,
      status
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
   * 접근 권한 확인
   *
   * 학부모:
   * 본인이 신청한 레벨테스트만 가능
   *
   * 학생:
   * student_user_id가 본인이거나
   * child_id에 연결된 학생 계정이 본인이어야 함
   */
  if (!isStudent) {
    if (
      levelTest.parent_user_id !==
      user.id
    ) {
      redirect("/parent");
    }
  }

  if (isStudent) {
    let studentHasAccess =
      levelTest.student_user_id ===
      user.id;

    if (
      !studentHasAccess &&
      levelTest.child_id
    ) {
      const {
        data: linkedChild,
        error: linkedChildError,
      } = await supabase
        .from("children")
        .select(`
          id,
          student_user_id,
          linked_student_user_id
        `)
        .eq(
          "id",
          levelTest.child_id
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();

      if (linkedChildError) {
        throw new Error(
          `학생 연결 정보를 확인하지 못했습니다: ${linkedChildError.message}`
        );
      }

      studentHasAccess =
        linkedChild?.student_user_id ===
          user.id ||
        linkedChild?.linked_student_user_id ===
          user.id;
    }

    if (!studentHasAccess) {
      redirect("/student");
    }
  }

  /*
   * 응시 기록 확인
   *
   * 기존 current_difficulty도
   * 호환성을 위해 계속 조회합니다.
   *
   * 실제 문제 출제에는
   * Grammar / Listening별 독립 난이도를 사용합니다.
   */
  const {
    data: attempt,
    error: attemptError,
  } = await supabase
    .from("level_test_attempts")
    .select(`
      id,
      level_test_id,
      student_user_id,
      target_group,
      status,
      current_difficulty,
      current_grammar_difficulty,
      current_listening_difficulty,
      started_at,
      completed_at
    `)
    .eq(
      "id",
      parsedAttemptId
    )
    .eq(
      "level_test_id",
      levelTestId
    )
    .maybeSingle();

  if (attemptError) {
    throw new Error(
      `응시 정보를 불러오지 못했습니다: ${attemptError.message}`
    );
  }

  if (!attempt) {
    notFound();
  }

  /*
   * 학생 계정은 본인의 attempt만 허용
   */
  if (
    isStudent &&
    attempt.student_user_id &&
    attempt.student_user_id !==
      user.id
  ) {
    redirect("/student");
  }

  /*
   * 이미 완료된 응시는
   * 레벨테스트 안내 화면으로 이동
   */
  if (
    attempt.status ===
    "completed"
  ) {
    redirect(
      `/parent/level-tests/${levelTestId}`
    );
  }

  /*
   * 이미 답변한 문항 확인
   */
  const {
    data: answeredRows,
    error: answeredError,
  } = await supabase
    .from("level_test_answers")
    .select(`
      question_id
    `)
    .eq(
      "attempt_id",
      parsedAttemptId
    );

  if (answeredError) {
    throw new Error(
      `답변 기록을 불러오지 못했습니다: ${answeredError.message}`
    );
  }

  const answeredQuestionIds =
    (answeredRows ?? []).map(
      (row) =>
        row.question_id
    );

  const answeredCount =
    answeredQuestionIds.length;

  /*
   * Grammar / Listening을
   * 번갈아 출제
   *
   * 1, 3, 5 ... = Grammar
   * 2, 4, 6 ... = Listening
   *
   * 20문항 완료 시
   * Grammar 10 + Listening 10
   */
  const nextCategory =
    answeredCount % 2 === 0
      ? "grammar"
      : "listening";

  /*
   * 영역별 현재 적응 난이도
   *
   * Grammar 문제:
   * current_grammar_difficulty
   *
   * Listening 문제:
   * current_listening_difficulty
   */
  const grammarDifficulty =
    normalizeDifficulty(
      attempt.current_grammar_difficulty
    );

  const listeningDifficulty =
    normalizeDifficulty(
      attempt.current_listening_difficulty
    );

  const currentCategoryDifficulty =
    nextCategory === "grammar"
      ? grammarDifficulty
      : listeningDifficulty;

  /*
   * 현재 영역에서 아직 풀지 않은
   * 모든 후보 문항 조회
   *
   * correct_answer는 조회하지 않음
   */
  let questionQuery =
    supabase
      .from(
        "level_test_questions"
      )
      .select(`
        id,
        target_group,
        category,
        difficulty,
        question_text,
        choice_a,
        choice_b,
        choice_c,
        choice_d,
        audio_url,
        grammar_topic,
        listening_topic
      `)
      .eq(
        "target_group",
        attempt.target_group
      )
      .eq(
        "category",
        nextCategory
      )
      .eq(
        "is_active",
        true
      );

  if (
    answeredQuestionIds.length >
    0
  ) {
    questionQuery =
      questionQuery.not(
        "id",
        "in",
        `(${answeredQuestionIds.join(
          ","
        )})`
      );
  }

  const {
    data: candidateData,
    error: candidateError,
  } = await questionQuery
    .order("id", {
      ascending: true,
    });

  if (candidateError) {
    throw new Error(
      `레벨테스트 문항을 불러오지 못했습니다: ${candidateError.message}`
    );
  }

  const candidates =
    (candidateData ??
      []) as QuestionRow[];

  /*
   * 현재 출제 영역의 독립 난이도와
   * 가장 가까운 문항을 선택합니다.
   *
   * Grammar 문제 선택에는
   * Listening 난이도가 영향을 주지 않고,
   *
   * Listening 문제 선택에는
   * Grammar 난이도가 영향을 주지 않습니다.
   */
  const sortedCandidates =
    [...candidates].sort(
      (a, b) => {
        const aDifference =
          Math.abs(
            a.difficulty -
              currentCategoryDifficulty
          );

        const bDifference =
          Math.abs(
            b.difficulty -
              currentCategoryDifficulty
          );

        if (
          aDifference !==
          bDifference
        ) {
          return (
            aDifference -
            bDifference
          );
        }

        if (
          a.difficulty !==
          b.difficulty
        ) {
          return (
            a.difficulty -
            b.difficulty
          );
        }

        return a.id - b.id;
      }
    );

  const question =
    sortedCandidates.length >
    0
      ? sortedCandidates[0]
      : null;

  /*
   * Listening 음원 Public URL 생성
   *
   * DB에는 파일명만 저장되어 있음.
   * Storage bucket: level-test-audio
   */
  let publicAudioUrl:
    | string
    | null = null;

  if (
    question?.category ===
      "listening" &&
    question.audio_url
  ) {
    const {
      data: publicUrlData,
    } = supabase.storage
      .from(
        "level-test-audio"
      )
      .getPublicUrl(
        question.audio_url
      );

    publicAudioUrl =
      publicUrlData.publicUrl;
  }

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "820px",
        margin: "0 auto",
        padding:
          "48px 28px 90px",
      }}
    >
      <Link
        href={`/parent/level-tests/${levelTestId}`}
        style={{
          color: "#667085",
          textDecoration: "none",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        ← 레벨테스트 안내
      </Link>

      <div
        style={{
          marginTop: "24px",
        }}
      >
        <div
          style={{
            color: "#2f6fed",
            fontSize: "12px",
            fontWeight: 900,
            letterSpacing:
              "0.08em",
          }}
        >
          TALKLY AI LEVEL TEST
        </div>

        <h1
          style={{
            margin: "10px 0 0",
            color: "#101828",
            fontSize: "32px",
            lineHeight: 1.2,
            letterSpacing:
              "-0.04em",
          }}
        >
          레벨테스트 진행
        </h1>

        <p
          style={{
            margin: "12px 0 0",
            color: "#667085",
            fontSize: "13px",
            lineHeight: 1.7,
          }}
        >
          문제를 읽거나 음성을 듣고
          가장 알맞은 답을
          선택해주세요.
        </p>
      </div>

      {/* 진행 정보 */}
      <section
        style={{
          marginTop: "24px",
          padding: "18px 20px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "14px",
          background: "#f9fafb",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "14px",
          }}
        >
          <InfoItem
            label={
              nextCategory ===
              "grammar"
                ? "Grammar 적응 난이도"
                : "Listening 적응 난이도"
            }
            value={`Level ${currentCategoryDifficulty}`}
          />

          <InfoItem
            label="응답 문항"
            value={`${answeredCount} / 20`}
          />

          <InfoItem
            label="다음 영역"
            value={
              nextCategory ===
              "grammar"
                ? "Grammar"
                : "Listening"
            }
          />

          <InfoItem
            label="테스트 유형"
            value={getTargetGroupLabel(
              attempt.target_group
            )}
          />
        </div>
      </section>

      {/* 실제 문제 */}
      <LevelTestQuestionPanel
        levelTestId={
          levelTestId
        }
        attemptId={
          parsedAttemptId
        }
        currentDifficulty={
          currentCategoryDifficulty
        }
        answeredCount={
          answeredCount
        }
        question={
          question
            ? {
                id:
                  question.id,

                category:
                  question.category,

                difficulty:
                  question.difficulty,

                question_text:
                  question.question_text,

                choice_a:
                  question.choice_a,

                choice_b:
                  question.choice_b,

                choice_c:
                  question.choice_c,

                choice_d:
                  question.choice_d,

                audio_url:
                  publicAudioUrl,

                grammar_topic:
                  question.grammar_topic,

                listening_topic:
                  question.listening_topic,
              }
            : null
        }
      />
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
          fontSize: "10px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "6px",
          color: "#344054",
          fontSize: "13px",
          fontWeight: 900,
          lineHeight: 1.5,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function getTargetGroupLabel(
  value: string
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
      return value;
  }
}