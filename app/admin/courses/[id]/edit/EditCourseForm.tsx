"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Course = {
  id: number | string;
  name: string;
  description: string | null;
  course_type: string;

  target_group: string | null;
  subject_category: string | null;
  level: string | null;
  class_format: string | null;

  duration_minutes: number;
  lessons_per_week: number | null;
  total_lessons: number | null;
  duration_weeks: number | null;
  price: number | null;
  is_active: boolean;

  created_at?: string | null;
  updated_at?: string | null;
};

type UsageCounts = {
  enrollments: number;
  enrollmentRequests: number;
  enrollmentOptions: number;
  coursePricing: number;
};

export default function EditCourseForm({
  course,
  canDelete,
  usageCounts,
}: {
  course: Course;
  canDelete: boolean;
  usageCounts: UsageCounts;
}) {
  const router = useRouter();

  const [name, setName] =
    useState(course.name);

  const [
    description,
    setDescription,
  ] = useState(
    course.description || ""
  );

  const [
    courseType,
    setCourseType,
  ] = useState(
    course.course_type
  );

  const [
    targetGroup,
    setTargetGroup,
  ] = useState(
    course.target_group || "all"
  );

  const [
    subjectCategory,
    setSubjectCategory,
  ] = useState(
    course.subject_category ||
      "comprehensive"
  );

  const [level, setLevel] =
    useState(
      course.level || "all"
    );

  const [
    classFormat,
    setClassFormat,
  ] = useState(
    course.class_format ||
      "one_to_one"
  );

  const [
    durationMinutes,
    setDurationMinutes,
  ] = useState(
    String(
      course.duration_minutes
    )
  );

  const [
    lessonsPerWeek,
    setLessonsPerWeek,
  ] = useState(
    String(
      course.lessons_per_week ??
        2
    )
  );

  const [
    totalLessons,
    setTotalLessons,
  ] = useState(
    String(
      course.total_lessons ??
        ""
    )
  );

  const [
    durationWeeks,
    setDurationWeeks,
  ] = useState(
    String(
      course.duration_weeks ??
        ""
    )
  );

  const [price, setPrice] =
    useState(
      course.price != null
        ? String(course.price)
        : ""
    );

  const [
    isActive,
    setIsActive,
  ] = useState(
    course.is_active
  );

  const [loading, setLoading] =
    useState(false);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const estimatedLessons =
    useMemo(() => {
      const perWeek =
        Number(lessonsPerWeek);

      const weeks =
        Number(durationWeeks);

      if (
        !Number.isFinite(perWeek) ||
        !Number.isFinite(weeks) ||
        perWeek <= 0 ||
        weeks <= 0
      ) {
        return null;
      }

      return perWeek * weeks;
    }, [
      lessonsPerWeek,
      durationWeeks,
    ]);

  async function verifyAdmin() {
    const supabase =
      createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      throw new Error(
        "로그인 정보를 확인할 수 없습니다."
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin"
    ) {
      throw new Error(
        "관리자 권한을 확인할 수 없습니다."
      );
    }

    return {
      supabase,
      user,
    };
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!name.trim()) {
      setErrorMessage(
        "과정명을 입력해주세요."
      );
      return;
    }

    if (
      Number(durationMinutes) <= 0
    ) {
      setErrorMessage(
        "수업시간을 확인해주세요."
      );
      return;
    }

    if (
      Number(lessonsPerWeek) <= 0
    ) {
      setErrorMessage(
        "주당 수업 횟수를 확인해주세요."
      );
      return;
    }

    if (
      totalLessons &&
      Number(totalLessons) <= 0
    ) {
      setErrorMessage(
        "총 수업 횟수를 확인해주세요."
      );
      return;
    }

    if (
      durationWeeks &&
      Number(durationWeeks) <= 0
    ) {
      setErrorMessage(
        "수강기간을 확인해주세요."
      );
      return;
    }

    if (
      price &&
      Number(price) < 0
    ) {
      setErrorMessage(
        "수강료를 확인해주세요."
      );
      return;
    }

    setLoading(true);

    try {
      const { supabase } =
        await verifyAdmin();

      const {
        data,
        error,
      } = await supabase
        .from("courses")
        .update({
          name:
            name.trim(),

          description:
            description.trim() ||
            null,

          course_type:
            courseType,

          target_group:
            targetGroup,

          subject_category:
            subjectCategory,

          level,

          class_format:
            classFormat,

          duration_minutes:
            Number(
              durationMinutes
            ),

          lessons_per_week:
            Number(
              lessonsPerWeek
            ),

          total_lessons:
            totalLessons
              ? Number(
                  totalLessons
                )
              : null,

          duration_weeks:
            durationWeeks
              ? Number(
                  durationWeeks
                )
              : null,

          price:
            price
              ? Number(price)
              : null,

          is_active:
            isActive,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", course.id)
        .select("id");

      if (error) {
        throw new Error(
          `과정 수정 실패: ${error.message}`
        );
      }

      if (
        !data ||
        data.length === 0
      ) {
        throw new Error(
          "수정된 과정 정보를 확인할 수 없습니다."
        );
      }

      setSuccessMessage(
        "과정 정보가 저장되었습니다."
      );

      router.refresh();
    } catch (error) {
      console.error(
        "COURSE UPDATE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "과정 수정 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!canDelete) {
      setErrorMessage(
        "수강 또는 신청 이력이 있는 과정은 삭제할 수 없습니다. 운영하지 않는 경우 과정을 비활성화해주세요."
      );
      return;
    }

    const firstConfirm =
      window.confirm(
        `"${course.name}" 과정을 영구 삭제하시겠습니까?\n\n삭제한 과정은 복구할 수 없습니다.`
      );

    if (!firstConfirm) {
      return;
    }

    const secondConfirm =
      window.confirm(
        "정말 삭제하시겠습니까?\n과정에 연결된 가격 정책도 함께 삭제됩니다."
      );

    if (!secondConfirm) {
      return;
    }

    setDeleting(true);

    try {
      const { supabase } =
        await verifyAdmin();

      /*
       * 삭제 직전에 다시 확인합니다.
       * 상세 페이지를 연 뒤 새 수강/신청이 생성됐을 수도
       * 있기 때문입니다.
       */
      const [
        enrollmentCheck,
        requestCheck,
        optionCheck,
      ] = await Promise.all([
        supabase
          .from("enrollments")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "course_id",
            course.id
          ),

        supabase
          .from(
            "enrollment_requests"
          )
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "course_id",
            course.id
          ),

        supabase
          .from(
            "enrollment_options"
          )
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "course_id",
            course.id
          ),
      ]);

      const checkError =
        enrollmentCheck.error ||
        requestCheck.error ||
        optionCheck.error;

      if (checkError) {
        throw new Error(
          checkError.message
        );
      }

      const hasUsage =
        (enrollmentCheck.count ??
          0) > 0 ||
        (requestCheck.count ??
          0) > 0 ||
        (optionCheck.count ??
          0) > 0;

      if (hasUsage) {
        throw new Error(
          "삭제를 시도하는 동안 이 과정에 새로운 수강 또는 신청 정보가 연결되었습니다. 삭제할 수 없으므로 비활성화해주세요."
        );
      }

      const {
        data,
        error,
      } = await supabase
        .from("courses")
        .delete()
        .eq("id", course.id)
        .select("id");

      if (error) {
        throw new Error(
          `과정 삭제 실패: ${error.message}`
        );
      }

      if (
        !data ||
        data.length === 0
      ) {
        throw new Error(
          "과정이 삭제되지 않았습니다."
        );
      }

      router.push(
        "/admin/courses"
      );

      router.refresh();
    } catch (error) {
      console.error(
        "COURSE DELETE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "과정 삭제 중 오류가 발생했습니다."
      );

      setDeleting(false);
    }
  }

  const disabled =
    loading || deleting;

  return (
    <div
      style={{
        marginTop: "24px",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gap: "20px",
        }}
      >
        <section style={cardStyle}>
          <SectionTitle
            title="기본 정보"
            description="과정명과 서비스 유형을 수정합니다."
          />

          <div
            style={{
              marginTop: "22px",
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0,1fr))",
              gap: "18px",
            }}
          >
            <Field label="과정명 *">
              <input
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value
                  )
                }
                required
                style={fieldStyle}
              />
            </Field>

            <Field label="서비스 유형">
              <select
                value={courseType}
                onChange={(event) =>
                  setCourseType(
                    event.target.value
                  )
                }
                style={fieldStyle}
              >
                <option value="video_english">
                  화상영어
                </option>

                <option value="phone_english">
                  전화영어
                </option>

                <option value="experience">
                  체험영어
                </option>

                <option value="other">
                  기타
                </option>
              </select>
            </Field>
          </div>

          <div
            style={{
              marginTop: "18px",
            }}
          >
            <Field label="과정 설명">
              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
                rows={5}
                style={{
                  ...fieldStyle,
                  minHeight: "130px",
                  padding: "13px 14px",
                  resize: "vertical",
                  lineHeight: 1.7,
                }}
              />
            </Field>
          </div>
        </section>

        <section style={cardStyle}>
          <SectionTitle
            title="학습 분류"
            description="대상, 과정 분야, 레벨 및 수업 형태를 설정합니다."
          />

          <div
            style={{
              marginTop: "22px",
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0,1fr))",
              gap: "18px",
            }}
          >
            <Field label="수강 대상">
              <select
                value={targetGroup}
                onChange={(event) =>
                  setTargetGroup(
                    event.target.value
                  )
                }
                style={fieldStyle}
              >
                <option value="preschool">
                  영유아
                </option>
                <option value="elementary">
                  초등
                </option>
                <option value="middle">
                  중등
                </option>
                <option value="high">
                  고등
                </option>
                <option value="university">
                  대학생
                </option>
                <option value="adult">
                  성인
                </option>
                <option value="senior">
                  시니어
                </option>
                <option value="all">
                  전연령
                </option>
              </select>
            </Field>

            <Field label="과정 분야">
              <select
                value={
                  subjectCategory
                }
                onChange={(event) =>
                  setSubjectCategory(
                    event.target.value
                  )
                }
                style={fieldStyle}
              >
                <option value="conversation">
                  회화
                </option>
                <option value="phonics">
                  파닉스
                </option>
                <option value="reading">
                  리딩
                </option>
                <option value="grammar">
                  문법
                </option>
                <option value="writing">
                  작문
                </option>
                <option value="test">
                  시험
                </option>
                <option value="business">
                  비즈니스
                </option>
                <option value="experiential">
                  체험영어
                </option>
                <option value="comprehensive">
                  종합
                </option>
                <option value="other">
                  기타
                </option>
              </select>
            </Field>

            <Field label="학습 레벨">
              <select
                value={level}
                onChange={(event) =>
                  setLevel(
                    event.target.value
                  )
                }
                style={fieldStyle}
              >
                <option value="beginner">
                  입문
                </option>
                <option value="elementary">
                  초급
                </option>
                <option value="pre_intermediate">
                  초중급
                </option>
                <option value="intermediate">
                  중급
                </option>
                <option value="upper_intermediate">
                  중고급
                </option>
                <option value="advanced">
                  고급
                </option>
                <option value="all">
                  레벨 무관
                </option>
              </select>
            </Field>

            <Field label="수업 형태">
              <select
                value={classFormat}
                onChange={(event) =>
                  setClassFormat(
                    event.target.value
                  )
                }
                style={fieldStyle}
              >
                <option value="one_to_one">
                  1:1
                </option>
                <option value="group">
                  그룹
                </option>
              </select>
            </Field>
          </div>
        </section>

        <section style={cardStyle}>
          <SectionTitle
            title="수업 구성"
            description="수업 시간과 기본 수강조건을 관리합니다."
          />

          <div
            style={{
              marginTop: "22px",
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0,1fr))",
              gap: "18px",
            }}
          >
            <Field label="1회 수업시간">
              <select
                value={
                  durationMinutes
                }
                onChange={(event) =>
                  setDurationMinutes(
                    event.target.value
                  )
                }
                style={fieldStyle}
              >
                {[
                  10,
                  20,
                  25,
                  30,
                  40,
                  50,
                  60,
                ].map((value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {value}분
                  </option>
                ))}
              </select>
            </Field>

            <Field label="주당 수업 횟수">
              <select
                value={
                  lessonsPerWeek
                }
                onChange={(event) =>
                  setLessonsPerWeek(
                    event.target.value
                  )
                }
                style={fieldStyle}
              >
                {[1,2,3,4,5].map(
                  (value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      주 {value}회
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="기본 수강기간">
              <input
                type="number"
                min="1"
                value={
                  durationWeeks
                }
                onChange={(event) =>
                  setDurationWeeks(
                    event.target.value
                  )
                }
                style={fieldStyle}
              />

              <Helper>
                주 단위
              </Helper>
            </Field>

            <Field label="총 수업 횟수">
              <input
                type="number"
                min="1"
                value={totalLessons}
                onChange={(event) =>
                  setTotalLessons(
                    event.target.value
                  )
                }
                style={fieldStyle}
              />

              {estimatedLessons !==
                null && (
                <Helper>
                  주당 횟수 × 기간 기준
                  예상 {estimatedLessons}회
                </Helper>
              )}
            </Field>

            <Field label="기본 수강료">
              <input
                type="number"
                min="0"
                step="1000"
                value={price}
                onChange={(event) =>
                  setPrice(
                    event.target.value
                  )
                }
                style={fieldStyle}
              />

              <Helper>
                대한민국 원(KRW)
              </Helper>
            </Field>
          </div>
        </section>

        <section style={cardStyle}>
          <SectionTitle
            title="운영 상태"
            description="신규 수강 과정 선택에 노출할지 설정합니다."
          />

          <label
            style={{
              marginTop: "20px",
              padding: "18px",
              display: "flex",
              alignItems:
                "flex-start",
              gap: "12px",
              border:
                "1px solid #e4e7ec",
              borderRadius: "12px",
              background: "#f9fafb",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) =>
                setIsActive(
                  event.target.checked
                )
              }
              style={{
                width: "18px",
                height: "18px",
                marginTop: "1px",
                accentColor:
                  "#2f6fed",
              }}
            />

            <div>
              <div
                style={{
                  color: "#101828",
                  fontSize: "14px",
                  fontWeight: 900,
                }}
              >
                과정 활성화
              </div>

              <div
                style={{
                  marginTop: "5px",
                  color: "#667085",
                  fontSize: "12px",
                  lineHeight: 1.6,
                }}
              >
                OFF로 변경하면 신규 수강등록에서
                선택하지 못하도록 운영할 수 있습니다.
              </div>
            </div>
          </label>
        </section>

        {successMessage && (
          <div
            style={{
              padding: "14px 16px",
              border:
                "1px solid #abefc6",
              borderRadius: "10px",
              background: "#ecfdf3",
              color: "#027a48",
              fontSize: "13px",
              fontWeight: 800,
            }}
          >
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              padding: "14px 16px",
              border:
                "1px solid #fecdca",
              borderRadius: "10px",
              background: "#fef3f2",
              color: "#b42318",
              fontSize: "13px",
              fontWeight: 700,
              lineHeight: 1.6,
            }}
          >
            {errorMessage}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() =>
              router.push(
                "/admin/courses"
              )
            }
            disabled={disabled}
            style={secondaryButtonStyle}
          >
            ← 목록으로 돌아가기
          </button>

          <button
            type="submit"
            disabled={disabled}
            style={{
              minHeight: "48px",
              padding: "0 24px",
              border: "none",
              borderRadius: "10px",
              background: "#0A1F44",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 900,
              cursor: disabled
                ? "default"
                : "pointer",
              opacity: disabled
                ? 0.6
                : 1,
            }}
          >
            {loading
              ? "저장 중..."
              : "변경사항 저장"}
          </button>
        </div>
      </form>

      <section
        style={{
          marginTop: "30px",
          padding: "22px",
          border: "1px solid #fecdca",
          borderRadius: "14px",
          background: "#fffafa",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#b42318",
            fontSize: "17px",
          }}
        >
          과정 영구 삭제
        </h2>

        <p
          style={{
            margin: "8px 0 0",
            color: "#667085",
            fontSize: "12px",
            lineHeight: 1.7,
          }}
        >
          삭제된 과정은 복구할 수 없습니다.
          수강, 수강신청 또는 수강 가능 일정에서
          사용된 과정은 삭제할 수 없습니다.
        </p>

        {!canDelete && (
          <div
            style={{
              marginTop: "15px",
              padding: "14px",
              border:
                "1px solid #fed7aa",
              borderRadius: "10px",
              background: "#fff7ed",
              color: "#b54708",
              fontSize: "12px",
              fontWeight: 800,
              lineHeight: 1.7,
            }}
          >
            삭제 불가 · 수강{" "}
            {usageCounts.enrollments}건 ·
            수강신청{" "}
            {usageCounts.enrollmentRequests}건 ·
            수강 가능 일정{" "}
            {usageCounts.enrollmentOptions}건이 연결되어
            있습니다. 이 과정은 비활성화해서
            운영해주세요.
          </div>
        )}

        {canDelete &&
          usageCounts.coursePricing >
            0 && (
            <div
              style={{
                marginTop: "15px",
                padding: "14px",
                border:
                  "1px solid #bfd0ff",
                borderRadius: "10px",
                background: "#f5f8ff",
                color: "#475467",
                fontSize: "12px",
                lineHeight: 1.7,
              }}
            >
              이 과정을 삭제하면 연결된 가격 정책{" "}
              {usageCounts.coursePricing}건도 함께
              삭제됩니다.
            </div>
          )}

        <button
          type="button"
          onClick={handleDelete}
          disabled={
            disabled ||
            !canDelete
          }
          style={{
            marginTop: "18px",
            minHeight: "42px",
            padding: "0 16px",
            border:
              "1px solid #fda29b",
            borderRadius: "9px",
            background:
              canDelete
                ? "#ffffff"
                : "#f2f4f7",
            color:
              canDelete
                ? "#b42318"
                : "#98a2b3",
            fontSize: "13px",
            fontWeight: 900,
            cursor:
              canDelete &&
              !disabled
                ? "pointer"
                : "default",
          }}
        >
          {deleting
            ? "과정 삭제 중..."
            : "과정 영구 삭제"}
        </button>
      </section>
    </div>
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

function Field({
  label,
  children,
}: {
  label: string;
  children:
    React.ReactNode;
}) {
  return (
    <div>
      <label style={labelStyle}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Helper({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div
      style={{
        marginTop: "6px",
        color: "#98a2b3",
        fontSize: "11px",
      }}
    >
      {children}
    </div>
  );
}

const cardStyle = {
  padding: "26px",
  border:
    "1px solid #e4e7ec",
  borderRadius: "16px",
  background: "#ffffff",
};

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  color: "#344054",
  fontSize: "13px",
  fontWeight: 900,
};

const fieldStyle = {
  width: "100%",
  minHeight: "44px",
  boxSizing:
    "border-box" as const,
  padding: "0 12px",
  border:
    "1px solid #d0d5dd",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "13px",
  outline: "none",
};

const secondaryButtonStyle = {
  minHeight: "46px",
  padding: "0 18px",
  border:
    "1px solid #d0d5dd",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#344054",
  fontSize: "13px",
  fontWeight: 800,
  cursor: "pointer",
};