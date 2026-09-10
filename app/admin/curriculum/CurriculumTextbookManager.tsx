"use client";

import {
  useMemo,
  useState,
} from "react";

type Textbook = {
  id: number;
  title: string;
  publisher: string | null;
  category: string | null;
  status: string | null;
  is_active: boolean;
};

type Mapping = {
  textbook_id: number;
  is_active: boolean;
};

type Props = {
  levelId: number;
  levelName: string;
  textbooks: Textbook[];
  mappings: Mapping[];
};

const CATEGORY_ORDER = [
  "course_book",
  "phonics",
  "reading",
  "speaking",
  "writing",
  "grammar",
  "vocabulary",
  "adult",
];

const CATEGORY_LABELS: Record<
  string,
  string
> = {
  course_book: "COURSE BOOK",
  phonics: "PHONICS",
  reading: "READING",
  speaking: "SPEAKING",
  writing: "WRITING",
  grammar: "GRAMMAR",
  vocabulary: "VOCA",
  adult: "ADULT",
};

export default function CurriculumTextbookManager({
  levelId,
  levelName,
  textbooks,
  mappings,
}: Props) {
  /*
   * 현재 활성화되어 있는 기존 교재 연결
   */
  const initialIds =
    useMemo(() => {
      return mappings
        .filter(
          (mapping) =>
            mapping.is_active
        )
        .map(
          (mapping) =>
            mapping.textbook_id
        );
    }, [mappings]);

  const [
    selectedIds,
    setSelectedIds,
  ] = useState<number[]>(
    initialIds
  );

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  /*
   * =========================================================
   * 교재를 분야별로 묶습니다.
   * =========================================================
   */
  const groupedTextbooks =
    useMemo(() => {
      const map =
        new Map<
          string,
          Textbook[]
        >();

      /*
       * 기본 카테고리 순서 생성
       */
      for (
        const category of
        CATEGORY_ORDER
      ) {
        map.set(
          category,
          []
        );
      }

      /*
       * 활성 교재만 후보에 표시
       */
      for (
        const textbook of
        textbooks
      ) {
        if (
          !textbook.is_active
        ) {
          continue;
        }

        const category =
          textbook.category ||
          "other";

        const current =
          map.get(
            category
          ) ?? [];

        current.push(
          textbook
        );

        map.set(
          category,
          current
        );
      }

      /*
       * 교재가 없는 카테고리는 숨김
       */
      return Array.from(
        map.entries()
      ).filter(
        ([, books]) =>
          books.length > 0
      );
    }, [textbooks]);

  /*
   * =========================================================
   * 체크박스 ON / OFF
   * =========================================================
   */
  function toggleTextbook(
    textbookId: number
  ) {
    if (loading) {
      return;
    }

    setSelectedIds(
      (current) => {
        if (
          current.includes(
            textbookId
          )
        ) {
          return current.filter(
            (id) =>
              id !== textbookId
          );
        }

        return [
          ...current,
          textbookId,
        ];
      }
    );
  }

  /*
   * =========================================================
   * 저장
   * =========================================================
   */
  async function handleSave() {
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/curriculum/textbooks",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials:
              "same-origin",

            body:
              JSON.stringify({
                curriculumLevelId:
                  levelId,

                textbookIds:
                  selectedIds,
              }),
          }
        );

      /*
       * 중요
       *
       * response.json()을 바로 호출하지 않습니다.
       *
       * Next.js/Vercel에서 API 오류가 발생하면
       * 경우에 따라 HTML 오류 페이지가
       * 반환될 수 있습니다.
       *
       * 그래서 먼저 text()로 받은 뒤
       * JSON인지 직접 확인합니다.
       */
      const responseText =
        await response.text();

      let data: {
        success?: boolean;
        error?: string;
        curriculumLevelId?: number;
        curriculumCode?: string;
        selectedCount?: number;
      } = {};

      if (responseText) {
        try {
          data =
            JSON.parse(
              responseText
            );
        } catch {
          console.error(
            "CURRICULUM TEXTBOOK API NON-JSON RESPONSE:",
            {
              status:
                response.status,

              statusText:
                response.statusText,

              response:
                responseText.slice(
                  0,
                  1500
                ),
            }
          );

          /*
           * HTML이 반환되었을 때
           * 기존처럼
           *
           * Unexpected token '<'
           *
           * 만 보여주는 대신
           * HTTP 상태를 관리자에게 표시합니다.
           */
          throw new Error(
            `교재 연결 API가 정상적인 JSON 응답을 반환하지 않았습니다. (HTTP ${response.status})`
          );
        }
      }

      /*
       * API가 JSON 오류를 정상적으로 반환한 경우
       */
      if (!response.ok) {
        throw new Error(
          data.error ||
            `교재 연결 저장에 실패했습니다. (HTTP ${response.status})`
        );
      }

      /*
       * response.ok인데
       * success=false 또는 값이 없는 경우도 방어
       */
      if (
        data.success === false
      ) {
        throw new Error(
          data.error ||
            "교재 연결 저장에 실패했습니다."
        );
      }

      setSuccessMessage(
        `${levelName} 교재 연결이 저장되었습니다. (${selectedIds.length}종)`
      );
    } catch (error) {
      console.error(
        "CURRICULUM TEXTBOOK SAVE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "교재 연결 저장 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <details
      style={{
        marginTop:
          "20px",

        border:
          "1px solid #dce3ed",

        borderRadius:
          "13px",

        background:
          "#ffffff",
      }}
    >
      <summary
        style={{
          padding:
            "15px 17px",

          cursor:
            "pointer",

          color:
            "#0A1F44",

          fontSize:
            "13px",

          fontWeight:
            900,

          userSelect:
            "none",
        }}
      >
        교재 연결 관리
      </summary>

      <div
        style={{
          padding:
            "4px 17px 18px",
        }}
      >
        {/* =====================================
            안내
        ====================================== */}
        <div
          style={{
            padding:
              "13px 14px",

            borderRadius:
              "10px",

            background:
              "#f5f8fd",

            color:
              "#526079",

            fontSize:
              "12px",

            lineHeight:
              1.7,
          }}
        >
          선택한 교재는{" "}
          <strong>
            {levelName}
          </strong>
          에서 사용할 수 있는
          교재 후보군입니다.
          체크했다고 해서 특정
          학생에게 자동 배정되지는
          않습니다.
        </div>

        {/* =====================================
            현재 선택 수
        ====================================== */}
        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "center",

            gap:
              "12px",

            flexWrap:
              "wrap",

            marginTop:
              "14px",

            padding:
              "11px 13px",

            borderRadius:
              "10px",

            background:
              "#fafbfc",

            border:
              "1px solid #edf0f4",
          }}
        >
          <div
            style={{
              color:
                "#667085",

              fontSize:
                "12px",
            }}
          >
            현재 선택{" "}
            <strong
              style={{
                color:
                  "#0A1F44",
              }}
            >
              {
                selectedIds.length
              }
              종
            </strong>
          </div>

          <div
            style={{
              color:
                "#98a2b3",

              fontSize:
                "11px",
            }}
          >
            실제 학생 교재
            배정과는 별도
          </div>
        </div>

        {/* =====================================
            교재 분야별 목록
        ====================================== */}
        <div
          style={{
            marginTop:
              "16px",

            display:
              "flex",

            flexDirection:
              "column",

            gap:
              "14px",
          }}
        >
          {groupedTextbooks.map(
            ([
              category,
              books,
            ]) => (
              <section
                key={
                  category
                }
                style={{
                  padding:
                    "15px",

                  border:
                    "1px solid #e3e8f0",

                  borderRadius:
                    "12px",

                  background:
                    "#ffffff",
                }}
              >
                {/* CATEGORY */}
                <div
                  style={{
                    marginBottom:
                      "11px",

                    color:
                      "#55739b",

                    fontSize:
                      "11px",

                    fontWeight:
                      900,

                    letterSpacing:
                      "0.04em",
                  }}
                >
                  {CATEGORY_LABELS[
                    category
                  ] ||
                    category.toUpperCase()}
                </div>

                {/* BOOKS */}
                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",

                    gap:
                      "9px",
                  }}
                >
                  {books.map(
                    (
                      textbook
                    ) => {
                      const checked =
                        selectedIds.includes(
                          textbook.id
                        );

                      return (
                        <label
                          key={
                            textbook.id
                          }
                          style={{
                            display:
                              "flex",

                            alignItems:
                              "flex-start",

                            gap:
                              "9px",

                            padding:
                              "11px",

                            border:
                              checked
                                ? "2px solid #0A1F44"
                                : "1px solid #e1e6ee",

                            borderRadius:
                              "10px",

                            background:
                              checked
                                ? "#f4f7fb"
                                : "#ffffff",

                            cursor:
                              loading
                                ? "default"
                                : "pointer",

                            opacity:
                              loading
                                ? 0.7
                                : 1,
                          }}
                        >
                          <input
                            type="checkbox"

                            checked={
                              checked
                            }

                            disabled={
                              loading
                            }

                            onChange={() =>
                              toggleTextbook(
                                textbook.id
                              )
                            }

                            style={{
                              marginTop:
                                "3px",
                            }}
                          />

                          <span
                            style={{
                              minWidth:
                                0,
                            }}
                          >
                            <strong
                              style={{
                                display:
                                  "block",

                                color:
                                  "#25324a",

                                fontSize:
                                  "13px",

                                lineHeight:
                                  1.45,

                                wordBreak:
                                  "break-word",
                              }}
                            >
                              {
                                textbook.title
                              }
                            </strong>

                            <span
                              style={{
                                display:
                                  "block",

                                marginTop:
                                  "3px",

                                color:
                                  "#8b95a7",

                                fontSize:
                                  "10px",

                                lineHeight:
                                  1.5,
                              }}
                            >
                              {textbook.publisher ||
                                "출판사 미등록"}

                              {" · "}

                              {textbook.status ===
                              "ready"
                                ? "사용 가능"
                                : "작업 중"}
                            </span>
                          </span>
                        </label>
                      );
                    }
                  )}
                </div>
              </section>
            )
          )}
        </div>

        {/* =====================================
            저장 버튼
        ====================================== */}
        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "center",

            gap:
              "12px",

            flexWrap:
              "wrap",

            marginTop:
              "18px",
          }}
        >
          <div
            style={{
              fontSize:
                "12px",

              color:
                "#667085",
            }}
          >
            선택한 교재{" "}
            <strong
              style={{
                color:
                  "#0A1F44",
              }}
            >
              {
                selectedIds.length
              }
              종
            </strong>
            을 {levelName} 후보
            교재로 저장합니다.
          </div>

          <button
            type="button"

            disabled={
              loading
            }

            onClick={
              handleSave
            }

            style={{
              border:
                "none",

              borderRadius:
                "10px",

              padding:
                "12px 18px",

              background:
                "#0A1F44",

              color:
                "#ffffff",

              fontSize:
                "13px",

              fontWeight:
                900,

              cursor:
                loading
                  ? "default"
                  : "pointer",

              opacity:
                loading
                  ? 0.65
                  : 1,

              minWidth:
                "132px",
            }}
          >
            {loading
              ? "저장 중..."
              : "교재 연결 저장"}
          </button>
        </div>

        {/* =====================================
            성공 메시지
        ====================================== */}
        {successMessage && (
          <div
            style={{
              marginTop:
                "12px",

              padding:
                "12px 14px",

              border:
                "1px solid #b7dfc3",

              borderRadius:
                "10px",

              background:
                "#f2fbf5",

              color:
                "#176b36",

              fontSize:
                "12px",

              fontWeight:
                800,

              lineHeight:
                1.6,
            }}
          >
            {
              successMessage
            }
          </div>
        )}

        {/* =====================================
            오류 메시지
        ====================================== */}
        {errorMessage && (
          <div
            style={{
              marginTop:
                "12px",

              padding:
                "12px 14px",

              border:
                "1px solid #f0b7b2",

              borderRadius:
                "10px",

              background:
                "#fff6f5",

              color:
                "#b42318",

              fontSize:
                "12px",

              fontWeight:
                800,

              lineHeight:
                1.6,

              wordBreak:
                "break-word",
            }}
          >
            {
              errorMessage
            }
          </div>
        )}
      </div>
    </details>
  );
}