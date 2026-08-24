import {
  NextResponse,
} from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function normalizeSiteUrl(
  value: string | undefined,
  fallback: string
) {
  return (
    value?.trim() ||
    fallback
  ).replace(
    /\/+$/,
    ""
  );
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const {
      id,
    } =
      await context.params;

    if (!id) {
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

    /*
     * =====================================================
     * 1. 현재 관리자 확인
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
            "로그인이 필요합니다.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: adminProfile,
      error:
        adminProfileError,
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
      adminProfileError ||
      !adminProfile ||
      adminProfile.role !==
        "admin"
    ) {
      return NextResponse.json(
        {
          error:
            "관리자 권한이 필요합니다.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =====================================================
     * 2. 대상 강사 확인
     * =====================================================
     */
    const adminClient =
      createAdminClient();

    const [
      authResult,
      profileResult,
      teacherProfileResult,
    ] =
      await Promise.all([
        adminClient.auth.admin
          .getUserById(id),

        adminClient
          .from("profiles")
          .select(`
            id,
            role,
            name
          `)
          .eq(
            "id",
            id
          )
          .maybeSingle(),

        adminClient
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
            id
          )
          .maybeSingle(),
      ]);

    if (
      authResult.error ||
      !authResult.data.user
    ) {
      return NextResponse.json(
        {
          error:
            "강사 Auth 계정을 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      profileResult.error ||
      !profileResult.data ||
      profileResult.data.role !==
        "teacher"
    ) {
      return NextResponse.json(
        {
          error:
            "올바른 강사 계정이 아닙니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      teacherProfileResult.error ||
      !teacherProfileResult.data
    ) {
      return NextResponse.json(
        {
          error:
            "강사 프로필을 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      !teacherProfileResult.data
        .is_active
    ) {
      return NextResponse.json(
        {
          error:
            "비활성 강사에게는 등록메일을 재발송할 수 없습니다.",
        },
        {
          status: 409,
        }
      );
    }

    const authUser =
      authResult.data.user;

    const teacherInvited =
      authUser.user_metadata
        ?.teacher_invited ===
      true;

    const accountReady =
      authUser.user_metadata
        ?.teacher_account_ready ===
      true;

    /*
     * 신규 등록방식 계정이며
     * 아직 계정 설정 전인 경우만 재발송 가능
     */
    if (
      !teacherInvited ||
      accountReady
    ) {
      return NextResponse.json(
        {
          error:
            "이미 계정 설정이 완료되었거나 등록메일 재발송 대상이 아닙니다.",
        },
        {
          status: 409,
        }
      );
    }

    const email =
      authUser.email;

    if (!email) {
      return NextResponse.json(
        {
          error:
            "등록된 강사 이메일을 확인할 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * 3. 계정설정 메일 재발송
     *
     * 이미 존재하는 Auth 사용자를 삭제/재생성하지 않고
     * 비밀번호 설정 메일을 다시 발송합니다.
     *
     * user id를 유지하기 때문에
     * 수업, 평가, enrollment 연결을 훼손하지 않습니다.
     * =====================================================
     */
    const requestOrigin =
      new URL(
        request.url
      ).origin;

    const siteUrl =
      normalizeSiteUrl(
        process.env
          .NEXT_PUBLIC_SITE_URL,
        requestOrigin
      );

    const nextPath =
      "/account/teacher-setup";

    const redirectTo =
      `${siteUrl}/auth/callback?next=${encodeURIComponent(
        nextPath
      )}`;

    const {
      error:
        resendError,
    } =
      await supabase.auth
        .resetPasswordForEmail(
          email,
          {
            redirectTo,
          }
        );

    if (
      resendError
    ) {
      return NextResponse.json(
        {
          error:
            `등록메일 재발송 실패: ${resendError.message}`,
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json({
      success: true,

      email,

      message:
        "강사 계정 설정 안내메일을 다시 발송했습니다.",
    });
  } catch (error) {
    console.error(
      "RESEND TEACHER REGISTRATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "등록메일 재발송 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}