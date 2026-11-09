import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { blockMinutes, currentKoreanMonth, formatDuration, validMonth, type ClassBlock, type ManualTimesheet } from "@/lib/timesheets/manual";

export const dynamic = "force-dynamic";
export default async function AdminManualPayrollPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
  const desired = (await searchParams).month;
  const month = validMonth(desired) ? desired : currentKoreanMonth();
  const db = createAdminClient();
  const { data: rows, error } = await db.from("teacher_manual_timesheets")
    .select("teacher_id,month,status,entries,revision,updated_at,submitted_at").eq("month", month).order("updated_at", { ascending: false }).limit(300);
  if (error) throw Error("Unable to load teacher timesheets.");
  const ids = (rows ?? []).map(row => row.teacher_id);
  const names = ids.length ? await db.from("teacher_profiles").select("user_id,display_name").in("user_id", ids) : { data: [], error: null };
  if (names.error) throw Error("Unable to load teacher names.");
  const nameMap = new Map((names.data ?? []).map(item => [item.user_id, item.display_name ?? "Teacher"]));
  const entries = (rows ?? []) as Array<Pick<ManualTimesheet, "teacher_id"|"month"|"status"|"entries"|"revision"|"updated_at"|"submitted_at">>;
  return <div className="talkly-timesheet-page">
    <header className="talkly-timesheet-hero">
      <span className="talkly-timesheet-eyebrow">TALKLY · ADMIN</span>
      <h1>강사 수업시간 보고서</h1>
      <p>강사가 직접 작성한 수업시간표를 확인합니다. 실제 수업 일정·출결 및 급여 관리 시스템과 자동 연동되지 않습니다.</p>
    </header>
    <section className="talkly-timesheet-panel">
      <div className="talkly-timesheet-controls">
        <div><h2>월별 제출 현황</h2><p>제출 전 임시저장 기록도 구분하여 표시합니다.</p></div>
        <form action="/admin/payroll"><label htmlFor="payroll-month">조회 월</label><input id="payroll-month" name="month" type="month" defaultValue={month} min="2020-01" max="2099-12"/><button type="submit">조회</button></form>
      </div>
      <div className="talkly-timesheet-table-scroller">
        <table className="talkly-timesheet-summary-table"><thead><tr><th>강사</th><th>상태</th><th>수업 블록</th><th>총 기록시간</th><th>수정일</th><th>상세</th></tr></thead>
        <tbody>{entries.map(row => <tr key={row.teacher_id}>
          <td><strong>{nameMap.get(row.teacher_id) || "Teacher"}</strong></td>
          <td><span className={"talkly-timesheet-badge " + (row.status === "submitted" ? "is-submitted" : "is-draft")}>{row.status === "submitted" ? "제출 완료" : "임시저장"}</span></td>
          <td>{(row.entries as ClassBlock[]).length}개</td>
          <td><strong>{formatDuration(blockMinutes(row.entries as ClassBlock[]))}</strong></td>
          <td>{new Date(row.updated_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</td>
          <td><Link className="talkly-timesheet-link" href={"/admin/payroll/" + row.teacher_id + "?month=" + month}>보고서 보기 →</Link></td>
        </tr>)}
        {!entries.length && <tr><td colSpan={6} className="talkly-timesheet-no-data">이 달에 저장된 강사 보고서가 아직 없습니다.</td></tr>}
        </tbody></table>
      </div>
      {entries.length >= 300 && <p className="talkly-timesheet-alert">조회 결과가 300건에 도달했습니다. 관리자에게 기간 분리 검토를 요청하세요.</p>}
    </section>
    <p className="talkly-timesheet-disclaimer">표시된 시간은 강사 본인의 수기 보고입니다. 관리자 확인 전에는 확정 급여나 공식 출결 기록으로 사용하지 마세요.</p>
  </div>;
}
