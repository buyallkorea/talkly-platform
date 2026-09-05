"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

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

type UpdateResponse = {
  success?: boolean;
  error?: string;
  status?: string;
  session?: {
    id: number;
    status: string;
  };
};

function getStatusLabel(status: string) {
  switch (status) {
    case "scheduled":
      return "예정";

    case "in_progress":
      return "수업 진행 중";

    case "completed":
      return "수업 완료";

    case "cancelled":
      return "수업 취소";

    case "no_show":
      return "결석";

    case "held":
      return "수업 연기";

    case "not_held":
      return "미진행";

    default:
      return status;
  }
}

function getLockedMessage(status: string) {
  switch (status) {
    case "in_progress":
      return "현재 진행 중인 수업입니다. 수업 일정은 변경할 수 없습니다.";

    case "completed":
      return "이미 완료된 수업입니다. 원래 수업 일정은 변경할 수 없습니다.";

    case "no_show":
      return "결석 처리된 수업입니다. 원래 수업 일정은 변경할 수 없습니다.";

    case "held":
      return "수업 연기로 처리된 원래 수업입니다. 일정 자체를 변경하지 않고 필요한 경우 별도의 보강수업을 생성합니다.";

    case "cancelled":
      return "취소된 원래 수업입니다. 일정 자체를 변경하지 않고 필요한 경우 별도의 보강수업을 생성합니다.";

    case "not_held":
      return "미진행으로 마감된 원래 수업입니다. 이 기록은 변경하지 않으며 필요한 경우 별도의 보강수업을 생성합니다.";

    default:
      return "현재 상태에서는 원래 수업 일정을 변경할 수 없습니다.";
  }
}

