import "server-only";
import { createHash } from "node:crypto";
const SOURCE = "talkly_signup_otp_v1";
export function koreanRecipientPhone(value: unknown) {
  if (typeof value !== "string") return null;
  const local = /^\+?82/.test(value)
    ? "0" + value.replace(/^\+/, "").slice(2)
    : value;
  return /^(?:010[0-9]{8}|01[16789][0-9]{7,8})$/.test(local) ? local : null;
}
function hash(phone: string) {
  return createHash("sha256")
    .update("talkly-verified-phone:" + phone)
    .digest("hex");
}
/** Called only after the signup endpoint has verified and consumed the OTP. */
export function signupPhoneProof(phone: string, verifiedAt: unknown) {
  const normalized = koreanRecipientPhone(phone);
  if (
    !normalized ||
    typeof verifiedAt !== "string" ||
    !Number.isFinite(Date.parse(verifiedAt)) ||
    Date.parse(verifiedAt) > Date.now()
  )
    return {};
  return {
    talkly_phone_proof: {
      source: SOURCE,
      phone_sha256: hash(normalized),
      verified_at: verifiedAt,
    },
  };
}
/** Auth user must come from Admin getUserById, never a submitted browser object. */
export function confirmedSignupPhone(
  value: unknown,
  currentProfilePhone: unknown,
) {
  const user =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const metadata =
    user.app_metadata && typeof user.app_metadata === "object"
      ? (user.app_metadata as Record<string, unknown>)
      : {};
  const proof =
    metadata.talkly_phone_proof &&
    typeof metadata.talkly_phone_proof === "object"
      ? (metadata.talkly_phone_proof as Record<string, unknown>)
      : {};
  const phone = koreanRecipientPhone(currentProfilePhone),
    at =
      typeof proof.verified_at === "string"
        ? Date.parse(proof.verified_at)
        : NaN;
  if (
    !phone ||
    proof.source !== SOURCE ||
    !Number.isFinite(at) ||
    at > Date.now() ||
    proof.phone_sha256 !== hash(phone)
  )
    return null;
  return phone;
}
