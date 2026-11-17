import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { data: profile, error: roleError } = await supabase.from("profiles")
    .select("role").eq("id", user.id).maybeSingle();
  if (roleError || profile?.role !== "admin") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "잘못된 강사 ID입니다." }, { status: 400 });
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "올바른 요청을 입력해주세요." }, { status: 400 }); }
  const notes = (body as { notes?: unknown })?.notes;
  if (typeof notes !== "string" || notes.length > 4000) {
    return NextResponse.json({ error: "메모는 최대 4,000자까지 입력할 수 있습니다." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: teacher, error: teacherError } = await admin.from("teacher_profiles")
    .select("user_id").eq("user_id", id).maybeSingle();
  if (teacherError || !teacher) return NextResponse.json({ error: "강사 정보를 찾을 수 없습니다." }, { status: 404 });
  const { error } = await admin.from("teacher_compensation_notes")
    .upsert({ teacher_user_id: id, notes: notes.trim(), updated_at: new Date().toISOString() }, { onConflict: "teacher_user_id" });
  if (error) {
    console.error("TEACHER COMPENSATION NOTE ERROR", error.message);
    return NextResponse.json({ error: "협상 메모를 저장하지 못했습니다." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
