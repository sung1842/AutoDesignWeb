# 통합 결정 v4 (3라운드 장 간 충돌 해소) — decisions_v3.md·decisions_v2.md·decisions.md보다 우선

3라운드 리뷰(Blocker 3, Major 37)를 장별로 반영하기 전에 결정을 고정한다. 각 장 편집자는 아래와 다른 부분을 모두 고치고, 대체된 S-xx·R-xx 문장에는 "→ T-xx로 대체"를 적는다. decisions_v3.md 파일 자체는 고치지 않는다.

- **읽는 법**: "채택: X 보완안"은 해당 리뷰 파일의 보완안과 수용 기준을 원문 그대로 반영한다는 뜻이다. 표에 따로 적은 값·키·경로·번호가 리뷰 원문과 다르면 표가 이긴다. 번호는 T-36이 최종이다.
- **완화 금지**: 숫자 합격선은 하나도 낮추지 않았다. 판정 정의가 바뀌는 곳은 T-03, T-04, T-05, T-06, T-08, T-14, T-17, T-18, T-19, T-28 열 곳이다. 모두 "같은 기준을 실제로 실행할 수 있게 하거나 더 엄격하게 하는" 변경이고, 근거를 각 행에 적었다. 튜닝 상수를 잠금 파일 밖으로 옮기는 것(T-03)은 합격선·시드·β 등은 그대로 잠그고, 옮긴 상수도 닫힌 값 집합과 시도 상한으로 자체 잠근다.
- **실행 환경(2026-11-19 실측, v3와 같음)**: Docker 데몬 없음, chromium-1243만 있음(webkit·firefox 없음), PG16에 pgvector 없음, npm 접근 가능, 외부 키 없음(`LLM_MODE=mock`). 06 DDL은 shim 위 PG16에서 오류 0으로 적용됨(TL3 실측).

