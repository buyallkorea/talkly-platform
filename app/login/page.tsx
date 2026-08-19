"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        setErrorMessage(
          "이메일 또는 비밀번호를 확인해주세요."
        );
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage(
          "로그인 정보를 확인할 수 없습니다."
        );
        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile) {
        setErrorMessage(
          "사용자 정보를 불러올 수 없습니다."
        );
        return;
      }

      switch (profile.role) {
        case "admin":
          router.replace("/admin");
          break;

        case "teacher":
          router.replace("/teacher");
          break;

        case "student":
          router.replace("/student");
          break;

        case "parent":
          router.replace("/parent");
          break;

        default:
          setErrorMessage(
            "사용자 권한 정보를 확인할 수 없습니다."
          );
          return;
      }

      router.refresh();
    } catch (error) {
      console.error("LOGIN ERROR:", error);

      setErrorMessage(
        "로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="talkly-login-page"
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
        className="talkly-login-brand"
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
              letterSpacing: "0.14em",
              opacity: 0.72,
            }}
          >
            TALKLY
          </div>

          <h1
            style={{
              margin: "14px 0 0",
              fontSize: "clamp(40px, 5vw, 68px)",
              lineHeight: 1.08,
              letterSpacing: "-0.05em",
            }}
          >
            언제 어디서나 톡.
          </h1>

          <p
            style={{
              margin: "22px 0 0",
              maxWidth: "540px",
              color: "rgba(255,255,255,0.76)",
              fontSize: "17px",
              lineHeight: 1.8,
            }}
          >
            수업 일정부터 TALKLY Classroom,
            출결과 학습평가까지 하나의 학습관리
            환경에서 확인하세요.
          </p>

          <div
            style={{
              marginTop: "34px",
              display: "grid",
              gridTemplateColumns:
                "repeat(3, minmax(0, 1fr))",
              gap: "12px",
              maxWidth: "520px",
            }}
          >
            {[
              ["STUDENT", "학생"],
              ["PARENT", "학부모"],
              ["TEACHER", "강사"],
            ].map(([en, ko]) => (
              <div
                key={en}
                style={{
                  padding: "16px",
                  borderRadius: "13px",
                  border:
                    "1px solid rgba(255,255,255,0.16)",
                  background:
                    "rgba(255,255,255,0.07)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    opacity: 0.65,
                  }}
                >
                  {en}
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "15px",
                    fontWeight: 800,
                  }}
                >
                  {ko}
                </div>
              </div>
            ))}
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
        className="talkly-login-form-area"
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
            href="/"
            style={{
              display: "inline-flex",
              marginBottom: "28px",
              color: "#3f75dc",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 800,
            }}
          >
            ← TALKLY 홈
          </Link>

          <div
            style={{
              padding: "34px",
              borderRadius: "20px",
              border: "1px solid #e1e9f5",
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
                letterSpacing: "0.09em",
              }}
            >
              WELCOME BACK
            </div>

            <h2
              style={{
                margin: "8px 0 0",
                color: "#0a1f44",
                fontSize: "31px",
                letterSpacing: "-0.04em",
              }}
            >
              로그인
            </h2>

            <p
              style={{
                margin: "8px 0 0",
                color: "#6f7f96",
                fontSize: "14px",
                lineHeight: 1.65,
              }}
            >
              등록된 계정으로 TALKLY에
              로그인하세요.
            </p>

            <form
              onSubmit={handleLogin}
              style={{
                marginTop: "28px",
              }}
            >
              <div style={{ marginBottom: "18px" }}>
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
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  required
                  disabled={loading}
                  placeholder="email@example.com"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    minHeight: "48px",
                    padding: "0 14px",
                    border: "1px solid #dce4ef",
                    borderRadius: "10px",
                    background: loading
                      ? "#f7f9fc"
                      : "#ffffff",
                    color: "#16233a",
                    fontSize: "15px",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: "18px" }}>
                <label
                  htmlFor="password"
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    color: "#0a1f44",
                    fontSize: "13px",
                    fontWeight: 800,
                  }}
                >
                  비밀번호
                </label>

                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  required
                  disabled={loading}
                  placeholder="비밀번호"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    minHeight: "48px",
                    padding: "0 14px",
                    border: "1px solid #dce4ef",
                    borderRadius: "10px",
                    background: loading
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
                    marginBottom: "18px",
                    padding: "13px 14px",
                    borderRadius: "9px",
                    border: "1px solid #f1c6c6",
                    background: "#fff7f7",
                    color: "#c43c3c",
                    fontSize: "13px",
                    lineHeight: 1.55,
                  }}
                >
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  minHeight: "50px",
                  border: "none",
                  borderRadius: "10px",
                  background: loading
                    ? "#91a9d7"
                    : "#3f75dc",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 900,
                  cursor: loading
                    ? "default"
                    : "pointer",
                  boxShadow:
                    "0 10px 24px rgba(63,117,220,0.24)",
                }}
              >
                {loading
                  ? "로그인 중..."
                  : "로그인"}
              </button>
            </form>

            <div
              style={{
                marginTop: "22px",
                paddingTop: "18px",
                borderTop: "1px solid #edf1f6",
                color: "#8a97aa",
                fontSize: "12px",
                lineHeight: 1.6,
              }}
            >
              로그인 후 계정 유형에 따라
              학생·학부모·강사·관리자 페이지로
              자동 이동합니다.
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 900px) {
          .talkly-login-page {
            grid-template-columns: 1fr !important;
          }

          .talkly-login-brand {
            min-height: 360px;
            padding: 54px 28px !important;
          }

          .talkly-login-form-area {
            padding: 34px 20px 48px !important;
          }
        }

        @media (max-width: 560px) {
          .talkly-login-brand {
            min-height: 300px;
          }

          .talkly-login-brand > div:first-child > div:last-child {
            grid-template-columns: 1fr 1fr 1fr !important;
          }

          .talkly-login-form-area > div > div:last-child {
            padding: 26px 20px !important;
          }
        }
      `}</style>
    </main>
  );
}