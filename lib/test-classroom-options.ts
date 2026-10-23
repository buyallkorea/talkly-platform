import { createAdminClient } from "@/lib/supabase-admin";

// page_count is legacy metadata; only actual rendered pages are usable in class.
export async function getTestClassroomOptions() {
  const admin = createAdminClient();
  const [teachers, books] = await Promise.all([
    admin.from("teacher_profiles").select("user_id, display_name").eq("is_active", true).order("display_name"),
    admin.from("textbooks").select("id, title, textbook_pages!inner(id)").eq("status", "ready").eq("is_active", true).order("title"),
  ]);
  if (teachers.error || books.error) throw new Error("강사·교재 목록을 불러오지 못했습니다.");
  return {
    teachers: (teachers.data ?? []).map(t => ({ id: t.user_id, name: t.display_name || "Teacher" })),
    textbooks: (books.data ?? []).filter(b => b.textbook_pages.length > 0).map(b => ({ id: b.id, title: b.title, pages: b.textbook_pages.length })),
  };
}
