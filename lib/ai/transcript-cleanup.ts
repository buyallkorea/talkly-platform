export type TranscriptCleanupResult = {
  originalTranscript: string;
  cleanedTranscript: string;
  changed: boolean;
};

type TranscriptLine = {
  role: "Teacher" | "Student";
  text: string;
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
 * Teacher / Student transcript 파싱
 * ==========================================
 */
function parseTranscript(
  transcript: string
): TranscriptLine[] {
  const lines =
    transcript
      .split("\n")
      .map(
        (line) =>
          line.trim()
      )
      .filter(Boolean);

  const result:
    TranscriptLine[] = [];

  for (
    const line of lines
  ) {
    if (
      line.startsWith(
        "Teacher:"
      )
    ) {
      result.push({
        role:
          "Teacher",

        text:
          line
            .slice(
              "Teacher:"
                .length
            )
            .trim(),
      });

      continue;
    }

    if (
      line.startsWith(
        "Student:"
      )
    ) {
      result.push({
        role:
          "Student",

        text:
          line
            .slice(
              "Student:"
                .length
            )
            .trim(),
      });
    }
  }

  return result;
}

/*
 * ==========================================
 * AI가 Teacher 문장만 정리
 *
 * Student 문장은 이 함수에
 * 수정 대상으로 보내지 않습니다.
 * ==========================================
 */
async function cleanupTeacherLines(
  lines: TranscriptLine[]
) {
  const apiKey =
    getOpenAiApiKey();

  const teacherLines =
    lines
      .map(
        (line, index) => ({
          index,
          role:
            line.role,
          text:
            line.text,
        })
      )
      .filter(
        (line) =>
          line.role ===
          "Teacher"
      );

  if (
    teacherLines.length ===
    0
  ) {
    return new Map<
      number,
      string
    >();
  }

  /*
   * 전체 대화는 문맥용으로 제공하지만,
   * 수정 대상은 Teacher 발화뿐입니다.
   */
  const fullContext =
    lines
      .map(
        (line) =>
          `${line.role}: ${line.text}`
      )
      .join("\n");

  const teacherInput =
    teacherLines
      .map(
        (line) =>
          `[${line.index}] ${line.text}`
      )
      .join("\n");

  const prompt = `
You are cleaning an automatic speech recognition transcript
from a one-to-one online English lesson.

VERY IMPORTANT RULES:

1. You may ONLY correct obvious ASR/transcription mistakes
   in TEACHER speech.

2. NEVER correct, improve, rewrite, paraphrase,
   normalize, or grammatically fix STUDENT speech.

3. Student mistakes are valuable learning data
   and must remain exactly as spoken.

4. For Teacher speech, make a correction ONLY when
   the surrounding conversation makes the ASR mistake
   highly obvious.

5. If a Teacher phrase may actually be what was spoken,
   leave it unchanged.

6. Do not improve the Teacher's style.
   Do not rewrite correct Teacher sentences.

7. Preserve meaning, tone, wording, and sentence order.

8. Minor punctuation cleanup is allowed
   for Teacher speech only.

9. Return exactly one string for every supplied Teacher index.

Example:

Teacher ASR:
"Pray, what kind of movie do you like?"

Conversation context clearly indicates:
"Great, what kind of movie do you like?"

Then "Pray" may be corrected to "Great".

But:

Student:
"I went to park yesterday."

MUST NEVER become:
"I went to the park yesterday."

Full lesson context:

${fullContext}

Teacher lines that may be cleaned:

${teacherInput}
`.trim();

  const indexes =
    teacherLines.map(
      (line) =>
        String(
          line.index
        )
    );

  const properties =
    Object.fromEntries(
      indexes.map(
        (index) => [
          index,
          {
            type:
              "string",
          },
        ]
      )
    );

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
                  "talkly_teacher_transcript_cleanup",

                strict:
                  true,

                schema: {
                  type:
                    "object",

                  additionalProperties:
                    false,

                  properties,

                  required:
                    indexes,
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
      "TRANSCRIPT CLEANUP OPENAI ERROR:",
      JSON.stringify(
        data,
        null,
        2
      )
    );

    throw new Error(
      "Teacher 전사문 정리에 실패했습니다."
    );
  }

  const outputText =
    extractOutputText(
      data
    );

  if (!outputText) {
    throw new Error(
      "Teacher 전사문 정리 결과가 비어 있습니다."
    );
  }

  let parsed:
    Record<
      string,
      unknown
    >;

  try {
    parsed =
      JSON.parse(
        outputText
      ) as Record<
        string,
        unknown
      >;
  } catch {
    console.error(
      "INVALID TRANSCRIPT CLEANUP JSON:",
      outputText
    );

    throw new Error(
      "Teacher 전사문 정리 결과를 해석하지 못했습니다."
    );
  }

  const replacements =
    new Map<
      number,
      string
    >();

  for (
    const teacherLine of
    teacherLines
  ) {
    const value =
      parsed[
        String(
          teacherLine.index
        )
      ];

    /*
     * 이상한 결과가 오면
     * 원문을 그대로 사용합니다.
     */
    if (
      typeof value !==
        "string" ||
      !value.trim()
    ) {
      replacements.set(
        teacherLine.index,
        teacherLine.text
      );

      continue;
    }

    replacements.set(
      teacherLine.index,
      value.trim()
    );
  }

  return replacements;
}

