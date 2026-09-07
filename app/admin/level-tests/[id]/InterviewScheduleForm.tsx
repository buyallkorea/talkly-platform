"use client";

import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type TeacherOption = {
  user_id: string;
  display_name: string | null;
  nationality: string | null;
};

type InterviewData = {
  id: number | null;
  status: string | null;
  tester_user_id: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  meeting_provider: string | null;
  meeting_url: string | null;
};

type Props = {
  levelTestId: number;
  interviewRequired: boolean;
  interview: InterviewData | null;
  teachers: TeacherOption[];
};

export default function InterviewScheduleForm({
  levelTestId,
  interviewRequired,
  interview,
  teachers,
}: Props) {
  const router = useRouter();

  const [
    testerUserId,
    setTesterUserId,
  ] = useState(
    interview?.tester_user_id || ""
  );

  const [
    scheduledAt,
    setScheduledAt,
  ] = useState(
    toLocalDateTimeInput(
      interview?.scheduled_at || null
    )
  );

  const [
    meetingProvider,
    setMeetingProvider,
  ] = useState(
    interview?.meeting_provider ||
      "manual"
  );

  const [
    meetingUrl,
    setMeetingUrl,
  ] = useState(
    interview?.meeting_url || ""
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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!interviewRequired) {
      setErrorMessage(
        "먼저 관리자 판단에서 원어민 추가 테스트 필요로 설정해주세요."
      );
      return;
    }

    if (!testerUserId) {
      setErrorMessage(
        "담당 강사를 선택해주세요."
      );
      return;
    }

    if (!scheduledAt) {
      setErrorMessage(
        "테스트 날짜와 시간을 입력해주세요."
      );
      return;
    }

    const localDate =
      new Date(scheduledAt);

    if (
      Number.isNaN(
        localDate.getTime()
      )
    ) {
      setErrorMessage(
        "테스트 날짜와 시간을 올바르게 입력해주세요."
      );
      return;
    }

    setLoading(true);

    try {
      /*
       * datetime-local은 timezone 정보가 없으므로
       * 브라우저가 해석한 실제 시간을 ISO 형식으로
       * 변환하여 서버에 전달합니다.
       *
       * 서버에서는 다시 강사 근무시간,
       * 예외일정, 운영차단, 정규수업,
       * 다른 레벨테스트와의 충돌을 확인합니다.
       */
      const scheduledIso =
        localDate.toISOString();

      const response = await fetch(
        `/api/admin/level-tests/${levelTestId}/interview-schedule`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            testerUserId,
            scheduledAt:
              scheduledIso,
            meetingProvider:
              meetingProvider.trim() ||
              null,
            meetingUrl:
              meetingUrl.trim() ||
              null,
          }),
        }
      );

      let result: {
        ok?: boolean;
        error?: string;
        message?: string;
      } = {};

      try {
        result =
          await response.json();
      } catch {
        throw new Error(
          "서버 응답을 확인할 수 없습니다."
        );
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "원어민 테스트 일정을 저장할 수 없습니다."
        );
      }

      setSuccessMessage(
        result.message ||
          "원어민 화상 레벨테스트 일정과 담당 강사가 저장되었습니다."
      );

      router.refresh();
    } catch (error) {
      console.error(
        "LEVEL TEST INTERVIEW SCHEDULE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "원어민 테스트 일정 저장 중 알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!interviewRequired) {
    return (
      <section
        style={{
          marginTop: "22px",
          padding: "24px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "16px",
          background: "#ffffff",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#101828",
            fontSize: "19px",
          }}
        >
          원어민 테스트 일정 관리
        </h2>

        <div
          style={{
            marginTop: "18px",
            padding: "18px",
            border:
              "1px solid #e4e7ec",
            borderRadius: "11px",
            background: "#f9fafb",
            color: "#667085",
            fontSize: "12px",
            lineHeight: 1.7,
          }}
        >
          아직 원어민 추가 테스트 대상으로 저장되지 않았습니다.
          먼저 위의 관리자 판단에서
          &apos;원어민 추가 테스트 필요&apos;를 선택한 뒤
          &apos;추가 테스트 대상으로 저장&apos; 버튼을 눌러주세요.
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        marginTop: "22px",
        padding: "26px",
        border:
          "1px solid #e4e7ec",
        borderRadius: "16px",
        background: "#ffffff",
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            color: "#101828",
            fontSize: "20px",
            letterSpacing:
              "-0.02em",
          }}
        >
          원어민 테스트 일정 관리
        </h2>

        <p
          style={{
            margin: "8px 0 0",
            color: "#667085",
            fontSize: "13px",
            lineHeight: 1.7,
          }}
        >
          학부모와 전화 또는 SNS로 협의한 날짜·시간을 입력하고
          담당 원어민 강사를 지정합니다.
          저장할 때 강사의 실제 근무 가능시간과 기존 수업 일정을
          다시 확인합니다.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          marginTop: "26px",
          display: "flex",
          flexDirection: "column",
          gap: "22px",
        }}
      >
        <div>
          <label
            htmlFor="testerUserId"
            style={labelStyle}
          >
            담당 강사
          </label>

          <select
            id="testerUserId"
            value={testerUserId}
            onChange={(event) => {
              setTesterUserId(
                event.target.value
              );

              setErrorMessage("");
              setSuccessMessage("");
            }}
            disabled={loading}
            style={fieldStyle}
          >
            <option value="">
              강사를 선택해주세요.
            </option>

            {teachers.map(
              (teacher) => (
                <option
                  key={
                    teacher.user_id
                  }
                  value={
                    teacher.user_id
                  }
                >
                  {getTeacherOptionLabel(
                    teacher
                  )}
                </option>
              )
            )}
          </select>

          <div
            style={{
              marginTop: "10px",
              padding: "12px 14px",
              border:
                "1px solid #dbe7ff",
              borderRadius: "9px",
              background: "#f5f8ff",
              color: "#475467",
              fontSize: "11px",
              lineHeight: 1.7,
            }}
          >
            무료 화상레벨테스트는 기본적으로
            필리핀 원어민 강사가 진행합니다.
            필리핀 강사를 목록 상단에 우선 표시하며,
            강사 사정과 실제 가능 일정에 따라 다른 국적의 강사를
            선택할 수도 있습니다.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "2fr 1fr",
            gap: "14px",
          }}
        >
          <div>
            <label
              htmlFor="scheduledAt"
              style={labelStyle}
            >
              테스트 일시
            </label>

            <input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => {
                setScheduledAt(
                  event.target.value
                );

                setErrorMessage("");
                setSuccessMessage("");
              }}
              disabled={loading}
              style={fieldStyle}
            />

            <div style={helpStyle}>
              저장 시 해당 날짜와 시간에 강사가 실제 배정 가능한지
              서버에서 다시 확인합니다.
            </div>
          </div>

          <div>
            <label
              htmlFor="durationMinutes"
              style={labelStyle}
            >
              테스트 시간
            </label>

            <select
              id="durationMinutes"
              value="20"
              disabled
              style={{
                ...fieldStyle,
                background: "#f9fafb",
                color: "#475467",
                cursor: "not-allowed",
              }}
            >
              <option value="20">
                20분
              </option>
            </select>

            <div style={helpStyle}>
              TALKLY 원어민 레벨테스트는 20분 기준으로 운영합니다.
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="meetingProvider"
            style={labelStyle}
          >
            화상 시스템
          </label>

          <select
            id="meetingProvider"
            value={meetingProvider}
            onChange={(event) => {
              setMeetingProvider(
                event.target.value
              );

              setErrorMessage("");
              setSuccessMessage("");
            }}
            disabled={loading}
            style={fieldStyle}
          >
            <option value="manual">
              TALKLY / 직접 입력
            </option>

            <option value="zoom">
              Zoom
            </option>

            <option value="google_meet">
              Google Meet
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
            화상 접속 링크
          </label>

          <input
            id="meetingUrl"
            type="url"
            value={meetingUrl}
            onChange={(event) => {
              setMeetingUrl(
                event.target.value
              );

              setErrorMessage("");
              setSuccessMessage("");
            }}
            placeholder="https://..."
            disabled={loading}
            style={fieldStyle}
          />

          <div style={helpStyle}>
            아직 링크가 정해지지 않았다면 비워둔 뒤
            나중에 다시 저장해도 됩니다.
          </div>
        </div>

        <div
          style={{
            padding: "16px 18px",
            border:
              "1px solid #dbe7ff",
            borderRadius: "11px",
            background: "#f5f8ff",
          }}
        >
          <div
            style={{
              color: "#2f6fed",
              fontSize: "12px",
              fontWeight: 900,
            }}
          >
            일정 운영 방식
          </div>

          <p
            style={{
              margin: "6px 0 0",
              color: "#667085",
              fontSize: "11px",
              lineHeight: 1.7,
            }}
          >
            TALKLY 시스템에서 학부모가 직접 강사 시간을 예약하는
            방식이 아니라, 관리자가 전화 또는 SNS로 일정을 협의한 뒤
            이곳에 확정 일정을 등록합니다.
          </p>

          <p
            style={{
              margin: "7px 0 0",
              color: "#667085",
              fontSize: "11px",
              lineHeight: 1.7,
            }}
          >
            테스트 일정 저장 시 강사의 정규 근무시간,
            특정일 예외 근무정보, 전체 운영 차단시간,
            기존 정규수업 및 다른 원어민 레벨테스트와의
            시간 충돌을 확인합니다.
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              padding: "14px 16px",
              border:
                "1px solid #fda29b",
              borderRadius: "10px",
              background: "#fffbfa",
              color: "#b42318",
              fontSize: "12px",
              fontWeight: 700,
              lineHeight: 1.6,
            }}
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              padding: "14px 16px",
              border:
                "1px solid #abefc6",
              borderRadius: "10px",
              background: "#ecfdf3",
              color: "#027a48",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            {successMessage}
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
              minHeight: "46px",
              padding: "0 22px",
              border: "none",
              borderRadius: "10px",
              background: loading
                ? "#98a2b3"
                : "#0A1F44",
              color: "#ffffff",
              fontFamily: "inherit",
              fontSize: "13px",
              fontWeight: 900,
              cursor: loading
                ? "default"
                : "pointer",
            }}
          >
            {loading
              ? "가용시간 확인 및 저장 중..."
              : "테스트 일정 저장"}
          </button>
        </div>
      </form>
    </section>
  );
}

