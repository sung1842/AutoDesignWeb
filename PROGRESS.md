# PROGRESS

## 현재 상태
- status: IN_PROGRESS
- phase: P4
- lock: {owner: 2026-11-26T06:08Z, since: 2026-11-26T07:14Z}
- review_pass_hashes: {thresholds: 9756b595efb0a9e8795cfff39018c5587bf621fd88c46aa1f20d0df5c81d57c4, testPolicy: 3bb46516432f148f6dea25b8c019d2fc20a2c5a7331591b8aed94cc25dbba481}  # 계산법 AD-019
- tags: {review-pass: 4519c49, spec-lock: acd413d, m0-done: 089cc76, m1-done: f1d5770}  # 원격 태그 푸시 불가 → 세션마다 로컬 복원(AD-022)
- review_pass_commit: 4519c49  # 원격 태그 푸시 403 → 태그 생성은 HUMAN_TODO(AD-020)
- limit.next_reset_kst: 2026-11-26 20:08  # 이 세션 시작(15:08 KST)+5h 추정
- 마지막 갱신: 2026-11-26 15:57 KST (세션 종료: M2-14c·14d, verify:m2 2차, 다음 14e 3차 실행)

## 실행 환경 사실(2026-11-18 점검)
- Docker 데몬 없음(클라이언트만). 이미지 레지스트리·Playwright 브라우저 다운로드 프록시 차단.
- 브라우저: `/opt/pw-browsers`의 chromium-1243만 있음(webkit·firefox 없음).
- PostgreSQL 16 설치됨, pgvector 없음. 06장 DDL은 auth 스키마 stub 위에서 vector 외 46개 테이블 생성 성공.
- npm 레지스트리 접근 가능.
- 2026-11-25 컨테이너 2코어: blocks.test AC-03-18 PS-T1이 180s 타임아웃(변경 전 코드도 동일, 환경 속도). 타임아웃 상향 금지 → 빠른 환경에서 재확인
- 새 컨테이너: shallow clone이면 `git fetch --unshallow` 후 태그 복원(guard:lock·tuned 필요). `pnpm install` 뒤 `pnpm typecheck`(tsc -b)로 dist 빌드해야 vitest·guard:count가 동작(루트 build 스크립트 없음)
- 하네스 폰트 캐시 `/tmp/tastefit-harness-fonts`: 빈 캐시면 AC-03-33·03-18이 2코어에서 180s 근처(페이지별 서브셋). 3차 verify 전 같은 컨테이너에서 한 번 돌려 데운다(캐시는 결과에 영향 없음)
- 폰트 서브셋(M2-07b2~)은 python3 fontTools(기본 설치) + brotli 필요. 컨테이너마다 `pip install --break-system-packages brotli` 1회(AD-032).

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
| M1 | done | 2026-11-19T14:47Z | 2026-11-19T17:53Z | m1-done | pass_blocked | 6 | 15 |
| M2 | in_progress | 2026-11-19T17:54Z | – | – | – | – | – |
| M3 | todo | – | – | – | – | – | – |
| M4 | todo | – | – | – | – | – | – |
| M5 | todo | – | – | – | – | – | – |
| M6 | todo | – | – | – | – | – | – |
| M7 | todo | – | – | – | – | – | – |
| M8 | todo | – | – | – | – | – | – |
상태 ∈ todo | in_progress | blocked | done | halted

데이터 provenance: B1~B25 전부 temp(seed:temp, human 0). B15 골격·B18 부트스트랩은 M3에서 교체(ASM-020·021)

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
  - [x] 11 verify:m1 pass_blocked(BLK-001~006) → m1-done. AC-06-32(m0 stack) 1회 간헐 실패 후 재실행 통과
