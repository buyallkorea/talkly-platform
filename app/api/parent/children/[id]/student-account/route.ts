import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type RequestBody = {
  email: string;
  password: string;
};

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const { id } = await context.params;

  const childId = Number(id);

  if (
    !Number.isInteger(childId) ||
    childId <= 0
  ) {
    return NextResponse.json(
      {
        error: "자녀 ID가 올바르지 않습니다.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * 1. 현재 로그인한 사용자 확인
   * -------------------------------------------------------
   */
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      {
        error: "로그인이 필요합니다.",
      },
      {
        status: 401,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * 2. 학부모 계정인지 확인
   * -------------------------------------------------------
   */
  const {
    data: parentProfile,
    error: parentProfileError,
  } = await supabase
    .from("profiles")
    .select(`
      id,
      role,
      name
    `)
    .eq("id", user.id)
    .maybeSingle();

  if (parentProfileError) {
    return NextResponse.json(
      {
        error: `학부모 정보 확인 실패: ${parentProfileError.message}`,
      },
      {
        status: 400,
      }
    );
  }

  if (
    !parentProfile ||
    parentProfile.role !== "parent"
  ) {
    return NextResponse.json(
      {
        error: "학부모 계정에서만 학생 계정을 만들 수 있습니다.",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * 3. 자신의 자녀인지 확인
   * -------------------------------------------------------
   */
  const {
    data: child,
    error: childError,
  } = await supabase
    .from("children")
    .select(`
      id,
      name,
      school_name,
      grade,
      learning_goal,
      parent_user_id,
      student_user_id,
      is_active
    `)
    .eq("id", childId)
    .eq("parent_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (
    childError ||
    !child
  ) {
    return NextResponse.json(
      {
        error:
          childError?.message ||
          "자녀 정보를 확인할 수 없습니다.",
      },
      {
        status: 404,
      }
    );
  }

  if (child.student_user_id) {
    return NextResponse.json(
      {
        error: "이미 학생 로그인 계정이 연결되어 있습니다.",
      },
      {
        status: 409,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * 4. 입력값 확인
   * -------------------------------------------------------
   */
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      {
        error: "학생 계정 정보를 읽을 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const email =
    body.email?.trim().toLowerCase();

  const password =
    body.password ?? "";

  if (!email) {
    return NextResponse.json(
      {
        error: "학생 로그인 이메일을 입력해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    return NextResponse.json(
      {
        error: "학생 로그인 이메일 형식이 올바르지 않습니다.",
      },
      {
        status: 400,
      }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      {
        error: "비밀번호는 8자 이상으로 설정해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * 5. 관리자 클라이언트 생성
   * -------------------------------------------------------
   */
  let admin:
    ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch (error) {
    console.error(
      "[Student Account] Admin client error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Supabase 관리자 클라이언트를 생성할 수 없습니다.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * 6. Auth 학생 계정 생성
   * -------------------------------------------------------
   */
  let studentUserId: string | null = null;

  try {
    const {
      data: createdUser,
      error: createUserError,
    } =
      await admin.auth.admin.createUser({
        email,
        password,

        /*
         * 현재 개발 단계에서는
         * 학부모가 생성한 학생계정을 즉시 사용 가능하게 합니다.
         */
        email_confirm: true,

        user_metadata: {
          name: child.name,
          role: "student",
          child_id: child.id,
        },
      });

    if (
      createUserError ||
      !createdUser.user
    ) {
      return NextResponse.json(
        {
          error:
            createUserError?.message ||
            "학생 로그인 계정 생성에 실패했습니다.",
        },
        {
          status: 400,
        }
      );
    }

    studentUserId =
      createdUser.user.id;

    /*
     * -----------------------------------------------------
     * 7. profiles 생성
     *
     * TALKLY 전체 사용자 역할 관리용
     * -----------------------------------------------------
     */
    const {
      error: profileInsertError,
    } = await admin
      .from("profiles")
      .upsert(
        {
          id: studentUserId,
          role: "student",
          name: child.name,
        },
        {
          onConflict: "id",
        }
      );

    if (profileInsertError) {
      throw new Error(
        `학생 기본 프로필 생성 실패: ${profileInsertError.message}`
      );
    }

    /*
     * -----------------------------------------------------
     * 8. student_profiles 생성
     *
     * 중요:
     * enrollments.student_user_id FK가
     * student_profiles.user_id를 참조합니다.
     *
     * 따라서 enrollments 연결보다
     * 반드시 먼저 만들어야 합니다.
     * -----------------------------------------------------
     */
    const {
      error: studentProfileError,
    } = await admin
      .from("student_profiles")
      .insert({
        user_id:
          studentUserId,

        school_name:
          child.school_name ??
          null,

        grade:
          child.grade ??
          null,

        english_level:
          null,

        learning_goal:
          child.learning_goal ??
          null,

        parent_name:
          parentProfile.name ??
          null,

        parent_phone:
          null,

        notes:
          null,
      });

    if (studentProfileError) {
      throw new Error(
        `학생 상세 프로필 생성 실패: ${studentProfileError.message}`
      );
    }

    /*
     * -----------------------------------------------------
     * 9. children.student_user_id 연결
     * -----------------------------------------------------
     */
    const {
      data: updatedChildren,
      error: childUpdateError,
    } = await admin
      .from("children")
      .update({
        student_user_id:
          studentUserId,
      })
      .eq("id", child.id)
      .is(
        "student_user_id",
        null
      )
      .select("id");

    if (childUpdateError) {
      throw new Error(
        `자녀 계정 연결 실패: ${childUpdateError.message}`
      );
    }

    if (
      !updatedChildren ||
      updatedChildren.length !== 1
    ) {
      throw new Error(
        "자녀 계정 연결 상태가 변경되어 학생 계정을 연결할 수 없습니다."
      );
    }

    /*
     * -----------------------------------------------------
     * 10. 기존 enrollments 연결
     *
     * 이제 student_profiles가 존재하므로
     * FK 오류 없이 연결됩니다.
     * -----------------------------------------------------
     */
    const {
      data: updatedEnrollments,
      error: enrollmentError,
    } = await admin
      .from("enrollments")
      .update({
        student_user_id:
          studentUserId,
      })
      .eq(
        "child_id",
        child.id
      )
      .select("id");

    if (enrollmentError) {
      throw new Error(
        `기존 수강정보 연결 실패: ${enrollmentError.message}`
      );
    }

    /*
     * -----------------------------------------------------
     * 성공
     * -----------------------------------------------------
     */
    return NextResponse.json(
      {
        success: true,

        studentUserId,

        studentName:
          child.name,

        email,

        updatedEnrollments:
          updatedEnrollments?.length ??
          0,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "[Student Account] Create/link error:",
      error
    );

    /*
     * -----------------------------------------------------
     * 실패 시 롤백
     *
     * 역순으로 제거합니다.
     * -----------------------------------------------------
     */
    if (studentUserId) {
      /*
       * enrollments 연결 복구
       */
      try {
        await admin
          .from("enrollments")
          .update({
            student_user_id:
              null,
          })
          .eq(
            "child_id",
            child.id
          )
          .eq(
            "student_user_id",
            studentUserId
          );
      } catch (rollbackError) {
        console.error(
          "[Student Account] Enrollment rollback error:",
          rollbackError
        );
      }

      /*
       * children 연결 복구
       */
      try {
        await admin
          .from("children")
          .update({
            student_user_id:
              null,
          })
          .eq(
            "id",
            child.id
          )
          .eq(
            "student_user_id",
            studentUserId
          );
      } catch (rollbackError) {
        console.error(
          "[Student Account] Child rollback error:",
          rollbackError
        );
      }

      /*
       * student_profiles 삭제
       */
      try {
        await admin
          .from("student_profiles")
          .delete()
          .eq(
            "user_id",
            studentUserId
          );
      } catch (rollbackError) {
        console.error(
          "[Student Account] Student profile rollback error:",
          rollbackError
        );
      }

      /*
       * profiles 삭제
       */
      try {
        await admin
          .from("profiles")
          .delete()
          .eq(
            "id",
            studentUserId
          );
      } catch (rollbackError) {
        console.error(
          "[Student Account] Profile rollback error:",
          rollbackError
        );
      }

      /*
       * Auth 계정 삭제
       */
      try {
        await admin.auth.admin.deleteUser(
          studentUserId
        );
      } catch (rollbackError) {
        console.error(
          "[Student Account] Auth rollback error:",
          rollbackError
        );
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "학생 계정 생성 및 연결 중 오류가 발생했습니다.",
      },
      {
        status: 400,
      }
    );
  }
}