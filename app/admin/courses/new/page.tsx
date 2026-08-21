import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import CourseForm from "./CourseForm";

export default async function NewCoursePage() {
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
        width: "100%",
        maxWidth: "980px",
        margin: "0 auto",
        padding: "54px 42px 90px",
      }}
    >
      <Link
        href="/admin/courses"
        style={{
          color: "#667085",
          textDecoration: "none",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        ← 과정 관리
      </Link>

      <div
        style={{
          marginTop: "22px",
        }}
      >
        <div
          style={{
            color: "#2f6fed",
            fontSize: "12px",
            fontWeight: 900,
            letterSpacing: "0.08em",
          }}
        >
          COURSE MANAGEMENT
        </div>

        <h1
          style={{
            margin: "10px 0 0",
            color: "#101828",
            fontSize: "36px",
            lineHeight: 1.2,
            letterSpacing: "-0.04em",
          }}
        >
          과정 등록
        </h1>

        <p
          style={{
            margin: "13px 0 0",
            color: "#667085",
            fontSize: "15px",
            lineHeight: 1.7,
          }}
        >
          TALKLY에서 운영할 수업 과정의 기본 정보와 학습
          분류를 등록합니다.
        </p>
      </div>

      <CourseForm />
    </main>
  );
}