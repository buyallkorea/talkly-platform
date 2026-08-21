import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function AdminClassHoldsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  const { data: holds, error } = await supabase
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
    .order("requested_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  const sessionIds =
    holds?.map((hold) => hold.class_session_id) ?? [];

  const requesterIds =
    holds?.map((hold) => hold.requested_by) ?? [];

  let sessions: {
    id: number;
    enrollment_id: number;
    lesson_number: number;
    scheduled_start: string;
  }[] = [];

  let requesters: {
    id: string;
    name: string | null;
  }[] = [];

  if (sessionIds.length > 0) {
    const { data, error: sessionError } =
      await supabase
        .from("class_sessions")
        .select(`
          id,
          enrollment_id,
          lesson_number,
          scheduled_start
        `)
        .in(
          "id",
          Array.from(new Set(sessionIds))
        );

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    sessions = data ?? [];
  }

  if (requesterIds.length > 0) {
    const { data, error: requesterError } =
      await supabase
        .from("profiles")
        .select("id, name")
        .in(
          "id",
          Array.from(new Set(requesterIds))
        );

    if (requesterError) {
      throw new Error(requesterError.message);
    }

    requesters = data ?? [];
  }

  const enrollmentIds = sessions.map(
    (session) => session.enrollment_id
  );

  let enrollments: {
    id: number;
    child_id: number | null;
    student_user_id: string | null;
  }[] = [];

  if (enrollmentIds.length > 0) {
    const { data, error: enrollmentError } =
      await supabase
        .from("enrollments")
        .select(`
          id,
          child_id,
          student_user_id
        `)
        .in(
          "id",
          Array.from(new Set(enrollmentIds))
        );

    if (enrollmentError) {
      throw new Error(enrollmentError.message);
    }

    enrollments = data ?? [];
  }

  const childIds = enrollments
    .map((enrollment) => enrollment.child_id)
    .filter(
      (id): id is number => id !== null
    );

  let children: {
    id: number;
    name: string;
  }[] = [];

  if (childIds.length > 0) {
    const { data, error: childError } =
      await supabase
        .from("children")
        .select("id, name")
        .in(
          "id",
          Array.from(new Set(childIds))
        );

    if (childError) {
      throw new Error(childError.message);
    }

    children = data ?? [];
  }

  function getStudentName(
    enrollmentId: number
  ) {
    const enrollment = enrollments.find(
      (item) => item.id === enrollmentId
    );

    if (!enrollment) {
      return "학생 정보 없음";
    }

    if (enrollment.child_id) {
      const child = children.find(
        (item) =>
          item.id === enrollment.child_id
      );

      return (
        child?.name ||
        `자녀 #${enrollment.child_id}`
      );
    }

    if (enrollment.student_user_id) {
      return "성인 학생";
    }

    return "학생 정보 없음";
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "requested":
        return "승인대기";
      case "approved":
        return "승인완료";
      case "rejected":
        return "거절";
      case "cancelled":
        return "신청취소";
      default:
        return status;
    }
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case "requested":
        return {
          background: "#fff7ed",
          color: "#b54708",
          border: "1px solid #fed7aa",
        };

      case "approved":
        return {
          background: "#ecfdf3",
          color: "#027a48",
          border: "1px solid #abefc6",
        };

      case "rejected":
        return {
          background: "#fef3f2",
          color: "#b42318",
          border: "1px solid #fecdca",
        };

      case "cancelled":
        return {
          background: "#f2f4f7",
          color: "#475467",
          border: "1px solid #e4e7ec",
        };

      default:
        return {
          background: "#f2f4f7",
          color: "#475467",
          border: "1px solid #e4e7ec",
        };
    }
  }

  function formatDateTime(value: string) {
    const date = new Date(value);

    return new Intl.DateTimeFormat(
      "ko-KR",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    ).format(date);
  }

  const totalCount = holds?.length ?? 0;

  const requestedCount =
    holds?.filter(
      (hold) => hold.status === "requested"
    ).length ?? 0;

  const approvedCount =
    holds?.filter(
      (hold) => hold.status === "approved"
    ).length ?? 0;

  const rejectedCount =
    holds?.filter(
      (hold) => hold.status === "rejected"
    ).length ?? 0;

  /*
   * 관리자가 먼저 처리해야 하는 승인대기 신청을
   * 목록 상단에 배치합니다.
   * 동일 상태에서는 최신 신청이 먼저 표시됩니다.
   */
  const sortedHolds = [...(holds ?? [])].sort(
    (a, b) => {
      const aPriority =
        a.status === "requested" ? 0 : 1;

      const bPriority =
        b.status === "requested" ? 0 : 1;

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      return (
        new Date(b.requested_at).getTime() -
        new Date(a.requested_at).getTime()
      );
    }
  );

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "54px 42px 90px",
      }}
    >
      {/* 페이지 제목 */}
      <section>
        <div
          style={{
            color: "#2f6fed",
            fontSize: "12px",
            fontWeight: 900,
            letterSpacing: "0.08em",
          }}
        >
          CLASS OPERATION
        </div>

        <h1
          style={{
            margin: "10px 0 0",
            color: "#101828",
            fontSize: "36px",
            lineHeight: 1.2,
            letterSpacing: "-0.04em",
          }}
        >
          결석 신청 관리
        </h1>

        <p
          style={{
            margin: "14px 0 0",
            color: "#667085",
            fontSize: "15px",
            lineHeight: 1.7,
          }}
        >
          학생과 학부모가 신청한 결석 요청을
          확인하고 승인 또는 거절합니다.
        </p>
      </section>

      {/* 요약 카드 */}
      <section
        style={{
          marginTop: "32px",
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0, 1fr))",
          gap: "14px",
        }}
      >
        <SummaryCard
          label="전체 신청"
          value={totalCount}
          description="누적 결석 신청"
        />

        <SummaryCard
          label="승인대기"
          value={requestedCount}
          description="처리가 필요한 신청"
          emphasized={requestedCount > 0}
        />

        <SummaryCard
          label="승인완료"
          value={approvedCount}
          description="승인된 신청"
        />

        <SummaryCard
          label="거절"
          value={rejectedCount}
          description="거절된 신청"
        />
      </section>

      {/* 목록 */}
      <section
        style={{
          marginTop: "26px",
          border: "1px solid #e4e7ec",
          borderRadius: "18px",
          background: "#ffffff",
          overflow: "hidden",
          boxShadow:
            "0 1px 2px rgba(16, 24, 40, 0.03)",
        }}
      >
        <div
          style={{
            padding: "22px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            borderBottom: "1px solid #eaecf0",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color: "#101828",
                fontSize: "18px",
                fontWeight: 900,
              }}
            >
              결석 신청 목록
            </h2>

            <p
              style={{
                margin: "6px 0 0",
                color: "#98a2b3",
                fontSize: "13px",
              }}
            >
              승인대기 신청이 우선 표시됩니다.
            </p>
          </div>

          {requestedCount > 0 && (
            <div
              style={{
                padding: "7px 11px",
                borderRadius: "999px",
                background: "#fff7ed",
                color: "#b54708",
                fontSize: "12px",
                fontWeight: 900,
              }}
            >
              처리 필요 {requestedCount}건
            </div>
          )}
        </div>

        {sortedHolds.length === 0 ? (
          <div
            style={{
              minHeight: "260px",
              padding: "60px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "54px",
                height: "54px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "16px",
                background: "#f2f4f7",
                color: "#667085",
                fontSize: "22px",
                fontWeight: 900,
              }}
            >
              ✓
            </div>

            <strong
              style={{
                marginTop: "18px",
                color: "#344054",
                fontSize: "16px",
              }}
            >
              접수된 결석 신청이 없습니다.
            </strong>

            <p
              style={{
                margin: "8px 0 0",
                color: "#98a2b3",
                fontSize: "13px",
              }}
            >
              새로운 신청이 접수되면 이곳에서
              확인할 수 있습니다.
            </p>
          </div>
        ) : (
          <>
            {/* 테이블 헤더 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1.1fr 0.65fr 1.3fr 0.9fr 1.4fr 0.9fr 0.8fr 90px",
                gap: "16px",
                alignItems: "center",
                padding: "13px 22px",
                background: "#f9fafb",
                borderBottom:
                  "1px solid #eaecf0",
                color: "#667085",
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              <div>학생</div>
              <div>회차</div>
              <div>수업일시</div>
              <div>신청자</div>
              <div>신청사유</div>
              <div>신청일</div>
              <div>상태</div>
              <div />
            </div>

            {sortedHolds.map(
              (hold, index) => {
                const session = sessions.find(
                  (item) =>
                    item.id ===
                    hold.class_session_id
                );

                const requester =
                  requesters.find(
                    (item) =>
                      item.id ===
                      hold.requested_by
                  );

                const studentName = session
                  ? getStudentName(
                      session.enrollment_id
                    )
                  : "학생 정보 없음";

                const statusStyle =
                  getStatusStyle(hold.status);

                return (
                  <div
                    key={hold.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "1.1fr 0.65fr 1.3fr 0.9fr 1.4fr 0.9fr 0.8fr 90px",
                      gap: "16px",
                      alignItems: "center",
                      padding: "19px 22px",
                      borderBottom:
                        index ===
                        sortedHolds.length - 1
                          ? "none"
                          : "1px solid #f0f2f5",
                      background:
                        hold.status ===
                        "requested"
                          ? "#fffdf9"
                          : "#ffffff",
                    }}
                  >
                    {/* 학생 */}
                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          color: "#101828",
                          fontSize: "14px",
                          overflow: "hidden",
                          textOverflow:
                            "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {studentName}
                      </strong>
                    </div>

                    {/* 회차 */}
                    <div
                      style={{
                        color: "#475467",
                        fontSize: "13px",
                      }}
                    >
                      {session?.lesson_number ??
                        "-"}
                      회차
                    </div>

                    {/* 수업 일시 */}
                    <div
                      style={{
                        color: "#475467",
                        fontSize: "13px",
                        lineHeight: 1.5,
                      }}
                    >
                      {session
                        ? formatDateTime(
                            session.scheduled_start
                          )
                        : "-"}
                    </div>

                    {/* 신청자 */}
                    <div
                      style={{
                        minWidth: 0,
                        color: "#475467",
                        fontSize: "13px",
                        overflow: "hidden",
                        textOverflow:
                          "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {requester?.name ||
                        "이름 미등록"}
                    </div>

                    {/* 사유 */}
                    <div
                      title={
                        hold.reason ||
                        "사유 미입력"
                      }
                      style={{
                        minWidth: 0,
                        color: "#475467",
                        fontSize: "13px",
                        overflow: "hidden",
                        textOverflow:
                          "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {hold.reason ||
                        "사유 미입력"}
                    </div>

                    {/* 신청일 */}
                    <div
                      style={{
                        color: "#667085",
                        fontSize: "12px",
                        lineHeight: 1.5,
                      }}
                    >
                      {formatDateTime(
                        hold.requested_at
                      )}
                    </div>

                    {/* 상태 */}
                    <div>
                      <span
                        style={{
                          ...statusStyle,
                          minHeight: "28px",
                          padding: "0 9px",
                          display:
                            "inline-flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          borderRadius:
                            "999px",
                          fontSize: "11px",
                          fontWeight: 900,
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {getStatusLabel(
                          hold.status
                        )}
                      </span>
                    </div>

                    {/* 상세 */}
                    <div
                      style={{
                        textAlign: "right",
                      }}
                    >
                      <Link
                        href={`/admin/class-holds/${hold.id}`}
                        style={{
                          display:
                            "inline-flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          minHeight: "36px",
                          padding:
                            "0 12px",
                          border:
                            "1px solid #d0d5dd",
                          borderRadius:
                            "9px",
                          background:
                            hold.status ===
                            "requested"
                              ? "#0A1F44"
                              : "#ffffff",
                          color:
                            hold.status ===
                            "requested"
                              ? "#ffffff"
                              : "#344054",
                          textDecoration:
                            "none",
                          fontSize: "12px",
                          fontWeight: 900,
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {hold.status ===
                        "requested"
                          ? "처리하기"
                          : "상세보기"}
                      </Link>
                    </div>
                  </div>
                );
              }
            )}
          </>
        )}
      </section>

      <p
        style={{
          margin: "18px 2px 0",
          color: "#98a2b3",
          fontSize: "12px",
          lineHeight: 1.6,
        }}
      >
        결석 신청 승인 또는 거절은 각 신청의
        상세 화면에서 처리할 수 있습니다.
      </p>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  description,
  emphasized = false,
}: {
  label: string;
  value: number;
  description: string;
  emphasized?: boolean;
}) {
  return (
    <div
      style={{
        minHeight: "132px",
        padding: "21px",
        border: emphasized
          ? "1px solid #fed7aa"
          : "1px solid #e4e7ec",
        borderRadius: "16px",
        background: emphasized
          ? "#fffaf5"
          : "#ffffff",
        boxShadow:
          "0 1px 2px rgba(16, 24, 40, 0.02)",
      }}
    >
      <div
        style={{
          color: emphasized
            ? "#b54708"
            : "#667085",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "12px",
          color: emphasized
            ? "#b54708"
            : "#101828",
          fontSize: "32px",
          lineHeight: 1,
          fontWeight: 900,
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: "12px",
          color: "#98a2b3",
          fontSize: "12px",
        }}
      >
        {description}
      </div>
    </div>
  );
}