import "server-only";
import { after } from "next/server";
import WebSocket from "ws";
import { createAdminClient } from "@/lib/supabase-admin";
import { API_MODELS } from "./api-events";
import { voiceUsageRow, type VoiceUsageRow } from "./voice-usage";
type Args = { sessionId: string; callId: string; deadline: string };
type Reason =
  | "deadline"
  | "socket_closed"
  | "connect_timeout"
  | "error"
  | "invalid_deadline";
type State = {
  state: "started" | "stopped" | "failed";
  reason?: Reason;
  observed_responses: number;
  recording_errors: number;
  dropped_events: boolean;
  finished_at?: string;
};
type Dependencies = {
  open: () => Pick<WebSocket, "on" | "terminate">;
  usage: (row: VoiceUsageRow) => Promise<void>;
  state: (value: State) => Promise<void>;
};
export async function runVoiceObservation(args: Args, deps: Dependencies) {
  const remaining = Math.min(240000, Date.parse(args.deadline) - Date.now());
  if (!Number.isFinite(remaining) || remaining <= 0) return;
  const seen = new Set<string>(),
    pending = new Set<Promise<void>>();
  let recordingErrors = 0,
    dropped = false,
    opened = false,
    finished = false;
  const initial = deps
    .state({
      state: "started",
      observed_responses: 0,
      recording_errors: 0,
      dropped_events: false,
    })
    .catch(() => {
      recordingErrors++;
    });
  await new Promise<void>((resolve) => {
    let socket: ReturnType<Dependencies["open"]> | undefined;
    async function finish(reason: Reason) {
      if (finished) return;
      finished = true;
      if (deadlineTimer) clearTimeout(deadlineTimer);
      if (connectTimer) clearTimeout(connectTimer);
      try {
        socket?.terminate();
      } catch {}
      await initial;
      await Promise.allSettled([...pending]);
      try {
        await deps.state({
          state: opened ? "stopped" : "failed",
          reason,
          observed_responses: seen.size,
          recording_errors: Math.min(1000, recordingErrors),
          dropped_events: dropped,
          finished_at: new Date().toISOString(),
        });
      } catch {}
      resolve();
    }
    const deadlineTimer = setTimeout(() => void finish("deadline"), remaining);
    const connectTimer = setTimeout(
      () => void finish("connect_timeout"),
      Math.min(5000, remaining),
    );
    try {
      socket = deps.open();
      socket.on("open", () => {
        if (finished) return;
        opened = true;
        if (connectTimer) clearTimeout(connectTimer);
      });
      socket.on("error", () => void finish("error"));
      socket.on("close", () => void finish("socket_closed"));
      socket.on("message", (data) => {
        if (finished) return;
        let event: unknown;
        try {
          const raw = data.toString();
          if (raw.length > 262144) return;
          event = JSON.parse(raw);
        } catch {
          return;
        }
        const row = voiceUsageRow(event);
        if (!row || seen.has(row.response_id)) return;
        if (seen.size >= 500 || pending.size >= 4) {
          dropped = true;
          return;
        }
        seen.add(row.response_id);
        const task = Promise.resolve()
          .then(() => deps.usage(row))
          .catch(() => {
            recordingErrors++;
          })
          .finally(() => pending.delete(task));
        pending.add(task);
      });
    } catch {
      void finish("error");
    }
  });
}
export function queueVoiceObservation(args: Args) {
  if (
    process.env.TALKLY_AI_VOICE_USAGE_ENABLED !== "true" ||
    !process.env.OPENAI_API_KEY ||
    !/^rtc_[A-Za-z0-9_-]+$/.test(args.callId)
  )
    return;
  try {
    after(async () => {
      try {
        const db = createAdminClient();
        const startedAt = new Date().toISOString();
        await runVoiceObservation(args, {
          open: () =>
            new WebSocket(
              "wss://api.openai.com/v1/realtime?call_id=" +
                encodeURIComponent(args.callId),
              {
                headers: {
                  Authorization: "Bearer " + process.env.OPENAI_API_KEY,
                },
                handshakeTimeout: 5000,
                maxPayload: 262144,
                perMessageDeflate: false,
              },
            ),
          usage: async (row) => {
            const { error } = await db
              .from("ai_voice_usage")
              .insert({
                ...row,
                session_id: args.sessionId,
                model: API_MODELS.voice_connect,
              })
              .abortSignal(AbortSignal.timeout(1500));
            if (error && error.code !== "23505")
              throw new Error("usage unavailable");
          },
          state: async (value) => {
            const { error } = await db
              .from("ai_voice_observations")
              .upsert({
                session_id: args.sessionId,
                started_at: startedAt,
                ...value,
              })
              .abortSignal(AbortSignal.timeout(1500));
            if (error) throw new Error("observation unavailable");
          },
        });
      } catch {
        console.error("[TALKLY AI] voice observation failed");
      }
    });
  } catch {
    console.error("[TALKLY AI] voice observation not scheduled");
  }
}
