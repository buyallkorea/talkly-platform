"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type CreateResult = {
  success?: boolean;
  error?: string;
  sessionId?: number;
  classroomUrl?: string;
};

const TEACHERS = [
  { id: "3c269c0a-fb3e-4e8f-98d5-fc1ac29cc090", name: "Jennifer" },
  { id: "b6dd3057-6350-45cb-ac89-8eb289f2740c", name: "Suzette" },
  { id: "f9f6f009-86f5-4604-9bef-cc814ecbf390", name: "Mars" },
  { id: "d67feb8e-9635-48b2-8b18-ed809ce00128", name: "Leo" },
  { id: "610c8097-10dd-408e-a368-89a5af29784d", name: "Cheryl" },
];

export default function TestClassroomPage() {
  const [teacherUserId, setTeacherUserId] = useState(TEACHERS[0].id);
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
            value={teacherUserId}
            onChange={(event) => setTeacherUserId(event.target.value)}
            style={{ padding: 12, borderRadius: 8, border: "1px solid #aaa" }}
          >
            {TEACHERS.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
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
          disabled={loading}
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
