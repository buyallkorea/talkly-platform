type DiarizedSegment = {
  id?: string;
  start?: number;
  end?: number;
  text?: string;
  speaker?: string;
};

type DiarizedTranscription = {
  task?: string;
  duration?: number;
  text?: string;
  segments?: DiarizedSegment[];
  usage?: unknown;
};

export type SpeakerRole =
  | "Teacher"
  | "Student";

export type RoleMapping =
  Record<string, SpeakerRole>;

export type ClassTranscriptionResult = {
  text: string;
  transcript: string;
  studentTranscript: string;
  duration: number | null;
  roleMapping: RoleMapping;
  segments: DiarizedSegment[];
};

/*
 * ==========================================
 * 설정
 * ==========================================
 */

const SUPPORTED_EXTENSIONS = [
  "flac",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "m4a",
  "ogg",
  "wav",
  "webm",
];

/*
 * 화자 분리가 실패한 경우
 * 추가로 재시도할 횟수입니다.
 *
 * 1 =
 * 최초 요청 + 재시도 1회
 *
 * 즉 최대 2번 OpenAI 전사를 실행합니다.
 */
const MAX_DIARIZATION_RETRIES =
  1;

/*
 * ==========================================
 * 파일 확장자
 * ==========================================
 */

function getExtension(
  filename: string
) {
  const parts = filename
    .toLowerCase()
    .split(".");

  if (parts.length < 2) {
    return "";
  }

  return parts.pop() ?? "";
}

/*
 * ==========================================
 * OpenAI API Key
 * ==========================================
 */

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

/*
 * ==========================================
 * Responses API 결과 텍스트 추출
 * ==========================================
 */

function extractResponseText(
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

  const texts:
    string[] = [];

  for (const item of output) {
    if (
      !item ||
      typeof item !==
        "object"
    ) {
      continue;
    }

    const content =
      Array.isArray(
        (
          item as {
            content?: unknown;
          }
        ).content
      )
        ? (
            item as {
              content: unknown[];
            }
          ).content
        : [];

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

      const text =
        (
          contentItem as {
            text?: unknown;
          }
        ).text;

      if (
        typeof text ===
          "string" &&
        text.trim()
      ) {
        texts.push(
          text.trim()
        );
      }
    }
  }

  return texts
    .join("\n")
    .trim();
}

/*
 * ==========================================
 * 실제 화자 수 계산
 * ==========================================
 */

function getSpeakers(
  segments:
    DiarizedSegment[]
) {
  return Array.from(
    new Set(
      segments
        .map(
          (segment) =>
            segment.speaker
              ?.trim()
        )
        .filter(
          (
            value
          ): value is string =>
            Boolean(value)
        )
    )
  );
}

/*
 * ==========================================
 * 화자별 발화 샘플
 * ==========================================
 */

function buildSpeakerSample(
  segments:
    DiarizedSegment[]
) {
  const speakerMap =
    new Map<
      string,
      string[]
    >();

  for (
    const segment of
    segments
  ) {
    const speaker =
      typeof segment.speaker ===
        "string" &&
      segment.speaker.trim()
        ? segment.speaker.trim()
        : "";

    const text =
      typeof segment.text ===
        "string"
        ? segment.text.trim()
        : "";

    if (
      !speaker ||
      !text
    ) {
      continue;
    }

    const current =
      speakerMap.get(
        speaker
      ) ?? [];

    current.push(text);

    speakerMap.set(
      speaker,
      current
    );
  }

  const result:
    string[] = [];

  for (
    const [
      speaker,
      utterances,
    ] of speakerMap.entries()
  ) {
    result.push(
      `[${speaker}]`
    );

    for (
      const utterance of
      utterances.slice(
        0,
        30
      )
    ) {
      result.push(
        utterance
      );
    }

    result.push("");
  }

  return result
    .join("\n")
    .trim();
}

/*
 * ==========================================
 * Teacher / Student 역할 판별
 * ==========================================
 */

