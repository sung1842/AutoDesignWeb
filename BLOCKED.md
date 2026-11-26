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
- 재현(M3 폴백 G-08): pnpm -s exec vitest run tests/acceptance/m3/golden.test.ts -t "폴백"
- 시도: (1) 허용 목록 패키지로 대체 → 같은 규칙 세트 없음 (2) 자체 구현 → G-08 정의(axe 규칙)와 달라 판정이 바뀜
- 처리: M2 수용 테스트는 AC-03-15의 렌더·케이스 수·G-02·G-07만 검사. axe 검사는 허용 목록에 추가된 뒤 수용 테스트에 넣는다(relock)
- 제안 수정안(사람): dependency-allowlist에 `axe-core`(MPL-2.0, apps/worker·e2e) 추가 → guard 라이선스 허용 목록에 MPL-2.0 → relock
- 추가(M3, 2026-11-26T14:37Z): evaluateCandidate는 axe 실행기가 없으면 G-08을 fail "axe 미실행(BLK-008)"로 기록한다(통과로 꾸미지 않음). 그래서 9.4.5 ②·AC-04-25 폴백 72의 실패 게이트는 G-08 하나뿐(나머지 G-01~G-13·H ≥ 80 통과). 재현: pnpm -s exec vitest run tests/acceptance/m3/golden.test.ts -t "폴백"
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

