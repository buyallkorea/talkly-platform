import { OUTREACH_DRAFTS } from "./reengagement";
import { validUnsubscribeToken } from "./unsubscribe-token";
export type OutreachMessage = { subject: string; text: string; html: string };
export type DeliveryResult = {
  state: "accepted" | "failed" | "unknown";
  providerId?: string;
};
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function composeOutreachMessage(
  kind: keyof typeof OUTREACH_DRAFTS,
  serviceUrl: string,
  unsubscribeUrl: string,
  operatorContact: string,
): OutreachMessage {
  const service = new URL(serviceUrl),
    unsubscribe = new URL(unsubscribeUrl);
  if (
    service.protocol !== "https:" ||
    service.username ||
    service.password ||
    service.search ||
    service.hash ||
    !/^\/talkly-ai\/?$/.test(service.pathname) ||
    unsubscribe.protocol !== "https:" ||
    unsubscribe.username ||
    unsubscribe.password ||
    unsubscribe.origin !== service.origin ||
    unsubscribe.pathname !== "/talkly-ai/unsubscribe" ||
    unsubscribe.search ||
    !validUnsubscribeToken(
      new URLSearchParams(unsubscribe.hash.slice(1)).get("token"),
    ) ||
    !operatorContact.trim() ||
    operatorContact.length > 200 ||
    /[\r\n]/.test(operatorContact)
  )
    throw new Error("Outreach message settings unavailable");
  const draft = OUTREACH_DRAFTS[kind];
  if (!draft) throw new Error("Unknown outreach event");
  const text = draft.text
    .replaceAll("#{서비스링크}", service.toString())
    .replaceAll("#{운영연락처}", operatorContact.trim())
    .replaceAll("#{수신거부방법}", unsubscribe.toString());
  if (
    text.length > 1300 ||
    text.split("\n").length > 100 ||
    /#\{[^}]*\}/.test(text)
  )
    throw new Error("Outreach message exceeds reviewed format");
  const html = escape(text)
    .replace(
      escape(service.toString()),
      `<a href="${escape(service.toString())}">이용 안내</a>`,
    )
    .replace(
      escape(unsubscribe.toString()),
      `<a href="${escape(unsubscribe.toString())}">안내 수신거부</a>`,
    )
    .replaceAll("\n", "<br>");
  return {
    subject: draft.title,
    text,
    html:
      '<div style="font-family:Arial,sans-serif;line-height:1.7">' +
      html +
      "</div>",
  };
}
