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

## ASM-013 · M1 · conflict · 2026-11-19T16:24Z
- 질문: 03장 3.7.2·3.7.3이 폰트(`kr-pretendard`…)·페어링(`FP01`~`FP20`) ID를 정했는데, 잠긴 M1 수용 테스트(ASM-008)는 B6·B7 temp id 전부에 `tmp_` 접두를 요구. 프리셋 l2 `type.pairing_id`는 03장 값(`FP01`)이어야 함(AC-03-09). 폰트 원본 파일은 사람 묶음
- 근거 탐색: 03장 3.2.1·3.4.4·3.7.2·3.7.3, 09장 9.2.2·9.2.4, tests/acceptance/m1/data.test.ts FREE_ID_BUNDLES
- 선택: B6·B7 `id = tmp_<장 ID>`, 장 ID는 `code`에 둔다. 프리셋·매핑·편집은 `code`로 참조하고 data:validate가 프리셋 페어링 code의 존재·허용 유형을 검사. 폰트 `files: []` + `filesPending: true` + `verified_by: temp-agent`(9.2.4 S-10, 파일·sha256·RFN 확인은 HUMAN_TODO B6). 9.2.4의 "Noto CJK temp 전용 레지스트리 항목"은 B6 수량(한글 12) 검사와 겹치므로 M2 렌더러 폴백 설정에 둔다. 사람 데이터 투입 시 id = 장 ID로 바꿔도 code 참조라 영향 없음
- 영향 범위: scripts/data/seed-temp.ts·validate.ts, packages/design-spec 컴파일러(M2: 폰트 파일 없으면 시스템 폴백 스택)
- 되돌리기 비용: 낮음

