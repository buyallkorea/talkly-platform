"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Enrollment = {
  id: number;
  student_user_id: string | null;
  child_id: number | null;
  course_id: number;
  teacher_user_id: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  lessons_per_week: number | null;
  total_lessons: number | null;
};

type Teacher = {
  user_id: string;
  display_name: string | null;
};

type Props = {
  enrollment: Enrollment;
  studentName: string;
  courseName: string;
  teachers: Teacher[];
};

export default function EditEnrollmentForm({
  enrollment,
  studentName,
  courseName,
  teachers,
}: Props) {
  const router = useRouter();

  const [teacherUserId, setTeacherUserId] = useState(
    enrollment.teacher_user_id || ""
  );

  const [status, setStatus] = useState(
    enrollment.status
  );

  const [startDate, setStartDate] = useState(
    enrollment.start_date || ""
  );

  const [endDate, setEndDate] = useState(
    enrollment.end_date || ""
  );

  const [lessonsPerWeek, setLessonsPerWeek] =
    useState(
      enrollment.lessons_per_week != null
        ? String(enrollment.lessons_per_week)
        : ""
    );

  const [totalLessons, setTotalLessons] = useState(
    enrollment.total_lessons != null
      ? String(enrollment.total_lessons)
      : ""
  );

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (!startDate) {
      setErrorMessage("수강 시작일을 입력해주세요.");
      return;
    }

    if (
      endDate &&
      new Date(endDate) < new Date(startDate)
    ) {
      setErrorMessage(
        "수강 종료일은 시작일보다 빠를 수 없습니다."
      );
      return;
    }

    if (
      lessonsPerWeek &&
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
        .from("enrollments")
        .update({
          teacher_user_id:
            teacherUserId || null,
          status,
          start_date: startDate,
          end_date: endDate || null,
          lessons_per_week: lessonsPerWeek
            ? Number(lessonsPerWeek)
            : null,
          total_lessons: totalLessons
            ? Number(totalLessons)
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollment.id)
        .select();

      if (error) {
        setErrorMessage(
          `수강정보 수정 실패: ${error.message} / code: ${error.code}`
        );
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setErrorMessage(
          "수정된 수강정보를 확인할 수 없습니다."
        );
        setLoading(false);
        return;
      }

      router.push(
        `/admin/enrollments/${enrollment.id}`
      );
      router.refresh();
    } catch (error) {
      console.error(
        "ENROLLMENT UPDATE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `수강정보 수정 오류: ${error.message}`
          : "수강정보 수정 중 알 수 없는 오류가 발생했습니다."
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
        <label style={labelStyle}>
          학생
        </label>

        <div
          style={{
            ...fieldStyle,
            background: "#f5f5f5",
          }}
        >
          {studentName}
        </div>
      </div>

      <div>
        <label style={labelStyle}>
          수강 과정
        </label>

        <div
          style={{
            ...fieldStyle,
            background: "#f5f5f5",
          }}
        >
          {courseName}
        </div>
      </div>

      <div>
        <label
          htmlFor="teacher"
          style={labelStyle}
        >
          담당 강사
        </label>

        <select
          id="teacher"
          value={teacherUserId}
          onChange={(event) =>
            setTeacherUserId(event.target.value)
          }
          style={fieldStyle}
        >
          <option value="">
            미배정
          </option>

          {teachers.map((teacher) => (
            <option
              key={teacher.user_id}
              value={teacher.user_id}
            >
              {teacher.display_name ||
                "이름 미등록 강사"}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="status"
          style={labelStyle}
        >
          수강 상태
        </label>

        <select
          id="status"
          value={status}
          onChange={(event) =>
            setStatus(event.target.value)
          }
          style={fieldStyle}
        >
          <option value="pending">
            대기
          </option>

          <option value="active">
            수강중
          </option>

          <option value="paused">
            일시중지
          </option>

          <option value="completed">
            수강완료
          </option>

          <option value="cancelled">
            취소
          </option>
        </select>
      </div>

      <div>
        <label
          htmlFor="startDate"
          style={labelStyle}
        >
          수강 시작일
        </label>

        <input
          id="startDate"
          type="date"
          value={startDate}
          onChange={(event) =>
            setStartDate(event.target.value)
          }
          required
          style={fieldStyle}
        />
      </div>

      <div>
        <label
          htmlFor="endDate"
          style={labelStyle}
        >
          수강 종료일
        </label>

        <input
          id="endDate"
          type="date"
          value={endDate}
          onChange={(event) =>
            setEndDate(event.target.value)
          }
          style={fieldStyle}
        />
      </div>

      <div>
        <label
          htmlFor="lessonsPerWeek"
          style={labelStyle}
        >
          주당 수업 횟수
        </label>

        <input
          id="lessonsPerWeek"
          type="number"
          min="1"
          max="7"
          value={lessonsPerWeek}
          onChange={(event) =>
            setLessonsPerWeek(event.target.value)
          }
          style={fieldStyle}
        />
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
            setTotalLessons(event.target.value)
          }
          style={fieldStyle}
        />
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
          ? "수강정보 수정 중..."
          : "수강정보 수정"}
      </button>
    </form>
  );
}