
"use client";

import { useState } from "react";

type TextbookOption = {
  id: number;
  title: string;
};

type Props = {
  sessionId: number;
  selectedTextbookId: number | null;
  textbooks: TextbookOption[];
  canControl: boolean;
  onSelected: (textbookId: number) => void;
};

export default function ClassroomTextbookSelector({
  sessionId,
  selectedTextbookId,
  textbooks,
  canControl,
  onSelected,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = async (
    textbookId: number
  ) => {
    if (!canControl || saving) return;

    if (textbookId === selectedTextbookId) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        "/api/classroom/select-textbook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            textbookId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "교재를 변경하지 못했습니다."
        );
      }

      onSelected(result.textbookId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "교재 변경 중 오류가 발생했습니다."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-sm text-slate-800">
          수업 교재
        </strong>

        <span className="text-xs text-slate-500">
          {canControl
            ? "강사 선택"
            : "강사와 동기화"}
        </span>
      </div>

      {textbooks.length === 0 ? (
        <p className="text-sm text-slate-500">
          배정된 교재가 없습니다.
        </p>
      ) : (
        <select
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          value={selectedTextbookId ?? ""}
          disabled={!canControl || saving}
          onChange={(event) => {
            const id = Number(event.target.value);

            if (Number.isSafeInteger(id) && id > 0) {
              void handleChange(id);
            }
          }}
        >
          <option value="">
            교재를 선택해주세요
          </option>

          {textbooks.map((textbook) => (
            <option
              key={textbook.id}
              value={textbook.id}
            >
              {textbook.title}
            </option>
          ))}
        </select>
      )}

      {saving && (
        <p className="mt-2 text-xs text-blue-600">
          교재 변경 내용을 저장하고 있습니다.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-2 text-xs text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}
