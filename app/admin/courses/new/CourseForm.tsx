"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function CourseForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] =
    useState("");

  const [courseType, setCourseType] =
    useState("video_english");

  const [targetGroup, setTargetGroup] =
    useState("all");

  const [
    subjectCategory,
    setSubjectCategory,
  ] = useState("comprehensive");

  const [level, setLevel] =
    useState("all");

  const [classFormat, setClassFormat] =
    useState("one_to_one");

  const [
    durationMinutes,
    setDurationMinutes,
  ] = useState("25");

  const [
    lessonsPerWeek,
    setLessonsPerWeek,
  ] = useState("2");

  const [
    totalLessons,
    setTotalLessons,
  ] = useState("24");

  const [
    durationWeeks,
    setDurationWeeks,
  ] = useState("12");

  const [price, setPrice] =
    useState("");

  const [isActive, setIsActive] =
    useState(true);

  const [loading, setLoading] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage(
        "과정명을 입력해주세요."
      );
      return;
    }

    if (!targetGroup) {
      setErrorMessage(
        "수강 대상을 선택해주세요."
      );
      return;
    }

    if (!subjectCategory) {
      setErrorMessage(
        "과정 분야를 선택해주세요."
      );
      return;
    }

    if (!level) {
      setErrorMessage(
        "학습 레벨을 선택해주세요."
      );
      return;
    }

    if (!classFormat) {
      setErrorMessage(
        "수업 형태를 선택해주세요."
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
      Number(totalLessons) <= 0
    ) {
      setErrorMessage(
        "총 수업 횟수를 확인해주세요."
      );
      return;
    }

    if (
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
        setErrorMessage(
          "로그인 정보를 확인할 수 없습니다."
        );
        setLoading(false);
        return;
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
        profile?.role !== "admin"
      ) {
        setErrorMessage(
          "관리자 권한을 확인할 수 없습니다."
        );
        setLoading(false);
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from("courses")
        .insert({
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
            Number(
              totalLessons
            ),

          duration_weeks:
            Number(
              durationWeeks
            ),

          price: price
            ? Number(price)
            : null,

          is_active:
            isActive,

          updated_at:
            new Date().toISOString(),
        })
        .select("id");

      if (error) {
        setErrorMessage(
          `과정 등록 실패: ${error.message} / code: ${error.code}`
        );

        setLoading(false);
        return;
      }

      if (
        !data ||
        data.length === 0
      ) {
        setErrorMessage(
          "과정 등록 요청은 처리되었지만 저장된 정보를 확인할 수 없습니다."
        );

        setLoading(false);
        return;
      }

      router.push(
        "/admin/courses"
      );

      router.refresh();
    } catch (error) {
      console.error(
        "COURSE CREATE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `과정 등록 오류: ${error.message}`
          : "과정 등록 중 알 수 없는 오류가 발생했습니다."
      );

      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: "30px",
        display: "grid",
        gap: "20px",
      }}
    >
      <section style={cardStyle}>
        <SectionTitle
          title="기본 정보"
          description="과정명과 기본 서비스 유형을 설정합니다."
        />

        <div
          style={{
            marginTop: "22px",
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: "18px",
          }}
        >
          <Field
            label="과정명 *"
          >
            <input
              type="text"
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value
                )
              }
              required
              placeholder="예: 초등 회화 Starter"
              style={fieldStyle}
            />
          </Field>

          <Field
            label="서비스 유형"
          >
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
          <Field
            label="과정 설명"
          >
            <textarea
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value
                )
              }
              rows={5}
              placeholder="과정에 대한 설명을 입력해주세요."
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
          description="수강생과 관리자가 과정을 쉽게 구분할 수 있도록 설정합니다."
        />

        <div
          style={{
            marginTop: "22px",
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: "18px",
          }}
        >
          <Field label="수강 대상 *">
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

          <Field label="과정 분야 *">
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

          <Field label="학습 레벨 *">
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

          <Field label="수업 형태 *">
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
          description="기본 수업시간, 횟수 및 수강기간을 설정합니다."
        />

        <div
          style={{
            marginTop: "22px",
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
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
              {[10,20,25,30,40,50,60].map(
                (value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {value}분
                  </option>
                )
              )}
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
              value={durationWeeks}
              onChange={(event) =>
                setDurationWeeks(
                  event.target.value
                )
              }
              style={fieldStyle}
            />
            <Helper>
              주 단위입니다.
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
              placeholder="예: 240000"
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
          description="신규 수강등록에서 사용할 수 있는 과정인지 설정합니다."
        />

        <label
          style={{
            marginTop: "20px",
            padding: "18px",
            display: "flex",
            gap: "12px",
            alignItems:
              "flex-start",
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
              accentColor: "#2f6fed",
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
              비활성화하면 신규 수강등록 과정
              선택에서 제외할 수 있습니다.
            </div>
          </div>
        </label>
      </section>

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
          }}
        >
          {errorMessage}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent:
            "flex-end",
        }}
      >
        <button
          type="submit"
          disabled={loading}
          style={{
            minHeight: "48px",
            padding: "0 24px",
            border: "none",
            borderRadius: "10px",
            background: "#0A1F44",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: 900,
            cursor: loading
              ? "default"
              : "pointer",
            opacity: loading
              ? 0.6
              : 1,
          }}
        >
          {loading
            ? "과정 등록 중..."
            : "과정 등록"}
        </button>
      </div>
    </form>
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
  children: React.ReactNode;
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
  children: React.ReactNode;
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
  border: "1px solid #e4e7ec",
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
  boxSizing: "border-box" as const,
  padding: "0 12px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "13px",
  outline: "none",
};