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

function calculateNextDifficulty(
  currentDifficulty: number,
  isCorrect: boolean
) {
  /*
   * TALKLY 적응형 테스트
   *
   * 정답:
   * 난이도 +1
   *
   * 오답:
   * 난이도 -1
   *
   * 현재 문제은행의 난이도 범위:
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
        (await request.json()) as RequestBody;
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
     * 정답은 절대 브라우저에 보내지 않습니다.
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

      /*
       * 과거 데이터 중
       * level_tests.student_user_id가
       * 비어 있을 가능성도 있으므로
       * child 연결정보를 fallback으로 확인합니다.
       */
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

    /*
     * 학생 로그인이라면
     * attempt.student_user_id도 확인합니다.
     *
     * 단, 과거 attempt 중 null인 경우에는
     * levelTest 소유권 확인 결과를 사용합니다.
     */
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

    /*
     * 다른 연령/대상 문제를
     * 임의로 제출하지 못하도록 검증
     */
    if (
      question.target_group !==
      attempt.target_group
    ) {
      return jsonError(
        "현재 테스트 유형과 일치하지 않는 문항입니다.",
        400
      );
    }

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
     * 10. 적응형 난이도 계산
     * ==========================================
     */
    const currentDifficulty =
      Number(
        attempt.current_difficulty
      ) || 1;

    const nextDifficulty =
      calculateNextDifficulty(
        currentDifficulty,
        isCorrect
      );

    const now =
      new Date().toISOString();

    /*
     * ==========================================
     * 11. 답안 저장
     *
     * 정답 자체(correct_answer)는
     * answers 테이블에 저장하지 않습니다.
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
     * ==========================================
     * 13. 20문항 완료
     * ==========================================
     */
    if (
      totalAnswered >=
      MAX_QUESTIONS
    ) {
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
            nextDifficulty,

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
       * AI 시험은 끝났고,
       * 다음 단계는 관리자 검토입니다.
       *
       * 기존 상세 페이지에서도
       * admin_review 상태를 정상 상태로
       * 사용하고 있습니다.
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
          `레벨테스트 상태 완료 처리 실패: ${levelTestCompleteError.message}`,
          500
        );
      }

      return NextResponse.json({
        success: true,

        completed: true,

        answeredCount:
          totalAnswered,

        nextDifficulty,

        /*
         * 학생에게 정답/오답 여부를
         * 반환하지 않습니다.
         */
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
      return jsonError(
        `난이도 조정 실패: ${attemptUpdateError.message}`,
        500
      );
    }

    /*
     * level_tests.ai_status도
     * 진행 중으로 유지합니다.
     *
     * status는 CHECK constraint 문제 때문에
     * 중간 진행 단계에서는 변경하지 않습니다.
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
     * 정답 여부는 학생 화면에 반환하지 않습니다.
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