"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  enrollmentId: number;
  teacherName: string;
  courseName: string | null;
};

type ScoreKey =
  | "attitudeScore"
  | "lessonQualityScore"
  | "explanationScore"
  | "communicationScore"
  | "preparationScore"
  | "satisfactionScore";

type Scores = Record<ScoreKey, number | null>;

const QUESTIONS: {
  key: ScoreKey;
  title: string;
  description: string;
}[] = [
  {
    key: "attitudeScore",
    title:
      "강사는 수업 시간에 성실하고 책임감 있는 태도로 수업을 진행했나요?",
    description:
      "시간 준수, 수업 태도, 학생을 대하는 자세 등을 생각해 주세요.",
  },
  {
    key: "lessonQualityScore",
    title:
      "수업 내용은 나의 수준과 학습목표에 맞게 구성되었나요?",
    description:
      "수업의 난이도와 내용 구성이 적절했는지 평가해 주세요.",
  },
  {
    key: "explanationScore",
    title:
      "강사의 설명은 이해하기 쉽고 명확했나요?",
    description:
      "문법, 어휘, 표현 등에 대한 설명이 이해에 도움이 되었는지 평가해 주세요.",
  },
  {
    key: "communicationScore",
    title:
      "강사는 나의 말을 잘 듣고 적극적으로 소통했나요?",
    description:
      "질문에 대한 반응과 대화 유도, 상호작용을 생각해 주세요.",
  },
  {
    key: "preparationScore",
    title:
      "강사는 수업 준비를 충분히 하고 수업을 체계적으로 진행했나요?",
    description:
      "교재 활용, 수업 흐름, 준비 정도 등을 평가해 주세요.",
  },
  {
    key: "satisfactionScore",
    title:
      "이번 수강에서 전반적으로 강사의 수업에 만족했나요?",
    description:
      "전체 수강 경험을 종합해서 평가해 주세요.",
  },
];

