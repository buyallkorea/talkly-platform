"use client";

import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Props = {
  textbookId: number;
  volumeId: number;
  displayTitle: string;
  originalFileUrl: string | null;
  pageCount: number;
};
type PageInfo = {
  page_number: number;
  page_image_url: string;
  page_width: number;
  page_height: number;
};
type ApiResult = {
  success?: boolean;
  error?: string;
  pages?: PageInfo[];
  pageCount?: number;
};
const supported = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);
const extension = (name: string) => name.split(".").pop()?.toLowerCase() || "";
const collator = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });
const MAX_FILES = 150;
const MAX_FILE_BYTES = 60 * 1024 * 1024;
function contentType(file: File): string {
  const ext = extension(file.name);
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}
function safeFilename(name: string): string {
  const ext = extension(name);
  const stem = name.slice(0, name.length - ext.length - 1).normalize("NFKD")
    .replace(/[^a-zA-Z0-9_.-]/g, "_").replace(/_+/g, "_").slice(0, 90) || "page";
  return stem + "." + ext;
}
function fileSize(size: number): string { return (size / 1024 / 1024).toFixed(2) + " MB"; }

export default function VolumePdfManager({textbookId,volumeId,displayTitle,originalFileUrl,pageCount}: Props) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const alreadyProcessed = pageCount > 0 || Boolean(originalFileUrl);

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const candidates = Array.from(event.target.files ?? []);
    event.target.value = "";
    setError(""); setSuccess(""); setProgress("");
    if (!candidates.length) return;
    if (candidates.length > MAX_FILES) {
      setFiles([]); setError("한 권에 한 번에 등록할 수 있는 파일은 최대 150개입니다."); return;
    }
    for (const file of candidates) {
      if (!supported.has(extension(file.name)) || file.size < 1 || file.size > MAX_FILE_BYTES) {
        setFiles([]);
        setError("PDF·JPG·JPEG·PNG·WEBP 파일만 등록할 수 있으며, 파일 하나당 60MB 이하여야 합니다.");
        return;
      }
    }
    setFiles(candidates.sort((a,b) => collator.compare(a.name,b.name)));
  }

  function move(index: number, delta: number) {
    setFiles(current => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index],next[target]] = [next[target],next[index]];
      return next;
    });
  }

  async function callProcessor(batchId: string, data: Record<string, unknown>): Promise<ApiResult> {
    const response = await fetch("/api/admin/textbook-volumes/" + volumeId + "/process-files", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ textbookId, batchId, ...data }),
      signal: AbortSignal.timeout(300000),
    });
    const raw = await response.text();
    let result: ApiResult;
    try { result = JSON.parse(raw) as ApiResult; }
    catch { throw Error("교재 처리 서버가 올바른 응답을 반환하지 않았습니다. HTTP " + response.status); }
    if (!response.ok || !result.success) throw Error(result.error || "교재 처리에 실패했습니다. HTTP " + response.status);
    return result;
  }

  async function upload() {
    if (busy || alreadyProcessed) return;
    if (!files.length) { setError("등록할 PDF 또는 이미지 파일을 선택해주세요."); return; }
    setBusy(true); setError(""); setSuccess("");
    const batchId = crypto.randomUUID();
    const originals: string[] = [];
    const pages: PageInfo[] = [];
    let finalizationStarted = false;

    try {
      const supabase = createClient();
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const name = String(index + 1).padStart(3,"0") + "-" + safeFilename(file.name);
        const path = "textbooks/" + textbookId + "/volumes/" + volumeId + "/original/" + batchId + "/" + name;
        setProgress("파일 " + (index + 1) + "/" + files.length + " 업로드 중: " + file.name);
        const { error: uploadError } = await supabase.storage.from("textbook-files").upload(path, file, {
          upsert: false, contentType: contentType(file), cacheControl: "3600",
        });
        if (uploadError) throw Error("원본 업로드 실패 (" + file.name + "): " + uploadError.message);
        originals.push(path);

        setProgress("파일 " + (index + 1) + "/" + files.length + " 페이지 생성 중: " + file.name);
        const result = await callProcessor(batchId, { operation: "render", storagePath: path, startPage: pages.length + 1 });
        if (!result.pages?.length || result.pageCount !== result.pages.length) throw Error("변환된 페이지 정보를 확인하지 못했습니다.");
        if (result.pages.some((row, i) => row.page_number !== pages.length + i + 1)) throw Error("페이지 순서가 잘못되었습니다.");
        pages.push(...result.pages);
        if (pages.length > 400) throw Error("한 권에는 최대 400페이지만 등록할 수 있습니다.");
        setProgress("변환 완료: " + pages.length + "페이지 / " + files.length + "개 파일 중 " + (index + 1) + "개");
      }
      finalizationStarted = true;
      setProgress("E-Book 페이지 " + pages.length + "개를 교재에 저장하고 있습니다...");
      const result = await callProcessor(batchId, { operation: "finalize", sources: originals, pages });
      if (result.pageCount !== pages.length) throw Error("최종 저장 페이지 수가 일치하지 않습니다. 관리자에게 문의해주세요.");
      setSuccess(displayTitle + " · " + files.length + "개 파일을 " + pages.length + "페이지로 등록했습니다.");
      setProgress("");
      setFiles([]);
      router.refresh();
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "교재 등록 중 오류가 발생했습니다.";
      if (!finalizationStarted) {
        try {
          // Only ephemeral objects from this batch are discarded, never existing pages.
          await callProcessor(batchId, {
            operation: "discard", sources: originals, pages: pages.map(row => row.page_image_url),
          });
        } catch (cleanupError) {
          console.error("TEXTBOOK TEMP CLEANUP ERROR:", cleanupError);
        }
      }
      setError(detail + (finalizationStarted ? " 새로고침하여 등록 상태를 확인해주세요." : " 기존 교재는 변경되지 않았습니다."));
      setProgress("");
      console.error("TEXTBOOK MULTI FILE UPLOAD ERROR:", caught);
    } finally {
      setBusy(false);
    }
  }

  return <section className="talkly-volume-upload">
    <h2>수업용 교재 파일 등록</h2>
    <p className="talkly-volume-upload-description">
      여러 개의 PDF, JPG, JPEG, PNG, WEBP 파일을 한꺼번에 선택할 수 있습니다.
      파일마다 한 페이지씩 분리되어 있어도 순서대로 합쳐 하나의 E-Book으로 등록합니다.
      여러 페이지가 들어 있는 PDF는 각 페이지가 자동으로 분리됩니다.
    </p>
    {alreadyProcessed ? <div className="talkly-volume-upload-completed">
      <strong>교재 페이지 등록 완료</strong>
      <p>기존 E-Book 페이지 <b>{pageCount}개</b>가 생성되어 있습니다.</p>
      <p>페이지·오디오 핫스팟을 보호하기 위해 이미 등록된 권의 파일 재등록은 차단되어 있습니다.</p>
      {originalFileUrl && <small>원본 저장 경로: {originalFileUrl}</small>}
    </div> : <>
      <div className="talkly-volume-upload-selection">
        <label htmlFor="volumePageFiles">PDF / 이미지 파일 여러 개 선택</label>
        <input id="volumePageFiles" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          disabled={busy} onChange={selectFiles}/>
        <p>자동 정렬: 파일명의 숫자 순서 (예: 1, 2, 10). 아래에서 ▲▼ 버튼으로 순서를 조정할 수 있습니다.</p>
        <p>파일당 60MB 이하 · 한 번에 최대 150개 · 한 권 최대 400페이지</p>
      </div>
      {files.length > 0 && <div className="talkly-volume-upload-queue">
        <div className="talkly-volume-upload-queue-header"><strong>선택한 파일 {files.length}개</strong><span>위에서 아래 순서대로 교재 페이지를 생성합니다.</span></div>
        <ol>{files.map((file,index)=><li key={index}>
          <span className="talkly-volume-upload-item-number">{index+1}</span>
          <span className="talkly-volume-upload-item-name" title={file.name}>{file.name}<small>{fileSize(file.size)}</small></span>
          <div className="talkly-volume-upload-move">
            <button type="button" disabled={busy||index===0} onClick={()=>move(index,-1)} aria-label={file.name+" 순서 위로"}>▲</button>
            <button type="button" disabled={busy||index===files.length-1} onClick={()=>move(index,1)} aria-label={file.name+" 순서 아래로"}>▼</button>
          </div>
        </li>)}</ol>
      </div>}
      <button type="button" className="talkly-volume-upload-submit" onClick={()=>void upload()} disabled={busy||files.length===0}>
        {busy ? "파일을 등록하고 있습니다..." : files.length+"개 파일로 E-Book 페이지 생성"}
      </button>
      {busy && <p className="talkly-volume-upload-warning">등록이 완료될 때까지 이 페이지를 닫거나 새로고침하지 마세요.</p>}
    </>}
    {progress && <p className="talkly-volume-upload-progress" role="status">{progress}</p>}
    {error && <p className="talkly-volume-upload-error" role="alert">{error}</p>}
    {success && <p className="talkly-volume-upload-success" role="status">{success}</p>}
  </section>;
}
