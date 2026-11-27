# PROGRESS

## 현재 상태
- status: IN_PROGRESS
- phase: P4
- lock: {owner: 2026-11-27T03:07Z, since: 2026-11-27T04:12Z}
- limit.weekly_block_until_kst:   # 주간 한도 소진 시 초기화 시각(KST). 비어 있으면 게이트 없음(CLAUDE.md 0.6)
- review_pass_hashes: {thresholds: 9756b595efb0a9e8795cfff39018c5587bf621fd88c46aa1f20d0df5c81d57c4, testPolicy: 3bb46516432f148f6dea25b8c019d2fc20a2c5a7331591b8aed94cc25dbba481}  # 계산법 AD-019
- tags: {review-pass: 4519c49, spec-lock: acd413d, m0-done: 089cc76, m1-done: f1d5770, m2-done: ae60108, m3-done: 25e1b05}  # 원격 태그 푸시 불가 → 세션마다 로컬 복원(AD-022)
- review_pass_commit: 4519c49  # 원격 태그 푸시 403 → 태그 생성은 HUMAN_TODO(AD-020)
- limit.next_reset_kst: 2026-11-27 17:07  # 이 세션 시작(12:07 KST)+5h 추정
- 마지막 갱신: 2026-11-27 12:55 KST (M5-01 수용 테스트 완료·자체 잠금, 구현 재개)

