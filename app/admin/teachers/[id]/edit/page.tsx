import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import EditTeacherForm from "./EditTeacherForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditTeacherPage({
  params,
}: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!adminProfile || adminProfile.role !== "admin") {
    redirect("/");
  }

  const { data: teacher, error: teacherError } =
    await supabase
      .from("teacher_profiles")
      .select(`
        user_id,
        display_name,
        nationality,
        bio,
        specialties,
        years_experience,
        education,
        certifications,
        hourly_rate,
        is_active
      `)
      .eq("user_id", id)
      .maybeSingle();

  if (teacherError) {
    throw new Error(teacherError.message);
  }

  if (!teacher) {
    notFound();
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select(`
        id,
        name,
        phone,
        birth_date,
        gender,
        profile_image_url
      `)
      .eq("id", id)
      .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile) {
    notFound();
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
        강사정보 수정
      </h1>

      <p
        style={{
          marginTop: 0,
          marginBottom: "32px",
        }}
      >
        {teacher.display_name || profile.name || "강사"}의
        기본 정보와 강사 프로필을 수정합니다.
      </p>

      <EditTeacherForm
        profile={profile}
        teacher={teacher}
      />
    </main>
  );
}