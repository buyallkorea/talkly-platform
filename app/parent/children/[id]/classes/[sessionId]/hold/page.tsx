import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase-server";

import HoldRequestForm from "./HoldRequestForm";

type PageProps = {
  params: Promise<{
    id: string;
    sessionId: string;
  }>;
};

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone:
        "Asia/Seoul",
      year:
        "numeric",
      month:
        "2-digit",
      day:
        "2-digit",
      weekday:
        "short",
      hour:
        "2-digit",
      minute:
        "2-digit",
      hour12:
        false,
    }
  ).format(
    new Date(value)
  );
}

export default async function ParentClassHoldPage({
  params,
}: PageProps) {
  const {
    id,
    sessionId,
  } =
    await params;

  const childId =
    Number(id);

  const classSessionId =
    Number(
      sessionId
    );

  if (
    !Number.isInteger(
      childId
    ) ||
    !Number.isInteger(
      classSessionId
    )
  ) {
    notFound();
  }

  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login"
    );
  }

  const {
    data:
      profile,
  } =
    await supabase
      .from(
        "profiles"
      )
      .select(
        "role"
      )
      .eq(
        "id",
        user.id
      )
      .maybeSingle();

  if (
    !profile ||
    profile.role !==
      "parent"
  ) {
    redirect("/");
  }

  /*
   * 자녀 소유권
   */
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
      .select(`
        id,
        name
      `)
      .eq(
        "id",
        childId
      )
      .eq(
        "parent_user_id",
        user.id
      )
      .eq(
        "is_active",
        true
      )
      .maybeSingle();

  if (
    childError
  ) {
    throw new Error(
      childError.message
    );
  }

  if (!child) {
    notFound();
  }

  /*
   * 대상 수업
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
        classSessionId
      )
      .maybeSingle();

  if (
    sessionError
  ) {
    throw new Error(
      sessionError.message
    );
  }

  if (!session) {
    notFound();
  }

  /*
   * 이 자녀의 수업인지 확인
   */
  const {
    data:
      enrollment,
    error:
      enrollmentError,
  } =
    await supabase
      .from(
        "enrollments"
      )
      .select(`
        id,
        child_id,
        course_id
      `)
      .eq(
        "id",
        session.enrollment_id
      )
      .eq(
        "child_id",
        child.id
      )
      .maybeSingle();

  if (
    enrollmentError
  ) {
    throw new Error(
      enrollmentError.message
    );
  }

  if (
    !enrollment
  ) {
    notFound();
  }

  /*
   * 이미 신청된 연기 확인
   */
  const {
    data:
      existingHold,
    error:
      holdError,
  } =
    await supabase
      .from(
        "class_holds"
      )
      .select(`
        id,
        status,
        requested_at
      `)
      .eq(
        "class_session_id",
        session.id
      )
      .in(
        "status",
        [
          "requested",
          "approved",
        ]
      )
      .limit(1)
      .maybeSingle();

  if (
    holdError
  ) {
    throw new Error(
      holdError.message
    );
  }

  if (
    existingHold ||
    session.status !==
      "scheduled"
  ) {
    redirect(
      `/parent/children/${child.id}/classes/${session.id}`
    );
  }

  const startTime =
    new Date(
      session.scheduled_start
    ).getTime();

  const nowTime =
    Date.now();

  const remainingHours =
    Math.max(
      0,
      (startTime -
        nowTime) /
        3600000
    );

  return (
    <main
      style={{
        width:
          "100%",
        maxWidth:
          "760px",
        margin:
          "0 auto",
        padding:
          "44px 24px 90px",
      }}
    >
      <Link
        href={`/parent/children/${child.id}/classes/${session.id}`}
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
        ← 수업 상세
      </Link>

      <div
        style={{
          marginTop:
            "28px",
        }}
      >
        <div
          style={{
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
          CLASS RESCHEDULE
        </div>

        <h1
          style={{
            margin:
              "9px 0 0",
            color:
              "#101828",
            fontSize:
              "34px",
            letterSpacing:
              "-0.04em",
          }}
        >
          수업 연기 신청
        </h1>

        <p
          style={{
            margin:
              "12px 0 0",
            color:
              "#667085",
            fontSize:
              "14px",
            lineHeight:
              1.75,
          }}
        >
          신청 조건을
          충족하면 별도의
          관리자 확인 없이
          즉시 자동
          승인됩니다.
        </p>
      </div>

      {/* 수업 정보 */}
      <section
        style={{
          marginTop:
            "26px",
          padding:
            "20px",
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "14px",
          background:
            "#ffffff",
        }}
      >
        <div
          style={{
            color:
              "#101828",
            fontSize:
              "15px",
            fontWeight:
              900,
          }}
        >
          {child.name} ·{" "}
          {
            session.lesson_number
          }
          회차
        </div>

        <div
          style={{
            marginTop:
              "8px",
            color:
              "#667085",
            fontSize:
              "13px",
          }}
        >
          {formatDateTime(
            session.scheduled_start
          )}
        </div>
      </section>

      {/* 규칙 */}
      <section
        style={{
          marginTop:
            "18px",
          padding:
            "20px",
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
          수업 연기 규정
        </div>

        <div
          style={{
            marginTop:
              "12px",
            display:
              "flex",
            flexDirection:
              "column",
            gap:
              "8px",
            color:
              "#475467",
            fontSize:
              "13px",
            lineHeight:
              1.65,
          }}
        >
          <div>
            • 한 달 최대{" "}
            <strong>
              2회
            </strong>
            까지 신청할 수
            있습니다.
          </div>

          <div>
            • 수업 시작{" "}
            <strong>
              2시간 전
            </strong>
            까지만 신청할 수
            있습니다.
          </div>

          <div>
            • 두 조건을
            만족하면 시스템이
            즉시 자동
            승인합니다.
          </div>

          <div>
            • 조건을 충족하지
            못하면 신청 자체가
            처리되지 않습니다.
          </div>
        </div>
      </section>

      {remainingHours <
      2 ? (
        <div
          style={{
            marginTop:
              "18px",
            padding:
              "18px",
            border:
              "1px solid #fecdca",
            borderRadius:
              "12px",
            background:
              "#fef3f2",
            color:
              "#b42318",
            fontSize:
              "13px",
            lineHeight:
              1.7,
          }}
        >
          현재 수업 시작까지
          2시간 미만이 남아
          수업 연기 신청이
          불가능합니다.
        </div>
      ) : (
        <HoldRequestForm
          sessionId={
            session.id
          }
          childId={
            child.id
          }
        />
      )}
    </main>
  );
}