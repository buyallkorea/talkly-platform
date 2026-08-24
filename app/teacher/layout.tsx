import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/teacher"
    );
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
    profile.role !== "teacher"
  ) {
    redirect("/");
  }

  /*
   * 모든 /teacher 하위 페이지에서
   * 강사 활성 여부를 공통 검사합니다.
   */
  const adminClient =
    createAdminClient();

  const {
    data: teacherProfile,
    error: teacherProfileError,
  } =
    await adminClient
      .from("teacher_profiles")
      .select("is_active")
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

  if (
    teacherProfileError ||
    !teacherProfile
  ) {
    redirect(
      "/account/teacher-disabled?reason=profile"
    );
  }

  /*
   * 관리자가 강사를 비활성화하면
   * 수업/학생/평가 등 모든 teacher 페이지 차단
   */
  if (
    !teacherProfile.is_active
  ) {
    redirect(
      "/account/teacher-disabled"
    );
  }

  /*
   * 신규 초대 방식으로 생성된 강사만
   * 최초 계정설정 여부를 강제합니다.
   *
   * 기존 강사는 teacher_invited metadata가 없으므로
   * 현재 로그인 흐름을 그대로 유지합니다.
   */
  const teacherInvited =
    user.user_metadata
      ?.teacher_invited === true;

  const accountReady =
    user.user_metadata
      ?.teacher_account_ready === true;

  if (
    teacherInvited &&
    !accountReady
  ) {
    redirect(
      "/account/teacher-setup"
    );
  }

  return children;
}