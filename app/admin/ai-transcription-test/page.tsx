"use client";

import {
  FormEvent,
  useState,
} from "react";

type ProcessResult = {
  success?: boolean;

  message?: string;

  error?: string;

  session?: {
    id?: number;
    lessonNumber?: number;
    studentName?: string;
    teacherName?: string;
    courseName?: string;
  };

  transcription?: {
    text?: string;

    transcript?: string;

    studentTranscript?: string;

    duration?:
      | number
      | null;

    roleMapping?:
      Record<
        string,
        string
      >;

    segments?:
      unknown[];
  };

  report?: {
    id?: number;

    class_session_id?:
      number;

    status?: string;

    transcript?: string;

    summary?: string;

    strengths?: string;

    improvements?: string;

    grammar_analysis?:
      string;

    vocabulary_analysis?:
      string;

    pronunciation_analysis?:
      string;

    fluency_analysis?:
      string;

    recommended_practice?:
      string;

    student_summary?:
      string;

    parent_summary?:
      string;

    ai_model?: string;

    analyzed_at?:
      string;
  };
};

export default function AiTranscriptionTestPage() {
  const [
    sessionId,
    setSessionId,
  ] =
    useState(
      "27"
    );

  const [
    audioFile,
    setAudioFile,
  ] =
    useState<
      File | null
    >(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );

  const [
    retryLoading,
    setRetryLoading,
  ] =
    useState(
      false
    );

  const [
    result,
    setResult,
  ] =
    useState<
      ProcessResult | null
    >(
      null
    );

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !audioFile
    ) {
      alert(
        "오디오 파일을 선택해주세요."
      );

      return;
    }

    if (
      !sessionId ||
      Number(
        sessionId
      ) <= 0
    ) {
      alert(
        "올바른 수업 ID를 입력해주세요."
      );

      return;
    }

    setLoading(
      true
    );

    setResult(
      null
    );

    try {
      const formData =
        new FormData();

      formData.append(
        "sessionId",
        sessionId
      );

      formData.append(
        "audio",
        audioFile
      );

      /*
       * ==========================================
       * 통합 AI 파이프라인 호출
       *
       * 오디오
       * ↓
       * 전사
       * ↓
       * 화자 구분
       * ↓
       * AI 분석
       * ↓
       * DB 저장
       * ==========================================
       */
      const response =
        await fetch(
          "/api/ai/process-class-audio",
          {
            method:
              "POST",

            body:
              formData,
          }
        );

      const data =
        (await response.json()) as
          ProcessResult;

      setResult(
        data
      );
    } catch (error) {
      setResult({
        success:
          false,

        error:
          error instanceof
          Error
            ? error.message
            : "요청 중 오류가 발생했습니다.",
      });
    } finally {
      setLoading(
        false
      );
    }
  }

  async function handleRetry() {
    if (
      !sessionId ||
      Number(
        sessionId
      ) <= 0
    ) {
      alert(
        "올바른 수업 ID를 입력해주세요."
      );

      return;
    }

    setRetryLoading(
      true
    );

    setResult(
      null
    );

    try {
      const response =
        await fetch(
          "/api/ai/retry-class-audio",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                sessionId:
                  Number(
                    sessionId
                  ),
              }),
          }
        );

      const data =
        (await response.json()) as
          ProcessResult;

      setResult(
        data
      );
    } catch (error) {
      setResult({
        success:
          false,

        error:
          error instanceof
          Error
            ? error.message
            : "저장된 음성 재분석 요청 중 오류가 발생했습니다.",
      });
    } finally {
      setRetryLoading(
        false
      );
    }
  }

  return (
    <main
      style={{
        maxWidth:
          "1000px",

        margin:
          "50px auto",

        padding:
          "0 24px 80px",
      }}
    >
      <div
        style={{
          marginBottom:
            "32px",
        }}
      >
        <div
          style={{
            fontSize:
              "14px",

            fontWeight:
              700,

            marginBottom:
              "10px",
          }}
        >
          TALKLY AI CLASS PIPELINE
        </div>

        <h1
          style={{
            fontSize:
              "32px",

            margin:
              "0 0 12px",
          }}
        >
          AI 수업 분석 통합 테스트
        </h1>

        <p
          style={{
            margin:
              0,

            opacity:
              0.7,

            lineHeight:
              1.7,
          }}
        >
          음성 파일 하나로
          전사, 화자 구분,
          AI 학습 분석,
          리포트 DB 저장까지
          전체 과정을
          테스트합니다.
        </p>
      </div>

      <form
        onSubmit={
          handleSubmit
        }
        style={{
          display:
            "flex",

          flexDirection:
            "column",

          gap:
            "24px",

          padding:
            "28px",

          border:
            "1px solid rgba(255,255,255,0.15)",

          borderRadius:
            "16px",
        }}
      >
        <div>
          <label
            style={{
              display:
                "block",

              marginBottom:
                "8px",

              fontWeight:
                700,
            }}
          >
            수업 ID
          </label>

          <input
            type="number"
            min="1"
            value={
              sessionId
            }
            onChange={(
              event
            ) =>
              setSessionId(
                event.target
                  .value
              )
            }
            style={{
              width:
                "100%",

              maxWidth:
                "320px",

              padding:
                "12px 14px",

              borderRadius:
                "8px",

              border:
                "1px solid #555",
            }}
          />
        </div>

        <div>
          <label
            style={{
              display:
                "block",

              marginBottom:
                "8px",

              fontWeight:
                700,
            }}
          >
            수업 오디오
          </label>

          <input
            type="file"
            accept="
              audio/*,
              .mp3,
              .wav,
              .m4a,
              .mp4,
              .webm,
              .ogg,
              .flac
            "
            onChange={(
              event
            ) =>
              setAudioFile(
                event.target
                  .files?.[0] ??
                  null
              )
            }
          />
        </div>

        <button
          type="submit"
          disabled={
            loading
          }
          style={{
            width:
              "fit-content",

            minWidth:
              "220px",

            padding:
              "14px 20px",

            borderRadius:
              "9px",

            border:
              "1px solid #666",

            fontWeight:
              700,

            cursor:
              loading
                ? "wait"
                : "pointer",
          }}
        >
          {loading
            ? "AI 분석 진행 중..."
            : "전체 AI 수업 분석 실행"}
        </button>

        {loading && (
          <p
            style={{
              margin:
                0,

              opacity:
                0.7,
            }}
          >
            음성 전사와 AI 분석을
            순차적으로 처리하고 있습니다.
            잠시 기다려주세요.
          </p>
        )}
      </form>

      <section
        style={{
          marginTop:
            "24px",

          padding:
            "28px",

          border:
            "1px solid rgba(255,255,255,0.15)",

          borderRadius:
            "16px",
        }}
      >
        <h2
          style={{
            margin:
              "0 0 10px",

            fontSize:
              "20px",
          }}
        >
          저장된 음성 재분석
        </h2>

        <p
          style={{
            margin:
              "0 0 18px",

            opacity:
              0.7,

            lineHeight:
              1.7,
          }}
        >
          위 수업 ID의 기존 원본 음성을
          Supabase Storage에서 다시 불러와
          파일 재업로드 없이 전사와 AI 분석을
          다시 실행합니다.
        </p>

        <button
          type="button"
          onClick={
            handleRetry
          }
          disabled={
            loading ||
            retryLoading
          }
          style={{
            width:
              "fit-content",

            minWidth:
              "220px",

            padding:
              "14px 20px",

            borderRadius:
              "9px",

            border:
              "1px solid #666",

            fontWeight:
              700,

            cursor:
              loading ||
              retryLoading
                ? "wait"
                : "pointer",
          }}
        >
          {retryLoading
            ? "저장된 음성 재분석 중..."
            : "저장된 음성으로 재분석"}
        </button>

        {retryLoading && (
          <p
            style={{
              margin:
                "14px 0 0",

              opacity:
                0.7,
            }}
          >
            Storage 원본 음성을 불러와
            전사와 AI 분석을 다시 처리하고 있습니다.
          </p>
        )}
      </section>

      {result && (
        <section
          style={{
            marginTop:
              "36px",
          }}
        >
          <h2>
            처리 결과
          </h2>

          <div
            style={{
              padding:
                "20px",

              marginBottom:
                "20px",

              borderRadius:
                "12px",

              border:
                "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <strong>
              {result.success
                ? "성공"
                : "실패"}
            </strong>

            <p>
              {result.message ??
                result.error ??
                "-"}
            </p>
          </div>

          {result
            .transcription
            ?.transcript && (
            <div
              style={{
                marginBottom:
                  "28px",
              }}
            >
              <h3>
                Teacher /
                Student 전사
              </h3>

              <pre
                style={{
                  padding:
                    "20px",

                  whiteSpace:
                    "pre-wrap",

                  overflowWrap:
                    "anywhere",

                  borderRadius:
                    "12px",

                  background:
                    "#f5f5f5",

                  color:
                    "#111",
                }}
              >
                {
                  result
                    .transcription
                    .transcript
                }
              </pre>
            </div>
          )}

          {result
            .transcription
            ?.studentTranscript && (
            <div
              style={{
                marginBottom:
                  "28px",
              }}
            >
              <h3>
                학생 발화
              </h3>

              <pre
                style={{
                  padding:
                    "20px",

                  whiteSpace:
                    "pre-wrap",

                  overflowWrap:
                    "anywhere",

                  borderRadius:
                    "12px",

                  background:
                    "#f5f5f5",

                  color:
                    "#111",
                }}
              >
                {
                  result
                    .transcription
                    .studentTranscript
                }
              </pre>
            </div>
          )}

          {result.report && (
            <div
              style={{
                display:
                  "flex",

                flexDirection:
                  "column",

                gap:
                  "18px",
              }}
            >
              <h3>
                AI 수업 리포트
              </h3>

              <ReportBox
                title="이번 수업 요약"
                text={
                  result.report
                    .summary
                }
              />

              <ReportBox
                title="잘한 점"
                text={
                  result.report
                    .strengths
                }
              />

              <ReportBox
                title="개선이 필요한 점"
                text={
                  result.report
                    .improvements
                }
              />

              <ReportBox
                title="문법 분석"
                text={
                  result.report
                    .grammar_analysis
                }
              />

              <ReportBox
                title="어휘 분석"
                text={
                  result.report
                    .vocabulary_analysis
                }
              />

              <ReportBox
                title="발음 분석"
                text={
                  result.report
                    .pronunciation_analysis
                }
              />

              <ReportBox
                title="유창성 분석"
                text={
                  result.report
                    .fluency_analysis
                }
              />

              <ReportBox
                title="추천 학습"
                text={
                  result.report
                    .recommended_practice
                }
              />

              <ReportBox
                title="학생용 AI 코멘트"
                text={
                  result.report
                    .student_summary
                }
              />

              <ReportBox
                title="학부모용 AI 코멘트"
                text={
                  result.report
                    .parent_summary
                }
              />
            </div>
          )}

          <details
            style={{
              marginTop:
                "32px",
            }}
          >
            <summary
              style={{
                cursor:
                  "pointer",

                fontWeight:
                  700,
              }}
            >
              전체 JSON 결과 보기
            </summary>

            <pre
              style={{
                marginTop:
                  "16px",

                padding:
                  "20px",

                whiteSpace:
                  "pre-wrap",

                overflowWrap:
                  "anywhere",

                borderRadius:
                  "12px",

                background:
                  "#f5f5f5",

                color:
                  "#111",
              }}
            >
              {JSON.stringify(
                result,
                null,
                2
              )}
            </pre>
          </details>
        </section>
      )}
    </main>
  );
}

function ReportBox({
  title,
  text,
}: {
  title:
    string;

  text?:
    string;
}) {
  if (!text) {
    return null;
  }

  return (
    <div
      style={{
        padding:
          "20px",

        borderRadius:
          "12px",

        border:
          "1px solid rgba(255,255,255,0.15)",
      }}
    >
      <div
        style={{
          fontWeight:
            700,

          marginBottom:
            "10px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          lineHeight:
            1.8,

          whiteSpace:
            "pre-wrap",
        }}
      >
        {text}
      </div>
    </div>
  );
}