"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TUITION_MONTHS,
  TUITION_REGIONS,
  type TuitionMonths,
  type TuitionRegion,
  tuitionAmount,
} from "@/lib/tuition";
import { MAX_SINGLE_PAYMENT_KRW } from "@/lib/payments/payment-limits";

type Props = {
  region?: TuitionRegion;
  onRegionChange?: (value: TuitionRegion) => void;
  weekly?: number;
  onWeeklyChange?: (value: number) => void;
  months?: TuitionMonths;
  onMonthsChange?: (value: TuitionMonths) => void;
  lessonMinutes?: number;
  showEnrollLink?: boolean;
};

const won = (value: number) => value.toLocaleString("ko-KR") + "원";
const inputStyle = {
  width: "100%",
  minHeight: "45px",
  padding: "10px 12px",
  color: "#0A1F44",
  background: "#fff",
  border: "1px solid #ccd7e6",
  borderRadius: "10px",
  fontSize: "14px",
} as const;

export default function TuitionCalculator({
  region, onRegionChange, weekly, onWeeklyChange,
  months, onMonthsChange, lessonMinutes = 25,
  showEnrollLink = false,
}: Props) {
  const [ownRegion, setOwnRegion] = useState<TuitionRegion>("philippines");
  const [ownWeekly, setOwnWeekly] = useState(2);
  const [ownMonths, setOwnMonths] = useState<TuitionMonths>(1);
  const actualRegion = region ?? ownRegion;
  const actualWeekly = weekly ?? ownWeekly;
  const actualMonths = months ?? ownMonths;
  const price = tuitionAmount(actualRegion, actualWeekly, actualMonths);
  const consultationOnly = lessonMinutes !== 25;
  const overLimit = price.final > MAX_SINGLE_PAYMENT_KRW;

  return (
    <section aria-label="수강료 자동 계산" style={{
      padding: "clamp(20px, 4vw, 32px)", border: "1px solid #cbdaf0",
      background: "#f8fbff", borderRadius: "18px", marginTop: "24px",
    }}>
      <div style={{ color: "#326bd1", fontSize: 12, fontWeight: 900, letterSpacing: "0.08em" }}>TUITION CALCULATOR</div>
      <h2 style={{ margin: "7px 0 8px", fontSize: 24, color: "#0A1F44" }}>수강료 자동 계산</h2>
      <p style={{ margin: "0 0 22px", color: "#59687b", fontSize: 13, lineHeight: 1.75 }}>
        강사 지역, 주당 수업 횟수, 수강기간을 선택하면 할인된 예상 수강료가 바로 표시됩니다.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
        <label style={{ color: "#344054", fontSize: 13, fontWeight: 800 }}>
          강사 지역
          <select aria-label="강사 지역" value={actualRegion} style={{ ...inputStyle, marginTop: 7 }}
            onChange={(e) => {
              const next = e.target.value as TuitionRegion;
              setOwnRegion(next); onRegionChange?.(next);
            }}>
            {TUITION_REGIONS.map((r) => <option value={r.key} key={r.key}>{r.label}</option>)}
          </select>
        </label>
        <label style={{ color: "#344054", fontSize: 13, fontWeight: 800 }}>
          주당 수업 횟수
          <select aria-label="주당 수업 횟수" value={actualWeekly} style={{ ...inputStyle, marginTop: 7 }}
            onChange={(e) => { const next = Number(e.target.value); setOwnWeekly(next); onWeeklyChange?.(next); }}>
            {[1, 2, 3, 4, 5].map((v) => <option value={v} key={v}>주 {v}회</option>)}
          </select>
        </label>
        <label style={{ color: "#344054", fontSize: 13, fontWeight: 800 }}>
          총 수강기간
          <select aria-label="총 수강기간" value={actualMonths} style={{ ...inputStyle, marginTop: 7 }}
            onChange={(e) => {
              const next = Number(e.target.value) as TuitionMonths;
              setOwnMonths(next); onMonthsChange?.(next);
            }}>
            {TUITION_MONTHS.map((v) => (
              <option value={v.months} key={v.months}>
                {v.months}개월{v.discount ? " (" + v.discount + "% 할인)" : " (기본)"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginTop: 23, background: "#fff", borderRadius: 14, border: "1px solid #d9e3f0", padding: "20px" }}>
        {consultationOnly ? (
          <>
            <strong style={{ color: "#0A1F44", fontSize: 20 }}>50분 수업은 별도 상담</strong>
            <p style={{ color: "#667085", fontSize: 13 }}>아래 금액은 25분 정규수업 기준입니다. 50분 수업의 실제 금액은 관리자와 상담해 주세요.</p>
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 9, color: "#475467", fontSize: 14 }}>
              <span>월 수강료 (25분 기준)</span><strong>{won(price.monthly)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 9, color: "#475467", fontSize: 14 }}>
              <span>할인 전 총액</span><span>{won(price.regular)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, color: "#157347", fontSize: 14 }}>
              <span>장기 수강 할인 ({price.rate}%)</span><strong>-{won(price.discount)}</strong>
            </div>
            <div style={{ borderTop: "1px solid #e7edf5", marginTop: 15, paddingTop: 16 }}>
              <div style={{ color: "#667085", fontSize: 12 }}>최종 예상 수강료</div>
              <strong style={{ display: "block", color: "#0A1F44", fontSize: "clamp(24px, 5vw, 33px)", marginTop: 4 }}>
                {won(price.final)}
              </strong>
            </div>
            {overLimit && <p role="alert" style={{ color: "#b42318", fontSize: 13 }}>1회 최대 결제 가능 금액 {won(MAX_SINGLE_PAYMENT_KRW)}을 초과하여 별도 상담이 필요합니다.</p>}
          </>
        )}
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 12, lineHeight: 1.8, color: "#667085" }}>
        평일 25분 수업, 월 4주 기준의 예상금액입니다. 주말 수업은 할증이 적용될 수 있으며, 실제 결제금액은 강사 및 일정 배정 후 서버에서 확정됩니다.
      </p>
      {showEnrollLink && (
        <Link href="/enroll" style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 46,
          marginTop: 18, padding: "0 24px", borderRadius: 10,
          color: "#fff", background: "#0A1F44", fontWeight: 800, textDecoration: "none",
        }}>
          수강신청하기 →
        </Link>
      )}
    </section>
  );
}
