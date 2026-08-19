import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type RequestBody = {
  sessionId: number;
  action: "start" | "end";
};

async function getZoomAccessToken() {
  const accountId =
    process.env.ZOOM_ACCOUNT_ID;

  const clientId =
    process.env.ZOOM_CLIENT_ID;

  const clientSecret =
    process.env.ZOOM_CLIENT_SECRET;

  if (
    !accountId ||
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      "Zoom Server-to-Server OAuth 환경변수가 설정되지 않았습니다."
    );
  }

  const credentials = Buffer.from(
  clientId + ":" + clientSecret
).toString("base64");

  const response =
    await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(
        accountId
      )}`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Basic ${credentials}`,

          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        cache: "no-store",
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.access_token
  ) {
    throw new Error(
      `Zoom Access Token 발급 실패: ${
        typeof data?.message === "string"
          ? data.message
          : JSON.stringify(data)
      }`
    );
  }

  return data.access_token as string;
}

async function endZoomMeeting(
  meetingId: string
) {
  const accessToken =
    await getZoomAccessToken();

  const response =
    await fetch(
      `https://api.zoom.us/v2/meetings/${encodeURIComponent(
        meetingId
      )}/status`,
      {
        method: "PUT",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            action: "end",
          }),

        cache: "no-store",
      }
    );

  /*
   * Zoom에서 정상 종료 처리되면
   * 204 No Content가 반환됩니다.
   */
  if (
    response.status === 204
  ) {
    return;
  }

  let data: unknown =
    null;

  try {
    data =
      await response.json();
  } catch {
    data = null;
  }

  throw new Error(
    `Zoom 회의 종료 실패: ${
      typeof (
        data as {
          message?: unknown;
        } | null
      )?.message === "string"
        ? (
            data as {
              message: string;
            }
          ).message
        : JSON.stringify(
            data
          )
    }`
  );
}

