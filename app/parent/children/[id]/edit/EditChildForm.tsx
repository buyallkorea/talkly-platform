"use client";

import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase-browser";

type Child = {
  id: number | string;
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
  const router =
    useRouter();

  const [
    name,
    setName,
  ] = useState(
    child.name || ""
  );

  const [
    birthDate,
    setBirthDate,
  ] = useState(
    child.birth_date || ""
  );

  const [
    schoolName,
    setSchoolName,
  ] = useState(
    child.school_name || ""
  );

  const [
    grade,
    setGrade,
  ] = useState(
    child.grade || ""
  );

  const [
    learningGoal,
    setLearningGoal,
  ] = useState(
    child.learning_goal || ""
  );

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage(
        "자녀 이름을 입력해주세요."
      );

      return;
    }

    if (!birthDate) {
      setErrorMessage(
        "생년월일을 입력해주세요."
      );

      return;
    }

    setLoading(true);

    try {
      const supabase =
        createClient();

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        setErrorMessage(
          "로그인 정보를 확인할 수 없습니다."
        );
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from("children")
        .update({
          name:
            name.trim(),
          birth_date:
            birthDate ||
            null,
          school_name:
            schoolName.trim() ||
            null,
          grade:
            grade.trim() ||
            null,
          learning_goal:
            learningGoal.trim() ||
            null,
        })
        .eq(
          "id",
          child.id
        )
        .eq(
          "parent_user_id",
          user.id
        )
        .select();

      console.log(
        "CHILD UPDATE RESULT:",
        {
          data,
          error,
        }
      );

      if (error) {
        setErrorMessage(
          `자녀 정보 수정 실패: ${error.message} / code: ${error.code}`
        );
        return;
      }

      if (
        !data ||
        data.length === 0
      ) {
        setErrorMessage(
          "수정된 자녀 정보를 확인할 수 없습니다."
        );
        return;
      }

      router.push(
        `/parent/children/${child.id}`
      );
      router.refresh();
    } catch (error) {
      console.error(
        "CHILD UPDATE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `자녀 정보 수정 오류: ${error.message}`
          : "자녀 정보 수정 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={
        handleSubmit
      }
    >
      <div
        className="edit-child-grid"
      >
        <Field
          label="자녀 이름"
          description="학생 및 학부모 화면에 표시되는 이름입니다."
        >
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) =>
              setName(
                e.target.value
              )
            }
            required
            disabled={
              loading
            }
            style={
              inputStyle
            }
          />
        </Field>

        <Field
          label="생년월일"
          description="연령 및 레벨테스트 대상 구분에 사용됩니다."
        >
          <input
            id="birthDate"
            type="date"
            value={
              birthDate
            }
            onChange={(e) =>
              setBirthDate(
                e.target.value
              )
            }
            required
            disabled={
              loading
            }
            style={
              inputStyle
            }
          />
        </Field>

        <Field
          label="학교명"
          description="현재 재학 중인 학교를 입력해주세요."
        >
          <input
            id="schoolName"
            type="text"
            value={
              schoolName
            }
            onChange={(e) =>
              setSchoolName(
                e.target.value
              )
            }
            placeholder="예: 토초등학교"
            disabled={
              loading
            }
            style={
              inputStyle
            }
          />
        </Field>

        <Field
          label="학년"
          description="예: 초3, 중1, 고2"
        >
          <input
            id="grade"
            type="text"
            value={grade}
            onChange={(e) =>
              setGrade(
                e.target.value
              )
            }
            placeholder="예: 초3"
            disabled={
              loading
            }
            style={
              inputStyle
            }
          />
        </Field>
      </div>

      <div
        style={{
          marginTop:
            "18px",
        }}
      >
        <Field
          label="학습 목표"
          description="수업 목표나 집중해서 향상하고 싶은 영역을 자유롭게 입력해주세요."
        >
          <textarea
            id="learningGoal"
            value={
              learningGoal
            }
            onChange={(e) =>
              setLearningGoal(
                e.target.value
              )
            }
            rows={5}
            placeholder="예: 영어 말하기 자신감 향상, 학교 영어 보완, 프리토킹"
            disabled={
              loading
            }
            style={{
              ...inputStyle,
              minHeight:
                "130px",
              resize:
                "vertical",
              lineHeight:
                1.7,
            }}
          />
        </Field>
      </div>

      {errorMessage && (
        <div
          style={{
            marginTop:
              "18px",
            padding:
              "14px 16px",
            border:
              "1px solid #f1b5ae",
            borderRadius:
              "10px",
            background:
              "#fff5f4",
            color:
              "#b42318",
            fontSize:
              "13px",
            fontWeight:
              700,
            lineHeight:
              1.6,
          }}
        >
          {errorMessage}
        </div>
      )}

      <div
        style={{
          marginTop:
            "28px",
          paddingTop:
            "22px",
          borderTop:
            "1px solid #e7edf5",
          display:
            "flex",
          justifyContent:
            "flex-end",
          gap: "10px",
          flexWrap:
            "wrap",
        }}
      >
        <button
          type="button"
          onClick={() =>
            router.push(
              `/parent/children/${child.id}`
            )
          }
          disabled={
            loading
          }
          className="talkly-button talkly-button-secondary"
        >
          취소
        </button>

        <button
          type="submit"
          disabled={
            loading
          }
          style={{
            minHeight:
              "48px",
            padding:
              "0 24px",
            border:
              "none",
            borderRadius:
              "10px",
            background:
              loading
                ? "#98a2b3"
                : "var(--talkly-blue)",
            color:
              "#ffffff",
            fontFamily:
              "inherit",
            fontSize:
              "14px",
            fontWeight:
              900,
            cursor:
              loading
                ? "default"
                : "pointer",
            boxShadow:
              loading
                ? "none"
                : "0 8px 20px rgba(47,111,237,0.20)",
          }}
        >
          {loading
            ? "수정 중..."
            : "정보 수정"}
        </button>
      </div>

      <style>{`
        .edit-child-grid {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
          gap: 18px;
        }

        @media(max-width: 760px) {
          .edit-child-grid {
            grid-template-columns:
              1fr;
          }
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children:
    React.ReactNode;
}) {
  return (
    <div>
      <label
        style={
          labelStyle
        }
      >
        {label}
      </label>

      {description && (
        <div
          style={{
            marginBottom:
              "9px",
            color:
              "var(--text-muted)",
            fontSize:
              "12px",
            lineHeight:
              1.55,
          }}
        >
          {description}
        </div>
      )}

      {children}
    </div>
  );
}

const labelStyle = {
  display:
    "block",
  marginBottom:
    "7px",
  color:
    "var(--talkly-navy)",
  fontSize:
    "13px",
  fontWeight:
    800,
};

const inputStyle = {
  width:
    "100%",
  boxSizing:
    "border-box" as const,
  minHeight:
    "48px",
  padding:
    "12px 14px",
  border:
    "1px solid #dce4ee",
  borderRadius:
    "10px",
  background:
    "#ffffff",
  color:
    "#0a1f44",
  fontFamily:
    "inherit",
  fontSize:
    "15px",
  outline:
    "none",
};