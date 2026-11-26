# BLOCKED (09장 9.5.3 형식, append)

막힌 작업 기록. 항목 형식은 FINAL 09장 9.5.3 예시(`## BLK-<번호> · M<n> · <유형> · <UTC>`).

## BLK-001 · M0 · locked-conflict · 2026-11-19T13:30Z
- 대상: 09장 9.5.5 F12 라이선스 규칙(MIT/Apache-2.0/BSD/ISC/OFL만, 간접 의존성 포함) ↔ `docs/dependency-allowlist.md`(사람 잠금)에 있는 next·sharp·eslint
- 증상: `pnpm licenses list --json`에서 허용 밖 라이선스 — `@img/sharp-libvips-*`(LGPL-3.0-or-later, sharp·next optional), `caniuse-lite`(CC-BY-4.0, next), `minimatch`·`@isaacs/nonrecursive-glob-match`(BlueOak-1.0.0), `argparse`(Python-2.0, eslint dev), `tslib`(0BSD), `type-fest`(MIT OR CC0-1.0)
- 재현: pnpm licenses list --json
- 시도: (1) 허용 패키지 직접 의존만 검사 → 규칙 위반 (2) optional 제외 → sharp는 allowlist에 직접 있어 M1에서 다시 들어옴 (3) 대체 패키지 → next·sharp 대체 불가
- 가설: 규칙이 허용 목록 패키지의 실제 간접 라이선스를 반영하지 않음
- 제안 수정안(사람): F12 허용 라이선스에 0BSD·BlueOak-1.0.0·CC-BY-4.0(데이터)·Python-2.0(dev)를 추가하고, libvips LGPL-3.0은 동적 링크 바이너리로 수용 여부를 법무 확인. 이중 라이선스는 허용 쪽 선택 규칙 명시
- 처리: guard 라이선스 단계는 위 패키지·라이선스 쌍만 `blockedBy: BLK-001`(종료 코드 3)로 보고하고, 목록 밖 위반은 그대로 FAIL(1)
- 상태: open

## BLK-002 · M0 · locked-conflict · 2026-11-19T13:40Z
- 대상: tests/acceptance/m0/guard.test.ts "AC-07-25: CLAUDE.md·07·09장의 DECISIONS_LOG 경로가 하나뿐이다"(에이전트 자체 잠금, c54ffda)
- 증상: 정규식 `[\w./-]*DECISIONS_LOG[\w.]*`가 경로가 아닌 이름 언급(`DECISIONS_LOG append-only`, 9.1.2 트리의 `spec/DECISIONS_LOG.md`, `DECISIONS_LOG.md`)까지 잡아 4종이 나와 항상 실패. 문서는 spec 잠금이라 문서 쪽 수정도 불가
- 재현: pnpm vitest run tests/acceptance/m0/guard.test.ts -t "경로가 하나뿐"
- 시도: (1) 문서에서 다른 경로(`docs/DECISIONS_LOG.md` 등) 존재 여부 확인 → 없음. 실제 경로는 `docs/spec/DECISIONS_LOG.md` 하나뿐이라 AC 의도는 충족 (2) 테스트 수정은 규칙 3(에이전트 entry 변경 금지) 위반
- 가설: 테스트 작성 오류(경로 토큰과 이름 언급을 구분하지 않음)
- 제안 수정안(사람): 검사 대상을 `docs/`로 시작하거나 `/`를 2개 이상 포함하는 경로 토큰으로 한정(`/\b[\w.-]+\/[\w./-]*DECISIONS_LOG\.md\b/` 중 `docs/`로 시작하는 것만 모아 `["docs/spec/DECISIONS_LOG.md"]`와 비교) 후 `pnpm guard:relock --human`
- 처리: 이 테스트 1건만 미충족(AC-07-25 나머지 5건은 정상 판정). verify:m0 결과에 blockedBy BLK-002
- 상태: open

