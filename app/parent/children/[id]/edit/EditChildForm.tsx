"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Child = {
  id: string;
  name: string;
  birth_date: string | null;
  school_name: string | null;
  grade: string | null;
  learning_goal: string | null;
};

export default function EditChildForm({
  child,
}: {
  child: Child;
}) {
  const router = useRouter();

  const [name, setName] = useState(child.name || "");
  const [birthDate, setBirthDate] = useState(
    child.birth_date || ""
  );
  const [schoolName, setSchoolName] = useState(
    child.school_name || ""
  );
  const [grade, setGrade] = useState(child.grade || "");
  const [learningGoal, setLearningGoal] = useState(
    child.learning_goal || ""
  );

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
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
        setErrorMessage("로그인 정보를 확인할 수 없습니다.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("children")
        .update({
          name: name.trim(),
          birth_date: birthDate || null,
          school_name: schoolName.trim() || null,
          grade: grade.trim() || null,
          learning_goal: learningGoal.trim() || null,
        })
        .eq("id", child.id)
        .eq("parent_user_id", user.id)
        .select();

      console.log("CHILD UPDATE RESULT:", {
        data,
        error,
      });

      if (error) {
        setErrorMessage(
          `자녀 정보 수정 실패: ${error.message} / code: ${error.code}`
        );
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setErrorMessage(
          "수정된 자녀 정보를 확인할 수 없습니다."
        );
        setLoading(false);
        return;
      }

      router.push(`/parent/children/${child.id}`);
      router.refresh();
    } catch (error) {
      console.error("CHILD UPDATE ERROR:", error);

      setErrorMessage(
        error instanceof Error
          ? `자녀 정보 수정 오류: ${error.message}`
          : "자녀 정보 수정 중 오류가 발생했습니다."
      );

      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "12px 14px",
    border: "1px solid #d9d9d9",
    borderRadius: "8px",
    fontSize: "16px",
  };

  const labelStyle = {
    display: "block",
    marginBottom: "8px",
    fontWeight: 600,
  };

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
        <label htmlFor="name" style={labelStyle}>
          자녀 이름
        </label>

        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="birthDate" style={labelStyle}>
          생년월일
        </label>

        <input
          id="birthDate"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          required
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="schoolName" style={labelStyle}>
          학교명
        </label>

        <input
          id="schoolName"
          type="text"
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="grade" style={labelStyle}>
          학년
        </label>

        <input
          id="grade"
          type="text"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="learningGoal" style={labelStyle}>
          학습 목표
        </label>

        <textarea
          id="learningGoal"
          value={learningGoal}
          onChange={(e) => setLearningGoal(e.target.value)}
          rows={4}
          style={{
            ...inputStyle,
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
        {loading ? "수정 중..." : "정보 수정"}
      </button>
    </form>
  );
}