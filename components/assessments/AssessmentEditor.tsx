"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { assessmentSections, validateAssessment, type Values, type AssessmentKind, type AssessmentStatus } from "@/lib/assessments/schema";
export default function AssessmentEditor({ kind, sourceId, period, initialValues, initialRevision, initialStatus, administrator, attendance }: {
  kind: AssessmentKind; sourceId: number; period: string; initialValues: Values; initialRevision: number; initialStatus: AssessmentStatus;
  administrator: boolean; attendance?: { attended: number; completed: number; scheduled: number };
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initialValues), [revision, setRevision] = useState(initialRevision),
    [status, setStatus] = useState(initialStatus), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false), [conflict, setConflict] = useState(false);
  const guard = useRef(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change(key: string, value: string | string[]) { setValues(current => ({ ...current, [key]: value })); setDirty(true); }
  async function save(nextStatus: AssessmentStatus) {
    if (guard.current || conflict) return;
    let cleaned;
    try { cleaned = validateAssessment(kind, values, nextStatus); } catch (error) { setMessage(error instanceof Error ? error.message : "Please check the fields."); return; }
    guard.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/assessments/${kind}/${sourceId}`, { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, values: cleaned, revision, status: nextStatus }), signal: AbortSignal.timeout(20000) });
      const result = await response.json();
      if (response.status === 409) setConflict(true);
      if (!response.ok || result?.success !== true || (!Number.isSafeInteger(result.revision) || result.revision !== revision + 1 || result.status !== nextStatus)) throw Error(result?.error || "Save could not be confirmed. Your text remains here. Copy it before leaving.");
      setRevision(result.revision); setStatus(result.status); setDirty(false);
      router.refresh();
      setMessage(nextStatus === "submitted" ? "Submitted for administrator review. No parent notification has been sent. / 제출 완료 · 관리자 확인 대기" : "Draft saved. / 임시저장 완료");
    } catch (error) {
      setMessage(error instanceof Error && !["TimeoutError", "AbortError"].includes(error.name) ? error.message : "Save result is uncertain. Keep this page and retry. / 저장 결과를 확인하지 못했습니다.");
    } finally { guard.current = false; setBusy(false); }
  }
  return <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 text-slate-900">
    <Link onClick={event => { if (dirty && !window.confirm("Unsaved changes will be lost. Leave this page? / 저장하지 않은 변경사항을 버리고 이동할까요?")) event.preventDefault(); }} href={administrator ? "/admin/assessments" : "/teacher/assessments"} className="font-semibold text-blue-700">← {administrator ? "평가서 목록" : "Assessment forms"}</Link>
    <header><p className="text-sm font-bold tracking-widest text-blue-600">TALKLY · {administrator ? "관리자 조회·수정" : "TEACHER ASSESSMENT"}</p>
      <h1 className="mt-2 text-3xl font-bold">{kind === "initial" ? "Initial / Diagnostic Assessment" : "Monthly Observation Review"}</h1>
      <p className="mt-3 text-sm leading-7">{period !== "initial" ? `Review period: ${period} · ` : ""}Status: {status} · Version: {revision} {dirty ? "· Unsaved changes / 저장하지 않은 변경사항" : ""}</p>
      <p className="text-sm leading-7 text-slate-600">E = Emerging · D = Developing · I = Independent · NYO = Not Yet Observed. Use concrete examples; do not infer an unobserved skill. This form does not change the learner’s assigned level, course or textbook.</p>
      <p className="text-sm leading-7 text-slate-600">Visible to the assigned teacher and administrators. Parent/student publication is not enabled. / 담당 강사·관리자 전용이며 학생·학부모에게 자동 공개되지 않습니다.</p>
      {attendance && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm">Recorded attendance in the assigned review period: {attendance.attended} attended / {attendance.scheduled} scheduled lessons · {attendance.completed} completed. Based on attendance records; cancelled and test lessons excluded.</p>}
    </header>
    <form onSubmit={event => { event.preventDefault(); void save("submitted"); }}>
      <fieldset disabled={busy} className="space-y-6">
        {assessmentSections(kind).map(section => <section key={section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-5 text-lg font-bold text-blue-900">{section.title}</h2>
          <div className="grid gap-5 sm:grid-cols-2">{section.fields.map(field => {
            const id = `assessment-${field.key}`, value = values[field.key] ?? (field.type === "multi" ? [] : "");
            return <div key={field.key} className={field.type === "textarea" || field.type === "multi" ? "sm:col-span-2" : ""}>
              {field.type === "multi" ? <fieldset><legend className="mb-2 text-sm font-semibold">{field.label}</legend><div className="flex flex-wrap gap-3">{field.options?.map(option => <label key={option} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Array.isArray(value) && value.includes(option)} onChange={event => change(field.key, event.target.checked ? [...(Array.isArray(value) ? value : []), option] : (Array.isArray(value) ? value : []).filter(v => v !== option))} />{option}</label>)}</div></fieldset>
              : <><label htmlFor={id} className="mb-2 block text-sm font-semibold">{field.label}{field.required ? " *" : ""}</label>
                {field.type === "select" ? <select id={id} value={String(value)} onChange={event => change(field.key, event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-3"><option value="">Select / 선택</option>{field.options?.map(option => <option key={option}>{option}</option>)}</select>
                : field.type === "textarea" ? <textarea id={id} value={String(value)} maxLength={2000} rows={3} onChange={event => change(field.key, event.target.value)} className="w-full rounded-lg border border-slate-300 p-3" />
                : <input id={id} type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"} min={field.type === "number" ? 0 : undefined} maxLength={200} value={String(value)} onChange={event => change(field.key, event.target.value)} className="w-full rounded-lg border border-slate-300 p-3" />}</>}
            </div>;
          })}</div>
        </section>)}
        <p className="text-sm text-slate-600">* Required for submission. Drafts may be incomplete. / 필수항목은 제출 시 검사합니다.</p>
        <div className="flex flex-wrap gap-3"><button disabled={conflict} type="button" onClick={() => void save(status)} className="rounded-xl border border-blue-700 px-5 py-3 font-semibold text-blue-700">{status === "submitted" ? "Save changes / 수정 저장" : "Save draft / 임시저장"}</button>
          {status === "draft" && <button disabled={conflict} type="submit" className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white">Submit for review / 제출</button>}
          <button type="button" onClick={() => window.print()} className="rounded-xl border px-5 py-3">Print / 인쇄</button></div>
      </fieldset>
    </form>
    <p role="status" aria-live="polite" className="whitespace-pre-wrap rounded-xl bg-slate-100 p-4 text-sm">{busy ? "Saving… / 저장 중…" : message || "Keep this page open until saving is confirmed. / 저장 완료를 확인해 주세요."}</p>
    {conflict && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm">A newer version may exist. Copy your text before reloading. / 입력 내용을 복사한 뒤 새로고침해 최신 내용을 확인해 주세요.</p>}
  </div>;
}
