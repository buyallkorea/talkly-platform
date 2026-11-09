import Link from "next/link";
export default function AssessmentEntry({ administrator = false, kind, sourceId, period }: {administrator?: boolean; kind?: "initial" | "monthly"; sourceId?: number; period?: string}) {
  if (process.env.TALKLY_ASSESSMENTS_ENABLED !== "true") return null;
  const base = administrator ? "/admin/assessments" : "/teacher/assessments";
  const href = kind === "initial" && sourceId ? `${base}/initial/${sourceId}?period=initial`
    : kind === "monthly" && sourceId && period ? `${base}/monthly/${sourceId}?period=${period}` : kind === "monthly" && sourceId ? `${base}?enrollment=${sourceId}` : base;
  return <aside className="talkly-assessment-entry"><Link prefetch={false} href={href} className="talkly-assessment-entry-link">{administrator ? "초기·월간 상세 평가서 확인·수정" : kind === "initial" ? "Initial diagnostic assessment — write / review" : kind === "monthly" ? "Monthly observation review — write / review" : "Initial & monthly assessment forms — write / review"} →</Link>
    <p className="talkly-assessment-entry-description">{administrator ? "문서 기반 상세 평가서와 작성·제출 상태를 확인합니다." : "Save a draft, submit your observations and review saved forms."}</p></aside>;
}
