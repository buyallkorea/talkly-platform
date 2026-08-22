"use client";

import {
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Question = {
  id: number;
  category: string;
  difficulty: number;
  question_text: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  audio_url: string | null;
  grammar_topic: string | null;
  listening_topic: string | null;
};

type Props = {
  levelTestId: number;
  attemptId: number;
  currentDifficulty: number;
  answeredCount: number;
  question: Question | null;
};

const MAX_QUESTIONS = 20;

export default function LevelTestQuestionPanel({
  levelTestId,
  attemptId,
  currentDifficulty,
  answeredCount,
  question,
}: Props) {
  const router = useRouter();

  const [
    selectedAnswer,
    setSelectedAnswer,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    questionStartedAt,
    setQuestionStartedAt,
  ] = useState<number>(
    Date.now()
  );

  useEffect(() => {
    setSelectedAnswer("");
    setErrorMessage("");
    setQuestionStartedAt(
      Date.now()
    );
  }, [question?.id]);

  async function handleAnswer() {
    if (!question) {
      return;
    }

    if (!selectedAnswer) {
      setErrorMessage(
        "답을 선택해주세요."
      );
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const responseTimeSeconds =
        Math.max(
          0,
          Math.round(
            (Date.now() -
              questionStartedAt) /
              1000
          )
        );

      const response =
        await fetch(
          "/api/level-tests/answer",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              levelTestId,
              attemptId,
              questionId:
                question.id,
              selectedAnswer,
              responseTimeSeconds,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "답변 처리 중 오류가 발생했습니다."
        );
      }

      /*
       * 서버에서 테스트 완료 처리된 경우
       * 상세 화면으로 이동합니다.
       */
      if (result.completed) {
        router.push(
          `/parent/level-tests/${levelTestId}`
        );

        router.refresh();

        return;
      }

      /*
       * 다음 문제를 서버 컴포넌트에서
       * 다시 가져옵니다.
       */
      setSelectedAnswer("");

      router.refresh();
    } catch (error) {
      console.error(
        "LEVEL TEST ANSWER ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "답변 처리 중 알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * 현재 난이도에 출제 가능한 문제가 없을 때
   */
  if (!question) {
    return (
      <section
        style={sectionStyle}
      >
        <h2
          style={{
            margin: 0,
            color: "#101828",
            fontSize: "20px",
          }}
        >
          다음 문항을 불러올 수 없습니다
        </h2>

        <p
          style={{
            margin: "10px 0 0",
            color: "#667085",
            fontSize: "13px",
            lineHeight: 1.7,
          }}
        >
          현재 난이도에서
          출제 가능한 문항이
          없습니다.
        </p>

        <div
          style={{
            marginTop: "18px",
            padding: "16px",
            border:
              "1px solid #fecdca",
            borderRadius: "10px",
            background: "#fffbfa",
            color: "#b42318",
            fontSize: "12px",
            lineHeight: 1.7,
          }}
        >
          관리자에게 해당 테스트
          유형과 난이도의 문항 등록이
          필요합니다.
        </div>
      </section>
    );
  }

  const progress =
    Math.min(
      100,
      Math.round(
        (answeredCount /
          MAX_QUESTIONS) *
          100
      )
    );

  const nextQuestionNumber =
    Math.min(
      answeredCount + 1,
      MAX_QUESTIONS
    );

  return (
    <section
      style={sectionStyle}
    >
      {/* 상단 진행률 */}
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <div>
          <div
            style={{
              color: "#667085",
              fontSize: "11px",
              fontWeight: 800,
            }}
          >
            QUESTION
          </div>

          <div
            style={{
              marginTop: "4px",
              color: "#101828",
              fontSize: "18px",
              fontWeight: 900,
            }}
          >
            {nextQuestionNumber} /{" "}
            {MAX_QUESTIONS}
          </div>
        </div>

        <CategoryBadge
          category={
            question.category
          }
        />
      </div>

      <div
        style={{
          marginTop: "18px",
          width: "100%",
          height: "8px",
          borderRadius: "999px",
          background: "#eaecf0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            borderRadius:
              "999px",
            background: "#2f6fed",
          }}
        />
      </div>

      {/* 문제 정보 */}
      <div
        style={{
          marginTop: "28px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              color: "#98a2b3",
              fontSize: "11px",
              fontWeight: 800,
            }}
          >
            DIFFICULTY{" "}
            {question.difficulty}
          </div>

          {question.category ===
            "grammar" &&
            question.grammar_topic && (
              <TopicBadge
                label={
                  question.grammar_topic
                }
              />
            )}

          {question.category ===
            "listening" &&
            question.listening_topic && (
              <TopicBadge
                label={
                  question.listening_topic
                }
              />
            )}
        </div>

        <h2
          style={{
            margin: "10px 0 0",
            color: "#101828",
            fontSize: "22px",
            lineHeight: 1.55,
            letterSpacing:
              "-0.02em",
            whiteSpace: "pre-wrap",
          }}
        >
          {question.question_text}
        </h2>
      </div>

      {/* Listening 오디오 */}
      {question.category ===
        "listening" &&
        question.audio_url && (
          <div
            style={{
              marginTop: "22px",
              padding: "18px",
              border:
                "1px solid #dbe7ff",
              borderRadius:
                "12px",
              background:
                "#f5f8ff",
            }}
          >
            <div
              style={{
                marginBottom: "10px",
                color: "#2f6fed",
                fontSize: "12px",
                fontWeight: 900,
              }}
            >
              Listening Audio
            </div>

            <audio
              controls
              preload="metadata"
              src={
                question.audio_url
              }
              style={{
                width: "100%",
              }}
            >
              오디오를 재생할 수
              없습니다.
            </audio>
          </div>
        )}

      {question.category ===
        "listening" &&
        !question.audio_url && (
          <div
            style={{
              marginTop: "20px",
              padding: "14px 16px",
              border:
                "1px solid #fecdca",
              borderRadius: "10px",
              background: "#fffbfa",
              color: "#b42318",
              fontSize: "12px",
              lineHeight: 1.6,
            }}
          >
            이 Listening 문항에는
            아직 오디오가 등록되지
            않았습니다.
          </div>
        )}

      {/* 보기 */}
      <div
        style={{
          marginTop: "28px",
          display: "flex",
          flexDirection:
            "column",
          gap: "11px",
        }}
      >
        <ChoiceButton
          letter="A"
          text={
            question.choice_a
          }
          selected={
            selectedAnswer ===
            "A"
          }
          disabled={loading}
          onClick={() =>
            setSelectedAnswer("A")
          }
        />

        <ChoiceButton
          letter="B"
          text={
            question.choice_b
          }
          selected={
            selectedAnswer ===
            "B"
          }
          disabled={loading}
          onClick={() =>
            setSelectedAnswer("B")
          }
        />

        <ChoiceButton
          letter="C"
          text={
            question.choice_c
          }
          selected={
            selectedAnswer ===
            "C"
          }
          disabled={loading}
          onClick={() =>
            setSelectedAnswer("C")
          }
        />

        <ChoiceButton
          letter="D"
          text={
            question.choice_d
          }
          selected={
            selectedAnswer ===
            "D"
          }
          disabled={loading}
          onClick={() =>
            setSelectedAnswer("D")
          }
        />
      </div>

      {/* 테스트 안내 */}
      <div
        style={{
          marginTop: "22px",
          padding: "14px 16px",
          border:
            "1px solid #eaecf0",
          borderRadius: "10px",
          background: "#f9fafb",
          color: "#667085",
          fontSize: "11px",
          lineHeight: 1.7,
        }}
      >
        답변 제출 후 정답과 오답
        여부는 표시되지 않습니다.
        학생의 실제 수준을 정확하게
        확인하기 위한 레벨테스트입니다.
      </div>

      {errorMessage && (
        <div
          style={{
            marginTop: "18px",
            padding: "14px 16px",
            border:
              "1px solid #fda29b",
            borderRadius: "10px",
            background: "#fffbfa",
            color: "#b42318",
            fontSize: "12px",
            fontWeight: 700,
            lineHeight: 1.6,
          }}
        >
          {errorMessage}
        </div>
      )}

      <div
        style={{
          marginTop: "26px",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            color: "#98a2b3",
            fontSize: "11px",
            lineHeight: 1.6,
          }}
        >
          현재 적응형 난이도:{" "}
          Level{" "}
          {currentDifficulty}
        </div>

        <button
          type="button"
          onClick={
            handleAnswer
          }
          disabled={
            loading ||
            !selectedAnswer
          }
          style={{
            minHeight: "48px",
            padding: "0 26px",
            border: "none",
            borderRadius:
              "10px",

            background:
              loading ||
              !selectedAnswer
                ? "#98a2b3"
                : "#0A1F44",

            color: "#ffffff",

            fontFamily:
              "inherit",

            fontSize: "13px",
            fontWeight: 900,

            cursor:
              loading ||
              !selectedAnswer
                ? "default"
                : "pointer",
          }}
        >
          {loading
            ? "답변 처리 중..."
            : answeredCount + 1 >=
              MAX_QUESTIONS
            ? "테스트 완료"
            : "다음 문제"}
        </button>
      </div>
    </section>
  );
}

function ChoiceButton({
  letter,
  text,
  selected,
  disabled,
  onClick,
}: {
  letter: string;
  text: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        minHeight: "58px",
        padding: "12px 16px",

        display: "flex",
        alignItems: "center",
        gap: "13px",

        border: selected
          ? "2px solid #2f6fed"
          : "1px solid #d0d5dd",

        borderRadius: "12px",

        background: selected
          ? "#f5f8ff"
          : "#ffffff",

        color: "#344054",

        fontFamily: "inherit",
        textAlign: "left",

        cursor: disabled
          ? "default"
          : "pointer",

        opacity: disabled
          ? 0.75
          : 1,
      }}
    >
      <span
        style={{
          width: "30px",
          height: "30px",
          flexShrink: 0,

          display:
            "inline-flex",

          alignItems:
            "center",

          justifyContent:
            "center",

          borderRadius:
            "999px",

          background: selected
            ? "#2f6fed"
            : "#f2f4f7",

          color: selected
            ? "#ffffff"
            : "#667085",

          fontSize: "12px",
          fontWeight: 900,
        }}
      >
        {letter}
      </span>

      <span
        style={{
          fontSize: "14px",
          fontWeight: 700,
          lineHeight: 1.6,
        }}
      >
        {text}
      </span>
    </button>
  );
}

function CategoryBadge({
  category,
}: {
  category: string;
}) {
  const listening =
    category ===
    "listening";

  return (
    <span
      style={{
        minHeight: "28px",
        padding: "0 10px",

        display:
          "inline-flex",

        alignItems:
          "center",

        borderRadius:
          "999px",

        background: listening
          ? "#f0f9ff"
          : "#eef4ff",

        color: listening
          ? "#026aa2"
          : "#2f6fed",

        fontSize: "11px",
        fontWeight: 900,
      }}
    >
      {listening
        ? "LISTENING"
        : "GRAMMAR"}
    </span>
  );
}

function TopicBadge({
  label,
}: {
  label: string;
}) {
  return (
    <span
      style={{
        minHeight: "24px",
        padding: "0 8px",

        display:
          "inline-flex",

        alignItems:
          "center",

        borderRadius:
          "999px",

        background: "#f2f4f7",

        color: "#667085",

        fontSize: "10px",
        fontWeight: 800,
      }}
    >
      {label}
    </span>
  );
}

const sectionStyle = {
  marginTop: "24px",
  padding: "28px",

  border:
    "1px solid #e4e7ec",

  borderRadius: "16px",

  background: "#ffffff",
};