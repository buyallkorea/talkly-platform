"use client";

import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Props = {
  interviewId: number;
  initialStatus: string;
  meetingUrl: string | null;
  isCurrentInterview: boolean;

  interview: {
    speaking_level: number | null;
    listening_level: number | null;
    pronunciation_level: number | null;
    comprehension_level: number | null;
    suggested_level: string | null;
    strengths: string | null;
    weaknesses: string | null;
    teacher_comment: string | null;
  };
};

export default function LevelTestEvaluationForm({
  interviewId,
  initialStatus,
  meetingUrl,
  isCurrentInterview,
  interview,
}: Props) {
  const router = useRouter();

  const [status, setStatus] =
    useState(initialStatus);

  const [speakingLevel, setSpeakingLevel] =
    useState(
      interview.speaking_level
        ? String(
            interview.speaking_level
          )
        : ""
    );

  const [listeningLevel, setListeningLevel] =
    useState(
      interview.listening_level
        ? String(
            interview.listening_level
          )
        : ""
    );

  const [
    pronunciationLevel,
    setPronunciationLevel,
  ] = useState(
    interview.pronunciation_level
      ? String(
          interview.pronunciation_level
        )
      : ""
  );

  const [
    comprehensionLevel,
    setComprehensionLevel,
  ] = useState(
    interview.comprehension_level
      ? String(
          interview.comprehension_level
        )
      : ""
  );

  const [
    suggestedLevel,
    setSuggestedLevel,
  ] = useState(
    interview.suggested_level || ""
  );

  const [strengths, setStrengths] =
    useState(
      interview.strengths || ""
    );

  const [weaknesses, setWeaknesses] =
    useState(
      interview.weaknesses || ""
    );

  const [
    teacherComment,
    setTeacherComment,
  ] = useState(
    interview.teacher_comment || ""
  );

  const [loading, setLoading] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const isCancelled =
    status === "cancelled" ||
    status === "canceled";

  function parseScore(
    value: string,
    label: string
  ) {
    if (!value) {
      throw new Error(
        `Please select the ${label} score.`
      );
    }

    const numberValue =
      Number(value);

    if (
      !Number.isInteger(numberValue) ||
      numberValue < 1 ||
      numberValue > 10
    ) {
      throw new Error(
        `${label} must be an integer from 1 to 10.`
      );
    }

    return numberValue;
  }

  /*
   * 테스트 시작 + 화상회의 입장
   *
   * 서버에서 먼저 담당 강사와 현재 인터뷰인지
   * 확인하고 status를 in_progress로 바꾼 뒤
   * meeting URL로 이동합니다.
   */
  async function handleStartAndEnter() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!meetingUrl) {
      setErrorMessage(
        "The meeting link has not been registered yet."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/teacher/level-tests/${interviewId}/evaluation`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "start",
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        setErrorMessage(
          result?.error ||
            "Unable to start the level test."
        );
        return;
      }

      setStatus("in_progress");

      /*
       * 새 창 팝업 차단 문제를 피하기 위해
       * 현재 탭에서 회의로 이동합니다.
       * 테스트 종료 후 TALKLY로 돌아와 평가 작성.
       */
      window.location.assign(
        result.meetingUrl ||
          meetingUrl
      );
    } catch (error) {
      console.error(
        "LEVEL TEST START ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to start the level test."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (status !== "in_progress") {
      setErrorMessage(
        "The level test must be started before you can submit the evaluation."
      );
      return;
    }

    if (!suggestedLevel.trim()) {
      setErrorMessage(
        "Please enter your suggested level."
      );
      return;
    }

    setLoading(true);

    try {
      const speaking =
        parseScore(
          speakingLevel,
          "Speaking"
        );

      const listening =
        parseScore(
          listeningLevel,
          "Listening"
        );

      const pronunciation =
        parseScore(
          pronunciationLevel,
          "Pronunciation"
        );

      const comprehension =
        parseScore(
          comprehensionLevel,
          "Comprehension"
        );

      const response = await fetch(
        `/api/teacher/level-tests/${interviewId}/evaluation`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "complete",
            speakingLevel:
              speaking,
            listeningLevel:
              listening,
            pronunciationLevel:
              pronunciation,
            comprehensionLevel:
              comprehension,
            suggestedLevel:
              suggestedLevel.trim(),
            strengths:
              strengths.trim(),
            weaknesses:
              weaknesses.trim(),
            teacherComment:
              teacherComment.trim(),
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        setErrorMessage(
          result?.error ||
            "Unable to save the evaluation."
        );
        return;
      }

      setStatus("completed");

      setSuccessMessage(
        "Your level test evaluation has been submitted successfully."
      );

      router.refresh();
    } catch (error) {
      console.error(
        "LEVEL TEST EVALUATION ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save the evaluation."
      );
    } finally {
      setLoading(false);
    }
  }

  if (
    !isCurrentInterview ||
    isCancelled
  ) {
    return (
      <section style={sectionStyle}>
        <SectionTitle
          title="Teacher Action"
          korean="강사 작업"
          description="This interview is an archived record. No action is available."
          descriptionKo="과거 또는 취소된 인터뷰 기록으로 입장 및 평가 작업을 할 수 없습니다."
        />
      </section>
    );
  }

  if (status === "completed") {
    return (
      <section style={sectionStyle}>
        <SectionTitle
          title="Evaluation Completed"
          korean="평가 제출 완료"
          description="Your evaluation has been submitted and is now waiting for the administrator's final review."
          descriptionKo="강사 평가가 저장되었습니다. 최종 레벨과 추천 과정은 관리자가 확정합니다."
        />

        <div
          style={{
            marginTop: "20px",
            padding: "17px",
            border:
              "1px solid #abefc6",
            borderRadius: "11px",
            background: "#ecfdf3",
            color: "#027a48",
          }}
        >
          <strong>
            Evaluation submitted
            successfully.
          </strong>

          <div
            style={{
              marginTop: "3px",
              fontSize: "11px",
            }}
          >
            평가가 정상적으로 제출되었습니다.
          </div>
        </div>

        <div
          style={{
            marginTop: "18px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "10px",
          }}
        >
          <ResultBox
            label="Speaking"
            value={
              speakingLevel || "-"
            }
          />
          <ResultBox
            label="Listening"
            value={
              listeningLevel || "-"
            }
          />
          <ResultBox
            label="Pronunciation"
            value={
              pronunciationLevel ||
              "-"
            }
          />
          <ResultBox
            label="Comprehension"
            value={
              comprehensionLevel ||
              "-"
            }
          />
        </div>

        <ReadOnlyText
          label="Suggested Level"
          korean="강사 제안 레벨"
          value={
            suggestedLevel || "-"
          }
        />

        <ReadOnlyText
          label="Strengths"
          korean="강점"
          value={strengths || "-"}
        />

        <ReadOnlyText
          label="Areas for Improvement"
          korean="보완점"
          value={weaknesses || "-"}
        />

        <ReadOnlyText
          label="Teacher Comment"
          korean="강사 의견"
          value={
            teacherComment || "-"
          }
        />

        {successMessage && (
          <div style={successStyle}>
            {successMessage}
          </div>
        )}
      </section>
    );
  }

  if (status === "scheduled") {
    return (
      <section style={sectionStyle}>
        <SectionTitle
          title="Start Level Test"
          korean="레벨테스트 시작"
          description="Start the assigned level test and enter the registered video meeting."
          descriptionKo="테스트 시작 버튼을 누르면 진행 중 상태로 변경되고 등록된 화상회의로 이동합니다."
        />

        {!meetingUrl ? (
          <div style={warningStyle}>
            <strong>
              Meeting link not registered.
            </strong>

            <div
              style={{
                marginTop: "4px",
                fontSize: "11px",
              }}
            >
              화상회의 링크가 등록된 후
              테스트를 시작할 수 있습니다.
            </div>
          </div>
        ) : (
          <div
            style={{
              marginTop: "22px",
              display: "flex",
              justifyContent:
                "flex-end",
            }}
          >
            <button
              type="button"
              onClick={
                handleStartAndEnter
              }
              disabled={loading}
              style={{
                minHeight: "48px",
                padding: "0 22px",
                border: "none",
                borderRadius: "10px",
                background: loading
                  ? "#98a2b3"
                  : "#0A1F44",
                color: "#ffffff",
                fontFamily: "inherit",
                fontSize: "13px",
                fontWeight: 900,
                cursor: loading
                  ? "default"
                  : "pointer",
              }}
            >
              {loading
                ? "Starting..."
                : "Start & Enter Level Test ↗"}
            </button>
          </div>
        )}

        {errorMessage && (
          <div style={errorStyle}>
            {errorMessage}
          </div>
        )}
      </section>
    );
  }

  if (status !== "in_progress") {
    return (
      <section style={sectionStyle}>
        <SectionTitle
          title="Teacher Action"
          korean="강사 작업"
          description="No teacher action is currently available for this interview."
          descriptionKo="현재 상태에서는 강사가 진행할 수 있는 작업이 없습니다."
        />
      </section>
    );
  }

  return (
    <section style={sectionStyle}>
      <SectionTitle
        title="Level Test Evaluation"
        korean="레벨테스트 강사 평가"
        description="After completing the interview, evaluate the student's speaking, listening, pronunciation and comprehension."
        descriptionKo="테스트 종료 후 학생의 Speaking, Listening, Pronunciation, Comprehension 및 강사 의견을 입력해주세요."
      />

      {meetingUrl && (
        <div
          style={{
            marginTop: "18px",
            display: "flex",
            justifyContent:
              "flex-end",
          }}
        >
          <a
            href={meetingUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "9px 14px",
              border:
                "1px solid #b2ccff",
              borderRadius: "9px",
              background: "#eef4ff",
              color: "#175cd3",
              textDecoration: "none",
              fontSize: "11px",
              fontWeight: 900,
            }}
          >
            Re-enter Meeting ↗
          </a>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          marginTop: "22px",
          display: "flex",
          flexDirection: "column",
          gap: "21px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(145px, 1fr))",
            gap: "12px",
          }}
        >
          <ScoreSelect
            id="speakingLevel"
            label="Speaking"
            korean="말하기"
            value={speakingLevel}
            onChange={setSpeakingLevel}
            disabled={loading}
          />

          <ScoreSelect
            id="listeningLevel"
            label="Listening"
            korean="듣기"
            value={listeningLevel}
            onChange={setListeningLevel}
            disabled={loading}
          />

          <ScoreSelect
            id="pronunciationLevel"
            label="Pronunciation"
            korean="발음"
            value={pronunciationLevel}
            onChange={
              setPronunciationLevel
            }
            disabled={loading}
          />

          <ScoreSelect
            id="comprehensionLevel"
            label="Comprehension"
            korean="이해도"
            value={comprehensionLevel}
            onChange={
              setComprehensionLevel
            }
            disabled={loading}
          />
        </div>

        <FieldGroup
          label="Suggested Level"
          korean="강사 제안 레벨"
        >
          <input
            type="text"
            value={suggestedLevel}
            onChange={(event) => {
              setSuggestedLevel(
                event.target.value
              );
              setSuccessMessage("");
            }}
            placeholder="e.g. TALKLY Level 4"
            disabled={loading}
            style={fieldStyle}
          />
        </FieldGroup>

        <FieldGroup
          label="Strengths"
          korean="강점"
        >
          <textarea
            value={strengths}
            onChange={(event) => {
              setStrengths(
                event.target.value
              );
              setSuccessMessage("");
            }}
            rows={4}
            placeholder="Describe the student's strengths."
            disabled={loading}
            style={textareaStyle}
          />
        </FieldGroup>

        <FieldGroup
          label="Areas for Improvement"
          korean="보완점"
        >
          <textarea
            value={weaknesses}
            onChange={(event) => {
              setWeaknesses(
                event.target.value
              );
              setSuccessMessage("");
            }}
            rows={4}
            placeholder="Describe areas that need improvement."
            disabled={loading}
            style={textareaStyle}
          />
        </FieldGroup>

        <FieldGroup
          label="Teacher Comment"
          korean="강사 의견"
        >
          <textarea
            value={teacherComment}
            onChange={(event) => {
              setTeacherComment(
                event.target.value
              );
              setSuccessMessage("");
            }}
            rows={5}
            placeholder="Add observations and notes for the administrator."
            disabled={loading}
            style={textareaStyle}
          />
        </FieldGroup>

        <div
          style={{
            padding: "14px 16px",
            border:
              "1px solid #dbe7ff",
            borderRadius: "10px",
            background: "#f7faff",
            color: "#344054",
            fontSize: "11px",
            lineHeight: 1.65,
          }}
        >
          <strong>
            Your suggested level is a
            teacher recommendation only.
          </strong>
          <br />
          강사는 학생의 레벨을 제안합니다.
          최종 레벨과 추천 교육과정은 TALKLY
          관리자가 확정합니다.
        </div>

        {errorMessage && (
          <div style={errorStyle}>
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div style={successStyle}>
            {successMessage}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent:
              "flex-end",
          }}
        >
          <button
            type="submit"
            disabled={loading}
            style={{
              minHeight: "48px",
              padding: "0 22px",
              border: "none",
              borderRadius: "10px",
              background: loading
                ? "#98a2b3"
                : "#0A1F44",
              color: "#ffffff",
              fontFamily: "inherit",
              fontSize: "13px",
              fontWeight: 900,
              cursor: loading
                ? "default"
                : "pointer",
            }}
          >
            {loading
              ? "Submitting..."
              : "Submit Evaluation"}
          </button>
        </div>
      </form>
    </section>
  );
}

function SectionTitle({
  title,
  korean,
  description,
  descriptionKo,
}: {
  title: string;
  korean: string;
  description: string;
  descriptionKo: string;
}) {
  return (
    <div>
      <div
        style={{
          color: "#2f6fed",
          fontSize: "10px",
          fontWeight: 900,
          letterSpacing: "0.08em",
        }}
      >
        TEACHER ACTION
      </div>

      <h2
        style={{
          margin: "6px 0 0",
          fontSize: "22px",
        }}
      >
        {title}
      </h2>

      <div
        style={{
          marginTop: "3px",
          fontSize: "11px",
          color: "#98a2b3",
        }}
      >
        {korean}
      </div>

      <p
        style={{
          margin: "14px 0 0",
          fontSize: "13px",
          lineHeight: 1.7,
          color: "#475467",
        }}
      >
        {description}
      </p>

      <div
        style={{
          marginTop: "3px",
          fontSize: "11px",
          lineHeight: 1.6,
          color: "#98a2b3",
        }}
      >
        {descriptionKo}
      </div>
    </div>
  );
}

function ScoreSelect({
  id,
  label,
  korean,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  korean: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        style={labelStyle}
      >
        {label}

        <span
          style={{
            display: "block",
            marginTop: "2px",
            color: "#98a2b3",
            fontSize: "10px",
            fontWeight: 500,
          }}
        >
          {korean}
        </span>
      </label>

      <select
        id={id}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        disabled={disabled}
        style={fieldStyle}
      >
        <option value="">
          Select
        </option>

        {Array.from(
          { length: 10 },
          (_, index) =>
            index + 1
        ).map((score) => (
          <option
            key={score}
            value={score}
          >
            {score}
          </option>
        ))}
      </select>
    </div>
  );
}

function FieldGroup({
  label,
  korean,
  children,
}: {
  label: string;
  korean: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={labelStyle}>
        {label}

        <span
          style={{
            display: "block",
            marginTop: "2px",
            color: "#98a2b3",
            fontSize: "10px",
            fontWeight: 500,
          }}
        >
          {korean}
        </span>
      </div>

      {children}
    </div>
  );
}

function ResultBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "15px",
        border:
          "1px solid #e4e7ec",
        borderRadius: "10px",
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "10px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "6px",
          fontSize: "21px",
          fontWeight: 900,
        }}
      >
        {value} / 10
      </div>
    </div>
  );
}

function ReadOnlyText({
  label,
  korean,
  value,
}: {
  label: string;
  korean: string;
  value: string;
}) {
  return (
    <div
      style={{
        marginTop: "15px",
        padding: "15px",
        border:
          "1px solid #e4e7ec",
        borderRadius: "10px",
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 900,
          color: "#344054",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "2px",
          fontSize: "10px",
          color: "#98a2b3",
        }}
      >
        {korean}
      </div>

      <div
        style={{
          marginTop: "8px",
          fontSize: "13px",
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const sectionStyle = {
  marginTop: "20px",
  padding: "26px",
  border: "1px solid #e4e7ec",
  borderRadius: "16px",
  background: "#ffffff",
};

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  color: "#344054",
  fontSize: "13px",
  fontWeight: 800,
};

const fieldStyle = {
  width: "100%",
  minHeight: "46px",
  boxSizing:
    "border-box" as const,
  padding: "0 14px",
  border:
    "1px solid #d0d5dd",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "14px",
  outline: "none",
};

const textareaStyle = {
  ...fieldStyle,
  minHeight: "110px",
  padding: "13px 14px",
  resize: "vertical" as const,
  lineHeight: 1.7,
};

const warningStyle = {
  marginTop: "20px",
  padding: "16px",
  border:
    "1px solid #fedf89",
  borderRadius: "10px",
  background: "#fffaeb",
  color: "#93370d",
  fontSize: "12px",
  lineHeight: 1.6,
};

const errorStyle = {
  marginTop: "14px",
  padding: "14px 16px",
  border:
    "1px solid #fda29b",
  borderRadius: "10px",
  background: "#fffbfa",
  color: "#b42318",
  fontSize: "12px",
  fontWeight: 700,
  lineHeight: 1.6,
};

const successStyle = {
  marginTop: "14px",
  padding: "14px 16px",
  border:
    "1px solid #abefc6",
  borderRadius: "10px",
  background: "#ecfdf3",
  color: "#027a48",
  fontSize: "12px",
  fontWeight: 800,
};