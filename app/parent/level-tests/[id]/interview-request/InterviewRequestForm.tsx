"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";

type ExistingRequest = {
  id?: number;
  preferred_teacher_nationality?: string | null;
  student_personality?: string | null;
  program_type?: string | null;
  intensive_type?: string | null;
  intensive_detail?: string | null;
  lessons_per_week?: number | null;
  preferred_days?: string[] | null;
  lesson_duration_minutes?: number | null;
  preferred_time?: string | null;
  contact_phone?: string | null;
  status?: string | null;
};

type Props = {
  levelTestId: number;
  childId: number | null;
  studentName: string;
  grade: string;
  parentName: string;
  parentPhone: string;
  learningGoal: string;
  existingRequest: ExistingRequest | null;
};

type TeacherNationality =
  | "philippines"
  | "south_africa"
  | "north_america";

type ProgramType =
  | "general"
  | "intensive";

type IntensiveType =
  | ""
  | "debate"
  | "english_test"
  | "interview"
  | "other";

type LessonDuration = 25 | 50;

const WEEKDAYS = [
  {
    value: "mon",
    label: "월",
    english: "Mon",
  },
  {
    value: "tue",
    label: "화",
    english: "Tue",
  },
  {
    value: "wed",
    label: "수",
    english: "Wed",
  },
  {
    value: "thu",
    label: "목",
    english: "Thu",
  },
  {
    value: "fri",
    label: "금",
    english: "Fri",
  },
  {
    value: "sat",
    label: "토",
    english: "Sat",
  },
  {
    value: "sun",
    label: "일",
    english: "Sun",
  },
] as const;

function createTimeOptions(
  duration: LessonDuration
) {
  const options: string[] = [];

  if (duration === 25) {
    for (
      let hour = 6;
      hour <= 23;
      hour += 1
    ) {
      options.push(
        `${String(hour).padStart(
          2,
          "0"
        )}:00`
      );

      options.push(
        `${String(hour).padStart(
          2,
          "0"
        )}:30`
      );
    }

    return options;
  }

  for (
    let hour = 6;
    hour <= 23;
    hour += 1
  ) {
    options.push(
      `${String(hour).padStart(
        2,
        "0"
      )}:00`
    );
  }

  return options;
}