| ID | 결정 | 고칠 장 |
|---|---|---|
| T-01 | **결정 기록 파일의 잠금 예외**(QA3-01, Blocker). 채택: QA3-01 보완안 **2번(append-only 예외)**. 1번(경로 이동)은 고르지 않는다. 이유: 저장소 CLAUDE.md §1과 세션 규칙이 이미 `docs/spec/DECISIONS_LOG.md`를 가리키므로, 옮기면 경로가 둘이 되는 위험이 더 크다. 07 7.12.2 6단계의 예외는 닫힌 목록이고 이 파일 1개뿐이다(baseRef 내용이 HEAD 내용의 접두어). 기존 줄 수정·삭제는 FAIL. 9.5.7 경로 옆에 "append-only, 7.12.2 예외". 신규 AC-07-25(QA3-01 메타 테스트). | 07, 09 |
| T-02 | **spec 고정점 = 리뷰 통과본**(QA3-08). 채택: QA3-08 보완안 1~3. P2 멈춤 커밋에 `review-pass` 태그를 붙이고 07 두 블록의 SHA-256을 PROGRESS.md에 기록한다. `spec-lock` 직전 `spec:extract --from FINAL`과 `--from review-pass`가 바이트 단위로 같아야 하고(guard 6단계도 검사), 다르면 BLOCKED. 추출 원천은 코드 상수 1개 `docs/spec/FINAL/07_quality.md`, `docs/spec/v2/`는 기록용. 9.8.1의 `docs/spec/00~09*.md` → `docs/spec/FINAL/`. 09 F01·9.5.6 규칙 2·`locked-hashes` 예시는 `baseRef = human-lock ?? spec-lock`(둘 다 없으면 FAIL), `lockedBy` += `spec`, M0 산출물에 `spec:extract`·guard 5~7단계, AC-09-03에 사례 2개. 신규 AC-07-24. S-04 보완. | 07, 09 |
| T-03 | **진단 튜닝 상수 분리 + 결정론 탐색**(QA3-02, AI3-05). 채택: QA3-02 보완안 1~3 + AI3-05 보완안 1~5. 근거(정의 변경): 잠긴 파일 안의 값을 조정하라는 절차는 실행할 수 없어 완화나 우회를 부른다. 합격선·β·σ0·sigmaStop·문항 수·시드는 `diagnosis`(spec 잠금)에 남고, 2.16.2의 6좌표만 `diagnosis.tunable`(값 집합·초기값)로 두며 런타임 값은 `config/diagnosis-tuned.json`이다. 자체 잠금: 값 ∈ 닫힌 집합, `sim/reports/tuning-log.json` dev 시도 ≤ `maxTuningTrials`, `chore(sim-tune):` 단독 커밋, `engine_version`에 tuned 해시. 목적함수는 사전식(미달 수 → 정규화 부족분 합 → 현재 값 → 사전순), 시도 계수는 시작점 포함 11회. **gate는 ①~⑥ 한 바퀴 뒤에만** 돌고 PASS/FAIL만 쓴다(선택 함수는 dev 리포트만 받음). `maxGateRuns` 3 = 바퀴 3회. ⑥은 tuned `bridgeRelocated`. 신규 AC-02-36. S-08 ④ 보완. | 02, 07, 09 |
| T-04 | **골든 `answers`·`muRef` 생성 시점**(QA3-03). 채택: QA3-03 보완안 1~3. 근거(정의 변경): M1에는 엔진이 없어 생성할 수 없고, 튜닝 뒤에는 이른 muRef가 정상 변경을 회귀로 판정한다. M1 ② = 골격 32행(`answers`·`muRef` null) 스키마 유효. `build-answers`는 M4 종료 직전 1회(T-03 확정 후), `m4-done` 커밋에서 `data/golden/**` 자체 잠금. 7.2.2 재생성 조건 = "엔진 major **또는** tuned 변경", 사람 승인(`golden-muref-approval`), tuned와 muRef는 같은 커밋. M1a 기준은 그대로. 신규 AC-09-17. S-07 보완. | 07, 09, 02 |
| T-05 | **`release:check` 단계 카탈로그·종료 코드 3**(QA3-04). 채택: QA3-04 보완안 1~4. 근거(정의 변경): 종료 코드 2가 문서상 도달 불가였고, 단계 분해를 에이전트가 정하면 허용표를 우회할 수 있다. 07 7.11.2 카탈로그를 `spec:test-policy.steps`로 추출·잠금하고, 카탈로그 밖 단계나 누락은 1. 허용표 추가 단계는 T-36 목록(temp·manual·needs_ci). temp 조건 열에 묶음을 적는다(`extractor-roundtrip` = B18). "9.8" → "9.2". **종료 코드 3** = 모든 fail이 `blockable`(`sim-diagnosis-gate`, `survey-items-count`, `locked-conflict` 대상) ∧ open BLK를 `blockedBy`로 가리킴 ∧ 재현 명령 있음. 3은 출시 불가, 9.9.2 완료 = 0·2·3. 신규 AC-07-21. S-03 보완. | 07, 09 |
| T-06 | **추출기 temp 상태 분류**(AI3-01). 채택: AI3-01 보완안 1~4. 근거(정의 변경): 0.10 판정은 그대로 하고 결과 상태만 정한다. 단계 `extractor-roundtrip`은 B18 temp일 때만 실패 축이 `temp`이고, reliable 축 < `reliableAxesMin`(3)이면 fail. human 정규화기는 기존대로 fail(05 5.9 앵커 행에 "(human 정규화기)"). **M4 ①은 완화하지 않는다**: 미달이면 fail + BLK, M5 이후 계속(`survey-items-count`, blockable). 02 2.6.1 후보 0이면 503 `SURVEY_ITEMS_INSUFFICIENT`(빌드에서 사전 검출). 신규 AC-02-37. S-09 보완. | 05, 09, 07, 02, 06 |
| T-07 | **시뮬레이션 자극물 = 배포 x_card**(AI3-03). 채택: AI3-03 보완안 1~3. 2.16.1 자극물 행은 "active x_card만(provenance 무관)". `--synthetic`(target_l1 + 잡음)은 M4 이전 단위 테스트 전용, `verdict:"n/a"`, `--synthetic --gate`는 종료 코드 1. 비차단 행 **V-MEAS**(지각 = target_l1, 갱신 = x_card) 추가. 같은 비차단 표에 AI2-06의 V-LAMBDA·V-POS·V-MIX를 함께 넣는다. 리포트에 `stimulus.source`, `normalizer_version`, `normalizer.provenance`. 신규 AC-02-35. | 02, 07 |
| T-08 | **`qa:trace --audit` 재정의 + 키 없는 합격 수치 키화**(QA3-05; AI3-06·PM3-08·QA3-10 포함). 채택: QA3-05 보완안 1~4. 근거(정의 변경): 문자 그대로의 규칙은 HTTP 상태·수량까지 금지해 테스트를 못 쓰게 하고, 헬퍼로 옮기면 우회된다. 감사 = 비교 매처·비교 연산자 피연산자의 리터럴이 thresholds 잎 값과 같으면 FAIL, 범위 = `tests/acceptance/**` + import 그래프. 예외 리터럴은 `spec:test-policy.auditAllowLiterals`, `forbidden-allowlist.json`은 경로만. 신규 키(현재 본문 값 그대로): `perf.surveyServerP95Ms` 200(서버 처리, D-0608·M4 ⑦), `perf.surveyApiP95Ms` 300 유지(API 관측), `perf.resultServerMs` 200, `perf.mockE2eSubmitToCardsSec` 30, `perf.queueWaitMaxSec` 180(= 2 × `latencyP95Sec`, TC-C-02·AC-06-37, 동시 상한 = S-14 실효), `release.extractor.anchorMinDist` 0.25, `diagnosis.typeCenterMinDist` 0.50, `generation.fallbackAbortToleranceSec` 2, `release.usability.seqMedianMin` 5. 나머지는 7.12.1 "사양 상수" 표로 닫는다. 신규 AC-07-22. | 07, 09, 06, 02, 00 |
| T-09 | **AC → 마일스톤 배정표 + 00장 기능 배정**(QA3-06, PM3-04). 채택: QA3-06 보완안 1~3 + PM3-04 보완안. 배정표 원천은 07 `spec:test-policy.acMilestones`(추출 원천을 07 한 파일로 유지), 09 9.4는 참조. 06 표를 옮겨 00~09장 전 AC를 채운다. 원칙: 그 기능을 처음 만드는 마일스톤, 정할 수 없으면 M8. `qa:trace`: AC는 배정된 `tests/acceptance/m<k>/`에만 매핑되어야 PASS, 정규식 `AC-\d{2}-\d{2,3}[a-z]?`(QA3-09). 09 9.4 범위 추가: M4 이벤트 API·zod·`identity_links`, M5 `quota_ledger`·초대 코드·생성 이벤트·T-20, M6 채택·공유/내보내기 이벤트·페이크 도어·T-22, M7 ADM-01~13·KPI 뷰·문의/신고(통과 조건 AC는 PM3-04 원문). AC-00-01·07은 "문서 검사". 신규 AC-07-23. | 07, 09, 06, 00 |
| T-10 | **수량 잔재와 AC ID 중복**(QA3-07). 채택: QA3-07 보완안. 수량 대신 원천을 참조한다: AC-09-04 "9.2.2 전 묶음", AC-09-07·AC-07-02·7.15 "9.6.2 전 행(기대 결과는 07 TC-R)", "G-01~G-12" → "R-13 하드 게이트 전부(현재 G-01~G-13)". **AC-03-38 중복**은 두 리뷰 안(1421행 → 38b, 3.1.5a → 41)이 다르고 AC-03-41은 이미 쓰인다. 그래서 3.1.5a 쪽을 **AC-03-42**로 바꾸고 조화 쪽은 그대로 둔다(3.15 요약 범위 "38~40" 유지). `qa:trace`는 ID 정의 2개 이상이면 FAIL. | 09, 07, 03, 00, 06, 04 |
| T-11 | **데이터 접근 설계 하나: 서버 전용 `DbPort` + 쓰기 권한 화이트리스트**(TL3-01, LG3-01 Blocker; TL3-11 포함). 채택: TL3-01 보완안 + LG3-01 보완안 1~4, 값은 아래로 고정. ① **브라우저는 DB·PostgREST·supabase-js를 쓰지 않는다.** 로그인(매직링크·Google·TOTP)도 서버 Route Handler가 `AuthPort`로 처리하고 세션 쿠키는 httpOnly다. `NEXT_PUBLIC_SUPABASE_URL`·`_ANON_KEY`는 폐지하고 서버 전용 `SUPABASE_URL`·`SUPABASE_ANON_KEY`(supabase 프로파일·staging·prod만 필수). ② **`DbPort`**(두 프로파일 공통): `withUser(uid, aal, fn)`·`withAnon`·`withService` = 트랜잭션 + `SET LOCAL ROLE` + `request.jwt.claims`. 역할 없는 쿼리는 API로 만들 수 없다. 드라이버 **Kysely + `pg`**, 타입 **kysely-codegen**(`pnpm db:types`, `DATABASE_URL_DIRECT`, Docker 불필요). 접속 사용자: native = shim의 `tastefit_app`(LOGIN, NOBYPASSRLS, 3역할 멤버, shim service_role은 BYPASSRLS), supabase = 기본 사용자(Supavisor 트랜잭션 모드). supabase-js import는 Auth·Storage supabase 드라이버 안에서만(guard). `DATABASE_URL_POOLED` 미설정 시 local만 DIRECT. ③ **쓰기 화이트리스트**: `authenticated`는 `users.display_name`과 `mockups(feedback, feedback_at, selected_at)` 컬럼 UPDATE만, `anon` 쓰기 0. `projects`·`mockup_versions`·`share_links`의 authenticated 쓰기 정책 삭제, 나머지 쓰기는 `withService`나 security definer 함수. 심층 방어 트리거와 권한 덤프 스냅샷은 LG3-01 3·4번. ④ `StoragePort.publicUrl`, fs = `${WEB_ORIGIN}/api/_storage/public/…`, CSP `img-src`는 신규 `STORAGE_PUBLIC_ORIGIN`. `/api/_storage/*`는 항상 존재하고 local·fs가 아니면 404, `api-parity` 제외(TL3-11). preview는 `next start -p 3001` 2번째 프로세스. ⑤ `AuthPort += adminSignOutAll, adminDeleteUser`, local exchange는 `auth.users` upsert 후 T-12 호출. ⑥ native는 AC-06-03·03b를 `withUser` SQL로, supabase CI는 REST 직접 호출까지(needs_ci `supabase-rest-rls`). 신규 AC-06-03b, AC-06-59. S-01 보완. | 06, 09, 08, 07 |
| T-12 | **`provision_user` + 관리자 권한 원천**(TL3-02). 채택: TL3-02 보완안. `auth.users` 트리거는 `users` 생성·관리자 판정·제재 승계를 하지 않는다(`minimize_auth_metadata`는 유지). 로그인 콜백(supabase `/auth/callback`, local `exchange`)마다 web이 `withService`로 `provision_user(p_user_id, p_is_admin, p_email_hash)`(security definer)를 호출해 `users` upsert, `role`을 현재 `ADMIN_EMAILS`에 동기화, `sanctions`·`abuse_holds` 승계를 한 트랜잭션으로 한다. HMAC은 web이 계산하고 키는 DB에 없다. 권한 = `role='admin'` ∧ 요청 시점 `ADMIN_EMAILS` ∧ `aal2`. 6.5.4 "자동 강등하지 않는다"·ADM-06 수동 승격 삭제. 신규 AC-06-60. S-21·S-28 보완. | 06, 00, 08 |
| T-13 | **인증 서버 기록 P14**(LG3-02). 채택: LG3-02 보완안 1~3. 08 8.7.2 P14(인증 이벤트·IP·UA·이메일, Supabase `auth.*`, 정당한 이익), 6.1.3 Supabase 행 P14. "IP 원문을 어디에도 저장하지 않는다"(00·06·08) → "앱 테이블(`public`)에는 미저장, 인증 서버 기록은 P14". 규칙 `auth_audit_90d`, `account-delete` ⑥b, AC-08-36 범위 = `public` + `auth` 보관 기간 밖 행. shim에 `auth.audit_log_entries`·`auth.sessions` 최소 컬럼, GoTrue 실측은 needs_ci → `docs/compliance/auth-metadata.md`. 기본값 90일(Q16). 신규 AC-08-55. | 08, 06, 00 |
| T-14 | **감사 로그 1년 파기**(LG3-03). 채택: LG3-03 보완안 1~3. 근거(정의 변경): AC-08-33(1년 후 0건)과 AC-06-06(DELETE 전면 실패)은 동시에 만족할 수 없고, 고지(1년)와 실제(영구)가 달라진다. UPDATE는 항상 거부, DELETE는 `old.created_at < now() − 1 year`인 행만 `purge_audit_logs(p_before)`(security definer, `p_before ≤ now() − 1 year` 재확인)로 허용. 6.6 규칙 `admin_audit_1y`. AC-06-06 = "UPDATE는 항상 실패, 1년 이내 행 DELETE는 service role에서도 실패". 00 AC-00-20 "append-only" → "1년 보관 후 파기만 허용". 테스트는 `created_at`을 과거로 넣은 행. 신규 AC-08-56. | 06, 08, 00 |
| T-15 | **신고 증거 보존·탈퇴 순서**(LG3-04). 채택: LG3-04 보완안 1~3. `account-delete`는 **⑤ → ①** 순서(`status_before_delete` 컬럼은 두지 않음). `reports.share_id`는 FK 없는 text + `evidence jsonb`. `impersonation`·`phishing` 신고가 `open`/`hidden`/`actioned`인 버전은 삭제 경로에서 객체를 `abuse-evidence/<report_id>/`로 옮기고 `abuse_evidence_90d`(검토 종료 후 90일). ⑤b `abuse_holds(email_hash, report_ids, until)`, `actioned` 처리 시 `sanctions` upsert, 재가입 시 T-12가 승계. 기본값 90일(Q6). 신규 AC-08-57. S-21 보완. | 06, 08 |
| T-16 | **익명 창구 계약**(LG3-05; UX3-09 Turnstile 부분 포함). 채택: LG3-05 보완안 1~3. 세 엔드포인트 입력 `turnstileToken` 필수, 실패 403 `TURNSTILE_FAILED`(R-13 표, 01 1.10.3 위젯). `rights_requests += verify_token_hash, verify_expires_at, verified_at`, status += `awaiting_verification`. 확인 메일은 계정 이메일 일치 시에만(응답은 같은 201), verify 링크 1회·24시간(재사용·만료 410), 미확인 처리 409. 메일 `privacy_verify`·`share_hidden_notice`. S12 "검토 중" + `me.share.underReview`. 신규 AC-06-66. S-27 보완. | 06, 01, 08 |
| T-17 | **원가: 캐시 예열·Mock 캐시·비용 시나리오 3종**(TL3-03, TL3-04; TL3-10·QA3-11 포함). 채택: TL3-03 보완안 **a** + 공통, TL3-04 보완안. 이유(a): b는 생략 임계·cap, 즉 합격선을 다시 정해야 하고 a는 지연 +1~2s(TTFT)뿐이다. ① 레이아웃 후보 0 먼저, 첫 토큰 뒤 나머지 5개, 카피는 처음부터 병렬. 04 4.17.2 표(기본 ≈ $0.23 < `skipVisionUsd`)가 성립하고 식은 06 6.9.4에 둔다. ② Mock usage는 `fixtures/llm/mock-prompt-sizes.json`(블록별 고정 문자 수)로 보고하고 정적 프리픽스는 첫 레이아웃 `cacheWrite`, 나머지 `cached`. 근거(정의 변경): "$0.23 ± 10%"는 프롬프트 길이로 맞출 수 있어 판정이 서지 않으므로 AC-06-56을 **"공식값 ± 1%"**(더 엄격)로. ③ `cost_spike` = 단가 10배(추정 반영) → `budget_skipped`, `sum ≤ 0.30`. `cost_ramp` = 단가 1.15배 → vision → repair 순 생략. `usage_overrun` = usage 3배(추정 미반영) → 진행 호출 정산, A11 1건, 이후 예약 전부 거부. 근거(정의 변경): 실제 청구는 외부 사실이라 저장 제약이 잡을 죽이거나 기록을 깎으면 KS-1 집계가 틀어진다. `generation_jobs.cost_usd` CHECK는 `≥ 0`만(S-13의 ≤ 0.36 대체), AC-06-07 = "0.30 초과 저장 시 A11 + 이후 예약 거부, DB 예외 0". 가드 0.30과 "cost_spike 합 ≤ 0.30"은 그대로. ④ attempt마다 reserve → settle/release(TL3-10). ⑤ 실효 cap = min(`JOB_COST_CAP_USD`, `capUsd`), 생략 기준은 같은 비율로 내린다(더 엄격). 00 §9.2는 06 참조 1줄, AC-00-14는 `cost_spike` 기준. 신규 AC-06-61·62. S-13 일부 → T-17로 대체. | 06, 04, 07, 09, 00 |
| T-18 | **Mock 재호출·수리·인덱스 매핑**(AI3-04; TL3-05·AI3-09 포함). 채택: AI3-04 보완안 1~5. 시드 `hash(designSpec.hash, candidateIndex, role, callKind, attempt)`, 장애는 `initial`에만, `!` 접미사만 재호출에도 유지(`copy_schema_fail@gen_copy`는 `!`). 수리 규칙, `fixtures/llm/mock-variant-effects.json`(B18 정규화기 Δ, 결정론), `fixtures/llm/low-score-trees/`(72조합 H < 80)는 원문. `candidateIndex = variantIndex × 2 + slotIndex`, 순서 `[v_true, v_fit, v_bal]`, 재생성은 같은 인덱스(04 4.8·06·09 같게, TC-R-15에 개수). 재호출도 위반이면 `eligible=false`(`DIVERSITY`). 근거(정의 변경): AC-04-16 "100%(재호출 후)"는 재호출 실패 시 판정 대상이 없었다. "**노출 집합 기준 100%**"로 바꾸며, 위반 후보는 노출될 수 없으므로 더 엄격하다. `call_kind`·`candidates.origin` += `diversity`, 카피 패치 = `gen_copy ∧ repair_quality`, AC-04-23 상한에 diversity 미포함. `judge_vision`은 `hash(sorted(ids))`로 승자 ID → 위치별 A/B, `judge_position_bias@judge_vision` 추가. 신규 AC-04-47, AC-09-18. S-11 일부 → T-18로 대체. | 09, 04, 06, 07 |
| T-19 | **TM·S_free에 `reliable`·`subjective` 반영**(AI3-02). 채택: AI3-02 보완안. 04 4.10.4가 원천: `m_k = reliable_k · (subjective_k ? 0.5 : 1)`, `w_k = m_k·λ_k/(σ_k²+τ²)` 정규화, `F = {A1, A4} ∩ reliable`, `S_free = F = ∅ ? null : …`, 노출 = `TM ≥ 75 ∧ (S_free = null ∨ S_free ≥ 65)`. 근거(정의 변경): 빈 평균은 계산 불가이므로 측정 불가를 명시하는 것이고, null이면 경고 `SFREE_NA`, 골든 M8 최솟값은 null 아닌 값으로 계산하고 null 개수를 리포트에 적는다. 사람 라벨 G2가 이 상태를 확인한다. `axis_gaps`는 reliable 축만. 05 D-056은 "04 4.10.4 m_k" 참조. 신규 AC-04-45. | 04, 05, 07 |
| T-20 | **노출 전 취소 환불 남용 차단**(PM3-02). 채택: PM3-02 보완안. 노출 0 취소 환불은 계정당 하루 **2회**, 3번째부터 차감(01 1.6.5 시트 문구 분기 `gen.cancel.noRefund`). `USER_DAILY_COST_CAP_USD`(기본 1.5, 6.10.4 플래그) 초과 시 그 계정 신규 생성 429 `QUOTA_DAY`(사유 `cost_cap`), A4는 차단 발동을 알림. 취소 즉시 진행 중 LLM 호출 abort, `llm_calls.status='aborted'`(enum 기존 값). 00 §9.3 `canceled` 행과 06 6.2.3이 같은 문장. 신규 AC-06-63. S-16 보완. | 06, 00, 01, 04 |
| T-21 | **평가 LLM 예산**(PM3-03). 채택: PM3-03 보완안. `EVAL_RUN_BUDGET_USD` 30·`EVAL_MONTHLY_BUDGET_USD` 60(06 6.10.4). `llm_calls.purpose ∈ {user_job, eval, ref_tag}`(`job_id not null`은 user_job일 때만). eval·ref_tag는 `GEN_*`와 따로 집계, staging `GEN_DAILY_BUDGET_USD=2`는 사용자 경로 스모크 전용. 00 §9.4 "비사용자 LLM 지출" 표, 월 총 상한 210. `release:check`는 G2 `runsCompleted = 96`을 확인하고 예산 중단 미완료는 fail(미실행 명시). 증액은 사람 결정. 신규 AC-06-64. S-15 보완. | 06, 00, 07, 09 |
| T-22 | **검증 운영 UI·API**(PM3-01, UX3-05). 두 안을 합치고 충돌은 이렇게 정한다. ① S03 소유자 뷰 `result.retestHint`. ② S12 배너 `me.retestBanner`: 로그인 ∧ 최신 결과 후 **6~14일** ∧ 그 뒤 결과 없음, [다시 진단하기] = `entry:'retest'`, 닫기 = `localStorage tf_retest_dismissed_{resultId}`. 이유: 재검사 유효 창이 02 2.16.3의 6~14일이고, 배너는 무해한 안내라 서버 상태가 필요 없다. ③ A5 시트는 **서버 상태**: "1회"를 기기와 무관하게 보장해야 지표가 맞기 때문이다. `mockups += followup_answered_at, followup_dismissed_at`, `GET /api/me.adoptionFollowup`(`adopted_at ≤ now − 7d`, 미응답·미닫힘, 가장 오래된 1건), S12·S09 진입 시 방문당 최대 1개. 엔드포인트는 **1개**: `POST /api/mockups/:id/adoption-followup {answer: deployed\|handed_off\|reference_only\|unused\|dismissed}` → 204(소유자만, 중복 409). `dismissed`는 이벤트 없음. ④ 00 §8.5: A5 = `{deployed, handed_off}` / **응답 시안**(n ≥ 15) + 응답률, A7 = `paywall_interest` / `paywall_view` 주체. ⑤ 1.12.1·1.16 상태와 발화 지점, 키 `followup.*`. 신규 AC-01-59, AC-06-65. S-18 보완. | 01, 06, 00 |
| T-23 | **자극물 크기 규칙**(UX3-01). 채택: UX3-01 보완안 1~5. 1단계 desktop/tablet은 `w2 = min((vw − 2m − 24)/2, 588) < 480`이면 1열 세로 목록(`w1 = min(vw − 2m, 800)`, m = desktop 32·tablet 48), 2단계는 같은 조건에서 토글 비교(desktop 자산, 폭 `w1`). mobile `card_h = 100dvh − 276 − env(safe-area-inset-bottom)`, 하단 바 두 줄, 1.14.3 [이전][다음]은 "썸네일 탭으로 대체", mobile A/B도 같은 고정 창. 회전 안내 판정은 `(pointer: coarse) && vh < 500`. `card_h < 300` 회전 안내는 유지. 07 7.6.2 S02 검증 뷰포트에 리뷰의 7개 뷰포트 + 844×390 추가. 신규 AC-01-55. S-30 일부 → T-23으로 대체. | 01, 07, 02 |
| T-24 | **편집 허용 기기와 내보내기**(UX3-02). 채택: UX3-02 보완안 1~4. 1.9 9번 = "편집 불허 기기(1.3.1)에서만 내보내기 숨김". 판정은 S09 마운트 시 1회, 세션 동안 고정. SSR은 편집 스켈레톤. 1.14.2 "< 768 1열 탭, 768~1023 드로어". 1.12.1 S09 `narrow_edit`. 편집 불허 기기 S08 주 CTA `drafts.mobile.cta` "PC에서 다듬기"(링크 복사 + 안내), 보조 [공유 링크 만들기] = `/edit/[mockupId]?modal=share`. 1.2 S11 진입 "S09, S09 읽기 전용". 07 7.6.2는 01 1.3.1 참조. 신규 AC-01-56. S-31 보완. | 01, 07 |
| T-25 | **결과 안내는 서버가 고른다**(UX3-03). 채택: UX3-03 보완안 1~4. 02 2.13.1 `pickNotice(profile) → 'low_signal'\|'conflict'\|'low_consistency'\|'boundary'\|null`(순수 함수, 순서는 S-29). `ResultView.notice`(같은 enum)·`ResultView.seasonAdjusted: boolean` 추가, `consistency: {C, level}` 삭제. 시즌 "첫 방문 1회"는 `localStorage tf_season_seen_{resultId}`. 02 2.9·2.12.2 문구 원문 3개는 키 참조로, κ < 0.50의 의미는 `lowConsistency`(재진단 권유)로 확정. `notice ∈ {low_signal, low_consistency}`이면 신뢰도 줄 생략. 클라이언트 σ·κ 임계 비교 0. 신규 AC-02-34(픽스처 5종), AC-01-57(S03 표시). S-29 보완. | 02, 06, 01 |
| T-26 | **S08 안내 데이터 원천**(UX3-04). 채택: UX3-04 보완안 1~4. `MockupCard.photoSubstituted: boolean`(04 4.9.4 결정론 결과), `GenerationView.copySource: 'llm'\|'template'`. 안내: 비폴백 < 3이면 `drafts.partial`, `copySource='template'`이면 `drafts.templateCopy`(동시 최대 2줄). 1.7 머리 상태 정의에 "템플릿 덱이면 비폴백 3이어도 `partial`(S-12)". 키 문구는 UX3-04 3번 원문, `labelKey = variant.v_true\|v_fit\|v_bal` + `variant.<v>.label/desc` 6개. 07 TC-R-16 기대 상태는 S-12 문장("R-15 값과 partial 중 낮은 쪽")으로 고친다(QA3-12). 신규 AC-01-58. S-12·S-34 보완. | 06, 01, 04, 07 |
| T-27 | **반전 면 컴포넌트·accent 텍스트**(UI3-01; UI3-06 "라벨" 부분 포함). 채택: UI3-01 보완안 1~3, 3번은 권장안(이미지 오버레이 위 = `@inverse` 매핑). `deriveTokens`가 `tokens.inverseButtonMode: 'primary'\|'invert'`와 `tokens.accentTextSafe: boolean`을 결정론으로 파생. accent 텍스트는 `accentTextSafe`일 때만, 03 3.13.3·3.13.2 (a)의 "라벨"은 이 조건으로 고친다. 팔레트 값은 바꾸지 않는다. 신규 AC-03-44(32 TokenSet 3쌍), AC-03-20에 G-02·G-03 추가. | 03, 04 |
| T-28 | **G-12·AIL-17 뷰포트별 기대값**(UI3-02). 채택: UI3-02 보완안 1~3, 3번은 첫 안(`nav.wordmark` = `t-lead`, heading 웨이트, "20~24px 고정" 삭제). 근거(정의 변경): 지금 정의는 clamp 보간값·중앙 정렬 여백을 위반으로 판정해 정상 시안을 모두 폐기한다. 허용 오차 0.5px와 색·radius 검사는 그대로이고, 스케일 밖 값 픽스처(`padding: 13px`, `font-size: 15px`)는 모든 뷰포트에서 계속 잡혀야 한다. font-size 기대값 = 03이 제공하는 `expectedSize(step, vw)`, spacing 검사 대상 = padding·gap·토큰 margin(`data-layout-auto` 요소 제외). 신규 AC-03-45. | 04, 03 |
| T-29 | **텍스트 역할 확장**(UI3-03). 채택: UI3-03 보완안(역할 행 그대로). 기존 `price`는 `pricing.price`로 이름을 바꾸고 pricing 블록 전용. B25 `text-roles.json` 갱신. 텍스트 역할 AC는 AC-03-42(T-10), 커버리지 교차 검사는 신규 AC-03-46. S-38 보완. | 03, 04, 09 |
| T-30 | **헤드라인 줄 예산 입력·cta·워드마크**(UI3-04). 채택: UI3-04 보완안 1~5. 덱 제약 입력 = `maxChars_job`(변형 3 × hero_variants 허용 목록 × {1280, 375}의 최솟값, S1 확정 후 S2 전에 계산). 하향 판정은 토큰 계산(`len > headlineBudget`)이고 렌더 측정은 AC-03-26 검증 전용. 하향 결과는 확정 트리 섹션 노드 `role_overrides: {slot_id: step}`(04 §4.5.2 스키마). **`spec.render_adjustments[]`는 폐지**(S-39 일부 → T-30으로 대체). `VariantDef.text_cols: {lg, base}` hero 6종(full-bleed-image 7, left-aligned 8, offset 6, split 6, type-only 10, centered 8), 반올림 `floor`. cta big-type·footer·nav 워드마크 규칙은 보완안 4(nav는 `t-lead` → `t-body` → 375 2줄). AIL-24에 "1280 > 2줄". 신규 AC-04-46. | 03, 04, 01 |
| T-31 | **베이스라인 자산 동등화**(PD3-01). 채택: PD3-01 보완안 1~3. 프롬프트 부록(이미지 팩 후보 ≤ 12, `@font-face` 블록)은 잠금 파일 `eval/blind/baseline_assets_appendix.md`. 렌더는 본 시스템과 같은 워커 렌더러·로컬 자산 서버·외부 네트워크 차단, 외부 URL 결정론 제거. 적합성(`imagesLoaded ≥ 1 ∧ systemFontFallback = 0`) 미달은 재요청 최대 2회, 그래도 미달이면 제외 수(기존 ≤ 2 상한 유지). P-2s도 같은 하네스. 신규 AC-07-26. S-36 보완. | 07, 00 |
| T-32 | **styleguide 원천 = 해당 버전 토큰**(PD3-02). 채택: PD3-02 보완안 1~3. 포맷터 `formatGuide(tokens)`를 `ResultView.guide`(입력 = 앵커 프리셋 토큰)와 styleguide(입력 = 그 버전 `tokens`·`l2`)가 같이 쓴다. 앵커 값은 "유형 기본값" 참고 행. E-14에 "팔레트 HEX·페어링 ID·radius 계열이 같은 버전 `tokens.json`과 100% 일치" 추가(AC-04-34 확장). 06 스토리지 표 `exports` 공통 파일에 `styleguide.html`. S-35 보완. | 04, 06, 03 |
| T-33 | **FP15 body = Wanted Sans 400**(PD3-03). 채택: PD3-03 보완안(본안). 대안(Syne 제거)은 '실험 디스플레이' 성격이 사라지므로 고르지 않는다. 패밀리 2종으로 AC-03-25·H4 만점. `pairings.json`·03 3.7.3·3.18 행을 같게 고친다. S-33의 FP15 문장 → T-33으로 대체. | 03, 04 |
| T-34 | **업종 허용 태그 연결·톤 선택식**(PD3-04). 채택: PD3-04 보완안 1~3. 04 4.2.1 `image_tags_allowed = purposeTags(p) ∩ industryTags(BrandInput)`(매칭 0이면 `{storefront} ∪ common.texture-*`), LT-10이 강제. 4.9.4 업종 블록은 "매칭 0일 때 hero 외 사진 슬롯 대체"만. 선택식 단계형(`C1` 같은 톤 → `C2` neutral → `fallback_variant`, 각 집합 `asset_id` 오름차순 후 해시 mod). `pageTone`은 보완안 3. `photoSubstituted`(T-26)는 이 결과에서 나온다. 신규 AC-04-44(수용 기준 3개 + portfolio placeholder 목록). S-34 보완. | 04, 03, 09 |
| T-35 | **S-32~S-34 규칙의 AC 등록**(PD3-05). 채택: PD3-05 보완안. AC-01-54(S08 칩·차이 행, E2E, M6), AC-03-43(`presets:lint-matrix` 리포트·error 0·CF 조합 편집 선택지 `disabled`, CI, M3), AC-04-44(T-34, M5). 07 TC와 T-09 배정표에 넣고, 각 장 반영 추적 표의 S-32~S-34 행에 AC ID를 적는다. | 01, 03, 04, 07 |
| T-36 | **번호·enum·이름 배정**(리뷰 간 번호 충돌 해소. 각 행의 번호가 최종). 신규 AC: AC-01-54~59, AC-02-34~37, AC-03-42(옛 3.1.5a AC-03-38)·43~46, AC-04-44~47, AC-06-03b·59~66, AC-07-21~26, AC-08-55~57, AC-09-17·18. 허용표 단계: temp `data-provenance`·`extractor-roundtrip`, manual `a11y-screenreader`·`device-smoke`·`legal-checklist`·`console-mfa`·`golden-muref-approval`, needs_ci `supabase-rest-rls`. blockable `sim-diagnosis-gate`·`survey-items-count`. 오류·경고: 403 `TURNSTILE_FAILED`, 503 `SURVEY_ITEMS_INSUFFICIENT`, 429 `QUOTA_DAY`(`cost_cap`), `SFREE_NA`, `DIVERSITY`. enum: `diversity`, `llm_calls.purpose`, `awaiting_verification`, `ResultView.notice`. DDL: `reports.share_id text`·`evidence`, `abuse_holds`, `rights_requests.verify_*`, `mockups.followup_*`, `provision_user`, `purge_audit_logs`, 버킷 `abuse-evidence`, 보관 `auth_audit_90d`·`admin_audit_1y`·`abuse_evidence_90d`. env: `SUPABASE_URL`·`SUPABASE_ANON_KEY`, `STORAGE_PUBLIC_ORIGIN`, `USER_DAILY_COST_CAP_USD`, `EVAL_RUN_BUDGET_USD`, `EVAL_MONTHLY_BUDGET_USD`. Mock: `cost_ramp`, `usage_overrun`, `judge_position_bias`. 메일: `privacy_verify`, `share_hidden_notice`. 태그: `review-pass`. | 전 장 |

