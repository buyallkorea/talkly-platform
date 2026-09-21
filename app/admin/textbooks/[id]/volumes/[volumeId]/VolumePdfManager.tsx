"use client";

import {
  ChangeEvent,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase-browser";

type Props = {
  textbookId: number;
  volumeId: number;
  displayTitle: string;

  originalFileUrl:
    | string
    | null;

  pageCount: number;
};

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

export default function VolumePdfManager({
  textbookId,
  volumeId,
  displayTitle,
  originalFileUrl,
  pageCount,
}: Props) {
  const router =
    useRouter();

  const [
    pdfFile,
    setPdfFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    progressMessage,
    setProgressMessage,
  ] =
    useState("");

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

  const alreadyProcessed =
    pageCount > 0;

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setErrorMessage("");
    setSuccessMessage("");
    setProgressMessage("");

    const file =
      event.target
        .files?.[0] ??
      null;

    if (!file) {
      setPdfFile(null);
      return;
    }

    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase();

    if (
      extension !== "pdf"
    ) {
      setPdfFile(null);

      setErrorMessage(
        "PDF 파일만 등록할 수 있습니다."
      );

      event.target.value =
        "";

      return;
    }

    setPdfFile(file);
  }

  async function handleUpload() {
    if (
      alreadyProcessed
    ) {
      setErrorMessage(
        "이미 E-Book 페이지가 생성된 권입니다."
      );

      return;
    }

    if (!pdfFile) {
      setErrorMessage(
        "등록할 PDF 파일을 선택해주세요."
      );

      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    let uploadedPath:
      | string
      | null = null;

    try {
      /*
       * =======================================================
       * 1. 브라우저 → Supabase Storage
       *
       * PDF를 Next.js API payload로 보내지 않습니다.
       * =======================================================
       */
      setProgressMessage(
        "1/3 PDF 파일을 업로드하고 있습니다..."
      );

      const supabase =
        createClient();

      const safeFilename =
        sanitizeFilename(
          pdfFile.name
        );

      const uniqueFilename =
        `${Date.now()}-${crypto.randomUUID()}-${safeFilename}`;

      uploadedPath =
        `textbooks/${textbookId}/volumes/${volumeId}/original/${uniqueFilename}`;

      const {
        error:
          uploadError,
      } =
        await supabase.storage
          .from(
            "textbook-files"
          )
          .upload(
            uploadedPath,
            pdfFile,
            {
              contentType:
                "application/pdf",

              cacheControl:
                "3600",

              upsert:
                false,
            }
          );

      if (uploadError) {
        throw new Error(
          `PDF 업로드 실패: ${uploadError.message}`
        );
      }

      /*
       * =======================================================
       * 2. 서버 PDF 처리
       * =======================================================
       */
      setProgressMessage(
        "2/3 PDF를 E-Book 페이지 이미지로 변환하고 있습니다..."
      );

      const response =
        await fetch(
          `/api/admin/textbook-volumes/${volumeId}/process-pdf`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials:
              "same-origin",

            body:
              JSON.stringify({
                textbookId,
                storagePath:
                  uploadedPath,
              }),
          }
        );

      const responseText =
        await response.text();

      let data: {
        success?: boolean;
        error?: string;
        message?: string;
        pageCount?: number;
        savedPageCount?: number;
      } = {};

      if (responseText) {
        try {
          data =
            JSON.parse(
              responseText
            );
        } catch {
          throw new Error(
            `PDF 처리 API가 정상적인 JSON 응답을 반환하지 않았습니다. (HTTP ${response.status})`
          );
        }
      }

      if (!response.ok) {
        /*
         * 서버 처리가 시작되기 전 오류일 수도 있고
         * 중간 처리 오류일 수도 있으므로
         * 원본 PDF를 여기서 무조건 삭제하지 않습니다.
         */
        throw new Error(
          data.error ||
            `PDF 처리에 실패했습니다. (HTTP ${response.status})`
        );
      }

      /*
       * =======================================================
       * 3. 완료
       * =======================================================
       */
      setProgressMessage(
        "3/3 권별 E-Book 생성이 완료되었습니다."
      );

      setSuccessMessage(
        `${displayTitle} PDF 등록 완료 · ${data.pageCount ?? 0}페이지`
      );

      setPdfFile(null);

      router.refresh();
    } catch (error) {
      console.error(
        "VOLUME PDF UPLOAD ERROR:",
        error
      );

      setProgressMessage("");

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "PDF 등록 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        marginTop:
          "20px",

        padding:
          "24px",

        border:
          "1px solid #e4e7ec",

        borderRadius:
          "14px",

        background:
          "#ffffff",
      }}
    >
      <h2
        style={{
          margin: 0,

          color:
            "#101828",

          fontSize:
            "18px",
        }}
      >
        수업용 PDF
      </h2>

      <p
        style={{
          margin:
            "9px 0 0",

          color:
            "#667085",

          fontSize:
            "12px",

          lineHeight:
            1.7,
        }}
      >
        이 권에서 실제
        수업에 사용할 PDF를
        등록합니다. 등록 후
        각 페이지가 자동으로
        이미지로 변환되어
        TALKLY E-Book에
        사용됩니다.
      </p>

      {alreadyProcessed ? (
        <div
          style={{
            marginTop:
              "20px",

            padding:
              "18px",

            border:
              "1px solid #abefc6",

            borderRadius:
              "11px",

            background:
              "#ecfdf3",
          }}
        >
          <div
            style={{
              color:
                "#027a48",

              fontSize:
                "13px",

              fontWeight:
                900,
            }}
          >
            PDF 등록 완료
          </div>

          <div
            style={{
              marginTop:
                "8px",

              color:
                "#475467",

              fontSize:
                "12px",

              lineHeight:
                1.7,
            }}
          >
            E-Book 페이지{" "}
            <strong>
              {pageCount}
            </strong>
            개가 생성되어
            있습니다.
          </div>

          {originalFileUrl && (
            <div
              style={{
                marginTop:
                  "10px",

                color:
                  "#98a2b3",

                fontSize:
                  "10px",

                lineHeight:
                  1.6,

                wordBreak:
                  "break-all",
              }}
            >
              {
                originalFileUrl
              }
            </div>
          )}

          <div
            style={{
              marginTop:
                "13px",

              padding:
                "11px 12px",

              borderRadius:
                "8px",

              background:
                "#ffffff",

              color:
                "#667085",

              fontSize:
                "11px",

              lineHeight:
                1.6,
            }}
          >
            기존 페이지와 향후
            Audio Hotspot을
            보호하기 위해 PDF
            재등록은 현재
            차단되어 있습니다.
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              marginTop:
                "20px",

              padding:
                "18px",

              border:
                "1px solid #e4e7ec",

              borderRadius:
                "11px",

              background:
                "#f9fafb",
            }}
          >
            <label
              htmlFor="volumePdf"
              style={{
                display:
                  "block",

                marginBottom:
                  "8px",

                color:
                  "#344054",

                fontSize:
                  "13px",

                fontWeight:
                  800,
              }}
            >
              PDF 파일 선택
            </label>

            <input
              id="volumePdf"
              type="file"
              accept=".pdf,application/pdf"
              disabled={
                loading
              }
              onChange={
                handleFileChange
              }
              style={{
                width:
                  "100%",

                boxSizing:
                  "border-box",

                padding:
                  "11px",

                border:
                  "1px solid #d0d5dd",

                borderRadius:
                  "9px",

                background:
                  "#ffffff",

                fontFamily:
                  "inherit",

                fontSize:
                  "12px",
              }}
            />

            {pdfFile && (
              <div
                style={{
                  marginTop:
                    "12px",

                  color:
                    "#475467",

                  fontSize:
                    "11px",

                  lineHeight:
                    1.6,
                }}
              >
                선택 파일:{" "}
                <strong>
                  {
                    pdfFile.name
                  }
                </strong>
                <br />
                크기:{" "}
                {(
                  pdfFile.size /
                  1024 /
                  1024
                ).toFixed(
                  2
                )}{" "}
                MB
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={
              loading ||
              !pdfFile
            }
            onClick={
              handleUpload
            }
            style={{
              width:
                "100%",

              minHeight:
                "48px",

              marginTop:
                "14px",

              border:
                "none",

              borderRadius:
                "10px",

              background:
                loading ||
                !pdfFile
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
                loading ||
                !pdfFile
                  ? "default"
                  : "pointer",
            }}
          >
            {loading
              ? "PDF 처리 중..."
              : "PDF 등록 및 E-Book 페이지 생성"}
          </button>
        </>
      )}

      {progressMessage && (
        <div
          style={{
            marginTop:
              "14px",

            padding:
              "13px 14px",

            border:
              "1px solid #b2ccff",

            borderRadius:
              "9px",

            background:
              "#eff4ff",

            color:
              "#3538cd",

            fontSize:
              "11px",

            fontWeight:
              800,

            lineHeight:
              1.6,
          }}
        >
          {
            progressMessage
          }
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            marginTop:
              "14px",

            padding:
              "13px 14px",

            border:
              "1px solid #fda29b",

            borderRadius:
              "9px",

            background:
              "#fffbfa",

            color:
              "#b42318",

            fontSize:
              "11px",

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
            marginTop:
              "14px",

            padding:
              "13px 14px",

            border:
              "1px solid #abefc6",

            borderRadius:
              "9px",

            background:
              "#ecfdf3",

            color:
              "#027a48",

            fontSize:
              "11px",

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
    </section>
  );
}