## 실행 환경 사실(2026-11-18 점검)
- Docker 데몬 없음(클라이언트만). 이미지 레지스트리·Playwright 브라우저 다운로드 프록시 차단.
- 브라우저: `/opt/pw-browsers`의 chromium-1243만 있음(webkit·firefox 없음).
- PostgreSQL 16 설치됨, pgvector 없음. 06장 DDL은 auth 스키마 stub 위에서 vector 외 46개 테이블 생성 성공.
- npm 레지스트리 접근 가능.
- 2026-11-25 컨테이너 2코어: blocks.test AC-03-18 PS-T1이 180s 타임아웃(변경 전 코드도 동일, 환경 속도). 타임아웃 상향 금지 → 빠른 환경에서 재확인
- 새 컨테이너: shallow clone이면 `git fetch --unshallow` 후 태그 복원(guard:lock·tuned 필요). `pnpm install` 뒤 `pnpm typecheck`(tsc -b)로 dist 빌드해야 vitest·guard:count가 동작(루트 build 스크립트 없음)
- 하네스 폰트 캐시 `/tmp/tastefit-harness-fonts`: 빈 캐시면 AC-03-33·03-18이 2코어에서 180s 근처(페이지별 서브셋). 3차 verify 전 같은 컨테이너에서 한 번 돌려 데운다(캐시는 결과에 영향 없음)
- 폰트 서브셋(M2-07b2~)은 python3 fontTools(기본 설치) + brotli 필요. 컨테이너마다 `pip install --break-system-packages brotli` 1회(AD-032).
- 새 컨테이너: fs 저장소 기본 루트 `/tmp/tastefit-storage`가 비어 있어 설문 WebP가 없다 → verify:m4 전에 `pnpm survey:build`로 재생성(없으면 e2e/m4 quiz가 모든 카드 대체 텍스트로 실패)
- 새 컨테이너: `pnpm env:init`은 비밀값 4개만 쓴다 → .env.example의 값 있는 비밀 아닌 줄(DATABASE_URL_DIRECT 등)을 .env.local에 덧붙여야 db:seed·survey:build 동작
- verify는 작업 트리를 읽는다: 실행 중 커밋하면 결과가 오염된다 → `git worktree add /home/claude/tf-verify-mN <커밋>` 후 그 안에서 실행

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
| M2 | done | 2026-11-19T17:54Z | 2026-11-26T07:41Z | m2-done | pass_blocked | 13 | 54 |
| M3 | done | 2026-11-26T07:41Z | 2026-11-26T16:07Z | m3-done | pass_blocked | 9 | 13 |
| M4 | in_progress | 2026-11-26T16:08Z | – | – | – | – | – |
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
  - [x] 14 verify:m2 → m2-done(tags 맵). 1차(2026-11-26, reports/verify-m2-1.json) fail: acceptance:m2 17건. 정리:
    - [x] 14a SIG-11 hero G-05 회귀 수정·next peer @playwright/test 끊기(AD-033)·validateBundle 구현(AC-03-22·42 녹색, ASM-072)
    - [x] 14b treeLint 단계 T(G-01·LT-01~11·RH-01~02, ASM-073). patternRaw LT-03 하한 채우기·리듬 DFS·덱 index 분배, 픽스처 29 재생성. AC-04-11은 pl1-00(기준선 입력) LT-03 1건 → BLK-013
    - [x] 14c harmonyScore(packages/scoring/src/harmony.ts, AC-03-20 녹색, 단위 6, ASM-074)
      - 메모(다음 세션): 03장 3.14.3~5·04장 4.10.3, data/taxonomy/harmony.json(items H1~H12·constants). 테스트 시그니처 `harmonyScore(spec, tree).total`(렌더 없음) → 정적 판정: H1~H3 팔레트 토큰(primary·accent·bg·surface·surface-inverse, 상태·hover 제외), H4·H5 font 토큰+registry, H6·H8·H9 토큰 생성이라 만점(렌더 측정 입력은 선택 인자, M3), H7 type display/body, H10 design-spec `l2Conflicts`(snap.ts, CF-03·04 등)+CF-05·06·08~12, H11 decor.effects ≤ max, H12 트리 리듬. scoring 의존은 config뿐(09장 9.1.3 표) → 리듬 판정을 scoring 안에 둘지(중복) 확인 후 ASM
    - [ ] 14d 원인 미확인 실패 개별 재현(`npx vitest run tests/acceptance/m2/<f> -t <AC>`): [x] AC-03-33(터치 타깃 CSS·하네스 폰트 캐시, ASM-075; 빈 캐시는 180s 초과 위험) [x] AC-03-18 PS-T1~T8(녹색, 각 50~90s: ASM-075 하네스 캐시 효과) [x] AC-03-23(라틴 서브셋 한글 제외·mono 스택·하네스 한글 구간, ASM-076) [x] AC-03-26·AC-03-45 ②④(재현 안 됨, 녹색) [~] 빈 캐시 대비: 페이지당 python 1회로 묶음(ASM-075). 그래도 빈 캐시 AC-03-33 ≈ 400페이지 × 1.2s > 180s(2코어), 데운 캐시 52~132s. 남은 안: 상주 서브셋 프로세스(페이지당 ≈0.8s, 여전히 빠듯) 또는 빠른 환경 확인
    - [ ] 14e verify:m2 재실행. 2차(2026-11-26, reports/verify-m2-2.json) fail 17→4 비BLK: AC-03-33(전체 실행 중 180s 초과, 단독 통과), AC-06-32 m0(간헐, 단독 통과), AC-03-19·AC-04-08(BLK-009·012 재현 명령 줄이 없어 매핑 실패 → BLOCKED.md에 추가). 다음: 3차 실행(데운 폰트 캐시) → pass_blocked면 m2-done.(약 60분, 백그라운드 nohup 후 reports/verify-m2.partial.json 확인). 남는 것: AC-03-19(BLK-009)·AC-04-08(BLK-012) blocked
      - 3차(2026-11-26, reports/verify-m2-3.json, 데운 캐시): acceptance:m2 blocked만(BLK-009·012·013, AC-03-33 통과). 남은 fail = AC-06-32 m0 "기본 env 통과" 1건(verify 안에서만 3회째, 단독·m0 전체 단독은 통과, 원인 미상). 4차는 NODE_OPTIONS 진단 훅(저장소 밖)으로 출력 수집
      - 4차(reports/verify-m2-4.json, ae60108): pass_blocked(BLK-001~006·009·012·013) → m2-done. AC-06-32는 이번엔 통과(간헐, 재발 시 BLOCKED 등록)
