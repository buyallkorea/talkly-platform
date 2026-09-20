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
      className="talkly-site-header"
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
          className="talkly-logo-link"
        >
          <Image
            src="/talkly-logo.png"
            alt="TALKLY"
            width={320}
            height={110}
            priority
            className="talkly-header-logo"
          />
        </Link>

        {/* DESKTOP NAVIGATION */}
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
              <span className="talkly-info-arrow">
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

        {/* DESKTOP AUTH */}
        <div className="talkly-desktop-auth">
          <HomeAuthMenu />
        </div>

        {/* MOBILE HAMBURGER */}
        <button
          type="button"
          className="talkly-mobile-menu-button"
          aria-label={
            mobileMenuOpen
              ? "메뉴 닫기"
              : "메뉴 열기"
          }
          aria-expanded={mobileMenuOpen}
          aria-controls="talkly-mobile-menu"
          onClick={() =>
            setMobileMenuOpen(
              (current) => !current
            )
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

      {/* MOBILE MENU */}
      <div
        id="talkly-mobile-menu"
        className={
          mobileMenuOpen
            ? "talkly-mobile-menu talkly-mobile-menu-open"
            : "talkly-mobile-menu"
        }
      >
        <div className="talkly-mobile-menu-content">
          <nav
            aria-label="TALKLY 모바일 메뉴"
            className="talkly-mobile-nav"
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
              INFORMATION
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

          {/* MOBILE AUTH */}
          <div className="talkly-mobile-auth">
            <HomeAuthMenu />
          </div>
        </div>
      </div>

      <style jsx global>{`
        .talkly-header-inner {
          width: min(
            1380px,
            calc(100% - 40px)
          );
          min-height: 88px;
          margin: 0 auto;

          display: grid;
          grid-template-columns:
            220px 1fr auto;
          align-items: center;
          gap: 26px;
        }

        .talkly-logo-link {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          text-decoration: none;
        }

        .talkly-header-logo {
          width: auto;
          height: 62px;
          object-fit: contain;
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

        .talkly-info-arrow {
          font-size: 10px;
        }

        .talkly-info-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 50%;

          width: 170px;
          padding: 8px;

          transform: translateX(-50%);

          border: 1px solid #e4e7ec;
          border-radius: 12px;

          background: #ffffff;

          box-shadow:
            0 18px 45px
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

          transform:
            translateX(-50%)
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

        .talkly-desktop-auth {
          display: flex;
          justify-content: flex-end;
          align-items: center;
        }

        /*
         * MOBILE BUTTON
         *
         * PC에서는 완전히 숨김
         */
        .talkly-mobile-menu-button {
          display: none;

          width: 44px;
          height: 44px;
          padding: 0;

          align-items: center;
          justify-content: center;

          border: 1px solid #dce3ed;
          border-radius: 12px;

          background: #ffffff;

          cursor: pointer;
        }

        .talkly-hamburger {
          display: flex;

          width: 21px;
          height: 16px;

          flex-direction: column;
          justify-content: space-between;
        }

        .talkly-hamburger span {
          display: block;

          width: 21px;
          height: 2px;

          border-radius: 999px;

          background: #0a1f44;

          transform-origin: center;

          transition:
            transform 0.18s ease,
            opacity 0.18s ease;
        }

        .talkly-hamburger-open
          span:nth-child(1) {
          transform:
            translateY(7px)
            rotate(45deg);
        }

        .talkly-hamburger-open
          span:nth-child(2) {
          opacity: 0;
        }

        .talkly-hamburger-open
          span:nth-child(3) {
          transform:
            translateY(-7px)
            rotate(-45deg);
        }

        /*
         * MOBILE MENU
         */
        .talkly-mobile-menu {
          display: none;
        }

        /*
         * TABLET / MOBILE
         */
        @media (max-width: 1050px) {
          .talkly-header-inner {
            width: calc(100% - 32px);
            min-height: 78px;

            display: flex;

            justify-content:
              space-between;

            align-items: center;

            gap: 16px;
          }

          /*
           * PC 메뉴 숨김
           */
          .talkly-site-nav {
            display: none !important;
          }

          /*
           * 핵심:
           * 모바일 헤더에서는
           * HomeAuthMenu 자체를 숨긴다.
           */
          .talkly-desktop-auth {
            display: none !important;
          }

          /*
           * 햄버거 표시
           */
          .talkly-mobile-menu-button {
            display: inline-flex !important;
            flex: 0 0 auto;
          }

          /*
           * 로고가 버튼을 밀어내지 않도록
           * 최대 폭 제한
           */
          .talkly-logo-link {
            min-width: 0;
            max-width:
              calc(100% - 60px);
          }

          .talkly-header-logo {
            height: 52px;
            max-width: 180px;
          }

          .talkly-mobile-menu {
            display: block;

            max-height: 0;
            overflow: hidden;

            border-top:
              0 solid #eef1f6;

            background: #ffffff;

            opacity: 0;

            transition:
              max-height 0.28s ease,
              opacity 0.18s ease,
              border-top-width
                0.18s ease;
          }

          .talkly-mobile-menu-open {
            max-height: 850px;

            border-top-width: 1px;

            opacity: 1;
          }

          .talkly-mobile-menu-content {
            width: min(
              720px,
              calc(100% - 32px)
            );

            margin: 0 auto;

            padding:
              12px 0 22px;
          }

          .talkly-mobile-nav {
            display: grid;
            gap: 3px;
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

            margin: 9px 0;

            background: #eef1f6;
          }

          .talkly-mobile-section-title {
            padding:
              7px 14px 5px;

            color: #98a2b3;

            font-size: 11px;
            font-weight: 900;

            letter-spacing: 0.08em;
          }

          /*
           * 모바일 로그인 영역
           */
          .talkly-mobile-auth {
            display: flex;

            margin-top: 14px;
            padding-top: 18px;

            justify-content: center;

            border-top:
              1px solid #eef1f6;
          }

          /*
           * HomeAuthMenu가 가진
           * 최소 폭도 메뉴 내부에서는
           * 충분한 공간이 있으므로 그대로 사용
           */
          .talkly-mobile-auth > * {
            max-width: 100%;
          }
        }

        /*
         * SMARTPHONE
         */
        @media (max-width: 640px) {
          .talkly-header-inner {
            width: calc(100% - 24px);
            min-height: 72px;
          }

          .talkly-header-logo {
            height: 46px;
            max-width: 145px;
          }

          .talkly-mobile-menu-button {
            width: 42px;
            height: 42px;

            border-radius: 11px;
          }

          .talkly-mobile-menu-content {
            width: calc(100% - 24px);
          }
        }

        /*
         * 아주 작은 스마트폰
         */
        @media (max-width: 380px) {
          .talkly-header-inner {
            width: calc(100% - 20px);
          }

          .talkly-header-logo {
            height: 42px;
            max-width: 132px;
          }

          .talkly-mobile-menu-content {
            width: calc(100% - 20px);
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