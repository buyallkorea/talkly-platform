import { createAdminClient } from "@/lib/supabase-admin";
import { queueVoiceObservation } from "@/lib/talkly-ai/voice-observer";
import { after } from "next/server";
import {
  body,
  context,
  failure,
  requireMember,
  AiError,
  hangup,
} from "@/lib/talkly-ai/server";
import { closeSession } from "@/lib/talkly-ai/session";
import { TUTORS, tutorInstructions } from "@/lib/talkly-ai/config";
import { queueApiEvent, API_MODELS } from "@/lib/talkly-ai/api-events";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  const requestStarted = performance.now();
  let owner: string | undefined,
    sessionId: string | undefined,
    callId: string | undefined;
  let callAttached = false;
  let providerStarted: number | undefined,
    providerStatus: number | undefined,
    providerDuration: number | undefined,
    succeeded = false,
    timedOut = false;
  try {
    const { user, db } = await context(request);
    owner = user.id;
    const member = await requireMember(db, user.id);
    if (!process.env.OPENAI_API_KEY)
      throw new AiError("음성 AI 설정을 준비 중이에요.", 503);
    const data = await body(request);
    const tutor = TUTORS.find((t) => t.id === data.tutorId);
    if (
      !tutor ||
      typeof data.sdp !== "string" ||
      !data.sdp.startsWith("v=0") ||
      data.sdp.length > 65000
    )
      throw new AiError("음성 연결 정보를 확인해 주세요.");
    if (process.env.TALKLY_AI_ORDERED_CHECKPOINTS_ENABLED === "true") {
      if (typeof data.writerId !== "string" ||
          !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.writerId))
        throw new AiError("대화 저장 연결 정보를 확인해 주세요.");
    }
    // Recover expired leases before accepting a new connection. Never refund an
    // expired lease without first hanging up its provider call.
    const { data: stale, error: staleError } = await db
      .from("ai_sessions")
      .select("id")
      .eq("user_id", user.id)
      .neq("state", "closed")
      .lt("deadline", new Date().toISOString())
      .abortSignal(AbortSignal.timeout(3000));
    if (staleError)
      throw new AiError(
        "이전 연결 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
        503,
      );
    for (const row of stale ?? []) await closeSession(user.id, row.id);
    // Count only authenticated, syntactically valid connection starts. Stop and
    // settlement routes remain available during a cooldown. No quota is reserved yet.
    const { data: attempt, error: attemptError } = await db
      .rpc("ai_claim_connection_attempt", { p_user: user.id })
      .abortSignal(AbortSignal.timeout(3000));
    if (attemptError || typeof attempt?.allowed !== "boolean")
      throw new AiError(
        "연결 요청을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
        503,
      );
    if (!attempt.allowed) {
      const retry = Number.isInteger(attempt.retry_after_seconds)
        ? Math.max(1, Math.min(3600, attempt.retry_after_seconds))
        : 60;
      return Response.json(
        {
          error: `연결 요청이 여러 번 반복됐어요. 약 ${retry}초 후 다시 시작해 주세요.`,
          retryAfterSeconds: retry,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retry),
            "Cache-Control": "no-store",
          },
        },
      );
    }
    const { data: lease, error } = await db.rpc("ai_reserve", {
      p_user: user.id,
      p_tutor: tutor.id,
    });
    if (error) {
      const message = error.message.includes("SESSION_ACTIVE")
        ? "다른 창의 대화를 종료한 뒤 다시 시작해 주세요."
        : error.message.includes("NO_TIME")
          ? "오늘의 10분을 모두 사용했어요."
          : error.message.includes("TRIAL_EXHAUSTED")
            ? "3분 무료 체험을 모두 사용했어요."
            : "이용권과 남은 시간을 확인해 주세요.";
      throw new AiError(message, 409);
    }
    sessionId = lease.id;
    // Bind the writer at reservation time, before any transcript checkpoint.
    if (process.env.TALKLY_AI_ORDERED_CHECKPOINTS_ENABLED === "true") {
      const { data: writerBound, error: writerError } = await db.from("ai_sessions")
        .update({ checkpoint_writer: data.writerId })
        .eq("id", lease.id).eq("user_id", user.id).eq("state", "connecting")
        .is("checkpoint_writer", null).select("id").maybeSingle();
      if (writerError || !writerBound)
        throw new AiError("대화 저장 작성자를 연결하지 못했어요.", 503);
    }
    // Leave runtime headroom for the 240-second lease and bounded close retries.
    // The catch path releases a call-less reservation without consuming minutes.
    if (performance.now() - requestStarted > 10000)
      throw new AiError(
        "연결 준비가 지연되고 있어요. 잠시 후 다시 시작해 주세요.",
        503,
      );
    const form = new FormData();
    form.set("sdp", data.sdp);
    form.set(
      "session",
      JSON.stringify({
        type: "realtime",
        model: API_MODELS.voice_connect,
        instructions: tutorInstructions(tutor.id, member.memory),
        tools: [
          {
            type: "function",
            name: "end_session",
            description:
              "End a lesson after a persistent disallowed sexual or illegal-drug instruction topic.",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
        ],
        audio: {
          input: {
            noise_reduction: { type: "near_field" },
            transcription: {
              model: "gpt-4o-mini-transcribe",
              prompt:
                "English conversation with a Korean-speaking learner. Transcribe English and Korean verbatim, preserving code switching. Do not translate or invent words for noise or silence.",
            },
            turn_detection: {
              type: "semantic_vad",
              eagerness: "low",
              // Client schedules exactly one response after a committed turn.
              create_response: false,
              interrupt_response: true,
            },
          },
          output: { voice: tutor.voice },
        },
      }),
    );
    providerStarted = Date.now();
    const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(25000),
    });
    providerStatus = upstream.status;
    providerDuration = Date.now() - providerStarted;
    if (!upstream.ok)
      throw new AiError(
        "선택한 음성 모델 연결에 실패했어요. 관리자에게 모델 권한·API 이용 한도를 확인해 달라고 알려주세요.",
        502,
      );
    callId = upstream.headers.get("location")?.split("/").pop();
    if (!callId || !/^rtc_[A-Za-z0-9_-]+$/.test(callId))
      throw new AiError("음성 연결의 종료 제어 정보를 받지 못했어요.", 502);
    const { data: attached, error: attachError } = await db
      .from("ai_sessions")
      .update({ call_id: callId, state: "active" })
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .eq("state", "connecting")
      .gt("deadline", new Date().toISOString())
      .select("id")
      .maybeSingle();
    if (attachError) throw attachError;
    if (!attached)
      throw new AiError(
        "음성 연결 준비 중 대화가 종료됐어요. 다시 시작해 주세요.",
        409,
      );
    callAttached = true;
    const capturedUser = user.id,
      capturedSession = lease.id;
    // Bounded server watchdog. This must pass real Vercel runtime verification
    // before the paid rollout flag is enabled. Never rely on a browser timer alone.
    after(async () => {
      const deadline = Date.parse(lease.deadline);
      while (Date.now() < deadline) {
        await new Promise((r) =>
          setTimeout(r, Math.min(10000, Math.max(1, deadline - Date.now()))),
        );
        // Do not put an optional state read between the lease deadline and hangup.
        if (Date.now() >= deadline) break;
        try {
          const { data: current, error: stateError } = await db
            .from("ai_sessions")
            .select("state")
            .eq("id", capturedSession)
            .abortSignal(
              AbortSignal.timeout(
                Math.min(1500, Math.max(1, deadline - Date.now())),
              ),
            )
            .maybeSingle();
          if (!stateError && current?.state === "closed") return;
        } catch {
          // A transient observation failure must not abandon deadline cleanup.
        }
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await closeSession(capturedUser, capturedSession);
          return;
        } catch {
          console.error("[TALKLY AI] watchdog retry");
        }
      }
      console.error("[TALKLY AI] watchdog termination failed", capturedSession);
    });
    if (process.env.TALKLY_AI_VOICE_USAGE_ENABLED === "true")
      queueVoiceObservation({
        sessionId: lease.id,
        callId,
        deadline: lease.deadline,
      });
    const answer = await upstream.text();
    succeeded = true;
    return Response.json(
      {
        sdp: answer,
        serverNow: new Date().toISOString(),
        sessionId,
        deadline: lease.deadline,
        seconds: lease.reserved_seconds,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    timedOut =
      e instanceof Error && ["TimeoutError", "AbortError"].includes(e.name);
    // Once attached, closeSession owns hangup and settlement atomically.
    // Never hang up twice or refund an already registered provider call.
    if (callId && !callAttached) {
      try {
        await hangup(callId);
      } catch {
        // A provider call may still be running. Preserve its ID on the reserved
        // session, rather than making the call invisible to overdue-call recovery.
        if (owner && sessionId) {
          try {
            const { data: retained, error: retainError } = await createAdminClient()
              .from("ai_sessions")
              .update({ call_id: callId })
              .eq("id", sessionId)
              .eq("user_id", owner)
              .eq("state", "connecting")
              .is("call_id", null)
              .select("id")
              .maybeSingle();
            if (retainError || !retained) {
              console.error("[TALKLY AI] provider call recovery ID not retained");
            } else {
              // Retry using the standard close path. Repeated hangup failure
              // keeps the provider call registered and the quota reserved.
              try {
                await closeSession(owner, sessionId);
              } catch {
                console.error("[TALKLY AI] retained provider call needs recovery");
              }
            }
          } catch {
            console.error("[TALKLY AI] provider call recovery ID retention failed");
          }
        }
        console.error("[TALKLY AI] failed negotiation hangup");
        return failure(e);
      }
    }
    if (owner && sessionId) {
      try {
        await closeSession(owner, sessionId, !callAttached);
      } catch {
        console.error("[TALKLY AI] failed reservation recovery");
      }
    }
    return failure(e);
  } finally {
    if (providerStarted !== undefined && sessionId)
      queueApiEvent({
        sessionId,
        kind: "voice_connect",
        outcome: succeeded ? "succeeded" : "failed",
        httpStatus: providerStatus,
        durationMs: providerDuration ?? Date.now() - providerStarted,
        timedOut,
      });
  }
}
