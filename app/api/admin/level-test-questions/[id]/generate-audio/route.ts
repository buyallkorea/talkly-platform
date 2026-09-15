import { NextResponse } from "next/server";
import {
  createClient as createAdminClient,
} from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase-server";

const AUDIO_BUCKET = "level-test-audio";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function createAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase 관리자 환경변수가 설정되지 않았습니다."
    );
  }

  return createAdminClient(
    url,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function getErrorMessage(
  error: unknown
) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "알 수 없는 오류가 발생했습니다.";
}

function getSpeechInstruction(
  targetGroup: string
) {
  switch (targetGroup) {
    case "early_kids":
      return [
        "Read this as a friendly native American English teacher.",
        "Speak clearly and naturally for a young English learner aged about 7 to 9.",
        "Use standard American pronunciation.",
        "Speak slightly slower than normal conversation.",
        "Keep a warm and encouraging tone.",
        "Do not exaggerate pauses.",
        "Do not add, remove, explain, or repeat any words.",
        "Read only the supplied text.",
      ].join(" ");

    case "elementary":
      return [
        "Read this as a friendly native American English teacher.",
        "Speak clearly and naturally for an elementary English learner.",
        "Use standard American pronunciation.",
        "Speak slightly slower than normal conversation.",
        "Do not exaggerate pauses.",
        "Do not add, remove, explain, or repeat any words.",
        "Read only the supplied text.",
      ].join(" ");

    case "secondary":
      return [
        "Read this as a native American English teacher.",
        "Speak clearly at a natural but learner-friendly pace.",
        "Use standard American pronunciation.",
        "Keep natural sentence rhythm and intonation.",
        "Do not add, remove, explain, or repeat any words.",
        "Read only the supplied text.",
      ].join(" ");

    case "adult":
      return [
        "Read this in clear natural American English.",
        "Use standard American pronunciation.",
        "Speak at a natural conversational pace.",
        "Keep natural rhythm and intonation.",
        "Do not add, remove, explain, or repeat any words.",
        "Read only the supplied text.",
      ].join(" ");

    default:
      return [
        "Read this clearly in natural American English.",
        "Use standard American pronunciation.",
        "Do not add, remove, explain, or repeat any words.",
        "Read only the supplied text.",
      ].join(" ");
  }
}

export async function POST(
  _request: Request,
  context: RouteContext
) {
  try {
    /*
     * ==========================================
     * 로그인 확인
     * ==========================================
     */
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "로그인이 필요합니다.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * ==========================================
     * 관리자 권한 확인
     * ==========================================
     */
    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "관리자 권한이 필요합니다.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * ==========================================
     * Question ID
     * ==========================================
     */
    const {
      id: rawId,
    } = await context.params;

    const questionId =
      Number(rawId);

    if (
      !Number.isInteger(questionId) ||
      questionId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "올바른 문제 ID가 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ==========================================
     * OpenAI Key
     * ==========================================
     */
    const openAiApiKey =
      process.env.OPENAI_API_KEY;

    if (!openAiApiKey) {
      throw new Error(
        "OPENAI_API_KEY 환경변수가 설정되지 않았습니다."
      );
    }

    const admin =
      createAdmin();

    /*
     * ==========================================
     * 문제 조회
     * ==========================================
     */
    const {
      data: question,
      error: questionError,
    } =
      await admin
        .from("level_test_questions")
        .select(`
          id,
          target_group,
          category,
          difficulty,
          question_text,
          audio_script,
          audio_url,
          is_active
        `)
        .eq("id", questionId)
        .maybeSingle();

    if (questionError) {
      throw new Error(
        `레벨테스트 문제 조회 실패: ${questionError.message}`
      );
    }

    if (!question) {
      return NextResponse.json(
        {
          success: false,
          error:
            "레벨테스트 문제를 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Listening 문항만 음원 생성 가능
     */
    if (
      question.category !==
      "listening"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Listening 문항만 음원을 생성할 수 있습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const audioScript =
      typeof question.audio_script ===
        "string"
        ? question.audio_script.trim()
        : "";

    if (!audioScript) {
      return NextResponse.json(
        {
          success: false,
          error:
            "audio_script가 비어 있습니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ==========================================
     * OpenAI Speech
     * ==========================================
     */
    const speechResponse =
      await fetch(
        "https://api.openai.com/v1/audio/speech",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${openAiApiKey}`,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            model:
              "gpt-4o-mini-tts",

            voice:
              "coral",

            input:
              audioScript,

            instructions:
              getSpeechInstruction(
                question.target_group
              ),

            response_format:
              "mp3",
          }),
        }
      );

    if (!speechResponse.ok) {
      const errorText =
        await speechResponse.text();

      throw new Error(
        `OpenAI 음원 생성 실패 (${speechResponse.status}): ${errorText}`
      );
    }

    const audioBuffer =
      await speechResponse.arrayBuffer();

    if (
      audioBuffer.byteLength <= 0
    ) {
      throw new Error(
        "OpenAI에서 빈 음원 파일을 반환했습니다."
      );
    }

    /*
     * ==========================================
     * Storage 경로
     *
     * 기존 파일을 덮어쓰지 않습니다.
     * DB가 새 파일로 정상 전환된 뒤에도
     * 이전 audio_url은 즉시 삭제하지 않습니다.
     * ==========================================
     */
    const targetGroup =
      question.target_group ||
      "unknown";

    const storagePath =
      `${targetGroup}/listening/question-${question.id}-${Date.now()}.mp3`;

    /*
     * ==========================================
     * Supabase Storage 업로드
     * ==========================================
     */
    const {
      error: uploadError,
    } =
      await admin.storage
        .from(AUDIO_BUCKET)
        .upload(
          storagePath,
          audioBuffer,
          {
            contentType:
              "audio/mpeg",

            upsert:
              false,
          }
        );

    if (uploadError) {
      throw new Error(
        `Listening 음원 Storage 저장 실패: ${uploadError.message}`
      );
    }

    /*
     * ==========================================
     * DB audio_url 전환
     * ==========================================
     */
    const {
      data: updatedQuestion,
      error: updateError,
    } =
      await admin
        .from("level_test_questions")
        .update({
          audio_url:
            storagePath,
        })
        .eq(
          "id",
          question.id
        )
        .select(`
          id,
          target_group,
          category,
          difficulty,
          question_text,
          audio_script,
          audio_url,
          is_active
        `)
        .single();

    /*
     * DB 변경 실패 시
     * 이번에 생성한 새 파일만 제거합니다.
     *
     * 기존 audio_url은 건드리지 않았기 때문에
     * 기존 정상 음원에는 영향이 없습니다.
     */
    if (updateError) {
      const {
        error: cleanupError,
      } =
        await admin.storage
          .from(AUDIO_BUCKET)
          .remove([
            storagePath,
          ]);

      if (cleanupError) {
        console.error(
          "LEVEL TEST AUDIO CLEANUP ERROR:",
          cleanupError.message
        );
      }

      throw new Error(
        `audio_url 저장 실패: ${updateError.message}`
      );
    }

    return NextResponse.json({
      success: true,

      message:
        "Listening AI 음원이 생성되었습니다.",

      question:
        updatedQuestion,

      storage: {
        bucket:
          AUDIO_BUCKET,

        path:
          storagePath,

        size:
          audioBuffer.byteLength,
      },

      previousAudioUrl:
        question.audio_url ||
        null,
    });
  } catch (error) {
    console.error(
      "GENERATE LEVEL TEST AUDIO ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          getErrorMessage(
            error
          ),
      },
      {
        status: 500,
      }
    );
  }
}