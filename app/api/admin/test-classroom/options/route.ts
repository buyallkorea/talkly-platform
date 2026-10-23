import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getTestClassroomOptions } from "@/lib/test-classroom-options";

export async function GET() {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin" || process.env.TALKLY_ENABLE_TEST_CLASSROOM !== "true") return NextResponse.json({ error: "테스트 수업 접근 권한이 없습니다." }, { status: 403 });
    return NextResponse.json(await getTestClassroomOptions(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "강사·교재 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
