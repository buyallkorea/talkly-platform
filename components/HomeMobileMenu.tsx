"use client";

import { useState } from "react";
import Link from "next/link";
import HomeAuthMenu from "@/components/HomeAuthMenu";

export default function HomeMobileMenu() {
  const [open, setOpen] = useState(false);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="talkly-home-mobile-menu-button"
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={open}
        aria-controls="talkly-home-mobile-menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={
            open
              ? "talkly-home-hamburger talkly-home-hamburger-open"
              : "talkly-home-hamburger"
          }
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </span>
      </button>

      <div
        id="talkly-home-mobile-menu"
        className={
          open
            ? "talkly-home-mobile-menu talkly-home-mobile-menu-open"
            : "talkly-home-mobile-menu"
        }
      >
        <nav
          className="talkly-home-mobile-nav"
          aria-label="TALKLY 모바일 메뉴"
        >
          <MobileSection title="토클리소개">
            <MobileLink href="#greeting" onClick={closeMenu}>
              인사말
            </MobileLink>
            <MobileLink href="#why" onClick={closeMenu}>
              Why TALKLY?
            </MobileLink>
            <MobileLink href="#programs" onClick={closeMenu}>
              프로그램
            </MobileLink>
            <MobileLink href="#business-areas" onClick={closeMenu}>
              사업영역
            </MobileLink>
          </MobileSection>

          <MobileSection title="교육센터">
            <MobileLink href="#programs" onClick={closeMenu}>
              프로그램소개
            </MobileLink>
            <MobileLink href="/curriculum" onClick={closeMenu}>
              커리큘럼/교재
            </MobileLink>
            <MobileLink href="#teachers" onClick={closeMenu}>
              교사소개
            </MobileLink>
          </MobileSection>

          <MobileSection title="TALKLY AI">
            <MobileLink href="#ai" onClick={closeMenu}>
              AI 수업리포트
            </MobileLink>
            <MobileLink href="#ai" onClick={closeMenu}>
              AI 성장리포트
            </MobileLink>
            <MobileLink href="#ai" onClick={closeMenu}>
              AI Writing
            </MobileLink>
            <MobileLink href="#ai" onClick={closeMenu}>
              강사 AI Brief
            </MobileLink>
          </MobileSection>

          <div className="talkly-home-mobile-main-links">
            <Link href="/level-test" onClick={closeMenu}>
              레벨테스트
              <span>›</span>
            </Link>
            <Link href="/enroll" onClick={closeMenu}>
              수강신청
              <span>›</span>
            </Link>
          </div>

          <MobileSection title="인포메이션">
            <MobileLink href="/notice" onClick={closeMenu}>
              공지사항
            </MobileLink>
            <MobileLink href="#reviews" onClick={closeMenu}>
              수업후기
            </MobileLink>
            <MobileLink href="/consultation" onClick={closeMenu}>
              1:1 상담
            </MobileLink>
          </MobileSection>

          <div className="talkly-home-mobile-auth">
            <HomeAuthMenu />
          </div>
        </nav>
      </div>

      <style jsx global>{`
        .talkly-home-mobile-menu-button {
          display: none;
          width: 44px;
          height: 44px;
          padding: 0;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border: 1px solid #dce3ed;
          border-radius: 12px;
          background: #ffffff;
          cursor: pointer;
        }

        .talkly-home-hamburger {
          display: flex;
          width: 21px;
          height: 16px;
          flex-direction: column;
          justify-content: space-between;
        }

        .talkly-home-hamburger span {
          display: block;
          width: 21px;
          height: 2px;
          border-radius: 999px;
          background: #0a1f44;
          transform-origin: center;
          transition: transform 0.18s ease, opacity 0.18s ease;
        }

        .talkly-home-hamburger-open span:nth-child(1) {
          transform: translateY(7px) rotate(45deg);
        }

        .talkly-home-hamburger-open span:nth-child(2) {
          opacity: 0;
        }

        .talkly-home-hamburger-open span:nth-child(3) {
          transform: translateY(-7px) rotate(-45deg);
        }

        .talkly-home-mobile-menu {
          display: none;
        }

        @media (max-width: 1040px) {
          .talkly-home-mobile-menu-button {
            display: inline-flex;
          }

          .talkly-home-mobile-menu {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            display: block;
            max-height: 0;
            overflow: hidden;
            background: #ffffff;
            border-top: 0 solid #eef1f6;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.1);
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transition:
              max-height 0.3s ease,
              opacity 0.2s ease,
              border-top-width 0.2s ease;
          }

          .talkly-home-mobile-menu-open {
            max-height: calc(100vh - 72px);
            overflow-y: auto;
            border-top-width: 1px;
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
          }

          .talkly-home-mobile-nav {
            width: min(720px, calc(100% - 32px));
            margin: 0 auto;
            padding: 16px 0 24px;
          }

          .talkly-home-mobile-section {
            padding: 6px 0 12px;
            border-bottom: 1px solid #eef1f6;
          }

          .talkly-home-mobile-section-title {
            padding: 9px 12px 6px;
            color: #1b2a4a;
            font-size: 15px;
            font-weight: 900;
          }

          .talkly-home-mobile-section-links {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 4px;
          }

          .talkly-home-mobile-sub-link {
            display: flex;
            min-height: 40px;
            padding: 0 12px;
            align-items: center;
            border-radius: 9px;
            color: #697386;
            text-decoration: none;
            font-size: 13px;
            font-weight: 700;
          }

          .talkly-home-mobile-sub-link:hover,
          .talkly-home-mobile-sub-link:active {
            background: #f1f5ff;
            color: #2f6fed;
          }

          .talkly-home-mobile-main-links {
            display: grid;
            gap: 5px;
            padding: 12px 0;
            border-bottom: 1px solid #eef1f6;
          }

          .talkly-home-mobile-main-links a {
            display: flex;
            min-height: 48px;
            padding: 0 12px;
            align-items: center;
            justify-content: space-between;
            border-radius: 10px;
            color: #1b2a4a;
            text-decoration: none;
            font-size: 15px;
            font-weight: 900;
          }

          .talkly-home-mobile-main-links a:hover,
          .talkly-home-mobile-main-links a:active {
            background: #f1f5ff;
            color: #2f6fed;
          }

          .talkly-home-mobile-main-links span {
            color: #98a2b3;
            font-size: 24px;
            font-weight: 400;
          }

          .talkly-home-mobile-auth {
            display: flex;
            justify-content: center;
            margin-top: 16px;
            padding-top: 18px;
            border-top: 1px solid #eef1f6;
          }
        }

        @media (max-width: 480px) {
          .talkly-home-mobile-menu-button {
            width: 42px;
            height: 42px;
          }

          .talkly-home-mobile-nav {
            width: calc(100% - 24px);
          }

          .talkly-home-mobile-section-links {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </>
  );
}

function MobileSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="talkly-home-mobile-section">
      <div className="talkly-home-mobile-section-title">
        {title}
      </div>
      <div className="talkly-home-mobile-section-links">
        {children}
      </div>
    </section>
  );
}

function MobileLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="talkly-home-mobile-sub-link"
    >
      {children}
    </Link>
  );
}