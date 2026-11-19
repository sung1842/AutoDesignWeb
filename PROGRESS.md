# PROGRESS

## 현재 상태
- status: IN_PROGRESS
- phase: P4
- lock: {owner: 2026-11-19T17:08Z, since: 2026-11-19T17:32Z}
- review_pass_hashes: {thresholds: 9756b595efb0a9e8795cfff39018c5587bf621fd88c46aa1f20d0df5c81d57c4, testPolicy: 3bb46516432f148f6dea25b8c019d2fc20a2c5a7331591b8aed94cc25dbba481}  # 계산법 AD-019
- tags: {review-pass: 4519c49, spec-lock: acd413d, m0-done: 089cc76}  # 원격 태그 푸시 불가 → 세션마다 로컬 복원(AD-022)
- review_pass_commit: 4519c49  # 원격 태그 푸시 403 → 태그 생성은 HUMAN_TODO(AD-020)
- limit.next_reset_kst: 2026-11-20 07:08
- 마지막 갱신: 2026-11-20 02:32 KST (예약 세션: M1-10 완료, 다음 M1-11 verify:m1)

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
- 라운드 3: [x] PM [x] 프로덕트 디자이너 [x] UX [x] UI [x] 테크 리드 [x] AI/ML [x] QA [x] 법무 → [x] decisions_v4(T-01~T-36) [x] 반영(아래 22단위)
- 라운드 3 반영 단위(decisions_v4.md "반영 순서" 참고): [x] 06-a [x] 06-b [x] 06-c [x] 06-d [x] 07-a [x] 07-b [x] 07-c [x] 07-d [x] 09-a [x] 09-b [x] 09-c [x] 01-a [x] 01-b [x] 04-a [x] 04-b [x] 03-a [x] 03-b [x] 08-a [x] 02-a [x] 05-a [x] 00-a [x] 잔여 표기 grep
- 라운드 4(1.1 규칙: 리뷰어 3명·패킷 `docs/reviews/round4/packet.md`): [x] R-A 제품·경험 [x] R-B 기술·품질 [x] R-C 법무 → [x] decisions_v5(U-01~U-13) [x] 반영(아래 9단위)
- 라운드 4 반영 단위(decisions_v5.md "반영 순서"): [x] 06-a [x] 06-b [x] 07-a [x] 09-a [x] 02-a [x] 04-a+03-a [x] 01-a [x] 08-a [x] 잔여 grep
- 라운드 5(패킷 `docs/reviews/round5/packet.md`): [x] 패킷 [x] R-A [x] R-B [x] R-C → [x] decisions_v6(V-01~V-04) [ ] 반영: [x] 06-a [x] 07+02+09-a [x] 잔여 grep
- 라운드 6(마지막, AD-018: R-B만, 기준 커밋 be5605d): [x] 패킷 [x] R-B → [x] 판정: 8개 역할 모두 PASS, P2 멈춤 → P3
- 판정 기록(라운드별 C1/C2/C3):
  - R6 R-B: TL·AI·QA 모두 PASS/PASS/PASS (B0·M0·m3). R5 R-A·R-C PASS와 합쳐 8역할 PASS(AD-018)
  - R5 R-C: 법무 PASS/PASS/PASS (B0·M0·m5)
  - R5 R-B: TL·AI·QA 모두 FAIL/FAIL/PASS (B0·M4·m5: t1 비스트리밍 추정, usage_overrun 기대 상태, tuning-log 캐시 필드, AC-09-19 배정)
  - R5 R-A: PM·PD·UX·UI 모두 PASS/PASS/PASS (B0·M0·m3)
  - R2 PM: FAIL/FAIL/FAIL (Blocker 0, Major 5: 예산-목표 불일치, 취소 시 한도 규칙 충돌, KPI 쿼리 분모, 검증 표본 확보, 00↔07·09 불일치)
  - R2 UX: FAIL/FAIL/FAIL (1라운드 19/19 해결, Blocker 0, Major 3: 결과 신뢰 문구 01↔02 불일치, 진단 카드 크기 규칙이 실제 화면에서 불성립, 편집 가능 판정을 화면 폭으로 해 200% 확대 시 편집 소실)
  - R2 QA: FAIL/FAIL/PASS (1라운드 21/27 해결·5 부분·1 P2, Blocker 0, Major 4: thresholds 키 구조 3종, 보류 허용 검증 목록 부재·k6 staging 의존, 에이전트 자기 채점 방지(spec:extract·spec-lock), 07·09·04 수치 불일치)
  - R2 TECH: FAIL/FAIL/FAIL (1라운드 24/28 해결, Blocker 2: Docker 없는 환경 대안 부재, 시각 회귀·브라우저 매트릭스가 Docker 전제 / Major 5: 병렬 호출 예산 초과, 동시 잡 5 vs Chromium 3, 후보 파기 DDL 불일치, CLAUDE.md↔09장 운영 규칙 차이, MVP DDL의 pgvector)
  - R2 PD: FAIL/FAIL/FAIL (1라운드 23건 중 20 해결·3 부분, Blocker 0, Major 5: S08 근거 칩 부재·v_true 문구 모순, 03 허용 조합이 04 린터에서 항상 실패(AIL-06·AIL-03), 사진 톤·업종 필터 부재, styleguide.html 내보내기 누락, 검증 대조군 약함)
  - R2 UI: FAIL/FAIL/PASS (1라운드 24건 중 20 해결·4 부분, Blocker 0, Major 4: 밝은 브랜드색 대비 보정 실패 경로 없음, 텍스트 역할→타입 단계 표 부재(H7 T3 2.47), 히어로 8~24자와 타입 스케일 불일치, 폰트 서브셋 전략·enum 불일치)
  - R2 AI: FAIL/FAIL/FAIL (1라운드 24건 중 22 해결·1 부분, Blocker 1: 05장 정규화 분위수 표·few-shot 48개의 임시 시드 규칙 부재(B1~B17) / Major 4: 진단 시뮬 단일 시드 판정·튜닝 겹침·멈춤 규칙 없음, 골든 M1 95%±0.12가 RMSE 0.12와 모순(QA2-05와 충돌 → v3 결정), gen_copy 실패·거절 처리 미정, MockProvider가 04장 분할 호출과 다르고 ok 시나리오가 수리 경로를 안 탐)
  - R4 R-C: 법무 FAIL/FAIL/FAIL(RC4-01~05: 증거 삭제 순서·프로젝트 삭제 경로·purge now()·abuse_holds 수명·미확인 요청 보관)
  - R4 R-B: TL FAIL/FAIL/PASS(RB4-01·02), AI FAIL/FAIL/PASS(RB4-03), QA FAIL/FAIL/PASS(RB4-02·04·05)
  - R4 R-A: PM PASS/PASS/PASS, PD FAIL/FAIL/PASS(RA4-02), UX FAIL/FAIL/PASS(RA4-03), UI FAIL/FAIL/PASS(RA4-01)
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
- [x] FINAL 정리 [x] 구현 규칙 추가 [x] 임시 시드 데이터(→ M1 seed:temp, AD-023) [x] HUMAN_TODO 정리

