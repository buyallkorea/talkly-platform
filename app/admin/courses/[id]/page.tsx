import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CourseDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const courseId = Number(id);

  if (
    !Number.isInteger(courseId) ||
    courseId <= 0
  ) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  if (
    profileError ||
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  const {
    data: course,
    error,
  } = await supabase
    .from("courses")
    .select(`
      id,
      name,
      description,
      course_type,
      target_group,
      subject_category,
      level,
      class_format,
      duration_minutes,
      lessons_per_week,
      total_lessons,
      duration_weeks,
      price,
      is_active,
      created_at,
      updated_at
    `)
    .eq("id", courseId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!course) {
    notFound();
  }

  const [
    enrollmentsResult,
    requestsResult,
    optionsResult,
    pricingResult,
  ] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("course_id", courseId),

    supabase
      .from("enrollment_requests")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("course_id", courseId),

    supabase
      .from("enrollment_options")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("course_id", courseId),

    supabase
      .from("course_pricing")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("course_id", courseId),
  ]);

  const countError =
    enrollmentsResult.error ||
    requestsResult.error ||
    optionsResult.error ||
    pricingResult.error;

  if (countError) {
    throw new Error(countError.message);
  }

  const usageCounts = {
    enrollments:
      enrollmentsResult.count ?? 0,

    enrollmentRequests:
      requestsResult.count ?? 0,

    enrollmentOptions:
      optionsResult.count ?? 0,

    coursePricing:
      pricingResult.count ?? 0,
  };

  const canDelete =
    usageCounts.enrollments === 0 &&
    usageCounts.enrollmentRequests === 0 &&
    usageCounts.enrollmentOptions === 0;

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1050px",
        margin: "0 auto",
        padding: "54px 42px 90px",
      }}
    >
      <Link
        href="/admin/courses"
        style={{
          color: "#667085",
          textDecoration: "none",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        ← 과정 관리
      </Link>

      <div
        style={{
          marginTop: "22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
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
              letterSpacing: "0.08em",
            }}
          >
            COURSE DETAIL
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
            {course.name}
          </h1>

          <p
            style={{
              margin: "13px 0 0",
              color: "#667085",
              fontSize: "15px",
              lineHeight: 1.7,
            }}
          >
            과정의 기본 정보와 운영 현황을 확인합니다.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "9px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <StatusBadge
            active={course.is_active}
          />

          <Link
            href={`/admin/courses/${course.id}/edit`}
            style={{
              minHeight: "44px",
              padding: "0 17px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "9px",
              background: "#0A1F44",
              color: "#ffffff",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 900,
            }}
          >
            과정 수정
          </Link>
        </div>
      </div>

      <section
        style={{
          marginTop: "28px",
          padding: "24px",
          border: "1px solid #e4e7ec",
          borderRadius: "16px",
          background: "#ffffff",
        }}
      >
        <SectionTitle
          title="과정 기본 정보"
          description="등록된 과정 분류와 서비스 정보를 확인합니다."
        />

        <div
          style={{
            marginTop: "22px",
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0,1fr))",
            gap: "22px",
          }}
        >
          <InfoItem
            label="서비스 유형"
            value={getCourseTypeLabel(
              course.course_type
            )}
          />

          <InfoItem
            label="수강 대상"
            value={getTargetGroupLabel(
              course.target_group
            )}
          />

          <InfoItem
            label="과정 분야"
            value={getSubjectLabel(
              course.subject_category
            )}
          />

          <InfoItem
            label="학습 레벨"
            value={getLevelLabel(
              course.level
            )}
          />

          <InfoItem
            label="수업 형태"
            value={getClassFormatLabel(
              course.class_format
            )}
          />

          <InfoItem
            label="1회 수업시간"
            value={`${course.duration_minutes}분`}
          />

          <InfoItem
            label="주당 수업"
            value={
              course.lessons_per_week != null
                ? `주 ${course.lessons_per_week}회`
                : "-"
            }
          />

          <InfoItem
            label="기본 수강기간"
            value={
              course.duration_weeks != null
                ? `${course.duration_weeks}주`
                : "-"
            }
          />

          <InfoItem
            label="총 수업 횟수"
            value={
              course.total_lessons != null
                ? `${course.total_lessons}회`
                : "-"
            }
          />

          <InfoItem
            label="기본 수강료"
            value={
              course.price != null
                ? `${Number(
                    course.price
                  ).toLocaleString(
                    "ko-KR"
                  )}원`
                : "-"
            }
          />
        </div>

        <div
          style={{
            marginTop: "26px",
            padding: "20px",
            border: "1px solid #e4e7ec",
            borderRadius: "12px",
            background: "#f9fafb",
          }}
        >
          <div
            style={{
              color: "#667085",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            과정 설명
          </div>

          <div
            style={{
              marginTop: "10px",
              color: "#344054",
              fontSize: "14px",
              lineHeight: 1.8,
              whiteSpace: "pre-wrap",
            }}
          >
            {course.description ||
              "등록된 과정 설명이 없습니다."}
          </div>
        </div>
      </section>

      <section
        style={{
          marginTop: "22px",
          padding: "24px",
          border: "1px solid #e4e7ec",
          borderRadius: "16px",
          background: "#ffffff",
        }}
      >
        <SectionTitle
          title="사용 현황"
          description="이 과정과 연결된 수강 및 신청 정보를 확인합니다."
        />

        <div
          style={{
            marginTop: "20px",
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0,1fr))",
            gap: "12px",
          }}
        >
          <UsageCard
            label="수강 이력"
            value={usageCounts.enrollments}
          />

          <UsageCard
            label="수강 신청"
            value={
              usageCounts.enrollmentRequests
            }
          />

          <UsageCard
            label="수강 가능 일정"
            value={
              usageCounts.enrollmentOptions
            }
          />

          <UsageCard
            label="가격 정책"
            value={
              usageCounts.coursePricing
            }
          />
        </div>

        <div
          style={{
            marginTop: "18px",
            padding: "14px 16px",
            borderRadius: "10px",
            border: canDelete
              ? "1px solid #abefc6"
              : "1px solid #fed7aa",
            background: canDelete
              ? "#ecfdf3"
              : "#fff7ed",
            color: canDelete
              ? "#027a48"
              : "#b54708",
            fontSize: "12px",
            fontWeight: 800,
            lineHeight: 1.7,
          }}
        >
          {canDelete
            ? "현재 과정은 수강·수강신청·수강 가능 일정에서 사용되지 않아 수정 화면에서 영구 삭제할 수 있습니다."
            : "현재 과정은 사용 이력이 있으므로 영구 삭제할 수 없습니다. 더 이상 운영하지 않는 경우 수정 화면에서 비활성화해주세요."}
        </div>
      </section>

      <div
        style={{
          marginTop: "22px",
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/admin/courses"
          style={secondaryButtonStyle}
        >
          ← 과정 목록으로
        </Link>

        <Link
          href={`/admin/courses/${course.id}/edit`}
          style={{
            minHeight: "46px",
            padding: "0 19px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "10px",
            background: "#0A1F44",
            color: "#ffffff",
            textDecoration: "none",
            fontSize: "13px",
            fontWeight: 900,
          }}
        >
          과정 정보 수정 →
        </Link>
      </div>
    </main>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2
        style={{
          margin: 0,
          color: "#101828",
          fontSize: "19px",
        }}
      >
        {title}
      </h2>

      <p
        style={{
          margin: "6px 0 0",
          color: "#98a2b3",
          fontSize: "12px",
        }}
      >
        {description}
      </p>
    </div>
  );
}

