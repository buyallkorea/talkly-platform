import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase-server";

const weekdayOptions = [
  { value: "Monday", label: "월" },
  { value: "Tuesday", label: "화" },
  { value: "Wednesday", label: "수" },
  { value: "Thursday", label: "목" },
  { value: "Friday", label: "금" },
  { value: "Saturday", label: "토" },
  { value: "Sunday", label: "일" },
];

const lessonCountOptions = [1, 2, 3, 4, 5];

const durationOptions = [25, 50];

const startTimeOptions = [
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
];

type PageProps = {
  searchParams: Promise<{
    saved?: string;
  }>;
};

async function saveEnrollmentOperationSettings(
  formData: FormData
) {
  "use server";

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: profile,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  const parentSelfEnrollmentEnabled =
    formData.get(
      "parent_self_enrollment_enabled"
    ) === "on";

  const adultSelfEnrollmentEnabled =
    formData.get(
      "adult_self_enrollment_enabled"
    ) === "on";

  const allowStudentChooseTeacher =
    formData.get(
      "allow_student_choose_teacher"
    ) === "on";

  const showEstimatedPrice =
    formData.get(
      "show_estimated_price"
    ) === "on";

  const allowedWeekdays =
    formData
      .getAll("allowed_weekdays")
      .map((value) =>
        String(value)
      )
      .filter((value) =>
        weekdayOptions.some(
          (option) =>
            option.value ===
            value
        )
      );

  const allowedLessonsPerWeek =
    formData
      .getAll(
        "allowed_lessons_per_week"
      )
      .map((value) =>
        Number(value)
      )
      .filter(
        (value) =>
          Number.isInteger(
            value
          ) &&
          lessonCountOptions.includes(
            value
          )
      );

  const allowedDurationMinutes =
    formData
      .getAll(
        "allowed_duration_minutes"
      )
      .map((value) =>
        Number(value)
      )
      .filter(
        (value) =>
          durationOptions.includes(
            value
          )
      );

  const allowedTimeSlots =
    formData
      .getAll(
        "allowed_time_slots"
      )
      .map((value) =>
        String(value)
      )
      .filter((value) =>
        startTimeOptions.includes(
          value
        )
      );

  if (
    allowedWeekdays.length ===
    0
  ) {
    throw new Error(
      "최소 1개의 수업 가능 요일을 선택해주세요."
    );
  }

  if (
    allowedLessonsPerWeek.length ===
    0
  ) {
    throw new Error(
      "최소 1개의 주당 수업 횟수를 선택해주세요."
    );
  }

  if (
    allowedDurationMinutes.length ===
    0
  ) {
    throw new Error(
      "25분 또는 50분 수업 중 최소 1개를 선택해주세요."
    );
  }

  if (
    allowedTimeSlots.length ===
    0
  ) {
    throw new Error(
      "최소 1개의 수업 시작 가능 시간을 선택해주세요."
    );
  }

  const {
    error: updateError,
  } = await supabase
    .from(
      "enrollment_settings"
    )
    .update({
      parent_self_enrollment_enabled:
        parentSelfEnrollmentEnabled,

      adult_self_enrollment_enabled:
        adultSelfEnrollmentEnabled,

      allowed_weekdays:
        allowedWeekdays,

      allowed_lessons_per_week:
        allowedLessonsPerWeek,

      allowed_duration_minutes:
        allowedDurationMinutes,

      allowed_time_slots:
        allowedTimeSlots,

      allow_student_choose_teacher:
        allowStudentChooseTeacher,

      show_estimated_price:
        showEstimatedPrice,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "setting_key",
      "default"
    );

  if (updateError) {
    throw new Error(
      `수강 운영 설정 저장 실패: ${updateError.message}`
    );
  }

  revalidatePath(
    "/admin/enrollment-settings"
  );

  redirect(
    "/admin/enrollment-settings?saved=1"
  );
}

export default async function EnrollmentSettingsPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: profile,
  } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  const {
    data: settings,
    error: settingsError,
  } = await supabase
    .from(
      "enrollment_settings"
    )
    .select(`
      setting_key,
      adult_self_enrollment_enabled,
      parent_self_enrollment_enabled,
      allowed_weekdays,
      allowed_time_slots,
      allowed_lessons_per_week,
      allowed_duration_minutes,
      allow_student_choose_teacher,
      show_estimated_price,
      updated_at
    `)
    .eq(
      "setting_key",
      "default"
    )
    .single();

  if (
    settingsError ||
    !settings
  ) {
    throw new Error(
      settingsError?.message ??
        "수강 운영 설정을 불러오지 못했습니다."
    );
  }

  const selectedWeekdays =
    Array.isArray(
      settings.allowed_weekdays
    )
      ? settings.allowed_weekdays
      : [];

  const selectedTimeSlots =
    Array.isArray(
      settings.allowed_time_slots
    )
      ? settings.allowed_time_slots
      : [];

  const selectedLessonsPerWeek =
    Array.isArray(
      settings.allowed_lessons_per_week
    )
      ? settings.allowed_lessons_per_week
      : [];

  const selectedDurations =
    Array.isArray(
      settings.allowed_duration_minutes
    )
      ? settings.allowed_duration_minutes
      : [];

  return (
    <main
      style={{
        maxWidth: "1180px",
        margin: "0 auto",
        padding:
          "34px 22px 80px",
      }}
    >
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
          <Link
            href="/admin"
            style={{
              display:
                "inline-flex",
              minHeight: "38px",
              padding: "0 13px",
              alignItems:
                "center",
              border:
                "1px solid #d0d5dd",
              borderRadius: "9px",
              background:
                "#ffffff",
              color: "#344054",
              textDecoration:
                "none",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            ← 관리자 대시보드
          </Link>

          <div
            style={{
              marginTop: "20px",
              color:
                "var(--talkly-blue)",
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing:
                "0.12em",
            }}
          >
            ENROLLMENT OPERATIONS
          </div>

          <h1
            style={{
              margin: "6px 0 0",
              color:
                "var(--talkly-navy)",
              fontSize: "32px",
              lineHeight: 1.25,
            }}
          >
            수강 운영 설정
          </h1>

          <p
            style={{
              margin: "9px 0 0",
              maxWidth: "720px",
              color:
                "var(--text-muted)",
              fontSize: "13px",
              lineHeight: 1.7,
            }}
          >
            학부모와 학생이 수강신청 시
            선택할 수 있는 기본 운영조건을
            관리합니다. 수강료와 장기 할인은
            별도의 수강료·할인 관리에서
            운영합니다.
          </p>
        </div>

        <Link
          href="/admin/enrollments"
          style={{
            display:
              "inline-flex",
            minHeight: "42px",
            padding: "0 14px",
            alignItems:
              "center",
            border:
              "1px solid #d0d5dd",
            borderRadius: "9px",
            background:
              "#ffffff",
            color: "#344054",
            textDecoration:
              "none",
            fontSize: "11px",
            fontWeight: 800,
          }}
        >
          전체 수강 관리 →
        </Link>
      </div>

      {params.saved === "1" && (
        <div
          style={{
            marginTop: "20px",
            padding: "14px 16px",
            border:
              "1px solid #abefc6",
            borderRadius: "11px",
            background:
              "#ecfdf3",
            color: "#067647",
            fontSize: "12px",
            fontWeight: 800,
          }}
        >
          수강 운영 설정이
          저장되었습니다.
        </div>
      )}

      <section
        style={{
          marginTop: "22px",
          padding: "18px 20px",
          border:
            "1px solid #dbe6ff",
          borderRadius: "14px",
          background:
            "#f8faff",
        }}
      >
        <div
          style={{
            color: "#175cd3",
            fontSize: "10px",
            fontWeight: 900,
            letterSpacing:
              "0.05em",
          }}
        >
          TALKLY OPERATION RULE
        </div>

        <div
          style={{
            marginTop: "7px",
            color: "#475467",
            fontSize: "11px",
            lineHeight: 1.8,
          }}
        >
          기본 운영시간은
          10:00~22:00입니다.
          25분 수업은 매시 정각과
          30분에 시작할 수 있고,
          50분 수업은 정시에만
          시작합니다. 주말 수업은
          토요일 또는 일요일 중
          최대 1일만 신청할 수 있습니다.
        </div>
      </section>

      <form
        action={
          saveEnrollmentOperationSettings
        }
        style={{
          marginTop: "18px",
          display: "flex",
          flexDirection:
            "column",
          gap: "16px",
        }}
      >
        <section
          style={sectionStyle}
        >
          <SectionHeader
            title="자가 수강신청 공개"
            description="학부모 또는 성인 학생에게 수강신청 기능을 공개할지 설정합니다."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "10px",
            }}
          >
            <ToggleCard
              name="parent_self_enrollment_enabled"
              title="학부모 자녀 수강신청"
              description="학부모가 등록된 자녀의 맞춤 수강신청을 직접 제출할 수 있습니다."
              defaultChecked={
                Boolean(
                  settings.parent_self_enrollment_enabled
                )
              }
            />

            <ToggleCard
              name="adult_self_enrollment_enabled"
              title="성인 학생 자가 수강신청"
              description="ON인 경우 성인 학생의 직접 수강신청 기능을 공개합니다."
              defaultChecked={
                Boolean(
                  settings.adult_self_enrollment_enabled
                )
              }
            />
          </div>
        </section>

        <section
          style={sectionStyle}
        >
          <SectionHeader
            title="수업시간"
            description="TALKLY에서 신청 가능한 1회 수업시간입니다."
          />

          <CheckboxGrid
            minWidth="180px"
          >
            {durationOptions.map(
              (duration) => (
                <CheckboxItem
                  key={duration}
                  name="allowed_duration_minutes"
                  value={String(
                    duration
                  )}
                  label={`${duration}분 수업`}
                  description={
                    duration === 25
                      ? "정각 / 30분 시작"
                      : "매시 정각 시작"
                  }
                  defaultChecked={
                    selectedDurations.includes(
                      duration
                    )
                  }
                />
              )
            )}
          </CheckboxGrid>

          <InfoNotice>
            45분·60분 수업은 현재
            TALKLY 수강신청 구조에서
            사용하지 않습니다.
          </InfoNotice>
        </section>

        <section
          style={sectionStyle}
        >
          <SectionHeader
            title="주당 수업 횟수"
            description="학부모 또는 학생이 선택할 수 있는 주당 수업 횟수입니다."
          />

          <CheckboxGrid>
            {lessonCountOptions.map(
              (count) => (
                <CheckboxItem
                  key={count}
                  name="allowed_lessons_per_week"
                  value={String(
                    count
                  )}
                  label={`주 ${count}회`}
                  defaultChecked={
                    selectedLessonsPerWeek.includes(
                      count
                    )
                  }
                />
              )
            )}
          </CheckboxGrid>
        </section>

        <section
          style={sectionStyle}
        >
          <SectionHeader
            title="수업 가능 요일"
            description="수강신청에서 선택 가능한 요일입니다."
          />

          <CheckboxGrid>
            {weekdayOptions.map(
              (day) => (
                <CheckboxItem
                  key={day.value}
                  name="allowed_weekdays"
                  value={day.value}
                  label={day.label}
                  defaultChecked={
                    selectedWeekdays.includes(
                      day.value
                    )
                  }
                />
              )
            )}
          </CheckboxGrid>

          <InfoNotice>
            토요일과 일요일을 모두
            운영 가능으로 설정할 수는
            있지만, 한 신청에서 토·일을
            동시에 선택할 수는 없습니다.
          </InfoNotice>
        </section>

        <section
          style={sectionStyle}
        >
          <SectionHeader
            title="수업 시작 가능 시간"
            description="수강신청에서 선택할 수 있는 시작 시간입니다. 10:00~22:00 운영을 기준으로 마지막 시작시간은 21:30입니다."
          />

          <CheckboxGrid
            minWidth="100px"
          >
            {startTimeOptions.map(
              (time) => (
                <CheckboxItem
                  key={time}
                  name="allowed_time_slots"
                  value={time}
                  label={time}
                  defaultChecked={
                    selectedTimeSlots.includes(
                      time
                    )
                  }
                />
              )
            )}
          </CheckboxGrid>

          <InfoNotice>
            25분 수업은 선택된
            :00 / :30 시간대를 사용하고,
            50분 수업은 이 중 정시
            시작시간만 실제 후보로
            사용합니다.
          </InfoNotice>
        </section>

        <section
          style={sectionStyle}
        >
          <SectionHeader
            title="학생·학부모 선택 권한"
            description="수강신청 과정에서 사용자에게 허용할 선택 범위를 설정합니다."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "10px",
            }}
          >
            <ToggleCard
              name="allow_student_choose_teacher"
              title="강사 선택 허용"
              description="ON이면 신청자가 특정 강사를 희망강사로 선택할 수 있습니다. 최종 배정은 관리자가 확정합니다."
              defaultChecked={
                Boolean(
                  settings.allow_student_choose_teacher
                )
              }
            />

            <ToggleCard
              name="show_estimated_price"
              title="예상 수강료 표시"
              description="신청 단계에서 계산 가능한 경우 예상 수강료 정보를 사용자에게 표시합니다."
              defaultChecked={
                Boolean(
                  settings.show_estimated_price
                )
              }
            />
          </div>
        </section>

        <section
          style={{
            ...sectionStyle,
            border:
              "1px solid #dbe6ff",
            background:
              "#f8faff",
          }}
        >
          <SectionHeader
            title="이 화면에서 관리하지 않는 항목"
            description="현재 TALKLY 구조에서는 아래 항목을 별도 관리 화면으로 분리합니다."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "10px",
            }}
          >
            <ReadonlyCard
              title="수강료"
              description="western / philippines / special / intensive 가격정책은 수강료·할인 관리에서 운영합니다."
            />

            <ReadonlyCard
              title="장기 수강 할인"
              description="1·3·6·12개월 할인정책은 enrollment_discount_policies 기준으로 별도 관리합니다."
            />

            <ReadonlyCard
              title="운영중지·휴무"
              description="전체 휴무일 및 특정 시간 운영중지는 class_operation_blocks 기반 화면에서 관리합니다."
            />
          </div>
        </section>

        <div
          style={{
            display: "flex",
            justifyContent:
              "flex-end",
            gap: "9px",
            paddingTop: "2px",
          }}
        >
          <Link
            href="/admin"
            style={{
              display:
                "inline-flex",
              minHeight: "44px",
              padding: "0 18px",
              alignItems:
                "center",
              border:
                "1px solid #d0d5dd",
              borderRadius: "9px",
              background:
                "#ffffff",
              color: "#344054",
              textDecoration:
                "none",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            취소
          </Link>

          <button
            type="submit"
            style={{
              minHeight: "44px",
              padding: "0 20px",
              border: 0,
              borderRadius: "9px",
              background:
                "#175cd3",
              color: "#ffffff",
              fontFamily:
                "inherit",
              fontSize: "12px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            운영 설정 저장
          </button>
        </div>
      </form>
    </main>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        marginBottom: "18px",
      }}
    >
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
          color: "#667085",
          fontSize: "11px",
          lineHeight: 1.65,
        }}
      >
        {description}
      </p>
    </div>
  );
}

