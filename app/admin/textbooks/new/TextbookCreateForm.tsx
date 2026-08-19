"use client";

import { FormEvent, useState } from "react";
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

function getExtension(filename: string) {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() || "" : "";
}

function sanitizeFilename(filename: string) {
  return filename
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_");
}

export default function TextbookCreateForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileType, setFileType] = useState("pdf");
  const [status, setStatus] = useState("draft");
  const [originalFile, setOriginalFile] =
    useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] =
    useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  const [pdfTestLoading, setPdfTestLoading] =
    useState(false);
  const [pdfTestResult, setPdfTestResult] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSuccessMessage("");
    setErrorMessage("");

    if (!title.trim()) {
      setErrorMessage("교재명을 입력해주세요.");
      return;
    }

    if (!originalFile) {
      setErrorMessage("원본 교재 파일을 선택해주세요.");
      return;
    }

    const extension = getExtension(originalFile.name);

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setErrorMessage(
        "지원하지 않는 파일 형식입니다. PDF, JPG, PNG, WEBP, ZIP, PPTX, DOCX 파일을 사용해주세요."
      );
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

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

      const uploadId = crypto.randomUUID();
      const safeFilename = sanitizeFilename(
        originalFile.name
      );

      const storagePath =
        `uploads/${uploadId}/original/${safeFilename}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("textbook-files")
        .upload(storagePath, originalFile, {
          cacheControl: "3600",
          upsert: false,
          contentType:
            originalFile.type || undefined,
        });

      if (uploadError) {
        throw new Error(
          `원본 파일 업로드 실패: ${uploadError.message}`
        );
      }

      const {
        data: inserted,
        error: insertError,
      } = await supabase
        .from("textbooks")
        .insert({
          title: title.trim(),
          description:
            description.trim() || null,
          original_file_url: storagePath,
          original_file_type: fileType,
          page_count: 0,
          status,
        })
        .select("id, title")
        .single();

      if (insertError) {
        throw new Error(
          `교재 등록 실패: ${insertError.message}`
        );
      }

      setSuccessMessage(
        `교재와 원본 파일이 등록되었습니다. (교재 ID: ${inserted.id})`
      );

      setTitle("");
      setDescription("");
      setFileType("pdf");
      setStatus("draft");
      setOriginalFile(null);

      const fileInput =
        document.getElementById(
          "originalFile"
        ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }
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

  async function handlePdfTest() {
    setPdfTestLoading(true);
    setPdfTestResult("");

    try {
      const response = await fetch(
        "/api/textbooks/process",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            textbookId: 4,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "PDF 분석에 실패했습니다."
        );
      }

      setPdfTestResult(
        `PDF 분석 성공 - 총 ${data.pageCount}페이지`
      );

      console.log("PDF TEST RESULT:", data);
    } catch (error) {
      setPdfTestResult(
        error instanceof Error
          ? `PDF 분석 실패 - ${error.message}`
          : "PDF 분석 실패"
      );
    } finally {
      setPdfTestLoading(false);
    }
  }

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "12px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    fontSize: "16px",
  };

  const labelStyle = {
    display: "block",
    marginBottom: "8px",
    fontWeight: 700,
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <section
        style={{
          padding: "24px",
          border: "1px solid #ddd",
          borderRadius: "12px",
        }}
      >
        <div
          style={{
            marginBottom: "24px",
          }}
        >
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
              setTitle(event.target.value)
            }
            placeholder="예: TALKLY Beginner English 1"
            style={fieldStyle}
          />
        </div>

        <div
          style={{
            marginBottom: "24px",
          }}
        >
          <label
            htmlFor="description"
            style={labelStyle}
          >
            설명
          </label>

          <textarea
            id="description"
            value={description}
            disabled={loading}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            placeholder="교재에 대한 간단한 설명을 입력하세요."
            rows={5}
            style={{
              ...fieldStyle,
              resize: "vertical",
              lineHeight: 1.6,
            }}
          />
        </div>

        <div
          style={{
            marginBottom: "24px",
          }}
        >
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
              setFileType(event.target.value)
            }
            style={fieldStyle}
          >
            <option value="pdf">PDF</option>
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

        <div
          style={{
            marginBottom: "24px",
          }}
        >
          <label
            htmlFor="originalFile"
            style={labelStyle}
          >
            원본 교재 파일 *
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

              if (file) {
                const ext =
                  getExtension(file.name);

                if (
                  ["jpg", "jpeg", "png", "webp"].includes(
                    ext
                  )
                ) {
                  setFileType("image");
                } else if (
                  ["pdf", "zip", "pptx", "docx"].includes(
                    ext
                  )
                ) {
                  setFileType(ext);
                }
              }
            }}
            style={fieldStyle}
          />

          <p
            style={{
              marginTop: "8px",
              marginBottom: 0,
              fontSize: "13px",
              opacity: 0.65,
              lineHeight: 1.6,
            }}
          >
            PDF, 이미지, ZIP, PPTX, DOCX를
            등록할 수 있습니다. 이번 단계에서는
            원본 파일만 보관하고 페이지 변환은
            다음 단계에서 처리합니다.
          </p>

          {originalFile && (
            <div
              style={{
                marginTop: "10px",
                fontSize: "13px",
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
        </div>

        <div>
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
              setStatus(event.target.value)
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

      {successMessage && (
        <div
          style={{
            padding: "14px",
            border: "1px solid #1a7f37",
            borderRadius: "8px",
          }}
        >
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            padding: "14px",
            border: "1px solid #d93025",
            borderRadius: "8px",
            color: "#d93025",
          }}
        >
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "15px",
          border: "none",
          borderRadius: "8px",
          fontSize: "16px",
          fontWeight: 700,
          cursor: loading
            ? "default"
            : "pointer",
          opacity: loading ? 0.65 : 1,
        }}
      >
        {loading
          ? "교재와 원본 파일 등록 중..."
          : "교재 등록"}
      </button>

      <button
        type="button"
        onClick={handlePdfTest}
        disabled={pdfTestLoading}
        style={{
          padding: "15px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          fontSize: "16px",
          fontWeight: 700,
          cursor: pdfTestLoading
            ? "default"
            : "pointer",
        }}
      >
        {pdfTestLoading
          ? "PDF 분석 중..."
          : "PDF 분석 테스트 (교재 ID 4)"}
      </button>

      {pdfTestResult && (
        <div
          style={{
            padding: "14px",
            border: "1px solid #ddd",
            borderRadius: "8px",
          }}
        >
          {pdfTestResult}
        </div>
      )}
    </form>
  );
}