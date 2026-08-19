import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import EnrollmentForm from "./EnrollmentForm";

export default async function NewEnrollmentPage() {
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
        수강 등록
      </h1>

      <p
        style={{
          marginTop: 0,
          marginBottom: "32px",
        }}
      >
        학생의 수강 과정과 담당 강사, 수강 기간을 등록합니다.
      </p>

      <EnrollmentForm />
    </main>
  );
}