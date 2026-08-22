"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type UserRole =
  | "parent"
  | "student"
  | "teacher"
  | "admin"
  | null;

export default function HomeAuthMenu() {
  const router = useRouter();

  const [role, setRole] =
    useState<UserRole>(null);

  const [
    isLoggedIn,
    setIsLoggedIn,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const supabase =
        createClient();

      try {
        const {
          data: { user },
        } =
          await supabase.auth.getUser();

        if (!mounted) {
          return;
        }

        if (!user) {
          setIsLoggedIn(false);
          setRole(null);
          setLoading(false);
          return;
        }

        setIsLoggedIn(true);

        const {
          data: profile,
        } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (!mounted) {
          return;
        }

        setRole(
          (profile?.role as UserRole) ??
            null
        );
      } catch (error) {
        console.error(
          "HOME AUTH MENU ERROR:",
          error
        );

        if (mounted) {
          setIsLoggedIn(false);
          setRole(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogout() {
    const supabase =
      createClient();

    try {
      await supabase.auth.signOut();

      setIsLoggedIn(false);
      setRole(null);

      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error(
        "LOGOUT ERROR:",
        error
      );
    }
  }

  /*
   * 로그인 상태 확인 중에는
   * 버튼 영역 크기만 유지합니다.
   */
  if (loading) {
    return (
      <div
        style={{
          minWidth: "185px",
          minHeight: "42px",
        }}
      />
    );
  }

  /*
   * 비로그인
   */
  if (!isLoggedIn) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
        }}
      >
        <Link
          href="/login"
          style={secondaryButtonStyle}
        >
          로그인
        </Link>

        <Link
          href="/signup"
          style={primaryButtonStyle}
        >
          회원가입
        </Link>
      </div>
    );
  }

  /*
   * 강사
   *
   * 강사 UI는 영어 우선,
   * 한국어는 작은 보조 문구로 표시합니다.
   */
  if (role === "teacher") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
        }}
      >
        <Link
          href="/teacher"
          style={{
            ...primaryButtonStyle,
            minHeight: "46px",
            padding: "5px 19px",
            flexDirection: "column",
            lineHeight: 1.05,
          }}
        >
          <span>Teach</span>

          <span
            style={{
              marginTop: "3px",
              fontSize: "9px",
              fontWeight: 700,
              opacity: 0.78,
            }}
          >
            수업하기
          </span>
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          style={{
            ...logoutButtonStyle,
            minHeight: "46px",
            padding: "5px 17px",
            flexDirection: "column",
            lineHeight: 1.05,
          }}
        >
          <span>Logout</span>

          <span
            style={{
              marginTop: "3px",
              fontSize: "9px",
              fontWeight: 700,
              opacity: 0.62,
            }}
          >
            로그아웃
          </span>
        </button>
      </div>
    );
  }

  /*
   * 학부모
   */
  if (role === "parent") {
    return (
      <LoggedInMenu
        href="/parent"
        label="마이페이지"
        onLogout={handleLogout}
      />
    );
  }

  /*
   * 학생
   */
  if (role === "student") {
    return (
      <LoggedInMenu
        href="/student"
        label="마이페이지"
        onLogout={handleLogout}
      />
    );
  }

  /*
   * 관리자
   *
   * 대표 관리자 계정은 로그인 단계에서
   * /admin으로 바로 이동하지만,
   * 관리자가 메인으로 돌아왔을 경우를
   * 대비해 관리자 버튼도 제공합니다.
   */
  if (role === "admin") {
    return (
      <LoggedInMenu
        href="/admin"
        label="관리자"
        onLogout={handleLogout}
      />
    );
  }

  /*
   * 로그인은 되었지만
   * role을 확인하지 못한 경우
   */
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "9px",
      }}
    >
      <button
        type="button"
        onClick={handleLogout}
        style={logoutButtonStyle}
      >
        로그아웃
      </button>
    </div>
  );
}

function LoggedInMenu({
  href,
  label,
  onLogout,
}: {
  href: string;
  label: string;
  onLogout: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "9px",
      }}
    >
      <Link
        href={href}
        style={primaryButtonStyle}
      >
        {label}
      </Link>

      <button
        type="button"
        onClick={onLogout}
        style={logoutButtonStyle}
      >
        로그아웃
      </button>
    </div>
  );
}

const secondaryButtonStyle = {
  minHeight: "42px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 18px",
  borderRadius: "999px",
  border: "1.5px solid #e0e4ee",
  background: "#ffffff",
  color: "#1b2a4a",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 800,
} as const;

const primaryButtonStyle = {
  minHeight: "42px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 20px",
  borderRadius: "999px",
  border: "none",
  background: "#2f6fed",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 900,
  boxShadow:
    "0 8px 20px rgba(47,111,237,.25)",
} as const;

const logoutButtonStyle = {
  minHeight: "42px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 18px",
  borderRadius: "999px",
  border: "1.5px solid #e0e4ee",
  background: "#ffffff",
  color: "#1b2a4a",
  fontSize: "13px",
  fontWeight: 800,
  cursor: "pointer",
} as const;