import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type RequestBody = {
  action?: "set_interview_requirement" | "save_review";
  interviewRequired?: boolean;
  finalLevel?: string | null;
  finalCourseId?: number | null;
  adminNote?: string | null;
};

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      user: null,
      response: NextResponse.json(
        {
          error: "로그인이 필요합니다.",
        },
        {
          status: 401,
        }
      ),
    };
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
    return {
      supabase,
      user: null,
      response: NextResponse.json(
        {
          error: "관리자 권한이 필요합니다.",
        },
        {
          status: 403,
        }
      ),
    };
  }

  return {
    supabase,
    user,
    response: null,
  };
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const levelTestId = Number(id);

    if (
      !Number.isInteger(levelTestId) ||
      levelTestId <= 0
    ) {
      return NextResponse.json(
        {
          error: "올바르지 않은 레벨테스트 ID입니다.",
        },
        {
          status: 400,
        }
      );
    }

    const auth = await requireAdmin();

    if (auth.response) {
      return auth.response;
    }

    const supabase = auth.supabase;

    const body =
      (await request.json()) as RequestBody;

    const action = body.action;

    if (
      action !== "set_interview_requirement" &&
      action !== "save_review"
    ) {
      return NextResponse.json(
        {
          error: "올바르지 않은 요청입니다.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: levelTest,
      error: levelTestError,
    } = await supabase
      .from("level_tests")
      .select(`
        id,
        status,
        interview_required,
        interview_status,
        final_level,
        final_course_id,
        finalized_at
      `)
      .eq("id", levelTestId)
      .maybeSingle();

    if (levelTestError) {
      return NextResponse.json(
        {
          error:
            "레벨테스트 정보를 확인하지 못했습니다.",
          detail: levelTestError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!levelTest) {
      return NextResponse.json(
        {
          error: "레벨테스트를 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    const now = new Date().toISOString();

    /*
     * ------------------------------------------------------
     * 1. 원어민 추가 테스트 필요 여부 변경
     * ------------------------------------------------------
     */
    if (
      action === "set_interview_requirement"
    ) {
      if (
        typeof body.interviewRequired !==
        "boolean"
      ) {
        return NextResponse.json(
          {
            error:
              "원어민 추가 테스트 여부가 필요합니다.",
          },
          {
            status: 400,
          }
        );
      }

      const required =
        body.interviewRequired;

      /*
       * 이미 최종 확정된 결과의 판단방식을 바꾸는 경우
       * 기존 최종확정은 취소합니다.
       *
       * final_course_id도 반드시 함께 비웁니다.
       */
      const {
        error: updateError,
      } = await supabase
        .from("level_tests")
        .update({
          interview_required: required,

          interview_status: required
            ? "scheduling"
            : null,

          status: required
            ? "interview_required"
            : "admin_review",

          final_level: null,
          final_course_id: null,
          finalized_at: null,

          updated_at: now,
        })
        .eq("id", levelTestId);

      if (updateError) {
        return NextResponse.json(
          {
            error:
              "관리자 판단을 변경하지 못했습니다.",
            detail: updateError.message,
          },
          {
            status: 500,
          }
        );
      }

      if (required) {
        /*
         * scheduling / scheduled / in_progress 상태의
         * 기존 인터뷰가 있으면 중복 생성하지 않습니다.
         */
        const {
          data: existingInterview,
          error: interviewCheckError,
        } = await supabase
          .from("level_test_interviews")
          .select("id")
          .eq(
            "level_test_id",
            levelTestId
          )
          .in("status", [
            "scheduling",
            "scheduled",
            "in_progress",
          ])
          .limit(1)
          .maybeSingle();

        if (interviewCheckError) {
          return NextResponse.json(
            {
              error:
                "원어민 테스트 정보를 확인하지 못했습니다.",
              detail:
                interviewCheckError.message,
            },
            {
              status: 500,
            }
          );
        }

        if (!existingInterview) {
          const {
            error: insertError,
          } = await supabase
            .from(
              "level_test_interviews"
            )
            .insert({
              level_test_id:
                levelTestId,
              status: "scheduling",
              duration_minutes: 20,
            });

          if (insertError) {
            /*
             * level_tests만 먼저 변경된 상태가
             * 남지 않도록 가능한 범위에서 원상복구합니다.
             */
            await supabase
              .from("level_tests")
              .update({
                interview_required:
                  levelTest.interview_required,

                interview_status:
                  levelTest.interview_status,

                status:
                  levelTest.status,

                final_level:
                  levelTest.final_level,

                final_course_id:
                  levelTest.final_course_id,

                finalized_at:
                  levelTest.finalized_at,

                updated_at: now,
              })
              .eq("id", levelTestId);

            return NextResponse.json(
              {
                error:
                  "원어민 테스트를 생성하지 못했습니다.",
                detail:
                  insertError.message,
              },
              {
                status: 500,
              }
            );
          }
        }
      } else {
        /*
         * 아직 진행되지 않은 인터뷰만 취소합니다.
         * completed 기록은 평가 이력으로 보존합니다.
         * in_progress 역시 임의 취소하지 않습니다.
         */
        const {
          error: cancelError,
        } = await supabase
          .from(
            "level_test_interviews"
          )
          .update({
            status: "cancelled",
            updated_at: now,
          })
          .eq(
            "level_test_id",
            levelTestId
          )
          .in("status", [
            "scheduling",
            "scheduled",
          ]);

        if (cancelError) {
          return NextResponse.json(
            {
              error:
                "기존 원어민 테스트를 취소하지 못했습니다.",
              detail:
                cancelError.message,
            },
            {
              status: 500,
            }
          );
        }
      }

      return NextResponse.json({
        ok: true,
        interviewRequired: required,
      });
    }

    /*
     * ------------------------------------------------------
     * 2. 관리자 검토 / 최종확정
     * ------------------------------------------------------
     */

    const interviewRequired =
      body.interviewRequired === true;

    const finalLevel =
      typeof body.finalLevel === "string"
        ? body.finalLevel.trim()
        : "";

    const adminNote =
      typeof body.adminNote === "string"
        ? body.adminNote.trim()
        : "";

    const finalCourseId =
      body.finalCourseId === null ||
      body.finalCourseId === undefined
        ? null
        : Number(body.finalCourseId);

    /*
     * 원어민 추가 테스트가 필요한 상태라면
     * 실제 인터뷰 완료 전에는 최종확정할 수 없습니다.
     */
    let interviewCompleted = false;

    if (interviewRequired) {
      const {
        data: completedInterview,
        error: completedInterviewError,
      } = await supabase
        .from(
          "level_test_interviews"
        )
        .select("id")
        .eq(
          "level_test_id",
          levelTestId
        )
        .eq("status", "completed")
        .order("completed_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (completedInterviewError) {
        return NextResponse.json(
          {
            error:
              "원어민 테스트 완료 여부를 확인하지 못했습니다.",
            detail:
              completedInterviewError.message,
          },
          {
            status: 500,
          }
        );
      }

      interviewCompleted =
        !!completedInterview;
    }

    const wantsFinalization =
      finalLevel.length > 0 ||
      finalCourseId !== null;

    if (
      interviewRequired &&
      !interviewCompleted &&
      wantsFinalization
    ) {
      return NextResponse.json(
        {
          error:
            "원어민 화상 레벨테스트가 완료된 후 최종 레벨과 추천 프로그램을 확정할 수 있습니다.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * 최종확정은 레벨과 추천과정이 반드시 한 쌍입니다.
     * 둘 중 하나만 저장되는 상태를 허용하지 않습니다.
     */
    if (
      (finalLevel && finalCourseId === null) ||
      (!finalLevel && finalCourseId !== null)
    ) {
      return NextResponse.json(
        {
          error:
            "최종 레벨과 추천 프로그램을 모두 입력해야 최종확정할 수 있습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const shouldFinalize =
      finalLevel.length > 0 &&
      finalCourseId !== null;

    /*
     * 선택한 추천과정은 실제 활성 course인지
     * 서버에서 다시 검증합니다.
     */
    if (shouldFinalize) {
      if (
        !Number.isInteger(finalCourseId) ||
        finalCourseId <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "추천 프로그램 정보가 올바르지 않습니다.",
          },
          {
            status: 400,
          }
        );
      }

      const {
        data: course,
        error: courseError,
      } = await supabase
        .from("courses")
        .select("id, is_active")
        .eq("id", finalCourseId)
        .maybeSingle();

      if (courseError) {
        return NextResponse.json(
          {
            error:
              "추천 프로그램을 확인하지 못했습니다.",
            detail: courseError.message,
          },
          {
            status: 500,
          }
        );
      }

      if (
        !course ||
        !course.is_active
      ) {
        return NextResponse.json(
          {
            error:
              "현재 신청 가능한 추천 프로그램이 아닙니다.",
          },
          {
            status: 400,
          }
        );
      }
    }

    let nextStatus = "admin_review";
    let nextInterviewStatus:
      | string
      | null =
      interviewRequired
        ? levelTest.interview_status
        : null;

    if (shouldFinalize) {
      nextStatus = "completed";

      if (interviewRequired) {
        nextInterviewStatus =
          "completed";
      }
    } else if (interviewRequired) {
      nextStatus = interviewCompleted
        ? "interview_completed"
        : "interview_required";
    }

    const {
      data: updated,
      error: updateError,
    } = await supabase
      .from("level_tests")
      .update({
        interview_required:
          interviewRequired,

        interview_status:
          nextInterviewStatus,

        status: nextStatus,

        final_level: shouldFinalize
          ? finalLevel
          : null,

        final_course_id:
          shouldFinalize
            ? finalCourseId
            : null,

        finalized_at:
          shouldFinalize
            ? now
            : null,

        admin_note:
          adminNote || null,

        updated_at: now,
      })
      .eq("id", levelTestId)
      .select(`
        id,
        status,
        interview_required,
        interview_status,
        final_level,
        final_course_id,
        finalized_at
      `)
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        {
          error:
            "관리자 검토 결과를 저장하지 못했습니다.",
          detail: updateError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!updated) {
      return NextResponse.json(
        {
          error:
            "저장 결과를 확인하지 못했습니다.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      levelTest: updated,
    });
  } catch (error) {
    console.error(
      "ADMIN LEVEL TEST REVIEW API ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "레벨테스트 처리 중 알 수 없는 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}