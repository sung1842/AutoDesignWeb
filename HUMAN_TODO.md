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
- [ ] (BLK-002) 자체 잠금된 m0 수용 테스트 1건의 정규식 오류(DECISIONS_LOG 경로 검사). BLOCKED.md BLK-002의 수정안대로 고치고 relock해 주세요
- [ ] (AD-027) `docs/dependency-allowlist.md`의 zod 사용 범위에 루트 scripts(guard)를 추가할지 확인해 주세요
- [ ] (BLK-003) 사양 상수 표(07장 7.12.1)에 96(골든 잡 수)·19(축별 A/B 최소 쌍)·0.00001(비용 합계 허용오차) 행 추가 여부를 결정하고 relock해 주세요(BLOCKED.md BLK-003)
- [ ] (BLK-004) 01~09장에 00장 태그 규칙(`대상` 열, [P0]/[P2]/[P3]/[MVP 제외] 제목 태그)이 반영되지 않음. 문서 개정 또는 AC-00-01·07 개정 후 relock해 주세요(BLOCKED.md BLK-004, 해석 ASM-005)
- [ ] (BLK-005) 이미 푸시된 커밋 5fefdda `feat(web,worker)`·207df53 `fix(config,db)`의 다중 scope가 AC-09-11 테스트 정규식에 걸림. scope에 쉼표 허용 또는 예외 처리 후 relock해 주세요(BLOCKED.md BLK-005)

- [ ] (ASM-010) 02장 2.11.2 유형 설명 문안 8개가 표기 범위 200~400자보다 짧음(154~190자). 문안 보강 또는 범위 개정 결정
- [ ] (ASM-012) `data/taxonomy/blocks.json` temp 문안(블록 기본 제목·nav 라벨)과 variant별 allowed_bg 값 확인. 03장 3.6.1 "50 variant"(표 합계 53, nav 제외 해석) 표기 정정 여부
- [ ] (ASM-013) B6 폰트 26종 원본 파일·OFL 원문·RFN 여부 확인 후 `data/fonts/registry.json`(human)로 교체. temp는 파일 없음(`filesPending`)이라 M2 렌더는 폴백 스택으로만 가능
- [ ] (ASM-014) 03장 3.10.2 톤 분포 "각 ≥ 30%"가 8장 카테고리에서 성립 불가 → 기준 정정(예: 각 ≥ 25% 또는 장수 9 이상). B8 실사진 192장 투입 시 함께 확인
- [ ] (ASM-015) AC-03-11 단조성에서 `type.headline_weight`(페어링 전환 시 웨이트 목록 변경) 제외 해석 확인. 03장 3.3.2·AC-03-11 문구 정정 여부
- [ ] (ASM-016) 설문 카드 alt 축 서술 사전(5축×5구간)과 tpl-text 본문 2단락 문안 확정(02장 2.4.3·2.4.6)
- [ ] (B17, seed:temp 자동) 법무 문안 확정(변호사 검토 권장): legal/terms.md·privacy.md·sources.md
- [ ] (ASM-017) processors.yaml(08장 8.7.6)과 흐름표(06장 6.1.3)의 processor_id·items 불일치 정리(llm-judge·llm-secondary 항목 추가, turnstile/cloudflare-turnstile 통일, vercel items)
- [ ] (BLK-006) package.json·`.guard/verify-scripts.json`에 `verify:schema-parity` 추가 후 relock해 주세요(구현은 `pnpm db:schema-parity`로 완료, BLOCKED.md BLK-006)
- [ ] (BLK-007) 사양 상수 표(07장 7.12.1)에 브랜드 hue 허용 5°·보정 사유 기준 0.20 행을 추가하고 M2 수용 테스트에 두 대조를 넣어 relock해 주세요(BLOCKED.md BLK-007)
- [ ] (BLK-008) dependency-allowlist에 axe-core(MPL-2.0) 추가 여부를 결정하고, 추가하면 AC-03-15·G-08 axe 검사를 수용 테스트에 넣어 relock해 주세요(BLOCKED.md BLK-008)
- [ ] (ASM-028) design-spec calibrate의 κ 구간 경계 0.75·moved_axes 0.20을 감사 회피용이 아닌 사양 상수 표 객체(KAPPA_BANDS·CALIB_SPEC)로 둔 것이 괜찮은지 확인해 주세요. BLK-007의 SC 행 추가 시 함께 정리 가능
- [ ] (ASM-030) JSON Schema 검증기(ajv 등)를 dependency-allowlist에 넣을지 결정해 주세요. 지금은 data-contracts의 최소 검증기로 data/tokens/schema.json을 검증합니다
- [ ] (ASM-034) 시그니처 용도 적합 순위(`signatures.json.purpose_rank`)가 데이터에 없어 design-spec `PURPOSE_RANK`에 임시 순위를 두었습니다. 사람 순위로 B 묶음에 추가해 주세요
- [ ] (BLK-009) AC-03-19 슬롯 maxLength ↔ 덱 상한 비교를 필드별로 고치고 relock해 주세요. 지금 식(min ≥ max)은 2필드 목록 키에서 항상 실패합니다(BLOCKED.md BLK-009)
- [ ] (ASM-035) 패턴 카탈로그(4.8)를 config/patterns.json으로, 용도 허용 hero 목록을 purposes.json에 둘지 확인해 주세요. 지금은 design-spec PATTERNS 상수와 패턴 hero 힌트로 대신합니다
- [ ] (BLK-010) 이미지 슬롯이 블록당 1개라 gallery(5~9장)·hero.offset(2장)·zigzag·highlight.trio·menu.cards 항목 이미지를 못 그림. 04장 4.5.2 image 슬롯 배열화 또는 목록 항목 image 필드, cta·menu media 슬롯 추가 결정 후 relock
- [ ] (BLK-011) 아이콘 패키지 3종(@phosphor-icons/core·@tabler/icons·iconoir, MIT) 허용 목록 추가 여부. 지금은 임시 자체 도형 40개
