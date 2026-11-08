import "server-only";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getTeacherEvaluationRequirements, type TeacherEvaluationSession, type ExistingTeacherEvaluation } from "@/lib/teacher-evaluations";
import type { AssessmentKind } from "./schema";
export class AssessmentError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function assessmentFailure(error: unknown) {
  return Response.json({ error: error instanceof AssessmentError ? error.message : "Unable to load or save the assessment. Please retry. / 평가서를 처리하지 못했습니다." }, { status: error instanceof AssessmentError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
}
export async function assessmentContext(request?: Request) {
  if (process.env.TALKLY_ASSESSMENTS_ENABLED !== "true") throw new AssessmentError("Assessment forms are being prepared. / 평가서 기능을 준비 중입니다.", 503);
  if (request && request.method !== "GET") {
    let origin;
    try { origin = new URL(request.headers.get("origin") ?? ""); } catch { throw new AssessmentError("Invalid origin.", 403); }
    if (origin.host !== (request.headers.get("host") ?? new URL(request.url).host) || !["https:", "http:"].includes(origin.protocol)) throw new AssessmentError("Invalid origin.", 403);
    if (process.env.VERCEL_ENV === "preview") {
      const ref = process.env.TALKLY_ASSESSMENTS_PREVIEW_DB_REF;
      if (!ref || !/^[a-z0-9]{20}$/.test(ref) || ref === "nvotgdovtxfzvmrrhxge" || process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co`) throw new AssessmentError("Isolated preview database required.", 503);
    }
  }
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new AssessmentError("Please sign in. / 로그인이 필요합니다.", 401);
  const { data: profile, error: roleError } = await client.from("profiles").select("role,name").eq("id", user.id).maybeSingle();
  if (roleError) throw new AssessmentError("Unable to verify permissions.", 503);
  if (!profile || !["teacher", "admin"].includes(profile.role)) throw new AssessmentError("Teachers and administrators only.", 403);
  return { user, role: profile.role as "teacher" | "admin", name: profile.name as string | null, db: createAdminClient() };
}
export type AssessmentContext = Awaited<ReturnType<typeof assessmentContext>>;
export async function assessmentSource(ctx: AssessmentContext, kind: AssessmentKind, sourceId: number): Promise<Record<string, unknown> & { studentName: string; nickname: string; grade: string; courseName: string }> {
  const { db, user, role } = ctx;
  const table = kind === "initial" ? "level_test_interviews" : "enrollments";
  const select = kind === "initial" ? "id,tester_user_id,level_test_id,status,started_at,duration_minutes" : "id,teacher_user_id,child_id,student_user_id,is_test,status,course_id,start_date,total_lessons";
  const { data: source, error } = await db.from(table).select(select).eq("id", sourceId).maybeSingle();
  if (error) throw new AssessmentError("Unable to verify the assessment target.", 503);
  const row = source as unknown as Record<string, unknown> | null;
  if (!row || (role !== "admin" && row[kind === "initial" ? "tester_user_id" : "teacher_user_id"] !== user.id) || row.is_test === true) throw new AssessmentError("Assessment target not found or not assigned to you.", 404);
  let studentName = "", nickname = "", grade = "", textbook = "";
  if (kind === "initial") {
    const result = await db.from("level_tests").select("student_name,grade,child_id,student_user_id").eq("id", row.level_test_id).maybeSingle();
    if (result.error || !result.data) throw new AssessmentError("Unable to load learner details.", 503);
    studentName = result.data.student_name ?? ""; grade = result.data.grade ?? "";
    const identity = result.data.child_id
      ? await db.from("children").select("nickname").eq("id", result.data.child_id).maybeSingle()
      : result.data.student_user_id ? await db.from("profiles").select("nickname").eq("id",result.data.student_user_id).maybeSingle() : null;
    if (identity?.error) throw new AssessmentError("Unable to load learner nickname.",503);
    nickname = identity?.data?.nickname ?? "";
  } else {
    if (row.child_id) {
      const result = await db.from("children").select("name,nickname,grade").eq("id", row.child_id).maybeSingle();
      if (result.error || !result.data) throw new AssessmentError("Unable to load learner details.", 503);
      studentName = result.data.name ?? ""; nickname = result.data.nickname ?? ""; grade = result.data.grade ?? "";
    } else if (row.student_user_id) {
      const result = await db.from("profiles").select("name,nickname").eq("id", row.student_user_id).maybeSingle();
      if (result.error || !result.data) throw new AssessmentError("Unable to load learner details.", 503);
      studentName = result.data.name ?? ""; nickname = result.data.nickname ?? "";
    }
    // Course title is a reference, not an invented textbook recommendation.
    const result = await db.from("courses").select("name").eq("id", row.course_id).maybeSingle();
    if (!result.error) textbook = result.data?.name ?? "";
  }
  return { ...row, studentName, nickname, grade, courseName: textbook };
}

export function progressKey(requirement: {type: string; periodNumber: number | null}) { return requirement.type === "final" ? "final" : `period-${requirement.periodNumber}`; }
export function progressWindow(startDate: string, requirement: {type: string; periodNumber: number | null}, anchorDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const anchor = new Date(`${anchorDate}T00:00:00Z`).getTime();
  const from = requirement.type === "final" ? Math.max(start,anchor-27*86400000) : start + ((requirement.periodNumber ?? 1)-1)*28*86400000;
  const to = requirement.type === "final" ? anchor : from+27*86400000;
  return {from:new Date(from).toISOString().slice(0,10),to:new Date(to).toISOString().slice(0,10)};
}
export async function progressPeriod(ctx: AssessmentContext, sourceId: number, period: string) {
  const source = await assessmentSource(ctx,"monthly",sourceId);
  const sessions = await ctx.db.from("class_sessions").select("id,enrollment_id,lesson_number,scheduled_start,status").eq("enrollment_id",sourceId).eq("is_test",false).limit(1000);
  if(sessions.error || (sessions.data?.length ?? 0)>=1000) throw new AssessmentError("Unable to verify review schedule.",503);
  const ids=(sessions.data??[]).map(row=>row.id);
  const legacy=ids.length ? await ctx.db.from("evaluations").select("class_session_id,evaluation_type,period_number").in("class_session_id",ids).limit(1000) : {data:[],error:null};
  if(legacy.error || (legacy.data?.length ?? 0)>=1000) throw new AssessmentError("Unable to verify previous reviews.",503);
  const requirements=getTeacherEvaluationRequirements({enrollmentId:sourceId,startDate:source.start_date as string|null,totalLessons:source.total_lessons as number|null,sessions:(sessions.data??[]) as TeacherEvaluationSession[],existingEvaluations:(legacy.data??[]) as ExistingTeacherEvaluation[]});
  const requirement=requirements.find(row=>progressKey(row)===period);
  const anchor=(sessions.data??[]).find(row=>row.id===requirement?.sessionId);
  if(!requirement || !anchor || !source.start_date) throw new AssessmentError("This review is not due yet. Reviews follow the existing four-week / final-lesson schedule.",409);
  const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul"}).format(new Date(anchor.scheduled_start));
  return {...progressWindow(String(source.start_date),requirement,day),requirement,sessions:sessions.data??[]};
}
