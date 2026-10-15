import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function PATCH(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin !== new URL(request.url).origin) {
      return NextResponse.json(
        { error: "허용되지 않은 요청입니다." },
        { status: 403 }
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const teacherUserId = body?.teacherUserId;
    const showOnHomepage = body?.showOnHomepage;

    if (
      typeof teacherUserId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teacherUserId) ||
      typeof showOnHomepage !== "boolean"
    ) {
      return NextResponse.json(
        { error: "올바른 강사 정보와 노출 설정이 필요합니다." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data: teacher, error: teacherError } = await adminClient
      .from("teacher_profiles")
      .select("user_id, is_active")
      .eq("user_id", teacherUserId)
      .maybeSingle();

    if (teacherError) {
      throw teacherError;
    }

    if (!teacher) {
      return NextResponse.json(
        { error: "강사 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (showOnHomepage && !teacher.is_active) {
      return NextResponse.json(
        { error: "비활성 강사는 메인페이지에 노출할 수 없습니다." },
        { status: 400 }
      );
    }

    const { error: updateError } = await adminClient
      .from("teacher_profiles")
      .update({ show_on_homepage: showOnHomepage })
      .eq("user_id", teacherUserId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      teacherUserId,
      showOnHomepage,
    });
  } catch (error) {
    console.error("TEACHER HOMEPAGE VISIBILITY ERROR:", error);

    return NextResponse.json(
      { error: "메인페이지 노출 설정 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}