## BLK-003 · M0 · locked-conflict · 2026-11-19T14:30Z
- 대상: 07장 7.12.2 키 커버리지 규칙("AC·9.4 비교 기준 수치는 thresholds 키이거나 사양 상수 표 행") ↔ spec 잠금 문서의 기존 문장
- 증상: `qa:trace --key-coverage`가 표·블록 밖 비교 수치 4건을 찾음 — 06장 AC-06-61 `차이 ≤ 0.00001`(부동소수 허용오차), 06장 AC-06-64·07장 AC-07-19 `runsCompleted < 96`(골든 32×3 잡 수), 09장 9.4.6 M4 `축별 ≥19쌍`(S-06 g)
- 재현: pnpm -s qa:trace --key-coverage
- 시도: (1) 단위 환산·SC 행 전체 값 대조 → 4건 남음 (2) 문서 수정 → spec 잠금 위반 (3) "비교 기준 아님"으로 휴리스틱 예외 → 판정 완화라 하지 않음
- 가설: 사양 상수 표(7.12.1)가 잡 수(96)·허용오차(1e-5)·축별 최소 쌍(19)을 행으로 두지 않음
- 제안 수정안(사람): 사양 상수 표에 행 추가(예: SC-02에 "골든 잡 96(32×3)·축별 A/B 최소 19쌍", SC-07 또는 신규 행에 "비용 합계 허용오차 0.00001") 후 relock
- 처리: key-coverage는 이 4건(파일+문구)만 `blockedBy: BLK-003`(종료 코드 3)로 보고하고, 그 밖 수치는 FAIL(1)
- 상태: open

## BLK-004 · M0 · locked-conflict · 2026-11-19T14:35Z
- 대상: 00장 AC-00-01·AC-00-07(문서 검사, M0) ↔ spec 잠금된 01~09장 본문
- 증상: `qa:trace --docs`(ASM-005 해석) 45건 — 01~09장 어디에도 `대상: P1|P2|P1,P2|운영자` 열 표가 없음(9건), 02·05·06·07·09장은 [P0] 등 기능 태그 제목이 0개, 08장은 `[MVP]` 태그(허용 목록 밖) 30여 개
- 재현: pnpm -s qa:trace --docs
- 시도: (1) 다른 해석(기능 열 표, 인라인 `대상:` 표기) grep → 해당 없음 (2) 문서 수정 → spec 잠금 위반
- 가설: 00장 태그 규칙이 v2 장 작성 때 각 장에 반영되지 않음
- 제안 수정안(사람): 각 장 기능 표에 `대상` 열 추가, 기능 절 제목에 [P0]/[P2]/[P3]/[MVP 제외] 태그 부여(08장 [MVP]→[P0]) 후 spec relock(`human-lock`). 또는 AC-00-01·07을 문서 검사 범위를 좁혀 개정
- 처리: --docs는 01~09장 항목을 `blockedBy: BLK-004`(종료 3)로 보고. m0 qa-trace.test.ts "AC-00-01 / AC-00-07: 문서 검사 통과"(종료 0 기대) 1건은 문서 개정 전까지 미충족
- 상태: open
- 재현(테스트): pnpm vitest run tests/acceptance/m0/qa-trace.test.ts -t "문서 검사"

## BLK-005 · M0 · locked-conflict · 2026-11-19T14:50Z
- 대상: tests/acceptance/m0/repo.test.ts "AC-09-11: spec-lock 이후 모든 커밋이 Conventional Commits + Milestone 꼬리말"(자체 잠금) ↔ 이미 푸시된 커밋 5fefdda `feat(web,worker): ...`
- 증상: 테스트 정규식의 scope 문자 집합 `[\w./-]`에 쉼표가 없어 다중 scope 커밋 1건이 위반으로 잡힘
- 재현: pnpm vitest run tests/acceptance/m0/repo.test.ts -t "AC-09-11"
- 시도: (1) 커밋 메시지 수정 → 히스토리 재작성·force push 금지(9.5.5) (2) 테스트 수정 → 자체 잠금 entry 변경 금지
- 가설: 다중 scope 표기(쉼표)를 허용할지 규칙이 정해지지 않음. 이후 커밋은 단일 scope만 쓴다
- 제안 수정안(사람): scope 정규식에 `,` 허용(`[\w.,/-]`) 또는 5fefdda를 예외 목록으로 두고 `pnpm guard:relock --human`
- 추가(2026-11-19 M1): 같은 원인 커밋 207df53 `fix(config,db): …`(다중 scope)도 이미 푸시됨. 히스토리 재작성 금지라 그대로 둠
- 추가(2026-11-26): 사람 웹 커밋 a0217bb `Update SHA256 hashes in locked-hashes.json`(형식·꼬리말 없음). 예외 목록에 함께 넣어야 함
- 상태: open

