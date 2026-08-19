import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import EnrollmentOptionForm from "./EnrollmentOptionForm";

export default async function NewEnrollmentOptionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  return (
    <main
      style={{
        maxWidth: "1180px",
        margin: "0 auto",
        padding: "40px",
      }}
    >
      <Link
        href="/admin/enrollment-options"
        style={{
          color: "inherit",
          textDecoration: "none",
          fontSize: "13px",
          opacity: 0.65,
        }}
      >
        ← 수강 가능 일정 관리
      </Link>

      <h1
        style={{
          margin: "14px 0 0",
          fontSize: "32px",
          letterSpacing: "-0.03em",
        }}
      >
        새 수강 가능 일정
      </h1>

      <p
        style={{
          margin: "10px 0 30px",
          opacity: 0.6,
          lineHeight: 1.7,
        }}
      >
        학생과 학부모가 선택하여 신청할 수 있는 표준 수업 일정을
        생성합니다.
      </p>

      <EnrollmentOptionForm />
    </main>
  );
}