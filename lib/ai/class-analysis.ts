import {
  cleanupTranscriptForAnalysis,
} from "@/lib/ai/transcript-cleanup";

export type AiAnalysis = {
  summary: string;
  strengths: string;
  improvements: string;
  grammar_analysis: string;
  vocabulary_analysis: string;
  pronunciation_analysis: string;
  fluency_analysis: string;
  recommended_practice: string;
  student_summary: string;
  parent_summary: string;
};

export type ClassAnalysisContext = {
  courseName: string;
  lessonNumber: number;
  studentName: string;
  teacherName: string;
};

function getOpenAiApiKey() {
  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY 환경변수가 설정되지 않았습니다."
    );
  }

  return apiKey;
}

function normalizeText(
  value: unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value.trim();
}

function validateAnalysis(
  value: unknown
): AiAnalysis {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    throw new Error(
      "AI 분석 결과가 올바른 객체 형식이 아닙니다."
    );
  }

  const data =
    value as Record<
      string,
      unknown
    >;

  const result:
    AiAnalysis = {
      summary:
        normalizeText(
          data.summary
        ),

      strengths:
        normalizeText(
          data.strengths
        ),

      improvements:
        normalizeText(
          data.improvements
        ),

      grammar_analysis:
        normalizeText(
          data.grammar_analysis
        ),

      vocabulary_analysis:
        normalizeText(
          data.vocabulary_analysis
        ),

      pronunciation_analysis:
        normalizeText(
          data.pronunciation_analysis
        ),

      fluency_analysis:
        normalizeText(
          data.fluency_analysis
        ),

      recommended_practice:
        normalizeText(
          data.recommended_practice
        ),

      student_summary:
        normalizeText(
          data.student_summary
        ),

      parent_summary:
        normalizeText(
          data.parent_summary
        ),
    };

  if (!result.summary) {
    throw new Error(
      "AI 분석 결과에 summary가 없습니다."
    );
  }

  if (
    !result.student_summary
  ) {
    throw new Error(
      "AI 분석 결과에 student_summary가 없습니다."
    );
  }

  if (
    !result.parent_summary
  ) {
    throw new Error(
      "AI 분석 결과에 parent_summary가 없습니다."
    );
  }

  return result;
}