export default function InterviewRequestForm({
  levelTestId,
  childId,
  studentName,
  grade,
  parentName,
  parentPhone,
  learningGoal,
  existingRequest,
}: Props) {
  /*
   * =====================================================
   * 연락처
   * =====================================================
   */

  const [
    contactPhone,
    setContactPhone,
  ] = useState(
    existingRequest
      ?.contact_phone ||
      parentPhone ||
      ""
  );

  /*
   * =====================================================
   * 희망 정규수업 강사 국적
   *
   * 화상레벨테스트는 기본적으로
   * 필리핀 강사가 진행합니다.
   * =====================================================
   */

  const [
    teacherNationality,
    setTeacherNationality,
  ] =
    useState<TeacherNationality>(
      (
        existingRequest
          ?.preferred_teacher_nationality as
          | TeacherNationality
          | undefined
      ) || "philippines"
    );

  /*
   * =====================================================
   * 학생 성향
   * =====================================================
   */

  const [
    studentPersonality,
    setStudentPersonality,
  ] = useState(
    existingRequest
      ?.student_personality ||
      ""
  );

  /*
   * =====================================================
   * 프로그램 유형
   *
   * general
   * 일반과정
   *
   * intensive
   * 단기집중과정
   * =====================================================
   */

  const [
    programType,
    setProgramType,
  ] =
    useState<ProgramType>(
      (
        existingRequest
          ?.program_type as
          | ProgramType
          | undefined
      ) || "general"
    );

  /*
   * =====================================================
   * 단기집중과정 유형
   * =====================================================
   */

  const [
    intensiveType,
    setIntensiveType,
  ] =
    useState<IntensiveType>(
      (
        existingRequest
          ?.intensive_type as
          | IntensiveType
          | undefined
      ) || ""
    );

  /*
   * =====================================================
   * 단기집중 기타 세부내용
   * =====================================================
   */

  const [
    intensiveDetail,
    setIntensiveDetail,
  ] = useState(
    existingRequest
      ?.intensive_detail ||
      ""
  );

  /*
   * =====================================================
   * 주당 수업 횟수
   * =====================================================
   */

  const [
    lessonsPerWeek,
    setLessonsPerWeek,
  ] = useState(
    existingRequest
      ?.lessons_per_week ||
      2
  );

  /*
   * =====================================================
   * 희망 요일
   * =====================================================
   */

  const [
    preferredDays,
    setPreferredDays,
  ] = useState<string[]>(
    Array.isArray(
      existingRequest
        ?.preferred_days
    )
      ? existingRequest
          .preferred_days
      : []
  );

  /*
   * =====================================================
   * 회당 수업시간
   * =====================================================
   */

  const [
    lessonDuration,
    setLessonDuration,
  ] =
    useState<LessonDuration>(
      existingRequest
        ?.lesson_duration_minutes ===
        50
        ? 50
        : 25
    );

  /*
   * =====================================================
   * 모든 요일에 적용되는 동일 수업시간
   * =====================================================
   */

  const [
    preferredTime,
    setPreferredTime,
  ] = useState(
    existingRequest
      ?.preferred_time ||
      ""
  );

  /*
   * =====================================================
   * 화면 상태
   * =====================================================
   */

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    previewReady,
    setPreviewReady,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  /*
   * level_tests.learning_goal은
   * 이 신청 테이블에 중복 저장하지 않습니다.
   *
   * 신청 화면에서는 기존 레벨테스트에 입력한
   * 학습목표를 참고용으로 보여줍니다.
   */

  const existingLearningGoal =
    learningGoal.trim();

  /*
   * =====================================================
   * 시간 목록
   * =====================================================
   */

  const timeOptions =
    useMemo(
      () =>
        createTimeOptions(
          lessonDuration
        ),
      [lessonDuration]
    );

  /*
   * =====================================================
   * 수업시간 변경
   * =====================================================
   */

  function changeDuration(
    duration: LessonDuration
  ) {
    setLessonDuration(
      duration
    );

    setPreviewReady(false);
    setErrorMessage("");

    const newOptions =
      createTimeOptions(
        duration
      );

    if (
      preferredTime &&
      !newOptions.includes(
        preferredTime
      )
    ) {
      setPreferredTime("");
    }
  }

  /*
   * =====================================================
   * 요일 선택
   *
   * 선택한 주당 횟수와
   * 선택 요일 개수를 일치시킵니다.
   * =====================================================
   */

  function toggleDay(
    day: string
  ) {
    setErrorMessage("");
    setPreviewReady(false);

    if (
      preferredDays.includes(
        day
      )
    ) {
      setPreferredDays(
        preferredDays.filter(
          (item) =>
            item !== day
        )
      );

      return;
    }

    if (
      preferredDays.length >=
      lessonsPerWeek
    ) {
      setErrorMessage(
        `주 ${lessonsPerWeek}회 수업은 ${lessonsPerWeek}개의 요일만 선택할 수 있습니다.`
      );

      return;
    }

    setPreferredDays([
      ...preferredDays,
      day,
    ]);
  }

  /*
   * =====================================================
   * 주당 횟수 변경
   * =====================================================
   */

  function changeLessonsPerWeek(
    value: number
  ) {
    setLessonsPerWeek(
      value
    );

    setPreviewReady(false);
    setErrorMessage("");

    setPreferredDays(
      (current) =>
        current.slice(
          0,
          value
        )
    );
  }

  /*
   * =====================================================
   * 프로그램 유형 변경
   * =====================================================
   */

  function changeProgramType(
    value: ProgramType
  ) {
    setProgramType(
      value
    );

    setPreviewReady(false);
    setErrorMessage("");

    if (
      value === "general"
    ) {
      setIntensiveType("");
      setIntensiveDetail("");
    }
  }

  /*
   * =====================================================
   * 단기집중 유형 변경
   * =====================================================
   */

  function changeIntensiveType(
    value: IntensiveType
  ) {
    setIntensiveType(
      value
    );

    setPreviewReady(false);
    setErrorMessage("");

    if (
      value !== "other"
    ) {
      setIntensiveDetail("");
    }
  }

  /*
   * =====================================================
   * 제출 검증
   *
   * 아직 실제 저장 API는
   * 다음 단계에서 연결합니다.
   * =====================================================
   */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setPreviewReady(false);

    if (!contactPhone.trim()) {
      setErrorMessage(
        "연락처를 입력해주세요."
      );
      return;
    }

    if (!teacherNationality) {
      setErrorMessage(
        "희망 원어민 강사 국적을 선택해주세요."
      );
      return;
    }

    if (!studentPersonality.trim()) {
      setErrorMessage(
        "수강학생의 성향을 입력해주세요."
      );
      return;
    }

    if (
      programType === "intensive" &&
      !intensiveType
    ) {
      setErrorMessage(
        "단기집중과정의 목적을 선택해주세요."
      );
      return;
    }

    if (
      programType === "intensive" &&
      intensiveType === "other" &&
      !intensiveDetail.trim()
    ) {
      setErrorMessage(
        "기타 단기집중과정의 세부 내용을 입력해주세요."
      );
      return;
    }

    if (
      ![2, 3, 4, 5].includes(
        lessonsPerWeek
      )
    ) {
      setErrorMessage(
        "주당 수업 횟수는 2회에서 5회 사이여야 합니다."
      );
      return;
    }

    if (
      preferredDays.length !==
      lessonsPerWeek
    ) {
      setErrorMessage(
        `주 ${lessonsPerWeek}회 수업을 선택하셨습니다. 수업 요일도 정확히 ${lessonsPerWeek}개 선택해주세요.`
      );
      return;
    }

    if (!preferredTime) {
      setErrorMessage(
        "희망 수업시간을 선택해주세요."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        "/api/level-tests/interview-request",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            levelTestId,
            childId,
            contactPhone:
              contactPhone.trim(),
            studentPersonality:
              studentPersonality.trim(),
            preferredTeacherNationality:
              teacherNationality,
            programType,
            intensiveType:
              programType === "intensive"
                ? intensiveType
                : null,
            intensiveDetail:
              programType === "intensive" &&
              intensiveType === "other"
                ? intensiveDetail.trim()
                : null,
            lessonsPerWeek,
            preferredDays,
            lessonDurationMinutes:
              lessonDuration,
            preferredTime,
          }),
        }
      );

      const result =
        (await response.json()) as {
          success?: boolean;
          error?: string;
          requestId?: number;
        };

      if (!response.ok) {
        throw new Error(
          result.error ||
            "화상레벨테스트 신청정보 저장에 실패했습니다."
        );
      }

      setPreviewReady(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "화상레벨테스트 신청정보 저장에 실패했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isExisting =
    Boolean(
      existingRequest?.id
    );

  const existingStatus =
    existingRequest
      ?.status ||
    null;

  return (
    <section
      style={{
        marginTop: "22px",
      }}
    >
      <form
        onSubmit={
          handleSubmit
        }
      >
        {/* ============================================= */}
        {/* 01. 학생 / 신청자 */}
        {/* ============================================= */}

        <FormSection
          number="01"
          title="신청자 및 학생 정보"
          description="화상레벨테스트와 정규수업 상담에 필요한 기본 정보를 확인해주세요."
        >
          <div
            style={
              gridStyle
            }
          >
            <ReadOnlyField
              label="학생 이름"
              value={
                studentName
              }
            />

            <ReadOnlyField
              label="학년"
              value={
                grade || "-"
              }
            />

            <ReadOnlyField
              label="보호자"
              value={
                parentName ||
                "-"
              }
            />

            <Field>
              <Label required>
                연락처
              </Label>

              <input
                type="tel"
                value={
                  contactPhone
                }
                onChange={(
                  event
                ) => {
                  setContactPhone(
                    event.target
                      .value
                  );

                  setPreviewReady(
                    false
                  );
                }}
                placeholder="010-0000-0000"
                style={
                  inputStyle
                }
              />
            </Field>
          </div>
        </FormSection>

        {/* ============================================= */}
        {/* 02. 희망 강사 국적 */}
        {/* ============================================= */}

        <FormSection
          number="02"
          title="희망 원어민 강사 국적"
          description="정규수업에서 희망하는 담당강사의 국적을 선택해주세요."
        >
          <NoticeBox>
            무료 화상레벨테스트는
            기본적으로{" "}
            <strong>
              필리핀 원어민 강사
            </strong>
            가 진행합니다. 아래
            선택은 향후 정규수업
            담당강사의 희망
            국적입니다.
          </NoticeBox>

          <div
            style={{
              marginTop: "16px",
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "10px",
            }}
          >
            <ChoiceCard
              selected={
                teacherNationality ===
                "philippines"
              }
              title="필리핀"
              description="Philippines"
              onClick={() => {
                setTeacherNationality(
                  "philippines"
                );
                setPreviewReady(
                  false
                );
              }}
            />

            <ChoiceCard
              selected={
                teacherNationality ===
                "south_africa"
              }
              title="남아프리카공화국"
              description="South Africa"
              onClick={() => {
                setTeacherNationality(
                  "south_africa"
                );
                setPreviewReady(
                  false
                );
              }}
            />

            <ChoiceCard
              selected={
                teacherNationality ===
                "north_america"
              }
              title="북미"
              description="North America"
              onClick={() => {
                setTeacherNationality(
                  "north_america"
                );
                setPreviewReady(
                  false
                );
              }}
            />
          </div>

          <div
            style={{
              marginTop: "12px",
              color: "#667085",
              fontSize: "12px",
              lineHeight: 1.7,
            }}
          >
            희망 국적, 수업시간,
            강사 일정 등을 종합하여
            담당강사를 배정합니다.
            선택한 국적의 강사
            배정이 항상 보장되는
            것은 아닙니다.
          </div>
        </FormSection>

        {/* ============================================= */}
        {/* 03. 학생 성향 */}
        {/* ============================================= */}

        <FormSection
          number="03"
          title="수강학생 성향"
          description="레벨테스트 강사와 향후 담당강사가 학생을 이해할 수 있도록 간단히 알려주세요."
        >
          <Field>
            <Label required>
              학생 성향 및 수업 시
              참고사항
            </Label>

            <textarea
              value={
                studentPersonality
              }
              onChange={(
                event
              ) => {
                setStudentPersonality(
                  event.target
                    .value
                );

                setPreviewReady(
                  false
                );
              }}
              placeholder="예: 처음에는 낯을 조금 가리지만 익숙해지면 말을 많이 합니다. 틀리는 것을 두려워하는 편이라 자연스럽게 말할 수 있도록 격려해주면 좋겠습니다."
              rows={5}
              style={{
                ...inputStyle,
                resize: "vertical",
                lineHeight: 1.7,
              }}
            />
          </Field>
        </FormSection>

        {/* ============================================= */}
        {/* 04. 수업과정 */}
        {/* ============================================= */}

        <FormSection
          number="04"
          title="희망 수업과정"
          description="학년과 관계없이 일반과정 또는 목적형 단기집중과정을 선택할 수 있습니다."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "10px",
            }}
          >
            <ChoiceCard
              selected={
                programType ===
                "general"
              }
              title="일반과정"
              description="지속적인 영어 의사소통 능력 향상"
              onClick={() =>
                changeProgramType(
                  "general"
                )
              }
            />

            <ChoiceCard
              selected={
                programType ===
                "intensive"
              }
              title="단기집중과정"
              description="영어토론대회 · 공인영어시험 · 영어면접 등"
              onClick={() =>
                changeProgramType(
                  "intensive"
                )
              }
            />
          </div>

          {programType ===
            "intensive" && (
            <div
              style={{
                marginTop: "18px",
              }}
            >
              <Label required>
                단기집중과정 목적
              </Label>

              <select
                value={
                  intensiveType
                }
                onChange={(
                  event
                ) =>
                  changeIntensiveType(
                    event.target
                      .value as IntensiveType
                  )
                }
                style={
                  inputStyle
                }
              >
                <option value="">
                  선택해주세요
                </option>

                <option value="debate">
                  영어토론대회
                </option>

                <option value="english_test">
                  공인영어시험
                </option>

                <option value="interview">
                  영어면접
                </option>

                <option value="other">
                  기타 단기집중과정
                </option>
              </select>

              {intensiveType ===
                "other" && (
                <div
                  style={{
                    marginTop:
                      "14px",
                  }}
                >
                  <Label required>
                    세부 목적
                  </Label>

                  <textarea
                    value={
                      intensiveDetail
                    }
                    onChange={(
                      event
                    ) => {
                      setIntensiveDetail(
                        event
                          .target
                          .value
                      );

                      setPreviewReady(
                        false
                      );
                    }}
                    placeholder="예: 국제학교 입학 준비, 해외 캠프 인터뷰 준비 등"
                    rows={3}
                    style={{
                      ...inputStyle,
                      resize:
                        "vertical",
                      lineHeight:
                        1.7,
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </FormSection>

        {/* ============================================= */}
        {/* 05. 주당 횟수 */}
        {/* ============================================= */}

        <FormSection
          number="05"
          title="주당 수업 횟수"
          description="주 2회부터 주 5회까지 선택할 수 있습니다."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(4, minmax(0, 1fr))",
              gap: "10px",
            }}
          >
            {[2, 3, 4, 5].map(
              (count) => (
                <ChoiceCard
                  key={count}
                  selected={
                    lessonsPerWeek ===
                    count
                  }
                  title={`주 ${count}회`}
                  description={`${count} lessons / week`}
                  onClick={() =>
                    changeLessonsPerWeek(
                      count
                    )
                  }
                />
              )
            )}
          </div>
        </FormSection>

        {/* ============================================= */}
        {/* 06. 희망 요일 */}
        {/* ============================================= */}

        <FormSection
          number="06"
          title="희망 수업요일"
          description={`주 ${lessonsPerWeek}회 수업에 맞춰 정확히 ${lessonsPerWeek}개의 요일을 선택해주세요.`}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(7, minmax(0, 1fr))",
              gap: "8px",
            }}
          >
            {WEEKDAYS.map(
              (day) => {
                const selected =
                  preferredDays.includes(
                    day.value
                  );

                return (
                  <button
                    key={
                      day.value
                    }
                    type="button"
                    onClick={() =>
                      toggleDay(
                        day.value
                      )
                    }
                    style={{
                      minHeight:
                        "70px",
                      padding:
                        "10px 6px",
                      borderRadius:
                        "11px",
                      border:
                        selected
                          ? "2px solid #2f6fed"
                          : "1px solid #d0d5dd",
                      background:
                        selected
                          ? "#eef4ff"
                          : "#ffffff",
                      color:
                        selected
                          ? "#2f6fed"
                          : "#344054",
                      cursor:
                        "pointer",
                      fontWeight:
                        900,
                    }}
                  >
                    <div
                      style={{
                        fontSize:
                          "16px",
                      }}
                    >
                      {day.label}
                    </div>

                    <div
                      style={{
                        marginTop:
                          "3px",
                        fontSize:
                          "9px",
                        opacity: 0.65,
                      }}
                    >
                      {
                        day.english
                      }
                    </div>
                  </button>
                );
              }
            )}
          </div>

          <div
            style={{
              marginTop: "12px",
              color:
                preferredDays.length ===
                lessonsPerWeek
                  ? "#138a4b"
                  : "#667085",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            선택:{" "}
            {
              preferredDays.length
            }
            /{lessonsPerWeek}일
          </div>
        </FormSection>

        {/* ============================================= */}
        {/* 07. 회당 수업시간 */}
        {/* ============================================= */}

        <FormSection
          number="07"
          title="회당 수업시간"
          description="25분 또는 50분 수업 중 하나를 선택해주세요."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: "10px",
            }}
          >
            <ChoiceCard
              selected={
                lessonDuration ===
                25
              }
              title="25분 수업"
              description="30분 단위로 시작시간 선택"
              onClick={() =>
                changeDuration(25)
              }
            />

            <ChoiceCard
              selected={
                lessonDuration ===
                50
              }
              title="50분 수업"
              description="1시간 단위로 시작시간 선택"
              onClick={() =>
                changeDuration(50)
              }
            />
          </div>
        </FormSection>

        {/* ============================================= */}
        {/* 08. 수업시간 */}
        {/* ============================================= */}

        <FormSection
          number="08"
          title="희망 수업 시작시간"
          description="한 번 정한 수업시간은 원칙적으로 모든 선택 요일과 전체 수강기간에 동일하게 적용됩니다."
        >
          <NoticeBox>
            예를 들어 월·수·금
            오후 8시를 선택하면
            월요일, 수요일,
            금요일 모두{" "}
            <strong>
              오후 8시
            </strong>
            에 수업이 시작됩니다.
            추후 불가피하게 변경이
            필요한 경우 TALKLY와
            별도로 협의할 수
            있습니다.
          </NoticeBox>

          <div
            style={{
              marginTop: "16px",
              maxWidth: "420px",
            }}
          >
            <Label required>
              수업 시작시간
            </Label>

            <select
              value={
                preferredTime
              }
              onChange={(
                event
              ) => {
                setPreferredTime(
                  event.target
                    .value
                );

                setPreviewReady(
                  false
                );
              }}
              style={
                inputStyle
              }
            >
              <option value="">
                시간을 선택해주세요
              </option>

              {timeOptions.map(
                (time) => (
                  <option
                    key={time}
                    value={time}
                  >
                    {formatTime(
                      time
                    )}
                  </option>
                )
              )}
            </select>

            <div
              style={{
                marginTop: "8px",
                color: "#667085",
                fontSize: "11px",
                lineHeight: 1.6,
              }}
            >
              25분 수업은 30분
              단위, 50분 수업은
              1시간 단위로
              선택합니다.
            </div>
          </div>
        </FormSection>

        {/* ============================================= */}
        {/* 09. 기존 학습목표 */}
        {/* ============================================= */}

        {existingLearningGoal && (
          <FormSection
            number="09"
            title="등록된 학습 목표"
            description="온라인 레벨테스트 신청 시 입력한 학습 목표입니다."
          >
            <div
              style={{
                padding:
                  "16px",
                border:
                  "1px solid #e4e7ec",
                borderRadius:
                  "10px",
                background:
                  "#f9fafb",
                color:
                  "#475467",
                fontSize:
                  "13px",
                lineHeight:
                  1.8,
                whiteSpace:
                  "pre-wrap",
              }}
            >
              {
                existingLearningGoal
              }
            </div>

            <div
              style={{
                marginTop:
                  "9px",
                color:
                  "#98a2b3",
                fontSize:
                  "11px",
                lineHeight:
                  1.6,
              }}
            >
              학습 목표는 기존
              레벨테스트 정보에
              보관되므로 별도로
              중복 저장하지
              않습니다.
            </div>
          </FormSection>
        )}

        {/* ============================================= */}
        {/* 신청 요약 */}
        {/* ============================================= */}

        <section
          style={{
            marginTop: "18px",
            padding: "24px",
            borderRadius:
              "16px",
            border:
              "1px solid #dbe7ff",
            background:
              "#f7faff",
          }}
        >
          <div
            style={{
              color: "#2f6fed",
              fontSize: "10px",
              fontWeight: 900,
              letterSpacing:
                "0.08em",
            }}
          >
            REQUEST SUMMARY
          </div>

          <h3
            style={{
              margin: "6px 0 0",
              color: "#101828",
              fontSize: "18px",
            }}
          >
            희망 정규수업 계획
          </h3>

          <div
            style={{
              marginTop: "18px",
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "16px",
            }}
          >
            <SummaryItem
              label="학생"
              value={
                studentName
              }
            />

            <SummaryItem
              label="희망 강사"
              value={getNationalityLabel(
                teacherNationality
              )}
            />

            <SummaryItem
              label="과정"
              value={getProgramLabel(
                programType,
                intensiveType,
                intensiveDetail
              )}
            />

            <SummaryItem
              label="주당 수업"
              value={`주 ${lessonsPerWeek}회`}
            />

            <SummaryItem
              label="수업요일"
              value={getDaysLabel(
                preferredDays
              )}
            />

            <SummaryItem
              label="회당 시간"
              value={`${lessonDuration}분`}
            />

            <SummaryItem
              label="수업 시작"
              value={
                preferredTime
                  ? formatTime(
                      preferredTime
                    )
                  : "-"
              }
            />
          </div>
        </section>

        {/* ============================================= */}
        {/* 오류 */}
        {/* ============================================= */}

        {errorMessage && (
          <div
            style={{
              marginTop: "16px",
              padding:
                "14px 16px",
              border:
                "1px solid #fecdca",
              borderRadius:
                "10px",
              background:
                "#fef3f2",
              color:
                "#b42318",
              fontSize: "12px",
              fontWeight: 800,
              lineHeight: 1.6,
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* ============================================= */}
        {/* 신청 완료 안내 */}
        {/* ============================================= */}

        {previewReady && (
          <section
            style={{
              marginTop: "20px",
              padding: "26px",
              border: "1px solid #abefc6",
              borderRadius: "16px",
              background:
                "linear-gradient(135deg, #ecfdf3 0%, #f7fffa 100%)",
              boxShadow:
                "0 10px 28px rgba(6, 118, 71, 0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "14px",
              }}
            >
              <div
                style={{
                  flex: "0 0 auto",
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#067647",
                  color: "#ffffff",
                  fontSize: "22px",
                  fontWeight: 900,
                }}
              >
                ✓
              </div>

              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    margin: 0,
                    color: "#065f46",
                    fontSize: "20px",
                    fontWeight: 900,
                    letterSpacing: "-0.02em",
                  }}
                >
                  화상레벨테스트 신청이 완료되었습니다
                </h3>

                <p
                  style={{
                    margin: "12px 0 0",
                    color: "#344054",
                    fontSize: "14px",
                    lineHeight: 1.85,
                  }}
                >
                  입력하신 희망 수업계획을 기준으로 추후{" "}
                  <strong
                    style={{
                      color: "#101828",
                    }}
                  >
                    화상레벨테스트 일정과 수강안내
                  </strong>
                  를 드릴 예정입니다.
                </p>

                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#344054",
                    fontSize: "14px",
                    lineHeight: 1.85,
                  }}
                >
                  일정 및 진행 안내는{" "}
                  <strong
                    style={{
                      color: "#2f6fed",
                    }}
                  >
                    TALKLY 사이트 내 &apos;내 강의실&apos;
                  </strong>
                  과{" "}
                  <strong
                    style={{
                      color: "#2f6fed",
                    }}
                  >
                    SMS
                  </strong>
                  를 통해 안내해 드립니다.
                </p>

                <div
                  style={{
                    marginTop: "20px",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    background: "#ffffff",
                    border: "1px solid #d1fadf",
                    color: "#475467",
                    fontSize: "12px",
                    lineHeight: 1.7,
                  }}
                >
                  TALKLY 관리자가 신청내용과 강사 일정을 확인한 후
                  화상레벨테스트 일정을 안내합니다. 확정된 일정은
                  내 강의실에서도 확인할 수 있습니다.
                </div>

                <div
                  style={{
                    marginTop: "20px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <a
                    href="/parent"
                    style={{
                      minHeight: "46px",
                      padding: "0 18px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "10px",
                      background: "#0a1f44",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 900,
                      textDecoration: "none",
                    }}
                  >
                    내 강의실 가기
                  </a>

                  <a
                    href={`/parent/level-tests/${levelTestId}`}
                    style={{
                      minHeight: "46px",
                      padding: "0 18px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "10px",
                      border: "1px solid #2f6fed",
                      background: "#ffffff",
                      color: "#2f6fed",
                      fontSize: "13px",
                      fontWeight: 900,
                      textDecoration: "none",
                    }}
                  >
                    온라인 레벨테스트 결과 보기
                  </a>

                  <a
                    href="/parent"
                    style={{
                      minHeight: "46px",
                      padding: "0 18px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "10px",
                      border: "1px solid #d0d5dd",
                      background: "#ffffff",
                      color: "#344054",
                      fontSize: "13px",
                      fontWeight: 900,
                      textDecoration: "none",
                    }}
                  >
                    학부모 대시보드
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ============================================= */}
        {/* 기존 신청 */}
        {/* ============================================= */}

        {isExisting && (
          <div
            style={{
              marginTop: "16px",
              padding:
                "14px 16px",
              border:
                "1px solid #d0d5dd",
              borderRadius:
                "10px",
              background:
                "#f9fafb",
              color:
                "#475467",
              fontSize: "12px",
              lineHeight: 1.7,
            }}
          >
            이 레벨테스트에는
            기존에 저장된 희망
            수업계획이 있습니다.

            {existingStatus && (
              <>
                {" "}
                현재 상태:{" "}
                <strong>
                  {existingStatus}
                </strong>
              </>
            )}
          </div>
        )}

        {/* ============================================= */}
        {/* 제출 */}
        {/* ============================================= */}

        {!previewReady && (
          <div
            style={{
              marginTop: "22px",
              display: "flex",
              justifyContent:
                "flex-end",
            }}
          >
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                minHeight: "52px",
                padding:
                  "0 24px",
                border: 0,
                borderRadius:
                  "11px",
                background:
                  "#2f6fed",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 900,
                cursor:
                  isSubmitting
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  isSubmitting
                    ? 0.65
                    : 1,
                boxShadow:
                  "0 8px 20px rgba(47,111,237,.20)",
              }}
            >
              {isSubmitting
                ? "저장 중..."
                : isExisting
                  ? "신청 내용 저장"
                  : "화상레벨테스트 신청"}
            </button>
          </div>
        )}

        <input
          type="hidden"
          name="levelTestId"
          value={levelTestId}
        />

        <input
          type="hidden"
          name="childId"
          value={
            childId ?? ""
          }
        />
      </form>
    </section>
  );
}

