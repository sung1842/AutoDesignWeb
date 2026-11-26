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

## ASM-023 · M2 · gap · 2026-11-19T18:12Z
- 질문: M2 수용 테스트를 쓰려면 design-spec·renderer·data-contracts의 공개 API 계약과 AC-03-02·03·04·08의 측정 대상이 정해져야 하는데 장에 함수 이름만 있음
- 근거 탐색: 03장 3.1.2~3.1.7·3.1.12·3.2.2·3.2.4·3.4.7, 04장 4.2.1·4.9.2 CM-02·4.14
- 선택: ① `@tastefit/design-spec`: `loadDesignData(root)`(MapData 호환 + `presets`·`palettes[].roles`·`signatures`·`harmony`(items)·`taxonomyVersion`), `deriveTokens({presetId,l2,brand?}, data) → {tokenSet, accentTextSafe, inverseButtonMode}`(TokenSet은 schema.json 그대로, 두 플래그는 바깥), `exportTokens(derived,{presetId,l2,taxonomyVersion}) → {경로: 문자열}` 3파일, `predictL1(l2,data) → {expression..depth}`(기본 L2만, 시그니처 인자 없음), `signatureEligible(id, SigCtx)`(SigCtx = 3.2.4 요구·충돌 열을 그대로 필드로), `DesignSpecSchema`(zod, `.shape.l2`가 18키 enum 객체) ② `@tastefit/data-contracts`: `validateTokenSet(x) → {ok, errors}`(schema.json, zod fromJSONSchema 허용) ③ `@tastefit/renderer`: `rendererCssSources() → {path, css}[]`(base·blocks·signatures 층), `cssLiteralViolations(css)`(CM-02 허용 목록) ④ AC-03-02 13쌍 = 3.1.3 "하드" 표기 쌍(fg·fg-muted 각 2, fg-inverse, border-strong, primary, on-primary 3, on-accent, focus 2), accent 없으면 on-accent 쌍 생략, 리포트 `reports/m2/contrast-pairs.json` ⑤ AC-03-04 크기 = `type.display`·`type.body` typography 토큰의 데스크톱 fontSize, 범위(2.5~8.0)·웨이트 상한(3)은 thresholds 키가 아니고 감사 리터럴과 값이 겹쳐 harmony.json H7 range·H5 만점 tier max에서 읽는다(같은 03장 원천) ⑥ AC-03-08 SIG-05는 예약이라 항상 불가, SIG-09는 조건·충돌이 없어 음성 픽스처 대신 "모든 음성 문맥에서도 가능"을 검사 ⑦ AC-03-09~11은 taxonomy `mapL1toL2`(purpose=null)에 design-spec 데이터를 넣어 검사, 단조성은 ASM-015 해석
- 영향 범위: tests/acceptance/m2/**, packages/design-spec·renderer·data-contracts
- 되돌리기 비용: 중간(잠긴 테스트라 바꾸려면 사람 relock)

## ASM-024 · M2 · gap · 2026-11-19T18:18Z
- 질문: 04장 AC-04-03~10·30 수용 테스트를 쓰려면 compileSpec·calibrate·LayoutTreeRaw·정적 린트의 공개 API와 "대표 벡터"·골든 입력이 정해져야 함
- 근거 탐색: 04장 4.2.1·4.2.2·4.3·4.4·4.5.2·4.14, 02장 2.3.1 TasteResult, 09장 9.4.4, data/golden(GS-01~32, persona.thetaStar)
- 선택: ① `compileSpecs({taste: TasteResult, purpose, brand: {brand_color} | null, jobSeed}, data) → {v_true, v_fit, v_bal}`(변형 간 거리·L2 차이 강제가 서로 의존하므로 3개를 함께 만든다. compileSpec 1개 = 그 원소) ② `calibrate({taste, purpose, alpha}, data) → {v1, v2, g, ...}`(Vec5는 R-01 키 객체), 용도 표는 04장 4.3 값, 유형 범위 = 앵커 ± 0.20을 [0,1]로 자른 값 ③ 대표 벡터 = μ: 앵커, σ: 0.08 전 축, κ: 0.8, 둔감 축 없음 ④ AC-04-08 L2 층은 골든 θ*를 μ로 넣어 7키(depth는 style|level 묶음, hero는 hero_variants 목록) 차이 ≥ l2DiffMin. 렌더 D ≥ 0.15 충족률은 render.test(01e) ⑤ `@tastefit/linter`의 `staticLint(spec) → {rule, severity}[]`(M2는 단계 S 최소 구현) ⑥ `@tastefit/layout-schema`의 `LayoutTreeRawSchema`(zod)·`layoutTreeRawJsonSchema()`, 퍼징 기준 트리 = fixtures/layouts 첫 파일(`raw` 필드가 있으면 그것) ⑦ 기준 구현의 κ 구간 상수는 표(KAPPA_BANDS)로 둔다(기대값 계산식이며 판정 기준이 아님) ⑧ 무채 브랜드 입력의 hue 비교·±5°·0.20 대조는 BLK-007로 단위 테스트 ⑨ 브랜드가 accent로 강등되면 on-accent 쌍 생략(3.13.2 S-37)
- 영향 범위: tests/acceptance/m2/spec.test.ts, packages/design-spec·layout-schema·linter
- 되돌리기 비용: 중간(잠긴 테스트)

## ASM-025 · M2 · gap · 2026-11-19T18:21Z
- 질문: 03장 AC-03-15~27·42·45·46 수용 테스트를 쓰려면 렌더 하네스·렌더러·표준 트리·게이트 API와 "골든 세트 시안"(M5 전)의 대체가 정해져야 함
- 근거 탐색: 03장 3.1.5·3.1.5a·3.5·3.6·3.7·3.8, 04장 4.9·4.10.2, 09장 9.4.4(하드 게이트 4종 선구현), dependency-allowlist(playwright는 worker·e2e)
- 선택: ① `apps/worker/src/render/harness.ts`: `openHarness() → Harness{measure(html, vw, {spec}?), withPage(html, vw, fn(page)), platformFontsForHangul(html, vw) → {selector,family}[], firstViewFontBytes(html, vw), headlineLines(html, vw) → {role,lines,lastLineChars}[], close()}` ② `@tastefit/scoring`: `evaluateGates(measure, ids) → {id, pass, violations}[]`(M2: G-02·03·04·05·06·07·12, AIL-17), `harmonyScore(spec, tree).total` ③ `@tastefit/renderer`: `compilePage(spec, tree, data) → {html}`, `renderBlockSample({presetId,block,variant,purpose,copy:'max'|'typical'}, data) → html|null`(프리셋 제외 variant면 null), `renderComponentGallery(presetId, data, {copy}) → {html, cases}`(각 케이스 `data-case`), `renderStepProbe(spec, data)`(단계 9개 `data-step-probe`) ④ `@tastefit/design-spec`: `standardTree(typeId, purpose, data, {pairingId?}) → {spec, tree}`, `expectedSize(tokens, step, vw)`, `letterSpacingEm(px, 'sans'|'serif'|'latin-heading')` ⑤ `@tastefit/layout-schema`: `copyDeckLimits() → {덱키: 수 | {필드: 수}}`(04장 4.6.2) ⑥ `@tastefit/linter`: `treeLint(spec, tree) → {rule, message}[]` ⑦ `@tastefit/data-contracts`: `validateBundle(경로, json) → {ok, errors}` ⑧ blocks.json 비미디어 슬롯에 `textRoles`(배열) 필드를 둔다(AC-03-46 ①), fallback 체인 끝 = image null variant 또는 `"remove"` ⑨ AC-03-22: verified_at은 provenance temp일 때만 null 허용(사람 검증 전), human이면 빌드 실패 ⑩ AC-03-24·26 "골든 세트 시안"은 M5 파이프라인 전이라 표준 트리 24개 렌더로 대신하고 M5·M8에서 골든 렌더로 다시 잰다 ⑪ 허용 오차 0.5px·자간 표 범위·페어링 상한은 harmony.json(H6 tolerancePx·H4 tier)에서 읽는다 ⑫ axe(AC-03-15)·CLS 0.05(AC-03-24)는 BLK-008·BLK-007
- 영향 범위: tests/acceptance/m2/blocks.test.ts, apps/worker, packages/renderer·design-spec·scoring·linter·layout-schema·data-contracts, data/taxonomy/blocks.json
- 되돌리기 비용: 중간(잠긴 테스트)

## ASM-026 · M2 · gap · 2026-11-19T18:24Z
- 질문: 03장 AC-03-28~37·41 수용 테스트의 API·측정 대상과 temp 데이터에서의 해석
- 근거 탐색: 03장 3.9~3.13, data/icons/map.json(40)·data/images/manifest.json(192, temp)
- 선택: ① `@tastefit/assets`: `iconSvg(set, 의미ID, {strokeWidth}) → '<svg data-icon-set aria-hidden …>'`, 120 = 의미 40 × 세트 3. 렌더 svg에 `data-icon-stroke` ② 하네스에 `firstViewImageBytes(html, vw)` 추가(ASM-025 계약 확장) ③ 이미지 src는 `/assets/images/` 또는 `data:image/`, 미디어 슬롯 요소 `data-media-slot`, shape-graphic 면 `data-shape-graphic` ④ temp manifest는 `LicenseRef-TasteFit-Generated`(무늬 SVG, ASM-014)도 허용, human이면 3.10 두 라이선스만 ⑤ AC-03-36 "160건"은 24 × 8 = 192와 맞지 않아 192건으로 검사(픽스처 24 = AC-04-03 20 + 밝은 색 4) ⑥ `applyBrandColor({presetId, paletteId, hex}, data) → {notice, reason, role}`, `deriveTokens`의 `brand: {hex} | null` ⑦ 무채 사유 코드는 reason 필드 ⑧ `loadDesignData().colorNames` = 색 이름 사전(3.13.5, `config/color-names.ko.json` 또는 data 묶음), 기본 이름 "검정"·"흰색" ⑨ 다크 규칙 3.12 표·아이콘 상한 3.9.1 표는 상수 표로 둔다 ⑩ AC-03-29·31·32 "골든"은 표준 트리 24개로 대신(ASM-025 ⑩) ⑪ 시간·hue·사전 수·일치율은 BLK-007
- 영향 범위: tests/acceptance/m2/assets.test.ts, packages/assets·design-spec·taxonomy, apps/worker
- 되돌리기 비용: 중간(잠긴 테스트)

## ASM-027 · M2 · conflict · 2026-11-19T18:27Z
- 질문: 렌더러 형태(09장 9.4.4 "renderToStaticMarkup"(React) ↔ 04장 CM-01 "render(...) → HTML string 순수 함수")와 AC-04-18a(브라우저 번들 실행)의 번들러 부재, 미리보기·render 잡·폴백 생성기 API
- 근거 탐색: 04장 4.8·4.9 CM-01~17, 06장 6.11.4·AC-06-24~28, 09장 9.4.4, dependency-allowlist(번들러 없음)
- 선택: ① 우선순위(장 > 09장)에 따라 블록 템플릿은 문자열 템플릿 순수 함수(CM-01), 런타임 의존성 없는 ESM으로 만든다. 그래서 브라우저 검증은 하네스가 dist ESM을 page.route로 서빙해 import map으로 실행한다(`Harness.compileInBrowser(spec, tree, data) → html`). React는 renderer에서 쓰지 않는다 ② `@tastefit/renderer`: `fixturePage(fx, data, {presetId?}) → {spec, tree}`(픽스처 = `{purpose, typeId, raw: LayoutTreeRaw, deck}`, `fixtures/layouts/*.json`), `compileForEdit(tokens, tree, vw, {webOrigin, spec, data}) → {html}`(head 첫 요소 meta CSP) ③ `@tastefit/design-spec`: `fallbackMockup(typeId, purpose, variant, data, {spec?}) → {spec, tree}`, `standardTree` 옵션 `{paletteId, brandName, copyOverride, pairingId}` ④ 하네스 추가: `extractL1(html, vw) → number[5]`(05장 추출기), `parentProbe(html) → {xss, contentDocumentNull}`, `measure()` 결과에 `externalRequests` ⑤ `apps/worker/src/jobs/render.ts`: `runRenderJob({html}, harness) → {screenshots:[{viewport, png}], renderBlockedRequests, externalRequests}` ⑥ `apps/web/src/lib/preview.ts`: `signPreview(secret, kind, id, vp, exp)`(HMAC-SHA256 hex, `kind|id|vp|exp`), `handlePreview(Request, deps) → Response`, `issuePreviewUrl({userId, kind, id, vp}, deps) → {status, url?}`, `previewFrame({kind:'display'|'measure', src|srcdoc}) → iframe 문자열`. deps는 env·now·loadCandidate·data 주입(Next 라우트는 얇게 감싼다) ⑦ preview CSP 기대값은 06장 6.11.4 문자열을 테스트에 그대로 둔다(preview는 APP_ENV별 차이 없음) ⑧ 9.4.4 ⑤ 시각 회귀 기준선은 Playwright toHaveScreenshot이 필요해 e2e(M2-12) 몫 ⑨ AC-04-08 렌더 D는 골든 θ*로 만든 변형 3개를 폴백 트리로 렌더해 잰다(LLM 트리는 M5)
- 영향 범위: tests/acceptance/m2/render.test.ts, packages/renderer·design-spec, apps/worker, apps/web
- 되돌리기 비용: 중간(잠긴 테스트)

## ASM-028 · M2 · gap · 2026-11-19T19:15Z
- 질문: 03장 3.2.2 `predictL1(l2, palette)`를 L2만으로 계산할 때 시그니처(장식 효과 수의 입력)·반올림·0.333/0.667 표기, 04장 4.3 calibrate의 moved_axes 사유·용도 표 위치가 정해지지 않음
- 근거 탐색: 03장 3.1.5·3.2.2·3.2.4·3.4.4·3.4.7, 04장 4.3, D-0302, 프리셋 decorCountDefault
- 선택: ① 시그니처는 선택 인자, 없으면 팔레트 유형 프리셋의 기본 시그니처(decorCountDefault 8/8 일치) ② 3등분 값 표기 0.333·0.667은 1/3·2/3로 읽는다 ③ 소수 둘째 자리 반올림은 0.5를 0 쪽으로(3.3.2 매핑 round와 같은 규칙). ①~③으로 3.4.7 앵커 8×5 재현 ④ moved_axes 사유 = 이동 몫이 큰 단계(1단계 type, 2단계 purpose), from=μ, to=v2. distance는 compileSpecs(4.4)에서 ⑤ 4.3 용도 표는 `config/calibration.json` 대신 design-spec 사양 상수(PURPOSE_CALIB, config/*.json 잠금 대상이라 새로 만들지 않음) ⑥ D-0302는 predictL1을 taxonomy에 두라 하나 팔레트·시그니처 로더가 design-spec에 있어 design-spec에 두고 05장은 이를 import
- 영향 범위: packages/design-spec(predict.ts·calibrate.ts)
- 되돌리기 비용: 낮음
- 추가 ⑦: κ 구간(0.75)·moved 0.20은 04장 사양 상수인데 값이 thresholds 잎(tmValidityMin·candidatePairDistMin)과 우연히 같아 감사(qa:trace --audit)가 걸림. thresholds 키가 아니므로 테스트 기준 구현(ASM-024 ⑦)과 같이 표 객체(KAPPA_BANDS·CALIB_SPEC)로 둠. 사람 확인 권장(HUMAN_TODO)

## ASM-029 · M2 · gap · 2026-11-19T19:20Z
- 질문: 04장 4.3 3단계 snapToFeasible의 F 집합 중 "conflict 규칙 0건"을 L2만으로 어디까지 판정하는지, 용도 경로 mapL1toL2의 API, 앵커가 용도 금지값일 때 시작점
- 근거 탐색: 03장 3.3.1·3.3.2·3.6.5, 04장 4.3·4.10.3 CF 목록, purposes.json forbiddenL2, 프리셋 buttonPill·theme·defaultSignatureId
- 선택: ① L2로 판정 가능한 CF-03·04·05·08·09·10·11만 F에서 검사(CF-01·02·06·07·12는 토큰·트리·렌더 수준이라 컴파일러·린터 몫) ② `mapL1toL2ForPurpose(t, typeId, purpose, data)` = taxonomy mapL1toL2 + 용도 금지값 대체(purpose=null이면 그대로) ③ `snapToFeasible(l2_0, t, σ, {typeId, purpose, signatureId?}, data)`: 시작점이 F 밖이고 앵커도 F 밖이면 앵커에 용도 대체값 적용 ④ J의 predictL1은 반올림값(3.2.2 정의), 동률 비교 1e-12 ⑤ 사양 상수(σ 바닥 0.05·벌점 0.02·반복 3·CF-09 3종)는 감사 리터럴과 겹치지 않게 표 객체(SNAP_SPEC·CF_SPEC)
- 영향 범위: packages/design-spec(snap.ts)
- 되돌리기 비용: 낮음

## ASM-030 · M2 · gap · 2026-11-19T19:25Z
- 질문: AC-03-02 `validateTokenSet`이 data/tokens/schema.json(JSON Schema 2020-12)으로 검증해야 하나 dependency-allowlist에 JSON Schema 검증기(ajv 등)가 없음
- 근거 탐색: dependency-allowlist(zod만), 03장 3.1.2, schema.json 사용 키워드 22종
- 선택: data-contracts에 사용 키워드만 지원하는 최소 검증기(MiniValidator)를 둔다. 스키마 원본은 그대로 읽는다(zod로 옮겨 쓰지 않음 → 이중 원천 방지). ajv 추가는 사람 결정(HUMAN_TODO)
- 영향 범위: packages/data-contracts(json-schema.ts·m2.ts)
- 되돌리기 비용: 낮음

## ASM-031 · M2 · gap · 2026-11-19T19:40Z
- 질문: 03장 3.1 TokenSet의 그룹 안 토큰 이름·DTCG 타입이 없는 값(media.treatment·glass·motion.level)의 표현, 모바일 pad, 팔레트에 없는 역할
- 근거 탐색: 03장 3.1.2~3.1.11·3.7.4·3.11.1·3.12, data/tokens/schema.json(tokens-1), AC-03-02~05·44
- 선택: ① type 그룹 토큰 이름 = caption·small·body·lead·h4·h3·h2·h1·display(단계 이름 t-…는 `$extensions.app.tastefit.step`, 모바일 크기는 `mobileSize`). h4~display = heading 서체·웨이트·3.8.2 자간, 나머지 = body·400 ② 단계 크기는 3.4.6 표가 아니라 3.1.5 공식으로 계산(기본 L2에서 표와 일치). 모바일 값은 데스크톱 이하로 자름 ③ media = grayscale·contrast·sepia·saturate number + duotone일 때 duotone-shadow·highlight 색, motion.enter = subtle이면 base(200ms) 아니면 0, glass는 shadow.glass.alpha-n·blur-n ④ 모바일 pad ±1 = 한 단계 조밀한 밀도의 데스크톱 값(3.1.6 예시 regular +1 → 80과 일치), compact는 스케일 한 단계 아래 ⑤ primary-active가 팔레트에 없으면 hover에서 같은 방향 0.04(방향 = hover−primary 부호), focus-inverse = fg-inverse ⑥ 다크(T7)는 그림자 층 비움(3.12) ⑦ 팔레트에 없는 역할(accent·on-accent)은 palettes.json에서 null 대신 키 생략(seed:temp 수정, AC-03-44 테스트가 roles 값을 모두 hex로 읽음) ⑧ 브랜드 색은 M2-03c applyBrandColor에서 반영
- 영향 범위: packages/design-spec(tokens.ts·data.ts), scripts/data/seed-temp.ts, data/taxonomy/palettes.json(temp)
- 되돌리기 비용: 중간

## ASM-032 · M2 · gap · 2026-11-19T22:15Z
- 질문: 03장 3.13 applyBrandColor의 탐색 순서·on-primary 반대 극·무채/강등/틴트 결과 표기
- 근거 탐색: 03장 3.13.1~3.13.3·3.1.3·3.14.1, 04장 4.2.2 표(S-37), assets.test AC-03-36·37(ASM-026 ⑥⑦)
- 선택: ① 입력은 1색(01장 R-21), 두 번째 색 규칙(3.13.3 첫 줄)은 강등된 색에만 적용 ② L 탐색은 "대비가 커지는 방향" 대신 가까운 순(0, ±0.01 … ±0.25)으로 양방향, 이어서 C −0.01×≤15마다 다시 L 탐색. 상한이 있어 반드시 끝난다(반복 수는 사양 74보다 많지만 결과는 가장 가까운 해) ③ on-primary 후보 = 팔레트 값과 반대 극(L ≥ 0.5면 L 0.145 무채, 아니면 흰색), 두 후보 중 시작점에서 덜 움직인 해 ④ 판정 대상은 on 대 primary·hover·active ≥ 본문, primary 대 bg ≥ 대형(3.1.3 하드) ⑤ hover/active는 브랜드 primary에서 3.1.3 공식으로 다시 파생(팔레트 방향 무시) ⑥ accent는 hue 차가 3.14.1 범위일 때만, C ≤ 팔레트 primary C × 1.3, 대 bg·surface ≥ 대형, on-accent는 후보 중 대비 최대(쓰임 금지는 컴파일러 몫) ⑦ 틴트 = surface의 C·h만 교체(C ≤ 0.035), fg·fg-muted 대 surface ≥ 본문·focus ≥ 대형일 때만 ⑧ 무채 반전 적용은 notice `used_as_tint`·role `tint`·reason `brand_neutral_inverse`, 무시는 `ignored`·`brand_neutral_ignored` ⑨ 형식 오류는 예외 대신 `ignored`·`brand_invalid_format` ⑩ 반환에 `overrides`(색 역할 → 값)·`record`(04장 brand_color) 추가, deriveTokens가 overrides를 팔레트 위에 얹는다(source `brand`)
- 영향 범위: packages/design-spec/src/brand.ts·tokens.ts·stubs.ts, packages/taxonomy/src/color.ts(hexToOklch·deltaEOk)
- 되돌리기 비용: 낮음

## ASM-033 · M2 · gap · 2026-11-19T22:25Z
- 질문: 04장 4.4 최소 거리 강제의 세부(반대 방향도 미달일 때, v_bal 기록값, moved_axes 사유)
- 근거 탐색: 04장 4.3·4.4, thresholds generation.variant.targetDistTf, calibrate.ts(ASM-028)
- 선택: ① α_TRUE = 0, α_FIT = min(0.8, α_p + 0.4)를 사양 상수로 둔다(`config/calibration.json` 부재, ASM-028 ⑤와 같음) ② e_p = PURPOSE_CALIB.emphasis ③ 정방향·반대 방향 모두 미달이면 D가 더 큰 쪽(같으면 정방향), distance_enforced = 강제 시도 여부(세 변형 모두 같은 값) ④ v_bal trace = v_fit trace에 alpha = α_FIT/2(소수 3자리)·v2 = t_BAL ⑤ 강제로 값이 바뀐 축은 moved_axes 사유 `distance` ⑥ target_vector는 강제 후 소수 3자리 반올림(범위 경계가 소수 1자리라 범위를 벗어나지 않음)
- 영향 범위: packages/design-spec/src/variants.ts
- 되돌리기 비용: 낮음

## ASM-034 · M2 · gap · 2026-11-19T22:35Z
- 질문: 04장 4.14 pickSignature의 용도 순위표 부재, 03·04장 카탈로그 차이, apply_to
- 근거 탐색: 04장 4.14, 03장 3.2.4 표(우선), data/taxonomy/signatures.json(temp, purpose_rank 없음), signature.ts(AC-03-08)
- 선택: ① 후보 = 프리셋 signatureIds ∩ signatureEligible(3.2.4 요구 조건·충돌). 시안당 1개라 시그니처 사이 충돌은 해당 없음 ② `purpose_rank`는 사양 상수 PURPOSE_RANK(SIG-05 제외 11종, 임시, HUMAN_TODO) ③ V-FIT = 순위 최상위(동률이면 후보 순서), V-BAL = 둘과 다른 첫 후보, 없으면 V-TRUE와 같은 값(BAL 후보에 없으면 BAL 첫 후보) ④ 후보가 비면 SIG-01, 03장 기준 SIG-01 조건(border ≠ bold)도 불가하면 SIG-09(조건 없음) ⑤ intensity: V-TRUE는 t_TRUE.expression ≥ 0.6이면 2, 나머지 1 ⑥ apply_to(블록 ID)는 layoutConstraints와 함께 M2-03d3에서 정한다
- 영향 범위: packages/design-spec/src/pick-signature.ts
- 되돌리기 비용: 낮음

## ASM-035 · M2 · gap · 2026-11-25T03:52Z
- 질문: 04장 4.2.2 7·8·10단계(layoutConstraints·copyTone·decor)와 4.8 슬롯·4.14 apply_to의 빈 곳(용도 허용 hero, 패턴 카탈로그 파일, 잡 내 패턴 상한 충돌, 적용 블록 매핑, tone 기본 순서)
- 근거 탐색: 04장 4.2.1·4.2.2·4.6.1·4.8·4.14, 03장 3.2.4·3.6.5·3.6.6, data/taxonomy/purposes·presets·blocks·signatures, images manifest
- 선택: ① hero_variants: TRUE = 프리셋 heroVariants, FIT = purposes.standardHero, BAL = 유형 ∩ "용도 허용"(= 그 용도 패턴 4개의 hero 힌트), 비면 유형 목록. 값은 `hero.<id>` ② 패턴 카탈로그는 사양 상수 PATTERNS(config/patterns.json 없음). FIT = [표준, job_seed 회전으로 고른 표준 외 1], TRUE = preferredPatterns, BAL = [표준, 유형 선호 중 표준 아닌 것]. 표준이 TRUE에도 있어 3회가 되면 "잡 내 ≤ 2"가 이기고 BAL 슬롯1을 남은 패턴으로 바꾼다 ③ SigCtx: 섹션 수 = 용도 하한, chroma medium→moderate, 숫자 슬롯 = stats·process·value.numbered 허용, 이미지 슬롯 = SIG-12 적용 블록(hero.split·story·about) 중 이미지 variant 허용 ④ allowed_variants = 용도 블록(required ∪ requiredAny ∪ optional, nav·hero·footer 포함) − excludedVariants, `*.bento`는 grid_mode=bento일 때만, hero = hero_variants ⑤ apply_to는 03장 3.2.4 적용 블록(순서 = 우선) ∩ 이 명세 블록, 최대 수는 04장 4.14(전체 = 후보 수), SIG-02·08 = 섹션 전체, SIG-09 = nav + 섹션, SIG-10 = 이미지 variant 블록, SIG-07 = "page"(페이지 배경) ⑥ image_tags_allowed: 업종 태그 입력이 CompileInput에 없어 지금은 항상 {defaultImageTag} ∪ common.texture-*(M5 BrandInput 업종 연결 때 industryTags 인자 사용) ⑦ tone 기본 헤드라인 순서(4.6.1 "tone 기본 순서" 미정): PRECISE factual>benefit>emotive, WARM benefit>emotive>factual, EDITORIAL·PLAYFUL emotive 우선 ⑧ decor.effects가 max를 넘는 조합(DecorId 시그니처 + glass/brutal-offset, max 1)은 M2-03d4 staticLint(S)에서 걸러 재시도한다
- 영향 범위: packages/design-spec/src/layout.ts·data.ts(blocks·imageTags 로드)
- 되돌리기 비용: 낮음

## ASM-036 · M2 · gap · 2026-11-25T03:56Z
- 질문: 04장 4.4 enforceVariantL2Diff의 탐색 방식(교체 키·평가 쌍·종료)과 4.2.1 spec_id "입력 정규화 JSON"의 범위
- 근거 탐색: 04장 4.2.1·4.2.2·4.3 3단계(J·F)·4.4 표, thresholds generation.variant.l2DiffMin
- 선택: ① 교체 대상 = 7키 중 L2 키 6개(pairing·palette·radius·depth.style·shadow_level·density). hero·signature는 l2에서 다시 계산하는 extras 콜백으로 차이에 반영 ② V-FIT은 (TRUE, FIT) 쌍만, V-BAL은 (TRUE, BAL)·(FIT, BAL) 부족분 합을 줄이는 단일 키 교체 중 J 증가량 최소(동률이면 키·값 순서 앞)를 F 안에서 반복(≤ 7회) ③ 페어링 교체 시 헤드라인 굵기가 새 페어링 허용값 밖이면 페어링 기본값(없으면 첫 허용값)으로 맞춘 뒤 F 판정 ④ 끝까지 미달이면 예외 없이 satisfied=false(4.4 렌더 층·low_separation으로 넘김) ⑤ spec_id = sha256(키 정렬 JSON(compile 입력 + variant + 버전)) 앞 16자. 조립 필드는 M2-03d4 compileSpecs에서 확정
- 영향 범위: packages/design-spec/src/enforce.ts
- 되돌리기 비용: 낮음

## ASM-037 · M2 · gap · 2026-11-25T04:05Z
- 질문: 04장 4.2.2 compileSpec 조립 순서(시그니처가 L2 차이 7키에 들어가는데 9단계에서 정해짐)와 DesignSpecSchema 세부(버전 필드·forbidden·hero 형식)
- 근거 탐색: 04장 4.2.1·4.2.2·4.4, 03장 3.2.4·AC-03-06, data/normalizers(2026-S0)·presets.version(2026-S4)
- 선택: ① 순서: variantTargets → 변형별 mapL1toL2ForPurpose·snapToFeasible(시그니처 = 프리셋 기본) → enforceVariantL2Diff(extras = hero_variants·pickSignatures를 후보 l2로 다시 계산) → pickSignatures 확정 → 변형별 브랜드·토큰·제약·톤·apply_to·decor ② preset_version = 프리셋 version, normalizer_version = data/normalizers 최신 파일명(R-30은 둘이 같은 시즌이라 했으나 temp 데이터는 S4/S0으로 다름 → 데이터 값을 그대로 기록, M3 B18 재생성 때 맞춤) ③ forbidden.lint_rules_strict = [](용도·유형 엄격 규칙 원천 미정), conflict_ids = l2Conflicts(확정 시그니처 기준) ④ DesignSpecSchema는 strict, l2는 taxonomy.json에서 단방향 생성(18키 enum), tokens는 record(TokenSet 세부 검증은 validateTokenSet) ⑤ staticLint 실패 시 재시도(11단계)는 M2-03d4b에서 붙인다
- 영향 범위: packages/design-spec/src/compile.ts·data.ts, packages/data-contracts/src/m2.ts
- 되돌리기 비용: 낮음

## ASM-038 · M2 · gap · 2026-11-25T04:15Z
- 질문: 04장 4.13 단계 S의 판정 대상(명세서만으로 볼 수 있는 규칙)과 4.2.2 11단계 "error면 다음 후보 값으로 재시도"의 구체 방식
- 근거 탐색: 04장 4.13.1·4.13.2(AIL-01·03·06·09 단계 S), 03장 3.2.4·3.3(radius.md = 버튼·카드)·S-33(allowSoftRoundShadow T3·T4·T6), 4.2.1 decor 주석(시그니처 포함 개수)
- 선택: ① 단계 S = AIL-01(토큰 gradient 정지점), AIL-03(font.heading·body 첫 항목을 fonts registry 별칭→패밀리로 풀어 비교, mono 제외), AIL-06(depth.style이 그림자형일 때 radius.md ∈ [12,16] ∧ 해당 shadow level 최대 blur ≥ 16 ∧ 전 층 α ≤ 0.15, T3·T4·T6 warn), AIL-09(a)(glass 장식 ∧ depth.style ≠ glass) + 명세 정합 규칙 SPEC-DECOR(effects > max)·SPEC-CF(conflict_ids)·SPEC-RESERVED(shadow 3)·SPEC-DUOTONE·SPEC-SIG. 탐지 상수는 packages/linter/data/rule-params.json(자체 잠금은 M2 끝 --m2-end에서) ② 11단계 재시도 대신 실패 원인을 선택 단계에서 막는다: pickSignatures 후보를 "장식 예산 안"(decorFor 결과 effects ≤ max)으로 거르고, 비면 SIG-01/SIG-09(장식 없음). 그 결과 72조합 단계 S error 0(AC-04-04). 다른 S 규칙 위반은 생성 경로가 없어(그라디언트 토큰 없음·F 집합이 상충 제외) 재시도 루프는 두지 않는다
- 영향 범위: packages/linter/src/stage-s.ts·data/rule-params.json, packages/design-spec/src/pick-signature.ts·compile.ts
- 되돌리기 비용: 낮음

## ASM-039 · M2 · gap · 2026-11-25T04:26Z
- 질문: 04장 4.5.2 LayoutTreeRaw zod의 enum 원천·슬롯 필수성·섹션 수 상한과 4.6.2 copyDeckLimits 형식, AC-04-10 기준 픽스처
- 근거 탐색: 04장 4.5.2·4.5.3·4.6.2, 03장 blocks.json(slots.kind·required)·purposes.json(sectionCount)·images manifest, ASM-024 ⑥·ASM-027 ②
- 선택: ① 섹션 = 블록별 discriminatedUnion(block 리터럴), variant enum·슬롯 키는 blocks.json, 슬롯 값은 kind별(copy·list·image·link) strict 객체, required 슬롯은 필수 ② nav·footer는 섹션 블록에서 제외(footer는 별도 필드) ③ 섹션 수 스키마 상한 = purposes 최대(8), 용도별 범위·LT-01~04·09·10은 명세서가 필요해 린트 T(M2-08)에서 ④ image.tag enum = manifest 태그(orient.·tone. 제외) ⑤ 섹션 id 중복은 superRefine으로 거부 ⑥ JSON Schema는 zod 4 `z.toJSONSchema` ⑦ copyDeckLimits = 4.6.2 상한(목록은 한글 필드명 객체, blocks.json maxLength 키와 같음), `work.items[0]`(showcase 캡션)·`contact.*`(컴파일러 채움, 0) 포함 ⑧ 기준 픽스처 fixtures/layouts/saas-ps1.json(`{purpose, typeId, provenance: temp, raw, deck}`), 나머지 픽스처는 M2-08
- 영향 범위: packages/layout-schema/src/schema.ts, fixtures/layouts
- 되돌리기 비용: 낮음

## ASM-040 · M2 · gap · 2026-11-25T04:33Z
- 질문: 04장 4.5.2 확정 트리(LayoutTree = 06장 PageSchema)의 세부 형태(목록 항목 2필드, nav·footer 표현, role_overrides 키)와 9.4.4 ⑥ 정적 검사 기준
- 근거 탐색: 04장 4.5.1·4.5.2(확정 치환 규칙·nav 최대 5·T-30 role_overrides), 06장 jsonb 원본 규칙, 09장 9.4.4 ⑥
- 선택: ① copy → `{copy: {text, sub?, placeholder, deck_ref}}`(sub = 목록 항목 둘째 필드: 본문·답·설명·라벨·이름), image → `{tag, ratio, asset_id, alt, focal}`, link.label도 같은 Text ② nav = `{variant, items[≤ 5]{label ≤ 20, target 앵커}}`, footer = `{variant, slots}`(blocks.json footer 슬롯) ③ role_overrides = 이미지가 아닌 슬롯 키만, 값은 타입 단계 9종 ④ 자유 키 record를 쓰지 않는다(전부 strict 객체) → ⑥ 검사 = JSON Schema에서 금지 키(style·className·css·html·script·on*) 속성 0 ∧ 열린 객체 0. 단위 테스트에서 PageSchema·LayoutTreeRaw 둘 다 검사 ⑤ 텍스트 상한 400자(덱 최대 240 + 여유), 이스케이프는 렌더러 책임
- 영향 범위: packages/layout-schema/src/schema.ts
- 되돌리기 비용: 낮음

## ASM-041 · M2 · gap · 2026-11-25T07:25Z
- 질문: CM-02 리터럴 허용 목록(0·100%·auto·1fr·inherit·currentColor)의 검사 범위(단위 없는 수·@media 머리·var 대체값)와 03장 px 크기(버튼 36/44/52)의 토큰 표현
- 근거 탐색: 04장 4.9.2 CM-02·03, 03장 3.5.1·3.5.3, AC-03-16(색·그림자·radius 리터럴 0)
- 선택: ① 위반 = 색 리터럴(hex·색 함수·color-mix·이름 색·transparent) + 단위 있는 치수(0·100%·1fr 제외, %·ms·deg 포함) + `!important` ② 단위 없는 수(opacity 0.06·flex 1)는 허용 ③ @media 등 at-rule 머리는 CSS 변수가 안 되므로 검사 밖(03장 브레이크포인트 값만 씀) ④ var(--x, 대체값)의 대체값은 검사 대상 ⑤ px 크기는 space 토큰 calc 합(36=8+1, 44=10+1, 52=12+1 단계), ghost hover α는 ::before currentColor + opacity ⑥ CSS는 문자열 TS 모듈(isomorphic, 4.9.1)로 두고 `rendererCssSources()`가 층 순서로 반환
- 영향 범위: packages/renderer/src/css/**
- 되돌리기 비용: 낮음

## ASM-042 · M2 · gap · 2026-11-25T07:50Z
- 질문: renderer가 DesignSpec.tokens(DTCG)를 tokens.css로 바꿀 때 design-spec의 변환 코드를 어떻게 쓰나(9.1.3 의존 표에 renderer→design-spec 없음, 4.9.1 isomorphic), 블록 기본 제목·확정 트리 타입은 어디서
- 근거 탐색: 04장 4.9.1·CM-01~16, 03장 3.1.12, 09장 9.1.3, ASM-027 ①
- 선택: ① design-spec의 토큰→CSS 변환을 순수 모듈 `tokens-css.ts`(+ 상수 `type-spec.ts`)로 분리하고 하위 경로 `@tastefit/design-spec/tokens-css`로만 renderer가 가져온다(fs·config 미사용, 내보내기 tokens.css와 같은 코드) ② renderer는 layout-schema를 런타임에 가져오지 않고 같은 모양의 구조 타입(PTree)을 둔다(테스트만 devDependency) ③ 블록 기본 제목은 `data.blocks[].default_heading_ko`, 없으면 시각 숨김 h2(aria-labelledby 유지) ④ data-slot-id = `<섹션>.<슬롯>[.<항목>]`(목록 둘째 필드 `.sub`), 푸터 `footer.<슬롯>` ⑤ variant 템플릿이 없으면 일반 템플릿(슬롯 종류 순서)으로 그리고 M2-05b·06에서 variant별로 교체 ⑥ 이미지는 M2-07 전까지 자리표시 틀(`data-media-slot`·`data-asset-id`)
- 영향 범위: packages/design-spec(tokens-css·type-spec·package exports), packages/renderer
- 되돌리기 비용: 낮음

## ASM-043 · M2 · gap · 2026-11-25T15:45Z
- 질문: 3.1.5a 역할 표를 CSS로 어떻게 옮기나(행간·자간 변수 없음), blocks.json 슬롯별 역할은 어디서 정하나, 조건부 단계(stepRuleKo)는 어떻게 고르나
- 근거 탐색: 03장 3.1.5a·3.8.2, AC-03-42·46, 04장 CM-02
- 선택: ① tokens.css에 단계별 `--tf-type-<키>-leading`·`-tracking` 추가, 모바일 자간은 모바일 크기로 계산해 `:root` 안 `@media (max-width: 47.99rem)`로 재선언(clamp 중간 크기는 두 값 중 하나로 근사) ② `text-roles.css`를 스펙마다 B25에서 생성해 components 층 뒤·blocks 층 앞에 둔다. weight heading→heading 글꼴·웨이트, emphasis→본문 글꼴·emphasis 웨이트, tracking label은 0(한글 기본, 라틴 대문자 +0.06·SIG-09는 시그니처 층) ③ 조건부 단계: hero.type-only·full-bleed-image / cta.big-type / footer.big-type → t-display, button sm → t-small, nav.link는 데스크톱 t-small < 15px면 컴파일 시 t-body. nav.wordmark 줄 예산 강등은 하네스(M2-09) 이후 ④ blocks.json 슬롯 textRoles는 seed:temp `BLOCK_SLOT_TEXT_ROLES` 표로 고정(list 슬롯은 항목 요소 순서) ⑤ 버튼 라벨은 `a > span[data-role=button.label][data-size]`, 스킵 링크는 nav.link
- 영향 범위: packages/design-spec(tokens·tokens-css·data), packages/renderer(compile·css/text-roles), data/taxonomy/blocks.json(temp)
- 되돌리기 비용: 낮음

## ASM-044 · M2 · gap · 2026-11-25T15:58Z
- 질문: hero 6 variant의 칸 배치·모바일 변환을 어떻게 그리나, offset의 둘째 이미지(1:1)는 PageSchema에 슬롯이 없는데 어떻게 하나
- 근거 탐색: 03장 3.6.1·3.6.2(text_cols)·3.11.3, 04장 CM-01·4.5.2, blocks.json hero variants
- 선택: ① 텍스트 칼럼(eyebrow → h1 → sub → CTA lg)은 공통, 칸 수 = text_cols.lg(12열 그리드, ≥64rem), 48~63.99rem은 split·offset 2열, 그 미만 1열(텍스트 → 이미지) ② full-bleed는 이미지·텍스트를 같은 격자 칸에 겹치고 스크림 `--tf-color-overlay`, 모바일 4:5·≥48rem 16:9, 텍스트 폭 7/12 ③ offset 보조 1:1은 같은 자산을 1:1로 자른 장식(aria-hidden, ≥64rem에서만 표시) — 둘째 이미지 슬롯은 스키마 밖이라 추가하지 않음 ④ variant 템플릿은 컴파일러가 만든 제목(ctx.heading)을 직접 배치, 등록은 패키지 진입점(blocks/index)에서 1회(순환 import 방지) ⑤ 헤드라인 단계 강등(role_overrides)은 M2-08·09 헤드라인 예산과 함께
- 영향 범위: packages/renderer(blocks/hero·css/blocks/hero·compile)
- 되돌리기 비용: 낮음

## ASM-045 · M2 · gap · 2026-11-25T16:10Z
- 질문: value·feature·showcase·stats·process 13 variant 배치, 항목별 이미지(zigzag)·아이콘·bento 칸을 어떻게 그리나
- 근거 탐색: 03장 3.6.1·3.6.3·3.11.3, 04장 CM-01, layout-schema(목록 항목 = 카피만)
- 선택: ① 공용 배치 층 `blocks/layout.css`(head·cols·rule-list·bento·split)와 블록 CSS. cols는 ≥64rem에서 항목 수만큼 같은 폭, 48rem~ 2열, 그 미만 1열. stats는 모바일 2×2 ② feature.zigzag는 스키마에 항목 이미지가 없어 media를 첫 항목에만 두고 나머지 행은 좌우 교차 텍스트 ③ icon-grid 아이콘은 `span[data-icon=auto]` 자리(M2-07 assets가 인라인 SVG로 채움) ④ bento는 3열·첫 칸 2×2 ⑤ list 항목 = [list.index] 제목(text) + 본문(sub), 역할은 슬롯 textRoles 순서. stats는 제목 태그 p(stat.value)
- 영향 범위: packages/renderer(blocks/common·content-a, css/blocks/content-a)
- 되돌리기 비용: 낮음

## ASM-046 · M2 · gap · 2026-11-25T16:05Z
- 질문: proof·pricing·faq·cta·menu 12 variant에서 목록 항목(카피 text/sub뿐)을 어떤 필드로 읽나, 덱 키가 없는 pricing·cta.image 이미지는 어떻게 하나
- 근거 탐색: 03장 3.6.1·3.6.3·3.11.3, 04장 4.6.2 덱 표(proof·faq·menu 비고), D-0312
- 선택: ① 필드 대응 고정: proof = 인용/이름(아바타 이니셜 = 이름 첫 글자, 장식), pricing = 플랜/가격, faq = 질문/답(details·summary), menu = 항목명/설명 + 가격은 항상 `[예시] 0,000원`(placeholder) ② pricing.cards 강조는 3플랜일 때 가운데 1개, 모바일은 강조 먼저(order) ③ menu 그룹은 1그룹으로 펼침(그룹 제목 = 블록 기본 제목), menu.cards 항목 이미지는 스키마 밖이라 생략 ④ cta 슬롯에 media가 없어 cta.image는 media가 있을 때만 겹치고 없으면 band 틀(fallback band) ⑤ inverse 섹션의 primary 버튼은 bg/fg를 뒤집어 대비 확보
- 영향 범위: packages/renderer(blocks/content-b, css/blocks/content-b)
- 되돌리기 비용: 낮음

## ASM-047 · M2 · gap · 2026-11-25T16:20Z
- 질문: highlight·gallery·location·story·about·service·contact 16 variant 배치, 여러 이미지 칸·지도·정적 폼은 어떻게 그리나
- 근거 탐색: 03장 3.6.1·3.6.3·3.11.3, 04장 4.5.2, 06장 contact 폼(정적 내보내기 action 없음)
- 선택: ① 여러 이미지 칸은 첫 칸만 실제 이미지, 나머지 빈 틀(BLK-010). gallery 칸 수 = captions 수, masonry 비율은 4:5·1:1·3:2 고정 순환, feature는 첫 칸 2×2 ② location 라벨 "주소·영업시간·전화"(dt, stat.label 역할), 지도는 3:2 자리표시(임베드 MVP 제외) ③ story·about 같은 틀(split/text), 본문 폭 `.tf-measure` = 컨테이너 1/2(36em 근사, 리터럴 금지) ④ contact 폼: 이름·이메일·문의 내용 고정 라벨 + form 슬롯은 도움말, action 없음, 보내기 버튼. contact.simple은 링크 슬롯이 없어 연락처를 강조 행으로 ⑤ 섹션 안 요소는 섹션 클래스(tf-<블록>, tf-<블록>--<variant>)를 쓰지 않는다(gallery 충돌 수정, 단위 테스트) ⑥ html `el`은 void 태그(input 등)를 닫지 않는다
- 영향 범위: packages/renderer(blocks/content-c, css/blocks/content-c, html)
- 되돌리기 비용: 낮음

## ASM-048 · M2 · gap · 2026-11-25T16:35Z
- 질문: nav 3·footer 3 variant 배치, sticky 적용 대상, nav CTA
- 근거 탐색: 03장 3.5.1 C08·C10·C18, 3.6.1 footer 행
- 선택: ① nav: split(로고 좌·링크 우), center(≥48rem 로고 위·링크 아래 가운데), minimal(로고 + 메뉴 버튼, 모든 폭 drawer). 768 미만 모두 drawer ② sticky = 프리셋 유형 T2·T7(`STICKY_NAV_TYPES`, C08 표) ③ nav CTA는 트리 nav에 슬롯이 없어 생략 ④ footer: minimal 세로 묶음, columns 3칸(브랜드+태그라인 / 링크 / 사업자 정보), big-type은 태그라인·링크·사업자 정보 뒤 맨 아래 워드마크(display) ⑤ 배치 CSS는 blocks/nav-footer.css(컴포넌트 층 위)
- 영향 범위: packages/renderer(compile navHtml·footerHtml, css/blocks/chrome)
- 되돌리기 비용: 낮음

## ASM-049 · M2 · gap · 2026-11-25T16:50Z
- 질문: 아이콘 패키지 없이 3.9 인라인 SVG를 어떻게 내나, value.icon-grid 항목별 의미는 무엇으로 고르나
- 근거 탐색: 03장 3.9.1, 04장 4.9.3, 09장 9.1.3(renderer → assets 허용), dependency-allowlist(잠금)
- 선택: ① 임시 자체 선 아이콘 40개(map.json 의미 그대로, 24 그리드, currentColor, aria-hidden, data-icon-set·data-icon-stroke)로 iconSvg 구현(BLK-011) ② 굵기 = radius family(sharp·soft 1.5, round·pill 2), 세트 = l2 icon.set ③ icon-grid 의미는 용도별 고정 순환(saas bolt·chart·shield-check·users, local coffee·store·heart·leaf, portfolio brush·camera·image·link), 크기 32 ④ location 행 라벨 앞 map-pin·clock·phone(20) — 3.9.1 연락처 행 예외 안
- 영향 범위: packages/assets(icons), packages/renderer(common·content-a·content-c, renderer → assets 의존)
- 되돌리기 비용: 낮음(PATHS 표 교체)

## ASM-050 · M2 · gap · 2026-11-25T17:05Z
- 질문: 순수 컴파일러(4.9.1)가 3.7.5 페이지 서브셋 woff2를 어떻게 "생성"하나, 파일 이름·경로·preload는 무엇으로 정하나
- 근거 탐색: 03장 3.7.4·3.7.5, 04장 CM-09, 09장 9.2 B6(temp: 시스템 Noto CJK KR 대체), D-0308
- 선택: ① 컴파일러는 폰트 계획만 낸다: 페어링 → heading(토큰 heading 웨이트, preload)·body 400(preload)·body emphasis·heading 라틴·mono(classification=mono) ≤ 5면, 글자 집합 = 본문 텍스트 + 제목 + ASCII 95 + 한글 문장부호, 파일 `assets/fonts/<code>-<웨이트>-<FNV-1a 64 해시 12자>.woff2`(상대 경로, 외부 요청 0) ② `compilePage` 반환에 `fonts`(FontPlan) 추가 — 실제 woff2는 node 쪽 assets가 같은 계획으로 만든다(M2-07b2) ③ @font-face family = registry `subsetFamily`, `font-display: swap`, 폴백 면 tf-fb-sans·serif(3.7.4 local·메트릭 오버라이드), base에 `font-synthesis: none` ④ 해시는 순수 JS(FNV-1a 64, BigInt)로 node API 없이 계산
- 영향 범위: packages/renderer(fonts·compile·m2·base.css)
- 되돌리기 비용: 낮음

## ASM-051 · M2 · gap · 2026-11-25T17:20Z
- 질문: 페이지 서브셋 woff2를 무엇으로 만들고, temp(B6 파일 없음)에서 어떤 원본을 쓰나, 렌더 측정(AC-03-23 getPlatformFontsForNode)이 지정 서체로 보이게 하려면
- 근거 탐색: 03장 3.7.5, 09장 9.2 B6(temp: 시스템 Noto CJK KR), AD-032
- 선택: ① `@tastefit/assets/fonts-node`(node 전용 하위 경로)가 python3 fontTools로 서브셋(layout 기능 전부, notdef 유지, 타임스탬프 재계산 없음 → 같은 입력 같은 바이트) ② 원본: registry files(있으면) → temp는 serif 분류 Noto Serif CJK KR, mono DejaVu Sans Mono, 그 외 Noto Sans CJK KR. 웨이트는 CSS 매칭 규칙(500 초과는 더 굵은 쪽)으로 가장 가까운 스타일 ③ 서브셋 파일의 이름 표(1·4·6·16)를 CSS family(subsetFamily)로 바꾼다 — temp 대체 서체여도 측정에는 지정 family로 나온다(실제 서체 품질 검증은 사람 데이터 B6 이후) ④ 같은 파일 이름이 있으면 다시 만들지 않는다(이름 = 글자 집합 해시)
- 영향 범위: packages/assets(fonts-node·py/subset_fonts.py)
- 되돌리기 비용: 낮음

## ASM-052 · M2 · gap · 2026-11-25T17:45Z
- 질문: 미디어 슬롯을 어떤 마크업으로 그리나(경로·크기·초점·shape-graphic), 3.10.5 구성 선택 seed는 무엇인가
- 근거 탐색: 03장 3.10·3.10.5·AC-03-31·32, 04장 CM-03(style 속성 금지)·CM-09, ASM-026 ③
- 선택: ① photo-led·type-led: `<img src="/assets/images/<manifest path에서 data/images/ 뺀 것>" width height(슬롯 비율, manifest 폭 기준) loading(hero eager + fetchpriority high, 나머지 lazy) decoding=async>`를 `.tf-media[data-media-slot][data-asset-id]` 안에 ② 초점은 10% 단위 `data-fx·data-fy` + 생성 CSS(focal.css, 소스 층 밖)로 object-position 변수 설정 ③ media.mode = shape-graphic 또는 manifest에 없는 자산 → 3.10.5 색면 G1~G4(12×12 격자 직사각형, primary·accent·surface-inverse), 선택 = FNV-1a(spec_id‖slot) mod 4(sha256(job_seed‖slot) 대신, 잡 seed가 아직 없음), role=img + "<alt> 이미지 자리" ④ BLK-010 빈 칸도 색면(aria-hidden, data-media-slot 없음) ⑤ 폰트·이미지 경로는 `/assets/...` 절대 경로(내보내기에서 상대 경로로 바꿈, M6). srcset은 human 래스터 이미지가 들어올 때(지금 temp는 SVG)
- 영향 범위: packages/renderer(media·compile·blocks), packages/design-spec(DesignData.images), packages/assets(py 경로)
- 되돌리기 비용: 낮음

## ASM-053 · M2 · gap · 2026-11-25T18:20Z
- 질문: standardTree·fallbackMockup(4.12 buildFallback)의 명세·트리·카피·이미지를 어떻게 결정하나
- 근거 탐색: 03장 3.4.7(앵커 = predictL1(기본 L2)), 04장 4.5.2·4.8 패턴 표·4.9.4·4.12·CP-10, copy_templates(B?·temp), purposes.json
- 선택: ① 앵커 취향 μ = predictL1(프리셋 기본 L2), σ 0.08, κ 0.8 → compileSpecs(jobSeed `standard:<유형>:<용도>`·`fallback:…`). standardTree = v_true, fallbackMockup = 지정 변형(명세 토큰 그대로) ② 트리 = 용도 표준 패턴 PS-1/PL-1/PP-1(layout.ts PATTERNS). variant = 명세 allowed_variants 첫 값(type-led면 이미지 없는 것 우선), hero = 패턴 힌트가 hero_variants에 있으면 그것, 아니면 첫 값. bg = 순환 surface·bg·bg·surface, 마지막 섹션 inverse(허용 밖이면 allowed_bg 첫 값), pad hero 1·나머지 0. 섹션 수는 footer 포함으로 셈(PL-1 = 5 + footer) ③ 카피 = copy_templates 용도별 + 브랜드 치환({name}·{description}·{key_points.N}), `[예시]`·`[임시]` 포함 문구는 placeholder. contact.*·사업자 정보는 CP-10 예시값, contact 제목 "문의하기" ④ 덱 값 모양 → text/sub(title·body, quote·name, name·desc, value·label). menu.groups 그룹은 항목으로 펼치고 deck_ref는 그룹 참조 ⑤ 이미지: 명세 image_tags_allowed에서 용도 태그 → 같은 태그·미사용 manifest 중 sha256(seed‖섹션‖슬롯) 선택(톤 규칙·fallback_variant 치환은 M5). 후보 없음·shape-graphic이면 asset_id `shape-graphic`(색면). PageSchema asset_id 정규식에 `:` 허용(temp id `tmp_img:…`) ⑥ nav = nav_label 있는 섹션 ≤ 5, footer = 워드마크(브랜드명)·태그라인·사업자 예시값 ⑦ 갤러리 캡션이 없으면 variant 기본 칸 수(grid·masonry 6, feature 5)
- 영향 범위: packages/design-spec(standard·stubs·data), packages/layout-schema(asset_id), packages/renderer(gallery)
- 되돌리기 비용: 중간(폴백 시안 모양 전체)

## ASM-054 · M2 · gap · 2026-11-25T18:40Z
- 질문: 9.4.4 ① 픽스처 30개를 어떻게 만들고 fixturePage는 어떤 명세로 확정하나
- 근거 탐색: 09장 9.4.4 ①, 04장 AC-04-11(용도 × 패턴 4), ASM-027 ②, ASM-053
- 선택: ① `pnpm fixtures:layouts`가 용도별 10개를 결정론으로 만든다: 패턴 = 번호 mod 4 + 1, 유형 = (3 × 번호 + 용도 순번) mod 8, variant = 그 유형 앵커 명세 allowed_variants에서 (번호 + 블록 순번) 순환, hero = hero_variants 순환. 덱 = 용도 템플릿 덱(+ PS-2용 [예시] stats 3개). provenance temp, 수동 픽스처 saas-ps1.json 유지 ② fixturePage(fx, data, {presetId?}) = 유형(또는 프리셋 유형) standardTree 명세(v_true) + resolveTree(raw, 픽스처 덱), spec_id는 명세 것으로 바꿈
- 영향 범위: scripts/data/fixtures-layouts.ts, fixtures/layouts/*.json, packages/renderer(m2 fixturePage), package.json
- 되돌리기 비용: 낮음

## ASM-055 · M2 · gap · 2026-11-25T19:10Z
- 질문: 렌더 하네스가 페이지·자산을 어떻게 띄우고, 하드 게이트 G-02·04·05·06·07을 어떤 측정으로 판정하나
- 근거 탐색: 04장 4.10.2 게이트 표·4.11 자동 보정, 03장 3.1.3(inverseButtonMode·fg-inverse), ASM-025 ①②
- 선택: ① 하네스: chromium 1회 실행, 페이지마다 새 컨텍스트, 가상 오리진 http://tf.local/ 에 route로 HTML·`/assets/images`(data/images)·`/assets/fonts`(요청 시 fonts-node로 서브셋 생성, tmp 캐시)만 응답, 나머지는 차단해 externalRequests로 센다. worker 의존성에 playwright 1.63.0·sharp·assets·renderer·design-spec·scoring 추가 ② G-02: 텍스트 노드의 부모 요소별 전경색 vs 조상 배경색 알파 합성(캔버스로 sRGB 변환, 기본 흰색), 큰 글자 = ≥ 24px 또는 ≥ 18.66px·700. 이미지 위(.tf-hero__overlay·[data-text-over-image]) 텍스트는 글자를 투명하게 한 뒤 bbox 픽셀별 대비의 하위 5% 값 ③ G-05: overflow hidden/clip인 텍스트 요소의 scroll > client + 1(시각 숨김·스킵 링크 제외) ④ G-06: 텍스트 줄 상자(Range 사각형을 line-height 높이로 자름)끼리·텍스트 vs 인터랙티브, 조상-자손 제외, 교차 > 2px² ⑤ G-07: 이미지 naturalWidth 0(lazy도 eager로 바꿔 측정), 폰트 error(3.7.4 폴백 면 tf-fb-* 제외), 404, 콘솔 error, 외부 요청 ⑥ 판정은 `@tastefit/scoring` evaluateGates(thresholds contrastBodyMin·LargeMin), 미구현 id는 실패로 낸다 ⑦ 결과에 맞춘 렌더러 수정: inverse 섹션의 fg-muted·border = fg-inverse, 버튼@inverse를 3.1.3 표대로(invert 모드 = bg fg-inverse·글자 surface-inverse, `html[data-inverse-button]`), 이미지·색면 위 hero 텍스트는 surface-inverse 판 위에(4.11 오버레이 보정은 생성 파이프라인 M3·M5) ⑧ inverseButtonMode·accentTextSafe는 TokenSet 루트 `$extensions["app.tastefit"]`(3.1.3), tokens-1 스키마(seed temp)에 루트 $extensions 허용
- 결과: 폴백 72 × 1280·375에서 G-02·04·05·06·07 위반 0(로컬 측정 약 80초)
- 영향 범위: apps/worker(render/harness·measure), packages/scoring, packages/renderer(base·hero·compile), packages/design-spec(tokens), data/tokens/schema.json(temp)
- 되돌리기 비용: 중간

## ASM-056 · M2 · gap · 2026-11-25T19:40Z
- 질문: 하네스 headlineLines·compileInBrowser를 어떻게 재나
- 근거 탐색: 03장 3.8.1(헤드라인 줄 수·고아 글자), 04장 AC-04-18a, ASM-027 ①
- 선택: ① headlineLines: [data-role=hero.headline|cta.headline] 요소의 글자별 Range 사각형을 top으로 묶어 줄 수, 마지막 줄 글자 수(공백 제외) ② compileInBrowser: renderer·design-spec·assets dist ESM을 가상 오리진에서 import map(`@tastefit/design-spec/tokens-css`·`@tastefit/assets`)으로 서빙하고, blocks/index.js 등록 후 compile.js의 compilePageImpl을 실행(node 전용 진입점 m2.js는 쓰지 않는다). import()는 문자열 평가로 실행(테스트 변환기 회피)
- 영향 범위: apps/worker(render/harness)
- 되돌리기 비용: 낮음

## ASM-057 · M2 · gap · 2026-11-25T19:55Z
- 질문: G-03 비텍스트 대비의 표본·기준값
- 근거 탐색: 04장 4.10.2 G-03, 03장 3.1.3 focus·focus-inverse, WCAG 1.4.11
- 선택: ① 표본: 입력(테두리·채움 중 큰 대비), .tf-button(채움·테두리 중 큰 대비, 둘 다 없으면 제외), 모든 인터랙티브 요소의 `--tf-color-focus`(요소 문맥에서 해석) — 각각 부모 쪽 합성 배경과 비교 ② 기준 3:1은 thresholds에 별도 키가 없어 같은 값인 `generation.contrastLargeMin`을 쓴다(키 추가는 사람 결정)
- 영향 범위: apps/worker(render/measure), packages/scoring
- 되돌리기 비용: 낮음

## ASM-058 · M2 · gap · 2026-11-25T20:15Z
- 질문: worker render 잡의 입력·출력과 06장 6.8.3 네트워크 규칙을 로컬 하네스에서 어떻게 맞추나
- 근거 탐색: 06장 6.8.2(javaScriptEnabled false)·6.8.3(자산 오리진 /assets/·/fonts/, 그 외 abort + render_blocked_requests), AC-06-28, ASM-027 ⑤
- 선택: ① 글꼴 경로를 `/fonts/<파일>`로(6.8.3), 이미지는 `/assets/images/…`. 운영 자산 오리진(http://assets.local)과 문서 오리진 분리는 운영 워커(M7)에서, 로컬 하네스는 가상 오리진 하나(http://tf.local)로 문서·자산을 같이 응답 ② 하네스 페이지는 javaScriptEnabled false(측정 evaluate는 동작, addStyleTag 대신 evaluate로 style 삽입) ③ Harness에 `screenshot(html, vw) → {png, blocked[]}` 추가, `runRenderJob({html}, h)` = renderViewports 5종 전체 페이지 PNG, renderBlockedRequests = 막은 URL 수(중복 제거), externalRequests = 실제로 나간 요청(route가 전부 막으므로 빈 배열)
- 영향 범위: apps/worker(jobs/render·render/harness·measure), packages/renderer(fonts)
- 되돌리기 비용: 낮음

## ASM-059 · M2 · gap · 2026-11-25T20:40Z
- 질문: 6.11.4 preview 호스트·서명·iframe·편집 srcdoc CSP를 어떤 함수로 두나
- 근거 탐색: 06장 6.11.4, AC-06-25·26, 09장 9.4.4 ⑧, ASM-027 ⑥
- 선택: ① `apps/web/src/lib/preview.ts`: signPreview(HMAC-SHA256 hex, `kind|id|vp|exp`), handlePreview(GET /render/{candidate|version}/{id}, 서명 timingSafeEqual, exp ≤ now 또는 > now + 15분이면 403, 없는 후보 404, 본문 = compilePage, 헤더 6.11.4 문자열 그대로), issuePreviewUrl(소유자 아니면 404, exp = 발급 + 600초), previewFrame(표시 sandbox=""·측정 sandbox="allow-same-origin" 화면 밖). share는 공개 링크 확인(M6) 전까지 404 ② 자산 URL은 루트 상대(`/fonts/…`·`/assets/…`)로 두어 문서 오리진(preview = PREVIEW_ORIGIN, srcdoc = 부모 WEB_ORIGIN)으로 해석되게 한다(6.11.4 "WEB_ORIGIN 절대 URL"과 같은 대상, 본문 외부 URL 0) ③ compileForEdit(tokens, tree, vw, {webOrigin, spec, data}) = 편집 토큰으로 컴파일 + `<head>` 첫 요소 CSP meta ④ 하네스 parentProbe: JS 켠 부모 페이지에 sandbox="" iframe srcdoc → `window.__xss` 미설정·`contentDocument === null` 확인 ⑤ web → renderer 의존 추가
- 영향 범위: apps/web(lib/preview), packages/renderer(m2 compileForEdit), apps/worker(harness parentProbe)
- 되돌리기 비용: 낮음

## ASM-060 · M2 · gap · 2026-11-25T21:00Z
- 질문: AC-06-24 정적 검사(`\son\w+=`)가 이스케이프된 사용자 문구(`<img onerror=…>` → `&lt;img onerror=…`)까지 잡는다
- 근거 탐색: 04장 CM-05, 06장 AC-06-24, render.test staticBad
- 선택: 컴파일러 `esc`가 `=`도 `&#61;`로 바꾼다(텍스트·속성 값 공통, 브라우저 표시는 같음). 폰트 서브셋 글자 수집은 `&#61;`을 되돌려 센다
- 영향 범위: packages/renderer(html·compile), apps/worker(harness facesOf)
- 되돌리기 비용: 낮음

## ASM-061 · M2 · gap · 2026-11-25T21:40Z
- 질문: AC-03-15·17·18·45·46 검사용 렌더(renderBlockSample·renderComponentGallery·renderStepProbe)를 어떻게 만드나
- 근거 탐색: 03장 3.5.1·3.5.3·3.6.1·3.1.5, 04장 4.6.2 상한, ASM-025 ③
- 선택: ① renderBlockSample = 프리셋 유형 표준 명세 + 블록 하나만 있는 원시 트리(patternRaw order 지정, 마지막 inverse 끔, footer 샘플은 hero 1개 + 해당 footer) + 덱(typical = 용도 템플릿, max = 4.6.2 상한 길이 한국어 문구 `maxDeck`, 템플릿에 없는 stats·work는 예시 값), 프리셋 excludedVariants면 null ② renderStepProbe = 토큰 CSS + 단계 9종 `[data-step-probe]` ③ renderComponentGallery = components.json 18종 × variant × state(true인 것만) 케이스(`<id>.<variant>.<state>`), hover·active·focus-visible은 층 CSS 상태 규칙을 `[data-state=…]`로 바꾼 사본으로 강제, disabled·error·checked·open·expanded·placeholder는 실제 속성. max 카피 = Button 10·Tag 8·Stat 값 10자(AC-03-17) ④ 문서 머리 조립을 `documentHtml`로 분리해 갤러리도 같은 폰트·토큰·층 CSS를 쓴다 ⑤ 결과에 맞춘 수정: Stat 값 nowrap 해제(10자 상한이 375에서 넘침), pricing 플랜 덱이 없으면 목록 생략
- 결과: 갤러리 8프리셋 × typical(G-02·G-07)·max(G-04·G-05) 위반 0
- 영향 범위: packages/renderer(samples·gallery·compile·m2·components.css), packages/design-spec(patternRaw opts)
- 되돌리기 비용: 낮음

## ASM-062 · M2 · gap · 2026-11-25T22:00Z
- 질문: 3.13.5 colorName 사전(≥ 40)과 판정 순서, 사전 파일은 어디서 만드나
- 근거 탐색: 03장 3.13.5·AC-03-41, 01장 D-0111, 09장 seed:temp(config 묶음 temp 생성)
- 선택: ① 사전 원천 = `packages/taxonomy` COLOR_NAMES(기본 색 22개가 0~360 빈틈없이 + 명도·채도 조건 색 20개 = 42), seed:temp가 같은 내용을 `config/color-names.ko.json`(provenance temp)으로 낸다. DesignData.colorNames는 이 파일 ② 판정: OKLCH → C < 0.03 무채색 5단계 → 조건 색(h·l·c 모두 맞으면, 수식어 없음) → 기본 색 + 수식어(밝은 ≥ 0.80 / 짙은 < 0.40 / 탁한 C < 0.08 / 선명한 C ≥ 0.20, 최대 1개, 명도 우선) ③ 사람 라벨 60색 일치율(85%)은 fixtures/color-names.json이 사람 데이터라 BLK-007 범위
- 영향 범위: packages/taxonomy(color-name), scripts/data/seed-config.ts, config/color-names.ko.json, packages/design-spec(data)
- 되돌리기 비용: 낮음

## ASM-063 · M2 · gap · 2026-11-25T22:10Z
- 질문: 3.6.1 fallback 열의 "블록 제거…"(feature.stack·showcase·gallery.grid)를 blocks.json에 어떻게 적나
- 근거 탐색: 03장 3.6.1 표·AC-03-21(끝 = 이미지 0장 variant 또는 블록 제거)
- 선택: seed:temp가 "블록 제거"가 든 셀(〃 포함)을 `fallback_variant: "remove"`로 적는다. 조건부 문구(saas에서 value 없으면 value.numbered 등)는 `fallbackKo`로 남기지 않고 제거로 본다(생성 파이프라인 M5에서 용도 필수 블록 처리)
- 영향 범위: scripts/data/seed-temp.ts, data/taxonomy/blocks.json(temp)
- 되돌리기 비용: 낮음

## ASM-064 · M2 · gap · 2026-11-25T22:35Z
- 질문: 3.8.1 헤드라인 넘침 처리(덱 교체 → 단계 하향 → warn)를 확정 단계에서 어떻게 계산하나
- 근거 탐색: 03장 3.8.1 headlineBudget(S-39·T-30·U-11)·AC-03-26, 04장 4.10.2
- 선택: ① headlineBudget(size = expectedSize(단계, vw), vw, text_cols, container) = floor(floor(textWidth / (size × 0.95)) × 줄수 × 0.85), 1280 2줄·375 3줄. 상수는 HEADLINE_SPEC ② 토큰 판정: 공백 뺀 글자 수 ≤ maxChars, 마지막 줄 글자 수(한 줄 글자 수로 나눈 나머지 근사) ≥ 3(1줄 2자 이하도 고아로 봄) ③ resolveTree에 budget(tokens, sizeOf)이 오면 hero·cta 헤드라인에 적용: 같은 덱 키 옵션을 시작 옵션부터 순서대로 → 다 안 되면 한 단 하향(t-display → t-1 → t-2) 후 다시 → 그래도 안 되면 원래 옵션 유지(warn, M3 AIL-24). 하향은 섹션 role_overrides.headline ④ 렌더러는 role_overrides를 `data-step`으로 내고 text-roles.css 끝의 `[data-role][data-step=…]` 규칙이 문맥 규칙을 이긴다 ⑤ cta는 text_cols가 없어 {lg 12, base 4}
- 결과: 표준 트리 24 중 8개 하향, AC-03-26 통과
- 영향 범위: packages/design-spec(standard·stubs), packages/renderer(compile·text-roles)
- 되돌리기 비용: 낮음

## ASM-065 · M2 · gap · 2026-11-25T21:30Z
- 질문: G-12 명세 무결성·AIL-17 스케일 밖 값의 표본 범위와 margin:auto 식별(M2-09e)
- 배경: 04장 G-12·AIL-17은 "토큰 집합 안"을 요구하지만 표본 범위(어떤 요소·속성)와 margin:auto 식별법을 정하지 않았다.
- 근거 탐색: 04장 4.10.2 G-12·4.11 AIL-17(T-28), 03장 3.1.5 expectedSize·H6 tolerancePx, AC-03-45
- 선택: ① 기준 집합(design-spec tokenReference): 색 = color 토큰 + border 토큰 color(ΔE_OK ≤ 0.01, alpha 차 ≤ 0.01), radius = radius.*, spacing = space.* + layout.*.gutter/margin + 0, font-size = 9단계 expectedSize(vw)(±H6 tolerancePx) ② 표본(worker measure): 보이는 요소 전부(svg 내부 제외)의 배경색·테두리색(폭>0)·px radius(>0), 텍스트 요소의 color·font-size, `data-layout-auto` 밖의 padding·flex/grid gap·세로 margin, 좌우가 다른 가로 margin(같으면 auto 중앙 정렬로 봄). 음수 margin은 절댓값 ③ G-12 = deriveTokens(l2[, brand hex_in]) 잎 비교 불일치 + AIL-17 판정, spec 없으면 실패 ④ ΔE 계산은 scoring 안 OKLab(의존 규칙: scoring → config만)
- 결과: 표준 트리 24 × 뷰포트 5 위반 0, 13px·15px 픽스처 전 뷰포트 검출, 폴백 3종 위반 0
- 영향 범위: packages/design-spec(integrity), apps/worker(measure), packages/scoring(gates)
- 되돌리기 비용: 낮음

## ASM-066 · M2 · gap · 2026-11-25T21:50Z
- 질문: 05장 5.5 추출기(원시 특징 F01~F30)의 정의가 모호한 부분을 어떻게 구현하나(M2-09d1, AC-04-08 선행)
- 근거 탐색: 05장 5.4.2·5.5.1~5.5.3·5.5.6, 09장 9.1.3 의존 규칙(extractor = Page 입력, 의존 없음)
- 선택: ① Sec "최상위 블록(중첩 시 가장 바깥)": 조건을 만족하는 자식이 2개 이상인 감싸개(main 등)는 내려가서 그 자식들을 Sec로 본다 ② F13 = 블록 수 / (측정 면적 / 1280×800)(면적 정규화, 2400px이면 /3) ③ F18 = 첫 뷰포트 T 최대 font-size / 본문 크기 ④ F29 = 2개 이상인 행만 최빈값, 없으면 1 ⑤ F28 line-height normal = 1.2 ⑥ 합집합 면적은 4px 격자 래스터화 ⑦ 미등록 generic: sans-serif·system-ui → sans_neo_grotesque, cursive → script, fantasy → display ⑧ 픽셀: 측정 영역 스크린샷을 sharp(nearest)로 폭 320 축소(worker가 decode 주입, 추출기는 이미지 라이브러리 무의존), k-means++ PRNG = mulberry32(42) ⑨ 하네스 `features(html, vw)`: 애니메이션 finish 후 추출(5.4.2 7단계, 로컬 렌더는 대기 없음)
- 결과: 앵커 8종 키 30개·2회 DOM 일치·픽셀 차 ≤ 0.01, 다크=T7·pill=T6. 표준 saas 트리에는 그림자 표면이 없어 F05=0(Sf 정의상 그림자만 있는 카드는 표면 아님) → M3 왕복 검증에서 depth 축 판단
- 영향 범위: packages/extractor(dom·pixels·index), apps/worker(harness.features)
- 되돌리기 비용: 낮음

## ASM-067 · M2 · gap · 2026-11-25T22:05Z
- 질문: extractL1의 null 축·정규화기 선택(M2-09d2)
- 근거 탐색: 05장 5.5.3(null 대체 금지)·5.5.4·5.8.2, 09장 9.2.4 B18
- 선택: ① 정규화기 = data/normalizers 가장 늦은 버전(design-spec normalizerVersion 규칙과 같음) ② 축이 null이면 extractL1은 예외(0·0.5 대체 금지) ③ quantileRank: 같은 값 구간 = (첫 분위 + 끝 분위)/2/100
- 결과: AC-04-08 실행 가능, 부트스트랩 자리표시 분위(2026-S0 placeholder)로는 충족률 0.406 < 0.95 → 9.2.4 B18 코퍼스 200 렌더 재생성(ASM-020 M3 이월분)을 M2-09d3으로 당긴다
- 영향 범위: packages/extractor(l1), apps/worker(harness.extractL1)
- 되돌리기 비용: 낮음

## ASM-068 · M2 · gap · 2026-11-25T22:30Z
- 질문: 9.2.4 B18 코퍼스 200 렌더를 seed:temp에서 어떻게 돌리나(렌더는 브라우저·비동기, seed:temp 1단계는 동기·결정적)
- 근거 탐색: 09장 9.2.4 B18·F19, 05장 5.5.4·5.8.2·5.9 temp 분기, 03장 3.4.5
- 선택: ① `pnpm seed:temp --corpus` = 1단계 뒤 2단계(scripts/data/seed-normalizer.ts). 빌드된 worker dist 하네스 사용(tsx keepNames가 page.evaluate를 깨뜨림) ② 1단계 genNormalizer는 corpus.n > 0 파일이 있으면 덮어쓰지 않는다(빈 data/면 자리표시 생성 → AC-09-04 그대로) ③ 변형 = 프리셋 기본 L2에서 키마다 allowedValues(팔레트는 preset.palettes) 균등 추출, mulberry32(20261116), inFeasible 통과·홀드아웃(앵커 기본·카드 48·A/B 이미지 L2) 밖·중복 없음, 용도는 saas·local_business·portfolio 순환 ④ standardTree에 `l2` 전체 덮어쓰기 옵션(트리 제약은 앵커 명세) ⑤ 분위 = R type 7, 소수 6자리 ⑥ b0·b1 = s_k(초기 가중치) → predictL1(l2) OLS ⑦ reliable = 앵커 8 왕복 오차 ≤ roundtripAbsMax 인 축(이번 결과 전 축 false), corpus에 fit·anchor_roundtrip_max 기록
- 결과: 200 렌더 정규화기 생성, AC-04-08 0.365 < 0.95(추출 특징 다수가 퇴화: F22·F07~F09 상수, F01 중앙값 0) → 다음 단위에서 원인 진단
- 영향 범위: scripts/data(seed-normalizer·seed-temp·seed-config), packages/design-spec(stubs TreeOptions.l2), data/normalizers/2026-S0.json
- 되돌리기 비용: 낮음

## ASM-069 · M2 · gap · 2026-11-25T22:40Z
- 질문: renderer 시그니처 층(4.14·3.2.4)을 DOM·CSS로 어떻게 표현하나(04장은 `data-signature` 속성만, CM-02는 리터럴 금지)
- 근거 탐색: 03장 3.2.4 표(원천, 4.14 규칙 1), 04장 4.14·AC-04-30, CM-02, 3.8.2
- 선택: ① 루트 `<html data-signature data-signature-intensity>`, 적용 블록(spec.signature.apply_to) 섹션·nav·footer에 `data-sig="on"` ② 정적 층 `signatures.css`(층 맨 끝, 리터럴 0)에 SIG-01~04·06~08·10~12 규칙 ③ 요소형: SIG-06 마키 띠(apply_to 첫 블록이 hero면 그 뒤, cta면 그 앞, 문구 = 브랜드, aria-hidden, reduced-motion 정지), SIG-07 인라인 SVG feTurbulence 그레인(fixed, z -1, α 0.05, 배경색 섹션 background none), SIG-11 aria-hidden 아웃라인 브랜드 텍스트(hero·footer, 채움 = 섹션 배경색) ④ SIG-09 자간은 역할 단계 토큰 × 비율(라틴 0.08·한글 0.02, 3.2.4 우선) 생성 CSS, 라틴 판정 = eyebrow·nav.link 텍스트가 ASCII만이고 문자 포함 → `data-script="latin"` + 대문자 ⑤ SIG-10 = grayscale + primary screen 겹침, SIG-12 = md 이상 이미지 오프셋 그림자(space-4)·상단 여백 ⑥ 시그니처 없는 명세(검사용 페이지)는 층이 꺼진다
- 영향 범위: packages/renderer(signature.ts·css/signatures.ts·compile.ts·sources.ts)
- 되돌리기 비용: 낮음

## ASM-070 · M2 · gap · 2026-11-26T00:50Z
- 질문: 카드 그림자 단계(3.1.8 S-33)와 radius 역할(3.1.7)을 renderer가 어떻게 따르나(기존 카드 level-1 고정, 카드 lg·미디어 md로 표와 뒤바뀜)
- 근거 탐색: 03장 3.1.7 표(radius.md = 버튼·카드, radius.lg = 이미지·큰 패널), 3.1.8(카드 = depth.shadow_level, 강조·hover +1 최대 2, 3은 떠 있는 레이어), CM-02
- 선택: ① 루트 `<html data-shadow-level="0|1|2">`(l2 값이 0~2일 때만) ② components.css: level 0이면 카드 level-0, 2면 level-2, `data-featured` 카드는 +1, level 0 hover는 level-1 ③ `.tf-card` radius-md, `.tf-media` radius-lg ④ B18 temp 정규화기 재생성(`seed:temp --corpus`)
- 영향 범위: packages/renderer(compile.ts·css/components.ts), data/normalizers/2026-S0.json(temp)
- 되돌리기 비용: 낮음

## ASM-071 · M2 · gap · 2026-11-26T02:00Z
- 질문: 9.4.4 ⑤ 렌더러 기준선 24장의 "대표 페이지 3"·캡처 범위·환경 지문 계산 방식
- 근거 탐색: 09장 9.4.1 S-02(RENDER_ENV_ID), D-0910, 07장 7.1 시각 회귀(렌더러) 행(1280×800, 고정 레이아웃 트리 픽스처), test-policy visual.maxDiffPixelRatio
- 선택: ① 대표 페이지 = 용도별 패턴 1 픽스처 `saas-ps1-00`·`local-business-pl1-00`·`portfolio-pp1-00`를 `fixturePage(…, {presetId})`로 프리셋 8에 적용 ② 1280×800 뷰포트, 전체 페이지 캡처, 애니메이션 끔(worker 하네스 가상 오리진으로 자산 로드) ③ RENDER_ENV_ID = sha256(chromium 실행 파일 리비전 + fc-list 폰트 파일 경로:내용 해시(정렬) + /etc/os-release ID-VERSION_ID) 앞 12자, `RENDER_ENV_ID` env로 덮어쓰기 가능 ④ maxDiffPixelRatio는 playwright.config.ts에서 test-policy를 읽는다 ⑤ 기준선 `chore(visual): baseline <id>` 단독 커밋 후 자체 잠금(spec 파일 포함). Docker 지문은 needs_ci(visual-docker-baseline)

## ASM-072 · M2 · gap · 2026-11-26T02:55Z
- 질문: `validateBundle(path, json)`(ASM-025 계약)의 경로 해석과 "verified_at은 temp만 비어도 됨"(AC-03-22)을 어디서 검사하나
- 근거 탐색: 03장 AC-03-22, 09장 9.2.1 봉투, data-contracts 레지스트리(BUNDLES)
- 선택: ① 경로 = 레지스트리 `paths` 정확 일치(디렉터리 배치는 접두사) → data:validate와 같은 스키마(envelope/itemDir) + bundle 이름 검사, text·yaml 묶음은 ok=false로 거절 ② 봉투 superRefine에 "provenance human이면 items[].verified_at null 금지"를 넣어 data:validate에도 같은 규칙 적용(registry·images manifest)

## ASM-073 · M2 · conflict · 2026-11-26T03:30Z
- 질문: 린트 단계 T(LT-01~11·RH-01~02·G-01)의 판정 세부와, 4.8 패턴 힌트(hero + 4 = 5섹션)가 LT-03 하한(local_business 6, saas 6)보다 짧은 충돌
- 근거 탐색: 04장 4.5.3·4.8·4.10(“LT-09 유지”), 03장 3.6.7(다크 inverse 0~1)·892행(섹션 수 nav·footer 제외), AC-03-20·AC-04-11
- 선택: ① G-01 = PageSchema 파싱 실패, LT-01~04·09·10 error, LT-05 error(AIL-07 a), LT-06~08·11·RH-01·02 warn. 상수는 linter/data/rule-params.json "T"(skeleton 연속 ≤2, 이미지 유무 연속 ≤3, CTA ≤2, 다크 inverse [0,1]), 리듬 값은 spec.rhythm ② 엄격 교대 = 6섹션 이상이 전부 bg/surface이고 인접이 모두 다름 ③ LT-09는 목록 슬롯 안 같은 참조를 1회로 센다(menu 그룹 펼침), link 라벨 제외 ④ RH-02 이미지 섹션 = image 슬롯 있음 또는 bg=image ⑤ patternRaw: 하한보다 짧으면 용도 선택 블록(명세 순서) 중 없는 것을 마지막 섹션 앞에 넣는다(ASM-053 ②의 “footer 포함으로 셈”을 대체) ⑥ variant는 선호 순 깊이 우선 탐색으로 RH-01·LT-05를 피한다(pick 고정 블록은 그대로) ⑦ 같은 덱 키를 여러 슬롯이 쓰면 이어지는 index(feature·process, showcase·gallery), 헤드라인 줄 예산 교체는 다른 슬롯이 쓰는 옵션을 제외한다 ⑧ AIL-04·05·12·18(단계 T)은 M3 린터에서
- 영향 범위: packages/linter(stage-t), packages/design-spec(standard.ts), fixtures/layouts(pl1-00 제외 재생성)
- 되돌리기 비용: 낮음

## ASM-074 · M2 · gap · 2026-11-26T04:20Z
- 질문: AC-03-20은 `harmonyScore(spec, tree).total`(렌더·린터 입력 없음)인데 3.14.5는 1280 렌더 측정·리듬 위반을 입력으로 둠. scoring 의존은 config뿐(9.1.3)이라 linter·design-spec 데이터를 import할 수 없음
- 근거 탐색: 03장 3.14.1~5, 04장 4.10.3, 09장 9.1.3(scoring 입력 `{Features, Violation[], DesignSpec}`), design-spec compile.ts(`forbidden.conflict_ids` = l2Conflicts)
- 선택: ① 3번째 선택 인자 `{render, violations, conflicts}`. 없으면 정적 판정: H1~H3 팔레트 역할 토큰(primary·accent·bg·surface·surface-inverse, 상태·on-*·hover 제외), H4·H5·H7 font·type 토큰, H6·H8·H9 토큰 생성 값이라 만점, H12는 판정 보류(만점, measured "not_provided"; 파이프라인은 linter 위반을 넘긴다) ② 상충 = spec.forbidden.conflict_ids(CF-03·04·08 등 데이터 의존) ∪ 명세·트리 판정(CF-01 glass+이미지 섹션 없음, 05, 06, 09, 10, 11, 12 hero.centered+eyebrow 정규식) ∪ 인자 ③ bg 채도 상한은 theme 키(dark는 light 값 0.03) ④ 상수는 findRepoRoot()/data/taxonomy/harmony.json에서 읽음(scoring 새 의존 없음)
- 영향 범위: packages/scoring(harmony.ts·harmony.test.ts)
- 되돌리기 비용: 낮음

## ASM-075 · M2 · gap · 2026-11-26T04:50Z
- 질문: AC-03-33 터치 타깃 위반(블록 샘플마다 1~3건): 건너뛰기 링크 43px, wordmark 39×36, navbar 링크 28×27(@768), 닫힌 drawer 안 링크가 Chrome ::details-content 크기로 14×54로 잡힘. 또한 하네스가 폰트 요청마다 python을 띄워(이미 있는 서브셋도) 180s 초과
- 근거 탐색: 03장 3.11(touchTargetPx 44), components.ts summary(44 = space-10 + space-1, ASM-041)
- 선택: ① skip-link·a.tf-wordmark·navbar 링크·drawer 링크에 min-height(·min-width) = space-10 + space-1, inline-flex 가운데 정렬 ② 닫힌 drawer 패널 display:none(시각·포커스 동작 변화 없음) ③ navbar 안 wordmark min-width 0 → 44 ④ 하네스: 같은 이름 서브셋 파일이 있으면 materializeFonts 생략. 시각 회귀 24장 그대로 통과
- 남은 위험: 빈 폰트 캐시(새 컨테이너·CI)에서는 서브셋 생성(CJK 원본 로드) 비용으로 2코어 환경 180s 초과 가능 → 14d 후속(상주 서브셋 프로세스 검토)
- 영향 범위: packages/renderer/src/css(base·components·blocks/chrome), apps/worker/src/render/harness.ts
- 되돌리기 비용: 낮음

## ASM-076 · M2 · conflict · 2026-11-26T05:25Z
- 질문: AC-03-23(한글 텍스트 실제 폰트 = 지정 한글 서체, 시스템 폴백 0) 실패 원인 ① temp 서브셋은 라틴 서체도 Noto CJK 원본에서 만들어 한글 글리프를 담음 → heading 라틴 서체가 한글까지 렌더(3.7: 라틴 글자만) ② 3.7.4 mono 스택("tf-<mono>", ui-monospace, monospace)에 한글 서체가 없어 SIG-08 모노 라벨(eyebrow)의 한글이 시스템 폰트로 빠짐 ③ 하네스가 노드 전체 플랫폼 폰트를 읽어 라틴 글자(괄호·숫자)의 라틴 서체까지 셈
- 근거 탐색: 03장 3.7.3(983·987행), 3.7.4, 411행 SIG-08, AC-03-23
- 선택: ① subset_fonts.py: script=latin 서체는 한글·CJK 글자를 빼고 서브셋(실제 라틴 서체와 같은 동작) ② mono 스택 = [mono, body 한글, ui-monospace, monospace](3.7.4의 heading 라틴→한글 순서와 같은 원리) ③ 하네스 platformFontsForHangul: 한글 연속 구간을 클래스 없는 span으로 감싸 그 span만 판정. 시각 회귀 24장 그대로, AC-04-08 0.5625·AC-04-11 BLK-013 변화 없음
- 영향 범위: packages/assets/py/subset_fonts.py, packages/design-spec/src/tokens.ts, apps/worker/src/render/harness.ts. 폰트 캐시(/tmp/tastefit-harness-fonts)는 비워야 함(이름 같고 내용 다름)
- 되돌리기 비용: 낮음

## ASM-077 · M3 · gap · 2026-11-26T08:30Z
- 질문: M3 린터 수용 테스트(AC-04-12·26, 9.4.5 ①)의 API·예시 형식이 장에 없음. "규칙 수 = 04장 규칙 수"의 규칙 범위도 불명(AIL만인지 LT·CP 포함인지)
- 근거 탐색: 04장 4.6.4·4.13.1~2·AC-04-26(24개 규칙), 09장 9.4.5 ①·9.2 B15, 기존 linter m2.ts(staticLint·treeLint)·data/linter/examples 골격(ASM-021)
- 선택: ① 규칙 = 4.13.2 AIL 24개(AC-04-26 "24개 규칙"). LT·RH·G·CP는 게이트·트리 검사로 각자 AC가 있음 ② `RULES: {id, stage[], severity[], appliesTo[], messageKo, fixHint}[]`, severity는 표 심각도 칸에 나오는 error·warn 집합 ③ `lintAll({spec?, tree?, copy?, brand?, snapshot?, ...}) → LintFinding[]`, 렌더 단계 D·P 입력은 하네스 `lintSnapshot(html, vw, {spec?})`(계약 확장)이 만든 스냅숏 ④ B15 예시 `data/linter/examples/AIL-xx/*.json` = `{ruleId, expect: violation|clean, severity?, stages[], provenance, input}`; input.html·vw가 있으면 렌더, 나머지는 lintAll에 그대로 ⑤ `matchCliche(text, {slot?: llm|user, userText?}) → {id, severity, lang}[]`, 기본 slot=llm(error), user 슬롯에서 userText와 같은 표현은 warn. 사전 패턴은 temp라 활용형 어간 정규식으로 seed:temp에서 다시 만든다
- 영향 범위: tests/acceptance/m3/linter.test.ts, packages/linter, apps/worker harness, data/linter
- 되돌리기 비용: 중간(자체 잠금 전까지 낮음)

## ASM-078 · M3 · gap · 2026-11-26T08:55Z
- 질문: AC-04-19(게이트·조화 순수 함수, 픽스처 ≥2)·AC-04-21·AC-08-11·12·13a(G-11)의 API·픽스처 위치·"통과/실패"의 H 항목 뜻이 장에 없음. `config/originality.json`(08장 8.3.3)이 저장소에 없음
- 근거 탐색: 04장 4.10.2·4.10.3·4.10.6·4.10.7, 08장 8.3.1~8.3.5, 기존 scoring gates.ts(evaluateGates)·harmony.ts(harmonyScore), 05장 레퍼런스 temp 시드(originality_sig 없음)
- 선택: ① scoring `GATE_FNS: Record<G-01..G-13, (input) => {id, pass, violations[]}>`, `HARMONY_FNS: Record<H1..H12, (input) => {score, max, measured}>`(max 합 100). 픽스처 `packages/scoring/fixtures/<id>/*.json` = `{id, expect: pass|fail, input}`, H는 pass = 만점·fail = 감점 ② `checkOriginality({sig, phash, texts}, ReferenceSig[], cfg) → OriginalityReport`(8.3.3 필드 + g5_max_run), G-11 게이트 입력 `{originality}` ③ extractor `phash64(rgb, w, h, channels) → 16자리 hex`(그레이스케일 DCT 64비트), `hamming64(a, b)` ④ `config/originality.json`은 08장 8.3.3 블록을 그대로 옮긴 파일(구현 단위에서 생성·잠금 대상 등록), `loadOriginalityConfig(root)` ⑤ 레퍼런스 temp 시드에 서명이 없어 픽스처는 합성 서명 10개와 하네스 렌더 1장으로 만든다. 변형 이미지는 worker 의존성 sharp로 만든다
- 영향 범위: tests/acceptance/m3/gates.test.ts, packages/scoring, packages/extractor, config/originality.json
- 되돌리기 비용: 중간(자체 잠금 전까지 낮음)

## ASM-079 · M3 · gap · 2026-11-26T09:15Z
- 질문: AC-04-20(QualityReport 저장·컬럼 일치)·AC-04-45(reliable·subjective)·AC-04-43(임계값 원천)을 M3에서 어떻게 검사할지. 후보 저장은 파이프라인(M5) 몫이고 M3에는 잡이 없음
- 근거 탐색: 04장 4.10.4·4.10.7·4.12·4.19, 06장 candidates DDL(harmony_score·taste_score smallint, rank_score real, eligible), 07장 7.12.1 배정표(M3)
- 선택: ① scoring `tasteMatch({v, t, sigma, reliable, subjective?}) → {tm, sFree|null, warnings[], weights, rawWeights, axisGaps[{axis,…}]}`(축 키 A1~A5, 벡터는 5원소 배열) ② `eligibility({gatesPass, harmony, tm, sFree, warn, fallback})`(경계 포함, 폴백은 G·H만), `rankScore({tm, harmony})`, `selectVisible(CandidateScore[]) → {v_true|v_fit|v_bal: id|null}`(동률은 patternSlot 1) ③ `QualityReportSchema`(zod, 4.10.7 + warnings[]), `qualityColumns(report) → {quality_report, harmony_score, taste_score, eligible, rank_score}`(반올림, rank는 eligible일 때 공식값). M3 AC-04-20은 이 유도 함수 일치로 보고, 실제 DB 저장·노출 100%는 M5 파이프라인 테스트가 같은 함수를 쓴다 ④ AC-04-43 리터럴 검사는 packages/scoring/src(주석 제외)에서 비교·곱·나눗셈 뒤 generation 임계값 숫자, 잠금 검사는 guard lockStage
- 영향 범위: tests/acceptance/m3/scoring.test.ts, packages/scoring
- 되돌리기 비용: 중간(자체 잠금 전까지 낮음)

## ASM-080 · M3 · gap · 2026-11-26T09:45Z
- 질문: 9.4.5 ③④⑤·AC-05-12·14·15·22·24·25의 "프리셋 앵커 렌더"가 어떤 페이지인지, extractL2의 형태, 후보 1개 평가 함수, 왕복 보고 형식이 장에 없음
- 근거 탐색: 05장 5.5.3~5.5.6·5.8·5.9, 03장 3.4.7, 기존 extractor(extractFeatures·toL1)·하네스 extractL1·design-spec anchorTaste, 06장 normalizers DDL(트리거 주석만 있음)
- 선택: ① 앵커 렌더 = `anchorTaste(T)`(μ = predictL1(기본 L2))로 compileSpecs한 v_true 명세 + fallbackMockup 표준 트리, 용도 = types.json goodPurposes[0], 1280 ② `extractL2(page, opts)` = 5.5.3 원시 특징(기존 extractFeatures의 공개 이름), `toL1(l2, normalizer)`, 하네스에 `extractOptions()`·`normalizer()` 노출(계약 확장) ③ `l1Distance({version, vector}, {version, vector})` 버전 불일치 예외 ④ worker `evaluateCandidate(harness, {spec, tree, html}, data) → {viewports[], report: QualityReport}`(렌더 5뷰포트 + 추출 + 린트 + 게이트) ⑤ `eval:extractor:selfcheck --json <path>` 보고 `{presets[{typeId, intended, measured, radiusErrPx, bgDeltaE, accentDeltaE, bodyFontMatch}]}`, `eval:extractor` → reports/extractor_eval.md + .json `{normalizer, axes[{axis, rho, mae}]}` ⑥ released 정규화기 UPDATE 거부 트리거는 새 마이그레이션으로 추가(6.3.3 표의 주석 "05장 5.3.7"을 구현) ⑦ AC-05-15는 사람 라벨이 없으면 실패가 정상이고 BLOCKED로 넘긴다(temp 라벨로 합격 처리하지 않음)
- 영향 범위: tests/acceptance/m3/extractor.test.ts, packages/extractor, apps/worker(harness·quality/evaluate), scripts(eval), packages/db 마이그레이션
- 되돌리기 비용: 중간(자체 잠금 전까지 낮음)

## ASM-081 · M3 · gap · 2026-11-26T10:10Z
- 질문: AC-04-13·AC-08-13("골든 노출 시안")·AC-08-15(프롬프트 조립)·AC-03-43(편집 선택지 disabled)은 M5·M6 기능에 기대는데 07장 배정표는 M3. 같은 AC를 M3에서 어떻게 검사할지, AC-08-14의 "approved 저장"(프리셋 파일에 status 없음)
- 근거 탐색: 07장 7.12.1 배정표, 04장 4.6.3·4.12 buildFallback, 08장 8.3.4·8.3.5, 03장 3.4.1 lint-matrix, data/golden(brand 포함)·presets(provenance만)
- 선택: ① M3 골든 노출 시안 = 골든 θ*로 compileSpecs한 변형별 `buildFallback({typeId, purpose, variant, spec, brand}, data)`(템플릿 카피·LLM 0). M5 파이프라인 시안은 M5 테스트가 같은 검사 함수로 다시 본다 ② linter `COPY_RULES`(CP-01~12)·`copyRules(tree, {brand, spec}) → {rule, message}[]` ③ worker `evaluateCandidate(..., data, {fallback?})`가 OriginalityReport까지 채움(레퍼런스 서명은 seed) ④ llm `assemblePrompt(role, input) → 메시지`: 입력에 references가 와도 출력에 넣지 않음 ⑤ AC-08-14 = 저장소의 프리셋 파일은 모두 사용 중(approved)으로 보고 `data:validate`가 cluster_median 프리셋의 eTLD+1(공개 접미사 처리) 수 < g1_min_domains이면 실패 ⑥ AC-08-16 보고서는 사람 2인 라벨이 필요하므로 provenance human·labelers ≥ 2·yes_count 0을 요구하고, 없으면 BLOCKED(temp 대체 없음) ⑦ AC-03-39 CF 픽스처 `packages/scoring/fixtures/conflicts/CF-xx/*.json` = `{cf, spec, tree}`, H ≤ 79는 harmonyFloor 미만으로 읽음 ⑧ AC-03-43 `presets:lint-matrix --json` 보고 `{presets[{presetId, combos, errors[{key, value, rules, cf}]}]}`, design-spec `editChoices(spec, data) → {key, value, disabled}[]`
- 영향 범위: tests/acceptance/m3/golden.test.ts, design-spec, linter, llm, scoring, worker, scripts
- 되돌리기 비용: 중간(자체 잠금 전까지 낮음)

## ASM-082 · M3 · gap · 2026-11-26T14:00Z
- 질문: AIL 규칙의 D·C·T 입력 형태(카피 역할·스냅숏 필드)와 표의 모호한 조건(AIL-04 pill 판정, AIL-12 항목 유형, AIL-14 고유명사, AIL-16 기본값 목록 위치)이 장에 없음
- 근거 탐색: 04장 4.13.1·4.13.2·4.6.3 CP-10·4.6.4, 03장 3.1.7 radius 표·theme.css 초기화 목록, blocks.json(align·icon_grid), data/taxonomy/harmony.json(defaultsBlacklist 없음)
- 선택: ① 카피 = `CopyItem{role, text, source?: llm|user, style?}[]`(role 예 hero.headline·hero.eyebrow·button·proof.quote·proof.author) ② AIL-04 pill = eyebrow style "pill" 또는 spec `shape.radius_family=pill`(태그 999) ③ AIL-12 항목 유형 = 숫자 포함→number, 인용부호 시작→quote, 그 밖→text, 섹션 image 슬롯→image 1칸 ④ AIL-14 키워드 = brand keywords·keyPoints·tags·properNouns·location, 고유명사 = 대문자 시작 라틴 단어 ⑤ AIL-16 목록은 harmony.json에 키가 없어 `packages/linter/data/defaults.json`(03장 목록 + 표 예시)에 둔다. 서체(Inter 등)는 AIL-03이 맡는다 ⑥ AIL-13 사용자 원문 슬롯의 사용자 표현은 4.6.4대로 warn(메타 심각도는 표대로 error) ⑦ D 탐지 상수는 rule-params.json에 추가 ⑧ 규칙이 받는 입력은 그 규칙 단계의 입력뿐(spec은 톤·프리셋 문맥으로 항상 전달)
- 영향 범위: packages/linter(rules·data), apps/worker harness(lintSnapshot)
- 되돌리기 비용: 낮음

## ASM-083 · M3 · gap · 2026-11-26T14:20Z
- 질문: 하네스 lintSnapshot의 스냅숏 필드와 카드·버튼·배지 판정 기준, B15 예시를 어떻게 만들지(seed:temp 골격과의 관계)가 장에 없음
- 근거 탐색: 04장 4.13.1·4.13.2, 03장 3.8.1(헤드라인 줄), 기존 하네스 headlineLines·features, seed-config genLinterExamples 골격(ASM-021)
- 선택: ① 스냅숏 = 요소별 computed style(본문 하위 전 요소, svg 내부 제외) + 아이콘 카드 행(자식 전부가 ≤48px svg+제목+본문) + :root custom property 원문 + 헤드라인 줄(3.8.1과 같은 방법) + 글래스 뒤 휘도 표준편차(요소를 숨긴 스크린샷, 0–255) + spec.tokens 허용 집합(색 hex·radius·space px·스텝별 expectedSize) ② 카드 = data-card·article·클래스 card/__item/__cell, 버튼 = button·role=button·btn 클래스·cta 역할, 배지 = eyebrow·badge 역할·badge/pill/tag 클래스, 장식 = aria-hidden 또는 글자 없음, margin:auto = 좌우 여백 같고 0보다 큼 ③ B15 예시는 seed:temp가 scripts/data/linter-examples.ts 정의로 만든다(골격 교체, provenance temp). 손으로 쓴 최소 HTML·JSON이며 실제 렌더러 출력 검증은 골든·폴백 단위가 맡는다
- 영향 범위: apps/worker/src/render/lint-snapshot.ts, scripts/data, data/linter/examples
- 되돌리기 비용: 낮음

## ASM-084 · M3 · gap · 2026-11-26T14:20Z
- 질문: 게이트 순수 함수의 입력 형태(G-01·G-08~G-11·G-13), G-13이 쓸 abuse 판정 함수(08장 8.9.2 `packages/compliance/abuse.ts`)가 없음, ΔE2000을 OKLab 값에 어떻게 적용할지
- 근거 탐색: 04장 4.10.2·4.10.6, 08장 8.3.2·8.3.3·8.9.2, 기존 scoring evaluateGates·harmonyScore, config/high_risk_brands.json·prohibited_categories.json
- 선택: ① 측정 게이트(G-02~07·12) 입력 = PageMeasure 1개 또는 `{measures: []}`, G-01 = `{spec, tree}`(treeLint의 G-01·LT-01~04·09·10 error), G-08 = `{axe: [{vw, violations[{id, impact}]}]}`(serious·critical 차단), G-09 = `{lint}`(error 수 > generation.lint.errorMax), G-10 = `{brandName, nav[], hero[], footer[]}`(NFC 포함), G-11 = `{originality}`, G-13 = `{texts}` ② `judgeAbuse(texts)`: 8.9.2 정규화 후 canonical·alias(길이 ≥ 3) 포함·도메인 포함 = high_risk, 피싱 문구 11개 = phishing_term, 금지 업종 키워드 = prohibited_category. 편집 거리(c)는 브랜드명 단독 판정(브리프)에서 M5에 추가 ③ ΔE2000 = OKLab → 선형 sRGB → XYZ(D65) → CIELAB 후 CIEDE2000 ④ G3 비교 대상이 없으면 min_phash_distance = 64(비트 수), 참조 id null ⑤ H 항목 함수 입력 = `{spec, tree, render?, violations?, conflicts?}` → harmonyScore의 해당 항목 {score, max, measured} ⑥ 픽스처는 scripts/data/gen-scoring-fixtures.ts가 결정적으로 만들고 자체 잠금
- 영향 범위: packages/scoring(gate-fns·originality·fixtures), packages/compliance, packages/extractor(phash), config/originality.json
- 되돌리기 비용: 낮음

## ASM-085 · M3 · gap · 2026-11-26T14:20Z
- 질문: evaluateCandidate의 구성(뷰포트별 측정·린트 입력·G-08 미실행 처리·G-10 브랜드명 출처·원본 유사도 비교 집합)과 자기검증 토큰 수준 판정 방법이 장에 없음
- 근거 탐색: 04장 4.10.1~4.10.7·4.13, 05장 5.9, 08장 8.3.1, 하네스 measure·features·lintSnapshot
- 선택: ① 측정 = generation.renderViewports 5개 measure, L1 = 1280 features→toL1, 린트 = S·C·T(spec·트리 카피·brand) + D·P(375·1280 스냅숏) ② 트리 카피 role = `블록.슬롯`(목록 항목 `.item`, 링크 라벨 = button) ③ G-08은 axe 실행기를 받을 때만 판정하고 없으면 fail "axe 미실행(BLK-008)" ④ G-10 브랜드명 = opts.brand.name, 없으면 nav 워드마크 텍스트 ⑤ 원본 유사도 비교 집합 기본 = 빈 집합(temp 레퍼런스에 originality_sig 없음), phash는 비교 대상이 있을 때만 계산 ⑥ TM reliable = 정규화기 reliable ∧ 측정 가능, σ = spec.calibration_trace.sigma ⑦ 자기검증 radius = 요소별 computed radius(원형·pill 상한 제외)와 토큰 radius 집합의 최대 차, 주 배경 = body·html·첫 자식 중 처음 불투명한 배경, accent = 페이지 computed 색 중 최소 ΔE2000(accent 토큰이 없는 단색 팔레트는 0, accentToken false)
- 영향 범위: apps/worker/src/quality/evaluate.ts, scripts/eval
- 되돌리기 비용: 낮음

## ASM-086 · M3 · gap · 2026-11-26T14:20Z
- 질문: CP-01~12를 확정 트리에서 어떻게 판정할지(표의 검사 칸이 AIL 규칙이 아닌 CP-01·02·06·08·10·11), 브랜드 입력에 brand_color가 없을 때 compileSpecs 동작
- 근거 탐색: 04장 4.6.3·4.6.4·4.13.2, 08장 8.7.5·8.9.2, 골든 32 brand(brand_color 없음), 3.13(브랜드 색 선택 입력)
- 선택: ① CP-03·04·05·07·09·12 = AIL-21·21·13·19·22·23 error(단계 C) ② CP-01 = 워드마크 슬롯 텍스트 = NFC 브랜드명 ③ CP-02 = hero.headline·sub에 브랜드명 또는 입력 문장(description·key_points·audience, 자리표시 제외)의 2자 이상 어절 ④ CP-06 = 종결 어미(다·요·까·시오)로 끝나는 문장 중 tone.ending 패턴 비율 ≥ 90%(자리표시·사용자 원문·브랜드명 제외) ⑤ CP-08 = 브랜드명 제외 라틴 4단어 연속 ⑥ CP-10 = 전화·이메일·사업자번호 패턴이 8.7.5 예시값과 다르면 위반 ⑦ CP-11 = 고위험 브랜드 사전(judgeAbuse high_risk)에서 브랜드 입력에 없는 상표 ⑧ brand_color가 없거나 빈 값이면 브랜드 색 단계를 건너뛴다(팔레트 그대로) ⑨ buildFallback = fallbackMockup 명세 + 브랜드 치환 템플릿 트리
- 영향 범위: packages/linter(copy-rules·tree-copy), packages/design-spec(compile·stubs)
- 되돌리기 비용: 낮음

## ASM-087 · M3 · gap · 2026-11-26T14:20Z
- 질문: 프롬프트 조립 함수의 블록 구성과 BRAND_DATA에 자리표시 입력을 넣을지, AC-08-14 eTLD+1 계산(공개 접미사 목록)을 어떻게 할지
- 근거 탐색: 04장 4.7.2, 08장 8.3.2 G1·AC-08-14, dependency-allowlist(PSL 패키지 없음)
- 선택: ① assemblePrompt = SYSTEM(prompts/<role>@v1.md) + DESIGN_SPEC + BRAND_DATA(경계 id = 입력 해시 8자리, 잡 id를 받으면 그것). 레이아웃 = purpose·primary_action·key_points 개수, 카피 = BrandInput(brand_color 제외). CATALOG·FEWSHOT·PATTERN·COPY_KEYS·FORBIDDEN·OUTPUT_SCHEMA는 M5 파이프라인 단위에서 붙인다 ② `[임시]`·`[예시]`로 시작하는 입력은 브랜드 사실이 아니므로 BRAND_DATA에서 뺀다 ③ eTLD+1 = 국내·주요 2단계 공개 접미사 27개 최소 목록 + 마지막 2라벨(전체 PSL은 허용 목록 밖) ④ 저장소의 프리셋 파일은 모두 approved로 보고 data:validate에서 판정
- 영향 범위: packages/llm(prompt·prompts), scripts/data/validate.ts
- 되돌리기 비용: 낮음

## ASM-088 · M3 · gap · 2026-11-26T14:32Z
- 질문: presets:lint-matrix의 렌더 범위·용도, 등록 상충(CF-13~)의 저장 형태, 편집 선택지 disabled 판정이 장에 없음. harmony.json에 3.14.4가 말하는 `conflicts` 키가 없음(CF가 items 안에만 있음)
- 근거 탐색: 03장 3.4.1 S-33·3.14.4·AC-03-43, 04장 4.3 F 집합·4.15, design-spec snap(allowedValues·inFeasible·l2Conflicts)
- 선택: ① 조합 = 프리셋 기본 L2에서 키 1개를 allowedValues(페어링 제약 반영)의 다른 값으로 바꾼 것, standardTree(용도 saas) → compilePage → S·C·T 린트 + 375·1280 D·P 린트, AIL error가 있으면 error 조합 ② harmony.json에 top-level `conflicts` = CF-01~12(id·comboKo) + lint-matrix 등록분 {id, preset, key, value, rules, comboKo, source}. seed:temp의 LINT_MATRIX_CONFLICTS가 원천(현재 CF-13 = PS-T7 depth.style=flat → AIL-09) ③ 등록분은 inFeasible에서 제외(F 밖) ④ editChoices = 프리셋 allowed 키 × allowedValues, 현재 값이 아니면서 inFeasible이 아니면 disabled ⑤ AIL-16 기본 색 쌍은 03장 목록의 쌍(0.141 0.005 285.823 / 0.985 0 0)만 쓴다(앞서 넣은 shadcn v4 쌍 0.145/1은 T2·T6 팔레트와 우연히 같아 오탐이라 뺌)
- 영향 범위: scripts/data(presets-lint-matrix·seed-temp), data/taxonomy/harmony.json, design-spec snap, linter defaults
- 되돌리기 비용: 낮음

## ASM-089 · M3 · gap · 2026-11-26T14:37Z
- 질문: 폴백 시안 63/72가 G-10(hero에 브랜드명)에서 실패. 템플릿 hero.headline 0번 "{name}"이 짧은 이름(예 "한결")이면 헤드라인 예산(headlineFits)에 걸려 [임시] 옵션으로 바뀌고 hero의 다른 슬롯에도 이름이 없음
- 근거 탐색: 04장 4.10.2 G-10·4.12 폴백(사전 검증 트리, 템플릿 치환 name·description·primary_action·key_points), seed-config TOKEN_BASE
- 선택: temp 템플릿(B20) hero.eyebrow 0번을 "{name}"으로 둔다(seed:temp 재생성). 헤드라인 예산 규칙은 바꾸지 않는다. 사람 템플릿 확정 때 확인(HUMAN_TODO)
- 영향 범위: scripts/data/seed-config.ts, config/copy_templates.json(temp)
- 되돌리기 비용: 낮음
