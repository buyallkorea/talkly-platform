import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { currentKoreanMonth, validMonth, type ManualTimesheet } from "@/lib/timesheets/manual";
import ManualTimesheetForm from "@/components/timesheets/ManualTimesheetForm";

export const dynamic = "force-dynamic";
export default async function AdminTeacherTimesheetPage({ params, searchParams }: {
  params: Promise<{ teacherId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await client.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
  const { teacherId } = await params;
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(teacherId)) notFound();
  const desired = (await searchParams).month;
  const month = validMonth(desired) ? desired : currentKoreanMonth();
  const db = createAdminClient();
  const { data, error } = await db.from("teacher_manual_timesheets")
    .select("id,month,teacher_id,status,entries,roster_notes,teacher_note,time_zone,revision,updated_at,submitted_at")
    .eq("teacher_id",teacherId).eq("month",month).maybeSingle();
  if (error) throw Error("Unable to load teacher's manual timesheet.");
  if (!data) notFound();
  const [{ data: teacher }, { data: versions }] = await Promise.all([
    db.from("teacher_profiles").select("display_name").eq("user_id",teacherId).maybeSingle(),
    db.from("teacher_manual_timesheet_versions").select("revision,status,created_at").eq("timesheet_id",data.id).order("revision",{ascending:false}).limit(20),
  ]);
  return <div>
    <Link className="talkly-timesheet-back" href={"/admin/payroll?month="+month}>← 강사 보고서 목록</Link>
    <ManualTimesheetForm month={month} initial={data as ManualTimesheet} teacherName={teacher?.display_name || "Teacher"}
      readOnly={true} baseUrl={"/admin/payroll/"+teacherId}/>
    <section className="talkly-timesheet-panel talkly-timesheet-history">
      <h2>수정·제출 이력</h2>
      {(versions ?? []).length ? <ul>{(versions ?? []).map(v=><li key={v.revision}>버전 {v.revision} · {v.status === "submitted" ? "제출" : "임시저장"} · {new Date(v.created_at).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</li>)}</ul> : <p>저장 이력이 없습니다.</p>}
    </section>
  </div>;
}
