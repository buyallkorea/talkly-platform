import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import BulkTextbookImportForm from "./BulkTextbookImportForm";

export default async function BulkTextbookImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || profile.role !== "admin") redirect("/");

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 24px 80px" }}>
      <Link href="/admin/textbooks" style={{ color: "#2f6fed", textDecoration: "none", fontWeight: 800 }}>← 교재 관리</Link>
      <div style={{ margin: "18px 0 26px", padding: 28, borderRadius: 20, background: "linear-gradient(135deg, #0A1F44, #173f7a)", color: "white" }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".08em", opacity: .8 }}>BULK TEXTBOOK REGISTRATION</div>
        <h1 style={{ margin: "10px 0", fontSize: 34 }}>교재 정보 일괄등록</h1>
        <p style={{ margin: 0, lineHeight: 1.7, opacity: .88 }}>
          엑셀로 출판사, 교재설명, 판매가격과 표지 이미지를 한 번에 반영합니다. 기존 교재 ID, 커리큘럼 Grade 연결, PDF·오디오 데이터는 유지됩니다.
        </p>
      </div>
      <BulkTextbookImportForm />
    </main>
  );
}