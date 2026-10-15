"use client";

import { useState } from "react";

type Props = {
  teacherUserId: string;
  initialValue: boolean;
  disabled?: boolean;
};

export default function HomepageVisibilityToggle({
  teacherUserId,
  initialValue,
  disabled = false,
}: Props) {
  const [enabled, setEnabled] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange() {
    if (saving || disabled) return;

    const nextValue = !enabled;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/admin/teachers/homepage-visibility",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            teacherUserId,
            showOnHomepage: nextValue,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || result.success !== true) {
        throw new Error(
          result.error || "설정 저장에 실패했습니다."
        );
      }

      setEnabled(nextValue);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "설정 저장에 실패했습니다."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="메인페이지 강사 노출"
        disabled={saving || disabled}
        onClick={handleChange}
        style={{
          width: "48px",
          height: "27px",
          padding: "3px",
          border: "none",
          borderRadius: "999px",
          background: enabled ? "#175cd3" : "#d0d5dd",
          cursor: saving || disabled ? "not-allowed" : "pointer",
          opacity: saving || disabled ? 0.55 : 1,
          transition: "background 0.2s",
        }}
      >
        <span
          style={{
            display: "block",
            width: "21px",
            height: "21px",
            borderRadius: "50%",
            background: "#ffffff",
            transform: enabled
              ? "translateX(21px)"
              : "translateX(0)",
            transition: "transform 0.2s",
          }}
        />
      </button>

      <div
        style={{
          marginTop: "3px",
          fontSize: "11px",
          color: enabled ? "#175cd3" : "#667085",
        }}
      >
        {saving ? "저장 중" : enabled ? "ON" : "OFF"}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: "4px",
            fontSize: "11px",
            color: "#b42318",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}