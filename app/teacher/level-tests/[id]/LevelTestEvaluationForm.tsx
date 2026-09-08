"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Props = {
  interviewId: number;

  initialStatus: string;

  scheduledAt: string | null;

  meetingUrl: string | null;

  isCurrentInterview: boolean;

  interview: {
    speaking_level: number | null;
    listening_level: number | null;
    pronunciation_level: number | null;
    comprehension_level: number | null;

    suggested_level: string | null;

    strengths: string | null;
    weaknesses: string | null;
    teacher_comment: string | null;
  };
};

type ApiResponse = {
  ok?: boolean;

  status?: string;

  levelTestStatus?: string;

  meetingUrl?: string | null;

  error?: string;

  code?: string;

  scheduledAt?: string;

  entryOpenAt?: string;
};

export default function LevelTestEvaluationForm({
  interviewId,
  initialStatus,
  scheduledAt,
  meetingUrl,
  isCurrentInterview,
  interview,
}: Props) {
  const router = useRouter();

  const [
    status,
    setStatus,
  ] = useState(
    initialStatus
  );

  const [
    speakingLevel,
    setSpeakingLevel,
  ] = useState(
    interview.speaking_level
      ? String(
          interview.speaking_level
        )
      : ""
  );

  const [
    listeningLevel,
    setListeningLevel,
  ] = useState(
    interview.listening_level
      ? String(
          interview.listening_level
        )
      : ""
  );

  const [
    pronunciationLevel,
    setPronunciationLevel,
  ] = useState(
    interview.pronunciation_level
      ? String(
          interview.pronunciation_level
        )
      : ""
  );

  const [
    comprehensionLevel,
    setComprehensionLevel,
  ] = useState(
    interview.comprehension_level
      ? String(
          interview.comprehension_level
        )
      : ""
  );

  const [
    suggestedLevel,
    setSuggestedLevel,
  ] = useState(
    interview.suggested_level ??
      ""
  );

  const [
    strengths,
    setStrengths,
  ] = useState(
    interview.strengths ??
      ""
  );

  const [
    weaknesses,
    setWeaknesses,
  ] = useState(
    interview.weaknesses ??
      ""
  );

  const [
    teacherComment,
    setTeacherComment,
  ] = useState(
    interview.teacher_comment ??
      ""
  );

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  /*
   * =====================================================
   * 현재 시간
   *
   * scheduled 상태인 동안 15초마다 갱신합니다.
   * 페이지를 새로고침하지 않아도
   * 테스트 시작 10분 전이 되면
   * 입장 버튼이 자동으로 활성화됩니다.
   * =====================================================
   */

  const [
    nowMs,
    setNowMs,
  ] = useState(
    () => Date.now()
  );

  useEffect(() => {
    if (
      status !==
      "scheduled"
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          setNowMs(
            Date.now()
          );
        },
        15_000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [status]);

  /*
   * =====================================================
   * 입장 가능시간 계산
   * =====================================================
   */

  const scheduledTimeMs =
    scheduledAt
      ? new Date(
          scheduledAt
        ).getTime()
      : null;

  const hasValidSchedule =
    scheduledTimeMs !==
      null &&
    !Number.isNaN(
      scheduledTimeMs
    );

  /*
   * 테스트 시작 10분 전
   */
  const entryOpenAtMs =
    hasValidSchedule
      ? scheduledTimeMs -
        10 * 60 * 1000
      : null;

  /*
   * 이미 테스트가 진행 중이면
   * 예정 시간이 지나도 재입장 가능
   */
  const canEnterByTime =
    status ===
      "in_progress" ||
    (
      status ===
        "scheduled" &&
      entryOpenAtMs !==
        null &&
      nowMs >=
        entryOpenAtMs
    );

  const minutesUntilEntry =
    entryOpenAtMs !==
      null &&
    nowMs <
      entryOpenAtMs
      ? Math.max(
          1,
          Math.ceil(
            (
              entryOpenAtMs -
              nowMs
            ) /
              60000
          )
        )
      : 0;

  /*
   * =====================================================
   * 테스트 시작 + 입장
   * =====================================================
   */

  async function handleStartAndEnter() {
    if (
      loading ||
      !isCurrentInterview
    ) {
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response =
        await fetch(
          `/api/teacher/level-tests/${interviewId}/evaluation`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "start",
              }),
          }
        );

      const result =
        (await response.json()) as ApiResponse;

      if (
        !response.ok
      ) {
        throw new Error(
          result.error ??
            "Unable to start the level test."
        );
      }

      if (
        !result.meetingUrl
      ) {
        throw new Error(
          "The meeting link has not been registered."
        );
      }

      setStatus(
        "in_progress"
      );

      /*
       * 현재 탭에서 화상회의로 이동합니다.
       *
       * 브라우저 popup 차단을 피하기 위해
       * window.open 대신 location.href 사용.
       */
      window.location.href =
        result.meetingUrl;
    } catch (error) {
      console.error(
        "TEACHER LEVEL TEST START ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to start the level test."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * =====================================================
   * 진행 중 테스트 재입장
   * =====================================================
   */

  async function handleReEnter() {
    if (
      loading ||
      !isCurrentInterview
    ) {
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response =
        await fetch(
          `/api/teacher/level-tests/${interviewId}/evaluation`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "start",
              }),
          }
        );

      const result =
        (await response.json()) as ApiResponse;

      if (
        !response.ok
      ) {
        throw new Error(
          result.error ??
            "Unable to re-enter the level test."
        );
      }

      if (
        !result.meetingUrl
      ) {
        throw new Error(
          "The meeting link has not been registered."
        );
      }

      window.location.href =
        result.meetingUrl;
    } catch (error) {
      console.error(
        "TEACHER LEVEL TEST RE-ENTRY ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to re-enter the level test."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * =====================================================
   * 평가 저장
   * =====================================================
   */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      loading ||
      !isCurrentInterview
    ) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (
      status !==
      "in_progress"
    ) {
      setErrorMessage(
        "The level test must be started before the evaluation can be submitted."
      );
      return;
    }

    const speaking =
      Number(
        speakingLevel
      );

    const listening =
      Number(
        listeningLevel
      );

    const pronunciation =
      Number(
        pronunciationLevel
      );

    const comprehension =
      Number(
        comprehensionLevel
      );

    const scores = [
      speaking,
      listening,
      pronunciation,
      comprehension,
    ];

    const invalidScore =
      scores.some(
        (score) =>
          !Number.isInteger(
            score
          ) ||
          score < 1 ||
          score > 10
      );

    if (
      invalidScore
    ) {
      setErrorMessage(
        "Please select a score from 1 to 10 for all four evaluation areas."
      );
      return;
    }

    if (
      !suggestedLevel.trim()
    ) {
      setErrorMessage(
        "Please enter your suggested level."
      );
      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          `/api/teacher/level-tests/${interviewId}/evaluation`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "complete",

                speakingLevel:
                  speaking,

                listeningLevel:
                  listening,

                pronunciationLevel:
                  pronunciation,

                comprehensionLevel:
                  comprehension,

                suggestedLevel:
                  suggestedLevel.trim(),

                strengths:
                  strengths.trim(),

                weaknesses:
                  weaknesses.trim(),

                teacherComment:
                  teacherComment.trim(),
              }),
          }
        );

      const result =
        (await response.json()) as ApiResponse;

      if (
        !response.ok
      ) {
        throw new Error(
          result.error ??
            "Unable to save the level test evaluation."
        );
      }

      setStatus(
        "completed"
      );

      setSuccessMessage(
        "Level test evaluation submitted successfully."
      );

      router.refresh();
    } catch (error) {
      console.error(
        "TEACHER LEVEL TEST COMPLETE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save the level test evaluation."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * =====================================================
   * 과거 / 비활성 인터뷰
   * =====================================================
   */

  if (
    !isCurrentInterview
  ) {
    return (
      <section
        style={
          sectionStyle
        }
      >
        <SectionHeader
          eyebrow="LEVEL TEST RECORD"
          title="Archived Level Test"
          description="This is a previous level-test record and can no longer be modified."
          korean="과거 레벨테스트 기록으로, 현재는 수정할 수 없습니다."
        />

        <NoticeBox
          type="warning"
        >
          This level test is
          read-only.
          <br />
          현재 유효한 테스트가
          아니므로 입장하거나 평가를
          변경할 수 없습니다.
        </NoticeBox>
      </section>
    );
  }

  /*
   * =====================================================
   * 취소된 테스트
   * =====================================================
   */

  if (
    status ===
      "cancelled" ||
    status ===
      "canceled"
  ) {
    return (
      <section
        style={
          sectionStyle
        }
      >
        <SectionHeader
          eyebrow="LEVEL TEST"
          title="Level Test Cancelled"
          description="This level test has been cancelled."
          korean="취소된 레벨테스트입니다."
        />

        <NoticeBox
          type="warning"
        >
          This test is no longer
          available.
        </NoticeBox>
      </section>
    );
  }

  /*
   * =====================================================
   * 예정 상태
   * =====================================================
   */

  if (
    status ===
    "scheduled"
  ) {
    return (
      <section
        style={
          sectionStyle
        }
      >
        <SectionHeader
          eyebrow="LEVEL TEST ENTRY"
          title="Enter Level Test"
          description="You can enter the video level test starting 10 minutes before the scheduled time."
          korean="예정된 테스트 시작 10분 전부터 입장할 수 있습니다."
        />

        {!meetingUrl ? (
          <NoticeBox
            type="warning"
          >
            <strong>
              Meeting link not
              registered yet.
            </strong>

            <br />

            The administrator must
            register the meeting
            link before you can
            enter.

            <br />

            관리자가 화상
            레벨테스트 링크를
            등록해야 입장할 수
            있습니다.
          </NoticeBox>
        ) : !hasValidSchedule ? (
          <NoticeBox
            type="warning"
          >
            <strong>
              Schedule information
              is unavailable.
            </strong>

            <br />

            Please contact the
            administrator.

            <br />

            테스트 일정 정보를
            확인할 수 없습니다.
          </NoticeBox>
        ) : !canEnterByTime ? (
          <>
            <NoticeBox
              type="info"
            >
              <strong>
                Entry opens 10
                minutes before the
                scheduled start.
              </strong>

              <br />

              테스트 시작 10분
              전부터 입장할 수
              있습니다.

              {minutesUntilEntry >
                0 && (
                <>
                  <br />

                  Approximately{" "}
                  <strong>
                    {
                      minutesUntilEntry
                    }{" "}
                    minute
                    {minutesUntilEntry ===
                    1
                      ? ""
                      : "s"}
                  </strong>{" "}
                  until entry opens.
                </>
              )}
            </NoticeBox>

            <button
              type="button"
              disabled
              style={{
                ...primaryButtonStyle,
                marginTop:
                  "16px",
                background:
                  "#98a2b3",
                cursor:
                  "default",
              }}
            >
              Entry Opens 10
              Minutes Before
            </button>
          </>
        ) : (
          <>
            <NoticeBox
              type="success"
            >
              <strong>
                The level test is
                ready.
              </strong>

              <br />

              You can enter the
              meeting now.

              <br />

              지금 화상
              레벨테스트에 입장할
              수 있습니다.
            </NoticeBox>

            <button
              type="button"
              onClick={
                handleStartAndEnter
              }
              disabled={
                loading
              }
              style={{
                ...primaryButtonStyle,
                marginTop:
                  "16px",
                background:
                  loading
                    ? "#98a2b3"
                    : "#0A1F44",
                cursor:
                  loading
                    ? "default"
                    : "pointer",
              }}
            >
              {loading
                ? "Starting..."
                : "Start & Enter Level Test ↗"}
            </button>
          </>
        )}

        {errorMessage && (
          <MessageBox
            type="error"
            message={
              errorMessage
            }
          />
        )}
      </section>
    );
  }

  /*
   * =====================================================
   * 완료 상태
   * =====================================================
   */

  if (
    status ===
    "completed"
  ) {
    return (
      <section
        style={
          sectionStyle
        }
      >
        <SectionHeader
          eyebrow="EVALUATION COMPLETE"
          title="Level Test Evaluation"
          description="Your evaluation has been submitted. The administrator will make the final level and course decision."
          korean="강사 평가는 제출 완료되었습니다. 최종 레벨 및 과정은 관리자가 확정합니다."
        />

        <NoticeBox
          type="success"
        >
          <strong>
            Evaluation submitted
            successfully.
          </strong>

          <br />

          Teacher recommendation
          only — final placement is
          decided by the
          administrator.
        </NoticeBox>

        <div
          style={
            scoreGridStyle
          }
        >
          <ReadOnlyScore
            label="Speaking"
            value={
              speakingLevel
            }
          />

          <ReadOnlyScore
            label="Listening"
            value={
              listeningLevel
            }
          />

          <ReadOnlyScore
            label="Pronunciation"
            value={
              pronunciationLevel
            }
          />

          <ReadOnlyScore
            label="Comprehension"
            value={
              comprehensionLevel
            }
          />
        </div>

        <ReadOnlyItem
          label="Suggested Level"
          korean="강사 제안 레벨"
          value={
            suggestedLevel
          }
        />

        <ReadOnlyItem
          label="Strengths"
          korean="강점"
          value={
            strengths
          }
        />

        <ReadOnlyItem
          label="Areas to Improve"
          korean="보완점"
          value={
            weaknesses
          }
        />

        <ReadOnlyItem
          label="Teacher Comment"
          korean="강사 의견"
          value={
            teacherComment
          }
        />

        {successMessage && (
          <MessageBox
            type="success"
            message={
              successMessage
            }
          />
        )}
      </section>
    );
  }

  /*
   * =====================================================
   * 진행 중
   * =====================================================
   */

  if (
    status ===
    "in_progress"
  ) {
    return (
      <section
        style={
          sectionStyle
        }
      >
        <SectionHeader
          eyebrow="LEVEL TEST IN PROGRESS"
          title="Level Test Evaluation"
          description="Complete the evaluation after the video level test."
          korean="화상 레벨테스트 종료 후 학생 평가를 입력해주세요."
        />

        <div
          style={{
            padding:
              "16px",
            borderRadius:
              "14px",
            border:
              "1px solid #c7d7fe",
            background:
              "#f5f8ff",
            marginBottom:
              "24px",
          }}
        >
          <div
            style={{
              display:
                "flex",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              gap: "14px",
              flexWrap:
                "wrap",
            }}
          >
            <div>
              <div
                style={{
                  color:
                    "#0A1F44",
                  fontSize:
                    "14px",
                  fontWeight:
                    800,
                }}
              >
                Video level test
                in progress
              </div>

              <div
                style={{
                  marginTop:
                    "4px",
                  color:
                    "#667085",
                  fontSize:
                    "12px",
                  lineHeight:
                    1.6,
                }}
              >
                You may re-enter
                the meeting if
                necessary.
                <br />
                필요하면 화상
                레벨테스트에 다시
                입장할 수 있습니다.
              </div>
            </div>

            <button
              type="button"
              onClick={
                handleReEnter
              }
              disabled={
                loading ||
                !meetingUrl
              }
              style={{
                minHeight:
                  "42px",
                padding:
                  "0 18px",
                border:
                  "1px solid #0A1F44",
                borderRadius:
                  "10px",
                background:
                  "#ffffff",
                color:
                  "#0A1F44",
                fontSize:
                  "13px",
                fontWeight:
                  800,
                cursor:
                  loading ||
                  !meetingUrl
                    ? "default"
                    : "pointer",
                opacity:
                  meetingUrl
                    ? 1
                    : 0.55,
              }}
            >
              Re-enter Meeting ↗
            </button>
          </div>
        </div>

        <form
          onSubmit={
            handleSubmit
          }
        >
          <div
            style={
              scoreGridStyle
            }
          >
            <ScoreSelect
              label="Speaking"
              korean="말하기"
              value={
                speakingLevel
              }
              onChange={
                setSpeakingLevel
              }
              disabled={
                loading
              }
            />

            <ScoreSelect
              label="Listening"
              korean="듣기"
              value={
                listeningLevel
              }
              onChange={
                setListeningLevel
              }
              disabled={
                loading
              }
            />

            <ScoreSelect
              label="Pronunciation"
              korean="발음"
              value={
                pronunciationLevel
              }
              onChange={
                setPronunciationLevel
              }
              disabled={
                loading
              }
            />

            <ScoreSelect
              label="Comprehension"
              korean="이해도"
              value={
                comprehensionLevel
              }
              onChange={
                setComprehensionLevel
              }
              disabled={
                loading
              }
            />
          </div>

          <div
            style={{
              marginTop:
                "24px",
            }}
          >
            <FieldLabel
              label="Suggested Level"
              korean="강사 제안 레벨"
              required
            />

            <input
              type="text"
              value={
                suggestedLevel
              }
              onChange={(
                event
              ) => {
                setSuggestedLevel(
                  event
                    .target
                    .value
                );

                setErrorMessage(
                  ""
                );
              }}
              maxLength={
                100
              }
              placeholder="e.g. TALKLY Level 4"
              disabled={
                loading
              }
              style={
                inputStyle
              }
            />

            <p
              style={{
                margin:
                  "7px 0 0",
                color:
                  "#667085",
                fontSize:
                  "11px",
                lineHeight:
                  1.6,
              }}
            >
              This is your
              recommendation only.
              The administrator
              decides the final
              level and course.
              <br />
              강사는 추천 레벨만
              입력하며 최종 레벨과
              과정은 관리자가
              확정합니다.
            </p>
          </div>

          <div
            style={{
              marginTop:
                "20px",
            }}
          >
            <FieldLabel
              label="Strengths"
              korean="강점"
            />

            <textarea
              value={
                strengths
              }
              onChange={(
                event
              ) =>
                setStrengths(
                  event
                    .target
                    .value
                )
              }
              rows={4}
              placeholder="Describe the student's strengths."
              disabled={
                loading
              }
              style={
                textareaStyle
              }
            />
          </div>

          <div
            style={{
              marginTop:
                "20px",
            }}
          >
            <FieldLabel
              label="Areas to Improve"
              korean="보완점"
            />

            <textarea
              value={
                weaknesses
              }
              onChange={(
                event
              ) =>
                setWeaknesses(
                  event
                    .target
                    .value
                )
              }
              rows={4}
              placeholder="Describe areas that need improvement."
              disabled={
                loading
              }
              style={
                textareaStyle
              }
            />
          </div>

          <div
            style={{
              marginTop:
                "20px",
            }}
          >
            <FieldLabel
              label="Teacher Comment"
              korean="강사 의견"
            />

            <textarea
              value={
                teacherComment
              }
              onChange={(
                event
              ) =>
                setTeacherComment(
                  event
                    .target
                    .value
                )
              }
              rows={5}
              placeholder="Add any additional comments for the administrator."
              disabled={
                loading
              }
              style={
                textareaStyle
              }
            />
          </div>

          {errorMessage && (
            <MessageBox
              type="error"
              message={
                errorMessage
              }
            />
          )}

          {successMessage && (
            <MessageBox
              type="success"
              message={
                successMessage
              }
            />
          )}

          <button
            type="submit"
            disabled={
              loading
            }
            style={{
              ...primaryButtonStyle,
              marginTop:
                "24px",
              background:
                loading
                  ? "#98a2b3"
                  : "#0A1F44",
              cursor:
                loading
                  ? "default"
                  : "pointer",
            }}
          >
            {loading
              ? "Submitting..."
              : "Submit Evaluation"}
          </button>
        </form>
      </section>
    );
  }

  /*
   * 기타 상태
   */
  return (
    <section
      style={
        sectionStyle
      }
    >
      <SectionHeader
        eyebrow="LEVEL TEST"
        title="Level Test"
        description="This level test is not currently available."
        korean="현재 진행할 수 없는 레벨테스트 상태입니다."
      />

      <NoticeBox
        type="warning"
      >
        Current status:{" "}
        <strong>
          {status}
        </strong>
      </NoticeBox>
    </section>
  );
}

/*
 * =====================================================
 * UI COMPONENTS
 * =====================================================
 */

function SectionHeader({
  eyebrow,
  title,
  description,
  korean,
}: {
  eyebrow: string;
  title: string;
  description: string;
  korean: string;
}) {
  return (
    <div
      style={{
        marginBottom:
          "24px",
      }}
    >
      <div
        style={{
          color:
            "#2f6fed",
          fontSize:
            "11px",
          fontWeight:
            900,
          letterSpacing:
            "0.12em",
        }}
      >
        {eyebrow}
      </div>

      <h2
        style={{
          margin:
            "8px 0 0",
          color:
            "#101828",
          fontSize:
            "24px",
          lineHeight:
            1.25,
          fontWeight:
            900,
        }}
      >
        {title}
      </h2>

      <p
        style={{
          margin:
            "9px 0 0",
          color:
            "#475467",
          fontSize:
            "13px",
          lineHeight:
            1.7,
        }}
      >
        {description}
      </p>

      <p
        style={{
          margin:
            "3px 0 0",
          color:
            "#98a2b3",
          fontSize:
            "11px",
          lineHeight:
            1.6,
        }}
      >
        {korean}
      </p>
    </div>
  );
}

function ScoreSelect({
  label,
  korean,
  value,
  onChange,
  disabled,
}: {
  label: string;
  korean: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <FieldLabel
        label={
          label
        }
        korean={
          korean
        }
        required
      />

      <select
        value={
          value
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target
              .value
          )
        }
        disabled={
          disabled
        }
        style={
          inputStyle
        }
      >
        <option value="">
          Select
        </option>

        {Array.from(
          {
            length: 10,
          },
          (
            _,
            index
          ) => {
            const score =
              index + 1;

            return (
              <option
                key={
                  score
                }
                value={
                  score
                }
              >
                {score}
              </option>
            );
          }
        )}
      </select>
    </div>
  );
}

