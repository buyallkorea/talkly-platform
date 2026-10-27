import "server-only";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  outreachSendConfiguration,
  deliverOutreach,
} from "./outreach-provider";
import { resolveOutreachRecipient } from "./outreach-recipient";
import { issueUnsubscribeLink } from "./unsubscribe";
import {
  outreachWindow,
  processClaimedOutreach,
  type ClaimedOutreach,
} from "./outreach-workflow";
export async function runOutreachBatch() {
  const config = outreachSendConfiguration();
  const counts = {
    accepted: 0,
    failed: 0,
    unknown: 0,
    skipped: 0,
    deferred: 0,
    unrecorded: 0,
  };
  if (!config.enabled) return { status: "off", ...counts };
  const channels = (["kakao", "email"] as const).filter(
    (channel) => config.available[channel],
  );
  if (!config.origin || !channels.length)
    return { status: "unconfigured", ...counts };
  if (!outreachWindow(new Date()))
    return { status: "outside_hours", ...counts };
  const db = createAdminClient({ timeoutMs: 3000 });
  const { data: pending, error } = await db
    .from("ai_outreach_outbox")
    .select("id")
    .eq("state", "pending")
    .in("channel", channels)
    .or(`retry_after.is.null,retry_after.lte.${new Date().toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(3)
    .abortSignal(AbortSignal.timeout(3000));
  if (error) throw new Error("Outreach queue unavailable");
  for (const item of pending ?? []) {
    if (!outreachSendConfiguration().enabled || !outreachWindow(new Date()))
      break;
    const { data: claim, error: claimError } = await db
      .rpc("ai_claim_outreach", { p_id: item.id })
      .abortSignal(AbortSignal.timeout(3000));
    if (claimError) {
      counts.unrecorded++;
      continue;
    }
    if (!claim) continue;
    const row = claim as ClaimedOutreach;
    const result = await processClaimedOutreach(
      row,
      { origin: config.origin, operatorContact: config.operatorContact },
      {
        now: () => new Date(),
        contact: (r) =>
          resolveOutreachRecipient({
            userId: r.user_id,
            channel: r.channel,
            kind: r.kind,
            anchor: r.activity_anchor,
            consentRevision: r.consent_revision,
          }),
        link: (r) => issueUnsubscribeLink(r.user_id, r.channel, config.origin!),
        eligible: async (r) => {
          const { data, error } = await db
            .rpc("ai_outreach_eligible", {
              p_user: r.user_id,
              p_channel: r.channel,
              p_kind: r.kind,
              p_anchor: r.activity_anchor,
              p_revision: r.consent_revision,
            })
            .abortSignal(AbortSignal.timeout(3000));
          if (error) throw new Error("Eligibility unavailable");
          return data === true;
        },
        send: deliverOutreach,
        finish: async (r, result) => {
          const { data, error } = await db
            .rpc("ai_finish_outreach", {
              p_id: r.id,
              p_token: r.claim_token,
              p_state: result.state,
              p_provider:
                "providerId" in result ? (result.providerId ?? null) : null,
            })
            .abortSignal(AbortSignal.timeout(3000));
          return !error && data === true;
        },
        release: async (r) => {
          const { data, error } = await db
            .rpc("ai_release_outreach", { p_id: r.id, p_token: r.claim_token })
            .abortSignal(AbortSignal.timeout(3000));
          return !error && (data === "pending" || data === "failed")
            ? data
            : null;
        },
      },
    );
    counts[result.state]++;
    if (!result.recorded) counts.unrecorded++;
  }
  return { status: "processed", ...counts };
}