- M3 계획(9.4.5, AC: 03-39·43, 04-12·13·19~21·26·43·45, 05-12·14·15·22·24·25, 08-11~16. 읽을 장은 CLAUDE.md 구현 규칙 3절):
  - [x] 01 M3 수용 테스트(tests/acceptance/m3, AD-031 방식, test(acc) 09da0ab 자체 잠금): [x] a linter.test(AC-04-12·26, ①, ASM-077) [x] b gates.test(AC-04-19·21, AC-08-11·12·13a, ASM-078) [x] c scoring.test(AC-04-20·43·45, ⑥, ASM-079) [x] d extractor.test(AC-05-12·14·15·22·24·25, ③④⑤, ASM-080) [x] e golden.test(②, AC-04-13, AC-08-13~16, AC-03-39·43, ASM-081) [x] f traceability M3·qa:trace --audit·단일 test(acc)·자체 잠금
  - [x] 02 linter 규칙 24파일·RULES·lintAll·matchCliche(사전 어간 정규식, AC-04-12 녹색, ASM-082·BLK-016) [x] 03 하네스 lintSnapshot(D·P, ASM-083) [x] 04 B15 예시 24×(2+2) 작성·자체 잠금(70f0f82, linter.test 30/31 — 남은 1 = BLK-016)
  - [x] 05 gates G-01~G-13·H1~H12 순수 함수·checkOriginality·phash64·judgeAbuse(gates.test 35/35, ASM-084) [x] 06 scoring TM·S_free·노출 선택·QualityReport(scoring.test 17/17) [x] 07 extractor 왕복·앵커 거리·p95(extractL2·l1Distance·evaluateCandidate·selfcheck·eval·normalizer 트리거. extractor.test 36/39, 남은 3 = BLK-017·018) [x] 08a CP-01~12 copyRules·buildFallback(AC-04-13 녹색, ASM-086) [ ] 08b [x] CF 픽스처 [x] assemblePrompt [x] eTLD+1 [x] lint-matrix·editChoices·harmony.conflicts(AC-03-43 녹색, ASM-088) [x] AC-08-16 BLK-019 [x] 08c verify:m3 2차 pass_blocked(BLK-002·004·005·006·008·009·012·013·016~019) → m3-done(25e1b05)(주의: qa:trace --audit가 packages/extractor/src/dom.ts 리터럴 4건 FAIL — M2부터 있던 것, M3-07에서 정리)
