"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  textbookId: number;
  textbookTitle: string;
};

export default function DeleteTextbookButton({
  textbookId,
  textbookTitle,
}: Props) {
  const router = useRouter();

  const [loading, setLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleDelete() {
    if (loading) {
      return;
    }

    setErrorMessage("");

    const confirmed = window.confirm(
      `"${textbookTitle}" 교재를 영구 삭제하시겠습니까?\n\n` +
        "교재 정보와 생성된 페이지 데이터가 모두 삭제됩니다.\n" +
        "Storage에 저장된 원본 파일도 함께 삭제됩니다.\n\n" +
        "이 작업은 되돌릴 수 없습니다."
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/admin/textbooks/${textbookId}`,
        {
          method: "DELETE",
        }
      );

      let result: {
        success?: boolean;
        error?: string;
        storageDeleted?: boolean;
        storageWarning?: string | null;
      } = {};

      try {
        result = await response.json();
      } catch {
        // JSON 응답이 아닌 경우 아래에서
        // 기본 오류 메시지를 사용합니다.
      }

      if (!response.ok) {
        setErrorMessage(
          result.error ||
            "교재 삭제에 실패했습니다."
        );

        setLoading(false);
        return;
      }

      if (!result.success) {
        setErrorMessage(
          result.error ||
            "교재 삭제 결과를 확인할 수 없습니다."
        );

        setLoading(false);
        return;
      }

      /*
       * DB 삭제는 성공했지만
       * Storage 파일 정리에 실패한 경우입니다.
       *
       * 이미 교재 DB가 삭제되었으므로
       * 상세 페이지에 머무르지 않고
       * 목록으로 이동하면서 관리자에게 알립니다.
       */
      if (result.storageWarning) {
        window.alert(
          "교재 정보는 삭제되었습니다.\n\n" +
            result.storageWarning
        );
      } else {
        window.alert(
          `"${textbookTitle}" 교재가 삭제되었습니다.`
        );
      }

      router.push("/admin/textbooks");
      router.refresh();
    } catch (error) {
      console.error(
        "TEXTBOOK DELETE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `교재 삭제 오류: ${error.message}`
          : "교재 삭제 중 알 수 없는 오류가 발생했습니다."
      );

      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        style={{
          minHeight: "44px",
          padding: "0 17px",
          border: "1px solid #f04438",
          borderRadius: "9px",
          background: loading
            ? "#f2f4f7"
            : "#ffffff",
          color: loading
            ? "#98a2b3"
            : "#d92d20",
          fontFamily: "inherit",
          fontSize: "12px",
          fontWeight: 900,
          cursor: loading
            ? "default"
            : "pointer",
        }}
      >
        {loading
          ? "삭제 처리 중..."
          : "교재 영구 삭제"}
      </button>

      {errorMessage && (
        <div
          style={{
            marginTop: "10px",
            maxWidth: "520px",
            padding: "12px 14px",
            border: "1px solid #fda29b",
            borderRadius: "9px",
            background: "#fffbfa",
            color: "#b42318",
            fontSize: "11px",
            fontWeight: 700,
            lineHeight: 1.6,
          }}
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}