import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import ZoomConnectButton from "./ZoomConnectButton";
import MakeupLessonForm from "./MakeupLessonForm";

type PageProps = {
  params: Promise<{
    id: string;
    lessonId: string;
  }>;
};

function getStatusLabel(
  status: string
) {
  switch (status) {
    case "scheduled":
      return "예정";

    case "in_progress":
      return "수업 진행 중";

    case "completed":
      return "수업 완료";

    case "cancelled":
      return "수업 취소";

    case "no_show":
      return "결석";

    case "held":
      return "수업 연기";

    case "not_held":
      return "미진행";

    default:
      return status;
  }
}

function getStatusDescription(
  status: string
) {
  switch (status) {
    case "scheduled":
      return "아직 시작되지 않은 예정 수업입니다.";

    case "in_progress":
      return "현재 진행 중인 수업입니다.";

    case "completed":
      return "정상적으로 완료된 수업입니다.";

    case "no_show":
      return "결석으로 처리된 수업입니다.";

    case "held":
      return "수업 연기로 처리된 원래 수업입니다.";

    case "cancelled":
      return "취소된 수업입니다.";

    case "not_held":
      return "예정된 종료시간까지 시작되지 않아 미진행으로 마감된 수업입니다.";

    default:
      return "수업 상태를 확인해주세요.";
  }
}

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(new Date(value));
}

function getDurationMinutes(
  start: string,
  end: string
) {
  return Math.round(
    (new Date(end).getTime() -
      new Date(start).getTime()) /
      60000
  );
}

