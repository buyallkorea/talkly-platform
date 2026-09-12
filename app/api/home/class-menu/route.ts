import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type Role =
  | "parent"
  | "student"
  | "teacher"
  | "admin"
  | null;

type HomeClassMenuState = {
  user_role: Role;
  next_session_id: number | null;
};

export async function GET() {
  const totalStartedAt =
    performance.now();

  const timings: string[] = [];

  function addTiming(
    name: string,
    startedAt: number
  ) {
    timings.push(
      `${name};dur=${(
        performance.now() -
        startedAt
      ).toFixed(1)}`
    );
  }

  function json(
    body: Record<string, unknown>
  ) {
    timings.push(
      `total;dur=${(
        performance.now() -
        totalStartedAt
      ).toFixed(1)}`
    );

    return NextResponse.json(
      body,
      {
        headers: {
          "Server-Timing":
            timings.join(", "),
          "Cache-Control":
            "private, no-store",
        },
      }
    );
  }

  /*
   * =====================================================
   * 1. Supabase client
   * =====================================================
   */

  const clientStartedAt =
    performance.now();

  const supabase =
    await createClient();

  addTiming(
    "create_client",
    clientStartedAt
  );

  /*
   * =====================================================
   * 2. 로그인 확인
   * =====================================================
   */

  const authStartedAt =
    performance.now();

  const {
    data: { user },
    error: authError,
  } =
    await supabase.auth.getUser();

  addTiming(
    "auth",
    authStartedAt
  );

  if (
    authError ||
    !user
  ) {
    return json({
      loggedIn: false,
      role: null,
      manageHref:
        "/login?next=%2F",
      classroomHref:
        "/login?next=%2F",
      hasUpcomingClass:
        false,
      nextSessionId:
        null,
    });
  }

  /*
   * =====================================================
   * 3. 역할 + 다음 수업
   *
   * 기존:
   * profiles
   * → children
   * → enrollments
   * → class_sessions
   *
   * 현재:
   * RPC 1회
   * =====================================================
   */

  const rpcStartedAt =
    performance.now();

  const {
    data,
    error,
  } = await supabase
    .rpc(
      "get_home_class_menu_state"
    )
    .maybeSingle();

  addTiming(
    "menu_rpc",
    rpcStartedAt
  );

  if (error) {
    console.error(
      "HOME CLASS MENU RPC ERROR:",
      error.message
    );

    return json({
      loggedIn: true,
      role: null,
      manageHref: "/",
      classroomHref: "/",
      hasUpcomingClass:
        false,
      nextSessionId:
        null,
    });
  }

  const state =
    data as HomeClassMenuState | null;

  const role: Role =
    state?.user_role ?? null;

  const nextSessionId =
    state?.next_session_id ??
    null;

  /*
   * =====================================================
   * 4. 역할별 관리 페이지
   * =====================================================
   */

  let manageHref = "/";

  if (role === "parent") {
    manageHref = "/parent";
  }

  if (role === "student") {
    manageHref =
      "/student/classes";
  }

  if (role === "teacher") {
    manageHref = "/teacher";
  }

  if (role === "admin") {
    manageHref = "/admin";
  }

  /*
   * =====================================================
   * 5. 강의실 링크
   * =====================================================
   */

  if (role === "admin") {
    return json({
      loggedIn: true,
      role,
      manageHref,
      classroomHref:
        "/admin/calendar",
      hasUpcomingClass:
        false,
      nextSessionId:
        null,
    });
  }

  const classroomHref =
    nextSessionId
      ? `/classroom/${nextSessionId}`
      : manageHref;

  return json({
    loggedIn: true,
    role,
    manageHref,
    classroomHref,
    hasUpcomingClass:
      Boolean(nextSessionId),
    nextSessionId,
  });
}