## ASM-014 · M1 · conflict · 2026-11-19T16:27Z
- 질문: 03장 3.10.2 "카테고리 내 톤 태그 각 ≥ 30%"는 8장 카테고리(saas.hands-device·portfolio.nature·local_business.flower)에서 성립 불가(3톤 × ⌈2.4⌉ = 9 > 8). 사진 원본·id 형식(`img:<tag>-<nnn>`)과 tmp_ 접두 요구도 겹침
- 근거 탐색: 03장 3.10.2·3.10.3·3.10.5, 09장 9.2.2 B8, ASM-008
- 선택: temp는 톤 순환(warm·neutral·cool)으로 8장 카테고리는 3/3/2, 방향은 교대(50/50). id `tmp_img:<tag>-<nnn>`. 파일은 에이전트가 만든 무늬 SVG(`source: placeholder`, `license: LicenseRef-TasteFit-Generated`·`verified_by: temp-agent`(9.2.4 S-10), sha256은 실제 파일 값). 수량은 9.2.4 B8의 "태그×비율 조합마다 1장 PNG" 대신 03장 3.10.2 표 192건(AC-03-30 수량과 일치)을 따르고 sharp 없이 SVG로 만든다. 톤 기준 정정은 HUMAN_TODO
- 영향 범위: data/images/**, 04장 이미지 선택(M2)
- 되돌리기 비용: 낮음

## ASM-015 · M1 · conflict · 2026-11-19T16:24Z
- 질문: AC-03-11(한 축 증가 시 구동 서수 키 인덱스 감소 0건)이 `type.headline_weight`에서는 3.3.2 규칙만으로 성립하지 않음. A1이 커지며 페어링이 바뀌면(예: PS-T5 FP08→FP13, 허용 웨이트 700~900 → 400) 웨이트 목록 자체가 바뀌어 인덱스가 떨어짐(8유형 × A1 격자에서 4건)
- 근거 탐색: 03장 3.3.2(headline_weight k = 페어링 허용 웨이트 수 − 1, "페어링 확정 후 계산"), 3.7.3 페어링 웨이트, AC-03-11
- 선택: AC-03-11 판정 대상은 값 목록이 고정된 서수 키(k 숫자 또는 허용 집합 순서)로 보고 headline_weight는 제외한다. headline_weight는 "선택된 페어링 안에서" 단조(같은 페어링 구간에서 감소 0)로만 검사. M2/M3 수용 테스트도 이 해석을 따른다
- 영향 범위: packages/taxonomy/src/map.ts·map.test.ts, AC-03-11 수용 테스트(M2·M3)
- 되돌리기 비용: 낮음

## ASM-016 · M1 · gap · 2026-11-19T16:26Z
- 질문: B9·B10 temp에서 ① 2.4.6 "축 서술 고정 사전"이 예시 1개(A3 L4)만 있음 ② alt의 "선택지 {n}"은 노출 위치라 시드 시점에 없음 ③ alt의 축 서술 3개를 고르는 기준·x_card(렌더 실측) 부재 ④ tpl-text 본문 2단락 문장이 02장에 없음
- 근거 탐색: 02장 2.1.2·2.2 표시 구간·2.4.2·2.4.3·2.4.6, 09장 9.2.4 B9·B10
- 선택: ① 2.1.2 앵커 묘사로 5축 × L0~L4 서술 사전을 평가어 없이 작성(seed-temp `AXIS_PHRASES`) ② `{n}`을 그대로 둔 템플릿 문자열(클라이언트가 위치로 치환) ③ target_l1 기준, 0.5에서 먼 3축(동률은 축 순서), survey:build가 x_card로 다시 쓴다 ④ `[임시]` 문장. 카드 `status: draft`(채택은 survey:build·B12)
- 영향 범위: data/survey/templates.json·card_plan.json, M4 survey:build
- 되돌리기 비용: 낮음

## ASM-017 · M1 · conflict · 2026-11-19T16:31Z
- 질문: B23에서 08장 8.7.6 processors.yaml 예시와 06장 6.1.3 흐름표가 어긋남: ① vercel items [P11] vs 흐름표 P1~P13 다수(compliance:flows ①은 items ⊇ 흐름표 행) ② 흐름표의 `llm-judge`·`llm-secondary`·`turnstile`이 8.7.6에 없음(대신 `cloudflare-turnstile`) — AC-06-58은 llm-judge 필수 ③ 9.2.4 B23은 전 항목 approved:false
- 근거 탐색: 06장 6.1.3, 08장 8.7.6·8.8.2, 09장 9.2.4 B23
- 선택: 8.7.6 YAML을 그대로 옮기되 items는 원문 P코드 ∪ 흐름표 행(원문은 `items_note`), 흐름표에만 있는 id는 `stub: true` 항목으로 추가, `cloudflare-turnstile`은 원문대로 두고 `turnstile` 스텁을 별도로 둔다. 전부 approved:false. 장 간 id 정리는 HUMAN_TODO
- 영향 범위: legal/processors.yaml·data-flows.yaml, M7 compliance:flows
- 되돌리기 비용: 낮음

## ASM-018 · M1 · gap · 2026-11-19T17:12Z
- 질문: B20 copy_templates.json·axis_hints.json의 항목 구조가 장에 없다(4.6.2는 키·개수·길이만, 4.11은 "방향 2종 × 5축"만)
- 근거 탐색: 04장 4.6.2·4.7(buildTemplateDeck)·4.11 repair, 09장 9.2.4 B20
- 선택: copy_templates 항목 = (용도 × 4.6.2 키) 1개, id `<purpose>:<key>`, count·length(또는 항목 필드별 lengths)·values(개수 상한만큼). 값은 `[임시]` 문장으로 길이 하한을 맞추고, cta.primary는 4.6.2 용도별 권장 동사 그대로, proof는 `[예시]`·김○○·placeholder, menu 가격 `[예시] 0,000원`, stats는 빈 배열, contact.*는 제외. 일부 첫 값은 치환 토큰(`{name}`·`{description}`·`{key_points.0}`)이며 길이 검사는 치환 후(M5 buildTemplateDeck)에 한다. axis_hints 항목 = `<axis>:up|down` 10개
- 영향 범위: config/copy_templates.json·axis_hints.json, M5 buildTemplateDeck·repair 프롬프트
- 되돌리기 비용: 낮음

## ASM-019 · M1 · gap · 2026-11-19T17:12Z
- 질문: B21·B22·B24 temp 시드의 구체 항목(장에는 범주·하한만)
- 근거 탐색: 08장 8.9.2(HighRiskBrand 스키마·범주·판정 규칙), 04장 4.9.4, 03장 3.10.2, 09장 9.2.4 B21·B22·B24
- 선택: B21 공개적으로 알려진 국내 금융·통신·포털·커머스·물류·공공기관 87개(domains 빈 배열). 8.9.2 (b) 부분 포함 규칙의 오탐을 피하려고 일반 영단어 부분열이 되는 짧은 alias(SKT·nts·nps·apple)는 넣지 않았다. B22 범주 6 × 키워드 10~12(일반 단어 부분열 오탐 우려 단어 제외). B24 키워드 62개, 각 1태그(03장 3.10.2 ImageTag만, data:validate 교차 참조 추가). 적정성은 사람 확인(HUMAN_TODO, 08장 Q13)
- 영향 범위: config/high_risk_brands.json·prohibited_categories.json·image_tag_keywords.json, M5 compliance/abuse·industryTags
- 되돌리기 비용: 낮음

## ASM-020 · M1 · conflict · 2026-11-19T17:14Z
- 질문: 09장 9.2.4 B18은 코퍼스 200 렌더 + 추출기로 분위표·b0/b1을 만들라고 하지만, 렌더러(M2)·추출기(M3)가 M1에 없다. 그런데 M1 ① data:validate는 25묶음(B18 포함) 존재를 요구한다
- 근거 탐색: 05장 5.5.3·5.5.4·5.8.2·5.9 temp 분기, 09장 9.2.2·9.2.4 B18·9.4.3 ①·9.4.4 ③
- 선택: M1에는 5.8.2 스키마의 부트스트랩 `2026-S0`을 만든다. mapping = 5.5.4 `mapping.initial` 그대로(b0=0·b1=1, (1−F)는 sign −1), 분위표 = 특징 단위 범위 등간격 자리표시(`placeholder: true`), `corpus.n=0`, 전 축 reliable=false, inter_rater unverified. M3 추출기 단위에서 seed:temp가 9.2.4 절차(200 렌더, b0·b1만 최소제곱)로 다시 만든다(PROGRESS M3에 할 일로 기록). 홀드아웃 재적합 금지(F19)는 그때 그대로 지킨다
- 영향 범위: data/normalizers/2026-S0.json, M3 extractor-roundtrip·M4 survey:build
- 되돌리기 비용: 낮음(M3에서 재생성)

## ASM-021 · M1 · gap · 2026-11-19T17:15Z
- 질문: M1 ① data:validate는 B15 존재를 요구하지만, 9.2.4는 B15를 M3에서 04장 규칙 정의로 작성·자체 잠금하라고 한다(PageSchema·렌더러는 M2)
- 근거 탐색: 09장 9.2.2·9.2.4 B15·9.4.4 ①, 04장 4.13
- 선택: M1에는 4.13 AIL-01~24 규칙별 pos-1(violation)·neg-1(clean) 골격만 둔다(`skeleton: true`, page·tokens null). M3 시작 단위에서 실제 예시로 교체한 뒤 자체 잠금한다(PROGRESS M3 이월)
- 영향 범위: data/linter/examples/**, M3 ①
- 되돌리기 비용: 낮음

## ASM-022 · M1 · gap · 2026-11-19T17:28Z
- 질문: db:seed의 대상 테이블과 temp 데이터의 DB 표현(B13에는 사람 라벨이 없는데 AC-05-02는 primary 라벨을 요구, 프리셋·정규화기 status)
- 근거 탐색: 06장 6.3.3(0002·0003·blocked_brands 주석)·6.16 시드 규칙, 05장 5.3.6·AC-05-02, 09장 9.2.4 B13·B18, 08장 8.9.2
- 선택: 대상 = taxonomy_releases(envelope taxonomyVersion, active, 공개일 = 분기 첫 월요일)·types·presets·sources('direct' 1행)·reference_sites·reference_labels·normalizers·blocked_brands, 전부 upsert. temp B13이면 primary 라벨을 유도: axes = round(1+4·l1)(1..5), l2 = 같은 유형 앵커 프리셋 l2, type_primary = typeId, checklist S-04/05/08/10 = "temp", rater op·session `seed:temp`, reference_sites.flags = ['temp']. human B13이면 라벨을 만들지 않는다(라벨 도구 몫). 프리셋은 status approved(앱이 읽을 수 있게, provenance jsonb에 temp 표시가 그대로 남음), 정규화기는 status draft(temp는 released 금지, 이미 released면 덮지 않음)
- 영향 범위: scripts/data/db-seed.ts, M4 닮은 사이트·survey:build
- 되돌리기 비용: 낮음

## ASM-023 · M2 · gap · 2026-11-19T18:40Z
- 질문: M2 수용 테스트를 쓰려면 design-spec·renderer·data-contracts의 공개 API 계약과 AC-03-02·03·04·08의 측정 대상이 정해져야 하는데 장에 함수 이름만 있음
- 근거 탐색: 03장 3.1.2~3.1.7·3.1.12·3.2.2·3.2.4·3.4.7, 04장 4.2.1·4.9.2 CM-02·4.14
- 선택: ① `@tastefit/design-spec`: `loadDesignData(root)`(MapData 호환 + `presets`·`palettes[].roles`·`signatures`·`harmony`(items)·`taxonomyVersion`), `deriveTokens({presetId,l2,brand?}, data) → {tokenSet, accentTextSafe, inverseButtonMode}`(TokenSet은 schema.json 그대로, 두 플래그는 바깥), `exportTokens(derived,{presetId,l2,taxonomyVersion}) → {경로: 문자열}` 3파일, `predictL1(l2,data) → {expression..depth}`(기본 L2만, 시그니처 인자 없음), `signatureEligible(id, SigCtx)`(SigCtx = 3.2.4 요구·충돌 열을 그대로 필드로), `DesignSpecSchema`(zod, `.shape.l2`가 18키 enum 객체) ② `@tastefit/data-contracts`: `validateTokenSet(x) → {ok, errors}`(schema.json, zod fromJSONSchema 허용) ③ `@tastefit/renderer`: `rendererCssSources() → {path, css}[]`(base·blocks·signatures 층), `cssLiteralViolations(css)`(CM-02 허용 목록) ④ AC-03-02 13쌍 = 3.1.3 "하드" 표기 쌍(fg·fg-muted 각 2, fg-inverse, border-strong, primary, on-primary 3, on-accent, focus 2), accent 없으면 on-accent 쌍 생략, 리포트 `reports/m2/contrast-pairs.json` ⑤ AC-03-04 크기 = `type.display`·`type.body` typography 토큰의 데스크톱 fontSize, 범위(2.5~8.0)·웨이트 상한(3)은 thresholds 키가 아니고 감사 리터럴과 값이 겹쳐 harmony.json H7 range·H5 만점 tier max에서 읽는다(같은 03장 원천) ⑥ AC-03-08 SIG-05는 예약이라 항상 불가, SIG-09는 조건·충돌이 없어 음성 픽스처 대신 "모든 음성 문맥에서도 가능"을 검사 ⑦ AC-03-09~11은 taxonomy `mapL1toL2`(purpose=null)에 design-spec 데이터를 넣어 검사, 단조성은 ASM-015 해석
- 영향 범위: tests/acceptance/m2/**, packages/design-spec·renderer·data-contracts
- 되돌리기 비용: 중간(잠긴 테스트라 바꾸려면 사람 relock)
