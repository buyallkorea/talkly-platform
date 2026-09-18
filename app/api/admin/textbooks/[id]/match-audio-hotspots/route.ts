import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

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

type TextbookPageRow = {
  id: number;
  page_number: number;
};

type ExistingHotspotRow = {
  id: number;
  page_id: number;
  type: string;
  label: string | null;
  x_percent: number | string;
  y_percent: number | string;
  width_percent: number | string;
  height_percent: number | string;
  audio_url: string | null;
  sort_order: number;
  is_active: boolean;
};

type NewHotspotRow = {
  page_id: number;
  type: "audio";
  label: string;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  audio_url: string;
  sort_order: number;
  is_active: boolean;
};

type MatchedTrackResult = {
  pageNumber: number;
  pageId: number;
  trackNumber: number;
  label: string;
  audioPath: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
};

type SkippedDuplicateResult = {
  pageNumber: number;
  pageId: number;
  trackNumber: number;
  label: string;
  audioPath: string;
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

  const exactMatch =
    normalized.match(/^T(\d{1,3})$/i);

  if (exactMatch) {
    const value = Number(
      exactMatch[1]
    );

    if (
      Number.isInteger(value) &&
      value > 0 &&
      value <= 999
    ) {
      return [value];
    }
  }

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

function parseAudioTrackNumber(
  filename: string
) {
  const baseName = filename
    .split("/")
    .pop()
    ?.trim();

  if (!baseName) {
    return null;
  }

  const match = baseName.match(
    /^TR\s*0*(\d+)\.mp3$/i
  );

  if (!match) {
    return null;
  }

  const trackNumber = Number(
    match[1]
  );

  if (
    !Number.isInteger(trackNumber) ||
    trackNumber <= 0
  ) {
    return null;
  }

  return trackNumber;
}

function numberValue(
  value: number | string | null | undefined
) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function isNear(
  a: number,
  b: number,
  tolerance = 0.75
) {
  return Math.abs(a - b) <= tolerance;
}

function makeClickableRect(
  xPercent: number,
  yPercent: number,
  widthPercent: number,
  heightPercent: number
) {
  /*
   * PDF에 인쇄된 T번호 자체는 매우 작기 때문에
   * 실제 클릭 영역을 조금 넓혀 줍니다.
   *
   * 단, 페이지 밖으로 나가지 않도록
   * 0~100% 범위로 제한합니다.
   */
  const horizontalPadding = 0.8;
  const verticalPadding = 0.6;

  let x = clampPercent(
    xPercent - horizontalPadding
  );

  let y = clampPercent(
    yPercent - verticalPadding
  );

  let width = Math.max(
    widthPercent +
      horizontalPadding * 2,
    2.5
  );

  let height = Math.max(
    heightPercent +
      verticalPadding * 2,
    2.5
  );

  if (x + width > 100) {
    width = 100 - x;
  }

  if (y + height > 100) {
    height = 100 - y;
  }

  x = clampPercent(x);
  y = clampPercent(y);
  width = clampPercent(width);
  height = clampPercent(height);

  return {
    xPercent: roundPercent(x),
    yPercent: roundPercent(y),
    widthPercent:
      roundPercent(width),
    heightPercent:
      roundPercent(height),
  };
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

    /*
     * 1. 로그인 확인
     */
    const supabase =
      await createClient();

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

    /*
     * 2. 관리자 권한 확인
     */
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
          success: false,
          error:
            "관리자 권한이 필요합니다.",
        },
        { status: 403 }
      );
    }

    const admin =
      createAdminClient();

    /*
     * 3. 교재 조회
     */
    const {
      data: textbook,
      error: textbookError,
    } = await admin
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
            "현재는 PDF 교재만 자동 오디오 매칭할 수 있습니다.",
        },
        { status: 400 }
      );
    }

    /*
     * 4. 생성된 textbook_pages 확인
     *
     * 기존 /api/textbooks/process가 먼저
     * 실행되어 있어야 합니다.
     */
    const {
      data: pageRows,
      error: pagesError,
    } = await admin
      .from("textbook_pages")
      .select(
        "id, page_number"
      )
      .eq(
        "textbook_id",
        textbookId
      )
      .order(
        "page_number",
        { ascending: true }
      );

    if (pagesError) {
      return NextResponse.json(
        {
          success: false,
          error:
            `교재 페이지 조회 실패: ${pagesError.message}`,
        },
        { status: 500 }
      );
    }

    const textbookPages =
      (pageRows ?? []) as TextbookPageRow[];

    if (
      textbookPages.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "생성된 교재 페이지가 없습니다. 먼저 PDF 페이지 처리를 완료해 주세요.",
        },
        { status: 400 }
      );
    }

    const pageIdByNumber =
      new Map<number, number>();

    for (
      const page of
      textbookPages
    ) {
      pageIdByNumber.set(
        page.page_number,
        page.id
      );
    }

    /*
     * 5. textbook-audio에 업로드된
     * TR MP3 목록 조회
     */
    const audioPrefix =
      `textbooks/${textbookId}/tracks`;

    const {
      data: audioFiles,
      error: audioListError,
    } = await admin.storage
      .from("textbook-audio")
      .list(
        audioPrefix,
        {
          limit: 1000,
          offset: 0,
          sortBy: {
            column: "name",
            order: "asc",
          },
        }
      );

    if (audioListError) {
      return NextResponse.json(
        {
          success: false,
          error:
            `교재 오디오 목록 조회 실패: ${audioListError.message}`,
        },
        { status: 500 }
      );
    }

    const audioPathByTrack =
      new Map<number, string>();

    const ignoredAudioFiles:
      string[] = [];

    for (
      const file of
      audioFiles ?? []
    ) {
      if (!file.name) {
        continue;
      }

      const trackNumber =
        parseAudioTrackNumber(
          file.name
        );

      if (
        trackNumber === null
      ) {
        ignoredAudioFiles.push(
          file.name
        );
        continue;
      }

      const storagePath =
        `${audioPrefix}/${file.name}`;

      if (
        audioPathByTrack.has(
          trackNumber
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              `같은 TR 번호의 오디오가 중복되어 있습니다: TR${String(
                trackNumber
              ).padStart(2, "0")}`,
          },
          { status: 400 }
        );
      }

      audioPathByTrack.set(
        trackNumber,
        storagePath
      );
    }

    if (
      audioPathByTrack.size === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "업로드된 TR MP3 오디오를 찾을 수 없습니다. 먼저 MP3 ZIP 처리를 완료해 주세요.",
        },
        { status: 400 }
      );
    }

    /*
     * 6. 원본 PDF 다운로드
     */
    const {
      data: pdfBlob,
      error: downloadError,
    } = await admin.storage
      .from("textbook-files")
      .download(
        textbook.original_file_url
      );

    if (
      downloadError ||
      !pdfBlob
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
      await pdfBlob.arrayBuffer();

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

    const pdfPageCount =
      pdfDocument.numPages;

    /*
     * 7. PDF의 T번호와 실제 위치 분석
     */
    const detectedTracks:
      DetectedTrack[] = [];

    /*
     * 같은 PDF text item이 내부적으로
     * 중복 반환되는 경우만 제거합니다.
     *
     * 같은 페이지에 동일한 T번호가
     * 실제로 다른 위치에 있다면
     * 두 위치 모두 유지합니다.
     */
    const detectedKeys =
      new Set<string>();

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

        const pdfX =
          Number(
            transform[4]
          ) || 0;

        const pdfBaselineY =
          Number(
            transform[5]
          ) || 0;

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

        /*
         * PDF 좌표를 Viewer 좌표로 변환합니다.
         *
         * convertToViewportPoint를 사용하면
         * PDF의 좌하단 원점 → 화면 좌상단 원점
         * 변환뿐 아니라 페이지 rotation도
         * PDF.js viewport 기준으로 처리됩니다.
         */
        const pointA =
          viewport.convertToViewportPoint(
            pdfX,
            pdfBaselineY
          );

        const pointB =
          viewport.convertToViewportPoint(
            pdfX + itemWidth,
            pdfBaselineY +
              itemHeight
          );

        const viewportX =
          Math.min(
            pointA[0],
            pointB[0]
          );

        const viewportY =
          Math.min(
            pointA[1],
            pointB[1]
          );

        const viewportWidth =
          Math.max(
            Math.abs(
              pointB[0] -
                pointA[0]
            ),
            1
          );

        const viewportHeight =
          Math.max(
            Math.abs(
              pointB[1] -
                pointA[1]
            ),
            1
          );

        const xPercent =
          clampPercent(
            (viewportX /
              viewport.width) *
              100
          );

        const yPercent =
          clampPercent(
            (viewportY /
              viewport.height) *
              100
          );

        const widthPercent =
          clampPercent(
            (viewportWidth /
              viewport.width) *
              100
          );

        const heightPercent =
          clampPercent(
            (viewportHeight /
              viewport.height) *
              100
          );

        for (
          const trackNumber of
          trackNumbers
        ) {
          /*
           * 0.1% 단위 좌표를 key에 포함하여
           * 동일 위치의 중복 text item만 제거합니다.
           */
          const coordinateKey = [
            pageNumber,
            trackNumber,
            Math.round(
              xPercent * 10
            ),
            Math.round(
              yPercent * 10
            ),
          ].join(":");

          if (
            detectedKeys.has(
              coordinateKey
            )
          ) {
            continue;
          }

          detectedKeys.add(
            coordinateKey
          );

          detectedTracks.push({
            pageNumber,
            trackNumber,
            label:
              `T${trackNumber}`,
            rawText: text,
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

    await pdfDocument.destroy();
    pdfDocument = null;

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

        if (
          a.trackNumber !==
          b.trackNumber
        ) {
          return (
            a.trackNumber -
            b.trackNumber
          );
        }

        if (
          a.yPercent !==
          b.yPercent
        ) {
          return (
            a.yPercent -
            b.yPercent
          );
        }

        return (
          a.xPercent -
          b.xPercent
        );
      }
    );

    if (
      detectedTracks.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PDF에서 T번호 오디오 표기를 찾지 못했습니다.",
        },
        { status: 400 }
      );
    }

    /*
     * 8. 이 교재 페이지들에 이미 존재하는
     * audio hotspot 조회
     */
    const pageIds =
      textbookPages.map(
        (page) => page.id
      );

    const {
      data: existingRows,
      error: existingError,
    } = await admin
      .from("textbook_hotspots")
      .select(`
        id,
        page_id,
        type,
        label,
        x_percent,
        y_percent,
        width_percent,
        height_percent,
        audio_url,
        sort_order,
        is_active
      `)
      .in(
        "page_id",
        pageIds
      )
      .eq(
        "type",
        "audio"
      );

    if (existingError) {
      return NextResponse.json(
        {
          success: false,
          error:
            `기존 오디오 hotspot 조회 실패: ${existingError.message}`,
        },
        { status: 500 }
      );
    }

    const existingHotspots =
      (existingRows ??
        []) as ExistingHotspotRow[];

    /*
     * 기존 sort_order 뒤에서부터
     * 자동 hotspot을 추가합니다.
     */
    const maxSortOrderByPage =
      new Map<number, number>();

    for (
      const hotspot of
      existingHotspots
    ) {
      const current =
        maxSortOrderByPage.get(
          hotspot.page_id
        ) ?? -1;

      maxSortOrderByPage.set(
        hotspot.page_id,
        Math.max(
          current,
          hotspot.sort_order ?? 0
        )
      );
    }

    /*
     * 9. T번호 ↔ TR번호 매칭
     */
    const rowsToInsert:
      NewHotspotRow[] = [];

    const matched:
      MatchedTrackResult[] = [];

    const skippedDuplicates:
      SkippedDuplicateResult[] = [];

    const unmatchedPdfTracks =
      new Set<number>();

    const missingPages =
      new Set<number>();

    for (
      const detected of
      detectedTracks
    ) {
      const pageId =
        pageIdByNumber.get(
          detected.pageNumber
        );

      if (!pageId) {
        missingPages.add(
          detected.pageNumber
        );
        continue;
      }

      const audioPath =
        audioPathByTrack.get(
          detected.trackNumber
        );

      if (!audioPath) {
        unmatchedPdfTracks.add(
          detected.trackNumber
        );
        continue;
      }

      const clickable =
        makeClickableRect(
          detected.xPercent,
          detected.yPercent,
          detected.widthPercent,
          detected.heightPercent
        );

      /*
       * 기존 hotspot을 삭제하지 않습니다.
       *
       * 같은 page + label + audio +
       * 거의 같은 좌표가 이미 있으면
       * 재실행으로 판단하여 건너뜁니다.
       */
      const duplicate =
        existingHotspots.some(
          (hotspot) =>
            hotspot.page_id ===
              pageId &&
            hotspot.type ===
              "audio" &&
            hotspot.label ===
              detected.label &&
            hotspot.audio_url ===
              audioPath &&
            isNear(
              numberValue(
                hotspot.x_percent
              ),
              clickable.xPercent
            ) &&
            isNear(
              numberValue(
                hotspot.y_percent
              ),
              clickable.yPercent
            )
        );

      if (duplicate) {
        skippedDuplicates.push({
          pageNumber:
            detected.pageNumber,
          pageId,
          trackNumber:
            detected.trackNumber,
          label:
            detected.label,
          audioPath,
        });

        continue;
      }

      const currentMax =
        maxSortOrderByPage.get(
          pageId
        ) ?? -1;

      const nextSortOrder =
        currentMax + 1;

      maxSortOrderByPage.set(
        pageId,
        nextSortOrder
      );

      rowsToInsert.push({
        page_id: pageId,
        type: "audio",
        label:
          detected.label,
        x_percent:
          clickable.xPercent,
        y_percent:
          clickable.yPercent,
        width_percent:
          clickable.widthPercent,
        height_percent:
          clickable.heightPercent,
        audio_url:
          audioPath,
        sort_order:
          nextSortOrder,
        is_active: true,
      });

      matched.push({
        pageNumber:
          detected.pageNumber,
        pageId,
        trackNumber:
          detected.trackNumber,
        label:
          detected.label,
        audioPath,
        xPercent:
          clickable.xPercent,
        yPercent:
          clickable.yPercent,
        widthPercent:
          clickable.widthPercent,
        heightPercent:
          clickable.heightPercent,
      });
    }

    /*
     * 10. PDF에는 없지만 Storage에는 있는
     * TR번호도 결과에 포함합니다.
     */
    const detectedTrackNumbers =
      new Set(
        detectedTracks.map(
          (item) =>
            item.trackNumber
        )
      );

    const unmatchedAudioTracks =
      Array.from(
        audioPathByTrack.keys()
      )
        .filter(
          (trackNumber) =>
            !detectedTrackNumbers.has(
              trackNumber
            )
        )
        .sort(
          (a, b) => a - b
        );

    /*
     * 11. 자동 생성 hotspot INSERT
     */
    if (
      rowsToInsert.length > 0
    ) {
      const {
        error: insertError,
      } = await admin
        .from(
          "textbook_hotspots"
        )
        .insert(
          rowsToInsert
        );

      if (insertError) {
        return NextResponse.json(
          {
            success: false,
            error:
              `자동 오디오 hotspot 저장 실패: ${insertError.message}`,
            detectedCount:
              detectedTracks.length,
            matchedCount:
              matched.length,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,

      message:
        rowsToInsert.length > 0
          ? `${rowsToInsert.length}개의 오디오 hotspot을 자동 생성했습니다.`
          : "새로 생성할 오디오 hotspot이 없습니다.",

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

      availableAudioCount:
        audioPathByTrack.size,

      createdCount:
        rowsToInsert.length,

      skippedDuplicateCount:
        skippedDuplicates.length,

      unmatchedPdfTrackCount:
        unmatchedPdfTracks.size,

      unmatchedAudioTrackCount:
        unmatchedAudioTracks.length,

      missingPageCount:
        missingPages.size,

      ignoredAudioFileCount:
        ignoredAudioFiles.length,

      created:
        matched,

      skippedDuplicates,

      unmatchedPdfTracks:
        Array.from(
          unmatchedPdfTracks
        ).sort(
          (a, b) => a - b
        ),

      unmatchedAudioTracks,

      missingPages:
        Array.from(
          missingPages
        ).sort(
          (a, b) => a - b
        ),

      ignoredAudioFiles,
    });
  } catch (error) {
    if (pdfDocument) {
      try {
        await pdfDocument.destroy();
      } catch {
        // 원래 오류를 유지합니다.
      }
    }

    console.error(
      "TEXTBOOK AUDIO HOTSPOT MATCH ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "교재 오디오 hotspot 자동 매칭 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}