## 반영 순서

한 단위는 30~45분이다. 원천 장(06 데이터·API, 07 판정)부터 고치고, 다른 장은 키·이름만 참조한다. 각 단위가 끝나면 PROGRESS 체크박스·로그 1줄·커밋·푸시.

1. **06-a**: T-11 `DbPort`·6.1.2·6.3.5 RLS 표 재작성·심층 방어 트리거·6.13.1/6.13.2 env·`StoragePort`/`AuthPort`·`/api/_storage`, T-12 6.5.4·6.11.2 권한 문장
2. **06-b**: DDL·보관(6.3.3·6.3.4·6.6·6.2.5): T-12 `provision_user`, T-13 shim·`auth_audit_90d`·⑥b, T-14 `purge_audit_logs`·AC-06-06, T-15 순서·`reports`·`abuse_holds`, T-16 `rights_requests`, T-22 `mockups.followup_*`, T-17 CHECK·AC-06-07, T-18·T-21 enum·`purpose`, AC-06-02 컬럼명(TL3-09)
3. **06-c**: T-17 6.9.4 예열 순서·식·시나리오·AC-06-56/21/61/62·실효 cap, T-20 6.2.3·6.10.4·AC-06-63, T-21 6.10.4·staging 행·AC-06-64, T-08 D-0608 키
4. **06-d**: API·오류 표(6.4): T-16 엔드포인트·`TURNSTILE_FAILED`, T-22 `GET /api/me`·`adoption-followup`·AC-06-65, T-25 `ResultView`, T-26 `MockupCard`·`GenerationView`, T-32 `guide` 주석·스토리지 표, T-06 `SURVEY_ITEMS_INSUFFICIENT`, T-36 코드, 6.19 미해결 행 정리
5. **07-a**: 7.12.1 블록·7.12.2: T-01 예외 목록·AC-07-25, T-02 review-pass·원천 경로·AC-07-24, T-03 `diagnosis.tunable`, T-08 감사 재정의·신규 키·사양 상수 표·AC-07-22
6. **07-b**: 7.11.2·`spec:test-policy`: T-05 카탈로그·허용표·종료 코드 3·AC-07-21, T-06 단계, T-11 `supabase-rest-rls`, T-21 `runsCompleted`
7. **07-c**: T-09 AC 배정표(`acMilestones`, 00~09 전 장)·AC-07-23·정규식, T-35 TC 등록
8. **07-d**: T-04 7.2.2 재생성 조건, T-17 TC-R-09·신규 TC-R 2행, T-18 TC-R-15 개수, T-19 M8 null, T-26 TC-R-16, T-31 7.8.3·AC-07-26, T-23·T-24 7.6.2, T-07 비차단 행, T-10 "13개·13종·G-01~G-12"
9. **09-a**: T-01 9.5.7 문구, T-02 F01·9.5.6·`lockedBy`·M0 산출물·AC-09-03·9.8.1, T-05 9.9.1·9.9.2, T-03 M4 ④·F 목록
10. **09-b**: 9.4 범위·통과 조건: T-09 M4~M7 기능 배정, T-04 M1 ② 골격·M4 build-answers·AC-09-17, T-06 M3 ③·M4 ①, T-10 AC-09-04·07, T-11 9.1.2·9.1.3·M1 `db:types`·M0 native 기동, T-08 M-행 리터럴 → 키
11. **09-c**: 9.6.2: T-18 시드·수리 규칙·효과표·인덱스·`judge_position_bias`·AC-09-18, T-17 Mock usage 캐시·시나리오 3종, T-34 B24 연결, T-29 B25
12. **01-a**: T-23 1.4.3·1.4.11·1.14.3·AC-01-55, T-24 1.9·1.14.2·1.8.7·1.2·S08 레일·AC-01-56
13. **01-b**: T-22 S03·S12 시트·배너·1.12.1·1.16·AC-01-59, T-25 S03·AC-01-57, T-26 1.7·1.15.3 키·AC-01-58, T-16 S12 "검토 중"·1.10.3, T-20 1.6.5, T-35 AC-01-54, T-30 1.8.4 편집 시 `role_overrides`
14. **04-a**: T-19 4.10.4·AC-04-45, T-18 4.8 매핑·재호출 규칙·AC-04-16·23·47, T-17 4.17.1·4.17.2 참조·AC-04-37, T-34 4.2.1·4.9.4·AC-04-44, T-26 4.9.4
15. **04-b**: T-30 덱 입력·`role_overrides`·AIL-24·AC-04-46, T-28 G-12·AIL-17, T-32 4.16.1·E-14, T-27 4.11.1 주석, T-33, T-10 G-13 표기
16. **03-a**: T-27 3.1.3·3.13.2/3.13.3·AC-03-44, T-28 3.1.5 `expectedSize`·`nav.wordmark`·AC-03-45, T-29 3.1.5a·AC-03-42·46
17. **03-b**: T-30 3.8.1·`VariantDef.text_cols`, T-33 FP15·3.7.3, T-35 AC-03-43, T-32 3.18, 3.15 요약·3.18 반영 추적 표
18. **08-a**: T-13 P14·8.7.7·AC-08-36·55, T-14 8.7.7·AC-08-56, T-15 8.7.7·8.9.5·AC-08-57, T-16 8.7.9·8.9.5, T-11 8.7.5 "서버 경유" 참조, T-12 8.15
19. **02-a**: T-03 2.16.2 목적함수·tuned·AC-02-36, T-07 2.16.1·V-MEAS·AC-02-35, T-06 2.6.1·AC-02-37, T-25 2.13.1·2.9·2.12.2·AC-02-34, T-04 2.15, T-08 AC-02-24·30 키
20. **05-a**: T-06 5.9 앵커 행, T-19 D-056 참조
21. **00-a**: T-20 §9.3, T-17 §9.2·AC-00-14, T-21 §9.4 표, T-22 §8.5 A5·A7, T-13 §8 IP 문장, T-14 AC-00-20, T-12 §10.1, T-10 G-01~G-13, T-31 §5.1 A2, §14 상태·버전 v2.3
22. **잔여 표기 grep**: `render_adjustments`, `supabase gen types`, `NEXT_PUBLIC_SUPABASE`, `\.from\(`(06 예시 제외), `자동 강등하지 않`, `G-01~G-12`, `17개 묶음`, `13개 시나리오\|13종`, `\$0\.23 ± 10%`, `usage를 10배`, `cost_usd <= 0.36`, `IP 원문을 어디에도`, `prompts/\{role\}`, `p95 ≤ (200\|300)ms`(02·09), `docs/spec/00~09`, `AC-03-38`(정의 1건)이 기대 건수와 같아야 한다.

