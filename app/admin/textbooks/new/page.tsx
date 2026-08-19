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
        교재 등록
      </h1>

      <p
        style={{
          marginTop: 0,
          marginBottom: "32px",
          opacity: 0.7,
        }}
      >
        TALKLY 수업에서 사용할 교재의 기본정보를 등록합니다.
      </p>

      <TextbookCreateForm />
    </main>
  );
}