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

  const [loading, setLoading] =
    useState(false);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const groupedTextbooks =
    useMemo(() => {
      const map =
        new Map<
          string,
          Textbook[]
        >();

      for (
        const category of
        CATEGORY_ORDER
      ) {
        map.set(
          category,
          []
        );
      }

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

      return Array.from(
        map.entries()
      ).filter(
        ([, books]) =>
          books.length > 0
      );
    }, [textbooks]);

  function toggleTextbook(
    textbookId: number
  ) {
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

      const data =
        await response.json();

      if (!response.ok) {
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
        marginTop: "20px",
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
          에서 관리자가 실제
          학생에게 배정할 수 있는
          후보군입니다. 체크했다고
          해서 학생에게 자동으로
          배정되지는 않습니다.
        </div>

        <div
          style={{
            marginTop:
              "16px",
            display:
              "flex",
            flexDirection:
              "column",
            gap: "14px",
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

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "9px",
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

                          <span>
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

        <div
          style={{
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: "12px",
            flexWrap:
              "wrap",
            marginTop:
              "16px",
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
            현재 선택{" "}
            <strong>
              {
                selectedIds.length
              }
              종
            </strong>
          </div>

          <button
            type="button"
            disabled={loading}
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
            }}
          >
            {loading
              ? "저장 중..."
              : "교재 연결 저장"}
          </button>
        </div>

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
            }}
          >
            {
              successMessage
            }
          </div>
        )}

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