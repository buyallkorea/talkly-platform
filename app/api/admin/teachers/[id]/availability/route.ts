import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type RequestBody =
  | {
      action: "create_regular";
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      effectiveFrom?: string | null;
      effectiveTo?: string | null;
    }
  | {
      action: "update_regular";
      availabilityId: number;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      effectiveFrom?: string | null;
      effectiveTo?: string | null;
      isAvailable?: boolean;
    }
  | {
      action: "delete_regular";
      availabilityId: number;
    }
  | {
      action: "create_exception";
      exceptionDate: string;
      exceptionType: "unavailable" | "available";
      startTime?: string | null;
      endTime?: string | null;
      reason?: string | null;
    }
  | {
      action: "update_exception";
      exceptionId: number;
      exceptionDate: string;
      exceptionType: "unavailable" | "available";
      startTime?: string | null;
      endTime?: string | null;
      reason?: string | null;
      isActive?: boolean;
    }
  | {
      action: "delete_exception";
      exceptionId: number;
    };

function normalizeTime(
  value: string | null | undefined
) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (
    !/^\d{2}:\d{2}$/.test(trimmed) &&
    !/^\d{2}:\d{2}:\d{2}$/.test(trimmed)
  ) {
    return null;
  }

  return trimmed.slice(0, 5);
}

