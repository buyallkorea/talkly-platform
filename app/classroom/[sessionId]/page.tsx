import ClassroomPreparation from "./ClassroomPreparation";
import ClassroomMaterialStage from "./ClassroomMaterialStage";
import { getCurrentUser } from "@/lib/server-user";
import TestStudentStartWatcher from "./TestStudentStartWatcher";
import { getTestClassroomOptions } from "@/lib/test-classroom-options";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

import ClassroomZoomFrame from "./ClassroomZoomFrame";
import ClassroomTextbookPanel from "./ClassroomTextbookPanel";
import ClassSessionControls from "./ClassSessionControls";
import ClassroomWaitingRoom from "./ClassroomWaitingRoom";
import ClassSessionEndWatcher from "./ClassSessionEndWatcher";
import StudentAttendanceRecorder from "./StudentAttendanceRecorder";
import ClassroomChat from "./ClassroomChat";
import ClassroomTextbookSelectorRefresh from "./ClassroomTextbookSelectorRefresh";
import TestClassroomModeChooser from "./TestClassroomModeChooser";
import { verifyTestStudentMode } from "@/lib/test-classroom-mode";

type PageProps = {
  params: Promise<{
    sessionId: string;
  }>;
  searchParams: Promise<{ testMode?: string; materials?: string }>;
};

