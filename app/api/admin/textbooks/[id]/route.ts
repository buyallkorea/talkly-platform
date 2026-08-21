import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(
  request: Request,
  context: RouteContext
) {
  const { id } = await context.params;

  const textbookId = Number(id);

  if (
    !Number.isInteger(textbookId) ||
    textbookId <= 0
  ) {
    return NextResponse.json(
      {
        error: "잘못된 교재 ID입니다.",
      },
      {
        status: 400,
      }
    );
  }

  const supabase = await createClient();

  /*
   * 관리자 인증
   */
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
    profile.role !== "admin"
  ) {
    return NextResponse.json(
      {
        error: "관리자 권한이 필요합니다.",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * 삭제 대상 교재 확인
   */
  const {
    data: textbook,
    error: textbookError,
  } = await supabase
    .from("textbooks")
    .select(`
      id,
      title,
      original_file_url
    `)
    .eq("id", textbookId)
    .maybeSingle();

  if (textbookError) {
    return NextResponse.json(
      {
        error:
          `교재 확인 실패: ${textbookError.message}`,
      },
      {
        status: 400,
      }
    );
  }

  if (!textbook) {
    return NextResponse.json(
      {
        error:
          "삭제할 교재를 찾을 수 없습니다.",
      },
      {
        status: 404,
      }
    );
  }

  /*
   * 먼저 DB 교재 삭제
   *
   * textbook_pages는 FK ON DELETE CASCADE이므로
   * 자동으로 함께 삭제됩니다.
   */
  const {
    data: deleted,
    error: deleteError,
  } = await supabase
    .from("textbooks")
    .delete()
    .eq("id", textbookId)
    .select("id");

  if (deleteError) {
    return NextResponse.json(
      {
        error:
          `교재 삭제 실패: ${deleteError.message}`,
      },
      {
        status: 400,
      }
    );
  }

  if (
    !deleted ||
    deleted.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "교재가 삭제되지 않았습니다.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * Storage 원본 파일 삭제
   *
   * original_file_url에는
   * uploads/... 형태의 Storage 내부 경로가 저장됩니다.
   */
  let storageDeleted = false;
  let storageWarning: string | null = null;

  if (textbook.original_file_url) {
    const {
      error: storageError,
    } = await supabase.storage
      .from("textbook-files")
      .remove([
        textbook.original_file_url,
      ]);

    if (storageError) {
      storageWarning =
        `교재 DB는 삭제되었지만 원본 파일 삭제에 실패했습니다: ${storageError.message}`;
    } else {
      storageDeleted = true;
    }
  }

  return NextResponse.json({
    success: true,
    textbookId,
    textbookTitle: textbook.title,
    storageDeleted,
    storageWarning,
  });
}