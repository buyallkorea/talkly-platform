import AssessmentList from "@/components/assessments/AssessmentList";
export const dynamic = "force-dynamic";
export default function Page(props: {searchParams: Promise<{period?: string; enrollment?: string}>}) { return <AssessmentList {...props} />; }
