"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Props = {
  enrollmentId: number;
  originalSessionId: number;
  lessonNumber: number;
  originalScheduledStart: string;
  originalScheduledEnd: string;
  enrollmentEndDate?: string | null;
};

type MakeupCreateResponse = {
  success?: boolean;
  error?: string;
  existingMakeupSessionId?: number;
  conflictingSessionId?: number;

  makeupSession?: {
    id: number;
    enrollmentId: number;
    lessonNumber: number;
    scheduledStart: string;
    scheduledEnd: string;
    status: string;
    sessionKind: string;
    makeupForSessionId: number;
    makeupReason: string;
    meetingProvider: string | null;
    meetingId: string | null;
    meetingUrl: string | null;
  };

  zoomConnectionRequired?: boolean;
};

type ZoomConnectResponse = {
  success?: boolean;
  error?: string | unknown;

  session?: {
    id: number;
    meetingId: string | null;
    meetingUrl: string | null;
  };
};

/*
 * =========================================================
 * YYYY-MM-DD
 * =========================================================
 */
function toDateInputValue(
  date: Date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/*
 * =========================================================
 * 한국시간 기준 오늘
 * =========================================================
 */
function getKoreaToday() {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year"
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type === "day"
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

/*
 * =========================================================
 * 정규수강 종료일 다음날
 *
 * 보강은 원칙적으로 정규수업 종료 이후 배치를 권장하지만
 * 운영상 필요한 경우 다른 미래 날짜도 선택할 수 있습니다.
 * =========================================================
 */
function getRecommendedMakeupDate(
  enrollmentEndDate:
    | string
    | null
    | undefined
) {
  const today =
    getKoreaToday();

  if (!enrollmentEndDate) {
    return today;
  }

  const parsed =
    new Date(
      `${enrollmentEndDate}T00:00:00+09:00`
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return today;
  }

  parsed.setDate(
    parsed.getDate() + 1
  );

  const recommended =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).format(parsed);

  /*
   * 종료일 다음날이 이미 과거라면
   * 오늘을 기본값으로 둡니다.
   */
  if (
    today &&
    recommended < today
  ) {
    return today;
  }

  return recommended;
}

/*
 * =========================================================
 * 원본 수업시간
 * =========================================================
 */
function calculateDurationMinutes(
  start: string,
  end: string
) {
  const startMs =
    new Date(start).getTime();

  const endMs =
    new Date(end).getTime();

  if (
    !Number.isFinite(
      startMs
    ) ||
    !Number.isFinite(
      endMs
    ) ||
    endMs <= startMs
  ) {
    return 25;
  }

  return Math.max(
    1,
    Math.round(
      (endMs - startMs) /
        60000
    )
  );
}

function getErrorText(
  value: unknown
) {
  if (
    typeof value ===
    "string"
  ) {
    return value;
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    try {
      return JSON.stringify(
        value
      );
    } catch {
      return "알 수 없는 오류가 발생했습니다.";
    }
  }

  return "알 수 없는 오류가 발생했습니다.";
}

export default function MakeupLessonForm({
  enrollmentId,
  originalSessionId,
  lessonNumber,
  originalScheduledStart,
  originalScheduledEnd,
  enrollmentEndDate,
}: Props) {
  const router =
    useRouter();

  const originalDuration =
    useMemo(
      () =>
        calculateDurationMinutes(
          originalScheduledStart,
          originalScheduledEnd
        ),
      [
        originalScheduledStart,
        originalScheduledEnd,
      ]
    );

  const recommendedDate =
    useMemo(
      () =>
        getRecommendedMakeupDate(
          enrollmentEndDate
        ),
      [enrollmentEndDate]
    );

  const [
    lessonDate,
    setLessonDate,
  ] = useState(
    recommendedDate
  );

  const [
    startTime,
    setStartTime,
  ] = useState("17:00");

  const [
    durationMinutes,
    setDurationMinutes,
  ] = useState(
    String(
      originalDuration
    )
  );

  const [
    makeupReason,
    setMakeupReason,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    infoMessage,
    setInfoMessage,
  ] = useState("");

  const [
    createdSessionId,
    setCreatedSessionId,
  ] = useState<
    number | null
  >(null);

  const today =
    getKoreaToday();

  /*
   * 정규수강 종료일 이후인지
   * 관리자에게 안내하기 위한 값입니다.
   *
   * API에서 강제하지는 않습니다.
   */
  const isBeforeRecommendedPeriod =
    Boolean(
      enrollmentEndDate &&
        lessonDate &&
        lessonDate <=
          enrollmentEndDate
    );

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setErrorMessage("");
    setInfoMessage("");
    setCreatedSessionId(
      null
    );

    if (!lessonDate) {
      setErrorMessage(
        "보강 수업일을 선택해주세요."
      );

      return;
    }

    if (!startTime) {
      setErrorMessage(
        "보강 시작시간을 선택해주세요."
      );

      return;
    }

    const parsedDuration =
      Number(
        durationMinutes
      );

    if (
      !Number.isInteger(
        parsedDuration
      ) ||
      parsedDuration <= 0
    ) {
      setErrorMessage(
        "보강 수업시간을 확인해주세요."
      );

      return;
    }

    if (
      !makeupReason.trim()
    ) {
      setErrorMessage(
        "보강 사유를 입력해주세요."
      );

      return;
    }

    /*
     * 브라우저에서도 한 번 확인합니다.
     * 실제 최종 검증은 서버 API가 수행합니다.
     */
    const selectedStart =
      new Date(
        `${lessonDate}T${startTime}:00+09:00`
      );

    if (
      Number.isNaN(
        selectedStart.getTime()
      )
    ) {
      setErrorMessage(
        "보강 시작일시를 확인해주세요."
      );

      return;
    }

    if (
      selectedStart.getTime() <=
      Date.now()
    ) {
      setErrorMessage(
        "보강수업은 현재 시각 이후로만 생성할 수 있습니다."
      );

      return;
    }

    setLoading(true);

    try {
      /*
       * =====================================================
       * 1. 보강 class_session 생성
       * =====================================================
       */
      const createResponse =
        await fetch(
          `/api/admin/class-sessions/${originalSessionId}/makeup`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials:
              "same-origin",

            body:
              JSON.stringify({
                lessonDate,
                startTime,

                durationMinutes:
                  parsedDuration,

                makeupReason:
                  makeupReason.trim(),
              }),
          }
        );

      let createData:
        MakeupCreateResponse =
          {};

      try {
        createData =
          (await createResponse.json()) as
            MakeupCreateResponse;
      } catch {
        createData = {};
      }

      if (
        !createResponse.ok ||
        !createData.success ||
        !createData
          .makeupSession
          ?.id
      ) {
        /*
         * 이미 보강이 존재하는 경우
         * 그 보강 상세로 바로 이동할 수 있도록
         * 오류 메시지에 안내합니다.
         */
        if (
          createData
            .existingMakeupSessionId
        ) {
          const existingId =
            createData
              .existingMakeupSessionId;

          setErrorMessage(
            `${
              createData.error ||
              "이미 보강수업이 존재합니다."
            } 기존 보강수업 ID: ${existingId}`
          );

          setCreatedSessionId(
            existingId
          );

          setLoading(false);

          return;
        }

        throw new Error(
          createData.error ||
            "보강수업을 생성할 수 없습니다."
        );
      }

      const newSessionId =
        createData
          .makeupSession.id;

      setCreatedSessionId(
        newSessionId
      );

      setInfoMessage(
        "보강수업이 생성되었습니다. Zoom 회의를 연결하고 있습니다."
      );

      /*
       * =====================================================
       * 2. 기존 Zoom 연결 API 재사용
       *
       * 보강 세션은 이미 DB에 안전하게 생성된 상태입니다.
       *
       * Zoom 연결에 실패해도 보강 세션은 삭제하지 않습니다.
       * 관리자 상세페이지에서 다시 연결할 수 있습니다.
       * =====================================================
       */
      const zoomResponse =
        await fetch(
          "/api/zoom/connect-session",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials:
              "same-origin",

            body:
              JSON.stringify({
                sessionId:
                  newSessionId,
              }),
          }
        );

      let zoomData:
        ZoomConnectResponse =
          {};

      try {
        zoomData =
          (await zoomResponse.json()) as
            ZoomConnectResponse;
      } catch {
        zoomData = {};
      }

      if (
        !zoomResponse.ok ||
        !zoomData.success
      ) {
        /*
         * 중요:
         * Zoom 실패는 보강 생성 자체의 실패가 아닙니다.
         *
         * 새 보강수업은 그대로 유지합니다.
         */
        setInfoMessage(
          "보강수업은 정상적으로 생성되었지만 Zoom 회의 자동 연결에 실패했습니다. 새 보강수업 상세화면에서 Zoom 연결을 다시 시도할 수 있습니다."
        );

        setErrorMessage(
          getErrorText(
            zoomData.error
          )
        );

        setLoading(false);

        return;
      }

      /*
       * =====================================================
       * 3. Zoom 연결까지 성공
       * =====================================================
       */
      setInfoMessage(
        "보강수업과 Zoom 회의가 정상적으로 생성되었습니다."
      );

      router.push(
        `/admin/enrollments/${enrollmentId}/lessons/${newSessionId}`
      );

      router.refresh();
    } catch (error) {
      console.error(
        "MAKEUP LESSON CREATE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "보강수업 생성 중 오류가 발생했습니다."
      );

      setLoading(false);
    }
  }

  const fieldStyle = {
    width: "100%",
    boxSizing:
      "border-box" as const,
    padding: "12px 14px",
    border:
      "1px solid #d9d9d9",
    borderRadius: "8px",
    fontSize: "15px",
    background: "#fff",
  };

  const labelStyle = {
    display: "block",
    marginBottom: "7px",
    fontWeight: 700,
  };

  return (
    <div>
      <div
        style={{
          padding: "18px",
          border:
            "1px solid #dbeafe",
          borderRadius:
            "10px",
          background:
            "#f8fbff",
          marginBottom:
            "22px",
        }}
      >
        <strong>
          {lessonNumber}
          회차 보강수업
        </strong>

        <p
          style={{
            margin:
              "8px 0 0",
            lineHeight: 1.6,
          }}
        >
          원래 수업은 변경하지
          않습니다. 새로운
          보강수업을 별도 회차
          기록으로 생성합니다.
        </p>

        <p
          style={{
            margin:
              "6px 0 0",
            lineHeight: 1.6,
            color: "#555",
          }}
        >
          보강수업은 정규 계약
          회차에 추가되지 않으며
          원래 {lessonNumber}
          회차와 연결되어
          관리됩니다.
        </p>
      </div>

      <form
        onSubmit={
          handleSubmit
        }
        style={{
          display: "flex",
          flexDirection:
            "column",
          gap: "18px",
        }}
      >
        {/* 수업일 */}
        <div>
          <label
            htmlFor="makeupLessonDate"
            style={
              labelStyle
            }
          >
            보강 수업일
          </label>

          <input
            id="makeupLessonDate"
            type="date"
            value={
              lessonDate
            }
            min={today}
            disabled={
              loading
            }
            onChange={(
              event
            ) =>
              setLessonDate(
                event.target
                  .value
              )
            }
            style={
              fieldStyle
            }
            required
          />

          {enrollmentEndDate && (
            <small
              style={{
                display:
                  "block",
                marginTop:
                  "7px",
                lineHeight:
                  1.5,
                color:
                  "#666",
              }}
            >
              정규수강 종료일:{" "}
              {
                enrollmentEndDate
              }
              . 가능하면 정규수강
              종료 이후에 보강을
              배치하는 것을
              권장합니다.
            </small>
          )}

          {isBeforeRecommendedPeriod && (
            <div
              style={{
                marginTop:
                  "8px",
                padding:
                  "10px 12px",
                border:
                  "1px solid #f59e0b",
                borderRadius:
                  "7px",
                lineHeight:
                  1.5,
                fontSize:
                  "14px",
              }}
            >
              선택한 날짜는
              정규수강 종료일
              이전 또는 종료일과
              같습니다. 운영상
              필요한 경우 그대로
              생성할 수 있습니다.
            </div>
          )}
        </div>

        {/* 시작시간 */}
        <div>
          <label
            htmlFor="makeupStartTime"
            style={
              labelStyle
            }
          >
            시작시간
          </label>

          <input
            id="makeupStartTime"
            type="time"
            value={
              startTime
            }
            disabled={
              loading
            }
            onChange={(
              event
            ) =>
              setStartTime(
                event.target
                  .value
              )
            }
            style={
              fieldStyle
            }
            required
          />
        </div>

        {/* 수업시간 */}
        <div>
          <label
            htmlFor="makeupDuration"
            style={
              labelStyle
            }
          >
            수업시간
          </label>

          <select
            id="makeupDuration"
            value={
              durationMinutes
            }
            disabled={
              loading
            }
            onChange={(
              event
            ) =>
              setDurationMinutes(
                event.target
                  .value
              )
            }
            style={
              fieldStyle
            }
          >
            {/*
             * 원본 시간이 표준 옵션에 없더라도
             * 현재 값을 잃지 않도록 별도 option을 추가합니다.
             */}
            {![
              10,
              20,
              25,
              30,
              40,
              50,
              60,
            ].includes(
              originalDuration
            ) && (
              <option
                value={String(
                  originalDuration
                )}
              >
                {
                  originalDuration
                }
                분 (원본)
              </option>
            )}

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

          <small
            style={{
              display:
                "block",
              marginTop:
                "7px",
              color: "#666",
            }}
          >
            원본 수업시간은{" "}
            {originalDuration}
            분입니다.
          </small>
        </div>

        {/* 사유 */}
        <div>
          <label
            htmlFor="makeupReason"
            style={
              labelStyle
            }
          >
            보강 사유
          </label>

          <textarea
            id="makeupReason"
            value={
              makeupReason
            }
            disabled={
              loading
            }
            onChange={(
              event
            ) =>
              setMakeupReason(
                event.target
                  .value
              )
            }
            rows={4}
            maxLength={500}
            placeholder="예: 담당 강사 결석으로 인한 보강"
            style={{
              ...fieldStyle,
              resize:
                "vertical",
            }}
            required
          />

          <small
            style={{
              display:
                "block",
              marginTop:
                "7px",
              color: "#666",
            }}
          >
            {
              makeupReason.length
            }
            /500
          </small>
        </div>

        {/* 안내 */}
        <div
          style={{
            padding: "14px",
            border:
              "1px solid #ddd",
            borderRadius:
              "8px",
            lineHeight: 1.6,
            fontSize:
              "14px",
          }}
        >
          저장하면 먼저 새로운
          보강수업을 생성한 뒤
          TALKLY의 기존 Zoom
          연결 기능을 이용하여
          해당 보강수업 전용
          Zoom 회의를 자동
          생성합니다.
        </div>

        {infoMessage && (
          <div
            style={{
              padding:
                "14px",
              border:
                "1px solid #188038",
              borderRadius:
                "8px",
              lineHeight:
                1.6,
              color:
                "#166534",
            }}
          >
            {infoMessage}
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              padding:
                "14px",
              border:
                "1px solid #d93025",
              borderRadius:
                "8px",
              lineHeight:
                1.6,
              color:
                "#d93025",
            }}
          >
            {errorMessage}
          </div>
        )}

        {createdSessionId && (
          <button
            type="button"
            disabled={
              loading
            }
            onClick={() => {
              router.push(
                `/admin/enrollments/${enrollmentId}/lessons/${createdSessionId}`
              );

              router.refresh();
            }}
            style={{
              padding:
                "13px 16px",
              border:
                "1px solid #ccc",
              borderRadius:
                "8px",
              fontSize:
                "15px",
              fontWeight:
                700,
              cursor:
                "pointer",
              background:
                "#fff",
            }}
          >
            생성된 보강수업
            상세 보기
          </button>
        )}

        <button
          type="submit"
          disabled={
            loading
          }
          style={{
            padding:
              "15px 18px",
            border: "none",
            borderRadius:
              "8px",
            fontSize:
              "16px",
            fontWeight:
              700,
            cursor:
              loading
                ? "default"
                : "pointer",
            opacity:
              loading
                ? 0.6
                : 1,
          }}
        >
          {loading
            ? "보강수업 생성 중..."
            : `${lessonNumber}회차 보강수업 생성`}
        </button>
      </form>
    </div>
  );
}