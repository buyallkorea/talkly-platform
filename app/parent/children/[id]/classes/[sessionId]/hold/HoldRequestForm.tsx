"use client";

import { useState } from "react";
import {
  useRouter,
} from "next/navigation";

type Props = {
  sessionId: number;
  childId: number;
};

export default function HoldRequestForm({
  sessionId,
  childId,
}: Props) {
  const router =
    useRouter();

  const [
    reason,
    setReason,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  async function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    const confirmed =
      window.confirm(
        "이 수업의 연기를 신청하시겠습니까?\n\n조건을 충족하면 즉시 자동 승인됩니다."
      );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response =
        await fetch(
          "/api/class-holds/request",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                sessionId,
                reason,
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        setErrorMessage(
          result.error ||
            "수업 연기 신청을 처리하지 못했습니다."
        );

        setLoading(false);
        return;
      }

      setSuccessMessage(
        `수업 연기 신청이 자동 승인되었습니다. 이번 달 ${result.monthlyUsage}/${result.monthlyLimit}회 사용했습니다.`
      );

      setTimeout(() => {
        router.push(
          `/parent/children/${childId}/classes/${sessionId}`
        );

        router.refresh();
      }, 1200);
    } catch (error) {
      console.error(
        error
      );

      setErrorMessage(
        "수업 연기 신청 중 오류가 발생했습니다."
      );

      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={
        handleSubmit
      }
      style={{
        marginTop:
          "24px",
      }}
    >
      <label
        style={{
          display:
            "block",
          color:
            "#344054",
          fontSize:
            "13px",
          fontWeight:
            900,
        }}
      >
        연기 사유
        <span
          style={{
            marginLeft:
              "5px",
            color:
              "#98a2b3",
            fontWeight:
              600,
          }}
        >
          (선택)
        </span>
      </label>

      <textarea
        value={
          reason
        }
        onChange={(
          event
        ) =>
          setReason(
            event.target
              .value
          )
        }
        maxLength={
          500
        }
        placeholder="수업 연기 사유가 있다면 입력해주세요."
        style={{
          width:
            "100%",
          minHeight:
            "120px",
          marginTop:
            "9px",
          padding:
            "14px",
          boxSizing:
            "border-box",
          border:
            "1px solid #d0d5dd",
          borderRadius:
            "10px",
          background:
            "#ffffff",
          color:
            "#101828",
          fontFamily:
            "inherit",
          fontSize:
            "14px",
          lineHeight:
            1.6,
          resize:
            "vertical",
        }}
      />

      {errorMessage && (
        <div
          style={{
            marginTop:
              "14px",
            padding:
              "14px 16px",
            border:
              "1px solid #fecdca",
            borderRadius:
              "10px",
            background:
              "#fef3f2",
            color:
              "#b42318",
            fontSize:
              "13px",
            lineHeight:
              1.6,
          }}
        >
          {
            errorMessage
          }
        </div>
      )}

      {successMessage && (
        <div
          style={{
            marginTop:
              "14px",
            padding:
              "14px 16px",
            border:
              "1px solid #abefc6",
            borderRadius:
              "10px",
            background:
              "#ecfdf3",
            color:
              "#067647",
            fontSize:
              "13px",
            lineHeight:
              1.6,
          }}
        >
          {
            successMessage
          }
        </div>
      )}

      <button
        type="submit"
        disabled={
          loading
        }
        style={{
          width:
            "100%",
          minHeight:
            "50px",
          marginTop:
            "18px",
          border:
            "none",
          borderRadius:
            "10px",
          background:
            loading
              ? "#98a2b3"
              : "#2f6fed",
          color:
            "#ffffff",
          fontSize:
            "14px",
          fontWeight:
            900,
          cursor:
            loading
              ? "default"
              : "pointer",
        }}
      >
        {loading
          ? "신청 처리 중..."
          : "수업 연기 신청"}
      </button>
    </form>
  );
}