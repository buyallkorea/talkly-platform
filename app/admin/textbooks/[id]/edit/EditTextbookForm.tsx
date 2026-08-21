"use client";

import {
  FormEvent,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Textbook = {
  id: number;
  title: string;
  description: string | null;
  original_file_url: string | null;
  original_file_type: string | null;
  page_count: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  textbook: Textbook;
  pageDataCount: number;
};

export default function EditTextbookForm({
  textbook,
  pageDataCount,
}: Props) {
  const router = useRouter();

  const [title, setTitle] =
    useState(textbook.title);

  const [description, setDescription] =
    useState(textbook.description || "");

  const [status, setStatus] =
    useState(textbook.status);

  const [loading, setLoading] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

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

    if (
      status !== "draft" &&
      status !== "ready"
    ) {
      setErrorMessage(
        "교재 상태를 확인해주세요."
      );
      return;
    }

    setLoading(true);

    try {
      const supabase =
        createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage(
          "로그인 정보를 확인할 수 없습니다."
        );
        setLoading(false);
        return;
      }

      /*
       * 클라이언트에서도 관리자 권한을
       * 다시 확인합니다.
       */
      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (
        profileError ||
        !profile ||
        profile.role !== "admin"
      ) {
        setErrorMessage(
          "관리자 권한을 확인할 수 없습니다."
        );
        setLoading(false);
        return;
      }

      const now =
        new Date().toISOString();

      const {
        data: updatedTextbook,
        error: updateError,
      } = await supabase
        .from("textbooks")
        .update({
          title: title.trim(),
          description:
            description.trim() || null,
          status,
          updated_at: now,
        })
        .eq("id", textbook.id)
        .select(`
          id,
          title,
          status
        `)
        .maybeSingle();

      if (updateError) {
        setErrorMessage(
          `교재 수정 실패: ${updateError.message} / code: ${updateError.code}`
        );
        setLoading(false);
        return;
      }

      if (!updatedTextbook) {
        setErrorMessage(
          "교재 수정 요청은 처리되었지만 변경된 정보를 확인할 수 없습니다."
        );
        setLoading(false);
        return;
      }

      setSuccessMessage(
        "교재 정보가 정상적으로 수정되었습니다."
      );

      router.refresh();
    } catch (error) {
      console.error(
        "TEXTBOOK UPDATE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `교재 수정 오류: ${error.message}`
          : "교재 수정 중 알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        marginTop: "22px",
        padding: "26px",
        border: "1px solid #e4e7ec",
        borderRadius: "16px",
        background: "#ffffff",
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            color: "#101828",
            fontSize: "20px",
            letterSpacing: "-0.02em",
          }}
        >
          기본 정보 수정
        </h2>

        <p
          style={{
            margin: "8px 0 0",
            color: "#667085",
            fontSize: "13px",
            lineHeight: 1.7,
          }}
        >
          교재명, 설명 및 현재 사용 상태를
          변경할 수 있습니다.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          marginTop: "26px",
          display: "flex",
          flexDirection: "column",
          gap: "22px",
        }}
      >
        {/* 교재명 */}
        <div>
          <label
            htmlFor="title"
            style={labelStyle}
          >
            교재명
          </label>

          <input
            id="title"
            type="text"
            value={title}
            onChange={(event) => {
              setTitle(
                event.target.value
              );
              setSuccessMessage("");
            }}
            placeholder="교재명을 입력해주세요."
            disabled={loading}
            style={fieldStyle}
          />
        </div>

        {/* 설명 */}
        <div>
          <label
            htmlFor="description"
            style={labelStyle}
          >
            교재 설명
          </label>

          <textarea
            id="description"
            value={description}
            onChange={(event) => {
              setDescription(
                event.target.value
              );
              setSuccessMessage("");
            }}
            rows={6}
            placeholder="교재에 대한 설명을 입력해주세요."
            disabled={loading}
            style={{
              ...fieldStyle,
              padding: "13px 14px",
              resize: "vertical",
              lineHeight: 1.7,
            }}
          />
        </div>

        {/* 상태 */}
        <div>
          <label
            htmlFor="status"
            style={labelStyle}
          >
            교재 상태
          </label>

          <select
            id="status"
            value={status}
            onChange={(event) => {
              setStatus(
                event.target.value
              );
              setSuccessMessage("");
            }}
            disabled={loading}
            style={fieldStyle}
          >
            <option value="draft">
              작업 중
            </option>

            <option value="ready">
              사용 가능
            </option>
          </select>

          <div
            style={{
              marginTop: "9px",
              color: "#98a2b3",
              fontSize: "11px",
              lineHeight: 1.6,
            }}
          >
            작업 중 교재는 아직 준비 단계이며,
            사용 가능으로 변경하면 수업용 교재로
            사용할 수 있습니다.
          </div>
        </div>

        {/* 현재 파일 정보 */}
        <div
          style={{
            padding: "18px",
            border: "1px solid #e4e7ec",
            borderRadius: "12px",
            background: "#f9fafb",
          }}
        >
          <div
            style={{
              color: "#101828",
              fontSize: "13px",
              fontWeight: 900,
            }}
          >
            현재 원본 파일
          </div>

          <div
            style={{
              marginTop: "14px",
              display: "grid",
              gridTemplateColumns:
                "repeat(3, minmax(0, 1fr))",
              gap: "14px",
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
                marginTop: "15px",
                paddingTop: "14px",
                borderTop:
                  "1px solid #e4e7ec",
              }}
            >
              <div
                style={{
                  color: "#98a2b3",
                  fontSize: "10px",
                  fontWeight: 800,
                }}
              >
                STORAGE PATH
              </div>

              <div
                style={{
                  marginTop: "6px",
                  color: "#667085",
                  fontSize: "11px",
                  lineHeight: 1.6,
                  wordBreak: "break-all",
                }}
              >
                {textbook.original_file_url}
              </div>
            </div>
          )}
        </div>

        {/* 파일 교체 안내 */}
        <div
          style={{
            padding: "16px 18px",
            border: "1px solid #dbe7ff",
            borderRadius: "11px",
            background: "#f5f8ff",
          }}
        >
          <div
            style={{
              color: "#2f6fed",
              fontSize: "12px",
              fontWeight: 900,
            }}
          >
            원본 파일 교체
          </div>

          <p
            style={{
              margin: "6px 0 0",
              color: "#667085",
              fontSize: "11px",
              lineHeight: 1.7,
            }}
          >
            현재 단계에서는 교재 기본 정보와
            상태만 수정합니다. 원본 파일을
            교체할 때는 기존 페이지 데이터와
            Storage 파일까지 함께 정리해야 하므로
            별도의 안전한 교체 기능으로 연결합니다.
          </p>
        </div>

        {/* 오류 */}
        {errorMessage && (
          <div
            style={{
              padding: "14px 16px",
              border: "1px solid #fda29b",
              borderRadius: "10px",
              background: "#fffbfa",
              color: "#b42318",
              fontSize: "12px",
              fontWeight: 700,
              lineHeight: 1.6,
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* 성공 */}
        {successMessage && (
          <div
            style={{
              padding: "14px 16px",
              border: "1px solid #abefc6",
              borderRadius: "10px",
              background: "#ecfdf3",
              color: "#027a48",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            {successMessage}
          </div>
        )}

        {/* 버튼 */}
        <div
          style={{
            paddingTop: "4px",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href={`/admin/textbooks/${textbook.id}`}
            style={{
              minHeight: "46px",
              padding: "0 18px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border:
                "1px solid #d0d5dd",
              borderRadius: "10px",
              background: "#ffffff",
              color: "#344054",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 800,
            }}
          >
            ← 수정 취소
          </Link>

          <button
            type="submit"
            disabled={loading}
            style={{
              minHeight: "46px",
              padding: "0 22px",
              border: "none",
              borderRadius: "10px",
              background: loading
                ? "#98a2b3"
                : "#0A1F44",
              color: "#ffffff",
              fontFamily: "inherit",
              fontSize: "13px",
              fontWeight: 900,
              cursor: loading
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
        padding: "13px",
        border: "1px solid #e4e7ec",
        borderRadius: "9px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          color: "#98a2b3",
          fontSize: "10px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "6px",
          color: "#344054",
          fontSize: "13px",
          fontWeight: 900,
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

const fieldStyle = {
  width: "100%",
  minHeight: "46px",
  boxSizing: "border-box" as const,
  padding: "0 14px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "14px",
  outline: "none",
};