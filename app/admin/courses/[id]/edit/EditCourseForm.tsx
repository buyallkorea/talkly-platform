"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Course = {
  id: string;
  name: string;
  description: string | null;
  course_type: string;
  duration_minutes: number;
  lessons_per_week: number | null;
  total_lessons: number | null;
  duration_weeks: number | null;
  price: number | null;
  is_active: boolean;
};

export default function EditCourseForm({
  course,
}: {
  course: Course;
}) {
  const router = useRouter();

  const [name, setName] = useState(course.name);
  const [description, setDescription] = useState(
    course.description || ""
  );
  const [courseType, setCourseType] = useState(
    course.course_type
  );

  const [durationMinutes, setDurationMinutes] = useState(
    String(course.duration_minutes)
  );

  const [lessonsPerWeek, setLessonsPerWeek] = useState(
    String(course.lessons_per_week ?? 2)
  );

  const [totalLessons, setTotalLessons] = useState(
    String(course.total_lessons ?? "")
  );

  const [durationWeeks, setDurationWeeks] = useState(
    String(course.duration_weeks ?? "")
  );

  const [price, setPrice] = useState(
    course.price != null ? String(course.price) : ""
  );

  const [isActive, setIsActive] = useState(
    course.is_active
  );

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage("과정명을 입력해주세요.");
      return;
    }

    if (Number(durationMinutes) <= 0) {
      setErrorMessage("수업시간을 확인해주세요.");
      return;
    }

    if (Number(lessonsPerWeek) <= 0) {
      setErrorMessage("주당 수업 횟수를 확인해주세요.");
      return;
    }

    if (
      totalLessons &&
      Number(totalLessons) <= 0
    ) {
      setErrorMessage("총 수업 횟수를 확인해주세요.");
      return;
    }

    if (
      durationWeeks &&
      Number(durationWeeks) <= 0
    ) {
      setErrorMessage("수강기간을 확인해주세요.");
      return;
    }

    if (price && Number(price) < 0) {
      setErrorMessage("수강료를 확인해주세요.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage(
          "로그인 정보를 확인할 수 없습니다."
        );
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

      if (
        profileError ||
        !profile ||
        profile.role !== "admin"
      ) {
        setErrorMessage(
          "관리자 권한을 확인할 수 없습니다."
        );
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("courses")
        .update({
          name: name.trim(),
          description:
            description.trim() || null,
          course_type: courseType,
          duration_minutes:
            Number(durationMinutes),
          lessons_per_week:
            Number(lessonsPerWeek),
          total_lessons: totalLessons
            ? Number(totalLessons)
            : null,
          duration_weeks: durationWeeks
            ? Number(durationWeeks)
            : null,
          price: price
            ? Number(price)
            : null,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", course.id)
        .select();

      if (error) {
        setErrorMessage(
          `과정 수정 실패: ${error.message} / code: ${error.code}`
        );
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setErrorMessage(
          "수정된 과정 정보를 확인할 수 없습니다."
        );
        setLoading(false);
        return;
      }

      router.push(
        `/admin/courses/${course.id}`
      );
      router.refresh();
    } catch (error) {
      console.error(
        "COURSE UPDATE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `과정 수정 오류: ${error.message}`
          : "과정 수정 중 알 수 없는 오류가 발생했습니다."
      );

      setLoading(false);
    }
  }

  const labelStyle = {
    display: "block",
    marginBottom: "8px",
    fontWeight: 600,
  };

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "12px 14px",
    border: "1px solid #d9d9d9",
    borderRadius: "8px",
    fontSize: "16px",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        width: "100%",
        maxWidth: "600px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      <div>
        <label
          htmlFor="name"
          style={labelStyle}
        >
          과정명
        </label>

        <input
          id="name"
          type="text"
          value={name}
          onChange={(event) =>
            setName(event.target.value)
          }
          required
          style={fieldStyle}
        />
      </div>

      <div>
        <label
          htmlFor="courseType"
          style={labelStyle}
        >
          과정 유형
        </label>

        <select
          id="courseType"
          value={courseType}
          onChange={(event) =>
            setCourseType(event.target.value)
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
      </div>

      <div>
        <label
          htmlFor="description"
          style={labelStyle}
        >
          과정 설명
        </label>

        <textarea
          id="description"
          value={description}
          onChange={(event) =>
            setDescription(event.target.value)
          }
          rows={4}
          style={{
            ...fieldStyle,
            resize: "vertical",
          }}
        />
      </div>

      <div>
        <label
          htmlFor="durationMinutes"
          style={labelStyle}
        >
          1회 수업시간
        </label>

        <select
          id="durationMinutes"
          value={durationMinutes}
          onChange={(event) =>
            setDurationMinutes(
              event.target.value
            )
          }
          style={fieldStyle}
        >
          <option value="10">10분</option>
          <option value="20">20분</option>
          <option value="25">25분</option>
          <option value="30">30분</option>
          <option value="40">40분</option>
          <option value="50">50분</option>
          <option value="60">60분</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="lessonsPerWeek"
          style={labelStyle}
        >
          주당 수업 횟수
        </label>

        <select
          id="lessonsPerWeek"
          value={lessonsPerWeek}
          onChange={(event) =>
            setLessonsPerWeek(
              event.target.value
            )
          }
          style={fieldStyle}
        >
          <option value="1">주 1회</option>
          <option value="2">주 2회</option>
          <option value="3">주 3회</option>
          <option value="4">주 4회</option>
          <option value="5">주 5회</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="durationWeeks"
          style={labelStyle}
        >
          기본 수강기간
        </label>

        <input
          id="durationWeeks"
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

        <small>주 단위입니다.</small>
      </div>

      <div>
        <label
          htmlFor="totalLessons"
          style={labelStyle}
        >
          총 수업 횟수
        </label>

        <input
          id="totalLessons"
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
      </div>

      <div>
        <label
          htmlFor="price"
          style={labelStyle}
        >
          기본 수강료
        </label>

        <input
          id="price"
          type="number"
          min="0"
          step="1000"
          value={price}
          onChange={(event) =>
            setPrice(event.target.value)
          }
          style={fieldStyle}
        />

        <small>
          대한민국 원(KRW) 기준입니다.
        </small>
      </div>

      <div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
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
          />

          과정 활성화
        </label>

        <small>
          비활성 과정은 신규 수강등록 대상에서
          제외할 수 있습니다.
        </small>
      </div>

      {errorMessage && (
        <div
          style={{
            padding: "12px",
            border: "1px solid #d93025",
            borderRadius: "8px",
            color: "#d93025",
          }}
        >
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "14px",
          border: "none",
          borderRadius: "8px",
          fontSize: "16px",
          fontWeight: 700,
          cursor: loading
            ? "default"
            : "pointer",
        }}
      >
        {loading
          ? "과정 수정 중..."
          : "과정 수정"}
      </button>
    </form>
  );
}