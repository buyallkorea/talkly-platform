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

/*
 * ==========================================
 * Storage
 * ==========================================
 */
const AUDIO_BUCKET =
  "ai-class-audio";

/*
 * ==========================================
 * Supabase Service Role Client
 * ==========================================
 */
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

/*
 * ==========================================
 * Error → 문자열
 * ==========================================
 */
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

/*
 * ==========================================
 * Storage용 안전한 파일명
 * ==========================================
 */
function sanitizeFilename(
  filename: string
) {
  const trimmed =
    filename.trim();

  if (!trimmed) {
    return "class-audio";
  }

  return trimmed
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    )
    .replace(
      /_+/g,
      "_"
    );
}

/*
 * ==========================================
 * AI Processing Job 실패 처리
 * ==========================================
 */
async function markJobFailed(
  admin: ReturnType<
    typeof createAdmin
  >,
  sessionId: number,
  error: unknown
) {
  const now =
    new Date().toISOString();

  const message =
    getErrorMessage(
      error
    );

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
          message,

        updated_at:
          now,
      })
      .eq(
        "class_session_id",
        sessionId
      );

  if (updateError) {
    console.error(
      "AI PROCESSING JOB FAILED UPDATE ERROR:",
      updateError.message
    );
  }
}

/*
 * ==========================================
 * AI Report 실패 처리
 * ==========================================
 */
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
      "AI REPORT FAILED UPDATE ERROR:",
      error.message
    );
  }
}

/*
 * ==========================================
 * POST
 *
 * manual audio upload
 *
 * ↓
 *
 * Private Storage
 * ai-class-audio
 *
 * ↓
 *
 * ai_processing_jobs
 *
 * ↓
 *
 * transcribing
 *
 * ↓
 *
 * Teacher / Student transcription
 *
 * ↓
 *
 * analyzing
 *
 * ↓
 *
 * AI analysis
 *
 * ↓
 *
 * ai_class_reports
 *
 * ↓
 *
 * completed
 *
 *
 * 향후 Zoom Cloud Recording도
 * 동일한 Storage 및 처리 엔진을 사용합니다.
 * ==========================================
 */
export async function POST(
  request: Request
) {
  /*
   * catch에서도 사용할 수 있도록
   * 바깥 scope에 둡니다.
   */
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
     *
     * 현재는 수동 테스트용.
     * 향후 Zoom Webhook은 별도 인증.
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
     * multipart/form-data
     * ==========================================
     */
    const formData =
      await request.formData();

    const sessionId =
      Number(
        formData.get(
          "sessionId"
        )
      );

    const audio =
      formData.get(
        "audio"
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

    if (
      !(audio instanceof File)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "오디오 파일이 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      audio.size <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "오디오 파일이 비어 있습니다.",
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
     * 수강정보 조회
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
          "PROCESS AUDIO CHILD ERROR:",
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
          "PROCESS AUDIO STUDENT PROFILE ERROR:",
          studentProfileError.message
        );
      }

      if (
        studentProfile
          ?.name
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
          "PROCESS AUDIO TEACHER PROFILE ERROR:",
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
            "PROCESS AUDIO FALLBACK TEACHER ERROR:",
            fallbackTeacherError.message
          );
        }

        if (
          fallbackTeacher
            ?.name
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
          "PROCESS AUDIO COURSE ERROR:",
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
     * 기존 Job 조회
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
          status,
          attempt_count,
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

    /*
     * ==========================================
     * 이미 처리 중인 작업 방지
     * ==========================================
     */
    if (
      existingJob?.status ===
        "transcribing" ||
      existingJob?.status ===
        "analyzing"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "이 수업의 AI 분석이 이미 진행 중입니다.",

          job: {
            id:
              existingJob.id,

            status:
              existingJob.status,

            attemptCount:
              existingJob.attempt_count,
          },
        },
        {
          status: 409,
        }
      );
    }

    const now =
      new Date().toISOString();

    const nextAttemptCount =
      (
        existingJob
          ?.attempt_count ??
        0
      ) + 1;

    /*
     * ==========================================
     * STEP 0
     *
     * 원본 오디오를 Private Storage에 저장
     *
     * 예:
     * sessions/27/
     * 1755590000000-class.wav
     * ==========================================
     */
    const safeFilename =
      sanitizeFilename(
        audio.name
      );

    const storagePath =
      `sessions/${session.id}/${Date.now()}-${safeFilename}`;

    const audioBuffer =
      await audio.arrayBuffer();

    const {
      error: uploadError,
    } =
      await admin.storage
        .from(
          AUDIO_BUCKET
        )
        .upload(
          storagePath,
          audioBuffer,
          {
            contentType:
              audio.type ||
              "application/octet-stream",

            upsert: false,
          }
        );

    if (uploadError) {
      throw new Error(
        `수업 음성 Storage 저장 실패: ${uploadError.message}`
      );
    }

    /*
     * ==========================================
     * AI Processing Job 시작
     *
     * Storage 경로까지 DB에 기록
     * ==========================================
     */
    const {
      data:
        processingJob,
      error:
        processingJobError,
    } =
      await admin
        .from(
          "ai_processing_jobs"
        )
        .upsert(
          {
            class_session_id:
              session.id,

            source_type:
              "manual_upload",

            status:
              "transcribing",

            attempt_count:
              nextAttemptCount,

            audio_filename:
              audio.name,

            audio_mime_type:
              audio.type ||
              null,

            audio_size_bytes:
              audio.size,

            audio_storage_path:
              storagePath,

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
          },
          {
            onConflict:
              "class_session_id",
          }
        )
        .select(`
          id,
          class_session_id,
          source_type,
          status,
          attempt_count,
          audio_storage_path
        `)
        .single();

    if (
      processingJobError
    ) {
      /*
       * Storage에는 업로드됐지만
       * DB Job 생성에 실패한 경우
       * 고아 파일이 남지 않도록 제거합니다.
       */
      const {
        error: cleanupError,
      } =
        await admin.storage
          .from(
            AUDIO_BUCKET
          )
          .remove([
            storagePath,
          ]);

      if (cleanupError) {
        console.error(
          "AUDIO STORAGE CLEANUP ERROR:",
          cleanupError.message
        );
      }

      throw new Error(
        `AI 처리 작업 생성 실패: ${processingJobError.message}`
      );
    }

    /*
     * ==========================================
     * STEP 1
     *
     * 음성 → 전사
     * → Speaker diarization
     * → Teacher / Student
     *
     * 현재 업로드된 File 객체를 그대로
     * 사용하므로 기존 정상 전사 로직 유지.
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
     * 전사 완료
     *
     * transcribing
     * ↓
     * analyzing
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
     * ai_class_reports
     *
     * 분석 시작 상태 저장
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
     *
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
     *
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
     *
     * Processing Job 완료
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
        `AI 처리 완료 상태 저장 실패: ${completedJobError.message}`
      );
    }

    /*
     * ==========================================
     * 최종 성공
     * ==========================================
     */
    return NextResponse.json({
      success: true,

      message:
        "수업 음성 저장, 전사 및 AI 분석이 모두 완료되었습니다.",

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
      "PROCESS CLASS AUDIO ERROR:",
      error
    );

    /*
     * ==========================================
     * Storage 업로드 및 Job 생성 이후
     * 전사/분석에 실패해도 음성은 삭제하지 않음.
     *
     * 저장된 원본이 향후 retry에 사용됩니다.
     * ==========================================
     */
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