import Image from "next/image";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

type UserRole =
  | "parent"
  | "student"
  | "teacher";

type TalklyUserHeaderProps = {
  role: UserRole;
  userName?: string | null;
};

export default function TalklyUserHeader({
  role,
  userName,
}: TalklyUserHeaderProps) {
  const config =
    getRoleConfig(role);

  return (
    <header
      className="talkly-header"
      style={{
        background: "#ffffff",
        borderBottom:
          "1px solid #e7e9f0",
      }}
    >
      <div
        className="talkly-container talkly-header-inner"
        style={{
          minHeight: "88px",
          display: "flex",
          alignItems: "center",
          gap: "34px",
        }}
      >
        {/* TALKLY 실제 로고 */}
        <Link
          href="/"
          aria-label="TALKLY 홈"
          style={{
            display: "inline-flex",
            alignItems: "center",
            flexShrink: 0,
            textDecoration: "none",
          }}
        >
          <Image
            src="/talkly-logo.png"
            alt="TALKLY"
            width={320}
            height={110}
            priority
            style={{
              width: "auto",
              height: "68px",
              objectFit: "contain",
            }}
          />
        </Link>

        {/* 역할별 메뉴 */}
        <nav
          aria-label={
            config.navLabel
          }
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flex: 1,
          }}
        >
          {config.menuItems.map(
            (item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  minHeight: "42px",
                  padding:
                    "0 12px",
                  display:
                    "inline-flex",
                  alignItems:
                    "center",
                  color:
                    "#1b2a4a",
                  textDecoration:
                    "none",
                  fontSize:
                    "14px",
                  fontWeight:
                    800,
                  whiteSpace:
                    "nowrap",
                }}
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        {/* 사용자 정보 + 로그아웃 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "flex-end",
            gap: "14px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              textAlign: "right",
              lineHeight: 1.35,
            }}
          >
            <div
              style={{
                color:
                  "#0a1f44",
                fontSize:
                  "13px",
                fontWeight:
                  900,
              }}
            >
              {userName ||
                config.defaultName}
              님
            </div>

            <div
              style={{
                marginTop: "3px",
                color:
                  "#7b899c",
                fontSize:
                  role ===
                  "teacher"
                    ? "10px"
                    : "11px",
                fontWeight:
                  700,
              }}
            >
              {
                config.roleLabel
              }
            </div>
          </div>

          <LogoutButton />
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .talkly-header .talkly-container {
            gap: 14px !important;
          }

          .talkly-header nav {
            display: none !important;
          }

          .talkly-header img {
            height: 52px !important;
          }
        }

        @media (max-width: 480px) {
          .talkly-header img {
            height: 44px !important;
          }
        }
      `}</style>
    </header>
  );
}

function getRoleConfig(
  role: UserRole
) {
  switch (role) {
    case "parent":
      return {
        defaultName:
          "학부모",
        roleLabel:
          "학부모",
        navLabel:
          "학부모 메뉴",
        menuItems: [
          {
            label:
              "대시보드",
            href:
              "/parent",
          },
          {
            label:
              "자녀 관리",
            href:
              "/parent/children",
          },
          {
            label:
              "수강신청",
            href:
              "/enroll",
          },
        ],
      };

    case "student":
      return {
        defaultName:
          "학생",
        roleLabel:
          "학생",
        navLabel:
          "학생 메뉴",
        menuItems: [
          {
            label:
              "마이페이지",
            href:
              "/student",
          },
          {
            label:
              "내 수업",
            href:
              "/student/classes",
          },
          {
            label:
              "출결",
            href:
              "/student/attendance",
          },
          {
            label:
              "학습평가",
            href:
              "/student/evaluations",
          },
        ],
      };

    case "teacher":
      return {
        defaultName:
          "Teacher",
        roleLabel:
          "Teacher · 강사",
        navLabel:
          "Teacher menu",
        menuItems: [
          {
            label:
              "Dashboard",
            href:
              "/teacher",
          },
          {
            label:
              "Classes",
            href:
              "/teacher",
          },
          {
            label:
              "Students",
            href:
              "/teacher/students",
          },
        ],
      };
  }
}