/*
 * ==========================================
 * TALKLY Transcript Cleanup
 *
 * 핵심 원칙:
 *
 * Student = 원문 그대로
 * Teacher = 명백한 ASR 오류만 최소 수정
 *
 * Cleanup 자체가 실패하면
 * 원본 transcript를 그대로 사용합니다.
 *
 * 따라서 Cleanup 문제 때문에
 * 전체 AI 리포트 생성이 실패하지 않습니다.
 * ==========================================
 */
export async function cleanupTranscriptForAnalysis(
  transcript: string
): Promise<TranscriptCleanupResult> {
  const originalTranscript =
    transcript.trim();

  if (
    originalTranscript.length <
    20
  ) {
    return {
      originalTranscript,

      cleanedTranscript:
        originalTranscript,

      changed:
        false,
    };
  }

  const lines =
    parseTranscript(
      originalTranscript
    );

  /*
   * Teacher / Student 구조가 아니면
   * 안전하게 원문 사용
   */
  if (
    lines.length === 0
  ) {
    return {
      originalTranscript,

      cleanedTranscript:
        originalTranscript,

      changed:
        false,
    };
  }

  try {
    const replacements =
      await cleanupTeacherLines(
        lines
      );

    const cleanedTranscript =
      lines
        .map(
          (
            line,
            index
          ) => {
            /*
             * Student 발화는
             * 절대 변경하지 않습니다.
             */
            if (
              line.role ===
              "Student"
            ) {
              return `Student: ${line.text}`;
            }

            const cleanedTeacherText =
              replacements.get(
                index
              ) ??
              line.text;

            return `Teacher: ${cleanedTeacherText}`;
          }
        )
        .join("\n")
        .trim();

    const changed =
      cleanedTranscript !==
      originalTranscript;

    if (changed) {
      console.log(
        "[TALKLY AI] Transcript cleanup applied."
      );

      console.log(
        "[TALKLY AI] Original transcript:",
        originalTranscript
      );

      console.log(
        "[TALKLY AI] Cleaned transcript:",
        cleanedTranscript
      );
    } else {
      console.log(
        "[TALKLY AI] Transcript cleanup: 변경 없음"
      );
    }

    return {
      originalTranscript,

      cleanedTranscript,

      changed,
    };
  } catch (error) {
    /*
     * Cleanup은 보조 기능입니다.
     *
     * 실패하더라도 AI 수업 리포트
     * 전체를 실패시키지 않습니다.
     */
    console.error(
      "TRANSCRIPT CLEANUP FAILED - USING ORIGINAL:",
      error
    );

    return {
      originalTranscript,

      cleanedTranscript:
        originalTranscript,

      changed:
        false,
    };
  }
}