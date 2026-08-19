"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

type UserRole = "parent" | "student" | "teacher";

type Props = {
  role: UserRole;
  userName?: string | null;
};

type MenuItem = {
  label: string;
  href: string;
};

const MENU_BY_ROLE: Record<UserRole, MenuItem[]> = {
  parent: [
    {
      label: "대시보드",
      href: "/parent",
    },
    {
      label: "자녀 관리",
      href: "/parent/children",
    },
  ],

  student: [
    {
      label: "대시보드",
      href: "/student",
    },
    {
      label: "내 수업",
      href: "/student/classes",
    },
    {
      label: "출결",
      href: "/student/attendance",
    },
    {
      label: "학습평가",
      href: "/student/evaluations",
    },
  ],

  teacher: [
    {
      label: "대시보드",
      href: "/teacher",
    },
    {
      label: "담당 학생",
      href: "/teacher/students",
    },
  ],
};

const ROLE_LABEL: Record<UserRole, string> = {
  parent: "학부모",
  student: "학생",
  teacher: "강사",
};

export default function TalklyUserHeader({
  role,
  userName,
}: Props) {
  const pathname = usePathname();
  const menuItems = MENU_BY_ROLE[role];

  function isActive(href: string) {
    if (href === `/${role}`) {
      return pathname === href;
    }

    return pathname.startsWith(href);
  }

  return (
    <header className="talkly-header">
      <div className="talkly-container talkly-header-inner">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "34px",
            minWidth: 0,
          }}
        >
          <Link
            href={`/${role}`}
            className="talkly-logo"
            aria-label="TALKLY 홈"
          >
            TALKLY
          </Link>

          <nav
            className="talkly-nav"
            aria-label={`${ROLE_LABEL[role]} 메뉴`}
          >
            {menuItems.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    color: active
                      ? "var(--talkly-blue)"
                      : "var(--talkly-navy)",
                    fontWeight: active ? 900 : 700,
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "12px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              lineHeight: 1.25,
              minWidth: 0,
            }}
          >
            <strong
              style={{
                color: "var(--talkly-navy)",
                fontSize: "14px",
                maxWidth: "180px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {userName || ROLE_LABEL[role]}님
            </strong>

            <span
              style={{
                marginTop: "3px",
                color: "var(--text-muted)",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              {ROLE_LABEL[role]}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <LogoutButton />
          </div>
        </div>
      </div>
    </header>
  );
}