## BLK-006 · M1 · locked-conflict · 2026-11-19T17:31Z
- 대상: tests/acceptance/m1/db.test.ts "9.4.3 ⑨: verify:schema-parity"(자체 잠금)가 `pnpm -s verify:schema-parity`를 호출 ↔ `.guard/verify-scripts.json`(잠금, F08)은 package.json의 verify:* 집합이 verify:fast·m0~m8과 정확히 같아야 함
- 증상: package.json에 `verify:schema-parity`를 넣으면 guard:verify-scripts FAIL, 넣지 않으면 수용 테스트 ⑨가 "스크립트 없음"으로 실패
- 재현: pnpm vitest run tests/acceptance/m1/db.test.ts -t "schema-parity"
- 시도: (1) 구현은 `pnpm db:schema-parity`(scripts/data/schema-parity.ts)로 완료 — native에서 차이 0, 컬럼 삭제·NOT NULL 변경 시 차이 검출 확인 (2) .guard 사본 수정 → 잠금 위반 (3) node_modules/.bin 우회 → 금지(우회 시도)
- 가설: 09장 9.4.3 ⑨의 명령 이름과 F08 verify 스크립트 사본이 서로 반영되지 않음
- 제안 수정안(사람): package.json과 `.guard/verify-scripts.json` 양쪽에 `"verify:schema-parity": "tsx scripts/data/schema-parity.ts"`를 추가하고 `pnpm guard:relock --human`(또는 테스트 쪽 명령을 db:schema-parity로)
- 처리: 수용 테스트 ⑨ 1건만 미충족, verify:m1 결과에 blockedBy BLK-006
- 상태: open

## BLK-007 · M2 · locked-conflict · 2026-11-19T18:18Z
- 대상: 07장 7.12.2 리터럴 감사(비교 피연산자 값 ∈ thresholds 잎 값이면 FAIL) ↔ 04장 AC-04-03 "primary hue 오차 ≤ 5°"·AC-04-07 "|v2_k − μ_k| ≥ 0.20"
- 증상: 두 비교 기준은 thresholds 키도 사양 상수 표(7.12.1) 행도 아닌데 값(5, 0.2)이 다른 잎 값(diagnosis.tunable.typeDiscWeight.initial 등, generation.variant.candidatePairDistMin 등)과 같아 수용 테스트에 쓰면 qa:trace --audit FAIL
- 재현: tests/acceptance/m2/spec.test.ts에 `toBeLessThanOrEqual(5)` 또는 `>= 0.2`를 넣고 pnpm -s qa:trace --audit
- 시도: (1) 의미가 같은 thresholds 키 탐색 → 없음 (2) spec-constants.ts → SC 행이 없어 예외 불가 (3) 우회 표기(계산식으로 숨기기) → 감사 우회라 하지 않음
- 처리: 수용 테스트(잠금)에서는 이 두 비교를 빼고(AC-04-03 대비 게이트·notice, AC-04-06 범위·moved_axes 형식만), packages/design-spec 단위 테스트에서 ±5°·0.20 대조를 한다(감사 범위 밖)
- 제안 수정안(사람): 7.12.1 사양 상수 표에 "브랜드 hue 고정 허용 5°(04장 4.2.2·AC-04-03)", "보정 사유 기록 기준 0.20(04장 4.3·AC-04-07)", "CLS ≤ 0.05(03장 AC-03-24)", "applyBrandColor 1회 ≤ 5ms(AC-03-36)", "색 이름 사전 ≥ 40개·일치율 ≥ 85%(AC-03-41, 85%는 사람 라벨 fixtures/color-names.json 필요)" 행 추가 → spec-constants.ts에 SC 상수 → 수용 테스트에 대조 추가 후 relock
- 상태: open

