import {
  composeOutreachMessage,
  type DeliveryResult,
} from "./outreach-message";
import type { ContactResult } from "./outreach-contact";
export type ClaimedOutreach = {
  id: string;
  user_id: string;
  kind: "trial_followup" | "pass_expired";
  channel: "kakao" | "email";
  activity_anchor: string;
  consent_revision: number;
  claim_token: string;
};
type Dependencies = {
  now: () => Date;
  contact: (row: ClaimedOutreach) => Promise<ContactResult>;
  link: (row: ClaimedOutreach) => Promise<string | null>;
  eligible: (row: ClaimedOutreach) => Promise<boolean>;
  send: (
    channel: "kakao" | "email",
    address: string,
    message: ReturnType<typeof composeOutreachMessage>,
  ) => Promise<DeliveryResult>;
  finish: (
    row: ClaimedOutreach,
    result: DeliveryResult | { state: "skipped" },
  ) => Promise<boolean>;
  release: (row: ClaimedOutreach) => Promise<"pending" | "failed" | null>;
};
export function outreachWindow(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  return hour >= 9 && hour < 18;
}
export async function processClaimedOutreach(
  row: ClaimedOutreach,
  settings: { origin: string; operatorContact: string },
  deps: Dependencies,
) {
  async function finish(result: DeliveryResult | { state: "skipped" }) {
    try {
      return { ...result, recorded: await deps.finish(row, result) };
    } catch {
      return { ...result, recorded: false };
    }
  }
  async function defer() {
    try {
      const state = await deps.release(row);
      return {
        state: state === "failed" ? ("failed" as const) : ("deferred" as const),
        recorded: state !== null,
      };
    } catch {
      return { state: "deferred" as const, recorded: false };
    }
  }
  let providerStarted = false;
  try {
    if (!outreachWindow(deps.now())) return defer();
    const recipient = await deps.contact(row);
    if (!recipient.ok)
      return recipient.reason === "lookup_unavailable"
        ? defer()
        : finish({ state: "skipped" });
    if (recipient.channel !== row.channel) return finish({ state: "skipped" });
    const link = await deps.link(row);
    if (!link) return finish({ state: "skipped" });
    const message = composeOutreachMessage(
      row.kind,
      settings.origin + "/talkly-ai",
      link,
      settings.operatorContact,
    );
    if (!outreachWindow(deps.now())) return defer();
    if (!(await deps.eligible(row))) return finish({ state: "skipped" });
    if (!outreachWindow(deps.now())) return defer();
    providerStarted = true;
    const result = await deps.send(row.channel, recipient.address, message);
    return finish(result);
  } catch {
    return providerStarted ? finish({ state: "unknown" }) : defer();
  }
}
