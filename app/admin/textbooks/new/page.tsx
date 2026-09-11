"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase-browser";

const ALLOWED_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "zip",
  "pptx",
  "docx",
];

const ALLOWED_COVER_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
];

const CATEGORY_OPTIONS = [
  {
    value: "course_book",
    label: "Course Book",
    description: "수업의 중심이 되는 종합 교재",
  },
  {
    value: "phonics",
    label: "Phonics",
    description: "파닉스 · 발음 · 기초 읽기",
  },
  {
    value: "reading",
    label: "Reading",
    description: "읽기 · 독해",
  },
  {
    value: "speaking",
    label: "Speaking",
    description: "회화 · 말하기",
  },
  {
    value: "writing",
    label: "Writing",
    description: "영작 · 쓰기",
  },
  {
    value: "grammar",
    label: "Grammar",
    description: "문법",
  },
  {
    value: "vocabulary",
    label: "Vocabulary",
    description: "어휘 · Voca",
  },
  {
    value: "adult",
    label: "Adult",
    description: "성인 과정 중심 교재",
  },
];

const CURRICULUM_LEVEL_OPTIONS = [
  {
    code: "K",
    label: "Grade K",
    reference: "영유아 수준 참고",
  },
  {
    code: "G1",
    label: "Grade 1",
    reference: "초등 1학년 수준 참고",
  },
  {
    code: "G2",
    label: "Grade 2",
    reference: "초등 2학년 수준 참고",
  },
  {
    code: "G3",
    label: "Grade 3",
    reference: "초등 3학년 수준 참고",
  },
  {
    code: "G4",
    label: "Grade 4",
    reference: "초등 4학년 수준 참고",
  },
  {
    code: "G5",
    label: "Grade 5",
    reference: "초등 5학년 수준 참고",
  },
  {
    code: "G6",
    label: "Grade 6",
    reference: "초등 6학년 수준 참고",
  },
  {
    code: "G7",
    label: "Grade 7",
    reference: "중학교 1학년 수준 참고",
  },
  {
    code: "G8",
    label: "Grade 8",
    reference: "중학교 2학년 수준 참고",
  },
  {
    code: "G9",
    label: "Grade 9",
    reference: "중학교 3학년 수준 참고",
  },
  {
    code: "ADULT",
    label: "Adult",
    reference: "성인 수준",
  },
];

function getExtension(filename: string) {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1
    ? parts.pop() || ""
    : "";
}

function sanitizeFilename(filename: string) {
  return filename
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_");
}

function formatPrice(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  return Number(digits).toLocaleString(
    "ko-KR"
  );
}