## BLK-008 · M2 · locked-conflict · 2026-11-19T18:21Z
- 대상: 03장 AC-03-15(axe-core serious/critical 0)·04장 G-08 ↔ docs/dependency-allowlist.md(사람 잠금, axe-core 없음)
- 증상: axe-core를 설치하면 guard:deps가 허용 목록 위반으로 실패
- 재현: pnpm add -D axe-core 후 pnpm guard
- 시도: (1) 허용 목록 패키지로 대체 → 같은 규칙 세트 없음 (2) 자체 구현 → G-08 정의(axe 규칙)와 달라 판정이 바뀜
- 처리: M2 수용 테스트는 AC-03-15의 렌더·케이스 수·G-02·G-07만 검사. axe 검사는 허용 목록에 추가된 뒤 수용 테스트에 넣는다(relock)
- 제안 수정안(사람): dependency-allowlist에 `axe-core`(MPL-2.0, apps/worker·e2e) 추가 → guard 라이선스 허용 목록에 MPL-2.0 → relock
- 상태: open

## BLK-009 · M2 · locked-conflict · 2026-11-25T04:25Z
- 대상: tests/acceptance/m2/blocks.test.ts AC-03-19(자체 잠금) ↔ 04장 4.6.2 덱 상한(목록 키는 필드별 상한) ↔ ASM-025 ⑤ 계약 `copyDeckLimits() → {덱키: 수 | {필드: 수}}`
- 증상: 테스트가 `min(슬롯 maxLength 값들) ≥ max(덱 상한 값들)`로 비교해, 필드가 2개 이상인 목록 키(value.items {제목 18, 본문 90} 등)는 슬롯과 상한이 같아도 18 < 90으로 항상 실패한다
- 재현 명령: npx vitest run tests/acceptance/m2/blocks.test.ts -t "AC-03-19"
- 재현: copyDeckLimits()가 4.6.2 표 그대로(예 "value.items": {제목: 18, 본문: 90}) 반환하고 blocks.json 슬롯 maxLength가 같은 값일 때 AC-03-19 실패
- 시도: (1) 목록 키 상한을 숫자 하나(최소 필드값)로 반환 → 본문 상한이 사라져 계약·4.6.2와 어긋남 (2) blocks.json 슬롯 maxLength를 부풀림 → 데이터 왜곡
- 처리: copyDeckLimits는 4.6.2 그대로 구현(M2-04a). AC-03-19 목록 키 비교는 실패로 남고 verify:m2에서 이 BLK로 보고
- 제안 수정안(사람): 비교를 필드별로 바꾼다(`for f in lim: ml[f] ≥ lim[f]`, 숫자끼리는 그대로) → relock
- 상태: open

## BLK-010 · M2 · locked-conflict · 2026-11-25T16:20Z
- 대상: 03장 3.6.1 이미지 수(hero.offset 2, feature.zigzag·highlight.trio·menu.cards 항목별 1, gallery 5~9, cta.image 1) ↔ 04장 4.5.2 PageSchema(블록당 image 슬롯 1개, 목록 항목은 카피만)·blocks.json 슬롯(cta·menu에 media 없음)
- 증상: 여러 장을 요구하는 variant를 스키마 안에서 그릴 수 없다. 렌더러는 첫 칸만 실제 이미지, 나머지는 빈 자리표시 틀(aria-hidden)로 그린다(ASM-044~047)
- 재현: gallery.grid에 캡션 6개 → 이미지 1장 + 빈 틀 5개
- 시도: 스키마·장 수정은 잠금 대상이라 하지 않음
- 처리: 렌더는 계속 진행. 시각 품질(AIL·이미지 다양성) 판정이 걸리면 이 BLK로 보고
- 제안 수정안(사람): 04장 4.5.2 image 슬롯을 배열(`images: {…}[]`, 최대 9)로 넓히거나 목록 항목에 선택 `image` 필드를 추가, blocks.json cta·menu에 media 슬롯 추가 → relock
- 상태: open

