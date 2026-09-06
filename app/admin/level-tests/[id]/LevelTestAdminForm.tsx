"use client";

import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type CourseOption = {
  id: number;
  name: string;
  target_group: string | null;
  subject_category: string | null;
  level: string | null;
};

type Props = {
  levelTest: {
    id: number;
    status: string;
    interview_required: boolean;
    interview_status: string | null;
    final_level: string | null;
    final_course_id: number | null;
    admin_note: string | null;
  };

  courses: CourseOption[];
};

export default function LevelTestAdminForm({
  levelTest,
  courses,
}: Props) {
  const router = useRouter();

  const [
    interviewRequired,
    setInterviewRequired,
  ] = useState(
    levelTest.interview_required
  );

  const [
    finalLevel,
    setFinalLevel,
  ] = useState(
    levelTest.final_level || ""
  );

  const [
    finalCourseId,
    setFinalCourseId,
  ] = useState(
    levelTest.final_course_id
      ? String(
          levelTest.final_course_id
        )
      : ""
  );

  const [
    adminNote,
    setAdminNote,
  ] = useState(
    levelTest.admin_note || ""
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
   * 원어민 테스트가 필요한 경우에는
   * 실제 평가 완료 이후에만 최종확정 UI를 엽니다.
   *
   * level_tests.interview_status는
   * InterviewResultForm 저장 시 completed가 됩니다.
   */
  const interviewCompleted =
    interviewRequired &&
    levelTest.interview_status ===
      "completed";

  const canFinalize =
    !interviewRequired ||
    interviewCompleted;

  async function postReview(
    body: Record<string, unknown>
  ) {
    const response = await fetch(
      `/api/admin/level-tests/${levelTest.id}/review`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(body),
      }
    );

    let data: {
      error?: string;
      detail?: string;
    } = {};

    try {
      data = await response.json();
    } catch {
      // JSON 응답이 아닌 예외 상황
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
          data.detail ||
          "요청을 처리하지 못했습니다."
      );
    }

    return data;
  }

  async function handleInterviewChoice(
    required: boolean
  ) {
    if (
      required === interviewRequired
    ) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);

    try {
      await postReview({
        action:
          "set_interview_requirement",

        interviewRequired:
          required,
      });

      setInterviewRequired(
        required
      );

      /*
       * 판단방식이 변경되면 기존 최종확정은
       * 서버에서도 해제되므로 화면 상태도 맞춥니다.
       */
      setFinalLevel("");
      setFinalCourseId("");

      setSuccessMessage(
        required
          ? "원어민 추가 테스트 대상으로 변경되었습니다."
          : "추가 테스트 없이 관리자가 최종 판단하도록 변경되었습니다."
      );

      router.refresh();
    } catch (error) {
      console.error(
        "INTERVIEW CHOICE UPDATE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "관리자 판단 변경 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleReviewSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    /*
     * 원어민 테스트가 필요한데 아직 완료되지 않았다면
     * 이 폼에서는 최종확정하지 않습니다.
     * 관리자 메모만 저장할 수 있습니다.
     */
    if (
      canFinalize &&
      finalLevel.trim() &&
      !finalCourseId
    ) {
      setErrorMessage(
        "최종 레벨을 확정하려면 추천 프로그램도 선택해주세요."
      );
      return;
    }

    if (
      canFinalize &&
      finalCourseId &&
      !finalLevel.trim()
    ) {
      setErrorMessage(
        "추천 프로그램을 확정하려면 최종 레벨도 입력해주세요."
      );
      return;
    }

    setLoading(true);

    try {
      await postReview({
        action: "save_review",

        interviewRequired,

        finalLevel:
          canFinalize
            ? finalLevel.trim() ||
              null
            : null,

        finalCourseId:
          canFinalize &&
          finalCourseId
            ? Number(finalCourseId)
            : null,

        adminNote:
          adminNote.trim() ||
          null,
      });

      const finalized =
        canFinalize &&
        !!finalLevel.trim() &&
        !!finalCourseId;

      setSuccessMessage(
        finalized
          ? "최종 레벨과 추천 프로그램이 확정되었습니다."
          : interviewRequired
          ? "관리자 검토 내용이 저장되었습니다. 원어민 테스트 완료 후 최종확정할 수 있습니다."
          : "관리자 검토 내용이 저장되었습니다."
      );

      router.refresh();
    } catch (error) {
      console.error(
        "LEVEL TEST ADMIN UPDATE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "레벨테스트 관리 중 알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={sectionStyle}>
      <div>
        <h2 style={titleStyle}>
          관리자 판단 및 최종 확정
        </h2>

        <p style={descriptionStyle}>
          AI 테스트 결과와 필요한 경우
          원어민 화상 테스트 평가를 함께
          검토하여 최종 레벨과 추천
          프로그램을 확정합니다.
        </p>
      </div>

      <form
        onSubmit={
          handleReviewSubmit
        }
        style={{
          marginTop: "26px",
          display: "flex",
          flexDirection: "column",
          gap: "22px",
        }}
      >
        {/* 원어민 추가 테스트 */}
        <div>
          <div style={labelStyle}>
            원어민 추가 테스트
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: "12px",
            }}
          >
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                void handleInterviewChoice(
                  false
                );
              }}
              style={{
                ...choiceButtonStyle,

                border:
                  !interviewRequired
                    ? "2px solid #2f6fed"
                    : "1px solid #d0d5dd",

                background:
                  !interviewRequired
                    ? "#f5f8ff"
                    : "#ffffff",

                color:
                  !interviewRequired
                    ? "#2f6fed"
                    : "#344054",

                cursor: loading
                  ? "default"
                  : "pointer",
              }}
            >
              추가 테스트 없이 판단
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                void handleInterviewChoice(
                  true
                );
              }}
              style={{
                ...choiceButtonStyle,

                border:
                  interviewRequired
                    ? "2px solid #b54708"
                    : "1px solid #d0d5dd",

                background:
                  interviewRequired
                    ? "#fff7ed"
                    : "#ffffff",

                color:
                  interviewRequired
                    ? "#b54708"
                    : "#344054",

                cursor: loading
                  ? "default"
                  : "pointer",
              }}
            >
              원어민 추가 테스트 필요
            </button>
          </div>

          <div style={helpStyle}>
            AI 결과만으로 판단하기 어려운
            경우에만 원어민 추가 테스트를
            진행합니다. 판단방식을 변경하면
            기존 최종확정은 해제됩니다.
          </div>
        </div>

        {/* 원어민 테스트 대기 */}
        {interviewRequired &&
          !interviewCompleted && (
            <div style={waitingStyle}>
              <div
                style={{
                  color: "#b54708",
                  fontSize: "12px",
                  fontWeight: 900,
                }}
              >
                원어민 화상 테스트 진행
                필요
              </div>

              <p
                style={{
                  margin: "7px 0 0",
                  color: "#667085",
                  fontSize: "11px",
                  lineHeight: 1.7,
                }}
              >
                원어민 화상 테스트의 평가가
                완료되기 전에는 최종 레벨과
                추천 프로그램을 확정할 수
                없습니다. 아래 일정 및 평가
                영역에서 테스트를 먼저
                완료해주세요.
              </p>
            </div>
          )}

        {/* 원어민 테스트 완료 */}
        {interviewRequired &&
          interviewCompleted && (
            <div style={completedStyle}>
              <div
                style={{
                  color: "#067647",
                  fontSize: "12px",
                  fontWeight: 900,
                }}
              >
                원어민 화상 테스트 평가
                완료
              </div>

              <p
                style={{
                  margin: "7px 0 0",
                  color: "#667085",
                  fontSize: "11px",
                  lineHeight: 1.7,
                }}
              >
                강사의 평가와 제안 레벨을
                참고하여 아래에서 TALKLY
                최종 레벨과 추천 프로그램을
                확정해주세요.
              </p>
            </div>
          )}

        {/* 최종 확정 */}
        {canFinalize && (
          <>
            <div>
              <label
                htmlFor="finalLevel"
                style={labelStyle}
              >
                최종 레벨
              </label>

              <input
                id="finalLevel"
                type="text"
                value={finalLevel}
                onChange={(event) => {
                  setFinalLevel(
                    event.target.value
                  );

                  setSuccessMessage("");
                }}
                placeholder="예: Elementary 3, TALKLY Level 4"
                disabled={loading}
                style={fieldStyle}
              />

              <div style={helpStyle}>
                AI 결과와 원어민 테스트가
                진행된 경우 강사 제안 레벨을
                참고하여 TALKLY가 최종
                확정하는 레벨입니다.
              </div>
            </div>

            <div>
              <label
                htmlFor="finalCourseId"
                style={labelStyle}
              >
                추천 프로그램
              </label>

              <select
                id="finalCourseId"
                value={finalCourseId}
                onChange={(event) => {
                  setFinalCourseId(
                    event.target.value
                  );

                  setSuccessMessage("");
                }}
                disabled={loading}
                style={fieldStyle}
              >
                <option value="">
                  추천 프로그램 선택
                </option>

                {courses.map(
                  (course) => (
                    <option
                      key={course.id}
                      value={course.id}
                    >
                      {course.name}
                    </option>
                  )
                )}
              </select>

              <div style={helpStyle}>
                교육과정 자체를 선택합니다.
                강사 국적, 25/50분, 주당
                횟수, 수강기간 등은 이후
                수강신청 단계에서 별도로
                결정합니다.
              </div>
            </div>
          </>
        )}

        {/* 관리자 메모 */}
        <div>
          <label
            htmlFor="adminNote"
            style={labelStyle}
          >
            관리자 메모
          </label>

          <textarea
            id="adminNote"
            value={adminNote}
            onChange={(event) => {
              setAdminNote(
                event.target.value
              );

              setSuccessMessage("");
            }}
            rows={5}
            placeholder="AI 결과 검토 내용, 추가 테스트 사유, 수업 배정 참고사항 등을 입력해주세요."
            disabled={loading}
            style={{
              ...fieldStyle,
              minHeight: "120px",
              padding: "13px 14px",
              resize: "vertical",
              lineHeight: 1.7,
            }}
          />
        </div>

        {errorMessage && (
          <div style={errorStyle}>
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div style={successStyle}>
            {successMessage}
          </div>
        )}

        <div
          style={{
            paddingTop: "4px",
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
              ? "저장 중..."
              : canFinalize &&
                finalLevel.trim() &&
                finalCourseId
              ? "최종 레벨 · 추천 프로그램 확정"
              : "검토 내용 저장"}
          </button>
        </div>
      </form>
    </section>
  );
}