## 사람 확인 필요

에이전트가 결정하지 않는다. HUMAN_TODO로 옮기고, 그동안은 temp·manual·needs_ci 상태로 진행한다. v3 목록은 그대로 유효하다.

- 인증 서버 기록 90일 보관의 적정성(T-13, Q16에 덧붙임)
- 신고 증거·탈퇴 보류 90일 보관의 근거(T-15, Q6에 덧붙임)
- 평가 예산(월 60)과 월 총 LLM 상한 210의 승인, staging 예산(T-21, S-15와 같은 항목)
- 환불 취소 2회/일·계정 일 원가 1.5의 사업 타당성(T-20)
- Supabase 콘솔 Data API 노출 스키마 점검(심층 방어, T-11)과 GoTrue 내부 테이블 실측 덤프(T-13, needs_ci)
- `review-pass` 태그 이후 FINAL 값 검토, tuned 변경 시 muRef 재생성 승인(T-02·T-04)

## 출처 대응표

| 리뷰 항목 | 심각도 | T-ID |
|---|---|---|
| QA3-01 | Blocker | T-01 |
| TL3-01 | Blocker | T-11 |
| LG3-01 | Blocker | T-11 |
| AI3-01 | Major | T-06 |
| AI3-02 | Major | T-19 |
| AI3-03 | Major | T-07 |
| AI3-04 | Major | T-18 |
| AI3-05 | Major | T-03 |
| LG3-02 | Major | T-13 |
| LG3-03 | Major | T-14 |
| LG3-04 | Major | T-15 |
| LG3-05 | Major | T-16 |
| PM3-01 | Major | T-22 |
| PM3-02 | Major | T-20 |
| PM3-03 | Major | T-21 |
| PM3-04 | Major | T-09 |
| PD3-01 | Major | T-31 |
| PD3-02 | Major | T-32 |
| PD3-03 | Major | T-33 |
| PD3-04 | Major | T-34 |
| PD3-05 | Major | T-35 |
| QA3-02 | Major | T-03 |
| QA3-03 | Major | T-04 |
| QA3-04 | Major | T-05 |
| QA3-05 | Major | T-08 |
| QA3-06 | Major | T-09 |
| QA3-07 | Major | T-10 |
| QA3-08 | Major | T-02 |
| TL3-02 | Major | T-12 |
| TL3-03 | Major | T-17 |
| TL3-04 | Major | T-17 |
| UI3-01 | Major | T-27 |
| UI3-02 | Major | T-28 |
| UI3-03 | Major | T-29 |
| UI3-04 | Major | T-30 |
| UX3-01 | Major | T-23 |
| UX3-02 | Major | T-24 |
| UX3-03 | Major | T-25 |
| UX3-04 | Major | T-26 |
| UX3-05 | Major | T-22 |