## BLK-011 · M2 · locked-conflict · 2026-11-25T16:50Z
- 대상: 03장 3.9.1 아이콘 패키지(`@phosphor-icons/core`·`@tabler/icons`·`iconoir`) ↔ `docs/dependency-allowlist.md`(M0 종료 시 잠금, 세 패키지 없음)
- 증상: 실제 아이콘 세트를 설치할 수 없다
- 시도: 허용 목록은 잠금 대상이라 행을 더하지 않음
- 처리: `packages/assets`에 임시 자체 도형 40개(24 그리드 선 아이콘, `ICON_PROVENANCE = "temp"`)를 세 세트 이름으로 낸다(ASM-049). 세트 구분은 선 끝·이음만
- 제안 수정안(사람): 허용 목록에 세 패키지(MIT, 출시 전 원문 확인) 추가 → `PATHS`를 패키지 SVG로 교체
- 상태: open

## BLK-012 · M2 · locked-conflict · 2026-11-26T01:40Z
- 대상: 04장 4.3 3단계 J의 변경 벌점(0.02 × 앵커 프리셋과 다른 키 수, w_k Σ=1 정규화) ↔ 04장 4.4·AC-04-08 렌더 D ≥ 0.15 충족률 ≥ 95%(tests/acceptance/m2/render.test.ts, 자체 잠금)
- 증상: 키 하나를 앵커에서 바꾸려면 가중 제곱오차가 0.02 이상 줄어야 한다(축 가중 0.2면 한 축 오차 0.32→0 수준). 변형 목표 차이(축당 0.1~0.3)로는 거의 항상 못 넘어서 v_true·v_fit·v_bal이 모두 앵커 L2로 스냅된다. L2 차이는 enforceVariantL2Diff(J 증가 최소 대안 = 예측 L1이 비슷한 값)와 hero·signature로만 채워져 렌더 차이가 작다
- 재현 명령: npx vitest run tests/acceptance/m2/render.test.ts -t "변형 쌍 추출 벡터 D"
- 재현(골든 32 × 3쌍 = 96, σ=0.08): mapL1toL2 결과는 64/64 F 안(불가능 아님). 스냅 뒤 6키(pairing·palette·radius·depth.style·shadow·density)가 같은 쌍: 벌점 0.02 → 69/96, 0.01 → 56, 0.005 → 30, 0 → 20. 예 GS-02 v_fit: soft 반경은 shape 오차 0.14→0.06(가중 이득 0.0032) < 벌점 0.02 → sharp 유지
- 시도: 구현이 4.3 의사코드·J 식과 일치함을 확인(ASM-029). 사양 상수 변경·테스트 완화는 금지라 하지 않음. 렌더 누락 수정(ASM-069·070)으로 0.365→0.5625까지 올림
- 처리: AC-04-08 렌더 D 1건 미충족(현재 54/96)으로 verify:m2에서 이 BLK로 보고. L2 ≥3키 조건은 enforce로 충족
- 제안 수정안(사람, 택1): ① 벌점 기준을 "앵커 프리셋 값"에서 "l2_0(매핑 결과) 값"으로 바꾼다 ② 벌점을 0.005로 낮춘다 ③ enforceVariantL2Diff 대안 선택을 "J 증가 최소"에서 "J ≤ J_min + ε 안에서 예측 L1 거리 최대"로 바꾼다 → 04장 개정·relock 후 B18 재생성(`pnpm seed:temp --corpus`)
- 상태: open

## BLK-013 · M2 · locked-conflict · 2026-11-26T03:30Z
- 대상: 시각 회귀 기준선 PL-1 8장(e2e/__screenshots__/7303eb92a5bd/…/PS-T*-local-business-pl1-00.png, 자체 잠금 ASM-071) ↔ AC-04-11(tests/acceptance/m2/render.test.ts, 픽스처 12개 린트 T error 0)
- 증상: 기준선 입력 fixtures/layouts/local-business-pl1-00.json은 LT-03 구현 전 5섹션 트리(local_business 하한 6). ASM-073 ⑤로 재생성하면 6섹션이 되어 잠긴 기준선 8장과 달라지고, 그대로 두면 AC-04-11이 이 픽스처에서 LT-03 error
- 재현: npx vitest run tests/acceptance/m2/render.test.ts -t "12개가 스키마"
- 처리: 기준선을 지키려고 pl1-00은 재생성에서 제외(scripts/data/fixtures-layouts.ts keep). 나머지 29개는 재생성, AC-04-11은 이 픽스처 LT-03 1건만 실패
- 제안 수정안(사람): pl1-00 재생성(`pnpm fixtures:layouts`에서 keep 해제) → `pnpm exec playwright test e2e/m2 --update-snapshots` → 기준선 8장 relock 승인
- 상태: open

