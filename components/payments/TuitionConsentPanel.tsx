"use client";
import Link from "next/link";
import {
  TUITION_CONSENT_ITEMS,
  type TuitionConsentAnswers,
  type TuitionConsentKey,
} from "@/lib/payments/tuition-consent";

export default function TuitionConsentPanel({
  answers, onChange, disabled = false,
}: {
  answers: TuitionConsentAnswers;
  onChange: (key: TuitionConsentKey, value: "yes" | "no") => void;
  disabled?: boolean;
}) {
  return (
    <section aria-labelledby="tuition-consent-heading" style={{ marginTop: 18, padding: 17, borderRadius: 14, border: "1px solid #6485b6", background: "#18335c" }}>
      <h3 id="tuition-consent-heading" style={{ fontSize: 17, margin: "0 0 8px", color: "white" }}>수강료 결제 전 필수 확인사항</h3>
      <p style={{ color: "#d5e4f9", fontSize: 12, lineHeight: 1.7, margin: "0 0 12px" }}>
        세 항목을 확인·동의해 주세요. 하나라도 미확인·미동의 상태면 결제를 진행할 수 없습니다.
      </p>
      {TUITION_CONSENT_ITEMS.map((item) => (
        <fieldset key={item.key} disabled={disabled} style={{ margin: "0 0 13px", padding: "12px 0 15px", border: 0, borderBottom: "1px solid #506b92", minWidth: 0 }}>
          <legend style={{ color: "#ffffff", fontSize: 13, fontWeight: 800, padding: 0 }}>{item.label}</legend>
          <p style={{ color: "#dbeafe", lineHeight: 1.8, fontSize: 12, margin: "7px 0 9px" }}>{item.text}</p>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {(["yes", "no"] as const).map((value) => (
              <label key={value} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#fff", cursor: disabled ? "default" : "pointer" }}>
                <input type="radio" name={`tuition-consent-${item.key}`} value={value} checked={answers[item.key] === value}
                  onChange={() => onChange(item.key, value)} style={{ accentColor: "#a9d4ff", width: 17, height: 17 }} />
                {value === "yes" ? item.positive : item.negative}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <p style={{ color: "#e1ecff", fontSize: 12, lineHeight: 1.75, margin: 0 }}>
        <Link href="/refund-policy" target="_blank" rel="noopener noreferrer" style={{ color: "#fff", fontWeight: 800, textDecoration: "underline" }}>수강 취소 및 환불정책 전문 보기</Link>
        {" · "}동의 내용과 선택 시각, 결제조건은 주문별 증빙으로 보관됩니다.
      </p>
    </section>
  );
}
