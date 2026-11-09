import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";

export type PublicTeacherCard = {
  user_id: string;
  display_name: string;
  nationality: string | null;
  profile_image_url: string | null;
};
export type PublicTeacherProfile = PublicTeacherCard & {
  bio: string | null;
  specialties: string[];
  years_experience: number | null;
  education: string | null;
  certifications: string | null;
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Use the same visibility rule and public card fields as the homepage. */
export const listPublicTeachers = cache(async (): Promise<PublicTeacherCard[]> => {
  // The existing public-card RPC grants EXECUTE to authenticated users,
  // but intentionally not to service_role. Use the server user's session.
  // /teachers checks live member identity/role before calling this function.
  const db = await createClient();
  const { data, error } = await db.rpc("get_public_teachers");
  if (error) throw Error("Unable to load the public teacher list.");
  return ((data ?? []) as Array<{
    user_id: string; display_name: string | null; nationality: string | null; profile_image_url: string | null;
  }>).map(row => ({
    user_id: row.user_id,
    display_name: row.display_name?.trim() || "TALKLY Teacher",
    nationality: row.nationality?.trim() || null,
    profile_image_url: row.profile_image_url || null,
  }));
});

/** Public profile only: require BOTH display flags in the server query.
 * Never select internal contact, account, compensation or student data.
 */
export const getPublicTeacherProfile = cache(async (id: string): Promise<PublicTeacherProfile | null> => {
  if (!UUID_PATTERN.test(id)) return null;
  const db = createAdminClient();
  const { data: teacher, error } = await db.from("teacher_profiles")
    .select("user_id,display_name,nationality,bio,specialties,years_experience,education,certifications")
    .eq("user_id", id)
    .eq("is_active", true)
    .eq("show_on_homepage", true)
    .maybeSingle();
  if (error) throw Error("Unable to load the teacher profile.");
  if (!teacher) return null;

  const { data: identity, error: identityError } = await db.from("profiles")
    .select("name,profile_image_url")
    .eq("id", id).maybeSingle();
  if (identityError) throw Error("Unable to load the teacher's public photo.");

  return {
    user_id: teacher.user_id,
    display_name: teacher.display_name?.trim() || identity?.name?.trim() || "TALKLY Teacher",
    nationality: teacher.nationality?.trim() || null,
    profile_image_url: identity?.profile_image_url || null,
    bio: teacher.bio?.trim() || null,
    specialties: (teacher.specialties ?? []).map((value: string) => value.trim()).filter(Boolean),
    years_experience: typeof teacher.years_experience === "number" && teacher.years_experience > 0 ? teacher.years_experience : null,
    education: teacher.education?.trim() || null,
    certifications: teacher.certifications?.trim() || null,
  };
});
