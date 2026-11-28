import { getClassroomText } from "@/lib/classroom-language";
import ClassroomPreparation from "./ClassroomPreparation";
import ClassroomMaterialStage from "./ClassroomMaterialStage";
import { getCurrentUser } from "@/lib/server-user";
import TestStudentStartWatcher from "./TestStudentStartWatcher";
import { getTestClassroomOptions } from "@/lib/test-classroom-options";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

import ClassroomZoomFrame from "./ClassroomZoomFrame";
import ClassroomResponsiveZoom from "./ClassroomResponsiveZoom";
import ClassroomTextbookPanel from "./ClassroomTextbookPanel";
import ClassSessionControls from "./ClassSessionControls";
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

  const ui = getClassroomText(profile.role === "teacher");

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
  // Test teachers also need ready-to-use test books in the classroom;
  // previously only admin-as-student could choose one. Production teachers
  // still see only textbooks assigned to their real enrollment.
  const isTeacherTestSession =
    profile.role === "teacher" &&
    session.is_test === true &&
    enrollment.is_test === true &&
    session.is_external_teacher !== true &&
    (session.teacher_user_id ?? enrollment.teacher_user_id) === user.id;
  const testTextbooks = (isVerifiedTestStudent || isTeacherTestSession)
    ? (await getTestClassroomOptions()).textbooks
    : null;
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
      ? ui("강사")
      : profile.role === "student"
        ? ui("학생")
        : profile.role === "parent"
          ? ui("학부모")
          : `${studentName} / ${teacherName}`;

  const isLearner =
    isVerifiedTestStudent ||
    profile.role ===
      "student" ||
    profile.role ===
      "parent";

  const unavailableMessages: Record<string, string> = {
    cancelled: ui("취소된 수업입니다."),
    held: ui("연기 또는 결석 승인된 수업입니다."),
    not_held: ui("진행되지 않은 수업입니다."),
    no_show: ui("결석 처리된 수업입니다."),
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
      <main lang={profile.role === "teacher" ? "en" : "ko"}
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
            {profile.role === "teacher" && /[가-힣]/.test(course?.name || "") ? "Online English" : course?.name || "Online English"} · {profile.role === "teacher" ? `Lesson ${session.lesson_number}` : `${session.lesson_number}회차`}</p>
          <Link href={returnHref} style={{ color: "#93c5fd" }}>{ui("돌아가기 →")}</Link>
        </div>
      </main>
    );
  }
  // Learners enter the same Zoom / materials / chat classroom as teachers,
  // even before the teacher starts the meeting. The embedded Zoom waiting
  // view provides a local camera and microphone preflight until host join.
  // Official attendance and class time remain gated on session.started_at.

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
        ? ui("수업 상세·평가 작성 →")
        : ui("돌아가기");

    return (
      <main lang={profile.role === "teacher" ? "en" : "ko"}
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
          >{ui("수업이 종료되었습니다")}</h1>

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
            }{ui("회차")}<br />{ui("담당 강사:")}{" "}
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
            >{ui("수업 종료가 완료되었습니다.")}<br />{ui("수업 상세 화면에서 이번 회차의 학습 평가를 작성할 수 있습니다.")}</div>
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
  if (hostMode && materials !== "ready" && session.status !== "in_progress") {
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
      <main lang={profile.role === "teacher" ? "en" : "ko"}
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

        <p>{ui("이 수업에는 아직 Zoom Meeting이 연결되어 있지 않습니다.")}</p>
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
          grid-template-columns: minmax(0, 2fr) minmax(0, 5fr) minmax(0, 3fr);
          gap: 8px;
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
        .talkly-classroom-screen-guide { display: none; flex-direction: column; justify-content: center; gap: 12px; padding: 22px; background: #101d30; color: #e2e8f0; }
        .talkly-classroom-screen-guide strong { font-size: 18px; }
        .talkly-classroom-screen-guide p { font-size: 14px; line-height: 1.6; color: #cbd5e1; }
        .talkly-zoom-frame { display: block; width: 100%; height: 100%; border: 0; background: #111216; }
        .talkly-zoom-desktop { display: flex; flex-direction: column; height: 100%; min-height: 0; }
        .talkly-zoom-desktop-embed { flex: 1 1 0; min-height: 0; }
        .talkly-zoom-app-fallback { flex: 0 0 auto; padding: 4px 10px; font-size: 11px; line-height: 1.6; background: #172033; color: #cbd5e1; }
        .talkly-zoom-app-fallback summary { cursor: pointer; min-height: 30px; color: #fef08a; }
        .talkly-zoom-app-fallback p { margin: 4px 0; }
        .talkly-zoom-app-fallback a { display: inline-flex; justify-content: center; min-height: 42px; align-items: center; padding: 6px 12px; margin: 5px 0; border-radius: 8px; background: #1d4ed8; color: #fff; font-weight: 800; text-decoration: none; }
        .talkly-mobile-zoom-access { height: 100%; min-height: 0; overflow-y: auto; box-sizing: border-box; padding: 22px; display: flex; flex-direction: column; justify-content: center; align-items: stretch; gap: 13px; background: #111827; color: #f8fafc; line-height: 1.6; }
        .talkly-mobile-zoom-heading { font-size: 18px; }
        .talkly-mobile-zoom-access p { font-size: 13px; margin: 0; color: #dbeafe; }
        .talkly-mobile-zoom-warning { border: 1px solid #f59e0b; border-radius: 10px; padding: 10px; background: #3b2f1e; }
        .talkly-mobile-zoom-launch, .talkly-mobile-zoom-browser { display: inline-flex; width: 100%; box-sizing: border-box; min-height: 49px; align-items: center; justify-content: center; border-radius: 10px; font-size: 14px; font-weight: 900; text-align: center; text-decoration: none; padding: 10px; }
        .talkly-mobile-zoom-launch { background: #2563eb; border: 1px solid #93c5fd; color: #fff; }
        .talkly-mobile-zoom-browser { background: #263243; border: 1px solid #64748b; color: #e2e8f0; cursor: pointer; }
        .talkly-mobile-zoom-note { font-size: 12px !important; }



        @media (max-width: 1050px) {
          .talkly-classroom { height: auto; min-height: 100dvh; overflow: auto; padding: 6px 8px; }
          .talkly-classroom-stage { grid-template-columns: minmax(0, 1fr); gap: 9px; overflow: visible; flex: none; }
          .talkly-classroom-video { height: 62dvh; min-height: 430px; grid-column: 1 / -1; }
          .talkly-classroom-textbook { height: 65dvh; min-height: 430px; grid-column: 1 / -1; }
          .talkly-classroom-stage > .talkly-chat { grid-column: 1 / -1; height: 320px; }
          .talkly-classroom-top { flex-wrap: wrap; gap: 8px; }
          .talkly-classroom-title { font-size: 17px; }
          .talkly-classroom-control { gap: 8px; padding: 6px 8px; }
          .talkly-mobile-zoom-access { padding: 16px; justify-content: flex-start; }
        }
        @media (max-width: 640px) {
          .talkly-classroom-video { height: 60dvh; min-height: 400px; }
          .talkly-classroom-textbook { height: 66dvh; min-height: 420px; }
          .talkly-mobile-zoom-access { padding: 13px; }
        }


        .talkly-material-controls { flex: 0 0 auto; padding: 4px 10px; border: 1px solid #334155; border-radius: 10px; background: #172033; margin-bottom: 5px; font-size: 12px; line-height: 1.4; display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; justify-content: space-between; }
        .talkly-material-controls details { max-width: min(100%, 480px); }
        .talkly-classroom button:focus-visible, .talkly-classroom select:focus-visible, .talkly-classroom summary:focus-visible { outline: 3px solid #facc15; outline-offset: 3px; }
        .talkly-classroom summary { cursor: pointer; padding: 8px 0; font-weight: 700; }
        .talkly-material-controls select { font-size: 13px; font-weight: 700; min-height: 34px; margin-left: 6px; padding: 4px; background: #0f172a; color: white; border: 1px solid #64748b; border-radius: 8px; max-width: 100%; }
        .talkly-material-controls p { margin: 4px 0 0; color: #cbd5e1; }
        /* The iframe contains camera + shared-material columns, chat stays third. */
        .talkly-classroom-stage[data-material-mode="screen"] > .talkly-classroom-video { grid-column: 1 / 3; min-height: 0; }
        .talkly-classroom-stage[data-material-mode="screen"] > .talkly-classroom-textbook { display: none; }
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-video { grid-column: 1; }
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-screen-guide { display: flex; grid-column: 2; grid-row: 1; }
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-chat { grid-column: 3; grid-row: 1; }
        @media (min-width: 641px) and (max-width: 1050px) {
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-chat { height: 65dvh; min-height: 420px; }
        }
        @media (max-width: 1050px) {
          .talkly-classroom-stage[data-material-mode="screen"] > .talkly-classroom-video { grid-column: 1; height: 62dvh; min-height: 430px; }
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] { grid-template-columns: minmax(0, 1fr); }
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-screen-guide { grid-column: 1; grid-row: 2; height: 220px; }
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-chat { grid-column: 1; grid-row: 3; }
        }

        /* A landscape tablet has room for the same 20/50/30 teaching layout. */
        @media (min-width: 900px) and (max-width: 1050px) {
          .talkly-classroom { height: 100dvh; overflow: hidden; }
          .talkly-classroom-stage,
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] {
            grid-template-columns: minmax(0, 2fr) minmax(0, 5fr) minmax(0, 3fr);
            flex: 1 1 auto; min-height: 0; overflow: hidden;
          }
          .talkly-classroom-video, .talkly-classroom-textbook,
          .talkly-classroom-stage > .talkly-chat,
          .talkly-classroom-stage[data-material-mode="screen"] > .talkly-classroom-video,
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-chat {
            height: 100%; min-height: 0;
          }
          .talkly-classroom-stage[data-material-mode="screen"] > .talkly-classroom-video { grid-column: 1 / 3; }
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-video { grid-column: 1; }
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-screen-guide { grid-column: 2; grid-row: 1; height: 100%; }
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-chat { grid-column: 3; grid-row: 1; }
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
        /* Keep the Zoom-app fallback available but no longer let its yellow
           troubleshooting summary compete with the lesson video. */
        .talkly-zoom-app-fallback {
          padding:2px 7px; background:#101827;
          border-bottom:1px solid rgba(148,163,184,.15);
        }
        .talkly-zoom-app-fallback summary {
          min-height:24px; padding:2px 0; color:#aab7cc;
          font-size:10px; font-weight:600; line-height:1.35;
        }
        .talkly-zoom-app-fallback[open] {
          padding:7px 9px; background:#192439;
        }
        .talkly-zoom-app-fallback[open] summary {
          color:#fde68a; font-size:11px;
        }
        /* Follow-up to #56: the Zoom component cannot be split into arbitrary
           React-owned video/share nodes. In screen-share mode give its native
           share viewer the full 70% stage instead of wasting 50% on a guide. */
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-video {
          grid-column:1 / 3;
        }
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-screen-guide {
          display:none;
        }
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-chat {
          grid-column:3; grid-row:1;
        }
        .talkly-mobile-zoom-access {
          justify-content:flex-start; gap:10px; padding:12px; font-size:12px;
        }
        .talkly-mobile-zoom-heading { font-size:14px; }
        .talkly-mobile-zoom-warning { font-size:11px; line-height:1.45; }
        .talkly-mobile-zoom-launch, .talkly-mobile-zoom-browser {
          min-height:40px; font-size:12px; padding:7px 8px;
        }
        /* Landscape touch devices need a wider video/fallback rail than 20%.
           Zoom Component View remains unsupported in tablet browsers. */
        @media (min-width:900px) and (pointer:coarse) {
          .talkly-classroom-stage {
            grid-template-columns:minmax(0,3fr) minmax(0,4.5fr) minmax(0,2.5fr);
          }
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] {
            grid-template-columns:minmax(0,3fr) minmax(0,4.5fr) minmax(0,2.5fr);
          }
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-video {
            grid-column:1 / 3;
          }
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-chat {
            grid-column:3; grid-row:1;
          }
        }
        /* Preserve single-column order on narrow devices. */
        @media (max-width:899px) {
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-video {
            grid-column:1; grid-row:1;
          }
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-chat {
            grid-column:1; grid-row:2;
          }
        }
        /* Adjustable classroom panels: separators float over the grid and do
           not remount Zoom, textbook or chat components while dragging. */
        .talkly-pane-resizer {
          position: absolute; top: 0; bottom: 0; z-index: 18;
          width: 16px; transform: translateX(-50%);
          cursor: col-resize; touch-action: none; user-select: none;
          display: flex; align-items: center; justify-content: center;
        }
        .talkly-pane-resizer::before {
          content: ""; display: block; width: 4px; height: 80px;
          max-height: 28%; border-radius: 9px;
          background: rgba(147,197,253,.75);
          box-shadow: 0 0 0 1px rgba(15,23,42,.8);
        }
        .talkly-pane-resizer:hover::before,
        .talkly-pane-resizer:focus-visible::before {
          background: #facc15; width: 6px;
        }
        .talkly-pane-resizer:focus-visible { outline: 2px solid #facc15; outline-offset: -2px; }
        .talkly-pane-reset {
          position:absolute; top:6px; right:6px; z-index:19;
          padding:5px 9px; border-radius:7px; border:1px solid #64748b;
          background:#172033; color:#e2e8f0; font-size:10px; font-weight:700;
          cursor:pointer; opacity:.8;
        }
        .talkly-pane-reset:hover, .talkly-pane-reset:focus-visible { opacity:1; }
        .talkly-classroom-stage[data-material-mode="screen"] .talkly-pane-reset {
          right:calc(100% - 100% * 0.8 + 6px);
        }
        @media (max-width:1050px) { .talkly-pane-resizer { display:none; } }
        /* ODP layout: one quiet header with lesson, status and elapsed time. */
        .talkly-classroom { padding:5px 8px; }
        .talkly-classroom-top {
          min-height:30px; margin-bottom:0; padding:0 3px;
          gap:8px;
        }
        .talkly-brand-kicker, .talkly-identity { display:none; }
        .talkly-classroom-title {
          margin:0; font-size:16px; font-weight:750; line-height:1.3;
        }
        .talkly-classroom-title small { display:none; }
        .talkly-classroom-control {
          position:absolute; z-index:8; top:6px; right:12px;
          width:auto; max-width:50%; min-height:26px;
          padding:0; margin:0; border:0;
          border-radius:0; background:transparent; box-shadow:none;
        }
        .talkly-session-status {
          min-height:28px!important; padding:0 8px!important;
        }
        .talkly-material-controls {
          min-height:31px; padding:3px 8px;
          margin-bottom:4px; border-radius:6px; background:#141b29;
          justify-content:flex-start;
        }
        .talkly-material-mode-label { font-size:12px; font-weight:700; }
        .talkly-material-controls select { margin-left:7px; min-height:28px; }
        .talkly-material-error { margin:0; font-size:11px; color:#fecaca; }
        .talkly-classroom-stage { gap:5px; }
        .talkly-classroom-panel { border-radius:9px; }
        @media(max-width:640px) {
          .talkly-classroom-top { padding-bottom:33px; }
          .talkly-classroom-control { top:37px; left:10px; right:auto; max-width:calc(100% - 20px); }
          .talkly-classroom-title { font-size:14px; }
        }


        /* Teacher screen-share has three real, independent DOM panes.
           Zoom stays in column 1; column 2 is the teacher's share status.
           The actual shared tab is transmitted by Zoom, not mirrored here. */
        @media (min-width: 1051px) {
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-video {
            grid-column: 1 !important; grid-row: 1;
            height: 100%; min-height: 0;
          }
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-screen-guide {
            display: flex !important; grid-column: 2 !important; grid-row: 1;
            min-width: 0; min-height: 0; height: 100%;
          }
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-chat {
            grid-column: 3 !important; grid-row: 1;
            min-width: 0; min-height: 0;
          }
        }
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] .talkly-classroom-screen-guide {
          align-items: center; text-align: center; padding: 14px;
          gap: 8px; border: 1px solid #4b617c;
        }
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] .talkly-classroom-screen-guide strong {
          font-size: 14px; font-weight: 700;
        }
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] .talkly-classroom-screen-guide p {
          max-width: 280px; margin: 0; font-size: 12px; line-height: 1.5;
        }
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] .talkly-share-guide-active { display: none; }
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"][data-sharing="true"] .talkly-share-guide-active { display: block; }
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"][data-sharing="true"] .talkly-share-guide-idle { display: none; }
        @media (max-width: 899px) {
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-video {
            grid-column: 1; grid-row: 1;
          }
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-screen-guide {
            display: flex; grid-column: 1; grid-row: 2; min-height: 150px;
          }
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-chat {
            grid-column: 1; grid-row: 3;
          }
        }
        /* Full-height resize handles sit inside the grid gutters, not on
           top of Zoom's camera or its native toolbar. With a 12px gap and
           a 10px rail, the draggable area stays between adjacent panes. */
        @media (min-width: 1051px) {
          .talkly-classroom-stage { gap: 12px; }
          .talkly-classroom-stage > .talkly-pane-resizer {
            width: 10px; transform: translateX(-50%);
            background: #23344d;
            border-left: 1px solid #6a86a7;
            border-right: 1px solid #6a86a7;
            box-sizing: border-box;
            border-radius: 4px;
          }
          .talkly-classroom-stage > .talkly-pane-resizer::before {
            width: 3px; height: 72px; border-radius: 4px;
            background: #dbeafe; box-shadow: none;
          }
          .talkly-classroom-stage > .talkly-pane-resizer:hover,
          .talkly-classroom-stage > .talkly-pane-resizer:focus-visible {
            background: #314e70;
          }
        }

        /* The Zoom iframe must occupy only the LEFT pane until a real screen
           share starts. In preclass READY it used to span columns 1/2 and
           centered the local camera preview across both, leaving an empty
           left panel and misleading the student. Keep the center material
           pane physically separate in READY and in joined/no-share state. */
        @media (min-width: 1051px) {
          .talkly-classroom-stage[data-material-mode="screen"] > .talkly-classroom-video,
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="false"][data-sharing="false"] > .talkly-classroom-video,
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-video {
            grid-column: 1 !important;
            grid-row: 1;
            min-width: 0;
            min-height: 0;
            height: 100%;
          }
          .talkly-classroom-stage[data-material-mode="screen"] > .talkly-classroom-screen-guide,
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="false"][data-sharing="false"] > .talkly-classroom-screen-guide {
            display: flex !important;
            grid-column: 2 !important;
            grid-row: 1;
            min-width: 0;
            min-height: 0;
            height: 100%;
          }
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="false"][data-sharing="true"] > .talkly-classroom-video {
            grid-column: 1 / 3 !important;
          }
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="false"][data-sharing="true"] > .talkly-classroom-screen-guide {
            display: none !important;
          }
          .talkly-classroom-stage[data-material-mode="screen"] > .talkly-chat {
            grid-column: 3 !important;
            grid-row: 1;
            min-width: 0;
            min-height: 0;
            height: 100%;
          }
        }
        /* Critical classroom restoration: selecting Zoom Screen Sharing
           must NEVER remove the synchronized TALKLY textbook pane.
           Native Zoom screen sharing remains available separately. */
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-screen-guide,
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="false"][data-sharing="false"] > .talkly-classroom-screen-guide {
          display:none!important;
        }
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-textbook,
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="false"][data-sharing="false"] > .talkly-classroom-textbook {
          display:flex!important;
          flex-direction:column;
          min-height:0; min-width:0; height:100%;
        }
        @media (min-width:1051px) {
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-textbook,
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="false"][data-sharing="false"] > .talkly-classroom-textbook {
            grid-column:2!important;
            grid-row:1;
          }
        }
        @media (max-width:1050px) {
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="true"] > .talkly-classroom-textbook,
          .talkly-classroom-stage[data-material-mode="screen"][data-presenter="false"][data-sharing="false"] > .talkly-classroom-textbook {
            grid-column:1!important;
            min-height:320px; height:65dvh;
          }
        }
        /* On the student, an active Zoom screen share occupies the left and
           middle panes; the textbook is only hidden DURING a real share. */
        .talkly-classroom-stage[data-material-mode="screen"][data-presenter="false"][data-sharing="true"] > .talkly-classroom-textbook {
          display:none!important;
        }
      `}</style>

      <main className="talkly-classroom" lang={profile.role === "teacher" ? "en" : "ko"}>
        <ClassSessionEndWatcher sessionId={session.id} />
        {isLearner && session.status === "scheduled" && !session.started_at && <TestStudentStartWatcher sessionId={session.id} />}

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
              {profile.role === "teacher" && /[가-힣]/.test(course?.name || "") ? "Online English" : course?.name || "Online English"} · Lesson {session.lesson_number}
              <small>{profile.role === "teacher" ? `Lesson ${session.lesson_number}` : `${session.lesson_number}회차`}</small>
            </h1>
          </div>

        </header>

        <section className="talkly-classroom-control">
          <ClassSessionControls
            sessionId={session.id}
            viewerRole={profile.role}
            initialStartedAt={session.started_at}
            initialEndedAt={session.ended_at}
          />
        </section>

        <ClassroomMaterialStage sessionId={session.id} initialMode={materialMode} canControl={hostMode}>
          <section className="talkly-classroom-panel talkly-classroom-video">
            <ClassroomResponsiveZoom meetingUrl={session.meeting_url} hostMode={hostMode}>
              <ClassroomZoomFrame
                key={`${user.id}-${profile.role}-${session.id}`}
                sessionId={session.id}
                testStudentMode={isVerifiedTestStudent}
              />
            </ClassroomResponsiveZoom>
          </section>



<section className="talkly-classroom-panel talkly-classroom-screen-guide" aria-label={profile.role === "teacher" ? "Shared teaching materials" : "공유 교재"}>
            <strong>{profile.role === "teacher" ? "Screen share" : "공유 교재"}</strong>
            <p className="talkly-share-guide-idle">{profile.role === "teacher" ? "Use Share Screen in Zoom to present your textbook." : "강사가 교재를 공유하면 표시됩니다."}</p>
            <p className="talkly-share-guide-active">{profile.role === "teacher" ? "You are sharing through Zoom. Students see the shared screen." : "교재 공유 중"}</p>
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
        <p className="text-base font-semibold text-slate-700">{ui("수업 교재가 선택되지 않았습니다.")}</p>

        <p className="mt-2 text-sm text-slate-500">{ui("담당 강사가 교재를 선택하면 이곳에 표시됩니다.")}</p>
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
