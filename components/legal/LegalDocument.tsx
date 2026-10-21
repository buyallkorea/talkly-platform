import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { business, legalVersion, type LegalSection } from "./legal-content";
import styles from "./legal-document.module.css";

type Props = { kind: "terms" | "privacy"; sections: LegalSection[] };

export default function LegalDocument({ kind, sections }: Props) {
  const title = kind === "terms" ? "이용약관" : "개인정보처리방침";
  return (
    <div id="top" className={styles.page} data-legal-status="draft">
      <a className={styles.skip} href="#legal-content">본문 바로가기</a>
      <SiteHeader />
      <main className={styles.container}>
        <nav className={styles.breadcrumb} aria-label="현재 위치">
          <Link href="/">홈</Link><span aria-hidden="true">/</span><span>{title}</span>
        </nav>
        <header className={styles.hero}>
          <span className={styles.eyebrow}>TALKLY · SERVICE POLICY</span>
          <h1>{title}</h1>
          <p>{kind === "terms" ? "함께 확인하는 수업과 서비스 이용의 기준" : "어떤 정보를, 왜, 어떻게 처리하는지 안내합니다."}</p>
          <dl className={styles.meta}>
            <div><dt>작성일</dt><dd>2026년 10월 21일</dd></div>
            <div><dt>시행일</dt><dd>확정 후 공지</dd></div>
            <div><dt>문서 상태</dt><dd>검토용 초안</dd></div>
          </dl>
        </header>
        <nav className={styles.tabs} aria-label="서비스 정책">
          <Link href="/terms" aria-current={kind === "terms" ? "page" : undefined}>이용약관</Link>
          <Link href="/privacy" aria-current={kind === "privacy" ? "page" : undefined}>개인정보처리방침</Link>
        </nav>
        <aside className={styles.draft} aria-label="문서 검토 상태">
          <strong>정식 게시 전 검토용 문서입니다.</strong>
          <p>아래 내용은 운영정책 확정과 실제 처리 현황 대조가 필요한 초안입니다. 아직 시행되지 않으며, 이 문서 열람으로 약관·개인정보 처리·녹화·국외 이전에 동의한 것으로 보지 않습니다.</p>
        </aside>
        <div className={styles.layout}>
          <aside className={styles.toc}>
            <nav aria-label={`${title} 목차`}>
              <h2>목차</h2>
              <ol>{sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol>
            </nav>
          </aside>
          <article id="legal-content" className={styles.document} tabIndex={-1}>
            <div className={styles.company}>
              <strong>{business.name}</strong>
              <p>운영 형태: {business.type}</p>
              <p>대표자 {business.representative} · 사업자등록번호 {business.registration}</p>
              <p>통신판매업 신고번호 {business.commerceRegistration}</p>
              <p>{business.address}</p>
            </div>
            {sections.map((section) => (
              <section className={styles.section} key={section.id} aria-labelledby={`heading-${section.id}`}>
                <h2 id={section.id}><span id={`heading-${section.id}`}>{section.title}</span></h2>
                {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
                {section.table && <div className={styles.tableWrap} tabIndex={0} role="region" aria-label={section.table.caption}>
                  <table>
                    <caption>{section.table.caption}</caption>
                    <thead><tr>{section.table.headings.map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead>
                    <tbody>{section.table.rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => index === 0 ? <th scope="row" key={index}>{cell}</th> : <td key={index}>{cell}</td>)}</tr>)}</tbody>
                  </table>
                </div>}
                {section.review && <aside className={styles.review}><strong>운영자 확인 필요</strong><p>{section.review}</p></aside>}
              </section>
            ))}
            <section className={styles.section} aria-labelledby="contact-heading">
              <h2 id="contact-heading">문의 및 검토 정보</h2>
              <p>개인정보 보호책임자: {business.privacyOfficer}</p>
              <p>접수 경로: <Link href="/consultation">TALKLY 1:1 상담</Link> (로그인 필요)</p>
              <dl className={styles.contacts}>
                <div><dt>이메일</dt><dd aria-label={business.supportEmail ? undefined : "미입력"}>{business.supportEmail}</dd></div>
                <div><dt>전화번호</dt><dd aria-label={business.supportPhone ? undefined : "미입력"}>{business.supportPhone}</dd></div>
              </dl>
              <details className={styles.sources}>
                <summary>작성 시 확인한 공식 자료</summary>
                <ul>
                  <li><a href="https://www.privacy.go.kr/front/bbs/bbsView.do?bbsNo=BBSMSTR_000000000049&bbscttNo=20885" target="_blank" rel="noopener noreferrer">개인정보보호위원회 2026 개인정보 처리방침 작성지침</a></li>
                  <li><a href="https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029334953" target="_blank" rel="noopener noreferrer">개인정보 보호법 제28조의8 — 국외 이전</a></li>
                  <li><a href="https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029334761" target="_blank" rel="noopener noreferrer">개인정보 보호법 제22조의2 — 아동의 개인정보 보호</a></li>
                  <li><a href="https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1018638379" target="_blank" rel="noopener noreferrer">전자상거래법 시행령 제6조 — 거래기록 보존기간</a></li>
                  <li><a href="https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=5&cciNo=2&cnpClsNo=2&csmSeq=631&popMenu=ov" target="_blank" rel="noopener noreferrer">법제처 — 학습계약 해지 및 이용료 환급</a></li>
                </ul>
              </details>
              <p className={styles.version}>문서 버전 {legalVersion} · 시행 전 초안</p>
            </section>
          </article>
        </div>
        <footer className={styles.footer}>
          <Link href="/">TALKLY 홈으로</Link>
          <a href="#top" aria-label="페이지 맨 위로">맨 위로 ↑</a>
        </footer>
      </main>
    </div>
  );
}
