"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Props = {
  enrollmentId: number;
  teacherUserId: string | null;
  startDate: string | null;
  lessonsPerWeek: number;
  totalLessons: number;
  durationMinutes: number;
};

type ZoomMeetingResponse = {
  success: boolean;
  meeting?: {
    meetingId: string;
    joinUrl: string;
    startTime: string;
    durationMinutes: number;
    topic: string;
  };
  error?: unknown;
};

const WEEKDAYS = [
  { value: 1, label: "월요일" },
  { value: 2, label: "화요일" },
  { value: 3, label: "수요일" },
  { value: 4, label: "목요일" },
  { value: 5, label: "금요일" },
  { value: 6, label: "토요일" },
  { value: 0, label: "일요일" },
];

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function LessonScheduleForm({
  enrollmentId,
  teacherUserId,
  startDate,
  lessonsPerWeek,
  totalLessons,
  durationMinutes,
}: Props) {
  const router = useRouter();

  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [lessonTime, setLessonTime] = useState("19:00");
  const [firstDate, setFirstDate] = useState(startDate || "");
  const [meetingProvider, setMeetingProvider] = useState("zoom");

  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const previewSessions = useMemo(() => {
    if (
      !firstDate ||
      selectedDays.length === 0 ||
      totalLessons <= 0
    ) {
      return [];
    }

    const result: {
      lessonNumber: number;
      lessonDate: string;
    }[] = [];

    const cursor = new Date(`${firstDate}T12:00:00`);

    let safetyCount = 0;

    while (
      result.length < totalLessons &&
      safetyCount < 1000
    ) {
      if (selectedDays.includes(cursor.getDay())) {
        result.push({
          lessonNumber: result.length + 1,
          lessonDate: formatDate(cursor),
        });
      }

      cursor.setDate(cursor.getDate() + 1);
      safetyCount += 1;
    }

    return result;
  }, [firstDate, selectedDays, totalLessons]);

  function toggleDay(day: number) {
    setSelectedDays((current) => {
      if (current.includes(day)) {
        return current.filter((item) => item !== day);
      }

      if (current.length >= lessonsPerWeek) {
        return current;
      }

      return [...current, day];
    });
  }

  async function createZoomMeeting(params: {
    lessonNumber: number;
    scheduledStart: string;
  }) {
    const response = await fetch("/api/zoom/create-meeting", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        topic: `TALKLY 수업 - 수강 #${enrollmentId} - ${params.lessonNumber}회차`,
        startTime: params.scheduledStart,
        durationMinutes,
      }),
    });

    const data =
      (await response.json()) as ZoomMeetingResponse;

    if (!response.ok || !data.success || !data.meeting) {
      const detail =
        typeof data.error === "string"
          ? data.error
          : JSON.stringify(data.error ?? {});

      throw new Error(
        `${params.lessonNumber}회차 Zoom 회의 생성 실패${
          detail ? `: ${detail}` : ""
        }`
      );
    }

    return data.meeting;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setProgressMessage("");

    if (!teacherUserId) {
      setErrorMessage(
        "담당 강사가 배정되지 않았습니다. 먼저 수강정보에서 담당 강사를 배정해주세요."
      );
      return;
    }

    if (!firstDate) {
      setErrorMessage("첫 수업 기준일을 선택해주세요.");
      return;
    }

    if (selectedDays.length !== lessonsPerWeek) {
      setErrorMessage(
        `주당 수업 횟수에 맞게 ${lessonsPerWeek}개의 요일을 선택해주세요.`
      );
      return;
    }

    if (!lessonTime) {
      setErrorMessage("수업 시작시간을 선택해주세요.");
      return;
    }

    if (totalLessons <= 0) {
      setErrorMessage("총 수업 횟수가 설정되어 있지 않습니다.");
      return;
    }

    if (previewSessions.length !== totalLessons) {
      setErrorMessage("전체 수업 일정을 생성하지 못했습니다.");
      return;
    }

    const confirmed = window.confirm(
      meetingProvider === "zoom"
        ? `총 ${totalLessons}회의 수업 일정과 Zoom 회의를 생성하시겠습니까?`
        : `총 ${totalLessons}회의 수업 일정을 생성하시겠습니까?`
    );

    if (!confirmed) {
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
        throw new Error("로그인 정보를 확인할 수 없습니다.");
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
        throw new Error("관리자 권한을 확인할 수 없습니다.");
      }

      const {
        count,
        error: countError,
      } = await supabase
        .from("class_sessions")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("enrollment_id", enrollmentId);

      if (countError) {
        throw new Error(
          `기존 일정 확인 실패: ${countError.message}`
        );
      }

      if ((count ?? 0) > 0) {
        throw new Error(
          "이미 생성된 수업 일정이 있습니다. 중복 생성을 방지하기 위해 새 일정을 생성하지 않았습니다."
        );
      }

      const rows: {
        enrollment_id: number;
        lesson_number: number;
        scheduled_start: string;
        scheduled_end: string;
        status: string;
        meeting_provider: string;
        meeting_id: string | null;
        meeting_url: string | null;
        teacher_notes: null;
      }[] = [];

      for (
        let index = 0;
        index < previewSessions.length;
        index += 1
      ) {
        const session = previewSessions[index];

        const scheduledStart = new Date(
          `${session.lessonDate}T${lessonTime}:00+09:00`
        );

        const scheduledEnd = new Date(
          scheduledStart.getTime() +
            durationMinutes * 60 * 1000
        );

        let meetingId: string | null = null;
        let meetingUrl: string | null = null;

        if (meetingProvider === "zoom") {
          setProgressMessage(
            `Zoom 회의 생성 중... ${index + 1}/${previewSessions.length}`
          );

          const meeting = await createZoomMeeting({
            lessonNumber: session.lessonNumber,
            scheduledStart: scheduledStart.toISOString(),
          });

          meetingId = meeting.meetingId;
          meetingUrl = meeting.joinUrl;
        }

        rows.push({
          enrollment_id: enrollmentId,
          lesson_number: session.lessonNumber,
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          status: "scheduled",
          meeting_provider: meetingProvider,
          meeting_id: meetingId,
          meeting_url: meetingUrl,
          teacher_notes: null,
        });
      }

      setProgressMessage("수업 일정을 저장하고 있습니다...");

      const { error: insertError } = await supabase
        .from("class_sessions")
        .insert(rows);

      if (insertError) {
        throw new Error(
          `수업 일정 생성 실패: ${insertError.message}`
        );
      }

      setProgressMessage("수업 일정 생성이 완료되었습니다.");

      router.push(`/admin/enrollments/${enrollmentId}`);
      router.refresh();
    } catch (error) {
      console.error("CLASS SESSION CREATE ERROR:", error);

      setErrorMessage(
        error instanceof Error
          ? `수업 일정 생성 오류: ${error.message}`
          : "수업 일정 생성 중 오류가 발생했습니다."
      );

      setProgressMessage("");
      setLoading(false);
    }
  }

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "12px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    fontSize: "16px",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <section
        style={{
          padding: "24px",
          border: "1px solid #ddd",
          borderRadius: "12px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          정규 수업시간 설정
        </h2>

        <div
          style={{
            marginBottom: "24px",
          }}
        >
          <label
            htmlFor="firstDate"
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: 700,
            }}
          >
            첫 수업 기준일
          </label>

          <input
            id="firstDate"
            type="date"
            value={firstDate}
            onChange={(event) =>
              setFirstDate(event.target.value)
            }
            style={fieldStyle}
          />
        </div>

        <div
          style={{
            marginBottom: "24px",
          }}
        >
          <strong>수업 요일</strong>

          <p
            style={{
              marginTop: "6px",
              opacity: 0.7,
            }}
          >
            이 과정은 주 {lessonsPerWeek}회
            수업입니다. 정확히{" "}
            {lessonsPerWeek}개의 요일을
            선택해주세요.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            {WEEKDAYS.map((day) => {
              const checked =
                selectedDays.includes(day.value);

              return (
                <label
                  key={day.value}
                  style={{
                    padding: "10px 14px",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    cursor: loading
                      ? "default"
                      : "pointer",
                    fontWeight: checked ? 700 : 400,
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={loading}
                    onChange={() =>
                      toggleDay(day.value)
                    }
                    style={{
                      marginRight: "7px",
                    }}
                  />

                  {day.label}
                </label>
              );
            })}
          </div>
        </div>

        <div
          style={{
            marginBottom: "24px",
          }}
        >
          <label
            htmlFor="lessonTime"
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: 700,
            }}
          >
            수업 시작시간
          </label>

          <input
            id="lessonTime"
            type="time"
            value={lessonTime}
            disabled={loading}
            onChange={(event) =>
              setLessonTime(event.target.value)
            }
            style={fieldStyle}
          />
        </div>

        <div>
          <label
            htmlFor="meetingProvider"
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: 700,
            }}
          >
            화상수업 플랫폼
          </label>

          <select
            id="meetingProvider"
            value={meetingProvider}
            disabled={loading}
            onChange={(event) =>
              setMeetingProvider(event.target.value)
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

          {meetingProvider === "zoom" && (
            <p
              style={{
                marginTop: "8px",
                marginBottom: 0,
                fontSize: "13px",
                opacity: 0.7,
              }}
            >
              Zoom을 선택하면 각 회차별 Zoom 회의와
              학생용 참가 링크가 자동 생성됩니다.
            </p>
          )}
        </div>
      </section>

      <section
        style={{
          padding: "24px",
          border: "1px solid #ddd",
          borderRadius: "12px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          생성 예정 일정
        </h2>

        {previewSessions.length === 0 ? (
          <p style={{ marginBottom: 0 }}>
            시작일과 수업 요일을 선택하면
            전체 일정이 여기에 표시됩니다.
          </p>
        ) : (
          <>
            <p>
              총{" "}
              <strong>
                {previewSessions.length}회
              </strong>{" "}
              일정이 생성됩니다.
            </p>

            <div
              style={{
                maxHeight: "360px",
                overflowY: "auto",
                borderTop: "1px solid #ddd",
              }}
            >
              {previewSessions.map((session) => (
                <div
                  key={session.lessonNumber}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 4px",
                    borderBottom: "1px solid #ddd",
                  }}
                >
                  <strong>
                    {session.lessonNumber}회차
                  </strong>

                  <span>
                    {session.lessonDate}{" "}
                    {lessonTime}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {progressMessage && (
        <div
          style={{
            padding: "14px",
            border: "1px solid #888",
            borderRadius: "8px",
            fontWeight: 700,
          }}
        >
          {progressMessage}
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            padding: "14px",
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
          padding: "15px",
          border: "none",
          borderRadius: "8px",
          fontSize: "16px",
          fontWeight: 700,
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading
          ? progressMessage || "수업 일정 생성 중..."
          : meetingProvider === "zoom"
            ? `총 ${totalLessons}회 수업 + Zoom 생성`
            : `총 ${totalLessons}회 수업 일정 생성`}
      </button>
    </form>
  );
}