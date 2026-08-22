import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type Role =
  | "parent"
  | "student"
  | "teacher"
  | "admin"
  | null;

export async function GET() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  /*
   * 비로그인
   */
  if (!user) {
    return NextResponse.json({
      loggedIn: false,
      role: null,
      manageHref:
        "/login?next=%2F",
      classroomHref:
        "/login?next=%2F",
    });
  }

  const {
    data: profile,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role =
    (profile?.role as Role) ??
    null;

  /*
   * 역할별 기본 관리 페이지
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
   * 관리자에게는 일반 강의실 입장
   * 개념보다 관리자 화면이 우선입니다.
   */
  if (role === "admin") {
    return NextResponse.json({
      loggedIn: true,
      role,
      manageHref,
      classroomHref:
        "/admin/calendar",
      hasUpcomingClass:
        false,
    });
  }

  let enrollmentIds: number[] =
    [];

  /*
   * 학부모
   *
   * 본인의 활성 자녀 →
   * 해당 자녀들의 enrollment 조회
   */
  if (role === "parent") {
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
      .eq("is_active", true);

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

    if (enrollmentError) {
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

    if (enrollmentError) {
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
   * 수강정보가 없으면
   * 역할별 관리 페이지로 이동
   */
  if (
    enrollmentIds.length === 0
  ) {
    return NextResponse.json({
      loggedIn: true,
      role,
      manageHref,
      classroomHref:
        manageHref,
      hasUpcomingClass:
        false,
    });
  }

  const now =
    new Date().toISOString();

  /*
   * 현재 또는 앞으로 예정된
   * 가장 가까운 수업 1건
   */
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

  if (sessionError) {
    console.error(
      "HOME CLASS MENU SESSION ERROR:",
      sessionError.message
    );
  }

  const nextSession =
    sessions?.[0] ?? null;

  /*
   * 예정 수업이 있으면
   * 실제 TALKLY Classroom으로 이동
   */
  const classroomHref =
    nextSession
      ? `/classroom/${nextSession.id}`
      : manageHref;

  return NextResponse.json({
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