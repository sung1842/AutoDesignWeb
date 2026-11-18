# PROGRESS

## 현재 상태
- status: IN_PROGRESS
- phase: P2
- lock: {owner: 2026-11-18T21:07Z, since: 2026-11-18T21:07Z}
- limit.next_reset_kst: 2026-11-19 07:42
- 마지막 갱신: 2026-11-19 06:23 KST (예약 세션: 07-a~c·06-a~d·09-a~c 반영)

## 실행 환경 사실(2026-11-18 점검)
- Docker 데몬 없음(클라이언트만). 이미지 레지스트리·Playwright 브라우저 다운로드 프록시 차단.
- 브라우저: `/opt/pw-browsers`의 chromium-1243만 있음(webkit·firefox 없음).
- PostgreSQL 16 설치됨, pgvector 없음. 06장 DDL은 auth 스키마 stub 위에서 vector 외 46개 테이블 생성 성공.
- npm 레지스트리 접근 가능.

## 배경
- v1 기획서 → 1라운드 역할별 리뷰 8개(전원 FAIL, Blocker 약 52·Major 약 105) → 결정 레지스터 → v2 10개 장 작성 → 장 간 충돌 통합 결정 R-01~R-38 반영.
- 통합 결정 반영 완료: 00, 01, 02, 03, 04, 05, 06, 07, 08장. 09장은 반영 도중 이관됨(확인 필요).
- 02장 진단 시뮬레이션은 합격선을 아슬아슬하게 통과(RMSE 0.119/0.12, 적응형 이득 5.6%/5%). 09장 M4 앵커 정확도 95%는 94.6% → 02장 2.16 기준을 따르도록 수정 요청됨.

## P1. v2 정합 마무리
- [x] 09장에 decisions_v2 반영 — R-02·03·05·06·07·08·09·11·12·19·25 반영 완료(2026-11-18 대화 세션). M1 ⑨ 스키마 대조(`verify:schema-parity`)·M7 ⑪ API 대조(`verify:api-parity`) 조건 추가로 06장 1:1 대조를 구현 단계 자동 검증으로 넘김 → 완료. 원래 목록: (잠금 경로 `config/lock/locked-hashes.json`, 골든 32, 역할명 `gen_copy/gen_layout/judge_vision/ref_tagger`, 프롬프트 경로 `packages/llm/prompts/<role>@v<N>.md`, `v_true` 코드값, 화면 S01~S15, 카드 풀 16×3, "한결", 이미지 192장, 앵커 정확도는 02장 기준 참조, D-0212·0213 반영, 06장 최종 DDL·API를 마일스톤에 반영)
- [x] 전 장 옛 표기 grep 검사 후 수정(2026-11-18. 남은 검색 결과는 '대체됨' 설명·금지 규칙 문맥뿐): `qa/thresholds.yaml`, `'local'`(용도), `V-TRUE`(코드), `BRAND_HIGH_RISK`, `PHISHING_TERM`, `survey_responses`, `taste_results`, `feedback_events`, `TEST_AUTH_BYPASS`, `/api/test/login`, `alt_ko`, `A1`~`A5` 축 키(JSON 키로 쓰인 경우), `page_generator`, `copywriter`, `.guard/locked-hashes`, `S01~S10`, 골든 30
- [x] 각 장 "다른 장과 맞출 인터페이스" 표의 미해결 항목 해소(03장 3.13.5 colorName 추가, 02장 dominant_colors·06장 purpose_hint 확인) (예: 01장 D-0111 `colorName`/`dominant_colors`, 02장 D-0201 용도 힌트 칩은 01·06 반영 확인)
- [x] `docs/spec/INDEX.md` 작성(장 목록, 결정 문서, 용어집 위치)

