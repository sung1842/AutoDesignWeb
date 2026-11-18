# 통합 결정 v3 (2라운드 장 간 충돌 해소) — decisions_v2.md·decisions.md보다 우선

2라운드 리뷰(Blocker 3, Major 37)를 장별로 반영하기 전에 결정을 고정한다. 각 장 편집자는 아래와 다른 부분을 모두 고치고, 대체된 결정과 R-xx에는 "→ S-xx로 대체"를 적는다.

- **읽는 법**: "채택: X 보완안"이라고 쓴 곳은 해당 리뷰 파일의 보완안과 수용 기준을 원문 그대로 반영한다는 뜻이다. 표에 따로 적은 값·키·경로가 리뷰 원문과 다르면 표가 이긴다.
- **완화 금지**: 숫자 합격선은 하나도 낮추지 않았다. 판정 정의가 바뀌는 곳은 S-07, S-08, S-13, S-38 네 곳뿐이다. 모두 통계적 정합이나 원천 정의 때문에 바꿨고, 그 근거를 각 행에 적었다.
- **실행 환경(2026-11-18 실측)**: Docker 데몬 없음, chromium-1243만 있음(webkit·firefox 없음), PG16에 pgvector 없음, npm 접근 가능.

| ID | 결정 | 고칠 장 |
|---|---|---|
| S-01 | **스택 프로파일**(TL2-01). 채택: TL2-01 보완안. 원천은 06 6.13.1 신설 "스택 프로파일" 절이다. `STACK_PROFILE=supabase\|native`이고, `docker info`가 성공하면 supabase를 고른다(env로 강제 가능). **native**: ① 시스템 PG16(포트 54322) + `packages/db/shim/0000_supabase_shim.sql`(역할 3개, `auth.users`, `auth.identities`, `auth.uid()/role()/jwt()`, supabase 프로파일에서는 건너뜀). ② AC-06-01은 "빈 DB 2회 적용 + `ON_ERROR_STOP`". ③ `StoragePort` 드라이버 `supabase\|fs`. ④ `AuthPort` 드라이버 `supabase\|local`. local은 `dev_mail_outbox`에 매직링크를 기록하고, HS256 JWT(`sub`·`aal`)와 otplib TOTP로 `aal2`를 낸다. E2E는 픽스처 함수로 outbox를 읽으므로 HTTP 우회 라우트는 0개이고 R-10이 유지된다. ⑤ `MailPort`·`TurnstilePort`에도 local 드라이버를 둔다. ⑥ `APP_ENV≠local`에서 local/fs 드라이버가 설정되면 기동을 거부한다. ⑦ 오리진은 `http://localhost:3000`과 `PREVIEW_ORIGIN=http://127.0.0.1:3001`(다른 site)이다. local에서는 HSTS·upgrade-insecure-requests를 끄고, CSP 기대값은 env별 2벌을 둔다. ⑧ worker는 `node apps/worker`로 돌린다. **CI 위임**: 같은 verify를 GitHub Actions에서 `STACK_PROFILE=supabase`로 돌리고 결과는 `gh run watch`로 확인한다. 이 대체가 적용된 `env` 사유는 BLOCKED·HALT 계산에서 뺀다. | 06, 09, 07 |
| S-02 | **렌더 환경·브라우저**(TL2-02). 채택: TL2-02 보완안. ① 시각 회귀 기준선은 `e2e/__screenshots__/<RENDER_ENV_ID>/`에 단독 커밋으로 1회 만들고 자체 잠근다. `RENDER_ENV_ID`는 chromium 리비전·폰트·OS의 해시 12자다. `maxDiffPixelRatio ≤ 0.01`은 유지한다. ② `scripts/env/check-browsers.ts`가 설치 리비전(현재 1243)과 짝이 맞는 `@playwright/test` 정확 버전을 고정한다. 불일치하면 종료 코드 1이다. 고른 버전은 DECISIONS_LOG에 적는다. AC-06-34는 "패키지 버전 → 이미지 태그" 방향으로 검사한다. ③ chromium은 로컬 pass가 필수다. webkit·firefox는 needs_ci로 두고, R-33 지원 범위는 바꾸지 않는다. ④ verify:m8 네트워크 격리는 디스패처 차단, route 차단, 가짜 프록시로 하고, docker 네트워크는 CI 전용이다. ⑤ M6 ④는 `pnpm install --offline`으로 한다. ⑥ B6 temp는 `fc-match` Noto CJK를 쓰고, 없으면 `@fontsource`(OFL)를 쓴다. | 07, 09, 06 |
| S-03 | **보류 상태**(QA2-02). 상태 enum은 `pass\|fail\|temp\|manual\|needs_live\|needs_ci` 하나로 07 7.1.5·7.11.2·09 9.9.1에 같게 쓴다. 종료 코드는 0 = 전부 pass, 2 = fail 0이고 보류가 모두 허용표 안, 1 = 그 밖이다. 허용표는 `config/test-policy.json`의 `deferrable`이고 원천은 07장, 잠금 대상이다. **temp**(해당 묶음 provenance=temp일 때): `font-budget`, `asset-license-verify`, `normalizer-human`, `extractor-human-label`, `fewshot-count`, `high-risk-domains`, `legal-text`. **needs_live**(LLM_MODE≠live): `golden-live`, `judge-vision-live`, `model-promotion`. **manual**: `blind-*`, `usability-*`, `k6-staging`, `processor-approval`. **needs_ci**: `lock-digest`, `supabase-db-lint`, `supabase-storage-policy`, `gotrue-magiclink-e2e`, `gotrue-mfa`, `gotrue-google-metadata`, `worker-image-build`, `visual-docker-baseline`, `browser-webkit`, `browser-firefox`, `net-isolation-docker`. 표에 없는 단계가 보류 상태를 반환하거나 조건이 맞지 않으면 fail이다. 07 7.5.1 진단 API 부하는 로컬 스택에서 10 VU × 5분으로 재고 `perf.surveyApiP95Ms`로 판정한다(k6, 없으면 같은 프로파일의 autocannon). | 07, 09 |
| S-04 | **사람 없는 기준 고정점**(QA2-03, QA2-07 함께). 채택: QA2-03 보완안. `pnpm spec:extract`는 07 7.12.1 JSON 블록과 보류 허용표에서 `config/thresholds.json`·`test-policy.json`을 만든다. guard는 `git diff --exit-code`로 둘이 같은지 확인한다. 잠금 기준 ref는 `human-lock ?? spec-lock`이고, `spec-lock`은 P3 종료 커밋에 에이전트가 붙인다. 둘 다 없으면 FAIL이다. `QA_LOCK_DIGEST`가 없으면 needs_ci이고 종료 코드 0은 불가다. `qa:trace --audit`는 AC 수치 리터럴을 FAIL로 처리한다. 예외 리터럴은 {0, 1, 0.5, 100}뿐이고 `config/forbidden-allowlist.json`에만 둔다. | 07, 09 |
| S-05 | **thresholds 키 구조**(QA2-01). 원천은 07 7.12.1의 완전한 JSON 블록 1개다. 최상위는 `diagnosis`(02 값), `generation`(04), `perf`(SLO·a11y), `release`(출시 전용)뿐이고 키는 camelCase다. 평면 키와 snake_case는 폐지한다. 한 의미는 키 하나에만 둔다. `release.golden`의 `harmonyFloor`·`tasteFloor`·`sFreeFloor`·`costMaxUsd`는 `generation`으로, `firstExposeP50Sec`·`latencyP50Sec`·`latencyP95Sec`는 `perf`로 옮긴다. `release.perf`·`release.a11y`는 최상위 `perf`·`perf.a11y`로 옮긴다. 신규 키: `generation.costGuard{skipVisionUsd 0.24, skipRepairUsd 0.27, capUsd 0.30}`(S-13), `diagnosis.surveyAssetL1AbsMax 0.15`(S-06), `release.surveySim`의 `anchorAccPABeta8Min 0.95`·`priorTypeChangeMax 0.06`·`robustNoneRmseMax 0.13`·`seeds`·`maxTuningTrials 15`·`maxGateRuns 3`(S-08), `release.golden.m1`(S-07), `release.blind.strongBaseline*`(S-36). 다른 장은 키 경로만 참조한다(04 AC-04-43, 02 D-0214, 09 9.5.6·M3·M4). zod strict 검사(`scripts/guard/thresholds-schema.ts`)는 모르는 키나 빠진 키가 있으면 FAIL이다. | 07, 02, 04, 06, 09 |
| S-06 | **09장은 수치를 소유하지 않는다**(QA2-04, QA2-08 일부). 채택: QA2-04 보완안 a~f. a) M3 ③은 `release.extractor.roundtripAbsMax` 0.10(모든 프리셋·축)을 쓴다. 0.15는 `diagnosis.surveyAssetL1AbsMax`(D-0904)에만 쓴다. 05 5.9 왕복도 0.10이다. b) 폴백은 04 AC-04-25의 72조합이고 G-01~G-13 + H ≥ 80으로 판정하며 TM·S_free는 면제한다. c) 골든은 07 7.2.2·7.2.3의 32케이스가 원천이다. B16 스키마를 지우고 temp는 07 구성표를 JSON화한다(답안은 S-07, 01 BrandInput 검증 100%). M7 ⑥은 32다. d·e) 9.6.2 "기대 결과" 열을 지우고 07 TC-R을 참조한다(`low_score@*` 전 후보 = fallback, 환불). f) 골든 리포트 경로는 `eval/reports/<reportId>.json` 하나다. g) M3 ⑤는 04 4.15.2 p95 ≤ 15s를 쓴다. M4 ①은 "≥19쌍"으로 적는다. | 09, 07, 04 |
| S-07 | **골든 M1 재정의**(AI2-03, QA2-05와의 충돌 해소). 채택: AI2-03 보완안. 근거: R-05는 RMSE ≤ 0.12를 허용한다. 정규 오차라면 이때 \|e\| ≤ 0.12 비율은 약 68%다. 95%를 요구하면 RMSE ≈ 0.06을 요구하는 셈이라 R-05와 모순된다(재현 76%). 정확도 차단 판정은 R-05 시뮬레이션 한 곳에만 두고, 골든은 회귀 검출을 맡는다. **M1a(차단)**: typeId 24/24, 그리고 \|μ − `expected.muRef`\| ≤ 0.02인 축 120/120. muRef는 빌드 시 재생값이고 소수 6자리다. **M1b(기록)**: \|μ − θ*\| ≤ 1.645·σ_display 비율이 0.85 미만이면 margin_warning을 남긴다. `muRange`는 폐지한다. **QA2-05의 seed 재시도는 채택하지 않는다**. 운 좋은 로그를 골라내 골든을 오염시키기 때문이다. `build-answers`는 seed = 케이스 번호로 고정하고 typeId만 검사한다. 불일치하면 오프셋 축을 (A1,A2)에서 (A3,A4)로 바꾸는 결정론 규칙을 1회 적용한다. 그래도 불일치하면 빌드 실패이고 BLOCKED다. `engine_version` major가 바뀌면 02 2.15 재생으로 muRef를 갱신하고 사람 승인을 받는다(manual). 변이 테스트: β 8.0 → 8.5에서 M1a가 FAIL해야 한다. | 07, 02, 09 |
| S-08 | **진단 시뮬레이션 판정**(AI2-02). 합격선 숫자는 그대로다. 근거: 시드 간 SD(약 0.002)가 여유(0.001)보다 크다. 또 튜닝과 판정을 같은 표본으로 하면 선택 편향이 생긴다. 아래 변경은 분산과 편향만 줄이므로 판정이 더 엄격해진다. ① 판정은 `gate=[20261117..20261121]` × 1,000명 풀링 점추정으로 한다. 튜닝은 `dev=[20261116, 20261122, 20261123]`로만 한다. 두 집합은 교집합 0이고 잠금 대상이다. ② 적응형 이득은 공통 난수 쌍체로 계산하고 부트스트랩 95% 구간을 리포트에 넣는다. ③ 점추정이 합격선을 충족하면 PASS다. 구간이 합격선에 걸치면 margin_warning(비차단)이다. P-A는 n=800이다. ④ 조정 공간은 AI2-02 보완안 4의 값 집합으로 닫는다. 좌표 순차 탐색으로 dev 시도 ≤ 15회, gate 실행 ≤ 3회다. 상한에 닿으면 HUMAN_TODO에 BLK를 등록하고 G2-진단은 fail로 둔 채 M5 이후를 계속한다(HALT 계산 제외). 시드와 합격선 변경은 F 목록에 넣는다. ⑤ 2.16.2의 모든 행이 `release.surveySim` 키에 연결되는지 `qa:trace`가 검사한다. | 02, 07, 09 |
| S-09 | **AI 기준 자산 temp**(AI2-01). 채택: AI2-01 보완안. 번호는 S-41을 따른다. **B18** `data/normalizers/2026-S0.json`: 프리셋 8 × `allowed` 변형 25(seed 20261116) = 200 렌더로 만든다. 앵커 8, 카드 48, A/B 120은 홀드아웃으로 코퍼스에서 뺀다. 가중치는 `mapping.initial`이고 b0·b1만 최소제곱으로 맞춘다. `provenance:'temp'`, `inter_rater:'unverified'`. **B19** few-shot은 human 전용이다. 0개이면 `[FEWSHOT]` 블록을 빼고 `fewshot-count=temp`로 둔다. **B20** `config/copy_templates.json`·`axis_hints.json`은 `[임시]` 문장(4.6.2 길이 하한 충족)으로 채운다. 05 5.9 temp 분기: 실패 축은 `reliable[k]=false`, 카드·쌍은 draft, TM 가중은 0(D-056)이다. 홀드아웃 실패를 이유로 b0·b1을 재적합하는 것은 금지한다(F). 정규화기 변경은 `seed:temp` 산출 커밋만 허용한다(guard). 04 4.3 "toL1과 동일 계수"는 "predictL1 = 의도값, toL1 = 측정값, 차이는 05 5.9"로 고친다. | 09, 05, 04 |
| S-10 | **법무 경로와 temp 확인 기록**(LG2-07, 08/09 경로 충돌). 08장이 이긴다. 원문은 `legal/{terms,privacy,sources}.md` 3개다. AI 고지·비제휴 문구는 `copy/ko.ts`가 소유한다. 09 B17을 이에 맞추고 `data/legal/` 표기는 0건이어야 한다. 묶음 B21(high_risk_brands, temp ≥ 80개, `domains:[]`), B22(prohibited_categories), B23(`legal/processors.yaml`·`data-flows.yaml`, temp는 `approved:false`, mock에서는 승인 검사 생략)을 둔다. 자산 temp는 `verified_by:'temp-agent'`, `verified_at:null`을 허용한다. 대신 temp가 1건이라도 있으면 `asset-license-verify=temp`이고 종료 코드 0은 나올 수 없다. LG2-07의 "실패"는 "출시 불가(≠0)"로 읽는다. 이렇게 해야 S-03의 종료 코드 2와 AC-09-01이 함께 성립한다. `verified_by≠temp-agent`인데 `verified_at=null`이면 fail이다. AC-08-23은 "release 모드에서 전 항목 사람 확인"으로 고친다. Noto CJK는 temp 레지스트리 항목으로 두고, `LicenseRef-TasteFit-Generated`를 enum에 추가한다. guard는 에이전트가 `verified_by`·`approved`·`tos_checked_at`·`robots_checked_at`·`provenance`를 temp에서 다른 값으로 바꾸면 FAIL이다. `seed:temp`는 HUMAN_TODO에 "법무 문안 확정"을 자동으로 추가한다. | 08, 09 |
| S-11 | **MockProvider 역할별**(AI2-05, QA2-08). 채택: AI2-05 보완안. 9.6.2를 R-12 역할 4개로 다시 쓴다. `gen_layout`은 덱 참조만 쓰고 텍스트 리터럴은 0이다. `judge_vision`은 JudgeResult 형식이다(고정 점수 0.70 폐지). mock은 이미지를 고르지 않는다. 시나리오 `mixed`(후보 0~5 할당은 원문)를 `eval:golden --mode mock` 기본으로 둔다. 시나리오 키는 `scenario@candidateIndex`와 `scenario@role`을 허용한다. M7 ⑥ 추가 조건: `repair_quality` ≥ 1, 다양성 재호출 ≥ 1, partial ≥ 1, 노출 전부 AC-04-20 충족. `page_generate`·`vision_score`·mock `requiredSections` 규칙·`prompts/{role}.v{N}.md`는 0건이어야 하고, 프롬프트 경로는 `<role>@v<N>.md`다. | 09, 04 |
| S-12 | **`gen_copy` 실패**(AI2-04). 채택: AI2-04 보완안. 순서는 repair_schema 1회 → 잡 경과 ≤ 60초일 때만 fallback 모델 1회 → `buildTemplateDeck`. 템플릿 덱을 쓰면 `generation_jobs.copy_source='template'`(enum `llm\|template`)이고, 상태는 R-15 값과 partial 중 낮은 쪽이며, 경고 `COPY_FALLBACK`를 남긴다. 공급자 안전 거부는 우회하지 않는다. failed + `BLOCKED_BRAND{reason:'content_policy'}`이고 환불한다. 시나리오 3종(`copy_*@gen_copy`)을 9.6.2에 넣고, 기대 결과는 07 TC-R에 적는다. | 04, 06, 07, 09, 01 |
| S-13 | **잡 예산 예약-정산**(TL2-03). 채택: TL2-03 보완안. 원천은 06 6.9.4이고 04 4.17.2는 참조만 한다. 판정식은 `spent + reserved + est ≤ generation.costGuard.capUsd`이고, 잡 단위 뮤텍스 아래 reserve/settle/release로 동작한다. `est`는 실측 입력×1.1 기준 식 하나다. `worstCost`는 폐지한다. 기본 경로 추정은 $0.33에서 약 $0.23이 된다. 추정 정확도를 고친 것이고 상한은 그대로다. DB CHECK는 `cost_usd ≤ 0.36`(cap × 1.2)으로 바꾼다. 이 CHECK는 실제 청구가 추정을 넘어도 잡이 죽지 않게 하는 저장 제약이다. 가드 상한 0.30과 "cost_spike 합계 ≤ 0.30" 수용 기준은 유지하고, 0.30 초과는 A11 경고로 잡는다. `pricing`에 `cache_write_per_mtok`를 추가한다. mock 단가는 USD/M 기준 입력 3, 출력 15, 캐시 읽기 0.30, 캐시 쓰기 3.75, 비전 1/5로 고정한다. | 06, 04, 09 |
| S-14 | **동시성·용량**(TL2-04, PM2-01과 정합, R-16 보완). `WORKER_GEN_CONCURRENCY`(기본 2)를 둔다. 실효 상한은 `min(GEN_MAX_CONCURRENT_JOBS=5, 머신 수 × 2)`다. MVP는 머신 1대이므로 실효 2이고, 초과분은 대기 순번으로 표시한다. 유료 머신은 추가하지 않는다. S-15 수요(월 ≤ 600잡, 일 약 20잡)에서 피크 2면 충분하다는 근거를 6.16에 적는다. 렌더 큐는 잡별 라운드로빈이다. 6.16 식은 `p95_est = t_llm_p95 + ceil(C×6/RENDER_MAX_CONTEXTS) × t_render_p95 + t_gate`이고, `pnpm bench:render` 결과(`reports/bench-render.json`)를 넣어 `release:check`가 `p95_est ≤ perf.latencyP95Sec`를 확인한다. | 06, 00, 01 |
| S-15 | **목표를 예산에 맞춘다**(PM2-01). 예산(월 150, 일 10 USD)은 유지한다. 유료 지출 증액은 사람 결정이다. 00 §9.4 검산 표: `WAM_max = (150/0.25)/4.35 × 0.6 × 0.4 ≈ 33`. 공개 출시 8주차 WAM ≥ 30, O2 8주 누적 채택 ≥ 150, Phase 2 진입 ① WAM ≥ 30. WAM 100은 "예산 상향 후" 목표로 옮긴다. "예상 월 생성"은 600이다. Phase 2 진입 ④는 "KS-1로 막힌 날 ≤ 3일/월 + GR-10 4주 평균 충족"으로 바꾼다. | 00 |
| S-16 | **취소 시 한도**(PM2-02). 채택: PM2-02 보완안. 취소 시점 비폴백 노출이 1 이상이면 차감하고 0이면 환불한다. queued와 running은 구분하지 않는다. 00 §9.3, 06 6.2.3, 04 4.12, 01 1.6.5를 같은 문장으로 고치고 통합 테스트 3건을 둔다. | 00, 06, 04, 01 |
| S-17 | **KPI 쿼리**(PM2-03). 채택: PM2-03 보완안. 퍼널 result에서 공유 열람을 뺀다. 베타 기간 F6·F7 분모는 `invite_redemptions` 주체로 한정한다. F4는 결과당 마지막 평가만 센다. F8은 7일 코호트로 센다. AC-00-13 픽스처 4종을 추가하고 모든 비율이 [0,1] 안인지 확인한다. | 00, 07 |
| S-18 | **검증 표본 운영**(PM2-04). 채택: PM2-04 보완안(00 §5.4 신설). 모집 글 1회를 허용하고 §7.2 문구는 "공개 SNS·광고 없음"으로 바꾼다. 재검사는 S03 안내 + S12 배너로 유도하고 이메일은 쓰지 않는다. A5는 인앱 1문항 시트로 받는다. 이벤트 `adoption_followup_answer`를 00 §8.3과 zod에 추가한다. 표본 미달이면 2주 연장을 최대 2회 하고, 그래도 미달이면 베타 2차로 간다. waiver 금지는 유지한다. 07 7.3.1 재검사는 "공개 출시 조건, 자동 게이트 아님"으로 적는다. | 00, 01, 07 |
| S-19 | **출시 단계·명칭·값**(PM2-05). 채택: PM2-05 보완안(원천 00장). 06~09장에서 `P0-α`·`P0-β`·`G0~G4`·`G0 ④⑤`·`공개 베타`를 0건으로 만든다. 07 7.9.1은 00 §5.3 참조 1줄로 줄인다. 07 7.3.1 완료율은 ≥ 65%다. 00 A3·Q2에 P-1b를 추가한다. 07 D-0716의 v1 값 인용은 삭제한다. `BETA_INVITE_ONLY` 설명은 "true(비공개 베타)"로 고친다. 비관리자의 관리자 경로 접근은 **404**로 통일하고 09 M7 ②도 고친다(AC-00-19 원천). | 07, 06, 08, 09, 00 |
| S-20 | **보관 파기**(TL2-05). 채택: TL2-05 보완안. 원천은 06 RetentionRule이다. `candidates_unexposed_30d`는 mockups가 참조하지 않는 후보만 지운다. `renders_orphan`은 참조 0일 때만 지운다. 규칙별 1,000행씩 별도 트랜잭션으로 돌리고, 실패 규칙 ID는 감사 로그에 남긴다. 08 표기는 "노출되지 않은 후보"와 `diagnosis_sessions`로 고친다. `verify:schema-parity`가 08 보관표 구현 기준 열 ⊆ 06 DDL을 검사한다. | 06, 08 |
| S-21 | **탈퇴 절차**(LG2-04). 채택: LG2-04 보완안. 06 6.2.5 `account-delete`는 원문의 ①~⑦ 멱등 단계로 돌고 재시도는 5회다. `consents_archive.user_hash = HMAC-SHA256(user_id, CONSENT_HASH_KEY)`이고 키는 교체하지 않는다. `sanctions(email_hash, level, until, reason_code)`를 두고, 재가입 시 생성 API는 403 `ACCOUNT_SUSPENDED`다. `admin_audit_logs.admin_id` FK는 `admin_hash text`로 바꾼다. 08 8.7.7에 `consents_archive`(1년)와 `sanctions`(until까지, 최대 1년)를 넣고 처리방침 4절에도 적는다. | 06, 08 |
| S-22 | **pgvector 제거**(TL2-07). 06 DDL에서 `vector` 확장과 `embedding`·`embedding_model` 컬럼을 삭제한다. 05 D-055에 "Phase 2 additive 마이그레이션"이라고 적는다. | 06, 05 |
| S-23 | **세션 운영 ↔ 구현 운영 매핑**(TL2-06). 채택: TL2-06 보완안(09 9.5.7 신설). 제품 공백은 `docs/ASSUMPTIONS.md`, 운영·환경 결정(S-01·S-02 적용 포함)은 `docs/spec/DECISIONS_LOG.md`에 쓰고 서로 가리키는 1줄을 둔다. BLOCKED.md가 원본이고 사람이 할 일만 HUMAN_TODO로 복사한다. PROGRESS.md는 P1~P5를 유지하고 P4 안에 9.7 형식을 넣는다(`lock`·`limit` 유지). CLAUDE.md는 "세션 운영"과 "구현 규칙" 두 절이고, 300줄 제한은 "구현 규칙" 절에만 적용한다. verify는 `.partial.json`을 남기고 재시작하면 처음부터 돈다. 3회 연속 녹색은 같은 `gitSha`면 세션이 달라도 인정한다. 90분은 PROGRESS 로그의 누적 시간으로 잰다. | 09 |
| S-24 | **악용 방지 적용 지점·금지 업종**(LG2-01, AI2-04 enum 통합). 채택: LG2-01 보완안. 판정 함수는 `packages/compliance/abuse.ts` 하나다. 08 8.9.2 "입력별 적용 단계 표"가 원천이고 06 6.11.2는 이를 참조한다. 신고·문의 본문은 판정하지 않는다. 하드 게이트 `G-13 abuse_terms`를 두고 R-13 게이트 범위는 G-01~G-13이다. 편집 저장 실패는 422 `EDIT_GATE_FAILED` + `GATE_FAILED:G-13`이다. 금지 범주는 `gambling\|adult\|illegal_loan\|drugs\|weapons\|counterfeit`이고 범주당 ≥ 10 키워드(B22)다. **`BLOCKED_BRAND.reason` = `high_risk\|phishing_term\|prohibited_category\|content_policy`**이고 원천은 06 오류 표다. 01 1.12에 2행을 추가한다. AC-08-41b/c/d를 둔다. | 08, 06, 04, 01 |
| S-25 | **OAuth 메타데이터 삭제**(LG2-02). 채택: LG2-02 보완안. `auth.users`·`auth.identities` INSERT/UPDATE 트리거가 키 집합을 {`email`, `email_verified`, `provider_id`, `sub`, `iss`}로 줄인다. native는 shim에 공급자 형태 행을 직접 넣어 시험하고, 실제 Google 흐름은 `gotrue-google-metadata` needs_ci다. 키 덤프는 `docs/compliance/auth-metadata.md`에 둔다. | 06, 08 |
| S-26 | **데이터 흐름·국외 이전**(LG2-03). 채택: LG2-03 보완안. 06 "구성요소 × P1~P13 흐름표"가 원천이고 `legal/data-flows.yaml`이 그 코드다. `processors.yaml.items`는 여기서 파생하고 CI `compliance:flows`가 검사한다. 최소 기대값: `flyio ⊇ {P2,P4,P5,P6}`, `vercel ⊇ {P1,P2,P3,P4,P8,P9,P11,P13}`, `llm-judge ⊇ {P5}`. 국외 판단은 사람 확인 전까지 보수적으로 표에 넣는다. | 06, 08 |
| S-27 | **익명 창구 방어**(LG2-05). 채택: LG2-05 보완안. 세 창구 모두 Turnstile이 필수다. `rep:day:ip:<hmac>` 10회/일을 06 D-0618 표에 추가한다. 확인 메일은 고정 템플릿이고 수신자당 하루 1통이다. `privacy_request`는 계정 이메일 확인 링크(1회, 24시간) 클릭 후에만 처리한다. 자동 비공개 시 소유자에게 통지하고, `ip_hmac`이 7일에 dismissed 3건을 넘기면 자동 비공개를 하지 않는다. | 08, 06, 01 |
| S-28 | **관리자 접근 통제**(LG2-06, S-19와 정합). 채택: LG2-06 보완안. 관리자 경로는 `aal2`만 허용하고, `aal1`이면 API 404·화면 `/admin/mfa`다. `ADMIN_EMAILS`는 매 요청 재확인한다. PII 열람은 `pii_view` 감사 행을 남긴다. `before/after`는 리댁션한다. 접속기록은 기본 1년 보관 + 월 1회 점검이다(09 운영 체크리스트). 콘솔 MFA는 08 8.15 수동 항목이다. native는 local TOTP로 시험하고 Supabase MFA는 needs_ci다. | 06, 08, 09, 00 |
| S-29 | **결과 화면 안내**(UX2-01, UX2-04 일부). 채택: UX2-01 보완안. 문구는 01 1.15.3(`copy/ko.ts`)이, 조건·우선순위는 02장이 소유한다. 순서 `low_signal → conflict → κ<0.50 → is_boundary` 중 하나만 표시하고 신뢰도 1줄을 붙인다. 백분율은 0건이다. 키 7개는 원문대로다(`result.notice.*` 5, `result.axis.*` 2). open 판정은 서버 `axes[].state`(σ > 0.08, `diagnosis` 키)만 쓰고, 01장의 0.10은 삭제한다. 1.15.3 머리에 "카피 표가 본문을 이긴다"를 적는다. | 01, 02, 06 |
| S-30 | **자극물 표시 크기**(UX2-02). 채택: UX2-02 보완안. mobile은 `card_h = 100dvh − 232`, 하단 고정 바 120, 카드 안 스크롤 0, `card_h < 300`이면 회전 안내다. desktop은 `w_min = 480px`이고, 미달이면 2×2 세로 스크롤로 보여 준다. 응답에 `ux.cardScale`을 기록한다. mobile 자산이 없는 문항은 mobile 후보에서 뺀다. | 01, 02, 06 |
| S-31 | **편집 허용 = 기기, 배치 = 뷰포트**(UX2-03). 채택: UX2-03 보완안. 편집 허용은 `(pointer: fine) \|\| screen.width ≥ 768`이다. 허용 상태에서 뷰포트 < 768이면 1열 탭 레이아웃이다. 01 1.3.1·1.8.7·1.9·D-0112와 00 §7.1을 고친다. | 01, 00 |
| S-32 | **변형 차이·보정 사유**(PD2-01). 채택: PD2-01 보완안. `MockupCard.movedAxes`(최대 2)와 `diffFromTrue`(v_true는 [])는 결정론으로 만든다. 카피 키는 `calib.purpose`·`calib.type`·`calib.distance`와 L2 쉬운 말 사전이다. v_true 문구는 "진단한 취향에 가장 가깝게 만들었어요"로 바꾸고 칩이 붙을 수 있음을 명시한다. "원래대로 보기"는 [P2]이고 00 §7.1에 넣는다. | 06, 01, 04, 00 |
| S-33 | **프리셋 ↔ 린터**(PD2-02). 채택: PD2-02 보완안. `Preset.allowSoftRoundShadow`(T3·T4·T6 = true)를 두고 04 AIL-06 이름을 맞춘다. 카드 그림자 단계 = `depth.shadow_level`, 강조 +1(최대 2)이다. FP15 heading 한글은 Wanted Sans 800이다. CI `presets:lint-matrix` 실패 조합은 `harmony.json.conflicts` CF-13부터 등록해 자동으로 제외한다. 클라이언트 즉시 검사에 AIL-03·06·09·16을 추가한다. | 03, 04 |
| S-34 | **사진 톤·업종**(PD2-03). 채택: PD2-03 보완안. 4.9.4 `tonePref`는 warm(temperature ≥ 0.60) / cool(≤ 0.40) / neutral이고 반대 톤은 제외한다. `config/image_tag_keywords.json`(B24)은 약 50항목이고 temp를 허용한다. 매칭 0이면 사진을 대체한다. 01 안내 키는 `drafts.photoSubstituted`다. portfolio `work`·`showcase` 이미지는 `placeholder:true`다. 03 D-0309는 "반영"으로 바꾼다. | 04, 03, 01 |
| S-35 | **styleguide**(PD2-04). 채택: PD2-04 보완안. 04 4.16.1 공통 파일에 `styleguide.html`을 추가한다. LLM은 쓰지 않고 `ResultView.guide`와 같은 함수를 쓴다. 검사 번호는 **E-14**다(대비값 = G-02 계산값 소수 1자리). 03 3.18과 파일 목록을 같게 둔다. | 04, 03 |
| S-36 | **차별점 비교군**(PD2-05). 채택: PD2-05 보완안. 모두 기록 전용이고 출시 합격선은 바꾸지 않는다. P-2s(`eval/blind/baseline_strong_prompt.md`, 선호 ≥ 0.60·Wilson LB ≥ 0.45, 미달이면 DF-2 붕괴 신호), P-4b(≤ 0.55면 "개인 오프셋 효용 미확인"), P-1a 층화 8/6/6. 00 §5.1에 A2s·A1c를 둔다. | 07, 00 |
| S-37 | **밝은 브랜드 컬러**(UI2-01). 채택: UI2-01 보완안. 사전 가능성 판정 후 primary → accent → tint → ignored 순서로 반드시 종료한다(반복 ≤ 74). `brand_color_notice = null\|adjusted\|demoted_to_accent\|used_as_tint\|ignored`이고 01 카피·06 MockupCard·04 DesignSpec에 같게 쓴다. AC-03-36 픽스처 4색을 추가하고 1회 ≤ 5ms다. | 03, 04, 01, 06 |
| S-38 | **텍스트 역할·H7**(UI2-02). 채택: UI2-02 보완안. `data/taxonomy/text-roles.json`(B25, 03 3.1.5a)을 두고 템플릿은 `data-role`만 쓴다. 단계 이름은 `t-display`, `t-1`… 로 시맨틱 태그와 분리한다. **H7 = display 토큰 계산값 / base(1280)**, 즉 03장 정의로 통일한다. 원천이 `harmony.json`(D-0310)이므로 04 표는 생성본으로 둔다. 범위 2.5~8.0은 그대로다. 04장 h1 정의는 원천과 다른 사본의 오류였다. | 03, 04 |
| S-39 | **헤드라인 줄 예산**(UI2-03). 채택: UI2-03 보완안. `headlineBudget` 식과 계수 0.95·0.85를 쓴다. `blocks.json`에 `text_cols`를 넣는다. 덱 3옵션 중 ≥ 1개는 `maxChars` 이하여야 하고 G-01이 검사한다. 넘침은 교체 → 1단 하향(`spec.render_adjustments[]`) → warn 순서다. AC-03-26은 "③ 0건(골든)"으로 고치고 하향 비율 ≤ 25%를 기록한다. | 03, 04 |
| S-40 | **맥락별 폰트 서브셋**(UI2-04). 채택: UI2-04 보완안. 원천은 03 3.7.5 표다. 편집기와 후보 카드는 `ks-x-1001` 정적 + `page` 보충(디바운스 1초)이다. 내보내기는 `page` + `fonts/extended/` ks-x-1001이다. enum은 `full\|ks-x-1001\|latin\|page`이고 03·09에 같게 쓴다. 측정 iframe은 `document.fonts.ready` 후에 잰다. 반영 p95에서 첫 폰트 로드는 제외한다. 내보낸 코드의 폴백 0 검사는 **E-15**다. | 03, 01, 06, 09, 04 |
| S-41 | **번호·enum 배정**(리뷰 간 번호 충돌 해소). 09 묶음 번호: B18 정규화기, B19 few-shot, B20 copy_templates·axis_hints, B21 high_risk_brands, B22 prohibited_categories, B23 processors·data-flows, B24 image_tag_keywords, B25 text-roles. AI2-01·LG2-07이 각각 제안한 B18·B19는 이 번호로 대체한다. E-14 styleguide, E-15 확장 폰트, G-13 abuse_terms. 코드: `COPY_FALLBACK`(경고), reason 4값(S-24). 신규 테이블·컬럼: `consents_archive`, `sanctions`, `dev_mail_outbox`(local 전용 마이그레이션, prod 세트 제외), `generation_jobs.copy_source`, `admin_audit_logs.admin_hash`. 신규 이벤트: `adoption_followup_answer`. | 09, 04, 06, 00 |

