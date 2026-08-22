"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Child = {
  id: number;
  name: string;
  grade: string | null;
  school_name: string | null;
  birth_date?: string | null;
  learning_goal?: string | null;
  student_user_id: string | null;
  linked_student_user_id: string | null;
};

type Props = {
  currentUserId: string;
  parentUserId: string;
  userRole: "parent" | "student";
  children: Child[];
};

type StudentMode =
  | "existing"
  | "direct";

export default function LevelTestRequestForm({
  currentUserId,
  parentUserId,
  userRole,
  children,
}: Props) {
  const router = useRouter();
  const isStudent = userRole === "student";

  const [studentMode, setStudentMode] =
    useState<StudentMode>(
      children.length > 0
        ? "existing"
        : "direct"
    );

  const [childId, setChildId] =
    useState(
      children.length > 0
        ? String(children[0].id)
        : ""
    );

  const [
    studentName,
    setStudentName,
  ] = useState(
    children.length > 0
      ? children[0].name
      : ""
  );

  const [
    birthDate,
    setBirthDate,
  ] = useState(
    children.length > 0
      ? children[0].birth_date || ""
      : ""
  );

  const [age, setAge] =
    useState("");

  const [grade, setGrade] =
    useState(
      children.length > 0
        ? children[0].grade || ""
        : ""
    );

  const [
    schoolName,
    setSchoolName,
  ] = useState(
    children.length > 0
      ? children[0].school_name || ""
      : ""
  );

  const [
    learningHistory,
    setLearningHistory,
  ] = useState("");

  const [
    learningGoal,
    setLearningGoal,
  ] = useState(
    children.length > 0
      ? children[0].learning_goal || ""
      : ""
  );

  const [
    targetGroup,
    setTargetGroup,
  ] = useState(
    children.length > 0
      ? getTargetGroupFromGrade(
          children[0].grade
        )
      : "elementary"
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

  const selectedChild =
    useMemo(() => {
      return (
        children.find(
          (child) =>
            String(child.id) ===
            childId
        ) ?? null
      );
    }, [childId, children]);

  function applyChild(
    child: Child
  ) {
    setStudentName(
      child.name
    );

    setBirthDate(
      child.birth_date || ""
    );

    setGrade(
      child.grade || ""
    );

    setSchoolName(
      child.school_name || ""
    );

    setLearningGoal(
      child.learning_goal || ""
    );

    setTargetGroup(
      getTargetGroupFromGrade(
        child.grade
      )
    );

    if (child.birth_date) {
      setAge(
        calculateAge(
          child.birth_date
        ).toString()
      );
    } else {
      setAge("");
    }
  }

  function handleModeChange(
    mode: StudentMode
  ) {
    setStudentMode(mode);
    setErrorMessage("");
    setSuccessMessage("");

    if (
      mode === "existing" &&
      selectedChild
    ) {
      applyChild(
        selectedChild
      );
    }

    if (mode === "direct") {
      setChildId("");
      setStudentName("");
      setBirthDate("");
      setAge("");
      setGrade("");
      setSchoolName("");
      setLearningHistory("");
      setLearningGoal("");
      setTargetGroup(
        "elementary"
      );
    }
  }

  function handleChildChange(
    value: string
  ) {
    setChildId(value);
    setErrorMessage("");
    setSuccessMessage("");

    const child =
      children.find(
        (item) =>
          String(item.id) ===
          value
      );

    if (child) {
      applyChild(child);
    }
  }

  function handleBirthDateChange(
    value: string
  ) {
    setBirthDate(value);
    setSuccessMessage("");

    if (value) {
      setAge(
        calculateAge(
          value
        ).toString()
      );
    } else {
      setAge("");
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (
      !studentName.trim()
    ) {
      setErrorMessage(
        "학생 이름을 입력해주세요."
      );
      return;
    }

    if (!grade.trim()) {
      setErrorMessage(
        "학년을 입력해주세요."
      );
      return;
    }

    if (
      !birthDate &&
      !age.trim()
    ) {
      setErrorMessage(
        "학생 생년월일 또는 나이를 입력해주세요."
      );
      return;
    }

    if (age.trim()) {
      const parsedAge =
        Number(age);

      if (
        !Number.isInteger(
          parsedAge
        ) ||
        parsedAge < 3 ||
        parsedAge > 100
      ) {
        setErrorMessage(
          "학생 나이를 올바르게 입력해주세요."
        );
        return;
      }
    }

    setLoading(true);

    try {
      const supabase =
        createClient();

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        throw new Error(
          "로그인 정보를 확인할 수 없습니다."
        );
      }

      if (
        user.id !==
        currentUserId
      ) {
        throw new Error(
          "현재 로그인한 사용자 정보를 확인할 수 없습니다."
        );
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (
        profileError ||
        !profile ||
        (profile.role !== "parent" &&
          profile.role !== "student")
      ) {
        throw new Error(
          "레벨테스트 이용 권한을 확인할 수 없습니다."
        );
      }

      if (profile.role !== userRole) {
        throw new Error(
          "로그인 역할 정보가 일치하지 않습니다."
        );
      }

      let childIdToSave:
        | number
        | null = null;

      let studentUserId:
        | string
        | null = null;

      if (
        studentMode ===
        "existing"
      ) {
        if (!selectedChild) {
          throw new Error(
            "등록된 자녀를 선택해주세요."
          );
        }

        let childQuery = supabase
          .from("children")
          .select(`
            id,
            parent_user_id,
            student_user_id,
            linked_student_user_id,
            is_active
          `)
          .eq(
            "id",
            selectedChild.id
          )
          .eq(
            "is_active",
            true
          );

        if (userRole === "parent") {
          childQuery = childQuery.eq(
            "parent_user_id",
            parentUserId
          );
        }

        if (userRole === "student") {
          childQuery = childQuery.or(
            `student_user_id.eq.${currentUserId},linked_student_user_id.eq.${currentUserId}`
          );
        }

        const {
          data: childCheck,
          error: childCheckError,
        } = await childQuery.maybeSingle();

        if (
          childCheckError ||
          !childCheck
        ) {
          throw new Error(
            "학생 정보를 확인할 수 없습니다."
          );
        }

        if (
          childCheck.parent_user_id !==
          parentUserId
        ) {
          throw new Error(
            "연결된 학부모 정보를 확인할 수 없습니다."
          );
        }

        childIdToSave =
          childCheck.id;

        studentUserId =
          userRole === "student"
            ? currentUserId
            : childCheck.student_user_id ||
              childCheck.linked_student_user_id ||
              null;
      }

      /*
       * 동일 학부모가 동일 학생명으로
       * 진행 중인 레벨테스트가 있는지 확인
       */
      let existingQuery =
        supabase
          .from(
            "level_tests"
          )
          .select(`
            id,
            status
          `)
          .eq(
            "parent_user_id",
            parentUserId
          )
          .not(
            "status",
            "eq",
            "completed"
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
          .limit(1);

      if (
        childIdToSave !==
        null
      ) {
        existingQuery =
          existingQuery.eq(
            "child_id",
            childIdToSave
          );
      } else {
        existingQuery =
          existingQuery.eq(
            "student_name",
            studentName.trim()
          );
      }

      const {
        data:
          existingTest,
        error:
          existingTestError,
      } =
        await existingQuery.maybeSingle();

      if (
        existingTestError
      ) {
        throw new Error(
          `기존 레벨테스트 확인 실패: ${existingTestError.message}`
        );
      }

      if (existingTest) {
        throw new Error(
          "현재 진행 중인 레벨테스트가 있습니다. 기존 테스트를 먼저 완료해주세요."
        );
      }

      const now =
        new Date().toISOString();

      const parsedAge =
        age.trim()
          ? Number(age)
          : birthDate
          ? calculateAge(
              birthDate
            )
          : null;

      const {
        data:
          createdTest,
        error:
          createError,
      } = await supabase
        .from(
          "level_tests"
        )
        .insert({
          child_id:
            childIdToSave,

          student_user_id:
            studentUserId,

          parent_user_id:
            parentUserId,

          student_name:
            studentName.trim(),

          student_birth_date:
            birthDate || null,

          student_age:
            parsedAge,

          school_name:
            schoolName.trim() ||
            null,

          grade:
            grade.trim(),

          learning_history:
            learningHistory.trim() ||
            null,

          learning_goal:
            learningGoal.trim() ||
            null,

          status:
            "requested",

          test_type:
            "ai",

          target_group:
            targetGroup,

          ai_status:
            "pending",

          interview_required:
            false,

          interview_status:
            null,

          created_at:
            now,

          updated_at:
            now,
        })
        .select("id")
        .maybeSingle();

      if (createError) {
        throw new Error(
          `레벨테스트 신청 실패: ${createError.message} / code: ${createError.code}`
        );
      }

      if (!createdTest) {
        throw new Error(
          "신청은 처리되었지만 생성된 레벨테스트 정보를 확인할 수 없습니다."
        );
      }

      setSuccessMessage(
        "AI 레벨테스트 신청이 완료되었습니다."
      );

      router.push(
        userRole === "student"
          ? `/parent/level-tests/${createdTest.id}?studentMode=1`
          : `/parent/level-tests/${createdTest.id}`
      );
    } catch (error) {
      console.error(
        "LEVEL TEST REQUEST ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "레벨테스트 신청 중 알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        marginTop: "24px",
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
          레벨테스트 신청
        </h2>

        <p
          style={{
            margin:
              "8px 0 0",
            color: "#667085",
            fontSize: "13px",
            lineHeight: 1.7,
          }}
        >
          {isStudent
            ? "현재 로그인한 학생 정보로 레벨테스트를 신청합니다."
            : "등록된 자녀를 선택하거나 레벨테스트를 받을 학생 정보를 직접 입력해주세요."}
        </p>
      </div>

      {!isStudent && children.length > 0 && (
        <div
          style={{
            marginTop: "24px",
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: "12px",
          }}
        >
          <ModeButton
            selected={
              studentMode ===
              "existing"
            }
            title="등록된 자녀 선택"
            description="이미 TALKLY에 등록한 자녀로 신청"
            onClick={() =>
              handleModeChange(
                "existing"
              )
            }
          />

          <ModeButton
            selected={
              studentMode ===
              "direct"
            }
            title="학생 정보 직접 입력"
            description="레벨테스트만 받을 학생 정보 입력"
            onClick={() =>
              handleModeChange(
                "direct"
              )
            }
          />
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          marginTop: "26px",
          display: "flex",
          flexDirection:
            "column",
          gap: "22px",
        }}
      >
        {!isStudent &&
          studentMode ===
            "existing" &&
          children.length >
            0 && (
            <div>
              <label
                htmlFor="childId"
                style={labelStyle}
              >
                등록된 자녀
              </label>

              <select
                id="childId"
                value={childId}
                onChange={(
                  event
                ) =>
                  handleChildChange(
                    event.target.value
                  )
                }
                disabled={
                  loading
                }
                style={fieldStyle}
              >
                {children.map(
                  (child) => (
                    <option
                      key={
                        child.id
                      }
                      value={
                        child.id
                      }
                    >
                      {child.name}
                      {child.grade
                        ? ` / ${child.grade}`
                        : ""}
                    </option>
                  )
                )}
              </select>
            </div>
          )}

        <div
          style={
            twoColumnStyle
          }
        >
          <div>
            <label
              htmlFor="studentName"
              style={labelStyle}
            >
              학생 이름
            </label>

            <input
              id="studentName"
              type="text"
              value={
                studentName
              }
              onChange={(
                event
              ) => {
                setStudentName(
                  event.target
                    .value
                );
                setSuccessMessage(
                  ""
                );
              }}
              disabled={
                loading ||
                studentMode ===
                  "existing" ||
                isStudent
              }
              style={fieldStyle}
            />
          </div>

          <div>
            <label
              htmlFor="grade"
              style={labelStyle}
            >
              학년
            </label>

            <input
              id="grade"
              type="text"
              value={grade}
              onChange={(
                event
              ) => {
                setGrade(
                  event.target
                    .value
                );

                setTargetGroup(
                  getTargetGroupFromGrade(
                    event.target
                      .value
                  )
                );

                setSuccessMessage(
                  ""
                );
              }}
              placeholder="예: 초등 4학년"
              disabled={
                loading ||
                isStudent
              }
              style={fieldStyle}
            />
          </div>
        </div>

        <div
          style={
            twoColumnStyle
          }
        >
          <div>
            <label
              htmlFor="birthDate"
              style={labelStyle}
            >
              생년월일
            </label>

            <input
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={(
                event
              ) =>
                handleBirthDateChange(
                  event.target.value
                )
              }
              disabled={
                loading ||
                isStudent
              }
              style={fieldStyle}
            />
          </div>

          <div>
            <label
              htmlFor="age"
              style={labelStyle}
            >
              나이
            </label>

            <input
              id="age"
              type="number"
              min="3"
              max="100"
              value={age}
              onChange={(
                event
              ) => {
                setAge(
                  event.target
                    .value
                );
                setSuccessMessage(
                  ""
                );
              }}
              placeholder="예: 10"
              disabled={
                loading ||
                isStudent
              }
              style={fieldStyle}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="schoolName"
            style={labelStyle}
          >
            학교명
            <span
              style={{
                marginLeft:
                  "5px",
                color:
                  "#98a2b3",
                fontSize:
                  "11px",
                fontWeight:
                  500,
              }}
            >
              선택
            </span>
          </label>

          <input
            id="schoolName"
            type="text"
            value={
              schoolName
            }
            onChange={(
              event
            ) => {
              setSchoolName(
                event.target
                  .value
              );
              setSuccessMessage(
                ""
              );
            }}
            placeholder="예: TALKLY초등학교"
            disabled={
              loading ||
              isStudent
            }
            style={fieldStyle}
          />
        </div>

        <div>
          <label
            htmlFor="targetGroup"
            style={labelStyle}
          >
            레벨테스트 유형
          </label>

          <select
            id="targetGroup"
            value={
              targetGroup
            }
            onChange={(
              event
            ) => {
              setTargetGroup(
                event.target
                  .value
              );
              setSuccessMessage(
                ""
              );
            }}
            disabled={
              loading ||
              isStudent
            }
            style={fieldStyle}
          >
            <option value="elementary">
              초등 영어 레벨테스트
            </option>

            <option value="middle">
              중등 영어 레벨테스트
            </option>

            <option value="high">
              고등 영어 레벨테스트
            </option>

            <option value="adult">
              대학생·성인 영어 레벨테스트
            </option>
          </select>
        </div>

        <div>
          <label
            htmlFor="learningHistory"
            style={labelStyle}
          >
            영어 학습경력
            <span
              style={{
                marginLeft:
                  "5px",
                color:
                  "#98a2b3",
                fontSize:
                  "11px",
                fontWeight:
                  500,
              }}
            >
              선택
            </span>
          </label>

          <textarea
            id="learningHistory"
            value={
              learningHistory
            }
            onChange={(
              event
            ) => {
              setLearningHistory(
                event.target
                  .value
              );
              setSuccessMessage(
                ""
              );
            }}
            rows={4}
            placeholder="예: 영어학원 2년, 화상영어 6개월"
            disabled={loading}
            style={textareaStyle}
          />
        </div>

        <div>
          <label
            htmlFor="learningGoal"
            style={labelStyle}
          >
            영어 학습 목표
            <span
              style={{
                marginLeft:
                  "5px",
                color:
                  "#98a2b3",
                fontSize:
                  "11px",
                fontWeight:
                  500,
              }}
            >
              선택
            </span>
          </label>

          <textarea
            id="learningGoal"
            value={
              learningGoal
            }
            onChange={(
              event
            ) => {
              setLearningGoal(
                event.target
                  .value
              );
              setSuccessMessage(
                ""
              );
            }}
            rows={4}
            placeholder="예: 회화 자신감 향상, 학교 영어 보완"
            disabled={loading}
            style={textareaStyle}
          />
        </div>

        <div
          style={{
            padding: "18px",
            border:
              "1px solid #dbe7ff",
            borderRadius:
              "12px",
            background:
              "#f5f8ff",
          }}
        >
          <div
            style={{
              color:
                "#2f6fed",
              fontSize:
                "12px",
              fontWeight:
                900,
            }}
          >
            레벨테스트 결과 안내
          </div>

          <p
            style={{
              margin:
                "7px 0 0",
              color:
                "#667085",
              fontSize:
                "11px",
              lineHeight: 1.8,
            }}
          >
            테스트 결과는 TALKLY의
            내부 레벨 판단과 수업
            상담을 위한 자료로
            활용합니다. 세부 점수 및
            내부 분석 결과는 별도로
            제공하지 않으며 추가
            확인이 필요한 경우
            보호자에게 전화 또는 SNS로
            원어민 화상 테스트를
            안내합니다.
          </p>
        </div>

        {errorMessage && (
          <div
            style={errorStyle}
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            style={
              successStyle
            }
          >
            {successMessage}
          </div>
        )}

        <div
          style={{
            display:
              "flex",
            justifyContent:
              "flex-end",
          }}
        >
          <button
            type="submit"
            disabled={loading}
            style={{
              minHeight:
                "48px",
              padding:
                "0 24px",
              border:
                "none",
              borderRadius:
                "10px",

              background:
                loading
                  ? "#98a2b3"
                  : "#0A1F44",

              color:
                "#ffffff",

              fontFamily:
                "inherit",

              fontSize:
                "13px",
              fontWeight:
                900,

              cursor:
                loading
                  ? "default"
                  : "pointer",
            }}
          >
            {loading
              ? "신청 중..."
              : "AI 레벨테스트 신청"}
          </button>
        </div>
      </form>
    </section>
  );
}

function ModeButton({
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
        minHeight: "82px",
        padding: "16px",
        border: selected
          ? "2px solid #2f6fed"
          : "1px solid #d0d5dd",
        borderRadius: "12px",
        background: selected
          ? "#f5f8ff"
          : "#ffffff",
        color: "#344054",
        fontFamily: "inherit",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          color: selected
            ? "#2f6fed"
            : "#101828",
          fontSize: "13px",
          fontWeight: 900,
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: "5px",
          color: "#667085",
          fontSize: "11px",
          lineHeight: 1.6,
        }}
      >
        {description}
      </div>
    </button>
  );
}

function getTargetGroupFromGrade(
  grade: string | null
) {
  if (!grade) {
    return "elementary";
  }

  const value =
    grade.toLowerCase();

  if (
    value.includes("중") ||
    value.includes("middle")
  ) {
    return "middle";
  }

  if (
    value.includes("고") ||
    value.includes("high")
  ) {
    return "high";
  }

  if (
    value.includes("대학") ||
    value.includes("성인") ||
    value.includes("adult") ||
    value.includes("university")
  ) {
    return "adult";
  }

  return "elementary";
}

function calculateAge(
  birthDate: string
) {
  const today =
    new Date();

  const birth =
    new Date(
      `${birthDate}T00:00:00`
    );

  let age =
    today.getFullYear() -
    birth.getFullYear();

  const monthDifference =
    today.getMonth() -
    birth.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 &&
      today.getDate() <
        birth.getDate())
  ) {
    age -= 1;
  }

  return age;
}

const twoColumnStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: "14px",
};

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
  border:
    "1px solid #d0d5dd",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "14px",
  outline: "none",
};

const textareaStyle = {
  ...fieldStyle,
  minHeight: "110px",
  padding: "13px 14px",
  resize: "vertical" as const,
  lineHeight: 1.7,
};

const errorStyle = {
  padding: "14px 16px",
  border:
    "1px solid #fda29b",
  borderRadius: "10px",
  background: "#fffbfa",
  color: "#b42318",
  fontSize: "12px",
  fontWeight: 700,
  lineHeight: 1.6,
};

const successStyle = {
  padding: "14px 16px",
  border:
    "1px solid #abefc6",
  borderRadius: "10px",
  background: "#ecfdf3",
  color: "#027a48",
  fontSize: "12px",
  fontWeight: 800,
};