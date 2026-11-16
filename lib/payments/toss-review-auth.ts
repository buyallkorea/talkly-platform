import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";
import { isSandboxKeyPair } from "@/lib/payments/toss-sandbox-order";

const REVIEWER_ID = "public-toss-review-2026";
export const TOSS_REVIEWER_ID = REVIEWER_ID;

export type TossReviewAuth = { secretKey: string; clientKey: string };
export type TossReviewFailure = { response: Response };

/** A public, sandbox-only route: never expose a live key or touch paid enrollments. */
export function requireTossReviewRequest(request: Request): TossReviewAuth | TossReviewFailure {
  const origin = request.headers.get("origin");
  let trusted = false;
  try {
    trusted = Boolean(origin && new URL(origin).origin === new URL(request.url).origin);
  } catch {
    trusted = false;
  }
  if (!trusted) {
    return { response: Response.json({ error: "같은 사이트의 테스트 결제창에서만 요청할 수 있습니다." }, { status: 403 }) };
  }
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "";
  const secretKey = process.env.TOSS_SECRET_KEY || "";
  if (!isSandboxKeyPair(clientKey, secretKey)) {
    return { response: Response.json({ error: "현재 토스 테스트 키가 설정되지 않아 가상 결제를 진행할 수 없습니다." }, { status: 503 }) };
  }
  return { clientKey, secretKey };
}

/** The only unauthenticated write is a bounded, server-side rate-limit counter. */
export async function consumeTossReviewRateLimit(request: Request, secretKey: string): Promise<Response | null> {
  const address = request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || "unknown";
  const ip = address.split(",")[0]?.trim().slice(0, 120) || "unknown";
  const agent = (request.headers.get("user-agent") || "").slice(0, 180);
  const fingerprint = createHmac("sha256", secretKey)
    .update("toss-review-v1|" + ip + "|" + agent).digest("hex");
  try {
    const { data, error } = await createAdminClient().rpc("consume_toss_review_rate_limit", {
      p_fingerprint: fingerprint,
    });
    if (error) {
      console.error("[TOSS REVIEW] rate limit check failed:", error.message);
      return Response.json({ error: "테스트 요청 검증에 실패했습니다. 관리자에게 문의해 주세요." }, { status: 503 });
    }
    if (data !== true) {
      return Response.json({ error: "테스트 시도 횟수를 초과했습니다. 잠시 후 다시 이용해 주세요." }, { status: 429 });
    }
  } catch (error) {
    console.error("[TOSS REVIEW] rate limit unavailable:", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "결제 테스트 서비스에 일시적으로 연결할 수 없습니다." }, { status: 503 });
  }
  return null;
}