/*
 * =========================================================
 * UI
 * =========================================================
 */

function FormSection({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        marginTop: "18px",
        padding: "26px",
        border:
          "1px solid #e4e7ec",
        borderRadius: "16px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems:
            "flex-start",
          gap: "12px",
        }}
      >
        <div
          style={{
            flex: "0 0 auto",
            width: "34px",
            height: "34px",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            borderRadius:
              "9px",
            background:
              "#eef4ff",
            color:
              "#2f6fed",
            fontSize: "10px",
            fontWeight: 900,
          }}
        >
          {number}
        </div>

        <div>
          <h2
            style={{
              margin: 0,
              color: "#101828",
              fontSize: "18px",
              letterSpacing:
                "-0.02em",
            }}
          >
            {title}
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              color: "#667085",
              fontSize: "12px",
              lineHeight: 1.7,
            }}
          >
            {description}
          </p>
        </div>
      </div>

      <div
        style={{
          marginTop: "22px",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Field({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div>{children}</div>;
}

function Label({
  children,
  required = false,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: "8px",
        color: "#344054",
        fontSize: "12px",
        fontWeight: 900,
      }}
    >
      {children}

      {required && (
        <span
          style={{
            marginLeft: "4px",
            color: "#d92d20",
          }}
        >
          *
        </span>
      )}
    </label>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <Field>
      <Label>{label}</Label>

      <div
        style={{
          minHeight: "46px",
          padding: "0 13px",
          display: "flex",
          alignItems:
            "center",
          border:
            "1px solid #e4e7ec",
          borderRadius: "9px",
          background: "#f9fafb",
          color: "#475467",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        {value || "-"}
      </div>
    </Field>
  );
}

function ChoiceCard({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: "86px",
        padding: "16px",
        borderRadius: "11px",
        border: selected
          ? "2px solid #2f6fed"
          : "1px solid #d0d5dd",
        background: selected
          ? "#eef4ff"
          : "#ffffff",
        color: selected
          ? "#2f6fed"
          : "#344054",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          fontSize: "14px",
          fontWeight: 900,
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: "5px",
          color: selected
            ? "#2f6fed"
            : "#667085",
          fontSize: "10px",
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>
    </button>
  );
}

function NoticeBox({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: "10px",
        border:
          "1px solid #dbe7ff",
        background: "#f5f8ff",
        color: "#475467",
        fontSize: "12px",
        lineHeight: 1.75,
      }}
    >
      {children}
    </div>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          color: "#98a2b3",
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
          lineHeight: 1.5,
        }}
      >
        {value || "-"}
      </div>
    </div>
  );
}

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function getNationalityLabel(
  value: TeacherNationality
) {
  if (
    value ===
    "south_africa"
  ) {
    return "남아프리카공화국";
  }

  if (
    value ===
    "north_america"
  ) {
    return "북미";
  }

  return "필리핀";
}

