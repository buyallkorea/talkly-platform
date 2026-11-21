import AdminOperationsPanel from "@/components/admin/AdminOperationsPanel";

export const metadata = { title: "실시간 수업 운영 현황 | TALKLY", robots: { index: false } };
export default function AdminLiveClassesPage() {
  return <AdminOperationsPanel mode="live" />;
}