async function getContext(
  sessionId: number
) {
  const supabase =
    await createClient();

  /*
   * =======================================================
   * 1. 로그인 사용자
   * =======================================================
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
    return {
      ok: false as const,

      response:
        NextResponse.json(
          {
            success: false,
            error:
              "로그인이 필요합니다.",
          },
          {
            status: 401,
          }
        ),
    };
  }

  /*
   * =======================================================
   * 2. 사용자 역할
   * =======================================================
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
    return {
      ok: false as const,

      response:
        NextResponse.json(
          {
            success: false,
            error:
              profileError?.message ||
              "사용자 정보를 확인할 수 없습니다.",
          },
          {
            status: 403,
          }
        ),
    };
  }

  /*
   * =======================================================
   * 3. 수업
   * =======================================================
   */
  const {
    data: session,
    error: sessionError,
  } = await supabase
    .from("class_sessions")
    .select(`
      id,
      enrollment_id,
      status,
      meeting_provider,
      meeting_id,
      started_at,
      ended_at
    `)
    .eq(
      "id",
      sessionId
    )
    .maybeSingle();

  if (
    sessionError ||
    !session
  ) {
    return {
      ok: false as const,

      response:
        NextResponse.json(
          {
            success: false,
            error:
              sessionError?.message ||
              "수업을 찾을 수 없습니다.",
          },
          {
            status: 404,
          }
        ),
    };
  }

  /*
   * =======================================================
   * 4. 수강정보
   * =======================================================
   */
  const {
    data: enrollment,
    error:
      enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(`
      teacher_user_id,
      student_user_id,
      child_id
    `)
    .eq(
      "id",
      session.enrollment_id
    )
    .maybeSingle();

  if (
    enrollmentError ||
    !enrollment
  ) {
    return {
      ok: false as const,

      response:
        NextResponse.json(
          {
            success: false,
            error:
              enrollmentError?.message ||
              "수강정보를 찾을 수 없습니다.",
          },
          {
            status: 404,
          }
        ),
    };
  }

  /*
   * =======================================================
   * 5. 접근 권한
   *
   * admin:
   * 모든 수업
   *
   * teacher:
   * 자신에게 배정된 수업
   *
   * student:
   * 자신의 수강 수업
   *
   * parent:
   * 본인이 등록한 자녀의 수업
   * =======================================================
   */
  let hasAccess =
    false;

  if (
    profile.role ===
    "admin"
  ) {
    hasAccess = true;
  } else if (
    profile.role ===
      "teacher" &&
    enrollment.teacher_user_id ===
      user.id
  ) {
    hasAccess = true;
  } else if (
    profile.role ===
      "student" &&
    enrollment.student_user_id ===
      user.id
  ) {
    hasAccess = true;
  } else if (
    profile.role ===
      "parent" &&
    enrollment.child_id
  ) {
    const {
      data: child,
      error: childError,
    } = await supabase
      .from("children")
      .select("id")
      .eq(
        "id",
        enrollment.child_id
      )
      .eq(
        "parent_user_id",
        user.id
      )
      .maybeSingle();

    if (!childError) {
      hasAccess =
        Boolean(child);
    }
  }

  if (!hasAccess) {
    return {
      ok: false as const,

      response:
        NextResponse.json(
          {
            success: false,
            error:
              "이 수업에 접근할 권한이 없습니다.",
          },
          {
            status: 403,
          }
        ),
    };
  }

  return {
    ok: true as const,

    supabase,
    user,
    profile,
    session,
    enrollment,
  };
}

/*
 * =========================================================
 * GET
 *
 * 현재 수업 상태 조회
 *
 * ClassroomWaitingRoom,
 * ClassSessionEndWatcher 등에서 polling할 수 있습니다.
 * =========================================================
 */
export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(
        request.url
      );

    const sessionId =
      Number(
        url.searchParams.get(
          "sessionId"
        )
      );

    if (
      !Number.isInteger(
        sessionId
      ) ||
      sessionId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "올바른 수업 ID가 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    const ctx =
      await getContext(
        sessionId
      );

    if (!ctx.ok) {
      return ctx.response;
    }

    /*
     * started_at / ended_at을 기준으로
     * 화면에서 사용할 실제 상태를 계산합니다.
     */
    const effectiveStatus =
      ctx.session.ended_at
        ? "completed"
        : ctx.session.started_at
          ? "in_progress"
          : "scheduled";

    return NextResponse.json({
      success: true,

      session: {
        id:
          ctx.session.id,

        databaseStatus:
          ctx.session.status,

        effectiveStatus,

        startedAt:
          ctx.session.started_at,

        endedAt:
          ctx.session.ended_at,
      },
    });
  } catch (error) {
    console.error(
      "CLASS SESSION STATUS GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "수업 상태 조회 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * =========================================================
 * POST
 *
 * action = start
 *   강사가 수업 시작
 *
 * action = end
 *   강사가 수업 종료
 * =========================================================
 */
export async function POST(
  request: Request
) {
  try {
    let body:
      RequestBody;

    try {
      body =
        (await request.json()) as
          RequestBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "요청 데이터를 읽을 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const sessionId =
      Number(
        body.sessionId
      );

    if (
      !Number.isInteger(
        sessionId
      ) ||
      sessionId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "올바른 수업 ID가 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      body.action !==
        "start" &&
      body.action !== "end"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "올바른 작업이 아닙니다.",
        },
        {
          status: 400,
        }
      );
    }

    const ctx =
      await getContext(
        sessionId
      );

    if (!ctx.ok) {
      return ctx.response;
    }

    /*
     * 상태 변경은
     * 담당 강사 또는 관리자만 가능
     */
    if (
      ctx.profile.role !==
        "teacher" &&
      ctx.profile.role !==
        "admin"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "강사 또는 관리자만 수업 상태를 변경할 수 있습니다.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =====================================================
     * 수업 시작
     * =====================================================
     */
    if (
      body.action ===
      "start"
    ) {
      /*
       * 종료된 수업을 다시 시작할 수 없음
       */
      if (
        ctx.session.ended_at ||
        ctx.session.status ===
          "completed"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "이미 종료된 수업입니다.",
          },
          {
            status: 409,
          }
        );
      }

      /*
       * 이미 시작된 상태라면
       * 중복 요청이어도 성공으로 처리
       */
      if (
        ctx.session.started_at
      ) {
        return NextResponse.json({
          success: true,

          session: {
            id:
              ctx.session.id,

            effectiveStatus:
              "in_progress",

            startedAt:
              ctx.session.started_at,

            endedAt:
              ctx.session.ended_at,
          },
        });
      }

      const now =
        new Date().toISOString();

      const {
        data,
        error,
      } = await ctx.supabase
        .from(
          "class_sessions"
        )
        .update({
          /*
           * DB status도 함께 변경합니다.
           * 기존 코드보다 상태가 명확합니다.
           */
          status:
            "in_progress",

          started_at:
            now,

          updated_at:
            now,
        })
        .eq(
          "id",
          sessionId
        )
        .select(`
          id,
          status,
          started_at,
          ended_at
        `)
        .maybeSingle();

      if (
        error ||
        !data
      ) {
        return NextResponse.json(
          {
            success: false,

            error:
              error?.message ||
              "수업 시작 처리에 실패했습니다.",
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        success: true,

        session: {
          id:
            data.id,

          databaseStatus:
            data.status,

          effectiveStatus:
            "in_progress",

          startedAt:
            data.started_at,

          endedAt:
            data.ended_at,
        },
      });
    }

    /*
     * =====================================================
     * 수업 종료
     * =====================================================
     */

    if (
      !ctx.session.started_at
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "아직 시작하지 않은 수업입니다.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * 이미 종료된 경우
     * 중복 종료 요청도 성공 처리
     */
    if (
      ctx.session.ended_at ||
      ctx.session.status ===
        "completed"
    ) {
      return NextResponse.json({
        success: true,

        session: {
          id:
            ctx.session.id,

          effectiveStatus:
            "completed",

          startedAt:
            ctx.session.started_at,

          endedAt:
            ctx.session.ended_at,
        },
      });
    }

    /*
     * Zoom Meeting이 연결된 수업이면
     * Zoom 회의도 종료합니다.
     */
    if (
      ctx.session
        .meeting_provider ===
        "zoom" &&
      ctx.session.meeting_id
    ) {
      await endZoomMeeting(
        String(
          ctx.session.meeting_id
        )
      );
    }

    const now =
      new Date().toISOString();

    const {
      data,
      error,
    } = await ctx.supabase
      .from("class_sessions")
      .update({
        ended_at:
          now,

        status:
          "completed",

        updated_at:
          now,
      })
      .eq(
        "id",
        sessionId
      )
      .select(`
        id,
        status,
        started_at,
        ended_at
      `)
      .maybeSingle();

    if (
      error ||
      !data
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            error?.message ||
            "수업 종료 처리에 실패했습니다.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,

      session: {
        id:
          data.id,

        databaseStatus:
          data.status,

        effectiveStatus:
          "completed",

        startedAt:
          data.started_at,

        endedAt:
          data.ended_at,
      },
    });
  } catch (error) {
    console.error(
      "CLASS SESSION STATUS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "수업 상태 처리 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}
