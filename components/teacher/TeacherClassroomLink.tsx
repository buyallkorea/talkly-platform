import Link from "next/link";

export default function TeacherClassroomLink({ sessionId, enabled }: { sessionId: number; enabled: boolean }) {
  if (!enabled) return <span style={{ display: "inline-block", padding: "10px 12px", color: "#475569", fontSize: 13 }}>Classroom unavailable · 입장 대기/종료</span>;
  return <Link href={`/classroom/${sessionId}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 46, padding: "12px 18px", borderRadius: 10, background: "#1d4ed8", color: "#ffffff", border: "2px solid #1e40af", fontSize: 16, fontWeight: 800, textDecoration: "none", whiteSpace: "normal", textAlign: "center" }}>
    Enter Classroom → · 수업 입장
  </Link>;
}
