import "server-only";
import { createClient } from "@/lib/supabase-server";
import { isSandboxKeyPair } from "@/lib/payments/toss-sandbox-order";

export type SandboxAuth = { adminId: string; secretKey: string; clientKey: string };
export type SandboxFailure = { response: Response };

export async function requireSandboxAdmin(request: Request): Promise<SandboxAuth | SandboxFailure> {
  const origin = request.headers.get("origin");
  const requestedUrl = new URL(request.url);
  if (!origin) return { response: Response.json({ error: "요청 출처를 확인하지 못했습니다." }, { status: 403 }) };
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== requestedUrl.origin) throw new Error("origin mismatch");
  } catch {
    return { response: Response.json({ error: "잘못된 요청 출처입니다." }, { status: 403 }) };
  }
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) return { response: Response.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  const { data: profile, error: roleError } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (roleError || profile?.role !== "admin") return { response: Response.json({ error: "관리자만 이용할 수 있습니다." }, { status: 403 }) };

  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "";
  const secretKey = process.env.TOSS_SECRET_KEY || "";
  if (!isSandboxKeyPair(clientKey, secretKey)) {
    return { response: Response.json({
      error: "토스 테스트 결제 키 설정을 확인해주세요. 클라이언트는 test_gck_, 서버 시크릿은 test_gsk_로 시작하는 한 쌍이어야 합니다. 실결제 키에서는 이 메뉴가 비활성화됩니다.",
    }, { status: 503 }) };
  }
  return { adminId: user.id, secretKey, clientKey };
}