const sectionStyle = {
  marginTop: "22px",
  padding: "26px",
  border: "1px solid #e4e7ec",
  borderRadius: "16px",
  background: "#ffffff",
};

const titleStyle = {
  margin: 0,
  color: "#101828",
  fontSize: "20px",
  letterSpacing: "-0.02em",
};

const descriptionStyle = {
  margin: "8px 0 0",
  color: "#667085",
  fontSize: "13px",
  lineHeight: 1.7,
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
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "14px",
  outline: "none",
};

const choiceButtonStyle = {
  minHeight: "54px",
  padding: "0 16px",
  borderRadius: "10px",
  fontFamily: "inherit",
  fontSize: "13px",
  fontWeight: 900,
};

const helpStyle = {
  marginTop: "9px",
  color: "#98a2b3",
  fontSize: "11px",
  lineHeight: 1.6,
};

const waitingStyle = {
  padding: "17px 18px",
  border: "1px solid #fedf89",
  borderRadius: "11px",
  background: "#fffaeb",
};

const completedStyle = {
  padding: "17px 18px",
  border: "1px solid #abefc6",
  borderRadius: "11px",
  background: "#ecfdf3",
};

const errorStyle = {
  padding: "14px 16px",
  border: "1px solid #fda29b",
  borderRadius: "10px",
  background: "#fffbfa",
  color: "#b42318",
  fontSize: "12px",
  fontWeight: 700,
  lineHeight: 1.6,
};

const successStyle = {
  padding: "14px 16px",
  border: "1px solid #abefc6",
  borderRadius: "10px",
  background: "#ecfdf3",
  color: "#027a48",
  fontSize: "12px",
  fontWeight: 800,
};