"use client";

import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function TeacherAccountSetupForm() {
  const router =
    useRouter();

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    passwordConfirm,
    setPasswordConfirm,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setErrorMessage("");

    if (
      password.length < 8
    ) {
      setErrorMessage(
        "Password must be at least 8 characters. / 비밀번호는 8자 이상이어야 합니다."
      );

      return;
    }

    if (
      password !==
      passwordConfirm
    ) {
      setErrorMessage(
        "Passwords do not match. / 비밀번호와 비밀번호 확인이 일치하지 않습니다."
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
        throw new Error(
          "Your session has expired. Please open the invitation link again."
        );
      }

      /*
       * 본인이 사용할 비밀번호 설정 +
       * 계정설정 완료 metadata 저장
       */
      const {
        error: updateError,
      } =
        await supabase.auth.updateUser({
          password,

          data: {
            ...user.user_metadata,

            teacher_invited:
              true,

            teacher_account_ready:
              true,

            teacher_account_ready_at:
              new Date().toISOString(),
          },
        });

      if (updateError) {
        throw updateError;
      }

      router.replace(
        "/teacher"
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Account setup failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle = {
    width: "100%",
    boxSizing:
      "border-box" as const,
    padding: "13px 14px",
    border:
      "1px solid #d0d5dd",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#101828",
    fontSize: "15px",
    outline: "none",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <div>
        <label
          htmlFor="teacherPassword"
          style={{
            display: "block",
            marginBottom: "7px",
            color: "#344054",
            fontSize: "14px",
            fontWeight: 800,
          }}
        >
          New password
        </label>

        <input
          id="teacherPassword"
          type="password"
          value={password}
          onChange={(event) =>
            setPassword(
              event.target.value
            )
          }
          minLength={8}
          autoComplete="new-password"
          required
          disabled={loading}
          style={fieldStyle}
        />

        <div
          style={{
            marginTop: "6px",
            color: "#667085",
            fontSize: "12px",
          }}
        >
          Use at least 8 characters.
          / 8자 이상 입력해 주세요.
        </div>
      </div>

      <div>
        <label
          htmlFor="teacherPasswordConfirm"
          style={{
            display: "block",
            marginBottom: "7px",
            color: "#344054",
            fontSize: "14px",
            fontWeight: 800,
          }}
        >
          Confirm password
        </label>

        <input
          id="teacherPasswordConfirm"
          type="password"
          value={passwordConfirm}
          onChange={(event) =>
            setPasswordConfirm(
              event.target.value
            )
          }
          minLength={8}
          autoComplete="new-password"
          required
          disabled={loading}
          style={fieldStyle}
        />
      </div>

      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: "13px 14px",
            border:
              "1px solid #fecdca",
            borderRadius: "10px",
            background: "#fef3f2",
            color: "#b42318",
            fontSize: "13px",
            lineHeight: 1.6,
          }}
        >
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          minHeight: "48px",
          border: "none",
          borderRadius: "10px",
          background:
            loading
              ? "#98a2b3"
              : "#0a1f44",
          color: "#ffffff",
          fontSize: "15px",
          fontWeight: 900,
          cursor:
            loading
              ? "default"
              : "pointer",
        }}
      >
        {loading
          ? "Setting up account..."
          : "Set password & continue"}
      </button>
    </form>
  );
}