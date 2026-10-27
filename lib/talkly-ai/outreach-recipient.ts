import "server-only";
import { confirmedSignupPhone, koreanRecipientPhone } from "./phone-proof";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  verifiedOutreachContact,
  type ContactResult,
} from "./outreach-contact";
type Input = {
  userId: string;
  channel: "email" | "kakao";
  kind: "trial_followup" | "pass_expired";
  anchor: string;
  consentRevision: number;
};
/** Future sender prerequisite, not a delivery action or a recipient list API. */
export async function resolveOutreachRecipient(
  input: Input,
): Promise<ContactResult> {
  if (
    !input ||
    typeof input.userId !== "string" ||
    typeof input.anchor !== "string" ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.userId) ||
    !["email", "kakao"].includes(input.channel) ||
    !["trial_followup", "pass_expired"].includes(input.kind) ||
    !Number.isFinite(Date.parse(input.anchor)) ||
    !Number.isSafeInteger(input.consentRevision) ||
    input.consentRevision < 1
  )
    return { ok: false, reason: "invalid_input" };
  try {
    const db = createAdminClient({ timeoutMs: 3000 });
    const args = {
      p_user: input.userId,
      p_channel: input.channel,
      p_kind: input.kind,
      p_anchor: input.anchor,
      p_revision: input.consentRevision,
    };
    async function eligible() {
      const { data, error } = await db
        .rpc("ai_outreach_eligible", args)
        .abortSignal(AbortSignal.timeout(3000));
      if (error) throw new Error("eligibility unavailable");
      return data === true;
    }
    if (!(await eligible())) return { ok: false, reason: "not_eligible" };
    const { data, error } = await db.auth.admin.getUserById(input.userId);
    if (error) return { ok: false, reason: "lookup_unavailable" };
    let contact = verifiedOutreachContact(
      data.user,
      input.userId,
      input.channel,
    );
    if (
      input.channel === "kakao" &&
      (contact.ok || contact.reason === "phone_unverified")
    ) {
      const { data: profile, error: profileError } = await db
        .from("profiles")
        .select("phone")
        .eq("id", input.userId)
        .abortSignal(AbortSignal.timeout(3000))
        .maybeSingle();
      if (profileError) return { ok: false, reason: "lookup_unavailable" };
      const current = koreanRecipientPhone(profile?.phone);
      if (contact.ok) {
        if (contact.address !== current)
          return { ok: false, reason: "phone_unverified" };
      } else {
        const proven = confirmedSignupPhone(data.user, profile?.phone);
        if (!proven) return { ok: false, reason: "phone_unverified" };
        contact = { ok: true, channel: "kakao", address: proven };
      }
    }
    if (!contact.ok) return contact;
    // A withdrawal/rejoin/repurchase during Auth lookup invalidates the old event.
    if (!(await eligible())) return { ok: false, reason: "not_eligible" };
    return contact;
  } catch {
    return { ok: false, reason: "lookup_unavailable" };
  }
}
