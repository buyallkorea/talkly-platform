import { createAdminClient } from "@/lib/supabase-admin";
import { AiError, body, failure, requireIsolatedPreviewWrite } from "@/lib/talkly-ai/server";
import { validUnsubscribeToken } from "@/lib/talkly-ai/unsubscribe-token";
import { unsubscribeHash } from "@/lib/talkly-ai/unsubscribe";
export async function POST(request: Request) {
  try {
    requireIsolatedPreviewWrite(request);
    // No login, active-member, new-opt-in or AI-enabled gate on withdrawal.
    let origin: URL;
    try {
      origin = new URL(request.headers.get("origin") ?? "");
    } catch {
      throw new AiError("허용되지 않은 요청입니다.", 403);
    }
    const host = request.headers.get("host") ?? new URL(request.url).host;
    if (origin.host !== host || !["https:", "http:"].includes(origin.protocol))
      throw new AiError("허용되지 않은 요청입니다.", 403);
    const value = await body(request);
    if (value.confirm !== true || !validUnsubscribeToken(value.token))
      throw new AiError("수신거부 링크와 확인 여부를 확인해 주세요.");
    const { data, error } = await createAdminClient()
      .rpc("ai_unsubscribe_outreach", { p_hash: unsubscribeHash(value.token) })
      .abortSignal(AbortSignal.timeout(3000));
    if (error)
      throw new AiError(
        "처리 결과를 확인하지 못했어요. 같은 링크로 다시 시도해 주세요.",
        503,
      );
    if (data !== true)
      throw new AiError(
        "이 링크로는 수신거부를 확인하지 못했어요. 로그인 후 안내 수신 설정에서 변경할 수 있어요.",
        404,
      );
    return Response.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch (error) {
    return failure(error);
  }
}
