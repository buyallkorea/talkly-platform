import "server-only";
import { createAdminClient } from "@/lib/supabase-admin";
import { hangup } from "./server";
export async function closeSession(
  userId: string,
  sessionId: string,
  failed = false,
) {
  const db = createAdminClient();
  // Atomically block new attachment before inspecting the provider call ID.
  // A failed hangup leaves `closing` for a later retry, without releasing quota.
  const { data: s, error } = await db
    .rpc("ai_begin_close", { p_user: userId, p_session: sessionId })
    .abortSignal(AbortSignal.timeout(2000));
  if (error || !s) throw new Error("Session not found");
  if (s.state !== "closed" && s.call_id) await hangup(s.call_id);
  const { error: finishError } = await db
    .rpc("ai_finish", {
      p_user: userId,
      p_session: sessionId,
      // begin-close prevents a later attachment, so a call-less reservation
      // cannot have delivered a connected lesson to this browser.
      p_failed: failed || !s.call_id,
    })
    .abortSignal(AbortSignal.timeout(2000));
  if (finishError) throw finishError;
}
