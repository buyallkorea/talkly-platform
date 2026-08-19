import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

import ClassroomZoomEmbed from "./ClassroomZoomEmbed";
import ClassroomTextbookPanel from "./ClassroomTextbookPanel";
import ClassSessionControls from "./ClassSessionControls";
import ClassroomWaitingRoom from "./ClassroomWaitingRoom";
import ClassSessionEndWatcher from "./ClassSessionEndWatcher";
import StudentAttendanceRecorder from "./StudentAttendanceRecorder";

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

  const headerIdentity =
    profile.role ===
    "teacher"
      ? `${teacherName} 강사`
      : profile.role ===
          "student"
        ? `${studentName} 학생`
        : profile.role ===
            "parent"
          ? `${studentName} 학부모`
          : `관리자 · ${studentName} / ${teacherName}`;

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
    <main
      style={{
        height:
          "100vh",

        padding:
          "12px 16px",

        boxSizing:
          "border-box",

        background:
          "#0b0b0d",

        color:
          "#f7f7f8",

        display:
          "flex",

        flexDirection:
          "column",

        overflow:
          "hidden",
      }}
    >
      <ClassSessionEndWatcher
        sessionId={
          session.id
        }
      />

      {/*
       * 학생 실제 Classroom 입장 시 자동출석.
       *
       * 강사/관리자는 기록하지 않습니다.
       * 최초 출석시간은 attendance API에서 유지됩니다.
       */}
      <StudentAttendanceRecorder
        sessionId={
          session.id
        }
        enabled={
          profile.role ===
            "student" &&
          Boolean(
            session.started_at
          ) &&
          !session.ended_at
        }
      />

      <header
        style={{
          maxWidth:
            "1500px",

          width:
            "100%",

          margin:
            "0 auto 10px",

          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "center",

          gap:
            "20px",

          flexShrink:
            0,
        }}
      >
        <div>
          <div
            style={{
              fontSize:
                "12px",

              opacity:
                0.58,

              marginBottom:
                "3px",
            }}
          >
            TALKLY CLASSROOM
          </div>

          <h1
            style={{
              margin:
                0,

              fontSize:
                "22px",
            }}
          >
            {course?.name ||
              "Online English"}{" "}
            ·{" "}
            {
              session.lesson_number
            }
            회차
          </h1>
        </div>

        <div
          style={{
            fontSize:
              "13px",

            opacity:
              0.7,

            textAlign:
              "right",

            paddingRight:
              "4px",
          }}
        >
          {headerIdentity}
        </div>
      </header>

      <section
        style={{
          maxWidth:
            "1500px",

          width:
            "100%",

          margin:
            "0 auto 10px",

          padding:
            "8px 14px",

          border:
            "1px solid rgba(255,255,255,0.10)",

          borderRadius:
            "12px",

          background:
            "rgba(255,255,255,0.035)",

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "space-between",

          gap:
            "16px",

          boxSizing:
            "border-box",

          flexShrink:
            0,
        }}
      >
        <div>
          <div
            style={{
              fontSize:
                "12px",

              fontWeight:
                800,

              letterSpacing:
                "0.04em",
            }}
          >
            CLASS CONTROL
          </div>

          <div
            style={{
              marginTop:
                "2px",

              fontSize:
                "11px",

              opacity:
                0.5,
            }}
          >
            수업 상태
          </div>
        </div>

        <ClassSessionControls
          sessionId={
            session.id
          }
          viewerRole={
            profile.role
          }
          initialStartedAt={
            session.started_at
          }
          initialEndedAt={
            session.ended_at
          }
        />
      </section>

      <div
        style={{
          maxWidth:
            "1500px",

          width:
            "100%",

          margin:
            "0 auto",

          display:
            "grid",

          gridTemplateColumns:
            "minmax(340px, 0.78fr) minmax(560px, 1.72fr)",

          gap:
            "16px",

          alignItems:
            "stretch",

          flex:
            1,

          minHeight:
            0,

          overflow:
            "hidden",
        }}
      >
        <section
          style={{
            minHeight:
              0,

            height:
              "100%",

            border:
              "1px solid rgba(255,255,255,0.12)",

            borderRadius:
              "16px",

            overflow:
              "hidden",

            background:
              "#111216",
          }}
        >
          <ClassroomZoomEmbed
            key={`${user.id}-${profile.role}-${session.id}`}
            sessionId={
              session.id
            }
            meetingNumber={
              session.meeting_id
            }
            password={
              meetingPassword
            }
            userName={
              zoomDisplayName
            }
            hostMode={
              hostMode
            }
          />
        </section>

        <section
          style={{
            minHeight:
              0,

            height:
              "100%",

            border:
              "1px solid rgba(255,255,255,0.12)",

            borderRadius:
              "16px",

            overflowX:
              "hidden",

            overflowY:
              "auto",

            background:
              "#15161a",
          }}
        >
          <ClassroomTextbookPanel
            textbookId={
              4
            }
            sessionId={
              session.id
            }
            viewerRole={
              profile.role
            }
          />
        </section>
      </div>
    </main>
  );
}