- M4 계획(9.4.6, AC: 00-02·03·11·12, 01-04~21·55·57, 02-02~11·13~31·33~37, 03-12~14, 05-10·23, 06-08·11·12·46, 07-08·20, 09-17. 읽을 장은 CLAUDE.md 구현 규칙 3절):
  - [x] 01 M4 수용 테스트(tests/acceptance/m4, AD-031 방식): [x] a diagnosis 엔진(02장 2.5~2.7·2.12, ③⑤⑥, ASM-090) [x] b sim:survey 게이트·튜닝 규칙(④, 2.16, ASM-091) [x] c survey:build 산출·멱등·x_card·--check(①②③, AC-02-07~10·37, survey-build.test, ASM-093) [x] d 진단 API·익명 세션·멱등·CSRF·소유·p95(⑤⑥⑦, AC-06-11·12·46, api.test, ASM-095) [x] e 이벤트 API·레지스트리·서버 이벤트·identity_links(⑫, AC-00-11·12, events.test, ASM-096) [x] f 진단·결과 화면 E2E(⑧⑨⑩, e2e/m4/survey.spec + serve.ts webServer, ASM-100) [~] g build-answers 결정성·M1a 변이(⑪, AC-07-20, golden-answers.test, ASM-097. 골든 잠금은 guard) [ ] h traceability M4(45/71, results.test 11/11). presets 3/3. e2e/m4 quiz 11/11(AC-01-04~08·10~12·55, 회전 안내·브라우저 뒤로·단조 진행률 구현). 남은: e2e 결과 화면(01-16~20·57) + vitest 브리지(ui.test), 06-08, 09-17·19, 01-13·14·21 수동/needs [x] i qa:trace --audit 리터럴 0·단일 test(acc) f4dc6b6·자체 잠금 15파일(tests/acceptance/m4·e2e/m4)  → qa:trace --audit·guard:patterns·단일 test(acc)·자체 잠금
  - [x] 02 packages/diagnosis 사후분포·1-step 갱신·문항 선택·종료·유형 판정·κ·pickNotice(diagnosis.test 24/24, AC-02-06 BLK-020)
  - [ ] 03 sim:survey(1,000명, 공통 난수 쌍체·부트스트랩)·튜닝 절차: [x] 시뮬레이터·판정·튜너·CLI(합성 dev: RMSE 0.1215·앵커 0.930만 미달, ASM-091) [ ] x_card gate·튜닝 실행(BLK-022로 활성 자극물 부족, 보류)
  - [ ] 04 survey:build(카드 렌더→x_card→게이트→WebP→local Storage→survey_items upsert, manifest.lock): [x] a surveyPage(ASM-092) [x] b 판정 순수 함수 stimuli.ts(judgeCard·judgePair·coverage·stage1Issues, 단위 5/5) [x] c StoragePort fs(멱등 put·서명 URL, 단위 3/3) [x] d 렌더·WebP·추출·manifest(--only, surveyShot·encodeWebp·dominantColors, ASM-094. C-SV01-hero x 오차 0.17~0.45 → draft) [x] e DB upsert·멱등·--check(survey-build.test ②·--check 5/5 녹색) [x] f 전체 실행·manifest 커밋(193장·361파일, 활성 카드 1/48 → BLK-022 survey-items) [x] g AC-02-09 domHash 차이 = shape-graphic·장식 시그니처 → ASM-098 수정, 재빌드 후 템플릿별 1종·쌍 DOM 차이 0(활성 카드 1, BLK-022) [ ] h 하드 게이트·린터 error 0(2.4.7 verified 조건, 현재는 추출 오차·렌더 오류만 판정 — BLK-022 해소 때 함께)
  - [ ] 05 진단 API·익명 쿠키 세션(D-41)·재개·뒤로가기: [x] a api-contract zod·handle 라우터·survey 서비스·db 픽스처(api.test 13/13, ASM-099) [x] b Next route.ts 위임·/api/_storage/public fs 라우트(next build 확인은 E2E 단위)
  - [x] 06 POST /api/events·이벤트 레지스트리 zod·identity_links(events.test 7/7)
  - [ ] 07 진단·결과 화면(01장, packages/ui 토큰)·닮은 사이트 3 링크·비제휴 고지: [x] a 닮은 사이트 2.14(서버 계산·저장·표시 시 재확인, seedSimilarSites 픽스처) [x] b S02 진단 화면(1.4 R1~R7·레이아웃 5종·뒤로가기·전환) [x] c S03 결과 화면(①②④⑤⑥⑦⑨⑩) [x] d S01 시작·이어하기 [x] e E2E 녹색(e2e/m4 4/4, AD-035)
  - [x] 08 E2E(375·1280)·MBTI grep(e2e/m4 4/4)
  - [~] 09 eval:golden:build-answers·골든 자체 잠금: [x] buildGoldenAnswers·replayGolden·CLI(엔진 beta 덮어쓰기, 계획 L1 픽스처 32/32·M1a 24/24·β8.5 9/24) [ ] 실데이터 실행(BLK-022로 0/32) [ ] m4-done에서 data/golden 자체 잠금
  - [ ] 10 verify:m4 → m4-done: [x] 1차(592aa1f 워크트리, reports/verify-m4.json) fail — 비BLK 3건: AC-06-32 m0(verify 안에서만, 단독 통과·재발), AC-03-33(빈 폰트 캐시 + 동시 부하 180s), e2e/m4 quiz(빈 /tmp/tastefit-storage). [ ] 2차: survey:build·폰트 캐시 데운 뒤 조용한 상태에서 재실행