## P2. 리뷰 루프
- 라운드 2: [x] PM [x] 프로덕트 디자이너 [x] UX [x] UI [x] 테크 리드 [x] AI/ML [x] QA [x] 법무 → [x] decisions_v3(S-01~S-41) [ ] 반영(아래 20단위)
- 라운드 2 반영 단위(decisions_v3.md "반영 순서" 참고): [x] 07-a [x] 07-b [x] 07-c [x] 06-a [x] 06-b [x] 06-c [x] 06-d [x] 09-a [x] 09-b [x] 09-c [ ] 04-a [ ] 04-b [ ] 04-c [ ] 03 [ ] 02 [ ] 05 [ ] 01 [ ] 08 [ ] 00 [ ] 잔여 표기 grep
- 판정 기록(라운드별 C1/C2/C3):
  - R2 PM: FAIL/FAIL/FAIL (Blocker 0, Major 5: 예산-목표 불일치, 취소 시 한도 규칙 충돌, KPI 쿼리 분모, 검증 표본 확보, 00↔07·09 불일치)
  - R2 UX: FAIL/FAIL/FAIL (1라운드 19/19 해결, Blocker 0, Major 3: 결과 신뢰 문구 01↔02 불일치, 진단 카드 크기 규칙이 실제 화면에서 불성립, 편집 가능 판정을 화면 폭으로 해 200% 확대 시 편집 소실)
  - R2 QA: FAIL/FAIL/PASS (1라운드 21/27 해결·5 부분·1 P2, Blocker 0, Major 4: thresholds 키 구조 3종, 보류 허용 검증 목록 부재·k6 staging 의존, 에이전트 자기 채점 방지(spec:extract·spec-lock), 07·09·04 수치 불일치)
  - R2 TECH: FAIL/FAIL/FAIL (1라운드 24/28 해결, Blocker 2: Docker 없는 환경 대안 부재, 시각 회귀·브라우저 매트릭스가 Docker 전제 / Major 5: 병렬 호출 예산 초과, 동시 잡 5 vs Chromium 3, 후보 파기 DDL 불일치, CLAUDE.md↔09장 운영 규칙 차이, MVP DDL의 pgvector)
  - R2 PD: FAIL/FAIL/FAIL (1라운드 23건 중 20 해결·3 부분, Blocker 0, Major 5: S08 근거 칩 부재·v_true 문구 모순, 03 허용 조합이 04 린터에서 항상 실패(AIL-06·AIL-03), 사진 톤·업종 필터 부재, styleguide.html 내보내기 누락, 검증 대조군 약함)
  - R2 UI: FAIL/FAIL/PASS (1라운드 24건 중 20 해결·4 부분, Blocker 0, Major 4: 밝은 브랜드색 대비 보정 실패 경로 없음, 텍스트 역할→타입 단계 표 부재(H7 T3 2.47), 히어로 8~24자와 타입 스케일 불일치, 폰트 서브셋 전략·enum 불일치)
  - R2 AI: FAIL/FAIL/FAIL (1라운드 24건 중 22 해결·1 부분, Blocker 1: 05장 정규화 분위수 표·few-shot 48개의 임시 시드 규칙 부재(B1~B17) / Major 4: 진단 시뮬 단일 시드 판정·튜닝 겹침·멈춤 규칙 없음, 골든 M1 95%±0.12가 RMSE 0.12와 모순(QA2-05와 충돌 → v3 결정), gen_copy 실패·거절 처리 미정, MockProvider가 04장 분할 호출과 다르고 ok 시나리오가 수리 경로를 안 탐)
  - R2 LEGAL: FAIL/FAIL/FAIL (1라운드 20건 중 14 해결·6 부분, Blocker 0, Major 7: 편집 시 남용 검사 우회·불법 업종 미필터, Supabase Auth 메타데이터 이름·사진 저장, 국외이전 목록 누락(Fly.io·Vercel·llm-judge), 탈퇴와 DDL 충돌(동의 기록·감사 로그·정지 회피), 익명 폼 남용, 관리자 MFA·열람 로그 부재, 법무 문서 경로 08↔09 불일치·컴플라이언스 임시 시드 규칙 부재)

## P3. 최종 기획서와 구현 준비
- [ ] FINAL 정리 [ ] 구현 규칙 추가 [ ] 임시 시드 데이터 [ ] HUMAN_TODO 정리

## P4. 구현
- [ ] M0 [ ] M1 [ ] M2 [ ] M3 [ ] M4 [ ] M5 [ ] M6 [ ] M7 [ ] M8

## P5. 완료
- [ ] release:check 요약

