import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase-server";

import {
  createAdminClient,
} from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type RequestBody = {
  title?: string;
  publisher?:
    | string
    | null;
  category?: string;
  description?:
    | string
    | null;
  status?: string;
  isActive?: boolean;
  isForSale?: boolean;
  salePrice?:
    | number
    | null;
  externalPurchaseUrl?:
    | string
    | null;
  coverImageUrl?:
    | string
    | null;
  curriculumLevelIds?: number[];
};

const ALLOWED_CATEGORIES =
  new Set([
    "course_book",
    "phonics",
    "reading",
    "speaking",
    "writing",
    "grammar",
    "vocabulary",
    "adult",
    "other",
  ]);

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const {
      id,
    } =
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
          error:
            "교재 ID가 올바르지 않습니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * 관리자 인증
     * =====================================================
     */
    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

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
      data: profile,
    } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (
      !profile ||
      profile.role !==
        "admin"
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

    const body =
      (await request.json()) as RequestBody;

    const title =
      typeof body.title ===
      "string"
        ? body.title.trim()
        : "";

    if (!title) {
      return NextResponse.json(
        {
          error:
            "교재명을 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    const category =
      typeof body.category ===
      "string"
        ? body.category
        : "";

    if (
      !ALLOWED_CATEGORIES.has(
        category
      )
    ) {
      return NextResponse.json(
        {
          error:
            "교재 분야가 올바르지 않습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const status =
      typeof body.status ===
      "string"
        ? body.status
        : "";

    if (
      status !== "draft" &&
      status !== "ready"
    ) {
      return NextResponse.json(
        {
          error:
            "교재 상태가 올바르지 않습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const isActive =
      body.isActive !==
      false;

    const isForSale =
      body.isForSale ===
      true;

    let salePrice:
      | number
      | null = null;

    if (isForSale) {
      salePrice =
        Number(
          body.salePrice
        );

      if (
        !Number.isInteger(
          salePrice
        ) ||
        salePrice < 0
      ) {
        return NextResponse.json(
          {
            error:
              "판매가격이 올바르지 않습니다.",
          },
          {
            status: 400,
          }
        );
      }
    }

    const curriculumLevelIds =
      Array.isArray(
        body.curriculumLevelIds
      )
        ? Array.from(
            new Set(
              body.curriculumLevelIds
                .map(
                  (value) =>
                    Number(
                      value
                    )
                )
                .filter(
                  (value) =>
                    Number.isInteger(
                      value
                    ) &&
                    value > 0
                )
            )
          )
        : [];

    const adminClient =
      createAdminClient();

    /*
     * =====================================================
     * 기존 교재 확인
     * =====================================================
     */
    const {
      data:
        existingTextbook,
      error:
        existingTextbookError,
    } =
      await adminClient
        .from(
          "textbooks"
        )
        .select(`
          id,
          cover_image_url
        `)
        .eq(
          "id",
          textbookId
        )
        .maybeSingle();

    if (
      existingTextbookError
    ) {
      return NextResponse.json(
        {
          error:
            existingTextbookError.message,
        },
        {
          status: 400,
        }
      );
    }

    if (
      !existingTextbook
    ) {
      return NextResponse.json(
        {
          error:
            "교재를 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * =====================================================
     * Grade ID 검증
     * =====================================================
     */
    if (
      curriculumLevelIds.length >
      0
    ) {
      const {
        data:
          validLevels,
        error:
          validLevelsError,
      } =
        await adminClient
          .from(
            "curriculum_levels"
          )
          .select("id")
          .in(
            "id",
            curriculumLevelIds
          );

      if (
        validLevelsError
      ) {
        return NextResponse.json(
          {
            error:
              validLevelsError.message,
          },
          {
            status: 400,
          }
        );
      }

      if (
        (
          validLevels ??
          []
        ).length !==
        curriculumLevelIds.length
      ) {
        return NextResponse.json(
          {
            error:
              "선택한 Grade 중 존재하지 않는 커리큘럼이 있습니다.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * =====================================================
     * 교재 마스터 정보 수정
     * =====================================================
     */
    const coverImageUrl =
      typeof body.coverImageUrl ===
      "string" &&
      body.coverImageUrl.trim()
        ? body.coverImageUrl.trim()
        : null;

    const {
      error:
        textbookUpdateError,
    } =
      await adminClient
        .from(
          "textbooks"
        )
        .update({
          title,

          publisher:
            typeof body.publisher ===
              "string" &&
            body.publisher.trim()
              ? body.publisher.trim()
              : null,

          category,

          description:
            typeof body.description ===
              "string" &&
            body.description.trim()
              ? body.description.trim()
              : null,

          cover_image_url:
            coverImageUrl,

          status,

          is_active:
            isActive,

          is_for_sale:
            isForSale,

          sale_price:
            isForSale
              ? salePrice
              : null,

          external_purchase_url:
            typeof body.externalPurchaseUrl ===
              "string" &&
            body.externalPurchaseUrl.trim()
              ? body.externalPurchaseUrl.trim()
              : null,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          textbookId
        );

    if (
      textbookUpdateError
    ) {
      return NextResponse.json(
        {
          error:
            `교재 정보 수정 실패: ${textbookUpdateError.message}`,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * 현재 Grade 연결 전체 조회
     * =====================================================
     */
    const {
      data:
        existingMappings,
      error:
        mappingReadError,
    } =
      await adminClient
        .from(
          "curriculum_level_textbooks"
        )
        .select(`
          id,
          curriculum_level_id,
          is_active
        `)
        .eq(
          "textbook_id",
          textbookId
        );

    if (
      mappingReadError
    ) {
      return NextResponse.json(
        {
          error:
            `Grade 연결 조회 실패: ${mappingReadError.message}`,
        },
        {
          status: 400,
        }
      );
    }

    const existing =
      existingMappings ??
      [];

    const selectedSet =
      new Set(
        curriculumLevelIds
      );

    /*
     * =====================================================
     * 기존 Grade 연결 활성/비활성 동기화
     * =====================================================
     */
    for (
      const mapping of
      existing
    ) {
      const shouldBeActive =
        selectedSet.has(
          mapping.curriculum_level_id
        );

      if (
        mapping.is_active ===
        shouldBeActive
      ) {
        continue;
      }

      const {
        error:
          mappingUpdateError,
      } =
        await adminClient
          .from(
            "curriculum_level_textbooks"
          )
          .update({
            is_active:
              shouldBeActive,

            /*
             * textbook master와
             * category 일치
             */
            category,
          })
          .eq(
            "id",
            mapping.id
          );

      if (
        mappingUpdateError
      ) {
        return NextResponse.json(
          {
            error:
              `Grade 연결 변경 실패: ${mappingUpdateError.message}`,
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * 기존 연결이 있는 row는 category도
     * 최신 master category로 맞춥니다.
     */
    if (
      existing.length >
      0
    ) {
      const {
        error:
          categorySyncError,
      } =
        await adminClient
          .from(
            "curriculum_level_textbooks"
          )
          .update({
            category,
          })
          .eq(
            "textbook_id",
            textbookId
          );

      if (
        categorySyncError
      ) {
        return NextResponse.json(
          {
            error:
              `교재 분야 동기화 실패: ${categorySyncError.message}`,
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * =====================================================
     * 새 Grade 연결 생성
     * =====================================================
     */
    const existingLevelIds =
      new Set(
        existing.map(
          (mapping) =>
            mapping.curriculum_level_id
        )
      );

    const newLevelIds =
      curriculumLevelIds.filter(
        (levelId) =>
          !existingLevelIds.has(
            levelId
          )
      );

    if (
      newLevelIds.length >
      0
    ) {
      const rows =
        newLevelIds.map(
          (
            levelId,
            index
          ) => ({
            curriculum_level_id:
              levelId,

            textbook_id:
              textbookId,

            category,

            is_primary:
              false,

            sort_order:
              (index + 1) *
              10,

            is_active:
              true,
          })
        );

      const {
        error:
          mappingInsertError,
      } =
        await adminClient
          .from(
            "curriculum_level_textbooks"
          )
          .insert(rows);

      if (
        mappingInsertError
      ) {
        return NextResponse.json(
          {
            error:
              `신규 Grade 연결 실패: ${mappingInsertError.message}`,
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * =====================================================
     * 표지 교체 완료 후 기존 표지 Storage 삭제
     * =====================================================
     *
     * DB가 새 표지를 정상적으로 가리킨 뒤에만
     * 과거 표지를 삭제합니다.
     */
    if (
      existingTextbook.cover_image_url &&
      coverImageUrl &&
      existingTextbook.cover_image_url !==
        coverImageUrl
    ) {
      const {
        error:
          oldCoverDeleteError,
      } =
        await adminClient.storage
          .from(
            "textbook-files"
          )
          .remove([
            existingTextbook.cover_image_url,
          ]);

      /*
       * 표지 파일 삭제 실패는
       * 교재 수정 자체를 실패 처리하지 않습니다.
       */
      if (
        oldCoverDeleteError
      ) {
        console.error(
          "OLD TEXTBOOK COVER DELETE ERROR:",
          oldCoverDeleteError
        );
      }
    }

    return NextResponse.json({
      success: true,
      textbookId,
      curriculumLevelCount:
        curriculumLevelIds.length,
    });
  } catch (error) {
    console.error(
      "ADMIN TEXTBOOK PATCH ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "교재 수정 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}