function getProgramLabel(
  programType: ProgramType,
  intensiveType: IntensiveType,
  intensiveDetail: string
) {
  if (
    programType === "general"
  ) {
    return "일반과정";
  }

  if (
    intensiveType ===
    "debate"
  ) {
    return "단기집중 · 영어토론대회";
  }

  if (
    intensiveType ===
    "english_test"
  ) {
    return "단기집중 · 공인영어시험";
  }

  if (
    intensiveType ===
    "interview"
  ) {
    return "단기집중 · 영어면접";
  }

  if (
    intensiveType ===
    "other"
  ) {
    return intensiveDetail
      ? `단기집중 · ${intensiveDetail}`
      : "단기집중 · 기타";
  }

  return "단기집중과정";
}

function getDaysLabel(
  days: string[]
) {
  if (
    days.length === 0
  ) {
    return "-";
  }

  return WEEKDAYS.filter(
    (day) =>
      days.includes(
        day.value
      )
  )
    .map(
      (day) =>
        day.label
    )
    .join(" · ");
}

function formatTime(
  time: string
) {
  const [
    hourText,
    minute,
  ] = time.split(":");

  const hour =
    Number(hourText);

  if (
    Number.isNaN(hour)
  ) {
    return time;
  }

  const period =
    hour < 12
      ? "오전"
      : "오후";

  const displayHour =
    hour === 0
      ? 12
      : hour > 12
        ? hour - 12
        : hour;

  return `${period} ${displayHour}:${minute}`;
}

/*
 * =========================================================
 * STYLES
 * =========================================================
 */

const gridStyle:
  React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "16px",
};

const inputStyle:
  React.CSSProperties = {
  width: "100%",
  minHeight: "46px",
  boxSizing: "border-box",
  padding: "11px 13px",
  border:
    "1px solid #d0d5dd",
  borderRadius: "9px",
  outline: "none",
  background: "#ffffff",
  color: "#101828",
  fontSize: "13px",
};