function FieldLabel({
  label,
  korean,
  required = false,
}: {
  label: string;
  korean: string;
  required?: boolean;
}) {
  return (
    <label
      style={{
        display:
          "block",
        marginBottom:
          "7px",
      }}
    >
      <span
        style={{
          color:
            "#344054",
          fontSize:
            "13px",
          fontWeight:
            800,
        }}
      >
        {label}

        {required && (
          <span
            style={{
              color:
                "#d92d20",
            }}
          >
            {" "}
            *
          </span>
        )}
      </span>

      <span
        style={{
          display:
            "block",
          marginTop:
            "2px",
          color:
            "#98a2b3",
          fontSize:
            "10px",
        }}
      >
        {korean}
      </span>
    </label>
  );
}

function NoticeBox({
  type,
  children,
}: {
  type:
    | "info"
    | "success"
    | "warning";
  children:
    React.ReactNode;
}) {
  const palette =
    type ===
    "success"
      ? {
          background:
            "#ecfdf3",
          border:
            "#abefc6",
          color:
            "#067647",
        }
      : type ===
        "warning"
      ? {
          background:
            "#fffaeb",
          border:
            "#fedf89",
          color:
            "#93370d",
        }
      : {
          background:
            "#f5f8ff",
          border:
            "#c7d7fe",
          color:
            "#344054",
        };

  return (
    <div
      style={{
        padding:
          "15px 17px",
        border:
          `1px solid ${palette.border}`,
        borderRadius:
          "12px",
        background:
          palette.background,
        color:
          palette.color,
        fontSize:
          "13px",
        lineHeight:
          1.7,
      }}
    >
      {children}
    </div>
  );
}

