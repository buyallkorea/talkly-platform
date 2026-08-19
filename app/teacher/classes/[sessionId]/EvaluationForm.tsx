"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Props = {
  sessionId: number;
  teacherUserId: string;
  initialEvaluation: {
    id: number;
    participation_score: number | null;
    comprehension_score: number | null;
    speaking_score: number | null;
    pronunciation_score: number | null;
    strengths: string | null;
    improvements: string | null;
    homework: string | null;
    teacher_comment: string | null;
  } | null;
};

function Score({
  title, ko, value, setValue,
}: {
  title: string;
  ko: string;
  value: number | null;
  setValue: (n: number) => void;
}) {
  return (
    <div>
      <strong>{title}</strong>
      <div style={{ fontSize: 12, opacity: 0.55, margin: "3px 0 10px" }}>{ko}</div>
      <div style={{ display: "flex", gap: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setValue(n)}
            style={{
              width: 42, height: 42, borderRadius: 8,
              border: value === n ? "2px solid #111" : "1px solid #ccc",
              background: value === n ? "#f2f2f2" : "#fff",
              fontWeight: value === n ? 700 : 400,
              cursor: "pointer",
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function EvaluationForm({
  sessionId, teacherUserId, initialEvaluation,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [participation, setParticipation] = useState<number | null>(initialEvaluation?.participation_score ?? null);
  const [comprehension, setComprehension] = useState<number | null>(initialEvaluation?.comprehension_score ?? null);
  const [speaking, setSpeaking] = useState<number | null>(initialEvaluation?.speaking_score ?? null);
  const [pronunciation, setPronunciation] = useState<number | null>(initialEvaluation?.pronunciation_score ?? null);
  const [strengths, setStrengths] = useState(initialEvaluation?.strengths ?? "");
  const [improvements, setImprovements] = useState(initialEvaluation?.improvements ?? "");
  const [homework, setHomework] = useState(initialEvaluation?.homework ?? "");
  const [comment, setComment] = useState(initialEvaluation?.teacher_comment ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if ([participation, comprehension, speaking, pronunciation].some((v) => v === null)) {
      setMessage("Please select all four scores. / 4개 평가 점수를 모두 선택해주세요.");
      return;
    }

    setSaving(true);

    const payload = {
      class_session_id: sessionId,
      teacher_user_id: teacherUserId,
      participation_score: participation,
      comprehension_score: comprehension,
      speaking_score: speaking,
      pronunciation_score: pronunciation,
      strengths: strengths.trim() || null,
      improvements: improvements.trim() || null,
      homework: homework.trim() || null,
      teacher_comment: comment.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const result = initialEvaluation
      ? await supabase.from("evaluations").update(payload).eq("id", initialEvaluation.id)
      : await supabase.from("evaluations").insert(payload);

    setSaving(false);

    if (result.error) {
      setMessage(`Evaluation save failed: ${result.error.message} / code: ${result.error.code}`);
      return;
    }

    setMessage(initialEvaluation
      ? "Evaluation updated. / 학습 평가가 수정되었습니다."
      : "Evaluation saved. / 학습 평가가 저장되었습니다."
    );
    router.refresh();
  }

  const textareaStyle: React.CSSProperties = {
    width: "100%", minHeight: 100, padding: 12,
    border: "1px solid #ccc", borderRadius: 8,
    boxSizing: "border-box", resize: "vertical", font: "inherit",
  };

  return (
    <form onSubmit={save} style={{ marginTop: 22 }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 24,
      }}>
        <Score title="Participation" ko="참여도" value={participation} setValue={setParticipation} />
        <Score title="Comprehension" ko="이해도" value={comprehension} setValue={setComprehension} />
        <Score title="Speaking" ko="말하기" value={speaking} setValue={setSpeaking} />
        <Score title="Pronunciation" ko="발음" value={pronunciation} setValue={setPronunciation} />
      </div>

      <div style={{ marginTop: 28, display: "grid", gap: 20 }}>
        <label><strong>Strengths</strong><div style={{ fontSize: 12, opacity: .55, marginBottom: 8 }}>잘한 점</div>
          <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} style={textareaStyle} />
        </label>
        <label><strong>Areas for Improvement</strong><div style={{ fontSize: 12, opacity: .55, marginBottom: 8 }}>보완할 점</div>
          <textarea value={improvements} onChange={(e) => setImprovements(e.target.value)} style={textareaStyle} />
        </label>
        <label><strong>Homework</strong><div style={{ fontSize: 12, opacity: .55, marginBottom: 8 }}>숙제</div>
          <textarea value={homework} onChange={(e) => setHomework(e.target.value)} style={textareaStyle} />
        </label>
        <label><strong>Teacher Comment</strong><div style={{ fontSize: 12, opacity: .55, marginBottom: 8 }}>종합 코멘트</div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} style={textareaStyle} />
        </label>
      </div>

      {message && (
        <div style={{ marginTop: 18, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        style={{
          marginTop: 20, padding: "12px 18px",
          border: "1px solid #ccc", borderRadius: 8,
          background: "#fff", fontWeight: 700,
          cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Saving..." : initialEvaluation ? "Update Evaluation" : "Save Evaluation"}
        <span style={{ display: "block", fontSize: 11, opacity: .55, fontWeight: 400 }}>
          {initialEvaluation ? "학습 평가 수정" : "학습 평가 저장"}
        </span>
      </button>
    </form>
  );
}