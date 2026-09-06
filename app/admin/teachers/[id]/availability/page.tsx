import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TeacherAvailabilityManager from "./TeacherAvailabilityManager";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type TeacherAvailability = {
  id: number;
  teacher_user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_available: boolean;
  effective_from: string | null;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
};

type TeacherAvailabilityException = {
  id: number;
  teacher_user_id: string;
  exception_date: string;
  exception_type: "available" | "unavailable";
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export default async function TeacherAvailabilityPage({
  params,
}: PageProps) {
  const { id } = await params;

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
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  const {
    data: teacher,
    error: teacherError,
  } = await supabase
    .from("teacher_profiles")
    .select(`
      user_id,
      display_name,
      nationality,
      is_active
    `)
    .eq("user_id", id)
    .maybeSingle();

  if (teacherError) {
    throw new Error(teacherError.message);
  }

  if (!teacher) {
    notFound();
  }

  const {
    data: teacherProfile,
    error: teacherProfileError,
  } = await supabase
    .from("profiles")
    .select(`
      id,
      name,
      profile_image_url
    `)
    .eq("id", id)
    .maybeSingle();

  if (teacherProfileError) {
    throw new Error(
      teacherProfileError.message
    );
  }

  const [
    regularAvailabilityResult,
    exceptionsResult,
  ] = await Promise.all([
    supabase
      .from("teacher_availability")
      .select(`
        id,
        teacher_user_id,
        day_of_week,
        start_time,
        end_time,
        timezone,
        is_available,
        effective_from,
        effective_to,
        created_at,
        updated_at
      `)
      .eq("teacher_user_id", id)
      .order("day_of_week", {
        ascending: true,
      })
      .order("start_time", {
        ascending: true,
      }),

    supabase
      .from(
        "teacher_availability_exceptions"
      )
      .select(`
        id,
        teacher_user_id,
        exception_date,
        exception_type,
        start_time,
        end_time,
        reason,
        is_active,
        created_by,
        created_at,
        updated_at
      `)
      .eq("teacher_user_id", id)
      .order("exception_date", {
        ascending: true,
      })
      .order("start_time", {
        ascending: true,
        nullsFirst: true,
      }),
  ]);

  const firstError =
    regularAvailabilityResult.error ||
    exceptionsResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const regularAvailability =
    (regularAvailabilityResult.data ??
      []) as TeacherAvailability[];

  const exceptions =
    (exceptionsResult.data ??
      []) as TeacherAvailabilityException[];

  const displayName =
    teacher.display_name ||
    teacherProfile?.name ||
    "이름 미등록 강사";

  return (
    <div>
      <Link
        href={`/admin/teachers/${teacher.user_id}`}
        style={{
          color: "inherit",
          textDecoration: "none",
          fontSize: "14px",
          opacity: 0.72,
        }}
      >
        ← 강사 상세
      </Link>

      <div
        style={{
          marginTop: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            minWidth: 0,
          }}
        >
          {teacherProfile?.profile_image_url ? (
            <img
              src={
                teacherProfile.profile_image_url
              }
              alt={`${displayName} 프로필`}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                objectFit: "cover",
                border:
                  "1px solid #d6deea",
                background:
                  "#f2f4f7",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "center",
                background:
                  "#eaf2ff",
                color:
                  "#0a1f44",
                fontSize: "24px",
                fontWeight: 900,
                border:
                  "1px solid #d6deea",
                flexShrink: 0,
              }}
            >
              {displayName
                .trim()
                .charAt(0)
                .toUpperCase()}
            </div>
          )}

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "30px",
                letterSpacing:
                  "-0.03em",
              }}
            >
              강사 근무시간 관리
            </h1>

            <p
              style={{
                margin:
                  "8px 0 0",
                color:
                  "#667085",
                fontSize:
                  "14px",
              }}
            >
              {displayName}
              {teacher.nationality
                ? ` · ${teacher.nationality}`
                : ""}
            </p>

            <p
              style={{
                margin:
                  "5px 0 0",
                color:
                  "#98a2b3",
                fontSize:
                  "12px",
              }}
            >
              정규 근무시간과 특정 날짜 예외일정을 관리합니다.
            </p>
          </div>
        </div>

        <div
          style={{
            display:
              "flex",
            alignItems:
              "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              display:
                "inline-flex",
              alignItems:
                "center",
              minHeight:
                "34px",
              padding:
                "6px 11px",
              borderRadius:
                "999px",
              border:
                teacher.is_active
                  ? "1px solid #abefc6"
                  : "1px solid #d0d5dd",
              background:
                teacher.is_active
                  ? "#ecfdf3"
                  : "#f2f4f7",
              color:
                teacher.is_active
                  ? "#067647"
                  : "#475467",
              fontSize:
                "12px",
              fontWeight:
                800,
            }}
          >
            {teacher.is_active
              ? "활성 강사"
              : "비활성 강사"}
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop:
            "22px",
          padding:
            "18px 20px",
          border:
            "1px solid #d6deea",
          borderRadius:
            "12px",
          background:
            "#f8fafc",
          color:
            "#475467",
          fontSize:
            "13px",
          lineHeight:
            1.7,
        }}
      >
        <strong
          style={{
            color:
              "#101828",
          }}
        >
          운영 기준
        </strong>
        <br />
        정규 근무시간은 신규 수강신청의
        실시간 강사 가용시간 계산에 사용됩니다.
        기존에 이미 확정된 수업은 이 화면에서
        근무시간을 변경하거나 삭제해도 자동으로
        변경되지 않습니다.
        <br />
        특정 날짜의 휴무·시간 차단·추가근무는
        아래 예외일정에서 별도로 관리합니다.
      </div>

      <TeacherAvailabilityManager
        teacherUserId={
          teacher.user_id
        }
        teacherName={
          displayName
        }
        initialRegularAvailability={
          regularAvailability
        }
        initialExceptions={
          exceptions
        }
      />
    </div>
  );
}