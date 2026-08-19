import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type RequestBody = {
  childId: number;
  studentUserId: string;
};

export async function POST(
  request: Request
) {
  const supabase =
    await createClient();

  /*
   * 관리자 인증
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    data: adminProfile,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !adminProfile ||
    adminProfile.role !== "admin"
  ) {
    return NextResponse.json(
      {
        error:
          "관리자 권한이 필요합니다.",
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
   * 학생 role 확인
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
   * 이미 연결됐는지 확인
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
        error:
          linkedError.message,
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
   * 기존 수강도 모두 학생 계정에 연결
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
     * enrollment 연결 실패 시
     * children 연결도 원상복구
     */
    await supabase
      .from("children")
      .update({
        student_user_id:
          child.student_user_id ??
          null,
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

    updatedEnrollments:
      updatedEnrollments?.length ??
      0,
  });
}