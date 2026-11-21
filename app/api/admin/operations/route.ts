import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { loadAdminOperationsSnapshot } from "@/lib/admin-operations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const client = await createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }
  const { data: profile, error: profileError } = await client.from("profiles")
    .select("role").eq("id", user.id).maybeSingle();
  if (profileError || profile?.role !== "admin") {
    return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
  }
  try {
    const snapshot = await loadAdminOperationsSnapshot();
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[admin operations] load failed", error);
    return NextResponse.json({ error: "운영 현황을 불러오지 못했습니다." }, { status: 500 });
  }
}
