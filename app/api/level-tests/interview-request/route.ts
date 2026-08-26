import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type RequestBody = {
  levelTestId: number;
  childId?: number | null;

  contactPhone: string;
  studentPersonality: string;

  preferredTeacherNationality:
    | "philippines"
    | "south_africa"
    | "north_america";

  programType:
    | "general"
    | "intensive";

  intensiveType?:
    | ""
    | "debate"
    | "english_test"
    | "interview"
    | "other";

  intensiveDetail?: string;

  lessonsPerWeek: number;

  preferredDays: string[];

  lessonDurationMinutes:
    | 25
    | 50;

  preferredTime: string;
};

const ALLOWED_NATIONALITIES = [
  "philippines",
  "south_africa",
  "north_america",
] as const;

const ALLOWED_PROGRAM_TYPES = [
  "general",
  "intensive",
] as const;

const ALLOWED_INTENSIVE_TYPES = [
  "debate",
  "english_test",
  "interview",
  "other",
] as const;

const ALLOWED_DAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

/*
 * =========================================================
 * 시간 형식 검사
 * =========================================================
 */

function isValidTimeFormat(
  value: string
) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(
    value
  );
}

/*
 * =========================================================
 * TALKLY 수업시간 규칙 검사
 *
 * 25분 수업
 * 오전 06:00 ~ 오후 11:30
 * 30분 단위
 *
 * 50분 수업
 * 오전 06:00 ~ 오후 11:00
 * 1시간 단위
 *
 * 사용자가 말한 "밤 12시"는
 * 수업 가능 운영시간의 종료 시각이며,
 * 실제 마지막 시작시간은 위와 같습니다.
 * =========================================================
 */

function isValidClassTime(
  time: string,
  duration: 25 | 50
) {
  if (!isValidTimeFormat(time)) {
    return false;
  }

  const [hourText, minuteText] =
    time.split(":");

  const hour =
    Number(hourText);

  const minute =
    Number(minuteText);

  if (
    hour < 6 ||
    hour > 23
  ) {
    return false;
  }

  if (duration === 25) {
    return (
      minute === 0 ||
      minute === 30
    );
  }

  return minute === 0;
}