function InfoItem({
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
          color: "#98a2b3",
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
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function UsageCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        padding: "16px",
        border: "1px solid #e4e7ec",
        borderRadius: "11px",
        background: "#f9fafb",
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
          marginTop: "8px",
          color: "#101828",
          fontSize: "25px",
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      style={{
        minHeight: "30px",
        padding: "0 10px",
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        background: active
          ? "#ecfdf3"
          : "#f2f4f7",
        color: active
          ? "#027a48"
          : "#667085",
        fontSize: "11px",
        fontWeight: 900,
      }}
    >
      {active
        ? "활성 과정"
        : "비활성 과정"}
    </span>
  );
}

function getCourseTypeLabel(
  value: string | null
) {
  switch (value) {
    case "video_english":
      return "화상영어";
    case "phone_english":
      return "전화영어";
    case "experience":
      return "체험영어";
    case "other":
      return "기타";
    default:
      return value || "-";
  }
}

function getTargetGroupLabel(
  value: string | null
) {
  switch (value) {
    case "preschool":
      return "영유아";
    case "elementary":
      return "초등";
    case "middle":
      return "중등";
    case "high":
      return "고등";
    case "university":
      return "대학생";
    case "adult":
      return "성인";
    case "senior":
      return "시니어";
    case "all":
      return "전연령";
    default:
      return "-";
  }
}

function getSubjectLabel(
  value: string | null
) {
  switch (value) {
    case "conversation":
      return "회화";
    case "phonics":
      return "파닉스";
    case "reading":
      return "리딩";
    case "grammar":
      return "문법";
    case "writing":
      return "작문";
    case "test":
      return "시험";
    case "business":
      return "비즈니스";
    case "experiential":
      return "체험영어";
    case "comprehensive":
      return "종합";
    case "other":
      return "기타";
    default:
      return "-";
  }
}

function getLevelLabel(
  value: string | null
) {
  switch (value) {
    case "beginner":
      return "입문";
    case "elementary":
      return "초급";
    case "pre_intermediate":
      return "초중급";
    case "intermediate":
      return "중급";
    case "upper_intermediate":
      return "중고급";
    case "advanced":
      return "고급";
    case "all":
      return "레벨 무관";
    default:
      return "-";
  }
}

function getClassFormatLabel(
  value: string | null
) {
  switch (value) {
    case "one_to_one":
      return "1:1";
    case "group":
      return "그룹";
    default:
      return "-";
  }
}

const secondaryButtonStyle = {
  minHeight: "46px",
  padding: "0 18px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#344054",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 800,
};