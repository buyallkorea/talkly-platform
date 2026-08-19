import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import LogoutButton from "@/components/LogoutButton";

type AdminLayoutProps = {
  children: React.ReactNode;
};

const menuGroups = [
  {
    title: "운영 현황",
    items: [
      {
        label: "대시보드",
        href: "/admin",
      },
    ],
  },
  {
    title: "회원 관리",
    items: [
      {
        label: "학부모 관리",
        href: "/admin/parents",
      },
      {
        label: "학생 관리",
        href: "/admin/students",
      },
      {
        label: "강사 관리",
        href: "/admin/teachers",
      },
    ],
  },
  {
    title: "수업 운영",
    items: [
      {
        label: "과정 관리",
        href: "/admin/courses",
      },
      {
        label: "수강 관리",
        href: "/admin/enrollments",
      },
      {
        label: "수업 관리",
        href: "/admin/classes",
      },
      {
        label: "출결 관리",
        href: "/admin/attendance",
      },
      {
        label: "결석 관리",
        href: "/admin/holds",
      },
      {
        label: "학습 평가",
        href: "/admin/evaluations",
      },
    ],
  },
  {
    title: "교육 서비스",
    items: [
      {
        label: "레벨테스트",
        href: "/admin/level-tests",
      },
      {
        label: "상담 관리",
        href: "/admin/consultations",
      },
    ],
  },
  {
    title: "운영 설정",
    items: [
      {
        label: "결제 관리",
        href: "/admin/payments",
      },
      {
        label: "설정",
        href: "/admin/settings",
      },
    ],
  },
];

export default async function AdminLayout({
  children,
}: AdminLayoutProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role, name")
      .eq("id", user.id)
      .single();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns:
          "260px minmax(0, 1fr)",
        background: "#070707",
        color: "#f5f5f5",
      }}
    >
      <aside
        style={{
          minHeight: "100vh",
          padding: "28px 22px",
          borderRight:
            "1px solid rgba(255,255,255,0.16)",
          position: "sticky",
          top: 0,
          alignSelf: "start",
          boxSizing: "border-box",
        }}
      >
        <Link
          href="/admin"
          style={{
            display: "block",
            color: "inherit",
            textDecoration: "none",
          }}
        >
          <div
            style={{
              fontSize: "25px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            TALKLY ADMIN
          </div>

          <div
            style={{
              marginTop: "5px",
              fontSize: "12px",
              opacity: 0.55,
            }}
          >
            토클리 통합 관리자
          </div>
        </Link>

        <nav
          style={{
            marginTop: "34px",
            display: "flex",
            flexDirection: "column",
            gap: "26px",
          }}
        >
          {menuGroups.map((group) => (
            <div key={group.title}>
              <div
                style={{
                  marginBottom: "9px",
                  paddingLeft: "10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  opacity: 0.42,
                  letterSpacing: "0.08em",
                }}
              >
                {group.title}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: "block",
                      padding: "10px 11px",
                      borderRadius: "8px",
                      color: "inherit",
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div
        style={{
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            minHeight: "76px",
            padding: "16px 30px",
            borderBottom:
              "1px solid rgba(255,255,255,0.16)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
            boxSizing: "border-box",
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 700,
              }}
            >
              {profile.name || "관리자"}
            </div>

            <div
              style={{
                marginTop: "3px",
                fontSize: "12px",
                opacity: 0.55,
              }}
            >
              총괄 관리자
            </div>
          </div>

          <LogoutButton />
        </header>

        <main
          style={{
            width: "100%",
            maxWidth: "1500px",
            margin: "0 auto",
            padding: "32px",
            boxSizing: "border-box",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}