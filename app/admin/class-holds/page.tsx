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
    holds?.map(
      (hold) => hold.class_session_id
    ) ?? [];

  const requesterIds =
    holds?.map(
      (hold) => hold.requested_by
    ) ?? [];

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
          Array.from(
            new Set(sessionIds)
          )
        );

    if (sessionError) {
      throw new Error(
        sessionError.message
      );
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
          Array.from(
            new Set(requesterIds)
          )
        );

    if (requesterError) {
      throw new Error(
        requesterError.message
      );
    }

    requesters = data ?? [];
  }

  const enrollmentIds =
    sessions.map(
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
          Array.from(
            new Set(enrollmentIds)
          )
        );

    if (enrollmentError) {
      throw new Error(
        enrollmentError.message
      );
    }

    enrollments = data ?? [];
  }

  const childIds =
    enrollments
      .map(
        (enrollment) =>
          enrollment.child_id
      )
      .filter(
        (
          id
        ): id is number =>
          id !== null
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
          Array.from(
            new Set(childIds)
          )
        );

    if (childError) {
      throw new Error(
        childError.message
      );
    }

    children = data ?? [];
  }

  function getStudentName(
    enrollmentId: number
  ) {
    const enrollment =
      enrollments.find(
        (item) =>
          item.id === enrollmentId
      );

    if (!enrollment) {
      return "학생 정보 없음";
    }

    if (enrollment.child_id) {
      const child =
        children.find(
          (item) =>
            item.id ===
            enrollment.child_id
        );

      return (
        child?.name ||
        `자녀 #${enrollment.child_id}`
      );
    }

    if (
      enrollment.student_user_id
    ) {
      return "성인 학생";
    }

    return "학생 정보 없음";
  }

  function getStatusLabel(
    status: string
  ) {
    switch (status) {
      case "requested":
        return "확인 대기중";
      case "approved":
        return "승인 완료";
      case "rejected":
        return "거절";
      case "cancelled":
        return "신청 취소";
      default:
        return status;
    }
  }

  function formatDateTime(
    value: string
  ) {
    const date =
      new Date(value);

    return new Intl.DateTimeFormat(
      "ko-KR",
      {
        timeZone:
          "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    ).format(date);
  }

  return (
    <main
      style={{
        padding: "40px",
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          marginBottom: "32px",
        }}
      >
        <h1
          style={{
            marginBottom: "8px",
          }}
        >
          결석신청 관리
        </h1>

        <p style={{ margin: 0 }}>
          학생과 학부모가 신청한 Class Hold를 확인하고 승인 또는 거절합니다.
        </p>
      </div>

      {!holds ||
      holds.length === 0 ? (
        <div
          style={{
            padding: "40px",
            border:
              "1px solid #ddd",
            borderRadius:
              "12px",
          }}
        >
          아직 접수된 결석신청이 없습니다.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection:
              "column",
            gap: "18px",
          }}
        >
          {holds.map(
            (hold) => {
              const session =
                sessions.find(
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

              return (
                <div
                  key={hold.id}
                  style={{
                    padding:
                      "24px",
                    border:
                      "1px solid #ddd",
                    borderRadius:
                      "12px",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      gap: "20px",
                      alignItems:
                        "flex-start",
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          marginTop:
                            0,
                        }}
                      >
                        {session
                          ? getStudentName(
                              session.enrollment_id
                            )
                          : "학생 정보 없음"}
                      </h2>

                      <p>
                        <strong>
                          회차:
                        </strong>{" "}
                        {session?.lesson_number ??
                          "-"}
                        회차
                      </p>

                      <p>
                        <strong>
                          수업일시:
                        </strong>{" "}
                        {session
                          ? formatDateTime(
                              session.scheduled_start
                            )
                          : "-"}
                      </p>

                      <p>
                        <strong>
                          신청자:
                        </strong>{" "}
                        {requester?.name ||
                          "이름 미등록"}
                      </p>

                      <p>
                        <strong>
                          신청사유:
                        </strong>{" "}
                        {hold.reason ||
                          "사유 미입력"}
                      </p>

                      <p>
                        <strong>
                          신청일:
                        </strong>{" "}
                        {formatDateTime(
                          hold.requested_at
                        )}
                      </p>

                      <p
                        style={{
                          marginBottom:
                            0,
                        }}
                      >
                        <strong>
                          상태:
                        </strong>{" "}
                        {getStatusLabel(
                          hold.status
                        )}
                      </p>
                    </div>

                    <Link
                      href={`/admin/class-holds/${hold.id}`}
                      style={{
                        padding:
                          "10px 14px",
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
                      상세보기
                    </Link>
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}
    </main>
  );
}