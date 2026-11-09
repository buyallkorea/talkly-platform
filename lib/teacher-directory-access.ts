import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

/**
 * Teacher directory/profile content is available only to signed-in TALKLY
 * members with a registered role, never to anonymous visitors or bots.
 * Keep this check BEFORE reading teacher details with the service role.
 */
export async function requireTeacherDirectoryMember(nextPath: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/signup?next=" + encodeURIComponent(nextPath));
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError) throw Error("Unable to verify account access.");
  if (!profile || !["parent", "student", "teacher", "admin"].includes(profile.role)) {
    redirect("/login?next=" + encodeURIComponent(nextPath));
  }
}
