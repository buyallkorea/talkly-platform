"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Session = {
  id: number;
  lessonNumber: number;
  lessonDate: string;
  startTime: string;
  durationMinutes: number;
  status: string;
  meetingProvider: string | null;
  meetingUrl: string | null;
  teacherNotes: string | null;
};

type Props = {
  enrollmentId: number;
  session: Session;
};

export default function EditLessonForm({
  enrollmentId,
  session,
}: Props) {
  const router = useRouter();

  const [lessonDate, setLessonDate] = useState(
    session.lessonDate
  );

  const [startTime, setStartTime] = useState(
    session.startTime
  );

  const [durationMinutes, setDurationMinutes] =
    useState(String(session.durationMinutes));

  const [status, setStatus] = useState(
    session.status
  );

  const [meetingProvider, setMeetingProvider] =
    useState(session.meetingProvider || "zoom");

  const [meetingUrl, setMeetingUrl] = useState(
    session.meetingUrl || ""
  );

  const [teacherNotes, setTeacherNotes] =
    useState(session.teacherNotes || "");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (!lessonDate) {
      setErrorMessage(
        "수업일을 입력해주세요."
      );
      return;
    }

    if (!startTime) {
      setErrorMessage(
        "수업 시작시간을 입력해주세요."
      );
      return;
    }

    if (Number(durationMinutes) <= 0) {
      setErrorMessage(
        "수업시간을 확인해주세요."
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
        setErrorMessage(
          "관리자 권한을 확인할 수 없습니다."
        );
        setLoading(false);
        return;
      }

      /*
        입력된 날짜/시간은 한국시간으로 해석해서
        UTC timestamptz 형태로 저장합니다.
      */
      const startDateTime = new Date(
        `${lessonDate}T${startTime}:00+09:00`
      );

      const endDateTime = new Date(
        startDateTime.getTime() +
          Number(durationMinutes) * 60 * 1000
      );

      const { data, error } = await supabase
        .from("class_sessions")
        .update({
          scheduled_start:
            startDateTime.toISOString(),

          scheduled_end:
            endDateTime.toISOString(),

          status,

          meeting_provider:
            meetingProvider || null,

          meeting_url:
            meetingUrl.trim() || null,

          teacher_notes:
            teacherNotes.trim() || null,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", session.id)
        .eq(
          "enrollment_id",
          enrollmentId
        )
        .select();

      if (error) {
        setErrorMessage(
          `수업정보 수정 실패: ${error.message} / code: ${error.code}`
        );

        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setErrorMessage(
          "수정된 수업정보를 확인할 수 없습니다."
        );

        setLoading(false);
        return;
      }

      router.push(
        `/admin/enrollments/${enrollmentId}/lessons/${session.id}`
      );

      router.refresh();
    } catch (error) {
      console.error(
        "CLASS SESSION UPDATE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `수업정보 수정 오류: ${error.message}`
          : "수업정보 수정 중 알 수 없는 오류가 발생했습니다."
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
        maxWidth: "650px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      <div>
        <label style={labelStyle}>
          회차
        </label>

        <div
          style={{
            ...fieldStyle,
            background: "#f5f5f5",
          }}
        >
          {session.lessonNumber}회차
        </div>
      </div>

      <div>
        <label
          htmlFor="lessonDate"
          style={labelStyle}
        >
          수업일
        </label>

        <input
          id="lessonDate"
          type="date"
          value={lessonDate}
          onChange={(event) =>
            setLessonDate(
              event.target.value
            )
          }
          required
          style={fieldStyle}
        />
      </div>

      <div>
        <label
          htmlFor="startTime"
          style={labelStyle}
        >
          수업 시작시간
        </label>

        <input
          id="startTime"
          type="time"
          value={startTime}
          onChange={(event) =>
            setStartTime(
              event.target.value
            )
          }
          required
          style={fieldStyle}
        />
      </div>

      <div>
        <label
          htmlFor="durationMinutes"
          style={labelStyle}
        >
          수업시간
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
          <option value="10">
            10분
          </option>

          <option value="20">
            20분
          </option>

          <option value="25">
            25분
          </option>

          <option value="30">
            30분
          </option>

          <option value="40">
            40분
          </option>

          <option value="50">
            50분
          </option>

          <option value="60">
            60분
          </option>
        </select>
      </div>

      <div>
        <label
          htmlFor="status"
          style={labelStyle}
        >
          수업 상태
        </label>

        <select
          id="status"
          value={status}
          onChange={(event) =>
            setStatus(
              event.target.value
            )
          }
          style={fieldStyle}
        >
          <option value="scheduled">
            예정
          </option>

          <option value="completed">
            완료
          </option>

          <option value="absent">
            결석
          </option>

          <option value="makeup">
            보강
          </option>

          <option value="cancelled">
            취소
          </option>
        </select>
      </div>

      <div>
        <label
          htmlFor="meetingProvider"
          style={labelStyle}
        >
          화상수업 플랫폼
        </label>

        <select
          id="meetingProvider"
          value={meetingProvider}
          onChange={(event) =>
            setMeetingProvider(
              event.target.value
            )
          }
          style={fieldStyle}
        >
          <option value="zoom">
            Zoom
          </option>

          <option value="google_meet">
            Google Meet
          </option>

          <option value="daily">
            Daily
          </option>

          <option value="whereby">
            Whereby
          </option>

          <option value="other">
            기타
          </option>
        </select>
      </div>

      <div>
        <label
          htmlFor="meetingUrl"
          style={labelStyle}
        >
          화상수업 링크
        </label>

        <input
          id="meetingUrl"
          type="url"
          value={meetingUrl}
          onChange={(event) =>
            setMeetingUrl(
              event.target.value
            )
          }
          placeholder="예: https://zoom.us/j/..."
          style={fieldStyle}
        />

        <small>
          아직 링크가 없으면 비워두어도 됩니다.
        </small>
      </div>

      <div>
        <label
          htmlFor="teacherNotes"
          style={labelStyle}
        >
          강사 / 관리자 메모
        </label>

        <textarea
          id="teacherNotes"
          value={teacherNotes}
          onChange={(event) =>
            setTeacherNotes(
              event.target.value
            )
          }
          rows={6}
          placeholder="수업 내용, 변경 사유, 특이사항 등을 입력해주세요."
          style={{
            ...fieldStyle,
            resize: "vertical",
          }}
        />
      </div>

      {errorMessage && (
        <div
          style={{
            padding: "14px",
            border:
              "1px solid #d93025",
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
          padding: "15px",
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
          ? "수업정보 수정 중..."
          : "수업정보 수정"}
      </button>
    </form>
  );
}