import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import LogoutButton from "@/components/LogoutButton";
import AdminSidebar from "./AdminSidebar";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default async function AdminLayout({
  children,
}: AdminLayoutProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  return (
    <div className="talkly-admin-shell">
      <AdminSidebar />

      <div className="talkly-admin-workspace">
        <header className="talkly-admin-header">
          <div>
            <div className="talkly-admin-header-eyebrow">
              TALKLY ADMINISTRATION
            </div>

            <div className="talkly-admin-header-user">
              {profile.name || "관리자"}
            </div>

            <div className="talkly-admin-header-role">
              총괄 관리자
            </div>
          </div>

          <div className="talkly-admin-header-actions">
            <a
              href="/"
              className="talkly-admin-site-link"
              target="_blank"
              rel="noreferrer"
            >
              사이트 보기 ↗
            </a>

            <LogoutButton />
          </div>
        </header>

        <main className="talkly-admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}