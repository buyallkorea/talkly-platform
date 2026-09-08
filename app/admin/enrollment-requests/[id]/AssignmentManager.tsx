"use client";

import {
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type TeacherSummary = {
  user_id: string;
  display_name: string | null;
  nationality: string | null;
};

type AvailabilityTeacher = {
  teacherUserId: string;
  displayName: string;
  availableTimes: string[];
};

type AvailabilityResponse = {
  availableTeachers?: AvailabilityTeacher[];
  error?: string;
  message?: string;
};

type Props = {
  requestId: number;
  preferredDays: string[];
  preferredTimes: Record<string, string>;
  startDate: string | null;
  lessonDurationMinutes: number;
  lessonsPerWeek: number;
  teacherPreferenceType: string;
  preferredTeacherUserId: string | null;
  teachers: TeacherSummary[];
  currentAssignedTeacherUserId: string | null;
  currentAssignedDays: string[] | null;
  currentAssignedTimes: Record<string, string> | null;
};

const DAY_LABELS: Record<string, string> = {
  Sunday: "일",
  Monday: "월",
  Tuesday: "화",
  Wednesday: "수",
  Thursday: "목",
  Friday: "금",
  Saturday: "토",
};

const DAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function formatDateOnly(
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

function getNextDateForWeekday({
  baseDateText,
  weekday,
}: {
  baseDateText: string;
  weekday: string;
}) {
  const targetDay =
    DAY_INDEX[weekday];

  if (
    targetDay === undefined
  ) {
    return null;
  }

  const base =
    new Date(
      `${baseDateText}T12:00:00`
    );

  if (
    Number.isNaN(
      base.getTime()
    )
  ) {
    return null;
  }

  const diff =
    (
      targetDay -
      base.getDay() +
      7
    ) % 7;

  const result =
    new Date(base);

  result.setDate(
    result.getDate() +
      diff
  );

  return formatDateOnly(
    result
  );
}

function firstPreferredTime(
  preferredDays: string[],
  preferredTimes: Record<string, string>
) {
  for (
    const day of
    preferredDays
  ) {
    if (
      preferredTimes[day]
    ) {
      return preferredTimes[
        day
      ];
    }
  }

  return "";
}

export default function AssignmentManager({
  requestId,
  preferredDays,
  preferredTimes,
  startDate,
  lessonDurationMinutes,
  lessonsPerWeek,
  teacherPreferenceType,
  preferredTeacherUserId,
  teachers,
  currentAssignedTeacherUserId,
  currentAssignedDays,
  currentAssignedTimes,
}: Props) {
  const router =
    useRouter();

  const hasCurrentAssignment =
    Boolean(
      currentAssignedTeacherUserId
    );

  const [
    isEditingAssignment,
    setIsEditingAssignment,
  ] = useState(
    !hasCurrentAssignment
  );

  const initialDays =
    currentAssignedDays &&
    currentAssignedDays.length >
      0
      ? currentAssignedDays
      : preferredDays;

  const initialTime =
    currentAssignedTimes
      ? firstPreferredTime(
          initialDays,
          currentAssignedTimes
        )
      : firstPreferredTime(
          preferredDays,
          preferredTimes
        );

  const [
    selectedTeacherId,
    setSelectedTeacherId,
  ] = useState(
    currentAssignedTeacherUserId ??
      (
        teacherPreferenceType ===
          "specific"
          ? preferredTeacherUserId ??
            ""
          : ""
      )
  );

  const [
    assignedDays,
    setAssignedDays,
  ] = useState<string[]>(
    initialDays
  );

  const [
    assignedTime,
    setAssignedTime,
  ] = useState(
    initialTime
  );

  const [
    checking,
    setChecking,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    availabilityCheckedAt,
    setAvailabilityCheckedAt,
  ] =
    useState<string | null>(
      null
    );

  const [
    checkSuccess,
    setCheckSuccess,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const timeOptions =
    useMemo(() => {
      const result: string[] =
        [];

      for (
        let hour = 10;
        hour <= 21;
        hour += 1
      ) {
        result.push(
          `${String(hour).padStart(2, "0")}:00`
        );

        if (
          lessonDurationMinutes ===
            25 &&
          !(
            hour === 21
          )
        ) {
          result.push(
            `${String(hour).padStart(2, "0")}:30`
          );
        }

        if (
          lessonDurationMinutes ===
            25 &&
          hour === 21
        ) {
          result.push(
            "21:30"
          );
        }
      }

      return result;
    }, [
      lessonDurationMinutes,
    ]);

  const selectedTeacher =
    teachers.find(
      (teacher) =>
        teacher.user_id ===
        selectedTeacherId
    ) ?? null;

  const currentAssignedTeacher =
    currentAssignedTeacherUserId
      ? teachers.find(
          (teacher) =>
            teacher.user_id ===
            currentAssignedTeacherUserId
        ) ?? null
      : null;

  const currentAssignmentSchedule =
    (currentAssignedDays ?? [])
      .map(
        (day) =>
          `${DAY_LABELS[day] ?? day} ${
            currentAssignedTimes?.[day] ??
            "-"
          }`
      )
      .join(" · ");

  function invalidateCheck() {
    setCheckSuccess(
      false
    );
    setAvailabilityCheckedAt(
      null
    );
    setErrorMessage(
      ""
    );
    setSuccessMessage(
      ""
    );
  }

  function toggleDay(
    day: string
  ) {
    if (
      assignedDays.includes(
        day
      )
    ) {
      setAssignedDays(
        (current) =>
          current.filter(
            (item) =>
              item !== day
          )
      );

      invalidateCheck();
      return;
    }

    if (
      assignedDays.length >=
      lessonsPerWeek
    ) {
      setErrorMessage(
        `주 ${lessonsPerWeek}회이므로 요일은 ${lessonsPerWeek}개까지만 선택할 수 있습니다.`
      );
      return;
    }

    if (
      (
        day === "Saturday" &&
        assignedDays.includes(
          "Sunday"
        )
      ) ||
      (
        day === "Sunday" &&
        assignedDays.includes(
          "Saturday"
        )
      )
    ) {
      setErrorMessage(
        "토요일과 일요일은 동시에 배정할 수 없습니다."
      );
      return;
    }

    setAssignedDays(
      (current) => [
        ...current,
        day,
      ]
    );

    invalidateCheck();
  }

  async function checkAvailability() {
    setErrorMessage(
      ""
    );
    setSuccessMessage(
      ""
    );
    setCheckSuccess(
      false
    );
    setAvailabilityCheckedAt(
      null
    );

    if (
      !selectedTeacherId
    ) {
      setErrorMessage(
        "배정할 강사를 선택해주세요."
      );
      return;
    }

    if (
      assignedDays.length !==
      lessonsPerWeek
    ) {
      setErrorMessage(
        `배정 요일을 정확히 ${lessonsPerWeek}개 선택해주세요.`
      );
      return;
    }

    if (
      !assignedTime
    ) {
      setErrorMessage(
        "수업시간을 선택해주세요."
      );
      return;
    }

    const baseDate =
      startDate ??
      formatDateOnly(
        new Date()
      );

    setChecking(
      true
    );

    try {
      for (
        const day of
        assignedDays
      ) {
        const date =
          getNextDateForWeekday({
            baseDateText:
              baseDate,
            weekday: day,
          });

        if (!date) {
          throw new Error(
            `${DAY_LABELS[day] ?? day}요일 날짜를 계산하지 못했습니다.`
          );
        }

        const response =
          await fetch(
            "/api/admin/teacher-availability",
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  date,
                  durationMinutes:
                    lessonDurationMinutes,
                  teacherUserId:
                    selectedTeacherId,
                }),
            }
          );

        const result =
          (await response.json()) as
            AvailabilityResponse;

        if (
          !response.ok
        ) {
          throw new Error(
            result.error ||
              "강사 가용시간 조회에 실패했습니다."
          );
        }

        const teacher =
          (
            result.availableTeachers ??
            []
          ).find(
            (item) =>
              item.teacherUserId ===
              selectedTeacherId
          );

        if (
          !teacher ||
          !teacher.availableTimes.includes(
            assignedTime
          )
        ) {
          throw new Error(
            `${
              DAY_LABELS[day] ??
              day
            }요일 ${assignedTime}에는 ${
              selectedTeacher?.display_name ??
              "선택 강사"
            } 강사를 배정할 수 없습니다.${
              result.message
                ? ` (${result.message})`
                : ""
            }`
          );
        }
      }

      const checkedAt =
        new Date().toISOString();

      setAvailabilityCheckedAt(
        checkedAt
      );

      setCheckSuccess(
        true
      );

      setSuccessMessage(
        `${selectedTeacher?.display_name ?? "선택 강사"} 강사가 선택한 모든 요일의 ${assignedTime} 수업에 현재 배정 가능합니다.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "강사 가용시간 확인 중 오류가 발생했습니다."
      );
    } finally {
      setChecking(
        false
      );
    }
  }

  async function confirmAssignment() {
    setErrorMessage(
      ""
    );

    if (
      !checkSuccess ||
      !availabilityCheckedAt
    ) {
      setErrorMessage(
        "강사 가용시간을 먼저 재확인해주세요."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `수강신청 #${requestId}의 강사와 일정을 확정하시겠습니까?\n\n강사: ${selectedTeacher?.display_name ?? "선택 강사"}\n일정: ${assignedDays
          .map(
            (day) =>
              `${DAY_LABELS[day] ?? day}`
          )
          .join(" · ")} / 매 수업 ${assignedTime}\n수업: ${lessonDurationMinutes}분 · 주 ${lessonsPerWeek}회`
      );

    if (!confirmed) {
      return;
    }

    setSaving(
      true
    );

    try {
      const response =
        await fetch(
          `/api/admin/enrollment-requests/${requestId}/assign`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                teacherUserId:
                  selectedTeacherId,
                assignedDays,
                assignedTime,
                lessonDurationMinutes,
                lessonsPerWeek,
                availabilityCheckedAt,
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        setErrorMessage(
          result.error ||
            "배정 저장에 실패했습니다."
        );
        return;
      }

      setSuccessMessage(
        hasCurrentAssignment
          ? "강사와 수업 일정이 변경되었습니다."
          : "강사와 수업 일정이 배정되었습니다. 아직 enrollment와 class_sessions는 생성하지 않았습니다."
      );

      setIsEditingAssignment(
        false
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "배정 저장 중 오류가 발생했습니다."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  if (
    hasCurrentAssignment &&
    !isEditingAssignment
  ) {
    return (
      <section
        className="talkly-card"
        style={{
          marginTop: "24px",
          padding: "26px",
          border:
            "1px solid #abefc6",
          background:
            "linear-gradient(180deg, #ffffff 0%, #f8fffb 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "flex-start",
            gap: "18px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="talkly-section-label">
              ASSIGNMENT CONFIRMED
            </div>

            <h2
              style={{
                margin: "7px 0 0",
                color:
                  "var(--talkly-navy)",
                fontSize: "24px",
              }}
            >
              강사 · 일정 배정 완료
            </h2>

            <p
              style={{
                margin: "9px 0 0",
                color: "#667085",
                fontSize: "12px",
                lineHeight: 1.7,
              }}
            >
              현재 배정은 보호 상태입니다.
              변경이 필요한 경우에만
              배정 변경을 눌러 수정해주세요.
            </p>
          </div>

          <span
            style={{
              minHeight: "32px",
              padding: "0 11px",
              display: "inline-flex",
              alignItems: "center",
              border:
                "1px solid #abefc6",
              borderRadius: "999px",
              background: "#ecfdf3",
              color: "#067647",
              fontSize: "11px",
              fontWeight: 900,
            }}
          >
            배정 완료
          </span>
        </div>

        <div
          style={{
            marginTop: "22px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "10px",
          }}
        >
          <ReadOnlyInfo
            label="배정 강사"
            value={
              currentAssignedTeacher?.display_name ??
              "확인 필요"
            }
            subValue={
              currentAssignedTeacher?.nationality ??
              undefined
            }
          />

          <ReadOnlyInfo
            label="확정 일정"
            value={
              currentAssignmentSchedule ||
              "확인 필요"
            }
          />

          <ReadOnlyInfo
            label="수업 조건"
            value={`${lessonDurationMinutes}분 · 주 ${lessonsPerWeek}회`}
          />
        </div>

        <div
          style={{
            marginTop: "18px",
            padding: "14px 16px",
            border:
              "1px solid #dbe6ff",
            borderRadius: "10px",
            background: "#f8faff",
            color: "#475467",
            fontSize: "11px",
            lineHeight: 1.7,
          }}
        >
          배정 완료 후에는 학부모의
          수강기간 선택과 결제 단계로
          이어집니다. 현재 단계에서는
          enrollment 및 class_sessions를
          생성하지 않습니다.
        </div>

        <div
          style={{
            marginTop: "18px",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={() => {
              const confirmed =
                window.confirm(
                  "현재 배정 내용을 변경하시겠습니까?\n\n변경 후에는 반드시 강사 가용시간을 다시 확인하고 배정을 확정해야 합니다."
                );

              if (!confirmed) {
                return;
              }

              invalidateCheck();
              setIsEditingAssignment(
                true
              );
            }}
            style={{
              minHeight: "42px",
              padding: "0 16px",
              border:
                "1px solid #d0d5dd",
              borderRadius: "9px",
              background: "#ffffff",
              color: "#344054",
              fontFamily: "inherit",
              fontSize: "12px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            배정 변경
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="talkly-card"
      style={{
        marginTop: "24px",
        padding: "26px",
      }}
    >
      <div className="talkly-section-label">
        ASSIGN CLASS
      </div>

      <h2
        style={{
          margin:
            "7px 0 0",
          color:
            "var(--talkly-navy)",
          fontSize: "24px",
        }}
      >
        {hasCurrentAssignment
          ? "강사 · 일정 배정 변경"
          : "실제 강사 · 일정 배정"}
      </h2>

      <p
        style={{
          margin:
            "9px 0 0",
          color:
            "#667085",
          lineHeight: 1.7,
        }}
      >
        {hasCurrentAssignment
          ? "현재 배정 내용을 수정하고 있습니다. 변경 내용을 저장하기 전에 반드시 실제 가용시간을 다시 확인해주세요."
          : "학부모의 희망조건을 기본값으로 사용하되 필요하면 관리자가 조정할 수 있습니다. 배정 확정 전 반드시 실제 가용시간을 다시 확인합니다."}
      </p>

      <div
        style={{
          marginTop: "22px",
        }}
      >
        <FieldLabel>
          배정 강사
        </FieldLabel>

        <select
          value={
            selectedTeacherId
          }
          onChange={(
            event
          ) => {
            setSelectedTeacherId(
              event.target.value
            );
            invalidateCheck();
          }}
          style={
            fieldStyle
          }
        >
          <option value="">
            강사 선택
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
                {teacher.display_name ??
                  "Teacher"}
                {teacher.nationality
                  ? ` · ${teacher.nationality}`
                  : ""}
                {teacher.user_id ===
                preferredTeacherUserId
                  ? " · 학부모 희망"
                  : ""}
              </option>
            )
          )}
        </select>
      </div>

      <div
        style={{
          marginTop: "22px",
        }}
      >
        <FieldLabel>
          배정 요일 ·{" "}
          {lessonsPerWeek}개
        </FieldLabel>

        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {DAY_ORDER.map(
            (day) => (
              <ChoiceButton
                key={day}
                active={
                  assignedDays.includes(
                    day
                  )
                }
                onClick={() =>
                  toggleDay(day)
                }
              >
                {
                  DAY_LABELS[
                    day
                  ]
                }
              </ChoiceButton>
            )
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: "22px",
        }}
      >
        <FieldLabel>
          매 수업 시작시간
        </FieldLabel>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "7px",
          }}
        >
          {timeOptions.map(
            (time) => (
              <ChoiceButton
                key={time}
                active={
                  assignedTime ===
                  time
                }
                onClick={() => {
                  setAssignedTime(
                    time
                  );
                  invalidateCheck();
                }}
              >
                {time}
              </ChoiceButton>
            )
          )}
        </div>
      </div>

      {errorMessage && (
        <div
          style={{
            marginTop: "18px",
            padding:
              "13px 15px",
            border:
              "1px solid #fecdca",
            borderRadius:
              "10px",
            background:
              "#fef3f2",
            color:
              "#b42318",
            fontSize:
              "12px",
            lineHeight: 1.7,
            fontWeight: 700,
          }}
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          style={{
            marginTop: "18px",
            padding:
              "13px 15px",
            border:
              "1px solid #abefc6",
            borderRadius:
              "10px",
            background:
              "#ecfdf3",
            color:
              "#067647",
            fontSize:
              "12px",
            lineHeight: 1.7,
            fontWeight: 700,
          }}
        >
          {successMessage}
        </div>
      )}

      <div
        style={{
          marginTop: "20px",
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={
            checkAvailability
          }
          disabled={
            checking ||
            saving
          }
          style={{
            minHeight:
              "48px",
            padding:
              "0 18px",
            border: 0,
            borderRadius:
              "10px",
            background:
              "#175cd3",
            color:
              "#ffffff",
            fontFamily:
              "inherit",
            fontSize:
              "13px",
            fontWeight:
              900,
            cursor:
              checking
                ? "wait"
                : "pointer",
          }}
        >
          {checking
            ? "가용시간 확인 중..."
            : "실제 가용시간 재확인"}
        </button>

        <button
          type="button"
          onClick={
            confirmAssignment
          }
          disabled={
            !checkSuccess ||
            saving
          }
          style={{
            minHeight:
              "48px",
            padding:
              "0 18px",
            border: 0,
            borderRadius:
              "10px",
            background:
              checkSuccess &&
              !saving
                ? "#0a1f44"
                : "#d0d5dd",
            color:
              checkSuccess &&
              !saving
                ? "#ffffff"
                : "#667085",
            fontFamily:
              "inherit",
            fontSize:
              "13px",
            fontWeight:
              900,
            cursor:
              checkSuccess &&
              !saving
                ? "pointer"
                : "not-allowed",
          }}
        >
          {saving
            ? "배정 저장 중..."
            : hasCurrentAssignment
            ? "변경 배정 확정"
            : "강사 · 일정 배정 확정"}
        </button>

        {hasCurrentAssignment && (
          <button
            type="button"
            onClick={() => {
              setSelectedTeacherId(
                currentAssignedTeacherUserId ??
                  ""
              );
              setAssignedDays(
                currentAssignedDays ??
                  preferredDays
              );
              setAssignedTime(
                currentAssignedTimes
                  ? firstPreferredTime(
                      currentAssignedDays ??
                        preferredDays,
                      currentAssignedTimes
                    )
                  : firstPreferredTime(
                      preferredDays,
                      preferredTimes
                    )
              );
              invalidateCheck();
              setIsEditingAssignment(
                false
              );
            }}
            disabled={
              checking ||
              saving
            }
            style={{
              minHeight: "48px",
              padding: "0 18px",
              border:
                "1px solid #d0d5dd",
              borderRadius: "10px",
              background: "#ffffff",
              color: "#344054",
              fontFamily: "inherit",
              fontSize: "13px",
              fontWeight: 900,
              cursor:
                checking || saving
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            변경 취소
          </button>
        )}
      </div>

      <div
        style={{
          marginTop: "12px",
          color:
            "#98a2b3",
          fontSize: "11px",
          lineHeight: 1.7,
        }}
      >
        현재 단계에서는
        enrollment 및
        class_sessions를 생성하지
        않습니다. 배정 확정 후
        학부모의 수강기간 선택과
        결제 단계로 이어집니다.
      </div>
    </section>
  );
}

function ReadOnlyInfo({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div
      style={{
        padding: "15px 16px",
        border:
          "1px solid #eaecf0",
        borderRadius: "11px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "10px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "5px",
          color: "#101828",
          fontSize: "13px",
          fontWeight: 900,
          lineHeight: 1.55,
        }}
      >
        {value}
      </div>

      {subValue && (
        <div
          style={{
            marginTop: "3px",
            color: "#98a2b3",
            fontSize: "10px",
          }}
        >
          {subValue}
        </div>
      )}
    </div>
  );
}

function FieldLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginBottom: "8px",
        color: "#344054",
        fontSize: "12px",
        fontWeight: 900,
      }}
    >
      {children}
    </div>
  );
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight:
          "38px",
        padding:
          "0 13px",
        border: active
          ? "1px solid #2f6fed"
          : "1px solid #d0d5dd",
        borderRadius:
          "9px",
        background:
          active
            ? "#eff8ff"
            : "#ffffff",
        color: active
          ? "#175cd3"
          : "#475467",
        fontFamily:
          "inherit",
        fontSize:
          "12px",
        fontWeight:
          800,
        cursor:
          "pointer",
      }}
    >
      {children}
    </button>
  );
}

const fieldStyle:
  React.CSSProperties = {
  width: "100%",
  minHeight: "44px",
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