## P4. 구현
### 상태(09장 9.7. 표는 덮어쓰고 아래 기록은 append)
| M | 상태 | 시작 | 종료 | 태그 | verify | 미해결 BLOCKED | 가정 수 |
|---|---|---|---|---|---|---|---|
| M0 | done | 2026-11-19T12:50Z | 2026-11-19T14:46Z | m0-done | pass_blocked | 5 | 7 |
| M1 | in_progress | 2026-11-19T14:47Z | – | – | – | – | – |
| M2 | todo | – | – | – | – | – | – |
| M3 | todo | – | – | – | – | – | – |
| M4 | todo | – | – | – | – | – | – |
| M5 | todo | – | – | – | – | – | – |
| M6 | todo | – | – | – | – | – | – |
| M7 | todo | – | – | – | – | – | – |
| M8 | todo | – | – | – | – | – | – |
상태 ∈ todo | in_progress | blocked | done | halted

데이터 provenance: (M1 data:validate 후 기록)

- P3 완료(spec-lock은 AD-025로 보완 커밋에 재생성). 다음: M0 하위 단위 계획(09장 9.4.2) 작성 후 착수
- M0 계획(9.4.2, 9.5.1. 코드는 저장소 루트에 9.1.2 트리로):
  - [x] 01 루트 스캐폴드: pnpm@9(corepack)·turbo·tsconfig strict·eslint·prettier·vitest·.nvmrc, lockfile
  - [x] 02 9.1.2 패키지·앱 빈 골격(index.ts), lint·typecheck 녹색
  - [x] 03 M0 수용 테스트(acMilestones M0) `test(acc)` 커밋(c54ffda) + 자체 잠금(79dc13d, guard:self-lock 선구현)
  - [x] 04 packages/config: env zod(06장 env 목록)·thresholds 로더·네트워크 가드, .env.example, env:init(.env.local 비밀값)
  - [x] 05 spec:extract(--from FINAL/review-pass/--init-tuned) → config/thresholds.json·test-policy.json(lockedBy spec), diagnosis-tuned.json(자체 잠금)
  - [x] 06 native 스택: PG16(:54322, runuser postgres) + packages/db/shim, `pnpm dev:stack`·`db:native` (web·worker `dev` 스크립트·local 드라이버는 07·M1)
  - [x] 07 web `/api/health`(Next 16, tsconfig.next.json), worker `/health`(:8081, pg-boss migrate), 필수 env 누락 시 종료 1 — stack.test 8/8 녹색
  - [x] 08 guard 1~4단계(잠금 해시·금지 패턴·테스트 수·deps/라이선스) — guard.test 15/24 녹색, 남은 8건은 09(spec 대조·6단계), 1건 BLK-002
  - [x] 09 guard 5~8단계: [x] 5·6단계 spec 대조(guard:spec, guard.test 23/24, 남은 1=BLK-002) [x] qa:trace 추적·배정(5/9) [x] --audit 리터럴(7/9) [x] --key-coverage(8/9, BLK-003) [x] --docs(BLK-004, qa-trace.test 8/9) [x] 8단계 tuned(guard:tuned)
  - [x] 10 tests/guard 메타 테스트(⑥⑦·7·8단계 10/10), guard:qa-audit(7단계) 추가
  - [x] 11 verify:fast·verify:m0~m8 실행기(scripts/verify, blocked 판정, 보고서), .guard/verify-scripts.json
  - [x] 11b AC-07-01 llm gateway 최소(replay·E_REPLAY_MISS, mock은 M5)
  - [x] 12 CI 워크플로(.github/workflows/ci.yml, 전 잡 NO_EXTERNAL_NETWORK=1·LLM_MODE=mock, AC-07-01)·docker/ 파일(실행은 needs_ci)
  - [x] 13 자체 잠금(--m0-end, ASM-007) → verify:m0 pass_blocked(BLK-001~005) → m0-done 태그