- M2 계획(9.4.4, AC: 03-02~11·15~38·41·42·44~46, 04-03~11·17·18·18a·30, 06-24~26·28. 읽을 장은 CLAUDE.md 구현 규칙 3절):
  - [x] 01 M2 수용 테스트(acMilestones M2 + 9.4.4 ①~⑧) `test(acc)` 커밋 → qa:trace --audit → 자체 잠금, traceability M2 행: [x] a 토큰·택소노미·시그니처(03-02~11·44, tokens.test, ASM-023) [x] b 04장 명세서·보정·변형·트리(04-03~10·30, spec.test, ASM-024·BLK-007; 04-11은 e로) [x] c 컴포넌트·블록·서체·조판·텍스트 역할(03-15~27·42·45·46, blocks.test, ASM-025·BLK-008) [x] d 아이콘·이미지·반응형·다크·브랜드(03-28~37·41, assets.test, ASM-026) [x] e 컴파일·렌더·미리보기(render.test, ASM-027, AC-03-38 tokens.test 추가, traceability M2 56행; 04-11·17·18·18a, 04-08 렌더 D, 03-44 accent 렌더, 06-24~26·28, ①~⑧) [x] f qa:trace --audit 리터럴 0·단일 test(acc) eded1cd(AD-031)·자체 잠금
  - [x] 02 design-spec a: [x] a1 predictL1(AC-03-07 8/8)·calibrate 1·2단계(AC-04-05 31/31, ASM-028) [x] a2 mapL1toL2ForPurpose·snapToFeasible(F·J, snap.test 4/4, ASM-029)
  - [x] 03 design-spec b: [x] a signatureEligible(AC-03-08 12/12)·letterSpacingEm(단위 8/8) [x] b0 validateTokenSet(최소 JSON Schema 검증기, ASM-030) [x] b1 deriveTokens·expectedSize(AC-03-02~04·44 8/8, ASM-031; expectedSize 브라우저 대조는 M2-09) [x] b2 exportTokens(AC-03-05 ① 녹색, CSS 리터럴 ②③은 renderer M2-05) [x] c applyBrandColor(3.13, brand.test 4/4·192건 대비 통과, ASM-032) [ ] d compileSpecs: [x] d1 variantTargets(4.4 α·거리 강제, variants.test 2/2, ASM-033) [x] d2a pickSignatures(4.14, PURPOSE_RANK 임시, ASM-034) [x] d3 layoutConstraints(hero_variants·SigCtx·apply_to)·copyTone(4.6.1)·decor(layout.test 9/9, ASM-035) [x] d3b enforceVariantL2Diff(4.4 L2 7키 ≥3)·spec_id(enforce.test 4/4, ASM-036) [x] d4a compileSpecs 조립·DesignSpecSchema(zod, l2 단방향 생성) — spec.test AC-04-03·06·08 녹색, ASM-037 [x] d4b staticLint(S)·장식 예산 후보 거름 → spec.test AC-04-03~09·30 녹색(10은 M2-04), ASM-038
  - [x] 04 layout-schema: [x] a LayoutTreeRaw zod(blocks.json enum·슬롯 kind)·JSON Schema·copyDeckLimits·기준 픽스처 → AC-04-10 녹색, ASM-039·BLK-009 [x] b PageSchema(확정 LayoutTree: text·asset_id·role_overrides)·JSON Schema 정적 검사(⑥, schema.test 4/4, ASM-040)
  - [x] 05 renderer a: [x] a1 CM-02 리터럴 검사·CSS 층 레지스트리·base.css·Button·TextLink(literal.test 4/4, 토큰 리터럴 AC 녹색, ASM-041) [x] a2 컴포넌트 CSS 나머지 16종(3.5.1·3.5.3 state, 12파일 리터럴 0) [x] a3 compilePage 골격(문서·nav·footer·섹션 속성 CM-04~06·14·16, 일반 템플릿, compile.test 3/3, ASM-042)
  - [x] 06 renderer b: [x] b0 텍스트 역할 층(B25 33역할 → text-roles.css·모든 텍스트 노드 data-role·blocks 슬롯 textRoles, 단위 4/4, ASM-043) [x] b1 hero 6 variant(hero.css 12열 text_cols, hero.test 4/4, ASM-044) [ ] b2 나머지 블록(registerTemplate + blocks/*.css): [x] b2a value·feature·showcase·stats·process 13(ASM-045) [x] b2b proof·pricing·faq·cta·menu 12(ASM-046) [x] b2c highlight·gallery·location·story·about·service·contact 16(ASM-047, BLK-010) [x] b2d nav·footer variant(sticky T2·T7, ASM-048)
  - [x] 07 assets: [x] a 아이콘 인라인 SVG(임시 도형 40, icon-grid·location, ASM-049·BLK-011) [x] b 로컬 @font-face: [x] b1 폰트 계획·@font-face·preload(순수, ASM-050) [x] b2 node 서브셋 생성(fontTools, temp 시스템 Noto CJK, 결정적·이름 표=subsetFamily, ASM-051) [x] c 이미지 <img>(로컬 경로·width/height·eager/lazy·초점)·shape-graphic G1~G4(ASM-052) [x] d 100회 SHA 동일(④, 프리셋 8 단위 테스트)
  - [x] 08 폴백 생성기: [x] a standardTree·fallbackMockup·resolveTree(72 PageSchema 유효, ASM-053) [x] b fixtures/layouts 31(용도 × 10+, 패턴 1~4 전부, `pnpm fixtures:layouts`)·fixturePage(①, ASM-054)
  - [x] 09 하네스·게이트(AC-04-08 렌더 D는 BLK-012): [x] a 하네스 코어(가상 오리진·자산 서빙·measure·폰트 바이트·플랫폼 폰트)·G-02·04·05·06·07(폴백 72×2 위반 0, ASM-055) [x] b headlineLines·compileInBrowser(브라우저 = Node SHA 동일, AC-04-18a) [x] c G-03 비텍스트 대비(입력·버튼 경계·포커스, 폴백 72×2 G-02~07 위반 0) [x] f 검사용 렌더: renderBlockSample·renderComponentGallery(93케이스)·renderStepProbe(ASM-061) [x] e G-12 명세 무결성·AIL-17(D)(AC-03-45 ①~④ 녹색, ASM-065) [ ] d extractL1(05장 추출기): [x] d1 원시 특징 F01~F30(DOM·픽셀 k-means, harness.features, ASM-066) [x] d2 정규화기 → L1(5.5.4)·harness.extractL1(ASM-067; AC-04-08 0.406, 자리표시 분위 탓) [x] d3 B18 재생성(`seed:temp --corpus`, 200 렌더, ASM-068) [ ] d4 AC-04-08(현재 0.365 < 0.95). 진단(골든 6건): 변형 쌍 토큰 차이 1~2키뿐이고 4.4 ≥3키는 hero·signature extras로 채움, 그런데 renderer에 시그니처 층(4.14 SIG-01~12)이 없어 렌더 차이가 안 남. F22 항상 0, F01 중앙값 0 → [x] d4a renderer 시그니처 층(4.14·3.2.4, signature.apply_to, ASM-069) [x] d4b 폴백 트리 hero variant 반영 확인(standard.ts lc.hero_variants) [x] d4c `pnpm typecheck && pnpm seed:temp --corpus` 재생성 → AC-04-08 0.542 [ ] d4d 진단(골든 32, 축별): ① shape 축이 radius_family sharp↔soft에도 0.37 고정(F01 = SB 중앙값, 큰 surface 섹션 radius 0이 지배, F01 차이 8/96) ② depth 축 0.25 고정(depth.shadow_level 0↔1이 렌더에 안 남: 카드는 항상 --tf-shadow-level-1) ③ 변형 L2 차이 1~2키(팔레트·페어링·density). [x] d4d1 렌더 누락 수정: 카드 그림자 = shadow_level(+1 강조·hover)·카드 radius md·미디어 lg(3.1.7·3.1.8, ASM-070), B18 재생성 → 54/96(0.5625). 남은 원인: 실패 42쌍 대부분 shape·depth L2 동일(골든 depth 대부분 flat·sharp), shape-graphic 직사각형(radius 0 Sf)이 F01 중앙값 지배(사양대로) [x] d4d2(구현은 사양 일치, 4.3 변경 벌점 0.02가 변형을 앵커로 모음 → BLK-012 locked-conflict) 4.4 variantTargets L1 거리 → snapToFeasible 뒤 L2가 붕괴하는지 확인(골든 32 변형별 L1 목표 vs 스냅 L2 비교) → 구현 오류면 수정, 사양상 불가면 BLOCKED(locked-conflict)
  - [x] 10 worker render 잡(뷰포트 5 PNG·차단 카운터, JS off, 글꼴 /fonts/, ASM-058)
  - [x] 11 미리보기: 서명 URL·preview 헤더·iframe·compileForEdit CSP·parentProbe(⑧, ASM-059). Next 라우트 연결은 M5
  - [x] 12 시각 회귀 기준선 24장(⑤, 지문 7303eb92a5bd, e2e/m2 재실행 24/24, Docker 지문 needs_ci, ASM-071)
  - [x] 13 renderer 금지 의존성 검사(⑦) 확인(수용 테스트 통과)
  - [ ] 14 verify:m2 → m2-done(tags 맵). 1차(2026-11-26, reports/verify-m2-1.json) fail: acceptance:m2 17건. 정리:
    - [x] 14a SIG-11 hero G-05 회귀 수정·next peer @playwright/test 끊기(AD-033)·validateBundle 구현(AC-03-22·42 녹색, ASM-072)
    - [x] 14b treeLint 단계 T(G-01·LT-01~11·RH-01~02, ASM-073). patternRaw LT-03 하한 채우기·리듬 DFS·덱 index 분배, 픽스처 29 재생성. AC-04-11은 pl1-00(기준선 입력) LT-03 1건 → BLK-013
    - [x] 14c harmonyScore(packages/scoring/src/harmony.ts, AC-03-20 녹색, 단위 6, ASM-074)
      - 메모(다음 세션): 03장 3.14.3~5·04장 4.10.3, data/taxonomy/harmony.json(items H1~H12·constants). 테스트 시그니처 `harmonyScore(spec, tree).total`(렌더 없음) → 정적 판정: H1~H3 팔레트 토큰(primary·accent·bg·surface·surface-inverse, 상태·hover 제외), H4·H5 font 토큰+registry, H6·H8·H9 토큰 생성이라 만점(렌더 측정 입력은 선택 인자, M3), H7 type display/body, H10 design-spec `l2Conflicts`(snap.ts, CF-03·04 등)+CF-05·06·08~12, H11 decor.effects ≤ max, H12 트리 리듬. scoring 의존은 config뿐(09장 9.1.3 표) → 리듬 판정을 scoring 안에 둘지(중복) 확인 후 ASM
    - [ ] 14d 원인 미확인 실패 개별 재현(`npx vitest run tests/acceptance/m2/<f> -t <AC>`): [x] AC-03-33(터치 타깃 CSS·하네스 폰트 캐시, ASM-075; 빈 캐시는 180s 초과 위험) [x] AC-03-18 PS-T1~T8(녹색, 각 50~90s: ASM-075 하네스 캐시 효과) [x] AC-03-23(라틴 서브셋 한글 제외·mono 스택·하네스 한글 구간, ASM-076) [x] AC-03-26·AC-03-45 ②④(재현 안 됨, 녹색) [~] 빈 캐시 대비: 페이지당 python 1회로 묶음(ASM-075). 그래도 빈 캐시 AC-03-33 ≈ 400페이지 × 1.2s > 180s(2코어), 데운 캐시 52~132s. 남은 안: 상주 서브셋 프로세스(페이지당 ≈0.8s, 여전히 빠듯) 또는 빠른 환경 확인
    - [ ] 14e verify:m2 재실행. 2차(2026-11-26, reports/verify-m2-2.json) fail 17→4 비BLK: AC-03-33(전체 실행 중 180s 초과, 단독 통과), AC-06-32 m0(간헐, 단독 통과), AC-03-19·AC-04-08(BLK-009·012 재현 명령 줄이 없어 매핑 실패 → BLOCKED.md에 추가). 다음: 3차 실행(데운 폰트 캐시) → pass_blocked면 m2-done.(약 60분, 백그라운드 nohup 후 reports/verify-m2.partial.json 확인). 남는 것: AC-03-19(BLK-009)·AC-04-08(BLK-012) blocked
      - 3차(2026-11-26, reports/verify-m2-3.json, 데운 캐시): acceptance:m2 blocked만(BLK-009·012·013, AC-03-33 통과). 남은 fail = AC-06-32 m0 "기본 env 통과" 1건(verify 안에서만 3회째, 단독·m0 전체 단독은 통과, 원인 미상). 4차는 NODE_OPTIONS 진단 훅(저장소 밖)으로 출력 수집
- M3 이월: (B18 재생성은 M2-09d3으로 당김), B15 골격을 실제 예시로 교체 후 자체 잠금(ASM-021)
- [x] M0 [x] M1 [ ] M2 [ ] M3 [ ] M4 [ ] M5 [ ] M6 [ ] M7 [ ] M8

## P5. 완료
- [ ] release:check 요약

## 로그
- 2026-11-26 16:15 | verify:m2 3차 fail: 비BLK는 AC-06-32 m0(verify 안에서만 재현) 1건. 4차 진단 실행
- 2026-11-26 15:55 | verify:m2 2차 fail(비BLK 4: 03-33 시간·06-32 간헐·BLK-009/012 재현 명령 누락→보완), 하네스 서체 묶음 생성
- 2026-11-26 15:57 | 세션 종료(잠금 해제). 다음 M2-14e 3차 verify:m2
- 2026-11-26 14:42 | M2-14d AC-03-18 PS-T1~T8 녹색(각 50~90s). 남은 14d = 빈 캐시 대비 검토
- 2026-11-26 14:27 | M2-14d AC-03-23 한글 서체(라틴 서브셋·mono 스택·하네스), AC-03-26·45②④ 녹색 확인, ASM-076
- 2026-11-26 13:52 | M2-14d AC-03-33 터치 타깃(skip·wordmark·nav·drawer 44px)·하네스 폰트 캐시, 녹색, ASM-075
- 2026-11-26 13:22 | M2-14c harmonyScore H1~H12·CF 판정(정적+선택 렌더·위반 입력), AC-03-20 녹색, ASM-074
- 2026-11-26 12:55 | 세션 종료(잠금 해제). 다음 M2-14c harmonyScore(메모는 P4 14c 아래)
- 2026-11-26 12:40 | M2-14b treeLint 단계 T(ASM-073)·표준 트리 LT-03 하한·리듬 수정, BLK-013(PL-1 기준선 ↔ AC-04-11)
- 2026-11-26 11:58 | verify:m2 1차 fail 17 → SIG-11 G-05 회귀·AC-09-09(AD-033)·validateBundle(ASM-072) 수정, 14b~e 계획
- 2026-11-26 11:05 | M2-12 렌더러 시각 회귀 기준선 24장(지문 7303eb92a5bd)·스펙 자체 잠금, ASM-071
- 2026-11-26 10:45 | M2-09d4d2 스냅 진단: 벌점 0.02로 96쌍 중 69쌍 6키 동일(사양대로) → BLK-012, 09 종료
- 2026-11-26 09:23 | M2-09d4d1 카드 그림자 단계·radius 역할(3.1.7·3.1.8) 렌더 수정, B18 재생성, AC-04-08 0.5625, ASM-070
- 2026-11-26 08:10 | 09d4d 진단: shape·depth 축 고정(F01 SB 중앙값, shadow_level 미반영), 세션 종료(잠금 해제)
- 2026-11-26 08:04 | M2-09d4c B18 재생성(시그니처 층 반영). AC-04-08 0.365→0.490(옛 B18)→0.542, 미달 → 원인 진단 계속
- 2026-11-26 07:52 | M2-09d4a 시그니처 층(data-signature·data-sig, 요소형 06·07·11, SIG-09 생성 CSS), ASM-069
