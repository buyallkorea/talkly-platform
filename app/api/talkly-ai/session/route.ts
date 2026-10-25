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
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  let owner: string | undefined,
    sessionId: string | undefined,
    callId: string | undefined;
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
    // Recover expired leases before accepting a new connection. Never refund an
    // expired lease without first hanging up its provider call.
    const { data: stale } = await db
      .from("ai_sessions")
      .select("id")
      .eq("user_id", user.id)
      .neq("state", "closed")
      .lt("deadline", new Date().toISOString());
    for (const row of stale ?? []) await closeSession(user.id, row.id);
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
    const form = new FormData();
    form.set("sdp", data.sdp);
    form.set(
      "session",
      JSON.stringify({
        type: "realtime",
        model: "gpt-realtime-2.1-mini",
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
    const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(25000),
    });
    if (!upstream.ok)
      throw new AiError(
        "선택한 음성 모델 연결에 실패했어요. 관리자에게 모델 권한·API 이용 한도를 확인해 달라고 알려주세요.",
        502,
      );
    callId = upstream.headers.get("location")?.split("/").pop();
    if (!callId || !/^rtc_[A-Za-z0-9_-]+$/.test(callId))
      throw new AiError("음성 연결의 종료 제어 정보를 받지 못했어요.", 502);
    const { error: attachError } = await db
      .from("ai_sessions")
      .update({ call_id: callId, state: "active" })
      .eq("id", sessionId)
      .eq("state", "connecting");
    if (attachError) throw attachError;
    const capturedUser = user.id,
      capturedSession = lease.id;
    // Bounded server watchdog. This must pass real Vercel runtime verification
    // before the paid rollout flag is enabled. Never rely on a browser timer alone.
    after(async () => {
      const deadline = Date.parse(lease.deadline);
      while (Date.now() < deadline) {
        await new Promise((r) =>
          setTimeout(r, Math.min(2000, Math.max(1, deadline - Date.now()))),
        );
        const { data: current } = await db
          .from("ai_sessions")
          .select("state")
          .eq("id", capturedSession)
          .maybeSingle();
        if (current?.state === "closed") return;
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
    const answer = await upstream.text();
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
    if (callId) {
      try {
        await hangup(callId);
      } catch {
        console.error("[TALKLY AI] failed negotiation hangup");
        return failure(e);
      }
    }
    if (owner && sessionId) {
      try {
        await closeSession(owner, sessionId, true);
      } catch {
        console.error("[TALKLY AI] failed reservation recovery");
      }
    }
    return failure(e);
  }
}
