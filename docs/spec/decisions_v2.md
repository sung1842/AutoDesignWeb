# 통합 결정 v2 (장 간 충돌 해소) — decisions.md보다 우선

각 장 작성자는 자기 장에서 아래 결정과 다른 부분을 모두 고친다. 자기 장의 "추가 결정" 표에서 아래로 대체된 항목은 "→ R-xx로 대체"라고 표시한다.

| ID | 결정 | 고칠 장 |
|---|---|---|
| R-01 | L1 축 코드 키: A1 `expression`, A2 `temperature`, A3 `shape`, A4 `density`, A5 `depth`. JSON·DB·코드 모두 이 키를 쓴다. | 전 장 |
| R-02 | 용도 코드: `saas` / `portfolio` / `local_business`(`local` 표기 금지). | 03, 04, 05, 07, 09 |
| R-03 | 변형 코드: `v_true` / `v_fit` / `v_bal`. UI 라벨은 "취향 그대로 / 용도 최적 / 균형". `V-TRUE` 같은 대문자 표기는 문서 설명에서만 허용하고 코드·스키마에서는 금지. | 04, 07 |
| R-04 | 유형 ID `T1`~`T8`(+slug), 앵커 프리셋 `PS-T1`~`PS-T8`. 유형 중심 벡터의 단일 원천은 03장 3.4.7 표, 유형 이름·설명 텍스트의 단일 원천은 02장. | 02, 03, 05, 07, 09 |
| R-05 | 진단 시뮬레이션 합격선(02장 D-0203~0205 채택, 07장 D-0703 대체): 유형 중심 근처 모집단 β=8 유형 정확도 ≥85%, β=4 ≥70%. 균일 모집단 top-1 ≥62%, top-2 ≥85%. RMSE β=8 ≤0.12, β=4 ≤0.18. 문항은 최대 16, 1단계는 정확히 8. 적응형 이득은 RMSE 5% 이상 감소 + top-1 +3%p 이상. 90% 구간 포함률 85~95%. 일관성 지수 기준은 07장 값 유지. | 00, 07 |
| R-06 | 1단계 카드 풀 48장 = 기준 벡터 16개(앵커 8 + 브리지 8) × 콘텐츠 템플릿 3(02장 D-0202, 09장 D-0902 대체). 2단계 A/B 수준은 {0.2, 0.5, 0.8}, 쌍 구성은 09장 D-0903(120쌍). 채택 판정은 실측 L1(x_card) 기준(09장 D-0904). | 03, 05, 09 |
| R-07 | 설문 자극물 이미지: desktop 1280×800 WebP ≤140KB, mobile 780×1560 WebP ≤160KB, 2벌. 메타는 `alt_text`, `dominant_colors`, `focus_region`. | 06, 09 |
| R-08 | 설문 가상 브랜드명은 "한결"(업종 표현 없음). 고정 카피는 02장. | 09 |
| R-09 | 임계값 단일 원천: `config/thresholds.json`(품질·SLO·진단·출시의 `release` 객체 포함). 잠금: `config/lock/locked-hashes.json` + CI 저장소 변수 `QA_LOCK_DIGEST` 이중 검증. `qa/thresholds.yaml`은 폐기. | 07, 06, 04 |
| R-10 | 테스트 전용 로그인 우회 라우트는 두지 않는다. E2E 로그인은 Supabase 로컬 Mailpit 매직링크(07장 D-0711 철회). | 07, 08 |
| R-11 | 골든 세트는 32케이스(유형 8 × 용도 3 = 24 + 엣지 8). 전체 실행은 케이스당 3회, 스모크는 8케이스 × 1회(07장 D-0702 채택, 09장 D-0905 대체). | 04, 09 |
| R-12 | models.yaml 역할: `gen_copy`, `gen_layout`, `judge_vision`, `ref_tagger`. 프롬프트 경로는 `packages/llm/prompts/<role>@v<N>.md`. 비전 채점은 MVP에서 기록 전용(`JUDGE_VISION_MODE` 기본값 `log`). 순위 반영(가중 ≤0.20)은 편입 조건 충족 후 Phase 2. | 04, 05, 07, 09 |
| R-13 | 오류 코드의 단일 원천은 06장 오류 코드 표 + `@tastefit/api-contract`. 브랜드 거부는 `BLOCKED_BRAND`(상세 `reason`: `high_risk` / `phishing_term`)로 통일하고 `BRAND_HIGH_RISK`·`PHISHING_TERM`은 폐기. `BRAND_ATTESTATION_REQUIRED`(422), `INVITE_REQUIRED`, `SHARE_HIDDEN`, `VERSION_GATE_NOT_PASSED`, `GATE_FAILED:<id>`, `GEN_BUDGET_EXCEEDED`(503), `JOB_IN_PROGRESS`(409)를 포함. | 00, 01, 04, 08 |
| R-14 | 생성 API: `POST /api/projects/:id/generations`(202 + 폴링: 2초, 60초 이후 5초). SSE는 Phase 2. | 01, 04, 08 |
| R-15 | 잡 상태 enum: `queued`, `running`, `succeeded`, `partial`, `fallback`, `failed`, `canceled`. 판정 기준은 비폴백 노출 수(3 = succeeded, 1~2 = partial, 0이면서 폴백 노출 ≥1 = fallback, 노출 0 = failed). 한도 차감은 비폴백 ≥1일 때만. | 04, 01 |
| R-16 | 동시 생성: 전역 `GEN_MAX_CONCURRENT_JOBS=5`, 사용자당 1. 초과하면 대기열에 넣고 대기 순번을 표시. Chromium 컨텍스트는 머신당 3. | 00, 01 |
| R-17 | 미리보기 격리: 공유·결과 미리보기는 다른 등록 도메인에서 `sandbox=""`, 생성 HTML에 스크립트 0. 편집 미리보기는 클라이언트 isomorphic 컴파일러가 만든 HTML로 같은 `sandbox=""` iframe의 `srcdoc`을 교체하는 방식이다(postMessage 프로토콜 없음). 슬롯 선택은 부모 페이지 오버레이와 컴파일러가 함께 내보내는 레이아웃 맵(`slotRects`)으로 처리한다. 저장할 때 서버가 다시 컴파일하고 재검사한다. 반영 p95 ≤200ms(스타일) / ≤500ms(구조) 유지. | 01, 06, 04 |
| R-18 | 테이블명: `users`, `survey_answers`, `survey_items`, `reference_sites`(05장 `references` 대체), `rights_requests`(opt-out은 그 위의 뷰), `admin_audit_logs`, `events`(제품 분석 단일 테이블). `feedback_events`는 두지 않는다(편집 신호는 `events` + `mockup_versions`). | 02, 04, 05, 08 |
| R-19 | 화면 ID·route는 01장 S01~S15가 단일 원천. | 09, 07 |
| R-20 | 원본 유사도 가드(MVP): 첫 화면 1280×800 64비트 pHash 해밍 거리 ≤8이면 실패, 7개 요소 조합 중 4개 이상 일치하면 실패, 카피 8어절 연속 일치하면 실패, token은 3개 이상 도메인 집계값만 사용. 이미지 임베딩 코사인(≥0.90 실패)과 구조 유사도는 Phase 2. 임계값 원천은 `config/originality.json`(08장 소유). 위반은 하드 게이트 실패로 처리. | 04, 05 |
| R-21 | BrandInput의 단일 원천은 01장 스키마. 사용자 업로드(로고·사진)는 MVP 제외. 07장 TC-B-09·10은 [P2]로 이동. | 04, 07 |
| R-22 | 예산·한도 플래그명은 00장 IF-09(`GEN_DAILY_BUDGET_USD=10`, `GEN_MONTHLY_BUDGET_USD=150`, `JOB_COST_CAP_USD=0.30`, `GEN_MAX_CONCURRENT_JOBS=5`). 80%에서 알림. 07장의 `limits.*` 이름은 이 플래그명으로 교체. | 07 |
| R-23 | 이벤트 이름의 단일 원천은 00장 §8.3 레지스트리(+01장 D-0106 확장: `survey_exit`, `ui_error_shown`). 07장 이벤트명은 이것에 맞춤. zod 원본은 `@tastefit/api-contract`. | 07, 00 |
| R-24 | 모델 승격 규칙: 블라인드 40쌍, 승률 Wilson 하한 ≥0.35, 그리고 골든 세트에서 회귀 없음(06장 D-0609 채택). | 07 |
| R-25 | 생성 SLO: 첫 시안 카드 노출 p50 ≤45초(점진 노출), 전체 p50 ≤60초, p95 ≤90초, 120초 초과 시 폴백, 180초에 강제 종료. | 00, 04, 07 |
| R-26 | `brief_drafts`는 TTL 24시간. 08장 보관 기간표에 추가. | 08 |
| R-27 | `DesignSpec.l2`는 18키(03장: `type.body_size`, `type.body_leading` 포함). | 04 |
| R-28 | 생성물 axe serious/critical 0건을 하드 게이트에 포함(07장 D-0713). | 04 |
| R-29 | 매직링크 요청에 Cloudflare Turnstile 적용(08장 D-0810). 메일 발송은 Resend. | 06, 01 |
| R-30 | 시즌 ID 규칙(05장 D-053) 채택. `normalizer_version` = 시즌 ID. | 02, 03, 04, 06 |
| R-31 | 레이트리밋 값은 06장 D-0618이 단일 원천. 00장 한도표는 이를 참조. | 00 |
| R-32 | 출시 단계: RC(G1) → 비공개 베타 ≤50명(G1~G6 + G7a, 초대 코드) → 공개 출시(G1~G7)(07장 D-0706). 00장 P0-β와 일치시킨다. | 00, 09 |
| R-33 | 지원 브라우저: Chrome/Edge ≥111, Safari·iOS Safari ≥16.4, Firefox ≥128, Samsung Internet ≥22(07장 D-0705). | 01, 04, 06 |
| R-34 | 이미지 팩은 192장, 태그 21종(03장 단일 원천). | 08, 09 |
| R-35 | 트렌드 집계에는 MVP 동안 사용자 로그를 쓰지 않는다(05장 D-05A). | 02 |
| R-36 | 진단 결과 화면의 "다른 유형 보기": `anchor_override_type_id`에만 저장하고 취향 벡터는 바꾸지 않는다. 결과 공감 점수가 1~2점이면 인접 유형 2개를 제안한다(01장 D-0102, 02장 D-0211). | 04 |
| R-37 | 비전 채점은 생성 모델과 다른 계열의 모델을 쓰고, 위치를 바꿔 2회 호출한다(04장 D-0405). MVP에서는 기록 전용(R-12). | 07 |
| R-38 | 임베딩 모델(로컬 오픈 가중치)은 Phase 2 기능에서만 사용한다. MVP의 닮은 사이트 매칭은 L1 벡터 거리로 한다. | 05 |
