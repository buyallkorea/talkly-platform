"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

type Props = {
  childId: number;
  childName: string;

  studentUserId:
    | string
    | null;

  studentEmail:
    | string
    | null;
};

type ApiResult = {
  success?: boolean;
  error?: string;

  studentUserId?: string;
  studentName?: string;
  email?: string;

  updatedEnrollments?: number;
};

export default function StudentAccountCard({
  childId,
  childName,
  studentUserId,
  studentEmail,
}: Props) {
  const router =
    useRouter();

  const [
    email,
    setEmail,
  ] = useState("");

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

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  async function createAccount() {
    if (loading) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage(
        "학생 로그인 이메일을 입력해주세요."
      );

      return;
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !emailPattern.test(
        normalizedEmail
      )
    ) {
      setErrorMessage(
        "학생 로그인 이메일 형식이 올바르지 않습니다."
      );

      return;
    }

    if (
      password.length < 8
    ) {
      setErrorMessage(
        "비밀번호는 8자 이상으로 입력해주세요."
      );

      return;
    }

    if (
      password !==
      passwordConfirm
    ) {
      setErrorMessage(
        "비밀번호와 비밀번호 확인이 일치하지 않습니다."
      );

      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          `/api/parent/children/${childId}/student-account`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body:
              JSON.stringify({
                email:
                  normalizedEmail,

                password,
              }),
          }
        );

      /*
       * response.json()을 바로 호출하지 않습니다.
       *
       * Next.js 자체 오류 페이지가 HTML로
       * 반환되더라도 화면이 깨지지 않도록
       * 먼저 text로 읽습니다.
       */
      const rawText =
        await response.text();

      let result:
        ApiResult = {};

      if (rawText) {
        try {
          result =
            JSON.parse(
              rawText
            ) as ApiResult;
        } catch (
          parseError
        ) {
          console.error(
            "[Student Account] Non JSON API response:",
            rawText
          );

          console.error(
            "[Student Account] JSON parse error:",
            parseError
          );

          throw new Error(
            `학생 계정 생성 API에서 서버 오류가 발생했습니다. HTTP ${response.status}`
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            `학생 계정 생성에 실패했습니다. HTTP ${response.status}`
        );
      }

      if (
        !result.success
      ) {
        throw new Error(
          result.error ||
            "학생 계정이 정상적으로 생성되지 않았습니다."
        );
      }

      setSuccessMessage(
        `${childName} 학생의 로그인 계정이 생성되었습니다. 기존 수강 ${result.updatedEnrollments ?? 0}건도 학생 계정에 연결되었습니다.`
      );

      setPassword("");
      setPasswordConfirm("");

      /*
       * 서버 컴포넌트를 다시 읽어서
       * student_user_id가 연결된 화면으로 전환
       */
      router.refresh();
    } catch (error) {
      console.error(
        "[Student Account] Create account error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "학생 계정 생성 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * =======================================================
   * 이미 학생 계정이 연결된 상태
   * =======================================================
   */
  if (studentUserId) {
    return (
      <section
        className="talkly-card"
        style={{
          marginTop:
            "26px",

          padding:
            "28px",
        }}
      >
        <div className="talkly-section-label">
          STUDENT ACCOUNT
        </div>

        <div
          style={{
            marginTop:
              "8px",

            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "flex-start",

            gap:
              "18px",

            flexWrap:
              "wrap",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,

                color:
                  "var(--talkly-navy)",

                fontSize:
                  "25px",
              }}
            >
              학생 로그인 계정
            </h2>

            <p
              style={{
                margin:
                  "9px 0 0",

                color:
                  "var(--text-muted)",

                lineHeight:
                  1.7,
              }}
            >
              {childName} 학생의
              TALKLY 학생 계정이
              연결되어 있습니다.
            </p>
          </div>

          <span
            style={{
              padding:
                "7px 11px",

              borderRadius:
                "999px",

              background:
                "#eef9f2",

              border:
                "1px solid #a9ddbd",

              color:
                "#197044",

              fontSize:
                "12px",

              fontWeight:
                900,
            }}
          >
            연결완료
          </span>
        </div>

        <div
          style={{
            marginTop:
              "20px",

            padding:
              "18px",

            border:
              "1px solid #dce4ee",

            borderRadius:
              "12px",

            background:
              "#f8fafe",
          }}
        >
          <div
            style={{
              color:
                "#8491a5",

              fontSize:
                "11px",

              fontWeight:
                700,
            }}
          >
            학생 로그인 이메일
          </div>

          <div
            style={{
              marginTop:
                "6px",

              color:
                "var(--talkly-navy)",

              fontSize:
                "15px",

              fontWeight:
                900,
            }}
          >
            {studentEmail ||
              "학생 계정 연결 완료"}
          </div>
        </div>

        <div
          style={{
            marginTop:
              "14px",

            padding:
              "14px 16px",

            borderRadius:
              "10px",

            background:
              "#f5f8fe",

            border:
              "1px solid #dce7f5",

            color:
              "#526277",

            fontSize:
              "13px",

            lineHeight:
              1.7,
          }}
        >
          이 학생 계정으로 로그인하면
          연결된 수강정보와 수업 일정을
          학생 전용 화면에서 확인할 수
          있습니다.
        </div>
      </section>
    );
  }

  /*
   * =======================================================
   * 학생 계정 미연결
   * =======================================================
   */
  return (
    <section
      className="talkly-card"
      style={{
        marginTop:
          "26px",

        padding:
          "28px",
      }}
    >
      <div className="talkly-section-label">
        STUDENT ACCOUNT
      </div>

      <h2
        style={{
          margin:
            "7px 0 0",

          color:
            "var(--talkly-navy)",

          fontSize:
            "25px",
        }}
      >
        학생 로그인 계정 만들기
      </h2>

      <p
        style={{
          margin:
            "10px 0 0",

          color:
            "var(--text-muted)",

          lineHeight:
            1.7,
        }}
      >
        {childName} 학생이 직접 TALKLY에 로그인하여
        수업 일정과 학습정보를 확인할 수 있도록
        학생 계정을 만듭니다.
      </p>

      <div
        style={{
          marginTop:
            "22px",

          padding:
            "18px",

          borderRadius:
            "12px",

          background:
            "#f5f8fe",

          border:
            "1px solid #dce7f5",

          color:
            "#526277",

          fontSize:
            "13px",

          lineHeight:
            1.7,
        }}
      >
        계정을 만들면 현재 승인된 수강과 앞으로
        승인되는 수강정보가 이 학생 계정에
        연결됩니다.
      </div>

      <div className="student-account-grid">
        <div
          style={{
            gridColumn:
              "1 / -1",
          }}
        >
          <label
            style={
              labelStyle
            }
          >
            학생 로그인 이메일
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(
                e.target.value
              )
            }
            placeholder="예: student@example.com"
            autoComplete="email"
            style={
              fieldStyle
            }
            disabled={
              loading
            }
          />
        </div>

        <div>
          <label
            style={
              labelStyle
            }
          >
            비밀번호
          </label>

          <input
            type="password"
            value={
              password
            }
            onChange={(e) =>
              setPassword(
                e.target.value
              )
            }
            placeholder="8자 이상"
            autoComplete="new-password"
            style={
              fieldStyle
            }
            disabled={
              loading
            }
          />
        </div>

        <div>
          <label
            style={
              labelStyle
            }
          >
            비밀번호 확인
          </label>

          <input
            type="password"
            value={
              passwordConfirm
            }
            onChange={(e) =>
              setPasswordConfirm(
                e.target.value
              )
            }
            placeholder="비밀번호 다시 입력"
            autoComplete="new-password"
            style={
              fieldStyle
            }
            disabled={
              loading
            }
          />
        </div>
      </div>

      {successMessage && (
        <div
          style={{
            marginTop:
              "16px",

            padding:
              "14px 16px",

            borderRadius:
              "10px",

            border:
              "1px solid #a9ddbd",

            background:
              "#eef9f2",

            color:
              "#197044",

            lineHeight:
              1.7,

            fontWeight:
              700,
          }}
        >
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            marginTop:
              "16px",

            padding:
              "14px 16px",

            borderRadius:
              "10px",

            border:
              "1px solid #efb3ad",

            background:
              "#fff2f1",

            color:
              "#b42318",

            lineHeight:
              1.7,
          }}
        >
          {errorMessage}
        </div>
      )}

      <div
        style={{
          marginTop:
            "20px",

          display:
            "flex",

          justifyContent:
            "flex-end",
        }}
      >
        <button
          type="button"
          onClick={
            createAccount
          }
          disabled={
            loading
          }
          style={{
            minHeight:
              "48px",

            padding:
              "0 22px",

            border: 0,

            borderRadius:
              "10px",

            background:
              "var(--talkly-blue)",

            color:
              "#ffffff",

            fontFamily:
              "inherit",

            fontSize:
              "14px",

            fontWeight:
              900,

            cursor:
              loading
                ? "default"
                : "pointer",

            opacity:
              loading
                ? 0.65
                : 1,
          }}
        >
          {loading
            ? "계정 생성 중..."
            : "학생 계정 만들기"}
        </button>
      </div>

      <style>{`
        .student-account-grid {
          margin-top: 22px;

          display: grid;

          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );

          gap: 14px;
        }

        @media(max-width: 680px) {
          .student-account-grid {
            grid-template-columns:
              1fr;
          }
        }
      `}</style>
    </section>
  );
}

const labelStyle = {
  display:
    "block",

  marginBottom:
    "7px",

  color:
    "var(--talkly-navy)",

  fontSize:
    "13px",

  fontWeight:
    800,
};

const fieldStyle = {
  width:
    "100%",

  boxSizing:
    "border-box" as const,

  padding:
    "12px 13px",

  border:
    "1px solid #dce4ee",

  borderRadius:
    "10px",

  background:
    "#ffffff",

  color:
    "#0a1f44",

  fontFamily:
    "inherit",

  fontSize:
    "14px",

  outline:
    "none",
};