- M5 계획(9.4.7, AC: 00-14~17, 01-01·02·22~34·51·58, 04-01·02·14~16·22~25·37·38·44·46·47, 06-07b·09·10·13·15~18·20~23·38~40·45·47·52·55·56·59~63, 07-02·13, 08-24~26·38~42, 09-07·13·18. 읽을 장은 CLAUDE.md 구현 규칙 3절):
  - [x] 01 M5 수용 테스트(tests/acceptance/m5, AD-031): [x] a 인증·귀속(AuthPort local·매직링크·dev_mail_outbox·attach_anon, auth.test WIP, ASM-103) [x] b 브랜드 입력·BrandInput 검증·인젝션 방어(brief.test WIP, fixtures/brands 3파일, ASM-105) [x] c 생성 API·Idempotency·진행 잡 1개·폴링(generation-api.test 9/9, ASM-108) [x] d llm gateway·models.yaml·MockProvider 시나리오(llm.test WIP 20건, ASM-107) [x] e pipeline 3변형→후보 6→검증·수리→렌더→게이트→점수→노출·재생성·폴백(pipeline.test WIP 14건, ASM-109. 시간·비용 시나리오는 f) [x] f 비용·quota_ledger·킬 스위치·초대·환불(quota.test 12/12, ASM-110. 비용 시나리오 AC-06-21·61·07b는 워커 예산 배선 후 pipeline 테스트에 추가) [x] g S04~S08 화면 E2E(e2e/m5/flow.spec: /g 도달까지 통과, 카드 3은 BLK-008) [ ] h traceability M5·qa:trace --audit·단일 test(acc)·자체 잠금: [x] h1 시나리오·비용·시간(scenarios.test, 10 AC, ASM-114) [x] h2 화면 E2E(screens.spec 9 + flow, ui.test 브리지·문구 대조, ASM-115) [x] h3 나머지(golden·fallback·abuse·access·deck, ASM-116~120) [x] h4 audit 리터럴 0·test(acc) 5a742c9·자체 잠금 18파일
  - [x] 02 AuthPort local·세션 쿠키·매직링크·attach_anon·/api/me·/api/consents(auth.test 7/7, ASM-104. MeView quota 등은 07·08)
  - [~] 03 동의(S05)·초대 코드: [x] API(consents·invites/redeem·inviteOk) [ ] S05 화면(09)
  - [x] 04 BrandInput zod·정규화·maskPII·judgeBrief(편집 거리 (c))·brief-drafts POST/GET(brief.test 8/8, ASM-106). 레퍼런스명 attestation(⑥)은 projects(08)
  - [~] 05 packages/llm: [x] models.yaml(temp)·승인 검사·llm:check·시나리오 파서·MockProvider(ok·장애·usage)·CopyDeck(llm.test 19/20, BLK-027) [x] callLlm 재시도(429 Retry-After·5xx backoff·연속 2회 → 폴백 모델, models.yaml retry) [ ] 효과표·mixed 2·4·low_score 트리·수리 규칙 [ ] 프롬프트 프런트매터·prompts.lock
  - [~] 06 pipeline: [x] a apps/worker/src/jobs/generation.ts S1~S9 1차(카피 폴백 체인·레이아웃 6·스키마 수리·평가·비전 기록·선택·폴백·R-15·예외 격리. axe 스텁 로컬 확인: ok·copy_schema_fail·copy_refusal·invalid_json@0·schema_violation@2·injection_echo·lint_error 기대대로) [~] b [x] 다양성 조건·재호출(packages/pipeline)·Mock 다양화·수리 규칙 [x] 수정 루프(≤3)·S3 덱 범위(→ repair_schema) [ ] 효과표(mock:effects)·mixed 2·4·low_score 트리·카피 패치(gen_copy repair_quality) [ ] c SLO 타이머 120/180s·예산 예약(6.9.4)·pg-boss 소비자
  - [~] 07 worker: [x] a quota_ledger reserve/refund·finishGenerationJob·applyKillSwitch·취소 API·JobBudget(packages/pipeline) [x] b JobBudget·finish 배선(budget_skipped·COST_CAP·A11, 스텁: ok 원가 0.23362 = C_base) [~] c [x] U-01 두 물결(카피 ∥ 후보 0 → t1 정산 → 1~5 예약, usage_overrun 거부 집합 = 6.9.4 ⑦ 표) [x] SLO 120s abort·호출 타임아웃 [ ] 180s 강제 종료·취소 신호 abort·GEN_MAX_CONCURRENT_JOBS
  - [~] 08 생성 API·폴링·이벤트: [x] a projects·generations·GET 폴링·ETag·멱등·attestation·retention brief_drafts [~] b [x] MockupCard 채우기 [ ] cancel·generate_request 이벤트·GET /api/projects(:id)
  - [~] 09 화면: [x] S04·S05·S06·S07·S08 1차(서버 액션·검증 공유·자동 제출·폴링·취소 시트·카드), next build 통과 [ ] 점진 노출(변형 확정 즉시 mockups)·미리보기 URL·S08 선택(M6 연결)·Google 버튼(supabase needs_ci)
  - [ ] 10 verify:m5 → m5-done
- M3 이월: (B18 재생성은 M2-09d3으로 당김), B15 골격을 실제 예시로 교체 후 자체 잠금(ASM-021)
- [x] M0 [x] M1 [x] M2 [x] M3 [ ] M4 [ ] M5 [ ] M6 [ ] M7 [ ] M8

## P5. 완료
- [ ] release:check 요약

