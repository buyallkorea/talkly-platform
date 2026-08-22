"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Props = {
  levelTestId: number;
  parentUserId: string;
  childId: number | null;
  targetGroup: string | null;
  aiStatus: string;
  status: string;
  latestAttempt: {
    id: number;
    status: string;
  } | null;
};

export default function LevelTestStartPanel({
  levelTestId,
  parentUserId,
  targetGroup,
  aiStatus,
  status,
  latestAttempt,
}: Props) {
  const router = useRouter();

  const [loading, setLoading] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function checkParent() {
    const supabase =
      createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      throw new Error(
        "로그인 정보를 확인할 수 없습니다."
      );
    }

    if (
      user.id !==
      parentUserId
    ) {
      throw new Error(
        "학부모 계정 정보를 확인할 수 없습니다."
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
      profile.role !== "parent"
    ) {
      throw new Error(
        "학부모 권한을 확인할 수 없습니다."
      );
    }

    return {
      supabase,
      user,
    };
  }

  async function handleStart() {
    setErrorMessage("");
    setLoading(true);

    try {
      const {
        supabase,
        user,
      } = await checkParent();

      /*
       * 로그인한 학부모의 레벨테스트인지
       * 다시 확인합니다.
       *
       * 기존 자녀 연결 여부(child_id)는
       * 응시 시작 조건으로 사용하지 않습니다.
       * 레벨테스트만 신청한 학생도 응시할 수 있습니다.
       */
      const {
        data: levelTest,
        error: levelTestError,
      } = await supabase
        .from("level_tests")
        .select(`
          id,
          parent_user_id,
          target_group,
          ai_status,
          status
        `)
        .eq(
          "id",
          levelTestId
        )
        .eq(
          "parent_user_id",
          user.id
        )
        .maybeSingle();

      if (
        levelTestError ||
        !levelTest
      ) {
        throw new Error(
          "레벨테스트 정보를 확인할 수 없습니다."
        );
      }

      if (
        levelTest.ai_status ===
          "completed" ||
        levelTest.status ===
          "admin_review" ||
        levelTest.status ===
          "interview_required" ||
        levelTest.status ===
          "interview_scheduled" ||
        levelTest.status ===
          "interview_completed" ||
        levelTest.status ===
          "completed"
      ) {
        throw new Error(
          "이미 응시가 완료된 레벨테스트입니다."
        );
      }

      /*
       * 진행 중인 attempt가 있으면
       * 새로 만들지 않고 그대로 이어갑니다.
       */
      const {
        data: existingAttempt,
        error:
          existingAttemptError,
      } = await supabase
        .from(
          "level_test_attempts"
        )
        .select(`
          id,
          status
        `)
        .eq(
          "level_test_id",
          levelTestId
        )
        .eq(
          "status",
          "in_progress"
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle();

      if (
        existingAttemptError
      ) {
        throw new Error(
          `응시 기록 확인 실패: ${existingAttemptError.message}`
        );
      }

      if (existingAttempt) {
        router.push(
          `/parent/level-tests/${levelTestId}/attempt/${existingAttempt.id}`
        );
        return;
      }

      const now =
        new Date().toISOString();

      /*
       * 새로운 응시 기록 생성
       *
       * 학생 계정이 없는 레벨테스트도 있으므로
       * student_user_id는 필수로 사용하지 않습니다.
       */
      const {
        data: createdAttempt,
        error:
          createAttemptError,
      } = await supabase
        .from(
          "level_test_attempts"
        )
        .insert({
          level_test_id:
            levelTestId,

          student_user_id:
            null,

          target_group:
            levelTest.target_group ||
            targetGroup ||
            "elementary",

          status:
            "in_progress",

          current_difficulty:
            1,

          started_at:
            now,

          created_at:
            now,

          updated_at:
            now,
        })
        .select("id")
        .maybeSingle();

      if (
        createAttemptError
      ) {
        throw new Error(
          `레벨테스트 시작 실패: ${createAttemptError.message} / code: ${createAttemptError.code}`
        );
      }

      if (
        !createdAttempt
      ) {
        throw new Error(
          "응시 기록은 생성되었지만 정보를 확인할 수 없습니다."
        );
      }

      const {
        error:
          levelTestUpdateError,
      } = await supabase
        .from("level_tests")
        .update({
          ai_status:
            "in_progress",

          status:
            "ai_in_progress",

          updated_at:
            now,
        })
        .eq(
          "id",
          levelTestId
        );

      if (
        levelTestUpdateError
      ) {
        throw new Error(
          `레벨테스트 상태 변경 실패: ${levelTestUpdateError.message}`
        );
      }

      router.push(
        `/parent/level-tests/${levelTestId}/attempt/${createdAttempt.id}`
      );
    } catch (error) {
      console.error(
        "LEVEL TEST START ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "레벨테스트 시작 중 알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  const completed =
    aiStatus === "completed" ||
    status === "admin_review" ||
    status === "interview_required" ||
    status === "interview_scheduled" ||
    status === "interview_completed" ||
    status === "completed" ||
    latestAttempt?.status ===
      "completed";

  const inProgress =
    aiStatus ===
      "in_progress" ||
    latestAttempt?.status ===
      "in_progress";

  return (
    <section
      style={{
        marginTop: "22px",
        padding: "26px",
        border:
          "1px solid #e4e7ec",
        borderRadius: "16px",
        background: "#ffffff",
      }}
    >
      <h2
        style={{
          margin: 0,
          color: "#101828",
          fontSize: "20px",
          letterSpacing:
            "-0.02em",
        }}
      >
        AI 레벨테스트 시작
      </h2>

      <p
        style={{
          margin: "8px 0 0",
          color: "#667085",
          fontSize: "13px",
          lineHeight: 1.7,
        }}
      >
        준비가 되면 실제 테스트를
        받을 학생이 직접 문제를
        풀어주세요. 진행 중인 테스트가
        있다면 이어서 진행할 수 있습니다.
      </p>

      <div
        style={{
          marginTop: "22px",
          padding: "18px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "12px",
          background: "#f9fafb",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",
            gap: "14px",
          }}
        >
          <InfoCard
            label="테스트 영역"
            value="Grammar + Listening"
          />

          <InfoCard
            label="예상 소요 시간"
            value="약 15~20분"
          />

          <InfoCard
            label="현재 상태"
            value={
              completed
                ? "완료"
                : inProgress
                ? "진행 중"
                : "시작 전"
            }
          />
        </div>
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
          marginTop: "22px",
          display: "flex",
          justifyContent:
            "flex-end",
        }}
      >
        <button
          type="button"
          onClick={
            handleStart
          }
          disabled={
            loading ||
            completed
          }
          style={{
            minHeight: "48px",
            padding: "0 24px",
            border: "none",
            borderRadius: "10px",

            background:
              loading ||
              completed
                ? "#98a2b3"
                : "#0A1F44",

            color: "#ffffff",
            fontFamily:
              "inherit",
            fontSize: "13px",
            fontWeight: 900,

            cursor:
              loading ||
              completed
                ? "default"
                : "pointer",
          }}
        >
          {loading
            ? "준비 중..."
            : completed
            ? "테스트 완료"
            : inProgress
            ? "테스트 이어서 하기"
            : "AI 레벨테스트 시작"}
        </button>
      </div>
    </section>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          color: "#98a2b3",
          fontSize: "10px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "6px",
          color: "#344054",
          fontSize: "13px",
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}