Blocker 3건과 Major 37건이 각각 정확히 한 T-ID에 대응한다.

## 선택 반영 (Minor)

"포함"은 해당 T 행이 이미 처리한다. "선택"은 해당 장 반영 단위에서 리뷰 원문 보완안대로(괄호 안 한 줄 결정이 있으면 그것으로) 처리하고, 시간이 없으면 다음 라운드로 넘겨도 된다. 레지스터와 충돌하면 레지스터가 이긴다.

| 역할 | 항목별 처리 |
|---|---|
| AI | AI3-06 포함 T-08 · AI3-07 선택(05 "95% ≤ 0.10"은 `release.extractor` 비차단 기록 키, 카드 판정은 0.15 하나) · AI3-08 선택(안 a: argmax면 `beta` 금지, 판별 유니온) · AI3-09 포함 T-18 |
| LG | LG3-06 선택(06 6.1.3 흐름표에서 파생한 예시) · LG3-07 선택 · LG3-08 선택 · LG3-09 선택(LG2-08~11 원문) · LG3-10 선택 |
| PM | PM3-05 00-a에서 처리(reason 4값·G-13·실효 동시 2·aal2, T-12 문장) · PM3-06 선택("예산 상향 결정 후" 단서) · PM3-07 00-a에서 처리(v2.3, 우선순위에 decisions_v4) · PM3-08 포함 T-08 |
| PD | PD3-06 선택(4.4 7키 순서, 순서형 up/down·명목형 changed) · PD3-07 03-b에서 처리 · PD3-08 선택(결과 화면 전 진행, 동일 쌍 제외) · PD3-09 선택([P2]로 00 §7.1에) |
| QA | QA3-09 포함 T-09 · QA3-10 포함 T-08 · QA3-11 포함 T-17 ⑤ · QA3-12 부분 포함(TC-R-16 = T-26, 인덱스 = T-18, M5 키 = T-08). `GM1~GM15` 개명은 하지 않는다(전 장 개명 비용이 큼) |
| TL | TL3-05 포함 T-18 · TL3-06 09-b에서 처리(잠금 파일 경로 `config/lock/locked-hashes.json` 하나) · TL3-07 선택(zod `uuid()`, 틀리면 재발급) · TL3-08 선택(6.7 참조 + `itemsetHash`) · TL3-09 06-b·09-b에서 처리 · TL3-10 포함 T-17 ④ · TL3-11 포함 T-11 ④ |
| UI | UI3-05 선택(registry 3값·런타임 `page`, 확장 face 먼저 선언, S09 폰트 ≤ 1.5MB) · UI3-06 선택(`role` += `tint\|none`, 24개/192건, "라벨"은 T-27) · UI3-07 선택(04 표를 `harmony.json` 생성본으로, ID 중복은 T-10) · UI3-08 선택(데스크톱 크기 기준, AC-03-25 FP20 예외) |
| UX | UX3-06 선택 · UX3-07 선택(`queuedAt` 기준, AC-01-51 Given = 실효 상한) · UX3-08 선택("공백 제외 ≤ 12자", `result.cta` = "내 사이트 시안 만들기") · UX3-09 01-a·01-b에서 처리 · UX3-10 선택(T-09 M5 초대 범위와 함께) |
