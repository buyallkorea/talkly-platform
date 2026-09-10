"use client";

import {
  FormEvent,
  useState,
} from "react";

import Link from "next/link";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase-browser";

type Textbook = {
  id: number;
  title: string;
  publisher: string | null;
  description: string | null;
  cover_image_url: string | null;
  category: string | null;
  original_file_url: string | null;
  original_file_type: string | null;
  page_count: number;
  status: string;
  is_for_sale: boolean;
  sale_price: number | null;
  external_purchase_url:
    | string
    | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type CurriculumLevel = {
  id: number;
  code: string;
  name: string;
  display_name:
    | string
    | null;
  sort_order:
    | number
    | null;
  is_active: boolean;
};

type Props = {
  textbook: Textbook;
  pageDataCount: number;
  curriculumLevels:
    CurriculumLevel[];
  selectedCurriculumLevelIds:
    number[];
  coverImagePreviewUrl:
    | string
    | null;
};

const CATEGORY_OPTIONS = [
  {
    value: "course_book",
    label: "Course Book",
  },
  {
    value: "phonics",
    label: "Phonics",
  },
  {
    value: "reading",
    label: "Reading",
  },
  {
    value: "speaking",
    label: "Speaking",
  },
  {
    value: "writing",
    label: "Writing",
  },
  {
    value: "grammar",
    label: "Grammar",
  },
  {
    value: "vocabulary",
    label: "Voca",
  },
  {
    value: "adult",
    label: "Adult",
  },
  {
    value: "other",
    label: "기타",
  },
];

const ALLOWED_COVER_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
];

function getExtension(
  filename: string
) {
  const parts =
    filename
      .toLowerCase()
      .split(".");

  return parts.length > 1
    ? parts.pop() || ""
    : "";
}

function sanitizeFilename(
  filename: string
) {
  return filename
    .normalize("NFKD")
    .replace(
      /[^\w.\-]+/g,
      "_"
    )
    .replace(
      /_+/g,
      "_"
    );
}

function formatPriceInput(
  value: string
) {
  const digits =
    value.replace(
      /\D/g,
      ""
    );

  if (!digits) {
    return "";
  }

  return Number(
    digits
  ).toLocaleString(
    "ko-KR"
  );
}

