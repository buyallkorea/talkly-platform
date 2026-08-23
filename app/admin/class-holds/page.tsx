import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

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

type SessionRow = {
  id: number;
  enrollment_id: number;
  lesson_number: number;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
};

type EnrollmentRow = {
  id: number;
  child_id: number | null;
  student_user_id: string | null;
};

type ProfileRow = {
  id: string;
  name: string | null;
};

type ChildRow = {
  id: number;
  name: string;
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

function getHoldStatusLabel(
  status: string
) {
  switch (status) {
    case "approved":
      return "자동 승인";

    case "cancelled":
      return "신청 취소";

    case "requested":
      return "이전 승인 대기";

    case "rejected":
      return "이전 반려";

    default:
      return status;
  }
}

function getHoldStatusStyle(
  status: string
) {
  switch (status) {
    case "approved":
      return {
        color: "#067647",
        background: "#ecfdf3",
        border: "#abefc6",
      };

    case "cancelled":
      return {
        color: "#475467",
        background: "#f2f4f7",
        border: "#e4e7ec",
      };

    case "requested":
      return {
        color: "#b54708",
        background: "#fff7ed",
        border: "#fedf89",
      };

    case "rejected":
      return {
        color: "#b42318",
        background: "#fef3f2",
        border: "#fecdca",
      };

    default:
      return {
        color: "#475467",
        background: "#f2f4f7",
        border: "#e4e7ec",
      };
  }
}

function isAutomaticApproval(
  hold: HoldRow
) {
  return (
    hold.status === "approved" &&
    Boolean(
      hold.admin_note?.includes(
        "시스템 자동승인"
      )
    )
  );
}

export default async function AdminClassHoldsPage() {
  const supabase =
    await createClient();

  /*
   * ==========================================
   * 관리자 인증
   * ==========================================
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
  } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  /*
   * ==========================================
   * 수업 연기 내역
   * ==========================================
   */

  const {
    data: holdData,
    error: holdError,
  } =
    await supabase
      .from("class_holds")
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
      .order(
        "requested_at",
        {
          ascending: false,
        }
      );

  if (holdError) {
    throw new Error(
      holdError.message
    );
  }

  const holds =
    (holdData ??
      []) as HoldRow[];

  /*
   * ==========================================
   * 관련 수업
   * ==========================================
   */

  const sessionIds =
    Array.from(
      new Set(
        holds.map(
          (hold) =>
            hold.class_session_id
        )
      )
    );

  let sessions: SessionRow[] =
    [];

  if (
    sessionIds.length > 0
  ) {
    const {
      data,
      error,
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
        .in(
          "id",
          sessionIds
        );

    if (error) {
      throw new Error(
        error.message
      );
    }

    sessions =
      (data ??
        []) as SessionRow[];
  }

  const sessionMap =
    new Map(
      sessions.map(
        (session) => [
          session.id,
          session,
        ]
      )
    );

  /*
   * ==========================================
   * 수강정보
   * ==========================================
   */

  const enrollmentIds =
    Array.from(
      new Set(
        sessions.map(
          (session) =>
            session.enrollment_id
        )
      )
    );

  let enrollments: EnrollmentRow[] =
    [];

  if (
    enrollmentIds.length > 0
  ) {
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
          student_user_id
        `)
        .in(
          "id",
          enrollmentIds
        );

    if (error) {
      throw new Error(
        error.message
      );
    }

    enrollments =
      (data ??
        []) as EnrollmentRow[];
  }

  const enrollmentMap =
    new Map(
      enrollments.map(
        (item) => [
          item.id,
          item,
        ]
      )
    );

  /*
   * ==========================================
   * 자녀 / 학생 / 신청자
   * ==========================================
   */

  const childIds =
    Array.from(
      new Set(
        enrollments
          .map(
            (item) =>
              item.child_id
          )
          .filter(
            (
              value
            ): value is number =>
              value !== null
          )
      )
    );

  const studentIds =
    Array.from(
      new Set(
        enrollments
          .map(
            (item) =>
              item.student_user_id
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(value)
          )
      )
    );

  const requesterIds =
    Array.from(
      new Set(
        holds.map(
          (hold) =>
            hold.requested_by
        )
      )
    );

  const profileIds =
    Array.from(
      new Set([
        ...studentIds,
        ...requesterIds,
      ])
    );

  const [
    childrenResult,
    profilesResult,
  ] =
    await Promise.all([
      childIds.length > 0
        ? supabase
            .from("children")
            .select(
              "id, name"
            )
            .in(
              "id",
              childIds
            )
        : Promise.resolve({
            data: [],
            error: null,
          }),

      profileIds.length > 0
        ? supabase
            .from("profiles")
            .select(
              "id, name"
            )
            .in(
              "id",
              profileIds
            )
        : Promise.resolve({
            data: [],
            error: null,
          }),
    ]);

  const lookupError =
    childrenResult.error ||
    profilesResult.error;

  if (lookupError) {
    throw new Error(
      lookupError.message
    );
  }

  const children =
    (childrenResult.data ??
      []) as ChildRow[];

  const profiles =
    (profilesResult.data ??
      []) as ProfileRow[];

  const childMap =
    new Map(
      children.map(
        (item) => [
          item.id,
          item.name,
        ]
      )
    );

  const profileMap =
    new Map(
      profiles.map(
        (item) => [
          item.id,
          item.name,
        ]
      )
    );

  /*
   * ==========================================
   * 표시용 함수
   * ==========================================
   */

  function getStudentName(
    enrollmentId: number
  ) {
    const enrollment =
      enrollmentMap.get(
        enrollmentId
      );

    if (!enrollment) {
      return "학생 정보 없음";
    }

    if (
      enrollment.child_id !==
      null
    ) {
      return (
        childMap.get(
          enrollment.child_id
        ) ||
        "자녀 정보 없음"
      );
    }

    if (
      enrollment.student_user_id
    ) {
      return (
        profileMap.get(
          enrollment.student_user_id
        ) ||
        "성인 학생"
      );
    }

    return "학생 정보 없음";
  }

  function getRequesterName(
    userId: string
  ) {
    return (
      profileMap.get(
        userId
      ) ||
      "이름 미등록"
    );
  }

  /*
   * ==========================================
   * 통계
   * ==========================================
   */

  const automaticApprovedCount =
    holds.filter(
      (hold) =>
        isAutomaticApproval(
          hold
        )
    ).length;

  const cancelledCount =
    holds.filter(
      (hold) =>
        hold.status ===
        "cancelled"
    ).length;

  const legacyCount =
    holds.filter(
      (hold) =>
        !isAutomaticApproval(
          hold
        ) &&
        hold.status !==
          "cancelled"
    ).length;

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1180px",
        margin: "0 auto",
        padding:
          "8px 0 70px",
      }}
    >
      {/* ======================================
          HEADER
      ====================================== */}

      <div
        style={{
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
              color: "#2f6fed",
              fontSize: "12px",
              fontWeight: 900,
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
              color: "#101828",
              fontSize: "34px",
              letterSpacing:
                "-0.04em",
            }}
          >
            수업 연기 내역
          </h1>

          <p
            style={{
              margin:
                "10px 0 0",
              color: "#667085",
              fontSize: "14px",
              lineHeight: 1.7,
            }}
          >
            학생과 학부모가 신청한
            수업 연기 내역과
            시스템 자동처리 결과를
            확인합니다.
          </p>
        </div>

        <Link
          href="/admin"
          style={{
            minHeight: "42px",
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
          ← 관리자 대시보드
        </Link>
      </div>

      {/* ======================================
          자동처리 안내
      ====================================== */}

      <section
        style={{
          marginTop: "24px",
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
            color: "#2f6fed",
            fontSize: "13px",
            fontWeight: 900,
          }}
        >
          수업 연기 자동승인 규칙
        </div>

        <div
          style={{
            marginTop: "10px",
            color: "#475467",
            fontSize: "13px",
            lineHeight: 1.75,
          }}
        >
          수업 연기는
          <strong>
            {" "}
            월 최대 2회
          </strong>
          까지 가능하며,
          <strong>
            {" "}
            수업 시작 2시간 전
          </strong>
          까지 신청해야 합니다.
          두 조건을 모두 충족하면
          관리자의 별도 승인 없이
          시스템이 즉시 자동
          승인합니다.
        </div>
      </section>

      {/* ======================================
          SUMMARY
      ====================================== */}

      <section
        style={{
          marginTop: "18px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
        }}
      >
        <SummaryCard
          label="전체 신청"
          value={
            holds.length
          }
        />

        <SummaryCard
          label="자동 승인"
          value={
            automaticApprovedCount
          }
          tone="green"
        />

        <SummaryCard
          label="신청 취소"
          value={
            cancelledCount
          }
          tone="gray"
        />

        <SummaryCard
          label="이전 수동처리 내역"
          value={
            legacyCount
          }
          tone={
            legacyCount > 0
              ? "orange"
              : "gray"
          }
        />
      </section>

      {/* ======================================
          이전 데이터 안내
      ====================================== */}

      {legacyCount > 0 && (
        <div
          style={{
            marginTop: "16px",
            padding:
              "14px 16px",
            border:
              "1px solid #fedf89",
            borderRadius:
              "11px",
            background:
              "#fffaeb",
            color:
              "#b54708",
            fontSize:
              "12px",
            lineHeight: 1.7,
          }}
        >
          자동승인 시스템 도입 전에
          생성된 승인 대기·수동 승인·
          반려 내역이 포함되어 있습니다.
          기존 데이터는 기록 보존을
          위해 그대로 표시합니다.
        </div>
      )}

      {/* ======================================
          LIST
      ====================================== */}

      <section
        style={{
          marginTop: "20px",
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "16px",
          overflowX: "auto",
          background:
            "#ffffff",
          boxShadow:
            "0 1px 2px rgba(16,24,40,.03)",
        }}
      >
        <div
          style={{
            minWidth:
              "1050px",
          }}
        >
          {/* Header */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(130px,1fr) 80px minmax(170px,1.2fr) minmax(130px,1fr) minmax(130px,1fr) minmax(180px,1.4fr) 110px",
              gap: "12px",
              padding:
                "14px 18px",
              borderBottom:
                "1px solid #eaecf0",
              background:
                "#f9fafb",
              color:
                "#667085",
              fontSize:
                "12px",
              fontWeight:
                800,
            }}
          >
            <div>학생</div>
            <div>회차</div>
            <div>수업일시</div>
            <div>신청자</div>
            <div>신청일시</div>
            <div>신청사유</div>
            <div>처리상태</div>
          </div>

          {holds.length ===
          0 ? (
            <div
              style={{
                padding:
                  "52px 24px",
                textAlign:
                  "center",
                color:
                  "#98a2b3",
              }}
            >
              등록된 수업 연기
              내역이 없습니다.
            </div>
          ) : (
            holds.map(
              (
                hold,
                index
              ) => {
                const session =
                  sessionMap.get(
                    hold.class_session_id
                  );

                const studentName =
                  session
                    ? getStudentName(
                        session.enrollment_id
                      )
                    : "학생 정보 없음";

                const badge =
                  getHoldStatusStyle(
                    hold.status
                  );

                const automatic =
                  isAutomaticApproval(
                    hold
                  );

                return (
                  <div
                    key={
                      hold.id
                    }
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "minmax(130px,1fr) 80px minmax(170px,1.2fr) minmax(130px,1fr) minmax(130px,1fr) minmax(180px,1.4fr) 110px",
                      gap:
                        "12px",
                      alignItems:
                        "center",
                      padding:
                        "16px 18px",
                      borderBottom:
                        index ===
                        holds.length -
                          1
                          ? "none"
                          : "1px solid #eef1f5",
                      color:
                        "#344054",
                      fontSize:
                        "13px",
                    }}
                  >
                    <div
                      style={{
                        color:
                          "#101828",
                        fontWeight:
                          900,
                      }}
                    >
                      {
                        studentName
                      }
                    </div>

                    <div>
                      {session
                        ? `${session.lesson_number}회`
                        : "-"}
                    </div>

                    <div>
                      {session
                        ? formatDateTime(
                            session.scheduled_start
                          )
                        : "-"}
                    </div>

                    <div>
                      {getRequesterName(
                        hold.requested_by
                      )}
                    </div>

                    <div>
                      {formatDateTime(
                        hold.requested_at
                      )}
                    </div>

                    <div
                      title={
                        hold.reason ||
                        ""
                      }
                      style={{
                        overflow:
                          "hidden",
                        textOverflow:
                          "ellipsis",
                        whiteSpace:
                          "nowrap",
                        color:
                          hold.reason
                            ? "#475467"
                            : "#98a2b3",
                      }}
                    >
                      {hold.reason ||
                        "사유 미입력"}
                    </div>

                    <div>
                      <span
                        style={{
                          display:
                            "inline-flex",
                          minHeight:
                            "28px",
                          padding:
                            "0 9px",
                          alignItems:
                            "center",
                          border:
                            `1px solid ${badge.border}`,
                          borderRadius:
                            "999px",
                          background:
                            badge.background,
                          color:
                            badge.color,
                          fontSize:
                            "11px",
                          fontWeight:
                            900,
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {automatic
                          ? "자동 승인"
                          : getHoldStatusLabel(
                              hold.status
                            )}
                      </span>
                    </div>
                  </div>
                );
              }
            )
          )}
        </div>
      </section>

      <div
        style={{
          marginTop: "14px",
          color: "#98a2b3",
          fontSize: "12px",
          textAlign: "right",
        }}
      >
        전체 수업 연기 내역{" "}
        {holds.length}건
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?:
    | "default"
    | "green"
    | "orange"
    | "gray";
}) {
  const tones = {
    default: {
      background: "#ffffff",
      border: "#e4e7ec",
      color: "#101828",
    },

    green: {
      background: "#f6fef9",
      border: "#abefc6",
      color: "#067647",
    },

    orange: {
      background: "#fffaeb",
      border: "#fedf89",
      color: "#b54708",
    },

    gray: {
      background: "#f9fafb",
      border: "#e4e7ec",
      color: "#475467",
    },
  };

  const style =
    tones[tone];

  return (
    <div
      style={{
        minHeight:
          "105px",
        padding: "18px",
        border:
          `1px solid ${style.border}`,
        borderRadius:
          "13px",
        background:
          style.background,
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "12px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "11px",
          color:
            style.color,
          fontSize: "29px",
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}