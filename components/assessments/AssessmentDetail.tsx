import Link from "next/link";
import { assessmentContext, assessmentSource, progressPeriod, AssessmentError } from "@/lib/assessments/server";
import { validProgressPeriod, validateAssessment, type AssessmentKind, type AssessmentStatus, type Values } from "@/lib/assessments/schema";
import AssessmentEditor from "./AssessmentEditor";
type Props = { params: Promise<{kind: string; sourceId: string}>; searchParams: Promise<{period?: string}>; administrator?: boolean };
async function loadDetail({params, searchParams, administrator=false}: Props) {
    const ctx = await assessmentContext();
    if ((ctx.role === "admin") !== administrator) throw new AssessmentError("Open the assessment from your own dashboard. / 권한에 맞는 메뉴를 이용해 주세요.", 403);
    const { kind: rawKind, sourceId: rawId } = await params;
    if (!["initial", "monthly"].includes(rawKind) || !/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(Number(rawId))) throw new AssessmentError("Invalid assessment target.", 404);
    const kind = rawKind as AssessmentKind, sourceId = Number(rawId);
    const period = kind === "initial" ? "initial" : (await searchParams).period;
    if (typeof period !== "string" || (kind === "monthly" && !validProgressPeriod(period))) throw new AssessmentError("Select a due four-week or final review from the assessment list.");
    const source = await assessmentSource(ctx, kind, sourceId);
    const { data: record, error } = await ctx.db.from("teacher_assessments").select("id,values,status,revision,updated_at").eq("kind", kind).eq("source_id", sourceId).eq("period_key", period).maybeSingle();
    if (error) throw new AssessmentError("Assessment storage is not ready. Please contact the administrator. / 평가서 저장소 준비 상태를 확인해 주세요.", 503);
    const teacherId = source[kind === "initial" ? "tester_user_id" : "teacher_user_id"];
    const teacher = teacherId ? await ctx.db.from("profiles").select("name").eq("id", teacherId).maybeSingle() : null;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
    let values: Values = { studentName: source.studentName, nickname: source.nickname, grade: source.grade, instructor: teacher?.data?.name ?? "", assessmentDate: today };
    let attendance;
    if (kind === "monthly") {
      const window = await progressPeriod(ctx,sourceId,period);
      const next = new Date(new Date(`${window.to}T00:00:00Z`).getTime()+86400000).toISOString().slice(0,10);
      values = { ...values, reviewFrom: window.from, reviewTo: window.to };
      const sessions = await ctx.db.from("class_sessions").select("id,status").eq("enrollment_id", sourceId).eq("is_test", false).neq("status", "cancelled").gte("scheduled_start", `${window.from}T00:00:00+09:00`).lt("scheduled_start", `${next}T00:00:00+09:00`).limit(1000);
      if (sessions.error) throw new AssessmentError("Unable to verify attendance. Please retry.", 503);
      if ((sessions.data?.length ?? 0) >= 1000) throw new AssessmentError("Too many lessons in this review period.", 503);
      const ids = (sessions.data ?? []).map(s => s.id);
      const marks = ids.length ? await ctx.db.from("attendance").select("class_session_id,status").in("class_session_id", ids).limit(5000) : { data: [], error: null };
      if (marks.error) throw new AssessmentError("Unable to verify attendance records.", 503);
      const attended = new Set((marks.data ?? []).filter(mark => ["present", "late"].includes(mark.status)).map(mark => mark.class_session_id)).size;
      attendance = { attended, scheduled: ids.length, completed: (sessions.data ?? []).filter(s => s.status === "completed").length };
    }
    if (record) {
      try { values = validateAssessment(kind, record.values, "draft"); } catch { throw new AssessmentError("Saved assessment format needs administrator review. The record has not been changed.", 503); }
    }
    const history = record ? await ctx.db.from("teacher_assessment_versions").select("revision,actor_id,status,created_at").eq("assessment_id", record.id).order("revision", { ascending: false }).limit(20) : { data: [], error: null };
    const back = administrator ? "/admin/assessments" : "/teacher/assessments";
    return {kind, sourceId, period, values, record, attendance, history, source, back};
}
export default async function AssessmentDetail(props: Props) {
  const {administrator=false}=props;
  const result=await loadDetail(props).then(value=>({value,error:null}),error=>({value:null,error}));
  if (!result.value) { const error=result.error;
return <main className="mx-auto max-w-3xl p-8"><h1 className="text-2xl font-bold">TALKLY · Assessment form</h1><p role="alert" className="my-5">{error instanceof AssessmentError ? error.message : "Unable to load this assessment. Please retry. / 평가서를 불러오지 못했습니다."}</p><Link href={administrator ? "/admin/evaluations" : "/teacher/reviews"} className="text-blue-700">← Back to evaluations</Link></main>;
  }
  const {kind, sourceId, period, values, record, attendance, history, source, back}=result.value;
return <>
      <AssessmentEditor kind={kind} sourceId={sourceId} period={period} initialValues={values} initialRevision={record?.revision ?? 0} initialStatus={(record?.status ?? "draft") as AssessmentStatus} administrator={administrator} attendance={attendance} />
      <section className="mx-auto mb-10 max-w-5xl px-4"><h2 className="text-lg font-bold">Revision history / 변경 이력</h2>
        {history.error ? <p>Unable to load history. / 이력을 불러오지 못했습니다.</p> : <ul className="mt-3 space-y-2 text-sm">{(history.data ?? []).map(row => <li key={row.revision}>Version {row.revision} · {row.status} · {new Date(row.created_at).toLocaleString("ko-KR", {timeZone:"Asia/Seoul"})} · {row.actor_id}</li>)}</ul>}
        {!history.data?.length && !history.error && <p className="mt-3 text-sm">No saved revisions yet.</p>}
        <p className="mt-4"><Link href={kind === "initial" ? (administrator ? `/admin/level-tests/${source.level_test_id}` : `/teacher/level-tests/${sourceId}`) : (administrator ? `/admin/enrollments/${sourceId}` : `/teacher/students/${sourceId}`)} className="text-blue-700">Related learner / level test →</Link> · <Link href={back} className="text-blue-700">Assessment list →</Link></p>
      </section>
    </>;
}
