import Link from "next/link";
import {
  context,
  AiError,
  monthlyReportsEnabled,
} from "@/lib/talkly-ai/server";
import {
  reportMonth,
  reportHistoryMonths,
  summaryRetentionCutoff,
  type LearningSummary,
} from "@/lib/talkly-ai/reports";
import SummaryConsent from "./SummaryConsent";
import SummaryDeletion from "./SummaryDeletion";
import { loadReportHistory } from "@/lib/talkly-ai/report-history";
export const dynamic = "force-dynamic";
export const metadata = { title: "나의 월간 학습 리포트 | TALKLY AI" };
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const now = new Date();
  const period = reportMonth((await searchParams).month, now);
  const periods = reportHistoryMonths(period.month, now);
  const cutoff = summaryRetentionCutoff(now);
  let result;
  try {
    const { user, db } = await context();
    // Reading and deleting one's records must not depend on renewed learning consent.
    const { data: member, error: memberError } = await db
      .from("ai_members")
      .select("status,learning_summary_consent_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member) throw new AiError("AI 가입 정보를 찾을 수 없어요.", 403);
    const [history, records] = await Promise.all([
      loadReportHistory(db, user.id, periods, monthlyReportsEnabled(), cutoff),
      db
        .from("ai_learning_summaries")
        .select("session_id,day,status,summary,created_at", { count: "exact" })
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .gt("created_at", cutoff)
        .gte("day", period.from)
        .lt("day", period.to)
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);
    const selected = history.rows.find(
      (row) => row.period.month === period.month,
    );
    if (!selected?.activity || records.error)
      throw new Error("Report read failed");
    result = {
      member,
      publication: selected.publishedAt
        ? { published_at: selected.publishedAt }
        : null,
      activity: selected.activity,
      history,
      records: records.data ?? [],
      total: records.count ?? 0,
    };
  } catch (e) {
    return (
      <main className="tai tai-info">
        <h1>나의 월간 학습 리포트</h1>
        <p>
          {e instanceof AiError
            ? e.message
            : "학습 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."}
        </p>
        <Link href="/talkly-ai">AI 회화로 돌아가기</Link>
      </main>
    );
  }
  const ready = result.records.filter((r) => r.status === "ready");
  const topics = [
    ...new Set(
      ready.flatMap((r) => (r.summary as LearningSummary)?.topics ?? []),
    ),
  ].slice(0, 12);
  const expressions = [
    ...new Set(
      ready.flatMap((r) => (r.summary as LearningSummary)?.expressions ?? []),
    ),
  ].slice(0, 12);
  const corrections = ready
    .flatMap((r) => (r.summary as LearningSummary)?.corrections ?? [])
    .slice(0, 12);
  return (
    <main className="tai tai-info">
      <Link href="/talkly-ai">← AI 회화</Link>
      <p className="tai-kicker">MY ENGLISH JOURNAL</p>
      <h1>{period.month} 학습 리포트</h1>
      <p>
        {period.complete ? "월간 정리" : "이번 달 중간 기록"} · 한국시간 기준.
        학습 요약은 저장 시점부터 3개월 동안 조회할 수 있어요.
      </p>
      {result.publication && (
        <p className="tai-guide">
          월말 리포트 발행 완료 ·{" "}
          {new Date(result.publication.published_at).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
          })}
          . 학습 요약은 각 기록의 3개월 보관 기간 안에서 제공돼요.
        </p>
      )}
      <form>
        <label>
          확인할 달{" "}
          <input
            aria-label="확인할 달"
            type="month"
            name="month"
            defaultValue={period.month}
            max={reportMonth(undefined).month}
          />
        </label>{" "}
        <button type="submit">조회</button>
      </form>
      {result.member.status === "active" && (
        <SummaryConsent enabled={!!result.member.learning_summary_consent_at} />
      )}
      <SummaryDeletion
        records={result.records.map(
          ({ session_id, day, status, created_at, summary }) => ({
            session_id,
            day,
            status,
            created_at,
            label:
              (summary as LearningSummary)?.topics?.slice(0, 2).join(" · ") ??
              "",
          }),
        )}
      />
      <section className="tai-card">
        <h2>꾸준히 이야기한 시간</h2>
        <p>
          학습한 날 <strong>{result.activity.days}일</strong> · 총 연결시간{" "}
          <strong>
            {Math.floor(result.activity.seconds / 60)}분{" "}
            {result.activity.seconds % 60}초
          </strong>
        </p>
        <p>
          {result.publication
            ? "발행 시점에 종료·정산된 회화 기준이며"
            : "종료·정산된 회화 기준이며"}{" "}
          생각하는 시간을 포함해요. 일시정지 시간은 제외합니다. 자동 재연결
          구간을 수업 횟수로 세지 않아요.
        </p>
      </section>
      <section className="tai-card">
        <h2>월별 학습 활동</h2>
        <p>
          선택한 달을 포함한 최대 3개월 기록입니다. 진행 중인 달과 월별 날짜
          수의 차이를 고려해 확인해 주세요. 시간과 학습 일수는 영어 실력 점수가
          아닙니다.
        </p>
        {result.history.publicationError && (
          <p>발행 기록을 불러오지 못해 현재 정산된 기록을 표시합니다.</p>
        )}
        <div style={{ overflowX: "auto" }}>
          <table className="tai-history-table">
            <caption>정산된 회화 시간과 학습 일수</caption>
            <thead>
              <tr>
                <th scope="col">월</th>
                <th scope="col">학습한 날</th>
                <th scope="col">총 연결시간</th>
                <th scope="col">집계 기준</th>
              </tr>
            </thead>
            <tbody>
              {result.history.rows.map((row) => (
                <tr
                  key={row.period.month}
                  data-selected={row.period.month === period.month}
                >
                  <th scope="row">
                    {row.period.month === period.month ? (
                      <strong aria-current="page">{row.period.month}</strong>
                    ) : (
                      <Link
                        prefetch={false}
                        href={`/talkly-ai/reports?month=${row.period.month}`}
                      >
                        {row.period.month}
                      </Link>
                    )}
                  </th>
                  {row.activity ? (
                    <>
                      <td>{row.activity.days}일</td>
                      <td>
                        {Math.floor(row.activity.seconds / 60)}분{" "}
                        {row.activity.seconds % 60}초
                      </td>
                      <td>
                        {row.period.complete ? "종료된 달" : "진행 중인 달"} ·{" "}
                        {row.publishedAt ? "발행 시점" : "현재 정산 기록"}
                      </td>
                    </>
                  ) : (
                    <td colSpan={3}>기록을 불러오지 못했어요.</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          발행된 월은 발행 시점의 사용량, 나머지는 현재 종료·정산된 회화를
          사용합니다. 생성에 실패하거나 삭제한 학습 요약과 별도로 이용 시간
          기록은 유지됩니다.
        </p>
      </section>
      <section className="tai-card">
        <h2>이달의 학습 주제</h2>
        {topics.length ? (
          <ul>
            {topics.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : (
          <p>
            아직 저장된 학습 요약이 없어요. 동의 후 회화에서 영어로 이야기해
            보세요.
          </p>
        )}
      </section>
      <section className="tai-card">
        <h2>다시 말해 볼 표현</h2>
        {expressions.length ? (
          <ul>
            {expressions.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : (
          <p>기록된 표현이 아직 없어요.</p>
        )}
      </section>
      <section className="tai-card">
        <h2>대화에서 짚어 본 교정</h2>
        {corrections.length ? (
          <ul>
            {corrections.map((c, i) => (
              <li key={i}>
                {c.before} → {c.after}
              </li>
            ))}
          </ul>
        ) : (
          <p>확인된 교정 기록이 없어요. 오류가 없었다는 뜻은 아니에요.</p>
        )}
      </section>
      <section className="tai-card">
        <h2>다음 회화에서 연습해요</h2>
        {ready.slice(0, 3).map((r) => (
          <p key={r.session_id}>
            {(r.summary as LearningSummary)?.nextPractice}
          </p>
        ))}
        {!ready.length && <p>짧은 문장 하나부터 시작해 보세요.</p>}
      </section>
      <p>
        분석에 사용한 요약 {ready.length}개 / 종료된 연결 구간{" "}
        {result.activity.segments}개. 요약은 동의 이후에만 저장되며, 창
        닫기·통신 장애·생성 실패로 누락될 수 있어요.
        {result.total > 1000 ? " 최근 1,000개 요약만 표시하고 있어요." : ""}
      </p>
      <p>
        AI가 생성한 복습용 요약이므로 잘못 정리될 수 있어요. 발음 점수·공인
        등급·향상률을 뜻하지 않으며 전체 대화의 평가가 아니에요.{" "}
        {monthlyReportsEnabled()
          ? "월말 발행 안내는 AI 회화 화면에서 제공해요."
          : "월말 자동 발행은 준비 중이에요."}{" "}
        이메일·문자·외부 푸시는 발송하지 않습니다.
      </p>
    </main>
  );
}