## 로그
- 2026-11-19 06:23 | 09-c 반영: 9.6.2 역할 4개별 Mock·mixed·copy_*@gen_copy·scenario@role, 기대 결과는 07 TC-R 참조, M4 ④ 시뮬 gate/dev 시드·조정 상한·F20, M7 ② 404·⑥ mixed 조건
- 2026-11-19 06:22 | 09-b 반영: 묶음 B17 경로(legal/)·B18~B25 추가와 temp 규칙, 자산·법무 temp 공통 규칙, F18·F19, B16 스키마 삭제·32행, M1~M4·M7 수치를 키 참조로(S-06), AD-007(normalizers S0)
- 2026-11-19 06:21 | 09-a 반영: 9.1.1 스택 프로파일·브라우저 고정, 9.4.1 보류 상태·RENDER_ENV_ID 기준선·partial 단절 내성, 9.5.3 프로파일 대체·HALT 제외, 9.5.7 무인 세션 매핑(AC-09-15·16), 9.6.3 native 대체, 9.9.1 종료 코드, M5①·M6④·B6
- 2026-11-19 06:19 | 06-d 반영: BLOCKED_BRAND reason 4값·G-13·COPY_FALLBACK(warnings 컬럼), 6.11.2 적용 단계 참조, 관리자 aal2·pii_view·리댁션(AC-06-57), 익명 창구 레이트리밋, 6.1.3 구성요소×P1~P13 흐름표·compliance:flows(AC-06-58), MockupCard movedAxes·diffFromTrue·brandColorNotice 5값
- 2026-11-19 06:17 | 06-c 반영: 잡 예산 예약-정산·추정식 단일화·mock 고정 단가·CHECK 0.36(S-13), WORKER_GEN_CONCURRENCY·렌더 라운드로빈·6.16 근거·p95 추정식(S-14), 취소 한도 규칙(S-16), AC-06-55·56
- 2026-11-19 06:16 | 06-b 반영: consents_archive·sanctions·admin_hash·copy_source·users.status deleting·OAuth 메타데이터 최소화 트리거·9000_local_only(dev_mail_outbox), account-delete ①~⑦, RetentionRule 원천화(1,000행 별도 트랜잭션, 후보·렌더 규칙), AC-06-53·54, CONSENT_HASH_KEY. native PG16에서 DDL 2회 적용 성공(51테이블), 메타데이터 트리거 동작 확인
- 2026-11-19 06:15 | 06-a 반영: 6.13.1 스택 프로파일(supabase/native, shim·드라이버·오리진·기동 거부·CI 위임), env별 CSP, env 변수, AC-06-50~52, pgvector 제거. native PG16에서 shim+DDL 적용 확인(public 48테이블)
- 2026-11-19 06:14 | 07-c 반영: TC-R-15~18(mixed·copy_*), 출시 단계 명칭 정리·완료율 65%·7.9.1 참조화·D-0716, P-2s·P-4b·P-1a 층화, KPI 분모 참조
- 2026-11-19 06:12 | 07-b 반영: 상태 enum 6종·보류 허용표·종료 코드(7.11.2), 진단 API 부하 로컬 측정, 골든 M1a/M1b·muRef·build-answers 결정론, AC-07-19~20
- 2026-11-19 06:10 | 07-a 반영: 7.12.1 thresholds 전체 JSON(diagnosis/generation/perf/release)·옛 키 대응표·test-policy 블록, 7.12.2 spec:extract·spec-lock·qa:trace --audit, AC-07-16~18, AD-006. 예약 세션 재개 예약 생성은 여전히 거부됨(HUMAN_TODO 기존 항목)
- 2026-11-19 03:40 | decisions_v3.md 작성(S-01~S-41, Blocker 3·Major 37 전부 대응), AD-001~005 기록. 다음은 07-a부터 반영. 잠금 해제
- 2026-11-19 03:25 | R2 AI/ML(Blocker 1·Major 4)·법무(Major 7) 리뷰 완료 → 라운드 2 리뷰 8개 수집 끝, 다음은 decisions_v3 작성 후 장별 반영
- 2026-11-19 02:58 | R2 프로덕트 디자이너(Major 5)·UI(Major 4) 리뷰 완료. 예약 세션에선 재개 예약 생성 불가 → HUMAN_TODO
- 2026-11-18 23:35 | R2 테크 리드 리뷰 완료(Blocker 2: Docker 부재 환경 대안)
- 2026-11-18 23:20 | R2 QA 리뷰 완료(새 Major 4, C3 PASS)
- 2026-11-18 23:10 | R2 UX 리뷰 완료(새 Major 3)
- 2026-11-18 23:00 | R2 PM 리뷰 완료(1라운드 19/20 해결, 새 Major 5)
- 2026-11-18 22:45 | 대화 세션: P1 완료(03장 colorName 추가). 다음은 P2 라운드 2 리뷰
- 2026-11-18 22:40 | 대화 세션: 09장 M1·M4·M7 통과 조건 갱신(골든 32, 중심 벡터 03장, 시뮬 합격선 thresholds 참조, 스키마·API 대조), INDEX.md 작성
- 2026-11-18 22:30 | 대화 세션: 09장 R-xx 반영(부분), 07장 alt_text, 06장 버전 4종 주석, 옛 표기 검사 완료
- 2026-11-18 | 초기 이관: v1, v2(00~09), 1라운드 리뷰, 결정 문서를 저장소로 옮김
