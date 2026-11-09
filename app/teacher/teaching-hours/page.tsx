import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { currentKoreanMonth, validMonth, type ManualTimesheet } from "@/lib/timesheets/manual";
import ManualTimesheetForm from "@/components/timesheets/ManualTimesheetForm";

export const dynamic = "force-dynamic";
export default async function TeacherTeachingHoursPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login?next=/teacher/teaching-hours");
  const { data: profile } = await client.from("profiles").select("role,name").eq("id", user.id).maybeSingle();
  if (profile?.role !== "teacher") redirect("/");
  const desired = (await searchParams).month;
  const month = validMonth(desired) ? desired : currentKoreanMonth();
  const admin = createAdminClient();
  const { data, error } = await admin.from("teacher_manual_timesheets")
    .select("month,teacher_id,status,entries,roster_notes,teacher_note,time_zone,revision,updated_at,submitted_at")
    .eq("teacher_id", user.id).eq("month", month).maybeSingle();
  if (error) throw Error("Unable to load the teaching hours form.");
  return <ManualTimesheetForm month={month} initial={data as ManualTimesheet | null}
    teacherName={profile.name || user.email || "Teacher"} readOnly={false} baseUrl="/teacher/teaching-hours" />;
}
