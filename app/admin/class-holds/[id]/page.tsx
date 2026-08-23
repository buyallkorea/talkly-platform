import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import ClassHoldReviewForm from "./ClassHoldReviewForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type HoldRow = {
  id: number;
  class_session_id: number;
  requested_by: string;
  reason: string | null;
  requested_at: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_note: string | null;
};

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return "-";
  }

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
  ).format(
    new Date(value)
  );
}

function getSessionStatusLabel(
  status: string
) {
  switch (status) {
    case "scheduled":
      return "예정";

    case "in_progress":
      return "수업 진행 중";

    case "completed":
      return "완료";

    case "held":
      return "수업 연기";

    case "no_show":
      return "결석";

    case "cancelled":
      return "수업 취소";

    default:
      return status;
  }
}

function getHoldStatusLabel(
  status: string,
  automaticApproval: boolean
) {
  switch (status) {
    case "approved":
      return automaticApproval
        ? "자동 승인"
        : "이전 수동 승인";

    case "requested":
      return "이전 승인 대기";

    case "rejected":
      return "이전 반려";

    case "cancelled":
      return "연기 취소";

    default:
      return status;
  }
}

export default async function AdminClassHoldDetailPage({
  params,
}: PageProps) {
  const {
    id,
  } = await params;

  const holdId =
    Number(id);

  if (
    !Number.isInteger(
      holdId
    ) ||
    holdId <= 0
  ) {
    notFound();
  }

  const supabase =
    await createClient();

  /*
   * ==========================================
   * 관리자 인증
   * ==========================================
   */

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data:
      adminProfile,
    error:
      adminProfileError,
  } =
    await supabase
      .from("profiles")
      .select(
        "role, name"
      )
      .eq(
        "id",
        user.id
      )
      .maybeSingle();

  if (
    adminProfileError ||
    !adminProfile ||
    adminProfile.role !==
      "admin"
  ) {
    redirect("/");
  }

  /*
   * ==========================================
   * 수업 연기 내역
   * ==========================================
   */

  const {
    data:
      holdData,
    error:
      holdError,
  } =
    await supabase
      .from(
        "class_holds"
      )
      .select(`
        id,
        class_session_id,
        requested_by,
        reason,
        requested_at,
        status,
        reviewed_by,
        reviewed_at,
        admin_note
      `)
      .eq(
        "id",
        holdId
      )
      .maybeSingle();

  if (holdError) {
    throw new Error(
      holdError.message
    );
  }

  if (!holdData) {
    notFound();
  }

  const hold =
    holdData as HoldRow;

  /*
   * ==========================================
   * 대상 수업
   * ==========================================
   */

  const {
    data:
      session,
    error:
      sessionError,
  } =
    await supabase
      .from(
        "class_sessions"
      )
      .select(`
        id,
        enrollment_id,
        lesson_number,
        scheduled_start,
        scheduled_end,
        status
      `)
      .eq(
        "id",
        hold.class_session_id
      )
      .maybeSingle();

  if (sessionError) {
    throw new Error(
      sessionError.message
    );
  }

  /*
   * ==========================================
   * 신청자
   * ==========================================
   */

  const {
    data:
      requester,
    error:
      requesterError,
  } =
    await supabase
      .from(
        "profiles"
      )
      .select(`
        id,
        name,
        role
      `)
      .eq(
        "id",
        hold.requested_by
      )
      .maybeSingle();

  if (
    requesterError
  ) {
    throw new Error(
      requesterError.message
    );
  }

  /*
   * ==========================================
   * 수강정보
   * ==========================================
   */

  let enrollment:
    | {
        id: number;
        child_id:
          | number
          | null;
        student_user_id:
          | string
          | null;
        course_id: number;
        teacher_user_id:
          | string
          | null;
      }
    | null = null;

  if (session) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "enrollments"
        )
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

    if (error) {
      throw new Error(
        error.message
      );
    }

    enrollment =
      data;
  }

  /*
   * ==========================================
   * 학생명
   * ==========================================
   */

  let studentName =
    "학생 정보 없음";

  if (
    enrollment?.child_id
  ) {
    const {
      data:
        child,
      error:
        childError,
    } =
      await supabase
        .from(
          "children"
        )
        .select(
          "id, name"
        )
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
    enrollment
      ?.student_user_id
  ) {
    const {
      data:
        studentProfile,
      error:
        studentProfileError,
    } =
      await supabase
        .from(
          "profiles"
        )
        .select(
          "id, name"
        )
        .eq(
          "id",
          enrollment.student_user_id
        )
        .maybeSingle();

    if (
      studentProfileError
    ) {
      throw new Error(
        studentProfileError.message
      );
    }

    studentName =
      studentProfile?.name ||
      "성인 학생";
  }

  /*
   * ==========================================
   * 과정
   * ==========================================
   */

  let courseName =
    "-";

  if (
    enrollment?.course_id
  ) {
    const {
      data:
        course,
      error:
        courseError,
    } =
      await supabase
        .from(
          "courses"
        )
        .select(
          "id, name"
        )
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

    if (course?.name) {
      courseName =
        course.name;
    }
  }

  /*
   * ==========================================
   * 강사
   * ==========================================
   */

  let teacherName =
    "미배정";

  if (
    enrollment
      ?.teacher_user_id
  ) {
    const {
      data:
        teacher,
      error:
        teacherError,
    } =
      await supabase
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
        .maybeSingle();

    if (
      teacherError
    ) {
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
   * ==========================================
   * 자동승인 여부
   *
   * 새 자동승인 API는
   * admin_note에
   * "시스템 자동승인"을 기록합니다.
   *
   * 과거 수동 승인 데이터와
   * 구분하기 위한 기준입니다.
   * ==========================================
   */

  const automaticApproval =
    hold.status ===
      "approved" &&
    Boolean(
      hold.admin_note?.includes(
        "시스템 자동승인"
      )
    );

  return (
    <main
      style={{
        width: "100%",
        maxWidth:
          "1080px",
        margin:
          "0 auto",
        padding:
          "8px 0 70px",
      }}
    >
      {/* ======================================
          HEADER
      ====================================== */}

      <div
        style={{
          display:
            "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap:
            "20px",
          flexWrap:
            "wrap",
        }}
      >
        <div>
          <Link
            href="/admin/class-holds"
            style={{
              color:
                "#667085",
              textDecoration:
                "none",
              fontSize:
                "13px",
              fontWeight:
                800,
            }}
          >
            ← 수업 연기 내역
          </Link>

          <div
            style={{
              marginTop:
                "24px",
              color:
                "#2f6fed",
              fontSize:
                "12px",
              fontWeight:
                900,
              letterSpacing:
                "0.08em",
            }}
          >
            CLASS RESCHEDULE DETAIL
          </div>

          <h1
            style={{
              margin:
                "8px 0 0",
              color:
                "#101828",
              fontSize:
                "34px",
              letterSpacing:
                "-0.04em",
            }}
          >
            수업 연기 상세
          </h1>

          <p
            style={{
              margin:
                "10px 0 0",
              color:
                "#667085",
              fontSize:
                "14px",
              lineHeight:
                1.7,
            }}
          >
            수업 연기 신청 내용과
            시스템 처리 결과를
            확인합니다.
          </p>
        </div>

        <Link
          href="/admin"
          style={{
            minHeight:
              "42px",
            padding:
              "0 16px",
            display:
              "inline-flex",
            alignItems:
              "center",
            border:
              "1px solid #d0d5dd",
            borderRadius:
              "9px",
            background:
              "#ffffff",
            color:
              "#344054",
            textDecoration:
              "none",
            fontSize:
              "13px",
            fontWeight:
              800,
          }}
        >
          관리자 대시보드
        </Link>
      </div>

      {/* ======================================
          기본 정보
      ====================================== */}

      <section
        style={{
          marginTop:
            "26px",
          padding:
            "24px",
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "16px",
          background:
            "#ffffff",
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
              "16px",
            flexWrap:
              "wrap",
          }}
        >
          <div>
            <div
              style={{
                color:
                  "#667085",
                fontSize:
                  "12px",
                fontWeight:
                  800,
              }}
            >
              대상 학생
            </div>

            <h2
              style={{
                margin:
                  "5px 0 0",
                color:
                  "#101828",
                fontSize:
                  "23px",
              }}
            >
              {studentName}
            </h2>
          </div>

          <span
            style={{
              display:
                "inline-flex",
              minHeight:
                "30px",
              padding:
                "0 11px",
              alignItems:
                "center",
              borderRadius:
                "999px",
              background:
                automaticApproval
                  ? "#ecfdf3"
                  : "#f2f4f7",
              color:
                automaticApproval
                  ? "#067647"
                  : "#475467",
              fontSize:
                "12px",
              fontWeight:
                900,
            }}
          >
            {getHoldStatusLabel(
              hold.status,
              automaticApproval
            )}
          </span>
        </div>

        <div
          style={{
            marginTop:
              "22px",
            display:
              "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(190px, 1fr))",
            gap:
              "12px",
          }}
        >
          <DetailBox
            label="회차"
            value={
              session
                ? `${session.lesson_number}회차`
                : "-"
            }
          />

          <DetailBox
            label="수업 시작"
            value={
              session
                ? formatDateTime(
                    session.scheduled_start
                  )
                : "-"
            }
          />

          <DetailBox
            label="과정"
            value={
              courseName
            }
          />

          <DetailBox
            label="담당 강사"
            value={
              teacherName
            }
          />

          <DetailBox
            label="수업 상태"
            value={
              session
                ? getSessionStatusLabel(
                    session.status
                  )
                : "-"
            }
          />

          <DetailBox
            label="신청자"
            value={
              requester?.name ||
              "이름 미등록"
            }
          />
        </div>
      </section>

      {/* ======================================
          자동처리 규칙
      ====================================== */}

      <section
        style={{
          marginTop:
            "18px",
          padding:
            "18px 20px",
          border:
            "1px solid #dbe7ff",
          borderRadius:
            "14px",
          background:
            "#f5f8ff",
        }}
      >
        <div
          style={{
            color:
              "#2f6fed",
            fontSize:
              "13px",
            fontWeight:
              900,
          }}
        >
          TALKLY 수업 연기 규정
        </div>

        <div
          style={{
            marginTop:
              "10px",
            color:
              "#475467",
            fontSize:
              "13px",
            lineHeight:
              1.75,
          }}
        >
          학생 또는 학부모는
          한 달에 최대{" "}
          <strong>
            2회
          </strong>
          까지 수업 연기를
          신청할 수 있으며,
          수업 시작{" "}
          <strong>
            2시간 전
          </strong>
          까지 신청해야 합니다.
          조건을 충족한 신청은
          별도의 관리자 승인 없이
          시스템에서 즉시
          처리됩니다.
        </div>
      </section>

      {/* ======================================
          처리 결과
      ====================================== */}

      <div
        style={{
          marginTop:
            "18px",
        }}
      >
        <ClassHoldReviewForm
          status={
            hold.status
          }
          requestedAt={
            hold.requested_at
          }
          reviewedAt={
            hold.reviewed_at
          }
          reason={
            hold.reason
          }
          adminNote={
            hold.admin_note
          }
          automaticApproval={
            automaticApproval
          }
        />
      </div>

      {/* ======================================
          바로가기
      ====================================== */}

      <section
        style={{
          marginTop:
            "18px",
          display:
            "flex",
          gap:
            "10px",
          flexWrap:
            "wrap",
        }}
      >
        <Link
          href="/admin/class-holds"
          style={{
            minHeight:
              "42px",
            padding:
              "0 16px",
            display:
              "inline-flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            border:
              "1px solid #d0d5dd",
            borderRadius:
              "9px",
            background:
              "#ffffff",
            color:
              "#344054",
            textDecoration:
              "none",
            fontSize:
              "13px",
            fontWeight:
              800,
          }}
        >
          ← 수업 연기 내역
        </Link>

        {session &&
          enrollment && (
            <Link
              href={`/admin/enrollments/${enrollment.id}/lessons/${session.id}`}
              style={{
                minHeight:
                  "42px",
                padding:
                  "0 16px",
                display:
                  "inline-flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                border:
                  "1px solid #0A1F44",
                borderRadius:
                  "9px",
                background:
                  "#0A1F44",
                color:
                  "#ffffff",
                textDecoration:
                  "none",
                fontSize:
                  "13px",
                fontWeight:
                  900,
              }}
            >
              수업 상세 보기 →
            </Link>
          )}
      </section>
    </main>
  );
}

function DetailBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "16px",
        border:
          "1px solid #e4e7ec",
        borderRadius: "11px",
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "11px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "7px",
          color: "#101828",
          fontSize: "14px",
          fontWeight: 800,
          lineHeight: 1.55,
        }}
      >
        {value}
      </div>
    </div>
  );
}