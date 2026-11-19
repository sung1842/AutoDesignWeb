# PROGRESS

## 현재 상태
- status: IN_PROGRESS
- phase: P2
- lock: {owner: 2026-11-19T05:57Z, since: 2026-11-19T06:31Z}
- limit.next_reset_kst: 2026-11-19 19:57
- 마지막 갱신: 2026-11-19 15:40 KST (예약 세션: 06-c~01-b 반영)

## 실행 환경 사실(2026-11-18 점검)
- Docker 데몬 없음(클라이언트만). 이미지 레지스트리·Playwright 브라우저 다운로드 프록시 차단.
- 브라우저: `/opt/pw-browsers`의 chromium-1243만 있음(webkit·firefox 없음).
- PostgreSQL 16 설치됨, pgvector 없음. 06장 DDL은 auth 스키마 stub 위에서 vector 외 46개 테이블 생성 성공.
- npm 레지스트리 접근 가능.

## 배경
- v1 기획서 → 1라운드 역할별 리뷰 8개(전원 FAIL, Blocker 약 52·Major 약 105) → 결정 레지스터 → v2 10개 장 작성 → 장 간 충돌 통합 결정 R-01~R-38 반영.
- 통합 결정 반영 완료: 00, 01, 02, 03, 04, 05, 06, 07, 08장. 09장은 반영 도중 이관됨(확인 필요).
- 02장 진단 시뮬레이션은 합격선을 아슬아슬하게 통과(RMSE 0.119/0.12, 적응형 이득 5.6%/5%). 09장 M4 앵커 정확도 95%는 94.6% → 02장 2.16 기준을 따르도록 수정 요청됨.

## P1. v2 정합 마무리
- [x] 09장에 decisions_v2 반영 — R-02·03·05·06·07·08·09·11·12·19·25 반영 완료(2026-11-18 대화 세션). M1 ⑨ 스키마 대조(`verify:schema-parity`)·M7 ⑪ API 대조(`verify:api-parity`) 조건 추가로 06장 1:1 대조를 구현 단계 자동 검증으로 넘김 → 완료. 원래 목록: (잠금 경로 `config/lock/locked-hashes.json`, 골든 32, 역할명 `gen_copy/gen_layout/judge_vision/ref_tagger`, 프롬프트 경로 `packages/llm/prompts/<role>@v<N>.md`, `v_true` 코드값, 화면 S01~S15, 카드 풀 16×3, "한결", 이미지 192장, 앵커 정확도는 02장 기준 참조, D-0212·0213 반영, 06장 최종 DDL·API를 마일스톤에 반영)
- [x] 전 장 옛 표기 grep 검사 후 수정(2026-11-18. 남은 검색 결과는 '대체됨' 설명·금지 규칙 문맥뿐): `qa/thresholds.yaml`, `'local'`(용도), `V-TRUE`(코드), `BRAND_HIGH_RISK`, `PHISHING_TERM`, `survey_responses`, `taste_results`, `feedback_events`, `TEST_AUTH_BYPASS`, `/api/test/login`, `alt_ko`, `A1`~`A5` 축 키(JSON 키로 쓰인 경우), `page_generator`, `copywriter`, `.guard/locked-hashes`, `S01~S10`, 골든 30
- [x] 각 장 "다른 장과 맞출 인터페이스" 표의 미해결 항목 해소(03장 3.13.5 colorName 추가, 02장 dominant_colors·06장 purpose_hint 확인) (예: 01장 D-0111 `colorName`/`dominant_colors`, 02장 D-0201 용도 힌트 칩은 01·06 반영 확인)
- [x] `docs/spec/INDEX.md` 작성(장 목록, 결정 문서, 용어집 위치)

