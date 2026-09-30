"use client";

import {
  FormEvent,
  useState,
} from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] =
    useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage(
        "이메일 주소를 입력해주세요."
      );
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const redirectTo =
        `${window.location.origin}/auth/callback?next=/reset-password`;

      const {
        error,
      } =
        await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          {
            redirectTo,
          }
        );

      if (error) {
        console.error(
          "PASSWORD RESET EMAIL ERROR:",
          error
        );

        setErrorMessage(
          "비밀번호 재설정 메일을 발송하지 못했습니다. 잠시 후 다시 시도해주세요."
        );

        return;
      }

      /*
       * 보안상 해당 이메일의 가입 여부를
       * 화면에서 구분해서 표시하지 않습니다.
       */
      setSuccessMessage(
        "입력하신 이메일이 TALKLY에 등록되어 있다면 비밀번호 재설정 메일이 발송됩니다. 받은편지함과 스팸메일함을 확인해주세요."
      );
    } catch (error) {
      console.error(
        "PASSWORD RESET ERROR:",
        error
      );

      setErrorMessage(
        "비밀번호 재설정 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="talkly-forgot-password-page"
      style={{
        minHeight: "100vh",

        display: "grid",

        gridTemplateColumns:
          "minmax(0, 1.08fr) minmax(420px, 0.92fr)",

        background:
          "linear-gradient(135deg, #eef4ff 0%, #f7faff 45%, #ffffff 100%)",
      }}
    >
      <section
        className="talkly-forgot-password-brand"
        style={{
          position: "relative",
          overflow: "hidden",

          display: "flex",
          alignItems: "center",

          padding: "70px 8vw",

          background:
            "linear-gradient(145deg, #0a1f44 0%, #173d75 72%, #2f66bb 100%)",

          color: "#ffffff",
        }}
      >
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: "620px",
          }}
        >
          <div
            style={{
              fontSize: "13px",

              fontWeight: 900,

              letterSpacing:
                "0.14em",

              opacity: 0.72,
            }}
          >
            TALKLY
          </div>

          <h1
            style={{
              margin: "14px 0 0",

              fontSize:
                "clamp(40px, 5vw, 68px)",

              lineHeight: 1.08,

              letterSpacing:
                "-0.05em",
            }}
          >
            비밀번호를
            <br />
            다시 설정하세요.
          </h1>

          <p
            style={{
              margin: "22px 0 0",

              maxWidth: "540px",

              color:
                "rgba(255,255,255,0.76)",

              fontSize: "17px",

              lineHeight: 1.8,
            }}
          >
            TALKLY에 가입한 이메일로
            비밀번호 재설정 링크를
            보내드립니다.
          </p>

          <div
            style={{
              marginTop: "34px",

              padding:
                "18px 20px",

              maxWidth: "500px",

              borderRadius: "13px",

              border:
                "1px solid rgba(255,255,255,0.16)",

              background:
                "rgba(255,255,255,0.07)",

              backdropFilter:
                "blur(6px)",

              color:
                "rgba(255,255,255,0.82)",

              fontSize: "14px",

              lineHeight: 1.7,
            }}
          >
            이메일의 재설정 링크를
            클릭한 후 새로운 비밀번호를
            설정할 수 있습니다.
          </div>
        </div>

        <div
          aria-hidden="true"
          style={{
            position: "absolute",

            width: "430px",
            height: "430px",

            right: "-180px",
            bottom: "-180px",

            borderRadius: "50%",

            border:
              "1px solid rgba(255,255,255,0.13)",
          }}
        />

        <div
          aria-hidden="true"
          style={{
            position: "absolute",

            width: "280px",
            height: "280px",

            right: "-80px",
            bottom: "-85px",

            borderRadius: "50%",

            background:
              "rgba(255,255,255,0.05)",
          }}
        />
      </section>

      <section
        className="talkly-forgot-password-form-area"
        style={{
          display: "flex",

          alignItems: "center",

          justifyContent: "center",

          padding: "48px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "440px",
          }}
        >
          <Link
            href="/login"
            style={{
              display: "inline-flex",

              marginBottom: "28px",

              color: "#3f75dc",

              textDecoration: "none",

              fontSize: "13px",

              fontWeight: 800,
            }}
          >
            ← 로그인으로 돌아가기
          </Link>

          <div
            style={{
              padding: "34px",

              borderRadius: "20px",

              border:
                "1px solid #e1e9f5",

              background: "#ffffff",

              boxShadow:
                "0 22px 60px rgba(10,31,68,0.10)",
            }}
          >
            <div
              style={{
                color: "#3f75dc",

                fontSize: "11px",

                fontWeight: 900,

                letterSpacing:
                  "0.09em",
              }}
            >
              RESET PASSWORD
            </div>

            <h2
              style={{
                margin: "8px 0 0",

                color: "#0a1f44",

                fontSize: "31px",

                letterSpacing:
                  "-0.04em",
              }}
            >
              비밀번호 찾기
            </h2>

            <p
              style={{
                margin: "8px 0 0",

                color: "#6f7f96",

                fontSize: "14px",

                lineHeight: 1.65,
              }}
            >
              TALKLY에 가입할 때 사용한
              이메일 주소를 입력해주세요.
            </p>

            <form
              onSubmit={
                handleSubmit
              }
              style={{
                marginTop: "28px",
              }}
            >
              <div
                style={{
                  marginBottom: "18px",
                }}
              >
                <label
                  htmlFor="email"
                  style={{
                    display: "block",

                    marginBottom: "8px",

                    color: "#0a1f44",

                    fontSize: "13px",

                    fontWeight: 800,
                  }}
                >
                  이메일
                </label>

                <input
                  id="email"

                  type="email"

                  autoComplete="email"

                  value={email}

                  onChange={(
                    event
                  ) =>
                    setEmail(
                      event.target
                        .value
                    )
                  }

                  required

                  disabled={
                    loading
                  }

                  placeholder="email@example.com"

                  style={{
                    width: "100%",

                    boxSizing:
                      "border-box",

                    minHeight: "48px",

                    padding:
                      "0 14px",

                    border:
                      "1px solid #dce4ef",

                    borderRadius:
                      "10px",

                    background:
                      loading
                        ? "#f7f9fc"
                        : "#ffffff",

                    color: "#16233a",

                    fontSize: "15px",

                    outline: "none",
                  }}
                />
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  style={{
                    marginBottom:
                      "18px",

                    padding:
                      "13px 14px",

                    borderRadius:
                      "9px",

                    border:
                      "1px solid #f1c6c6",

                    background:
                      "#fff7f7",

                    color: "#c43c3c",

                    fontSize: "13px",

                    lineHeight: 1.55,
                  }}
                >
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div
                  role="status"
                  style={{
                    marginBottom:
                      "18px",

                    padding:
                      "13px 14px",

                    borderRadius:
                      "9px",

                    border:
                      "1px solid #c8e6d2",

                    background:
                      "#f4fbf6",

                    color: "#237a45",

                    fontSize: "13px",

                    lineHeight: 1.6,
                  }}
                >
                  {successMessage}
                </div>
              )}

              <button
                type="submit"

                disabled={
                  loading
                }

                style={{
                  width: "100%",

                  minHeight: "50px",

                  border: "none",

                  borderRadius:
                    "10px",

                  background:
                    loading
                      ? "#91a9d7"
                      : "#3f75dc",

                  color: "#ffffff",

                  fontSize: "15px",

                  fontWeight: 900,

                  cursor:
                    loading
                      ? "default"
                      : "pointer",

                  boxShadow:
                    "0 10px 24px rgba(63,117,220,0.24)",
                }}
              >
                {loading
                  ? "발송 중..."
                  : "비밀번호 재설정 메일 보내기"}
              </button>
            </form>

            <div
              style={{
                marginTop: "22px",

                paddingTop: "18px",

                borderTop:
                  "1px solid #edf1f6",

                color: "#8a97aa",

                fontSize: "12px",

                lineHeight: 1.6,
              }}
            >
              메일이 보이지 않는 경우
              스팸메일함을 확인해주세요.
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 900px) {
          .talkly-forgot-password-page {
            grid-template-columns: 1fr !important;
          }

          .talkly-forgot-password-brand {
            min-height: 320px;
            padding: 54px 28px !important;
          }

          .talkly-forgot-password-form-area {
            padding: 34px 20px 48px !important;
          }
        }

        @media (max-width: 560px) {
          .talkly-forgot-password-brand {
            min-height: 280px;
          }

          .talkly-forgot-password-form-area > div > div:last-child {
            padding: 26px 20px !important;
          }
        }
      `}</style>
    </main>
  );
}