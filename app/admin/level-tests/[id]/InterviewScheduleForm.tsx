"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
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

type AvailabilityResponse = {
  ok?: boolean;
  error?: string;
  date?: string;
  durationMinutes?: number;
  slots?: string[];
  teacher?: {
    userId: string;
    displayName: string | null;
  };
};

type ScheduleResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export default function InterviewScheduleForm({
  levelTestId,
  interviewRequired,
  interview,
  teachers,
}: Props) {
  const router = useRouter();

  const sortedTeachers = useMemo(
    () =>
      [...teachers].sort((a, b) => {
        const aPreferred =
          isPhilippineNationality(
            a.nationality
          )
            ? 0
            : 1;

        const bPreferred =
          isPhilippineNationality(
            b.nationality
          )
            ? 0
            : 1;

        if (aPreferred !== bPreferred) {
          return aPreferred - bPreferred;
        }

        return (
          a.display_name || ""
        ).localeCompare(
          b.display_name || ""
        );
      }),
    [teachers]
  );

  const initialSchedule =
    getSeoulScheduleParts(
      interview?.scheduled_at || null
    );

  const [
    testerUserId,
    setTesterUserId,
  ] = useState(
    interview?.tester_user_id || ""
  );

  const [testDate, setTestDate] =
    useState(initialSchedule.date);

  const [
    selectedTime,
    setSelectedTime,
  ] = useState(initialSchedule.time);

  const [
    availableSlots,
    setAvailableSlots,
  ] = useState<string[]>([]);

  const [
    availabilityLoading,
    setAvailabilityLoading,
  ] = useState(false);

  const [
    availabilityError,
    setAvailabilityError,
  ] = useState("");

  const [
    availabilityLoaded,
    setAvailabilityLoaded,
  ] = useState(false);

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

  /*
   * 강사 또는 날짜가 바뀌면
   * 이전 조회 결과는 무효화합니다.
   */
  useEffect(() => {
    setAvailableSlots([]);
    setAvailabilityError("");
    setAvailabilityLoaded(false);
    setSuccessMessage("");
    setErrorMessage("");

    /*
     * 기존 저장 일정과 동일한 강사/날짜라면
     * 기존 시간은 화면에 유지합니다.
     * 다른 조건으로 바뀌면 시간 선택을 초기화합니다.
     */
    const initial =
      getSeoulScheduleParts(
        interview?.scheduled_at || null
      );

    const isOriginalCondition =
      testerUserId ===
        (interview?.tester_user_id ||
          "") &&
      testDate === initial.date;

    if (!isOriginalCondition) {
      setSelectedTime("");
    }
  }, [
    testerUserId,
    testDate,
    interview?.tester_user_id,
    interview?.scheduled_at,
  ]);

  async function loadAvailability() {
    setAvailabilityError("");
    setErrorMessage("");
    setSuccessMessage("");
    setAvailableSlots([]);
    setAvailabilityLoaded(false);

    if (!testerUserId) {
      setAvailabilityError(
        "먼저 담당 강사를 선택해주세요."
      );
      return;
    }

    if (!testDate) {
      setAvailabilityError(
        "테스트 날짜를 선택해주세요."
      );
      return;
    }

    setAvailabilityLoading(true);

    try {
      const response = await fetch(
        `/api/admin/level-tests/${levelTestId}/interview-availability`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            testerUserId,
            date: testDate,
          }),
        }
      );

      let result: AvailabilityResponse =
        {};

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
            "가능한 테스트 시간을 확인할 수 없습니다."
        );
      }

      const slots =
        result.slots || [];

      setAvailableSlots(slots);
      setAvailabilityLoaded(true);

      /*
       * 기존 선택시간이 더 이상 가능하지 않으면
       * 선택을 해제합니다.
       */
      if (
        selectedTime &&
        !slots.includes(selectedTime)
      ) {
        setSelectedTime("");
      }
    } catch (error) {
      console.error(
        "LEVEL TEST AVAILABILITY ERROR:",
        error
      );

      setAvailabilityError(
        error instanceof Error
          ? error.message
          : "가능한 테스트 시간을 확인하는 중 오류가 발생했습니다."
      );
    } finally {
      setAvailabilityLoading(false);
    }
  }

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

    if (!testDate) {
      setErrorMessage(
        "테스트 날짜를 선택해주세요."
      );
      return;
    }

    if (!selectedTime) {
      setErrorMessage(
        "가능한 테스트 시간을 선택해주세요."
      );
      return;
    }

    /*
     * datetime-local → Date 변환을 사용하지 않습니다.
     *
     * 한국시간 날짜/시간을 직접 UTC ISO로 변환하여
     * 관리자 PC의 timezone 설정과 무관하게
     * 항상 Asia/Seoul 기준으로 저장합니다.
     */
    const scheduledIso =
      seoulLocalToIso(
        testDate,
        selectedTime
      );

    if (!scheduledIso) {
      setErrorMessage(
        "테스트 일시를 올바르게 선택해주세요."
      );
      return;
    }

    setLoading(true);

    try {
      /*
       * 최종 저장 API에서도 다시 한번
       * 강사 가용시간과 일정 충돌을 검증합니다.
       */
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

      let result: ScheduleResponse =
        {};

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
          "원어민 화상 레벨테스트 일정이 저장되었습니다."
      );

      /*
       * 저장 직후 다시 가용시간을 조회하면
       * 현재 레벨테스트 일정은 API에서 제외하므로
       * 선택한 시간이 그대로 유지될 수 있습니다.
       */
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
          담당 강사와 날짜를 선택하면 실제 배정 가능한 시간만
          확인할 수 있습니다. 시간 선택 후 확정 일정을 저장해주세요.
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
            }}
            disabled={
              loading ||
              availabilityLoading
            }
            style={fieldStyle}
          >
            <option value="">
              강사를 선택해주세요.
            </option>

            {sortedTeachers.map(
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
            무료 화상레벨테스트는 기본적으로 필리핀 원어민 강사가
            진행합니다. 필리핀 강사를 목록 상단에 우선 표시하며,
            실제 근무 가능 일정에 따라 다른 국적의 강사도 선택할 수
            있습니다.
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
              htmlFor="testDate"
              style={labelStyle}
            >
              테스트 날짜
            </label>

            <input
              id="testDate"
              type="date"
              value={testDate}
              min={getTodaySeoul()}
              onChange={(event) => {
                setTestDate(
                  event.target.value
                );
              }}
              disabled={
                loading ||
                availabilityLoading
              }
              style={fieldStyle}
            />
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
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={loadAvailability}
            disabled={
              availabilityLoading ||
              loading ||
              !testerUserId ||
              !testDate
            }
            style={{
              minHeight: "44px",
              padding: "0 18px",
              border:
                "1px solid #2f6fed",
              borderRadius: "9px",
              background:
                availabilityLoading
                  ? "#f2f4f7"
                  : "#ffffff",
              color:
                availabilityLoading
                  ? "#98a2b3"
                  : "#2f6fed",
              fontFamily: "inherit",
              fontSize: "12px",
              fontWeight: 900,
              cursor:
                availabilityLoading ||
                loading ||
                !testerUserId ||
                !testDate
                  ? "default"
                  : "pointer",
            }}
          >
            {availabilityLoading
              ? "가능시간 확인 중..."
              : "가능한 테스트 시간 확인"}
          </button>
        </div>

        {availabilityError && (
          <div style={errorBoxStyle}>
            {availabilityError}
          </div>
        )}

        {availabilityLoaded && (
          <div
            style={{
              padding: "18px",
              border:
                "1px solid #dbe7ff",
              borderRadius: "12px",
              background: "#f8faff",
            }}
          >
            <div
              style={{
                color: "#101828",
                fontSize: "13px",
                fontWeight: 900,
              }}
            >
              가능한 테스트 시간
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "#667085",
                fontSize: "11px",
                lineHeight: 1.6,
              }}
            >
              강사의 근무시간, 예외일정, 기존 수업 및 다른
              레벨테스트 일정을 반영한 결과입니다.
            </div>

            {availableSlots.length >
            0 ? (
              <div
                style={{
                  marginTop: "16px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "9px",
                }}
              >
                {availableSlots.map(
                  (slot) => {
                    const selected =
                      selectedTime ===
                      slot;

                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => {
                          setSelectedTime(
                            slot
                          );
                          setErrorMessage(
                            ""
                          );
                          setSuccessMessage(
                            ""
                          );
                        }}
                        style={{
                          minWidth:
                            "82px",
                          minHeight:
                            "42px",
                          padding:
                            "0 14px",
                          border: selected
                            ? "1px solid #0A1F44"
                            : "1px solid #d0d5dd",
                          borderRadius:
                            "9px",
                          background:
                            selected
                              ? "#0A1F44"
                              : "#ffffff",
                          color:
                            selected
                              ? "#ffffff"
                              : "#344054",
                          fontFamily:
                            "inherit",
                          fontSize:
                            "13px",
                          fontWeight:
                            800,
                          cursor:
                            "pointer",
                        }}
                      >
                        {formatTime(
                          slot
                        )}
                      </button>
                    );
                  }
                )}
              </div>
            ) : (
              <div
                style={{
                  marginTop: "14px",
                  padding:
                    "14px 16px",
                  border:
                    "1px solid #e4e7ec",
                  borderRadius:
                    "9px",
                  background:
                    "#ffffff",
                  color: "#667085",
                  fontSize: "12px",
                  lineHeight: 1.6,
                }}
              >
                이 날짜에는 해당 강사가 배정 가능한 시간이 없습니다.
                다른 날짜 또는 다른 강사를 선택해주세요.
              </div>
            )}
          </div>
        )}

        {selectedTime && (
          <div
            style={{
              padding: "15px 17px",
              border:
                "1px solid #abefc6",
              borderRadius: "10px",
              background: "#ecfdf3",
            }}
          >
            <div
              style={{
                color: "#027a48",
                fontSize: "11px",
                fontWeight: 800,
              }}
            >
              선택한 테스트 일정
            </div>

            <div
              style={{
                marginTop: "5px",
                color: "#05603a",
                fontSize: "15px",
                fontWeight: 900,
              }}
            >
              {formatDate(
                testDate
              )}{" "}
              {formatTime(
                selectedTime
              )}{" "}
              · 20분
            </div>
          </div>
        )}

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
            }}
            placeholder="https://..."
            disabled={loading}
            style={fieldStyle}
          />

          <div style={helpStyle}>
            아직 링크가 정해지지 않았다면 비워둔 뒤 나중에 다시
            저장해도 됩니다.
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
            강사와 날짜를 선택하면 TALKLY가 실제 배정 가능한
            시간만 표시합니다. 관리자는 학부모와 협의한 시간을
            선택한 뒤 확정 일정을 저장합니다.
          </p>

          <p
            style={{
              margin: "7px 0 0",
              color: "#667085",
              fontSize: "11px",
              lineHeight: 1.7,
            }}
          >
            저장 순간에도 서버가 강사 근무시간, 예외일정,
            운영 차단, 정규수업 및 다른 레벨테스트와의 충돌을
            다시 확인합니다.
          </p>
        </div>

        {errorMessage && (
          <div style={errorBoxStyle}>
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
            disabled={
              loading ||
              availabilityLoading ||
              !selectedTime
            }
            style={{
              minHeight: "46px",
              padding: "0 22px",
              border: "none",
              borderRadius: "10px",
              background:
                loading ||
                availabilityLoading ||
                !selectedTime
                  ? "#98a2b3"
                  : "#0A1F44",
              color: "#ffffff",
              fontFamily: "inherit",
              fontSize: "13px",
              fontWeight: 900,
              cursor:
                loading ||
                availabilityLoading ||
                !selectedTime
                  ? "default"
                  : "pointer",
            }}
          >
            {loading
              ? "일정 확인 및 저장 중..."
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

  const normalized = value
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

  const normalized = value
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

function getSeoulScheduleParts(
  value: string | null
) {
  if (!value) {
    return {
      date: "",
      time: "",
    };
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return {
      date: "",
      time: "",
    };
  }

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

  const formatted =
    formatter.format(date);

  const [datePart, timePart] =
    formatted.split(" ");

  return {
    date: datePart || "",
    time: timePart || "",
  };
}

function seoulLocalToIso(
  dateString: string,
  timeString: string
) {
  const [year, month, day] =
    dateString
      .split("-")
      .map(Number);

  const [hour, minute] =
    timeString
      .split(":")
      .map(Number);

  if (
    !year ||
    !month ||
    !day ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return null;
  }

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour - 9,
      minute,
      0,
      0
    )
  );

  return date.toISOString();
}

function getTodaySeoul() {
  const formatter =
    new Intl.DateTimeFormat(
      "sv-SE",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    );

  return formatter.format(
    new Date()
  );
}

function formatDate(
  value: string
) {
  if (!value) {
    return "";
  }

  const [year, month, day] =
    value.split("-");

  return `${year}.${month}.${day}`;
}

function formatTime(
  value: string
) {
  if (!value) {
    return "";
  }

  const [hour, minute] =
    value.split(":");

  return `${hour}:${minute}`;
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

const errorBoxStyle = {
  padding: "14px 16px",
  border: "1px solid #fda29b",
  borderRadius: "10px",
  background: "#fffbfa",
  color: "#b42318",
  fontSize: "12px",
  fontWeight: 700,
  lineHeight: 1.6,
};