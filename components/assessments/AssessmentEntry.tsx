import Link from "next/link";
export default function AssessmentEntry({ administrator = false, kind, sourceId, period }: {administrator?: boolean; kind?: "initial" | "monthly"; sourceId?: number; period?: string}) {
  if (process.env.TALKLY_ASSESSMENTS_ENABLED !== "true") return null;
  const base = administrator ? "/admin/assessments" : "/teacher/assessments";
  const href = kind === "initial" && sourceId ? `${base}/initial/${sourceId}?period=initial`
    : kind === "monthly" && sourceId && period ? `${base}/monthly/${sourceId}?period=${period}` : kind === "monthly" && sourceId ? `${base}?enrollment=${sourceId}` : base;
  return <aside className="my-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-slate-900"><Link prefetch={false} href={href} className="font-bold text-blue-800">{administrator ? "초기·월간 상세 평가서 확인·수정" : kind === "initial" ? "Initial diagnostic assessment — write / review" : kind === "monthly" ? "Monthly observation review — write / review" : "Initial & monthly assessment forms — write / review"} →</Link>
    <p className="mt-2 text-sm">{administrator ? "문서 기반 상세 평가서와 작성·제출 상태를 확인합니다." : "Save a draft, submit your observations and review saved forms."}</p></aside>;
}
