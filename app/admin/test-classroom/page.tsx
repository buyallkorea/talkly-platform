"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type CreateResult = {
  success?: boolean;
  error?: string;
  sessionId?: number;
  classroomUrl?: string;
};

export default function TestClassroomPage() {
  const [teacherUserId, setTeacherUserId] = useState("");
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [textbooks, setTextbooks] = useState<{ id: number; title: string; pages: number }[]>([]);
  const [textbookId, setTextbookId] = useState("");
  const [optionsError, setOptionsError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/test-classroom/options", { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "목록 조회 실패");
        setTeachers(data.teachers); setTextbooks(data.textbooks);
        setTeacherUserId(data.teachers[0]?.id ?? "");
        setTextbookId(String(data.textbooks[0]?.id ?? ""));
      }).catch(error => { if (!controller.signal.aborted) setOptionsError(error.message); });
    return () => controller.abort();
  }, []);
  const [scheduledStart, setScheduledStart] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<25 | 50>(25);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const start = new Date(scheduledStart);
    if (!scheduledStart || !Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) {
      setResult({ error: "미래의 올바른 수업 시작시간을 선택해주세요." });
      return;
    }

    if (!window.confirm("관리자 테스트 수업을 생성하시겠습니까? Zoom 회의와 테스트 데이터가 생성됩니다.")) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/test-classroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherUserId,
          textbookId: Number(textbookId),
          scheduledStart: start.toISOString(),
          durationMinutes,
        }),
      });

      const data = (await response.json()) as CreateResult;
      setResult(data);

      if (!response.ok && !data.error) {
        setResult({ error: `테스트 수업 생성 실패 (${response.status})` });
      }
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : "요청 중 오류가 발생했습니다.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 24px 80px" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 12 }}>
        관리자 테스트 수업
      </h1>
      <p style={{ lineHeight: 1.7, opacity: 0.75, marginBottom: 28 }}>
        실제 학생 없이 강사와 관리자 간 Zoom 수업을 점검합니다.
        생성된 수업은 테스트 데이터로 표시됩니다.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          padding: 28,
          border: "1px solid #d1d5db",
          borderRadius: 14,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <strong>강사 선택</strong>
          <select
            required
            value={teacherUserId}
            onChange={(event) => setTeacherUserId(event.target.value)}
            style={{ padding: 12, borderRadius: 8, border: "1px solid #aaa" }}
          >
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
        </label>

        {optionsError && <p role="alert" style={{ color: "#b91c1c" }}>{optionsError}</p>}
        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <strong>수업 교재 선택</strong>
          <select required value={textbookId} onChange={event => setTextbookId(event.target.value)} style={{ padding: 12, borderRadius: 8, border: "1px solid #aaa" }}>
            <option value="">교재를 선택해 주세요</option>
            {textbooks.map(book => <option key={book.id} value={book.id}>{book.title} · {book.pages}페이지</option>)}
          </select>
          <small>페이지 준비가 완료된 활성 교재만 표시됩니다. 선택한 교재가 테스트 수업에 자동 배정됩니다.</small>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <strong>수업 시작 날짜 및 시간</strong>
          <input
            type="datetime-local"
            required
            value={scheduledStart}
            onChange={(event) => setScheduledStart(event.target.value)}
            style={{ padding: 12, borderRadius: 8, border: "1px solid #aaa" }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <strong>수업시간</strong>
          <select
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value) as 25 | 50)}
            style={{ padding: 12, borderRadius: 8, border: "1px solid #aaa" }}
          >
            <option value={25}>25분</option>
            <option value={50}>50분</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={loading || !teacherUserId || !textbookId || !!optionsError}
          style={{
            padding: 14,
            borderRadius: 9,
            fontWeight: 700,
            background: "#2563eb",
            color: "white",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "테스트 수업 생성 중..." : "테스트 수업 생성"}
        </button>
      </form>

      {result && (
        <section style={{ marginTop: 24, padding: 22, border: "1px solid #d1d5db", borderRadius: 12 }}>
          {result.success && result.classroomUrl ? (
            <>
              <p><strong>테스트 수업이 생성되었습니다.</strong></p>
              <p>수업 ID: {result.sessionId}</p>
              <Link href={result.classroomUrl} style={{ color: "#2563eb", fontWeight: 700 }}>
                테스트 수업 입장 →
              </Link>
            </>
          ) : (
            <p role="alert">{result.error ?? "테스트 수업 생성 결과를 확인할 수 없습니다."}</p>
          )}
        </section>
      )}
    </main>
  );
}
