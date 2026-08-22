"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

type Role =
  | "parent"
  | "student"
  | "teacher"
  | "admin"
  | null;

type MenuState = {
  loggedIn: boolean;
  role: Role;
  manageHref: string;
  classroomHref: string;
  hasUpcomingClass:
    boolean;
};

const initialState: MenuState =
  {
    loggedIn: false,
    role: null,
    manageHref:
      "/login",
    classroomHref:
      "/login",
    hasUpcomingClass:
      false,
  };

export default function HomeClassMenu() {
  const [state, setState] =
    useState<MenuState>(
      initialState
    );

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadMenu() {
      try {
        const response =
          await fetch(
            "/api/home/class-menu",
            {
              method: "GET",
              cache:
                "no-store",
            }
          );

        if (!response.ok) {
          throw new Error(
            "수업 메뉴 정보를 불러오지 못했습니다."
          );
        }

        const data =
          await response.json();

        if (!mounted) {
          return;
        }

        setState({
          loggedIn:
            Boolean(
              data.loggedIn
            ),
          role:
            data.role ??
            null,
          manageHref:
            data.manageHref ||
            "/login",
          classroomHref:
            data.classroomHref ||
            "/login",
          hasUpcomingClass:
            Boolean(
              data.hasUpcomingClass
            ),
        });
      } catch (error) {
        console.error(
          "HOME CLASS MENU ERROR:",
          error
        );

        if (mounted) {
          setState(
            initialState
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadMenu();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * 메뉴 로딩 중에도
   * 레이아웃이 흔들리지 않게
   * 기본 링크를 보여줍니다.
   */
  if (loading) {
    return (
      <>
        <Link href="/login">
          내 수업관리
        </Link>

        <Link href="/login">
          강의실 입장
        </Link>
      </>
    );
  }

  /*
   * 비로그인
   */
  if (!state.loggedIn) {
    return (
      <>
        <Link
          href="/login?next=%2F"
        >
          내 수업관리
        </Link>

        <Link
          href="/login?next=%2F"
        >
          강의실 입장
        </Link>
      </>
    );
  }

  return (
    <>
      <Link
        href={
          state.manageHref
        }
      >
        내 수업관리
      </Link>

      <Link
        href={
          state.classroomHref
        }
      >
        강의실 입장
        {state.hasUpcomingClass
          ? ""
          : ""}
      </Link>
    </>
  );
}