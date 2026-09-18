import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
};

type DetectedTrack = {
  pageNumber: number;
  trackNumber: number;
  label: string;
  rawText: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
};

function roundPercent(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clampPercent(value: number) {
  return Math.min(
    100,
    Math.max(0, value)
  );
}

function extractTrackNumbers(
  text: string
): number[] {
  const normalized = text
    .replace(/\s+/g, "")
    .trim();

  if (!normalized) {
    return [];
  }

  /*
   * 우선 PDF text item 자체가
   * T2, T15, T123처럼 정확히 하나의
   * 트랙 표기인 경우를 가장 안전하게 처리합니다.
   */
  const exactMatch =
    normalized.match(/^T(\d{1,3})$/i);

  if (exactMatch) {
    const value =
      Number(exactMatch[1]);

    if (
      Number.isInteger(value) &&
      value > 0 &&
      value <= 999
    ) {
      return [value];
    }
  }

  /*
   * 일부 PDF에서는 T2가 다른 문자와
   * 하나의 text item으로 묶일 수 있으므로
   * 그 경우도 보조적으로 탐지합니다.
   */
  const matches = [
    ...normalized.matchAll(
      /(?:^|[^A-Z0-9])T(\d{1,3})(?!\d)/gi
    ),
  ];

  const numbers = matches
    .map((match) =>
      Number(match[1])
    )
    .filter(
      (value) =>
        Number.isInteger(value) &&
        value > 0 &&
        value <= 999
    );

  return [...new Set(numbers)];
}

export async function POST(
  _request: NextRequest,
  context: RouteContext
) {
  let pdfDocument:
    | Awaited<
        ReturnType<
          (
            typeof import(
              "pdfjs-dist/legacy/build/pdf.mjs"
            )
          )["getDocument"]
        >["promise"]
      >
    | null = null;

  try {
    const { id } =
      await context.params;

    const textbookId =
      Number(id);

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
            "올바른 교재 ID가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const supabase =
      await createClient();

    // 1. 로그인 확인
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

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
        { status: 401 }
      );
    }

    // 2. 관리자 권한 확인
    const {
      data: profile,
      error: profileError,
    } = await supabase
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
          error:
            "관리자 권한이 필요합니다.",
        },
        { status: 403 }
      );
    }

    // 3. 교재 정보 조회
    const {
      data: textbook,
      error: textbookError,
    } = await supabase
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
      .maybeSingle();

    if (textbookError) {
      return NextResponse.json(
        {
          success: false,
          error:
            `교재 조회 실패: ${textbookError.message}`,
        },
        { status: 500 }
      );
    }

    if (!textbook) {
      return NextResponse.json(
        {
          success: false,
          error:
            "교재를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    if (
      !textbook.original_file_url
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "등록된 원본 파일이 없습니다.",
        },
        { status: 400 }
      );
    }

    if (
      textbook.original_file_type !==
      "pdf"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "현재는 PDF 교재만 오디오 트랙 위치를 분석할 수 있습니다.",
        },
        { status: 400 }
      );
    }

    // 4. Private Storage에서 원본 PDF 다운로드
    const {
      data: fileData,
      error: downloadError,
    } = await supabase.storage
      .from("textbook-files")
      .download(
        textbook.original_file_url
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
            "원본 PDF를 다운로드하지 못했습니다.",
        },
        { status: 500 }
      );
    }

    const arrayBuffer =
      await fileData.arrayBuffer();

    /*
     * pdfjs-dist 5.x는 ESM 기반입니다.
     * 서버 Node runtime에서만 동적으로
     * import하여 사용합니다.
     */
    const pdfjs =
      await import(
        "pdfjs-dist/legacy/build/pdf.mjs"
      );

    const loadingTask =
      pdfjs.getDocument({
        data: new Uint8Array(
          arrayBuffer
        ),
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      });

    pdfDocument =
      await loadingTask.promise;

    /*
     * destroy() 전에 필요한 PDF 메타데이터를
     * 별도 변수에 보관합니다.
     */
    const pdfPageCount =
      pdfDocument.numPages;

    const detectedTracks:
      DetectedTrack[] = [];

    /*
     * 같은 페이지에서 같은 T번호가
     * 중복 검출되는 것을 방지합니다.
     */
    const detectedKeys =
      new Set<string>();

    // 5. 각 PDF 페이지 분석
    for (
      let pageNumber = 1;
      pageNumber <=
      pdfPageCount;
      pageNumber += 1
    ) {
      const page =
        await pdfDocument.getPage(
          pageNumber
        );

      const viewport =
        page.getViewport({
          scale: 1,
        });

      const textContent =
        await page.getTextContent();

      for (
        const rawItem of
        textContent.items
      ) {
        if (
          !("str" in rawItem)
        ) {
          continue;
        }

        const item =
          rawItem as PdfTextItem;

        const text =
          item.str?.trim() ?? "";

        if (!text) {
          continue;
        }

        const trackNumbers =
          extractTrackNumbers(
            text
          );

        if (
          trackNumbers.length ===
          0
        ) {
          continue;
        }

        const transform =
          item.transform;

        if (
          !transform ||
          transform.length < 6
        ) {
          continue;
        }

        /*
         * PDF.js text transform
         *
         * transform[4] = X
         * transform[5] = baseline Y
         *
         * PDF 좌표계:
         * 좌측 하단이 원점
         *
         * TALKLY Viewer:
         * 좌측 상단이 원점
         *
         * 따라서 Y 좌표를 뒤집어 줍니다.
         */
        const x =
          Number(
            transform[4]
          ) || 0;

        const baselineY =
          Number(
            transform[5]
          ) || 0;

        /*
         * textContent item.width를
         * 우선 사용합니다.
         *
         * width가 없는 특수 PDF를 위해
         * transform[0]을 fallback으로
         * 사용합니다.
         */
        const itemWidth =
          Math.max(
            Number(
              item.width
            ) || 0,
            Math.abs(
              Number(
                transform[0]
              ) || 0
            ),
            1
          );

        /*
         * PDF에 따라 item.height가
         * 0 또는 undefined일 수 있으므로
         * transform의 글자 크기도
         * fallback으로 사용합니다.
         */
        const transformHeight =
          Math.max(
            Math.abs(
              Number(
                transform[3]
              ) || 0
            ),
            Math.abs(
              Number(
                transform[1]
              ) || 0
            )
          );

        const itemHeight =
          Math.max(
            Number(
              item.height
            ) || 0,
            transformHeight,
            1
          );

        const topY =
          viewport.height -
          baselineY -
          itemHeight;

        /*
         * 현재 Viewer가 hotspot 위치를
         * % 단위로 저장하므로
         * PDF 좌표도 동일하게 %로 변환합니다.
         */
        const xPercent =
          clampPercent(
            (x /
              viewport.width) *
              100
          );

        const yPercent =
          clampPercent(
            (topY /
              viewport.height) *
              100
          );

        const widthPercent =
          clampPercent(
            (itemWidth /
              viewport.width) *
              100
          );

        const heightPercent =
          clampPercent(
            (itemHeight /
              viewport.height) *
              100
          );

        for (
          const trackNumber of
          trackNumbers
        ) {
          const key =
            `${pageNumber}:${trackNumber}`;

          if (
            detectedKeys.has(key)
          ) {
            continue;
          }

          detectedKeys.add(key);

          detectedTracks.push({
            pageNumber,
            trackNumber,
            label:
              `T${trackNumber}`,
            rawText: text,

            /*
             * 이 단계에서는 PDF에 인쇄된
             * T번호 자체의 실제 bounding box를
             * 반환합니다.
             *
             * 자동 hotspot 저장 단계에서
             * 클릭하기 편하도록 padding을
             * 추가할 예정입니다.
             */
            xPercent:
              roundPercent(
                xPercent
              ),

            yPercent:
              roundPercent(
                yPercent
              ),

            widthPercent:
              roundPercent(
                widthPercent
              ),

            heightPercent:
              roundPercent(
                heightPercent
              ),
          });
        }
      }

      page.cleanup();
    }

    // 6. 페이지 → 트랙 번호 순으로 정렬
    detectedTracks.sort(
      (a, b) => {
        if (
          a.pageNumber !==
          b.pageNumber
        ) {
          return (
            a.pageNumber -
            b.pageNumber
          );
        }

        return (
          a.trackNumber -
          b.trackNumber
        );
      }
    );

    const trackNumbers = [
      ...new Set(
        detectedTracks.map(
          (item) =>
            item.trackNumber
        )
      ),
    ].sort(
      (a, b) => a - b
    );

    /*
     * 정상 처리 후 PDF.js 자원을
     * 명시적으로 정리합니다.
     */
    await pdfDocument.destroy();
    pdfDocument = null;

    // 아직 DB에는 아무것도 저장하지 않습니다.
    return NextResponse.json({
      success: true,

      message:
        "PDF 오디오 트랙 위치 분석이 완료되었습니다.",

      textbook: {
        id: textbook.id,
        title:
          textbook.title,
        status:
          textbook.status,

        storedPageCount:
          textbook.page_count,

        pdfPageCount,
      },

      detectedCount:
        detectedTracks.length,

      uniqueTrackCount:
        trackNumbers.length,

      trackNumbers,

      tracks:
        detectedTracks,
    });
  } catch (error) {
    /*
     * 분석 도중 오류가 발생해도
     * PDF.js document가 열려 있다면
     * 정리를 시도합니다.
     */
    if (pdfDocument) {
      try {
        await pdfDocument.destroy();
      } catch {
        // cleanup 오류는 원래 오류를 덮지 않습니다.
      }
    }

    console.error(
      "TEXTBOOK AUDIO TRACK DETECTION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "PDF 오디오 트랙 위치 분석 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}