export default function EditTextbookForm({
  textbook,
  pageDataCount,
  curriculumLevels,
  selectedCurriculumLevelIds,
  coverImagePreviewUrl,
}: Props) {
  const router =
    useRouter();

  const [title, setTitle] =
    useState(
      textbook.title
    );

  const [
    publisher,
    setPublisher,
  ] =
    useState(
      textbook.publisher ||
        ""
    );

  const [
    category,
    setCategory,
  ] =
    useState(
      textbook.category ||
        "other"
    );

  const [
    description,
    setDescription,
  ] =
    useState(
      textbook.description ||
        ""
    );

  const [
    status,
    setStatus,
  ] =
    useState(
      textbook.status
    );

  const [
    isActive,
    setIsActive,
  ] =
    useState(
      textbook.is_active
    );

  const [
    isForSale,
    setIsForSale,
  ] =
    useState(
      textbook.is_for_sale
    );

  const [
    salePrice,
    setSalePrice,
  ] =
    useState(
      textbook.sale_price !==
      null
        ? Number(
            textbook.sale_price
          ).toLocaleString(
            "ko-KR"
          )
        : ""
    );

  const [
    externalPurchaseUrl,
    setExternalPurchaseUrl,
  ] =
    useState(
      textbook.external_purchase_url ||
        ""
    );

  const [
    selectedLevels,
    setSelectedLevels,
  ] =
    useState<number[]>(
      selectedCurriculumLevelIds
    );

  const [
    coverFile,
    setCoverFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    localCoverPreview,
    setLocalCoverPreview,
  ] =
    useState<
      string | null
    >(
      coverImagePreviewUrl
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  function toggleLevel(
    levelId: number
  ) {
    setSelectedLevels(
      (current) => {
        if (
          current.includes(
            levelId
          )
        ) {
          return current.filter(
            (id) =>
              id !== levelId
          );
        }

        return [
          ...current,
          levelId,
        ];
      }
    );

    setSuccessMessage("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!title.trim()) {
      setErrorMessage(
        "교재명을 입력해주세요."
      );
      return;
    }

    if (!category) {
      setErrorMessage(
        "교재 분야를 선택해주세요."
      );
      return;
    }

    if (
      status !== "draft" &&
      status !== "ready"
    ) {
      setErrorMessage(
        "교재 상태를 확인해주세요."
      );
      return;
    }

    let parsedSalePrice:
      | number
      | null = null;

    if (isForSale) {
      const digits =
        salePrice.replace(
          /\D/g,
          ""
        );

      if (!digits) {
        setErrorMessage(
          "TALKLY 판매 교재는 판매가를 입력해주세요."
        );
        return;
      }

      parsedSalePrice =
        Number(digits);

      if (
        !Number.isFinite(
          parsedSalePrice
        ) ||
        parsedSalePrice < 0
      ) {
        setErrorMessage(
          "판매가를 정확하게 입력해주세요."
        );
        return;
      }
    }

    if (coverFile) {
      const extension =
        getExtension(
          coverFile.name
        );

      if (
        !ALLOWED_COVER_EXTENSIONS.includes(
          extension
        )
      ) {
        setErrorMessage(
          "표지 이미지는 JPG, JPEG, PNG, WEBP 파일만 등록할 수 있습니다."
        );
        return;
      }
    }

    setLoading(true);

    let newCoverPath:
      | string
      | null = null;

    try {
      const supabase =
        createClient();

      /*
       * =====================================================
       * 새 표지 이미지가 선택되었다면
       * 먼저 Storage에 업로드
       * =====================================================
       */
      if (coverFile) {
        const uploadId =
          crypto.randomUUID();

        const safeFilename =
          sanitizeFilename(
            coverFile.name
          );

        newCoverPath =
          `uploads/${uploadId}/cover/${safeFilename}`;

        const {
          error:
            uploadError,
        } =
          await supabase.storage
            .from(
              "textbook-files"
            )
            .upload(
              newCoverPath,
              coverFile,
              {
                cacheControl:
                  "3600",
                upsert:
                  false,
                contentType:
                  coverFile.type ||
                  undefined,
              }
            );

        if (uploadError) {
          throw new Error(
            `표지 이미지 업로드 실패: ${uploadError.message}`
          );
        }
      }

      /*
       * =====================================================
       * DB 수정은 관리자 API에서 처리
       * =====================================================
       */
      const response =
        await fetch(
          `/api/admin/textbooks/${textbook.id}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials:
              "same-origin",

            body:
              JSON.stringify({
                title:
                  title.trim(),

                publisher:
                  publisher.trim() ||
                  null,

                category,

                description:
                  description.trim() ||
                  null,

                status,

                isActive,

                isForSale,

                salePrice:
                  isForSale
                    ? parsedSalePrice
                    : null,

                externalPurchaseUrl:
                  externalPurchaseUrl.trim() ||
                  null,

                /*
                 * 새 표지를 올리지 않았다면
                 * 기존 path를 유지합니다.
                 */
                coverImageUrl:
                  newCoverPath ??
                  textbook.cover_image_url,

                curriculumLevelIds:
                  selectedLevels,
              }),
          }
        );

      const responseText =
        await response.text();

      let data: {
        success?: boolean;
        error?: string;
      } = {};

      if (responseText) {
        try {
          data =
            JSON.parse(
              responseText
            );
        } catch {
          throw new Error(
            `교재 수정 API가 정상적인 JSON 응답을 반환하지 않았습니다. (HTTP ${response.status})`
          );
        }
      }

      if (!response.ok) {
        /*
         * DB 수정 실패 시
         * 이번 요청에서 새로 업로드한
         * 표지 파일만 정리합니다.
         */
        if (newCoverPath) {
          await supabase.storage
            .from(
              "textbook-files"
            )
            .remove([
              newCoverPath,
            ]);
        }

        throw new Error(
          data.error ||
            `교재 수정에 실패했습니다. (HTTP ${response.status})`
        );
      }

      setSuccessMessage(
        "교재 정보가 정상적으로 수정되었습니다."
      );

      /*
       * 새 표지 업로드 직후에는
       * 브라우저 로컬 Preview를
       * 그대로 보여줍니다.
       */
      router.refresh();
    } catch (error) {
      console.error(
        "TEXTBOOK UPDATE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "교재 수정 중 알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        marginTop:
          "22px",
        padding:
          "26px",
        border:
          "1px solid #e4e7ec",
        borderRadius:
          "16px",
        background:
          "#ffffff",
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            color:
              "#101828",
            fontSize:
              "20px",
            letterSpacing:
              "-0.02em",
          }}
        >
          교재 정보 수정
        </h2>

        <p
          style={{
            margin:
              "8px 0 0",
            color:
              "#667085",
            fontSize:
              "13px",
            lineHeight:
              1.7,
          }}
        >
          교재 기본정보,
          표지 이미지,
          커리큘럼 Grade와
          판매정보를 관리합니다.
        </p>
      </div>

      <form
        onSubmit={
          handleSubmit
        }
        style={{
          marginTop:
            "26px",
          display:
            "flex",
          flexDirection:
            "column",
          gap: "24px",
        }}
      >
        {/* =================================================
            기본정보
        ================================================== */}
        <SectionBox
          title="기본 정보"
          description="교재명, 출판사 및 교재 분야를 관리합니다."
        >
          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "16px",
            }}
          >
            <div>
              <label
                htmlFor="title"
                style={
                  labelStyle
                }
              >
                교재명 *
              </label>

              <input
                id="title"
                type="text"
                value={title}
                onChange={(
                  event
                ) => {
                  setTitle(
                    event
                      .target
                      .value
                  );
                  setSuccessMessage(
                    ""
                  );
                }}
                disabled={
                  loading
                }
                style={
                  fieldStyle
                }
              />
            </div>

            <div>
              <label
                htmlFor="publisher"
                style={
                  labelStyle
                }
              >
                출판사
              </label>

              <input
                id="publisher"
                type="text"
                value={
                  publisher
                }
                onChange={(
                  event
                ) => {
                  setPublisher(
                    event
                      .target
                      .value
                  );
                  setSuccessMessage(
                    ""
                  );
                }}
                placeholder="예: Oxford University Press"
                disabled={
                  loading
                }
                style={
                  fieldStyle
                }
              />
            </div>

            <div>
              <label
                htmlFor="category"
                style={
                  labelStyle
                }
              >
                교재 분야 *
              </label>

              <select
                id="category"
                value={
                  category
                }
                onChange={(
                  event
                ) => {
                  setCategory(
                    event
                      .target
                      .value
                  );
                  setSuccessMessage(
                    ""
                  );
                }}
                disabled={
                  loading
                }
                style={
                  fieldStyle
                }
              >
                {CATEGORY_OPTIONS.map(
                  (item) => (
                    <option
                      key={
                        item.value
                      }
                      value={
                        item.value
                      }
                    >
                      {
                        item.label
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="status"
                style={
                  labelStyle
                }
              >
                교재 상태
              </label>

              <select
                id="status"
                value={
                  status
                }
                onChange={(
                  event
                ) => {
                  setStatus(
                    event
                      .target
                      .value
                  );
                  setSuccessMessage(
                    ""
                  );
                }}
                disabled={
                  loading
                }
                style={
                  fieldStyle
                }
              >
                <option value="draft">
                  작업 중
                </option>

                <option value="ready">
                  사용 가능
                </option>
              </select>
            </div>
          </div>

          <div
            style={{
              marginTop:
                "18px",
            }}
          >
            <label
              htmlFor="description"
              style={
                labelStyle
              }
            >
              교재 설명
            </label>

            <textarea
              id="description"
              value={
                description
              }
              onChange={(
                event
              ) => {
                setDescription(
                  event.target
                    .value
                );
                setSuccessMessage(
                  ""
                );
              }}
              rows={5}
              placeholder="교재 특징과 수업 활용 목적을 입력해주세요."
              disabled={
                loading
              }
              style={{
                ...fieldStyle,
                padding:
                  "13px 14px",
                resize:
                  "vertical",
                lineHeight:
                  1.7,
              }}
            />
          </div>

          <label
            style={{
              display:
                "flex",
              alignItems:
                "center",
              gap: "10px",
              marginTop:
                "18px",
              padding:
                "13px 14px",
              borderRadius:
                "10px",
              background:
                "#f8fafc",
              fontSize:
                "13px",
              fontWeight:
                800,
              color:
                "#344054",
            }}
          >
            <input
              type="checkbox"
              checked={
                isActive
              }
              disabled={
                loading
              }
              onChange={(
                event
              ) => {
                setIsActive(
                  event.target
                    .checked
                );
                setSuccessMessage(
                  ""
                );
              }}
            />

            교재를 활성 상태로
            운영합니다.
          </label>
        </SectionBox>

        {/* =================================================
            표지 이미지
        ================================================== */}
        <SectionBox
          title="교재 표지 이미지"
          description="학부모·학생 및 관리자 화면에서 보여줄 대표 이미지를 별도로 등록합니다."
        >
          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "180px minmax(0, 1fr)",
              gap: "22px",
              alignItems:
                "start",
            }}
          >
            <div
              style={{
                width:
                  "180px",
                aspectRatio:
                  "3 / 4",
                border:
                  "1px solid #e4e7ec",
                borderRadius:
                  "12px",
                overflow:
                  "hidden",
                background:
                  "#f8fafc",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
              }}
            >
              {localCoverPreview ? (
                <img
                  src={
                    localCoverPreview
                  }
                  alt={`${title} 표지`}
                  style={{
                    width:
                      "100%",
                    height:
                      "100%",
                    objectFit:
                      "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    padding:
                      "18px",
                    textAlign:
                      "center",
                    color:
                      "#98a2b3",
                    fontSize:
                      "12px",
                    lineHeight:
                      1.6,
                  }}
                >
                  표지 이미지
                  미등록
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="coverFile"
                style={
                  labelStyle
                }
              >
                새 표지 이미지
              </label>

              <input
                id="coverFile"
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                disabled={
                  loading
                }
                onChange={(
                  event
                ) => {
                  const file =
                    event
                      .target
                      .files?.[0] ??
                    null;

                  setCoverFile(
                    file
                  );

                  setSuccessMessage(
                    ""
                  );

                  if (file) {
                    const preview =
                      URL.createObjectURL(
                        file
                      );

                    setLocalCoverPreview(
                      preview
                    );
                  } else {
                    setLocalCoverPreview(
                      coverImagePreviewUrl
                    );
                  }
                }}
                style={
                  fieldStyle
                }
              />

              <p
                style={
                  helperStyle
                }
              >
                JPG, PNG, WEBP
                권장. 교재 원본
                PDF와는 별도로
                저장됩니다.
              </p>

              <div
                style={{
                  marginTop:
                    "15px",
                  padding:
                    "14px",
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
                원본 교재의 첫
                페이지를 표지로
                강제 사용하지
                않습니다. 표지가
                없는 경우에는
                나중에 PDF 첫
                페이지로 자동
                생성하는 보조
                기능을 추가할 수
                있습니다.
              </div>
            </div>
          </div>
        </SectionBox>

        {/* =================================================
            TALKLY Grade
        ================================================== */}
        <SectionBox
          title="적용 TALKLY Grade"
          description="실제 학교 학년이 아니라 영어 수준에 따라 이 교재를 사용할 수 있는 커리큘럼 Grade를 선택합니다."
        >
          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "9px",
            }}
          >
            {curriculumLevels.map(
              (level) => {
                const checked =
                  selectedLevels.includes(
                    level.id
                  );

                return (
                  <label
                    key={
                      level.id
                    }
                    style={{
                      display:
                        "flex",
                      gap: "8px",
                      alignItems:
                        "flex-start",
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
                        toggleLevel(
                          level.id
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
                            "#0A1F44",
                          fontSize:
                            "12px",
                        }}
                      >
                        {
                          level.code
                        }
                      </strong>

                      <span
                        style={{
                          display:
                            "block",
                          marginTop:
                            "2px",
                          color:
                            "#8b95a7",
                          fontSize:
                            "10px",
                          lineHeight:
                            1.4,
                        }}
                      >
                        {level.display_name ||
                          level.name}
                      </span>
                    </span>
                  </label>
                );
              }
            )}
          </div>

          <p
            style={
              helperStyle
            }
          >
            현재 선택{" "}
            <strong>
              {
                selectedLevels.length
              }
              개
            </strong>
          </p>
        </SectionBox>

        {/* =================================================
            판매
        ================================================== */}
        <SectionBox
          title="교재 판매"
          description="수강료와 별도로 결제되는 TALKLY 교재 판매 정보를 관리합니다."
        >
          <label
            style={{
              display:
                "flex",
              alignItems:
                "center",
              gap: "10px",
              fontSize:
                "13px",
              fontWeight:
                800,
              color:
                "#344054",
            }}
          >
            <input
              type="checkbox"
              checked={
                isForSale
              }
              disabled={
                loading
              }
              onChange={(
                event
              ) => {
                const checked =
                  event.target
                    .checked;

                setIsForSale(
                  checked
                );

                if (!checked) {
                  setSalePrice(
                    ""
                  );
                }

                setSuccessMessage(
                  ""
                );
              }}
            />

            TALKLY에서 판매하는
            교재입니다.
          </label>

          {isForSale && (
            <div
              style={{
                marginTop:
                  "18px",
                maxWidth:
                  "340px",
              }}
            >
              <label
                htmlFor="salePrice"
                style={
                  labelStyle
                }
              >
                판매가격 *
              </label>

              <input
                id="salePrice"
                type="text"
                inputMode="numeric"
                value={
                  salePrice
                }
                disabled={
                  loading
                }
                onChange={(
                  event
                ) =>
                  setSalePrice(
                    formatPriceInput(
                      event
                        .target
                        .value
                    )
                  )
                }
                placeholder="18,000"
                style={
                  fieldStyle
                }
              />

              <p
                style={
                  helperStyle
                }
              >
                실제 학생에게
                교재를 배정할 때
                별도의 가격
                snapshot을
                생성하게 됩니다.
              </p>
            </div>
          )}

          <div
            style={{
              marginTop:
                "18px",
            }}
          >
            <label
              htmlFor="externalPurchaseUrl"
              style={
                labelStyle
              }
            >
              외부 참고 URL
            </label>

            <input
              id="externalPurchaseUrl"
              type="url"
              value={
                externalPurchaseUrl
              }
              disabled={
                loading
              }
              onChange={(
                event
              ) =>
                setExternalPurchaseUrl(
                  event.target
                    .value
                )
              }
              placeholder="https://..."
              style={
                fieldStyle
              }
            />

            <p
              style={
                helperStyle
              }
            >
              관리자용 참고
              주소입니다. 학부모
              화면에서 외부 구매
              선택지로 자동
              노출하지 않습니다.
            </p>
          </div>
        </SectionBox>

        {/* =================================================
            원본 콘텐츠
        ================================================== */}
        <SectionBox
          title="수업용 원본 콘텐츠"
          description="현재 연결된 원본 파일 상태입니다. 이번 단계에서는 기존 원본 파일을 안전하게 유지합니다."
        >
          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "12px",
            }}
          >
            <FileInfo
              label="파일 유형"
              value={
                textbook.original_file_type
                  ? textbook.original_file_type.toUpperCase()
                  : "-"
              }
            />

            <FileInfo
              label="교재 페이지"
              value={`${textbook.page_count ?? 0}페이지`}
            />

            <FileInfo
              label="페이지 데이터"
              value={`${pageDataCount}건`}
            />
          </div>

          {textbook.original_file_url && (
            <div
              style={{
                marginTop:
                  "15px",
                padding:
                  "12px",
                borderRadius:
                  "9px",
                background:
                  "#f8fafc",
                color:
                  "#667085",
                fontSize:
                  "10px",
                lineHeight:
                  1.6,
                wordBreak:
                  "break-all",
              }}
            >
              Storage path:{" "}
              {
                textbook.original_file_url
              }
            </div>
          )}

          <div
            style={{
              marginTop:
                "15px",
              padding:
                "14px",
              border:
                "1px solid #dbe7ff",
              borderRadius:
                "10px",
              background:
                "#f5f8ff",
              color:
                "#526079",
              fontSize:
                "11px",
              lineHeight:
                1.7,
            }}
          >
            원본 PDF/eBook을
            교체하면 기존
            textbook_pages와
            수업용 Viewer에
            영향을 줄 수
            있으므로, 이번
            수정에서는 원본
            파일을 변경하지
            않습니다. 별도의
            안전한 원본 교체
            기능으로 추가합니다.
          </div>
        </SectionBox>

        {errorMessage && (
          <div
            style={{
              padding:
                "14px 16px",
              border:
                "1px solid #fda29b",
              borderRadius:
                "10px",
              background:
                "#fffbfa",
              color:
                "#b42318",
              fontSize:
                "12px",
              fontWeight:
                700,
              lineHeight:
                1.6,
            }}
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              padding:
                "14px 16px",
              border:
                "1px solid #abefc6",
              borderRadius:
                "10px",
              background:
                "#ecfdf3",
              color:
                "#027a48",
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

        <div
          style={{
            paddingTop:
              "4px",
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: "12px",
            flexWrap:
              "wrap",
          }}
        >
          <Link
            href={`/admin/textbooks/${textbook.id}`}
            style={{
              minHeight:
                "46px",
              padding:
                "0 18px",
              display:
                "inline-flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              border:
                "1px solid #d0d5dd",
              borderRadius:
                "10px",
              background:
                "#ffffff",
              color:
                "#344054",
              textDecoration:
                "none",
              fontSize:
                "13px",
              fontWeight:
                800,
            }}
          >
            ← 수정 취소
          </Link>

          <button
            type="submit"
            disabled={
              loading
            }
            style={{
              minHeight:
                "46px",
              padding:
                "0 22px",
              border:
                "none",
              borderRadius:
                "10px",
              background:
                loading
                  ? "#98a2b3"
                  : "#0A1F44",
              color:
                "#ffffff",
              fontFamily:
                "inherit",
              fontSize:
                "13px",
              fontWeight:
                900,
              cursor:
                loading
                  ? "default"
                  : "pointer",
            }}
          >
            {loading
              ? "저장 중..."
              : "변경사항 저장"}
          </button>
        </div>
      </form>
    </section>
  );
}

function SectionBox({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children:
    React.ReactNode;
}) {
  return (
    <section
      style={{
        padding:
          "20px",
        border:
          "1px solid #e4e7ec",
        borderRadius:
          "13px",
        background:
          "#ffffff",
      }}
    >
      <div
        style={{
          color:
            "#101828",
          fontSize:
            "15px",
          fontWeight:
            900,
        }}
      >
        {title}
      </div>

      <p
        style={{
          margin:
            "6px 0 18px",
          color:
            "#667085",
          fontSize:
            "11px",
          lineHeight:
            1.7,
        }}
      >
        {description}
      </p>

      {children}
    </section>
  );
}

function FileInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding:
          "13px",
        border:
          "1px solid #e4e7ec",
        borderRadius:
          "9px",
        background:
          "#f9fafb",
      }}
    >
      <div
        style={{
          color:
            "#98a2b3",
          fontSize:
            "10px",
          fontWeight:
            800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "6px",
          color:
            "#344054",
          fontSize:
            "13px",
          fontWeight:
            900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  color: "#344054",
  fontSize: "13px",
  fontWeight: 800,
};

const helperStyle = {
  margin:
    "8px 0 0",
  color: "#98a2b3",
  fontSize: "11px",
  lineHeight: 1.6,
};

const fieldStyle = {
  width: "100%",
  minHeight: "46px",
  boxSizing:
    "border-box" as const,
  padding: "0 14px",
  border:
    "1px solid #d0d5dd",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "14px",
  outline: "none",
};