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
