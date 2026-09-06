"use client";

import {
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

type RegularAvailability = {
  id: number;
  teacher_user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_available: boolean;
  effective_from: string | null;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
};

type AvailabilityException = {
  id: number;
  teacher_user_id: string;
  exception_date: string;
  exception_type:
    | "available"
    | "unavailable";
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  teacherUserId: string;
  teacherName: string;
  initialRegularAvailability:
    RegularAvailability[];
  initialExceptions:
    AvailabilityException[];
};

const DAY_NAMES = [
  "일요일",
  "월요일",
  "화요일",
  "수요일",
  "목요일",
  "금요일",
  "토요일",
];

function shortTime(
  value: string | null
) {
  if (!value) {
    return "";
  }

  return value.slice(
    0,
    5
  );
}

function formatPeriod(
  from: string | null,
  to: string | null
) {
  if (
    !from &&
    !to
  ) {
    return "기간 제한 없음";
  }

  if (
    from &&
    !to
  ) {
    return `${from}부터`;
  }

  if (
    !from &&
    to
  ) {
    return `${to}까지`;
  }

  return `${from} ~ ${to}`;
}

export default function TeacherAvailabilityManager({
  teacherUserId,
  teacherName,
  initialRegularAvailability,
  initialExceptions,
}: Props) {
  const router =
    useRouter();

  const [
    regularAvailability,
    setRegularAvailability,
  ] = useState<
    RegularAvailability[]
  >(
    initialRegularAvailability
  );

  const [
    exceptions,
    setExceptions,
  ] = useState<
    AvailabilityException[]
  >(
    initialExceptions
  );

  const [
    regularDay,
    setRegularDay,
  ] =
    useState<number>(1);

  const [
    regularStart,
    setRegularStart,
  ] =
    useState("10:00");

  const [
    regularEnd,
    setRegularEnd,
  ] =
    useState("18:00");

  const [
    regularFrom,
    setRegularFrom,
  ] =
    useState("");

  const [
    regularTo,
    setRegularTo,
  ] =
    useState("");

  const [
    editingRegularId,
    setEditingRegularId,
  ] =
    useState<
      number | null
    >(null);

  const [
    exceptionDate,
    setExceptionDate,
  ] =
    useState("");

  const [
    exceptionType,
    setExceptionType,
  ] =
    useState<
      "available" | "unavailable"
    >("unavailable");

  const [
    exceptionAllDay,
    setExceptionAllDay,
  ] =
    useState(true);

  const [
    exceptionStart,
    setExceptionStart,
  ] =
    useState("10:00");

  const [
    exceptionEnd,
    setExceptionEnd,
  ] =
    useState("18:00");

  const [
    exceptionReason,
    setExceptionReason,
  ] =
    useState("");

  const [
    editingExceptionId,
    setEditingExceptionId,
  ] =
    useState<
      number | null
    >(null);

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const groupedRegular =
    useMemo(() => {
      return DAY_NAMES.map(
        (
          dayName,
          dayIndex
        ) => ({
          dayName,
          dayIndex,
          items:
            regularAvailability
              .filter(
                (item) =>
                  item.day_of_week ===
                  dayIndex
              )
              .sort(
                (a, b) =>
                  a.start_time.localeCompare(
                    b.start_time
                  )
              ),
        })
      );
    }, [
      regularAvailability,
    ]);

  async function callApi(
    body: Record<
      string,
      unknown
    >
  ) {
    const response =
      await fetch(
        `/api/admin/teachers/${teacherUserId}/availability`,
        {
          method:
            "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify(
              body
            ),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "처리하지 못했습니다."
      );
    }

    return data;
  }

  function clearMessages() {
    setMessage("");
    setErrorMessage("");
  }

  function resetRegularForm() {
    setEditingRegularId(
      null
    );
    setRegularDay(1);
    setRegularStart(
      "10:00"
    );
    setRegularEnd(
      "18:00"
    );
    setRegularFrom("");
    setRegularTo("");
  }

  function resetExceptionForm() {
    setEditingExceptionId(
      null
    );
    setExceptionDate("");
    setExceptionType(
      "unavailable"
    );
    setExceptionAllDay(
      true
    );
    setExceptionStart(
      "10:00"
    );
    setExceptionEnd(
      "18:00"
    );
    setExceptionReason(
      ""
    );
  }

  async function handleSaveRegular() {
    clearMessages();

    if (
      !regularStart ||
      !regularEnd
    ) {
      setErrorMessage(
        "시작시간과 종료시간을 입력해주세요."
      );
      return;
    }

    setIsSaving(true);

    try {
      if (
        editingRegularId
      ) {
        const data =
          await callApi({
            action:
              "update_regular",
            availabilityId:
              editingRegularId,
            dayOfWeek:
              regularDay,
            startTime:
              regularStart,
            endTime:
              regularEnd,
            effectiveFrom:
              regularFrom ||
              null,
            effectiveTo:
              regularTo ||
              null,
            isAvailable:
              true,
          });

        if (
          data.availability
        ) {
          setRegularAvailability(
            (
              current
            ) =>
              current.map(
                (item) =>
                  item.id ===
                  editingRegularId
                    ? data.availability
                    : item
              )
          );
        }

        setMessage(
          "정규 근무시간을 수정했습니다."
        );
      } else {
        const data =
          await callApi({
            action:
              "create_regular",
            dayOfWeek:
              regularDay,
            startTime:
              regularStart,
            endTime:
              regularEnd,
            effectiveFrom:
              regularFrom ||
              null,
            effectiveTo:
              regularTo ||
              null,
          });

        if (
          data.availability
        ) {
          setRegularAvailability(
            (
              current
            ) => [
              ...current,
              data.availability,
            ]
          );
        }

        setMessage(
          "정규 근무시간을 등록했습니다."
        );
      }

      resetRegularForm();
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "근무시간 처리 중 오류가 발생했습니다."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleEditRegular(
    item: RegularAvailability
  ) {
    clearMessages();

    setEditingRegularId(
      item.id
    );

    setRegularDay(
      item.day_of_week
    );

    setRegularStart(
      shortTime(
        item.start_time
      )
    );

    setRegularEnd(
      shortTime(
        item.end_time
      )
    );

    setRegularFrom(
      item.effective_from ||
        ""
    );

    setRegularTo(
      item.effective_to ||
        ""
    );

    window.scrollTo({
      top: 0,
      behavior:
        "smooth",
    });
  }

  async function handleDeleteRegular(
    item: RegularAvailability
  ) {
    clearMessages();

    const confirmed =
      window.confirm(
        `${DAY_NAMES[item.day_of_week]} ${shortTime(
          item.start_time
        )}~${shortTime(
          item.end_time
        )} 근무시간을 삭제하시겠습니까?\n\n기존 확정 수업은 삭제되지 않습니다.`
      );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);

    try {
      await callApi({
        action:
          "delete_regular",
        availabilityId:
          item.id,
      });

      setRegularAvailability(
        (current) =>
          current.filter(
            (row) =>
              row.id !==
              item.id
          )
      );

      if (
        editingRegularId ===
        item.id
      ) {
        resetRegularForm();
      }

      setMessage(
        "정규 근무시간을 삭제했습니다."
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "근무시간 삭제 중 오류가 발생했습니다."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveException() {
    clearMessages();

    if (
      !exceptionDate
    ) {
      setErrorMessage(
        "예외 날짜를 선택해주세요."
      );
      return;
    }

    if (
      !exceptionAllDay &&
      (
        !exceptionStart ||
        !exceptionEnd
      )
    ) {
      setErrorMessage(
        "시작시간과 종료시간을 입력해주세요."
      );
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        exceptionDate,
        exceptionType,
        startTime:
          exceptionAllDay
            ? null
            : exceptionStart,
        endTime:
          exceptionAllDay
            ? null
            : exceptionEnd,
        reason:
          exceptionReason ||
          null,
      };

      if (
        editingExceptionId
      ) {
        const data =
          await callApi({
            action:
              "update_exception",
            exceptionId:
              editingExceptionId,
            ...payload,
            isActive:
              true,
          });

        if (
          data.exception
        ) {
          setExceptions(
            (
              current
            ) =>
              current.map(
                (item) =>
                  item.id ===
                  editingExceptionId
                    ? data.exception
                    : item
              )
          );
        }

        setMessage(
          "예외일정을 수정했습니다."
        );
      } else {
        const data =
          await callApi({
            action:
              "create_exception",
            ...payload,
          });

        if (
          data.exception
        ) {
          setExceptions(
            (
              current
            ) => [
              ...current,
              data.exception,
            ]
          );
        }

        setMessage(
          "예외일정을 등록했습니다."
        );
      }

      resetExceptionForm();
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "예외일정 처리 중 오류가 발생했습니다."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleEditException(
    item: AvailabilityException
  ) {
    clearMessages();

    setEditingExceptionId(
      item.id
    );

    setExceptionDate(
      item.exception_date
    );

    setExceptionType(
      item.exception_type
    );

    const allDay =
      !item.start_time &&
      !item.end_time;

    setExceptionAllDay(
      allDay
    );

    setExceptionStart(
      item.start_time
        ? shortTime(
            item.start_time
          )
        : "10:00"
    );

    setExceptionEnd(
      item.end_time
        ? shortTime(
            item.end_time
          )
        : "18:00"
    );

    setExceptionReason(
      item.reason ||
        ""
    );
  }

  async function handleDeleteException(
    item: AvailabilityException
  ) {
    clearMessages();

    const confirmed =
      window.confirm(
        `${item.exception_date} 예외일정을 삭제하시겠습니까?`
      );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);

    try {
      await callApi({
        action:
          "delete_exception",
        exceptionId:
          item.id,
      });

      setExceptions(
        (current) =>
          current.filter(
            (row) =>
              row.id !==
              item.id
          )
      );

      if (
        editingExceptionId ===
        item.id
      ) {
        resetExceptionForm();
      }

      setMessage(
        "예외일정을 삭제했습니다."
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "예외일정 삭제 중 오류가 발생했습니다."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      style={{
        marginTop:
          "22px",
        display:
          "flex",
        flexDirection:
          "column",
        gap: "22px",
      }}
    >
      {(message ||
        errorMessage) && (
        <div
          style={{
            padding:
              "14px 16px",
            borderRadius:
              "10px",
            border:
              errorMessage
                ? "1px solid #fda29b"
                : "1px solid #abefc6",
            background:
              errorMessage
                ? "#fef3f2"
                : "#ecfdf3",
            color:
              errorMessage
                ? "#b42318"
                : "#067647",
            fontSize:
              "13px",
            fontWeight:
              700,
          }}
        >
          {errorMessage ||
            message}
        </div>
      )}

      {/* ============================= */}
      {/* 정규 근무시간 등록/수정 */}
      {/* ============================= */}

      <section
        style={{
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "14px",
          background:
            "#ffffff",
          overflow:
            "hidden",
        }}
      >
        <div
          style={{
            padding:
              "22px 24px",
            borderBottom:
              "1px solid #e4e7ec",
          }}
        >
          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              gap: "16px",
              alignItems:
                "flex-start",
              flexWrap:
                "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize:
                    "20px",
                }}
              >
                정규 근무시간
              </h2>

              <p
                style={{
                  margin:
                    "6px 0 0",
                  color:
                    "#667085",
                  fontSize:
                    "13px",
                }}
              >
                {teacherName} 강사가 반복적으로 수업 가능한 요일과 시간입니다.
              </p>
            </div>

            {editingRegularId && (
              <button
                type="button"
                onClick={
                  resetRegularForm
                }
                disabled={
                  isSaving
                }
                style={{
                  border:
                    "1px solid #d0d5dd",
                  borderRadius:
                    "8px",
                  background:
                    "#ffffff",
                  padding:
                    "8px 12px",
                  cursor:
                    "pointer",
                  fontWeight:
                    700,
                }}
              >
                수정 취소
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            padding:
              "20px 24px",
            background:
              "#f8fafc",
          }}
        >
          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "150px 140px 140px minmax(150px, 1fr) minmax(150px, 1fr) auto",
              gap: "10px",
              alignItems:
                "end",
            }}
          >
            <label>
              <div
                style={{
                  marginBottom:
                    "6px",
                  fontSize:
                    "12px",
                  fontWeight:
                    700,
                  color:
                    "#475467",
                }}
              >
                요일
              </div>

              <select
                value={
                  regularDay
                }
                onChange={(
                  event
                ) =>
                  setRegularDay(
                    Number(
                      event.target
                        .value
                    )
                  )
                }
                style={{
                  width:
                    "100%",
                  height:
                    "42px",
                  padding:
                    "0 10px",
                  border:
                    "1px solid #d0d5dd",
                  borderRadius:
                    "8px",
                  background:
                    "#ffffff",
                }}
              >
                {DAY_NAMES.map(
                  (
                    day,
                    index
                  ) => (
                    <option
                      key={
                        index
                      }
                      value={
                        index
                      }
                    >
                      {day}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <div
                style={{
                  marginBottom:
                    "6px",
                  fontSize:
                    "12px",
                  fontWeight:
                    700,
                  color:
                    "#475467",
                }}
              >
                시작시간
              </div>

              <input
                type="time"
                value={
                  regularStart
                }
                onChange={(
                  event
                ) =>
                  setRegularStart(
                    event.target
                      .value
                  )
                }
                style={{
                  width:
                    "100%",
                  height:
                    "42px",
                  padding:
                    "0 10px",
                  border:
                    "1px solid #d0d5dd",
                  borderRadius:
                    "8px",
                  background:
                    "#ffffff",
                  boxSizing:
                    "border-box",
                }}
              />
            </label>

            <label>
              <div
                style={{
                  marginBottom:
                    "6px",
                  fontSize:
                    "12px",
                  fontWeight:
                    700,
                  color:
                    "#475467",
                }}
              >
                종료시간
              </div>

              <input
                type="time"
                value={
                  regularEnd
                }
                onChange={(
                  event
                ) =>
                  setRegularEnd(
                    event.target
                      .value
                  )
                }
                style={{
                  width:
                    "100%",
                  height:
                    "42px",
                  padding:
                    "0 10px",
                  border:
                    "1px solid #d0d5dd",
                  borderRadius:
                    "8px",
                  background:
                    "#ffffff",
                  boxSizing:
                    "border-box",
                }}
              />
            </label>

            <label>
              <div
                style={{
                  marginBottom:
                    "6px",
                  fontSize:
                    "12px",
                  fontWeight:
                    700,
                  color:
                    "#475467",
                }}
              >
                적용 시작일
              </div>

              <input
                type="date"
                value={
                  regularFrom
                }
                onChange={(
                  event
                ) =>
                  setRegularFrom(
                    event.target
                      .value
                  )
                }
                style={{
                  width:
                    "100%",
                  height:
                    "42px",
                  padding:
                    "0 10px",
                  border:
                    "1px solid #d0d5dd",
                  borderRadius:
                    "8px",
                  background:
                    "#ffffff",
                  boxSizing:
                    "border-box",
                }}
              />
            </label>

            <label>
              <div
                style={{
                  marginBottom:
                    "6px",
                  fontSize:
                    "12px",
                  fontWeight:
                    700,
                  color:
                    "#475467",
                }}
              >
                적용 종료일
              </div>

              <input
                type="date"
                value={
                  regularTo
                }
                onChange={(
                  event
                ) =>
                  setRegularTo(
                    event.target
                      .value
                  )
                }
                style={{
                  width:
                    "100%",
                  height:
                    "42px",
                  padding:
                    "0 10px",
                  border:
                    "1px solid #d0d5dd",
                  borderRadius:
                    "8px",
                  background:
                    "#ffffff",
                  boxSizing:
                    "border-box",
                }}
              />
            </label>

            <button
              type="button"
              onClick={
                handleSaveRegular
              }
              disabled={
                isSaving
              }
              style={{
                minHeight:
                  "42px",
                padding:
                  "0 18px",
                border: 0,
                borderRadius:
                  "8px",
                background:
                  "#0a1f44",
                color:
                  "#ffffff",
                fontWeight:
                  800,
                cursor:
                  isSaving
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  isSaving
                    ? 0.6
                    : 1,
                whiteSpace:
                  "nowrap",
              }}
            >
              {editingRegularId
                ? "근무시간 수정"
                : "+ 근무시간 추가"}
            </button>
          </div>

          <div
            style={{
              marginTop:
                "10px",
              color:
                "#98a2b3",
              fontSize:
                "11px",
            }}
          >
            적용 시작일과 종료일을 비워두면 기간 제한 없이 반복 적용됩니다.
          </div>
        </div>

        <div
          style={{
            padding:
              "20px 24px 24px",
          }}
        >
          <div
            style={{
              display:
                "flex",
              flexDirection:
                "column",
              gap: "10px",
            }}
          >
            {groupedRegular.map(
              (group) => (
                <div
                  key={
                    group.dayIndex
                  }
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "100px minmax(0, 1fr)",
                    gap: "14px",
                    padding:
                      "14px 0",
                    borderBottom:
                      "1px solid #eef1f5",
                  }}
                >
                  <div
                    style={{
                      fontWeight:
                        800,
                      color:
                        group.items
                          .length >
                        0
                          ? "#101828"
                          : "#98a2b3",
                    }}
                  >
                    {
                      group.dayName
                    }
                  </div>

                  {group.items
                    .length ===
                  0 ? (
                    <div
                      style={{
                        color:
                          "#98a2b3",
                        fontSize:
                          "13px",
                      }}
                    >
                      근무시간 없음
                    </div>
                  ) : (
                    <div
                      style={{
                        display:
                          "flex",
                        flexDirection:
                          "column",
                        gap:
                          "8px",
                      }}
                    >
                      {group.items.map(
                        (
                          item
                        ) => (
                          <div
                            key={
                              item.id
                            }
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              alignItems:
                                "center",
                              gap:
                                "14px",
                              padding:
                                "11px 13px",
                              border:
                                "1px solid #e4e7ec",
                              borderRadius:
                                "9px",
                              background:
                                item.is_available
                                  ? "#ffffff"
                                  : "#f2f4f7",
                            }}
                          >
                            <div>
                              <strong
                                style={{
                                  fontSize:
                                    "14px",
                                }}
                              >
                                {shortTime(
                                  item.start_time
                                )}
                                {" ~ "}
                                {shortTime(
                                  item.end_time
                                )}
                              </strong>

                              <div
                                style={{
                                  marginTop:
                                    "4px",
                                  color:
                                    "#667085",
                                  fontSize:
                                    "11px",
                                }}
                              >
                                {formatPeriod(
                                  item.effective_from,
                                  item.effective_to
                                )}
                              </div>
                            </div>

                            <div
                              style={{
                                display:
                                  "flex",
                                gap:
                                  "6px",
                                flexShrink:
                                  0,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  handleEditRegular(
                                    item
                                  )
                                }
                                disabled={
                                  isSaving
                                }
                                style={{
                                  padding:
                                    "7px 10px",
                                  border:
                                    "1px solid #d0d5dd",
                                  borderRadius:
                                    "7px",
                                  background:
                                    "#ffffff",
                                  cursor:
                                    "pointer",
                                  fontSize:
                                    "12px",
                                  fontWeight:
                                    700,
                                }}
                              >
                                수정
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteRegular(
                                    item
                                  )
                                }
                                disabled={
                                  isSaving
                                }
                                style={{
                                  padding:
                                    "7px 10px",
                                  border:
                                    "1px solid #fda29b",
                                  borderRadius:
                                    "7px",
                                  background:
                                    "#fff",
                                  color:
                                    "#b42318",
                                  cursor:
                                    "pointer",
                                  fontSize:
                                    "12px",
                                  fontWeight:
                                    700,
                                }}
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* ============================= */}
      {/* 특정일 예외 */}
      {/* ============================= */}

      <section
        style={{
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "14px",
          background:
            "#ffffff",
          overflow:
            "hidden",
        }}
      >
        <div
          style={{
            padding:
              "22px 24px",
            borderBottom:
              "1px solid #e4e7ec",
          }}
        >
          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              gap: "16px",
              alignItems:
                "flex-start",
              flexWrap:
                "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize:
                    "20px",
                }}
              >
                특정일 예외일정
              </h2>

              <p
                style={{
                  margin:
                    "6px 0 0",
                  color:
                    "#667085",
                  fontSize:
                    "13px",
                }}
              >
                휴무, 일부시간 근무불가 또는 정규시간 외 추가근무를 등록합니다.
              </p>
            </div>

            {editingExceptionId && (
              <button
                type="button"
                onClick={
                  resetExceptionForm
                }
                disabled={
                  isSaving
                }
                style={{
                  border:
                    "1px solid #d0d5dd",
                  borderRadius:
                    "8px",
                  background:
                    "#ffffff",
                  padding:
                    "8px 12px",
                  cursor:
                    "pointer",
                  fontWeight:
                    700,
                }}
              >
                수정 취소
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            padding:
              "20px 24px",
            background:
              "#f8fafc",
          }}
        >
          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "170px 190px 130px 130px minmax(200px, 1fr) auto",
              gap: "10px",
              alignItems:
                "end",
            }}
          >
            <label>
              <div
                style={{
                  marginBottom:
                    "6px",
                  fontSize:
                    "12px",
                  fontWeight:
                    700,
                  color:
                    "#475467",
                }}
              >
                날짜
              </div>

              <input
                type="date"
                value={
                  exceptionDate
                }
                onChange={(
                  event
                ) =>
                  setExceptionDate(
                    event.target
                      .value
                  )
                }
                style={{
                  width:
                    "100%",
                  height:
                    "42px",
                  padding:
                    "0 10px",
                  border:
                    "1px solid #d0d5dd",
                  borderRadius:
                    "8px",
                  background:
                    "#ffffff",
                  boxSizing:
                    "border-box",
                }}
              />
            </label>

            <label>
              <div
                style={{
                  marginBottom:
                    "6px",
                  fontSize:
                    "12px",
                  fontWeight:
                    700,
                  color:
                    "#475467",
                }}
              >
                예외 유형
              </div>

              <select
                value={
                  exceptionType
                }
                onChange={(
                  event
                ) =>
                  setExceptionType(
                    event.target
                      .value as
                      | "available"
                      | "unavailable"
                  )
                }
                style={{
                  width:
                    "100%",
                  height:
                    "42px",
                  padding:
                    "0 10px",
                  border:
                    "1px solid #d0d5dd",
                  borderRadius:
                    "8px",
                  background:
                    "#ffffff",
                }}
              >
                <option value="unavailable">
                  근무불가 / 휴무
                </option>

                <option value="available">
                  추가근무 가능
                </option>
              </select>
            </label>

            <label>
              <div
                style={{
                  marginBottom:
                    "6px",
                  fontSize:
                    "12px",
                  fontWeight:
                    700,
                  color:
                    "#475467",
                }}
              >
                시작시간
              </div>

              <input
                type="time"
                value={
                  exceptionStart
                }
                disabled={
                  exceptionAllDay
                }
                onChange={(
                  event
                ) =>
                  setExceptionStart(
                    event.target
                      .value
                  )
                }
                style={{
                  width:
                    "100%",
                  height:
                    "42px",
                  padding:
                    "0 10px",
                  border:
                    "1px solid #d0d5dd",
                  borderRadius:
                    "8px",
                  background:
                    exceptionAllDay
                      ? "#f2f4f7"
                      : "#ffffff",
                  boxSizing:
                    "border-box",
                }}
              />
            </label>

            <label>
              <div
                style={{
                  marginBottom:
                    "6px",
                  fontSize:
                    "12px",
                  fontWeight:
                    700,
                  color:
                    "#475467",
                }}
              >
                종료시간
              </div>

              <input
                type="time"
                value={
                  exceptionEnd
                }
                disabled={
                  exceptionAllDay
                }
                onChange={(
                  event
                ) =>
                  setExceptionEnd(
                    event.target
                      .value
                  )
                }
                style={{
                  width:
                    "100%",
                  height:
                    "42px",
                  padding:
                    "0 10px",
                  border:
                    "1px solid #d0d5dd",
                  borderRadius:
                    "8px",
                  background:
                    exceptionAllDay
                      ? "#f2f4f7"
                      : "#ffffff",
                  boxSizing:
                    "border-box",
                }}
              />
            </label>

            <label>
              <div
                style={{
                  marginBottom:
                    "6px",
                  fontSize:
                    "12px",
                  fontWeight:
                    700,
                  color:
                    "#475467",
                }}
              >
                사유
              </div>

              <input
                type="text"
                value={
                  exceptionReason
                }
                onChange={(
                  event
                ) =>
                  setExceptionReason(
                    event.target
                      .value
                  )
                }
                placeholder="예: 병가, 개인일정, 추가근무"
                style={{
                  width:
                    "100%",
                  height:
                    "42px",
                  padding:
                    "0 10px",
                  border:
                    "1px solid #d0d5dd",
                  borderRadius:
                    "8px",
                  background:
                    "#ffffff",
                  boxSizing:
                    "border-box",
                }}
              />
            </label>

            <button
              type="button"
              onClick={
                handleSaveException
              }
              disabled={
                isSaving
              }
              style={{
                minHeight:
                  "42px",
                padding:
                  "0 18px",
                border: 0,
                borderRadius:
                  "8px",
                background:
                  "#0a1f44",
                color:
                  "#ffffff",
                fontWeight:
                  800,
                cursor:
                  isSaving
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  isSaving
                    ? 0.6
                    : 1,
                whiteSpace:
                  "nowrap",
              }}
            >
              {editingExceptionId
                ? "예외일정 수정"
                : "+ 예외일정 추가"}
            </button>
          </div>

          <label
            style={{
              marginTop:
                "12px",
              display:
                "inline-flex",
              alignItems:
                "center",
              gap: "7px",
              color:
                "#475467",
              fontSize:
                "13px",
              cursor:
                "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={
                exceptionAllDay
              }
              onChange={(
                event
              ) =>
                setExceptionAllDay(
                  event.target
                    .checked
                )
              }
            />
            종일 적용
          </label>

          <div
            style={{
              marginTop:
                "8px",
              color:
                "#98a2b3",
              fontSize:
                "11px",
              lineHeight:
                1.6,
            }}
          >
            종일 적용 + 근무불가 = 하루 전체 휴무입니다.
            추가근무 가능은 정규 근무시간 밖의 특별 근무시간을 등록할 때 사용합니다.
          </div>
        </div>

        <div
          style={{
            padding:
              "20px 24px 24px",
          }}
        >
          {exceptions.length ===
          0 ? (
            <div
              style={{
                padding:
                  "26px",
                border:
                  "1px dashed #d0d5dd",
                borderRadius:
                  "10px",
                textAlign:
                  "center",
                color:
                  "#98a2b3",
                fontSize:
                  "13px",
              }}
            >
              등록된 예외일정이 없습니다.
            </div>
          ) : (
            <div
              style={{
                display:
                  "flex",
                flexDirection:
                  "column",
                gap: "9px",
              }}
            >
              {[...exceptions]
                .sort(
                  (a, b) =>
                    a.exception_date.localeCompare(
                      b.exception_date
                    )
                )
                .map(
                  (
                    item
                  ) => {
                    const allDay =
                      !item.start_time &&
                      !item.end_time;

                    const isUnavailable =
                      item.exception_type ===
                      "unavailable";

                    return (
                      <div
                        key={
                          item.id
                        }
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "130px 140px 170px minmax(160px, 1fr) auto",
                          gap:
                            "12px",
                          alignItems:
                            "center",
                          padding:
                            "13px 14px",
                          border:
                            "1px solid #e4e7ec",
                          borderRadius:
                            "9px",
                          background:
                            "#ffffff",
                          opacity:
                            item.is_active
                              ? 1
                              : 0.55,
                        }}
                      >
                        <div
                          style={{
                            fontWeight:
                              800,
                          }}
                        >
                          {
                            item.exception_date
                          }
                        </div>

                        <div>
                          <span
                            style={{
                              display:
                                "inline-flex",
                              padding:
                                "5px 8px",
                              borderRadius:
                                "999px",
                              background:
                                isUnavailable
                                  ? "#fef3f2"
                                  : "#ecfdf3",
                              color:
                                isUnavailable
                                  ? "#b42318"
                                  : "#067647",
                              border:
                                isUnavailable
                                  ? "1px solid #fecdca"
                                  : "1px solid #abefc6",
                              fontSize:
                                "11px",
                              fontWeight:
                                800,
                            }}
                          >
                            {isUnavailable
                              ? "근무불가"
                              : "추가근무"}
                          </span>
                        </div>

                        <div
                          style={{
                            fontWeight:
                              700,
                          }}
                        >
                          {allDay
                            ? "종일"
                            : `${shortTime(
                                item.start_time
                              )} ~ ${shortTime(
                                item.end_time
                              )}`}
                        </div>

                        <div
                          style={{
                            color:
                              "#667085",
                            fontSize:
                              "13px",
                          }}
                        >
                          {item.reason ||
                            "사유 없음"}
                        </div>

                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "flex-end",
                            gap:
                              "6px",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              handleEditException(
                                item
                              )
                            }
                            disabled={
                              isSaving
                            }
                            style={{
                              padding:
                                "7px 10px",
                              border:
                                "1px solid #d0d5dd",
                              borderRadius:
                                "7px",
                              background:
                                "#ffffff",
                              cursor:
                                "pointer",
                              fontSize:
                                "12px",
                              fontWeight:
                                700,
                            }}
                          >
                            수정
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteException(
                                item
                              )
                            }
                            disabled={
                              isSaving
                            }
                            style={{
                              padding:
                                "7px 10px",
                              border:
                                "1px solid #fda29b",
                              borderRadius:
                                "7px",
                              background:
                                "#ffffff",
                              color:
                                "#b42318",
                              cursor:
                                "pointer",
                              fontSize:
                                "12px",
                              fontWeight:
                                700,
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}
            </div>
          )}
        </div>
      </section>

      <div
        style={{
          padding:
            "14px 16px",
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "10px",
          background:
            "#f8fafc",
          color:
            "#667085",
          fontSize:
            "12px",
          lineHeight:
            1.7,
        }}
      >
        <strong
          style={{
            color:
              "#344054",
          }}
        >
          참고
        </strong>
        <br />
        근무 가능시간을 변경해도 이미 확정되어 있는 수업은 자동으로 이동하거나 취소되지 않습니다.
        이 설정은 앞으로 신규 수강신청에서 강사의 실제 가용시간을 계산할 때 사용합니다.
      </div>
    </div>
  );
}