## 반영 순서

한 단위는 30~45분이다. 원천 장부터 고친다.

1. **07-a**: S-05 thresholds 블록, S-04 spec:extract·spec-lock
2. **07-b**: S-03 허용표·enum·부하, S-07 골든 M1, S-06 f
3. **07-c**: S-19 명칭, S-11·S-12 TC-R, S-36, S-17·S-18 연결
4. **06-a**: S-01 스택 프로파일·오리진·CSP, S-22
5. **06-b**: DDL (S-20, S-21, S-25, S-41 컬럼)
6. **06-c**: S-13 예산, S-14 용량·6.16, S-16 상태-한도
7. **06-d**: S-24·S-27·S-28 보안·오류 표, S-26 흐름표, S-32·S-37 MockupCard
8. **09-a**: S-01·S-02 환경·HALT, S-23 9.5.7
9. **09-b**: S-09·S-10·S-41 묶음 B17~B25·temp 규칙, S-06 a~e·g
10. **09-c**: S-11 Mock, S-12 시나리오, S-08 M4, S-19 M7 404
11. **04-a**: S-13 참조, S-12 gen_copy, S-16, S-09 4.3
12. **04-b**: S-24 G-13, S-33, S-34, S-38 H7, S-39 덱 제약
13. **04-c**: S-35 E-14, S-40 E-15, S-32, S-37, S-05 키 이름
14. **03**: S-33, S-37, S-38, S-39, S-40, S-35 3.18
15. **02**: S-08, S-07 muRef, S-29 키 참조, S-30 필터, S-05 키
16. **05**: S-09 5.9 temp 분기, S-22, S-06a
17. **01**: S-29, S-30, S-31, S-32·S-34·S-37 카피, S-24 1.12, S-16, S-40 1.8.5
18. **08**: S-10, S-24 적용 표, S-25~S-28, S-20·S-21 보관표
19. **00**: S-15, S-16~S-18, S-19 P-1b, S-31, S-32 [P2], S-36, §14 상태 갱신
20. **검사**: 잔재 grep. `muRange`, `data/legal/`, `page_generate`, `vision_score`, `P0-β`, `vector`, `allow_soft_round_shadow`, 평면 thresholds 키가 0건이어야 한다.

