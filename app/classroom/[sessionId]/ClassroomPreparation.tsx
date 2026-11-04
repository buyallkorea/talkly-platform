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
      {mode === "screen" && <p className="mt-4 text-sm leading-7 text-slate-300">Open the online textbook first. After joining Zoom, click its Share Screen button and select the textbook tab or window. Enable “Share tab audio” for listening activities. Students watch your screen; no website link or password is sent.<br />온라인 교재를 미리 열어두세요. 실제 공유 화면은 입장 후 직접 선택합니다.</p>}
      {error && <p role="alert" className="mt-4 text-red-300">{error}</p>}
      <button type="button" disabled={busy} onClick={() => void enter()} className="mt-6 w-full rounded-xl bg-blue-600 p-3 font-semibold disabled:opacity-50">{busy ? "Saving…" : "Enter classroom · 강의실 입장"}</button>
      <Link href={returnHref} className="mt-4 block text-center text-sm text-slate-300">Back to lessons · 수업 목록</Link>
    </section>
  </main>;
}
