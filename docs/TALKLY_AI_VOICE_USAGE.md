# 음성 응답 사용량 관찰

현재 `TALKLY_AI_VOICE_USAGE_ENABLED` 기본값은 OFF다. 기존 Realtime 모델·WebRTC 음성·턴 대기·사용 시간·요약 생성 경로를 유지한다. 기존 OpenAI 키 재사용 승인 범위이며 새 키/실제 API 요청을 만들지 않았다.

## 구현

공식 Realtime sideband 방식으로 서버가 기존 call_id의 제어 WebSocket을 관찰한다. 다른 음성 세션을 만들거나 response.create/session.update/음성 전송을 하지 않는다. 응답 후 작업으로 예약해 프런트 응답을 직접 기다리게 하지 않는다. `response.done`에서 응답 ID, 완료 상태, 입력/출력 토큰과 음성/텍스트/이미지/캐시 세부 사용량만 추출한다. 취소·실패·미완료 응답도 유효 사용량이 반환되면 기록한다. 원문/원음/SDP/인증키/공급업체 오류를 저장하거나 로그에 출력하지 않는다.

`ai_voice_usage`는 회화/응답 ID로 중복을 막고 `ai_voice_observations`는 관찰 시도·종료·저장 오류·수집 제한 누락을 표시한다. 서버 역할만 접근하며 회원/익명 역할은 직접 읽거나 쓰지 못한다. 기존 API 처리 기록과 별도 집계한다.

관찰 연결만 닫고 학습자의 음성 연결은 종료하지 않는다. 연결 준비 5초, 관찰은 해당 lease 만료 이내/최대 240초, DB 작업 1.5초 제한이다. 저장 동시 요청 최대 4개, 고유 응답 최대 500개이며 넘으면 누락 표시를 남긴다. 재시도/새 응답 생성/부가 모델 호출은 하지 않는다. 비동기 수집 실패가 회화나 정산의 성공 여부를 바꾸지 않는다.

## 해석과 공개 전 확인

관리자에는 최근 응답 1,000건/관찰 100건의 확인된 합계만 표시한다. 미수집은 0이 아니고 캐시는 입력의 부분집합이므로 추가 합산하면 안 된다. 시작 전/연결 실패/타임아웃/함수 강제 종료/수집 한도/DB 오류로 누락될 수 있다. 이것만으로 전사 비용·전체 청구액·청구 대사가 완성되는 것은 아니다. 음성/텍스트/캐시 단가를 임의 가정하지 않는다.

서버 제어 연결은 이벤트 전송량·실행 시간을 추가할 수 있다. 기본 OFF를 유지하고 실제 사용자 테스트 단계에서 준비 시간·대화 품질·사이드밴드 전송량·실제 OpenAI 사용량·플랫폼 비용을 함께 검증한 후 켜야 한다. 실제 음성/API/청구 검증은 사용자 결정대로 오픈 이후 진행하며 현재 통과로 표시하지 않는다. 기술 기록의 보관·삭제 정책 확정과 독립 supervisor는 남아 있다.

## 검증

가상 이벤트/가상 소켓으로 숫자·모달리티·캐시 부분집합·잘못된 상태·원문 제거·중복·늦은 이벤트·기본 OFF·키/ID 게이트·연결/저장 실패·동시 저장 상한·관찰 종료를 검증했다. 독립 PostgreSQL에서 토큰 제약, 중복 차단, 관찰 기록과 익명/회원 권한 차단을 확인했다. 실제 WebSocket/실제 고객 대화/새 API 과금 요청은 실행하지 않았다.

공식 근거:
- https://developers.openai.com/api/docs/guides/voice-server-controls?voice-api=realtime (Realtime의 call_id sideband 부분)
- https://developers.openai.com/api/reference/resources/realtime/server-events.md (`response.done`의 usage; 전사는 별도 사용량)

개발 CLI는 공식 문서의 `SUPABASE_TELEMETRY_DISABLED=1` 및 `DO_NOT_TRACK=1`로 통계 전송을 비활성화한 뒤 마이그레이션 파일을 생성했다. 기존 차단된 통계 요청을 재시도하지 않았다. https://supabase.com/docs/guides/local-development/cli/getting-started#telemetry
