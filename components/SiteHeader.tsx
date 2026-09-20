"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import HomeAuthMenu from "@/components/HomeAuthMenu";

export default function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

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
      <div className="talkly-header-inner">
        {/* TALKLY LOGO */}
        <Link
          href="/"
          aria-label="TALKLY 홈"
          onClick={closeMobileMenu}
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
            className="talkly-header-logo"
            style={{
              width: "auto",
              height: "62px",
              objectFit: "contain",
            }}
          />
        </Link>

        {/* DESKTOP MAIN NAVIGATION */}
        <nav
          aria-label="TALKLY 주요 메뉴"
          className="talkly-site-nav"
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

          <div className="talkly-info-menu">
            <span className="talkly-site-nav-link talkly-info-trigger">
              인포메이션
              <span
                style={{
                  fontSize: "10px",
                }}
              >
                ▼
              </span>
            </span>

            <div className="talkly-info-dropdown">
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
        <div className="talkly-header-actions">
          <div className="talkly-auth-menu">
            <HomeAuthMenu />
          </div>

          {/* MOBILE HAMBURGER */}
          <button
            type="button"
            className="talkly-mobile-menu-button"
            aria-label={
              mobileMenuOpen
                ? "모바일 메뉴 닫기"
                : "모바일 메뉴 열기"
            }
            aria-expanded={mobileMenuOpen}
            aria-controls="talkly-mobile-menu"
            onClick={() =>
              setMobileMenuOpen((current) => !current)
            }
          >
            <span
              className={
                mobileMenuOpen
                  ? "talkly-hamburger talkly-hamburger-open"
                  : "talkly-hamburger"
              }
              aria-hidden="true"
            >
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}
      <div
        id="talkly-mobile-menu"
        className={
          mobileMenuOpen
            ? "talkly-mobile-menu talkly-mobile-menu-open"
            : "talkly-mobile-menu"
        }
      >
        <nav
          aria-label="TALKLY 모바일 메뉴"
          className="talkly-mobile-menu-inner"
        >
          <MobileNavLink
            href="/#about"
            onClick={closeMobileMenu}
          >
            토클리소개
          </MobileNavLink>

          <MobileNavLink
            href="/curriculum"
            onClick={closeMobileMenu}
          >
            교육센터
          </MobileNavLink>

          <MobileNavLink
            href="/level-test"
            onClick={closeMobileMenu}
          >
            레벨테스트
          </MobileNavLink>

          <MobileNavLink
            href="/enroll"
            onClick={closeMobileMenu}
          >
            수강신청
          </MobileNavLink>

          <MobileNavLink
            href="/#ai"
            onClick={closeMobileMenu}
          >
            TALKLY AI
          </MobileNavLink>

          <div className="talkly-mobile-divider" />

          <div className="talkly-mobile-section-title">
            인포메이션
          </div>

          <MobileNavLink
            href="/notice"
            onClick={closeMobileMenu}
            secondary
          >
            공지사항
          </MobileNavLink>

          <MobileNavLink
            href="/#reviews"
            onClick={closeMobileMenu}
            secondary
          >
            수업후기
          </MobileNavLink>

          <MobileNavLink
            href="/consultation"
            onClick={closeMobileMenu}
            secondary
          >
            1:1 상담
          </MobileNavLink>
        </nav>
      </div>

      <style jsx global>{`
        .talkly-header-inner {
          width: min(1380px, calc(100% - 40px));
          min-height: 88px;
          margin: 0 auto;

          display: grid;
          grid-template-columns: 220px 1fr auto;
          align-items: center;
          gap: 26px;
        }

        .talkly-site-nav {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 4px;
        }

        .talkly-site-nav-link:hover {
          background: #f1f5ff;
          color: #2f6fed !important;
        }

        .talkly-info-menu {
          position: relative;
        }

        .talkly-info-trigger {
          display: inline-flex;
          min-height: 44px;
          padding: 0 13px;
          align-items: center;
          gap: 5px;
          border-radius: 9px;
          color: #1b2a4a;
          font-size: 14px;
          font-weight: 800;
          white-space: nowrap;
          cursor: default;
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
          box-shadow: 0 18px 45px
            rgba(15, 23, 42, 0.12);

          opacity: 0;
          visibility: hidden;
          pointer-events: none;

          transition:
            opacity 0.16s ease,
            transform 0.16s ease;
        }

        .talkly-info-menu:hover
          .talkly-info-dropdown {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          transform: translateX(-50%)
            translateY(2px);
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

        .talkly-header-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
        }

        .talkly-mobile-menu-button {
          display: none;

          width: 44px;
          height: 44px;
          padding: 0;

          align-items: center;
          justify-content: center;

          border: 1px solid #dfe4ec;
          border-radius: 11px;

          background: #ffffff;
          color: #0a1f44;

          cursor: pointer;
        }

        .talkly-mobile-menu-button:hover {
          background: #f5f8ff;
          border-color: #cbd5e1;
        }

        .talkly-hamburger {
          position: relative;

          display: flex;
          width: 20px;
          height: 16px;

          flex-direction: column;
          justify-content: space-between;
        }

        .talkly-hamburger span {
          display: block;

          width: 20px;
          height: 2px;

          border-radius: 999px;
          background: #0a1f44;

          transform-origin: center;

          transition:
            transform 0.18s ease,
            opacity 0.18s ease;
        }

        .talkly-hamburger-open span:nth-child(1) {
          transform: translateY(7px)
            rotate(45deg);
        }

        .talkly-hamburger-open span:nth-child(2) {
          opacity: 0;
        }

        .talkly-hamburger-open span:nth-child(3) {
          transform: translateY(-7px)
            rotate(-45deg);
        }

        .talkly-mobile-menu {
          display: none;
        }

        @media (max-width: 1050px) {
          .talkly-header-inner {
            grid-template-columns: 1fr auto;
            gap: 14px;
          }

          .talkly-site-nav {
            display: none !important;
          }

          .talkly-header-actions {
            min-width: 0;
          }

          .talkly-mobile-menu-button {
            display: inline-flex;
            flex: 0 0 auto;
          }

          .talkly-mobile-menu {
            display: block;

            max-height: 0;
            overflow: hidden;

            background: #ffffff;
            border-top: 0 solid #eef1f6;

            opacity: 0;

            transition:
              max-height 0.25s ease,
              opacity 0.18s ease,
              border-top-width 0.18s ease;
          }

          .talkly-mobile-menu-open {
            max-height: 650px;
            border-top-width: 1px;
            opacity: 1;
          }

          .talkly-mobile-menu-inner {
            width: min(
              100% - 36px,
              720px
            );

            margin: 0 auto;
            padding: 12px 0 20px;

            display: grid;
            gap: 4px;
          }

          .talkly-mobile-nav-link {
            display: flex;
            min-height: 48px;
            padding: 0 14px;

            align-items: center;

            border-radius: 10px;

            color: #1b2a4a;
            text-decoration: none;

            font-size: 15px;
            font-weight: 850;
          }

          .talkly-mobile-nav-link:hover,
          .talkly-mobile-nav-link:active {
            background: #f1f5ff;
            color: #2f6fed;
          }

          .talkly-mobile-nav-link-secondary {
            min-height: 44px;
            padding-left: 22px;

            color: #475467;

            font-size: 14px;
            font-weight: 750;
          }

          .talkly-mobile-divider {
            height: 1px;
            margin: 8px 0;

            background: #eef1f6;
          }

          .talkly-mobile-section-title {
            padding: 7px 14px 5px;

            color: #98a2b3;

            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.08em;
          }
        }

        @media (max-width: 640px) {
          .talkly-header-inner {
            width: calc(100% - 24px);
            min-height: 72px;
            gap: 8px;
          }

          .talkly-header-logo {
            height: 46px !important;
          }

          .talkly-header-actions {
            gap: 6px;
          }

          .talkly-mobile-menu-button {
            width: 42px;
            height: 42px;
          }

          .talkly-mobile-menu-inner {
            width: calc(100% - 24px);
          }
        }

        @media (max-width: 400px) {
          .talkly-header-inner {
            width: calc(100% - 18px);
          }

          .talkly-header-logo {
            height: 42px !important;
          }

          .talkly-mobile-menu-inner {
            width: calc(100% - 18px);
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

function MobileNavLink({
  href,
  children,
  onClick,
  secondary = false,
}: {
  href: string;
  children: React.ReactNode;
  onClick: () => void;
  secondary?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={
        secondary
          ? "talkly-mobile-nav-link talkly-mobile-nav-link-secondary"
          : "talkly-mobile-nav-link"
      }
    >
      {children}
    </Link>
  );
}