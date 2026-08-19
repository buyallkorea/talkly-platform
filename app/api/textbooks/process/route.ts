import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { pdf } from "pdf-to-img";

export const runtime = "nodejs";

type TextbookPageRow = {
  textbook_id: number;
  page_number: number;
  page_image_url: string;
  page_width: number | null;
  page_height: number | null;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. 로그인 확인
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    // 2. 관리자 권한 확인
    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "관리자 권한이 필요합니다.",
        },
        { status: 403 }
      );
    }

    // 3. 요청값 확인
    const body = await request.json();
    const textbookId = Number(body.textbookId);

    if (
      !Number.isInteger(textbookId) ||
      textbookId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "올바른 교재 ID가 필요합니다.",
        },
        { status: 400 }
      );
    }

    // 4. 교재 정보 조회
    const { data: textbook, error: textbookError } =
      await supabase
        .from("textbooks")
        .select(`
          id,
          title,
          original_file_url,
          original_file_type,
          page_count,
          status
        `)
        .eq("id", textbookId)
        .single();

    if (textbookError || !textbook) {
      return NextResponse.json(
        {
          success: false,
          error: "교재를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    if (!textbook.original_file_url) {
      return NextResponse.json(
        {
          success: false,
          error: "등록된 원본 파일이 없습니다.",
        },
        { status: 400 }
      );
    }

    if (textbook.original_file_type !== "pdf") {
      return NextResponse.json(
        {
          success: false,
          error:
            "현재는 PDF 교재만 페이지 이미지로 변환할 수 있습니다.",
        },
        { status: 400 }
      );
    }

    // 5. Private Storage에서 원본 PDF 다운로드
    const {
      data: fileData,
      error: downloadError,
    } = await supabase.storage
      .from("textbook-files")
      .download(textbook.original_file_url);

    if (downloadError || !fileData) {
      return NextResponse.json(
        {
          success: false,
          error:
            downloadError?.message ||
            "원본 PDF를 다운로드하지 못했습니다.",
        },
        { status: 500 }
      );
    }

    const arrayBuffer =
      await fileData.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // 6. PDF 렌더링
    const document = await pdf(pdfBuffer, {
      scale: 1.5,
    });

    let pageCount = 0;

    const pageRows: TextbookPageRow[] = [];

    const uploadedPages: {
      pageNumber: number;
      storagePath: string;
      imageBytes: number;
    }[] = [];

    for await (const image of document) {
      pageCount += 1;

      const filename =
        `page-${String(pageCount).padStart(
          3,
          "0"
        )}.png`;

      const storagePath =
        `textbooks/${textbookId}/pages/${filename}`;

      // 7. 페이지 이미지 Storage 업로드
      const { error: uploadError } =
        await supabase.storage
          .from("textbook-pages")
          .upload(storagePath, image, {
            contentType: "image/png",
            cacheControl: "3600",
            upsert: true,
          });

      if (uploadError) {
        return NextResponse.json(
          {
            success: false,
            error:
              `${pageCount}페이지 이미지 업로드 실패: ${uploadError.message}`,
            uploadedPages,
          },
          { status: 500 }
        );
      }

      uploadedPages.push({
        pageNumber: pageCount,
        storagePath,
        imageBytes: image.length,
      });

      pageRows.push({
        textbook_id: textbookId,
        page_number: pageCount,
        page_image_url: storagePath,
        page_width: null,
        page_height: null,
      });
    }

    if (pageCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "PDF에서 페이지를 찾지 못했습니다.",
        },
        { status: 500 }
      );
    }

    // 8. textbook_pages에 페이지 메타데이터 저장
    // unique(textbook_id, page_number) 제약을 기준으로 upsert합니다.
    const {
      data: savedPages,
      error: pageUpsertError,
    } = await supabase
      .from("textbook_pages")
      .upsert(pageRows, {
        onConflict: "textbook_id,page_number",
      })
      .select(
        "id, textbook_id, page_number, page_image_url"
      )
      .order("page_number", {
        ascending: true,
      });

    if (pageUpsertError) {
      return NextResponse.json(
        {
          success: false,
          error:
            `페이지 DB 저장 실패: ${pageUpsertError.message}`,
          pageCount,
          uploadedPages,
        },
        { status: 500 }
      );
    }

    // 9. textbooks.page_count 업데이트
    const {
      data: updatedTextbook,
      error: textbookUpdateError,
    } = await supabase
      .from("textbooks")
      .update({
        page_count: pageCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", textbookId)
      .select(
        "id, title, page_count, status"
      )
      .single();

    if (textbookUpdateError) {
      return NextResponse.json(
        {
          success: false,
          error:
            `교재 페이지 수 업데이트 실패: ${textbookUpdateError.message}`,
          pageCount,
          savedPages: savedPages ?? [],
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "PDF 페이지 변환, Storage 업로드, DB 저장이 완료되었습니다.",
      textbook: updatedTextbook,
      pageCount,
      savedPageCount:
        savedPages?.length ?? 0,
      uploadedPages,
    });
  } catch (error) {
    console.error(
      "TEXTBOOK PDF PROCESS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "PDF 페이지 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}