- M1 계획(9.4.3, AC: 02-01·12, 03-01, 05-02~04, 06-01~07·51, 09-04·05. 읽을 장은 CLAUDE.md 구현 규칙 3절):
  - [x] 01 M1 수용 테스트(acMilestones M1 + 9.4.3 ①~⑨) `test(acc)` 커밋 → qa:trace --audit → 자체 잠금, traceability.yaml M1 행
  - [x] 02 packages/data-contracts B1~B17 zod(09장 9.2 묶음 정의)
  - [x] 03 `data:validate`(25묶음, B19 0개 허용, 교차 참조 고아 0) — todo 자리표시 교체
  - [x] 04 `seed:temp` 결정적 PRNG(provenance temp, tmp_ 접두사, 2회 바이트 동일): [x] a1 골격·B1 축·B2 유형·B4 용도(장 표 파싱) [x] a2a taxonomy·mapping [x] a2b presets 8종 [x] a2b2 palettes 32벌(OKLCH→hex·색역·대비 재검사, ASM-011) [x] a2c1 text-roles(B25)·icons [x] a2c2 signatures·harmony [x] a2c3a components [x] a2c3b blocks(20블록·53 variant, ASM-012) [x] a2c3c tokens/schema [x] a3a 폰트 26·페어링 20(code 참조, ASM-013) [x] a3b 이미지 192(무늬 SVG placeholder, ASM-014) [x] b0 taxonomy mapL1toL2(purpose=null, AC-03-09~11 단위, ASM-015) [x] b1 템플릿(B9)·카드 48(B10, mapL1toL2 오버라이드, ASM-016) [x] b2 A/B 120·승인 168(전부 rejected: 게이트 미실행) [x] b3 레퍼런스 60·골든 32 골격(muRef·answers null, T-04) [x] c1 B14 금지어 48·28·B17 법무 골격·B23 처리위탁(ASM-017) [x] c2a B20 카피·축 힌트·B21 87·B22 6×≥10·B24 62(ASM-018·019) [x] c2b B18 부트스트랩 2026-S0(mapping.initial·자리표시 분위, M3에서 재생성, ASM-020) [x] c3 B15 골격 AIL 24×2(ASM-021) → data:validate 33묶음 녹색, data.test 9/11(남은 2 = M1-05)
  - [x] 05 packages/taxonomy 로더·nearestType(2.12.1)·브리지 규칙 1~3 — data.test 11/11
  - [x] 06 마이그레이션 6+local 1(6.3.3 그대로, AD-028)·`pnpm db:reset`, 빈 DB 2회 적용 녹색(public 50)
  - [x] 07 RLS(0007·0006_grants·local 9001)·DbPort(pg, SET LOCAL ROLE+claims)·픽스처 — db.test RLS 12/12
  - [x] 08 `db:seed` 멱등(⑥)·temp 라벨 유도(AC-05-02, ASM-022)
  - [x] 09 `db:types`(kysely-codegen ^0.20, AD-030) + web·worker 컴파일(⑧) 녹색
  - [x] 10 `db:schema-parity`(⑨ 차이 0, 이름 잠금 충돌 BLK-006) + `db:grants-snapshot`(6.3.5, 허용 6항목 일치·위반 검출 확인)
  - [ ] 11 verify:m1 녹색 → m1-done(tags 맵)
