import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const MAX_QUESTIONS = 20;

type AnswerRow = {
  question_id: number;
  is_correct: boolean;
  difficulty: number;
};

type QuestionCategoryRow = {
  id: number;
  category: string;
};

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const levelTestId =
      Number(body.levelTestId);

    const attemptId =
      Number(body.attemptId);

    const questionId =
      Number(body.questionId);

    const selectedAnswer =
      String(
        body.selectedAnswer || ""
      )
        .trim()
        .toUpperCase();

    const responseTimeSeconds =
      Number(
        body.responseTimeSeconds
      );

    /*
     * 기본 요청값 검사
     */
    if (
      !Number.isInteger(
        levelTestId
      ) ||
      levelTestId <= 0 ||
      !Number.isInteger(
        attemptId
      ) ||
      attemptId <= 0 ||
      !Number.isInteger(
        questionId
      ) ||
      questionId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "잘못된 레벨테스트 요청입니다.",
        },
        {
          status: 400,
        }
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
      return NextResponse.json(
        {
          error:
            "선택한 답변을 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        responseTimeSeconds
      ) ||
      responseTimeSeconds < 0
    ) {
      return NextResponse.json(
        {
          error:
            "응답 시간을 확인할 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      await createClient();

    /*
     * 로그인 확인
     */
    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "로그인이 필요합니다.",
        },
        {
          status: 401,
        }
      );
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
      return NextResponse.json(
        {
          error:
            "레벨테스트 응시 권한이 없습니다.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * 로그인한 학부모의
     * 레벨테스트인지 확인
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
        status,
        ai_status
      `)
      .eq(
        "id",
        levelTestId
      )
      .maybeSingle();

    if (
      levelTestError ||
      !levelTest
    ) {
      return NextResponse.json(
        {
          error:
            "레벨테스트 정보를 확인할 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      levelTest.parent_user_id !==
      user.id
    ) {
      return NextResponse.json(
        {
          error:
            "본인의 레벨테스트만 응시할 수 있습니다.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      levelTest.ai_status ===
        "completed" ||
      levelTest.status ===
        "completed"
    ) {
      return NextResponse.json(
        {
          error:
            "이미 완료된 레벨테스트입니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 응시 기록 확인
     */
    const {
      data: attempt,
      error: attemptError,
    } = await supabase
      .from(
        "level_test_attempts"
      )
      .select(`
        id,
        level_test_id,
        target_group,
        status,
        current_difficulty
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
      attemptError ||
      !attempt
    ) {
      return NextResponse.json(
        {
          error:
            "응시 기록을 확인할 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      attempt.status !==
      "in_progress"
    ) {
      return NextResponse.json(
        {
          error:
            "현재 진행할 수 있는 응시 기록이 아닙니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 여기서만 정답을 가져옵니다.
     *
     * correct_answer는
     * 브라우저로 전달하지 않습니다.
     */
    const {
      data: question,
      error: questionError,
    } = await supabase
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
      .eq(
        "is_active",
        true
      )
      .maybeSingle();

    if (
      questionError ||
      !question
    ) {
      return NextResponse.json(
        {
          error:
            "문항 정보를 확인할 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * 다른 시험군의 문제를
     * 임의로 제출하지 못하도록 확인
     */
    if (
      question.target_group !==
      attempt.target_group
    ) {
      return NextResponse.json(
        {
          error:
            "현재 테스트에 해당하지 않는 문항입니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 같은 문제 중복 제출 방지
     */
    const {
      data: existingAnswer,
      error:
        existingAnswerError,
    } = await supabase
      .from(
        "level_test_answers"
      )
      .select("id")
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
      return NextResponse.json(
        {
          error:
            "기존 답변 확인 중 오류가 발생했습니다.",
        },
        {
          status: 500,
        }
      );
    }

    if (existingAnswer) {
      return NextResponse.json(
        {
          error:
            "이미 제출한 문항입니다.",
        },
        {
          status: 409,
        }
      );
    }

    const correctAnswer =
      String(
        question.correct_answer
      )
        .trim()
        .toUpperCase();

    const isCorrect =
      selectedAnswer ===
      correctAnswer;

    const now =
      new Date().toISOString();

    /*
     * 답변 저장
     */
    const {
      error: answerError,
    } = await supabase
      .from(
        "level_test_answers"
      )
      .insert({
        attempt_id:
          attemptId,

        question_id:
          questionId,

        selected_answer:
          selectedAnswer,

        is_correct:
          isCorrect,

        difficulty:
          question.difficulty,

        response_time_seconds:
          Math.max(
            0,
            Math.round(
              responseTimeSeconds
            )
          ),

        answered_at:
          now,

        created_at:
          now,
      });

    if (answerError) {
      return NextResponse.json(
        {
          error:
            `답변 저장 실패: ${answerError.message}`,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 저장 후 현재 총 답변 수 확인
     */
    const {
      count: answeredCount,
      error:
        answeredCountError,
    } = await supabase
      .from(
        "level_test_answers"
      )
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "attempt_id",
        attemptId
      );

    if (
      answeredCountError
    ) {
      return NextResponse.json(
        {
          error:
            "테스트 진행률을 계산하지 못했습니다.",
        },
        {
          status: 500,
        }
      );
    }

    const totalAnswered =
      answeredCount ?? 0;

    /*
     * 20문항 완료 시
     * 최종 내부 점수를 계산합니다.
     */
    if (
      totalAnswered >=
      MAX_QUESTIONS
    ) {
      const result =
        await completeAttempt({
          supabase,
          levelTestId,
          attemptId,
          now,
        });

      if (!result.ok) {
        return NextResponse.json(
          {
            error:
              result.error,
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        success: true,
        completed: true,
        answeredCount:
          totalAnswered,
      });
    }

    /*
     * 간단한 적응형 난이도
     *
     * 현재 1~5만 사용합니다.
     * 문항 DB는 1~10까지 확장 가능하게
     * 만들어 두었습니다.
     */
    let nextDifficulty =
      attempt.current_difficulty;

    if (isCorrect) {
      nextDifficulty =
        Math.min(
          5,
          attempt.current_difficulty +
            1
        );
    } else {
      nextDifficulty =
        Math.max(
          1,
          attempt.current_difficulty -
            1
        );
    }

    const {
      error:
        attemptUpdateError,
    } = await supabase
      .from(
        "level_test_attempts"
      )
      .update({
        current_difficulty:
          nextDifficulty,

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
      return NextResponse.json(
        {
          error:
            `난이도 변경 실패: ${attemptUpdateError.message}`,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 학생 화면에는
     * 정답 여부를 돌려주지 않습니다.
     *
     * 레벨테스트이므로
     * 문제마다 정답/오답을 알려주지 않고
     * 다음 문제로 이동합니다.
     */
    return NextResponse.json({
      success: true,
      completed: false,
      answeredCount:
        totalAnswered,
      nextDifficulty,
    });
  } catch (error) {
    console.error(
      "LEVEL TEST ANSWER API ERROR:",
      error
    );

    return NextResponse.json(
      {
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

async function completeAttempt({
  supabase,
  levelTestId,
  attemptId,
  now,
}: {
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >;
  levelTestId: number;
  attemptId: number;
  now: string;
}) {
  /*
   * 전체 답변 조회
   */
  const {
    data: answersData,
    error: answersError,
  } = await supabase
    .from(
      "level_test_answers"
    )
    .select(`
      question_id,
      is_correct,
      difficulty
    `)
    .eq(
      "attempt_id",
      attemptId
    );

  if (answersError) {
    return {
      ok: false as const,
      error:
        `최종 답변 집계 실패: ${answersError.message}`,
    };
  }

  const answers =
    (answersData ??
      []) as AnswerRow[];

  const questionIds =
    answers.map(
      (answer) =>
        answer.question_id
    );

  let categoryMap =
    new Map<
      number,
      string
    >();

  if (
    questionIds.length > 0
  ) {
    const {
      data: questionsData,
      error: questionsError,
    } = await supabase
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
      questionsError
    ) {
      return {
        ok: false as const,
        error:
          `문항 유형 집계 실패: ${questionsError.message}`,
      };
    }

    categoryMap =
      new Map(
        (
          (questionsData ??
            []) as QuestionCategoryRow[]
        ).map(
          (question) => [
            question.id,
            question.category,
          ]
        )
      );
  }

  const grammarAnswers =
    answers.filter(
      (answer) =>
        categoryMap.get(
          answer.question_id
        ) === "grammar"
    );

  const listeningAnswers =
    answers.filter(
      (answer) =>
        categoryMap.get(
          answer.question_id
        ) === "listening"
    );

  const grammarScore =
    calculatePercentage(
      grammarAnswers
    );

  const listeningScore =
    calculatePercentage(
      listeningAnswers
    );

  const totalScore =
    calculatePercentage(
      answers
    );

  const grammarLevel =
    scoreToLevel(
      grammarScore
    );

  const listeningLevel =
    scoreToLevel(
      listeningScore
    );

  const averageLevel =
    Math.round(
      (grammarLevel +
        listeningLevel) /
        2
    );

  const finalNumericLevel =
    Math.max(
      1,
      Math.min(
        5,
        averageLevel
      )
    );

  const suggestedLevel =
    `TALKLY Level ${finalNumericLevel}`;

  /*
   * Grammar / Listening의
   * 편차가 크면 신뢰도를 낮춥니다.
   */
  const levelDifference =
    Math.abs(
      grammarLevel -
        listeningLevel
    );

  const confidence =
    Math.max(
      60,
      95 -
        levelDifference *
          10
    );

  const {
    error:
      attemptCompleteError,
  } = await supabase
    .from(
      "level_test_attempts"
    )
    .update({
      status:
        "completed",

      grammar_score:
        grammarScore,

      listening_score:
        listeningScore,

      total_score:
        totalScore,

      grammar_level:
        grammarLevel,

      listening_level:
        listeningLevel,

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
    return {
      ok: false as const,
      error:
        `응시 결과 저장 실패: ${attemptCompleteError.message}`,
    };
  }

  /*
   * 학생/학부모에게는
   * 아래 결과를 직접 표시하지 않고
   * 관리자 화면에서만 확인합니다.
   */
  const aiReviewNote =
    buildAiReviewNote({
      grammarScore,
      listeningScore,
      grammarLevel,
      listeningLevel,
      confidence,
    });

  const {
    error:
      levelTestCompleteError,
  } = await supabase
    .from("level_tests")
    .update({
      ai_status:
        "completed",

      ai_suggested_level:
        suggestedLevel,

      ai_confidence:
        confidence,

      ai_review_note:
        aiReviewNote,

      status:
        "admin_review",

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
    return {
      ok: false as const,
      error:
        `AI 레벨테스트 완료 처리 실패: ${levelTestCompleteError.message}`,
    };
  }

  return {
    ok: true as const,
  };
}

function calculatePercentage(
  answers: {
    is_correct: boolean;
  }[]
) {
  if (
    answers.length === 0
  ) {
    return 0;
  }

  const correctCount =
    answers.filter(
      (answer) =>
        answer.is_correct
    ).length;

  return Math.round(
    (correctCount /
      answers.length) *
      100
  );
}

function scoreToLevel(
  score: number
) {
  if (score >= 85) {
    return 5;
  }

  if (score >= 70) {
    return 4;
  }

  if (score >= 55) {
    return 3;
  }

  if (score >= 40) {
    return 2;
  }

  return 1;
}

function buildAiReviewNote({
  grammarScore,
  listeningScore,
  grammarLevel,
  listeningLevel,
  confidence,
}: {
  grammarScore: number;
  listeningScore: number;
  grammarLevel: number;
  listeningLevel: number;
  confidence: number;
}) {
  const difference =
    Math.abs(
      grammarLevel -
        listeningLevel
    );

  const lines = [
    `Grammar: ${grammarScore}점 / Level ${grammarLevel}`,
    `Listening: ${listeningScore}점 / Level ${listeningLevel}`,
    `AI 진단 신뢰도: ${confidence}%`,
  ];

  if (difference >= 2) {
    lines.push(
      "Grammar와 Listening 영역 간 편차가 큽니다."
    );

    lines.push(
      "원어민 추가 화상 테스트 검토를 권장합니다."
    );
  } else {
    lines.push(
      "Grammar와 Listening 결과의 편차가 크지 않습니다."
    );
  }

  return lines.join("\n");
}