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

type Props = {
  region?: TuitionRegion;
  onRegionChange?: (value: TuitionRegion) => void;
  weekly?: number;
  onWeeklyChange?: (value: number) => void;
  months?: TuitionMonths;
  onMonthsChange?: (value: TuitionMonths) => void;
  lessonMinutes?: number;
  showEnrollLink?: boolean;
  weeklyOptions?: number[];
};

const won = (value: number) => value.toLocaleString("ko-KR") + "원";
const inputStyle = {
  width: "100%", minHeight: 45, padding: "10px 12px", color: "#0A1F44",
  background: "#fff", border: "1px solid #ccd7e6", borderRadius: 10, fontSize: 14,
} as const;

export default function TuitionCalculator({
  region, onRegionChange, weekly, onWeeklyChange,
  months, onMonthsChange, lessonMinutes = 25,
  showEnrollLink = false, weeklyOptions = [2, 3, 5],
}: Props) {
  const [ownRegion, setOwnRegion] = useState<TuitionRegion>("philippines");
  const [ownWeekly, setOwnWeekly] = useState(2);
  const [ownMonths, setOwnMonths] = useState<TuitionMonths>(1);
  const [courseType, setCourseType] = useState<"regular" | "intensive">("regular");
  const [intensiveCount, setIntensiveCount] = useState(1);
  const actualRegion = region ?? ownRegion;
  const actualWeekly = weekly ?? ownWeekly;
  const actualMonths = months ?? ownMonths;
  const price = tuitionAmount(actualRegion, actualWeekly, actualMonths);
  const intensive = showEnrollLink && courseType === "intensive";
  const consultationOnly = lessonMinutes !== 25 && !intensive;
  const totalLessons = intensive ? intensiveCount : actualWeekly * 4 * actualMonths;

  return (
    <section aria-label="수강료 자동 계산" style={{
      padding: "clamp(18px,4vw,28px)", border: "1px solid #cbdaf0",
      background: "#f8fbff", borderRadius: 18, marginTop: 20,
    }}>
      <div style={{ color: "#326bd1", fontSize: 12, fontWeight: 900, letterSpacing: ".08em" }}>TUITION CALCULATOR</div>
      <h2 style={{ margin: "7px 0 8px", fontSize: 24, color: "#0A1F44" }}>수강료 계산해보기</h2>
      <p style={{ margin: "0 0 16px", color: "#59687b", fontSize: 13, lineHeight: 1.75 }}>
        강사선택, 주당 수업 횟수, 수강기간을 선택하면 할인된 예상 수강료가 바로 표시됩니다.
      </p>
      {showEnrollLink && (
        <fieldset style={{ border: 0, padding: 0, margin: "0 0 16px" }}>
          <legend style={{ color: "#344054", fontSize: 13, fontWeight: 800, marginBottom: 8 }}>수강 유형</legend>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <label><input type="radio" name="tuition-course-type" checked={!intensive} onChange={() => setCourseType("regular")} /> 정규수업</label>
            <label><input type="radio" name="tuition-course-type" checked={intensive} onChange={() => setCourseType("intensive")} /> 단기집중코스</label>
          </div>
        </fieldset>
      )}
      {intensive ? (
        <label style={{ display: "block", maxWidth: 260, color: "#344054", fontSize: 13, fontWeight: 800 }}>
          총 수업 횟수 (1~20회)
          <select aria-label="단기집중코스 총 수업 횟수" value={intensiveCount} style={{ ...inputStyle, marginTop: 7 }}
            onChange={(e) => setIntensiveCount(Number(e.target.value))}>
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}회</option>)}
          </select>
        </label>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
          <label style={{ color: "#344054", fontSize: 13, fontWeight: 800 }}>
            강사선택
            <select aria-label="강사선택" value={actualRegion} style={{ ...inputStyle, marginTop: 7 }}
              onChange={(e) => { const next = e.target.value as TuitionRegion; setOwnRegion(next); onRegionChange?.(next); }}>
              {TUITION_REGIONS.map((r) => <option value={r.key} key={r.key}>{r.label}</option>)}
            </select>
          </label>
          <label style={{ color: "#344054", fontSize: 13, fontWeight: 800 }}>
            주당 수업 횟수
            <select aria-label="주당 수업 횟수" value={actualWeekly} style={{ ...inputStyle, marginTop: 7 }}
              onChange={(e) => { const next = Number(e.target.value); setOwnWeekly(next); onWeeklyChange?.(next); }}>
              {weeklyOptions.map((v) => <option value={v} key={v}>주 {v}회</option>)}
            </select>
          </label>
          <label style={{ color: "#344054", fontSize: 13, fontWeight: 800 }}>
            총 수강기간
            <select aria-label="총 수강기간" value={actualMonths} style={{ ...inputStyle, marginTop: 7 }}
              onChange={(e) => { const next = Number(e.target.value) as TuitionMonths; setOwnMonths(next); onMonthsChange?.(next); }}>
              {TUITION_MONTHS.map((v) => <option value={v.months} key={v.months}>
                {v.months}개월{v.discount ? " (" + v.discount + "% 할인)" : " (기본)"}
              </option>)}
            </select>
          </label>
        </div>
      )}
      <div aria-live="polite" style={{ marginTop: 16, background: "#fff", borderRadius: 14, border: "1px solid #d9e3f0", padding: 19 }}>
        {consultationOnly ? (
          <><strong style={{ color: "#0A1F44" }}>50분 수업은 별도 상담</strong><p style={{ color: "#667085", fontSize: 13 }}>25분 수업 기준으로 다시 선택해 주세요.</p></>
        ) : intensive ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14, color: "#475467" }}>
              <span>단기집중코스 30분 · {intensiveCount}회</span><strong>회당 40,000원</strong>
            </div>
            <div style={{ color: "#667085", fontSize: 12, marginTop: 14 }}>총 예상 수강료 (할인 없음)</div>
            <strong style={{ display: "block", color: "#0A1F44", fontSize: 30 }}>{won(intensiveCount * 40000)}</strong>
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8, color: "#475467", fontSize: 14 }}><span>월 수강료 (25분)</span><strong>{won(price.monthly)}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8, color: "#475467", fontSize: 14 }}><span>할인 전 총액</span><span>{won(price.regular)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, color: "#157347", fontSize: 14 }}><span>장기 수강 할인 ({price.rate}%)</span><strong>-{won(price.discount)}</strong></div>
            <div style={{ borderTop: "1px solid #e7edf5", marginTop: 13, paddingTop: 14 }}>
              <div style={{ color: "#667085", fontSize: 12 }}>최종 예상 수강료</div>
              <strong style={{ display: "block", color: "#0A1F44", fontSize: "clamp(24px,5vw,33px)", marginTop: 4 }}>{won(price.final)}</strong>
            </div>
          </>
        )}
        {!consultationOnly && <p style={{ fontSize: 13, color: "#344054", margin: "12px 0 0", fontWeight: 800 }}>총 수업 횟수: {totalLessons.toLocaleString("ko-KR")}회</p>}
      </div>
      {!showEnrollLink && <p style={{ fontSize: 12, color: "#667085", margin: "12px 0 0" }}>
        평일 25분 수업, 월 4주 기준의 예상금액입니다. 최종 결제금액은 서버에서 확정됩니다.
      </p>}
      {showEnrollLink && <Link href="/enroll" style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 46,
        marginTop: 16, padding: "0 24px", borderRadius: 10,
        color: "#fff", background: "#0A1F44", fontWeight: 800, textDecoration: "none",
      }}>수강신청하기</Link>}
    </section>
  );
}