function extractOutputText(
  data: Record<
    string,
    unknown
  >
) {
  if (
    typeof data.output_text ===
      "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  const output =
    Array.isArray(
      data.output
    )
      ? data.output
      : [];

  for (
    const item of output
  ) {
    if (
      !item ||
      typeof item !==
        "object"
    ) {
      continue;
    }

    const content =
      (
        item as {
          content?: unknown;
        }
      ).content;

    if (
      !Array.isArray(
        content
      )
    ) {
      continue;
    }

    for (
      const contentItem of
      content
    ) {
      if (
        !contentItem ||
        typeof contentItem !==
          "object"
      ) {
        continue;
      }

      const typed =
        contentItem as {
          type?: unknown;
          text?: unknown;
        };

      if (
        typed.type ===
          "output_text" &&
        typeof typed.text ===
          "string" &&
        typed.text.trim()
      ) {
        return typed.text.trim();
      }
    }
  }

  return "";
}

/*
 * ==========================================
 * TALKLY 공용 AI 수업 분석 엔진
 *
 * 원본 transcript
 * ↓
 * Teacher ASR Cleanup
 * ↓
 * 학생 발화는 원본 그대로 유지
 * ↓
 * AI 학습 분석
 * ==========================================
 */
export async function analyzeClassTranscript(
  transcript: string,
  context:
    ClassAnalysisContext
): Promise<AiAnalysis> {
  const originalTranscript =
    transcript.trim();

  if (
    originalTranscript.length <
    20
  ) {
    throw new Error(
      "분석할 수업 전사문이 너무 짧습니다."
    );
  }

  /*
   * ==========================================
   * Transcript Cleanup
   *
   * ai_class_reports에는
   * process-class-audio가 이미
   * 원본 transcript를 저장합니다.
   *
   * 여기서는 분석용으로만
   * cleanup 결과를 사용합니다.
   * ==========================================
   */
  const cleanupResult =
    await cleanupTranscriptForAnalysis(
      originalTranscript
    );

  const analysisTranscript =
    cleanupResult.cleanedTranscript;

  const apiKey =
    getOpenAiApiKey();

  const prompt = `
You are an English education analysis assistant for TALKLY.

Analyze the transcript of a real one-to-one online English lesson.

Student:
${context.studentName}

Teacher:
${context.teacherName}

Course:
${context.courseName}

Lesson:
${context.lessonNumber}

Important rules:

1. Focus ONLY on evaluating the STUDENT'S English performance.

2. Teacher speech is provided only to understand the context of the student's answers.

3. Never treat a teacher's sentence, grammar, vocabulary, or pronunciation as the student's performance.

4. Do not criticize or evaluate the teacher.

5. Do not invent anything that is not supported by the transcript.

6. The student's wording in this transcript must be treated as the student's actual spoken English.
   Do not assume the student's grammar has already been corrected.

7. If pronunciation cannot be reliably judged from transcript text alone,
   explicitly say that pronunciation could not be fully evaluated from text.

8. Use Korean for explanations.

9. English examples may be included where helpful.

10. Keep the tone professional, supportive, specific, and educational.

11. Avoid exaggerated praise.

12. Do not provide numeric scores.

13. When identifying grammar or vocabulary problems,
    quote or refer to the student's actual wording where useful.

14. Consider the teacher's preceding question
    when interpreting the student's response.

15. Give practical corrections and recommended practice
    appropriate for the student's demonstrated level.

Analyze these areas:

- overall lesson summary
- strengths
- improvements
- grammar
- vocabulary
- pronunciation
- fluency
- recommended practice
- student-friendly summary
- parent-facing summary

Full lesson transcript:

${analysisTranscript}
`.trim();

  const response =
    await fetch(
      "https://api.openai.com/v1/responses",
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            model:
              "gpt-5-mini",

            input:
              prompt,

            text: {
              format: {
                type:
                  "json_schema",

                name:
                  "talkly_class_analysis",

                strict:
                  true,

                schema: {
                  type:
                    "object",

                  additionalProperties:
                    false,

                  properties: {
                    summary: {
                      type:
                        "string",
                    },

                    strengths: {
                      type:
                        "string",
                    },

                    improvements: {
                      type:
                        "string",
                    },

                    grammar_analysis:
                      {
                        type:
                          "string",
                      },

                    vocabulary_analysis:
                      {
                        type:
                          "string",
                      },

                    pronunciation_analysis:
                      {
                        type:
                          "string",
                      },

                    fluency_analysis:
                      {
                        type:
                          "string",
                      },

                    recommended_practice:
                      {
                        type:
                          "string",
                      },

                    student_summary:
                      {
                        type:
                          "string",
                      },

                    parent_summary:
                      {
                        type:
                          "string",
                      },
                  },

                  required: [
                    "summary",
                    "strengths",
                    "improvements",
                    "grammar_analysis",
                    "vocabulary_analysis",
                    "pronunciation_analysis",
                    "fluency_analysis",
                    "recommended_practice",
                    "student_summary",
                    "parent_summary",
                  ],
                },
              },
            },
          }),

        cache:
          "no-store",
      }
    );

  const data =
    (await response.json()) as
      Record<
        string,
        unknown
      >;

  if (!response.ok) {
    console.error(
      "OPENAI CLASS ANALYSIS ERROR:",
      JSON.stringify(
        data,
        null,
        2
      )
    );

    throw new Error(
      `OpenAI 분석 실패: ${JSON.stringify(
        data
      )}`
    );
  }

  const outputText =
    extractOutputText(
      data
    );

  if (!outputText) {
    console.error(
      "OPENAI RAW RESPONSE:",
      JSON.stringify(
        data,
        null,
        2
      )
    );

    throw new Error(
      "OpenAI 응답에서 분석 텍스트를 찾을 수 없습니다."
    );
  }

  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
        outputText
      );
  } catch {
    console.error(
      "OPENAI ANALYSIS OUTPUT:",
      outputText
    );

    throw new Error(
      "OpenAI 분석 결과 JSON 파싱에 실패했습니다."
    );
  }

  return validateAnalysis(
    parsed
  );
}