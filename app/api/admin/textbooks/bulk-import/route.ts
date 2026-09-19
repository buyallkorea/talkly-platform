import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type Row = {
  title: string;
  publisher: string | null;
  description: string | null;
  image: string | null;
  salePrice: number | null;
};

type Textbook = {
  id: number;
  title: string;
  publisher: string | null;
  description: string | null;
  cover_image_url: string | null;
  sale_price: number | null;
};

type ImportBody = {
  rows?: Row[];
};

function normalizeTitle(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\blv\.?\s*/g, "")
    .replace(/\b3rd\b/g, "")
    .replace(/\(oup\)/g, "")
    .replace(/\s+/g, "")
    .replace(/~/g, "-")
    .replace(/[^a-z0-9가-힣-]+/g, "");
}

function findTextbook(
  rowTitle: string,
  textbooks: Textbook[]
) {
  const needle = normalizeTitle(rowTitle);

  if (!needle) return null;

  const exact = textbooks.filter(
    (textbook) =>
      normalizeTitle(textbook.title) === needle
  );

  if (exact.length === 1) {
    return exact[0];
  }

  const close = textbooks.filter((textbook) => {
    const candidate = normalizeTitle(textbook.title);

    if (!candidate || candidate.length < 5) {
      return false;
    }

    return (
      candidate.startsWith(needle) ||
      needle.startsWith(candidate)
    );
  });

  return close.length === 1 ? close[0] : null;
}

function cleanNullableString(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed || null;
}

function cleanSalePrice(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? Math.round(value)
      : null;
  }

  if (typeof value === "string") {
    const numeric = value.replace(/[^0-9]/g, "");

    if (!numeric) return null;

    const parsed = Number(numeric);

    return Number.isFinite(parsed)
      ? Math.round(parsed)
      : null;
  }

  return null;
}

function cleanRows(input: unknown): Row[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item): Row | null => {
      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item)
      ) {
        return null;
      }

      const record = item as Record<string, unknown>;

      const title =
        typeof record.title === "string"
          ? record.title.trim()
          : "";

      if (!title) {
        return null;
      }

      return {
        title,
        publisher: cleanNullableString(
          record.publisher
        ),
        description: cleanNullableString(
          record.description
        ),
        image: cleanNullableString(record.image),
        salePrice: cleanSalePrice(
          record.salePrice
        ),
      };
    })
    .filter((row): row is Row => row !== null);
}

export async function POST(request: Request) {
  try {
    /*
     * 1. 로그인 / 관리자 권한 확인
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
     * 2. JSON 데이터 읽기
     *
     * XLSX 파일 자체는 서버로 전송하지 않습니다.
     * 브라우저에서 추출한 필요한 행만 받습니다.
     */
    let body: ImportBody;

    try {
      body = (await request.json()) as ImportBody;
    } catch {
      return NextResponse.json(
        {
          error:
            "교재 등록 데이터를 읽을 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const rows = cleanRows(body.rows);

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

    /*
     * 현재 TALKLY 최종 교재는 25종이지만,
     * 이후 커리큘럼 확장을 고려하여 특정 숫자로
     * 강제 제한하지 않습니다.
     */
    if (rows.length > 500) {
      return NextResponse.json(
        {
          error:
            "한 번에 등록할 수 있는 교재 수를 초과했습니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 3. 기존 textbook 조회
     *
     * 여기서는 신규 textbook을 생성하지 않습니다.
     * 기존 ID를 찾은 뒤 정보만 업데이트합니다.
     */
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

    const existingTextbooks =
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

    /*
     * 4. 기존 교재와 매칭하여 정보만 갱신
     */
    for (const row of rows) {
      const textbook = findTextbook(
        row.title,
        existingTextbooks
      );

      if (!textbook) {
        results.push({
          title: row.title,
          status: "unmatched",
          message:
            "기존 교재와 자동 매칭되지 않았습니다.",
        });

        continue;
      }

      /*
       * 중요:
       * - id 변경 없음
       * - title 변경 없음
       * - category 변경 없음
       * - status 변경 없음
       * - is_active 변경 없음
       * - cover_image_url 변경 없음
       * - curriculum_level_textbooks 변경 없음
       * - PDF/페이지/오디오/핫스팟 변경 없음
       */
      const update = {
        publisher: row.publisher,
        description: row.description,
        sale_price: row.salePrice,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await admin
        .from("textbooks")
        .update(update)
        .eq("id", textbook.id);

      if (updateError) {
        results.push({
          title: row.title,
          matchedTitle: textbook.title,
          textbookId: textbook.id,
          status: "failed",
          message: updateError.message,
        });

        continue;
      }

      results.push({
        title: row.title,
        matchedTitle: textbook.title,
        textbookId: textbook.id,
        status: "updated",
        coverUpdated: false,
      });
    }

    /*
     * 5. 처리 결과
     */
    const updated = results.filter(
      (result) => result.status === "updated"
    ).length;

    const unmatched = results.filter(
      (result) => result.status === "unmatched"
    ).length;

    const failed = results.filter(
      (result) => result.status === "failed"
    ).length;

    return NextResponse.json({
      total: rows.length,
      updated,
      unmatched,
      failed,
      results,
    });
  } catch (error) {
    console.error(
      "[textbook bulk import]",
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