function MessageBox({
  type,
  message,
}: {
  type:
    | "error"
    | "success";
  message: string;
}) {
  const isError =
    type ===
    "error";

  return (
    <div
      style={{
        marginTop:
          "18px",
        padding:
          "13px 15px",
        border:
          `1px solid ${
            isError
              ? "#fecdca"
              : "#abefc6"
          }`,
        borderRadius:
          "10px",
        background:
          isError
            ? "#fef3f2"
            : "#ecfdf3",
        color:
          isError
            ? "#b42318"
            : "#067647",
        fontSize:
          "12px",
        lineHeight:
          1.6,
      }}
    >
      {message}
    </div>
  );
}

function ReadOnlyScore({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding:
          "15px",
        border:
          "1px solid #e4e7ec",
        borderRadius:
          "12px",
        background:
          "#f9fafb",
      }}
    >
      <div
        style={{
          color:
            "#667085",
          fontSize:
            "11px",
          fontWeight:
            700,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "5px",
          color:
            "#101828",
          fontSize:
            "22px",
          fontWeight:
            900,
        }}
      >
        {value ||
          "-"}
        {value
          ? " / 10"
          : ""}
      </div>
    </div>
  );
}

function ReadOnlyItem({
  label,
  korean,
  value,
}: {
  label: string;
  korean: string;
  value: string;
}) {
  return (
    <div
      style={{
        marginTop:
          "18px",
        padding:
          "16px",
        border:
          "1px solid #e4e7ec",
        borderRadius:
          "12px",
        background:
          "#ffffff",
      }}
    >
      <div
        style={{
          color:
            "#344054",
          fontSize:
            "12px",
          fontWeight:
            800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "2px",
          color:
            "#98a2b3",
          fontSize:
            "10px",
        }}
      >
        {korean}
      </div>

      <div
        style={{
          marginTop:
            "10px",
          color:
            "#475467",
          fontSize:
            "13px",
          lineHeight:
            1.7,
          whiteSpace:
            "pre-wrap",
        }}
      >
        {value ||
          "-"}
      </div>
    </div>
  );
}

