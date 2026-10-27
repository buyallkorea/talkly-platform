type Channel = "email" | "kakao";
export type ContactResult =
  | { ok: true; channel: Channel; address: string }
  | {
      ok: false;
      reason:
        | "account_unavailable"
        | "email_unverified"
        | "phone_unverified"
        | "not_eligible"
        | "lookup_unavailable"
        | "invalid_input";
    };
const date = (v: unknown) =>
  typeof v === "string" && Number.isFinite(Date.parse(v))
    ? Date.parse(v)
    : null;
/** Use only top-level Auth confirmation fields returned by the server Admin API. */
export function verifiedOutreachContact(
  value: unknown,
  userId: string,
  channel: Channel,
  now = Date.now(),
): ContactResult {
  const user =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  if (!Number.isFinite(now) || !["email", "kakao"].includes(channel))
    return { ok: false, reason: "invalid_input" };
  const banned = date(user.banned_until);
  if (
    user.id !== userId ||
    user.is_anonymous === true ||
    user.deleted_at ||
    (user.banned_until && banned === null) ||
    (banned !== null && banned > now)
  )
    return { ok: false, reason: "account_unavailable" };
  if (channel === "email") {
    const email = user.email,
      confirmed = date(user.email_confirmed_at);
    if (
      typeof email !== "string" ||
      email.length > 254 ||
      email.split("@")[0].length > 64 ||
      confirmed === null ||
      confirmed > now ||
      !/^[-A-Za-z0-9.!#$%&'*+/=?^_`{|}~]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(
        email,
      ) ||
      email.startsWith(".") ||
      email.includes("..") ||
      email.includes(".@")
    )
      return { ok: false, reason: "email_unverified" };
    return { ok: true, channel, address: email };
  }
  const phone = user.phone,
    confirmed = date(user.phone_confirmed_at);
  if (
    typeof phone !== "string" ||
    confirmed === null ||
    confirmed > now ||
    !/^\+?82(?:10\d{8}|1[16789]\d{7,8})$/.test(phone)
  )
    return { ok: false, reason: "phone_unverified" };
  return {
    ok: true,
    channel,
    address: "0" + phone.replace(/^\+/, "").slice(2),
  };
}
