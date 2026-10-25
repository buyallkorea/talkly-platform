import "server-only";
import { createAdminClient } from "@/lib/supabase-admin";
import { hangup } from "./server";
export async function closeSession(
  userId: string,
  sessionId: string,
  failed = false,
) {
  const db = createAdminClient();
  const { data: s, error } = await db
    .from("ai_sessions")
    .select("call_id,state")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !s) throw new Error("Session not found");
  if (s.state !== "closed" && s.call_id) await hangup(s.call_id);
  const { error: finishError } = await db.rpc("ai_finish", {
    p_user: userId,
    p_session: sessionId,
    p_failed: failed,
  });
  if (finishError) throw finishError;
}
