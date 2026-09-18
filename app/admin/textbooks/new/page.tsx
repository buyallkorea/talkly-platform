import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TextbookCreateForm from "./TextbookCreateForm";

export default async function NewTextbookPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    redirect("/");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f6f8fc",
        padding: "32px 20px 60px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            marginBottom: "24px",
          }}
        >
          <a
            href="/admin/textbooks"
            style={{
              display: "inline-block",
              marginBottom: "16px",
              color: "#667085",
              fontSize: "14px",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            ← 교재 관리
          </a>

          <h1
            style={{
              margin: 0,
              color: "#0A1F44",
              fontSize: "30px",
              fontWeight: 900,
              letterSpacing: "-0.03em",
            }}
          >
            교재 등록
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              color: "#667085",
              fontSize: "14px",
              lineHeight: 1.7,
            }}
          >
            TALKLY 수업과 커리큘럼에서 사용할 교재를 등록합니다.
          </p>
        </div>

        <TextbookCreateForm />
      </div>
    </main>
  );
}