"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    checkingSession,
    setCheckingSession,
  ] = useState(true);

  const [
    sessionReady,
    setSessionReady,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const {
          data: {
            session,
          },
          error,
        } =
          await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        if (
          error ||
          !session
        ) {
          setSessionReady(false);

          setErrorMessage(
            "비밀번호 재설정 인증정보를 확인할 수 없습니다. 재설정 메일을 다시 요청해주세요."
          );

          return;
        }

        setSessionReady(true);
      } catch (error) {
        console.error(
          "RESET PASSWORD SESSION ERROR:",
          error
        );

        if (!mounted) {
          return;
        }

        setSessionReady(false);

        setErrorMessage(
          "비밀번호 재설정 인증정보를 확인하는 중 오류가 발생했습니다."
        );
      } finally {
        if (mounted) {
          setCheckingSession(false);
        }
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, [supabase.auth]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      loading ||
      !sessionReady
    ) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (password.length < 8) {
      setErrorMessage(
        "새 비밀번호는 8자 이상으로 입력해주세요."
      );
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setErrorMessage(
        "새 비밀번호와 비밀번호 확인이 일치하지 않습니다."
      );
      return;
    }

    setLoading(true);

    try {
      const {
        error,
      } =
        await supabase.auth.updateUser(
          {
            password,
          }
        );

      if (error) {
        console.error(
          "PASSWORD UPDATE ERROR:",
          error
        );

        setErrorMessage(
          "비밀번호를 변경하지 못했습니다. 재설정 링크가 만료되었거나 사용할 수 없는 상태일 수 있습니다."
        );

        return;
      }

      setSuccessMessage(
        "비밀번호가 성공적으로 변경되었습니다. 잠시 후 로그인 페이지로 이동합니다."
      );

      setPassword("");
      setConfirmPassword("");

      await supabase.auth.signOut();

      window.setTimeout(
        () => {
          router.replace(
            "/login"
          );
          router.refresh();
        },
        1800
      );
    } catch (error) {
      console.error(
        "PASSWORD UPDATE ERROR:",
        error
      );

      setErrorMessage(
        "비밀번호 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="talkly-reset-password-page"
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
        className="talkly-reset-password-brand"
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
            새로운 비밀번호를
            <br />
            설정하세요.
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
            안전한 TALKLY 이용을 위해
            새로운 비밀번호를 설정해 주세요.
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
            비밀번호 변경이 완료되면
            기존 로그인 화면으로
            자동 이동합니다.
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
        className="talkly-reset-password-form-area"
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
              NEW PASSWORD
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
              새 비밀번호 설정
            </h2>

            <p
              style={{
                margin: "8px 0 0",

                color: "#6f7f96",

                fontSize: "14px",

                lineHeight: 1.65,
              }}
            >
              사용할 새로운 비밀번호를
              입력해주세요.
            </p>

            {checkingSession ? (
              <div
                style={{
                  marginTop: "28px",

                  padding:
                    "18px 16px",

                  borderRadius:
                    "10px",

                  background:
                    "#f7f9fc",

                  color: "#667085",

                  fontSize: "13px",

                  lineHeight: 1.6,

                  textAlign:
                    "center",
                }}
              >
                비밀번호 재설정 정보를
                확인하고 있습니다...
              </div>
            ) : (
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
                    marginBottom:
                      "18px",
                  }}
                >
                  <label
                    htmlFor="password"
                    style={{
                      display:
                        "block",

                      marginBottom:
                        "8px",

                      color:
                        "#0a1f44",

                      fontSize:
                        "13px",

                      fontWeight:
                        800,
                    }}
                  >
                    새 비밀번호
                  </label>

                  <input
                    id="password"

                    type="password"

                    autoComplete="new-password"

                    value={password}

                    onChange={(
                      event
                    ) =>
                      setPassword(
                        event.target
                          .value
                      )
                    }

                    required

                    minLength={8}

                    disabled={
                      loading ||
                      !sessionReady
                    }

                    placeholder="8자 이상 입력"

                    style={{
                      width: "100%",

                      boxSizing:
                        "border-box",

                      minHeight:
                        "48px",

                      padding:
                        "0 14px",

                      border:
                        "1px solid #dce4ef",

                      borderRadius:
                        "10px",

                      background:
                        loading ||
                        !sessionReady
                          ? "#f7f9fc"
                          : "#ffffff",

                      color:
                        "#16233a",

                      fontSize:
                        "15px",

                      outline: "none",
                    }}
                  />
                </div>

                <div
                  style={{
                    marginBottom:
                      "18px",
                  }}
                >
                  <label
                    htmlFor="confirmPassword"
                    style={{
                      display:
                        "block",

                      marginBottom:
                        "8px",

                      color:
                        "#0a1f44",

                      fontSize:
                        "13px",

                      fontWeight:
                        800,
                    }}
                  >
                    새 비밀번호 확인
                  </label>

                  <input
                    id="confirmPassword"

                    type="password"

                    autoComplete="new-password"

                    value={
                      confirmPassword
                    }

                    onChange={(
                      event
                    ) =>
                      setConfirmPassword(
                        event.target
                          .value
                      )
                    }

                    required

                    minLength={8}

                    disabled={
                      loading ||
                      !sessionReady
                    }

                    placeholder="새 비밀번호 다시 입력"

                    style={{
                      width: "100%",

                      boxSizing:
                        "border-box",

                      minHeight:
                        "48px",

                      padding:
                        "0 14px",

                      border:
                        "1px solid #dce4ef",

                      borderRadius:
                        "10px",

                      background:
                        loading ||
                        !sessionReady
                          ? "#f7f9fc"
                          : "#ffffff",

                      color:
                        "#16233a",

                      fontSize:
                        "15px",

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

                      color:
                        "#c43c3c",

                      fontSize:
                        "13px",

                      lineHeight:
                        1.55,
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

                      color:
                        "#237a45",

                      fontSize:
                        "13px",

                      lineHeight:
                        1.6,
                    }}
                  >
                    {successMessage}
                  </div>
                )}

                {sessionReady && (
                  <button
                    type="submit"

                    disabled={
                      loading
                    }

                    style={{
                      width: "100%",

                      minHeight:
                        "50px",

                      border:
                        "none",

                      borderRadius:
                        "10px",

                      background:
                        loading
                          ? "#91a9d7"
                          : "#3f75dc",

                      color:
                        "#ffffff",

                      fontSize:
                        "15px",

                      fontWeight:
                        900,

                      cursor:
                        loading
                          ? "default"
                          : "pointer",

                      boxShadow:
                        "0 10px 24px rgba(63,117,220,0.24)",
                    }}
                  >
                    {loading
                      ? "변경 중..."
                      : "비밀번호 변경"}
                  </button>
                )}

                {!sessionReady && (
                  <Link
                    href="/forgot-password"
                    style={{
                      display:
                        "flex",

                      alignItems:
                        "center",

                      justifyContent:
                        "center",

                      minHeight:
                        "50px",

                      borderRadius:
                        "10px",

                      background:
                        "#3f75dc",

                      color:
                        "#ffffff",

                      textDecoration:
                        "none",

                      fontSize:
                        "14px",

                      fontWeight:
                        900,
                    }}
                  >
                    재설정 메일 다시 받기
                  </Link>
                )}
              </form>
            )}

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
              계정 보호를 위해 다른
              서비스에서 사용하지 않는
              비밀번호를 사용하는 것을
              권장합니다.
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 900px) {
          .talkly-reset-password-page {
            grid-template-columns: 1fr !important;
          }

          .talkly-reset-password-brand {
            min-height: 320px;
            padding: 54px 28px !important;
          }

          .talkly-reset-password-form-area {
            padding: 34px 20px 48px !important;
          }
        }

        @media (max-width: 560px) {
          .talkly-reset-password-brand {
            min-height: 280px;
          }

          .talkly-reset-password-form-area > div > div:last-child {
            padding: 26px 20px !important;
          }
        }
      `}</style>
    </main>
  );
}