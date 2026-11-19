# 사람이 해야 할 일

자율 세션이 대신할 수 없어서 넘긴 일들. 처리하면 체크하고 커밋하세요.

- [x] (2026-11-19 02:43 KST) 예약 실행 세션에서는 일회성 재개 예약 작업(`create_trigger`)을 만들 수 없음(사용자 승인 필요로 거부됨). CLAUDE.md 0-5절의 "초기화 직후 재개 예약"은 대화 세션에서만 가능. 3시간 정기 작업이 안전망으로 계속 돌므로 진행은 됨. 원하면 정기 작업 주기를 조정하거나, 0-5절을 "가능할 때만"으로 완화할지 결정.  → 해결(2026-11-19): 재개 예약 대신 정기 예약을 매시간 실행으로 변경, CLAUDE.md 0-5 개정
- [ ] (R2 법무, 변호사 확인 필요) 차단할 불법·유해 업종 범위(Q13), 국내 리전이지만 미국 회사 소유 호스팅이 국외이전인지(Q5), 정지 사용자 이메일 해시 1년 보관 근거(Q6), 1인 운영자에 대한 안전성 확보조치 고시 적용 범위·접속기록 보관 기간(Q16), 법무 문서 최종 문안. 상세: docs/reviews/round2/r2_legal.md
- [ ] (2026-11-19 R3) decisions_v4 T-17: 잡 원가 DB CHECK(≤0.36)를 없애고 경고+예약 거부로 바꾼 결정이 괜찮은지 검토(AD-009). T-11: 호스팅 Supabase 풀러(Supavisor 트랜잭션 모드)에서 `SET LOCAL ROLE` 동작을 실제 프로젝트에서 확인(AD-008).
- [ ] (2026-11-19 P2 멈춤) 이 실행 환경은 git 태그 푸시가 403으로 막힘. 커밋 `4519c49`에 주석 태그 `review-pass`를 만들어 푸시해 주세요(`git tag -a review-pass 4519c49 -m "P2 멈춤" && git push origin review-pass`). 그때까지 기준 커밋은 PROGRESS.md `review_pass_commit`(AD-020). P3 끝의 `spec-lock` 태그도 같은 문제가 생기면 함께 부탁드립니다.
- [ ] (2026-11-19 P3) 태그 3개 원격 생성: `review-pass`→4519c49는 위 항목, 이후 `spec-lock`·`m<N>-done`도 푸시가 막힘(재시도 시 disconnect). 그동안 PROGRESS.md `tags:` 맵이 원천이고 세션마다 로컬 복원(AD-022). 사람이 만들 때는 맵의 커밋과 같은 곳에 만들어 주세요.
- [ ] (2026-11-19 P3) `docs/dependency-allowlist.md` 초안 확인(사람 잠금 대상, 9.5.6). 버전 범위·라이선스·`jszip` 이중 라이선스 사용 방식. M0 종료 시 에이전트가 잠금.
- [ ] (2026-11-19 P3) 사람 데이터 묶음(09장 9.2.5 우선순위). 없는 동안 `seed:temp` 임시값으로 진행하며 출시 판정은 종료 코드 2까지만 가능:
  1. B2·B3·B5 유형·프리셋·매핑(2~3일) 2. B6·B7 폰트 파일·페어링(1일) 3. B8 이미지 192장(2일) 4. B13 레퍼런스 60(수동 큐레이션, 크롤링 금지) 5. B12 설문 자산 승인(0.5일) 6. B16 골든 세트 검수(0.5일) 7. B14·B15·B17 금지어·린터 규칙·법무 문안(변호사 검토 권장) 8. B21·B22 고위험 기관명·금지 업종 키워드 적정성(08장 8.14 Q13) 9. B23 처리위탁사 승인(`approved:true`는 사람만)
  투입 후 `pnpm data:validate && pnpm verify:m8`, 시각 회귀 기준선은 `chore(visual): rebaseline for human data` 1커밋.
- [ ] (2026-11-19 P3) 이 환경에서 못 하는 검증(needs_ci): `STACK_PROFILE=supabase`(Docker) 기동, webkit·firefox 브라우저 매트릭스, CI 3회 green(`ci-green-3x`), GoTrue auth 테이블(`gotrue-auth-tables`), Supavisor `SET LOCAL ROLE`(AD-008). GitHub Actions에서 돌려 결과를 확인해 주세요.

- [ ] (ASM-003) 07장 7.12.1 사양 상수 표에 "CLAUDE.md 구현 규칙 300줄"(AC-09-14)·"dev:stack 기동 120초"(AC-06-50) 행 추가 여부 확인 후 relock. 현재는 비교 매처 없이 판정 중
- [ ] (BLK-001) 의존성 라이선스 규칙 충돌: next·sharp·eslint의 간접 의존성에 LGPL-3.0(libvips)·CC-BY-4.0·BlueOak·0BSD·Python-2.0이 있음. 09장 F12 허용 라이선스 확장 여부를 결정하고 relock해 주세요(BLOCKED.md BLK-001)
