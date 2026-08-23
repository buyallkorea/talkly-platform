import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const MAX_MONTHLY_HOLDS = 2;
const MIN_NOTICE_HOURS = 2;

type RequestBody = {
  sessionId?: number;
  reason?: string;
};

function getSeoulMonthRange(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);

  const year = Number(
    parts.find((part) => part.type === "year")?.value
  );

  const month = Number(
    parts.find((part) => part.type === "month")?.value
  );

  const monthText = String(month).padStart(2, "0");

  const nextYear =
    month === 12
      ? year + 1
      : year;

  const nextMonth =
    month === 12
      ? 1
      : month + 1;

  const nextMonthText =
    String(nextMonth).padStart(2, "0");

  const start = new Date(
    `${year}-${monthText}-01T00:00:00+09:00`
  );

  const end = new Date(
    `${nextYear}-${nextMonthText}-01T00:00:00+09:00`
  );

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    /*
     * ========================================
     * 로그인 확인
     * ========================================
     */
    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "로그인이 필요합니다.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * ========================================
     * 역할 확인
     * ========================================
     */
    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (
      profileError ||
      !profile
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "회원정보를 확인할 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      profile.role !== "parent" &&
      profile.role !== "student"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "학부모 또는 학생만 수업 연기를 신청할 수 있습니다.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * ========================================
     * 요청값
     * ========================================
     */
    const body =
      (await request.json()) as RequestBody;

    const sessionId =
      Number(body.sessionId);

    const reason =
      body.reason?.trim() || null;

    if (
      !Number.isInteger(sessionId) ||
      sessionId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "올바른 수업 정보가 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ========================================
     * 대상 수업
     * ========================================
     */
    const {
      data: session,
      error: sessionError,
    } =
      await supabase
        .from("class_sessions")
        .select(`
          id,
          enrollment_id,
          scheduled_start,
          scheduled_end,
          status
        `)
        .eq("id", sessionId)
        .maybeSingle();

    if (
      sessionError ||
      !session
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "수업정보를 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * 이미 시작되었거나
     * 종료/취소/연기된 수업은 신청 불가
     */
    if (
      session.status !== "scheduled"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "예정 상태인 수업만 연기 신청이 가능합니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ========================================
     * 수강정보 및 신청 권한
     * ========================================
     */
    const {
      data: enrollment,
      error: enrollmentError,
    } =
      await supabase
        .from("enrollments")
        .select(`
          id,
          child_id,
          student_user_id,
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
      return NextResponse.json(
        {
          success: false,
          error:
            "수강정보를 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    let hasAccess = false;

    /*
     * 학생 본인
     */
    if (
      profile.role === "student" &&
      enrollment.student_user_id ===
        user.id
    ) {
      hasAccess = true;
    }

    /*
     * 학부모가 자신의 자녀 수업 신청
     */
    if (
      profile.role === "parent" &&
      enrollment.child_id
    ) {
      const {
        data: child,
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

      hasAccess =
        Boolean(child);
    }

    if (!hasAccess) {
      return NextResponse.json(
        {
          success: false,
          error:
            "이 수업에 대해 연기 신청할 권한이 없습니다.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * ========================================
     * 이미 신청한 수업인지 확인
     * ========================================
     */
    const {
      data: existingHold,
      error: existingHoldError,
    } =
      await supabase
        .from("class_holds")
        .select(`
          id,
          status
        `)
        .eq(
          "class_session_id",
          sessionId
        )
        .in(
          "status",
          [
            "requested",
            "approved",
          ]
        )
        .limit(1)
        .maybeSingle();

    if (existingHoldError) {
      return NextResponse.json(
        {
          success: false,
          error:
            existingHoldError.message,
        },
        {
          status: 400,
        }
      );
    }

    if (existingHold) {
      return NextResponse.json(
        {
          success: false,
          error:
            "이미 수업 연기 신청이 처리된 수업입니다.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * ========================================
     * 2시간 전 규칙
     * ========================================
     */
    const now =
      new Date();

    const classStart =
      new Date(
        session.scheduled_start
      );

    const noticeMilliseconds =
      classStart.getTime() -
      now.getTime();

    const requiredMilliseconds =
      MIN_NOTICE_HOURS *
      60 *
      60 *
      1000;

    if (
      noticeMilliseconds <
      requiredMilliseconds
    ) {
      return NextResponse.json(
        {
          success: false,
          code:
            "TOO_LATE",
          error:
            "수업 연기 신청은 수업 시작 2시간 전까지만 가능합니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ========================================
     * 이번 달 수업 목록
     *
     * 신청자 기준이 아니라
     * 같은 enrollment 기준으로 계산합니다.
     *
     * 부모와 학생 중 누가 신청하든
     * 같은 학생의 월 2회 제한이 적용됩니다.
     * ========================================
     */
    const {
      start: monthStart,
      end: monthEnd,
    } =
      getSeoulMonthRange(now);

    const {
      data: monthSessions,
      error: monthSessionsError,
    } =
      await supabase
        .from("class_sessions")
        .select("id")
        .eq(
          "enrollment_id",
          enrollment.id
        )
        .gte(
          "scheduled_start",
          monthStart
        )
        .lt(
          "scheduled_start",
          monthEnd
        );

    if (monthSessionsError) {
      return NextResponse.json(
        {
          success: false,
          error:
            monthSessionsError.message,
        },
        {
          status: 400,
        }
      );
    }

    const monthSessionIds =
      (monthSessions ?? []).map(
        (item) => item.id
      );

    let monthlyApprovedCount = 0;

    if (
      monthSessionIds.length >
      0
    ) {
      const {
        count,
        error:
          monthlyHoldError,
      } =
        await supabase
          .from("class_holds")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "status",
            "approved"
          )
          .in(
            "class_session_id",
            monthSessionIds
          );

      if (monthlyHoldError) {
        return NextResponse.json(
          {
            success: false,
            error:
              monthlyHoldError.message,
          },
          {
            status: 400,
          }
        );
      }

      monthlyApprovedCount =
        count ?? 0;
    }

    /*
     * 월 최대 2회
     */
    if (
      monthlyApprovedCount >=
      MAX_MONTHLY_HOLDS
    ) {
      return NextResponse.json(
        {
          success: false,
          code:
            "MONTHLY_LIMIT",
          error:
            "수업 연기 신청은 한 달에 최대 2회까지 가능합니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ========================================
     * 자동 승인
     * ========================================
     */
    const processedAt =
      new Date().toISOString();

    const {
      data: insertedHold,
      error: insertError,
    } =
      await supabase
        .from("class_holds")
        .insert({
          class_session_id:
            session.id,

          requested_by:
            user.id,

          reason,

          requested_at:
            processedAt,

          /*
           * 관리자의 requested 단계 없이
           * 즉시 승인
           */
          status:
            "approved",

          reviewed_at:
            processedAt,

          admin_note:
            "시스템 자동승인: 월 2회 제한 및 수업 시작 2시간 전 신청 규칙 충족",
        })
        .select(`
          id,
          status,
          requested_at,
          reviewed_at
        `)
        .single();

    if (insertError) {
      return NextResponse.json(
        {
          success: false,
          error:
            insertError.message,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ========================================
     * 해당 수업을 연기 상태로 변경
     * ========================================
     */
    const {
      error: sessionUpdateError,
    } =
      await supabase
        .from(
          "class_sessions"
        )
        .update({
          status: "held",
        })
        .eq(
          "id",
          session.id
        );

    if (
      sessionUpdateError
    ) {
      /*
       * 수업 상태 변경에 실패하면
       * 방금 생성한 신청도 원상복구합니다.
       */
      await supabase
        .from("class_holds")
        .delete()
        .eq(
          "id",
          insertedHold.id
        );

      return NextResponse.json(
        {
          success: false,
          error:
            `수업 연기 상태 변경에 실패했습니다: ${sessionUpdateError.message}`,
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json({
      success: true,

      message:
        "수업 연기 신청이 자동 승인되었습니다.",

      hold:
        insertedHold,

      monthlyUsage:
        monthlyApprovedCount +
        1,

      monthlyLimit:
        MAX_MONTHLY_HOLDS,
    });
  } catch (error) {
    console.error(
      "CLASS HOLD AUTO APPROVAL ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof
          Error
            ? error.message
            : "수업 연기 신청 처리 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}