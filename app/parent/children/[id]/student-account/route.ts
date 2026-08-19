import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase-server";

import {
  createAdminClient,
} from "@/lib/supabase-admin";

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
  const { id } =
    await context.params;

  const childId =
    Number(id);

  if (
    !Number.isInteger(childId) ||
    childId <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "자녀 ID가 올바르지 않습니다.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * 일반 로그인 클라이언트
   *
   * 현재 로그인한 학부모가
   * 실제 이 자녀의 보호자인지 확인합니다.
   */
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
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
    !profile ||
    profile.role !== "parent"
  ) {
    return NextResponse.json(
      {
        error:
          "학부모 계정에서만 학생 계정을 만들 수 있습니다.",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * 자신의 자녀인지 확인
   */
  const {
    data: child,
    error: childError,
  } = await supabase
    .from("children")
    .select(`
      id,
      name,
      student_user_id,
      is_active
    `)
    .eq(
      "id",
      childId
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
          "자녀 정보를 확인할 수 없습니다.",
      },
      {
        status: 404,
      }
    );
  }

  if (
    child.student_user_id
  ) {
    return NextResponse.json(
      {
        error:
          "이미 학생 로그인 계정이 연결되어 있습니다.",
      },
      {
        status: 409,
      }
    );
  }

  /*
   * 입력값
   */
  let body: RequestBody;

  try {
    body =
      (await request.json()) as
        RequestBody;
  } catch {
    return NextResponse.json(
      {
        error:
          "학생 계정 정보를 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const email =
    body.email
      ?.trim()
      .toLowerCase();

  const password =
    body.password ?? "";

  if (!email) {
    return NextResponse.json(
      {
        error:
          "학생 로그인 이메일을 입력해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    password.length < 8
  ) {
    return NextResponse.json(
      {
        error:
          "비밀번호는 8자 이상으로 설정해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * 여기부터는 Service Role을 사용합니다.
   *
   * 서버에서만 실행되며
   * 브라우저에는 Service Role Key가
   * 전달되지 않습니다.
   */
  const admin =
    createAdminClient();

  /*
   * Auth 학생계정 생성
   *
   * email_confirm: true
   * → 부모가 직접 만든 계정이므로
   * 테스트 단계에서는 이메일 인증 없이
   * 바로 로그인 가능하게 설정
   */
  const {
    data: createdUser,
    error:
      createUserError,
  } =
    await admin.auth.admin.createUser(
      {
        email,
        password,

        email_confirm:
          true,

        user_metadata: {
          name:
            child.name,

          role:
            "student",

          child_id:
            child.id,
        },
      }
    );

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

  const studentUserId =
    createdUser.user.id;

  /*
   * 아래 단계 중 하나라도 실패하면
   * 방금 만든 Auth 계정을 삭제하여
   * 반쯤 연결된 계정이 남지 않게 합니다.
   */
  try {
    /*
     * 학생 profile 생성
     */
    const {
      error:
        studentProfileError,
    } = await admin
      .from("profiles")
      .upsert(
        {
          id:
            studentUserId,

          role:
            "student",

          name:
            child.name,
        },
        {
          onConflict:
            "id",
        }
      );

    if (
      studentProfileError
    ) {
      throw new Error(
        `학생 프로필 생성 실패: ${studentProfileError.message}`
      );
    }

    /*
     * 자녀와 학생 로그인 계정 연결
     */
    const {
      error:
        childUpdateError,
    } = await admin
      .from("children")
      .update({
        student_user_id:
          studentUserId,
      })
      .eq(
        "id",
        child.id
      )
      .is(
        "student_user_id",
        null
      );

    if (
      childUpdateError
    ) {
      throw new Error(
        `자녀 계정 연결 실패: ${childUpdateError.message}`
      );
    }

    /*
     * 기존 승인 수강정보 전부 연결
     *
     * 방금 만든 학생 계정이
     * 기존 초등영어 수강도 바로 볼 수 있게 됩니다.
     */
    const {
      data:
        updatedEnrollments,
      error:
        enrollmentError,
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

    if (
      enrollmentError
    ) {
      throw new Error(
        `기존 수강정보 연결 실패: ${enrollmentError.message}`
      );
    }

    return NextResponse.json({
      success: true,

      studentUserId,

      studentName:
        child.name,

      email,

      updatedEnrollments:
        updatedEnrollments?.length ??
        0,
    });
  } catch (error) {
    /*
     * children 연결이 되어버린 경우
     * 다시 null로 복구
     */
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

    /*
     * enrollments도 복구
     */
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

    /*
     * 생성한 Auth 사용자 삭제
     */
    await admin.auth.admin.deleteUser(
      studentUserId
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "학생 계정 연결 중 오류가 발생했습니다.",
      },
      {
        status: 400,
      }
    );
  }
}