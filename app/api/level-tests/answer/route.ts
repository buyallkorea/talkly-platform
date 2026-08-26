import { NextResponse } from "next/server";
import {
  createClient as createAdminClient,
} from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase-server";

const MAX_QUESTIONS = 20;

type RequestBody = {
  levelTestId?: unknown;
  attemptId?: unknown;
  questionId?: unknown;
  selectedAnswer?: unknown;
  responseTimeSeconds?: unknown;
};

type UserRole =
  | "parent"
  | "student";

type QuestionCategory =
  | "grammar"
  | "listening";

type ScoreAnswerRow = {
  question_id: number;
  difficulty: number;
  is_correct: boolean;
};

type ScoreQuestionRow = {
  id: number;
  category: string;
};

type CategoryAnswer = {
  difficulty: number;
  isCorrect: boolean;
};

type CategoryResult = {
  score: number;
  level: number;
  answeredCount: number;
  correctCount: number;
  averageDifficulty: number;
};

function createAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase 관리자 환경변수가 설정되지 않았습니다."
    );
  }

  return createAdminClient(
    url,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function jsonError(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
    }
  );
}

function normalizeAnswer(
  value: unknown
) {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .trim()
    .toUpperCase();
}

function normalizeNumber(
  value: unknown
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return null;
  }

  return number;
}

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

function clamp(
  value: number,
  minimum: number,
  maximum: number
) {
  return Math.max(
    minimum,
    Math.min(
      maximum,
      value
    )
  );
}

function calculateNextDifficulty(
  currentDifficulty: number,
  isCorrect: boolean
) {
  /*
   * TALKLY 적응형 테스트
   *
   * 정답:
   * 해당 영역 난이도 +1
   *
   * 오답:
   * 해당 영역 난이도 -1
   *
   * 난이도 범위:
   * Level 1 ~ Level 5
   */
  if (isCorrect) {
    return Math.min(
      5,
      currentDifficulty + 1
    );
  }

  return Math.max(
    1,
    currentDifficulty - 1
  );
}

function isQuestionCategory(
  value: string
): value is QuestionCategory {
  return (
    value === "grammar" ||
    value === "listening"
  );
}

/*
 * =========================================================
 * TALKLY 온라인 레벨테스트 결과 산정
 * =========================================================
 *
 * 단순 정답률만 사용하지 않습니다.
 *
 * 70%:
 * 출제 난이도를 반영한 정답률
 *
 * 30%:
 * 실제로 도달하여 응시한 평균 난이도
 *
 * 따라서 동일하게 7문제를 맞았더라도
 * Level 4~5 문제를 주로 푼 학생이
 * Level 1~2 문제를 주로 푼 학생보다
 * 더 높은 점수를 받을 수 있습니다.
 */
function calculateCategoryResult(
  answers: CategoryAnswer[]
): CategoryResult {
  if (
    answers.length === 0
  ) {
    return {
      score: 0,
      level: 1,
      answeredCount: 0,
      correctCount: 0,
      averageDifficulty: 1,
    };
  }

  const normalized =
    answers.map(
      (answer) => ({
        difficulty:
          normalizeDifficulty(
            answer.difficulty
          ),

        isCorrect:
          answer.isCorrect,
      })
    );

  const answeredCount =
    normalized.length;

  const correctCount =
    normalized.filter(
      (answer) =>
        answer.isCorrect
    ).length;

  /*
   * 난이도 가중 정답률
   *
   * Level 5 문제 정답은
   * Level 1 문제 정답보다
   * 더 높은 수행으로 평가합니다.
   */
  const weightedMaximum =
    normalized.reduce(
      (
        total,
        answer
      ) =>
        total +
        answer.difficulty,
      0
    );

  const weightedCorrect =
    normalized.reduce(
      (
        total,
        answer
      ) =>
        total +
        (
          answer.isCorrect
            ? answer.difficulty
            : 0
        ),
      0
    );

  const weightedAccuracy =
    weightedMaximum > 0
      ? weightedCorrect /
        weightedMaximum
      : 0;

  /*
   * 실제 출제 평균 난이도
   *
   * Level 1 = 0
   * Level 5 = 1
   * 로 정규화합니다.
   */
  const averageDifficulty =
    normalized.reduce(
      (
        total,
        answer
      ) =>
        total +
        answer.difficulty,
      0
    ) /
    answeredCount;

  const difficultyIndex =
    clamp(
      (
        averageDifficulty -
        1
      ) / 4,
      0,
      1
    );

  const rawScore =
    (
      weightedAccuracy *
        0.7 +
      difficultyIndex *
        0.3
    ) *
    100;

  const score =
    clamp(
      Math.round(
        rawScore
      ),
      0,
      100
    );

  return {
    score,

    level:
      scoreToLevel(
        score
      ),

    answeredCount,

    correctCount,

    averageDifficulty:
      Number(
        averageDifficulty.toFixed(
          2
        )
      ),
  };
}

