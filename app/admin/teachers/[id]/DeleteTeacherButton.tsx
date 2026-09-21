"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  teacherId: string;
  teacherName: string;
};

type DeleteErrorResponse = {
  error?: string;
  code?: string;
  history?: {
    label: string;
    count: number;
  }[];
};

export default function DeleteTeacherButton({
  teacherId,
  teacherName,
}: Props) {
  const router = useRouter();

  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleDelete() {
    if (deleting) {
      return;
    }

    setErrorMessage("");

    const firstConfirmed = window.confirm(
      `${teacherName} 강사를 완전히 삭제하시겠습니까?\n\n` +
        "강사 계정, 프로필 및 근무시간 정보가 삭제됩니다.\n" +
        "수업 또는 운영 이력이 있는 강사는 삭제되지 않습니다."
    );

    if (!firstConfirmed) {
      return;
    }

    const secondConfirmed = window.confirm(
      "삭제 후에는 복구할 수 없습니다.\n\n정말 완전 삭제하시겠습니까?"
    );

    if (!secondConfirmed) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(
        `/api/admin/teachers/${teacherId}`,
        {
          method: "DELETE",
        }
      );

      const result =
        (await response.json()) as DeleteErrorResponse & {
          success?: boolean;
          message?: string;
        };

      if (!response.ok) {
        if (
          result.code === "TEACHER_HAS_HISTORY" &&
          result.history &&
          result.history.length > 0
        ) {
          const historyText = result.history
            .map(
              (item) =>
                `${item.label} ${item.count}건`
            )
            .join(", ");

          setErrorMessage(
            `${result.error || "강사를 삭제할 수 없습니다."}\n\n` +
              `확인된 이력: ${historyText}`
          );
        } else {
          setErrorMessage(
            result.error ||
              "강사 삭제에 실패했습니다."
          );
        }

        setDeleting(false);
        return;
      }

      router.push("/admin/teachers");
      router.refresh();
    } catch (error) {
      console.error(
        "DELETE TEACHER CLIENT ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `강사 삭제 오류: ${error.message}`
          : "강사 삭제 중 오류가 발생했습니다."
      );

      setDeleting(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "8px",
      }}
    >
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        style={{
          padding: "10px 14px",
          border: "1px solid #fda29b",
          borderRadius: "9px",
          color: deleting ? "#98a2b3" : "#b42318",
          background: deleting ? "#f2f4f7" : "#fff5f4",
          fontWeight: 800,
          whiteSpace: "nowrap",
          cursor: deleting ? "default" : "pointer",
        }}
      >
        {deleting ? "삭제 중..." : "강사 삭제"}
      </button>

      {errorMessage && (
        <div
          role="alert"
          style={{
            maxWidth: "420px",
            padding: "10px 12px",
            border: "1px solid #fda29b",
            borderRadius: "8px",
            background: "#fff5f4",
            color: "#b42318",
            fontSize: "12px",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}