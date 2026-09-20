import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type CoverPayload = {
  filename: string;
  mimeType: string;
  base64: string;
};

type ImportRow = {
  title: string;
  publisher: string | null;
  description: string | null;
  image: string | null;
  salePrice: number | null;
  cover?: CoverPayload | null;
};

type Textbook = {
  id: number;
  title: string;
  publisher: string | null;
  description: string | null;
  cover_image_url: string | null;
  sale_price: number | null;
};

type Result = {
  title: string;
  matchedTitle?: string;
  textbookId?: number;
  status: "updated" | "unmatched" | "failed";
  message?: string;
  coverUpdated?: boolean;
};

function normalizeTitle(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()

    // "Lv1~6", "Lv 1~6" 등 제거
    .replace(/\blv\.?\s*/g, "")

    // 3rd 같은 판 정보 제거
    .replace(/\b3rd\b/g, "")

    // (OUP) 같은 기존 제목 표기 제거
    .replace(/\(\s*oup\s*\)/g, "")

    // starter-5 / starter~5 등 끝부분 변형 완화
    .replace(/starter\s*[-~]\s*5$/g, "starter")

    // 비교에 필요 없는 문자 제거
    .replace(/[^a-z0-9가-힣]+/g, "");
}

function sanitizeFilename(filename: string) {
  return filename
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";

  return null;
}

function findTextbook(
  rowTitle: string,
  textbooks: Textbook[]
) {
  const needle = normalizeTitle(rowTitle);

  /*
   * 1. 정규화 후 완전 일치
   */
  const exact = textbooks.filter(
    (textbook) =>
      normalizeTitle(textbook.title) === needle
  );

  if (exact.length === 1) {
    return exact[0];
  }

  /*
   * 2. 한쪽 제목이 다른 쪽 제목을 포함하는 경우
   *
   * 예:
   * Smart Ponics, Lv1~5
   * Smart Ponics 1~5
   */
  const close = textbooks.filter((textbook) => {
    const candidate = normalizeTitle(textbook.title);

    if (candidate.length < 5 || needle.length < 5) {
      return false;
    }

    return (
      candidate.startsWith(needle) ||
      needle.startsWith(candidate) ||
      candidate.includes(needle) ||
      needle.includes(candidate)
    );
  });

  if (close.length === 1) {
    return close[0];
  }

  return null;
}

function isValidRow(value: unknown): value is ImportRow {
  if (!value || typeof value !== "object") {
    return false;
  }

  const row = value as Partial<ImportRow>;

  return (
    typeof row.title === "string" &&
    row.title.trim().length > 0
  );
}

function base64ToBuffer(base64: string) {
  const cleaned = base64.replace(
    /^data:[^;]+;base64,/,
    ""
  );

  return Buffer.from(cleaned, "base64");
}

function validateCover(
  cover: CoverPayload
): string | null {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (!allowedMimeTypes.includes(cover.mimeType)) {
    return `지원하지 않는 표지 형식입니다: ${cover.mimeType}`;
  }

  if (
    typeof cover.base64 !== "string" ||
    cover.base64.length === 0
  ) {
    return "표지 이미지 데이터가 비어 있습니다.";
  }

  return null;
}

