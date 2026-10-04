"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type EvaluationType = "monthly" | "final";

type Props = {
  sessionId: number;
  evaluationType: EvaluationType;
  periodNumber: number | null;
  initialEvaluation: {
    id: number;
    participation_score: number | null;
    comprehension_score: number | null;
    speaking_score: number | null;
    pronunciation_score: number | null;
    strengths: string | null;
    improvements: string | null;
    homework: string | null;
    teacher_comment: string | null;
  } | null;
};

function Score({
  title,
  ko,
  value,
  setValue,
}: {
  title: string;
  ko: string;
  value: number | null;
  setValue: (n: number) => void;
}) {
  return (
    <div>
      <strong>{title}</strong>
      <div style={{ fontSize: 12, opacity: 0.55, margin: "3px 0 10px" }}>
        {ko}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setValue(n)}
            style={{
              width: 42,
              height: 42,
              borderRadius: 8,
              border: value === n ? "2px solid #111" : "1px solid #ccc",
              background: value === n ? "#f2f2f2" : "#fff",
              fontWeight: value === n ? 700 : 400,
              cursor: "pointer",
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function EvaluationForm({
  sessionId,
  evaluationType,
  periodNumber,
  initialEvaluation,
}: Props) {
  const router = useRouter();

  const isFinal = evaluationType === "final";

  const evaluationTitle = isFinal
    ? "Final Teacher Evaluation"
    : `Month ${periodNumber ?? 1} Teacher Evaluation`;

  const evaluationTitleKo = isFinal
    ? "최종 강사 종합평가"
    : `${periodNumber ?? 1}개월 학습평가`;

  const [participation, setParticipation] = useState<number | null>(
    initialEvaluation?.participation_score ?? null
  );
  const [comprehension, setComprehension] = useState<number | null>(
    initialEvaluation?.comprehension_score ?? null
  );
  const [speaking, setSpeaking] = useState<number | null>(
    initialEvaluation?.speaking_score ?? null
  );
  const [pronunciation, setPronunciation] = useState<number | null>(
    initialEvaluation?.pronunciation_score ?? null
  );
  const [strengths, setStrengths] = useState(
    initialEvaluation?.strengths ?? ""
  );
  const [improvements, setImprovements] = useState(
    initialEvaluation?.improvements ?? ""
  );
  const [homework, setHomework] = useState(
    initialEvaluation?.homework ?? ""
  );
  const [comment, setComment] = useState(
    initialEvaluation?.teacher_comment ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | ""
  >("");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setMessageType("");

    if (
      [participation, comprehension, speaking, pronunciation].some(
        (value) => value === null
      )
    ) {
      setMessageType("error");
      setMessage(
        "Please select all four scores. / 4개 종합평가 점수를 모두 선택해주세요."
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `/api/teacher/classes/${sessionId}/final-evaluation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            participationScore: participation,
            comprehensionScore: comprehension,
            speakingScore: speaking,
            pronunciationScore: pronunciation,
            strengths: strengths.trim() || null,
            improvements: improvements.trim() || null,
            homework: homework.trim() || null,
            teacherComment: comment.trim() || null,
          }),
        }
      );

      const contentType =
        response.headers.get("content-type") ?? "";

      const data = contentType.includes("application/json")
        ? await response.json()
        : null;

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `${evaluationTitle} save failed. (HTTP ${response.status})`
        );
      }

      setMessageType("success");
      setMessage(
        initialEvaluation
          ? `${evaluationTitle} updated. / ${evaluationTitleKo}가 수정되었습니다.`
          : `${evaluationTitle} saved. / ${evaluationTitleKo}가 저장되었습니다.`
      );

      router.refresh();
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "학생 종합평가 저장 중 오류가 발생했습니다."
      );
    } finally {
      setSaving(false);
    }
  }

  const textareaStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 100,
    padding: 12,
    border: "1px solid #ccc",
    borderRadius: 8,
    boxSizing: "border-box",
    resize: "vertical",
    font: "inherit",
  };

  return (
    <form onSubmit={save} style={{ marginTop: 22 }}>
      <div
        style={{
          padding: "14px 16px",
          marginBottom: 24,
          border: "1px solid #dbe6f5",
          borderRadius: 10,
          background: "#f7faff",
          lineHeight: 1.65,
          fontSize: 13,
        }}
      >
        <strong>{evaluationTitle}</strong>

        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            fontWeight: 700,
            color: "#175cd3",
          }}
        >
          {evaluationTitleKo}
        </div>

        {isFinal ? (
          <>
            <p style={{ margin: "10px 0 0" }}>
              Evaluate the student&apos;s overall progress throughout
              the course.
            </p>
            <div
              style={{
                marginTop: 4,
                opacity: 0.65,
                fontSize: 12,
              }}
            >
              전체 수강기간의 참여도, 이해도, 말하기, 발음 및
              학습 성장을 종합하여 평가해 주세요.
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: "10px 0 0" }}>
              Evaluate the student&apos;s progress during this
              four-week learning period.
            </p>
            <div
              style={{
                marginTop: 4,
                opacity: 0.65,
                fontSize: 12,
              }}
            >
              수강 시작일부터 해당 4주 학습기간 동안의 참여도,
              이해도, 말하기, 발음 및 학습 성장을 종합하여
              평가해 주세요. 매 수업마다 작성하는 평가는 아닙니다.
            </div>
          </>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 24,
        }}
      >
        <Score
          title="Participation"
          ko="학습 참여도"
          value={participation}
          setValue={setParticipation}
        />
        <Score
          title="Comprehension"
          ko="학습 이해도"
          value={comprehension}
          setValue={setComprehension}
        />
        <Score
          title="Speaking"
          ko="말하기 능력"
          value={speaking}
          setValue={setSpeaking}
        />
        <Score
          title="Pronunciation"
          ko="발음"
          value={pronunciation}
          setValue={setPronunciation}
        />
      </div>

      <div
        style={{
          marginTop: 28,
          display: "grid",
          gap: 20,
        }}
      >
        <label>
          <strong>Overall Strengths</strong>
          <div
            style={{
              fontSize: 12,
              opacity: 0.55,
              marginBottom: 8,
            }}
          >
            {isFinal
              ? "전체 수강기간에서 잘한 점"
              : "이번 4주 학습기간에서 잘한 점"}
          </div>
          <textarea
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            style={textareaStyle}
          />
        </label>

        <label>
          <strong>Areas for Improvement</strong>
          <div
            style={{
              fontSize: 12,
              opacity: 0.55,
              marginBottom: 8,
            }}
          >
            보완이 필요한 부분
          </div>
          <textarea
            value={improvements}
            onChange={(e) => setImprovements(e.target.value)}
            style={textareaStyle}
          />
        </label>

        <label>
          <strong>Next Study Recommendation</strong>
          <div
            style={{
              fontSize: 12,
              opacity: 0.55,
              marginBottom: 8,
            }}
          >
            다음 학습을 위한 과제·추천
          </div>
          <textarea
            value={homework}
            onChange={(e) => setHomework(e.target.value)}
            style={textareaStyle}
          />
        </label>

        <label>
          <strong>
            {isFinal
              ? "Final Teacher Comment"
              : "Monthly Teacher Comment"}
          </strong>
          <div
            style={{
              fontSize: 12,
              opacity: 0.55,
              marginBottom: 8,
            }}
          >
            {isFinal
              ? "강사 최종 종합 코멘트"
              : "이번 학습기간에 대한 강사 종합 코멘트"}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={textareaStyle}
          />
        </label>
      </div>

      {message && (
        <div
          style={{
            marginTop: 18,
            padding: 12,
            border:
              messageType === "success"
                ? "1px solid #b9dfc8"
                : "1px solid #efc2c2",
            background:
              messageType === "success"
                ? "#f0fbf4"
                : "#fff5f5",
            color:
              messageType === "success"
                ? "#237447"
                : "#a33b3b",
            borderRadius: 8,
          }}
        >
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        style={{
          marginTop: 20,
          padding: "12px 18px",
          border: "1px solid #ccc",
          borderRadius: 8,
          background: "#fff",
          fontWeight: 700,
          cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        {saving
          ? "Saving..."
          : initialEvaluation
            ? `Update ${isFinal ? "Final" : "Monthly"} Evaluation`
            : `Save ${isFinal ? "Final" : "Monthly"} Evaluation`}

        <span
          style={{
            display: "block",
            fontSize: 11,
            opacity: 0.55,
            fontWeight: 400,
          }}
        >
          {initialEvaluation
            ? `${evaluationTitleKo} 수정`
            : `${evaluationTitleKo} 저장`}
        </span>
      </button>
    </form>
  );
}