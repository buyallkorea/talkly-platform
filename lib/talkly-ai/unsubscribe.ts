import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";
export function unsubscribeHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
/** Future sender prerequisite only; this helper neither sends nor opts anyone in. */
export async function issueUnsubscribeLink(
  userId: string,
  channel: "kakao" | "email",
  baseUrl: string,
) {
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("HTTPS service origin required");
  const db = createAdminClient();
  const { data: preference, error: preferenceError } = await db
    .from("ai_outreach_preferences")
    .select("enabled")
    .eq("user_id", userId)
    .eq("channel", channel)
    .abortSignal(AbortSignal.timeout(3000))
    .maybeSingle();
  if (preferenceError) throw new Error("Preference unavailable");
  if (!preference?.enabled) return null;
  const token = randomBytes(32).toString("base64url");
  const { error } = await db
    .from("ai_outreach_unsubscribe_tokens")
    .insert({ token_hash: unsubscribeHash(token), user_id: userId, channel })
    .abortSignal(AbortSignal.timeout(3000));
  if (error) throw new Error("Unsubscribe link unavailable");
  // Fragments are not sent in HTTP requests or Referer headers.
  url.pathname = "/talkly-ai/unsubscribe";
  url.search = "";
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}
