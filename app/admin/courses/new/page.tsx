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
        padding: "40px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ marginBottom: "8px" }}>
        과정 등록
      </h1>

      <p
        style={{
          marginTop: 0,
          marginBottom: "32px",
        }}
      >
        TALKLY에서 운영할 수업 과정의 기본 정보를 등록합니다.
      </p>

      <CourseForm />
    </main>
  );
}