import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import ChildForm from "./ChildForm";

export default async function NewChildPage() {
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

  if (!profile || profile.role !== "parent") {
    redirect("/");
  }

  return (
    <main
      style={{
        padding: "40px",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      <h1>자녀 등록</h1>

      <p
        style={{
          marginBottom: "24px",
        }}
      >
        TALKLY 수업을 이용할 자녀 정보를 등록합니다.
      </p>

      <ChildForm />
    </main>
  );
}