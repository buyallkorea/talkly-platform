"use client";

import Link from "next/link";
import { useState } from "react";
import type { Turn } from "@/lib/talkly-ai/config";
import type { DailyLessonNotes } from "@/lib/talkly-ai/daily-pdf";
import { downloadDailyLessonPdf } from "@/lib/talkly-ai/daily-pdf";

export default function SessionLearningTools({
  tutor, turns, notes, studyMessage, connected,
}: {
  tutor: string;
  turns: Turn[];
  notes: DailyLessonNotes | null;
  studyMessage: string;
  connected: boolean;
}) {
  const [captions, setCaptions] = useState(true);
  const [grammarOpen, setGrammarOpen] = useState(false);
  const [pdfMessage, setPdfMessage] = useState("");
  const canDownload = turns.length > 0;
  function savePdf() {
    setPdfMessage("");
    try {
      downloadDailyLessonPdf({ tutor, turns, notes });
      setPdfMessage("PDF 저장을 시작했어요. 브라우저 다운로드 목록을 확인해 주세요.");
    } catch (error) {
      setPdfMessage(error instanceof Error ? error.message : "PDF를 만들지 못했어요. 브라우저 환경을 확인해 주세요.");
    }
  }
  return <section className="tai-study-desk" aria-label="AI 대화 자막과 생활 문법">
    <div className="tai-study-top">
      <div>
        <span className="tai-study-eyebrow">LIVE CONVERSATION NOTES</span>
        <h3>말한 문장으로 배우는 영어</h3>
        <p>대화는 자유롭게, 문장과 문법은 필요할 때 확인하세요.</p>
      </div>
      <div className="tai-study-actions" role="group" aria-label="대화 학습 도구">
        <button type="button" aria-pressed={captions} onClick={() => setCaptions(v => !v)}>
          {captions ? "자막 숨기기" : "자막 표시"}
        </button>
        <button type="button" aria-expanded={grammarOpen} aria-controls="tai-context-grammar"
          onClick={() => setGrammarOpen(v => !v)}>
          {grammarOpen ? "문법 접기" : "생활 문법 보기"}
        </button>
        <button type="button" disabled={!canDownload} onClick={savePdf} className="tai-study-download">
          수업 PDF 저장
        </button>
      </div>
    </div>
    {captions ? <div className="tai-transcript" aria-live="polite" role="log" aria-label="영어회화 자막">
      {turns.length ? turns.map((turn, index) =>
        <p key={index} className={"tai-turn-" + turn.role}>
          <b>{turn.role === "user" ? "나 · MY ENGLISH" : tutor + " · AI TUTOR"}</b>
          <span lang="en">{turn.text}</span>
        </p>) : <p>대화를 시작하면 말한 문장이 순서대로 표시돼요.</p>}
    </div> : <p className="tai-study-hidden">대화 자막을 숨겼어요. 언제든 다시 표시할 수 있어요.</p>}
    <p className="tai-study-footnote">음성 인식 결과는 실제 발음과 다르게 표시될 수 있어요. 원본 음성은 이 화면에서 저장하지 않아요.</p>

    {grammarOpen && <div className="tai-context-grammar" id="tai-context-grammar">
      <h4>오늘의 실생활 문법</h4>
      <p>AI가 대화가 끝난 뒤 실제 발화에서 교정할 만한 표현을 골라 설명해요. 대화 중에는 끼어들지 않아요.</p>
      {notes?.grammarNotes?.length ? notes.grammarNotes.map((item, index) =>
        <article className="tai-grammar-example" key={index}>
          <span className="tai-grammar-num">GRAMMAR {String(index + 1).padStart(2, "0")}</span>
          <p><b>내가 말한 문장</b><span lang="en">{item.before}</span></p>
          <p className="tai-grammar-better"><b>이렇게 말해 보세요</b><span lang="en">{item.after}</span></p>
          <p className="tai-grammar-reason">{item.rule}</p>
          <small>다른 예문 · <span lang="en">{item.example}</span></small>
        </article>) :
      notes ? <p className="tai-study-hint">이번 대화에서 별도로 교정할 생활 문법이 발견되지 않았어요.</p> :
      <p className="tai-study-hint">
        {studyMessage || (connected ? "영어 대화를 자유롭게 진행해 주세요. 종료 후 정리됩니다." : "학습 요약을 저장할 수 있도록 동의한 뒤 대화하면 종료 후 문법 정리가 제공돼요.")}
        {" "}
        <Link href="/talkly-ai/reports">학습 요약 저장 설정</Link>
      </p>}
      {notes?.expressions?.length ? <div className="tai-today-expressions">
        <h4>오늘의 유용한 표현</h4>
        <ol>{notes.expressions.map((x, i) => <li lang="en" key={i}>{x}</li>)}</ol>
      </div> : null}
      <p className="tai-study-footnote">AI가 작성한 교정은 제안이며 정답 판정이나 발음 점수가 아니에요.</p>
    </div>}
    {pdfMessage && <p className="tai-study-download-status" role="status">{pdfMessage}</p>}
    {canDownload && <p className="tai-study-footnote">PDF에는 현재 화면의 대화문과 준비된 학습 요약이 포함돼요. 파일은 이 기기에서 직접 생성하며, 수업을 새로 시작하기 전에 저장해 주세요. PDF의 텍스트는 이미지로 구성돼 검색·복사가 제한될 수 있어요.</p>}
  </section>;
}