export default function TextbookCreateForm() {
  const [title, setTitle] = useState("");
  const [publisher, setPublisher] =
    useState("");
  const [category, setCategory] =
    useState("course_book");

  const [selectedLevels, setSelectedLevels] =
    useState<string[]>([]);

  const [description, setDescription] =
    useState("");

  const [fileType, setFileType] =
    useState("pdf");

  const [coverFile, setCoverFile] =
    useState<File | null>(null);

  const [originalFile, setOriginalFile] =
    useState<File | null>(null);

  const [isForSale, setIsForSale] =
    useState(false);

  const [salePrice, setSalePrice] =
    useState("");

  const [
    externalPurchaseUrl,
    setExternalPurchaseUrl,
  ] = useState("");

  const [status, setStatus] =
    useState("draft");

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

  const selectedCategory =
    useMemo(() => {
      return CATEGORY_OPTIONS.find(
        (item) => item.value === category
      );
    }, [category]);

  function toggleLevel(code: string) {
    setSelectedLevels((current) => {
      if (current.includes(code)) {
        return current.filter(
          (item) => item !== code
        );
      }

      return [...current, code];
    });
  }

  function resetForm() {
    setTitle("");
    setPublisher("");
    setCategory("course_book");
    setSelectedLevels([]);
    setDescription("");
    setFileType("pdf");
    setCoverFile(null);
    setOriginalFile(null);
    setIsForSale(false);
    setSalePrice("");
    setExternalPurchaseUrl("");
    setStatus("draft");

    const coverInput =
      document.getElementById(
        "coverFile"
      ) as HTMLInputElement | null;

    if (coverInput) {
      coverInput.value = "";
    }

    const fileInput =
      document.getElementById(
        "originalFile"
      ) as HTMLInputElement | null;

    if (fileInput) {
      fileInput.value = "";
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSuccessMessage("");
    setErrorMessage("");

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
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

    if (selectedLevels.length === 0) {
      setErrorMessage(
        "적용할 커리큘럼 Grade를 1개 이상 선택해주세요."
      );
      return;
    }

    let parsedSalePrice: number | null =
      null;

    if (isForSale) {
      const priceDigits =
        salePrice.replace(/\D/g, "");

      if (!priceDigits) {
        setErrorMessage(
          "TALKLY 판매 교재는 판매가를 입력해주세요."
        );
        return;
      }

      parsedSalePrice =
        Number(priceDigits);

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
      const coverExtension =
        getExtension(coverFile.name);

      if (
        !ALLOWED_COVER_EXTENSIONS.includes(
          coverExtension
        )
      ) {
        setErrorMessage(
          "교재 표지는 JPG, JPEG, PNG, WEBP 형식만 사용할 수 있습니다."
        );
        return;
      }
    }

    if (originalFile) {
      const extension =
        getExtension(originalFile.name);

      if (
        !ALLOWED_EXTENSIONS.includes(
          extension
        )
      ) {
        setErrorMessage(
          "지원하지 않는 파일 형식입니다. PDF, JPG, PNG, WEBP, ZIP, PPTX, DOCX 파일을 사용해주세요."
        );
        return;
      }
    }

    setLoading(true);

    let uploadedStoragePath:
      | string
      | null = null;

    let uploadedCoverPath:
      | string
      | null = null;

    try {
      const supabase = createClient();

      /*
       * 관리자 권한 확인
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "로그인 정보를 확인할 수 없습니다."
        );
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (
        profileError ||
        !profile ||
        profile.role !== "admin"
      ) {
        throw new Error(
          "관리자 권한을 확인할 수 없습니다."
        );
      }

      /*
       * 같은 제목의 교재가 이미 존재하는지 확인
       *
       * 현재 textbooks.title에 UNIQUE 제약을
       * 강제로 걸지 않았기 때문에 관리자 실수로
       * 동일 교재가 중복 등록되는 것을 UI에서
       * 한 번 더 방지합니다.
       */
      const {
        data: existingTextbooks,
        error: duplicateCheckError,
      } = await supabase
        .from("textbooks")
        .select("id, title")
        .ilike("title", trimmedTitle)
        .limit(10);

      if (duplicateCheckError) {
        throw new Error(
          `교재 중복 확인 실패: ${duplicateCheckError.message}`
        );
      }

      const exactDuplicate =
        (
          existingTextbooks || []
        ).find(
          (item) =>
            item.title
              .trim()
              .toLowerCase() ===
            trimmedTitle.toLowerCase()
        );

      if (exactDuplicate) {
        throw new Error(
          `동일한 교재명이 이미 등록되어 있습니다. (교재 ID: ${exactDuplicate.id})`
        );
      }

      /*
       * 선택적으로 교재 표지 이미지 업로드
       *
       * 표지는 원본 교재 파일과 별도로 저장합니다.
       * 공개 커리큘럼 화면에서는 이 Storage 경로를
       * 서버에서 signed URL로 변환해 표시합니다.
       */
      if (coverFile) {
        const coverUploadId =
          crypto.randomUUID();

        const safeCoverFilename =
          sanitizeFilename(
            coverFile.name
          );

        uploadedCoverPath =
          `covers/${coverUploadId}/${safeCoverFilename}`;

        const {
          error: coverUploadError,
        } = await supabase.storage
          .from("textbook-files")
          .upload(
            uploadedCoverPath,
            coverFile,
            {
              cacheControl: "3600",
              upsert: false,
              contentType:
                coverFile.type ||
                undefined,
            }
          );

        if (coverUploadError) {
          throw new Error(
            `교재 표지 업로드 실패: ${coverUploadError.message}`
          );
        }
      }

      /*
       * 선택적으로 원본 파일 업로드
       *
       * 출판사 협의 전에는 파일 없이
       * 교재 메타데이터만 등록할 수 있습니다.
       */
      if (originalFile) {
        const uploadId =
          crypto.randomUUID();

        const safeFilename =
          sanitizeFilename(
            originalFile.name
          );

        uploadedStoragePath =
          `uploads/${uploadId}/original/${safeFilename}`;

        const {
          error: uploadError,
        } = await supabase.storage
          .from("textbook-files")
          .upload(
            uploadedStoragePath,
            originalFile,
            {
              cacheControl: "3600",
              upsert: false,
              contentType:
                originalFile.type ||
                undefined,
            }
          );

        if (uploadError) {
          throw new Error(
            `원본 파일 업로드 실패: ${uploadError.message}`
          );
        }
      }

      /*
       * 교재 마스터 등록
       *
       * 교재는 하나의 중앙 엔티티입니다.
       * Grade별로 별도 교재 레코드를
       * 복제하지 않습니다.
       */
      const {
        data: inserted,
        error: insertError,
      } = await supabase
        .from("textbooks")
        .insert({
          title: trimmedTitle,
          publisher:
            publisher.trim() || null,
          category,
          description:
            description.trim() || null,

          cover_image_url:
            uploadedCoverPath,

          original_file_url:
            uploadedStoragePath,

          original_file_type:
            originalFile
              ? fileType
              : null,

          page_count: 0,

          is_for_sale: isForSale,

          sale_price: isForSale
            ? parsedSalePrice
            : null,

          external_purchase_url:
            externalPurchaseUrl.trim() ||
            null,

          is_active: true,

          status,
        })
        .select("id, title")
        .single();

      if (insertError || !inserted) {
        /*
         * DB 등록 실패 시 이번 요청에서
         * 업로드한 파일만 정리합니다.
         */
        const cleanupPaths = [
          uploadedStoragePath,
          uploadedCoverPath,
        ].filter(
          (value): value is string =>
            Boolean(value)
        );

        if (cleanupPaths.length > 0) {
          await supabase.storage
            .from("textbook-files")
            .remove(cleanupPaths);
        }

        throw new Error(
          `교재 등록 실패: ${
            insertError?.message ||
            "등록 결과를 확인할 수 없습니다."
          }`
        );
      }

      /*
       * 선택한 Grade들의 실제
       * curriculum_levels.id를 조회합니다.
       */
      const {
        data: curriculumLevels,
        error: curriculumError,
      } = await supabase
        .from("curriculum_levels")
        .select("id, code")
        .in("code", selectedLevels);

      if (curriculumError) {
        /*
         * 교재 자체는 이미 생성되었으므로
         * 관리자에게 명확히 알립니다.
         */
        throw new Error(
          `교재는 등록되었지만 Grade 정보를 불러오지 못했습니다. 교재 ID ${inserted.id}: ${curriculumError.message}`
        );
      }

      if (
        !curriculumLevels ||
        curriculumLevels.length !==
          selectedLevels.length
      ) {
        throw new Error(
          `교재는 등록되었지만 일부 커리큘럼 Grade를 찾을 수 없습니다. 교재 ID: ${inserted.id}`
        );
      }

      /*
       * Grade ↔ 교재 연결
       *
       * is_primary는 false입니다.
       * Grade에 들어간다는 사실만 등록하고,
       * 실제 주교재 여부나 학생별 배정은
       * 관리자가 별도로 결정합니다.
       */
      const mappingRows =
        curriculumLevels.map(
          (level, index) => ({
            curriculum_level_id:
              level.id,

            textbook_id:
              inserted.id,

            category,

            is_primary: false,

            sort_order:
              (index + 1) * 10,

            is_active: true,
          })
        );

      const {
        error: mappingError,
      } = await supabase
        .from(
          "curriculum_level_textbooks"
        )
        .insert(mappingRows);

      if (mappingError) {
        throw new Error(
          `교재는 등록되었지만 Grade 연결에 실패했습니다. 교재 ID ${inserted.id}: ${mappingError.message}`
        );
      }

      setSuccessMessage(
        `교재 등록이 완료되었습니다. (${inserted.title} / 교재 ID: ${inserted.id} / 적용 Grade ${selectedLevels.length}개)`
      );

      resetForm();
    } catch (error) {
      console.error(
        "TEXTBOOK CREATE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "교재 등록 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "12px 14px",
    border: "1px solid #d7ddea",
    borderRadius: "10px",
    fontSize: "15px",
    background: "#ffffff",
    color: "#16213e",
    outline: "none",
  };

  const labelStyle = {
    display: "block",
    marginBottom: "8px",
    fontSize: "14px",
    fontWeight: 800,
    color: "#16213e",
  };

  const helperStyle = {
    margin: "8px 0 0",
    fontSize: "13px",
    lineHeight: 1.6,
    color: "#667085",
  };

  const sectionStyle = {
    padding: "24px",
    border: "1px solid #e3e7ef",
    borderRadius: "16px",
    background: "#ffffff",
    boxShadow:
      "0 8px 24px rgba(15, 31, 68, 0.04)",
  };

  const sectionTitleStyle = {
    margin: "0 0 6px",
    fontSize: "18px",
    fontWeight: 900,
    color: "#0A1F44",
  };

  const sectionDescriptionStyle = {
    margin: "0 0 22px",
    fontSize: "13px",
    lineHeight: 1.6,
    color: "#667085",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "22px",
      }}
    >
      {/* =========================
          기본 정보
      ========================== */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>
          기본 정보
        </h2>

        <p
          style={sectionDescriptionStyle}
        >
          TALKLY 커리큘럼에서 사용할
          교재의 기본 정보를 등록합니다.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "18px",
          }}
        >
          <div>
            <label
              htmlFor="title"
              style={labelStyle}
            >
              교재명 *
            </label>

            <input
              id="title"
              type="text"
              value={title}
              disabled={loading}
              onChange={(event) =>
                setTitle(
                  event.target.value
                )
              }
              placeholder="예: Everybody Up 3rd"
              style={fieldStyle}
            />
          </div>

          <div>
            <label
              htmlFor="publisher"
              style={labelStyle}
            >
              출판사
            </label>

            <input
              id="publisher"
              type="text"
              value={publisher}
              disabled={loading}
              onChange={(event) =>
                setPublisher(
                  event.target.value
                )
              }
              placeholder="예: Oxford University Press"
              style={fieldStyle}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: "20px",
          }}
        >
          <label
            htmlFor="category"
            style={labelStyle}
          >
            교재 분야 *
          </label>

          <select
            id="category"
            value={category}
            disabled={loading}
            onChange={(event) =>
              setCategory(
                event.target.value
              )
            }
            style={fieldStyle}
          >
            {CATEGORY_OPTIONS.map(
              (item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              )
            )}
          </select>

          {selectedCategory && (
            <p style={helperStyle}>
              {
                selectedCategory.description
              }
            </p>
          )}
        </div>

        <div
          style={{
            marginTop: "20px",
          }}
        >
          <label
            htmlFor="description"
            style={labelStyle}
          >
            교재 설명
          </label>

          <textarea
            id="description"
            value={description}
            disabled={loading}
            onChange={(event) =>
              setDescription(
                event.target.value
              )
            }
            placeholder="교재의 특징과 수업 활용 목적 등을 입력하세요."
            rows={5}
            style={{
              ...fieldStyle,
              resize: "vertical",
              lineHeight: 1.7,
            }}
          />
        </div>
      </section>

      {/* =========================
          교재 표지
      ========================== */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>
          교재 표지
        </h2>

        <p
          style={sectionDescriptionStyle}
        >
          사용자용 커리큘럼 페이지와
          교재 관리 화면에 표시할 표지입니다.
          JPG, PNG, WEBP 이미지를 사용할 수 있으며
          수업용 원본 파일과는 별도입니다.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(180px, 240px) minmax(260px, 1fr)",
            gap: "20px",
            alignItems: "start",
          }}
        >
          <div
            style={{
              aspectRatio: "3 / 4",
              border: "1px solid #dfe4ee",
              borderRadius: "14px",
              overflow: "hidden",
              background:
                "linear-gradient(145deg, #eef3fb 0%, #f8fbff 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {coverFile ? (
              <img
                src={URL.createObjectURL(
                  coverFile
                )}
                alt="교재 표지 미리보기"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                  background: "#ffffff",
                }}
              />
            ) : (
              <div
                style={{
                  textAlign: "center",
                  color: "#7d8ba2",
                  fontSize: "13px",
                  lineHeight: 1.7,
                  padding: "20px",
                }}
              >
                <div
                  style={{
                    fontSize: "28px",
                    marginBottom: "8px",
                  }}
                >
                  📘
                </div>
                표지 이미지 미리보기
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="coverFile"
              style={labelStyle}
            >
              표지 이미지
            </label>

            <input
              id="coverFile"
              type="file"
              disabled={loading}
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              onChange={(event) => {
                const file =
                  event.target.files?.[0] ??
                  null;

                setCoverFile(file);
              }}
              style={fieldStyle}
            />

            <p style={helperStyle}>
              표지는 선택사항입니다. 아직 준비되지 않았다면
              비워두고 나중에 교재 수정 화면에서 등록할 수 있습니다.
            </p>

            {coverFile && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  background: "#f6f8fc",
                  fontSize: "13px",
                  color: "#475467",
                }}
              >
                선택 이미지:{" "}
                <strong>
                  {coverFile.name}
                </strong>{" "}
                (
                {(
                  coverFile.size /
                  1024 /
                  1024
                ).toFixed(2)}
                MB)
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =========================
          커리큘럼 Grade
      ========================== */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>
          적용 커리큘럼
        </h2>

        <p
          style={sectionDescriptionStyle}
        >
          이 교재를 사용할 수 있는
          TALKLY 영어 실력 Grade를
          선택합니다. 학생의 실제 학년을
          제한하는 항목이 아닙니다.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(155px, 1fr))",
            gap: "10px",
          }}
        >
          {CURRICULUM_LEVEL_OPTIONS.map(
            (level) => {
              const checked =
                selectedLevels.includes(
                  level.code
                );

              return (
                <label
                  key={level.code}
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems:
                      "flex-start",
                    padding: "13px",
                    border: checked
                      ? "2px solid #0A1F44"
                      : "1px solid #dfe4ee",
                    borderRadius: "12px",
                    cursor: loading
                      ? "default"
                      : "pointer",
                    background: checked
                      ? "#f3f6fb"
                      : "#ffffff",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={loading}
                    onChange={() =>
                      toggleLevel(
                        level.code
                      )
                    }
                    style={{
                      marginTop: "3px",
                    }}
                  />

                  <span>
                    <strong
                      style={{
                        display: "block",
                        color: "#0A1F44",
                        fontSize: "14px",
                      }}
                    >
                      {level.label}
                    </strong>

                    <span
                      style={{
                        display: "block",
                        marginTop: "3px",
                        fontSize: "11px",
                        lineHeight: 1.4,
                        color: "#7a8497",
                      }}
                    >
                      {level.reference}
                    </span>
                  </span>
                </label>
              );
            }
          )}
        </div>

        <p style={helperStyle}>
          현재 선택:{" "}
          <strong>
            {selectedLevels.length}개
          </strong>
        </p>
      </section>

      {/* =========================
          교재 판매
      ========================== */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>
          교재 판매
        </h2>

        <p
          style={sectionDescriptionStyle}
        >
          학생에게 실제 배정된 교재들의
          판매가를 합산하여 별도의 교재비
          결제금액을 구성하게 됩니다.
        </p>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: loading
              ? "default"
              : "pointer",
            fontWeight: 800,
            color: "#16213e",
          }}
        >
          <input
            type="checkbox"
            checked={isForSale}
            disabled={loading}
            onChange={(event) => {
              const checked =
                event.target.checked;

              setIsForSale(checked);

              if (!checked) {
                setSalePrice("");
              }
            }}
          />

          TALKLY에서 판매하는 교재
        </label>

        {isForSale && (
          <div
            style={{
              marginTop: "20px",
              maxWidth: "360px",
            }}
          >
            <label
              htmlFor="salePrice"
              style={labelStyle}
            >
              판매가 *
            </label>

            <div
              style={{
                position: "relative",
              }}
            >
              <input
                id="salePrice"
                type="text"
                inputMode="numeric"
                value={salePrice}
                disabled={loading}
                onChange={(event) =>
                  setSalePrice(
                    formatPrice(
                      event.target.value
                    )
                  )
                }
                placeholder="18,000"
                style={{
                  ...fieldStyle,
                  paddingRight: "45px",
                }}
              />

              <span
                style={{
                  position: "absolute",
                  right: "14px",
                  top: "50%",
                  transform:
                    "translateY(-50%)",
                  fontSize: "14px",
                  color: "#667085",
                }}
              >
                원
              </span>
            </div>

            <p style={helperStyle}>
              학생에게 교재를 배정할 때
              이 가격을 기준으로 교재비가
              계산됩니다.
            </p>
          </div>
        )}

        <div
          style={{
            marginTop: "20px",
          }}
        >
          <label
            htmlFor="externalPurchaseUrl"
            style={labelStyle}
          >
            외부 참고 URL
          </label>

          <input
            id="externalPurchaseUrl"
            type="url"
            value={externalPurchaseUrl}
            disabled={loading}
            onChange={(event) =>
              setExternalPurchaseUrl(
                event.target.value
              )
            }
            placeholder="https://..."
            style={fieldStyle}
          />

          <p style={helperStyle}>
            출판사 또는 교재 정보를
            확인하기 위한 관리자용 참고
            주소로 사용할 수 있습니다.
          </p>
        </div>
      </section>

      {/* =========================
          수업용 원본
      ========================== */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>
          수업용 원본
        </h2>

        <p
          style={sectionDescriptionStyle}
        >
          출판사로부터 적법하게 제공받은
          PDF·eBook·스캔본 등이 있는 경우에
          등록합니다. 아직 파일이 없다면
          비워두어도 교재 등록이 가능합니다.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(180px, 0.35fr) minmax(260px, 1fr)",
            gap: "18px",
          }}
        >
          <div>
            <label
              htmlFor="fileType"
              style={labelStyle}
            >
              원본 파일 유형
            </label>

            <select
              id="fileType"
              value={fileType}
              disabled={loading}
              onChange={(event) =>
                setFileType(
                  event.target.value
                )
              }
              style={fieldStyle}
            >
              <option value="pdf">
                PDF
              </option>

              <option value="image">
                이미지
              </option>

              <option value="zip">
                이미지 ZIP
              </option>

              <option value="pptx">
                PowerPoint (PPTX)
              </option>

              <option value="docx">
                Word (DOCX)
              </option>

              <option value="other">
                기타
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="originalFile"
              style={labelStyle}
            >
              원본 교재 파일
            </label>

            <input
              id="originalFile"
              type="file"
              disabled={loading}
              accept=".pdf,.jpg,.jpeg,.png,.webp,.zip,.pptx,.docx"
              onChange={(event) => {
                const file =
                  event.target.files?.[0] ??
                  null;

                setOriginalFile(file);

                if (!file) {
                  return;
                }

                const ext =
                  getExtension(file.name);

                if (
                  [
                    "jpg",
                    "jpeg",
                    "png",
                    "webp",
                  ].includes(ext)
                ) {
                  setFileType("image");
                } else if (
                  [
                    "pdf",
                    "zip",
                    "pptx",
                    "docx",
                  ].includes(ext)
                ) {
                  setFileType(ext);
                }
              }}
              style={fieldStyle}
            />
          </div>
        </div>

        {originalFile && (
          <div
            style={{
              marginTop: "12px",
              padding: "12px 14px",
              borderRadius: "10px",
              background: "#f6f8fc",
              fontSize: "13px",
              color: "#475467",
            }}
          >
            선택 파일:{" "}
            <strong>
              {originalFile.name}
            </strong>{" "}
            (
            {(
              originalFile.size /
              1024 /
              1024
            ).toFixed(2)}
            MB)
          </div>
        )}
      </section>

      {/* =========================
          상태
      ========================== */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>
          등록 상태
        </h2>

        <p
          style={sectionDescriptionStyle}
        >
          교재 정보를 먼저 등록한 뒤
          파일·판매정보 등을 나중에
          보완할 수 있습니다.
        </p>

        <div
          style={{
            maxWidth: "360px",
          }}
        >
          <label
            htmlFor="status"
            style={labelStyle}
          >
            상태
          </label>

          <select
            id="status"
            value={status}
            disabled={loading}
            onChange={(event) =>
              setStatus(
                event.target.value
              )
            }
            style={fieldStyle}
          >
            <option value="draft">
              작업 중
            </option>

            <option value="ready">
              사용 가능
            </option>
          </select>
        </div>
      </section>

      {/* =========================
          메시지
      ========================== */}
      {successMessage && (
        <div
          style={{
            padding: "15px 16px",
            border:
              "1px solid #b7dfc3",
            borderRadius: "12px",
            background: "#f2fbf5",
            color: "#176b36",
            fontSize: "14px",
            fontWeight: 700,
            lineHeight: 1.6,
          }}
        >
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            padding: "15px 16px",
            border:
              "1px solid #f0b7b2",
            borderRadius: "12px",
            background: "#fff6f5",
            color: "#b42318",
            fontSize: "14px",
            fontWeight: 700,
            lineHeight: 1.6,
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* =========================
          저장
      ========================== */}
      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "16px 20px",
          border: "none",
          borderRadius: "12px",
          background: "#0A1F44",
          color: "#ffffff",
          fontSize: "16px",
          fontWeight: 900,
          cursor: loading
            ? "default"
            : "pointer",
          opacity: loading ? 0.65 : 1,
          boxShadow:
            "0 10px 24px rgba(10, 31, 68, 0.15)",
        }}
      >
        {loading
          ? "교재 등록 중..."
          : "교재 등록"}
      </button>
    </form>
  );
}