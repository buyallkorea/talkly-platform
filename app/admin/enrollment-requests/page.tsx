import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

function statusLabel(status: string) {
  switch (status) {
    case "pending":
      return "승인대기";
    case "approved":
      return "승인완료";
    case "rejected":
      return "반려";
    default:
      return status;
  }
}

export default async function EnrollmentRequestsPage() {
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

  const {
    data: requests,
    error,
  } = await supabase
    .from("enrollment_requests")
    .select(`
      id,
      status,
      child_id,
      course_id,
      lesson_duration_minutes,
      lessons_per_week,
      preferred_days,
      preferred_times,
      start_date,
      end_date,
      total_lessons,
      estimated_price,
      created_at,
      children (
        id,
        name,
        grade,
        school_name
      ),
      courses (
        id,
        name
      ),
      enrollment_options (
        id,
        title
      )
    `)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px",
      }}
    >
      <Link
        href="/admin"
        style={{
          color: "inherit",
          textDecoration: "none",
          fontSize: "13px",
          opacity: 0.65,
        }}
      >
        ← 관리자 대시보드
      </Link>

      <h1
        style={{
          margin: "14px 0 0",
          fontSize: "32px",
        }}
      >
        수강신청 관리
      </h1>

      <p
        style={{
          marginTop: "10px",
          opacity: 0.6,
        }}
      >
        학생·학부모가 신청한 수업을 확인하고 승인합니다.
      </p>

      <section
        style={{
          marginTop: "28px",
          border:
            "1px solid rgba(255,255,255,0.14)",
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom:
              "1px solid rgba(255,255,255,0.1)",
            fontWeight: 900,
          }}
        >
          전체 신청 {requests?.length ?? 0}건
        </div>

        {!requests || requests.length === 0 ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              opacity: 0.55,
            }}
          >
            접수된 수강신청이 없습니다.
          </div>
        ) : (
          requests.map((request) => {
            const child = Array.isArray(request.children)
              ? request.children[0]
              : request.children;

            const course = Array.isArray(request.courses)
              ? request.courses[0]
              : request.courses;

            const option = Array.isArray(request.enrollment_options)
              ? request.enrollment_options[0]
              : request.enrollment_options;

            return (
              <div
                key={request.id}
                style={{
                  padding: "20px",
                  borderBottom:
                    "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "20px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 700px" }}>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={badgeStyle}>
                      {statusLabel(request.status)}
                    </span>

                    <span style={badgeStyle}>
                      {request.lesson_duration_minutes}분
                    </span>

                    <span style={badgeStyle}>
                      주 {request.lessons_per_week}회
                    </span>
                  </div>

                  <h2
                    style={{
                      margin: "12px 0 0",
                      fontSize: "19px",
                    }}
                  >
                    {child?.name ?? "학생 정보 없음"}
                  </h2>

                  <div
                    style={{
                      marginTop: "5px",
                      fontSize: "13px",
                      opacity: 0.6,
                    }}
                  >
                    {child?.grade ?? "-"} · {child?.school_name ?? "-"}
                  </div>

                  <div
                    style={{
                      marginTop: "14px",
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(180px,1fr))",
                      gap: "12px",
                    }}
                  >
                    <Info
                      label="신청 일정"
                      value={option?.title ?? "-"}
                    />

                    <Info
                      label="과정"
                      value={course?.name ?? "-"}
                    />

                    <Info
                      label="수강기간"
                      value={`${request.start_date} ~ ${request.end_date ?? "-"}`}
                    />

                    <Info
                      label="총 회차"
                      value={`${request.total_lessons}회`}
                    />

                    <Info
                      label="예상 수강료"
                      value={`${Number(
                        request.estimated_price ?? 0
                      ).toLocaleString("ko-KR")}원`}
                    />
                  </div>
                </div>

                <Link
                  href={`/admin/enrollment-requests/${request.id}`}
                  style={{
                    minHeight: "42px",
                    padding: "0 16px",
                    display: "inline-flex",
                    alignItems: "center",
                    border:
                      "1px solid rgba(255,255,255,0.16)",
                    borderRadius: "9px",
                    color: "inherit",
                    textDecoration: "none",
                    fontWeight: 800,
                    fontSize: "13px",
                  }}
                >
                  상세보기 →
                </Link>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "11px",
          opacity: 0.45,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "5px",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const badgeStyle = {
  padding: "5px 8px",
  borderRadius: "999px",
  background: "rgba(47,111,237,0.13)",
  color: "#9dbbff",
  fontSize: "11px",
  fontWeight: 900,
};