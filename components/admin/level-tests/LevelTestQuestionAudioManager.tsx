"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

type Props = {
  questionId: number;
  targetGroup: string;
  audioScript:
    | string
    | null;
  audioPath:
    | string
    | null;
};

type GenerateResponse = {
  success?: boolean;

  message?: string;

  error?: string;

  question?: {
    audio_url?:
      | string
      | null;
  };
};

const SUPABASE_URL =
  process.env
    .NEXT_PUBLIC_SUPABASE_URL;

const AUDIO_BUCKET =
  "level-test-audio";

export default function LevelTestQuestionAudioManager({
  questionId,
  targetGroup,
  audioScript,
  audioPath,
}: Props) {
  const router =
    useRouter();

  const [
    isGenerating,
    setIsGenerating,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(
      null
    );

  /*
   * audio_url에는 전체 URL이 아니라
   * Storage object path가 저장됩니다.
   *
   * 학생 레벨테스트 화면과 같은
   * level-test-audio public bucket을
   * 사용합니다.
   */
  const publicAudioUrl =
    useMemo(() => {
      if (
        !audioPath ||
        !SUPABASE_URL
      ) {
        return null;
      }

      /*
       * 혹시 과거 데이터에
       * 전체 URL이 들어 있다면
       * 그대로 사용할 수 있도록 처리.
       */
      if (
        audioPath.startsWith(
          "http://"
        ) ||
        audioPath.startsWith(
          "https://"
        )
      ) {
        return audioPath;
      }

      const encodedPath =
        audioPath
          .split("/")
          .map(
            (part) =>
              encodeURIComponent(
                part
              )
          )
          .join("/");

      return `${SUPABASE_URL}/storage/v1/object/public/${AUDIO_BUCKET}/${encodedPath}`;
    }, [audioPath]);

  async function handleGenerate() {
    if (isGenerating) {
      return;
    }

    if (
      !audioScript?.trim()
    ) {
      setError(
        "audio_script가 비어 있어 음원을 생성할 수 없습니다."
      );

      return;
    }

    const isRegenerate =
      Boolean(audioPath);

    if (isRegenerate) {
      const confirmed =
        window.confirm(
          `문제 #${questionId}의 AI 음원을 새로 생성하시겠습니까?\n\n기존 음원은 즉시 삭제하지 않고 새 음원이 정상 저장된 후 DB 연결만 새 파일로 변경됩니다.`
        );

      if (!confirmed) {
        return;
      }
    }

    setIsGenerating(true);
    setError(null);
    setMessage(null);

    try {
      const response =
        await fetch(
          `/api/admin/level-test-questions/${questionId}/generate-audio`,
          {
            method:
              "POST",

            headers: {
              Accept:
                "application/json",
            },
          }
        );

      let result:
        GenerateResponse;

      try {
        result =
          (await response.json()) as GenerateResponse;
      } catch {
        throw new Error(
          "서버 응답을 읽을 수 없습니다."
        );
      }

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            "AI 음원 생성에 실패했습니다."
        );
      }

      setMessage(
        result.message ||
          "AI 음원이 생성되었습니다."
      );

      /*
       * Server Component를 다시 읽어
       * 새 audio_url을 반영합니다.
       */
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "AI 음원 생성 중 오류가 발생했습니다."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="mt-6 border-t border-slate-200 pt-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Listening Audio
          </div>

          <div className="mt-1 flex items-center gap-2">
            <span
              className={
                audioPath
                  ? "inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"
                  : "inline-flex items-center rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700"
              }
            >
              {audioPath
                ? "음원 생성 완료"
                : "음원 없음"}
            </span>

            <span className="text-xs text-slate-400">
              {targetGroup}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={
            handleGenerate
          }
          disabled={
            isGenerating ||
            !audioScript?.trim()
          }
          className="inline-flex min-w-[140px] items-center justify-center rounded-xl bg-[#0A1F44] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#102f63] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGenerating
            ? "AI 생성 중..."
            : audioPath
              ? "AI 음원 재생성"
              : "AI 음원 생성"}
        </button>
      </div>

      {/* 실제 읽는 문장 */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-blue-600">
          Audio Script
        </div>

        {audioScript ? (
          <p className="text-sm font-medium leading-6 text-slate-800">
            {audioScript}
          </p>
        ) : (
          <p className="text-sm font-medium text-amber-700">
            audio_script가
            등록되어 있지
            않습니다.
          </p>
        )}
      </div>

      {/* 기존 음원 */}
      {publicAudioUrl && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Audio Preview
          </div>

          <audio
            key={
              publicAudioUrl
            }
            controls
            preload="metadata"
            className="w-full"
            src={
              publicAudioUrl
            }
          >
            브라우저에서 오디오
            재생을 지원하지
            않습니다.
          </audio>

          <div className="mt-2 break-all text-xs leading-5 text-slate-400">
            {audioPath}
          </div>
        </div>
      )}

      {message && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">
          {error}
        </div>
      )}

      {isGenerating && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium leading-6 text-blue-700">
          OpenAI가 Listening
          음성을 생성하고
          있습니다. 완료될 때까지
          이 페이지를 닫지
          마세요.
        </div>
      )}
    </div>
  );
}