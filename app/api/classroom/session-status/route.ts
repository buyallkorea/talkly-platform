import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type RequestBody = {
  sessionId: number;
  action: "start" | "end";
};

type SupabaseClient = Awaited<
  ReturnType<typeof createClient>
>;

/*
 * =========================================================
 * Zoom Access Token
 * =========================================================
 */
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

  const credentials =
    Buffer.from(
      `${clientId}:${clientSecret}`
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

/*
 * =========================================================
 * Zoom 회의 종료
 * =========================================================
 */
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
   * Zoom 정상 종료:
   * 204 No Content
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
        : JSON.stringify(data)
    }`
  );
}

/*
 * =========================================================
 * 수업 상태의 화면 표시용 실제 상태
 *
 * 중요:
 * held / cancelled / no_show / not_held는
 * started_at / ended_at만으로 덮어쓰면 안 됩니다.
 * =========================================================
 */
function getEffectiveStatus(
  session: {
    status: string;
    started_at: string | null;
    ended_at: string | null;
  }
) {
  /*
   * 업무상 확정된 특수 상태를 최우선합니다.
   */
  if (
    session.status === "held" ||
    session.status === "cancelled" ||
    session.status === "no_show" ||
    session.status === "not_held"
  ) {
    return session.status;
  }

  if (
    session.ended_at ||
    session.status ===
      "completed"
  ) {
    return "completed";
  }

  if (
    session.started_at ||
    session.status ===
      "in_progress"
  ) {
    return "in_progress";
  }

  return "scheduled";
}

/*
 * =========================================================
 * 예정 종료시간 경과 수업 자동마감
 *
 * 규칙:
 * - status = scheduled
 * - started_at IS NULL
 * - scheduled_end <= 현재시각
 *   => status = not_held
 *
 * 이미 시작한 수업은 예정 종료시간이 지나도 자동 종료하지 않습니다.
 * not_held는 귀책사유가 확정되지 않은 중립적인 "미진행" 상태입니다.
 * =========================================================
 */
async function closeExpiredScheduledSession({
  supabase,
  session,
}: {
  supabase: SupabaseClient;
  session: {
    id: number;
    enrollment_id: number;
    status: string;
    scheduled_end: string;
    meeting_provider: string | null;
    meeting_id: string | null;
    started_at: string | null;
    ended_at: string | null;
  };
}) {
  if (
    session.status !== "scheduled" ||
    session.started_at ||
    session.ended_at
  ) {
    return session;
  }

  const scheduledEndMs =
    new Date(
      session.scheduled_end
    ).getTime();

  if (
    !Number.isFinite(
      scheduledEndMs
    ) ||
    scheduledEndMs >
      Date.now()
  ) {
    return session;
  }

  const now =
    new Date().toISOString();

  const {
    data,
    error,
  } =
    await supabase
      .from("class_sessions")
      .update({
        status: "not_held",
        updated_at: now,
      })
      .eq(
        "id",
        session.id
      )
      .eq(
        "status",
        "scheduled"
      )
      .is(
        "started_at",
        null
      )
      .lte(
        "scheduled_end",
        now
      )
      .select(`
        id,
        enrollment_id,
        status,
        scheduled_end,
        meeting_provider,
        meeting_id,
        started_at,
        ended_at
      `)
      .maybeSingle();

  if (error) {
    throw new Error(
      `미진행 수업 자동마감 실패: ${error.message}`
    );
  }

  /*
   * 동시에 다른 요청이 먼저 수업을 시작했거나
   * 상태를 변경했다면 update 결과가 없을 수 있습니다.
   * 그 경우 현재 DB 상태를 다시 읽습니다.
   */
  if (!data) {
    const {
      data: latest,
      error: latestError,
    } =
      await supabase
        .from(
          "class_sessions"
        )
        .select(`
          id,
          enrollment_id,
          status,
          scheduled_end,
          meeting_provider,
          meeting_id,
          started_at,
          ended_at
        `)
        .eq(
          "id",
          session.id
        )
        .maybeSingle();

    if (
      latestError ||
      !latest
    ) {
      throw new Error(
        latestError?.message ||
          "수업의 최신 상태를 확인할 수 없습니다."
      );
    }

    return latest;
  }

  return data;
}

/*
 * =========================================================
 * 수강 자동 완료 처리
 *
 * 중요:
 * enrollment의 완료 여부는 "정규수업"만 기준으로 합니다.
 *
 * session_kind = regular
 *   → 계약된 정규 수업 회차
 *
 * session_kind = makeup
 *   → 원래 정규수업을 대체하기 위한 보강수업
 *   → 추가 계약 회차로 계산하지 않음
 *
 * 따라서 정규 20회 + 보강 1회가 존재하더라도
 * 수강 완료 판정의 기본 회차는 정규 20회입니다.
 *
 * 최종 종료로 인정:
 * - completed
 * - cancelled
 * - no_show
 *
 * held는 최종 종료로 인정하지 않습니다.
 * not_held도 귀책사유 미확정 상태이므로
 * 최종 종료로 인정하지 않습니다.
 *
 * 보강수업 완료와 원본 held/not_held의 충족 관계는
 * 보강수업 생성/완료 정책에서 별도로 처리합니다.
 * =========================================================
 */
async function syncEnrollmentCompletion({
  supabase,
  enrollmentId,
}: {
  supabase: SupabaseClient;
  enrollmentId: number;
}) {
  const {
    data: enrollment,
    error: enrollmentError,
  } =
    await supabase
      .from("enrollments")
      .select(`
        id,
        status
      `)
      .eq(
        "id",
        enrollmentId
      )
      .maybeSingle();

  if (
    enrollmentError
  ) {
    throw new Error(
      `수강상태 확인 실패: ${enrollmentError.message}`
    );
  }

  if (!enrollment) {
    throw new Error(
      "수강정보를 찾을 수 없습니다."
    );
  }

  /*
   * 이미 완료된 수강이면
   * 중복 변경하지 않습니다.
   */
  if (
    enrollment.status ===
    "completed"
  ) {
    return {
      completed: true,
      changed: false,
    };
  }

  /*
   * =========================================================
   * 정규수업만 조회
   *
   * 보강수업(session_kind = makeup)은
   * enrollment의 계약 회차에 추가하지 않습니다.
   * =========================================================
   */
  const {
    data: sessions,
    error: sessionsError,
  } =
    await supabase
      .from("class_sessions")
      .select(`
        id,
        status,
        started_at,
        ended_at,
        session_kind
      `)
      .eq(
        "enrollment_id",
        enrollmentId
      )
      .eq(
        "session_kind",
        "regular"
      );

  if (
    sessionsError
  ) {
    throw new Error(
      `수강 회차 확인 실패: ${sessionsError.message}`
    );
  }

  const sessionRows =
    sessions ?? [];

  /*
   * 정규수업이 한 건도 없는 수강은
   * 자동 완료하지 않습니다.
   */
  if (
    sessionRows.length === 0
  ) {
    return {
      completed: false,
      changed: false,
    };
  }

  /*
   * completed / cancelled / no_show만
   * 최종 종료 상태로 인정합니다.
   *
   * held는 보강/대체수업이 필요한 상태이므로
   * 여기서는 완료로 인정하지 않습니다.
   *
   * not_held는 귀책사유가 확정되지 않은
   * 중립 상태이므로 완료로 인정하지 않습니다.
   */
  const allFinished =
    sessionRows.every(
      (session) => {
        if (
          session.status ===
            "cancelled" ||
          session.status ===
            "no_show"
        ) {
          return true;
        }

        return (
          session.status ===
            "completed" ||
          Boolean(
            session.ended_at
          )
        );
      }
    );

  if (!allFinished) {
    return {
      completed: false,
      changed: false,
    };
  }

  const now =
    new Date().toISOString();

  const {
    error: updateError,
  } =
    await supabase
      .from("enrollments")
      .update({
        status:
          "completed",
        updated_at: now,
      })
      .eq(
        "id",
        enrollmentId
      )
      /*
       * 이미 취소되거나 다른 상태로
       * 변경된 수강을 덮어쓰지 않습니다.
       */
      .in(
        "status",
        [
          "active",
          "paused",
          "pending",
        ]
      );

  if (
    updateError
  ) {
    throw new Error(
      `수강 완료 처리 실패: ${updateError.message}`
    );
  }

  return {
    completed: true,
    changed: true,
  };
}

/*
 * =========================================================
 * 공통 Context
 * =========================================================
 */
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
  } =
    await supabase
      .from(
        "class_sessions"
      )
      .select(`
        id,
        enrollment_id,
        status,
        scheduled_end,
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
  } =
    await supabase
      .from("enrollments")
      .select(`
        id,
        teacher_user_id,
        student_user_id,
        child_id,
        status
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
   * enrollment.student_user_id
   * 또는
   * 자녀 student_user_id
   * 또는
   * 자녀 linked_student_user_id
   *
   * parent:
   * 본인이 등록한 자녀
   * =======================================================
   */

  let hasAccess =
    false;

  if (
    profile.role ===
    "admin"
  ) {
    hasAccess = true;
  }

  /*
   * 강사
   */
  if (
    profile.role ===
      "teacher" &&
    enrollment.teacher_user_id ===
      user.id
  ) {
    hasAccess = true;
  }

  /*
   * 성인학생 또는
   * enrollment에 직접 연결된 학생
   */
  if (
    profile.role ===
      "student" &&
    enrollment.student_user_id ===
      user.id
  ) {
    hasAccess = true;
  }

  /*
   * 자녀 학생계정
   */
  if (
    profile.role ===
      "student" &&
    !hasAccess &&
    enrollment.child_id
  ) {
    const {
      data: child,
      error: childError,
    } =
      await supabase
        .from("children")
        .select(`
          id,
          student_user_id,
          linked_student_user_id
        `)
        .eq(
          "id",
          enrollment.child_id
        )
        .maybeSingle();

    if (
      !childError &&
      child
    ) {
      hasAccess =
        child.student_user_id ===
          user.id ||
        child.linked_student_user_id ===
          user.id;
    }
  }

  /*
   * 학부모
   */
  if (
    profile.role ===
      "parent" &&
    enrollment.child_id
  ) {
    const {
      data: child,
      error: childError,
    } =
      await supabase
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

    if (
      !childError &&
      child
    ) {
      hasAccess = true;
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

    const currentSession =
      await closeExpiredScheduledSession({
        supabase:
          ctx.supabase,
        session:
          ctx.session,
      });

    const effectiveStatus =
      getEffectiveStatus(
        currentSession
      );

    return NextResponse.json({
      success: true,

      session: {
        id:
          currentSession.id,

        databaseStatus:
          currentSession.status,

        effectiveStatus,

        scheduledEnd:
          currentSession.scheduled_end,

        startedAt:
          currentSession.started_at,

        endedAt:
          currentSession.ended_at,
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
      body.action !==
        "end"
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
       * 예정 종료시간이 지난 미시작 수업은
       * 시작 직전에 서버에서 다시 확인하여 자동마감합니다.
       */
      const currentSession =
        await closeExpiredScheduledSession({
          supabase:
            ctx.supabase,
          session:
            ctx.session,
        });

      if (
        currentSession.status ===
        "not_held"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "예정된 수업 종료시간이 지나 미진행으로 마감된 수업입니다.",
          },
          {
            status: 409,
          }
        );
      }

      /*
       * 완료된 전체 수강은
       * 새로운 수업을 시작할 수 없습니다.
       */
      if (
        ctx.enrollment.status ===
        "completed"
      ) {
        return NextResponse.json(
          {
            success: false,

            error:
              "이미 완료된 수강입니다.",
          },
          {
            status: 409,
          }
        );
      }

      /*
       * 시작할 수 없는 회차 상태
       */
      if (
        currentSession.status ===
          "completed" ||
        currentSession.status ===
          "cancelled" ||
        currentSession.status ===
          "held" ||
        currentSession.status ===
          "no_show" ||
        currentSession.status ===
          "not_held" ||
        currentSession.ended_at
      ) {
        return NextResponse.json(
          {
            success: false,

            error:
              "현재 상태의 수업은 시작할 수 없습니다.",
          },
          {
            status: 409,
          }
        );
      }

      /*
       * 이미 시작 상태라면
       * 중복 요청을 성공 처리
       */
      if (
        currentSession.started_at
      ) {
        return NextResponse.json({
          success: true,

          session: {
            id:
              currentSession.id,

            databaseStatus:
              currentSession.status,

            effectiveStatus:
              "in_progress",

            startedAt:
              currentSession.started_at,

            endedAt:
              currentSession.ended_at,
          },
        });
      }

      const now =
        new Date().toISOString();

      const {
        data,
        error,
      } =
        await ctx.supabase
          .from(
            "class_sessions"
          )
          .update({
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
          /*
           * 동시에 다른 요청이 상태를 바꿨을 경우
           * 덮어쓰지 않도록 예정 상태만 변경
           */
          .eq(
            "status",
            "scheduled"
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
              "수업 시작 처리에 실패했습니다. 현재 수업 상태를 다시 확인해주세요.",
          },
          {
            status: 409,
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
     * 이미 종료된 수업
     *
     * 이전 요청에서 회차 종료는 성공했지만
     * enrollment 완료처리가 실패했을 가능성도 있으므로
     * 여기에서도 sync를 다시 실행합니다.
     */
    if (
      ctx.session.ended_at ||
      ctx.session.status ===
        "completed"
    ) {
      const enrollmentSync =
        await syncEnrollmentCompletion({
          supabase:
            ctx.supabase,

          enrollmentId:
            ctx.session
              .enrollment_id,
        });

      return NextResponse.json({
        success: true,

        session: {
          id:
            ctx.session.id,

          databaseStatus:
            ctx.session.status,

          effectiveStatus:
            "completed",

          startedAt:
            ctx.session.started_at,

          endedAt:
            ctx.session.ended_at,
        },

        enrollment: {
          id:
            ctx.session
              .enrollment_id,

          completed:
            enrollmentSync.completed,

          changed:
            enrollmentSync.changed,
        },
      });
    }

    /*
     * Zoom Meeting 종료
     *
     * Zoom API 오류 때문에 TALKLY DB의 수업 종료가
     * 영원히 막히면 안 됩니다.
     *
     * Zoom 종료는 시도하되 실패하면 로그를 남기고
     * TALKLY 내부 수업 종료 처리는 계속합니다.
     */
    let zoomEndWarning:
      string | null =
        null;

    if (
      ctx.session
        .meeting_provider ===
        "zoom" &&
      ctx.session.meeting_id
    ) {
      try {
        await endZoomMeeting(
          String(
            ctx.session
              .meeting_id
          )
        );
      } catch (error) {
        zoomEndWarning =
          error instanceof Error
            ? error.message
            : "Zoom 회의 종료 처리에 실패했습니다.";

        console.warn(
          "ZOOM END WARNING:",
          zoomEndWarning
        );
      }
    }

    const now =
      new Date().toISOString();

    const {
      data,
      error,
    } =
      await ctx.supabase
        .from(
          "class_sessions"
        )
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
        /*
         * 이미 다른 작업으로 종료된 상태를
         * 덮어쓰지 않습니다.
         */
        .eq(
          "status",
          "in_progress"
        )
        .select(`
          id,
          enrollment_id,
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
            "수업 종료 처리에 실패했습니다. 현재 수업 상태를 다시 확인해주세요.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =====================================================
     * 이 회차 종료 후
     * 전체 수강 완료 여부 자동 확인
     * =====================================================
     */
    const enrollmentSync =
      await syncEnrollmentCompletion({
        supabase:
          ctx.supabase,

        enrollmentId:
          data.enrollment_id,
      });

    return NextResponse.json({
      success: true,

      message:
        enrollmentSync.completed
          ? "수업이 종료되었으며 전체 수강도 완료 처리되었습니다."
          : "수업이 종료되었습니다.",

      warning:
        zoomEndWarning,

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

      enrollment: {
        id:
          data.enrollment_id,

        completed:
          enrollmentSync.completed,

        changed:
          enrollmentSync.changed,
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