## 사람 확인 필요

에이전트가 결정하지 않는다. 각 항목은 HUMAN_TODO로 옮기고, 그동안은 temp·manual·needs_ci 상태로 진행한다.

- 법무 문안 3종 확정과 변호사 검토 (S-10)
- 국내 리전에서 실행하는 국외 법인 호스팅을 국외 이전으로 볼지 (S-26, 8.14 Q5)
- 정지 이력 이메일 해시 1년 보관의 근거 (S-21, Q6)
- 금지 업종 범주·키워드의 적정성 (S-24, Q13)
- 안전성 확보조치 고시의 적용 범위와 접속기록 보관 기간 (S-28, Q16 신설)
- 고위험 브랜드 목록·도메인 사실 확인, 자산 라이선스 확인, 처리위탁 공급자 승인 (S-10)
- few-shot 48개 작성·승인, 정규화기·추출기 사람 라벨 (S-09)
- 콘솔 MFA, service role 키 보관 (S-28)
- `QA_LOCK_DIGEST` 설정, 워크플로 push 권한, CI의 webkit·firefox·Docker 기준선·GoTrue 결과 확인 (S-01·S-02·S-04)
- 베타 모집 글 게시, 평가자·참가자 섭외, 보상 지급 (S-18)
- 예산 증액과 WAM 100 복귀 여부 (S-15·S-14)
- 시뮬레이션 조정 상한 도달 시 판단 (S-08), muRef 갱신 승인 (S-07)
- staging 부하 재측정, 사용성 테스트 R1·R2 (S-03·S-19)