## BLK-014 · M3 · locked-conflict · 2026-11-26T10:40Z
- 대상: 07장 7.12.2 리터럴 감사 ↔ 04장 AC-04-19·26 "픽스처 ≥ 2"(값 2 = generation.lint.warnPerMockupMax 등), 05장 AC-05-22 "색 ΔE2000 < 5"(값 5 = 다른 잎 값)
- 증상: 두 비교 기준은 thresholds 키도 사양 상수 표(7.12.1) 행도 아닌데 값이 잎 값과 같아 수용 테스트에 비교 매처로 쓰면 qa:trace --audit FAIL(BLK-007과 같은 유형)
- 재현: tests/acceptance/m3/linter.test.ts에 `expect(pos.length).toBeGreaterThanOrEqual(2)`를 넣고 pnpm -s qa:trace --audit
- 시도: (1) 같은 뜻의 thresholds 키 탐색 → 없음 (2) spec-constants.ts → SC 행 없음 (3) 계산식으로 숨기기 → 감사 우회라 하지 않음
- 처리: ≥ 2는 파일 이름 규약(pos-1·pos-2·neg-1·neg-2, pass-1·pass-2·fail-1·fail-2) 존재 검사로 본다(같은 조건, 수치 비교 아님). ΔE < 5는 `eval:extractor:selfcheck` 종료 코드와 packages/extractor 단위 테스트로 대조하고 수용 테스트는 필드 존재만 본다
- 제안 수정안(사람): 7.12.1 사양 상수 표에 "규칙·게이트 픽스처 최소 수 2(04장 AC-04-19·26)", "자기검증 색 ΔE2000 < 5·radius ±1px(05장 5.9·AC-05-22)" 행 추가 → spec-constants.ts에 SC 상수 → 수용 테스트에 대조 추가 후 relock
- 상태: open

## BLK-015 · M3 · locked-conflict(HALT) · 2026-11-26T11:20Z
- 대상: tests/acceptance/m3/*.test.ts(test(acc) 09da0ab, 자체 잠금 0b9d1d0) ↔ guard:patterns F06(테스트별 타임아웃 금지, ASM-004)
- 증상: 에이전트가 잠근 M3 수용 테스트 5파일에 it·beforeAll 3번째 인자 타임아웃 14곳이 있어 `pnpm guard`가 F06 FAIL. 잠긴 파일이라 고칠 수 없음 → 9.5.3 "guard가 에이전트 자신의 잠금 위반을 탐지" = HALT
- 재현: pnpm typecheck && pnpm -s guard 2>&1 | grep F06
- 원인: 잠그기 전 guard:patterns를 돌리지 않음(qa:trace --audit·eslint만 확인)
- 수정안(준비됨): 브랜치 `wip/blocked-m3-timeouts`(origin)에 타임아웃을 빼고 긴 반복을 항목별 it로 나눈 5파일. 판정 기준·매핑·수치는 그대로. guard:patterns ok·qa:trace --audit 리터럴 0 확인
- 사람 절차: 브랜치 diff 검토 → 5파일을 main에 반영 → `pnpm guard:relock --human tests/acceptance/m3` → 커밋 → PROGRESS status를 IN_PROGRESS로
- 상태: resolved 2026-11-26 — 사람이 PR #1 squash(01c9596)·해시 갱신(a0217bb)·재개(1ecf213). 4파일(scoring 무변경). `guard:relock` 명령은 없음(locked-hashes.json 직접 수정). a0217bb 메시지가 AC-09-11 형식 위반 → BLK-005에 추가
