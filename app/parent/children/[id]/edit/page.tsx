import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import EditChildForm from "./EditChildForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditChildPage({ params }: PageProps) {
  const { id } = await params;

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

  const { data: child, error } = await supabase
    .from("children")
    .select(`
      id,
      name,
      birth_date,
      school_name,
      grade,
      learning_goal
    `)
    .eq("id", id)
    .eq("parent_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!child) {
    notFound();
  }

  return (
    <main
      style={{
        padding: "40px",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      <h1>자녀 정보 수정</h1>

      <p style={{ marginBottom: "30px" }}>
        등록된 자녀의 기본 정보를 수정합니다.
      </p>

      <EditChildForm child={child} />
    </main>
  );
}