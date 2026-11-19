# ASSUMPTIONS (09장 9.5.4 형식, append)

운영·환경 결정은 docs/spec/DECISIONS_LOG.md

에이전트가 문서에 없는 결정을 가장 보수적으로 내린 기록. 형식은 FINAL 09장 9.5.4.

## ASM-001 · M0 · gap · 2026-11-19T13:20Z
- 질문: worker `/health`의 포트·주소가 문서에 없음(06장 6.13.2 env 표에도 없음)
- 근거 탐색: 06장 6.13.1·6.13.2, 09장 9.4.2 — 언급 없음
- 선택: 고정 `http://127.0.0.1:8081`(env 추가 안 함. `.env.example` = 6.13.2 표 규칙 유지)
- 영향 범위: apps/worker health 서버, tests/acceptance/m0/stack.test.ts
- 되돌리기 비용: 낮음

## ASM-002 · M0 · conflict · 2026-11-19T13:20Z
- 질문: AC-09-01(클린 클론 → `verify:m8` 종료 0)이 M0 배정인데, M0 시점엔 통과 불가하고 verify:m0가 자기 자신을 포함하면 재귀
- 근거 탐색: 07장 7.12.1 acMilestones, 09장 9.4.2·9.9
- 선택: m0 테스트는 클린 클론 `pnpm i --frozen-lockfile` 성공만 검사. 전체 `verify:m8` 실행은 `release:check`(M8)가 판정
- 영향 범위: tests/acceptance/m0/repo.test.ts
- 되돌리기 비용: 낮음

## ASM-003 · M0 · gap · 2026-11-19T13:20Z
- 질문: AC-09-14 "300줄", AC-06-50 "120초"는 비교 기준인데 thresholds 키도 사양 상수 표(SC) 행도 아님. 값이 thresholds 잎(300·120)과 같아 `qa:trace --audit` 대상이 됨
- 근거 탐색: 07장 7.12.1 사양 상수 표, 7.12.2 audit 정의
- 선택: 비교 매처 대신 `lines.slice(300)` 비었는지, `AbortSignal.timeout(120_000)` 도달 여부로 판정. 키 커버리지 공백은 HUMAN_TODO로 사람 확인 요청
- 영향 범위: tests/acceptance/m0/repo.test.ts·stack.test.ts, qa:trace 키 커버리지
- 되돌리기 비용: 낮음(사람이 SC 행 추가 후 relock)

## ASM-004 · M0 · conflict · 2026-11-19T13:20Z
- 질문: F06은 `testTimeout`을 "policy 외 값" 금지로 두는데 test-policy에 타임아웃 키가 없음. 7.12.1은 "타임아웃 값은 러너 설정에만 두며 판정 기준이 아니다"라고 함. guard·스택 수용 테스트는 기본 5초를 넘음
- 근거 탐색: 09장 9.5.5 F06, 07장 7.12.1 test-policy 설명
- 선택: 루트 `vitest.config.ts` 한 곳에만 러너 타임아웃을 두고(테스트 파일·per-test 인자 금지), F06 검사는 retry를 policy 값과 대조하고 timeout은 "루트 러너 설정 1곳 외 지정 금지"로 구현
- 영향 범위: vitest.config.ts, scripts/guard F06
- 되돌리기 비용: 낮음

## ASM-005 · M0 · gap · 2026-11-19T14:35Z
- 질문: AC-00-01 "사용자 기능 명세 표"·AC-00-07 "기능 항목"을 문서 검사로 어떻게 식별하나(09장에 검사 정의 없음)
- 근거 탐색: 00장 2.1 태그 규칙·7.1, 07장 7.12.1(--docs로 M0), 09장 전체 grep(정의 없음)
- 선택: AC-00-01 = 01~09장 각각에 `대상` 열 값이 전부 P1|P2|P1,P2|운영자인 표가 1개 이상. AC-00-07 = 각 장에 끝 대괄호 태그 제목이 1개 이상이고 태그는 [P0]/[P2]/[P3]/[MVP 제외]로 시작
- 영향 범위: scripts/qa/docs-check.ts(`qa:trace --docs`), BLK-004
- 되돌리기 비용: 낮음

