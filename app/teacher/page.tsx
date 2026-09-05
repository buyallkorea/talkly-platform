import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function TeacherPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "teacher") {
    redirect("/");
  }

  const {
    data: enrollments,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(`
      id,
      student_user_id,
      child_id,
      course_id,
      teacher_user_id,
      status
    `)
    .eq("teacher_user_id", user.id)
    .in("status", ["active", "pending"]);

  if (enrollmentError) {
    throw new Error(enrollmentError.message);
  }

  const enrollmentIds =
    enrollments?.map((enrollment) => enrollment.id) ?? [];

  let sessions: {
    id: number;
    enrollment_id: number;
    lesson_number: number;
    scheduled_start: string;
    scheduled_end: string;
    status: string;
    started_at: string | null;
    ended_at: string | null;
    meeting_provider: string | null;
    meeting_url: string | null;
  }[] = [];

  if (enrollmentIds.length > 0) {
    const { data, error } = await supabase
      .from("class_sessions")
      .select(`
        id,
        enrollment_id,
        lesson_number,
        scheduled_start,
        scheduled_end,
        status,
        started_at,
        ended_at,
        meeting_provider,
        meeting_url
      `)
      .in("enrollment_id", enrollmentIds)
      .order("scheduled_start", {
        ascending: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    sessions = data ?? [];

    /*
     * 종료시간이 지났는데 한 번도 시작되지 않은 scheduled 수업은
     * 강사 대시보드에서도 즉시 미진행(not_held)으로 정리합니다.
     *
     * 이미 started_at이 있는 수업은 예정 종료시간이 지나도
     * 자동마감하지 않습니다.
     */
    const nowIso = new Date().toISOString();

    const expiredSessionIds = sessions
      .filter(
        (session) =>
          session.status === "scheduled" &&
          !session.started_at &&
          !session.ended_at &&
          new Date(session.scheduled_end).getTime() <= Date.now()
      )
      .map((session) => session.id);

    if (expiredSessionIds.length > 0) {
      const { error: closeExpiredError } = await supabase
        .from("class_sessions")
        .update({
          status: "not_held",
          updated_at: nowIso,
        })
        .in("id", expiredSessionIds)
        .eq("status", "scheduled")
        .is("started_at", null)
        .lte("scheduled_end", nowIso);

      if (closeExpiredError) {
        throw new Error(closeExpiredError.message);
      }

      /*
       * 현재 렌더링에도 즉시 반영합니다.
       */
      const expiredIdSet = new Set(expiredSessionIds);

      sessions = sessions.map((session) =>
        expiredIdSet.has(session.id)
          ? {
              ...session,
              status: "not_held",
            }
          : session
      );
    }
  }

  const childIds =
    enrollments
      ?.map((enrollment) => enrollment.child_id)
      .filter((id): id is number => id !== null) ?? [];

  let children: {
    id: number;
    name: string;
  }[] = [];

  if (childIds.length > 0) {
    const { data, error } = await supabase
      .from("children")
      .select("id, name")
      .in(
        "id",
        Array.from(new Set(childIds))
      );

    if (error) {
      throw new Error(error.message);
    }

    children = data ?? [];
  }

  const studentIds =
    enrollments
      ?.map((enrollment) => enrollment.student_user_id)
      .filter((id): id is string => id !== null) ?? [];

  let students: {
    id: string;
    name: string | null;
  }[] = [];

  if (studentIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name")
      .in(
        "id",
        Array.from(new Set(studentIds))
      );

    if (error) {
      throw new Error(error.message);
    }

    students = data ?? [];
  }

  const courseIds =
    enrollments?.map(
      (enrollment) => enrollment.course_id
    ) ?? [];

  let courses: {
    id: number;
    name: string;
  }[] = [];

  if (courseIds.length > 0) {
    const { data, error } = await supabase
      .from("courses")
      .select("id, name")
      .in(
        "id",
        Array.from(new Set(courseIds))
      );

    if (error) {
      throw new Error(error.message);
    }

    courses = data ?? [];
  }

  function getEnrollment(enrollmentId: number) {
    return enrollments?.find(
      (item) => item.id === enrollmentId
    );
  }

  function getStudentName(enrollmentId: number) {
    const enrollment = getEnrollment(enrollmentId);

    if (!enrollment) {
      return "Student";
    }

    if (enrollment.child_id) {
      const child = children.find(
        (item) => item.id === enrollment.child_id
      );

      return child?.name || "Student";
    }

    if (enrollment.student_user_id) {
      const student = students.find(
        (item) =>
          item.id === enrollment.student_user_id
      );

      return student?.name || "Adult Student";
    }

    return "Student";
  }

  function getCourseName(enrollmentId: number) {
    const enrollment = getEnrollment(enrollmentId);

    if (!enrollment) {
      return "-";
    }

    const course = courses.find(
      (item) => item.id === enrollment.course_id
    );

    return course?.name || "-";
  }

  function getSessionStatus(status: string) {
    switch (status) {
      case "scheduled":
        return {
          en: "Scheduled",
          ko: "예정",
        };

      case "in_progress":
        return {
          en: "In Progress",
          ko: "수업 진행 중",
        };

      case "completed":
        return {
          en: "Completed",
          ko: "수업 완료",
        };

      case "cancelled":
        return {
          en: "Cancelled",
          ko: "수업 취소",
        };

      case "no_show":
        return {
          en: "Absent",
          ko: "결석",
        };

      case "held":
        return {
          en: "Class Reschedule",
          ko: "수업 연기",
        };

      case "not_held":
        return {
          en: "Not Held",
          ko: "미진행",
        };

      default:
        return {
          en: status,
          ko: "",
        };
    }
  }

  function formatEnglishDateTime(value: string) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(value));
  }

  function formatKoreanDateTime(value: string) {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
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

  const [reviewSummaryResult, recentReviewsResult] = await Promise.all([
    supabase
      .from("teacher_review_summary")
      .select(`
        teacher_user_id,
        review_count,
        overall_average,
        latest_review_at
      `)
      .eq("teacher_user_id", user.id)
      .maybeSingle(),

    supabase
      .from("teacher_reviews")
      .select(`
        id,
        attitude_score,
        lesson_quality_score,
        explanation_score,
        communication_score,
        preparation_score,
        satisfaction_score,
        comment,
        created_at
      `)
      .eq("teacher_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const reviewError =
    reviewSummaryResult.error ||
    recentReviewsResult.error;

  if (reviewError) {
    throw new Error(reviewError.message);
  }

  const reviewSummary = reviewSummaryResult.data;
  const recentReviews = recentReviewsResult.data ?? [];

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
          marginBottom: "36px",
        }}
      >
        <h1
          style={{
            marginBottom: "6px",
            fontSize: "34px",
          }}
        >
          TALKLY Teacher
        </h1>

        <div
          style={{
            fontSize: "14px",
            opacity: 0.65,
            marginBottom: "14px",
          }}
        >
          TALKLY 강사
        </div>

        <p
          style={{
            margin: 0,
            fontSize: "18px",
          }}
        >
          {profile.name
            ? `Welcome, ${profile.name}.`
            : "Welcome to your teacher dashboard."}
        </p>

        <div
          style={{
            marginTop: "5px",
            fontSize: "13px",
            opacity: 0.6,
          }}
        >
          배정된 수업 일정을 확인하고 관리할 수 있습니다.
        </div>
      </div>

      <section
        style={{
          marginBottom: "24px",
          padding: "24px",
          border: "1px solid #dbe7ff",
          borderRadius: "14px",
          background: "#f7faff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "18px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ color: "#2f6fed", fontSize: "11px", fontWeight: 900, letterSpacing: "0.08em" }}>
              MY REVIEWS
            </div>
            <h2 style={{ margin: "6px 0 0", fontSize: "24px" }}>내 강사 평가</h2>
            <p style={{ margin: "8px 0 0", fontSize: "13px", opacity: 0.68 }}>
              학생이 남긴 점수와 코멘트를 확인할 수 있습니다. 평가 작성 학생의 이름은 표시되지 않습니다.
            </p>
          </div>

          <Link
            href="/teacher/reviews"
            style={{
              padding: "10px 14px",
              border: "1px solid #b9cdf8",
              borderRadius: "9px",
              color: "#175cd3",
              background: "#ffffff",
              textDecoration: "none",
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            전체 평가 보기 →
          </Link>
        </div>

        <div
          style={{
            marginTop: "18px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "10px",
          }}
        >
          <div style={{ padding: "15px", border: "1px solid #dbe7ff", borderRadius: "10px", background: "#ffffff" }}>
            <div style={{ fontSize: "11px", opacity: 0.6 }}>종합 평점</div>
            <div style={{ marginTop: "5px", fontSize: "25px", fontWeight: 900 }}>
              {reviewSummary?.overall_average != null
                ? `${Number(reviewSummary.overall_average).toFixed(2)} / 10`
                : "-"}
            </div>
          </div>

          <div style={{ padding: "15px", border: "1px solid #dbe7ff", borderRadius: "10px", background: "#ffffff" }}>
            <div style={{ fontSize: "11px", opacity: 0.6 }}>평가 건수</div>
            <div style={{ marginTop: "5px", fontSize: "25px", fontWeight: 900 }}>
              {reviewSummary?.review_count ?? 0}건
            </div>
          </div>
        </div>

        {recentReviews.length > 0 && (
          <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {recentReviews.map((review) => (
              <div
                key={review.id}
                style={{
                  padding: "13px 14px",
                  border: "1px solid #e5ecf6",
                  borderRadius: "9px",
                  background: "#ffffff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <span style={{ fontSize: "12px", opacity: 0.62 }}>최근 평가</span>
                  <strong>
                    {((
                      review.attitude_score +
                      review.lesson_quality_score +
                      review.explanation_score +
                      review.communication_score +
                      review.preparation_score +
                      review.satisfaction_score
                    ) / 6).toFixed(1)} / 10
                  </strong>
                </div>
                {review.comment && (
                  <div style={{ marginTop: "8px", fontSize: "13px", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                    {review.comment}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        style={{
          padding: "28px",
          border: "1px solid #ddd",
          borderRadius: "14px",
        }}
      >
        <div
          style={{
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: "4px",
              fontSize: "26px",
            }}
          >
            My Classes
          </h2>

          <div
            style={{
              fontSize: "13px",
              opacity: 0.6,
            }}
          >
            내 수업
          </div>

          <div
            style={{
              marginTop: "14px",
              fontSize: "17px",
            }}
          >
            {sessions.length} Classes
          </div>

          <div
            style={{
              marginTop: "2px",
              fontSize: "12px",
              opacity: 0.55,
            }}
          >
            총 {sessions.length}회 수업
          </div>
        </div>

        {sessions.length === 0 ? (
          <div
            style={{
              padding: "28px",
              border: "1px dashed #ccc",
              borderRadius: "10px",
            }}
          >
            <div
              style={{
                fontSize: "18px",
                fontWeight: 700,
              }}
            >
              No classes assigned.
            </div>

            <div
              style={{
                marginTop: "5px",
                fontSize: "13px",
                opacity: 0.6,
              }}
            >
              현재 배정된 수업이 없습니다.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            {sessions.map((session) => {
              const status =
                getSessionStatus(session.status);

              return (
                <Link
                  key={session.id}
                  href={`/teacher/classes/${session.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "100px 1.2fr 1.3fr 90px 110px",
                    gap: "18px",
                    alignItems: "center",
                    padding: "18px",
                    border: "1px solid #ddd",
                    borderRadius: "10px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div>
                    <strong
                      style={{
                        fontSize: "17px",
                      }}
                    >
                      Lesson {session.lesson_number}
                    </strong>

                    <div
                      style={{
                        marginTop: "3px",
                        fontSize: "12px",
                        opacity: 0.55,
                      }}
                    >
                      {session.lesson_number}회차
                    </div>
                  </div>

                  <div>
                    <strong
                      style={{
                        fontSize: "17px",
                      }}
                    >
                      {getStudentName(
                        session.enrollment_id
                      )}
                    </strong>

                    <div
                      style={{
                        marginTop: "5px",
                        fontSize: "13px",
                        opacity: 0.65,
                      }}
                    >
                      {getCourseName(
                        session.enrollment_id
                      )}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                      }}
                    >
                      {formatEnglishDateTime(
                        session.scheduled_start
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: "5px",
                        fontSize: "12px",
                        opacity: 0.55,
                      }}
                    >
                      {formatKoreanDateTime(
                        session.scheduled_start
                      )}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                      }}
                    >
                      {getDurationMinutes(
                        session.scheduled_start,
                        session.scheduled_end
                      )}{" "}
                      min
                    </div>

                    <div
                      style={{
                        marginTop: "3px",
                        fontSize: "12px",
                        opacity: 0.55,
                      }}
                    >
                      수업시간
                    </div>
                  </div>

                  <div>
                    <strong
                      style={{
                        fontSize: "16px",
                      }}
                    >
                      {status.en}
                    </strong>

                    {status.ko && (
                      <div
                        style={{
                          marginTop: "3px",
                          fontSize: "12px",
                          opacity: 0.55,
                        }}
                      >
                        {status.ko}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}