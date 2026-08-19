"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function ChildForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [grade, setGrade] = useState("");
  const [learningGoal, setLearningGoal] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage(
          `로그인 정보를 확인할 수 없습니다.${
            userError ? ` ${userError.message}` : ""
          }`
        );
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("children")
        .insert({
          parent_user_id: user.id,
          name: name.trim(),
          birth_date: birthDate,
          school_name: schoolName.trim() || null,
          grade: grade.trim() || null,
          learning_goal: learningGoal.trim() || null,
        })
        .select();

      console.log("CHILD INSERT RESULT:", {
        userId: user.id,
        data,
        error,
      });

      if (error) {
        setErrorMessage(
          `자녀 등록 실패: ${error.message} / code: ${error.code}`
        );
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setErrorMessage(
          "등록 요청은 처리되었지만 저장된 자녀 정보를 확인할 수 없습니다."
        );
        setLoading(false);
        return;
      }

      router.push("/parent/children");
      router.refresh();
    } catch (error) {
      console.error("CHILD FORM ERROR:", error);

      setErrorMessage(
        error instanceof Error
          ? `자녀 등록 오류: ${error.message}`
          : "자녀 등록 중 알 수 없는 오류가 발생했습니다."
      );

      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        width: "100%",
        maxWidth: "520px",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <div>
        <label
          htmlFor="child-name"
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: 600,
          }}
        >
          자녀 이름
        </label>

        <input
          id="child-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          placeholder="자녀 이름"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            border: "1px solid #d9d9d9",
            borderRadius: "8px",
            fontSize: "16px",
          }}
        />
      </div>

      <div>
        <label
          htmlFor="birth-date"
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: 600,
          }}
        >
          생년월일
        </label>

        <input
          id="birth-date"
          type="date"
          value={birthDate}
          onChange={(event) => setBirthDate(event.target.value)}
          required
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            border: "1px solid #d9d9d9",
            borderRadius: "8px",
            fontSize: "16px",
          }}
        />
      </div>

      <div>
        <label
          htmlFor="school-name"
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: 600,
          }}
        >
          학교명
        </label>

        <input
          id="school-name"
          type="text"
          value={schoolName}
          onChange={(event) => setSchoolName(event.target.value)}
          placeholder="예: 토클리초등학교"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            border: "1px solid #d9d9d9",
            borderRadius: "8px",
            fontSize: "16px",
          }}
        />
      </div>

      <div>
        <label
          htmlFor="grade"
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: 600,
          }}
        >
          학년
        </label>

        <input
          id="grade"
          type="text"
          value={grade}
          onChange={(event) => setGrade(event.target.value)}
          placeholder="예: 초등학교 3학년"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            border: "1px solid #d9d9d9",
            borderRadius: "8px",
            fontSize: "16px",
          }}
        />
      </div>

      <div>
        <label
          htmlFor="learning-goal"
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: 600,
          }}
        >
          학습 목표
        </label>

        <textarea
          id="learning-goal"
          value={learningGoal}
          onChange={(event) => setLearningGoal(event.target.value)}
          rows={4}
          placeholder="예: 영어 말하기 자신감 향상"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            border: "1px solid #d9d9d9",
            borderRadius: "8px",
            fontSize: "16px",
            resize: "vertical",
          }}
        />
      </div>

      {errorMessage && (
        <div
          style={{
            padding: "12px",
            border: "1px solid #d93025",
            borderRadius: "8px",
            color: "#d93025",
          }}
        >
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "14px",
          border: "none",
          borderRadius: "8px",
          fontSize: "16px",
          fontWeight: 700,
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "등록 중..." : "자녀 등록"}
      </button>
    </form>
  );
}