function ToggleCard({
  name,
  title,
  description,
  defaultChecked,
}: {
  name: string;
  title: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems:
          "flex-start",
        gap: "12px",
        padding: "16px",
        border:
          "1px solid #e4e7ec",
        borderRadius: "11px",
        background: "#ffffff",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={
          defaultChecked
        }
        style={{
          width: "18px",
          height: "18px",
          marginTop: "2px",
          accentColor:
            "#175cd3",
        }}
      />

      <div>
        <div
          style={{
            color: "#101828",
            fontSize: "12px",
            fontWeight: 900,
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: "5px",
            color: "#667085",
            fontSize: "10px",
            lineHeight: 1.6,
          }}
        >
          {description}
        </div>
      </div>
    </label>
  );
}

function CheckboxGrid({
  children,
  minWidth = "105px",
}: {
  children: React.ReactNode;
  minWidth?: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          `repeat(auto-fit, minmax(${minWidth}, 1fr))`,
        gap: "8px",
      }}
    >
      {children}
    </div>
  );
}

function CheckboxItem({
  name,
  value,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  value: string;
  label: string;
  description?: string;
  defaultChecked: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems:
          description
            ? "flex-start"
            : "center",
        gap: "8px",
        padding: "12px",
        border:
          "1px solid #e4e7ec",
        borderRadius: "9px",
        background: "#ffffff",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={
          defaultChecked
        }
        style={{
          width: "16px",
          height: "16px",
          marginTop:
            description
              ? "1px"
              : 0,
          accentColor:
            "#175cd3",
        }}
      />

      <div>
        <div
          style={{
            color: "#344054",
            fontSize: "11px",
            fontWeight: 800,
          }}
        >
          {label}
        </div>

        {description && (
          <div
            style={{
              marginTop: "3px",
              color: "#98a2b3",
              fontSize: "9px",
              lineHeight: 1.5,
            }}
          >
            {description}
          </div>
        )}
      </div>
    </label>
  );
}

function InfoNotice({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginTop: "12px",
        padding: "12px 14px",
        border:
          "1px solid #dbe6ff",
        borderRadius: "9px",
        background: "#f8faff",
        color: "#475467",
        fontSize: "10px",
        lineHeight: 1.7,
      }}
    >
      {children}
    </div>
  );
}

function ReadonlyCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        padding: "15px",
        border:
          "1px solid #dbe6ff",
        borderRadius: "10px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          color: "#175cd3",
          fontSize: "11px",
          fontWeight: 900,
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: "5px",
          color: "#667085",
          fontSize: "10px",
          lineHeight: 1.65,
        }}
      >
        {description}
      </div>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  padding: "22px",
  border:
    "1px solid #e4e7ec",
  borderRadius: "14px",
  background: "#ffffff",
  boxShadow:
    "0 6px 20px rgba(16,24,40,0.03)",
};