export default function TeacherReviewForm({
  enrollmentId,
  teacherName,
  courseName,
}: Props) {
  const router = useRouter();

  const [scores, setScores] = useState<Scores>({
    attitudeScore: null,
    lessonQualityScore: null,
    explanationScore: null,
    communicationScore: null,
    preparationScore: null,
    satisfactionScore: null,
  });

  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = Object.values(scores).every(
    (score) => typeof score === "number"
  );

  const average = useMemo(() => {
    const values = Object.values(scores).filter(
      (score): score is number => typeof score === "number"
    );

    if (values.length !== QUESTIONS.length) {
      return null;
    }

    return (
      values.reduce((sum, value) => sum + value, 0) /
      values.length
    ).toFixed(1);
  }, [scores]);

  function setScore(key: ScoreKey, score: number) {
    setScores((current) => ({
      ...current,
      [key]: score,
    }));
  }

  async function submitReview() {
    if (submitting || !allAnswered) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/teacher-reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enrollmentId,
          ...scores,
          comment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "강사 평가 등록에 실패했습니다."
        );
      }

      router.replace(
        `/student/teacher-reviews/${enrollmentId}?submitted=1`
      );
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "강사 평가 등록 중 오류가 발생했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <section
        className="talkly-card"
        style={{
          padding: "24px",
          border: "1px solid #dbe7ff",
          background: "#f7faff",
        }}
      >
        <div
          style={{
            color: "var(--talkly-blue)",
            fontSize: "11px",
            fontWeight: 900,
            letterSpacing: "0.08em",
          }}
        >
          REVIEW TARGET
        </div>

        <h2
          style={{
            margin: "7px 0 0",
            color: "var(--talkly-navy)",
            fontSize: "22px",
          }}
        >
          {teacherName} 강사
        </h2>

        <p
          style={{
            margin: "7px 0 0",
            color: "var(--text-secondary)",
            fontSize: "14px",
          }}
        >
          {courseName || "수강 과정"}
        </p>

        <div
          style={{
            marginTop: "15px",
            color: "var(--text-muted)",
            fontSize: "12px",
            lineHeight: 1.7,
          }}
        >
          평가 내용은 담당 강사와 TALKLY 관리자에게 전달됩니다.
          강사에게는 평가를 작성한 학생의 이름이나 계정정보가 표시되지 않습니다.
        </div>
      </section>

      {QUESTIONS.map((question, questionIndex) => (
        <section
          key={question.key}
          className="talkly-card"
          style={{ padding: "24px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "9px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background: "var(--talkly-blue-soft)",
                color: "var(--talkly-blue)",
                fontWeight: 900,
                fontSize: "13px",
              }}
            >
              {questionIndex + 1}
            </div>

            <div>
              <h3
                style={{
                  margin: 0,
                  color: "var(--talkly-navy)",
                  fontSize: "17px",
                  lineHeight: 1.55,
                }}
              >
                {question.title}
              </h3>

              <p
                style={{
                  margin: "6px 0 0",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                  lineHeight: 1.65,
                }}
              >
                {question.description}
              </p>
            </div>
          </div>

          <div
            className="teacher-review-score-grid"
            style={{
              marginTop: "18px",
              display: "grid",
              gridTemplateColumns: "repeat(10, minmax(36px, 1fr))",
              gap: "7px",
            }}
          >
            {Array.from({ length: 10 }, (_, index) => index + 1).map(
              (score) => {
                const selected = scores[question.key] === score;

                return (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setScore(question.key, score)}
                    aria-pressed={selected}
                    disabled={submitting}
                    style={{
                      minHeight: "44px",
                      border: selected
                        ? "1px solid var(--talkly-blue)"
                        : "1px solid var(--border)",
                      borderRadius: "10px",
                      background: selected
                        ? "var(--talkly-blue)"
                        : "#ffffff",
                      color: selected
                        ? "#ffffff"
                        : "var(--talkly-navy)",
                      fontWeight: 900,
                      cursor: submitting ? "default" : "pointer",
                    }}
                  >
                    {score}
                  </button>
                );
              }
            )}
          </div>

          <div
            style={{
              marginTop: "9px",
              display: "flex",
              justifyContent: "space-between",
              color: "var(--text-muted)",
              fontSize: "11px",
            }}
          >
            <span>1 · 전혀 그렇지 않다</span>
            <span>10 · 매우 그렇다</span>
          </div>
        </section>
      ))}

      <section className="talkly-card" style={{ padding: "24px" }}>
        <label
          htmlFor="teacher-review-comment"
          style={{
            display: "block",
            color: "var(--talkly-navy)",
            fontSize: "17px",
            fontWeight: 900,
          }}
        >
          강사의 수업에 대해 좋았던 점이나 아쉬웠던 점이 있다면 자유롭게 작성해주세요.
        </label>

        <p
          style={{
            margin: "7px 0 0",
            color: "var(--text-muted)",
            fontSize: "12px",
          }}
        >
          선택사항 · 최대 2,000자
        </p>

        <textarea
          id="teacher-review-comment"
          value={comment}
          maxLength={2000}
          disabled={submitting}
          onChange={(event) => setComment(event.target.value)}
          placeholder="수업에서 좋았던 점, 도움이 된 점, 개선되었으면 하는 점 등을 작성해주세요."
          style={{
            width: "100%",
            minHeight: "150px",
            marginTop: "15px",
            padding: "15px",
            boxSizing: "border-box",
            resize: "vertical",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            background: "#ffffff",
            color: "var(--talkly-navy)",
            fontSize: "14px",
            lineHeight: 1.7,
            fontFamily: "inherit",
            outline: "none",
          }}
        />

        <div
          style={{
            marginTop: "6px",
            textAlign: "right",
            color: "var(--text-muted)",
            fontSize: "11px",
          }}
        >
          {comment.length.toLocaleString("ko-KR")} / 2,000
        </div>
      </section>

      {error && (
        <div
          role="alert"
          style={{
            padding: "15px 17px",
            border: "1px solid #fecdca",
            borderRadius: "11px",
            background: "#fef3f2",
            color: "#b42318",
            fontSize: "13px",
            lineHeight: 1.6,
          }}
        >
          {error}
        </div>
      )}

      <section
        className="talkly-card"
        style={{
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: "var(--text-muted)",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            현재 선택 점수
          </div>

          <div
            style={{
              marginTop: "5px",
              color: "var(--talkly-navy)",
              fontSize: "22px",
              fontWeight: 900,
            }}
          >
            {average
              ? `${average} / 10`
              : "6개 문항을 모두 평가해주세요."}
          </div>
        </div>

        <button
          type="button"
          onClick={submitReview}
          disabled={!allAnswered || submitting}
          className="talkly-button talkly-button-primary"
          style={{
            minHeight: "46px",
            opacity: !allAnswered || submitting ? 0.55 : 1,
            cursor:
              !allAnswered || submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "평가 등록 중..." : "강사 평가 제출"}
        </button>
      </section>

      <style>{`
        @media (max-width: 720px) {
          .teacher-review-score-grid {
            grid-template-columns: repeat(5, minmax(40px, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  );
}