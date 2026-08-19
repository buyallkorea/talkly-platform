"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type StudentProfile = {
  id: string;
  name: string | null;
};

type ChildRow = {
  id: number;
  name: string;
  grade: string | null;
  school_name: string | null;
  student_user_id: string | null;
};

export default function StudentLinkForm({
  children,
  students,
}: {
  children: ChildRow[];
  students: StudentProfile[];
}) {
  const router = useRouter();

  const [childId, setChildId] =
    useState("");

  const [studentUserId, setStudentUserId] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  async function handleLink() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!childId) {
      setErrorMessage(
        "연결할 자녀를 선택해주세요."
      );
      return;
    }

    if (!studentUserId) {
      setErrorMessage(
        "학생 로그인 계정을 선택해주세요."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/admin/student-links",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            childId:
              Number(childId),

            studentUserId,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "학생 계정 연결에 실패했습니다."
        );
      }

      setSuccessMessage(
        `학생 계정이 연결되었습니다. 기존 수강 ${result.updatedEnrollments ?? 0}건도 함께 연결했습니다.`
      );

      setChildId("");
      setStudentUserId("");

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "학생 계정 연결 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        marginTop: "24px",
        display: "grid",
        gap: "20px",
      }}
    >
      <section style={sectionStyle}>
        <h2
          style={{
            margin: 0,
            fontSize: "21px",
          }}
        >
          학생 연결
        </h2>

        <p
          style={{
            margin: "8px 0 22px",
            opacity: 0.55,
            fontSize: "13px",
          }}
        >
          자녀와 실제 학생 로그인 계정을 선택합니다.
        </p>

        <div className="link-grid">
          <div>
            <label style={labelStyle}>
              학부모 등록 자녀
            </label>

            <select
              value={childId}
              onChange={(e) =>
                setChildId(
                  e.target.value
                )
              }
              style={fieldStyle}
            >
              <option value="">
                자녀 선택
              </option>

              {children.map(
                (child) => (
                  <option
                    key={child.id}
                    value={child.id}
                  >
                    {child.name}
                    {child.grade
                      ? ` · ${child.grade}`
                      : ""}
                    {child.school_name
                      ? ` · ${child.school_name}`
                      : ""}
                    {child.student_user_id
                      ? " · 연결됨"
                      : ""}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label style={labelStyle}>
              학생 로그인 계정
            </label>

            <select
              value={studentUserId}
              onChange={(e) =>
                setStudentUserId(
                  e.target.value
                )
              }
              style={fieldStyle}
            >
              <option value="">
                학생 계정 선택
              </option>

              {students.map(
                (student) => (
                  <option
                    key={student.id}
                    value={student.id}
                  >
                    {student.name ||
                      "이름 미등록 학생"}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {successMessage && (
          <div style={successStyle}>
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div style={errorStyle}>
            {errorMessage}
          </div>
        )}

        <div
          style={{
            marginTop: "20px",
            display: "flex",
            justifyContent:
              "flex-end",
          }}
        >
          <button
            type="button"
            onClick={handleLink}
            disabled={loading}
            style={{
              minHeight: "48px",
              padding: "0 22px",
              border: 0,
              borderRadius: "10px",
              background: "#2f6fed",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 900,
              cursor: loading
                ? "default"
                : "pointer",
              opacity: loading
                ? 0.65
                : 1,
            }}
          >
            {loading
              ? "연결 중..."
              : "학생 계정 연결"}
          </button>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2
          style={{
            margin: 0,
            fontSize: "21px",
          }}
        >
          현재 연결 상태
        </h2>

        <div
          style={{
            marginTop: "18px",
            display: "grid",
            gap: "10px",
          }}
        >
          {children.length === 0 ? (
            <div
              style={{
                padding: "30px",
                opacity: 0.5,
                textAlign: "center",
              }}
            >
              등록된 자녀가 없습니다.
            </div>
          ) : (
            children.map(
              (child) => {
                const linkedStudent =
                  students.find(
                    (student) =>
                      student.id ===
                      child.student_user_id
                  );

                return (
                  <div
                    key={child.id}
                    style={{
                      padding:
                        "15px 16px",

                      border:
                        "1px solid rgba(255,255,255,.12)",

                      borderRadius:
                        "10px",

                      display:
                        "flex",

                      justifyContent:
                        "space-between",

                      gap: "15px",

                      flexWrap:
                        "wrap",
                    }}
                  >
                    <div>
                      <strong>
                        {child.name}
                      </strong>

                      <div
                        style={{
                          marginTop:
                            "5px",
                          opacity:
                            0.55,
                          fontSize:
                            "12px",
                        }}
                      >
                        {child.grade ||
                          "-"}
                        {" · "}
                        {child.school_name ||
                          "-"}
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize:
                          "13px",
                        fontWeight:
                          800,
                        color:
                          linkedStudent
                            ? "#8fb4ff"
                            : "#8f98a6",
                      }}
                    >
                      {linkedStudent
                        ? `연결: ${
                            linkedStudent.name ||
                            "학생 계정"
                          }`
                        : "학생 계정 미연결"}
                    </div>
                  </div>
                );
              }
            )
          )}
        </div>
      </section>

      <style>{`
        .link-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0,1fr));
          gap: 16px;
        }

        @media(max-width:720px) {
          .link-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

const sectionStyle = {
  padding: "24px",
  border:
    "1px solid rgba(255,255,255,.15)",
  borderRadius: "14px",
  background:
    "rgba(255,255,255,.025)",
};

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  fontSize: "13px",
  fontWeight: 800,
};

const fieldStyle = {
  width: "100%",
  boxSizing:
    "border-box" as const,
  padding: "12px 13px",
  border:
    "1px solid rgba(255,255,255,.18)",
  borderRadius: "9px",
  background:
    "rgba(255,255,255,.06)",
  color: "inherit",
  fontFamily: "inherit",
};

const successStyle = {
  marginTop: "18px",
  padding: "14px",
  borderRadius: "9px",
  border:
    "1px solid rgba(57,170,100,.4)",
  color: "#75d79a",
};

const errorStyle = {
  marginTop: "18px",
  padding: "14px",
  borderRadius: "9px",
  border:
    "1px solid rgba(217,48,37,.45)",
  color: "#ff9d95",
};