function isValidDate(
  value: string | null | undefined
) {
  if (!value) {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}

function timeToMinutes(
  value: string
) {
  const [hour, minute] = value
    .slice(0, 5)
    .split(":")
    .map(Number);

  return hour * 60 + minute;
}

async function requireAdmin() {
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
    return {
      supabase,
      user: null,
      response:
        NextResponse.json(
          {
            error:
              "로그인이 필요합니다.",
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
  } =
    await supabase
      .from("profiles")
      .select("role")
      .eq(
        "id",
        user.id
      )
      .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin"
  ) {
    return {
      supabase,
      user: null,
      response:
        NextResponse.json(
          {
            error:
              "관리자 권한이 필요합니다.",
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

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const {
      id: teacherUserId,
    } =
      await context.params;

    if (!teacherUserId) {
      return NextResponse.json(
        {
          error:
            "강사 ID가 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    const auth =
      await requireAdmin();

    if (auth.response) {
      return auth.response;
    }

    const supabase =
      auth.supabase;

    const {
      data: teacher,
      error: teacherError,
    } =
      await supabase
        .from(
          "teacher_profiles"
        )
        .select(`
          user_id,
          display_name,
          nationality,
          is_active
        `)
        .eq(
          "user_id",
          teacherUserId
        )
        .maybeSingle();

    if (teacherError) {
      return NextResponse.json(
        {
          error:
            "강사 정보를 확인하지 못했습니다.",
          detail:
            teacherError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!teacher) {
      return NextResponse.json(
        {
          error:
            "강사를 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    const [
      regularResult,
      exceptionResult,
    ] =
      await Promise.all([
        supabase
          .from(
            "teacher_availability"
          )
          .select(`
            id,
            teacher_user_id,
            day_of_week,
            start_time,
            end_time,
            timezone,
            is_available,
            effective_from,
            effective_to,
            created_at,
            updated_at
          `)
          .eq(
            "teacher_user_id",
            teacherUserId
          )
          .order(
            "day_of_week",
            {
              ascending:
                true,
            }
          )
          .order(
            "start_time",
            {
              ascending:
                true,
            }
          ),

        supabase
          .from(
            "teacher_availability_exceptions"
          )
          .select(`
            id,
            teacher_user_id,
            exception_date,
            exception_type,
            start_time,
            end_time,
            reason,
            is_active,
            created_by,
            created_at,
            updated_at
          `)
          .eq(
            "teacher_user_id",
            teacherUserId
          )
          .order(
            "exception_date",
            {
              ascending:
                true,
            }
          )
          .order(
            "start_time",
            {
              ascending:
                true,
              nullsFirst:
                true,
            }
          ),
      ]);

    const firstError =
      regularResult.error ||
      exceptionResult.error;

    if (firstError) {
      return NextResponse.json(
        {
          error:
            "강사 근무시간 정보를 불러오지 못했습니다.",
          detail:
            firstError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      teacher,
      regularAvailability:
        regularResult.data ??
        [],
      exceptions:
        exceptionResult.data ??
        [],
    });
  } catch (error) {
    console.error(
      "ADMIN TEACHER AVAILABILITY GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "강사 근무시간 조회 중 알 수 없는 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const {
      id: teacherUserId,
    } =
      await context.params;

    if (!teacherUserId) {
      return NextResponse.json(
        {
          error:
            "강사 ID가 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    const auth =
      await requireAdmin();

    if (auth.response) {
      return auth.response;
    }

    const supabase =
      auth.supabase;

    const {
      data: teacher,
      error: teacherError,
    } =
      await supabase
        .from(
          "teacher_profiles"
        )
        .select(`
          user_id,
          display_name,
          is_active
        `)
        .eq(
          "user_id",
          teacherUserId
        )
        .maybeSingle();

    if (teacherError) {
      return NextResponse.json(
        {
          error:
            "강사 정보를 확인하지 못했습니다.",
          detail:
            teacherError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!teacher) {
      return NextResponse.json(
        {
          error:
            "강사를 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    let body: RequestBody;

    try {
      body =
        (await request.json()) as RequestBody;
    } catch {
      return NextResponse.json(
        {
          error:
            "요청 내용을 확인할 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const now =
      new Date().toISOString();

    /*
     * =====================================================
     * 정규 근무시간 등록
     * =====================================================
     */
    if (
      body.action ===
      "create_regular"
    ) {
      const dayOfWeek =
        Number(
          body.dayOfWeek
        );

      const startTime =
        normalizeTime(
          body.startTime
        );

      const endTime =
        normalizeTime(
          body.endTime
        );

      const effectiveFrom =
        body.effectiveFrom ||
        null;

      const effectiveTo =
        body.effectiveTo ||
        null;

      if (
        !Number.isInteger(
          dayOfWeek
        ) ||
        dayOfWeek < 0 ||
        dayOfWeek > 6
      ) {
        return NextResponse.json(
          {
            error:
              "요일 정보가 올바르지 않습니다.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        !startTime ||
        !endTime
      ) {
        return NextResponse.json(
          {
            error:
              "시작시간과 종료시간을 확인해주세요.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        timeToMinutes(
          startTime
        ) >=
        timeToMinutes(
          endTime
        )
      ) {
        return NextResponse.json(
          {
            error:
              "종료시간은 시작시간보다 늦어야 합니다.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        effectiveFrom &&
        !isValidDate(
          effectiveFrom
        )
      ) {
        return NextResponse.json(
          {
            error:
              "적용 시작일을 확인해주세요.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        effectiveTo &&
        !isValidDate(
          effectiveTo
        )
      ) {
        return NextResponse.json(
          {
            error:
              "적용 종료일을 확인해주세요.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        effectiveFrom &&
        effectiveTo &&
        effectiveFrom >
          effectiveTo
      ) {
        return NextResponse.json(
          {
            error:
              "적용 종료일은 시작일보다 빠를 수 없습니다.",
          },
          {
            status: 400,
          }
        );
      }

      const {
        data: overlappingRows,
        error:
          overlapCheckError,
      } =
        await supabase
          .from(
            "teacher_availability"
          )
          .select(`
            id,
            start_time,
            end_time,
            effective_from,
            effective_to
          `)
          .eq(
            "teacher_user_id",
            teacherUserId
          )
          .eq(
            "day_of_week",
            dayOfWeek
          )
          .eq(
            "is_available",
            true
          );

      if (
        overlapCheckError
      ) {
        return NextResponse.json(
          {
            error:
              "기존 근무시간을 확인하지 못했습니다.",
            detail:
              overlapCheckError.message,
          },
          {
            status: 500,
          }
        );
      }

      const hasOverlap =
        (
          overlappingRows ??
          []
        ).some(
          (row) => {
            const rowStart =
              timeToMinutes(
                row.start_time
              );

            const rowEnd =
              timeToMinutes(
                row.end_time
              );

            const timeOverlap =
              timeToMinutes(
                startTime
              ) <
                rowEnd &&
              timeToMinutes(
                endTime
              ) >
                rowStart;

            if (
              !timeOverlap
            ) {
              return false;
            }

            const rowFrom =
              row.effective_from ||
              "0000-01-01";

            const rowTo =
              row.effective_to ||
              "9999-12-31";

            const newFrom =
              effectiveFrom ||
              "0000-01-01";

            const newTo =
              effectiveTo ||
              "9999-12-31";

            return (
              newFrom <=
                rowTo &&
              newTo >=
                rowFrom
            );
          }
        );

      if (hasOverlap) {
        return NextResponse.json(
          {
            error:
              "같은 요일의 기존 근무시간과 겹칩니다.",
          },
          {
            status: 409,
          }
        );
      }

      const {
        data: inserted,
        error: insertError,
      } =
        await supabase
          .from(
            "teacher_availability"
          )
          .insert({
            teacher_user_id:
              teacherUserId,
            day_of_week:
              dayOfWeek,
            start_time:
              startTime,
            end_time:
              endTime,
            timezone:
              "Asia/Seoul",
            is_available:
              true,
            effective_from:
              effectiveFrom,
            effective_to:
              effectiveTo,
            updated_at:
              now,
          })
          .select(`
            id,
            teacher_user_id,
            day_of_week,
            start_time,
            end_time,
            timezone,
            is_available,
            effective_from,
            effective_to,
            created_at,
            updated_at
          `)
          .maybeSingle();

      if (insertError) {
        return NextResponse.json(
          {
            error:
              "정규 근무시간을 등록하지 못했습니다.",
            detail:
              insertError.message,
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        ok: true,
        availability:
          inserted,
      });
    }

    /*
     * =====================================================
     * 정규 근무시간 수정
     * =====================================================
     */
    if (
      body.action ===
      "update_regular"
    ) {
      const availabilityId =
        Number(
          body.availabilityId
        );

      const dayOfWeek =
        Number(
          body.dayOfWeek
        );

      const startTime =
        normalizeTime(
          body.startTime
        );

      const endTime =
        normalizeTime(
          body.endTime
        );

      const effectiveFrom =
        body.effectiveFrom ||
        null;

      const effectiveTo =
        body.effectiveTo ||
        null;

      const isAvailable =
        body.isAvailable !==
        false;

      if (
        !Number.isInteger(
          availabilityId
        ) ||
        availabilityId <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "근무시간 ID가 올바르지 않습니다.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        !Number.isInteger(
          dayOfWeek
        ) ||
        dayOfWeek < 0 ||
        dayOfWeek > 6
      ) {
        return NextResponse.json(
          {
            error:
              "요일 정보가 올바르지 않습니다.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        !startTime ||
        !endTime
      ) {
        return NextResponse.json(
          {
            error:
              "시작시간과 종료시간을 확인해주세요.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        timeToMinutes(
          startTime
        ) >=
        timeToMinutes(
          endTime
        )
      ) {
        return NextResponse.json(
          {
            error:
              "종료시간은 시작시간보다 늦어야 합니다.",
          },
          {
            status: 400,
          }
        );
      }

      const {
        data: existing,
        error:
          existingError,
      } =
        await supabase
          .from(
            "teacher_availability"
          )
          .select("id")
          .eq(
            "id",
            availabilityId
          )
          .eq(
            "teacher_user_id",
            teacherUserId
          )
          .maybeSingle();

      if (
        existingError
      ) {
        return NextResponse.json(
          {
            error:
              "기존 근무시간을 확인하지 못했습니다.",
            detail:
              existingError.message,
          },
          {
            status: 500,
          }
        );
      }

      if (!existing) {
        return NextResponse.json(
          {
            error:
              "수정할 근무시간을 찾을 수 없습니다.",
          },
          {
            status: 404,
          }
        );
      }

      const {
        data:
          overlappingRows,
        error:
          overlapCheckError,
      } =
        await supabase
          .from(
            "teacher_availability"
          )
          .select(`
            id,
            start_time,
            end_time,
            effective_from,
            effective_to
          `)
          .eq(
            "teacher_user_id",
            teacherUserId
          )
          .eq(
            "day_of_week",
            dayOfWeek
          )
          .eq(
            "is_available",
            true
          )
          .neq(
            "id",
            availabilityId
          );

      if (
        overlapCheckError
      ) {
        return NextResponse.json(
          {
            error:
              "기존 근무시간을 확인하지 못했습니다.",
            detail:
              overlapCheckError.message,
          },
          {
            status: 500,
          }
        );
      }

      const hasOverlap =
        (
          overlappingRows ??
          []
        ).some(
          (row) => {
            const rowStart =
              timeToMinutes(
                row.start_time
              );

            const rowEnd =
              timeToMinutes(
                row.end_time
              );

            const timeOverlap =
              timeToMinutes(
                startTime
              ) <
                rowEnd &&
              timeToMinutes(
                endTime
              ) >
                rowStart;

            if (
              !timeOverlap
            ) {
              return false;
            }

            const rowFrom =
              row.effective_from ||
              "0000-01-01";

            const rowTo =
              row.effective_to ||
              "9999-12-31";

            const newFrom =
              effectiveFrom ||
              "0000-01-01";

            const newTo =
              effectiveTo ||
              "9999-12-31";

            return (
              newFrom <=
                rowTo &&
              newTo >=
                rowFrom
            );
          }
        );

      if (
        isAvailable &&
        hasOverlap
      ) {
        return NextResponse.json(
          {
            error:
              "같은 요일의 기존 근무시간과 겹칩니다.",
          },
          {
            status: 409,
          }
        );
      }

      const {
        data: updated,
        error: updateError,
      } =
        await supabase
          .from(
            "teacher_availability"
          )
          .update({
            day_of_week:
              dayOfWeek,
            start_time:
              startTime,
            end_time:
              endTime,
            effective_from:
              effectiveFrom,
            effective_to:
              effectiveTo,
            is_available:
              isAvailable,
            updated_at:
              now,
          })
          .eq(
            "id",
            availabilityId
          )
          .eq(
            "teacher_user_id",
            teacherUserId
          )
          .select(`
            id,
            teacher_user_id,
            day_of_week,
            start_time,
            end_time,
            timezone,
            is_available,
            effective_from,
            effective_to,
            created_at,
            updated_at
          `)
          .maybeSingle();

      if (updateError) {
        return NextResponse.json(
          {
            error:
              "정규 근무시간을 수정하지 못했습니다.",
            detail:
              updateError.message,
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        ok: true,
        availability:
          updated,
      });
    }

    /*
     * =====================================================
     * 정규 근무시간 삭제
     * =====================================================
     */
    if (
      body.action ===
      "delete_regular"
    ) {
      const availabilityId =
        Number(
          body.availabilityId
        );

      if (
        !Number.isInteger(
          availabilityId
        ) ||
        availabilityId <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "근무시간 ID가 올바르지 않습니다.",
          },
          {
            status: 400,
          }
        );
      }

      const {
        error: deleteError,
      } =
        await supabase
          .from(
            "teacher_availability"
          )
          .delete()
          .eq(
            "id",
            availabilityId
          )
          .eq(
            "teacher_user_id",
            teacherUserId
          );

      if (deleteError) {
        return NextResponse.json(
          {
            error:
              "정규 근무시간을 삭제하지 못했습니다.",
            detail:
              deleteError.message,
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        ok: true,
      });
    }

    /*
     * =====================================================
     * 예외 일정 등록
     * =====================================================
     */
    if (
      body.action ===
      "create_exception"
    ) {
      const exceptionDate =
        body.exceptionDate;

      const exceptionType =
        body.exceptionType;

      const startTime =
        normalizeTime(
          body.startTime
        );

      const endTime =
        normalizeTime(
          body.endTime
        );

      const reason =
        typeof body.reason ===
        "string"
          ? body.reason.trim()
          : "";

      if (
        !isValidDate(
          exceptionDate
        )
      ) {
        return NextResponse.json(
          {
            error:
              "예외 날짜를 확인해주세요.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        ![
          "available",
          "unavailable",
        ].includes(
          exceptionType
        )
      ) {
        return NextResponse.json(
          {
            error:
              "예외 유형이 올바르지 않습니다.",
          },
          {
            status: 400,
          }
        );
      }

      const hasStart =
        !!startTime;

      const hasEnd =
        !!endTime;

      if (
        hasStart !== hasEnd
      ) {
        return NextResponse.json(
          {
            error:
              "시작시간과 종료시간은 함께 입력하거나 모두 비워야 합니다.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        startTime &&
        endTime &&
        timeToMinutes(
          startTime
        ) >=
          timeToMinutes(
            endTime
          )
      ) {
        return NextResponse.json(
          {
            error:
              "종료시간은 시작시간보다 늦어야 합니다.",
          },
          {
            status: 400,
          }
        );
      }

      const {
        data: inserted,
        error: insertError,
      } =
        await supabase
          .from(
            "teacher_availability_exceptions"
          )
          .insert({
            teacher_user_id:
              teacherUserId,
            exception_date:
              exceptionDate,
            exception_type:
              exceptionType,
            start_time:
              startTime,
            end_time:
              endTime,
            reason:
              reason ||
              null,
            is_active:
              true,
            created_by:
              auth.user?.id ??
              null,
            updated_at:
              now,
          })
          .select(`
            id,
            teacher_user_id,
            exception_date,
            exception_type,
            start_time,
            end_time,
            reason,
            is_active,
            created_by,
            created_at,
            updated_at
          `)
          .maybeSingle();

      if (insertError) {
        return NextResponse.json(
          {
            error:
              "예외 일정을 등록하지 못했습니다.",
            detail:
              insertError.message,
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        ok: true,
        exception:
          inserted,
      });
    }

    /*
     * =====================================================
     * 예외 일정 수정
     * =====================================================
     */
    if (
      body.action ===
      "update_exception"
    ) {
      const exceptionId =
        Number(
          body.exceptionId
        );

      const exceptionDate =
        body.exceptionDate;

      const exceptionType =
        body.exceptionType;

      const startTime =
        normalizeTime(
          body.startTime
        );

      const endTime =
        normalizeTime(
          body.endTime
        );

      const reason =
        typeof body.reason ===
        "string"
          ? body.reason.trim()
          : "";

      const isActive =
        body.isActive !==
        false;

      if (
        !Number.isInteger(
          exceptionId
        ) ||
        exceptionId <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "예외 일정 ID가 올바르지 않습니다.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        !isValidDate(
          exceptionDate
        )
      ) {
        return NextResponse.json(
          {
            error:
              "예외 날짜를 확인해주세요.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        ![
          "available",
          "unavailable",
        ].includes(
          exceptionType
        )
      ) {
        return NextResponse.json(
          {
            error:
              "예외 유형이 올바르지 않습니다.",
          },
          {
            status: 400,
          }
        );
      }

      const hasStart =
        !!startTime;

      const hasEnd =
        !!endTime;

      if (
        hasStart !== hasEnd
      ) {
        return NextResponse.json(
          {
            error:
              "시작시간과 종료시간은 함께 입력하거나 모두 비워야 합니다.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        startTime &&
        endTime &&
        timeToMinutes(
          startTime
        ) >=
          timeToMinutes(
            endTime
          )
      ) {
        return NextResponse.json(
          {
            error:
              "종료시간은 시작시간보다 늦어야 합니다.",
          },
          {
            status: 400,
          }
        );
      }

      const {
        data: existing,
        error:
          existingError,
      } =
        await supabase
          .from(
            "teacher_availability_exceptions"
          )
          .select("id")
          .eq(
            "id",
            exceptionId
          )
          .eq(
            "teacher_user_id",
            teacherUserId
          )
          .maybeSingle();

      if (
        existingError
      ) {
        return NextResponse.json(
          {
            error:
              "기존 예외일정을 확인하지 못했습니다.",
            detail:
              existingError.message,
          },
          {
            status: 500,
          }
        );
      }

      if (!existing) {
        return NextResponse.json(
          {
            error:
              "수정할 예외일정을 찾을 수 없습니다.",
          },
          {
            status: 404,
          }
        );
      }

      const {
        data: updated,
        error: updateError,
      } =
        await supabase
          .from(
            "teacher_availability_exceptions"
          )
          .update({
            exception_date:
              exceptionDate,
            exception_type:
              exceptionType,
            start_time:
              startTime,
            end_time:
              endTime,
            reason:
              reason ||
              null,
            is_active:
              isActive,
            updated_at:
              now,
          })
          .eq(
            "id",
            exceptionId
          )
          .eq(
            "teacher_user_id",
            teacherUserId
          )
          .select(`
            id,
            teacher_user_id,
            exception_date,
            exception_type,
            start_time,
            end_time,
            reason,
            is_active,
            created_by,
            created_at,
            updated_at
          `)
          .maybeSingle();

      if (updateError) {
        return NextResponse.json(
          {
            error:
              "예외 일정을 수정하지 못했습니다.",
            detail:
              updateError.message,
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        ok: true,
        exception:
          updated,
      });
    }

    /*
     * =====================================================
     * 예외 일정 삭제
     * =====================================================
     */
    if (
      body.action ===
      "delete_exception"
    ) {
      const exceptionId =
        Number(
          body.exceptionId
        );

      if (
        !Number.isInteger(
          exceptionId
        ) ||
        exceptionId <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "예외 일정 ID가 올바르지 않습니다.",
          },
          {
            status: 400,
          }
        );
      }

      const {
        error: deleteError,
      } =
        await supabase
          .from(
            "teacher_availability_exceptions"
          )
          .delete()
          .eq(
            "id",
            exceptionId
          )
          .eq(
            "teacher_user_id",
            teacherUserId
          );

      if (deleteError) {
        return NextResponse.json(
          {
            error:
              "예외 일정을 삭제하지 못했습니다.",
            detail:
              deleteError.message,
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        ok: true,
      });
    }

    return NextResponse.json(
      {
        error:
          "올바르지 않은 요청입니다.",
      },
      {
        status: 400,
      }
    );
  } catch (error) {
    console.error(
      "ADMIN TEACHER AVAILABILITY API ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "강사 근무시간 처리 중 알 수 없는 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}