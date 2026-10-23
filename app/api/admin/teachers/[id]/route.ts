import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type HistoryCheck = {
  label: string;
  table: string;
  column: string;
};

const HISTORY_CHECKS: HistoryCheck[] = [
  { label: "강사 전달사항", table: "teacher_message_threads", column: "teacher_user_id" },
  {
    label: "수강 배정",
    table: "enrollments",
    column: "teacher_user_id",
  },
  {
    label: "수업",
    table: "class_sessions",
    column: "teacher_user_id",
  },
  {
    label: "원 담당 강사 수업",
    table: "class_sessions",
    column: "original_teacher_user_id",
  },
  {
    label: "강사 변경 처리",
    table: "class_sessions",
    column: "teacher_changed_by",
  },
  {
    label: "평가",
    table: "evaluations",
    column: "teacher_user_id",
  },
  {
    label: "강사 평가",
    table: "teacher_reviews",
    column: "teacher_user_id",
  },
  {
    label: "작성한 강사 평가",
    table: "teacher_reviews",
    column: "reviewer_user_id",
  },
  {
    label: "레벨테스트",
    table: "level_tests",
    column: "tester_user_id",
  },
  {
    label: "수강신청 선호 강사",
    table: "enrollment_requests",
    column: "preferred_teacher_user_id",
  },
  {
    label: "수업 보류 요청",
    table: "class_holds",
    column: "requested_by",
  },
  {
    label: "근무시간 예외 등록",
    table: "teacher_availability_exceptions",
    column: "created_by",
  },
];

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "강사 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { data: adminProfile, error: adminProfileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (
      adminProfileError ||
      !adminProfile ||
      adminProfile.role !== "admin"
    ) {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    if (user.id === id) {
      return NextResponse.json(
        {
          error:
            "현재 로그인한 관리자 계정은 강사 삭제 대상으로 처리할 수 없습니다.",
        },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const [profileResult, teacherProfileResult, authResult] =
      await Promise.all([
        adminClient
          .from("profiles")
          .select("id, role, name, profile_image_url")
          .eq("id", id)
          .maybeSingle(),

        adminClient
          .from("teacher_profiles")
          .select("user_id, display_name")
          .eq("user_id", id)
          .maybeSingle(),

        adminClient.auth.admin.getUserById(id),
      ]);

    if (profileResult.error) {
      return NextResponse.json(
        {
          error:
            `강사 기본정보 확인 실패: ${profileResult.error.message}`,
        },
        { status: 500 }
      );
    }

    if (
      !profileResult.data ||
      profileResult.data.role !== "teacher"
    ) {
      return NextResponse.json(
        { error: "올바른 강사 계정이 아닙니다." },
        { status: 400 }
      );
    }

    if (
      teacherProfileResult.error ||
      !teacherProfileResult.data
    ) {
      return NextResponse.json(
        { error: "강사 프로필을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    /*
     * 운영 이력이 하나라도 있으면 완전 삭제하지 않습니다.
     *
     * 수강/수업/평가뿐 아니라
     * 강사 변경 처리 및 다른 강사의 근무시간 예외를
     * 등록한 기록도 운영 이력으로 간주합니다.
     *
     * 운영 이력 보존이 완전 삭제보다 우선입니다.
     */
    const historyResults = await Promise.all(
      HISTORY_CHECKS.map(async (check) => {
        const { count, error } = await adminClient
          .from(check.table)
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq(check.column, id);

        return {
          ...check,
          count: count ?? 0,
          error,
        };
      })
    );

    const historyQueryError = historyResults.find(
      (item) => item.error
    );

    if (historyQueryError?.error) {
      return NextResponse.json(
        {
          error:
            `강사 삭제 가능 여부 확인 실패 (${historyQueryError.label}): ` +
            historyQueryError.error.message,
        },
        { status: 500 }
      );
    }

    const blockingHistory = historyResults.filter(
      (item) => item.count > 0
    );

    if (blockingHistory.length > 0) {
      return NextResponse.json(
        {
          error:
            "이 강사는 수업 또는 운영 이력이 있어 완전 삭제할 수 없습니다. " +
            "강사정보 수정에서 '활성 강사'를 해제하여 비활성화해 주세요.",
          code: "TEACHER_HAS_HISTORY",
          history: blockingHistory.map((item) => ({
            label: item.label,
            count: item.count,
          })),
        },
        { status: 409 }
      );
    }

    /*
     * 여기까지 왔다면 보존해야 할 운영 이력이 없는 강사입니다.
     *
     * 해당 강사 자신의 근무시간 예외 및 일반 근무시간은
     * 계정에 종속된 설정 데이터이므로 완전 삭제합니다.
     *
     * teacher_availability_exceptions.created_by에 이 강사가
     * 남아 있는 경우는 위 HISTORY_CHECKS에서 이미 차단됩니다.
     */
    const { error: availabilityExceptionError } =
      await adminClient
        .from("teacher_availability_exceptions")
        .delete()
        .eq("teacher_user_id", id);

    if (availabilityExceptionError) {
      return NextResponse.json(
        {
          error:
            `강사 예외 근무시간 삭제 실패: ${availabilityExceptionError.message}`,
        },
        { status: 500 }
      );
    }

    const { error: availabilityError } =
      await adminClient
        .from("teacher_availability")
        .delete()
        .eq("teacher_user_id", id);

    if (availabilityError) {
      return NextResponse.json(
        {
          error:
            `강사 근무시간 삭제 실패: ${availabilityError.message}`,
        },
        { status: 500 }
      );
    }

    /*
     * 프로필 이미지 정리.
     *
     * 현재 EditTeacherForm의 저장 경로:
     * teacher-profile-images/{teacherId}/profile-image
     *
     * 이미지가 없더라도 강사 삭제 자체를 막지는 않습니다.
     */
    const { error: imageDeleteError } =
      await adminClient.storage
        .from("teacher-profile-images")
        .remove([`${id}/profile-image`]);

    if (imageDeleteError) {
      console.warn(
        "DELETE TEACHER PROFILE IMAGE WARNING:",
        imageDeleteError.message
      );
    }

    /*
     * DB 삭제 순서:
     *
     * teacher_profiles
     * → profiles
     * → auth.users
     *
     * Auth 계정은 가장 마지막에 삭제합니다.
     */
    const { error: teacherDeleteError } =
      await adminClient
        .from("teacher_profiles")
        .delete()
        .eq("user_id", id);

    if (teacherDeleteError) {
      return NextResponse.json(
        {
          error:
            `강사 프로필 삭제 실패: ${teacherDeleteError.message}`,
        },
        { status: 500 }
      );
    }

    const { error: profileDeleteError } =
      await adminClient
        .from("profiles")
        .delete()
        .eq("id", id);

    if (profileDeleteError) {
      return NextResponse.json(
        {
          error:
            `강사 기본정보 삭제 실패: ${profileDeleteError.message}`,
        },
        { status: 500 }
      );
    }

    if (!authResult.error && authResult.data.user) {
      const { error: authDeleteError } =
        await adminClient.auth.admin.deleteUser(id);

      if (authDeleteError) {
        return NextResponse.json(
          {
            error:
              "강사 DB 정보는 삭제되었지만 Auth 계정 삭제에 실패했습니다. " +
              authDeleteError.message,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message:
        "강사 계정과 관련 등록정보를 삭제했습니다.",
    });
  } catch (error) {
    console.error("DELETE TEACHER ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "강사 삭제 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}


export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "강사 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { data: adminProfile, error: adminError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (
      adminError ||
      !adminProfile ||
      adminProfile.role !== "admin"
    ) {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { error: "올바른 이메일 주소를 입력해주세요." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data: profile, error: profileError } =
      await adminClient
        .from("profiles")
        .select("id, role")
        .eq("id", id)
        .maybeSingle();

    if (profileError || !profile || profile.role !== "teacher") {
      return NextResponse.json(
        { error: "올바른 강사 계정이 아닙니다." },
        { status: 404 }
      );
    }

    const { data: authData, error: authError } =
      await adminClient.auth.admin.getUserById(id);

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "강사 로그인 계정을 확인할 수 없습니다." },
        { status: 404 }
      );
    }

    const previousEmail =
      authData.user.email?.toLowerCase() || "";

    if (previousEmail === email) {
      return NextResponse.json({
        success: true,
        email,
        message: "이메일 주소에 변경사항이 없습니다.",
      });
    }

    const { error: updateAuthError } =
      await adminClient.auth.admin.updateUserById(
        id,
        {
          email,
          email_confirm: true,
        }
      );

    if (updateAuthError) {
      return NextResponse.json(
        {
          error:
            `로그인 이메일 변경 실패: ${updateAuthError.message}`,
        },
        { status: 400 }
      );
    }

    // Auth is the single source of truth for login email. There is no
    // profiles.email column to mirror or roll back after this successful update.

    return NextResponse.json({
      success: true,
      email,
      message: "강사 로그인 이메일이 변경되었습니다.",
    });
  } catch (error) {
    console.error("UPDATE TEACHER EMAIL ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "이메일 변경 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
