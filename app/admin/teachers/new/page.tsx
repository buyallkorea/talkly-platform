import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TeacherForm from "./TeacherForm";

export default async function NewTeacherPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: profile,
  } =
    await supabase
      .from("profiles")
      .select("role")
      .eq(
        "id",
        user.id
      )
      .maybeSingle();

  if (
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  return (
    <main
      style={{
        padding: "40px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <Link
        href="/admin/teachers"
        style={{
          color: "inherit",
          textDecoration: "none",
          fontSize: "14px",
          opacity: 0.72,
        }}
      >
        ← 강사 관리
      </Link>

      <div
        style={{
          marginTop: "24px",
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: 900,
            letterSpacing:
              "0.08em",
            color: "#175cd3",
          }}
        >
          TEACHER REGISTRATION
        </div>

        <h1
          style={{
            margin: "6px 0 0",
            fontSize: "32px",
            letterSpacing:
              "-0.03em",
          }}
        >
          강사등록
        </h1>

        <p
          style={{
            marginTop: "9px",
            marginBottom: 0,
            color: "#667085",
            lineHeight: 1.7,
          }}
        >
          TALKLY에서 수업할 강사의 계정과
          프로필을 등록합니다. 관리자가
          등록을 완료하면 강사의 이메일로
          계정 설정 안내메일이 발송되며,
          강사는 본인이 사용할 비밀번호를
          직접 설정합니다.
        </p>
      </div>

      <TeacherForm />
    </main>
  );
}