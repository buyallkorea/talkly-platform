"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Question = {
  id: number;
  audio_url: string | null;
  audio_script: string | null;
};

type Props = {
  questions: Question[];
};

type GenerateResponse = {
  success?: boolean;
  error?: string;
  message?: string;
};

export default function LevelTestBulkAudioGenerator({
  questions,
}: Props) {
  const router = useRouter();

  const [isRunning, setIsRunning] =
    useState(false);

  const [completed, setCompleted] =
    useState(0);

  const [total, setTotal] =
    useState(0);

  const [currentQuestionId, setCurrentQuestionId] =
    useState<number | null>(null);

  const [failedIds, setFailedIds] =
    useState<number[]>([]);

  const [message, setMessage] =
    useState<string | null>(null);

  /*
   * 이미 audio_url이 있는 문제는 제외합니다.
   *
   * audio_script가 없는 문제 역시
   * 생성 대상에서 제외합니다.
   */
  const pendingQuestions =
    questions.filter(
      (question) =>
        !question.audio_url &&
        Boolean(
          question.audio_script?.trim()
        )
    );

  async function handleBulkGenerate() {
    if (isRunning) {
      return;
    }

    if (
      pendingQuestions.length === 0
    ) {
      setMessage(
        "현재 조건에서 생성할 미생성 Listening 음원이 없습니다."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `미생성 Listening 음원 ${pendingQuestions.length}개를 순차적으로 생성합니다.\n\n이미 생성된 음원은 재생성하지 않습니다.\n계속하시겠습니까?`
      );

    if (!confirmed) {
      return;
    }

    setIsRunning(true);
    setCompleted(0);
    setTotal(
      pendingQuestions.length
    );
    setFailedIds([]);
    setMessage(null);

    const failures: number[] =
      [];

    let completedCount = 0;

    try {
      /*
       * Promise.all을 사용하지 않습니다.
       *
       * OpenAI 요청과 Storage 저장을
       * 한 문항씩 순차적으로 처리하여
       * 안정성을 우선합니다.
       */
      for (
        const question of
        pendingQuestions
      ) {
        setCurrentQuestionId(
          question.id
        );

        try {
          const response =
            await fetch(
              `/api/admin/level-test-questions/${question.id}/generate-audio`,
              {
                method: "POST",
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
                "음원 생성 실패"
            );
          }
        } catch (error) {
          console.error(
            `[Level Test Audio] Question #${question.id} generation failed:`,
            error
          );

          failures.push(
            question.id
          );

          setFailedIds([
            ...failures,
          ]);
        }

        completedCount += 1;

        setCompleted(
          completedCount
        );
      }

      setCurrentQuestionId(
        null
      );

      if (
        failures.length === 0
      ) {
        setMessage(
          `${pendingQuestions.length}개 Listening AI 음원 생성이 완료되었습니다.`
        );
      } else {
        setMessage(
          `일괄 처리가 완료되었습니다. 실패 문항: ${failures
            .map(
              (id) =>
                `#${id}`
            )
            .join(", ")}`
        );
      }

      /*
       * 서버 페이지를 다시 읽어
       * audio_url 및 생성 개수를
       * 최신 상태로 갱신합니다.
       */
      router.refresh();
    } finally {
      setIsRunning(false);
      setCurrentQuestionId(
        null
      );
    }
  }

  const progress =
    total > 0
      ? Math.round(
          (completed / total) *
            100
        )
      : 0;

  return (
    <section className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-bold text-slate-950">
            Listening AI 음원
            일괄 생성
          </div>

          <p className="mt-1 text-sm leading-6 text-slate-600">
            현재 필터에 표시된
            Listening 문제 중
            아직 음원이 없는
            문제만 생성합니다.
            기존 음원은 변경하지
            않습니다.
          </p>

          <div className="mt-2 text-sm font-semibold text-blue-700">
            미생성 음원{" "}
            {
              pendingQuestions.length
            }
            개
          </div>
        </div>

        <button
          type="button"
          onClick={
            handleBulkGenerate
          }
          disabled={
            isRunning ||
            pendingQuestions.length ===
              0
          }
          className="inline-flex min-w-[220px] items-center justify-center rounded-xl bg-[#0A1F44] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#102f63] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning
            ? `생성 중 ${completed}/${total}`
            : pendingQuestions.length >
                0
              ? `미생성 음원 ${pendingQuestions.length}개 일괄 생성`
              : "모든 음원 생성 완료"}
        </button>
      </div>

      {isRunning && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>
              {currentQuestionId
                ? `현재 #${currentQuestionId} 생성 중`
                : "처리 중"}
            </span>

            <span>
              {completed}/{total} ·{" "}
              {progress}%
            </span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            음원 생성이 완료될
            때까지 이 페이지를
            닫거나 새로고침하지
            마세요.
          </p>
        </div>
      )}

      {failedIds.length >
        0 && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          생성 실패:{" "}
          {failedIds
            .map(
              (id) =>
                `#${id}`
            )
            .join(", ")}
        </div>
      )}

      {message && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}
    </section>
  );
}