"use client";

import {
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Props = {
  teacherUserId: string;
};

export default function ResendTeacherRegistrationButton({
  teacherUserId,
}: Props) {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(
      null
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  async function handleResend() {
    if (loading) {
      return;
    }

    const confirmed =
      window.confirm(
        "이 강사에게 계정 설정 안내메일을 다시 발송하시겠습니까?"
      );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response =
        await fetch(
          `/api/admin/teachers/${teacherUserId}/resend-registration`,
          {
            method:
              "POST",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          typeof data?.error ===
          "string"
            ? data.error
            : "등록메일 재발송에 실패했습니다."
        );
      }

      setMessage(
        typeof data?.message ===
        "string"
          ? data.message
          : "등록메일을 다시 발송했습니다."
      );

      router.refresh();

      window.setTimeout(
        () => {
          setMessage(null);
        },
        3500
      );
    } catch (resendError) {
      setError(
        resendError instanceof
        Error
          ? resendError.message
          : "등록메일 재발송 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection:
          "column",
        alignItems:
          "flex-end",
        gap: "5px",
      }}
    >
      <button
        type="button"
        onClick={
          handleResend
        }
        disabled={
          loading
        }
        style={{
          minHeight:
            "36px",
          padding:
            "7px 10px",
          border:
            "1px solid #b2ccff",
          borderRadius:
            "8px",
          background:
            "#eff4ff",
          color:
            "#175cd3",
          fontSize:
            "11px",
          fontWeight:
            800,
          cursor:
            loading
              ? "default"
              : "pointer",
          opacity:
            loading
              ? 0.6
              : 1,
          whiteSpace:
            "nowrap",
        }}
      >
        {loading
          ? "발송 중..."
          : "등록메일 재발송"}
      </button>

      {message && (
        <span
          style={{
            maxWidth:
              "180px",
            color:
              "#067647",
            fontSize:
              "10px",
            textAlign:
              "right",
          }}
        >
          {message}
        </span>
      )}

      {error && (
        <span
          style={{
            maxWidth:
              "180px",
            color:
              "#b42318",
            fontSize:
              "10px",
            textAlign:
              "right",
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}