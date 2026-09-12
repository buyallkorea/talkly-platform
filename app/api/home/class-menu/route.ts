import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type Role =
  | "parent"
  | "student"
  | "teacher"
  | "admin"
  | null;

export async function GET() {
  const startedAt = performance.now();

  const timings: string[] = [];

  function addTiming(
    name: string,
    start: number
  ) {
    const duration =
      performance.now() - start;

    timings.push(
      `${name};dur=${duration.toFixed(1)}`
    );
  }

  function json(
    body: Record<string, unknown>
  ) {
    timings.push(
      `total;dur=${(
        performance.now() -
        startedAt
      ).toFixed(1)}`
    );

    return NextResponse.json(body, {
      headers: {
        "Server-Timing":
          timings.join(", "),
        "Cache-Control":
          "private, no-store",
      },
    });
  }

  const supabaseStart =
    performance.now();

  const supabase =
    await createClient();

  addTiming(
    "create_client",
    supabaseStart
  );

  /*
   * 로그인 사용자 확인
   */
  const authStart =
    performance.now();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  addTiming(
    "auth",
    authStart
  );

  if (!user) {
    return json({
      loggedIn: false,
      role: null,
      manageHref:
        "/login?next=%2F",
      classroomHref:
        "/login?next=%2F",
      hasUpcomingClass: false,
    });
  }

  /*
   * 사용자 역할
   */
  const profileStart =
    performance.now();

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  addTiming(
    "profile",
    profileStart
  );

  if (profileError) {
    console.error(
      "HOME CLASS MENU PROFILE ERROR:",
      profileError.message
    );
  }

  const role =
    (profile?.role as Role) ??
    null;

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

  if (role === "admin") {
    return json({
      loggedIn: true,
      role,
      manageHref,
      classroomHref:
        "/admin/calendar",
      hasUpcomingClass: false,
    });
  }

  let enrollmentIds: number[] =
    [];

  /*
   * 학부모
   */
  if (role === "parent") {
    const childStart =
      performance.now();

    const {
      data: children,
      error: childError,
    } = await supabase
      .from("children")
      .select("id")
      .eq(
        "parent_user_id",
        user.id
      )
      .eq(
        "is_active",
        true
      );

    addTiming(
      "children",
      childStart
    );

    if (childError) {
      console.error(
        "HOME CLASS MENU CHILD ERROR:",
        childError.message
      );
    }

    const childIds =
      (children ?? []).map(
        (item) => item.id
      );

    if (
      childIds.length > 0
    ) {
      const enrollmentStart =
        performance.now();

      const {
        data: enrollments,
        error:
          enrollmentError,
      } = await supabase
        .from("enrollments")
        .select("id")
        .in(
          "child_id",
          childIds
        )
        .in("status", [
          "active",
          "pending",
        ]);

      addTiming(
        "enrollments",
        enrollmentStart
      );

      if (
        enrollmentError
      ) {
        console.error(
          "HOME CLASS MENU PARENT ENROLLMENT ERROR:",
          enrollmentError.message
        );
      }

      enrollmentIds =
        (enrollments ?? []).map(
          (item) => item.id
        );
    }
  }

  /*
   * 학생
   */
  if (role === "student") {
    const enrollmentStart =
      performance.now();

    const {
      data: enrollments,
      error:
        enrollmentError,
    } = await supabase
      .from("enrollments")
      .select("id")
      .eq(
        "student_user_id",
        user.id
      )
      .in("status", [
        "active",
        "pending",
      ]);

    addTiming(
      "enrollments",
      enrollmentStart
    );

    if (
      enrollmentError
    ) {
      console.error(
        "HOME CLASS MENU STUDENT ENROLLMENT ERROR:",
        enrollmentError.message
      );
    }

    enrollmentIds =
      (enrollments ?? []).map(
        (item) => item.id
      );
  }

  /*
   * 강사
   */
  if (role === "teacher") {
    const enrollmentStart =
      performance.now();

    const {
      data: enrollments,
      error:
        enrollmentError,
    } = await supabase
      .from("enrollments")
      .select("id")
      .eq(
        "teacher_user_id",
        user.id
      )
      .in("status", [
        "active",
        "pending",
      ]);

    addTiming(
      "enrollments",
      enrollmentStart
    );

    if (
      enrollmentError
    ) {
      console.error(
        "HOME CLASS MENU TEACHER ENROLLMENT ERROR:",
        enrollmentError.message
      );
    }

    enrollmentIds =
      (enrollments ?? []).map(
        (item) => item.id
      );
  }

  /*
   * 수강 없음
   */
  if (
    enrollmentIds.length === 0
  ) {
    return json({
      loggedIn: true,
      role,
      manageHref,
      classroomHref:
        manageHref,
      hasUpcomingClass: false,
    });
  }

  /*
   * 다음 수업 1건만 조회
   */
  const now =
    new Date().toISOString();

  const sessionStart =
    performance.now();

  const {
    data: sessions,
    error: sessionError,
  } = await supabase
    .from("class_sessions")
    .select(`
      id,
      enrollment_id,
      scheduled_start,
      scheduled_end,
      status
    `)
    .in(
      "enrollment_id",
      enrollmentIds
    )
    .gte(
      "scheduled_end",
      now
    )
    .in("status", [
      "scheduled",
      "in_progress",
    ])
    .order(
      "scheduled_start",
      {
        ascending: true,
      }
    )
    .limit(1);

  addTiming(
    "sessions",
    sessionStart
  );

  if (sessionError) {
    console.error(
      "HOME CLASS MENU SESSION ERROR:",
      sessionError.message
    );
  }

  const nextSession =
    sessions?.[0] ??
    null;

  const classroomHref =
    nextSession
      ? `/classroom/${nextSession.id}`
      : manageHref;

  return json({
    loggedIn: true,
    role,
    manageHref,
    classroomHref,
    hasUpcomingClass:
      Boolean(nextSession),
    nextSessionId:
      nextSession?.id ??
      null,
  });
}