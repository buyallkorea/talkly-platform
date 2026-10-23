import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00+09:00`);
  return Number.isFinite(date.getTime()) && new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date) === value;
}

export default async function AdminEvaluationsPage({ searchParams }: { searchParams: Promise<{ date?: string; page?: string }> }) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: viewer } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (viewer?.role !== "admin") redirect("/");
  const params = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const date = validDate(params.date) ? params.date : today;
  const parsedPage = Number(params.page);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10000) : 1;
  const start = new Date(`${date}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 86400000);
  const { data: sessions, error } = await db.from("class_sessions")
    .select("id,enrollment_id,lesson_number,scheduled_start,teacher_user_id,enrollments!inner(id,is_test,child_id,student_user_id,teacher_user_id)")
    .eq("is_test", false).eq("enrollments.is_test", false).eq("status", "completed")
    .gte("scheduled_start", start.toISOString()).lt("scheduled_start", end.toISOString())
    .order("scheduled_start", { ascending: false }).order("id", { ascending: false }).range((page - 1) * 50, page * 50);
  if (error) throw new Error("평가 대상 수업을 불러오지 못했습니다.");
  const visible = (sessions ?? []).slice(0, 50);
  const records = visible.map(s => ({ ...s, enrollment: Array.isArray(s.enrollments) ? s.enrollments[0] : s.enrollments }));
  const sessionIds = records.map(s => s.id);
  const childIds = [...new Set(records.flatMap(s => s.enrollment?.child_id ? [s.enrollment.child_id] : []))];
  const studentIds = [...new Set(records.flatMap(s => s.enrollment?.student_user_id ? [s.enrollment.student_user_id] : []))];
  const teacherIds = [...new Set(records.flatMap(s => s.teacher_user_id || s.enrollment?.teacher_user_id ? [s.teacher_user_id || s.enrollment!.teacher_user_id] : []))];
  const [evaluations, children, students, teachers] = await Promise.all([
    sessionIds.length ? db.from("evaluations").select("id,class_session_id,evaluation_type,period_number,participation_score,comprehension_score,speaking_score,pronunciation_score,strengths,improvements,homework,teacher_comment").in("class_session_id", sessionIds) : { data: [], error: null },
    childIds.length ? db.from("children").select("id,name").in("id", childIds) : { data: [], error: null },
    studentIds.length ? db.from("profiles").select("id,name").in("id", studentIds) : { data: [], error: null },
    teacherIds.length ? db.from("teacher_profiles").select("user_id,display_name").in("user_id", teacherIds) : { data: [], error: null },
  ]);
  if ([evaluations, children, students, teachers].some(result => result.error)) throw new Error("평가 정보를 불러오지 못했습니다.");
  return <section style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 0" }}>
    <p className="text-xs font-bold tracking-widest text-blue-600">TALKLY · LEARNING EVALUATIONS</p>
    <h1 className="mt-2 text-3xl font-bold text-slate-900">학습 평가</h1>
    <p className="mt-3 text-sm leading-7 text-slate-600">선택한 날짜의 완료된 수업과 등록된 평가를 확인합니다. 월간·최종 평가 작성 시점은 각 강사 상세 화면에서 확인할 수 있습니다.</p>
    <form className="my-6 flex flex-wrap items-end gap-3"><label className="grid gap-2 text-sm font-semibold">수업 날짜 (한국 시간)<input type="date" name="date" defaultValue={date} required className="rounded-lg border border-slate-300 bg-white px-3 py-2" /></label><button className="rounded-lg bg-blue-600 px-5 py-2 text-white">조회</button><Link href="/admin/teachers" className="px-3 py-2 text-sm text-blue-700">강사별 평가 작성 현황 →</Link></form>
    {!records.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">해당 날짜에 완료된 수업이 없습니다.</div>}
    <div className="grid gap-4">{records.map(session => {
      const enrollment = session.enrollment;
      const student = enrollment?.child_id ? children.data?.find(c => c.id === enrollment.child_id)?.name : students.data?.find(s => s.id === enrollment?.student_user_id)?.name;
      const teacherId = session.teacher_user_id || enrollment?.teacher_user_id;
      const teacher = teachers.data?.find(t => t.user_id === teacherId);
      const items = (evaluations.data ?? []).filter(e => e.class_session_id === session.id);
      return <article key={session.id} className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap justify-between gap-3"><h2 className="font-bold text-slate-900">{student || "학생"} · {session.lesson_number}회차</h2><Link className="text-sm font-semibold text-blue-700" href={`/admin/enrollments/${session.enrollment_id}/lessons/${session.id}`}>수업 상세 →</Link></div>
        <p className="mt-2 text-sm text-slate-500">{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }).format(new Date(session.scheduled_start))} · {teacher?.display_name || "담당 강사 미지정"}{teacherId && <> · <Link href={`/admin/teachers/${teacherId}`} className="text-blue-700">강사 상세</Link></>}</p>
        {!items.length && <p className="mt-4 text-sm text-slate-500">등록된 평가가 없습니다. 정기 평가 대상 여부는 강사 상세에서 확인해 주세요.</p>}
        {items.map(item => <div key={item.id} className="mt-4 rounded-xl bg-slate-50 p-4">
          <h3 className="font-semibold">{item.evaluation_type === "final" ? "최종 평가" : item.evaluation_type === "monthly" ? `월간 평가${item.period_number ? ` · ${item.period_number}차` : ""}` : "수업 평가"}</h3>
          <p className="mt-2 text-sm text-slate-600">참여 {item.participation_score ?? "-"} · 이해 {item.comprehension_score ?? "-"} · 말하기 {item.speaking_score ?? "-"} · 발음 {item.pronunciation_score ?? "-"}</p>
          {[["강점", item.strengths], ["개선점", item.improvements], ["과제", item.homework], ["강사 의견", item.teacher_comment]].map(([label, text]) => text ? <div key={label} className="mt-3"><strong className="text-sm">{label}</strong><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{text}</p></div> : null)}
        </div>)}
      </article>;
    })}</div>
    <nav aria-label="평가 목록 페이지" className="mt-6 flex items-center gap-4">{page > 1 && <Link href={`/admin/evaluations?date=${date}&page=${page - 1}`} className="text-blue-700">← 이전</Link>}<span className="text-sm text-slate-500">{page}페이지</span>{(sessions?.length ?? 0) > 50 && <Link href={`/admin/evaluations?date=${date}&page=${page + 1}`} className="text-blue-700">다음 →</Link>}</nav>
  </section>;
}
