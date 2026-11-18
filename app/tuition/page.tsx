import type { Metadata } from "next";
import Link from "next/link";
import TuitionCalculator from "@/components/TuitionCalculator";
import { TUITION_REGIONS, TUITION_MONTHS, tuitionAmount } from "@/lib/tuition";

export const metadata: Metadata = {
  title: "수강료 안내 | TALKLY",
  description: "TALKLY 화상영어 필리핀·서구권·북미권 강사별 수강료와 장기수강 할인 안내",
};

const won = (amount: number) => amount.toLocaleString("ko-KR") + "원";
const frequencies = [2, 3, 5];

export default function TuitionPage() {
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#f0f6ff 0%,#fff 46%)", padding: "64px 18px 92px" }}>
      <div style={{ width: "min(1030px,100%)", margin: "0 auto" }}>
        <Link href="/" style={{ color: "#4169a1", fontSize: 14, textDecoration: "none", fontWeight: 800 }}>← TALKLY 홈</Link>
        <p style={{ margin: "30px 0 7px", color: "#3978ef", fontSize: 12, fontWeight: 900, letterSpacing: "0.1em" }}>TALKLY TUITION</p>
        <h1 style={{ margin: 0, color: "#0A1F44", fontSize: "clamp(30px,5vw,43px)", letterSpacing: "-0.04em" }}>수강료 안내</h1>

        <section style={{ marginTop: 28, padding: "clamp(18px,4vw,30px)", background: "#fff", border: "1px solid #e1e9f3", borderRadius: 18, boxShadow: "0 12px 35px rgba(10,31,68,.05)" }}>
          <h2 style={{ fontSize: 23, color: "#0A1F44", margin: "0 0 9px" }}>정규수업 월 수강료</h2>
          <p style={{ fontSize: 13, color: "#667085", lineHeight: 1.7, marginBottom: 20 }}>평일 수업 기준 / 수업당 25분 / 월 4주(주 2·3·5회 기준) / 주말·50분 수업은 별도 상담</p>
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560, textAlign: "center" }}>
              <thead>
                <tr style={{ background: "#0A1F44", color: "#fff" }}>
                  {["강사 구분", "주 2회", "주 3회", "주 5회"].map((h) => (
                    <th key={h} scope="col" style={{ padding: "15px 12px", border: "1px solid #d7e1ef", fontSize: 14 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TUITION_REGIONS.map((region, index) => (
                  <tr key={region.key} style={{ background: index === 0 ? "#f2f6fd" : index === 1 ? "#fcf6f2" : "#eff8f4" }}>
                    <th scope="row" style={{ padding: "16px 12px", border: "1px solid #d7e1ef", fontSize: 14, color: "#0A1F44" }}>{region.label}</th>
                    {frequencies.map((weekly) => (
                      <td key={weekly} style={{ padding: "16px 10px", border: "1px solid #d7e1ef", color: "#1d2939", fontSize: 14, fontWeight: 700 }}>
                        {won(tuitionAmount(region.key, weekly, 1).monthly)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 13, color: "#526277", lineHeight: 1.7, marginBottom: 0 }}>
            주 2·3회 수강생은 월 최대 1회, 주 5회 수강생은 월 최대 2회 수업 연기를 신청할 수 있습니다.
          </p>
        </section>

        <section style={{ marginTop: 16, padding: "20px clamp(16px,3vw,24px)", background: "#fff", border: "1px solid #e1e9f3", borderRadius: 18 }}>
          <h2 style={{ fontSize: 21, color: "#0A1F44", margin: "0 0 10px" }}>장기 수강 할인</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
            {TUITION_MONTHS.filter((p) => p.discount > 0).map((policy) => (
              <div key={policy.months} style={{ border: "1px solid #d7e5fa", background: "#edf4ff", padding: "10px 12px", textAlign: "center", borderRadius: 13 }}>
                <strong style={{ color: "#0A1F44" }}>{policy.months}개월 수강</strong>
                <div style={{ marginTop: 4, fontSize: 25, fontWeight: 900, color: "#326bd1" }}>{policy.discount}% 할인</div>
              </div>
            ))}
          </div>
          <p style={{ marginBottom: 0, fontSize: 13, color: "#667085", lineHeight: 1.7 }}>할인금액 = 정상 수강료 × 기간별 할인율. 1개월은 할인 없이 정상가가 적용됩니다.</p>
        </section>

        <section aria-label="단기집중코스 수강료" style={{ marginTop: 16, padding: "20px clamp(16px,3vw,24px)", background: "#fff", border: "1px solid #e1e9f3", borderRadius: 18 }}>
          <h2 style={{ fontSize: 21, color: "#0A1F44", margin: "0 0 10px" }}>단기집중코스 (30분)</h2>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#526277", lineHeight: 1.75 }}>영어토론대회·공인영어시험·영어면접 등 필요한 주제에 맞춰 30분 단위로 수업합니다.</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center" }}>
              <thead><tr style={{ background: "#0A1F44", color: "#fff" }}>
                <th scope="col" style={{ padding: 12 }}>교육 내용</th>
                <th scope="col" style={{ padding: 12 }}>수업 시간</th>
                <th scope="col" style={{ padding: 12 }}>회당 수강료</th>
                <th scope="col" style={{ padding: 12 }}>선택 가능한 횟수</th>
              </tr></thead>
              <tbody><tr style={{ background: "#f2f6fd", color: "#1d2939" }}>
                <td style={{ border: "1px solid #d7e1ef", padding: 12 }}>영어토론대회 · 공인영어시험 · 영어면접 등</td>
                <td style={{ border: "1px solid #d7e1ef", padding: 12 }}>30분</td>
                <td style={{ border: "1px solid #d7e1ef", padding: 12 }}>{won(40000)}</td>
                <td style={{ border: "1px solid #d7e1ef", padding: 12 }}>1~20회</td>
              </tr></tbody>
            </table>
          </div>
        </section>
        <TuitionCalculator showEnrollLink />

      </div>
    </main>
  );
}