export default async function ClassroomPage({
  params,
  searchParams,
}: PageProps) {
  const { sessionId } =
    await params;
  const { testMode, materials } = await searchParams;

  const numericSessionId =
    Number(sessionId);

  if (
    !Number.isInteger(
      numericSessionId
    )
  ) {
    notFound();
  }

  const supabase =
    await createClient();

  /*
   * =====================================================
   * 로그인 사용자
   * =====================================================
   */
  const {
    data: { user },
  } =
    await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: profile,
  } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/");
  }

  /*
   * =====================================================
   * 수업 회차
   * =====================================================
   */
  const {
    data: session,
    error: sessionError,
  } = await supabase
    .from("class_sessions")
    .select(`
      id,
      enrollment_id,
      lesson_number,
      scheduled_start,
      scheduled_end,
      status,
      meeting_provider,
      meeting_id,
      meeting_url,
      started_at,
      ended_at,
      selected_textbook_id,
      material_mode,
      teacher_user_id,
      original_teacher_user_id,
      is_external_teacher,
      is_test

    `)
    .eq(
      "id",
      numericSessionId
    )
    .maybeSingle();

  if (sessionError) {
    throw new Error(
      sessionError.message
    );
  }

  if (!session) {
    notFound();
  }

  /*
   * =====================================================
   * 수강정보
   * =====================================================
   */
  const {
    data: enrollment,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(`
      id,
      child_id,
      student_user_id,
      course_id,
      teacher_user_id,
      is_test
    `)
    .eq(
      "id",
      session.enrollment_id
    )
    .maybeSingle();

  if (enrollmentError) {
    throw new Error(
      enrollmentError.message
    );
  }

  if (!enrollment) {
    notFound();
  }

  /*
   * =====================================================
   * 접근권한 + 학생명
   * =====================================================
   */
  let hasAccess =
    false;

  let studentName =
    "Student";

  if (
    profile.role ===
    "admin"
  ) {
    hasAccess =
      true;

  } else if (
    profile.role === "teacher" &&
    session.is_external_teacher !== true &&
    (
      session.teacher_user_id ??
      enrollment.teacher_user_id
    ) === user.id
  ) {
    hasAccess = true;

  } else if (
    profile.role ===
      "student" &&
    enrollment.student_user_id ===
      user.id
  ) {
    hasAccess =
      true;
  } else if (
    profile.role ===
      "parent" &&
    enrollment.child_id
  ) {
    const {
      data: child,
    } = await supabase
      .from("children")
      .select(
        "id, name, parent_user_id"
      )
      .eq(
        "id",
        enrollment.child_id
      )
      .eq(
        "parent_user_id",
        user.id
      )
      .maybeSingle();

    if (child) {
      hasAccess =
        true;

      studentName =
        child.name;
    }
  }

  if (!hasAccess) {
    notFound();
  }

  // 테스트 모드는 두 레코드가 모두 테스트로 표시된 경우에만 노출합니다.
  // 관리자 역할을 변경하지 않고 테스트 학생 인증을 별도로 확인합니다.
  const isAdminTestClassroom =
    profile.role === "admin" &&
    process.env.TALKLY_ENABLE_TEST_CLASSROOM === "true" &&
    session.is_test === true &&
    enrollment.is_test === true;

  // URL 파라미터만으로 학생 권한을 부여하지 않습니다.
  const isVerifiedTestStudent =
    isAdminTestClassroom &&
    testMode === "student" &&
    (await verifyTestStudentMode(session.id));

  if (
    isAdminTestClassroom &&
    ["scheduled", "in_progress"].includes(session.status) &&
    !session.ended_at &&
    testMode !== "observer" &&
    !isVerifiedTestStudent
  ) {
    return <TestClassroomModeChooser sessionId={session.id} />;
  }

  /*
   * =====================================================
   * 학생에게 배정된 수업 교재 목록
   * =====================================================
   */
  const testTextbooks = isVerifiedTestStudent ? (await getTestClassroomOptions()).textbooks : null;
  const {
    data: assignedTextbooks,
    error: assignedTextbooksError,
  } = await supabase
    .from("enrollment_textbooks")
    .select(`
      id,
      textbook_id,
      status,
      textbooks (
        id,
        title
      )
    `)
   .eq("enrollment_id", enrollment.id)
   .in("status", ["assigned", "in_use"])
   .is("ended_at", null)
   .order("assigned_at", { ascending: true });

  if (assignedTextbooksError) {
    throw new Error(
      `교재 배정 목록 조회 실패: ${assignedTextbooksError.message}`
    );
  }

  /*
   * 자녀 이름
   */
  if (
    enrollment.child_id &&
    studentName ===
      "Student"
  ) {
    const {
      data: child,
    } = await supabase
      .from("children")
      .select("name")
      .eq(
        "id",
        enrollment.child_id
      )
      .maybeSingle();

    if (child?.name) {
      studentName =
        child.name;
    }
  }

  /*
   * 학생 로그인계정 이름
   */
  if (
    enrollment.student_user_id
  ) {
    const {
      data: student,
    } = await supabase
      .from("profiles")
      .select("name")
      .eq(
        "id",
        enrollment.student_user_id
      )
      .maybeSingle();

    if (student?.name) {
      studentName =
        student.name;
    }
  }

  /*
   * =====================================================
   * 과정
   * =====================================================
   */
  const {
    data: course,
  } = await supabase
    .from("courses")
    .select("name")
    .eq(
      "id",
      enrollment.course_id
    )
    .maybeSingle();

  /*
   * =====================================================
   * 강사명
   *
   * 1순위 teacher_profiles.display_name
   * 2순위 profiles.name
   * 3순위 현재 강사 로그인 사용자명
   * 4순위 "Teacher"
   *
   * 학생/학부모 화면에서 teacher_profiles 조회가
   * RLS 등으로 보이지 않더라도 profiles 이름으로
   * fallback 하도록 수정했습니다.
   * =====================================================
   */
  let teacherName =
    "Teacher";

  if (
    enrollment.teacher_user_id
  ) {
    const [
      teacherProfileResult,
      teacherUserProfileResult,
    ] =
      await Promise.all([
        supabase
          .from(
            "teacher_profiles"
          )
          .select(
            "display_name"
          )
          .eq(
            "user_id",
            enrollment.teacher_user_id
          )
          .maybeSingle(),

        supabase
          .from(
            "profiles"
          )
          .select(
            "name"
          )
          .eq(
            "id",
            enrollment.teacher_user_id
          )
          .maybeSingle(),
      ]);

    const displayName =
      teacherProfileResult
        .data
        ?.display_name;

    const profileName =
      teacherUserProfileResult
        .data
        ?.name;

    if (
      displayName?.trim()
    ) {
      teacherName =
        displayName.trim();
    } else if (
      profileName?.trim()
    ) {
      teacherName =
        profileName.trim();
    } else if (
      profile.role ===
        "teacher" &&
      profile.name?.trim()
    ) {
      teacherName =
        profile.name.trim();
    }
  }



  /*
   * Zoom 참가자 표시 이름
   */
  const hostMode =
    profile.role === "teacher" &&
    session.is_external_teacher !== true &&
    (session.teacher_user_id ?? enrollment.teacher_user_id) === user.id;

  const identityPrimary =
    isVerifiedTestStudent
      ? "ADMIN · TEST STUDENT"
      : profile.role === "teacher"
      ? `${teacherName} · TEACHER`
      : profile.role === "student"
        ? `${studentName} · STUDENT`
        : profile.role === "parent"
          ? `${studentName} · PARENT`
          : `TALKLY ADMIN`;

  const identitySecondary =
    isVerifiedTestStudent
      ? `테스트 학생 / ${teacherName}`
      : profile.role === "teacher"
      ? "강사"
      : profile.role === "student"
        ? "학생"
        : profile.role === "parent"
          ? "학부모"
          : `${studentName} / ${teacherName}`;

  const isLearner =
    isVerifiedTestStudent ||
    profile.role ===
      "student" ||
    profile.role ===
      "parent";

  const unavailableMessages: Record<string, string> = {
    cancelled: "취소된 수업입니다.",
    held: "연기 또는 결석 승인된 수업입니다.",
    not_held: "진행되지 않은 수업입니다.",
    no_show: "결석 처리된 수업입니다.",
  };

  const unavailableMessage = unavailableMessages[session.status];

  if (unavailableMessage) {
    const returnHref =
      profile.role === "teacher"
        ? `/teacher/classes/${session.id}`
        : profile.role === "parent"
          ? "/parent"
          : profile.role === "student"
            ? "/student"
            : "/admin";

    return (
      <main
        style={{
          minHeight: "100vh",
          padding: "40px 20px",
          background: "#0b0b0d",
          color: "#f7f7f8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1>{unavailableMessage}</h1>
          <p>
            {course?.name || "Online English"} · {session.lesson_number}회차
          </p>
          <Link href={returnHref} style={{ color: "#93c5fd" }}>
            돌아가기 →
          </Link>
        </div>
      </main>
    );
  }
  /*
   * =====================================================
   * 학생/학부모 수업 시작 전 대기실
   * =====================================================
   */
  if (
    isLearner && !isVerifiedTestStudent && session.status === "scheduled" && !session.started_at && !session.ended_at
  ) {
    return (
      <ClassroomWaitingRoom
        sessionId={
          session.id
        }
        courseName={
          course?.name ||
          "Online English"
        }
        lessonNumber={
          session.lesson_number
        }
        studentName={
          isVerifiedTestStudent ? "Admin (Test Student)" : studentName
        }
        teacherName={
          teacherName
        }
      />
    );
  }

  /*
   * =====================================================
   * 수업 종료
   * =====================================================
   */
  if (session.ended_at || session.status === "completed") {
    const returnHref =
      profile.role ===
      "teacher"
        ? `/teacher/classes/${session.id}`
        : profile.role ===
            "parent"
          ? "/parent"
          : profile.role ===
              "student"
            ? "/student"
            : "/admin";

    const returnLabel =
      profile.role ===
      "teacher"
        ? "수업 상세·평가 작성 →"
        : "돌아가기";

    return (
      <main
        style={{
          minHeight:
            "100vh",

          padding:
            "40px 20px",

          boxSizing:
            "border-box",

          background:
            "#0b0b0d",

          color:
            "#f7f7f8",

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "center",
        }}
      >
        <div
          style={{
            width:
              "100%",

            maxWidth:
              "560px",

            padding:
              "34px",

            borderRadius:
              "16px",

            border:
              "1px solid rgba(255,255,255,0.12)",

            background:
              "#15161a",

            textAlign:
              "center",
          }}
        >
          <div
            style={{
              fontSize:
                "12px",

              opacity:
                0.5,

              letterSpacing:
                "0.08em",
            }}
          >
            TALKLY CLASSROOM
          </div>

          <h1
            style={{
              margin:
                "12px 0 10px",

              fontSize:
                "28px",
            }}
          >
            수업이 종료되었습니다
          </h1>

          <p
            style={{
              margin:
                0,

              lineHeight:
                1.7,

              opacity:
                0.68,
            }}
          >
            {course?.name ||
              "Online English"}{" "}
            ·{" "}
            {
              session.lesson_number
            }
            회차
            <br />
            담당 강사:{" "}
            {teacherName}
          </p>

          {profile.role ===
            "teacher" && (
            <div
              style={{
                margin:
                  "20px 0 0",

                padding:
                  "14px 16px",

                borderRadius:
                  "10px",

                background:
                  "rgba(59,130,246,0.08)",

                border:
                  "1px solid rgba(96,165,250,0.18)",

                fontSize:
                  "13px",

                lineHeight:
                  1.65,

                color:
                  "#bfdbfe",
              }}
            >
              수업 종료가
              완료되었습니다.
              <br />
              수업 상세 화면에서
              이번 회차의 학습
              평가를 작성할 수
              있습니다.
            </div>
          )}

          <Link
            href={
              returnHref
            }
            style={{
              display:
                "inline-flex",

              marginTop:
                "24px",

              padding:
                "11px 18px",

              borderRadius:
                "9px",

              border:
                profile.role ===
                "teacher"
                  ? "1px solid #3b82f6"
                  : "1px solid rgba(255,255,255,0.18)",

              background:
                profile.role ===
                "teacher"
                  ? "#2563eb"
                  : "transparent",

              color:
                "#f7f7f8",

              textDecoration:
                "none",

              fontSize:
                "13px",

              fontWeight:
                800,
            }}
          >
            {returnLabel}
          </Link>
        </div>
      </main>
    );
  }

  const materialMode = session.material_mode === "screen" ? "screen" : "textbook";
  if (hostMode && materials !== "ready") {
    return <ClassroomPreparation sessionId={session.id} initialMode={materialMode}
      selectedTextbookId={session.selected_textbook_id} returnHref="/teacher"
      textbooks={(assignedTextbooks ?? []).flatMap(item => {
        const book = Array.isArray(item.textbooks) ? item.textbooks[0] : item.textbooks;
        return book ? [{ id: book.id, title: book.title }] : [];
      })} />;
  }

  /*
   * =====================================================
   * Zoom 연결 확인
   * =====================================================
   */
  if (
    session.meeting_provider !==
      "zoom" ||
    !session.meeting_id
  ) {
    return (
      <main
        style={{
          minHeight:
            "100vh",

          padding:
            "40px",

          background:
            "#0b0b0d",

          color:
            "#f7f7f8",

          boxSizing:
            "border-box",
        }}
      >
        <h1>
          TALKLY Classroom
        </h1>

        <p>
          이 수업에는 아직
          Zoom Meeting이
          연결되어 있지 않습니다.
        </p>
      </main>
    );
  }



  /*
   * =====================================================
   * 실제 Classroom
   * =====================================================
   */
  return (
    <>
      <style>{`
        .talkly-classroom {
          height: 100vh;
          height: 100dvh;
          padding: 6px 10px;
          box-sizing: border-box;
          background:
            radial-gradient(circle at 72% -10%, rgba(37,99,235,.10), transparent 34%),
            #090b0f;
          color: #f8fafc;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .talkly-classroom-top,
        .talkly-classroom-control,
        .talkly-classroom-stage,
        .talkly-classroom > .talkly-chat {
          max-width: 1920px;
          width: 100%;
          margin-left: auto;
          margin-right: auto;
        }

        .talkly-classroom-top {
          min-height: 38px;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          flex: 0 0 auto;
        }

        .talkly-brand-kicker {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .11em;
          color: rgba(255,255,255,.42);
        }

        .talkly-classroom-title {
          margin: 4px 0 0;
          font-size: 21px;
          line-height: 1.15;
          letter-spacing: -.02em;
        }

        .talkly-classroom-title small {
          margin-left: 8px;
          font-size: 10px;
          font-weight: 700;
          color: rgba(255,255,255,.40);
          letter-spacing: 0;
        }

        .talkly-identity {
          text-align: right;
          min-width: 0;
        }

        .talkly-identity strong {
          display: block;
          font-size: 11px;
          letter-spacing: .02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .talkly-identity small {
          display: block;
          margin-top: 3px;
          font-size: 9px;
          color: rgba(255,255,255,.42);
        }

        .talkly-classroom-control {
          margin-bottom: 6px;
          padding: 8px 12px;
          min-height: 48px;
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 14px;
          background: linear-gradient(
            180deg,
            rgba(255,255,255,.045),
            rgba(255,255,255,.025)
          );
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          box-sizing: border-box;
          flex: 0 0 auto;
          box-shadow: 0 10px 26px rgba(0,0,0,.12);
        }

        .talkly-control-copy strong {
          display: block;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .08em;
        }

        .talkly-control-copy small {
          display: block;
          margin-top: 3px;
          font-size: 9px;
          color: rgba(255,255,255,.42);
        }

        .talkly-classroom-stage {
          position: relative;
          display: grid;
          grid-template-columns: minmax(240px, .7fr) minmax(0, 1.9fr) minmax(260px, .85fr);
          gap: 14px;
          align-items: stretch;
          flex: 1 1 auto;
          min-height: 0;
          overflow: hidden;
        }

        .talkly-classroom-panel {
          min-width: 0;
          min-height: 0;
          height: 100%;
          border: 1px solid rgba(255,255,255,.11);
          border-radius: 16px;
          overflow: hidden;
          background: #111318;
          box-shadow: 0 14px 34px rgba(0,0,0,.18);
        }

        .talkly-classroom-textbook {
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .talkly-classroom-textbook > :first-child { flex: 0 0 auto; margin-bottom: 0; }
        .talkly-classroom-textbook > .talkly-textbook-shell { flex: 1 1 0; height: auto !important; min-height: 0; }
        .talkly-classroom-video { overflow: hidden; }
        .talkly-zoom-frame { display: block; width: 100%; height: 100%; border: 0; background: #111216; }


        @media (max-width: 1050px) {
          .talkly-classroom { height: auto; min-height: 100dvh; overflow: auto; }
          .talkly-classroom-stage { grid-template-columns: minmax(260px, .65fr) minmax(0, 1.35fr); overflow: visible; flex: none; }
          .talkly-classroom-video, .talkly-classroom-textbook { height: 65dvh; min-height: 420px; }
          .talkly-classroom-stage > .talkly-chat { grid-column: 1 / -1; height: 320px; }
        }
        @media (max-width: 640px) {
          .talkly-classroom-stage { grid-template-columns: minmax(0, 1fr); }
          .talkly-classroom-video { height: 360px; min-height: 360px; }
          .talkly-classroom-textbook { height: 70dvh; min-height: 480px; }
          .talkly-classroom-top { flex-wrap: wrap; }
          .talkly-classroom-title { font-size: 17px; }
        }


        .talkly-material-controls { flex: 0 0 auto; padding: 10px 14px; border: 1px solid #334155; border-radius: 12px; background: #172033; margin-bottom: 10px; font-size: 13px; line-height: 1.6; }
        .talkly-classroom button:focus-visible, .talkly-classroom select:focus-visible, .talkly-classroom summary:focus-visible { outline: 3px solid #facc15; outline-offset: 3px; }
        .talkly-classroom summary { cursor: pointer; padding: 8px 0; font-weight: 700; }
        .talkly-material-controls select { font-size: 16px; font-weight: 700; min-height: 44px; margin-left: 10px; padding: 7px; background: #0f172a; color: white; border: 1px solid #64748b; border-radius: 8px; max-width: 100%; }
        .talkly-material-controls p { margin: 4px 0 0; color: #cbd5e1; }
        /* The iframe contains camera + shared-material columns, chat stays third. */
        .talkly-classroom-stage[data-material-mode="screen"] > .talkly-classroom-video { grid-column: 1 / 3; min-height: 0; }
        .talkly-classroom-stage[data-material-mode="screen"] > .talkly-classroom-textbook { display: none; }
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] { grid-template-columns: minmax(260px, 1fr) minmax(260px, .9fr); }
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-video { grid-column: 1; }
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-chat { grid-column: 2; grid-row: 1; }
        @media (min-width: 641px) and (max-width: 1050px) {
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-chat { height: 65dvh; min-height: 420px; }
        }
        @media (max-width: 640px) {
          .talkly-classroom-stage[data-material-mode="screen"] > .talkly-classroom-video { grid-column: 1; height: 65dvh; min-height: 420px; }
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] { grid-template-columns: minmax(0, 1fr); }
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-chat { grid-column: 1; grid-row: 2; }
        }

        @media (orientation: landscape) and (max-height: 600px) {
          .talkly-classroom-top {
            min-height: 34px;
            margin-bottom: 4px;
          }

          .talkly-brand-kicker,
          .talkly-identity small,
          .talkly-control-copy small {
            display: none;
          }

          .talkly-classroom-title {
            margin-top: 0;
            font-size: 15px;
          }

          .talkly-classroom-control {
            min-height: 38px;
            margin-bottom: 4px;
            padding-top: 4px;
            padding-bottom: 4px;
          }
        }
      `}</style>

      <main className="talkly-classroom">
        <ClassSessionEndWatcher sessionId={session.id} />
        {isVerifiedTestStudent && session.status === "scheduled" && <TestStudentStartWatcher sessionId={session.id} />}

        <StudentAttendanceRecorder
  sessionId={session.id}
  enabled={
    (profile.role === "student" ||
      isVerifiedTestStudent) &&
    session.status === "in_progress" &&
    Boolean(session.started_at) &&
    !session.ended_at
  }
  testStudentMode={isVerifiedTestStudent}
/>

        <header className="talkly-classroom-top">
          <div>
            <div className="talkly-brand-kicker">
              TALKLY CLASSROOM
            </div>

            <h1 className="talkly-classroom-title">
              {course?.name || "Online English"} · Lesson {session.lesson_number}
              <small>{session.lesson_number}회차</small>
            </h1>
          </div>

          <div className="talkly-identity">
            <strong>{identityPrimary}</strong>
            <small>{identitySecondary}</small>
          </div>
        </header>

        <section className="talkly-classroom-control">
          <div className="talkly-control-copy">
            <strong>CLASS CONTROL</strong>
            <small>수업 제어 · 상태 확인</small>
          </div>

          <ClassSessionControls
            sessionId={session.id}
            viewerRole={profile.role}
            initialStartedAt={session.started_at}
            initialEndedAt={session.ended_at}
          />
        </section>

        <ClassroomMaterialStage sessionId={session.id} initialMode={materialMode} canControl={hostMode}>
          <section className="talkly-classroom-panel talkly-classroom-video">
            <ClassroomZoomFrame
              key={`${user.id}-${profile.role}-${session.id}`}
              sessionId={session.id}
              testStudentMode={isVerifiedTestStudent}
            />
          </section>



<section className="talkly-classroom-panel talkly-classroom-textbook">
  <ClassroomTextbookSelectorRefresh
    sessionId={session.id}
    selectedTextbookId={session.selected_textbook_id}
    textbooks={testTextbooks ?? (assignedTextbooks ?? []).flatMap((item) => {
      const textbook = item.textbooks;

      if (!textbook) {
        return [];
      }

      const book = Array.isArray(textbook)
        ? textbook[0]
        : textbook;

      if (!book) {
        return [];
      }

      return [
        {
          id: book.id,
          title: book.title,
        },
      ];
    })}
    canControl={hostMode || isVerifiedTestStudent}
  />

  {session.selected_textbook_id ? (
    <ClassroomTextbookPanel
      key={session.selected_textbook_id}
      textbookId={session.selected_textbook_id}
      sessionId={session.id}
      enrollmentId={enrollment.id}
      viewerRole={profile.role}
      testStudentMode={isVerifiedTestStudent}
    />
  ) : (
    <div className="flex h-full min-h-[320px] items-center justify-center p-6 text-center">
      <div>
        <p className="text-base font-semibold text-slate-700">
          수업 교재가 선택되지 않았습니다.
        </p>

        <p className="mt-2 text-sm text-slate-500">
          담당 강사가 교재를 선택하면 이곳에 표시됩니다.
        </p>
      </div>
    </div>
  )}
</section>


        <ClassroomChat
          sessionId={session.id}
          currentUserId={user.id}
          currentUserRole={profile.role}
          classInProgress={session.status === "in_progress" && Boolean(session.started_at) && !session.ended_at}
          testStudentMode={isVerifiedTestStudent}
          currentUserName={
            profile.role === "teacher"
              ? teacherName
              : profile.role === "admin"
                ? profile.name || "TALKLY Admin"
                : studentName
          }
        />
        </ClassroomMaterialStage>
      </main>
    </>
  );
}
