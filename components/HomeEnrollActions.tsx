"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type UserRole = "parent" | "student" | "teacher" | "admin" | null;

export default function HomeEnrollActions() {
  const [role, setRole] = useState<UserRole>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const supabase = createClient();

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (!user) {
          setIsLoggedIn(false);
          setRole(null);
          return;
        }

        setIsLoggedIn(true);

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (!mounted) return;

        setRole((profile?.role as UserRole) ?? null);
      } catch (error) {
        console.error("HOME ENROLL ACTIONS ERROR:", error);

        if (mounted) {
          setIsLoggedIn(false);
          setRole(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div style={{ minWidth: "190px", minHeight: "46px" }} />;
  }

  if (!isLoggedIn) {
    return (
      <div style={wrapperStyle}>
        <Link href="/signup" className="talkly-bottom-primary">
          회원가입
        </Link>
        <Link href="/login" className="talkly-bottom-ghost">
          로그인
        </Link>
      </div>
    );
  }

  if (role === "teacher") {
    return (
      <div style={wrapperStyle}>
        <Link href="/teacher" className="talkly-bottom-primary">
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.05 }}>
            <span>Teach</span>
            <span style={{ marginTop: "3px", fontSize: "9px", fontWeight: 700, opacity: 0.8 }}>
              수업하기
            </span>
          </span>
        </Link>
      </div>
    );
  }

  if (role === "parent") {
    return (
      <div style={wrapperStyle}>
        <Link href="/parent" className="talkly-bottom-primary">
          마이페이지
        </Link>
      </div>
    );
  }

  if (role === "student") {
    return (
      <div style={wrapperStyle}>
        <Link href="/student" className="talkly-bottom-primary">
          마이페이지
        </Link>
      </div>
    );
  }

  if (role === "admin") {
    return (
      <div style={wrapperStyle}>
        <Link href="/admin" className="talkly-bottom-primary">
          관리자
        </Link>
      </div>
    );
  }

  return null;
}

const wrapperStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  alignItems: "center",
} as const;