/*
 * TALKLY 온라인 테스트 Level
 *
 * 0 ~ 19   Level 1
 * 20 ~ 39  Level 2
 * 40 ~ 59  Level 3
 * 60 ~ 79  Level 4
 * 80 ~ 100 Level 5
 *
 * 추후 실제 운영데이터가 충분히 쌓이면
 * 이 경계값만 조정할 수 있도록
 * 함수로 분리해 둡니다.
 */
function scoreToLevel(
  score: number
) {
  if (
    score >= 80
  ) {
    return 5;
  }

  if (
    score >= 60
  ) {
    return 4;
  }

  if (
    score >= 40
  ) {
    return 3;
  }

  if (
    score >= 20
  ) {
    return 2;
  }

  return 1;
}

function getSuggestedLevelLabel(
  level: number
) {
  return `Level ${clamp(
    Math.round(level),
    1,
    5
  )}`;
}

/*
 * 추천 레벨의 신뢰도
 *
 * 현재 온라인 테스트는
 * Grammar 10 + Listening 10,
 * 총 20문항 구조입니다.
 *
 * 기본 신뢰도:
 * - 응답 완성도 50%
 * - 두 영역의 문항 균형 20%
 * - 레벨 경계값과의 거리 30%
 *
 * 점수가 Level 경계에 매우 가까우면
 * 추천 레벨의 신뢰도를 조금 낮춥니다.
 *
 * 이 값은 "학생 실력이 얼마나 좋은가"가 아니라
 * "온라인 테스트가 해당 Level을 얼마나
 * 안정적으로 제안할 수 있는가"를 의미합니다.
 */
function calculateConfidence({
  totalScore,
  totalAnswered,
  grammarAnswered,
  listeningAnswered,
}: {
  totalScore: number;
  totalAnswered: number;
  grammarAnswered: number;
  listeningAnswered: number;
}) {
  const completionRatio =
    clamp(
      totalAnswered /
        MAX_QUESTIONS,
      0,
      1
    );

  const expectedPerCategory =
    MAX_QUESTIONS / 2;

  const grammarBalance =
    clamp(
      grammarAnswered /
        expectedPerCategory,
      0,
      1
    );

  const listeningBalance =
    clamp(
      listeningAnswered /
        expectedPerCategory,
      0,
      1
    );

  const categoryBalance =
    (
      grammarBalance +
      listeningBalance
    ) / 2;

  const boundaries = [
    20,
    40,
    60,
    80,
  ];

  const distanceToBoundary =
    Math.min(
      ...boundaries.map(
        (boundary) =>
          Math.abs(
            totalScore -
              boundary
          )
      )
    );

  /*
   * Level 경계에서 10점 이상 떨어지면
   * 경계 안정성은 최대값으로 봅니다.
   */
  const boundaryStability =
    clamp(
      distanceToBoundary /
        10,
      0,
      1
    );

  const rawConfidence =
    completionRatio *
      0.5 +
    categoryBalance *
      0.2 +
    boundaryStability *
      0.3;

  /*
   * 20문항 온라인 테스트라는 특성을 고려하여
   * 100% 확신으로 표시하지 않고 최대 95%로 제한
   */
  return clamp(
    Math.round(
      rawConfidence *
        100
    ),
    0,
    95
  );
}

