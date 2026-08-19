import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type RequestBody = {
  enrollmentId: number;
};

async function getZoomAccessToken() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error(
      "Zoom API 환경변수가 설정되지 않았습니다."
    );
  }

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const response = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(
      accountId
    )}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (
    !response.ok ||
    !data.access_token
  ) {
    throw new Error(
      `Zoom access token 발급 실패: ${JSON.stringify(
        data
      )}`
    );
  }

  return data.access_token as string;
}

async function deleteZoomMeeting(
  accessToken: string,
  meetingId: string
) {
  try {
    await fetch(
      `https://api.zoom.us/v2/meetings/${encodeURIComponent(
        meetingId
      )}`,
      {
        method: "DELETE",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );
  } catch (error) {
    console.error(
      "[Zoom rollback] meeting delete failed:",
      meetingId,
      error
    );
  }
}

export async function POST(
  request: Request
) {
  const supabase =
    await createClient();

  /*
   * 1. 관리자 확인
   */
  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error:
          "로그인이 필요합니다.",
      },
      {
        status: 401,
      }
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin"
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "관리자 권한이 필요합니다.",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * 2. 요청값
   */
  let body: RequestBody;

  try {
    body =
      (await request.json()) as
        RequestBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "요청 데이터를 읽을 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const enrollmentId =
    Number(
      body.enrollmentId
    );

  if (
    !Number.isInteger(
      enrollmentId
    ) ||
    enrollmentId <= 0
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "올바른 수강 ID가 필요합니다.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * 3. 수강정보
   */
  const {
    data: enrollment,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(`
      id,
      child_id,
      course_id,
      teacher_user_id
    `)
    .eq(
      "id",
      enrollmentId
    )
    .maybeSingle();

  if (
    enrollmentError ||
    !enrollment
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          enrollmentError?.message ||
          "수강정보를 찾을 수 없습니다.",
      },
      {
        status: 404,
      }
    );
  }

  if (
    !enrollment.teacher_user_id
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "담당 강사가 배정되지 않았습니다.",
      },
      {
        status: 409,
      }
    );
  }

  /*
   * 4. 학생/과정
   */
  let studentName =
    "Student";

  if (
    enrollment.child_id
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

  let courseName =
    "English";

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

  if (course?.name) {
    courseName =
      course.name;
  }

  /*
   * 5. Zoom 미연결 수업 조회
   */
  const {
    data: sessions,
    error: sessionsError,
  } = await supabase
    .from("class_sessions")
    .select(`
      id,
      lesson_number,
      scheduled_start,
      scheduled_end,
      status,
      meeting_id,
      meeting_url
    `)
    .eq(
      "enrollment_id",
      enrollmentId
    )
    .eq(
      "status",
      "scheduled"
    )
    .order(
      "lesson_number",
      {
        ascending: true,
      }
    );

  if (sessionsError) {
    return NextResponse.json(
      {
        success: false,
        error:
          `수업 조회 실패: ${sessionsError.message}`,
      },
      {
        status: 500,
      }
    );
  }

  const targets =
    (sessions ?? []).filter(
      (session) =>
        !session.meeting_id &&
        !session.meeting_url
    );

  if (
    targets.length === 0
  ) {
    return NextResponse.json({
      success: true,
      connected: 0,
      message:
        "Zoom 연결이 필요한 수업이 없습니다.",
    });
  }

  /*
   * 6. Zoom 준비
   */
  const hostEmail =
    process.env.ZOOM_HOST_EMAIL;

  if (!hostEmail) {
    return NextResponse.json(
      {
        success: false,
        error:
          "ZOOM_HOST_EMAIL 환경변수가 없습니다.",
      },
      {
        status: 500,
      }
    );
  }

  const accessToken =
    await getZoomAccessToken();

  const createdMeetings: {
    sessionId: number;
    meetingId: string;
  }[] = [];

  /*
   * 7. 회차별 Zoom 생성
   */
  try {
    for (
      const session of
      targets
    ) {
      const start =
        new Date(
          session.scheduled_start
        );

      const end =
        new Date(
          session.scheduled_end
        );

      const duration =
        Math.max(
          1,
          Math.round(
            (
              end.getTime() -
              start.getTime()
            ) /
              60000
          )
        );

      const zoomResponse =
        await fetch(
          `https://api.zoom.us/v2/users/${encodeURIComponent(
            hostEmail
          )}/meetings`,
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                topic:
                  `TALKLY ${studentName} - ${session.lesson_number}회차 - ${courseName}`,

                type: 2,

                start_time:
                  session.scheduled_start,

                duration,

                timezone:
                  "Asia/Seoul",

                agenda:
                  "TALKLY online English class",

                settings: {
                  host_video:
                    true,

                  participant_video:
                    true,

                  join_before_host:
                    false,

                  mute_upon_entry:
                    true,

                  waiting_room:
                    false,

                  auto_recording:
                    "none",
                },
              }),

            cache:
              "no-store",
          }
        );

      const meeting =
        await zoomResponse.json();

      if (
        !zoomResponse.ok ||
        !meeting.id ||
        !meeting.join_url
      ) {
        throw new Error(
          `${session.lesson_number}회차 Zoom 생성 실패: ${JSON.stringify(
            meeting
          )}`
        );
      }

      const meetingId =
        String(
          meeting.id
        );

      createdMeetings.push({
        sessionId:
          session.id,

        meetingId,
      });

      const {
        error: updateError,
      } = await supabase
        .from("class_sessions")
        .update({
          meeting_provider:
            "zoom",

          meeting_id:
            meetingId,

          meeting_url:
            meeting.join_url,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          session.id
        );

      if (updateError) {
        throw new Error(
          `${session.lesson_number}회차 DB 연결 실패: ${updateError.message}`
        );
      }
    }
  } catch (error) {
    /*
     * 실패 시 이번 작업에서 만든
     * Zoom Meeting만 전부 삭제
     */
    for (
      const meeting of
      createdMeetings
    ) {
      await deleteZoomMeeting(
        accessToken,
        meeting.meetingId
      );

      await supabase
        .from("class_sessions")
        .update({
          meeting_id:
            null,
          meeting_url:
            null,
        })
        .eq(
          "id",
          meeting.sessionId
        )
        .eq(
          "meeting_id",
          meeting.meetingId
        );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Zoom 일괄 연결 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    success: true,

    enrollmentId,

    connected:
      createdMeetings.length,

    totalSessions:
      sessions?.length ??
      0,

    message:
      `${createdMeetings.length}개 수업에 Zoom Meeting을 연결했습니다.`,
  });
}