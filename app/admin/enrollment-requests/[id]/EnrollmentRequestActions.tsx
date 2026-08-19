"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Teacher = {
  user_id: string;
  display_name: string | null;
};

export default function EnrollmentRequestActions({
  requestId,
  status,
  teachers,
  initialTeacherUserId,
  initialCurriculum,
  initialAdminNote,
}: {
  requestId: number;
  status: string;
  teachers: Teacher[];
  initialTeacherUserId: string;
  initialCurriculum: string;
  initialAdminNote: string;
}) {
  const router = useRouter();

  const [
    teacherUserId,
    setTeacherUserId,
  ] = useState(
    initialTeacherUserId
  );

  const [
    curriculum,
    setCurriculum,
  ] = useState(
    initialCurriculum
  );

  const [
    adminNote,
    setAdminNote,
  ] = useState(
    initialAdminNote
  );

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function sendAction(
    action: "approve" | "reject"
  ) {
    if (loading) {
      return;
    }

    if (
      action === "approve" &&
      !teacherUserId
    ) {
      setErrorMessage(
        "승인하려면 담당 강사를 선택해주세요."
      );
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const response =
        await fetch(
          `/api/admin/enrollment-requests/${requestId}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action,

                teacherUserId:
                  teacherUserId ||
                  null,

                curriculum:
                  curriculum.trim() ||
                  null,

                adminNote:
                  adminNote.trim() ||
                  null,
              }),
          }
        );

      const rawText =
        await response.text();

      let result: {
        success?: boolean;
        error?: string;
        enrollmentId?: number;
        sessionsCreated?: number;
      } = {};

      if (rawText) {
        try {
          result =
            JSON.parse(rawText);
        } catch {
          throw new Error(
            `서버 응답을 해석할 수 없습니다. HTTP ${response.status}`
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            `처리에 실패했습니다. HTTP ${response.status}`
        );
      }

      router.push(
        "/admin/enrollment-requests"
      );

      router.refresh();
    } catch (error) {
      console.error(
        "[Enrollment Request Action]",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "수강신청 처리 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        marginTop: "22px",
        padding: "24px",
        border:
          "1px solid rgba(255,255,255,0.15)",
        borderRadius: "14px",
      }}
    >
      <h2
        style={{
          marginTop: 0,
        }}
      >
        승인 처리
      </h2>

      <div
        style={{
          display: "grid",
          gap: "16px",
        }}
      >
        <div>
          <label
            style={labelStyle}
          >
            담당 강사
          </label>

          <select
            value={teacherUserId}
            onChange={(e) =>
              setTeacherUserId(
                e.target.value
              )
            }
            style={fieldStyle}
            disabled={
              status !== "pending" ||
              loading
            }
          >
            <option value="">
              강사 선택
            </option>

            {teachers.map(
              (teacher) => (
                <option
                  key={
                    teacher.user_id
                  }
                  value={
                    teacher.user_id
                  }
                >
                  {teacher.display_name ||
                    "이름 미등록 강사"}
                </option>
              )
            )}
          </select>
        </div>

        <div>
          <label
            style={labelStyle}
          >
            커리큘럼 / 교재
          </label>

          <input
            value={curriculum}
            onChange={(e) =>
              setCurriculum(
                e.target.value
              )
            }
            style={fieldStyle}
            disabled={
              status !== "pending" ||
              loading
            }
          />
        </div>

        <div>
          <label
            style={labelStyle}
          >
            관리자 메모
          </label>

          <textarea
            rows={4}
            value={adminNote}
            onChange={(e) =>
              setAdminNote(
                e.target.value
              )
            }
            style={{
              ...fieldStyle,
              resize: "vertical",
            }}
            disabled={
              status !== "pending" ||
              loading
            }
          />
        </div>
      </div>

      {errorMessage && (
        <div
          style={{
            marginTop: "16px",
            padding: "14px 16px",
            border:
              "1px solid rgba(217,48,37,.45)",
            borderRadius: "10px",
            background:
              "rgba(217,48,37,.08)",
            color: "#ff9d95",
            lineHeight: 1.6,
          }}
        >
          {errorMessage}
        </div>
      )}

      {status === "pending" && (
        <div
          style={{
            marginTop: "20px",
            display: "flex",
            justifyContent:
              "flex-end",
            gap: "10px",
          }}
        >
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              sendAction(
                "reject"
              )
            }
            style={{
              ...buttonStyle,

              background:
                "rgba(217,48,37,.12)",

              color:
                "#ff9d95",

              opacity:
                loading
                  ? 0.55
                  : 1,
            }}
          >
            반려
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              sendAction(
                "approve"
              )
            }
            style={{
              ...buttonStyle,

              background:
                "#2f6fed",

              color:
                "#ffffff",

              opacity:
                loading
                  ? 0.65
                  : 1,
            }}
          >
            {loading
              ? "처리 중..."
              : "승인 및 수강 생성"}
          </button>
        </div>
      )}
    </section>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: "7px",
  fontSize: "13px",
  fontWeight: 800,
};

const fieldStyle = {
  width: "100%",
  boxSizing:
    "border-box" as const,
  padding: "12px",
  border:
    "1px solid rgba(255,255,255,.18)",
  borderRadius: "9px",
  background:
    "rgba(255,255,255,.06)",
  color: "inherit",
  fontFamily: "inherit",
};

const buttonStyle = {
  minHeight: "46px",
  padding: "0 18px",
  border: 0,
  borderRadius: "9px",
  fontWeight: 900,
  cursor: "pointer",
};