async function identifySpeakerRoles(
  segments:
    DiarizedSegment[],
  apiKey: string
): Promise<RoleMapping> {
  const speakers =
    getSpeakers(
      segments
    );

  if (
    speakers.length < 2
  ) {
    throw new Error(
      "화자 구분 결과가 2명 미만입니다. Teacher와 Student를 구분할 수 없습니다."
    );
  }

  const speakerSample =
    buildSpeakerSample(
      segments
    );

  const prompt = `
You are analyzing a one-to-one English lesson.

There are normally two speakers:

1. Teacher
2. Student

Determine which diarized speaker is the Teacher
and which diarized speaker is the Student.

Typical Teacher behavior:
- asks questions
- gives instructions
- encourages the learner
- corrects or guides the learner
- introduces topics

Typical Student behavior:
- answers questions
- talks about personal experiences
- practices English
- may make grammar or vocabulary mistakes

Important:
- Do not decide based only on English fluency.
- Use conversational role and interaction patterns.
- Return only valid JSON.
- Do not include markdown.
- Do not include explanations.

Example:

{
  "A": "Teacher",
  "B": "Student"
}

Diarized conversation:

${speakerSample}
`.trim();

  const response =
    await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

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
                  "talkly_speaker_roles",

                strict:
                  true,

                schema: {
                  type:
                    "object",

                  additionalProperties:
                    false,

                  properties:
                    Object.fromEntries(
                      speakers.map(
                        (
                          speaker
                        ) => [
                          speaker,
                          {
                            type:
                              "string",

                            enum: [
                              "Teacher",
                              "Student",
                            ],
                          },
                        ]
                      )
                    ),

                  required:
                    speakers,
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
      "SPEAKER ROLE OPENAI ERROR:",
      JSON.stringify(
        data,
        null,
        2
      )
    );

    throw new Error(
      "Teacher/Student 화자 판별에 실패했습니다."
    );
  }

  const outputText =
    extractResponseText(
      data
    );

  if (!outputText) {
    console.error(
      "EMPTY SPEAKER ROLE RESPONSE:",
      JSON.stringify(
        data,
        null,
        2
      )
    );

    throw new Error(
      "Teacher/Student 화자 판별 결과가 비어 있습니다."
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
      "INVALID SPEAKER ROLE JSON:",
      outputText
    );

    throw new Error(
      "Teacher/Student 화자 판별 결과를 해석할 수 없습니다."
    );
  }

  const mapping:
    RoleMapping = {};

  for (
    const speaker of
    speakers
  ) {
    const role =
      parsed[speaker];

    if (
      role === "Teacher" ||
      role === "Student"
    ) {
      mapping[speaker] =
        role;
    }
  }

  const roles =
    Object.values(
      mapping
    );

  if (
    !roles.includes(
      "Teacher"
    ) ||
    !roles.includes(
      "Student"
    )
  ) {
    console.error(
      "INVALID ROLE MAPPING:",
      mapping
    );

    throw new Error(
      "Teacher와 Student를 정확하게 구분하지 못했습니다."
    );
  }

  return mapping;
}

/*
 * ==========================================
 * 같은 역할의 연속 segment 병합
 * ==========================================
 */

function mergeRoleSegments(
  segments:
    DiarizedSegment[],
  roleMapping:
    RoleMapping
) {
  const merged:
    Array<{
      role:
        SpeakerRole;
      text:
        string;
    }> = [];

  for (
    const segment of
    segments
  ) {
    const speaker =
      segment.speaker
        ?.trim();

    const text =
      segment.text
        ?.trim();

    if (
      !speaker ||
      !text
    ) {
      continue;
    }

    const role =
      roleMapping[
        speaker
      ];

    if (!role) {
      continue;
    }

    const previous =
      merged[
        merged.length -
          1
      ];

    if (
      previous &&
      previous.role ===
        role
    ) {
      previous.text =
        `${previous.text} ${text}`
          .replace(
            /\s+/g,
            " "
          )
          .trim();

      continue;
    }

    merged.push({
      role,
      text,
    });
  }

  return merged;
}

/*
 * ==========================================
 * 전체 Teacher / Student 전사
 * ==========================================
 */

function buildRoleTranscript(
  segments:
    DiarizedSegment[],
  roleMapping:
    RoleMapping
) {
  const merged =
    mergeRoleSegments(
      segments,
      roleMapping
    );

  return merged
    .map(
      (item) =>
        `${item.role}: ${item.text}`
    )
    .join("\n");
}

/*
 * ==========================================
 * 학생 발화만 추출
 * ==========================================
 */

function buildStudentTranscript(
  segments:
    DiarizedSegment[],
  roleMapping:
    RoleMapping
) {
  const merged =
    mergeRoleSegments(
      segments,
      roleMapping
    );

  return merged
    .filter(
      (item) =>
        item.role ===
        "Student"
    )
    .map(
      (item) =>
        item.text
    )
    .join("\n");
}

/*
 * ==========================================
 * OpenAI diarization 1회 실행
 * ==========================================
 */

