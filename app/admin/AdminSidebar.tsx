"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MenuItem = {
  label: string;
  href: string;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
  {
    title: "운영 현황",
    items: [
      {
        label: "대시보드",
        href: "/admin",
      },
      {
        label: "수업 캘린더",
        href: "/admin/calendar",
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
      {
        label: "학생 계정 연결",
        href: "/admin/student-links",
      },
    ],
  },

  {
    title: "수강 관리",
    items: [
      {
        label: "수강 가능 일정",
        href: "/admin/enrollment-options",
      },
      {
        label: "수강 신청 관리",
        href: "/admin/enrollment-requests",
      },
      {
        label: "전체 수강 관리",
        href: "/admin/enrollments",
      },
      {
        label: "수강신청 설정",
        href: "/admin/enrollment-settings",
      },
    ],
  },

  {
    title: "수업 운영",
    items: [
      {
        label: "결석 신청 관리",
        href: "/admin/class-holds",
      },
      {
        label: "오늘 수업",
        href: "/admin/calendar",
      },
      {
        label: "주간 수업",
        href: "/admin/calendar/week",
      },
      {
        label: "월간 수업",
        href: "/admin/calendar/month",
      },
    ],
  },

  {
    title: "교육 콘텐츠",
    items: [
      {
        label: "과정 관리",
        href: "/admin/courses",
      },
      {
        label: "교재 관리",
        href: "/admin/textbooks",
      },
    ],
  },

  {
    title: "고객 지원",
    items: [
      {
        label: "공지사항 관리",
        href: "/admin/notices",
      },
      {
        label: "1:1 문의 관리",
        href: "/admin/support-inquiries",
      },
    ],
  },

  {
    title: "AI 서비스",
    items: [
      {
        label: "AI 수업 분석 테스트",
        href: "/admin/ai-transcription-test",
      },
    ],
  },
];

function isActivePath(
  pathname: string,
  href: string
) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  if (
    href === "/admin/calendar"
  ) {
    return (
      pathname ===
      "/admin/calendar"
    );
  }

  return (
    pathname === href ||
    pathname.startsWith(
      `${href}/`
    )
  );
}

export default function AdminSidebar() {
  const pathname =
    usePathname();

  return (
    <aside className="talkly-admin-sidebar">
      <Link
        href="/admin"
        className="talkly-admin-brand"
      >
        <span className="talkly-admin-brand-main">
          TALKLY
        </span>

        <span className="talkly-admin-brand-badge">
          ADMIN
        </span>

        <span className="talkly-admin-brand-sub">
          토클리 통합 관리자
        </span>
      </Link>

      <nav className="talkly-admin-nav">
        {menuGroups.map(
          (group) => (
            <section
              key={group.title}
              className="talkly-admin-nav-group"
            >
              <div className="talkly-admin-nav-title">
                {group.title}
              </div>

              <div className="talkly-admin-nav-items">
                {group.items.map(
                  (item) => {
                    const active =
                      isActivePath(
                        pathname,
                        item.href
                      );

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={
                          active
                            ? "talkly-admin-nav-link talkly-admin-nav-link-active"
                            : "talkly-admin-nav-link"
                        }
                      >
                        {item.label}
                      </Link>
                    );
                  }
                )}
              </div>
            </section>
          )
        )}
      </nav>

      <div className="talkly-admin-sidebar-footer">
        <div className="talkly-admin-sidebar-note">
          TALKLY 운영관리
        </div>

        <div className="talkly-admin-sidebar-note-sub">
          수강 · 수업 · 회원 · 고객지원 · AI 통합
        </div>
      </div>
    </aside>
  );
}