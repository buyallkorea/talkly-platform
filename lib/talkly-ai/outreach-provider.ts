import "server-only";
import { createAuthorizationHeader } from "@/lib/solapi";
import { sendEmail } from "@/lib/email";
import type { DeliveryResult, OutreachMessage } from "./outreach-message";
const present = (name: string) => Boolean(process.env[name]?.trim());
const providerId = (v: unknown) =>
  typeof v === "string" && /^[A-Za-z0-9._:@<>-]{1,200}$/.test(v)
    ? v
    : undefined;
export function outreachSendConfiguration() {
  let origin: string | null = null;
  try {
    const url = new URL(process.env.TALKLY_AI_SERVICE_ORIGIN ?? "");
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    )
      origin = url.origin;
  } catch {}
  const contact = process.env.TALKLY_AI_OPERATOR_CONTACT?.trim() ?? "";
  const common = Boolean(
    origin &&
      contact.length > 0 &&
      contact.length <= 200 &&
      !/[\r\n]/.test(contact),
  );
  const pfId = process.env.TALKLY_AI_KAKAO_PFID ?? "";
  const smtpPort = Number(process.env.SMTP_PORT?.trim() || 465);
  return {
    enabled: process.env.TALKLY_AI_OUTREACH_DELIVERY_ENABLED === "true",
    origin,
    operatorContact: contact,
    available: {
      kakao:
        common &&
        ["SOLAPI_API_KEY", "SOLAPI_API_SECRET", "SOLAPI_SENDER_NUMBER"].every(
          present,
        ) &&
        /^[A-Za-z0-9_-]{6,100}$/.test(pfId),
      email:
        common &&
        present("SMTP_USER") &&
        present("SMTP_PASSWORD") &&
        Number.isInteger(smtpPort) &&
        smtpPort > 0 &&
        smtpPort <= 65535 &&
        Boolean(
          (process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER)?.includes("@"),
        ),
    },
  };
}
export async function deliverOutreach(
  channel: "email" | "kakao",
  address: string,
  message: OutreachMessage,
): Promise<DeliveryResult> {
  const config = outreachSendConfiguration();
  if (!config.enabled || !config.available[channel]) return { state: "failed" };
  try {
    if (channel === "email") {
      if (/[\r\n,;<>]/.test(address)) return { state: "failed" };
      const result = await sendEmail({
        to: address,
        subject: message.subject,
        html: message.html,
        text: message.text,
        timeoutMs: 15000,
      });
      const matches = (item: unknown) => {
        const value =
          typeof item === "string"
            ? item
            : item && typeof item === "object" && "address" in item
              ? (item as { address: unknown }).address
              : null;
        return (
          typeof value === "string" &&
          value.toLowerCase() === address.toLowerCase()
        );
      };
      const accepted = result.accepted.some(matches),
        rejected = result.rejected.some(matches);
      if (accepted && !rejected)
        return { state: "accepted", providerId: providerId(result.messageId) };
      if (rejected && !accepted)
        return { state: "failed", providerId: providerId(result.messageId) };
      return { state: "unknown", providerId: providerId(result.messageId) };
    }
    if (
      !/^(?:010[0-9]{8}|01[16789][0-9]{7,8})$/.test(address) ||
      message.text.length > 1300
    )
      return { state: "failed" };
    const response = await fetch(
      "https://api.solapi.com/messages/v4/send-many/detail",
      {
        method: "POST",
        headers: {
          Authorization: createAuthorizationHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              to: address,
              country: "82",
              type: "BMS_FREE",
              text: message.text,
              kakaoOptions: {
                pfId: process.env.TALKLY_AI_KAKAO_PFID,
                disableSms: true,
                adFlag: true,
                bms: { targeting: "I", chatBubbleType: "TEXT", adult: false },
              },
            },
          ],
        }),
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      },
    );
    if (!response.ok)
      return {
        state:
          response.status >= 400 && response.status < 500
            ? "failed"
            : "unknown",
      };
    const result = await response.json();
    const count = result?.groupInfo?.count,
      id = providerId(result?.groupInfo?.groupId);
    if (
      count?.total === 1 &&
      count.registeredSuccess === 1 &&
      count.registeredFailed === 0 &&
      Array.isArray(result.failedMessageList) &&
      result.failedMessageList.length === 0 &&
      Array.isArray(result.messageList) &&
      result.messageList.length === 1 &&
      result.messageList[0].statusCode === "2000" &&
      providerId(result.messageList[0].messageId)
    )
      return {
        state: "accepted",
        providerId: providerId(result.messageList[0].messageId),
      };
    if (
      count?.total === 1 &&
      count.registeredSuccess === 0 &&
      count.registeredFailed === 1 &&
      Array.isArray(result.failedMessageList) &&
      result.failedMessageList.length === 1 &&
      result.failedMessageList[0].to === address
    )
      return {
        state: "failed",
        providerId: providerId(result.failedMessageList[0].messageId) ?? id,
      };
    return { state: "unknown", providerId: id };
  } catch {
    return { state: "unknown" };
  }
}
