import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function messageActor() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["admin", "teacher"].includes(profile.role)) return null;
  if (profile.role === "teacher") {
    const { data: teacher } = await createAdminClient().from("teacher_profiles").select("is_active").eq("user_id", user.id).maybeSingle();
    if (!teacher?.is_active) return null;
  }
  return { db, userId: user.id, role: profile.role as "admin" | "teacher" };
}
export function validMessage(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 5000;
}
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
