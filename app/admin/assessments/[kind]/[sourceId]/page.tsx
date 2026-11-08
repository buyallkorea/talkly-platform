import AssessmentDetail from "@/components/assessments/AssessmentDetail";
export const dynamic = "force-dynamic";
export default function Page(props: {params: Promise<{kind: string; sourceId: string}>; searchParams: Promise<{period?: string}>}) { return <AssessmentDetail {...props} administrator />; }
