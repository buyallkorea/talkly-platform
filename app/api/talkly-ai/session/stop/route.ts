import { body, context, failure, AiError } from "@/lib/talkly-ai/server";
import { closeSession } from "@/lib/talkly-ai/session";
export async function POST(request: Request) {
  try {
    const { user } = await context(request);
    const data = await body(request);
    if (
      typeof data.sessionId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(data.sessionId)
    )
      throw new AiError("대화 정보를 확인해 주세요.");
    await closeSession(user.id, data.sessionId);
    return Response.json({ success: true });
  } catch (e) {
    return failure(e);
  }
}
