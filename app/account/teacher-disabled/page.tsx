import Link from "next/link";

export default function TeacherDisabledPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "48px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
      }}
    >
      <section
        style={{
          width:
            "min(560px, 100%)",
          padding: "32px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "18px",
          background: "#ffffff",
          boxShadow:
            "0 16px 45px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          style={{
            color: "#2f6fed",
            fontSize: "12px",
            fontWeight: 900,
            letterSpacing: "0.09em",
          }}
        >
          TALKLY TEACHER
        </div>

        <h1
          style={{
            margin: "8px 0 0",
            color: "#0a1f44",
            fontSize: "30px",
          }}
        >
          Teacher access is unavailable
        </h1>

        <p
          style={{
            margin: "14px 0 0",
            color: "#475467",
            fontSize: "15px",
            lineHeight: 1.75,
          }}
        >
          Your TALKLY teacher account
          is currently inactive or is
          not fully connected to a
          teacher profile. Please
          contact the TALKLY
          administrator.
        </p>

        <p
          style={{
            margin: "8px 0 0",
            color: "#667085",
            fontSize: "13px",
            lineHeight: 1.65,
          }}
        >
          현재 강사 계정이 비활성화되어
          있거나 강사 프로필 연결을 확인할
          수 없습니다. TALKLY 관리자에게
          문의해 주세요.
        </p>

        <Link
          href="/"
          style={{
            display: "inline-flex",
            marginTop: "22px",
            padding: "11px 15px",
            borderRadius: "9px",
            background: "#0a1f44",
            color: "#ffffff",
            textDecoration: "none",
            fontSize: "13px",
            fontWeight: 900,
          }}
        >
          Back to TALKLY
        </Link>
      </section>
    </main>
  );
}