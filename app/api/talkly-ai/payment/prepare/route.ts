import { randomUUID } from "node:crypto";
import { PLAN } from "@/lib/talkly-ai/config";
import {
  context,
  failure,
  requireMember,
  AiError,
} from "@/lib/talkly-ai/server";
export async function POST(request: Request) {
  try {
    const { user, db } = await context(request);
    await requireMember(db, user.id);
    if (process.env.TALKLY_AI_PAYMENTS_ENABLED !== "true")
      throw new AiError("결제 준비 중이에요.", 503);
    const orderId = `TALKLYAI-${randomUUID()}`;
    const { error } = await db
      .from("ai_payments")
      .insert({ user_id: user.id, order_id: orderId, amount: PLAN.amount });
    if (error) throw error;
    return Response.json({
      orderId,
      orderName: PLAN.name,
      amount: PLAN.amount,
      customerKey: user.id,
    });
  } catch (e) {
    return failure(e);
  }
}
