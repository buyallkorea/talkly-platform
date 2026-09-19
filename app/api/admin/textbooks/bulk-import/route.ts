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

type Row = {
  title: string;
  publisher: string | null;
  description: string | null;
  image: string | null;
  salePrice: number | null;
  cover?: CoverPayload | null;
};

type ImportBody = {
  rows?: Row[];
};

type Textbook = {
  id: number;
  title: string;
  publisher: string | null;
  description: string | null;
  cover_image_url: string | null;
  sale_price: number | null;
};

function normalizeTitle(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\blv\.?\s*/g, "")
    .replace(/\b3rd\b/g, "")
    .replace(/\(oup\)/g, "")
    .replace(/starter\s*[-~]\s*5$/g, "")
    .replace(/[^a-z0-9가-힣]+/g, "");
}

function sanitizeFilename(filename: string) {
  return filename
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_");
}

function findTextbook(
  rowTitle: string,
  textbooks: Textbook[]
) {
  const needle = normalizeTitle(rowTitle);

  const exact = textbooks.filter(
    (textbook) =>
      normalizeTitle(textbook.title) === needle
  );

  if (exact.length === 1) {
    return exact[0];
  }

  const close = textbooks.filter(
    (textbook) => {
      const candidate = normalizeTitle(
        textbook.title
      );

      return (
        candidate.length >= 8 &&
        (candidate.startsWith(needle) ||
          needle.startsWith(candidate))
      );
    }
  );

  return close.length === 1
    ? close[0]
    : null;
}

function base64ToBuffer(value: string) {
  const clean = value.includes(",")
    ? value.slice(value.indexOf(",") + 1)
    : value;

  return Buffer.from(clean, "base64");
}

function extensionFromMimeType(
  mimeType: string
) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";

  return null;
}

