"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

  const [childId, setChildId] = useState("");
  const [studentUserId, setStudentUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [unlinkingChildId, setUnlinkingChildId] =
    useState<number | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedChild = useMemo(
    () =>
      children.find(
        (child) => child.id === Number(childId)
      ) ?? null,
    [childId, children]
  );

  const studentLinkMap = useMemo(() => {
    const map = new Map<string, number>();

    for (const child of children) {
      if (child.student_user_id) {
        map.set(child.student_user_id, child.id);
      }
    }

    return map;
  }, [children]);

  async function handleLink() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!childId) {
      setErrorMessage("연결할 자녀를 선택해주세요.");
      return;
    }

    if (!studentUserId) {
      setErrorMessage("학생 로그인 계정을 선택해주세요.");
      return;
    }

    const linkedChildId = studentLinkMap.get(studentUserId);

    if (
      linkedChildId &&
      linkedChildId !== Number(childId)
    ) {
      setErrorMessage(
        "선택한 학생 로그인 계정은 다른 자녀에 이미 연결되어 있습니다."
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
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            childId: Number(childId),
            studentUserId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "학생 계정 연결에 실패했습니다."
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

  async function handleUnlink(child: ChildRow) {
    if (!child.student_user_id) {
      return;
    }

    const linkedStudent = students.find(
      (student) =>
        student.id === child.student_user_id
    );

    const studentName =
      linkedStudent?.name || "학생 계정";

    const confirmed = window.confirm(
      `${child.name} 자녀와 ${studentName} 학생 계정의 연결을 해제하시겠습니까?\n\n자녀 정보와 수강 기록은 삭제되지 않으며 학생 로그인 계정 연결만 해제됩니다.`
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setUnlinkingChildId(child.id);

    try {
      const response = await fetch(
        "/api/admin/student-links",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            childId: child.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "학생 계정 연결 해제에 실패했습니다."
        );
      }

      setSuccessMessage(
        `${child.name}의 학생 계정 연결을 해제했습니다. 기존 수강 ${result.updatedEnrollments ?? 0}건의 로그인 계정 연결도 함께 해제했습니다.`
      );

      if (childId === String(child.id)) {
        setChildId("");
        setStudentUserId("");
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "학생 계정 연결 해제 중 오류가 발생했습니다."
      );
    } finally {
      setUnlinkingChildId(null);
    }
  }

  return (
    <div
      style={{
        marginTop: "22px",
        display: "grid",
        gap: "20px",
      }}
    >
      <section style={sectionStyle}>
        <div>
          <h2
            style={{
              margin: 0,
              color: "#101828",
              fontSize: "21px",
            }}
          >
            학생 연결
          </h2>

          <p
            style={{
              margin: "7px 0 0",
              color: "#667085",
              fontSize: "13px",
              lineHeight: 1.6,
            }}
          >
            학부모가 등록한 자녀와 실제 학생 로그인 계정을
            선택합니다.
          </p>
        </div>

        <div className="link-grid">
          <div>
            <label style={labelStyle}>
              학부모 등록 자녀
            </label>

            <select
              value={childId}
              onChange={(e) => {
                const nextChildId = e.target.value;

                setChildId(nextChildId);
                setErrorMessage("");
                setSuccessMessage("");

                const nextChild = children.find(
                  (child) =>
                    child.id === Number(nextChildId)
                );

                setStudentUserId(
                  nextChild?.student_user_id || ""
                );
              }}
              style={fieldStyle}
            >
              <option value="">자녀 선택</option>

              {children.map((child) => (
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
                    : " · 미연결"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>
              학생 로그인 계정
            </label>

            <select
              value={studentUserId}
              onChange={(e) =>
                setStudentUserId(e.target.value)
              }
              style={fieldStyle}
            >
              <option value="">
                학생 계정 선택
              </option>

              {students.map((student) => {
                const linkedChildId =
                  studentLinkMap.get(student.id);

                const linkedToOther =
                  !!linkedChildId &&
                  linkedChildId !== selectedChild?.id;

                return (
                  <option
                    key={student.id}
                    value={student.id}
                    disabled={linkedToOther}
                  >
                    {student.name ||
                      "이름 미등록 학생"}
                    {linkedToOther
                      ? " · 다른 자녀에 연결됨"
                      : ""}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {selectedChild && (
          <div
            style={{
              padding: "13px 15px",
              borderRadius: "10px",
              background: "#f8fafc",
              border: "1px solid #e4e7ec",
              color: "#475467",
              fontSize: "13px",
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: "#101828" }}>
              {selectedChild.name}
            </strong>
            {" · "}
            현재 상태:{" "}
            {selectedChild.student_user_id
              ? "학생 계정 연결됨"
              : "학생 계정 미연결"}
          </div>
        )}

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
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={handleLink}
            disabled={
              loading || !childId || !studentUserId
            }
            style={{
              minHeight: "46px",
              padding: "0 20px",
              border: 0,
              borderRadius: "10px",
              background:
                loading || !childId || !studentUserId
                  ? "#98a2b3"
                  : "#0a1f44",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 900,
              cursor:
                loading || !childId || !studentUserId
                  ? "default"
                  : "pointer",
            }}
          >
            {loading
              ? "저장 중..."
              : selectedChild?.student_user_id
                ? "학생 계정 변경"
                : "학생 계정 연결"}
          </button>
        </div>
      </section>

      <section style={sectionStyle}>
        <div>
          <h2
            style={{
              margin: 0,
              color: "#101828",
              fontSize: "21px",
            }}
          >
            현재 연결 상태
          </h2>

          <p
            style={{
              margin: "7px 0 0",
              color: "#667085",
              fontSize: "13px",
            }}
          >
            연결된 학생 로그인 계정과 미연결 자녀를 확인합니다.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gap: "10px",
          }}
        >
          {children.length === 0 ? (
            <div
              style={{
                padding: "34px",
                color: "#667085",
                textAlign: "center",
                border: "1px dashed #cfd8e6",
                borderRadius: "12px",
              }}
            >
              등록된 활성 자녀가 없습니다.
            </div>
          ) : (
            children.map((child) => {
              const linkedStudent = students.find(
                (student) =>
                  student.id === child.student_user_id
              );

              const linked = !!child.student_user_id;

              return (
                <div
                  key={child.id}
                  style={{
                    padding: "15px 16px",
                    border: "1px solid #e4e7ec",
                    borderRadius: "12px",
                    background: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "18px",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      minWidth: "220px",
                    }}
                  >
                    <Link
                      href={`/admin/students/child/${child.id}`}
                      style={{
                        color: "#101828",
                        textDecoration: "none",
                        fontWeight: 900,
                      }}
                    >
                      {child.name}
                    </Link>

                    <div
                      style={{
                        marginTop: "5px",
                        color: "#667085",
                        fontSize: "12px",
                      }}
                    >
                      {child.grade || "학년 미등록"}
                      {" · "}
                      {child.school_name ||
                        "학교 미등록"}
                    </div>
                  </div>

                  <div
                    style={{
                      marginLeft: "auto",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        padding: "7px 10px",
                        borderRadius: "999px",
                        background: linked
                          ? "#ecfdf3"
                          : "#f2f4f7",
                        color: linked
                          ? "#027a48"
                          : "#475467",
                        fontSize: "12px",
                        fontWeight: 900,
                      }}
                    >
                      {linked
                        ? `연결 완료 · ${
                            linkedStudent?.name ||
                            "학생 계정"
                          }`
                        : "학생 계정 미연결"}
                    </span>

                    {linked && (
                      <button
                        type="button"
                        onClick={() =>
                          handleUnlink(child)
                        }
                        disabled={
                          unlinkingChildId === child.id
                        }
                        style={{
                          minHeight: "36px",
                          padding: "0 12px",
                          border: "1px solid #fda29b",
                          borderRadius: "8px",
                          background: "#ffffff",
                          color: "#b42318",
                          fontSize: "12px",
                          fontWeight: 800,
                          cursor:
                            unlinkingChildId === child.id
                              ? "default"
                              : "pointer",
                          opacity:
                            unlinkingChildId === child.id
                              ? 0.6
                              : 1,
                        }}
                      >
                        {unlinkingChildId === child.id
                          ? "해제 중..."
                          : "연결 해제"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <style>{`
        .link-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        @media (max-width: 720px) {
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
  border: "1px solid #e4e7ec",
  borderRadius: "14px",
  background: "#ffffff",
  boxShadow:
    "0 1px 2px rgba(16,24,40,0.03), 0 8px 24px rgba(16,24,40,0.04)",
  display: "grid",
  gap: "18px",
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
  boxSizing: "border-box" as const,
  minHeight: "46px",
  padding: "10px 12px",
  border: "1px solid #d6deea",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "14px",
};

const successStyle = {
  padding: "13px 14px",
  borderRadius: "9px",
  border: "1px solid #abefc6",
  background: "#ecfdf3",
  color: "#027a48",
  fontSize: "13px",
  fontWeight: 700,
};

const errorStyle = {
  padding: "13px 14px",
  borderRadius: "9px",
  border: "1px solid #fecdca",
  background: "#fef3f2",
  color: "#b42318",
  fontSize: "13px",
  fontWeight: 700,
};