## P2. 리뷰 루프
- 라운드 2: [x] PM [x] 프로덕트 디자이너 [x] UX [x] UI [x] 테크 리드 [x] AI/ML [x] QA [x] 법무 → [x] decisions_v3(S-01~S-41) [x] 반영(아래 20단위)
- 라운드 2 반영 단위(decisions_v3.md "반영 순서" 참고): [x] 07-a [x] 07-b [x] 07-c [x] 06-a [x] 06-b [x] 06-c [x] 06-d [x] 09-a [x] 09-b [x] 09-c [x] 04-a [x] 04-b [x] 04-c [x] 03 [x] 02 [x] 05 [x] 01 [x] 08 [x] 00 [x] 잔여 표기 grep
- 라운드 3: [x] PM [x] 프로덕트 디자이너 [x] UX [x] UI [x] 테크 리드 [x] AI/ML [x] QA [x] 법무 → [x] decisions_v4(T-01~T-36) [ ] 반영(아래 22단위)
- 라운드 3 반영 단위(decisions_v4.md "반영 순서" 참고): [x] 06-a [x] 06-b [x] 06-c [x] 06-d [x] 07-a [x] 07-b [x] 07-c [x] 07-d [x] 09-a [x] 09-b [x] 09-c [x] 01-a [x] 01-b [x] 04-a [x] 04-b [x] 03-a [x] 03-b [x] 08-a [ ] 02-a [ ] 05-a [ ] 00-a [ ] 잔여 표기 grep
- 판정 기록(라운드별 C1/C2/C3):
  - R2 PM: FAIL/FAIL/FAIL (Blocker 0, Major 5: 예산-목표 불일치, 취소 시 한도 규칙 충돌, KPI 쿼리 분모, 검증 표본 확보, 00↔07·09 불일치)
  - R2 UX: FAIL/FAIL/FAIL (1라운드 19/19 해결, Blocker 0, Major 3: 결과 신뢰 문구 01↔02 불일치, 진단 카드 크기 규칙이 실제 화면에서 불성립, 편집 가능 판정을 화면 폭으로 해 200% 확대 시 편집 소실)
  - R2 QA: FAIL/FAIL/PASS (1라운드 21/27 해결·5 부분·1 P2, Blocker 0, Major 4: thresholds 키 구조 3종, 보류 허용 검증 목록 부재·k6 staging 의존, 에이전트 자기 채점 방지(spec:extract·spec-lock), 07·09·04 수치 불일치)
  - R2 TECH: FAIL/FAIL/FAIL (1라운드 24/28 해결, Blocker 2: Docker 없는 환경 대안 부재, 시각 회귀·브라우저 매트릭스가 Docker 전제 / Major 5: 병렬 호출 예산 초과, 동시 잡 5 vs Chromium 3, 후보 파기 DDL 불일치, CLAUDE.md↔09장 운영 규칙 차이, MVP DDL의 pgvector)
  - R2 PD: FAIL/FAIL/FAIL (1라운드 23건 중 20 해결·3 부분, Blocker 0, Major 5: S08 근거 칩 부재·v_true 문구 모순, 03 허용 조합이 04 린터에서 항상 실패(AIL-06·AIL-03), 사진 톤·업종 필터 부재, styleguide.html 내보내기 누락, 검증 대조군 약함)
  - R2 UI: FAIL/FAIL/PASS (1라운드 24건 중 20 해결·4 부분, Blocker 0, Major 4: 밝은 브랜드색 대비 보정 실패 경로 없음, 텍스트 역할→타입 단계 표 부재(H7 T3 2.47), 히어로 8~24자와 타입 스케일 불일치, 폰트 서브셋 전략·enum 불일치)
  - R2 AI: FAIL/FAIL/FAIL (1라운드 24건 중 22 해결·1 부분, Blocker 1: 05장 정규화 분위수 표·few-shot 48개의 임시 시드 규칙 부재(B1~B17) / Major 4: 진단 시뮬 단일 시드 판정·튜닝 겹침·멈춤 규칙 없음, 골든 M1 95%±0.12가 RMSE 0.12와 모순(QA2-05와 충돌 → v3 결정), gen_copy 실패·거절 처리 미정, MockProvider가 04장 분할 호출과 다르고 ok 시나리오가 수리 경로를 안 탐)
  - R3 PM: FAIL/FAIL/FAIL (2라운드 PM2-01·02·03·05 해결, 04·07 부분, 06 미해결(Minor). Blocker 0, Major 4: S-18 표본 운영 기능이 00장에만 있음(01 화면·06 API·A5/A7 쿼리 없음), 노출 전 취소 환불 반복으로 일 예산 소진(차단 없음), 평가·staging LLM 원가가 예산 모델에 없음, 09 M0~M8에 00장 제품 기능(이벤트·KPI·어드민 KPI·초대코드·한도·관심 페이지·지원) 배정 없음)
  - R3 UX: FAIL/FAIL/FAIL (UX2-05 해결, 01·02·03 부분, 04·06·07·08·09 미해결 — 2라운드 수용 기준이 01장에 안 들어감. Blocker 0, Major 5: 자극물 크기 규칙이 tablet·좁은 desktop·A/B·mobile에서 불성립, S-31 누락(768px 미만 내보내기 숨김 잔존·확대 검증 없음), S03 ② 안내 데이터가 ResultView에 없음, S08 안내 데이터 원천 누락·partial 의미 충돌, S-18 검증 UI가 화면·API에 없음)
  - R3 QA: FAIL/FAIL/PASS (QA2-01·04·05 해결, 02·03·07·08 부분, 06 미해결. 키 경로·AC ID 참조는 전부 정의됨. Blocker 1: spec-lock 후 docs/spec/** 변경이 guard 실패인데 DECISIONS_LOG가 그 안에 있음 / Major 7: 진단 튜닝 상수가 잠긴 thresholds에 있어 S-08 튜닝 불가, 골든 muRef가 M1(엔진·튜닝 전)에 잠김, release:check 단계 ID 카탈로그 없음·보류표 누락, qa:trace 리터럴 금지 과대·우회 가능, AC→마일스톤 배정이 06장만, AC 본문의 낡은 개수(17묶음·13시나리오·G-12, AC-03-38 중복), FINAL↔v2 일치 검사·spec:extract 원천 경로 부재)
  - R3 TECH: FAIL/FAIL/FAIL (TL2 5 해결·3 부분(01·03·09)·2 미해결(08·10 Minor). PG16에 6.3.3 DDL 49테이블 오류 0. Blocker 1: native 프로파일에서 웹의 DB 접근 경로 없음(PostgREST 대체·request.jwt.claims 설정 주체·타입 생성·공개 버킷 URL·auth.admin 호출) / Major 3: auth.users 트리거가 env 비밀(ADMIN_EMAILS·CONSENT_HASH_KEY)을 못 읽음·관리자 자동 강등 6.5.4↔6.11.2 충돌, 병렬 6회 레이아웃 호출 캐시 쓰기 가정 오류로 기본 경로 ≈$0.28(스킵 임계 초과)·mock 캐시 토큰 없음, cost_spike 정의 04(단가)↔09(사용량) 충돌로 AC-06-56·TC-R-09 불성립)
  - R3 UI: FAIL/FAIL/PASS (UI2-01·04 해결, 02·03 부분, 05~09 미해결(Minor). Blocker 0, Major 4: 반전 섹션 버튼·링크 색 규칙·accent 텍스트 사용 규칙 부재(6/8 프리셋 G-03 실패), G-12·AIL-17 토큰 검사가 clamp 중간값·중앙 정렬 여백·워드마크를 실패 처리, 텍스트 역할 표에 버튼·내비·폼·메뉴 역할 없음(AC-03-38 불성립), 헤드라인 줄 예산 입력 미정(덱 생성 시 히어로 변형 미정·text_cols 누락·CTA·워드마크 길이 규칙 없음))
  - R3 AI: FAIL/FAIL/FAIL (AI2-01~04 해결, 05·09 부분, 06·07·08·10 미해결(Minor). Blocker 0, Major 5: 05 5.9 temp 분기 비차단↔CI 실패·M3③·M4① 충돌, 04 4.10.4 TM·S_free에 reliable 마스크 없음, temp 시뮬이 배포 x_card 대신 target_l1+잡음 사용, Mock 재호출·수리 응답 규칙·candidateIndex→변형 매핑 없음(TC-R-15·M7⑥ 불성립), 튜닝 목적함수·좌표별 지표·gate 실행 시점 미정)
  - R3 PD: FAIL/FAIL/FAIL (PD2-01·05 해결, 02·03·04 부분, 06·07·08 미해결(Minor). Blocker 0, Major 5: P-2·P-2s 대조군 렌더 조건(이미지·웹폰트) 미고정, styleguide가 앵커 프리셋 폰트·팔레트를 써 내보낸 토큰과 불일치·06 저장표 누락, FP15 비모노 폰트 3종 남아 AC-03-25 상시 실패, 업종 키워드 태그↔slot.tag·image_tags_allowed 미연결·사진 톤 우선순위와 해시 선택 결합 미정, S-32~34 규칙에 AC·TC ID 없음)
  - R3 LEGAL: FAIL/FAIL/FAIL (LG2-01·02·06·07 해결, 03·04·05·10 부분, 08·09·11 미해결(Minor). Blocker 1: RLS 쓰기 정책으로 authenticated가 projects·mockup_versions·share_links에 직접 써 서버 검사 우회 / Major 4: auth.audit_log_entries·auth.sessions의 IP·UA·이메일이 수집·보관·삭제표에 없음, admin_audit_logs 1년 파기(08)↔DELETE 금지(AC-06-06) 충돌, 탈퇴 순서상 sanctions 미기록·신고 증거 cascade 삭제·재가입 회피, S-27 익명 창구 방어가 06·01에 없음)
  - R2 LEGAL: FAIL/FAIL/FAIL (1라운드 20건 중 14 해결·6 부분, Blocker 0, Major 7: 편집 시 남용 검사 우회·불법 업종 미필터, Supabase Auth 메타데이터 이름·사진 저장, 국외이전 목록 누락(Fly.io·Vercel·llm-judge), 탈퇴와 DDL 충돌(동의 기록·감사 로그·정지 회피), 익명 폼 남용, 관리자 MFA·열람 로그 부재, 법무 문서 경로 08↔09 불일치·컴플라이언스 임시 시드 규칙 부재)

## P3. 최종 기획서와 구현 준비
- [ ] FINAL 정리 [ ] 구현 규칙 추가 [ ] 임시 시드 데이터 [ ] HUMAN_TODO 정리

## P4. 구현
- [ ] M0 [ ] M1 [ ] M2 [ ] M3 [ ] M4 [ ] M5 [ ] M6 [ ] M7 [ ] M8

## P5. 완료
- [ ] release:check 요약

## 로그
- 2026-11-19 16:45 | 08-a: P14·auth 90일, 감사 1년 파기, 신고 증거·abuse_holds, 본인 확인, AC-08-55~57
- 2026-11-19 16:40 | 03-b: text_cols hero 6종·토큰 판정, FP15 body, lint-matrix AC-03-43, styleguide 입력, 3.15 요약
- 2026-11-19 16:35 | 03-a: 반전 면 매핑·accentTextSafe, expectedSize·nav.wordmark, 텍스트 역할 17행, AC-03-42·44·45·46
- 2026-11-19 16:30 | 04-b: maxChars_job·role_overrides·AIL-24, G-12·AIL-17 expectedSize, styleguide 입력, AC-04-46
- 2026-11-19 16:25 | 04-a: TM reliable 마스크·S_free null, 후보 인덱스·DIVERSITY, 이미지 단계 선택, 원가 참조, AC-04-44·45·47
- 2026-11-19 16:15 | 01-b 반영: S03 notice 서버 선택·retestHint(T-25·22), S12 재검사 배너·채택 후속 시트·shareStatus(T-22·16), 1.6.5 취…
- 2026-11-19 16:05 | 01-a 반영: 1.4.3 자극물 크기 규칙·회전 안내·layoutMode, 1.4.11 mobile 와이어프레임, 1.14.3 썸네일 탭, AC-01-55(T-23); 1…
- 2026-11-19 16:00 | 09-c 반영: 9.6.2 시드(callKind·attempt)·인덱스 매핑·장애 initial 한정·수리 규칙·효과표·low-score-trees·judge ID 기반·j…
- 2026-11-19 15:55 | 09-b 반영: 9.1.2 트리·9.1.3 의존(DbPort·api-contract·compliance·auth/storage/mail), M0 native, M1 db:t…
- 2026-11-19 15:45 | 09-a 반영: F01 baseRef·DECISIONS_LOG append-only 예외, 9.5.6 spec 잠금·lockedBy spec, M0 산출물 spec:extr…
- 2026-11-19 15:40 | 07-d 반영: 7.2.2 muRef 생성 시점·재생성 조건(T-04), TC-R-09 정의·TC-R-19/20 신설(T-17), TC-R-15 인덱스·개수(T-18), M…
- 2026-11-19 15:30 | 07-c 반영: AC → 마일스톤 배정표(00~09장 425 ID, 중복·누락 0 스크립트 확인)·acMilestones·qa:trace 배정 위치 강제·접미사 정규식, 0…
- 2026-11-19 15:20 | 07-b 반영: 7.11.2 단계 카탈로그 57단계·허용표 확장·종료 코드 3·temp 묶음 대응, spec:test-policy steps·blockable·exitCod…
- 2026-11-19 15:06 | 06-d 반영: 오류 코드 6종, 익명 창구 turnstileToken·privacy_request 본인 확인(verify 엔드포인트)·메일 템플릿 표·shareStatus…
- 2026-11-19 15:03 | 06-c 반영: 6.9.4 전면 개정(캐시 예열 순서·기본 경로 공식 $0.23363·attempt별 예약·실효 cap 비례 생략·usage_overrun·Mock usag…
- 2026-11-19 10:35 | 06-a 반영: T-11 DbPort(Kysely+pg·withUser/withAnon/withService)·R-3 가드·6.3.5 쓰기 화이트리스트·심층 방어 트리거·d…
- 2026-11-19 10:35 | 07-a 반영: diagnosis.tunable(값 불변)·T-08 신규 키 8개·auditAllowLiterals, FINAL 원천 경로·tuned/tuning-log 스…
- 2026-11-19 10:22 | decisions_v4 작성(T-01~T-36, Blocker 3·Major 37 전부 대응, Minor는 선택 반영표). AD-008·009 기록, T-17·T-11 사람…
- 2026-11-19 10:10 | 라운드 3 PD·법무 리뷰 작성 → 8개 수집 완료. 합계 Blocker 3(QA3-01·TL3-01·LG3-01), Major 37. 다음은 decisions_v4
- 2026-11-19 09:58 | 라운드 3 UI·AI/ML 리뷰 작성(UI FAIL/FAIL/PASS M4, AI FAIL×3 M5)
