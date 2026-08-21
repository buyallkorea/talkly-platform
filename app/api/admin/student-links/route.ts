import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type LinkRequestBody = {
  childId: number;
  studentUserId: string;
};

type UnlinkRequestBody = {
  childId: number;
};

/*
 * 관리자 인증 공통 함수
 */
async function getAdminClient() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      error: NextResponse.json(
        {
          error: "로그인이 필요합니다.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  const {
    data: adminProfile,
    error: adminProfileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    adminProfileError ||
    !adminProfile ||
    adminProfile.role !== "admin"
  ) {
    return {
      supabase,
      error: NextResponse.json(
        {
          error: "관리자 권한이 필요합니다.",
        },
        {
          status: 403,
        }
      ),
    };
  }

  return {
    supabase,
    error: null,
  };
}

/*
 * 학생 계정 연결 / 재연결
 */
export async function POST(
  request: Request
) {
  const {
    supabase,
    error: authError,
  } = await getAdminClient();

  if (authError) {
    return authError;
  }

  let body: LinkRequestBody;

  try {
    body =
      (await request.json()) as LinkRequestBody;
  } catch {
    return NextResponse.json(
      {
        error:
          "연결 정보를 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const childId =
    Number(body.childId);

  const studentUserId =
    body.studentUserId;

  if (
    !Number.isInteger(childId) ||
    childId <= 0 ||
    !studentUserId
  ) {
    return NextResponse.json(
      {
        error:
          "자녀와 학생 계정을 모두 선택해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * 학생 계정 확인
   */
  const {
    data: studentProfile,
    error: studentError,
  } = await supabase
    .from("profiles")
    .select("id, role, name")
    .eq("id", studentUserId)
    .eq("role", "student")
    .maybeSingle();

  if (
    studentError ||
    !studentProfile
  ) {
    return NextResponse.json(
      {
        error:
          "선택한 학생 계정을 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * 자녀 확인
   */
  const {
    data: child,
    error: childError,
  } = await supabase
    .from("children")
    .select(`
      id,
      name,
      student_user_id
    `)
    .eq("id", childId)
    .eq("is_active", true)
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

  /*
   * 같은 학생 계정이 다른 자녀에
   * 이미 연결되어 있는지 확인
   */
  const {
    data: alreadyLinked,
    error: linkedError,
  } = await supabase
    .from("children")
    .select("id, name")
    .eq(
      "student_user_id",
      studentUserId
    )
    .neq("id", childId)
    .limit(1);

  if (linkedError) {
    return NextResponse.json(
      {
        error: linkedError.message,
      },
      {
        status: 400,
      }
    );
  }

  if (
    alreadyLinked &&
    alreadyLinked.length > 0
  ) {
    return NextResponse.json(
      {
        error:
          `이 학생 계정은 이미 ${alreadyLinked[0].name} 자녀 정보에 연결되어 있습니다.`,
      },
      {
        status: 409,
      }
    );
  }

  /*
   * 이미 동일한 계정에 연결된 경우에도
   * enrollments를 다시 동기화합니다.
   */
  const previousStudentUserId =
    child.student_user_id ?? null;

  /*
   * children 연결
   */
  const {
    error: updateChildError,
  } = await supabase
    .from("children")
    .update({
      student_user_id:
        studentUserId,
    })
    .eq("id", childId);

  if (updateChildError) {
    return NextResponse.json(
      {
        error:
          `자녀 계정 연결 실패: ${updateChildError.message}`,
      },
      {
        status: 400,
      }
    );
  }

  /*
   * 해당 자녀의 모든 기존 수강정보도
   * 학생 계정과 연결
   */
  const {
    data: updatedEnrollments,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .update({
      student_user_id:
        studentUserId,
    })
    .eq(
      "child_id",
      childId
    )
    .select("id");

  if (enrollmentError) {
    /*
     * 실패 시 children 원상복구
     */
    await supabase
      .from("children")
      .update({
        student_user_id:
          previousStudentUserId,
      })
      .eq("id", childId);

    return NextResponse.json(
      {
        error:
          `수강정보 학생 연결 실패: ${enrollmentError.message}`,
      },
      {
        status: 400,
      }
    );
  }

  return NextResponse.json({
    success: true,

    childId,

    studentUserId,

    studentName:
      studentProfile.name,

    updatedEnrollments:
      updatedEnrollments?.length ??
      0,
  });
}

/*
 * 학생 계정 연결 해제
 */
export async function DELETE(
  request: Request
) {
  const {
    supabase,
    error: authError,
  } = await getAdminClient();

  if (authError) {
    return authError;
  }

  let body: UnlinkRequestBody;

  try {
    body =
      (await request.json()) as UnlinkRequestBody;
  } catch {
    return NextResponse.json(
      {
        error:
          "연결 해제 정보를 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const childId =
    Number(body.childId);

  if (
    !Number.isInteger(childId) ||
    childId <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "연결을 해제할 자녀를 확인해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * 현재 자녀 연결 상태 확인
   */
  const {
    data: child,
    error: childError,
  } = await supabase
    .from("children")
    .select(`
      id,
      name,
      student_user_id
    `)
    .eq("id", childId)
    .eq("is_active", true)
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

  if (!child.student_user_id) {
    return NextResponse.json(
      {
        error:
          "현재 연결된 학생 계정이 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const previousStudentUserId =
    child.student_user_id;

  /*
   * children 연결 해제
   */
  const {
    error: unlinkChildError,
  } = await supabase
    .from("children")
    .update({
      student_user_id: null,
    })
    .eq("id", childId);

  if (unlinkChildError) {
    return NextResponse.json(
      {
        error:
          `학생 계정 연결 해제 실패: ${unlinkChildError.message}`,
      },
      {
        status: 400,
      }
    );
  }

  /*
   * 해당 자녀의 기존 수강정보에서도
   * 학생 로그인 계정 연결 제거
   *
   * child_id 및 수강 자체는 유지합니다.
   */
  const {
    data: updatedEnrollments,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .update({
      student_user_id: null,
    })
    .eq(
      "child_id",
      childId
    )
    .select("id");

  if (enrollmentError) {
    /*
     * 실패하면 children 연결 복구
     */
    await supabase
      .from("children")
      .update({
        student_user_id:
          previousStudentUserId,
      })
      .eq("id", childId);

    return NextResponse.json(
      {
        error:
          `수강정보 연결 해제 실패: ${enrollmentError.message}`,
      },
      {
        status: 400,
      }
    );
  }

  return NextResponse.json({
    success: true,

    childId,

    unlinkedStudentUserId:
      previousStudentUserId,

    updatedEnrollments:
      updatedEnrollments?.length ??
      0,
  });
}