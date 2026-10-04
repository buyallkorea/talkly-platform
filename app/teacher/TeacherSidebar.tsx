"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MenuItem = {
  label: string;
  href: string;
  exact?: boolean;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
  {
    title: "OVERVIEW",
    items: [
      {
        label: "Dashboard",
        href: "/teacher",
        exact: true,
      },
    ],
  },
  {
    title: "TEACHING",
    items: [
      {
        label: "My Students",
        href: "/teacher/students",
      },
      {
        label: "Level Tests",
        href: "/teacher/level-tests",
      },
    ],
  },
  {
    title: "FEEDBACK",
    items: [
      {
        label: "My Reviews",
        href: "/teacher/reviews",
      },
    ],
  },
];

function isActivePath(
  pathname: string,
  item: MenuItem
): boolean {
  if (item.exact) {
    return pathname === item.href;
  }

  return (
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`)
  );
}

export default function TeacherSidebar() {
  const pathname = usePathname();

  return (
    <aside className="talkly-teacher-sidebar">
      <Link
        href="/teacher"
        className="talkly-teacher-brand"
      >
        <span className="talkly-teacher-brand-main">
          TALKLY
        </span>

        <span className="talkly-teacher-brand-badge">
          TEACHER
        </span>

        <span className="talkly-teacher-brand-sub">
          Teacher Workspace
        </span>
      </Link>

      <nav className="talkly-teacher-nav">
        {menuGroups.map((group) => (
          <section key={group.title}>
            <div className="talkly-teacher-nav-title">
              {group.title}
            </div>

            <div className="talkly-teacher-nav-items">
              {group.items.map((item) => {
                const active = isActivePath(
                  pathname,
                  item
                );

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      active
                        ? "talkly-teacher-nav-link talkly-teacher-nav-link-active"
                        : "talkly-teacher-nav-link"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="talkly-teacher-sidebar-footer">
        TALKLY Teacher Portal
      </div>
    </aside>
  );
}