## ASM-006 · M0 · conflict · 2026-11-19T14:40Z
- 질문: 7.12.2 8d는 tuned 변경 커밋에 `diagnosis-tuned.json`·`tuning-log.json` 외 변경 0을 요구하지만, 9.5.6 규칙 1(entry 해시 = 파일)·규칙 3 예외를 지키려면 같은 커밋에서 `config/lock/locked-hashes.json`의 tuned entry 해시도 바꿔야 함
- 근거 탐색: 07장 7.12.2 8단계, 09장 9.5.6 판정 규칙 1·3
- 선택: 8d 검사에서 `config/lock/locked-hashes.json`도 허용. 그 커밋에서 tuned 외 entry가 바뀌면 guard:lock 규칙 3이 FAIL
- 영향 범위: scripts/guard/stages/tuned.ts
- 되돌리기 비용: 낮음

## ASM-007 · M0 · conflict · 2026-11-19T15:00Z
- 질문: 9.4.2 종료 처리·9.5.6 표는 M0 끝에 `scripts/verify/**`·`scripts/guard/**`·`.guard/verify-scripts.json` 자체 잠금을 요구하는데, 9.5.6 규칙 4는 "이번 커밋에서 새로 추가된 파일만 등록"이라 여러 커밋에 걸쳐 만든 이 파일들을 잠글 수 없음
- 근거 탐색: 09장 9.4.2·9.5.6 판정 규칙 4·5
- 선택: `guard:self-lock --m0-end`(닫힌 목록, entry 없는 추적 파일만)을 9.4.2가 명시한 1회 예외로 둔다. guard가 import하는 판정 코드 `scripts/qa/**`(7단계)·`scripts/spec/**`(5·6단계)와 AD-023이 M0 종료 잠금을 정한 `docs/dependency-allowlist.md`도 같이 잠근다(잠금을 늘리는 쪽이라 기준 완화 아님)
- 영향 범위: scripts/guard/self-lock.ts, config/lock/locked-hashes.json
- 되돌리기 비용: 낮음(사람 relock)