export default async function LessonDetailPage({
  params,
}: PageProps) {
  const { id, lessonId } =
    await params;

  const enrollmentId =
    Number(id);

  const classSessionId =
    Number(lessonId);

  if (
    !Number.isInteger(
      enrollmentId
    ) ||
    enrollmentId <= 0 ||
    !Number.isInteger(
      classSessionId
    ) ||
    classSessionId <= 0
  ) {
    notFound();
  }

  const supabase =
    await createClient();

  /*
   * =========================================================
   * 관리자 확인
   * =========================================================
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
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      profileError.message
    );
  }

  if (
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  /*
   * =========================================================
   * 수업 조회
   * =========================================================
   */
  const {
    data: sessionData,
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
      teacher_notes,
      created_at,
      updated_at,
      started_at,
      ended_at,
      session_kind,
      makeup_for_session_id,
      makeup_reason
    `)
    .eq(
      "id",
      classSessionId
    )
    .eq(
      "enrollment_id",
      enrollmentId
    )
    .maybeSingle();

  if (sessionError) {
    throw new Error(
      sessionError.message
    );
  }

  if (!sessionData) {
    notFound();
  }

  /*
   * =========================================================
   * 만료된 미시작 scheduled 수업 즉시 마감
   *
   * 관리자 상세페이지에 들어왔을 때도
   * scheduled_end가 지났고 시작된 적이 없다면
   * not_held로 저장합니다.
   * =========================================================
   */
  let session = sessionData;

  const now = new Date();

  const scheduledEnd =
    new Date(
      session.scheduled_end
    );

  const shouldCloseAsNotHeld =
    session.status ===
      "scheduled" &&
    !session.started_at &&
    !session.ended_at &&
    !Number.isNaN(
      scheduledEnd.getTime()
    ) &&
    scheduledEnd.getTime() <=
      now.getTime();

  if (shouldCloseAsNotHeld) {
    const {
      data: closedSession,
      error: closeError,
    } = await supabase
      .from("class_sessions")
      .update({
        status: "not_held",
        updated_at:
          now.toISOString(),
      })
      .eq(
        "id",
        session.id
      )
      .eq(
        "status",
        "scheduled"
      )
      .is(
        "started_at",
        null
      )
      .lte(
        "scheduled_end",
        now.toISOString()
      )
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
        teacher_notes,
        created_at,
        updated_at,
        started_at,
        ended_at,
        session_kind,
        makeup_for_session_id,
        makeup_reason
      `)
      .maybeSingle();

    if (closeError) {
      throw new Error(
        closeError.message
      );
    }

    if (closedSession) {
      session =
        closedSession;
    } else {
      /*
       * 다른 요청이 동시에 상태를 변경했을 수 있으므로
       * 최신 상태를 다시 읽습니다.
       */
      const {
        data: latestSession,
        error: latestError,
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
          teacher_notes,
          created_at,
          updated_at,
          started_at,
          ended_at,
          session_kind,
          makeup_for_session_id,
          makeup_reason
        `)
        .eq(
          "id",
          classSessionId
        )
        .eq(
          "enrollment_id",
          enrollmentId
        )
        .maybeSingle();

      if (latestError) {
        throw new Error(
          latestError.message
        );
      }

      if (!latestSession) {
        notFound();
      }

      session =
        latestSession;
    }
  }

  /*
   * =========================================================
   * 수강정보
   * =========================================================
   */
  const {
    data: enrollment,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(`
      id,
      student_user_id,
      child_id,
      course_id,
      teacher_user_id,
      end_date
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
   * =========================================================
   * 학생
   * =========================================================
   */
  let studentName =
    "학생 정보 없음";

  if (enrollment.child_id) {
    const {
      data: child,
      error: childError,
    } = await supabase
      .from("children")
      .select("name")
      .eq(
        "id",
        enrollment.child_id
      )
      .maybeSingle();

    if (childError) {
      throw new Error(
        childError.message
      );
    }

    if (child?.name) {
      studentName =
        child.name;
    }
  } else if (
    enrollment.student_user_id
  ) {
    const {
      data: student,
      error: studentError,
    } = await supabase
      .from("profiles")
      .select("name")
      .eq(
        "id",
        enrollment.student_user_id
      )
      .maybeSingle();

    if (studentError) {
      throw new Error(
        studentError.message
      );
    }

    studentName =
      student?.name ||
      "성인 학생";
  }

  /*
   * =========================================================
   * 과정
   * =========================================================
   */
  const {
    data: course,
    error: courseError,
  } = await supabase
    .from("courses")
    .select("name")
    .eq(
      "id",
      enrollment.course_id
    )
    .maybeSingle();

  if (courseError) {
    throw new Error(
      courseError.message
    );
  }

  /*
   * =========================================================
   * 강사
   * =========================================================
   */
  let teacherName =
    "미배정";

  if (
    enrollment.teacher_user_id
  ) {
    const {
      data: teacher,
      error: teacherError,
    } = await supabase
      .from("teacher_profiles")
      .select("display_name")
      .eq(
        "user_id",
        enrollment.teacher_user_id
      )
      .maybeSingle();

    if (teacherError) {
      throw new Error(
        teacherError.message
      );
    }

    if (
      teacher?.display_name
    ) {
      teacherName =
        teacher.display_name;
    }
  }

  /*
   * =========================================================
   * 보강수업이면 원본 수업 정보 조회
   * =========================================================
   */
  let originalSession:
    | {
        id: number;
        lesson_number: number;
        scheduled_start: string;
        scheduled_end: string;
        status: string;
      }
    | null = null;

  if (
    session.session_kind ===
      "makeup" &&
    session.makeup_for_session_id
  ) {
    const {
      data: original,
      error: originalError,
    } = await supabase
      .from("class_sessions")
      .select(`
        id,
        lesson_number,
        scheduled_start,
        scheduled_end,
        status
      `)
      .eq(
        "id",
        session.makeup_for_session_id
      )
      .maybeSingle();

    if (originalError) {
      throw new Error(
        originalError.message
      );
    }

    originalSession =
      original ?? null;
  }

  /*
   * =========================================================
   * 정규수업이면 연결된 보강수업 조회
   *
   * 원본 수업 상세에서 이미 생성된 보강수업이 있는지
   * 확인하고 중복 생성 대신 기존 보강수업으로 이동할 수
   * 있도록 합니다.
   * =========================================================
   */
  let linkedMakeupSessions:
    | {
        id: number;
        lesson_number: number;
        scheduled_start: string;
        scheduled_end: string;
        status: string;
        makeup_reason: string | null;
      }[]
    = [];

  if (
    session.session_kind ===
    "regular"
  ) {
    const {
      data: makeupRows,
      error: makeupRowsError,
    } = await supabase
      .from("class_sessions")
      .select(`
        id,
        lesson_number,
        scheduled_start,
        scheduled_end,
        status,
        makeup_reason
      `)
      .eq(
        "enrollment_id",
        enrollment.id
      )
      .eq(
        "session_kind",
        "makeup"
      )
      .eq(
        "makeup_for_session_id",
        session.id
      )
      .order(
        "scheduled_start",
        {
          ascending: false,
        }
      );

    if (makeupRowsError) {
      throw new Error(
        makeupRowsError.message
      );
    }

    linkedMakeupSessions =
      makeupRows ?? [];
  }

  /*
   * =========================================================
   * 화면 정책
   * =========================================================
   */
  const hasZoomMeeting =
    Boolean(
      session.meeting_id ||
        session.meeting_url
    );

  /*
   * 실제 수업 입장은 예정/진행 중에만 허용합니다.
   *
   * completed / no_show / held / cancelled / not_held
   * 등의 과거 기록에서는 링크를 노출하지 않습니다.
   */
  const canEnterClassroom =
    (session.status ===
      "scheduled" ||
      session.status ===
        "in_progress") &&
    Boolean(
      session.meeting_id
    );

  /*
   * Zoom 신규 연결은 scheduled 상태이며
   * 기존 Meeting이 없고 강사가 배정된 경우만 가능합니다.
   */
  const canConnectZoom =
    session.status ===
      "scheduled" &&
    !hasZoomMeeting &&
    Boolean(
      enrollment.teacher_user_id
    );

  /*
   * 미래 scheduled 수업만 원본 일정 수정 가능.
   *
   * 다른 상태에서도 상세 수정 화면으로 가면
   * 메모는 수정할 수 있으므로 버튼 문구를 구분합니다.
   */
  const canEditSchedule =
    session.status ===
    "scheduled";

  const isMakeup =
    session.session_kind ===
    "makeup";

  /*
   * 보강 생성 대상:
   * - 정규수업만
   * - 수업 연기 / 수업 취소 / 미진행
   *
   * 학생 결석(no_show)은 기본 보강 대상에서 제외합니다.
   */
  const canCreateMakeup =
    !isMakeup &&
    (
      session.status ===
        "held" ||
      session.status ===
        "cancelled" ||
      session.status ===
        "not_held"
    );

  /*
   * scheduled / in_progress / completed 보강이 이미 존재하면
   * 새 보강을 생성하지 않고 기존 보강을 보여줍니다.
   *
   * cancelled / not_held 보강만 존재하는 경우에는
   * 새 보강을 다시 생성할 수 있습니다.
   */
  const blockingMakeup =
    linkedMakeupSessions.find(
      (makeup) =>
        makeup.status ===
          "scheduled" ||
        makeup.status ===
          "in_progress" ||
        makeup.status ===
          "completed"
    ) ?? null;

  const showMakeupCreateForm =
    canCreateMakeup &&
    !blockingMakeup;

  return (
    <main
      style={{
        padding: "40px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <Link
        href={`/admin/enrollments/${enrollment.id}`}
        style={{
          textDecoration:
            "none",
        }}
      >
        ← 수강 상세
      </Link>

      {/* =====================================================
          제목
          ===================================================== */}
      <div
        style={{
          marginTop: "32px",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom:
                "8px",
            }}
          >
            <h1
              style={{
                margin: 0,
              }}
            >
              {session.lesson_number}
              회차{" "}
              {isMakeup
                ? "보강수업"
                : "수업"}
            </h1>

            {isMakeup && (
              <span
                style={{
                  padding:
                    "5px 10px",
                  border:
                    "1px solid #2563eb",
                  borderRadius:
                    "999px",
                  color:
                    "#2563eb",
                  fontSize:
                    "13px",
                  fontWeight: 700,
                }}
              >
                보강
              </span>
            )}
          </div>

          <p
            style={{
              margin: 0,
            }}
          >
            {studentName} 학생의
            개별 수업정보입니다.
          </p>
        </div>

        <Link
          href={`/admin/enrollments/${enrollment.id}/lessons/${session.id}/edit`}
          style={{
            padding:
              "12px 18px",
            border:
              "1px solid #ddd",
            borderRadius:
              "8px",
            textDecoration:
              "none",
            fontWeight: 700,
            whiteSpace:
              "nowrap",
          }}
        >
          {canEditSchedule
            ? "수업정보 수정"
            : "관리 메모 수정"}
        </Link>
      </div>

      {/* =====================================================
          상태
          ===================================================== */}
      <div
        style={{
          marginTop: "28px",
          padding: "20px",
          border:
            session.status ===
            "not_held"
              ? "1px solid #999"
              : "1px solid #ddd",
          borderRadius:
            "12px",
          background:
            session.status ===
            "not_held"
              ? "#f7f7f7"
              : "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems:
              "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <strong>
            수업 상태
          </strong>

          <span
            style={{
              padding:
                "5px 10px",
              border:
                "1px solid #ccc",
              borderRadius:
                "999px",
              fontWeight: 700,
            }}
          >
            {getStatusLabel(
              session.status
            )}
          </span>
        </div>

        <p
          style={{
            margin:
              "10px 0 0",
            lineHeight: 1.6,
          }}
        >
          {getStatusDescription(
            session.status
          )}
        </p>

        {session.status ===
          "not_held" && (
          <p
            style={{
              margin:
                "10px 0 0",
              lineHeight: 1.6,
              fontWeight: 700,
            }}
          >
            이 원래 수업의 날짜나
            시간을 변경하여 다시
            사용하지 않습니다. 보강이
            필요한 경우 새로운
            보강수업을 생성합니다.
          </p>
        )}
      </div>

      {/* =====================================================
          기본정보
          ===================================================== */}
      <div
        style={{
          marginTop: "24px",
          padding: "28px",
          border:
            "1px solid #ddd",
          borderRadius:
            "12px",
        }}
      >
        <h2
          style={{
            marginTop: 0,
          }}
        >
          수업 기본정보
        </h2>

        <p>
          <strong>
            학생:
          </strong>{" "}
          {studentName}
        </p>

        <p>
          <strong>
            과정:
          </strong>{" "}
          {course?.name ||
            "-"}
        </p>

        <p>
          <strong>
            담당 강사:
          </strong>{" "}
          {teacherName}
        </p>

        <p>
          <strong>
            수업 구분:
          </strong>{" "}
          {isMakeup
            ? "보강수업"
            : "정규수업"}
        </p>

        <p>
          <strong>
            회차:
          </strong>{" "}
          {session.lesson_number}
          회차
        </p>

        <p>
          <strong>
            수업 시작:
          </strong>{" "}
          {formatDateTime(
            session.scheduled_start
          )}
        </p>

        <p>
          <strong>
            수업 종료:
          </strong>{" "}
          {formatDateTime(
            session.scheduled_end
          )}
        </p>

        <p>
          <strong>
            수업시간:
          </strong>{" "}
          {getDurationMinutes(
            session.scheduled_start,
            session.scheduled_end
          )}
          분
        </p>

        <p>
          <strong>
            수업 상태:
          </strong>{" "}
          {getStatusLabel(
            session.status
          )}
        </p>

        <p>
          <strong>
            수업 플랫폼:
          </strong>{" "}
          {session.meeting_provider ||
            "-"}
        </p>

        <p>
          <strong>
            Zoom Meeting ID:
          </strong>{" "}
          {session.meeting_id ||
            "아직 등록되지 않음"}
        </p>

        {session.started_at && (
          <p>
            <strong>
              실제 시작:
            </strong>{" "}
            {formatDateTime(
              session.started_at
            )}
          </p>
        )}

        {session.ended_at && (
          <p>
            <strong>
              실제 종료:
            </strong>{" "}
            {formatDateTime(
              session.ended_at
            )}
          </p>
        )}

        <p
          style={{
            marginBottom: 0,
          }}
        >
          <strong>
            TALKLY 수업실:
          </strong>{" "}

          {canEnterClassroom ? (
            <Link
              href={`/classroom/${session.id}`}
              style={{
                fontWeight: 700,
                textDecoration:
                  "underline",
              }}
            >
              TALKLY 수업 입장
            </Link>
          ) : session.status ===
              "scheduled" &&
            !session.meeting_id ? (
            "Zoom 회의가 아직 연결되지 않았습니다."
          ) : session.status ===
              "in_progress" &&
            !session.meeting_id ? (
            "Zoom Meeting ID가 없어 TALKLY 수업실에 입장할 수 없습니다."
          ) : (
            "현재 상태에서는 수업실에 입장할 수 없습니다."
          )}
        </p>
      </div>

      {/* =====================================================
          보강 원본 수업
          ===================================================== */}
      {isMakeup && (
        <div
          style={{
            marginTop:
              "24px",
            padding: "28px",
            border:
              "1px solid #2563eb",
            borderRadius:
              "12px",
          }}
        >
          <h2
            style={{
              marginTop: 0,
            }}
          >
            보강 원본 수업
          </h2>

          {originalSession ? (
            <>
              <p>
                <strong>
                  원본 회차:
                </strong>{" "}
                {
                  originalSession.lesson_number
                }
                회차
              </p>

              <p>
                <strong>
                  원본 일정:
                </strong>{" "}
                {formatDateTime(
                  originalSession.scheduled_start
                )}
              </p>

              <p>
                <strong>
                  원본 상태:
                </strong>{" "}
                {getStatusLabel(
                  originalSession.status
                )}
              </p>

              {session.makeup_reason && (
                <p>
                  <strong>
                    보강 사유:
                  </strong>{" "}
                  {
                    session.makeup_reason
                  }
                </p>
              )}

              <Link
                href={`/admin/enrollments/${enrollment.id}/lessons/${originalSession.id}`}
                style={{
                  fontWeight: 700,
                  textDecoration:
                    "underline",
                }}
              >
                원본 수업 상세 보기
              </Link>
            </>
          ) : (
            <p
              style={{
                marginBottom: 0,
              }}
            >
              연결된 원본 수업정보를
              확인할 수 없습니다.
            </p>
          )}
        </div>
      )}

      {/* =====================================================
          보강수업 관리
          ===================================================== */}
      {!isMakeup &&
        canCreateMakeup && (
          <div
            style={{
              marginTop: "24px",
              padding: "28px",
              border:
                "1px solid #2563eb",
              borderRadius:
                "12px",
              background:
                "#f8fbff",
            }}
          >
            <h2
              style={{
                marginTop: 0,
              }}
            >
              보강수업 관리
            </h2>

            <p
              style={{
                lineHeight: 1.6,
              }}
            >
              원본 수업은 그대로
              보존합니다. 보강이
              필요한 경우 이 원본
              수업과 연결된 별도의
              보강수업을 생성합니다.
            </p>

            {linkedMakeupSessions.length >
              0 && (
              <div
                style={{
                  marginTop:
                    "18px",
                  marginBottom:
                    "22px",
                  padding:
                    "18px",
                  border:
                    "1px solid #dbeafe",
                  borderRadius:
                    "10px",
                  background:
                    "#fff",
                }}
              >
                <strong>
                  기존 보강수업
                </strong>

                <div
                  style={{
                    marginTop:
                      "12px",
                    display:
                      "flex",
                    flexDirection:
                      "column",
                    gap: "12px",
                  }}
                >
                  {linkedMakeupSessions.map(
                    (makeup) => (
                      <div
                        key={
                          makeup.id
                        }
                        style={{
                          padding:
                            "14px",
                          border:
                            "1px solid #e5e7eb",
                          borderRadius:
                            "8px",
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            alignItems:
                              "center",
                            gap:
                              "12px",
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <div>
                            <strong>
                              {
                                makeup.lesson_number
                              }
                              회차
                              보강
                            </strong>

                            <div
                              style={{
                                marginTop:
                                  "5px",
                                fontSize:
                                  "14px",
                                lineHeight:
                                  1.5,
                              }}
                            >
                              {formatDateTime(
                                makeup.scheduled_start
                              )}
                              {" · "}
                              {getStatusLabel(
                                makeup.status
                              )}
                            </div>

                            {makeup.makeup_reason && (
                              <div
                                style={{
                                  marginTop:
                                    "5px",
                                  fontSize:
                                    "14px",
                                  color:
                                    "#555",
                                }}
                              >
                                사유:{" "}
                                {
                                  makeup.makeup_reason
                                }
                              </div>
                            )}
                          </div>

                          <Link
                            href={`/admin/enrollments/${enrollment.id}/lessons/${makeup.id}`}
                            style={{
                              fontWeight:
                                700,
                              textDecoration:
                                "underline",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            보강수업
                            상세 보기
                          </Link>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {blockingMakeup ? (
              <div
                style={{
                  padding:
                    "16px",
                  border:
                    "1px solid #2563eb",
                  borderRadius:
                    "8px",
                  background:
                    "#fff",
                  lineHeight:
                    1.6,
                }}
              >
                <strong>
                  이 원본 수업에는
                  이미 유효한
                  보강수업이
                  있습니다.
                </strong>

                <p
                  style={{
                    margin:
                      "8px 0 12px",
                  }}
                >
                  중복 보강은
                  생성하지 않습니다.
                  기존 보강수업을
                  확인해주세요.
                </p>

                <Link
                  href={`/admin/enrollments/${enrollment.id}/lessons/${blockingMakeup.id}`}
                  style={{
                    fontWeight:
                      700,
                    textDecoration:
                      "underline",
                  }}
                >
                  기존 보강수업
                  상세 보기
                </Link>
              </div>
            ) : showMakeupCreateForm ? (
              <MakeupLessonForm
                enrollmentId={
                  enrollment.id
                }
                originalSessionId={
                  session.id
                }
                lessonNumber={
                  session.lesson_number
                }
                originalScheduledStart={
                  session.scheduled_start
                }
                originalScheduledEnd={
                  session.scheduled_end
                }
                enrollmentEndDate={
                  enrollment.end_date
                }
              />
            ) : null}
          </div>
        )}

      {/* =====================================================
          Zoom 연결
          ===================================================== */}
      <div
        style={{
          marginTop: "24px",
          padding: "28px",
          border:
            "1px solid #ddd",
          borderRadius:
            "12px",
        }}
      >
        <h2
          style={{
            marginTop: 0,
          }}
        >
          Zoom 연결
        </h2>

        {hasZoomMeeting ? (
          <>
            <strong>
              Zoom 회의가 이미
              연결되어 있습니다.
            </strong>

            <p
              style={{
                marginBottom: 0,
                marginTop: "8px",
              }}
            >
              이 수업에는 새 Zoom
              회의를 중복 생성하지
              않습니다.
            </p>

            {!canEnterClassroom &&
              session.status !==
                "scheduled" &&
              session.status !==
                "in_progress" && (
                <p
                  style={{
                    marginBottom: 0,
                    marginTop:
                      "8px",
                    fontWeight:
                      700,
                  }}
                >
                  기존 Zoom 정보는
                  과거 수업 기록으로
                  보존되지만 현재
                  상태에서는 수업
                  입장에 사용하지
                  않습니다.
                </p>
              )}
          </>
        ) : (
          <>
            <p>
              이 버튼은 현재 수업
              1건에만 Zoom 회의를
              생성합니다. 다른
              회차에는 영향을 주지
              않습니다.
            </p>

            {!enrollment.teacher_user_id && (
              <p>
                담당 강사가 배정되지
                않아 Zoom을 연결할
                수 없습니다.
              </p>
            )}

            {session.status !==
              "scheduled" && (
              <p>
                예정 상태의 수업에만
                Zoom을 연결할 수
                있습니다.
              </p>
            )}

            <ZoomConnectButton
              sessionId={
                session.id
              }
              disabled={
                !canConnectZoom
              }
            />
          </>
        )}
      </div>

      {/* =====================================================
          메모
          ===================================================== */}
      <div
        style={{
          marginTop: "24px",
          padding: "28px",
          border:
            "1px solid #ddd",
          borderRadius:
            "12px",
        }}
      >
        <h2
          style={{
            marginTop: 0,
          }}
        >
          강사 / 관리자 메모
        </h2>

        <p
          style={{
            whiteSpace:
              "pre-wrap",
            marginBottom: 0,
          }}
        >
          {session.teacher_notes ||
            "등록된 메모가 없습니다."}
        </p>
      </div>
    </main>
  );
}