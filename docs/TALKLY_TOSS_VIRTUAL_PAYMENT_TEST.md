# TALKLY 토스페이먼츠 가상 결제 검증

## 사전 상태
- 운영 Vercel 프로젝트에 `NEXT_PUBLIC_TOSS_CLIENT_KEY`와 `TOSS_SECRET_KEY`가 등록되어 있었다.
- 클라이언트 키는 `test_gck_`로 시작한다. 서버 시크릿 키는 민감한 설정이므로 전체 내용/쌍의 일치 여부는 실제 테스트 승인 시 확인한다.
- 2026-11-10 점검 시 운영 enrollment_requests, enrollment_payments는 모두 0건이었다. 기존 일반결제는 강사/일정 배정과 금액 확정이 선행되어야 한다.

## 관리자 가상 결제 단계
1. TALKLY 관리자 계정으로 https://www.talkly.co.kr 로그인.
2. 수강 관리 → 토스 테스트 결제 또는 `/admin/payment-test`로 이동.
3. 상태가 '테스트용 키 형식 확인'으로 표시되는지 확인. 아니라면 Vercel Production에 같은 상점의 `test_gck_...` / `test_gsk_...` 한 쌍이 설정돼야 한다. 비밀 키는 공유하거나 붙여넣어 전송하지 않는다.
4. '가상 결제창 열기 · 1,000원' 선택.
5. 결제창에서 지원되는 결제수단을 선택하고 결제 진행. 테스트키는 실제 금액을 출금하지 않는다.
6. TALKLY 결과 화면에서 '승인 성공 · DONE'과 테스트 주문번호 확인.
7. https://developers.tosspayments.com/ → 테스트 결제내역에서 주문번호 대조.
8. 불명확한 오류가 나면 새 결제를 반복하기 전에 개발자센터에서 테스트 내역부터 확인.

## 보안 및 범위
- 실제 로그인한 관리자만 가능. POST API에서 관리자 role과 동일 Origin을 확인.
- 클라이언트 키/서버 시크릿 키가 모두 테스트 결제창형 키 prefix(`test_gck_`, `test_gsk_`)가 아닐 경우 메뉴는 비활성화된다.
- 테스트 주문번호는 관리자 ID와 시크릿 기반 HMAC 서명 + 난수 + 10분 만료로 검증되며, 금액은 서버에서 1,000원 고정.
- 서버에서만 `https://api.tosspayments.com/v1/payments/confirm`을 호출하고, 주문번호·paymentKey·금액·DONE 상태를 대조한다.
- 주문은 TALKLY DB에 등록되지 않고 enrollment_requests, enrollment_payments, enrollments, class_schedules, class_sessions 등 기존 테이블을 수정하지 않는다.
- 토스 개발자센터의 테스트 결제내역에서 테스트 승인 기록을 조회한다.
- 라이브 키로 전환되면 이 메뉴는 자동 비활성화된다.
- 테스트의 성공은 Toss 결제창/승인 API 연결만 증명한다. 일반 수강신청→결제→수강권/세션 생성의 전체 실사용 검증은 별도 진행해야 한다.

## 공식 문서
- https://docs.tosspayments.com/reference/using-api/api-keys
- https://docs.tosspayments.com/guides/v2/get-started/environment
- https://docs.tosspayments.com/sdk/v2/js/payment-window
