import fs from 'node:fs';
import { terms, privacy, business, legalVersion } from '../components/legal/legal-content.ts';
let out = `# TALKLY 이용약관·개인정보처리방침 검토본\n\n작성일: 2026년 10월 21일 · 시행일: 미정 · 버전: ${legalVersion}\n\n> **시행 전 초안입니다.** 미확정 항목을 확정하기 전에는 운영 약관으로 게시하거나 가입 동의를 받지 않습니다.\n\n`;
out += `사업자: ${business.name} / 운영 형태: ${business.type} / 대표 ${business.representative} / ${business.registration} / ${business.commerceRegistration}\n\n주소: ${business.address}\n\n고객센터 이메일: ${business.supportEmail}\n\n고객센터 전화번호: ${business.supportPhone}\n\n문의: TALKLY 1:1 상담(로그인 필요)\n\n`;
for (const [title, sections] of [['이용약관', terms], ['개인정보처리방침', privacy]]) {
  out += `## ${title}\n\n`;
  for (const s of sections) {
    out += `### ${s.title}\n\n`;
    if (s.paragraphs) out += s.paragraphs.join('\n\n') + '\n\n';
    if (s.bullets) out += s.bullets.map(x => '- ' + x).join('\n') + '\n\n';
    if (s.table) out += s.table.caption + '\n\n| ' + s.table.headings.join(' | ') + ' |\n| ' + s.table.headings.map(() => '---').join(' | ') + ' |\n' + s.table.rows.map(r => '| ' + r.join(' | ') + ' |').join('\n') + '\n\n';
    if (s.review) out += `> **운영자 확인 필요:** ${s.review}\n\n`;
  }
}
out += `## 확인된 운영 조건\n\n- 일반 사업자\n- 수업 녹화·음성 저장·AI 분석 사용\n- 고객센터 이메일·전화번호는 현재 공란\n\n## 정식 게시 전 남은 확인 사항\n\n1. 실제 화상수업 계약에 맞는 환불 산정표·환급 기한 및 결석·보강 상세 기준\n2. 원본 영상·음성·전사문·리포트·학습기록·인증·로그·백업별 보유기간과 파기 절차\n3. 수탁업체·국외 이전 수신자/연락처/국가/항목/시기/방법/기간/법적 근거\n4. 녹화·AI 분석의 필수/선택 여부·거부 시 영향 및 필요한 동의·실제 녹화 설정\n5. 아동 가입·법정대리인 확인, 수집 화면별 고지 및 동의 증빙\n6. 담당부서·응대 절차, 시행일 및 이메일·전화번호 추후 입력\n\n## 확인한 공식 자료\n\n- [2026 개인정보 처리방침 작성지침](https://www.privacy.go.kr/front/bbs/bbsView.do?bbsNo=BBSMSTR_000000000049&bbscttNo=20885)\n- [개인정보 보호법 제28조의8](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029334953)\n- [개인정보 보호법 제22조의2](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029334761)\n- [전자상거래법 시행령 제6조](https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1018638379)\n`;
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/TALKLY_legal_review.md', out);
