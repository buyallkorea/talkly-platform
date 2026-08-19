import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import EnrollmentOptionEditForm from "./EnrollmentOptionEditForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EnrollmentOptionDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const optionId = Number(id);

  if (
    !Number.isInteger(optionId) ||
    optionId <= 0
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  const [
    optionResult,
    coursesResult,
    teachersResult,
    settingsResult,
    pricingResult,
  ] = await Promise.all([
    supabase
      .from("enrollment_options")
      .select(`
        id,
        title,
        course_id,
        target_group,
        lesson_duration_minutes,
        lessons_per_week,
        preferred_days,
        preferred_times,
        course_weeks,
        start_date,
        end_date,
        total_lessons,
        price_per_lesson,
        weekend_multiplier,
        weekday_lesson_count,
        weekend_lesson_count,
        estimated_price,
        capacity,
        enrolled_count,
        teacher_user_id,
        curriculum_name,
        is_published,
        is_open,
        admin_note,
        created_at,
        updated_at
      `)
      .eq("id", optionId)
      .single(),

    supabase
      .from("courses")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("teacher_profiles")
      .select("user_id, display_name")
      .eq("is_active", true)
      .order("display_name"),

    supabase
      .from("enrollment_settings")
      .select(`
        allowed_weekdays,
        allowed_time_slots,
        allowed_lessons_per_week,
        allowed_duration_minutes,
        min_course_weeks,
        max_course_weeks
      `)
      .eq("setting_key", "default")
      .single(),

    supabase
      .from("course_pricing")
      .select(`
        course_id,
        lesson_duration_minutes,
        price_per_lesson,
        weekend_multiplier,
        is_active
      `)
      .eq("is_active", true),
  ]);

  if (
    optionResult.error ||
    !optionResult.data
  ) {
    notFound();
  }

  const firstError =
    coursesResult.error ||
    teachersResult.error ||
    settingsResult.error ||
    pricingResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  return (
    <main
      style={{
        maxWidth: "1180px",
        margin: "0 auto",
        padding: "40px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <Link
            href="/admin/enrollment-options"
            style={{
              color: "inherit",
              textDecoration: "none",
              fontSize: "13px",
              opacity: 0.65,
            }}
          >
            ← 수강 가능 일정 관리
          </Link>

          <h1
            style={{
              margin: "14px 0 0",
              fontSize: "32px",
              letterSpacing: "-0.03em",
            }}
          >
            수강 가능 일정 관리
          </h1>

          <p
            style={{
              margin: "9px 0 0",
              opacity: 0.58,
              lineHeight: 1.7,
            }}
          >
            일정 조건과 공개 상태,
            신청 가능 여부를 수정합니다.
          </p>
        </div>
      </div>

      <EnrollmentOptionEditForm
        option={optionResult.data}
        courses={coursesResult.data ?? []}
        teachers={teachersResult.data ?? []}
        settings={settingsResult.data}
        pricingRows={pricingResult.data ?? []}
      />
    </main>
  );
}