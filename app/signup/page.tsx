"use client";

import {
  FormEvent,
  Suspense,
  useState,
} from "react";
import Link from "next/link";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

type SignupRole =
  | "student"
  | "parent";

function SignupPageContent() {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const [role, setRole] =
    useState<SignupRole>(
      "parent"
    );

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    passwordConfirm,
    setPasswordConfirm,
  ] = useState("");

  const [phone, setPhone] =
    useState("");

  const [verificationCode, setVerificationCode] =
    useState("");

  const [phoneVerified, setPhoneVerified] =
    useState(false);

  const [verificationToken, setVerificationToken] =
    useState("");

  const [sendingCode, setSendingCode] =
    useState(false);

  const [verifyingCode, setVerifyingCode] =
    useState(false);

  const [resendLocked, setResendLocked] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  /*
   * 회원가입 전 사용자가
   * 이동하려고 했던 TALKLY 내부 경로
   */
  const nextParam =
    searchParams.get("next");

  const safeNextPath =
    nextParam &&
    nextParam.startsWith("/") &&
    !nextParam.startsWith("//")
      ? nextParam
      : null;

  /*
   * 로그인 페이지에서도
   * next 값을 유지합니다.
   */
  const loginHref =
    safeNextPath
      ? `/login?next=${encodeURIComponent(
          safeNextPath
        )}`
      : "/login";

  function normalizePhone(value: string) {
    return value.replace(/[^0-9]/g, "");
  }

  function handlePhoneChange(value: string) {
    const digits = normalizePhone(value).slice(0, 11);
    setPhone(digits);
    setVerificationCode("");
    setPhoneVerified(false);
    setVerificationToken("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleSendVerificationCode() {
    if (sendingCode || loading || resendLocked) {
      return;
    }

    const normalizedPhone = normalizePhone(phone);

    if (!/^01[016789][0-9]{7,8}$/.test(normalizedPhone)) {
      setErrorMessage("올바른 휴대폰 번호를 입력해주세요.");
      return;
    }

    setSendingCode(true);
    setErrorMessage("");
    setSuccessMessage("");
    setPhoneVerified(false);
    setVerificationToken("");

    try {
      const response = await fetch("/api/auth/phone/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: normalizedPhone,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setErrorMessage(
          result?.error ?? "인증번호를 발송하지 못했습니다."
        );
        return;
      }

      setSuccessMessage(
        "인증번호를 발송했습니다. 5분 안에 입력해주세요."
      );
      setResendLocked(true);
      window.setTimeout(() => {
        setResendLocked(false);
      }, 60_000);
    } catch (error) {
      console.error("PHONE SEND ERROR:", error);
      setErrorMessage(
        "인증번호 발송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setSendingCode(false);
    }
  }

  async function handleVerifyPhone() {
    if (verifyingCode || loading || phoneVerified) {
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    const code = verificationCode.replace(/[^0-9]/g, "");

    if (!/^[0-9]{6}$/.test(code)) {
      setErrorMessage("6자리 인증번호를 입력해주세요.");
      return;
    }

    setVerifyingCode(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/auth/phone/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          code,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setErrorMessage(
          result?.error ?? "휴대폰 인증에 실패했습니다."
        );
        return;
      }

      if (!result?.verificationToken) {
        setErrorMessage("휴대폰 인증정보를 확인하지 못했습니다.");
        return;
      }

      setVerificationToken(result.verificationToken);
      setPhoneVerified(true);
      setSuccessMessage("휴대폰 인증이 완료되었습니다.");
    } catch (error) {
      console.error("PHONE VERIFY ERROR:", error);
      setErrorMessage(
        "휴대폰 인증 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setVerifyingCode(false);
    }
  }

  async function handleSignup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const normalizedPhone = normalizePhone(phone);

    if (!trimmedName) {
      setErrorMessage("이름을 입력해주세요.");
      return;
    }

    if (!phoneVerified || !verificationToken) {
      setErrorMessage("휴대폰 인증을 완료해주세요.");
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("비밀번호는 8자 이상 입력해주세요.");
      return;
    }

    if (
      safeNextPath?.startsWith("/parent/") &&
      role !== "parent"
    ) {
      setErrorMessage(
        "자녀 레벨테스트는 학부모 계정으로 가입해주세요."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          password,
          role,
          phone: normalizedPhone,
          verificationToken,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setErrorMessage(
          result?.error ?? "회원가입에 실패했습니다."
        );
        return;
      }

      setSuccessMessage(
        safeNextPath
          ? "회원가입이 완료되었습니다. 로그인 후 레벨테스트를 계속할 수 있습니다."
          : "회원가입이 완료되었습니다. 로그인 페이지로 이동합니다."
      );

      window.setTimeout(() => {
        router.replace(loginHref);
        router.refresh();
      }, 1200);
    } catch (error) {
      console.error("SIGNUP ERROR:", error);
      setErrorMessage(
        "회원가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="talkly-signup-page"
      style={{
        minHeight:
          "100vh",

        display:
          "grid",

        gridTemplateColumns:
          "minmax(0, 0.9fr) minmax(480px, 1.1fr)",

        background:
          "linear-gradient(135deg, #eef4ff 0%, #f8fbff 48%, #ffffff 100%)",
      }}
    >
      <section
        className="talkly-signup-brand"
        style={{
          position:
            "relative",

          overflow:
            "hidden",

          display:
            "flex",

          alignItems:
            "center",

          padding:
            "70px 7vw",

          background:
            "linear-gradient(145deg, #0a1f44 0%, #173d75 72%, #2f66bb 100%)",

          color:
            "#ffffff",
        }}
      >
        <div
          style={{
            position:
              "relative",

            zIndex: 1,

            maxWidth:
              "560px",
          }}
        >
          <div
            style={{
              fontSize:
                "13px",

              fontWeight:
                900,

              letterSpacing:
                "0.14em",

              opacity:
                0.72,
            }}
          >
            TALKLY
          </div>

          <h1
            style={{
              margin:
                "14px 0 0",

              fontSize:
                "clamp(38px, 4.6vw, 62px)",

              lineHeight:
                1.1,

              letterSpacing:
                "-0.05em",
            }}
          >
            영어 학습의 시작을
            <br />
            TALKLY와 함께.
          </h1>

          <p
            style={{
              margin:
                "22px 0 0",

              color:
                "rgba(255,255,255,0.76)",

              fontSize:
                "16px",

              lineHeight:
                1.8,
            }}
          >
            학부모는 자녀를 등록해
            수업과 학습 기록을
            관리하고, 수강생은
            본인 계정으로 수업에
            직접 참여할 수 있습니다.
          </p>

          <div
            style={{
              marginTop:
                "32px",

              display:
                "grid",

              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",

              gap:
                "12px",
            }}
          >
            <div
              style={{
                padding:
                  "18px",

                borderRadius:
                  "14px",

                border:
                  "1px solid rgba(255,255,255,0.16)",

                background:
                  "rgba(255,255,255,0.07)",
              }}
            >
              <div
                style={{
                  fontSize:
                    "10px",

                  fontWeight:
                    900,

                  letterSpacing:
                    "0.08em",

                  opacity:
                    0.65,
                }}
              >
                PARENT
              </div>

              <div
                style={{
                  marginTop:
                    "6px",

                  fontSize:
                    "17px",

                  fontWeight:
                    900,
                }}
              >
                학부모
              </div>

              <p
                style={{
                  margin:
                    "7px 0 0",

                  color:
                    "rgba(255,255,255,0.66)",

                  fontSize:
                    "12px",

                  lineHeight:
                    1.6,
                }}
              >
                자녀 등록 후
                수업·출결·평가 관리
              </p>
            </div>

            <div
              style={{
                padding:
                  "18px",

                borderRadius:
                  "14px",

                border:
                  "1px solid rgba(255,255,255,0.16)",

                background:
                  "rgba(255,255,255,0.07)",
              }}
            >
              <div
                style={{
                  fontSize:
                    "10px",

                  fontWeight:
                    900,

                  letterSpacing:
                    "0.08em",

                  opacity:
                    0.65,
                }}
              >
                STUDENT
              </div>

              <div
                style={{
                  marginTop:
                    "6px",

                  fontSize:
                    "17px",

                  fontWeight:
                    900,
                }}
              >
                수강생
              </div>

              <p
                style={{
                  margin:
                    "7px 0 0",

                  color:
                    "rgba(255,255,255,0.66)",

                  fontSize:
                    "12px",

                  lineHeight:
                    1.6,
                }}
              >
                본인 계정으로
                수업 참여 및 학습관리
              </p>
            </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          style={{
            position:
              "absolute",

            width:
              "420px",

            height:
              "420px",

            left:
              "-210px",

            bottom:
              "-190px",

            borderRadius:
              "50%",

            border:
              "1px solid rgba(255,255,255,0.12)",
          }}
        />
      </section>

      <section
        className="talkly-signup-form-area"
        style={{
          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "center",

          padding:
            "48px",
        }}
      >
        <div
          style={{
            width:
              "100%",

            maxWidth:
              "500px",
          }}
        >
          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",

              gap:
                "16px",

              marginBottom:
                "24px",
            }}
          >
            <Link
              href="/"
              style={{
                color:
                  "#3f75dc",

                textDecoration:
                  "none",

                fontSize:
                  "13px",

                fontWeight:
                  800,
              }}
            >
              ← TALKLY 홈
            </Link>

            <Link
              href={
                loginHref
              }
              style={{
                color:
                  "#0a1f44",

                textDecoration:
                  "none",

                fontSize:
                  "13px",

                fontWeight:
                  800,
              }}
            >
              이미 회원이신가요?
              로그인 →
            </Link>
          </div>

          <div
            style={{
              padding:
                "34px",

              borderRadius:
                "20px",

              border:
                "1px solid #e1e9f5",

              background:
                "#ffffff",

              boxShadow:
                "0 22px 60px rgba(10,31,68,0.10)",
            }}
          >
            <div
              style={{
                color:
                  "#3f75dc",

                fontSize:
                  "11px",

                fontWeight:
                  900,

                letterSpacing:
                  "0.09em",
              }}
            >
              JOIN TALKLY
            </div>

            <h2
              style={{
                margin:
                  "8px 0 0",

                color:
                  "#0a1f44",

                fontSize:
                  "31px",

                letterSpacing:
                  "-0.04em",
              }}
            >
              회원가입
            </h2>

            <p
              style={{
                margin:
                  "8px 0 0",

                color:
                  "#6f7f96",

                fontSize:
                  "14px",

                lineHeight:
                  1.65,
              }}
            >
              {safeNextPath
                ? "레벨테스트를 계속하려면 회원 유형을 선택하고 가입해주세요."
                : "회원 유형을 선택하고 기본 정보를 입력해주세요."}
            </p>

            <form
              onSubmit={
                handleSignup
              }
              style={{
                marginTop:
                  "26px",
              }}
            >
              <div
                style={{
                  marginBottom:
                    "20px",
                }}
              >
                <div
                  style={{
                    marginBottom:
                      "9px",

                    color:
                      "#0a1f44",

                    fontSize:
                      "13px",

                    fontWeight:
                      800,
                  }}
                >
                  회원 유형
                </div>

                <div
                  className="talkly-role-selector"
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",

                    gap:
                      "10px",
                  }}
                >
                  {[
                    {
                      value:
                        "parent" as const,

                      title:
                        "학부모",

                      description:
                        "자녀의 수업과 학습을 관리합니다.",
                    },
                    {
                      value:
                        "student" as const,

                      title:
                        "수강생",

                      description:
                        "본인이 직접 수업에 참여합니다.",
                    },
                  ].map(
                    (
                      item
                    ) => {
                      const selected =
                        role ===
                        item.value;

                      const lockedForLevelTest =
                        Boolean(
                          safeNextPath?.startsWith(
                            "/parent/"
                          )
                        ) &&
                        item.value ===
                          "student";

                      return (
                        <button
                          key={
                            item.value
                          }

                          type="button"

                          disabled={
                            loading ||
                            lockedForLevelTest
                          }

                          onClick={() =>
                            setRole(
                              item.value
                            )
                          }

                          style={{
                            textAlign:
                              "left",

                            padding:
                              "15px",

                            borderRadius:
                              "11px",

                            border:
                              selected
                                ? "2px solid #3f75dc"
                                : "1px solid #dce4ef",

                            background:
                              selected
                                ? "#f1f6ff"
                                : "#ffffff",

                            opacity:
                              lockedForLevelTest
                                ? 0.45
                                : 1,

                            cursor:
                              loading ||
                              lockedForLevelTest
                                ? "default"
                                : "pointer",
                          }}
                        >
                          <div
                            style={{
                              color:
                                selected
                                  ? "#2f66bb"
                                  : "#0a1f44",

                              fontSize:
                                "14px",

                              fontWeight:
                                900,
                            }}
                          >
                            {
                              item.title
                            }
                          </div>

                          <div
                            style={{
                              marginTop:
                                "4px",

                              color:
                                "#7b899c",

                              fontSize:
                                "11px",

                              lineHeight:
                                1.5,
                            }}
                          >
                            {
                              item.description
                            }
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <SignupField
                id="name"
                label="이름"
                type="text"
                value={name}
                onChange={
                  setName
                }
                placeholder="이름을 입력해주세요"
                autoComplete="name"
                disabled={
                  loading
                }
              />

              <SignupField
                id="email"
                label="이메일"
                type="email"
                value={email}
                onChange={
                  setEmail
                }
                placeholder="email@example.com"
                autoComplete="email"
                disabled={
                  loading
                }
              />


              <div
                style={{
                  marginBottom: "18px",
                }}
              >
                <label
                  htmlFor="phone"
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    color: "#0a1f44",
                    fontSize: "13px",
                    fontWeight: 800,
                  }}
                >
                  휴대폰 번호
                </label>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: "8px",
                  }}
                >
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) =>
                      handlePhoneChange(event.target.value)
                    }
                    required
                    inputMode="numeric"
                    autoComplete="tel"
                    disabled={loading || phoneVerified}
                    placeholder="01012345678"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      minHeight: "48px",
                      padding: "0 14px",
                      border: phoneVerified
                        ? "1px solid #b9dec6"
                        : "1px solid #dce4ef",
                      borderRadius: "10px",
                      background: phoneVerified ? "#f4fbf6" : "#ffffff",
                      color: "#16233a",
                      fontSize: "15px",
                      outline: "none",
                    }}
                  />

                  <button
                    type="button"
                    onClick={handleSendVerificationCode}
                    disabled={
                      loading ||
                      sendingCode ||
                      resendLocked ||
                      phoneVerified
                    }
                    style={{
                      minWidth: "112px",
                      minHeight: "48px",
                      padding: "0 14px",
                      border: "1px solid #3f75dc",
                      borderRadius: "10px",
                      background: phoneVerified ? "#eef7f1" : "#ffffff",
                      color: phoneVerified ? "#237443" : "#2f66bb",
                      fontSize: "12px",
                      fontWeight: 900,
                      cursor:
                        loading || sendingCode || resendLocked || phoneVerified
                          ? "default"
                          : "pointer",
                      opacity: resendLocked && !phoneVerified ? 0.65 : 1,
                    }}
                  >
                    {phoneVerified
                      ? "인증 완료"
                      : sendingCode
                      ? "발송 중..."
                      : resendLocked
                      ? "재발송 대기"
                      : "인증번호 받기"}
                  </button>
                </div>

                {!phoneVerified && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      gap: "8px",
                      marginTop: "8px",
                    }}
                  >
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(event) =>
                        setVerificationCode(
                          event.target.value.replace(/[^0-9]/g, "").slice(0, 6)
                        )
                      }
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      disabled={loading || verifyingCode}
                      placeholder="6자리 인증번호"
                      maxLength={6}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        minHeight: "48px",
                        padding: "0 14px",
                        border: "1px solid #dce4ef",
                        borderRadius: "10px",
                        background: "#ffffff",
                        color: "#16233a",
                        fontSize: "15px",
                        outline: "none",
                      }}
                    />

                    <button
                      type="button"
                      onClick={handleVerifyPhone}
                      disabled={
                        loading ||
                        verifyingCode ||
                        verificationCode.length !== 6
                      }
                      style={{
                        minWidth: "112px",
                        minHeight: "48px",
                        padding: "0 14px",
                        border: "none",
                        borderRadius: "10px",
                        background:
                          verificationCode.length === 6
                            ? "#0a1f44"
                            : "#a9b5c7",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontWeight: 900,
                        cursor:
                          loading ||
                          verifyingCode ||
                          verificationCode.length !== 6
                            ? "default"
                            : "pointer",
                      }}
                    >
                      {verifyingCode ? "확인 중..." : "인증 확인"}
                    </button>
                  </div>
                )}

                <div
                  style={{
                    marginTop: "7px",
                    color: phoneVerified ? "#237443" : "#7b899c",
                    fontSize: "11px",
                    lineHeight: 1.5,
                  }}
                >
                  {phoneVerified
                    ? "휴대폰 인증이 완료되었습니다."
                    : "회원가입을 위해 휴대폰 인증이 필요합니다."}
                </div>
              </div>

              <SignupField
                id="password"
                label="비밀번호"
                type="password"
                value={
                  password
                }
                onChange={
                  setPassword
                }
                placeholder="8자 이상 입력해주세요"
                autoComplete="new-password"
                disabled={
                  loading
                }
                minLength={8}
              />

              <SignupField
                id="passwordConfirm"
                label="비밀번호 확인"
                type="password"
                value={
                  passwordConfirm
                }
                onChange={
                  setPasswordConfirm
                }
                placeholder="비밀번호를 다시 입력해주세요"
                autoComplete="new-password"
                disabled={
                  loading
                }
                minLength={8}
              />

              <div
                style={{
                  margin:
                    "2px 0 18px",

                  padding:
                    "13px 14px",

                  borderRadius:
                    "9px",

                  background:
                    "#f7faff",

                  border:
                    "1px solid #e3ebf7",

                  color:
                    "#6f7f96",

                  fontSize:
                    "12px",

                  lineHeight:
                    1.6,
                }}
              >
                {safeNextPath?.startsWith(
                  "/parent/"
                )
                  ? "레벨테스트는 학부모 계정으로 신청합니다. 가입 후 로그인하면 학생 정보를 입력하고 바로 레벨테스트를 진행할 수 있습니다."
                  : role ===
                    "parent"
                  ? "학부모 가입 후 자녀를 등록하면 수업 일정, 출결, 학습평가를 확인할 수 있습니다."
                  : "연령과 관계없이 본인 계정으로 직접 가입할 수 있습니다. 어린 수강생은 학부모 계정의 자녀 관리 방식도 이용할 수 있습니다."}
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  style={{
                    marginBottom:
                      "16px",

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
                  {
                    errorMessage
                  }
                </div>
              )}

              {successMessage && (
                <div
                  role="status"
                  style={{
                    marginBottom:
                      "16px",

                    padding:
                      "13px 14px",

                    borderRadius:
                      "9px",

                    border:
                      "1px solid #c9e8d4",

                    background:
                      "#f4fbf6",

                    color:
                      "#237443",

                    fontSize:
                      "13px",

                    lineHeight:
                      1.55,
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
                  loading || !phoneVerified
                }
                style={{
                  width:
                    "100%",

                  minHeight:
                    "50px",

                  border:
                    "none",

                  borderRadius:
                    "10px",

                  background:
                    loading || !phoneVerified
                      ? "#91a9d7"
                      : "#3f75dc",

                  color:
                    "#ffffff",

                  fontSize:
                    "15px",

                  fontWeight:
                    900,

                  cursor:
                    loading || !phoneVerified
                      ? "default"
                      : "pointer",

                  boxShadow:
                    "0 10px 24px rgba(63,117,220,0.24)",
                }}
              >
                {loading
                  ? "가입 처리 중..."
                  : !phoneVerified
                  ? "휴대폰 인증 후 가입할 수 있습니다"
                  : "TALKLY 회원가입"}
              </button>
            </form>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 960px) {
          .talkly-signup-page {
            grid-template-columns: 1fr !important;
          }

          .talkly-signup-brand {
            min-height: 380px;
            padding: 54px 28px !important;
          }

          .talkly-signup-form-area {
            padding: 34px 20px 48px !important;
          }
        }

        @media (max-width: 560px) {
          .talkly-signup-brand {
            min-height: 330px;
          }

          .talkly-role-selector {
            grid-template-columns: 1fr !important;
          }

          .talkly-signup-form-area > div > div:last-child {
            padding: 26px 20px !important;
          }
        }
      `}</style>
    </main>
  );
}

type SignupFieldProps = {
  id: string;
  label: string;

  type:
    | "text"
    | "email"
    | "password";

  value: string;

  onChange: (
    value: string
  ) => void;

  placeholder:
    string;

  autoComplete:
    string;

  disabled:
    boolean;

  minLength?:
    number;
};

function SignupField({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  minLength,
}: SignupFieldProps) {
  return (
    <div
      style={{
        marginBottom:
          "18px",
      }}
    >
      <label
        htmlFor={id}
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
        {label}
      </label>

      <input
        id={id}

        type={type}

        value={value}

        onChange={(
          event
        ) =>
          onChange(
            event.target
              .value
          )
        }

        required

        minLength={
          minLength
        }

        autoComplete={
          autoComplete
        }

        disabled={
          disabled
        }

        placeholder={
          placeholder
        }

        style={{
          width:
            "100%",

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
            disabled
              ? "#f7f9fc"
              : "#ffffff",

          color:
            "#16233a",

          fontSize:
            "15px",

          outline:
            "none",
        }}
      />
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight:
              "100vh",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            background:
              "linear-gradient(135deg, #eef4ff 0%, #f8fbff 48%, #ffffff 100%)",

            color:
              "#667085",

            fontSize:
              "14px",

            fontWeight:
              800,
          }}
        >
          TALKLY 회원가입 페이지를 불러오는 중입니다...
        </main>
      }
    >
      <SignupPageContent />
    </Suspense>
  );
}