## BLK-016 · M3 · locked-conflict · 2026-11-26T14:20Z
- 대상: tests/acceptance/m3/linter.test.ts `specRules()`(자체 잠금) ↔ 04장 4.13.2 AIL-04·AIL-23 행
- 증상: 표 행을 `split("|")`로 나누는데 AIL-04 패턴 칸(`/new|beta|…/i`)과 AIL-23 칸(`/lorem ipsum|your company|…/i`)에 `|`가 있어 칸이 밀림 → 심각도 칸을 "beta"·"your company"로 읽어 기대 심각도가 `[]`가 됨. 표의 실제 심각도는 둘 다 error라 "규칙 메타" 테스트가 항상 실패
- 재현: pnpm -s exec vitest run tests/acceptance/m3/linter.test.ts -t "규칙 수·ID·단계·심각도"
- 시도: (1) 규칙 메타를 `[]`로 → 장 표와 다른 거짓 메타라 하지 않음 (2) 테스트 수정 → 자체 잠금 entry 변경 금지
- 제안 수정안(사람): 칸 분리를 백틱 구간 안의 `|`를 무시하도록 고친다(예: 줄에서 `` `[^`]*` `` 구간을 먼저 자리표시로 바꾼 뒤 split) 후 relock
- 상태: open

## BLK-017 · M3 · locked-conflict · 2026-11-26T14:20Z
- 대상: AC-05-15 `eval:extractor`(05장 5.7.4) ↔ 사람 라벨 없음(B18·레퍼런스 라벨 전부 temp). 잠긴 수용 테스트가 사람 데이터 없이는 충족 불가 → 9.5.3 "구현 불가로 보임" 행대로 locked-conflict로 기록
- 증상: ρ·MAE를 잴 사람 라벨(`data/references/labels.json`, provenance human)이 없어 평가 불가. 스크립트는 보고서에 사실을 적고 종료 코드 1(temp 라벨로 합격 처리하지 않음, ASM-080 ⑦)
- 재현: pnpm -s exec vitest run tests/acceptance/m3/extractor.test.ts -t "eval:extractor"
- 제안(사람): 5.7 방식 블라인드 라벨 세트 작성 → labels.json(human) → 평가 구현 확정
- 상태: open

## BLK-018 · M3 · locked-conflict · 2026-11-26T14:20Z
- 대상: 9.4.5 ③④·AC-05-22·24 앵커 왕복·분리 ↔ temp 정규화기 2026-S0(B18 합성 부트스트랩). 사람 데이터 없이는 충족 불가 → locked-conflict로 기록(9.5.3)
- 증상: 앵커 8개 측정 L1이 3.4.7 의도값과 5축 모두 0.10 초과(reliable 0축 < reliableAxesMin 3), 앵커 간 최소 거리 0.129 < anchorMinDist 0.25. depth 축이 전 프리셋 0.25로 고정(b1 0.385로 압축), shape가 0.37 근처에 몰림. 토큰 수준 자기검증(radius·배경·accent·본문 서체)은 8/8 통과라 렌더·추출은 토큰을 맞게 읽음 → 정규화기(분위·b0·b1) 문제
- 재현: pnpm -s exec vitest run tests/acceptance/m3/extractor.test.ts -t "앵커"
- 시도: 5.9 temp 분기 규칙상 앵커 실패를 이유로 정규화기를 재적합하지 않는다(09장 F19) → 수정하지 않음
- 제안(사람): human 정규화기(사람 라벨 코퍼스, 5.8) 마련, 또는 5.9 앵커 실패 절차 1~4(블라인드 라벨)로 3.4.7 의도값·프리셋 토큰 조정
- 상태: open

## BLK-019 · M3 · locked-conflict · 2026-11-26T14:37Z
- 대상: AC-08-16 원본 유사도 보정 보고서(08장 8.3.4) ↔ 사람 2인 라벨. 사람 없이는 충족 불가 → locked-conflict로 기록(9.5.3)
- 증상: `eval/originality/report-<version>.md`(provenance human, labelers 2, yes_count 0)는 운영자 포함 2인이 레퍼런스–시안 30쌍을 라벨해야 만들 수 있다. 에이전트가 temp로 대신 만들지 않는다(ASM-081 ⑥)
- 재현: pnpm -s exec vitest run tests/acceptance/m3/golden.test.ts -t "AC-08-16"
- 제안(사람): 8.3.4 절차 1~4 수행 후 보고서 작성(레퍼런스 originality_sig·phash_1280도 함께 필요)
- 상태: open

## BLK-020 · M4 · locked-conflict · 2026-11-26T16:14Z
- 대상: 02장 AC-02-06(같은 응답 집합을 무작위 순서로 50회 재생 → 최종 μ 축별 최대 차 ≤ 0.05) ↔ 02장 2.5.2·2.5.3 1-step 갱신(β=8, λ=1, clip)
- 증상: 2.5.3 의사코드 그대로인 updateMNL은 순서에 민감하다. 일관된 가상 응답자 40세션(실제 문항 선택·16문항)의 재생 순서 차: 최소 0.10, 중앙값 ≈ 0.24, 최대 0.34. 무작위 자극 12응답도 0.16~0.21. 한 번의 갱신 폭이 σ'²·g(최대 ≈ 0.5)라 clip과 결합해 순서 효과가 크다
- 재현: packages/diagnosis의 updateMNL로 한 세션 로그를 순서만 바꿔 50회 재생(수용 테스트 tests/acceptance/m4/diagnosis.test.ts "AC-02-06"은 값만 기록한다)
- 시도: (1) 일관된 응답자로 바꿔 봄 → 여전히 > 0.05 (2) 갱신 식 변경 → 02장 2.5 원천 변경이라 하지 않음
- 제안(사람): AC-02-06 기준을 실측 분포에 맞춰 개정(예: 중앙값 ≤ 0.30)하거나, 재생 시 원래 순서를 지키는 것만 요구(AC-02-16·18이 이미 순서 보존 재생 일치를 검사)
- 상태: open

## BLK-021 · M4 · locked-conflict · 2026-11-26T18:50Z
- 대상: 07장 7.12.2 리터럴 감사 ↔ 05장 5.9 카드 채택 "카드×축 95% 이상 ≤ 0.10"(0.95 = release.golden.fullSuccessMin 등 잎 값, 0.10 = release.extractor.roundtripAbsMax 등), 02장 2.3.6·06장 DDL 대체 텍스트 "5~160자"(5·160 = 다른 잎 값)
- 증상: 두 기준은 thresholds 키도 사양 상수 표(7.12.1) 행도 아닌데 값이 잎 값과 같아 수용 테스트 비교 매처로 쓰면 qa:trace --audit FAIL(BLK-014와 같은 유형)
- 재현: tests/acceptance/m4/survey-build.test.ts에 `expect(ratio).toBeGreaterThanOrEqual(0.95)`를 넣고 pnpm -s qa:trace --audit
- 시도: (1) thresholds 키 탐색 → 없음 (2) spec-constants.ts → SC 행 없음 (3) 계산식으로 숨기기 → 감사 우회라 하지 않음
- 처리: 두 기준은 `survey:build --check`(packages/diagnosis 명명 상수)가 판정하고 수용 테스트는 그 종료 코드를 본다. 대체 텍스트 길이는 DB CHECK(06장 DDL)도 강제
- 제안 수정안(사람): 7.12.1 사양 상수 표에 "설문 카드 채택 비율 95%·오차 0.10(05장 5.9)", "대체 텍스트 5~160자(02장 2.3.6)" 행 추가 → spec-constants.ts → 수용 테스트에 직접 대조 후 relock
- 상태: open

## BLK-022 · M4 · survey-items · 2026-11-26T19:05Z
- 대상: 09장 9.4.6 ① 활성 카드 ≥ 48·축별 활성 쌍 ≥ 19(단계 survey-items-count, blockable)
- 증상: 전체 `survey:build`(193장 렌더·361파일 업로드, 규격·용량 위반 0) 결과 활성 카드 1/48, 활성 쌍 A1 0·A2 0·A3 1·A4 0·A5 0(ASM-098 재빌드 후), 앵커 참조 0/25. 카드 |x_card − target| 축별 중앙값 A1 0.18·A2 0.11·A3 0.22·A4 0.28·A5 0.25(채택 상한 0.15). A/B 대상 축 측정 차이도 대부분 0.5×Δ 미만
- 재현: pnpm survey:build --check
- 원인 추정: 실측 L1을 만드는 정규화기가 B18 합성 부트스트랩(2026-S0, temp)이고 추출기 왕복이 맞지 않음(BLK-012·017·018과 같은 뿌리). 렌더러가 L2 차이를 충분히 드러내지 못하는 축(shape·depth, M2-09d4d)도 겹침
- 시도: (1) 임계값·채택 기준 완화 → 금지 (2) 정규화기 재적합 → 09장 F19(홀드아웃 왕복 실패로 재적합 금지)
- 파급: `pnpm eval:golden:build-answers` 0/32(SURVEY_ITEMS_INSUFFICIENT stage 1, 9.4.6 ⑪), `sim:survey --gate`(④) 입력 부족. 계획 L1을 x로 둔 픽스처에서는 build-answers 32/32·M1a 24/24, β 8.5 변이 9/24로 검출(로직 확인)
- 처리: fail로 두고 M5 이후 진행(9.4.6 ①). 사람 라벨 정규화기(05장 5.7) 확보 후 `pnpm survey:build` 재실행 → 2회차는 입력 해시가 바뀐 항목만 다시 렌더
- 상태: open

## BLK-023 · M4 · locked-conflict · 2026-11-26T21:30Z
- 대상: 07장 7.12.1 AC 배정표(acMilestones M4 = AC-01-04~21) ↔ 09장 9.4.8 M6 범위(공유)·01장 1.5.2 공개 보기(`/r/[shareId]`, `GET /api/share/:shareId`)
- 증상: AC-01-20(공개 모드에서 공감 평가·삭제·"이 취향으로 시안 만들기" 0건, "나도 진단하기"·"신고" 1건)은 공유 링크·ShareView·신고 모달(1.10.3, M7 신고 창구)이 있어야 검사할 수 있는데 공유는 M6 범위
- 재현: pnpm vitest run tests/acceptance/m4/blocked.test.ts -t "AC-01-20 공개 결과 화면"
- 시도: (1) 공유 API를 M4에 당겨 구현 → 09장 마일스톤 범위 위반·M6 의존(공유 생성 규칙·share_links RLS) (2) 소유자 화면으로 대체 → 공개 모드 검사가 아님
- 처리: M6에서 공유 구현 후 tests/acceptance/m6에 AC-01-20 테스트를 두되 배정표가 M4라 qa:trace는 m4 디렉터리만 인정 → 배정표 수정 필요
- 제안 수정안(사람): 07장 7.12.1 배정표에서 AC-01-20을 M6으로 옮기고 spec:extract 재생성·relock
- 상태: open

## BLK-024 · M4 · locked-conflict · 2026-11-26T21:50Z
- 대상: 09장 9.4.6 ①·④(survey-items-count·sim-diagnosis-gate = blockable, BLK 유형 survey-items·sim-limit)·AC-09-19(U-09) ↔ M0에 잠근 verify 러너(scripts/verify/run.ts)
- 증상: 잠긴 러너는 verify:mN 단계가 guard·lint·typecheck·unit·trace·acceptance·e2e뿐이고 `survey-items-count`(`pnpm survey:build --check`) 단계가 없다. 수용 테스트 실패를 blocked로 바꾸는 것은 locked-conflict 유형 BLK의 재현 명령(-t)뿐이라, BLK-022(survey-items) 때문에 실패하는 수용 테스트가 verify:m4를 fail로 만든다. AC-09-19 메타 테스트(활성 카드 47장 픽스처 → pass_blocked·survey-items-count blocked)도 러너 수정 없이는 만들 수 없음
- 재현: pnpm vitest run tests/acceptance/m4/survey-build.test.ts -t "활성 카드 = 48장 전부"
- 재현: pnpm vitest run tests/acceptance/m4/survey-build.test.ts -t "커밋된 manifest로 survey:build --check 종료 코드 0"
- 재현: pnpm vitest run tests/acceptance/m4/survey-build.test.ts -t "축별 활성 쌍 ≥ 19"
- 재현: pnpm vitest run tests/acceptance/m4/sim.test.ts -t "x_card를 한 축 +0.1 옮기면 RMSE가 바뀐다"
- 재현: pnpm vitest run tests/acceptance/m4/sim.test.ts -t "모든 차단 합격선 통과"
- 재현: pnpm vitest run tests/acceptance/m4/golden-answers.test.ts -t "2회 실행 출력 바이트 동일"
- 재현: pnpm vitest run tests/acceptance/m4/golden-answers.test.ts -t "β 8 → 8.5로 재생하면"
- 재현: pnpm vitest run tests/acceptance/m4/blocked.test.ts -t "AC-09-19 verify:m4 계획에"
- 시도: (1) 러너에 survey-items-count 단계 추가 → scripts/verify 잠금(F01) (2) 테스트 기준 완화 → 금지
- 처리: 위 7건은 BLK-022(활성 자극물 부족)가 원인. 이 BLK가 verify에서 blocked로 표시되게 한다. 사람 정규화기로 BLK-022가 풀리면 7건은 녹색이 되어야 한다
- 제안 수정안(사람): scripts/verify/plan.ts에 m4 이상 `survey-items-count`(survey:build --check, blockable) 단계와 survey-items·sim-limit 유형 BLK 매핑을 넣고 relock, AC-09-19 메타 테스트 추가
- 상태: open

## BLK-025 · M4 · locked-conflict · 2026-11-26T22:00Z
- 대상: 09장 AC-09-17 뒷부분("m4-done 이후 data/golden/** 1바이트 변경은 guard FAIL", "tuned 변경 커밋에 새 muRef가 없으면(또는 그 반대면) guard FAIL") ↔ 잠긴 guard(scripts/guard)·자체 잠금 규칙 4(HEAD 커밋에서 새로 추가된 파일만)
- 증상: guard:tuned에 muRef 동반 변경 검사가 없고(scripts/guard 잠금), data/golden/*.json은 M1에 추가된 파일이라 자체 잠금 규칙 4로 바로 등록할 수 없다(AD-031처럼 지웠다 다시 추가하는 단일 커밋 필요). 실데이터 build-answers도 BLK-022로 0/32
- 재현: pnpm vitest run tests/acceptance/m4/golden-answers.test.ts -t "2회 실행 출력 바이트 동일"
- 시도: (1) guard 수정 → 잠금 위반 (2) 테스트로 대체 → guard 동작 검사가 아님
- 처리: BLK-022 해소 후 build-answers 실행 → AD-031 방식으로 data/golden 단일 커밋 재추가·자체 잠금. muRef 동반 검사는 사람 guard 수정 대기
- 제안 수정안(사람): scripts/guard/stages/tuned.ts에 "config/diagnosis-tuned.json 변경 커밋 ⇔ data/golden/*.json expected.muRef 변경" 검사 추가 후 relock, tests/acceptance/m4에 guard 메타 테스트 추가
- 상태: open

## BLK-026 · M4 · locked-conflict · 2026-11-26T20:20Z
- 대상: 자체 잠근 tests/acceptance/m4/contract.test.ts(AC-06-08 ②③) ↔ M5 이후 라우트 추가(06장 6.4.3, 09장 9.4.7~)
- 증상: ②가 "빌드된 라우트마다 계약 사례"를 요구하는데 사례 목록(cases())이 잠긴 테스트 파일 안에 하드코딩돼 있다. M5에서 `/auth/callback`·`/api/projects` 등 route.ts가 생기면 사례를 더할 수 없어 ②가 실패한다(에이전트 설계 오류: 사례를 데이터로 분리했어야 함)
- 재현: pnpm vitest run tests/acceptance/m4/contract.test.ts -t "AC-06-08 ② 빌드된 라우트마다"
- 시도: (1) 잠긴 테스트 수정 → 금지(9.5.6) (2) 라우트 추가 보류 → M5 범위 불가
- 처리: M5부터 ②가 실패하면 이 BLK로 blocked 표시. 새 라우트의 계약 사례는 tests/acceptance/m5 이후 테스트에 둔다
- 재현 확인: 2026-11-26T22:30Z 8248a66(M5-02)부터 ② 실패(`/auth/callback`·`/api/me`·`/api/consents` 사례 없음)
- 제안 수정안(사람): contract.test.ts의 cases()를 `tests/contract/cases.ts`(마일스톤별 사례 등록부, 잠금 대상)로 옮기고 테스트는 그 등록부를 읽게 바꾼 뒤 relock
- 상태: open