export default function EditLessonForm({
  enrollmentId,
  session,
}: Props) {
  const router = useRouter();

  const [lessonDate, setLessonDate] =
    useState(session.lessonDate);

  const [startTime, setStartTime] =
    useState(session.startTime);

  const [
    durationMinutes,
    setDurationMinutes,
  ] = useState(
    String(session.durationMinutes)
  );

  const [
    meetingProvider,
    setMeetingProvider,
  ] = useState(
    session.meetingProvider || "zoom"
  );

  const [meetingUrl, setMeetingUrl] =
    useState(
      session.meetingUrl || ""
    );

  const [
    teacherNotes,
    setTeacherNotes,
  ] = useState(
    session.teacherNotes || ""
  );

  const [loading, setLoading] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  /*
   * scheduled 상태만 원본 일정 수정 가능
   *
   * 실제 최종 권한 판단은 서버 API가 다시 수행합니다.
   * 여기의 잠금은 관리자 UI를 명확하게 하기 위한 것입니다.
   */
  const canEditSchedule =
    session.status === "scheduled";

  /*
   * 현재 값과 최초 값을 비교해서
   * 일정 관련 정보가 실제로 바뀌었는지 확인합니다.
   */
  const scheduleChanged =
    lessonDate !== session.lessonDate ||
    startTime !== session.startTime ||
    durationMinutes !==
      String(session.durationMinutes) ||
    meetingProvider !==
      (session.meetingProvider || "zoom") ||
    meetingUrl.trim() !==
      (session.meetingUrl || "").trim();

  const notesChanged =
    teacherNotes.trim() !==
    (session.teacherNotes || "").trim();

  const hasChanges =
    scheduleChanged || notesChanged;

  /*
   * 현재 상태 안내 문구
   */
  const statusDescription =
    useMemo(() => {
      if (canEditSchedule) {
        return "아직 시작되지 않은 예정 수업입니다. 수업일, 시간 및 화상수업 정보를 수정할 수 있습니다.";
      }

      return getLockedMessage(
        session.status
      );
    }, [
      canEditSchedule,
      session.status,
    ]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!hasChanges) {
      setErrorMessage(
        "변경된 수업정보가 없습니다."
      );

      return;
    }

    /*
     * 일정 수정이 가능한 경우에만
     * 날짜/시간/수업시간 검증
     */
    if (
      canEditSchedule &&
      scheduleChanged
    ) {
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

      const parsedDuration =
        Number(durationMinutes);

      if (
        !Number.isInteger(
          parsedDuration
        ) ||
        parsedDuration <= 0
      ) {
        setErrorMessage(
          "수업시간을 확인해주세요."
        );

        return;
      }
    }

    setLoading(true);

    try {
      /*
       * =====================================================
       * 서버 API를 통한 수정
       *
       * 더 이상 브라우저에서 class_sessions를
       * 직접 UPDATE하지 않습니다.
       * =====================================================
       */
      const requestBody: {
        lessonDate?: string;
        startTime?: string;
        durationMinutes?: number;
        meetingProvider?: string | null;
        meetingUrl?: string | null;
        teacherNotes?: string | null;
      } = {};

      /*
       * scheduled이고 실제 일정 관련 변경이 있는 경우에만
       * 일정 정보를 API에 보냅니다.
       */
      if (
        canEditSchedule &&
        scheduleChanged
      ) {
        requestBody.lessonDate =
          lessonDate;

        requestBody.startTime =
          startTime;

        requestBody.durationMinutes =
          Number(durationMinutes);

        requestBody.meetingProvider =
          meetingProvider || null;

        requestBody.meetingUrl =
          meetingUrl.trim() || null;
      }

      /*
       * 메모는 모든 상태에서 수정 가능
       */
      if (notesChanged) {
        requestBody.teacherNotes =
          teacherNotes.trim() || null;
      }

      const response = await fetch(
        `/api/admin/class-sessions/${session.id}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials: "same-origin",

          body: JSON.stringify(
            requestBody
          ),
        }
      );

      let data: UpdateResponse = {};

      try {
        data =
          (await response.json()) as
            UpdateResponse;
      } catch {
        data = {};
      }

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "수업정보를 수정할 수 없습니다."
        );
      }

      setSuccessMessage(
        "수업정보가 수정되었습니다."
      );

      /*
       * 서버에서 상태가 바뀌었을 수도 있습니다.
       *
       * 예:
       * 편집 화면을 오래 열어둔 사이
       * scheduled_end가 지나 not_held 처리된 경우.
       *
       * 상세화면으로 돌아가 서버의 최신 데이터를
       * 다시 읽도록 합니다.
       */
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
          ? error.message
          : "수업정보 수정 중 알 수 없는 오류가 발생했습니다."
      );

      setLoading(false);
    }
  }

  const labelStyle = {
    display: "block",
    marginBottom: "8px",
    fontWeight: 700,
  };

  const fieldStyle = {
    width: "100%",
    boxSizing:
      "border-box" as const,
    padding: "12px 14px",
    border: "1px solid #d9d9d9",
    borderRadius: "8px",
    fontSize: "16px",
  };

  const disabledFieldStyle = {
    ...fieldStyle,
    background: "#f5f5f5",
    color: "#666",
    cursor: "not-allowed",
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
      {/* 현재 상태 */}
      <div
        style={{
          padding: "18px",
          border: "1px solid #ddd",
          borderRadius: "10px",
          background:
            session.status ===
            "scheduled"
              ? "#fffaf0"
              : "#f7f7f7",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <strong>
            현재 상태
          </strong>

          <span
            style={{
              padding:
                "5px 10px",
              border:
                "1px solid #ccc",
              borderRadius:
                "999px",
              fontSize:
                "14px",
              fontWeight: 700,
            }}
          >
            {getStatusLabel(
              session.status
            )}
          </span>
        </div>

        <p
          style={{
            margin:
              "10px 0 0",
            lineHeight: 1.6,
          }}
        >
          {statusDescription}
        </p>
      </div>

      {/* 회차 */}
      <div>
        <label
          style={labelStyle}
        >
          회차
        </label>

        <div
          style={{
            ...fieldStyle,
            background:
              "#f5f5f5",
          }}
        >
          {session.lessonNumber}
          회차
        </div>
      </div>

      {/* 수업일 */}
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
          disabled={
            !canEditSchedule ||
            loading
          }
          onChange={(event) =>
            setLessonDate(
              event.target.value
            )
          }
          required={
            canEditSchedule
          }
          style={
            canEditSchedule
              ? fieldStyle
              : disabledFieldStyle
          }
        />
      </div>

      {/* 시작시간 */}
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
          disabled={
            !canEditSchedule ||
            loading
          }
          onChange={(event) =>
            setStartTime(
              event.target.value
            )
          }
          required={
            canEditSchedule
          }
          style={
            canEditSchedule
              ? fieldStyle
              : disabledFieldStyle
          }
        />
      </div>

      {/* 수업시간 */}
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
          disabled={
            !canEditSchedule ||
            loading
          }
          onChange={(event) =>
            setDurationMinutes(
              event.target.value
            )
          }
          style={
            canEditSchedule
              ? fieldStyle
              : disabledFieldStyle
          }
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

      {/* 수업 상태 */}
      <div>
        <label
          style={labelStyle}
        >
          수업 상태
        </label>

        <div
          style={{
            ...fieldStyle,
            background:
              "#f5f5f5",
          }}
        >
          {getStatusLabel(
            session.status
          )}
        </div>

        <small
          style={{
            display: "block",
            marginTop: "7px",
            lineHeight: 1.5,
            color: "#666",
          }}
        >
          수업 상태는 이 화면에서
          임의로 변경하지 않습니다.
          출석·수업진행·미진행 처리
          결과에 따라 관리됩니다.
        </small>
      </div>

      {/* 화상수업 플랫폼 */}
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
          disabled={
            !canEditSchedule ||
            loading
          }
          onChange={(event) =>
            setMeetingProvider(
              event.target.value
            )
          }
          style={
            canEditSchedule
              ? fieldStyle
              : disabledFieldStyle
          }
        >
          <option value="zoom">
            Zoom
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

      {/* 화상수업 링크 */}
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
          disabled={
            !canEditSchedule ||
            loading
          }
          onChange={(event) =>
            setMeetingUrl(
              event.target.value
            )
          }
          placeholder="예: https://zoom.us/j/..."
          style={
            canEditSchedule
              ? fieldStyle
              : disabledFieldStyle
          }
        />

        {canEditSchedule && (
          <small
            style={{
              display:
                "block",
              marginTop:
                "7px",
              color: "#666",
            }}
          >
            아직 링크가 없으면
            비워두어도 됩니다.
          </small>
        )}
      </div>

      {/* 메모 */}
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
          disabled={loading}
          onChange={(event) =>
            setTeacherNotes(
              event.target.value
            )
          }
          rows={6}
          placeholder="수업 내용, 변경 사유, 특이사항 등을 입력해주세요."
          style={{
            ...fieldStyle,
            resize:
              "vertical",
          }}
        />

        {!canEditSchedule && (
          <small
            style={{
              display:
                "block",
              marginTop:
                "7px",
              color: "#666",
              lineHeight: 1.5,
            }}
          >
            원래 수업 일정은
            잠겨 있지만 관리 메모는
            계속 수정할 수 있습니다.
          </small>
        )}
      </div>

      {/* 에러 */}
      {errorMessage && (
        <div
          style={{
            padding: "14px",
            border:
              "1px solid #d93025",
            borderRadius:
              "8px",
            color: "#d93025",
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* 성공 */}
      {successMessage && (
        <div
          style={{
            padding: "14px",
            border:
              "1px solid #188038",
            borderRadius:
              "8px",
            color: "#188038",
          }}
        >
          {successMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={
          loading ||
          !hasChanges
        }
        style={{
          padding: "15px",
          border: "none",
          borderRadius: "8px",
          fontSize: "16px",
          fontWeight: 700,
          cursor:
            loading ||
            !hasChanges
              ? "default"
              : "pointer",
          opacity:
            loading ||
            !hasChanges
              ? 0.55
              : 1,
        }}
      >
        {loading
          ? "수업정보 수정 중..."
          : canEditSchedule
            ? "수업정보 수정"
            : "관리 메모 저장"}
      </button>
    </form>
  );
}