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
   * 학부모 권한 확인
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
    profile.role !== "parent"
  ) {
    redirect("/");
  }

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
   * 본인 레벨테스트만 응시 가능
   */
  if (
    levelTest.parent_user_id !==
    user.id
  ) {
    redirect("/parent");
  }

  /*
   * 응시 기록 확인
   */
  const {
    data: attempt,
    error: attemptError,
  } = await supabase
    .from("level_test_attempts")
    .select(`
      id,
      level_test_id,
      target_group,
      status,
      current_difficulty,
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
   */
  const nextCategory =
    answeredCount % 2 === 0
      ? "grammar"
      : "listening";

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
   * 현재 난이도와 가장 가까운
   * 문항 선택
   */
  const sortedCandidates =
    [...candidates].sort(
      (a, b) => {
        const aDifference =
          Math.abs(
            a.difficulty -
              attempt.current_difficulty
          );

        const bDifference =
          Math.abs(
            b.difficulty -
              attempt.current_difficulty
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
   * DB에는 파일명만 저장되어 있음:
   * elementary-l1-01.mp3
   *
   * Storage bucket:
   * level-test-audio
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
            label="현재 적응 난이도"
            value={`Level ${attempt.current_difficulty}`}
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
          attempt.current_difficulty
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

                /*
                 * DB의 파일명이 아니라
                 * 실제 Public URL 전달
                 */
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