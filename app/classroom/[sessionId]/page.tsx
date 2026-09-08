import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

import ClassroomZoomEmbed from "./ClassroomZoomEmbed";
import ClassroomTextbookPanel from "./ClassroomTextbookPanel";
import ClassSessionControls from "./ClassSessionControls";
import ClassroomWaitingRoom from "./ClassroomWaitingRoom";
import ClassSessionEndWatcher from "./ClassSessionEndWatcher";
import StudentAttendanceRecorder from "./StudentAttendanceRecorder";
import ClassroomChat from "./ClassroomChat";

type PageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

async function getZoomAccessToken() {
  const accountId =
    process.env.ZOOM_ACCOUNT_ID;

  const clientId =
    process.env.ZOOM_CLIENT_ID;

  const clientSecret =
    process.env.ZOOM_CLIENT_SECRET;

  if (
    !accountId ||
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      "Zoom Server-to-Server 환경변수가 없습니다."
    );
  }

  const credentials =
    Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString("base64");

  const response =
    await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(
        accountId
      )}`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Basic ${credentials}`,

          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        cache: "no-store",
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.access_token
  ) {
    throw new Error(
      "Zoom Access Token 발급에 실패했습니다."
    );
  }

  return data.access_token as string;
}

async function getZoomMeetingPassword(
  meetingId: string
) {
  const accessToken =
    await getZoomAccessToken();

  const response =
    await fetch(
      `https://api.zoom.us/v2/meetings/${encodeURIComponent(
        meetingId
      )}`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

        cache: "no-store",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      `Zoom 회의정보 조회 실패: ${
        typeof data?.message === "string"
          ? data.message
          : response.status
      }`
    );
  }

  return typeof data.password ===
    "string"
    ? data.password
    : "";
}

export default async function ClassroomPage({
  params,
}: PageProps) {
  const { sessionId } =
    await params;

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
    await supabase.auth.getUser();

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
      ended_at
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
      teacher_user_id
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
    profile.role ===
      "teacher" &&
    enrollment.teacher_user_id ===
      user.id
  ) {
    hasAccess =
      true;
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

  const meetingPassword =
    await getZoomMeetingPassword(
      session.meeting_id
    );

  /*
   * Zoom 참가자 표시 이름
   */
  const zoomDisplayName =
    profile.role ===
    "teacher"
      ? teacherName
      : profile.role ===
          "admin"
        ? profile.name ||
          "TALKLY Admin"
        : studentName;

  const hostMode =
    profile.role ===
      "teacher" ||
    profile.role ===
      "admin";

  const identityPrimary =
    profile.role === "teacher"
      ? `${teacherName} · TEACHER`
      : profile.role === "student"
        ? `${studentName} · STUDENT`
        : profile.role === "parent"
          ? `${studentName} · PARENT`
          : `TALKLY ADMIN`;

  const identitySecondary =
    profile.role === "teacher"
      ? "강사"
      : profile.role === "student"
        ? "학생"
        : profile.role === "parent"
          ? "학부모"
          : `${studentName} / ${teacherName}`;

  const isLearner =
    profile.role ===
      "student" ||
    profile.role ===
      "parent";

  /*
   * =====================================================
   * 학생/학부모 수업 시작 전 대기실
   * =====================================================
   */
  if (
    isLearner &&
    !session.started_at &&
    !session.ended_at
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
          studentName
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
  if (
    session.ended_at
  ) {
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
          max-width: 1500px;
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
          grid-template-columns:
            minmax(300px, .68fr)
            minmax(620px, 1.82fr);
          gap: 14px;
          align-items: stretch;
          flex: 1 1 auto;
          min-height: 0;
          overflow: hidden;
        }

        .talkly-classroom-panel {
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
        }

        @media (max-width: 1100px) {
          .talkly-classroom {
            padding: 10px 12px;
          }

          .talkly-classroom-stage {
            grid-template-columns:
              minmax(280px, .72fr)
              minmax(500px, 1.58fr);
            gap: 10px;
          }
        }

        /*
         * 태블릿 세로/스마트폰:
         * 교재를 메인 화면으로 두고 Zoom을 Picture-in-Picture 형태로 올립니다.
         * 따라서 영상 + 교재 + 전자칠판 + 채팅을 한 화면에서 계속 확인할 수 있습니다.
         */
        @media (max-width: 900px) {
          .talkly-classroom {
            padding: 8px;
          }

          .talkly-classroom-top {
            min-height: 42px;
            margin-bottom: 7px;
          }

          .talkly-classroom-title {
            font-size: 18px;
          }

          .talkly-classroom-control {
            min-height: 46px;
            margin-bottom: 7px;
            padding: 6px 9px;
            border-radius: 12px;
          }

          .talkly-classroom-stage {
            display: block;
            position: relative;
            flex: 1 1 auto;
            min-height: 0;
            overflow: hidden;
          }

          .talkly-classroom-video {
            position: absolute;
            z-index: 35;
            top: 56px;
            right: 10px;
            left: auto;
            width: min(25vw, 180px);
            height: min(18vh, 132px);
            min-width: 138px;
            min-height: 98px;
            border-radius: 12px;
            box-shadow:
              0 18px 48px rgba(0,0,0,.46),
              0 0 0 1px rgba(255,255,255,.10);
          }

          .talkly-classroom-textbook {
            width: 100%;
            height: 100%;
          }
        }

        @media (max-width: 620px) {
          .talkly-classroom {
            padding: 6px;
          }

          .talkly-classroom-top {
            min-height: 34px;
            margin-bottom: 5px;
            gap: 10px;
          }

          .talkly-brand-kicker {
            font-size: 8px;
          }

          .talkly-classroom-title {
            margin-top: 2px;
            font-size: 15px;
          }

          .talkly-classroom-title small {
            display: none;
          }

          .talkly-identity strong {
            max-width: 130px;
            font-size: 9px;
          }

          .talkly-identity small {
            display: none;
          }

          .talkly-classroom-control {
            min-height: 42px;
            margin-bottom: 5px;
          }

          .talkly-control-copy small {
            display: none;
          }

          .talkly-classroom-video {
            top: 48px;
            right: 7px;
            left: auto;
            width: 106px;
            height: 78px;
            min-width: 106px;
            min-height: 78px;
            border-radius: 10px;
          }
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

        <StudentAttendanceRecorder
          sessionId={session.id}
          enabled={
            profile.role === "student" &&
            Boolean(session.started_at) &&
            !session.ended_at
          }
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

        <div className="talkly-classroom-stage">
          <section className="talkly-classroom-panel talkly-classroom-video">
            <ClassroomZoomEmbed
              key={`${user.id}-${profile.role}-${session.id}`}
              sessionId={session.id}
              meetingNumber={session.meeting_id}
              password={meetingPassword}
              userName={zoomDisplayName}
              hostMode={hostMode}
            />
          </section>

          <section className="talkly-classroom-panel talkly-classroom-textbook">
            <ClassroomTextbookPanel
              textbookId={4}
              sessionId={session.id}
              viewerRole={profile.role}
            />
          </section>
        </div>

        <ClassroomChat
          sessionId={session.id}
          currentUserId={user.id}
          currentUserRole={profile.role}
          currentUserName={
            profile.role === "teacher"
              ? teacherName
              : profile.role === "admin"
                ? profile.name || "TALKLY Admin"
                : studentName
          }
        />
      </main>
    </>
  );
}