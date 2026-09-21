import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type StudentMode =
  | "existing"
  | "direct";

type RequestBody = {
  studentMode: StudentMode;
  childId?: number | null;
  studentName: string;
  birthDate?: string | null;
  age?: number | null;
  grade: string;
  schoolName?: string | null;
  learningHistory?: string | null;
  learningGoal?: string | null;
  targetGroup: string;
};

const ALLOWED_TARGET_GROUPS = [
  "early_kids",
  "elementary",
  "secondary",
  "adult",
] as const;

function cleanOptionalText(
  value: unknown
) {
  return typeof value === "string" &&
    value.trim()
    ? value.trim()
    : null;
}

function calculateAge(
  birthDate: string
) {
  const today = new Date();
  const birth = new Date(
    `${birthDate}T00:00:00`
  );

  if (
    Number.isNaN(
      birth.getTime()
    )
  ) {
    return null;
  }

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

export async function POST(
  request: Request
) {
  try {
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
          error:
            "로그인이 필요합니다.",
        },
        {
          status: 401,
        }
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
      profile.role !== "parent" &&
      profile.role !== "student"
    ) {
      return NextResponse.json(
        {
          error:
            "수강생 또는 학부모 계정에서 신청할 수 있습니다.",
        },
        {
          status: 403,
        }
      );
    }

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

    const studentMode =
      body.studentMode;

    if (
      studentMode !== "existing" &&
      studentMode !== "direct"
    ) {
      return NextResponse.json(
        {
          error:
            "학생 신청 방식을 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    const studentName =
      typeof body.studentName ===
      "string"
        ? body.studentName.trim()
        : "";

    const grade =
      typeof body.grade ===
      "string"
        ? body.grade.trim()
        : "";

    const birthDate =
      cleanOptionalText(
        body.birthDate
      );

    const schoolName =
      cleanOptionalText(
        body.schoolName
      );

    const learningHistory =
      cleanOptionalText(
        body.learningHistory
      );

    const learningGoal =
      cleanOptionalText(
        body.learningGoal
      );

    const targetGroup =
      typeof body.targetGroup ===
      "string"
        ? body.targetGroup.trim()
        : "";

    if (!studentName) {
      return NextResponse.json(
        {
          error:
            "학생 이름을 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (!grade) {
      return NextResponse.json(
        {
          error:
            "학년을 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !ALLOWED_TARGET_GROUPS.includes(
        targetGroup as
          | "early_kids"
          | "elementary"
          | "secondary"
          | "adult"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "레벨테스트 유형을 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    let parsedAge:
      | number
      | null = null;

    if (
      body.age !== null &&
      body.age !== undefined
    ) {
      parsedAge =
        Number(body.age);
    } else if (birthDate) {
      parsedAge =
        calculateAge(
          birthDate
        );
    }

    if (
      parsedAge === null ||
      !Number.isInteger(
        parsedAge
      ) ||
      parsedAge < 3 ||
      parsedAge > 100
    ) {
      return NextResponse.json(
        {
          error:
            "학생 생년월일 또는 나이를 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    const requestedChildId =
      body.childId === null ||
      body.childId === undefined
        ? null
        : Number(body.childId);

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

    let childIdToSave:
      | number
      | null = null;

    let studentUserId:
      | string
      | null = null;

    let parentUserId =
      user.id;

    if (
      profile.role ===
      "parent"
    ) {
      if (
        studentMode ===
        "existing"
      ) {
        if (
          requestedChildId ===
          null
        ) {
          return NextResponse.json(
            {
              error:
                "등록된 자녀를 선택해주세요.",
            },
            {
              status: 400,
            }
          );
        }

        const {
          data: child,
          error: childError,
        } = await supabase
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
            requestedChildId
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
          !child
        ) {
          return NextResponse.json(
            {
              error:
                "학생 정보를 확인할 수 없습니다.",
            },
            {
              status: 404,
            }
          );
        }

        childIdToSave =
          child.id;

        studentUserId =
          child.student_user_id ||
          child.linked_student_user_id ||
          null;
      } else {
        childIdToSave = null;
        studentUserId = null;
      }
    } else {
      studentUserId =
        user.id;

      if (
        studentMode ===
        "existing"
      ) {
        if (
          requestedChildId ===
          null
        ) {
          return NextResponse.json(
            {
              error:
                "연결된 학생 정보를 확인해주세요.",
            },
            {
              status: 400,
            }
          );
        }

        const {
          data: child,
          error: childError,
        } = await supabase
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
            requestedChildId
          )
          .eq(
            "is_active",
            true
          )
          .or(
            `student_user_id.eq.${user.id},linked_student_user_id.eq.${user.id}`
          )
          .maybeSingle();

        if (
          childError ||
          !child
        ) {
          return NextResponse.json(
            {
              error:
                "연결된 학생 정보를 확인할 수 없습니다.",
            },
            {
              status: 404,
            }
          );
        }

        childIdToSave =
          child.id;

        parentUserId =
          child.parent_user_id;
      } else {
        childIdToSave = null;
        parentUserId = user.id;
      }
    }

    let existingQuery =
      supabase
        .from("level_tests")
        .select(`
          id,
          status
        `)
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
      profile.role ===
      "parent"
    ) {
      existingQuery =
        existingQuery.eq(
          "parent_user_id",
          user.id
        );
    } else {
      existingQuery =
        existingQuery.eq(
          "student_user_id",
          user.id
        );
    }

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
        existingQuery
          .is(
            "child_id",
            null
          )
          .eq(
            "student_name",
            studentName
          );
    }

    const {
      data: existingTest,
      error:
        existingTestError,
    } =
      await existingQuery.maybeSingle();

    if (
      existingTestError
    ) {
      return NextResponse.json(
        {
          error:
            `기존 레벨테스트 확인 실패: ${existingTestError.message}`,
        },
        {
          status: 400,
        }
      );
    }

    if (existingTest) {
      return NextResponse.json(
        {
          success: true,
          levelTestId:
            existingTest.id,
          existing: true,
          role: profile.role,
        },
        {
          status: 200,
        }
      );
    }

    const now =
      new Date().toISOString();

    const {
      data: createdTest,
      error: createError,
    } = await supabase
      .from("level_tests")
      .insert({
        child_id:
          childIdToSave,

        student_user_id:
          studentUserId,

        parent_user_id:
          parentUserId,

        student_name:
          studentName,

        student_birth_date:
          birthDate,

        student_age:
          parsedAge,

        school_name:
          schoolName,

        grade,

        learning_history:
          learningHistory,

        learning_goal:
          learningGoal,

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
      .single();

    if (
      createError ||
      !createdTest
    ) {
      return NextResponse.json(
        {
          error:
            createError
              ? `레벨테스트 신청 실패: ${createError.message} / code: ${createError.code}`
              : "신청은 처리되었지만 생성된 레벨테스트 정보를 확인할 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        levelTestId:
          createdTest.id,
        existing: false,
        role: profile.role,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "LEVEL TEST REQUEST ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "레벨테스트 신청 처리 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}