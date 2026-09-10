import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase-server";

import {
  createAdminClient,
} from "@/lib/supabase-admin";

type RequestBody = {
  curriculumLevelId?: number;
  textbookIds?: number[];
};

export async function POST(
  request: Request
) {
  try {
    /*
     * 관리자 인증
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
          error:
            "관리자 권한이 필요합니다.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * 요청 body 확인
     */
    const body =
      (await request.json()) as RequestBody;

    const curriculumLevelId =
      Number(
        body.curriculumLevelId
      );

    if (
      !Number.isInteger(
        curriculumLevelId
      ) ||
      curriculumLevelId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "커리큘럼 Grade 정보가 올바르지 않습니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 전달받은 textbook id 정리
     *
     * 중복 제거
     * 숫자가 아닌 값 제거
     * 0 이하 제거
     */
    const textbookIds =
      Array.isArray(
        body.textbookIds
      )
        ? Array.from(
            new Set(
              body.textbookIds
                .map(
                  (id) =>
                    Number(id)
                )
                .filter(
                  (id) =>
                    Number.isInteger(
                      id
                    ) &&
                    id > 0
                )
            )
          )
        : [];

    const adminClient =
      createAdminClient();

    /*
     * 커리큘럼 Grade 존재 여부 확인
     */
    const {
      data: level,
      error: levelError,
    } =
      await adminClient
        .from(
          "curriculum_levels"
        )
        .select(`
          id,
          code,
          name
        `)
        .eq(
          "id",
          curriculumLevelId
        )
        .maybeSingle();

    if (
      levelError ||
      !level
    ) {
      return NextResponse.json(
        {
          error:
            "해당 커리큘럼 Grade를 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * 선택된 교재가 실제 존재하고
     * 활성 상태인지 확인
     */
    let selectedTextbooks:
      {
        id: number;
        category: string | null;
      }[] = [];

    if (
      textbookIds.length > 0
    ) {
      const {
        data,
        error,
      } =
        await adminClient
          .from(
            "textbooks"
          )
          .select(`
            id,
            category
          `)
          .in(
            "id",
            textbookIds
          )
          .eq(
            "is_active",
            true
          );

      if (error) {
        return NextResponse.json(
          {
            error:
              `교재 조회 실패: ${error.message}`,
          },
          {
            status: 400,
          }
        );
      }

      selectedTextbooks =
        (data ?? []) as {
          id: number;
          category: string | null;
        }[];

      /*
       * 전달된 id 수와 실제 조회된
       * 활성 교재 수가 다르면 잘못된 요청
       */
      if (
        selectedTextbooks.length !==
        textbookIds.length
      ) {
        return NextResponse.json(
          {
            error:
              "선택한 교재 중 존재하지 않거나 비활성 상태인 교재가 있습니다.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * 이 Grade의 과거 연결까지 모두 조회
     *
     * is_active=false도 포함해야
     * 과거에 해제했던 교재를 다시 선택할 때
     * 새 row를 만들지 않고 재활성화할 수 있습니다.
     */
    const {
      data: existingMappings,
      error:
        existingMappingsError,
    } =
      await adminClient
        .from(
          "curriculum_level_textbooks"
        )
        .select(`
          id,
          textbook_id,
          category,
          is_primary,
          sort_order,
          is_active
        `)
        .eq(
          "curriculum_level_id",
          curriculumLevelId
        );

    if (
      existingMappingsError
    ) {
      return NextResponse.json(
        {
          error:
            `기존 교재 연결 조회 실패: ${existingMappingsError.message}`,
        },
        {
          status: 400,
        }
      );
    }

    const existing =
      existingMappings ?? [];

    const selectedSet =
      new Set(
        textbookIds
      );

    const selectedBookMap =
      new Map(
        selectedTextbooks.map(
          (book) => [
            book.id,
            book,
          ]
        )
      );

    /*
     * =========================================================
     * 기존 연결 상태 업데이트
     * =========================================================
     *
     * 선택됨    → is_active=true
     * 선택 해제 → is_active=false
     *
     * row 자체를 삭제하지 않습니다.
     */
    for (
      const mapping of
      existing
    ) {
      const shouldBeActive =
        selectedSet.has(
          mapping.textbook_id
        );

      const selectedBook =
        selectedBookMap.get(
          mapping.textbook_id
        );

      /*
       * 기존 상태와 같고
       * category 변경도 필요 없다면
       * 불필요한 update 생략
       */
      const nextCategory =
        selectedBook?.category ??
        mapping.category ??
        null;

      const needsUpdate =
        mapping.is_active !==
          shouldBeActive ||
        mapping.category !==
          nextCategory;

      if (!needsUpdate) {
        continue;
      }

      const {
        error: updateError,
      } =
        await adminClient
          .from(
            "curriculum_level_textbooks"
          )
          .update({
            is_active:
              shouldBeActive,
            category:
              nextCategory,
          })
          .eq(
            "id",
            mapping.id
          );

      if (
        updateError
      ) {
        return NextResponse.json(
          {
            error:
              `기존 교재 연결 수정 실패: ${updateError.message}`,
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * =========================================================
     * 아직 한 번도 연결된 적 없는 교재 INSERT
     * =========================================================
     */
    const existingTextbookIds =
      new Set(
        existing.map(
          (mapping) =>
            mapping.textbook_id
        )
      );

    const newTextbooks =
      selectedTextbooks.filter(
        (book) =>
          !existingTextbookIds.has(
            book.id
          )
      );

    if (
      newTextbooks.length > 0
    ) {
      /*
       * 기존 sort_order 뒤에서부터
       * 순서 부여
       */
      const maxSortOrder =
        existing.reduce(
          (
            max,
            mapping
          ) => {
            const value =
              typeof mapping.sort_order ===
              "number"
                ? mapping.sort_order
                : 0;

            return Math.max(
              max,
              value
            );
          },
          0
        );

      const rows =
        newTextbooks.map(
          (
            textbook,
            index
          ) => ({
            curriculum_level_id:
              curriculumLevelId,

            textbook_id:
              textbook.id,

            category:
              textbook.category,

            /*
             * Grade에 사용할 수 있는
             * 후보교재라는 의미만 등록합니다.
             *
             * 주교재 자동 지정은 하지 않습니다.
             */
            is_primary:
              false,

            sort_order:
              maxSortOrder +
              (index + 1) *
                10,

            is_active:
              true,
          })
        );

      const {
        error: insertError,
      } =
        await adminClient
          .from(
            "curriculum_level_textbooks"
          )
          .insert(rows);

      if (
        insertError
      ) {
        return NextResponse.json(
          {
            error:
              `신규 교재 연결 실패: ${insertError.message}`,
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * 저장 후 실제 활성 연결 수 재확인
     */
    const {
      count:
        activeMappingCount,
      error:
        countError,
    } =
      await adminClient
        .from(
          "curriculum_level_textbooks"
        )
        .select(
          "id",
          {
            count:
              "exact",
            head:
              true,
          }
        )
        .eq(
          "curriculum_level_id",
          curriculumLevelId
        )
        .eq(
          "is_active",
          true
        );

    if (countError) {
      console.error(
        "CURRICULUM TEXTBOOK COUNT ERROR:",
        countError
      );
    }

    return NextResponse.json({
      success: true,

      curriculumLevelId:
        level.id,

      curriculumCode:
        level.code,

      curriculumName:
        level.name,

      selectedCount:
        textbookIds.length,

      activeMappingCount:
        activeMappingCount ??
        textbookIds.length,
    });
  } catch (error) {
    console.error(
      "CURRICULUM TEXTBOOK API ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "교재 연결 저장 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}