import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

function normalizeText(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeOptionalNumber(
  value: unknown
) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const numberValue =
    Number(value);

  return Number.isFinite(
    numberValue
  )
    ? numberValue
    : null;
}

export async function POST(
  request: Request
) {
  let teacherUserId:
    | string
    | null = null;

  try {
    /*
     * =====================================================
     * 1. 현재 로그인 사용자 확인
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

    /*
     * =====================================================
     * 2. 관리자 권한 확인
     * =====================================================
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
      !profile ||
      profile.role !==
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
     * 3. 요청 데이터
     * =====================================================
     */
    const body =
      await request.json();

    const email =
      normalizeText(
        body.email
      ).toLowerCase();

    const name =
      normalizeText(
        body.name
      );

    const phone =
      normalizeText(
        body.phone
      );

    const displayName =
      normalizeText(
        body.displayName
      );

    const nationality =
      normalizeText(
        body.nationality
      );

    const bio =
      normalizeText(
        body.bio
      );

    const education =
      normalizeText(
        body.education
      );

    const certifications =
      normalizeText(
        body.certifications
      );

    const specialties:
      string[] =
      Array.isArray(
        body.specialties
      )
        ? (
            body.specialties as unknown[]
          )
            .filter(
              (
                value
              ): value is string =>
                typeof value ===
                "string"
            )
            .map(
              (
                value: string
              ) =>
                value.trim()
            )
            .filter(
              (
                value: string
              ) =>
                value.length >
                0
            )
        : [];

    const yearsExperience =
      normalizeOptionalNumber(
        body.yearsExperience
      );

    const hourlyRate =
      normalizeOptionalNumber(
        body.hourlyRate
      );

    /*
     * =====================================================
     * 4. 입력 검증
     * =====================================================
     */
    if (
      !email ||
      !name
    ) {
      return NextResponse.json(
        {
          error:
            "이메일과 강사 이름은 필수입니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (!nationality) {
      return NextResponse.json(
        {
          error:
            "강사 국적은 필수입니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      yearsExperience !==
        null &&
      yearsExperience < 0
    ) {
      return NextResponse.json(
        {
          error:
            "강사 경력을 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      hourlyRate !==
        null &&
      hourlyRate < 0
    ) {
      return NextResponse.json(
        {
          error:
            "시간당 수업료를 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * 5. Admin Client
     * =====================================================
     */
    const adminClient =
      createAdminClient();

    /*
     * =====================================================
     * 6. 강사 계정 설정 복귀 URL
     * =====================================================
     */
    const configuredSiteUrl =
      normalizeText(
        process.env
          .NEXT_PUBLIC_SITE_URL
      );

    const requestOrigin =
      new URL(
        request.url
      ).origin;

    const siteUrl =
      (
        configuredSiteUrl ||
        requestOrigin
      ).replace(
        /\/+$/,
        ""
      );

    const nextPath =
      "/account/teacher-setup";

    const redirectTo =
      `${siteUrl}/auth/callback?next=${encodeURIComponent(
        nextPath
      )}`;

    /*
     * =====================================================
     * 7. Auth 강사 계정 생성 + 등록메일 발송
     *
     * 관리자 화면에서는 "강사등록"으로 표현하지만
     * 내부적으로는 Supabase invitation 방식을 사용합니다.
     * =====================================================
     */
    const {
      data: inviteData,
      error: inviteError,
    } =
      await adminClient.auth.admin
        .inviteUserByEmail(
          email,
          {
            redirectTo,

            data: {
              name,

              role:
                "teacher",

              teacher_invited:
                true,

              teacher_account_ready:
                false,
            },
          }
        );

    if (
      inviteError ||
      !inviteData.user
    ) {
      return NextResponse.json(
        {
          error:
            inviteError?.message ||
            "강사 계정 생성 또는 등록메일 발송에 실패했습니다.",
        },
        {
          status: 400,
        }
      );
    }

    teacherUserId =
      inviteData.user.id;

    /*
     * =====================================================
     * 8. profiles 생성
     * =====================================================
     */
    const {
      error:
        commonProfileError,
    } =
      await adminClient
        .from("profiles")
        .upsert(
          {
            id:
              teacherUserId,

            role:
              "teacher",

            name,

            phone:
              phone ||
              null,

            updated_at:
              new Date()
                .toISOString(),
          },
          {
            onConflict:
              "id",
          }
        );

    if (
      commonProfileError
    ) {
      await adminClient.auth.admin
        .deleteUser(
          teacherUserId
        );

      teacherUserId =
        null;

      return NextResponse.json(
        {
          error:
            `공통 프로필 생성 실패: ${commonProfileError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * =====================================================
     * 9. teacher_profiles 생성
     * =====================================================
     */
    const {
      error:
        teacherProfileError,
    } =
      await adminClient
        .from(
          "teacher_profiles"
        )
        .insert({
          user_id:
            teacherUserId,

          display_name:
            displayName ||
            name,

          nationality,

          bio:
            bio ||
            null,

          specialties,

          years_experience:
            yearsExperience,

          education:
            education ||
            null,

          certifications:
            certifications ||
            null,

          hourly_rate:
            hourlyRate,

          /*
           * 관리자에게 등록된 강사는
           * 기본적으로 활성 대상입니다.
           *
           * 실제 강사페이지 접근은
           * teacher_account_ready 여부까지
           * app/teacher/layout.tsx가 검사합니다.
           */
          is_active:
            true,
        });

    if (
      teacherProfileError
    ) {
      await adminClient
        .from("profiles")
        .delete()
        .eq(
          "id",
          teacherUserId
        );

      await adminClient.auth.admin
        .deleteUser(
          teacherUserId
        );

      teacherUserId =
        null;

      return NextResponse.json(
        {
          error:
            `강사 프로필 생성 실패: ${teacherProfileError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * =====================================================
     * 10. 완료
     * =====================================================
     */
    return NextResponse.json(
      {
        success: true,

        userId:
          teacherUserId,

        registeredEmail:
          email,

        message:
          "강사등록이 완료되었습니다. 등록된 이메일로 계정 설정 안내메일을 발송했습니다.",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "CREATE TEACHER REGISTRATION ERROR:",
      error
    );

    /*
     * 중간 오류가 발생하면
     * 불완전 계정이 남지 않도록 정리합니다.
     */
    if (teacherUserId) {
      try {
        const adminClient =
          createAdminClient();

        await adminClient
          .from(
            "teacher_profiles"
          )
          .delete()
          .eq(
            "user_id",
            teacherUserId
          );

        await adminClient
          .from("profiles")
          .delete()
          .eq(
            "id",
            teacherUserId
          );

        await adminClient.auth.admin
          .deleteUser(
            teacherUserId
          );
      } catch (
        rollbackError
      ) {
        console.error(
          "CREATE TEACHER REGISTRATION ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "강사등록 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}