## 출처 대응표

| 리뷰 항목 | 심각도 | S-ID |
|---|---|---|
| TL2-01 | Blocker | S-01, S-03, S-23 |
| TL2-02 | Blocker | S-02, S-03 |
| AI2-01 | Blocker | S-09, S-41 |
| AI2-02 | Major | S-08, S-05 |
| AI2-03 | Major | S-07 |
| AI2-04 | Major | S-12, S-24 |
| AI2-05 | Major | S-11 |
| LG2-01 | Major | S-24 |
| LG2-02 | Major | S-25 |
| LG2-03 | Major | S-26 |
| LG2-04 | Major | S-21 |
| LG2-05 | Major | S-27 |
| LG2-06 | Major | S-28 |
| LG2-07 | Major | S-10, S-41 |
| PD2-01 | Major | S-32 |
| PD2-02 | Major | S-33 |
| PD2-03 | Major | S-34 |
| PD2-04 | Major | S-35 |
| PD2-05 | Major | S-36 |
| PM2-01 | Major | S-15, S-14 |
| PM2-02 | Major | S-16 |
| PM2-03 | Major | S-17 |
| PM2-04 | Major | S-18 |
| PM2-05 | Major | S-19 |
| QA2-01 | Major | S-05 |
| QA2-02 | Major | S-03 |
| QA2-03 | Major | S-04 |
| QA2-04 | Major | S-06 |
| TL2-03 | Major | S-13, S-05 |
| TL2-04 | Major | S-14 |
| TL2-05 | Major | S-20 |
| TL2-06 | Major | S-23 |
| TL2-07 | Major | S-22 |
| UI2-01 | Major | S-37 |
| UI2-02 | Major | S-38 |
| UI2-03 | Major | S-39 |
| UI2-04 | Major | S-40 |
| UX2-01 | Major | S-29 |
| UX2-02 | Major | S-30 |
| UX2-03 | Major | S-31 |
| QA2-05 · QA2-07 · QA2-08 · UX2-04 | Minor | S-07(QA2-05 불채택) · S-04 · S-06 g·S-11 · S-29 |

Blocker 3건과 Major 37건이 모두 대응된다. 나머지 Minor는 각 장 반영 때 리뷰 원문 보완안대로 처리한다. 레지스터와 충돌하면 레지스터가 이긴다.