/*
 * =====================================================
 * STYLES
 * =====================================================
 */

const sectionStyle:
  React.CSSProperties = {
    marginTop: "26px",
    padding: "26px",
    border:
      "1px solid #e4e7ec",
    borderRadius:
      "20px",
    background:
      "#ffffff",
    boxShadow:
      "0 12px 32px rgba(16, 24, 40, 0.05)",
  };

const scoreGridStyle:
  React.CSSProperties = {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "14px",
    marginTop: "8px",
  };

const inputStyle:
  React.CSSProperties = {
    width: "100%",
    minHeight:
      "44px",
    padding:
      "10px 12px",
    border:
      "1px solid #d0d5dd",
    borderRadius:
      "10px",
    background:
      "#ffffff",
    color:
      "#101828",
    fontSize:
      "13px",
    outline:
      "none",
    boxSizing:
      "border-box",
  };

const textareaStyle:
  React.CSSProperties = {
    ...inputStyle,
    minHeight:
      "110px",
    resize:
      "vertical",
    lineHeight:
      1.6,
  };

const primaryButtonStyle:
  React.CSSProperties = {
    width: "100%",
    minHeight:
      "50px",
    padding:
      "0 18px",
    border: 0,
    borderRadius:
      "12px",
    color:
      "#ffffff",
    fontSize:
      "14px",
    fontWeight:
      900,
  };