import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";

const SEOUL_TIME_ZONE = "Asia/Seoul";
const INTERVIEW_DURATION_MINUTES = 20;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ScheduleBody = {
  testerUserId?: string;
  scheduledAt?: string;
  meetingProvider?: string | null;
  meetingUrl?: string | null;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const levelTestId = Number(id);

    if (
      !Number.isInteger(levelTestId) ||
      levelTestId <= 0
    ) {
      return NextResponse.json(
        {
          error: "잘못된 레벨테스트 번호입니다.",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "로그인이 필요합니다.",
        },
        { status: 401 }
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin"
    ) {
      return NextResponse.json(
        {
          error: "관리자 권한이 필요합니다.",
        },
        { status: 403 }
      );
    }

    const body =
      (await request.json()) as ScheduleBody;

    const testerUserId =
      body.testerUserId?.trim() || "";

    const scheduledAt =
      body.scheduledAt?.trim() || "";

    const meetingProvider =
      body.meetingProvider?.trim() || null;

    const meetingUrl =
      body.meetingUrl?.trim() || null;

    if (!testerUserId) {
      return NextResponse.json(
        {
          error: "담당 강사를 선택해주세요.",
        },
        { status: 400 }
      );
    }

    if (!scheduledAt) {
      return NextResponse.json(
        {
          error: "테스트 일시를 선택해주세요.",
        },
        { status: 400 }
      );
    }

    const start = new Date(scheduledAt);

    if (Number.isNaN(start.getTime())) {
      return NextResponse.json(
        {
          error: "테스트 일시가 올바르지 않습니다.",
        },
        { status: 400 }
      );
    }

    if (start.getTime() <= Date.now()) {
      return NextResponse.json(
        {
          error:
            "지난 시간에는 레벨테스트를 배정할 수 없습니다.",
        },
        { status: 400 }
      );
    }

    const end = new Date(
      start.getTime() +
        INTERVIEW_DURATION_MINUTES *
          60 *
          1000
    );

    const admin = createAdminClient();

    const {
      data: levelTest,
      error: levelTestError,
    } = await admin
      .from("level_tests")
      .select(`
        id,
        child_id,
        student_user_id,
        parent_user_id,
        interview_required,
        status
      `)
      .eq("id", levelTestId)
      .maybeSingle();

    if (levelTestError) {
      return NextResponse.json(
        {
          error: levelTestError.message,
        },
        { status: 400 }
      );
    }

    if (!levelTest) {
      return NextResponse.json(
        {
          error:
            "레벨테스트 정보를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    if (!levelTest.interview_required) {
      return NextResponse.json(
        {
          error:
            "먼저 원어민 추가 테스트 대상으로 저장해주세요.",
        },
        { status: 400 }
      );
    }

    const {
      data: teacher,
      error: teacherError,
    } = await admin
      .from("teacher_profiles")
      .select(`
        user_id,
        display_name,
        is_active
      `)
      .eq("user_id", testerUserId)
      .maybeSingle();

    if (
      teacherError ||
      !teacher ||
      !teacher.is_active
    ) {
      return NextResponse.json(
        {
          error:
            "활동 중인 강사 정보를 확인할 수 없습니다.",
        },
        { status: 400 }
      );
    }

    const seoulParts =
      getSeoulDateParts(start);

    const dateString =
      `${seoulParts.year}-` +
      `${pad(seoulParts.month)}-` +
      `${pad(seoulParts.day)}`;

    const startTime =
      `${pad(seoulParts.hour)}:` +
      `${pad(seoulParts.minute)}:00`;

    const endParts =
      getSeoulDateParts(end);

    const endTime =
      `${pad(endParts.hour)}:` +
      `${pad(endParts.minute)}:00`;

    /*
     * JS getDay():
     * 0=Sunday ... 6=Saturday
     *
     * TALKLY teacher_availability도
     * 동일한 규칙을 사용합니다.
     */
    const dayOfWeek =
      getSeoulDayOfWeek(start);

    /*
     * 1. TALKLY 전체 운영 차단일 확인
     */
    const {
      data: blocks,
      error: blockError,
    } = await admin
      .from("class_operation_blocks")
      .select(`
        id,
        start_time,
        end_time,
        reason
      `)
      .eq("block_date", dateString)
      .eq("is_active", true);

    if (blockError) {
      return NextResponse.json(
        {
          error: blockError.message,
        },
        { status: 400 }
      );
    }

    for (const block of blocks || []) {
      if (
        !block.start_time ||
        !block.end_time
      ) {
        return NextResponse.json(
          {
            error:
              block.reason
                ? `해당 날짜는 수업 운영이 중단되어 있습니다. (${block.reason})`
                : "해당 날짜는 수업 운영이 중단되어 있습니다.",
          },
          { status: 409 }
        );
      }

      if (
        timeRangesOverlap(
          startTime,
          endTime,
          block.start_time,
          block.end_time
        )
      ) {
        return NextResponse.json(
          {
            error:
              block.reason
                ? `선택한 시간은 운영 차단 시간입니다. (${block.reason})`
                : "선택한 시간은 운영 차단 시간입니다.",
          },
          { status: 409 }
        );
      }
    }

    /*
     * 2. 강사의 정규 근무시간 확인
     */
    const {
      data: recurring,
      error: recurringError,
    } = await admin
      .from("teacher_availability")
      .select(`
        id,
        start_time,
        end_time,
        effective_from,
        effective_to
      `)
      .eq(
        "teacher_user_id",
        testerUserId
      )
      .eq("day_of_week", dayOfWeek)
      .eq("is_available", true);

    if (recurringError) {
      return NextResponse.json(
        {
          error: recurringError.message,
        },
        { status: 400 }
      );
    }

    const recurringAvailable =
      (recurring || []).some((row) => {
        if (
          row.effective_from &&
          dateString <
            row.effective_from
        ) {
          return false;
        }

        if (
          row.effective_to &&
          dateString >
            row.effective_to
        ) {
          return false;
        }

        return (
          startTime >= row.start_time &&
          endTime <= row.end_time
        );
      });

    /*
     * 3. 특정일 예외 확인
     */
    const {
      data: exceptions,
      error: exceptionError,
    } = await admin
      .from(
        "teacher_availability_exceptions"
      )
      .select(`
        id,
        exception_type,
        start_time,
        end_time,
        reason
      `)
      .eq(
        "teacher_user_id",
        testerUserId
      )
      .eq(
        "exception_date",
        dateString
      )
      .eq("is_active", true);

    if (exceptionError) {
      return NextResponse.json(
        {
          error: exceptionError.message,
        },
        { status: 400 }
      );
    }

    let availableByException = false;

    for (const exception of
      exceptions || []) {
      if (
        exception.exception_type ===
        "unavailable"
      ) {
        if (
          !exception.start_time ||
          !exception.end_time
        ) {
          return NextResponse.json(
            {
              error:
                exception.reason
                  ? `해당 강사는 이 날짜에 근무할 수 없습니다. (${exception.reason})`
                  : "해당 강사는 이 날짜에 근무할 수 없습니다.",
            },
            { status: 409 }
          );
        }

        if (
          timeRangesOverlap(
            startTime,
            endTime,
            exception.start_time,
            exception.end_time
          )
        ) {
          return NextResponse.json(
            {
              error:
                exception.reason
                  ? `해당 강사는 선택한 시간에 근무할 수 없습니다. (${exception.reason})`
                  : "해당 강사는 선택한 시간에 근무할 수 없습니다.",
            },
            { status: 409 }
          );
        }
      }

      if (
        exception.exception_type ===
        "available"
      ) {
        if (
          !exception.start_time ||
          !exception.end_time
        ) {
          availableByException = true;
        } else if (
          startTime >=
            exception.start_time &&
          endTime <=
            exception.end_time
        ) {
          availableByException = true;
        }
      }
    }

    if (
      !recurringAvailable &&
      !availableByException
    ) {
      return NextResponse.json(
        {
          error:
            "선택한 시간은 해당 강사의 근무 가능시간이 아닙니다.",
        },
        { status: 409 }
      );
    }

    /*
     * 4. 기존 정규수업 충돌 확인
     */
    const {
      data: classConflicts,
      error: classConflictError,
    } = await admin
      .from("class_sessions")
      .select(`
        id,
        scheduled_start,
        scheduled_end,
        status
      `)
      .eq(
        "teacher_user_id",
        testerUserId
      )
      .lt(
        "scheduled_start",
        end.toISOString()
      )
      .gt(
        "scheduled_end",
        start.toISOString()
      )
      .not(
        "status",
        "in",
        '("cancelled","canceled")'
      )
      .limit(1);

    if (classConflictError) {
      return NextResponse.json(
        {
          error:
            classConflictError.message,
        },
        { status: 400 }
      );
    }

    if (
      classConflicts &&
      classConflicts.length > 0
    ) {
      return NextResponse.json(
        {
          error:
            "선택한 시간에 이미 정규수업이 배정되어 있습니다.",
        },
        { status: 409 }
      );
    }

    /*
     * 5. 다른 원어민 레벨테스트와 충돌 확인
     */
    const {
      data: interviewConflicts,
      error: interviewConflictError,
    } = await admin
      .from("level_test_interviews")
      .select(`
        id,
        level_test_id,
        scheduled_at,
        duration_minutes,
        status
      `)
      .eq(
        "tester_user_id",
        testerUserId
      )
      .neq(
        "level_test_id",
        levelTestId
      )
      .not(
        "status",
        "in",
        '("cancelled","canceled","completed")'
      );

    if (interviewConflictError) {
      return NextResponse.json(
        {
          error:
            interviewConflictError.message,
        },
        { status: 400 }
      );
    }

    const hasInterviewConflict =
      (interviewConflicts || []).some(
        (item) => {
          if (!item.scheduled_at) {
            return false;
          }

          const otherStart =
            new Date(
              item.scheduled_at
            );

          const otherDuration =
            item.duration_minutes || 20;

          const otherEnd =
            new Date(
              otherStart.getTime() +
                otherDuration *
                  60 *
                  1000
            );

          return (
            start < otherEnd &&
            end > otherStart
          );
        }
      );

    if (hasInterviewConflict) {
      return NextResponse.json(
        {
          error:
            "선택한 시간에 해당 강사의 다른 레벨테스트가 이미 예약되어 있습니다.",
        },
        { status: 409 }
      );
    }

    /*
     * 모든 검증 통과 후 저장
     */
    const now =
      new Date().toISOString();

    const {
      data: existingInterview,
      error: existingError,
    } = await admin
      .from("level_test_interviews")
      .select(`
        id,
        status,
        scheduled_at,
        tester_user_id,
        duration_minutes,
        meeting_provider,
        meeting_url,
        created_at
      `)
      .eq(
        "level_test_id",
        levelTestId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          error: existingError.message,
        },
        { status: 400 }
      );
    }

    const interviewPayload = {
      level_test_id: levelTestId,
      tester_user_id:
        testerUserId,
      status: "scheduled",
      scheduled_at:
        start.toISOString(),
      duration_minutes:
        INTERVIEW_DURATION_MINUTES,
      meeting_provider:
        meetingProvider,
      meeting_url:
        meetingUrl,
      updated_at: now,
    };

    if (existingInterview?.id) {
      const { error } = await admin
        .from("level_test_interviews")
        .update(interviewPayload)
        .eq(
          "id",
          existingInterview.id
        );

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
          },
          { status: 400 }
        );
      }
    } else {
      const { error } = await admin
        .from("level_test_interviews")
        .insert({
          ...interviewPayload,
          created_at: now,
        });

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
          },
          { status: 400 }
        );
      }
    }

    const {
      error: levelTestUpdateError,
    } = await admin
      .from("level_tests")
      .update({
        tester_user_id:
          testerUserId,
        scheduled_at:
          start.toISOString(),
        interview_status:
          "scheduled",
        status:
          "interview_scheduled",
        updated_at: now,
      })
      .eq("id", levelTestId);

    if (levelTestUpdateError) {
      return NextResponse.json(
        {
          error:
            levelTestUpdateError.message,
        },
        { status: 400 }
      );
    }

    /*
     * DB 저장 완료 후 이메일 발송 여부 결정
     *
     * - 최초 일정 저장: 발송
     * - 시간/강사/접속정보 변경: 발송
     * - 동일한 내용을 다시 저장: 중복 발송 안 함
     */
    const shouldSendScheduleEmail =
      !existingInterview?.id ||
      existingInterview.scheduled_at !==
        start.toISOString() ||
      existingInterview.tester_user_id !==
        testerUserId ||
      (existingInterview.meeting_provider ??
        null) !== meetingProvider ||
      (existingInterview.meeting_url ??
        null) !== meetingUrl ||
      (existingInterview.duration_minutes ??
        INTERVIEW_DURATION_MINUTES) !==
        INTERVIEW_DURATION_MINUTES;

    let emailStatus:
      | "sent"
      | "skipped"
      | "failed" = "skipped";

    if (shouldSendScheduleEmail) {
      try {
        /*
         * 학부모 신청:
         * parent_user_id의 이메일로 발송
         *
         * 직접 학생 신청:
         * student_user_id의 이메일로 발송
         */
        const recipientUserId =
          levelTest.parent_user_id ||
          levelTest.student_user_id ||
          null;

        if (!recipientUserId) {
          throw new Error(
            "일정 안내 이메일 수신자 계정을 확인할 수 없습니다."
          );
        }

        const {
          data: recipientProfile,
          error: recipientProfileError,
        } = await admin
          .from("profiles")
          .select(
            "id, name, email"
          )
          .eq(
            "id",
            recipientUserId
          )
          .maybeSingle();

        if (recipientProfileError) {
          throw recipientProfileError;
        }

        const recipientEmail =
          recipientProfile?.email?.trim() ||
          "";

        if (!recipientEmail) {
          throw new Error(
            "일정 안내 이메일 주소를 확인할 수 없습니다."
          );
        }

        /*
         * 학생 이름
         *
         * 학부모 자녀:
         * children.name
         *
         * 직접 가입 학생:
         * profiles.name
         */
        let studentName = "학생";

        if (levelTest.child_id) {
          const {
            data: child,
            error: childError,
          } = await admin
            .from("children")
            .select("name")
            .eq(
              "id",
              levelTest.child_id
            )
            .maybeSingle();

          if (childError) {
            throw childError;
          }

          studentName =
            child?.name?.trim() ||
            "학생";
        } else if (
          levelTest.student_user_id
        ) {
          const {
            data: studentProfile,
            error: studentProfileError,
          } = await admin
            .from("profiles")
            .select("name")
            .eq(
              "id",
              levelTest.student_user_id
            )
            .maybeSingle();

          if (studentProfileError) {
            throw studentProfileError;
          }

          studentName =
            studentProfile?.name?.trim() ||
            "학생";
        }

        const isReschedule =
          Boolean(
            existingInterview?.id
          );

        const scheduleLabel =
          formatSeoulSchedule(start);

        const teacherName =
          teacher.display_name?.trim() ||
          "TALKLY Teacher";

        const safeStudentName =
          escapeHtml(studentName);

        const safeTeacherName =
          escapeHtml(teacherName);

        const safeScheduleLabel =
          escapeHtml(scheduleLabel);

        const safeMeetingUrl =
          meetingUrl
            ? escapeHtml(meetingUrl)
            : null;

        const subject =
          isReschedule
            ? `[TALKLY] ${studentName} 학생 원어민 화상 레벨테스트 일정 변경 안내`
            : `[TALKLY] ${studentName} 학생 원어민 화상 레벨테스트 일정 확정 안내`;

        const accessHtml =
          safeMeetingUrl
            ? `
              <a
                href="${safeMeetingUrl}"
                style="
                  display:inline-block;
                  padding:12px 18px;
                  border-radius:8px;
                  background:#0a1f44;
                  color:#ffffff;
                  text-decoration:none;
                  font-weight:700;
                "
              >
                화상 레벨테스트 접속하기
              </a>

              <p
                style="
                  margin:12px 0 0;
                  color:#667085;
                  font-size:13px;
                  word-break:break-all;
                "
              >
                ${safeMeetingUrl}
              </p>
            `
            : `
              <p
                style="
                  margin:0;
                  color:#475467;
                "
              >
                화상 접속 정보는 TALKLY에서 별도로 안내드리겠습니다.
              </p>
            `;

        const accessText =
          meetingUrl
            ? `화상 접속 링크: ${meetingUrl}`
            : "화상 접속 정보는 TALKLY에서 별도로 안내드리겠습니다.";

        await sendEmail({
          to: recipientEmail,
          subject,

          html: `
            <div
              style="
                margin:0;
                padding:32px 16px;
                background:#f6f8fb;
                font-family:Arial,'Noto Sans KR',sans-serif;
                color:#172033;
              "
            >
              <div
                style="
                  max-width:620px;
                  margin:0 auto;
                  background:#ffffff;
                  border:1px solid #e5eaf1;
                  border-radius:14px;
                  overflow:hidden;
                "
              >
                <div
                  style="
                    padding:24px 28px;
                    background:#0a1f44;
                    color:#ffffff;
                  "
                >
                  <div
                    style="
                      font-size:24px;
                      font-weight:800;
                    "
                  >
                    TALKLY
                  </div>

                  <div
                    style="
                      margin-top:6px;
                      font-size:14px;
                      opacity:0.88;
                    "
                  >
                    원어민 화상 레벨테스트 ${
                      isReschedule
                        ? "일정 변경"
                        : "일정 확정"
                    } 안내
                  </div>
                </div>

                <div
                  style="
                    padding:28px;
                  "
                >
                  <p
                    style="
                      margin:0 0 20px;
                      line-height:1.7;
                    "
                  >
                    안녕하세요.<br />
                    <strong>
                      ${safeStudentName}
                    </strong>
                    학생의 원어민 화상 레벨테스트 ${
                      isReschedule
                        ? "일정이 변경되었습니다."
                        : "일정이 확정되었습니다."
                    }
                  </p>

                  <table
                    style="
                      width:100%;
                      border-collapse:collapse;
                      margin:0 0 24px;
                      font-size:14px;
                    "
                  >
                    <tbody>
                      <tr>
                        <td
                          style="
                            width:120px;
                            padding:11px 12px;
                            background:#f8fafc;
                            border-bottom:1px solid #e5eaf1;
                            font-weight:700;
                          "
                        >
                          학생
                        </td>

                        <td
                          style="
                            padding:11px 12px;
                            border-bottom:1px solid #e5eaf1;
                          "
                        >
                          ${safeStudentName}
                        </td>
                      </tr>

                      <tr>
                        <td
                          style="
                            padding:11px 12px;
                            background:#f8fafc;
                            border-bottom:1px solid #e5eaf1;
                            font-weight:700;
                          "
                        >
                          일시
                        </td>

                        <td
                          style="
                            padding:11px 12px;
                            border-bottom:1px solid #e5eaf1;
                          "
                        >
                          ${safeScheduleLabel}
                        </td>
                      </tr>

                      <tr>
                        <td
                          style="
                            padding:11px 12px;
                            background:#f8fafc;
                            border-bottom:1px solid #e5eaf1;
                            font-weight:700;
                          "
                        >
                          소요시간
                        </td>

                        <td
                          style="
                            padding:11px 12px;
                            border-bottom:1px solid #e5eaf1;
                          "
                        >
                          약 ${INTERVIEW_DURATION_MINUTES}분
                        </td>
                      </tr>

                      <tr>
                        <td
                          style="
                            padding:11px 12px;
                            background:#f8fafc;
                            border-bottom:1px solid #e5eaf1;
                            font-weight:700;
                          "
                        >
                          담당 강사
                        </td>

                        <td
                          style="
                            padding:11px 12px;
                            border-bottom:1px solid #e5eaf1;
                          "
                        >
                          ${safeTeacherName}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div
                    style="
                      padding:18px;
                      border-radius:10px;
                      background:#f8fafc;
                    "
                  >
                    ${accessHtml}
                  </div>

                  <p
                    style="
                      margin:24px 0 0;
                      color:#667085;
                      font-size:13px;
                      line-height:1.7;
                    "
                  >
                    테스트 시작 전 인터넷 연결과
                    카메라·마이크 상태를 확인해주세요.
                    <br />
                    감사합니다.
                    <br />
                    TALKLY
                  </p>
                </div>
              </div>
            </div>
          `,

          text: [
            "TALKLY 원어민 화상 레벨테스트 안내",
            `학생: ${studentName}`,
            `일시: ${scheduleLabel}`,
            `소요시간: 약 ${INTERVIEW_DURATION_MINUTES}분`,
            `담당 강사: ${teacherName}`,
            accessText,
          ].join("\n"),
        });

        emailStatus = "sent";
      } catch (emailError) {
        /*
         * 이메일 실패 때문에 이미 저장된
         * 레벨테스트 일정을 되돌리지 않습니다.
         */
        emailStatus = "failed";

        console.error(
          "LEVEL TEST INTERVIEW SCHEDULE EMAIL ERROR:",
          emailError instanceof Error
            ? emailError.message
            : emailError
        );
      }
    }

    return NextResponse.json({
      ok: true,

      message:
        emailStatus === "failed"
          ? "원어민 화상 레벨테스트 일정은 저장되었지만 안내 이메일 발송에 실패했습니다."
          : "원어민 화상 레벨테스트 일정이 저장되었습니다.",

      scheduledAt:
        start.toISOString(),

      durationMinutes:
        INTERVIEW_DURATION_MINUTES,

      emailStatus,

      teacher: {
        userId:
          teacher.user_id,

        displayName:
          teacher.display_name,
      },
    });
  } catch (error) {
    console.error(
      "LEVEL TEST INTERVIEW SCHEDULE API ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "원어민 테스트 일정 저장 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

function formatSeoulSchedule(
  date: Date
) {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone:
        SEOUL_TIME_ZONE,

      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(date);
}

function escapeHtml(
  value: string
) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function pad(value: number) {
  return String(value).padStart(
    2,
    "0"
  );
}

function getSeoulDateParts(
  date: Date
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          SEOUL_TIME_ZONE,

        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    );

  const parts =
    formatter.formatToParts(
      date
    );

  const map =
    Object.fromEntries(
      parts.map((part) => [
        part.type,
        part.value,
      ])
    );

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function getSeoulDayOfWeek(
  date: Date
) {
  const weekday =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          SEOUL_TIME_ZONE,

        weekday: "short",
      }
    ).format(date);

  const map: Record<
    string,
    number
  > = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return map[weekday];
}

function timeToMinutes(
  value: string
) {
  const [hour, minute] =
    value.split(":");

  return (
    Number(hour) * 60 +
    Number(minute)
  );
}

function timeRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
) {
  const aStart =
    timeToMinutes(startA);

  const aEnd =
    timeToMinutes(endA);

  const bStart =
    timeToMinutes(startB);

  const bEnd =
    timeToMinutes(endB);

  return (
    aStart < bEnd &&
    aEnd > bStart
  );
}