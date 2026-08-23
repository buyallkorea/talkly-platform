import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TalklyUserHeader from "@/components/TalklyUserHeader";
import { checkTeacherReviewEligibility } from "@/lib/teacher-reviews";
import TeacherReviewForm from "./TeacherReviewForm";

type PageProps = {
  params: Promise<{
    enrollmentId: string;
  }>;
  searchParams: Promise<{
    submitted?: string;
  }>;
};

type ExistingReview = {
  id: number;
  teacher_user_id: string;
  attitude_score: number;
  lesson_quality_score: number;
  explanation_score: number;
  communication_score: number;
  preparation_score: number;
  satisfaction_score: number;
  comment: string | null;
  created_at: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function getOverallAverage(review: ExistingReview) {
  return (
    (
      review.attitude_score +
      review.lesson_quality_score +
      review.explanation_score +
      review.communication_score +
      review.preparation_score +
      review.satisfaction_score
    ) / 6
  ).toFixed(1);
}

export default async function StudentTeacherReviewPage({
  params,
  searchParams,
}: PageProps) {
  const { enrollmentId: enrollmentIdParam } = await params;
  const query = await searchParams;
  const enrollmentId = Number(enrollmentIdParam);

  if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(
        `/student/teacher-reviews/${enrollmentId}`
      )}`
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "student"
  ) {
    redirect("/");
  }

  const eligibility = await checkTeacherReviewEligibility({
    supabase,
    userId: user.id,
    enrollmentId,
  });

  let existingReview: ExistingReview | null = null;

  if (
    eligibility.code === "ALREADY_REVIEWED" ||
    query.submitted === "1"
  ) {
    const { data, error } = await supabase
      .from("teacher_reviews")
      .select(`
        id,
        teacher_user_id,
        attitude_score,
        lesson_quality_score,
        explanation_score,
        communication_score,
        preparation_score,
        satisfaction_score,
        comment,
        created_at
      `)
      .eq("enrollment_id", enrollmentId)
      .eq("reviewer_user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new Error(
        `강사평가 확인 실패: ${error.message}`
      );
    }

    existingReview = data as ExistingReview | null;
  }

  let existingTeacherName = "담당 강사";

  if (existingReview?.teacher_user_id) {
    const { data: teacher } = await supabase
      .from("teacher_profiles")
      .select("display_name")
      .eq("user_id", existingReview.teacher_user_id)
      .maybeSingle();

    if (teacher?.display_name) {
      existingTeacherName = teacher.display_name;
    }
  }

  return (
    <div className="talkly-dashboard">
      <TalklyUserHeader
        role="student"
        userName={profile.name}
      />

      <main className="talkly-dashboard-main">
        <section
          style={{
            padding: "32px",
            borderRadius: "22px",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f1f6ff 65%, #e8f1ff 100%)",
            border: "1px solid #e1e9f5",
            boxShadow: "var(--shadow-card)",
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
              <div className="talkly-section-label">
                TEACHER REVIEW
              </div>

              <h1
                className="talkly-dashboard-title"
                style={{ marginTop: "6px" }}
              >
                강사 평가
              </h1>

              <p
                className="talkly-dashboard-subtitle"
                style={{ maxWidth: "720px" }}
              >
                수강을 마친 후 함께 수업한 강사에 대한 평가를 남겨주세요.
                작성한 점수와 의견은 TALKLY의 수업 품질 개선과 강사의
                피드백에 활용됩니다.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/student/classes"
                className="talkly-button talkly-button-secondary"
              >
                ← 내 수업
              </Link>

              <Link
                href="/student"
                className="talkly-button talkly-button-secondary"
              >
                대시보드
              </Link>
            </div>
          </div>
        </section>

        {existingReview ? (
          <section
            className="talkly-card"
            style={{
              marginTop: "24px",
              padding: "28px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div className="talkly-section-label">
                  REVIEW COMPLETED
                </div>

                <h2
                  style={{
                    margin: "6px 0 0",
                    color: "var(--talkly-navy)",
                    fontSize: "24px",
                  }}
                >
                  평가가 완료되었습니다.
                </h2>

                <p
                  style={{
                    margin: "8px 0 0",
                    color: "var(--text-secondary)",
                    fontSize: "14px",
                  }}
                >
                  {existingTeacherName} 강사에 대한 평가입니다.
                </p>
              </div>

              <span className="talkly-badge talkly-badge-success">
                종합 {getOverallAverage(existingReview)} / 10
              </span>
            </div>

            <div
              style={{
                marginTop: "22px",
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "10px",
              }}
            >
              {[
                ["수업 태도", existingReview.attitude_score],
                ["수업 구성", existingReview.lesson_quality_score],
                ["설명 이해도", existingReview.explanation_score],
                ["소통", existingReview.communication_score],
                ["수업 준비", existingReview.preparation_score],
                ["전반 만족도", existingReview.satisfaction_score],
              ].map(([label, score]) => (
                <div
                  key={String(label)}
                  style={{
                    padding: "15px",
                    borderRadius: "10px",
                    border: "1px solid #e5ecf6",
                    background: "var(--talkly-blue-soft)",
                  }}
                >
                  <div
                    style={{
                      color: "var(--text-muted)",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    {label}
                  </div>

                  <div
                    style={{
                      marginTop: "5px",
                      color: "var(--talkly-navy)",
                      fontSize: "20px",
                      fontWeight: 900,
                    }}
                  >
                    {score} / 10
                  </div>
                </div>
              ))}
            </div>

            {existingReview.comment && (
              <div
                style={{
                  marginTop: "18px",
                  padding: "18px",
                  border: "1px solid var(--border)",
                  borderRadius: "11px",
                  background: "#ffffff",
                }}
              >
                <strong style={{ color: "var(--talkly-navy)" }}>
                  내가 남긴 의견
                </strong>

                <div
                  style={{
                    marginTop: "8px",
                    color: "var(--text-secondary)",
                    lineHeight: 1.75,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {existingReview.comment}
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: "16px",
                color: "var(--text-muted)",
                fontSize: "12px",
              }}
            >
              제출일 {formatDateTime(existingReview.created_at)}
            </div>
          </section>
        ) : eligibility.eligible && eligibility.teacherName ? (
          <div style={{ marginTop: "24px" }}>
            <TeacherReviewForm
              enrollmentId={enrollmentId}
              teacherName={eligibility.teacherName}
              courseName={eligibility.courseName}
            />
          </div>
        ) : (
          <section
            className="talkly-card"
            style={{
              marginTop: "24px",
              padding: "28px",
            }}
          >
            <div className="talkly-section-label">
              REVIEW STATUS
            </div>

            <h2
              style={{
                margin: "6px 0 0",
                color: "var(--talkly-navy)",
                fontSize: "23px",
              }}
            >
              아직 강사 평가를 작성할 수 없습니다.
            </h2>

            <p
              style={{
                margin: "12px 0 0",
                color: "var(--text-secondary)",
                fontSize: "14px",
                lineHeight: 1.75,
              }}
            >
              {eligibility.message}
            </p>

            <Link
              href="/student/classes"
              className="talkly-button talkly-button-primary"
              style={{ marginTop: "20px" }}
            >
              내 수업 확인 →
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}