/*
 * =========================================================
 * POST
 * 화상레벨테스트 신청 + 희망 정규수업 계획 저장
 * =========================================================
 */

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    /*
     * -----------------------------------------------------
     * 1. 로그인 확인
     * -----------------------------------------------------
     */

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
          error:
            "로그인이 필요합니다.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 2. 사용자 프로필 확인
     *
     * 현재 이 신청 화면은 학부모 흐름을 기준으로
     * 만들어져 있으므로 parent 계정만 허용합니다.
     * -----------------------------------------------------
     */

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(`
        id,
        role,
        name,
        phone
      `)
      .eq("id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile
    ) {
      return NextResponse.json(
        {
          error:
            "사용자 정보를 확인할 수 없습니다.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      profile.role !== "parent"
    ) {
      return NextResponse.json(
        {
          error:
            "학부모 계정에서만 신청할 수 있습니다.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 3. 요청 데이터 읽기
     * -----------------------------------------------------
     */

    let body: RequestBody;

    try {
      body =
        (await request.json()) as RequestBody;
    } catch {
      return NextResponse.json(
        {
          error:
            "신청 정보를 확인할 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const levelTestId =
      Number(
        body.levelTestId
      );

    const requestedChildId =
      body.childId === null ||
      body.childId === undefined ||
      body.childId === ("" as never)
        ? null
        : Number(body.childId);

    const contactPhone =
      typeof body.contactPhone ===
      "string"
        ? body.contactPhone.trim()
        : "";

    const studentPersonality =
      typeof body.studentPersonality ===
      "string"
        ? body.studentPersonality.trim()
        : "";

    const preferredTeacherNationality =
      body.preferredTeacherNationality;

    const programType =
      body.programType;

    const intensiveType =
      typeof body.intensiveType ===
      "string"
        ? body.intensiveType.trim()
        : "";

    const intensiveDetail =
      typeof body.intensiveDetail ===
      "string"
        ? body.intensiveDetail.trim()
        : "";

    const lessonsPerWeek =
      Number(
        body.lessonsPerWeek
      );

    const preferredDays =
      Array.isArray(
        body.preferredDays
      )
        ? body.preferredDays.filter(
            (
              value
            ): value is string =>
              typeof value ===
              "string"
          )
        : [];

    const lessonDurationMinutes =
      Number(
        body.lessonDurationMinutes
      );

    const preferredTime =
      typeof body.preferredTime ===
      "string"
        ? body.preferredTime.trim()
        : "";

    /*
     * -----------------------------------------------------
     * 4. 기본 데이터 검증
     * -----------------------------------------------------
     */

    if (
      !Number.isInteger(
        levelTestId
      ) ||
      levelTestId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "레벨테스트 정보를 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      requestedChildId !==
        null &&
      (
        !Number.isInteger(
          requestedChildId
        ) ||
        requestedChildId <= 0
      )
    ) {
      return NextResponse.json(
        {
          error:
            "학생 정보를 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (!contactPhone) {
      return NextResponse.json(
        {
          error:
            "연락처를 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !studentPersonality
    ) {
      return NextResponse.json(
        {
          error:
            "수강학생의 성향을 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !ALLOWED_NATIONALITIES.includes(
        preferredTeacherNationality
      )
    ) {
      return NextResponse.json(
        {
          error:
            "희망 원어민 강사 국적을 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !ALLOWED_PROGRAM_TYPES.includes(
        programType
      )
    ) {
      return NextResponse.json(
        {
          error:
            "수업과정을 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 5. 단기집중과정 검증
     * -----------------------------------------------------
     */

    if (
      programType ===
      "intensive"
    ) {
      if (
        !ALLOWED_INTENSIVE_TYPES.includes(
          intensiveType as
            | "debate"
            | "english_test"
            | "interview"
            | "other"
        )
      ) {
        return NextResponse.json(
          {
            error:
              "단기집중과정의 목적을 선택해주세요.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        intensiveType ===
          "other" &&
        !intensiveDetail
      ) {
        return NextResponse.json(
          {
            error:
              "기타 단기집중과정의 세부 내용을 입력해주세요.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * -----------------------------------------------------
     * 6. 주당 횟수 검증
     * -----------------------------------------------------
     */

    if (
      ![2, 3, 4, 5].includes(
        lessonsPerWeek
      )
    ) {
      return NextResponse.json(
        {
          error:
            "주당 수업 횟수는 2회에서 5회 사이여야 합니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 7. 희망 요일 검증
     * -----------------------------------------------------
     */

    const uniqueDays =
      Array.from(
        new Set(
          preferredDays
        )
      );

    if (
      uniqueDays.length !==
      lessonsPerWeek
    ) {
      return NextResponse.json(
        {
          error:
            `주 ${lessonsPerWeek}회 수업에 맞춰 정확히 ${lessonsPerWeek}개의 수업요일을 선택해주세요.`,
        },
        {
          status: 400,
        }
      );
    }

    const hasInvalidDay =
      uniqueDays.some(
        (day) =>
          !ALLOWED_DAYS.includes(
            day as
              | "mon"
              | "tue"
              | "wed"
              | "thu"
              | "fri"
              | "sat"
              | "sun"
          )
      );

    if (hasInvalidDay) {
      return NextResponse.json(
        {
          error:
            "희망 수업요일 정보를 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 8. 회당 수업시간 검증
     * -----------------------------------------------------
     */

    if (
      lessonDurationMinutes !==
        25 &&
      lessonDurationMinutes !==
        50
    ) {
      return NextResponse.json(
        {
          error:
            "회당 수업시간은 25분 또는 50분이어야 합니다.",
        },
        {
          status: 400,
        }
      );
    }

    const validatedDuration =
      lessonDurationMinutes as
        | 25
        | 50;

    if (
      !isValidClassTime(
        preferredTime,
        validatedDuration
      )
    ) {
      return NextResponse.json(
        {
          error:
            validatedDuration ===
            25
              ? "25분 수업은 오전 6시부터 밤 12시 사이에서 30분 단위로 선택해주세요."
              : "50분 수업은 오전 6시부터 밤 12시 사이에서 1시간 단위로 선택해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 9. 레벨테스트 조회
     *
     * 반드시 현재 로그인한 학부모 본인의
     * 레벨테스트여야 합니다.
     * -----------------------------------------------------
     */

    const {
      data: levelTest,
      error: levelTestError,
    } = await supabase
      .from("level_tests")
      .select(`
        id,
        parent_user_id,
        student_user_id,
        child_id,
        student_name,
        grade,
        status,
        ai_status,
        ai_suggested_level,
        final_level,
        interview_required,
        interview_status
      `)
      .eq(
        "id",
        levelTestId
      )
      .eq(
        "parent_user_id",
        user.id
      )
      .maybeSingle();

    if (
      levelTestError ||
      !levelTest
    ) {
      return NextResponse.json(
        {
          error:
            "레벨테스트 정보를 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 10. 자녀 정보 일치 확인
     *
     * URL/클라이언트에서 childId를 임의 변경해도
     * 다른 자녀 또는 다른 학부모의 자녀를
     * 신청할 수 없도록 서버에서 다시 검증합니다.
     * -----------------------------------------------------
     */

    const actualChildId =
      levelTest.child_id ??
      requestedChildId;

    if (
      levelTest.child_id !==
        null &&
      requestedChildId !==
        null &&
      Number(
        levelTest.child_id
      ) !==
        requestedChildId
    ) {
      return NextResponse.json(
        {
          error:
            "레벨테스트의 학생 정보와 신청 학생 정보가 일치하지 않습니다.",
        },
        {
          status: 400,
        }
      );
    }

    let child:
      | {
          id: number;
          name: string;
          grade:
            | string
            | null;
        }
      | null = null;

    if (
      actualChildId !==
      null
    ) {
      const {
        data: childData,
        error: childError,
      } = await supabase
        .from("children")
        .select(`
          id,
          name,
          grade
        `)
        .eq(
          "id",
          actualChildId
        )
        .eq(
          "parent_user_id",
          user.id
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();

      if (
        childError ||
        !childData
      ) {
        return NextResponse.json(
          {
            error:
              "등록된 학생 정보를 확인할 수 없습니다.",
          },
          {
            status: 404,
          }
        );
      }

      child = childData;
    }

    /*
     * -----------------------------------------------------
     * 11. 온라인 레벨테스트 완료 여부 확인
     *
     * level_test_attempts에서 실제 완료된 응시 기록을
     * 확인합니다.
     *
     * 화면의 status 문자열만 믿지 않고
     * 실제 completed attempt가 존재하는지 확인합니다.
     * -----------------------------------------------------
     */

    const {
      data: completedAttempt,
      error:
        completedAttemptError,
    } = await supabase
      .from(
        "level_test_attempts"
      )
      .select(`
        id,
        status,
        completed_at,
        suggested_level
      `)
      .eq(
        "level_test_id",
        levelTestId
      )
      .eq(
        "status",
        "completed"
      )
      .not(
        "completed_at",
        "is",
        null
      )
      .order(
        "completed_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (
      completedAttemptError
    ) {
      return NextResponse.json(
        {
          error:
            `온라인 레벨테스트 완료 여부를 확인하지 못했습니다: ${completedAttemptError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    if (!completedAttempt) {
      return NextResponse.json(
        {
          error:
            "온라인 레벨테스트를 완료한 후 화상레벨테스트를 신청할 수 있습니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 12. 학생 이름 / 학년 확정
     *
     * 자녀 테이블이 있으면 children을 우선 사용하고,
     * 그렇지 않은 경우 level_tests의 스냅샷 정보를
     * 사용합니다.
     * -----------------------------------------------------
     */

    const studentName =
      child?.name?.trim() ||
      levelTest.student_name?.trim() ||
      "";

    const studentGrade =
      child?.grade?.trim() ||
      levelTest.grade?.trim() ||
      null;

    if (!studentName) {
      return NextResponse.json(
        {
          error:
            "학생 이름을 확인할 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 13. 기존 희망 수업계획 확인
     *
     * level_test_id 기준으로 가장 최근 행을 확인합니다.
     *
     * 이미 신청한 경우 새 행을 계속 만들지 않고
     * 기존 신청 내용을 수정하도록 처리합니다.
     * -----------------------------------------------------
     */

    const {
      data:
        existingPreference,
      error:
        existingPreferenceError,
    } = await supabase
      .from(
        "level_test_class_preferences"
      )
      .select(`
        id,
        applicant_user_id,
        status
      `)
      .eq(
        "level_test_id",
        levelTestId
      )
      .eq(
        "applicant_user_id",
        user.id
      )
      .order(
        "id",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (
      existingPreferenceError
    ) {
      return NextResponse.json(
        {
          error:
            `기존 신청정보 확인에 실패했습니다: ${existingPreferenceError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 14. 저장할 데이터 구성
     *
     * 일반과정이면 intensive 관련 컬럼은 null 처리합니다.
     *
     * 단기집중과정에서도 other가 아니면
     * intensive_detail은 null로 저장합니다.
     * -----------------------------------------------------
     */

    const now =
      new Date().toISOString();

    const preferenceData = {
      level_test_id:
        levelTestId,

      applicant_user_id:
        user.id,

      child_id:
        actualChildId,

      student_user_id:
        levelTest.student_user_id ??
        null,

      student_name:
        studentName,

      grade:
        studentGrade,

      contact_phone:
        contactPhone,

      student_personality:
        studentPersonality,

      preferred_teacher_nationality:
        preferredTeacherNationality,

      program_type:
        programType,

      intensive_type:
        programType ===
        "intensive"
          ? intensiveType
          : null,

      intensive_detail:
        programType ===
          "intensive" &&
        intensiveType ===
          "other"
          ? intensiveDetail
          : null,

      lessons_per_week:
        lessonsPerWeek,

      preferred_days:
        uniqueDays,

      lesson_duration_minutes:
        validatedDuration,

      preferred_time:
        preferredTime,

      updated_at:
        now,
    };

    /*
     * -----------------------------------------------------
     * 15. 희망 수업계획 INSERT / UPDATE
     * -----------------------------------------------------
     */

    let preferenceId:
      | number
      | null = null;

    if (
      existingPreference
    ) {
      const {
        data: updated,
        error: updateError,
      } = await supabase
        .from(
          "level_test_class_preferences"
        )
        .update({
          ...preferenceData,

          /*
           * 신청자가 내용을 다시 수정한 경우
           * 관리자 검토 전 상태로 되돌립니다.
           */
          status:
            "submitted",
        })
        .eq(
          "id",
          existingPreference.id
        )
        .eq(
          "applicant_user_id",
          user.id
        )
        .select("id")
        .single();

      if (
        updateError ||
        !updated
      ) {
        return NextResponse.json(
          {
            error:
              updateError?.message ||
              "화상레벨테스트 신청정보 수정에 실패했습니다.",
          },
          {
            status: 400,
          }
        );
      }

      preferenceId =
        updated.id;
    } else {
      const {
        data: inserted,
        error: insertError,
      } = await supabase
        .from(
          "level_test_class_preferences"
        )
        .insert({
          ...preferenceData,

          status:
            "submitted",

          admin_note:
            null,
        })
        .select("id")
        .single();

      if (
        insertError ||
        !inserted
      ) {
        return NextResponse.json(
          {
            error:
              insertError?.message ||
              "화상레벨테스트 신청정보 저장에 실패했습니다.",
          },
          {
            status: 400,
          }
        );
      }

      preferenceId =
        inserted.id;
    }

    /*
     * -----------------------------------------------------
     * 16. level_tests 상태 업데이트
     *
     * 아직 인터뷰 일정은 확정되지 않았습니다.
     *
     * 따라서:
     *
     * interview_required = true
     * interview_status   = requested
     *
     * 만 기록합니다.
     *
     * level_test_interviews 행은 여기서 만들지 않습니다.
     * 관리자 확인 → 상담 → 일정/강사 확정 단계에서
     * 생성합니다.
     * -----------------------------------------------------
     */

    const {
      error:
        levelTestUpdateError,
    } = await supabase
      .from("level_tests")
      .update({
        interview_required:
          true,

        interview_status:
          "requested",

        updated_at:
          now,
      })
      .eq(
        "id",
        levelTestId
      )
      .eq(
        "parent_user_id",
        user.id
      );

    if (
      levelTestUpdateError
    ) {
      /*
       * 두 테이블을 하나의 DB transaction으로
       * 묶는 RPC를 아직 사용하지 않기 때문에
       * 여기서 상태 업데이트가 실패하면
       * 방금 저장한 preference를 가능한 범위에서
       * 원상 복구합니다.
       *
       * 신규 신청이었다면 삭제합니다.
       *
       * 기존 신청 수정이었다면 이전 전체 값을
       * 가지고 있지 않으므로 삭제하지 않습니다.
       * 대신 서버 오류를 반환합니다.
       */

      if (
        !existingPreference &&
        preferenceId
      ) {
        await supabase
          .from(
            "level_test_class_preferences"
          )
          .delete()
          .eq(
            "id",
            preferenceId
          )
          .eq(
            "applicant_user_id",
            user.id
          );
      }

      return NextResponse.json(
        {
          error:
            `화상레벨테스트 상태 변경에 실패했습니다: ${levelTestUpdateError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 17. 성공
     * -----------------------------------------------------
     */

    return NextResponse.json(
      {
        success: true,

        preferenceId,

        levelTestId,

        interviewStatus:
          "requested",

        updated:
          Boolean(
            existingPreference
          ),

        message:
          existingPreference
            ? "화상레벨테스트 신청 내용이 수정되었습니다."
            : "화상레벨테스트 신청이 완료되었습니다.",
      },
      {
        status:
          existingPreference
            ? 200
            : 201,
      }
    );
  } catch (error) {
    console.error(
      "LEVEL TEST INTERVIEW REQUEST ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "화상레벨테스트 신청 처리 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}