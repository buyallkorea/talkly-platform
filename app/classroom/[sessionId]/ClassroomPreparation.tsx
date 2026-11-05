"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ClassroomPreparation({ sessionId, initialMode, selectedTextbookId, textbooks, returnHref }: {
  sessionId: number; initialMode: "textbook" | "screen"; selectedTextbookId: number | null;
  textbooks: { id: number; title: string }[]; returnHref: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [book, setBook] = useState(String(selectedTextbookId ?? textbooks[0]?.id ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function enter() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/classroom/material-mode", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, mode, ...(mode === "textbook" && book ? { textbookId: Number(book) } : {}) }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not save classroom setup.");
      router.replace(`/classroom/${sessionId}?materials=ready`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not enter classroom."); setBusy(false); }
  }
  return <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
    <section className="mx-auto max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-7">
      <p className="text-sm font-semibold text-blue-300">TALKLY · CLASSROOM SETUP</p>
      <h1 className="mt-3 text-2xl font-bold">Choose lesson materials</h1>
      <p className="mt-2 text-sm text-slate-300">수업 전 교재 방식을 선택해 주세요. 수업 중에도 변경할 수 있습니다.</p>
      <fieldset disabled={busy} className="mt-6 space-y-4">
        <legend className="sr-only">Lesson material type</legend>
        <label className="flex gap-3 rounded-xl border border-slate-600 p-4"><input type="radio" name="material" checked={mode === "textbook"} onChange={() => setMode("textbook")} />Registered textbook · 등록 교재</label>
        {mode === "textbook" && <label className="block text-sm">Textbook · 교재
          <select value={book} onChange={event => setBook(event.target.value)} className="mt-2 w-full rounded-lg bg-slate-800 p-3">
            <option value="">Choose in classroom · 강의실에서 선택</option>
            {textbooks.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          {!textbooks.length && <span className="mt-2 block text-slate-300">No assigned textbook. You can use screen sharing instead.</span>}
        </label>}
        <label className="flex gap-3 rounded-xl border border-slate-600 p-4"><input type="radio" name="material" checked={mode === "screen"} onChange={() => setMode("screen")} />Online material / Screen share · 화면 공유</label>
      </fieldset>
      {mode === "screen" && <div className="mt-4 rounded-xl bg-slate-800 p-4 text-sm leading-7 text-slate-200">
        <strong>Two-window teaching · 두 창으로 수업하기</strong>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Open the original online textbook in a separate window. · 교재를 별도 창으로 여세요.</li>
          <li>Keep TALKLY and the textbook side by side. · 강의실과 교재 창을 나란히 배치하세요.</li>
          <li>Enter, connect Zoom audio/video, then click Start Class. · 입장·오디오 연결 후 수업을 시작하세요.</li>
          <li>In Zoom, share the textbook tab/window. Enable Share tab audio for listening. · 원본 교재 창을 공유하세요.</li>
        </ol>
        <p className="mt-2 text-blue-200">Do not share the TALKLY classroom tab. Students only need TALKLY; they do not need your textbook login. · 강의실 자체를 공유하지 마세요. 학생은 강의실만 열면 됩니다.</p>
      </div>}
      {error && <p role="alert" className="mt-4 text-red-300">{error}</p>}
      <button type="button" disabled={busy} onClick={() => void enter()} className="mt-6 w-full rounded-xl bg-blue-600 p-3 font-semibold disabled:opacity-50">{busy ? "Saving…" : "Enter classroom · 강의실 입장"}</button>
      <Link href={returnHref} className="mt-4 block text-center text-sm text-slate-300">Back to lessons · 수업 목록</Link>
    </section>
  </main>;
}
