"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CurriculumLevel = {
  id: number;
  code: string;
  name: string;
  display_name: string | null;
  sort_order: number | null;
};

type Textbook = {
  id: number;
  title: string;
  publisher: string | null;
  category: string | null;
  sale_price: number | null;
  is_for_sale: boolean | null;
};

type TextbookMapping = {
  curriculum_level_id: number;
  textbook_id: number;
  category: string | null;
  sort_order: number | null;
};

type InitialAssignment = {
  textbookId: number;
  paymentRequired: boolean;
  priceSnapshot: number | null;
  adminNote: string | null;
  status: string;
};

type Props = {
  enrollmentId: number;
  tuitionPaid: boolean;
  curriculumLevels: CurriculumLevel[];
  textbooks: Textbook[];
  textbookMappings: TextbookMapping[];
  initialCurriculumLevelId: number | null;
  initialAssignments: InitialAssignment[];
};

type AssignmentState = {
  paymentRequired: boolean;
  adminNote: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  course_book: "Course Book",
  phonics: "Phonics",
  reading: "Reading",
  speaking: "Speaking",
  writing: "Writing",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  adult: "Adult",
};

export default function CurriculumTextbookAssignment({
  enrollmentId,
  tuitionPaid,
  curriculumLevels,
  textbooks,
  textbookMappings,
  initialCurriculumLevelId,
  initialAssignments,
}: Props) {
  const router = useRouter();

  const [curriculumLevelId, setCurriculumLevelId] =
    useState<number | null>(initialCurriculumLevelId);

  const [assignments, setAssignments] = useState<
    Record<number, AssignmentState>
  >(() => {
    const result: Record<number, AssignmentState> = {};

    for (const item of initialAssignments) {
      result[item.textbookId] = {
        paymentRequired: item.paymentRequired,
        adminNote: item.adminNote ?? "",
      };
    }

    return result;
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | ""
  >("");

  const textbookMap = useMemo(
    () =>
      new Map(
        textbooks.map((textbook) => [textbook.id, textbook])
      ),
    [textbooks]
  );

  const candidateTextbooks = useMemo(() => {
    if (!curriculumLevelId) {
      return [];
    }

    return textbookMappings
      .filter(
        (mapping) =>
          mapping.curriculum_level_id === curriculumLevelId
      )
      .sort(
        (a, b) =>
          (a.sort_order ?? 999) - (b.sort_order ?? 999)
      )
      .map((mapping) => {
        const textbook = textbookMap.get(mapping.textbook_id);

        if (!textbook) {
          return null;
        }

        return {
          ...textbook,
          mappedCategory:
            mapping.category ?? textbook.category ?? "",
        };
      })
      .filter(Boolean) as Array<
      Textbook & { mappedCategory: string }
    >;
  }, [
    curriculumLevelId,
    textbookMappings,
    textbookMap,
  ]);

  const groupedCandidates = useMemo(() => {
    const groups = new Map<
      string,
      Array<Textbook & { mappedCategory: string }>
    >();

    for (const textbook of candidateTextbooks) {
      const category =
        textbook.mappedCategory ||
        textbook.category ||
        "other";

      const rows = groups.get(category) ?? [];
      rows.push(textbook);
      groups.set(category, rows);
    }

    return Array.from(groups.entries());
  }, [candidateTextbooks]);

  const selectedCount =
    Object.keys(assignments).length;

  function toggleTextbook(textbook: Textbook) {
    setAssignments((current) => {
      const next = { ...current };

      if (next[textbook.id]) {
        delete next[textbook.id];
        return next;
      }

      next[textbook.id] = {
        paymentRequired: Boolean(
          textbook.is_for_sale &&
            textbook.sale_price !== null
        ),
        adminNote: "",
      };

      return next;
    });
  }

  function updateAssignment(
    textbookId: number,
    patch: Partial<AssignmentState>
  ) {
    setAssignments((current) => ({
      ...current,
      [textbookId]: {
        ...(current[textbookId] ?? {
          paymentRequired: false,
          adminNote: "",
        }),
        ...patch,
      },
    }));
  }

  function changeCurriculumLevel(value: string) {
    const nextId = value ? Number(value) : null;
    setCurriculumLevelId(nextId);
    setMessage("");
    setMessageType("");
  }

  async function save() {
    if (!tuitionPaid) {
      setMessageType("error");
      setMessage(
        "수강료 결제가 완료된 수강만 커리큘럼과 교재를 배정할 수 있습니다."
      );
      return;
    }

    if (!curriculumLevelId) {
      setMessageType("error");
      setMessage("TALKLY Grade를 선택해 주세요.");
      return;
    }

    if (selectedCount === 0) {
      setMessageType("error");
      setMessage("실제 수업에 사용할 교재를 1권 이상 선택해 주세요.");
      return;
    }

    setSaving(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch(
        `/api/admin/enrollments/${enrollmentId}/curriculum-textbooks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            curriculumLevelId,
            textbooks: Object.entries(assignments).map(
              ([textbookId, value]) => ({
                textbookId: Number(textbookId),
                paymentRequired: value.paymentRequired,
                adminNote: value.adminNote.trim() || null,
              })
            ),
          }),
        }
      );

      const contentType =
        response.headers.get("content-type") ?? "";

      const data = contentType.includes("application/json")
        ? await response.json()
        : null;

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `저장 중 오류가 발생했습니다. (HTTP ${response.status})`
        );
      }

      setMessageType("success");
      setMessage(
        `커리큘럼과 교재 ${data?.textbookCount ?? selectedCount}종이 저장되었습니다.`
      );

      router.refresh();
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "저장 중 오류가 발생했습니다."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      style={{
        marginTop: "24px",
        padding: "28px",
        border: "1px solid #d8e2ef",
        borderRadius: "12px",
        background: "#fbfdff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: "#0A1F44",
            }}
          >
            커리큘럼 · 교재 배정
          </h2>
          <p
            style={{
              margin: "8px 0 0",
              color: "#66758a",
              fontSize: "13px",
              lineHeight: 1.7,
            }}
          >
            학생의 실제 영어 수준과 학습 목표에 따라
            TALKLY Grade와 실제 수업 교재를 관리자가
            결정합니다.
          </p>
        </div>

        <span
          style={{
            padding: "7px 11px",
            borderRadius: "999px",
            background: tuitionPaid ? "#eaf8ef" : "#fff4e5",
            color: tuitionPaid ? "#247344" : "#9a6415",
            fontSize: "12px",
            fontWeight: 800,
          }}
        >
          {tuitionPaid
            ? "수강료 결제 완료"
            : "수강료 결제 확인 필요"}
        </span>
      </div>

      {!tuitionPaid && (
        <div
          style={{
            marginTop: "18px",
            padding: "14px 16px",
            borderRadius: "9px",
            background: "#fff8ec",
            border: "1px solid #f0dfb8",
            color: "#725a27",
            fontSize: "13px",
            lineHeight: 1.7,
          }}
        >
          결제 완료 수강에만 실제 커리큘럼과 교재를
          배정할 수 있습니다.
        </div>
      )}

      <div style={{ marginTop: "22px" }}>
        <label
          htmlFor="curriculum-level"
          style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "13px",
            fontWeight: 800,
          }}
        >
          TALKLY Grade
        </label>

        <select
          id="curriculum-level"
          value={curriculumLevelId ?? ""}
          onChange={(event) =>
            changeCurriculumLevel(event.target.value)
          }
          disabled={!tuitionPaid || saving}
          style={{
            width: "100%",
            maxWidth: "460px",
            minHeight: "44px",
            padding: "0 12px",
            border: "1px solid #ccd7e5",
            borderRadius: "8px",
            background: "#fff",
          }}
        >
          <option value="">Grade 선택</option>
          {curriculumLevels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name}
              {level.display_name
                ? ` · ${level.display_name}`
                : ""}
            </option>
          ))}
        </select>

        <p
          style={{
            margin: "7px 0 0",
            color: "#7b8797",
            fontSize: "11px",
          }}
        >
          TALKLY Grade는 실제 학교 학년이 아니라 영어
          실력 수준입니다.
        </p>
      </div>

      {curriculumLevelId && (
        <div style={{ marginTop: "26px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong>실제 수업 교재 선택</strong>
              <div
                style={{
                  marginTop: "4px",
                  color: "#7b8797",
                  fontSize: "12px",
                }}
              >
                선택 {selectedCount}종 · 해당 Grade에 연결된
                후보 교재 중 필요한 교재만 선택합니다.
              </div>
            </div>
          </div>

          {candidateTextbooks.length === 0 ? (
            <div
              style={{
                marginTop: "14px",
                padding: "18px",
                border: "1px dashed #cbd5e1",
                borderRadius: "9px",
                color: "#64748b",
              }}
            >
              이 Grade에 연결된 사용 가능 교재가 없습니다.
            </div>
          ) : (
            <div
              style={{
                marginTop: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
              }}
            >
              {groupedCandidates.map(([category, rows]) => (
                <div key={category}>
                  <div
                    style={{
                      marginBottom: "8px",
                      color: "#315f9c",
                      fontSize: "12px",
                      fontWeight: 900,
                    }}
                  >
                    {CATEGORY_LABELS[category] || category}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: "9px",
                    }}
                  >
                    {rows.map((textbook) => {
                      const selected =
                        Boolean(assignments[textbook.id]);

                      return (
                        <div
                          key={textbook.id}
                          style={{
                            padding: "13px 14px",
                            border: selected
                              ? "1px solid #6e9bd5"
                              : "1px solid #dbe3ed",
                            borderRadius: "9px",
                            background: selected
                              ? "#f4f8ff"
                              : "#fff",
                          }}
                        >
                          <label
                            style={{
                              display: "flex",
                              gap: "10px",
                              alignItems: "flex-start",
                              cursor: tuitionPaid
                                ? "pointer"
                                : "default",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={!tuitionPaid || saving}
                              onChange={() =>
                                toggleTextbook(textbook)
                              }
                              style={{
                                marginTop: "3px",
                              }}
                            />

                            <span style={{ flex: 1 }}>
                              <strong
                                style={{
                                  display: "block",
                                  fontSize: "13px",
                                }}
                              >
                                {textbook.title}
                              </strong>

                              <span
                                style={{
                                  display: "block",
                                  marginTop: "3px",
                                  color: "#7b8797",
                                  fontSize: "11px",
                                }}
                              >
                                {textbook.publisher ||
                                  "출판사 미등록"}
                                {textbook.sale_price !== null
                                  ? ` · 현재 판매가 ${Number(
                                      textbook.sale_price
                                    ).toLocaleString(
                                      "ko-KR"
                                    )}원`
                                  : " · 판매가 미등록"}
                              </span>
                            </span>
                          </label>

                          {selected && (
                            <div
                              style={{
                                marginTop: "12px",
                                paddingTop: "12px",
                                borderTop:
                                  "1px solid #dfe7f2",
                              }}
                            >
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    assignments[textbook.id]
                                      ?.paymentRequired ??
                                    false
                                  }
                                  disabled={saving}
                                  onChange={(event) =>
                                    updateAssignment(
                                      textbook.id,
                                      {
                                        paymentRequired:
                                          event.target.checked,
                                      }
                                    )
                                  }
                                />
                                이 교재는 별도 교재비 결제가
                                필요합니다.
                              </label>

                              <textarea
                                value={
                                  assignments[textbook.id]
                                    ?.adminNote ?? ""
                                }
                                disabled={saving}
                                onChange={(event) =>
                                  updateAssignment(
                                    textbook.id,
                                    {
                                      adminNote:
                                        event.target.value,
                                    }
                                  )
                                }
                                placeholder="선택 이유, 수업 활용 목적 등 관리자 메모 (선택)"
                                rows={2}
                                style={{
                                  width: "100%",
                                  marginTop: "10px",
                                  padding: "10px 11px",
                                  border:
                                    "1px solid #d5deea",
                                  borderRadius: "7px",
                                  resize: "vertical",
                                  boxSizing:
                                    "border-box",
                                  fontFamily: "inherit",
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {message && (
        <div
          style={{
            marginTop: "18px",
            padding: "12px 14px",
            borderRadius: "8px",
            background:
              messageType === "success"
                ? "#eaf8ef"
                : "#fff0f0",
            color:
              messageType === "success"
                ? "#247344"
                : "#a43b3b",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          {message}
        </div>
      )}

      <div
        style={{
          marginTop: "22px",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={save}
          disabled={
            !tuitionPaid ||
            saving ||
            !curriculumLevelId ||
            selectedCount === 0
          }
          style={{
            minHeight: "44px",
            padding: "0 18px",
            border: 0,
            borderRadius: "8px",
            background:
              !tuitionPaid ||
              !curriculumLevelId ||
              selectedCount === 0
                ? "#b8c2cf"
                : "#0A1F44",
            color: "#fff",
            fontWeight: 800,
            cursor:
              !tuitionPaid ||
              !curriculumLevelId ||
              selectedCount === 0
                ? "not-allowed"
                : "pointer",
          }}
        >
          {saving
            ? "저장 중..."
            : "커리큘럼 · 교재 배정 저장"}
        </button>
      </div>
    </section>
  );
}