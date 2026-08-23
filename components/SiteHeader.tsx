import Image from "next/image";
import Link from "next/link";
import HomeAuthMenu from "@/components/HomeAuthMenu";

export default function SiteHeader() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        width: "100%",
        background: "rgba(255,255,255,0.97)",
        borderBottom: "1px solid #e7e9f0",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          width: "min(1380px, calc(100% - 40px))",
          minHeight: "88px",
          margin: "0 auto",

          display: "grid",
          gridTemplateColumns: "220px 1fr auto",
          alignItems: "center",
          gap: "26px",
        }}
      >
        {/* TALKLY LOGO */}
        <Link
          href="/"
          aria-label="TALKLY 홈"
          style={{
            display: "inline-flex",
            alignItems: "center",
            width: "fit-content",
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
              height: "62px",
              objectFit: "contain",
            }}
          />
        </Link>

        {/* MAIN NAVIGATION */}
        <nav
          aria-label="TALKLY 주요 메뉴"
          className="talkly-site-nav"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <NavLink href="/#about">
            토클리소개
          </NavLink>

          <NavLink href="/curriculum">
            교육센터
          </NavLink>

          <NavLink href="/level-test">
            레벨테스트
          </NavLink>

          <NavLink href="/enroll">
            수강신청
          </NavLink>

          <NavLink href="/#ai">
            TALKLY AI
          </NavLink>

          <div
            className="talkly-info-menu"
            style={{
              position: "relative",
            }}
          >
            <span
              className="talkly-site-nav-link"
              style={{
                display: "inline-flex",
                minHeight: "44px",
                padding: "0 13px",
                alignItems: "center",
                gap: "5px",
                borderRadius: "9px",
                color: "#1b2a4a",
                fontSize: "14px",
                fontWeight: 800,
                whiteSpace: "nowrap",
                cursor: "default",
              }}
            >
              인포메이션
              <span
                style={{
                  fontSize: "10px",
                }}
              >
                ▼
              </span>
            </span>

            <div
              className="talkly-info-dropdown"
            >
              <Link href="/notice">
                공지사항
              </Link>

              <Link href="/#reviews">
                수업후기
              </Link>

              <Link href="/consultation">
                1:1 상담
              </Link>
            </div>
          </div>
        </nav>

        {/* LOGIN / MYPAGE */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <HomeAuthMenu />
        </div>
      </div>

      {/* 모바일 보조 메뉴 */}
      <div
        className="talkly-mobile-service-nav"
      >
        <Link href="/">홈</Link>
        <Link href="/level-test">
          레벨테스트
        </Link>
        <Link href="/enroll">
          수강신청
        </Link>
        <Link href="/notice">
          공지사항
        </Link>
        <Link href="/consultation">
          1:1 상담
        </Link>
      </div>

      <style>{`
        .talkly-site-nav-link:hover {
          background: #f1f5ff;
          color: #2f6fed !important;
        }

        .talkly-info-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          width: 170px;
          padding: 8px;
          border: 1px solid #e4e7ec;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: opacity 0.16s ease, transform 0.16s ease;
        }

        .talkly-info-menu:hover
          .talkly-info-dropdown {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          transform: translateX(-50%) translateY(2px);
        }

        .talkly-info-dropdown a {
          display: flex;
          align-items: center;
          min-height: 42px;
          padding: 0 12px;
          border-radius: 8px;
          color: #344054;
          text-decoration: none;
          font-size: 13px;
          font-weight: 800;
        }

        .talkly-info-dropdown a:hover {
          background: #f5f8ff;
          color: #2f6fed;
        }

        .talkly-mobile-service-nav {
          display: none;
        }

        @media (max-width: 1050px) {
          .talkly-site-nav {
            display: none !important;
          }

          header > div:first-child {
            grid-template-columns: 1fr auto !important;
          }

          .talkly-mobile-service-nav {
            display: flex;
            overflow-x: auto;
            border-top: 1px solid #eef1f6;
            padding: 9px 18px;
            gap: 8px;
            background: #ffffff;
            scrollbar-width: none;
          }

          .talkly-mobile-service-nav::-webkit-scrollbar {
            display: none;
          }

          .talkly-mobile-service-nav a {
            flex: 0 0 auto;
            padding: 8px 12px;
            border-radius: 999px;
            background: #f5f7fb;
            color: #344054;
            text-decoration: none;
            font-size: 12px;
            font-weight: 800;
          }
        }

        @media (max-width: 640px) {
          header > div:first-child {
            width: calc(100% - 28px) !important;
            min-height: 72px !important;
          }

          header img {
            height: 48px !important;
          }
        }
      `}</style>
    </header>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="talkly-site-nav-link"
      style={{
        display: "inline-flex",
        minHeight: "44px",
        padding: "0 13px",
        alignItems: "center",
        borderRadius: "9px",

        color: "#1b2a4a",
        textDecoration: "none",

        fontSize: "14px",
        fontWeight: 800,
        whiteSpace: "nowrap",

        transition:
          "background 0.15s ease, color 0.15s ease",
      }}
    >
      {children}
    </Link>
  );
}