## 로그
- 2026-11-27 13:12 | M5-05 callLlm 재시도·폴백 모델 전환(스텁: rate_limit 2회·server_error 4회/후보, ok 13호출 유지)
- 2026-11-27 13:10 | M5-07c U-01 두 물결·SLO abort(axe 스텁 로컬 확인: ok 13호출 succeeded, usage_overrun 0.53933 succeeded·A11). 남은: low-score-trees·재시도·폴백 모델
- 2026-11-27 12:55 | 미리보기 /healthz, industryTags·maxCharsJob(design-spec)·워커 배선. 앞 로그·ASM 시각 오기 정정(실제 커밋 시각)
- 2026-11-27 12:50 | M5-01 완료: test(acc) 5a742c9, 자체 잠금 18파일(tests/acceptance/m5·e2e/m5·_support/pipe.ts). ≤M5 매핑 누락 0
- 2026-11-27 12:49 | e2e/m5 구조 수정: 시나리오 env·준비/확인 분리(30s 러너 기본 유지, ASM-121). scenarios.test 실행 단계 분리
- 2026-11-27 12:39 | M5-01h3 deck.test·golden 보강(AC-04-44·46, ASM-120). qa:trace ≤M5 매핑 누락 0, audit 리터럴 0
- 2026-11-27 12:32 | M5-01h3 access.test(AC-06-59 ①~⑦, 5/7 녹색, ⑥ healthz 미구현, ASM-119)
- 2026-11-27 12:30 | M5-01h3 fallback.test(AC-04-25)·abuse.test(AC-08-41b·41d, ASM-117·118). 남은 매핑 04-44·04-46·06-59
- 2026-11-27 12:26 | M5-01h3a golden.test(32×3 Mock, AC-01-30·32·04-16·24·08-25, ASM-116)·AC-01-28 manual
- 2026-11-27 12:23 | M5-01h2 화면 E2E(screens.spec·ui 브리지, 11 AC)·ko.ts 누락 키 4. audit 리터럴 0
- 2026-11-27 12:17 | M5-01h1 scenarios.test(9.6.2 전 시나리오·비용·시간 10 AC)·pipe 헬퍼. 현재 BLK-008로 잡 failed
- 2026-11-27 12:08 | 잠금 회수(이전 23:52Z, 3h+). 새 컨테이너 복원(unshallow·태그·install·PG·seed·survey:build)
- 2026-11-27 08:52 | M5-01g e2e/m5 흐름(로그인·동의·자동 제출·/g 통과, 카드는 BLK-008). mail 템플릿 경로 수정
- 2026-11-27 08:50 | verify:m4 1차 fail: 비BLK 3건 모두 환경(간헐 env·폰트 캐시·빈 저장소). M5-09 화면 S04~S08 1차·next build 통과
- 2026-11-27 08:39 | M5-07b 워커 예산 예약·정산(ok 원가 = C_base), A11은 alerts 테이블 부재로 warnings(ASM-111)
- 2026-11-27 08:35 | M5-07a 한도·취소·킬 스위치·예산·레이트리밋·초대(quota.test 12/12)
- 2026-11-27 08:27 | M5-06b 다양성·수정 루프(스텁: ok 13호출 유지, mixed 후보1 diversity·후보3 repair_schema). AC-06-32 verify 안에서 재발(단독 통과)
- 2026-11-27 08:15 | M5-06a 파이프라인 1차(잡 ~12s). 실제 실행은 BLK-008(G-08 axe)로 전부 failed — 스텁으로만 확인
- 2026-11-27 08:04 | M5-01e pipeline.test WIP(14건). 주의: BLK-008(axe 없음) 때문에 G-08 실패 → 노출 0 예상
- 2026-11-27 07:59 | M5-08a 프로젝트·생성 API(generation-api.test 9/9). verify:m4는 /home/claude/tf-verify-m4 워크트리(592aa1f)에서 실행
- 2026-11-27 07:51 | M5-05 MockProvider·models.yaml·CopyDeck(llm.test 19/20, AC-08-39 = BLK-027 사람)
- 2026-11-27 07:43 | M5-01d llm.test WIP(시나리오 파서·models.yaml·Mock 역할·장애). 타임스탬프 오기 정정
- 2026-11-27 07:32 | M5-04 brief-drafts·정규화·마스킹·고위험 판정(brief.test 8/8, AC-08-41)
- 2026-11-27 07:25 | M5-01b brief.test WIP·fixtures/brands. verify:m4 백그라운드 진행 중
- 2026-11-27 07:16 | M5-02 AuthPort local·mail local·콜백·me·consents(auth.test 7/7). BLK-026 재현
