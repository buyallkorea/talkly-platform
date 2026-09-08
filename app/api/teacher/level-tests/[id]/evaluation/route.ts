import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type RequestBody = {
  action?: "start" | "complete";

  speakingLevel?: number;
  listeningLevel?: number;
  pronunciationLevel?: number;
  comprehensionLevel?: number;

  suggestedLevel?: string;

  strengths?: string;
  weaknesses?: string;
  teacherComment?: string;
};

type InterviewRow = {
  id: number;
  level_test_id: number;
  tester_user_id: string | null;
  status: string;

  /*
   * 테스트 예정시간
   * 시작 10분 전 입장 제한에 사용
   */
  scheduled_at: string | null;

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

function validScore(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 10
  );
}

function cleanOptionalText(
  value: unknown
) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } =
      await context.params;

    const interviewId =
      Number(id);

    if (
      !Number.isInteger(
        interviewId
      ) ||
      interviewId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid level test interview ID.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * 1. 로그인 / 강사 권한
     * =====================================================
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
      return NextResponse.json(
        {
          error:
            "Please sign in first.",
        },
        {
          status: 401,
        }
      );
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
      profile.role !== "teacher"
    ) {
      return NextResponse.json(
        {
          error:
            "Teacher access is required.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =====================================================
     * 2. 담당 인터뷰 검증
     * =====================================================
     */

    const admin =
      createAdminClient();

    const {
      data: interviewData,
      error: interviewError,
    } = await admin
      .from(
        "level_test_interviews"
      )
      .select(`
        id,
        level_test_id,
        tester_user_id,
        status,
        scheduled_at,
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
      return NextResponse.json(
        {
          error:
            "Unable to load the level test.",
          detail:
            interviewError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!interviewData) {
      return NextResponse.json(
        {
          error:
            "Level test interview not found.",
        },
        {
          status: 404,
        }
      );
    }

    const interview =
      interviewData as InterviewRow;

    if (
      interview.tester_user_id !==
      user.id
    ) {
      return NextResponse.json(
        {
          error:
            "This level test is not assigned to you.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =====================================================
     * 3. 현재 유효한 interview ID인지 검증
     *
     * 같은 level_test_id에 과거 row가 있어도
     * 가장 최근의 비취소 인터뷰만 작업 가능.
     * =====================================================
     */

    const {
      data: currentInterview,
      error:
        currentInterviewError,
    } = await admin
      .from(
        "level_test_interviews"
      )
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

    if (
      currentInterviewError
    ) {
      return NextResponse.json(
        {
          error:
            "Unable to verify the current level test interview.",
          detail:
            currentInterviewError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      !currentInterview ||
      currentInterview.id !==
        interview.id
    ) {
      return NextResponse.json(
        {
          error:
            "This is an archived level test interview and can no longer be modified.",
        },
        {
          status: 409,
        }
      );
    }

    const body =
      (await request.json()) as RequestBody;

    const now =
      new Date().toISOString();

    /*
     * =====================================================
     * ACTION: START
     * =====================================================
     */

    if (
      body.action === "start"
    ) {
      if (
        interview.status ===
        "completed"
      ) {
        return NextResponse.json(
          {
            error:
              "This level test has already been completed.",
          },
          {
            status: 409,
          }
        );
      }

      if (
        interview.status ===
          "cancelled" ||
        interview.status ===
          "canceled"
      ) {
        return NextResponse.json(
          {
            error:
              "This level test has been cancelled.",
          },
          {
            status: 409,
          }
        );
      }

      /*
       * 이미 테스트가 시작된 경우에는
       * 예정 종료시간이 지나더라도 재입장 허용.
       *
       * 따라서 시간 검증보다 먼저 처리합니다.
       */
      if (
        interview.status ===
        "in_progress"
      ) {
        if (
          !interview.meeting_url
        ) {
          return NextResponse.json(
            {
              error:
                "The meeting link has not been registered.",
            },
            {
              status: 409,
            }
          );
        }

        return NextResponse.json({
          ok: true,
          status:
            "in_progress",
          meetingUrl:
            interview.meeting_url,
        });
      }

      /*
       * 아직 시작 전이라면
       * scheduled 상태만 시작 가능
       */
      if (
        interview.status !==
        "scheduled"
      ) {
        return NextResponse.json(
          {
            error:
              "This level test is not ready to start.",
          },
          {
            status: 409,
          }
        );
      }

      /*
       * =====================================================
       * 4. 예정시간 검증
       * =====================================================
       */

      if (
        !interview.scheduled_at
      ) {
        return NextResponse.json(
          {
            error:
              "The level test schedule has not been registered.",
          },
          {
            status: 409,
          }
        );
      }

      const scheduledTime =
        new Date(
          interview.scheduled_at
        ).getTime();

      if (
        Number.isNaN(
          scheduledTime
        )
      ) {
        return NextResponse.json(
          {
            error:
              "The scheduled level test time is invalid.",
          },
          {
            status: 500,
          }
        );
      }

      /*
       * 테스트 시작 10분 전부터 입장 가능.
       *
       * 예:
       * 12:00 테스트
       * → 11:50부터 입장 가능
       */
      const entryOpenTime =
        scheduledTime -
        10 * 60 * 1000;

      const currentTime =
        Date.now();

      if (
        currentTime <
        entryOpenTime
      ) {
        const remainingMinutes =
          Math.max(
            1,
            Math.ceil(
              (
                entryOpenTime -
                currentTime
              ) /
                60000
            )
          );

        return NextResponse.json(
          {
            error:
              `You can enter this level test 10 minutes before the scheduled start time. Entry opens in approximately ${remainingMinutes} minute${
                remainingMinutes === 1
                  ? ""
                  : "s"
              }.`,

            code:
              "LEVEL_TEST_ENTRY_TOO_EARLY",

            scheduledAt:
              interview.scheduled_at,

            entryOpenAt:
              new Date(
                entryOpenTime
              ).toISOString(),
          },
          {
            status: 409,
          }
        );
      }

      /*
       * =====================================================
       * 5. Meeting URL 확인
       * =====================================================
       */

      if (
        !interview.meeting_url
      ) {
        return NextResponse.json(
          {
            error:
              "The meeting link has not been registered yet.",
          },
          {
            status: 409,
          }
        );
      }

      /*
       * =====================================================
       * 6. 인터뷰 시작
       * =====================================================
       */

      const {
        data: startedInterview,
        error: startError,
      } = await admin
        .from(
          "level_test_interviews"
        )
        .update({
          status:
            "in_progress",

          started_at:
            interview.started_at ??
            now,

          updated_at: now,
        })
        .eq(
          "id",
          interview.id
        )
        .eq(
          "tester_user_id",
          user.id
        )
        .eq(
          "status",
          "scheduled"
        )
        .select("id")
        .maybeSingle();

      if (
        startError ||
        !startedInterview
      ) {
        return NextResponse.json(
          {
            error:
              "Unable to start the level test.",
            detail:
              startError?.message,
          },
          {
            status: 409,
          }
        );
      }

      /*
       * 전체 level_test 상태는
       * interview_scheduled를 유지하고
       * interview_status만 진행 중으로 변경.
       *
       * 최종 상태는 평가 제출 때
       * interview_completed로 변경.
       */

      const {
        error:
          levelTestStartError,
      } = await admin
        .from("level_tests")
        .update({
          interview_status:
            "in_progress",

          updated_at:
            now,
        })
        .eq(
          "id",
          interview.level_test_id
        );

      if (
        levelTestStartError
      ) {
        /*
         * 가능한 범위에서 원상복구
         */

        await admin
          .from(
            "level_test_interviews"
          )
          .update({
            status:
              interview.status,

            started_at:
              interview.started_at,

            updated_at:
              now,
          })
          .eq(
            "id",
            interview.id
          );

        return NextResponse.json(
          {
            error:
              "Unable to update the level test status.",
            detail:
              levelTestStartError.message,
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        ok: true,
        status:
          "in_progress",
        meetingUrl:
          interview.meeting_url,
      });
    }

    /*
     * =====================================================
     * ACTION: COMPLETE
     * =====================================================
     */

    if (
      body.action === "complete"
    ) {
      if (
        interview.status ===
        "completed"
      ) {
        return NextResponse.json(
          {
            error:
              "This evaluation has already been submitted.",
          },
          {
            status: 409,
          }
        );
      }

      if (
        interview.status !==
        "in_progress"
      ) {
        return NextResponse.json(
          {
            error:
              "The level test must be started before the evaluation can be submitted.",
          },
          {
            status: 409,
          }
        );
      }

      /*
       * =====================================================
       * 평가 점수 검증
       * =====================================================
       */

      if (
        !validScore(
          body.speakingLevel
        ) ||
        !validScore(
          body.listeningLevel
        ) ||
        !validScore(
          body.pronunciationLevel
        ) ||
        !validScore(
          body.comprehensionLevel
        )
      ) {
        return NextResponse.json(
          {
            error:
              "All four evaluation scores must be integers from 1 to 10.",
          },
          {
            status: 400,
          }
        );
      }

      const suggestedLevel =
        typeof body.suggestedLevel ===
        "string"
          ? body.suggestedLevel.trim()
          : "";

      if (!suggestedLevel) {
        return NextResponse.json(
          {
            error:
              "Please enter your suggested level.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        suggestedLevel.length > 100
      ) {
        return NextResponse.json(
          {
            error:
              "The suggested level is too long.",
          },
          {
            status: 400,
          }
        );
      }

      const strengths =
        cleanOptionalText(
          body.strengths
        );

      const weaknesses =
        cleanOptionalText(
          body.weaknesses
        );

      const teacherComment =
        cleanOptionalText(
          body.teacherComment
        );

      /*
       * =====================================================
       * 인터뷰 평가 저장
       * =====================================================
       */

      const {
        data:
          completedInterview,
        error:
          interviewUpdateError,
      } = await admin
        .from(
          "level_test_interviews"
        )
        .update({
          status:
            "completed",

          speaking_level:
            body.speakingLevel,

          listening_level:
            body.listeningLevel,

          pronunciation_level:
            body.pronunciationLevel,

          comprehension_level:
            body.comprehensionLevel,

          suggested_level:
            suggestedLevel,

          strengths,

          weaknesses,

          teacher_comment:
            teacherComment,

          completed_at:
            now,

          updated_at:
            now,
        })
        .eq(
          "id",
          interview.id
        )
        .eq(
          "tester_user_id",
          user.id
        )
        .eq(
          "status",
          "in_progress"
        )
        .select("id")
        .maybeSingle();

      if (
        interviewUpdateError ||
        !completedInterview
      ) {
        return NextResponse.json(
          {
            error:
              "Unable to save the level test evaluation.",
            detail:
              interviewUpdateError?.message,
          },
          {
            status: 409,
          }
        );
      }

      /*
       * =====================================================
       * level_tests 상태 반영
       *
       * 강사는 여기까지만 결정합니다.
       *
       * teacher_suggested_level 저장
       * interview_completed 전환
       *
       * final_level / final_course_id는
       * 절대 수정하지 않습니다.
       * =====================================================
       */

      const {
        error:
          levelTestUpdateError,
      } = await admin
        .from("level_tests")
        .update({
          interview_status:
            "completed",

          teacher_suggested_level:
            suggestedLevel,

          status:
            "interview_completed",

          updated_at:
            now,
        })
        .eq(
          "id",
          interview.level_test_id
        );

      if (
        levelTestUpdateError
      ) {
        /*
         * level_tests 저장 실패 시
         * 인터뷰를 가능한 범위에서
         * 이전 상태로 복원
         */

        await admin
          .from(
            "level_test_interviews"
          )
          .update({
            status:
              interview.status,

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

            completed_at:
              interview.completed_at,

            updated_at:
              now,
          })
          .eq(
            "id",
            interview.id
          );

        return NextResponse.json(
          {
            error:
              "The interview evaluation was not finalized because the level test status could not be updated.",
            detail:
              levelTestUpdateError.message,
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        ok: true,
        status:
          "completed",
        levelTestStatus:
          "interview_completed",
      });
    }

    return NextResponse.json(
      {
        error:
          "Invalid action.",
      },
      {
        status: 400,
      }
    );
  } catch (error) {
    console.error(
      "TEACHER LEVEL TEST EVALUATION API ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      },
      {
        status: 500,
      }
    );
  }
}