async function requestDiarizedTranscription(
  audio: File,
  apiKey: string,
  attemptNumber: number
): Promise<DiarizedTranscription> {
  const formData =
    new FormData();

  formData.append(
    "file",
    audio,
    audio.name
  );

  formData.append(
    "model",
    "gpt-4o-transcribe-diarize"
  );

  formData.append(
    "response_format",
    "diarized_json"
  );

  formData.append(
    "chunking_strategy",
    "auto"
  );

  console.log(
    `[TALKLY AI] 음성 diarization 요청 ${attemptNumber}회차 시작`
  );

  const response =
    await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${apiKey}`,
        },

        body:
          formData,

        cache:
          "no-store",
      }
    );

  const data =
    (await response.json()) as
      DiarizedTranscription &
      Record<
        string,
        unknown
      >;

  if (!response.ok) {
    console.error(
      `OPENAI TRANSCRIPTION ERROR - ATTEMPT ${attemptNumber}:`,
      JSON.stringify(
        data,
        null,
        2
      )
    );

    throw new Error(
      "OpenAI 음성 전사에 실패했습니다."
    );
  }

  return data;
}

/*
 * ==========================================
 * 메인
 *
 * Audio
 * ↓
 * diarization
 * ↓
 * 화자 수 확인
 * ↓
 * 2명 미만이면 자동 재시도
 * ↓
 * Teacher / Student 역할 판별
 * ↓
 * 최종 transcript 생성
 * ==========================================
 */

export async function transcribeClassAudio(
  audio: File
): Promise<ClassTranscriptionResult> {
  /*
   * ==========================================
   * 파일 검증
   * ==========================================
   */

  if (
    !(audio instanceof File)
  ) {
    throw new Error(
      "오디오 파일이 필요합니다."
    );
  }

  if (
    audio.size <= 0
  ) {
    throw new Error(
      "오디오 파일이 비어 있습니다."
    );
  }

  const extension =
    getExtension(
      audio.name
    );

  if (
    !SUPPORTED_EXTENSIONS.includes(
      extension
    )
  ) {
    throw new Error(
      `지원하지 않는 오디오 형식입니다. 지원 형식: ${SUPPORTED_EXTENSIONS.join(
        ", "
      )}`
    );
  }

  const apiKey =
    getOpenAiApiKey();

  /*
   * 최초 1회 +
   * MAX_DIARIZATION_RETRIES 만큼 추가 실행
   */
  const maxAttempts =
    MAX_DIARIZATION_RETRIES +
    1;

  let data:
    DiarizedTranscription | null =
    null;

  let segments:
    DiarizedSegment[] = [];

  let speakers:
    string[] = [];

  /*
   * ==========================================
   * diarization 자동 재시도
   * ==========================================
   */

  for (
    let attempt = 1;
    attempt <=
      maxAttempts;
    attempt += 1
  ) {
    data =
      await requestDiarizedTranscription(
        audio,
        apiKey,
        attempt
      );

    segments =
      Array.isArray(
        data.segments
      )
        ? data.segments
        : [];

    if (
      segments.length === 0
    ) {
      console.warn(
        `[TALKLY AI] ${attempt}회차: diarized segment가 없습니다.`
      );
    }

    speakers =
      getSpeakers(
        segments
      );

    console.log(
      `[TALKLY AI] ${attempt}회차 diarization 결과:`,
      {
        segmentCount:
          segments.length,

        speakerCount:
          speakers.length,

        speakers,
      }
    );

    /*
     * Teacher + Student로
     * 사용할 수 있는 최소 2명의
     * 화자가 발견됐습니다.
     */
    if (
      speakers.length >= 2
    ) {
      break;
    }

    /*
     * 마지막 시도가 아니라면
     * 동일한 원본 음성으로 재시도합니다.
     */
    if (
      attempt <
      maxAttempts
    ) {
      console.warn(
        `[TALKLY AI] 화자가 ${speakers.length}명만 감지되었습니다. 동일 음성으로 diarization을 자동 재시도합니다.`
      );
    }
  }

  /*
   * ==========================================
   * 모든 재시도 실패
   * ==========================================
   */

  if (!data) {
    throw new Error(
      "음성 전사 결과를 생성하지 못했습니다."
    );
  }

  if (
    segments.length === 0
  ) {
    console.error(
      "NO DIARIZED SEGMENTS:",
      JSON.stringify(
        data,
        null,
        2
      )
    );

    throw new Error(
      "화자 구분된 전사 결과가 없습니다."
    );
  }

  if (
    speakers.length < 2
  ) {
    console.error(
      "DIARIZATION RETRY FAILED:",
      {
        attempts:
          maxAttempts,

        speakerCount:
          speakers.length,

        speakers,

        segmentCount:
          segments.length,
      }
    );

    throw new Error(
      `화자 구분을 ${maxAttempts}회 시도했지만 ${speakers.length}명의 화자만 감지되었습니다. Teacher와 Student를 구분할 수 없습니다.`
    );
  }

  /*
   * ==========================================
   * Teacher / Student 역할 판별
   * ==========================================
   */

  const roleMapping =
    await identifySpeakerRoles(
      segments,
      apiKey
    );

  /*
   * ==========================================
   * 최종 전사 생성
   * ==========================================
   */

  const transcript =
    buildRoleTranscript(
      segments,
      roleMapping
    );

  const studentTranscript =
    buildStudentTranscript(
      segments,
      roleMapping
    );

  if (!transcript) {
    throw new Error(
      "Teacher/Student 전사문 생성에 실패했습니다."
    );
  }

  if (
    !studentTranscript
  ) {
    throw new Error(
      "학생 발화를 찾을 수 없습니다."
    );
  }

  /*
   * ==========================================
   * 성공
   * ==========================================
   */

  console.log(
    "[TALKLY AI] Teacher / Student 화자 구분 완료:",
    {
      speakers,

      roleMapping,

      duration:
        data.duration ??
        null,
    }
  );

  return {
    text:
      data.text ??
      transcript,

    transcript,

    studentTranscript,

    duration:
      data.duration ??
      null,

    roleMapping,

    segments,
  };
}