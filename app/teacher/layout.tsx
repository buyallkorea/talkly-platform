import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import LogoutButton from "@/components/LogoutButton";
import TeacherSidebar from "./TeacherSidebar";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/teacher");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "teacher") {
    redirect("/");
  }

  // Active teacher guard
  const adminClient = createAdminClient();

  const { data: teacherProfile, error: teacherProfileError } =
    await adminClient
      .from("teacher_profiles")
      .select("is_active")
      .eq("user_id", user.id)
      .maybeSingle();

  if (teacherProfileError || !teacherProfile) {
    redirect("/account/teacher-disabled?reason=profile");
  }

  if (!teacherProfile.is_active) {
    redirect("/account/teacher-disabled");
  }

  // Teacher invitation account setup guard
  const teacherInvited =
    user.user_metadata?.teacher_invited === true;

  const accountReady =
    user.user_metadata?.teacher_account_ready === true;

  if (teacherInvited && !accountReady) {
    redirect("/account/teacher-setup");
  }

  return (
    <div className="talkly-teacher-shell">
      <TeacherSidebar />

      <div className="talkly-teacher-workspace">
        <header className="talkly-teacher-header">
          <div>
            <div className="talkly-teacher-header-eyebrow">
              TALKLY TEACHER PORTAL
            </div>
            <div className="talkly-teacher-header-user">
              {user.email || "Teacher"}
            </div>
          </div>

          <div className="talkly-teacher-header-actions">
            <LogoutButton label="Log Out" />
          </div>
        </header>

        <main className="talkly-teacher-content">
          {children}
        </main>
      </div>
    </div>
  );
}