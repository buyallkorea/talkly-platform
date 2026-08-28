"use client";

import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Props = {
  levelTestId: number;
  interview: {
    id: number;
    status: string;
    speaking_level: number | null;
    listening_level: number | null;
    pronunciation_level: number | null;
    comprehension_level: number | null;
    suggested_level: string | null;
    strengths: string | null;
    weaknesses: string | null;
    teacher_comment: string | null;
  } | null;
};

export default function InterviewResultForm({
  levelTestId,
  interview,
}: Props) {
  const router = useRouter();

  const [speakingLevel, setSpeakingLevel] =
    useState(
      interview?.speaking_level
        ? String(interview.speaking_level)
        : ""
    );

  const [listeningLevel, setListeningLevel] =
    useState(
      interview?.listening_level
        ? String(interview.listening_level)
        : ""
    );

  const [
    pronunciationLevel,
    setPronunciationLevel,
  ] = useState(
    interview?.pronunciation_level
      ? String(interview.pronunciation_level)
      : ""
  );

  const [
    comprehensionLevel,
    setComprehensionLevel,
  ] = useState(
    interview?.comprehension_level
      ? String(interview.comprehension_level)
      : ""
  );

  const [
    suggestedLevel,
    setSuggestedLevel,
  ] = useState(
    interview?.suggested_level || ""
  );

  const [strengths, setStrengths] =
    useState(
      interview?.strengths || ""
    );

  const [weaknesses, setWeaknesses] =
    useState(
      interview?.weaknesses || ""
    );

  const [
    teacherComment,
    setTeacherComment,
  ] = useState(
    interview?.teacher_comment || ""
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

  async function checkAdmin() {
    const supabase =
      createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(
        "로그인 정보를 확인할 수 없습니다."
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin"
    ) {
      throw new Error(
        "관리자 권한을 확인할 수 없습니다."
      );
    }

    return supabase;
  }

  function parseScore(
    value: string,
    label: string
  ) {
    if (!value) {
      throw new Error(
        `${label} 점수를 입력해주세요.`
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
        `${label} 점수는 1~10 사이의 정수여야 합니다.`
      );
    }

    return numberValue;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!interview?.id) {
      setErrorMessage(
        "먼저 원어민 테스트 일정이 등록되어야 합니다."
      );
      return;
    }

    if (
      interview.status !== "in_progress" &&
      interview.status !== "completed"
    ) {
      setErrorMessage(
        "화상 레벨테스트가 시작된 이후에 평가를 저장할 수 있습니다."
      );
      return;
    }

    if (!suggestedLevel.trim()) {
      setErrorMessage(
        "강사 제안 레벨을 입력해주세요."
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

      const supabase =
        await checkAdmin();

      const now =
        new Date().toISOString();

      const {
        error: interviewUpdateError,
      } = await supabase
        .from(
          "level_test_interviews"
        )
        .update({
          status:
            "completed",

          speaking_level:
            speaking,

          listening_level:
            listening,

          pronunciation_level:
            pronunciation,

          comprehension_level:
            comprehension,

          suggested_level:
            suggestedLevel.trim(),

          strengths:
            strengths.trim() ||
            null,

          weaknesses:
            weaknesses.trim() ||
            null,

          teacher_comment:
            teacherComment.trim() ||
            null,

          completed_at:
            now,

          updated_at:
            now,
        })
        .eq("id", interview.id);

      if (
        interviewUpdateError
      ) {
        setErrorMessage(
          `원어민 테스트 결과 저장 실패: ${interviewUpdateError.message} / code: ${interviewUpdateError.code}`
        );
        return;
      }

      const {
        error: levelTestUpdateError,
      } = await supabase
        .from("level_tests")
        .update({
          interview_status:
            "completed",

          teacher_suggested_level:
            suggestedLevel.trim(),

          status:
            "interview_completed",

          updated_at:
            now,
        })
        .eq("id", levelTestId);

      if (
        levelTestUpdateError
      ) {
        setErrorMessage(
          `레벨테스트 상태 저장 실패: ${levelTestUpdateError.message} / code: ${levelTestUpdateError.code}`
        );
        return;
      }

      setSuccessMessage(
        "원어민 화상 레벨테스트 결과가 저장되었습니다."
      );

      router.refresh();
    } catch (error) {
      console.error(
        "LEVEL TEST INTERVIEW RESULT ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "원어민 테스트 결과 저장 중 알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!interview?.id) {
    return null;
  }

  if (interview.status === "scheduled") {
    return (
      <section style={sectionStyle}>
        <h2 style={titleStyle}>
          원어민 테스트 평가 입력
        </h2>

        <p style={descriptionStyle}>
          화상 레벨테스트가 완료된 후 평가를 입력할 수 있습니다.
        </p>

        <div style={emptyStyle}>
          현재 테스트 상태는 <strong>예정</strong>입니다.
          실제 화상 레벨테스트가 시작되어 상태가
          <strong> 진행 중</strong>으로 변경된 이후에 평가 입력이 활성화됩니다.
        </div>
      </section>
    );
  }

  if (
    interview.status !== "in_progress" &&
    interview.status !== "completed"
  ) {
    return null;
  }

  return (
    <section style={sectionStyle}>
      <div>
        <h2 style={titleStyle}>
          원어민 테스트 평가 입력
        </h2>

        <p style={descriptionStyle}>
          화상 레벨테스트 종료 후
          Speaking, Listening,
          Pronunciation,
          Comprehension 및 강사 의견을
          입력합니다.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          marginTop: "26px",
          display: "flex",
          flexDirection: "column",
          gap: "22px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "14px",
          }}
        >
          <ScoreSelect
            id="speakingLevel"
            label="Speaking"
            value={speakingLevel}
            onChange={setSpeakingLevel}
            disabled={loading}
          />

          <ScoreSelect
            id="listeningLevel"
            label="Listening"
            value={listeningLevel}
            onChange={setListeningLevel}
            disabled={loading}
          />

          <ScoreSelect
            id="pronunciationLevel"
            label="Pronunciation"
            value={pronunciationLevel}
            onChange={
              setPronunciationLevel
            }
            disabled={loading}
          />

          <ScoreSelect
            id="comprehensionLevel"
            label="Comprehension"
            value={comprehensionLevel}
            onChange={
              setComprehensionLevel
            }
            disabled={loading}
          />
        </div>

        <div>
          <label
            htmlFor="suggestedLevel"
            style={labelStyle}
          >
            강사 제안 레벨
          </label>

          <input
            id="suggestedLevel"
            type="text"
            value={suggestedLevel}
            onChange={(event) => {
              setSuggestedLevel(
                event.target.value
              );
              setSuccessMessage("");
            }}
            placeholder="예: TALKLY Level 4"
            disabled={loading}
            style={fieldStyle}
          />
        </div>

        <div>
          <label
            htmlFor="strengths"
            style={labelStyle}
          >
            강점
          </label>

          <textarea
            id="strengths"
            value={strengths}
            onChange={(event) => {
              setStrengths(
                event.target.value
              );
              setSuccessMessage("");
            }}
            rows={4}
            placeholder="학생의 강점을 입력해주세요."
            disabled={loading}
            style={textareaStyle}
          />
        </div>

        <div>
          <label
            htmlFor="weaknesses"
            style={labelStyle}
          >
            보완점
          </label>

          <textarea
            id="weaknesses"
            value={weaknesses}
            onChange={(event) => {
              setWeaknesses(
                event.target.value
              );
              setSuccessMessage("");
            }}
            rows={4}
            placeholder="보완이 필요한 부분을 입력해주세요."
            disabled={loading}
            style={textareaStyle}
          />
        </div>

        <div>
          <label
            htmlFor="teacherComment"
            style={labelStyle}
          >
            강사 의견
          </label>

          <textarea
            id="teacherComment"
            value={teacherComment}
            onChange={(event) => {
              setTeacherComment(
                event.target.value
              );
              setSuccessMessage("");
            }}
            rows={5}
            placeholder="테스트 진행 중 관찰한 내용과 수업 배정 참고사항을 입력해주세요."
            disabled={loading}
            style={textareaStyle}
          />
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
              minHeight: "46px",
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
              ? "저장 중..."
              : "원어민 테스트 결과 저장"}
          </button>
        </div>
      </form>
    </section>
  );
}

