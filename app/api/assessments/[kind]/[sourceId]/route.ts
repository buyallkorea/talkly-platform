import { AssessmentError, assessmentContext, assessmentFailure, assessmentSource, progressPeriod } from "@/lib/assessments/server";
import { validProgressPeriod, validateAssessment, type AssessmentKind } from "@/lib/assessments/schema";
type Context = { params: Promise<{kind: string; sourceId: string}> };
export async function PUT(request: Request, { params }: Context) {
  try {
    const ctx = await assessmentContext(request);
    const { kind, sourceId } = await params;
    if (!["initial", "monthly"].includes(kind) || !/^[1-9]\d*$/.test(sourceId) || !Number.isSafeInteger(Number(sourceId))) throw new AssessmentError("Invalid target.");
    const source = await assessmentSource(ctx, kind as AssessmentKind, Number(sourceId));
    const raw = await request.text();
    if (raw.length > 100000) throw new AssessmentError("Assessment is too large.", 413);
    let input;
    try { input = JSON.parse(raw); } catch { throw new AssessmentError("Invalid request."); }
    if (!input || typeof input !== "object" || Array.isArray(input) || !["draft", "submitted"].includes(input.status) || !Number.isSafeInteger(input.revision) || input.revision < 0 || (kind === "monthly" && !validProgressPeriod(input.period)) || (kind === "initial" && input.period !== "initial")) throw new AssessmentError("Invalid assessment request.");
    if (input.status === "submitted" && kind === "initial" && (!source.started_at || ["cancelled", "no_show"].includes(String(source.status)))) throw new AssessmentError("Start and observe the level test before submitting.", 409);
    let values;
    try { values = validateAssessment(kind as AssessmentKind, input.values, input.status); } catch (error) { throw new AssessmentError(error instanceof Error ? error.message : "Invalid fields."); }
    if (kind === "monthly") {
      const window = await progressPeriod(ctx,Number(sourceId),input.period);
      if ([values.reviewFrom,values.reviewTo].some(date=>typeof date === "string" && date && (date<window.from || date>window.to))) throw new AssessmentError("Review dates must stay within the assigned review period.");
    }
    const { data, error } = await ctx.db.rpc("save_teacher_assessment", {
      p_actor: ctx.user.id, p_kind: kind, p_source: Number(sourceId), p_period: input.period,
      p_revision: input.revision, p_status: input.status, p_values: values,
    });
    if (error) {
      if (error.message?.includes("ASSESSMENT_CONFLICT") || error.code === "23505") throw new AssessmentError("Another edit was saved first. Your text is still here. Copy it before reloading. / 다른 수정이 먼저 저장됐습니다. 입력 내용을 복사한 뒤 새로고침해 주세요.", 409);
      if (error.message?.includes("ASSESSMENT_FORBIDDEN")) throw new AssessmentError("Assignment or permissions changed. Reload to verify access.", 403);
      throw error;
    }
    if (!data || !Number.isSafeInteger(data.revision)) throw Error("Invalid save result");
    return Response.json({ success: true, revision: data.revision, updatedAt: data.updated_at, status: data.status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return assessmentFailure(error); }
}