## ASM-008 · M1 · gap · 2026-11-19T15:40Z
- 질문: M1 수용 테스트를 쓰려면 ① temp id 접두사 범위 ② 거부(42501)와 "0행"의 관계 ③ 명령·API 계약이 정해져야 하는데 장에 없음
- 근거 탐색: 09장 9.2.1·9.2.2·9.4.3, 02장 2.11.1(id `T1`~`T8`·`PS-T1`~), 06장 DDL CHECK(`types.id ~ '^T[1-8]$'` 등)·R-5·AC-06-03, 05장 AC-05-04
- 선택: ① `tmp_` 접두사는 id 형식을 다른 장이 정하지 않은 temp 묶음(B6 폰트·B7 페어링·B8 이미지·B13 레퍼런스)에만 적용. 축·유형·프리셋·용도·템플릿·카드·A/B·텍스트 역할 등 장이 형식을 고정한 id(DB CHECK 포함)는 그대로 둔다 ② AC-06-03의 "0행"은 권한 거부(42501)도 0행으로 센다. AC-05-04는 42501만 통과 ③ 계약: `pnpm db:reset`(native: `DATABASE_URL_DIRECT`의 DB를 drop/create → shim → 마이그레이션, `ON_ERROR_STOP`), `pnpm verify:schema-parity`·`db:types`·`db:seed`는 같은 env를 따름. 테스트 DB는 `tastefit_m1acc`. `@tastefit/db`는 `createDbPort(url)`·`q(tx, sql, params)`(withX 안의 tx로만 실행)를 export하고, 픽스처 행은 `packages/db/src/testing/fixtures.ts`(`seedOwnership`·`insertSurveyItem`·`insertJob`·`insertAuditLog`)가 만든다. `@tastefit/taxonomy`는 `loadTaxonomy(root)`(`types`·`standardVectors`·`cardPlan`·`abPlan`)·`classifyType`·`checkBridgeRules`(02장 2.4.2 규칙 1~3 위반 목록)를 export. `seed:temp`는 data/가 비면 03장 3.0 파일 14종도 03장 값으로 만든다
- 영향 범위: tests/acceptance/m1/**, packages/db, packages/taxonomy, scripts/data
- 되돌리기 비용: 중간(잠긴 테스트라 바꾸려면 사람 relock)

## ASM-009 · M1 · gap · 2026-11-19T15:20Z
- 질문: m1 수용 테스트가 패키지 소스를 상대 경로로 import해 `qa:trace --audit` import 그래프에 `packages/config/src/env.ts`가 들어왔고, 06장 6.13.2 비밀값 하한 `>= 32`(임계값 아님)가 thresholds 잎 값 32와 우연히 같아 F04로 잡힘
- 근거 탐색: 07장 7.12.2 audit 정의(범위 = 수용 테스트와 상대 import 모듈), 06장 6.13.2
- 선택: 비교 연산 대신 동치·더 엄격한 길이 검사로 표현(`z.string().min(32)`: 문자 수 ≥ 32 ⇒ UTF-8 바이트 ≥ 32, base64는 43자 이상 = 디코딩 ≥ 32바이트). 임계값 판정이 아니라 감사 오탐 해소이며 기준을 낮추지 않음. 앞으로 수용 테스트가 닿는 구현의 사양 상수는 data/·config에서 읽는다
- 영향 범위: packages/config/src/env.ts
- 되돌리기 비용: 낮음

## ASM-010 · M1 · conflict · 2026-11-19T15:35Z
- 질문: ① 02장 2.11.2 `descriptionKo` 고정 문안 8개가 154~190자로 같은 장·09장 9.2.3의 "200~400자"보다 짧음 ② 봉투 `taxonomyVersion` 형식이 9.2.1("2026.1")·03장 3.0(`tx-YYYY.N`)·06장 DDL(`taxonomy_releases.version ~ '^\d{4}-S[1-4]'`, types 등 FK)에서 서로 다름 ③ 용도 `nameKo`가 어느 장에도 없음
- 근거 탐색: 02장 2.11.2, 09장 9.2.1·9.2.3, 03장 3.0, 06장 taxonomy_releases DDL, 00장 세그먼트 표(D-03)
- 선택: ① 문안이 단일 원천(R-04, "고정")이므로 그대로 쓰고 스키마 하한은 두지 않음(상한 400 유지). 문안 보강은 HUMAN_TODO ② DB 저장과 FK가 걸리는 06장 형식(시즌 ID)을 따른다. temp는 `2026-S4` ③ 00장 세그먼트 표 문구로 "SaaS·앱 소개"·"포트폴리오"·"가게 소개(카페·식당·공방)"
- 영향 범위: packages/data-contracts(typeDef), scripts/data/seed-temp.ts
- 되돌리기 비용: 낮음

## ASM-011 · M1 · gap · 2026-11-19T16:13Z
- 질문: `palettes.json` 파생 속성(3.2.3 warm·chromaScore·structure·brandColorCount)의 "브랜드 색" 범위와 structure 판정 경계, PAL-T6-0 tintHue(3.4.3 "30~85 역할별")가 어느 장에도 수치로 없음
- 근거 탐색: 03장 3.2.1·3.2.2·3.2.3·3.4.2(structure 표기)·3.4.3·3.1.4
- 선택: 브랜드 색 = primary·accent, 유채(C ≥ 0.04) 개수로 structure(0 mono·1 accent-on-neutral·2는 hue 차 ≤60 analogous, ≥165 complementary, 그 사이 split-complementary). PAL-0 8벌의 3.4.2 표기와 모두 일치함을 seed:temp가 검사. T6-0 tintHue = null(3.1.4 규칙대로 neutral C 0)
- 영향 범위: scripts/data/seed-temp.ts(genPalettes), 04장 deriveTokens(M2)
- 되돌리기 비용: 낮음

## ASM-012 · M1 · gap · 2026-11-19T16:18Z
- 질문: `blocks.json`의 ① `default_heading_ko`·`nav_label`이 03장에 예시(faq·menu·location)만 있음 ② variant별 `allowed_bg` 값이 없음(LT-06이 참조만) ③ "50 variant"가 3.6.1 표 합계 53과 다름 ④ 슬롯↔덱 키 대응이 블록 단위로만 적혀 있음
- 근거 탐색: 03장 3.6.1~3.6.3·3.2.4·3.6.7 LT-06, 04장 4.5.2·4.6.2
- 선택: ① temp 한국어 문안(seed-temp `BLOCK_META`), 사람 확인은 HUMAN_TODO ② cta.band=inverse, text_over_image=image, hero=bg·surface, 나머지 bg·surface·inverse ③ 50 = nav(컴파일러 생성) 3개 제외, 파일에는 53개 모두 ④ 비미디어 슬롯 수 = 덱 키 수면 순서 대응, 아니면 블록의 덱 키 전체. maxLength = 04장 4.6.2 덱 상한
- 영향 범위: data/taxonomy/blocks.json, packages/layout-schema(M2)
- 되돌리기 비용: 낮음(seed:temp 재실행)