export async function POST(request: Request) {
  try {
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (
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

    const contentType =
      request.headers.get("content-type") || "";

    if (
      !contentType.includes(
        "application/json"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "잘못된 요청 형식입니다.",
        },
        {
          status: 400,
        }
      );
    }

    const body =
      (await request.json()) as ImportBody;

    const rows = Array.isArray(body.rows)
      ? body.rows
      : [];

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "등록할 교재 정보가 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (rows.length > 100) {
      return NextResponse.json(
        {
          error:
            "한 번에 처리할 수 있는 교재 수를 초과했습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const admin = createAdminClient();

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

    const textbookList =
      (textbooks || []) as Textbook[];

    const results: Array<{
      title: string;
      matchedTitle?: string;
      textbookId?: number;
      status:
        | "updated"
        | "unmatched"
        | "failed";
      message?: string;
      coverUpdated?: boolean;
    }> = [];

    for (const row of rows) {
      const title =
        typeof row.title === "string"
          ? row.title.trim()
          : "";

      if (!title) {
        continue;
      }

      const textbook = findTextbook(
        title,
        textbookList
      );

      if (!textbook) {
        results.push({
          title,
          status: "unmatched",
          message:
            "기존 교재와 자동 매칭되지 않았습니다.",
        });

        continue;
      }

      let newCoverPath:
        | string
        | null = null;

      let coverUpdated = false;

      if (row.cover?.base64) {
        const mimeType =
          row.cover.mimeType;

        const extension =
          extensionFromMimeType(
            mimeType
          );

        if (!extension) {
          results.push({
            title,
            textbookId:
              textbook.id,
            matchedTitle:
              textbook.title,
            status: "failed",
            message:
              "지원하지 않는 표지 이미지 형식입니다.",
          });

          continue;
        }

        const imageBuffer =
          base64ToBuffer(
            row.cover.base64
          );

        if (
          imageBuffer.length === 0
        ) {
          results.push({
            title,
            textbookId:
              textbook.id,
            matchedTitle:
              textbook.title,
            status: "failed",
            message:
              "표지 이미지 데이터가 비어 있습니다.",
          });

          continue;
        }

        /*
         * 비정상적으로 큰 이미지가 들어오는 것을 방지.
         * 교재 표지는 10MB 이내로 제한.
         */
        if (
          imageBuffer.length >
          10 * 1024 * 1024
        ) {
          results.push({
            title,
            textbookId:
              textbook.id,
            matchedTitle:
              textbook.title,
            status: "failed",
            message:
              "표지 이미지가 10MB를 초과합니다.",
          });

          continue;
        }

        const originalFilename =
          row.cover.filename ||
          `cover.${extension}`;

        const safeFilename =
          sanitizeFilename(
            originalFilename
          );

        newCoverPath =
          `covers/bulk/${textbook.id}/${crypto.randomUUID()}-${safeFilename}`;

        /*
         * 파일 확장자가 이상한 경우에도
         * MIME type을 기준으로 Storage에 저장.
         */
        if (
          !newCoverPath
            .toLowerCase()
            .endsWith(
              `.${extension}`
            )
        ) {
          newCoverPath +=
            `.${extension}`;
        }

        const {
          error: uploadError,
        } = await admin.storage
          .from("textbook-files")
          .upload(
            newCoverPath,
            imageBuffer,
            {
              contentType:
                mimeType,
              cacheControl:
                "3600",
              upsert: false,
            }
          );

        if (uploadError) {
          results.push({
            title,
            textbookId:
              textbook.id,
            matchedTitle:
              textbook.title,
            status: "failed",
            message:
              `표지 업로드 실패: ${uploadError.message}`,
          });

          continue;
        }

        coverUpdated = true;
      }

      const update: Record<
        string,
        unknown
      > = {
        publisher:
          row.publisher ?? null,
        description:
          row.description ?? null,
        sale_price:
          row.salePrice ?? null,
        updated_at:
          new Date().toISOString(),
      };

      /*
       * 새 표지가 실제로 추출·업로드된 경우에만
       * cover_image_url을 변경한다.
       *
       * 엑셀에 이미지가 없는 행은 기존 표지를
       * 절대로 null로 만들지 않는다.
       */
      if (newCoverPath) {
        update.cover_image_url =
          newCoverPath;
      }

      const {
        error: updateError,
      } = await admin
        .from("textbooks")
        .update(update)
        .eq("id", textbook.id);

      if (updateError) {
        /*
         * DB 갱신 실패 시 이번 요청에서
         * 새로 올린 표지만 제거한다.
         */
        if (newCoverPath) {
          await admin.storage
            .from("textbook-files")
            .remove([
              newCoverPath,
            ]);
        }

        results.push({
          title,
          textbookId:
            textbook.id,
          matchedTitle:
            textbook.title,
          status: "failed",
          message:
            updateError.message,
        });

        continue;
      }

      /*
       * DB 갱신까지 성공한 뒤에만
       * 이전 표지를 제거한다.
       */
      if (
        newCoverPath &&
        textbook.cover_image_url &&
        textbook.cover_image_url !==
          newCoverPath
      ) {
        await admin.storage
          .from("textbook-files")
          .remove([
            textbook.cover_image_url,
          ]);
      }

      /*
       * 같은 요청 중 동일 교재가 다시 들어올 경우를
       * 대비해 메모리 데이터도 최신 상태로 맞춘다.
       */
      textbook.publisher =
        row.publisher ?? null;

      textbook.description =
        row.description ?? null;

      textbook.sale_price =
        row.salePrice ?? null;

      if (newCoverPath) {
        textbook.cover_image_url =
          newCoverPath;
      }

      results.push({
        title,
        matchedTitle:
          textbook.title,
        textbookId:
          textbook.id,
        status: "updated",
        coverUpdated,
      });
    }

    const updated = results.filter(
      (result) =>
        result.status ===
        "updated"
    ).length;

    const unmatched =
      results.filter(
        (result) =>
          result.status ===
          "unmatched"
      ).length;

    const failed = results.filter(
      (result) =>
        result.status ===
        "failed"
    ).length;

    const coversUpdated =
      results.filter(
        (result) =>
          result.status ===
            "updated" &&
          result.coverUpdated
      ).length;

    return NextResponse.json({
      total: rows.length,
      updated,
      coversUpdated,
      unmatched,
      failed,
      results,
    });
  } catch (error) {
    console.error(
      "Bulk textbook import error:",
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
