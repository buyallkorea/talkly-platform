import { NextResponse } from "next/server";
import {
  createClient as createAdminClient,
} from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase-server";

import {
  transcribeClassAudio,
} from "@/lib/ai/class-transcription";

import {
  analyzeClassTranscript,
  type AiAnalysis,
} from "@/lib/ai/class-analysis";

const AUDIO_BUCKET =
  "ai-class-audio";

function createAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase 관리자 환경변수가 설정되지 않았습니다."
    );
  }

  return createAdminClient(
    url,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function getErrorMessage(
  error: unknown
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  if (
    typeof error === "string"
  ) {
    return error;
  }

  return "알 수 없는 오류가 발생했습니다.";
}

async function markJobFailed(
  admin: ReturnType<
    typeof createAdmin
  >,
  sessionId: number,
  error: unknown
) {
  const now =
    new Date().toISOString();

  const {
    error: updateError,
  } =
    await admin
      .from(
        "ai_processing_jobs"
      )
      .update({
        status:
          "failed",

        failed_at:
          now,

        last_error:
          getErrorMessage(
            error
          ),

        updated_at:
          now,
      })
      .eq(
        "class_session_id",
        sessionId
      );

  if (updateError) {
    console.error(
      "RETRY JOB FAILED UPDATE ERROR:",
      updateError.message
    );
  }
}

async function markReportFailed(
  admin: ReturnType<
    typeof createAdmin
  >,
  sessionId: number
) {
  const {
    error,
  } =
    await admin
      .from(
        "ai_class_reports"
      )
      .update({
        status:
          "failed",

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "class_session_id",
        sessionId
      );

  if (error) {
    console.error(
      "RETRY REPORT FAILED UPDATE ERROR:",
      error.message
    );
  }
}

function extensionFromPath(
  path: string
) {
  const filename =
    path
      .split("/")
      .pop() ??
    "class-audio";

  return filename;
}

/*
 * ==========================================
 * POST /api/ai/retry-class-audio
 *
 * JSON:
 * {
 *   "sessionId": 27
 * }
 *
 * 기존 ai_processing_jobs에 저장된
 * audio_storage_path를 이용해
 * 원본 음성을 다시 업로드하지 않고
 * 전사 + AI 분석을 재실행합니다.
 * ==========================================
 */
export async function POST(
  request: Request
) {
  let admin:
    ReturnType<
      typeof createAdmin
    > | null =
    null;

  let processingSessionId:
    number | null =
    null;

  try {
    /*
     * ==========================================
     * 로그인 확인
     * ==========================================
     */
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "로그인이 필요합니다.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * ==========================================
     * 관리자 확인
     * ==========================================
     */
    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select("role")
        .eq(
          "id",
          user.id
        )
        .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role !==
        "admin"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "관리자 권한이 필요합니다.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * ==========================================
     * JSON body
     * ==========================================
     */
    let body:
      Record<
        string,
        unknown
      >;

    try {
      body =
        (await request.json()) as
          Record<
            string,
            unknown
          >;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "요청 JSON을 읽을 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const sessionId =
      Number(
        body.sessionId
      );

    if (
      !Number.isInteger(
        sessionId
      ) ||
      sessionId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "올바른 수업 ID가 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    admin =
      createAdmin();

    processingSessionId =
      sessionId;

    /*
     * ==========================================
     * 수업 조회
     * ==========================================
     */
    const {
      data: session,
      error: sessionError,
    } =
      await admin
        .from(
          "class_sessions"
        )
        .select(`
          id,
          enrollment_id,
          lesson_number,
          status,
          scheduled_start,
          scheduled_end
        `)
        .eq(
          "id",
          sessionId
        )
        .maybeSingle();

    if (sessionError) {
      throw new Error(
        `수업 조회 실패: ${sessionError.message}`
      );
    }

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error:
            "수업을 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * ==========================================
     * 기존 Processing Job
     * ==========================================
     */
    const {
      data: existingJob,
      error:
        existingJobError,
    } =
      await admin
        .from(
          "ai_processing_jobs"
        )
        .select(`
          id,
          class_session_id,
          source_type,
          status,
          attempt_count,
          audio_filename,
          audio_mime_type,
          audio_size_bytes,
          audio_storage_path
        `)
        .eq(
          "class_session_id",
          session.id
        )
        .maybeSingle();

    if (
      existingJobError
    ) {
      throw new Error(
        `AI 처리 작업 조회 실패: ${existingJobError.message}`
      );
    }

    if (!existingJob) {
      return NextResponse.json(
        {
          success: false,
          error:
            "재처리할 AI 처리 작업이 없습니다. 먼저 원본 음성을 업로드해 주세요.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      existingJob.status ===
        "transcribing" ||
      existingJob.status ===
        "analyzing"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "이 수업의 AI 분석이 이미 진행 중입니다.",
        },
        {
          status: 409,
        }
      );
    }

    const storagePath =
      typeof existingJob
        .audio_storage_path ===
        "string"
        ? existingJob
            .audio_storage_path
            .trim()
        : "";

    if (!storagePath) {
      return NextResponse.json(
        {
          success: false,
          error:
            "저장된 원본 음성 경로가 없습니다. 이 작업은 자동 재처리할 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ==========================================
     * 수강정보
     * ==========================================
     */
    const {
      data: enrollment,
      error:
        enrollmentError,
    } =
      await admin
        .from(
          "enrollments"
        )
        .select(`
          id,
          student_user_id,
          child_id,
          course_id,
          teacher_user_id
        `)
        .eq(
          "id",
          session.enrollment_id
        )
        .maybeSingle();

    if (
      enrollmentError ||
      !enrollment
    ) {
      throw new Error(
        enrollmentError
          ?.message ||
        "수강정보를 찾을 수 없습니다."
      );
    }

    /*
     * ==========================================
     * 학생 이름
     * ==========================================
     */
    let studentName =
      "Student";

    if (
      enrollment.child_id
    ) {
      const {
        data: child,
        error: childError,
      } =
        await admin
          .from(
            "children"
          )
          .select(
            "name"
          )
          .eq(
            "id",
            enrollment.child_id
          )
          .maybeSingle();

      if (childError) {
        console.error(
          "RETRY CHILD ERROR:",
          childError.message
        );
      }

      if (
        child?.name
      ) {
        studentName =
          child.name;
      }
    } else if (
      enrollment.student_user_id
    ) {
      const {
        data:
          studentProfile,
        error:
          studentProfileError,
      } =
        await admin
          .from(
            "profiles"
          )
          .select(
            "name"
          )
          .eq(
            "id",
            enrollment.student_user_id
          )
          .maybeSingle();

      if (
        studentProfileError
      ) {
        console.error(
          "RETRY STUDENT PROFILE ERROR:",
          studentProfileError.message
        );
      }

      if (
        studentProfile?.name
      ) {
        studentName =
          studentProfile.name;
      }
    }

    /*
     * ==========================================
     * 강사 이름
     * ==========================================
     */
    let teacherName =
      "Teacher";

    if (
      enrollment.teacher_user_id
    ) {
      const {
        data:
          teacherProfile,
        error:
          teacherProfileError,
      } =
        await admin
          .from(
            "teacher_profiles"
          )
          .select(
            "display_name"
          )
          .eq(
            "user_id",
            enrollment.teacher_user_id
          )
          .maybeSingle();

      if (
        teacherProfileError
      ) {
        console.error(
          "RETRY TEACHER PROFILE ERROR:",
          teacherProfileError.message
        );
      }

      if (
        teacherProfile
          ?.display_name
      ) {
        teacherName =
          teacherProfile.display_name;
      } else {
        const {
          data:
            fallbackTeacher,
          error:
            fallbackTeacherError,
        } =
          await admin
            .from(
              "profiles"
            )
            .select(
              "name"
            )
            .eq(
              "id",
              enrollment.teacher_user_id
            )
            .maybeSingle();

        if (
          fallbackTeacherError
        ) {
          console.error(
            "RETRY FALLBACK TEACHER ERROR:",
            fallbackTeacherError.message
          );
        }

        if (
          fallbackTeacher?.name
        ) {
          teacherName =
            fallbackTeacher.name;
        }
      }
    }

    /*
     * ==========================================
     * 과정명
     * ==========================================
     */
    let courseName =
      "English Class";

    if (
      enrollment.course_id
    ) {
      const {
        data: course,
        error: courseError,
      } =
        await admin
          .from(
            "courses"
          )
          .select(
            "name"
          )
          .eq(
            "id",
            enrollment.course_id
          )
          .maybeSingle();

      if (courseError) {
        console.error(
          "RETRY COURSE ERROR:",
          courseError.message
        );
      }

      if (
        course?.name
      ) {
        courseName =
          course.name;
      }
    }

    /*
     * ==========================================
     * Storage에서 원본 음성 다운로드
     * ==========================================
     */
    const {
      data: audioBlob,
      error: downloadError,
    } =
      await admin.storage
        .from(
          AUDIO_BUCKET
        )
        .download(
          storagePath
        );

    if (
      downloadError ||
      !audioBlob
    ) {
      throw new Error(
        `저장된 수업 음성 다운로드 실패: ${
          downloadError
            ?.message ||
          "파일을 찾을 수 없습니다."
        }`
      );
    }

    const filename =
      (
        typeof existingJob
          .audio_filename ===
          "string" &&
        existingJob
          .audio_filename
          .trim()
      )
        ? existingJob
            .audio_filename
            .trim()
        : extensionFromPath(
            storagePath
          );

    const mimeType =
      (
        typeof existingJob
          .audio_mime_type ===
          "string" &&
        existingJob
          .audio_mime_type
          .trim()
      )
        ? existingJob
            .audio_mime_type
            .trim()
        : (
            audioBlob.type ||
            "application/octet-stream"
          );

    const audio =
      new File(
        [
          await audioBlob
            .arrayBuffer(),
        ],
        filename,
        {
          type:
            mimeType,
        }
      );

    if (
      audio.size <= 0
    ) {
      throw new Error(
        "Storage에서 불러온 원본 음성 파일이 비어 있습니다."
      );
    }

    /*
     * ==========================================
     * Job → transcribing
     * ==========================================
     */
    const now =
      new Date().toISOString();

    const nextAttemptCount =
      (
        existingJob
          .attempt_count ??
        0
      ) + 1;

    const {
      error:
        startJobError,
    } =
      await admin
        .from(
          "ai_processing_jobs"
        )
        .update({
          status:
            "transcribing",

          attempt_count:
            nextAttemptCount,

          transcription_started_at:
            now,

          transcription_completed_at:
            null,

          analysis_started_at:
            null,

          analysis_completed_at:
            null,

          completed_at:
            null,

          failed_at:
            null,

          last_error:
            null,

          updated_at:
            now,
        })
        .eq(
          "class_session_id",
          session.id
        );

    if (
      startJobError
    ) {
      throw new Error(
        `AI 재처리 시작 상태 저장 실패: ${startJobError.message}`
      );
    }

    /*
     * ==========================================
     * STEP 1
     * Storage Audio → 전사 / 화자분리
     * ==========================================
     */
    const transcription =
      await transcribeClassAudio(
        audio
      );

    const transcript =
      transcription.transcript
        .trim();

    if (
      transcript.length < 20
    ) {
      throw new Error(
        "전사된 수업 내용이 너무 짧아 AI 분석을 진행할 수 없습니다."
      );
    }

    /*
     * ==========================================
     * Job → analyzing
     * ==========================================
     */
    const transcriptionCompletedAt =
      new Date().toISOString();

    const {
      error:
        transcriptionJobError,
    } =
      await admin
        .from(
          "ai_processing_jobs"
        )
        .update({
          status:
            "analyzing",

          transcription_completed_at:
            transcriptionCompletedAt,

          analysis_started_at:
            transcriptionCompletedAt,

          updated_at:
            transcriptionCompletedAt,
        })
        .eq(
          "class_session_id",
          session.id
        );

    if (
      transcriptionJobError
    ) {
      throw new Error(
        `전사 완료 상태 저장 실패: ${transcriptionJobError.message}`
      );
    }

    /*
     * ==========================================
     * Report → analyzing
     *
     * transcript에는 원본 Teacher/Student
     * 전사문을 그대로 보존합니다.
     *
     * class-analysis.ts 내부에서
     * 분석용 cleanup이 실행됩니다.
     * ==========================================
     */
    const {
      error:
        analyzingReportError,
    } =
      await admin
        .from(
          "ai_class_reports"
        )
        .upsert(
          {
            class_session_id:
              session.id,

            student_user_id:
              enrollment.student_user_id,

            child_id:
              enrollment.child_id,

            teacher_user_id:
              enrollment.teacher_user_id,

            status:
              "analyzing",

            transcript,

            updated_at:
              transcriptionCompletedAt,
          },
          {
            onConflict:
              "class_session_id",
          }
        );

    if (
      analyzingReportError
    ) {
      throw new Error(
        `AI 분석 상태 저장 실패: ${analyzingReportError.message}`
      );
    }

    /*
     * ==========================================
     * STEP 2
     * TALKLY AI 분석
     * ==========================================
     */
    let analysis:
      AiAnalysis;

    try {
      analysis =
        await analyzeClassTranscript(
          transcript,
          {
            courseName,

            lessonNumber:
              session.lesson_number,

            studentName,

            teacherName,
          }
        );
    } catch (error) {
      await markReportFailed(
        admin,
        session.id
      );

      throw error;
    }

    /*
     * ==========================================
     * STEP 3
     * 최종 AI Report 저장
     * ==========================================
     */
    const analyzedAt =
      new Date().toISOString();

    const {
      data: savedReport,
      error: saveError,
    } =
      await admin
        .from(
          "ai_class_reports"
        )
        .upsert(
          {
            class_session_id:
              session.id,

            student_user_id:
              enrollment.student_user_id,

            child_id:
              enrollment.child_id,

            teacher_user_id:
              enrollment.teacher_user_id,

            status:
              "completed",

            transcript,

            summary:
              analysis.summary,

            strengths:
              analysis.strengths,

            improvements:
              analysis.improvements,

            grammar_analysis:
              analysis.grammar_analysis,

            vocabulary_analysis:
              analysis.vocabulary_analysis,

            pronunciation_analysis:
              analysis.pronunciation_analysis,

            fluency_analysis:
              analysis.fluency_analysis,

            recommended_practice:
              analysis.recommended_practice,

            student_summary:
              analysis.student_summary,

            parent_summary:
              analysis.parent_summary,

            ai_model:
              "gpt-5-mini",

            analyzed_at:
              analyzedAt,

            updated_at:
              analyzedAt,
          },
          {
            onConflict:
              "class_session_id",
          }
        )
        .select(`
          id,
          class_session_id,
          status,
          transcript,
          summary,
          strengths,
          improvements,
          grammar_analysis,
          vocabulary_analysis,
          pronunciation_analysis,
          fluency_analysis,
          recommended_practice,
          student_summary,
          parent_summary,
          ai_model,
          analyzed_at
        `)
        .single();

    if (saveError) {
      await markReportFailed(
        admin,
        session.id
      );

      throw new Error(
        `AI 리포트 저장 실패: ${saveError.message}`
      );
    }

    /*
     * ==========================================
     * STEP 4
     * Processing Job → completed
     * ==========================================
     */
    const completedAt =
      new Date().toISOString();

    const {
      data:
        completedJob,
      error:
        completedJobError,
    } =
      await admin
        .from(
          "ai_processing_jobs"
        )
        .update({
          status:
            "completed",

          analysis_completed_at:
            completedAt,

          completed_at:
            completedAt,

          failed_at:
            null,

          last_error:
            null,

          updated_at:
            completedAt,
        })
        .eq(
          "class_session_id",
          session.id
        )
        .select(`
          id,
          class_session_id,
          source_type,
          status,
          attempt_count,
          audio_filename,
          audio_mime_type,
          audio_size_bytes,
          audio_storage_path,
          transcription_started_at,
          transcription_completed_at,
          analysis_started_at,
          analysis_completed_at,
          completed_at,
          failed_at,
          last_error,
          created_at,
          updated_at
        `)
        .single();

    if (
      completedJobError
    ) {
      throw new Error(
        `AI 재처리 완료 상태 저장 실패: ${completedJobError.message}`
      );
    }

    return NextResponse.json({
      success: true,

      message:
        "저장된 원본 음성을 이용한 AI 수업 재처리가 완료되었습니다.",

      session: {
        id:
          session.id,

        lessonNumber:
          session.lesson_number,

        studentName,

        teacherName,

        courseName,
      },

      storage: {
        bucket:
          AUDIO_BUCKET,

        path:
          storagePath,

        reused:
          true,
      },

      processingJob:
        completedJob,

      transcription: {
        text:
          transcription.text,

        transcript:
          transcription.transcript,

        studentTranscript:
          transcription.studentTranscript,

        duration:
          transcription.duration,

        roleMapping:
          transcription.roleMapping,

        segments:
          transcription.segments,
      },

      report:
        savedReport,
    });
  } catch (error) {
    console.error(
      "RETRY CLASS AUDIO ERROR:",
      error
    );

    if (
      admin &&
      processingSessionId
    ) {
      await markJobFailed(
        admin,
        processingSessionId,
        error
      );
    }

    return NextResponse.json(
      {
        success: false,

        error:
          getErrorMessage(
            error
          ),
      },
      {
        status: 500,
      }
    );
  }
}