function getTeacherOptionLabel(
  teacher: TeacherOption
) {
  const name =
    teacher.display_name ||
    teacher.user_id;

  const nationality =
    getNationalityLabel(
      teacher.nationality
    );

  const preferred =
    isPhilippineNationality(
      teacher.nationality
    )
      ? " · 레벨테스트 우선"
      : "";

  return `${name} · ${nationality}${preferred}`;
}

function getNationalityLabel(
  value: string | null
) {
  if (!value) {
    return "국적 미등록";
  }

  const normalized =
    value
      .trim()
      .toLowerCase()
      .replace(/[\s_-]/g, "");

  if (
    [
      "philippines",
      "philippine",
      "filipino",
      "필리핀",
    ].includes(normalized)
  ) {
    return "필리핀";
  }

  if (
    [
      "southafrica",
      "southafrican",
      "남아공",
      "남아프리카공화국",
    ].includes(normalized)
  ) {
    return "남아공";
  }

  if (
    [
      "northamerica",
      "northamerican",
      "북미",
    ].includes(normalized)
  ) {
    return "북미";
  }

  return value;
}

function isPhilippineNationality(
  value: string | null
) {
  if (!value) {
    return false;
  }

  const normalized =
    value
      .trim()
      .toLowerCase()
      .replace(/[\s_-]/g, "");

  return [
    "philippines",
    "philippine",
    "filipino",
    "필리핀",
  ].includes(normalized);
}

function toLocalDateTimeInput(
  value: string | null
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  const formatter =
    new Intl.DateTimeFormat(
      "sv-SE",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    );

  return formatter
    .format(date)
    .replace(" ", "T");
}

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  color: "#344054",
  fontSize: "13px",
  fontWeight: 800,
};

const fieldStyle = {
  width: "100%",
  minHeight: "46px",
  boxSizing:
    "border-box" as const,
  padding: "0 14px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "14px",
  outline: "none",
};

const helpStyle = {
  marginTop: "9px",
  color: "#98a2b3",
  fontSize: "11px",
  lineHeight: 1.6,
};