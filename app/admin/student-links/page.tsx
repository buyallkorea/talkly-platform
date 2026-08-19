import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import StudentLinkForm from "./StudentLinkForm";

type StudentProfile = {
  id: string;
  name: string | null;
  email?: string | null;
};

type ChildRow = {
  id: number;
  name: string;
  grade: string | null;
  school_name: string | null;
  student_user_id: string | null;
};

export default async function StudentLinksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: adminProfile,
    error: adminProfileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (adminProfileError) {
    throw new Error(adminProfileError.message);
  }

  if (
    !adminProfile ||
    adminProfile.role !== "admin"
  ) {
    redirect("/");
  }

  /*
   * 학생 계정
   */
  const {
    data: students,
    error: studentsError,
  } = await supabase
    .from("profiles")
    .select(`
      id,
      name
    `)
    .eq("role", "student")
    .order("name");

  if (studentsError) {
    throw new Error(
      `학생 계정 조회 실패: ${studentsError.message}`
    );
  }

  /*
   * 학부모가 등록한 활성 자녀
   */
  const {
    data: children,
    error: childrenError,
  } = await supabase
    .from("children")
    .select(`
      id,
      name,
      grade,
      school_name,
      student_user_id
    `)
    .eq("is_active", true)
    .order("name");

  if (childrenError) {
    throw new Error(
      `자녀 조회 실패: ${childrenError.message}`
    );
  }

  return (
    <main
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "40px",
      }}
    >
      <Link
        href="/admin"
        style={{
          color: "inherit",
          textDecoration: "none",
          fontSize: "13px",
          opacity: 0.65,
        }}
      >
        ← 관리자 대시보드
      </Link>

      <div
        style={{
          marginTop: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "34px",
              letterSpacing: "-0.03em",
            }}
          >
            학생 계정 연결
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              opacity: 0.6,
              lineHeight: 1.7,
            }}
          >
            학부모가 등록한 자녀 정보와 학생 로그인 계정을
            연결합니다.
          </p>
        </div>
      </div>

      <div
        style={{
          marginTop: "28px",
          padding: "18px 20px",
          borderRadius: "12px",
          border: "1px solid rgba(47,111,237,.35)",
          background: "rgba(47,111,237,.08)",
          lineHeight: 1.7,
          fontSize: "13px",
        }}
      >
        학생 계정을 자녀와 연결하면 해당 자녀의 기존 수강정보와
        앞으로 승인되는 수강정보를 학생 계정에서 확인할 수 있습니다.
      </div>

      <StudentLinkForm
        children={(children ?? []) as ChildRow[]}
        students={(students ?? []) as StudentProfile[]}
      />
    </main>
  );
}