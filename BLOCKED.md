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
- 제안 수정안(사람): 7.12.1 사양 상수 표에 "브랜드 hue 고정 허용 5°(04장 4.2.2·AC-04-03)", "보정 사유 기록 기준 0.20(04장 4.3·AC-04-07)", "CLS ≤ 0.05(03장 AC-03-24, generation.taste.tau와 값 겹침)" 행 추가 → spec-constants.ts에 SC 상수 → 수용 테스트에 대조 추가 후 relock
- 상태: open

## BLK-008 · M2 · locked-conflict · 2026-11-19T18:21Z
- 대상: 03장 AC-03-15(axe-core serious/critical 0)·04장 G-08 ↔ docs/dependency-allowlist.md(사람 잠금, axe-core 없음)
- 증상: axe-core를 설치하면 guard:deps가 허용 목록 위반으로 실패
- 재현: pnpm add -D axe-core 후 pnpm guard
- 시도: (1) 허용 목록 패키지로 대체 → 같은 규칙 세트 없음 (2) 자체 구현 → G-08 정의(axe 규칙)와 달라 판정이 바뀜
- 처리: M2 수용 테스트는 AC-03-15의 렌더·케이스 수·G-02·G-07만 검사. axe 검사는 허용 목록에 추가된 뒤 수용 테스트에 넣는다(relock)
- 제안 수정안(사람): dependency-allowlist에 `axe-core`(MPL-2.0, apps/worker·e2e) 추가 → guard 라이선스 허용 목록에 MPL-2.0 → relock
- 상태: open
