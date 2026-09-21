import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase-server";

import {
  createAdminClient,
} from "@/lib/supabase-admin";

export const runtime = "nodejs";

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

type CanvasModule =
  typeof import("@napi-rs/canvas");

/*
 * =============================================================
 * PDF.js Node Canvas 환경 구성
 *
 * 중요:
 * pdfjs-dist를 import하기 전에
 * DOMMatrix / ImageData / Path2D를 등록해야 합니다.
 * =============================================================
 */
function installCanvasGlobals(
  canvasModule: CanvasModule
) {
  const globalObject =
    globalThis as unknown as {
      DOMMatrix?: unknown;
      ImageData?: unknown;
      Path2D?: unknown;
    };

  if (
    typeof globalObject.DOMMatrix ===
    "undefined"
  ) {
    globalObject.DOMMatrix =
      canvasModule.DOMMatrix as unknown;
  }

  if (
    typeof globalObject.ImageData ===
    "undefined"
  ) {
    globalObject.ImageData =
      canvasModule.ImageData as unknown;
  }

  if (
    typeof globalObject.Path2D ===
    "undefined"
  ) {
    globalObject.Path2D =
      canvasModule.Path2D as unknown;
  }
}

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
      profile.role !== "admin"
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
     * 2. Volume ID 확인
     * =========================================================
     */
    const {
      volumeId: volumeIdParam,
    } =
      await context.params;

    const volumeId =
      Number(volumeIdParam);

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
     * 3. 요청값 확인
     *
     * PDF 파일 자체는 이 API로 보내지 않습니다.
     * 브라우저에서 Storage에 직접 업로드한 뒤
     * Storage path만 전달합니다.
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
     * Volume 전용 Storage 경로인지 검증
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
     * 4. Volume 조회
     *
     * volumeId가 실제로 해당 대표교재에 속하는지 확인합니다.
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
        .eq(
          "id",
          volumeId
        )
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
     * 5. 기존 페이지 확인
     *
     * 현재 단계에서는 최초 PDF 등록만 허용합니다.
     *
     * 이미 페이지가 만들어진 Volume을 다시 처리하면
     * 이후 Audio Hotspot 등이 깨질 수 있으므로 차단합니다.
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
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
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
     * 6. Private Storage에서 PDF 다운로드
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

    const pdfBytes =
      new Uint8Array(
        arrayBuffer
      );

    /*
     * =========================================================
     * 7. @napi-rs/canvas 먼저 로드
     *
     * pdfjs-dist보다 반드시 먼저 실행되어야 합니다.
     * =========================================================
     */
    const canvasModule =
      await import(
        "@napi-rs/canvas"
      );

    installCanvasGlobals(
      canvasModule
    );

    /*
     * =========================================================
     * 8. Canvas globals 구성 후 PDF.js 로드
     *
     * 정적 import를 사용하면 pdfjs-dist가 먼저 평가되어
     * DOMMatrix is not defined 오류가 발생할 수 있습니다.
     * =========================================================
     */
    const pdfjs =
      await import(
        "pdfjs-dist/legacy/build/pdf.mjs"
      );

    /*
     * =========================================================
     * 9. PDF 문서 로드
     * =========================================================
     */
    const loadingTask =
      pdfjs.getDocument({
        data: pdfBytes,
        disableFontFace:
          false,
        useSystemFonts:
          true,
      });

    const pdfDocument =
      await loadingTask.promise;

    const pageCount =
      pdfDocument.numPages;

    if (
      !pageCount ||
      pageCount <= 0
    ) {
      await pdfDocument.destroy();

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
     * 10. 페이지 렌더링 준비
     * =========================================================
     */
    const pageRows:
      TextbookPageRow[] =
      [];

    const uploadedPaths:
      string[] =
      [];

    try {
      /*
       * =======================================================
       * 11. PDF 페이지 → PNG
       * =======================================================
       */
      for (
        let pageNumber = 1;
        pageNumber <=
        pageCount;
        pageNumber += 1
      ) {
        const page =
          await pdfDocument.getPage(
            pageNumber
          );

        /*
         * 기존 TALKLY PDF 처리와 동일하게
         * scale 1.5를 사용합니다.
         */
        const viewport =
          page.getViewport({
            scale: 1.5,
          });

        const width =
          Math.ceil(
            viewport.width
          );

        const height =
          Math.ceil(
            viewport.height
          );

        /*
         * Node Native Canvas 생성
         */
        const canvas =
          canvasModule.createCanvas(
            width,
            height
          );

        const context2d =
          canvas.getContext(
            "2d"
          );

        /*
         * =====================================================
         * pdfjs-dist 5.6.205 RenderParameters
         *
         * canvas와 canvasContext를 모두 전달합니다.
         *
         * PDF.js TypeScript 타입은 Browser Canvas를 기준으로
         * 작성되어 있지만 실제 런타임에서는
         * @napi-rs/canvas를 사용합니다.
         * =====================================================
         */
        await page.render({
          canvas:
            canvas as never,

          canvasContext:
            context2d as never,

          viewport,
        }).promise;

        /*
         * PNG Buffer 생성
         */
        const imageBuffer =
          canvas.toBuffer(
            "image/png"
          );

        const filename =
          `page-${String(
            pageNumber
          ).padStart(
            3,
            "0"
          )}.png`;

        /*
         * Volume별로 Storage 경로를 완전히 분리합니다.
         */
        const pageStoragePath =
          `textbooks/${textbookId}/volumes/${volumeId}/pages/${filename}`;

        /*
         * =====================================================
         * 12. PNG Storage 업로드
         * =====================================================
         */
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
              imageBuffer,
              {
                contentType:
                  "image/png",

                cacheControl:
                  "3600",

                upsert:
                  true,
              }
            );

        if (
          uploadError
        ) {
          throw new Error(
            `${pageNumber}페이지 이미지 업로드 실패: ${uploadError.message}`
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
            pageNumber,

          page_image_url:
            pageStoragePath,

          page_width:
            width,

          page_height:
            height,
        });

        /*
         * PDF.js 페이지 리소스 정리
         */
        page.cleanup();
      }
    } catch (
      renderError
    ) {
      /*
       * 렌더링 또는 Storage 업로드 도중 실패한 경우
       * 이번 작업에서 생성한 페이지 이미지만 제거합니다.
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

      await pdfDocument.destroy();

      throw renderError;
    }

    /*
     * PDF 리소스 해제
     */
    await pdfDocument.destroy();

    /*
     * =========================================================
     * 13. textbook_pages DB 저장
     *
     * 현재 DB:
     *
     * UNIQUE (volume_id, page_number)
     * WHERE volume_id IS NOT NULL
     *
     * Volume 최초 등록만 허용하므로 INSERT를 사용합니다.
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
       * DB 저장 실패 시 이번 작업에서 만든
       * Storage 페이지 이미지를 정리합니다.
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
     * 14. textbook_volumes 업데이트
     *
     * 중요:
     * 대표 textbooks.page_count는 변경하지 않습니다.
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
       * 여기까지 왔으면 textbook_pages가 이미 정상 생성됐습니다.
       *
       * 데이터 손실 방지를 위해 페이지를 자동 삭제하지 않고
       * 오류만 반환합니다.
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
     * 15. 완료
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