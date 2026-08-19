import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    // 현재 로그인 사용자 확인
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "로그인이 필요합니다.",
        },
        {
          status: 401,
        }
      );
    }

    // 관리자 여부 확인
    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin"
    ) {
      return NextResponse.json(
        {
          error: "관리자 권한이 필요합니다.",
        },
        {
          status: 403,
        }
      );
    }

    const body = await request.json();

    const {
      email,
      password,
      name,
      phone,
      displayName,
      nationality,
      bio,
      specialties,
      yearsExperience,
      education,
      certifications,
      hourlyRate,
    } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        {
          error:
            "이메일, 비밀번호, 강사 이름은 필수입니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error:
            "비밀번호는 8자 이상이어야 합니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (!nationality) {
      return NextResponse.json(
        {
          error: "강사 국적은 필수입니다.",
        },
        {
          status: 400,
        }
      );
    }

    const adminClient = createAdminClient();

    // 1. Auth 강사 계정 생성
    const {
      data: authData,
      error: authError,
    } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: {
        name: name.trim(),
        role: "teacher",
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error:
            authError?.message ||
            "강사 계정 생성에 실패했습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const teacherUserId = authData.user.id;

    // 2. profiles 생성/보정
    const { error: commonProfileError } =
      await adminClient
        .from("profiles")
        .upsert(
          {
            id: teacherUserId,
            role: "teacher",
            name: name.trim(),
            phone: phone?.trim() || null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "id",
          }
        );

    if (commonProfileError) {
      await adminClient.auth.admin.deleteUser(
        teacherUserId
      );

      return NextResponse.json(
        {
          error: `공통 프로필 생성 실패: ${commonProfileError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    // 3. teacher_profiles 생성
    const { error: teacherProfileError } =
      await adminClient
        .from("teacher_profiles")
        .insert({
          user_id: teacherUserId,

          display_name:
            displayName?.trim() ||
            name.trim(),

          nationality:
            nationality.trim(),

          bio:
            bio?.trim() || null,

          specialties:
            Array.isArray(specialties)
              ? specialties
              : [],

          years_experience:
            yearsExperience !== "" &&
            yearsExperience != null
              ? Number(yearsExperience)
              : null,

          education:
            education?.trim() || null,

          certifications:
            certifications?.trim() || null,

          hourly_rate:
            hourlyRate !== "" &&
            hourlyRate != null
              ? Number(hourlyRate)
              : null,

          is_active: true,
        });

    if (teacherProfileError) {
      // 중간 실패 시 생성 데이터 롤백
      await adminClient
        .from("profiles")
        .delete()
        .eq("id", teacherUserId);

      await adminClient.auth.admin.deleteUser(
        teacherUserId
      );

      return NextResponse.json(
        {
          error: `강사 프로필 생성 실패: ${teacherProfileError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        userId: teacherUserId,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "CREATE TEACHER ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "강사 등록 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}