export async function POST(
  request: Request
) {
  try {
    /*
     * ==========================================
     * 1. 로그인 확인
     * ==========================================
     */
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return jsonError(
        "로그인이 필요합니다.",
        401
      );
    }

    /*
     * ==========================================
     * 2. 역할 확인
     * ==========================================
     */
    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("role")
      .eq(
        "id",
        user.id
      )
      .maybeSingle();

    if (
      profileError ||
      !profile
    ) {
      return jsonError(
        "회원 정보를 확인할 수 없습니다.",
        403
      );
    }

    if (
      profile.role !== "parent" &&
      profile.role !== "student"
    ) {
      return jsonError(
        "레벨테스트 응시 권한이 없습니다.",
        403
      );
    }

    const role =
      profile.role as UserRole;

    /*
     * ==========================================
     * 3. 요청 JSON 확인
     * ==========================================
     */
    let body:
      RequestBody;

    try {
      body =
        (await request.json()) as
          RequestBody;
    } catch {
      return jsonError(
        "잘못된 요청 형식입니다."
      );
    }

    const levelTestId =
      normalizeNumber(
        body.levelTestId
      );

    const attemptId =
      normalizeNumber(
        body.attemptId
      );

    const questionId =
      normalizeNumber(
        body.questionId
      );

    const selectedAnswer =
      normalizeAnswer(
        body.selectedAnswer
      );

    const responseTimeSecondsRaw =
      normalizeNumber(
        body.responseTimeSeconds
      );

    if (
      !levelTestId ||
      !Number.isInteger(
        levelTestId
      ) ||
      levelTestId <= 0
    ) {
      return jsonError(
        "올바른 레벨테스트 ID가 필요합니다."
      );
    }

    if (
      !attemptId ||
      !Number.isInteger(
        attemptId
      ) ||
      attemptId <= 0
    ) {
      return jsonError(
        "올바른 응시 ID가 필요합니다."
      );
    }

    if (
      !questionId ||
      !Number.isInteger(
        questionId
      ) ||
      questionId <= 0
    ) {
      return jsonError(
        "올바른 문항 ID가 필요합니다."
      );
    }

    if (
      ![
        "A",
        "B",
        "C",
        "D",
      ].includes(
        selectedAnswer
      )
    ) {
      return jsonError(
        "답안은 A, B, C, D 중 하나여야 합니다."
      );
    }

    const responseTimeSeconds =
      Math.max(
        0,
        Math.min(
          3600,
          Math.round(
            responseTimeSecondsRaw ??
              0
          )
        )
      );

    /*
     * ==========================================
     * 4. Service Role Client
     *
     * 정답은 브라우저로 보내지 않고
     * 서버에서만 조회합니다.
     * ==========================================
     */
    const admin =
      createAdmin();

    /*
     * ==========================================
     * 5. 레벨테스트 확인
     * ==========================================
     */
    const {
      data: levelTest,
      error:
        levelTestError,
    } = await admin
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
      .eq(
        "id",
        levelTestId
      )
      .maybeSingle();

    if (
      levelTestError
    ) {
      return jsonError(
        `레벨테스트 확인 실패: ${levelTestError.message}`,
        500
      );
    }

    if (!levelTest) {
      return jsonError(
        "레벨테스트를 찾을 수 없습니다.",
        404
      );
    }

    /*
     * ==========================================
     * 6. 사용자 접근권한 검증
     * ==========================================
     */
    if (
      role === "parent"
    ) {
      if (
        levelTest.parent_user_id !==
        user.id
      ) {
        return jsonError(
          "본인이 신청한 레벨테스트만 응시할 수 있습니다.",
          403
        );
      }
    }

    if (
      role === "student"
    ) {
      let studentHasAccess =
        levelTest.student_user_id ===
        user.id;

      if (
        !studentHasAccess &&
        levelTest.child_id
      ) {
        const {
          data: child,
          error:
            childError,
        } = await admin
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
          .maybeSingle();

        if (
          childError
        ) {
          return jsonError(
            `학생 연결정보 확인 실패: ${childError.message}`,
            500
          );
        }

        studentHasAccess =
          child?.student_user_id ===
            user.id ||
          child?.linked_student_user_id ===
            user.id;
      }

      if (
        !studentHasAccess
      ) {
        return jsonError(
          "본인의 레벨테스트만 응시할 수 있습니다.",
          403
        );
      }
    }

    /*
     * ==========================================
     * 7. 응시 기록 확인
     * ==========================================
     */
    const {
      data: attempt,
      error:
        attemptError,
    } = await admin
      .from(
        "level_test_attempts"
      )
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
        attemptId
      )
      .eq(
        "level_test_id",
        levelTestId
      )
      .maybeSingle();

    if (
      attemptError
    ) {
      return jsonError(
        `응시 기록 확인 실패: ${attemptError.message}`,
        500
      );
    }

    if (!attempt) {
      return jsonError(
        "응시 기록을 찾을 수 없습니다.",
        404
      );
    }

    if (
      attempt.status ===
      "completed"
    ) {
      return jsonError(
        "이미 완료된 레벨테스트입니다.",
        409
      );
    }

    if (
      role === "student" &&
      attempt.student_user_id &&
      attempt.student_user_id !==
        user.id
    ) {
      return jsonError(
        "본인의 응시 기록이 아닙니다.",
        403
      );
    }

    /*
     * ==========================================
     * 8. 문제 + 정답 조회
     *
     * correct_answer는 서버에서만 조회
     * ==========================================
     */
    const {
      data: question,
      error:
        questionError,
    } = await admin
      .from(
        "level_test_questions"
      )
      .select(`
        id,
        target_group,
        category,
        difficulty,
        correct_answer,
        is_active
      `)
      .eq(
        "id",
        questionId
      )
      .maybeSingle();

    if (
      questionError
    ) {
      return jsonError(
        `문항 확인 실패: ${questionError.message}`,
        500
      );
    }

    if (!question) {
      return jsonError(
        "문항을 찾을 수 없습니다.",
        404
      );
    }

    if (
      !question.is_active
    ) {
      return jsonError(
        "현재 사용할 수 없는 문항입니다.",
        400
      );
    }

    if (
      question.target_group !==
      attempt.target_group
    ) {
      return jsonError(
        "현재 테스트 유형과 일치하지 않는 문항입니다.",
        400
      );
    }

    if (
      !isQuestionCategory(
        question.category
      )
    ) {
      return jsonError(
        "지원하지 않는 레벨테스트 문항 영역입니다.",
        400
      );
    }

    const questionCategory =
      question.category;

    const correctAnswer =
      normalizeAnswer(
        question.correct_answer
      );

    if (
      ![
        "A",
        "B",
        "C",
        "D",
      ].includes(
        correctAnswer
      )
    ) {
      return jsonError(
        "문항 정답 정보가 올바르게 등록되어 있지 않습니다.",
        500
      );
    }

    const isCorrect =
      selectedAnswer ===
      correctAnswer;

    /*
     * ==========================================
     * 9. 동일 문항 중복 답변 방지
     * ==========================================
     */
    const {
      data:
        existingAnswer,
      error:
        existingAnswerError,
    } = await admin
      .from(
        "level_test_answers"
      )
      .select(`
        id,
        question_id
      `)
      .eq(
        "attempt_id",
        attemptId
      )
      .eq(
        "question_id",
        questionId
      )
      .maybeSingle();

    if (
      existingAnswerError
    ) {
      return jsonError(
        `기존 답안 확인 실패: ${existingAnswerError.message}`,
        500
      );
    }

    if (
      existingAnswer
    ) {
      return jsonError(
        "이미 답변한 문항입니다.",
        409
      );
    }

    /*
     * ==========================================
     * 10. 영역별 적응형 난이도 계산
     * ==========================================
     */
    const currentGrammarDifficulty =
      normalizeDifficulty(
        attempt.current_grammar_difficulty
      );

    const currentListeningDifficulty =
      normalizeDifficulty(
        attempt.current_listening_difficulty
      );

    const currentCategoryDifficulty =
      questionCategory === "grammar"
        ? currentGrammarDifficulty
        : currentListeningDifficulty;

    const nextDifficulty =
      calculateNextDifficulty(
        currentCategoryDifficulty,
        isCorrect
      );

    const nextGrammarDifficulty =
      questionCategory === "grammar"
        ? nextDifficulty
        : currentGrammarDifficulty;

    const nextListeningDifficulty =
      questionCategory === "listening"
        ? nextDifficulty
        : currentListeningDifficulty;

    const now =
      new Date().toISOString();

    /*
     * ==========================================
     * 11. 답안 저장
     *
     * 실제 출제된 문항의 난이도와
     * 정답 여부를 저장합니다.
     * ==========================================
     */
    const {
      error:
        answerInsertError,
    } = await admin
      .from(
        "level_test_answers"
      )
      .insert({
        attempt_id:
          attemptId,

        question_id:
          questionId,

        difficulty:
          question.difficulty,

        selected_answer:
          selectedAnswer,

        is_correct:
          isCorrect,

        response_time_seconds:
          responseTimeSeconds,

        created_at:
          now,
      });

    if (
      answerInsertError
    ) {
      return jsonError(
        `답안 저장 실패: ${answerInsertError.message}`,
        500
      );
    }

    /*
     * ==========================================
     * 12. 현재까지 답변 수 확인
     * ==========================================
     */
    const {
      count:
        answeredCount,
      error:
        countError,
    } = await admin
      .from(
        "level_test_answers"
      )
      .select(
        "id",
        {
          count: "exact",
          head: true,
        }
      )
      .eq(
        "attempt_id",
        attemptId
      );

    if (
      countError
    ) {
      return jsonError(
        `응답 문항 수 확인 실패: ${countError.message}`,
        500
      );
    }

    const totalAnswered =
      answeredCount ?? 0;

    /*
     * 기존 current_difficulty는
     * 과거 코드 호환용으로 계속 기록합니다.
     */
    const legacyCurrentDifficulty =
      nextDifficulty;

    /*
     * ==========================================
     * 13. 20문항 완료
     * ==========================================
     */
    if (
      totalAnswered >=
      MAX_QUESTIONS
    ) {
      /*
       * -------------------------------------------------
       * 13-1. 전체 답안 조회
       * -------------------------------------------------
       *
       * 방금 저장한 20번째 답안까지
       * 포함하여 결과를 계산합니다.
       */
      const {
        data: scoreAnswerData,
        error:
          scoreAnswerError,
      } = await admin
        .from(
          "level_test_answers"
        )
        .select(`
          question_id,
          difficulty,
          is_correct
        `)
        .eq(
          "attempt_id",
          attemptId
        );

      if (
        scoreAnswerError
      ) {
        return jsonError(
          `레벨테스트 결과 계산용 답안 조회 실패: ${scoreAnswerError.message}`,
          500
        );
      }

      const scoreAnswers =
        (
          scoreAnswerData ??
          []
        ) as ScoreAnswerRow[];

      const questionIds =
        Array.from(
          new Set(
            scoreAnswers.map(
              (answer) =>
                answer.question_id
            )
          )
        );

      /*
       * -------------------------------------------------
       * 13-2. 답안에 연결된 문제의 영역 확인
       * -------------------------------------------------
       */
      let scoreQuestions:
        ScoreQuestionRow[] =
        [];

      if (
        questionIds.length >
        0
      ) {
        const {
          data:
            scoreQuestionData,
          error:
            scoreQuestionError,
        } = await admin
          .from(
            "level_test_questions"
          )
          .select(`
            id,
            category
          `)
          .in(
            "id",
            questionIds
          );

        if (
          scoreQuestionError
        ) {
          return jsonError(
            `레벨테스트 문제 영역 확인 실패: ${scoreQuestionError.message}`,
            500
          );
        }

        scoreQuestions =
          (
            scoreQuestionData ??
            []
          ) as ScoreQuestionRow[];
      }

      const categoryMap =
        new Map<
          number,
          string
        >(
          scoreQuestions.map(
            (item) => [
              item.id,
              item.category,
            ]
          )
        );

      const grammarAnswers:
        CategoryAnswer[] =
        [];

      const listeningAnswers:
        CategoryAnswer[] =
        [];

      for (
        const answer of
        scoreAnswers
      ) {
        const category =
          categoryMap.get(
            answer.question_id
          );

        if (
          category ===
          "grammar"
        ) {
          grammarAnswers.push({
            difficulty:
              answer.difficulty,

            isCorrect:
              answer.is_correct,
          });
        }

        if (
          category ===
          "listening"
        ) {
          listeningAnswers.push({
            difficulty:
              answer.difficulty,

            isCorrect:
              answer.is_correct,
          });
        }
      }

      /*
       * -------------------------------------------------
       * 13-3. 영역별 결과
       * -------------------------------------------------
       */
      const grammarResult =
        calculateCategoryResult(
          grammarAnswers
        );

      const listeningResult =
        calculateCategoryResult(
          listeningAnswers
        );

      /*
       * Grammar / Listening은
       * 온라인 테스트에서 동일 비중 50:50
       */
      const totalScore =
        Math.round(
          (
            grammarResult.score +
            listeningResult.score
          ) / 2
        );

      const suggestedLevelNumber =
        scoreToLevel(
          totalScore
        );

      const suggestedLevel =
        getSuggestedLevelLabel(
          suggestedLevelNumber
        );

      const confidence =
        calculateConfidence({
          totalScore,

          totalAnswered:
            scoreAnswers.length,

          grammarAnswered:
            grammarResult.answeredCount,

          listeningAnswered:
            listeningResult.answeredCount,
        });

      /*
       * -------------------------------------------------
       * 13-4. 응시 결과 저장
       * -------------------------------------------------
       */
      const {
        error:
          attemptCompleteError,
      } = await admin
        .from(
          "level_test_attempts"
        )
        .update({
          status:
            "completed",

          current_difficulty:
            legacyCurrentDifficulty,

          current_grammar_difficulty:
            nextGrammarDifficulty,

          current_listening_difficulty:
            nextListeningDifficulty,

          grammar_score:
            grammarResult.score,

          listening_score:
            listeningResult.score,

          total_score:
            totalScore,

          grammar_level:
            grammarResult.level,

          listening_level:
            listeningResult.level,

          suggested_level:
            suggestedLevel,

          confidence,

          completed_at:
            now,

          updated_at:
            now,
        })
        .eq(
          "id",
          attemptId
        );

      if (
        attemptCompleteError
      ) {
        return jsonError(
          `레벨테스트 완료 처리 실패: ${attemptCompleteError.message}`,
          500
        );
      }

      /*
       * -------------------------------------------------
       * 13-5. level_tests에도
       * 학생/학부모 및 관리자 화면에서
       * 바로 사용할 요약 결과 저장
       * -------------------------------------------------
       *
       * final_level은 아직 저장하지 않습니다.
       *
       * 최종 Level은 향후
       * 원어민 화상레벨테스트까지 완료된 후
       * 확정할 값이기 때문입니다.
       */
      const {
        error:
          levelTestCompleteError,
      } = await admin
        .from(
          "level_tests"
        )
        .update({
          ai_status:
            "completed",

          status:
            "admin_review",

          score:
            totalScore,

          ai_suggested_level:
            suggestedLevel,

          ai_confidence:
            confidence,

          updated_at:
            now,
        })
        .eq(
          "id",
          levelTestId
        );

      if (
        levelTestCompleteError
      ) {
        return jsonError(
          `레벨테스트 결과 저장 실패: ${levelTestCompleteError.message}`,
          500
        );
      }

      /*
       * 정답/오답 여부는 학생에게
       * 반환하지 않습니다.
       *
       * 결과 요약값만 반환합니다.
       */
      return NextResponse.json({
        success: true,

        completed: true,

        answeredCount:
          totalAnswered,

        nextDifficulty,

        result: {
          grammarScore:
            grammarResult.score,

          listeningScore:
            listeningResult.score,

          totalScore,

          grammarLevel:
            grammarResult.level,

          listeningLevel:
            listeningResult.level,

          suggestedLevel,

          confidence,
        },

        message:
          "AI 레벨테스트가 완료되었습니다.",
      });
    }

    /*
     * ==========================================
     * 14. 아직 테스트 진행 중
     * ==========================================
     */
    const {
      error:
        attemptUpdateError,
    } = await admin
      .from(
        "level_test_attempts"
      )
      .update({
        current_difficulty:
          legacyCurrentDifficulty,

        current_grammar_difficulty:
          nextGrammarDifficulty,

        current_listening_difficulty:
          nextListeningDifficulty,

        updated_at:
          now,
      })
      .eq(
        "id",
        attemptId
      );

    if (
      attemptUpdateError
    ) {
      return jsonError(
        `난이도 조정 실패: ${attemptUpdateError.message}`,
        500
      );
    }

    /*
     * 기존 상태 구조 유지
     */
    const {
      error:
        levelTestUpdateError,
    } = await admin
      .from(
        "level_tests"
      )
      .update({
        ai_status:
          "in_progress",

        updated_at:
          now,
      })
      .eq(
        "id",
        levelTestId
      );

    if (
      levelTestUpdateError
    ) {
      return jsonError(
        `레벨테스트 진행 상태 저장 실패: ${levelTestUpdateError.message}`,
        500
      );
    }

    /*
     * 정답 여부는 학생 화면에
     * 반환하지 않습니다.
     */
    return NextResponse.json({
      success: true,

      completed: false,

      answeredCount:
        totalAnswered,

      nextDifficulty,

      message:
        "답변이 저장되었습니다.",
    });
  } catch (error) {
    console.error(
      "LEVEL TEST ANSWER API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "답변 처리 중 알 수 없는 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}