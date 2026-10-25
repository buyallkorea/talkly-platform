import { CONSENT_VERSION } from "./config";
export type OutreachMember = {
  id: string;
  role: string;
  status: string;
  consentVersion: string;
  validUntil: string | null;
  trialUsed: number;
  lastActivity: string | null;
  hasPaid: boolean;
  activeSession: boolean;
  paymentPending: boolean;
};
export type OutreachCandidate = {
  kind: "trial_followup" | "pass_expired";
  key: string;
  anchor: string;
};
const DAY = 86400000;
export function outreachCandidate(
  member: OutreachMember,
  now = new Date(),
): OutreachCandidate | null {
  if (
    !["student", "parent"].includes(member.role) ||
    member.status !== "active" ||
    member.consentVersion !== CONSENT_VERSION ||
    member.activeSession ||
    member.paymentPending
  )
    return null;
  const time = now.getTime(),
    expiry = member.validUntil ? Date.parse(member.validUntil) : null;
  if (expiry !== null && (!Number.isFinite(expiry) || expiry > time))
    return null;
  if (member.hasPaid && expiry !== null && time - expiry >= DAY) {
    return {
      kind: "pass_expired",
      key: `pass_expired:${member.id}:${new Date(expiry).toISOString()}`,
      anchor: new Date(expiry).toISOString(),
    };
  }
  const last = member.lastActivity ? Date.parse(member.lastActivity) : NaN;
  if (
    !member.hasPaid &&
    member.validUntil === null &&
    member.trialUsed > 0 &&
    Number.isFinite(last) &&
    time - last >= DAY
  ) {
    return {
      kind: "trial_followup",
      key: `trial_followup:${member.id}`,
      anchor: new Date(last).toISOString(),
    };
  }
  return null;
}
export function outreachDelivery(
  candidate: OutreachCandidate,
  preferences: { email: boolean; kakao: boolean },
  available: { email: boolean; kakao: boolean },
  sentKeys: ReadonlySet<string>,
  now = new Date(),
) {
  if (sentKeys.has(candidate.key))
    return { channel: null, reason: "already_sent" } as const;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  if (hour < 9 || hour >= 18)
    return { channel: null, reason: "outside_hours" } as const;
  // One channel per event. Do not automatically fall back after an uncertain send.
  if (preferences.email && available.email)
    return { channel: "email", reason: "ready" } as const;
  if (preferences.kakao && available.kakao)
    return { channel: "kakao", reason: "ready" } as const;
  return { channel: null, reason: "no_consent_or_channel" } as const;
}
export const OUTREACH_DRAFTS = {
  trial_followup: {
    title: "(광고) TALKLY AI에서 영어 한 문장, 다시 시작해 보세요",
    text: "(광고) TALKLY AI\n체험하신 영어 회화를 다시 이어가 보세요. 하루 10분·30일 13,900원 이용권을 확인할 수 있어요. 자동결제는 없습니다.\n이용 안내: #{서비스링크}\n발신자 연락처: #{운영연락처}\n무료 수신거부: #{수신거부방법}",
  },
  pass_expired: {
    title: "(광고) TALKLY AI 이용권 재구매 안내",
    text: "(광고) TALKLY AI\n이용권이 만료되었어요. 다시 대화하고 싶을 때 하루 10분·30일 13,900원 이용권을 구매할 수 있어요. 자동결제는 없습니다.\n이용 안내: #{서비스링크}\n발신자 연락처: #{운영연락처}\n무료 수신거부: #{수신거부방법}",
  },
} as const;
