"use client";

import Link from "next/link";
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
  enrollmentId,
}: {
  requestId: number;
  status: string;
  teachers: Teacher[];
  initialTeacherUserId: string;
  initialCurriculum: string;
  initialAdminNote: string;
  enrollmentId: number | null;
}) {
  const router = useRouter();

  const [
    teacherUserId,
    setTeacherUserId,
  ] = useState(initialTeacherUserId);

  const [
    curriculum,
    setCurriculum,
  ] = useState(initialCurriculum);

  const [
    adminNote,
    setAdminNote,
  ] = useState(initialAdminNote);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const selectedTeacher =
    teachers.find(
      (teacher) =>
        teacher.user_id ===
        teacherUserId
    );

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

            body: JSON.stringify({
              action,

              teacherUserId:
                teacherUserId || null,

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

  /*
   * 승인 대기 상태
   */
  if (status === "pending") {
    return (
      <section style={sectionStyle}>
        <h2 style={titleStyle}>
          승인 처리
        </h2>

        <p style={descriptionStyle}>
          담당 강사와 커리큘럼을 지정한 후
          수강신청을 승인합니다. 승인하면 실제
          수강정보와 전체 수업 일정이 자동으로
          생성됩니다.
        </p>

        <div
          style={{
            marginTop: "24px",
            display: "grid",
            gap: "20px",
          }}
        >
          <div>
            <label style={labelStyle}>
              담당 강사 *
            </label>

            <select
              value={teacherUserId}
              onChange={(e) =>
                setTeacherUserId(
                  e.target.value
                )
              }
              style={fieldStyle}
              disabled={loading}
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
            <label style={labelStyle}>
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
              disabled={loading}
              placeholder="예: TALKLY Elementary 1 / 자체 교재"
            />
          </div>

          <div>
            <label style={labelStyle}>
              관리자 메모
            </label>

            <textarea
              rows={5}
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
              disabled={loading}
              placeholder="수강신청 및 승인과 관련한 관리자 메모를 입력하세요."
            />
          </div>
        </div>

        {errorMessage && (
          <ErrorBox>
            {errorMessage}
          </ErrorBox>
        )}

        <div
          style={{
            marginTop: "24px",
            display: "flex",
            justifyContent:
              "flex-end",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              sendAction("reject")
            }
            style={{
              ...buttonStyle,
              background: "#ffffff",
              color: "#c0392b",
              border:
                "1px solid rgba(192,57,43,.25)",
              opacity:
                loading ? 0.55 : 1,
            }}
          >
            반려
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              sendAction("approve")
            }
            style={{
              ...buttonStyle,
              background: "#082554",
              color: "#ffffff",
              border:
                "1px solid #082554",
              opacity:
                loading ? 0.65 : 1,
            }}
          >
            {loading
              ? "처리 중..."
              : "승인 및 수강 생성"}
          </button>
        </div>
      </section>
    );
  }

  /*
   * 승인 완료
   */
  if (status === "approved") {
    return (
      <section style={sectionStyle}>
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "flex-start",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={titleStyle}>
              승인 처리 결과
            </h2>

            <p style={descriptionStyle}>
              수강신청 승인이 완료되어 실제
              수강과 수업 일정이 생성되었습니다.
            </p>
          </div>

          <div
            style={{
              padding: "8px 13px",
              borderRadius: "999px",
              background:
                "rgba(19,138,75,.10)",
              color: "#138a4b",
              fontSize: "13px",
              fontWeight: 900,
            }}
          >
            승인 완료
          </div>
        </div>

        <div
          style={{
            marginTop: "26px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(220px,1fr))",
            gap: "18px",
          }}
        >
          <ResultItem
            label="담당 강사"
            value={
              selectedTeacher?.display_name ||
              "강사 정보 없음"
            }
          />

          <ResultItem
            label="커리큘럼 / 교재"
            value={
              curriculum ||
              "등록된 내용 없음"
            }
          />
        </div>

        <div
          style={{
            marginTop: "24px",
          }}
        >
          <div style={labelStyle}>
            관리자 메모
          </div>

          <div
            style={{
              minHeight: "100px",
              padding: "16px",
              border:
                "1px solid rgba(15,35,65,.10)",
              borderRadius: "10px",
              background: "#f8fafc",
              color: "#344054",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
            }}
          >
            {adminNote ||
              "등록된 관리자 메모가 없습니다."}
          </div>
        </div>

        <div
          style={{
            marginTop: "24px",
            display: "flex",
            justifyContent:
              "flex-end",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/admin/enrollments"
            style={secondaryLinkStyle}
          >
            전체 수강 관리
          </Link>

          {enrollmentId && (
            <Link
              href={`/admin/enrollments/${enrollmentId}`}
              style={primaryLinkStyle}
            >
              생성된 수강 상세 보기 →
            </Link>
          )}
        </div>

        {!enrollmentId && (
          <div
            style={{
              marginTop: "18px",
              padding: "14px 16px",
              borderRadius: "10px",
              background:
                "rgba(47,111,237,.07)",
              color: "#315a9b",
              lineHeight: 1.6,
              fontSize: "13px",
            }}
          >
            생성된 수강정보를 자동으로
            연결하지 못했습니다. 전체 수강 관리에서
            해당 학생의 수강을 확인해주세요.
          </div>
        )}
      </section>
    );
  }

  /*
   * 반려 상태
   */
  if (status === "rejected") {
    return (
      <section style={sectionStyle}>
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <h2 style={titleStyle}>
            신청 처리 결과
          </h2>

          <div
            style={{
              padding: "8px 13px",
              borderRadius: "999px",
              background:
                "rgba(192,57,43,.09)",
              color: "#c0392b",
              fontSize: "13px",
              fontWeight: 900,
            }}
          >
            반려
          </div>
        </div>

        <div
          style={{
            marginTop: "24px",
          }}
        >
          <div style={labelStyle}>
            관리자 메모
          </div>

          <div
            style={{
              minHeight: "100px",
              padding: "16px",
              border:
                "1px solid rgba(15,35,65,.10)",
              borderRadius: "10px",
              background: "#f8fafc",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
            }}
          >
            {adminNote ||
              "등록된 관리자 메모가 없습니다."}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={sectionStyle}>
      <h2 style={titleStyle}>
        처리 상태
      </h2>

      <p style={descriptionStyle}>
        현재 신청 상태: {status}
      </p>
    </section>
  );
}

function ResultItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "18px",
        border:
          "1px solid rgba(15,35,65,.10)",
        borderRadius: "12px",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: "#7b8493",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "7px",
          fontWeight: 800,
          color: "#101828",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ErrorBox({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginTop: "18px",
        padding: "14px 16px",
        border:
          "1px solid rgba(217,48,37,.30)",
        borderRadius: "10px",
        background:
          "rgba(217,48,37,.06)",
        color: "#b42318",
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}

const sectionStyle = {
  marginTop: "24px",
  padding: "28px",
  border:
    "1px solid rgba(15,35,65,.10)",
  borderRadius: "16px",
  background: "#ffffff",
};

const titleStyle = {
  margin: 0,
  fontSize: "21px",
};

const descriptionStyle = {
  margin: "8px 0 0",
  color: "#667085",
  lineHeight: 1.7,
};

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  fontSize: "13px",
  fontWeight: 800,
  color: "#101828",
};

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "13px 14px",
  border:
    "1px solid rgba(15,35,65,.15)",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "14px",
  outline: "none",
};

const buttonStyle = {
  minHeight: "46px",
  padding: "0 20px",
  borderRadius: "10px",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryLinkStyle = {
  minHeight: "46px",
  padding: "0 18px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border:
    "1px solid rgba(15,35,65,.15)",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#101828",
  textDecoration: "none",
  fontWeight: 800,
  fontSize: "14px",
};

const primaryLinkStyle = {
  minHeight: "46px",
  padding: "0 18px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "10px",
  background: "#082554",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: "14px",
};