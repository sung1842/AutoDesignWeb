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
