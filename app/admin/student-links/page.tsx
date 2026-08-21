import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import StudentLinkForm from "./StudentLinkForm";

type StudentProfile = {
  id: string;
  name: string | null;
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

  if (!adminProfile || adminProfile.role !== "admin") {
    redirect("/");
  }

  const {
    data: students,
    error: studentsError,
  } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("role", "student")
    .order("name");

  if (studentsError) {
    throw new Error(
      `학생 계정 조회 실패: ${studentsError.message}`
    );
  }

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

  const childRows = (children ?? []) as ChildRow[];
  const studentRows = (students ?? []) as StudentProfile[];

  const linkedCount = childRows.filter(
    (child) => !!child.student_user_id
  ).length;

  const unlinkedCount = childRows.length - linkedCount;

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1180px",
        margin: "0 auto",
      }}
    >
      <Link
        href="/admin"
        style={{
          color: "#667085",
          textDecoration: "none",
          fontSize: "13px",
          fontWeight: 700,
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
              color: "#101828",
              fontSize: "34px",
              letterSpacing: "-0.03em",
            }}
          >
            학생 계정 연결
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              color: "#667085",
              lineHeight: 1.7,
            }}
          >
            학부모가 등록한 자녀 정보와 실제 학생 로그인 계정을
            연결하고 관리합니다.
          </p>
        </div>
      </div>

      <div
        style={{
          marginTop: "26px",
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "14px",
        }}
        className="student-link-summary-grid"
      >
        <SummaryCard label="전체 자녀" value={childRows.length} />
        <SummaryCard label="연결 완료" value={linkedCount} tone="success" />
        <SummaryCard
          label="미연결"
          value={unlinkedCount}
          tone={unlinkedCount > 0 ? "warning" : "default"}
        />
        <SummaryCard label="학생 로그인 계정" value={studentRows.length} />
      </div>

      <div
        style={{
          marginTop: "18px",
          padding: "17px 19px",
          borderRadius: "12px",
          border: "1px solid #b9d0ff",
          background: "#eef4ff",
          color: "#344054",
          lineHeight: 1.7,
          fontSize: "13px",
        }}
      >
        학생 계정을 자녀와 연결하면 해당 자녀의 기존 수강정보와
        앞으로 승인되는 수강정보를 학생 로그인 계정에서도 확인할 수
        있습니다. 연결을 해제해도 자녀와 수강 기록 자체는 삭제되지
        않습니다.
      </div>

      <StudentLinkForm
        children={childRows}
        students={studentRows}
      />

      <style>{`
        @media (max-width: 840px) {
          .student-link-summary-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 520px) {
          .student-link-summary-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning";
}) {
  const valueColor =
    tone === "success"
      ? "#14804a"
      : tone === "warning"
        ? "#b54708"
        : "#101828";

  return (
    <div
      style={{
        minHeight: "118px",
        padding: "20px",
        border: "1px solid #e4e7ec",
        borderRadius: "14px",
        background: "#ffffff",
        boxShadow:
          "0 1px 2px rgba(16,24,40,0.03), 0 8px 24px rgba(16,24,40,0.04)",
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "13px",
          color: valueColor,
          fontSize: "34px",
          fontWeight: 900,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
    </div>
  );
}