- M3 이월: B18 정규화기를 추출기로 재생성(9.2.4 코퍼스 200 렌더, ASM-020), B15 골격을 실제 예시로 교체 후 자체 잠금(ASM-021)
- [x] M0 [ ] M1 [ ] M2 [ ] M3 [ ] M4 [ ] M5 [ ] M6 [ ] M7 [ ] M8

## P5. 완료
- [ ] release:check 요약

## 로그
- 2026-11-20 02:32 | M1-10 db:schema-parity 차이 0·db:grants-snapshot 일치, BLK-006 → 다음: M1-11 verify:m1·m1-done
- 2026-11-20 02:29 | M1-09 db:types(kysely-codegen)·types.gen.ts 51테이블, ⑧ 녹색, guard deps ok → 다음: M1-10 schema-parity
- 2026-11-20 02:28 | M1-08 db:seed(8테이블 upsert, temp 라벨 유도 ASM-022), ⑥·AC-05-02 녹색 → 다음: M1-09 db:types
- 2026-11-20 02:26 | M1-07 RLS·DbPort·픽스처, shim에 auth 테이블 service_role 권한, db.test 13/17 → 다음: M1-08 db:seed
- 2026-11-20 02:23 | M1-06 마이그레이션 0001~0006+9000 local·db:reset, AC-06-01 녹색 → 다음: M1-07 RLS·DbPort
- 2026-11-20 02:22 | M1-05 loadTaxonomy·nearestType·checkBridgeRules(+단위 5), data.test 11/11, verify:fast pass_blocked → 다음: M1-06 마이그레이션
- 2026-11-20 02:15 | M1-04c3 B15 골격, M1-04 완료: data:validate 33묶음 녹색, data.test 9/11 → 다음: M1-05 taxonomy 로더
- 2026-11-20 02:14 | M1-04c2b B18 2026-S0 부트스트랩(5.5.4 initial, 분위 자리표시, M3 재생성 ASM-020) → 다음: c3 B15
- 2026-11-20 02:13 | M1-04c2a B20 copy_templates 44·axis_hints 10·B21 87·B22 6·B24 62, validate 교차 참조 → 다음: c2b B18
- 2026-11-20 01:31 | M1-04c1 cliche ko48·en28·legal md 3·processors/data-flows(스텁 3, ASM-017) → 다음: c2 B18·B20·B21·B22·B24
- 2026-11-20 01:29 | M1-04b3 references 60(쿼터·[임시])·golden 32 골격(7.2.3 θ*·브랜드 경계값) → 다음: c1 B14·B17·B23
- 2026-11-20 01:27 | M1-04b2 ab_plan 120(ABP·AB ID, focus_region)·approvals 168(temp 게이트 미실행 rejected) → 다음: b3 레퍼런스·골든
- 2026-11-20 01:26 | M1-04b1 templates.json(한결 고정 문안)·card_plan 48(브리지 L2 오버라이드·alt), ASM-016 → 다음: b2 A/B·승인
- 2026-11-20 01:24 | M1-04b0 @tastefit/taxonomy mapL1toL2(앵커 재현 8/8·160 허용·단조), ASM-015 → 다음: b1 템플릿·카드
- 2026-11-20 01:23 | 폰트·이미지 temp에 9.2.4 S-10 표기(verified_by temp-agent·LicenseRef-TasteFit-Generated) → 다음: 04b mapL1toL2+카드
