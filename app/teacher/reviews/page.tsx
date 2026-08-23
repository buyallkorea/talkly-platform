import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export default async function TeacherReviewsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "teacher") {
    redirect("/");
  }

  const [summaryResult, reviewsResult] = await Promise.all([
    supabase
      .from("teacher_review_summary")
      .select(`
        teacher_user_id,
        review_count,
        attitude_average,
        lesson_quality_average,
        explanation_average,
        communication_average,
        preparation_average,
        satisfaction_average,
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
      .order("created_at", { ascending: false }),
  ]);

  const error = summaryResult.error || reviewsResult.error;

  if (error) {
    throw new Error(error.message);
  }

  const summary = summaryResult.data;
  const reviews = reviewsResult.data ?? [];

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
          <h1 style={{ margin: "6px 0 0", fontSize: "32px" }}>내 강사 평가</h1>
          <p style={{ margin: "9px 0 0", color: "#667085", lineHeight: 1.7 }}>
            학생이 남긴 평가 점수와 코멘트를 확인합니다. 평가 작성 학생의 이름과 계정정보는 표시되지 않습니다.
          </p>
        </div>

        <Link
          href="/teacher"
          style={{
            padding: "10px 14px",
            border: "1px solid #d6deea",
            borderRadius: "9px",
            color: "inherit",
            textDecoration: "none",
            fontWeight: 800,
          }}
        >
          ← 강사 대시보드
        </Link>
      </div>

      <section
        style={{
          marginTop: "26px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "10px",
        }}
      >
        {[
          ["종합 평점", summary?.overall_average != null ? `${Number(summary.overall_average).toFixed(2)} / 10` : "-"],
          ["평가 건수", `${summary?.review_count ?? 0}건`],
          ["수업 태도", summary?.attitude_average != null ? `${Number(summary.attitude_average).toFixed(2)}` : "-"],
          ["수업 구성", summary?.lesson_quality_average != null ? `${Number(summary.lesson_quality_average).toFixed(2)}` : "-"],
          ["설명 이해도", summary?.explanation_average != null ? `${Number(summary.explanation_average).toFixed(2)}` : "-"],
          ["소통", summary?.communication_average != null ? `${Number(summary.communication_average).toFixed(2)}` : "-"],
          ["수업 준비", summary?.preparation_average != null ? `${Number(summary.preparation_average).toFixed(2)}` : "-"],
          ["전반 만족도", summary?.satisfaction_average != null ? `${Number(summary.satisfaction_average).toFixed(2)}` : "-"],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              padding: "18px",
              border: "1px solid #e4e7ec",
              borderRadius: "11px",
              background: "#ffffff",
            }}
          >
            <div style={{ color: "#667085", fontSize: "11px", fontWeight: 700 }}>{label}</div>
            <div style={{ marginTop: "6px", fontSize: "22px", fontWeight: 900 }}>{value}</div>
          </div>
        ))}
      </section>

      <section
        style={{
          marginTop: "24px",
          padding: "24px",
          border: "1px solid #e4e7ec",
          borderRadius: "14px",
          background: "#ffffff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>평가 내역</h2>

        {reviews.length === 0 ? (
          <div
            style={{
              marginTop: "16px",
              padding: "28px",
              border: "1px dashed #cfd8e6",
              borderRadius: "10px",
              color: "#667085",
            }}
          >
            아직 등록된 평가가 없습니다.
          </div>
        ) : (
          <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {reviews.map((review) => {
              const overall = (
                (review.attitude_score +
                  review.lesson_quality_score +
                  review.explanation_score +
                  review.communication_score +
                  review.preparation_score +
                  review.satisfaction_score) /
                6
              ).toFixed(1);

              return (
                <article
                  key={review.id}
                  style={{
                    padding: "20px",
                    border: "1px solid #e7ebf0",
                    borderRadius: "11px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }}>
                    <div>
                      <strong style={{ fontSize: "17px" }}>학생 평가</strong>
                      <div style={{ marginTop: "4px", color: "#667085", fontSize: "12px" }}>
                        {formatDateTime(review.created_at)}
                      </div>
                    </div>
                    <strong style={{ fontSize: "20px" }}>{overall} / 10</strong>
                  </div>

                  <div
                    style={{
                      marginTop: "14px",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                      gap: "8px",
                    }}
                  >
                    {[
                      ["수업 태도", review.attitude_score],
                      ["수업 구성", review.lesson_quality_score],
                      ["설명 이해도", review.explanation_score],
                      ["소통", review.communication_score],
                      ["수업 준비", review.preparation_score],
                      ["전반 만족도", review.satisfaction_score],
                    ].map(([label, score]) => (
                      <div key={String(label)} style={{ padding: "11px", background: "#f8fafc", borderRadius: "8px" }}>
                        <div style={{ color: "#667085", fontSize: "11px" }}>{label}</div>
                        <div style={{ marginTop: "4px", fontWeight: 900 }}>{score} / 10</div>
                      </div>
                    ))}
                  </div>

                  {review.comment && (
                    <div
                      style={{
                        marginTop: "14px",
                        padding: "15px",
                        borderRadius: "9px",
                        background: "#f9fafb",
                        lineHeight: 1.75,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {review.comment}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}