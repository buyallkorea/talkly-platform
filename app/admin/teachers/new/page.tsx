import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TeacherForm from "./TeacherForm";

export default async function NewTeacherPage() {
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
        강사 등록
      </h1>

      <p
        style={{
          marginTop: 0,
          marginBottom: "32px",
        }}
      >
        TALKLY에서 수업할 강사의 로그인 계정과 프로필을 등록합니다.
      </p>

      <TeacherForm />
    </main>
  );
}