export async function POST(request: Request) {
  try {
    /*
     * 1. 관리자 인증
     */
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "로그인이 필요합니다.",
        },
        {
          status: 401,
        }
      );
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        {
          error: profileError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!profile || profile.role !== "admin") {
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
     * 2. 단일 교재 데이터 수신
     */
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "요청 데이터를 읽을 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const payload = body as {
      row?: unknown;
    };

    if (!isValidRow(payload.row)) {
      return NextResponse.json(
        {
          error: "등록할 교재 정보가 올바르지 않습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const row = payload.row;

    const admin = createAdminClient();

    /*
     * 3. 기존 교재 조회
     *
     * 새 textbook을 생성하지 않는다.
     * 기존 25종과 매칭해서 ID를 유지한다.
     */
    const {
      data: textbooks,
      error: textbookError,
    } = await admin
      .from("textbooks")
      .select(
        "id,title,publisher,description,cover_image_url,sale_price"
      );

    if (textbookError) {
      throw textbookError;
    }

    const textbook = findTextbook(
      row.title,
      (textbooks || []) as Textbook[]
    );

    if (!textbook) {
      const result: Result = {
        title: row.title,
        status: "unmatched",
        message:
          "기존 교재와 자동 매칭되지 않았습니다.",
        coverUpdated: false,
      };

      return NextResponse.json({
        result,
      });
    }

    /*
     * 4. 표지 처리
     */
    let newCoverPath: string | null = null;

    if (row.cover) {
      const validationError =
        validateCover(row.cover);

      if (validationError) {
        const result: Result = {
          title: row.title,
          matchedTitle: textbook.title,
          textbookId: textbook.id,
          status: "failed",
          message: validationError,
          coverUpdated: false,
        };

        return NextResponse.json({
          result,
        });
      }

      const extension =
        extensionFromMimeType(row.cover.mimeType);

      if (!extension) {
        const result: Result = {
          title: row.title,
          matchedTitle: textbook.title,
          textbookId: textbook.id,
          status: "failed",
          message:
            "지원하지 않는 표지 이미지 형식입니다.",
          coverUpdated: false,
        };

        return NextResponse.json({
          result,
        });
      }

      let imageBuffer: Buffer;

      try {
        imageBuffer = base64ToBuffer(
          row.cover.base64
        );
      } catch {
        const result: Result = {
          title: row.title,
          matchedTitle: textbook.title,
          textbookId: textbook.id,
          status: "failed",
          message:
            "표지 이미지 데이터를 변환하지 못했습니다.",
          coverUpdated: false,
        };

        return NextResponse.json({
          result,
        });
      }

      if (imageBuffer.length === 0) {
        const result: Result = {
          title: row.title,
          matchedTitle: textbook.title,
          textbookId: textbook.id,
          status: "failed",
          message:
            "표지 이미지 데이터가 비어 있습니다.",
          coverUpdated: false,
        };

        return NextResponse.json({
          result,
        });
      }

      /*
       * 교재 한 종의 이미지가 비정상적으로 큰 경우
       * Vercel payload 문제를 반복하지 않도록 명확히 표시한다.
       *
       * 일반적인 교재 표지는 이 크기보다 훨씬 작다.
       */
      const maxCoverBytes = 4 * 1024 * 1024;

      if (imageBuffer.length > maxCoverBytes) {
        const result: Result = {
          title: row.title,
          matchedTitle: textbook.title,
          textbookId: textbook.id,
          status: "failed",
          message:
            "표지 이미지가 4MB를 초과합니다. 해당 교재의 표지 크기를 줄인 후 다시 등록해주세요.",
          coverUpdated: false,
        };

        return NextResponse.json({
          result,
        });
      }

      const originalFilename =
        sanitizeFilename(row.cover.filename) ||
        `cover.${extension}`;

      newCoverPath =
        `covers/bulk/${textbook.id}/` +
        `${crypto.randomUUID()}-${originalFilename}`;

      const { error: uploadError } =
        await admin.storage
          .from("textbook-files")
          .upload(
            newCoverPath,
            imageBuffer,
            {
              contentType: row.cover.mimeType,
              cacheControl: "3600",
              upsert: false,
            }
          );

      if (uploadError) {
        const result: Result = {
          title: row.title,
          matchedTitle: textbook.title,
          textbookId: textbook.id,
          status: "failed",
          message: `표지 업로드 실패: ${uploadError.message}`,
          coverUpdated: false,
        };

        return NextResponse.json({
          result,
        });
      }
    }

    /*
     * 5. 교재 마스터 정보 갱신
     *
     * 여기서 수정하는 컬럼:
     * - publisher
     * - description
     * - sale_price
     * - cover_image_url (새 표지가 있는 경우)
     * - updated_at
     *
     * 수정하지 않는 것:
     * - id
     * - title
     * - category
     * - status
     * - is_active
     * - PDF
     * - textbook_pages
     * - textbook_hotspots
     * - curriculum_level_textbooks
     */
    const update: Record<string, unknown> = {
      publisher: row.publisher,
      description: row.description,
      sale_price: row.salePrice,
      updated_at: new Date().toISOString(),
    };

    if (newCoverPath) {
      update.cover_image_url = newCoverPath;
    }

    const { error: updateError } =
      await admin
        .from("textbooks")
        .update(update)
        .eq("id", textbook.id);

    if (updateError) {
      /*
       * DB 갱신 실패 시 방금 업로드한 새 이미지만 제거한다.
       */
      if (newCoverPath) {
        await admin.storage
          .from("textbook-files")
          .remove([newCoverPath]);
      }

      const result: Result = {
        title: row.title,
        matchedTitle: textbook.title,
        textbookId: textbook.id,
        status: "failed",
        message: updateError.message,
        coverUpdated: false,
      };

      return NextResponse.json({
        result,
      });
    }

    /*
     * 6. DB 갱신 성공 후 기존 표지가 있었다면 제거
     *
     * 새 DB 경로가 정상 저장된 이후에만 삭제한다.
     */
    if (
      newCoverPath &&
      textbook.cover_image_url &&
      textbook.cover_image_url !== newCoverPath
    ) {
      await admin.storage
        .from("textbook-files")
        .remove([textbook.cover_image_url]);
    }

    const result: Result = {
      title: row.title,
      matchedTitle: textbook.title,
      textbookId: textbook.id,
      status: "updated",
      coverUpdated: Boolean(newCoverPath),
    };

    return NextResponse.json({
      result,
    });
  } catch (error) {
    console.error(
      "[textbooks/bulk-import] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "교재 일괄등록 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}
