import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
export const API_MODELS = {
  voice_connect: "gpt-realtime-2.1-mini",
  learning_summary: "gpt-4.1-mini",
} as const;
type ApiEvent = {
  sessionId: string;
  kind: "voice_connect" | "learning_summary";
  outcome: "succeeded" | "failed";
  httpStatus?: number;
  durationMs: number;
  timedOut?: boolean;
  usage?: unknown;
};
const integer = (value: unknown) =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= 1_000_000_000
    ? value
    : null;
export function apiEventRow(event: ApiEvent) {
  const usage =
    event.kind === "learning_summary" &&
    event.usage &&
    typeof event.usage === "object"
      ? (event.usage as Record<string, unknown>)
      : {};
  const details =
    usage.input_tokens_details && typeof usage.input_tokens_details === "object"
      ? (usage.input_tokens_details as Record<string, unknown>)
      : {};
  const input = integer(usage.input_tokens),
    output = integer(usage.output_tokens),
    cached = integer(details.cached_tokens);
  const status =
    event.httpStatus &&
    Number.isInteger(event.httpStatus) &&
    event.httpStatus >= 100 &&
    event.httpStatus <= 599
      ? event.httpStatus
      : null;
  const failure =
    event.outcome === "succeeded"
      ? null
      : event.timedOut
        ? "timeout"
        : status === 401 || status === 403
          ? "access"
          : status === 429
            ? "rate_limit"
            : status !== null && status >= 500
              ? "provider"
              : status !== null && status >= 400
                ? "request_rejected"
                : "other";
  return {
    session_id: event.sessionId,
    kind: event.kind,
    model: API_MODELS[event.kind],
    outcome: event.outcome,
    failure_kind: failure,
    http_status: status,
    duration_ms: Number.isFinite(event.durationMs)
      ? Math.max(0, Math.min(600000, Math.round(event.durationMs)))
      : 0,
    input_tokens: input,
    output_tokens: output,
    cached_input_tokens:
      input !== null && cached !== null && cached <= input ? cached : null,
  };
}
export function queueApiEvent(event: ApiEvent) {
  const row = apiEventRow(event);
  // Best effort after the response, with no extra model request and no automatic retry.
  try {
    after(async () => {
      try {
        const { error } = await createAdminClient()
          .from("ai_api_events")
          .insert(row)
          .abortSignal(AbortSignal.timeout(1500));
        if (error && error.code !== "23505")
          console.error("[TALKLY AI] API metadata not recorded");
      } catch {
        console.error("[TALKLY AI] API metadata not recorded");
      }
    });
  } catch {
    console.error("[TALKLY AI] API metadata scheduling failed");
  }
}
