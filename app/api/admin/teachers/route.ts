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

    /*
     * TypeScript strict mode 대응:
     * body.specialties는 런타임 입력값이므로
     * unknown[]으로 명확하게 변환한 뒤
     * string만 남깁니다.
     */
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
     * 4. 기본 검증
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
     * 5. 관리자 Auth Client
     * =====================================================
     */
    const adminClient =
      createAdminClient();

    /*
     * =====================================================
     * 6. 강사 초대 URL
     *
     * 관리자가 강사 비밀번호를 만들지 않습니다.
     * 강사가 이메일 초대 링크를 통해
     * 직접 비밀번호를 설정합니다.
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
     * 7. Supabase Auth 강사 초대
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

              /*
               * 신규 초대 방식 강사 식별
               */
              teacher_invited:
                true,

              /*
               * 아직 본인 계정설정 전
               */
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
            "강사 초대 이메일 발송에 실패했습니다.",
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
     * 8. profiles 생성 / 보정
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
      /*
       * profiles 생성 실패 시
       * Auth 계정 롤백
       */
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
           * 관리자 등록 시 기본 활성.
           *
           * 다만 새 초대 강사는
           * teacher_account_ready=false이므로
           * 최초 비밀번호 설정 전까지
           * /teacher 접근이 제한됩니다.
           */
          is_active:
            true,
        });

    if (
      teacherProfileError
    ) {
      /*
       * 중간 실패 시 생성 데이터 롤백
       */
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

        invitedEmail:
          email,

        message:
          "강사 계정이 생성되었고 초대 이메일이 발송되었습니다. 강사가 이메일 링크를 열어 직접 비밀번호를 설정하면 TALKLY Teacher 페이지를 사용할 수 있습니다.",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "INVITE TEACHER ERROR:",
      error
    );

    /*
     * 예외가 발생한 경우
     * Auth 계정만 남는 orphan 상태를
     * 최대한 방지합니다.
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
          "INVITE TEACHER ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "강사 초대 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}