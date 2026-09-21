import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  pdf,
} from "pdf-to-img";

import {
  createClient,
} from "@/lib/supabase-server";

import {
  createAdminClient,
} from "@/lib/supabase-admin";

export const runtime =
  "nodejs";

type RouteContext = {
  params: Promise<{
    volumeId: string;
  }>;
};

type TextbookPageRow = {
  textbook_id: number;
  volume_id: number;
  page_number: number;
  page_image_url: string;
  page_width: number | null;
  page_height: number | null;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    /*
     * =========================================================
     * 1. 관리자 인증
     * =========================================================
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

    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
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
     * =========================================================
     * 2. Volume ID
     * =========================================================
     */
    const {
      volumeId: volumeIdParam,
    } =
      await context.params;

    const volumeId =
      Number(
        volumeIdParam
      );

    if (
      !Number.isInteger(
        volumeId
      ) ||
      volumeId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "올바른 Volume ID가 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =========================================================
     * 3. 요청값
     *
     * PDF 자체를 API로 보내지 않습니다.
     * 브라우저가 먼저 Storage에 올리고,
     * 여기에는 Storage path만 전달합니다.
     *
     * 대용량 PDF의 Vercel payload 제한을 피하기 위한 구조입니다.
     * =========================================================
     */
    const body =
      await request.json();

    const textbookId =
      Number(
        body.textbookId
      );

    const storagePath =
      typeof body.storagePath ===
      "string"
        ? body.storagePath.trim()
        : "";

    if (
      !Number.isInteger(
        textbookId
      ) ||
      textbookId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "올바른 대표교재 ID가 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (!storagePath) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PDF Storage path가 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 우리가 사용하는 Volume 전용 Storage 경로인지 확인
     */
    const expectedPrefix =
      `textbooks/${textbookId}/volumes/${volumeId}/original/`;

    if (
      !storagePath.startsWith(
        expectedPrefix
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "올바르지 않은 PDF Storage 경로입니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !storagePath
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PDF 파일만 처리할 수 있습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const adminClient =
      createAdminClient();

    /*
     * =========================================================
     * 4. Volume 조회 및 대표교재 소속 검증
     * =========================================================
     */
    const {
      data: volume,
      error: volumeError,
    } =
      await adminClient
        .from(
          "textbook_volumes"
        )
        .select(`
          id,
          textbook_id,
          volume_code,
          display_title,
          original_file_url,
          original_file_type,
          page_count,
          status,
          is_active
        `)
        .eq("id", volumeId)
        .eq(
          "textbook_id",
          textbookId
        )
        .maybeSingle();

    if (
      volumeError ||
      !volume
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "해당 권별 교재를 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * =========================================================
     * 5. 현재 Volume 페이지 확인
     *
     * 이번 단계에서는 최초 등록만 허용합니다.
     *
     * 이미 페이지와 Hotspot이 존재하는 교재를 무심코
     * 재처리하여 수업자료가 깨지는 것을 막습니다.
     *
     * 추후 'PDF 교체' 기능은 별도의 안전한 흐름으로 만듭니다.
     * =========================================================
     */
    const {
      count:
        existingPageCount,
      error:
        existingPageCountError,
    } =
      await adminClient
        .from(
          "textbook_pages"
        )
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "volume_id",
          volumeId
        );

    if (
      existingPageCountError
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `기존 페이지 확인 실패: ${existingPageCountError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    if (
      (existingPageCount ??
        0) > 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "이미 페이지가 생성된 권입니다. 기존 E-Book 데이터를 보호하기 위해 현재 화면에서는 PDF를 다시 처리할 수 없습니다.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =========================================================
     * 6. Storage PDF 다운로드
     * =========================================================
     */
    const {
      data: fileData,
      error: downloadError,
    } =
      await adminClient.storage
        .from(
          "textbook-files"
        )
        .download(
          storagePath
        );

    if (
      downloadError ||
      !fileData
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            downloadError?.message ||
            "업로드한 PDF를 Storage에서 불러오지 못했습니다.",
        },
        {
          status: 500,
        }
      );
    }

    const arrayBuffer =
      await fileData.arrayBuffer();

    const pdfBuffer =
      Buffer.from(
        arrayBuffer
      );

    /*
     * =========================================================
     * 7. PDF 렌더링
     * =========================================================
     */
    const document =
      await pdf(
        pdfBuffer,
        {
          scale: 1.5,
        }
      );

    let pageCount = 0;

    const pageRows:
      TextbookPageRow[] =
      [];

    const uploadedPaths:
      string[] = [];

    /*
     * =========================================================
     * 8. 각 페이지를 PNG로 변환하여 Storage 저장
     *
     * 대표교재 단위가 아니라
     * textbookId / volumeId 단위로 완전히 분리합니다.
     * =========================================================
     */
    for await (
      const image of document
    ) {
      pageCount += 1;

      const filename =
        `page-${String(
          pageCount
        ).padStart(
          3,
          "0"
        )}.png`;

      const pageStoragePath =
        `textbooks/${textbookId}/volumes/${volumeId}/pages/${filename}`;

      const {
        error:
          uploadError,
      } =
        await adminClient.storage
          .from(
            "textbook-pages"
          )
          .upload(
            pageStoragePath,
            image,
            {
              contentType:
                "image/png",

              cacheControl:
                "3600",

              upsert:
                true,
            }
          );

      if (uploadError) {
        /*
         * 중간 실패 시 이번 처리에서 생성한
         * 페이지 이미지만 정리합니다.
         */
        if (
          uploadedPaths.length >
          0
        ) {
          await adminClient.storage
            .from(
              "textbook-pages"
            )
            .remove(
              uploadedPaths
            );
        }

        return NextResponse.json(
          {
            success: false,
            error:
              `${pageCount}페이지 이미지 업로드 실패: ${uploadError.message}`,
          },
          {
            status: 500,
          }
        );
      }

      uploadedPaths.push(
        pageStoragePath
      );

      pageRows.push({
        textbook_id:
          textbookId,

        volume_id:
          volumeId,

        page_number:
          pageCount,

        page_image_url:
          pageStoragePath,

        page_width:
          null,

        page_height:
          null,
      });
    }

    if (
      pageCount === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PDF에서 페이지를 찾지 못했습니다.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * =========================================================
     * 9. textbook_pages 저장
     *
     * Volume 최초 등록만 허용하므로 INSERT를 사용합니다.
     *
     * UNIQUE:
     * (volume_id, page_number)
     * WHERE volume_id IS NOT NULL
     * =========================================================
     */
    const {
      data: savedPages,
      error:
        pageInsertError,
    } =
      await adminClient
        .from(
          "textbook_pages"
        )
        .insert(
          pageRows
        )
        .select(`
          id,
          textbook_id,
          volume_id,
          page_number,
          page_image_url
        `);

    if (
      pageInsertError
    ) {
      /*
       * DB 저장 실패 시
       * 이번에 생성한 페이지 이미지 제거
       */
      if (
        uploadedPaths.length >
        0
      ) {
        await adminClient.storage
          .from(
            "textbook-pages"
          )
          .remove(
            uploadedPaths
          );
      }

      return NextResponse.json(
        {
          success: false,
          error:
            `페이지 DB 저장 실패: ${pageInsertError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * =========================================================
     * 10. Volume 정보 업데이트
     *
     * 대표 textbooks.page_count는 건드리지 않습니다.
     * =========================================================
     */
    const {
      data:
        updatedVolume,
      error:
        volumeUpdateError,
    } =
      await adminClient
        .from(
          "textbook_volumes"
        )
        .update({
          original_file_url:
            storagePath,

          original_file_type:
            "pdf",

          page_count:
            pageCount,

          status:
            "ready",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          volumeId
        )
        .eq(
          "textbook_id",
          textbookId
        )
        .select(`
          id,
          textbook_id,
          volume_code,
          display_title,
          original_file_url,
          original_file_type,
          page_count,
          status,
          is_active
        `)
        .single();

    if (
      volumeUpdateError
    ) {
      /*
       * 여기까지 왔으면 페이지 DB가 생성됐으므로
       * 무조건 자동 삭제하지 않습니다.
       *
       * 데이터 손실보다 관리자 확인이 안전합니다.
       */
      return NextResponse.json(
        {
          success: false,
          error:
            `페이지 생성은 완료되었지만 Volume 정보 업데이트에 실패했습니다: ${volumeUpdateError.message}`,

          pageCount,

          savedPageCount:
            savedPages?.length ??
            0,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * =========================================================
     * 11. 완료
     * =========================================================
     */
    return NextResponse.json({
      success: true,

      message:
        "권별 PDF 등록 및 E-Book 페이지 생성이 완료되었습니다.",

      volume:
        updatedVolume,

      pageCount,

      savedPageCount:
        savedPages?.length ??
        0,
    });
  } catch (error) {
    console.error(
      "TEXTBOOK VOLUME PDF PROCESS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof
          Error
            ? error.message
            : "권별 PDF 처리 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}