function ScoreSelect({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
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
          선택
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

const sectionStyle = {
  marginTop: "22px",
  padding: "26px",
  border: "1px solid #e4e7ec",
  borderRadius: "16px",
  background: "#ffffff",
};

const titleStyle = {
  margin: 0,
  color: "#101828",
  fontSize: "20px",
  letterSpacing: "-0.02em",
};

const descriptionStyle = {
  margin: "8px 0 0",
  color: "#667085",
  fontSize: "13px",
  lineHeight: 1.7,
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
  border: "1px solid #d0d5dd",
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

const emptyStyle = {
  marginTop: "18px",
  padding: "18px",
  border: "1px solid #e4e7ec",
  borderRadius: "11px",
  background: "#f9fafb",
  color: "#667085",
  fontSize: "12px",
  lineHeight: 1.7,
};

const errorStyle = {
  padding: "14px 16px",
  border: "1px solid #fda29b",
  borderRadius: "10px",
  background: "#fffbfa",
  color: "#b42318",
  fontSize: "12px",
  fontWeight: 700,
  lineHeight: 1.6,
};

const successStyle = {
  padding: "14px 16px",
  border: "1px solid #abefc6",
  borderRadius: "10px",
  background: "#ecfdf3",
  color: "#027a48",
  fontSize: "12px",
  fontWeight: 800,
};