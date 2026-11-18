# 00. 개요·전략

- 문서 버전: v2.1 (2026-11-17, decisions_v2.md R-01~R-38 반영) / 서비스 가칭: 취향핏(TasteFit) (D-01)
- 이 장의 역할: 문제·타깃·가치·경쟁·지표·범위·원가·로깅·운영·리스크·용어를 정의한다. 기능 상세는 01~09장이 정의하며, 이 장은 그 장들이 따라야 할 **제품 수준 기준값**을 확정한다.
- 우선순위 규칙: decisions_v2.md(R-xx) > decisions.md(D-xx) > 이 장 > 개별 장. 이 장의 "추가 결정"(D-00x) 중 R-xx로 대체된 항목은 §13에 표시한다.
- 단일 원천 위임(R-xx): 출시 게이트 합격선 → 07장 + `config/thresholds.json`(R-09) / 오류 코드 → 06장 6.4.2 + `@tastefit/api-contract`(R-13) / 레이트리밋 → 06장 6.10.1(R-31) / 화면 ID·route → 01장 S01~S15(R-19) / 유형 이름·설명 → 02장, 유형 중심 벡터 → 03장 3.4.7(R-04). 이 장의 KPI 목표값(§6)은 출시 후 관측용 제품 지표이며 잠금 대상이 아니다.
- ID 체계: 이 장의 가드레일은 `GR-n`, 리스크는 `RK-nn`, 출시 단계는 07장 게이트 `G1~G7`(R-32)을 쓴다. 04장 하드 게이트 `G-01~G-12`, decisions_v2 `R-xx`와 구분한다.
- 표기: **[P0]** = MVP 포함, **[P2]** = Phase 2, **[P3]** = Phase 3, **MVP 제외** = MVP에서 구현하지 않음. 수치는 별도 표기가 없으면 **초기 가설값**이며 클로즈드 베타 종료 시 재조정한다(→ §6.6).

---

## 1. 프로젝트 목적과 문제 정의

### 1.1 프로젝트 목적(우선순위 순)

| 순위 | 목적 | 성공 판정(측정 가능) |
|---|---|---|
| O1 | **검증**: "고르기만 하는 취향 진단 + 통제된 생성"이 일반 프롬프트 생성보다 사용자 선호를 얻는지 수치로 증명한다 | 가정 A2 통과(§5): 07장 P-2 베이스라인 대비 선호율 ≥ 70%, Wilson 95% 하한 ≥ 0.60 |
| O2 | **포트폴리오**: AI 결과물 품질을 시스템(프리셋·린터·게이트)으로 통제한 사례를 실사용 데이터와 함께 공개한다 | 공개 출시 후 8주 누적 채택 시안 ≥ 300, 공개 케이스 스터디 1건 |
| O3 | **수익화 탐색**: 결제 없이 지불 의향만 측정한다(결제 [P3], D-05) | 페이크 도어 관심 등록률 ≥ 5%(§6.3) |

### 1.2 문제 정의(가설 — §5에서 검증)

| ID | 문제 | 현재 대응과 한계 | 관련 가정 |
|---|---|---|---|
| PR-1 | 디자이너 없는 사업자는 원하는 디자인을 **말로 표현하지 못한다**("깔끔한데 심심하지 않게"). | 프롬프트 생성기·외주 브리핑 모두 언어화가 필요 → 반복 수정·의사소통 비용 | A1 |
| PR-2 | AI 빌더·템플릿 결과는 **획일적인 "AI 티"**(보라 그라디언트, 전부 Inter, 중앙 히어로+3열 카드 등)가 난다. | 사용자가 무엇이 문제인지 몰라 고치지 못함 | A2, A3 |
| PR-3 | 레퍼런스를 모아도 **일관된 디자인 시스템**(서체·색·간격·모서리)으로 옮기지 못한다. | 짜깁기 결과는 조화가 깨짐 | A2 |
| PR-4 | 결과물을 **실제로 쓰거나 전달할 형태**(공유 링크, 코드, 토큰)로 받기 어렵다. | 이미지 시안은 개발 전달 시 재작업 | A5 |

### 1.3 문제가 아닌 것(비목표, Non-goals)

MVP 비목표: 호스팅·도메인 연결, CMS·자유 배치형 노코드 편집기, 다페이지 사이트·쇼핑몰·블로그(D-03, [P2] 이후), 팀 협업, 결제([P3]), 자연어 편집([P3]), Figma 내보내기([P3]), AI 생성 이미지(D-27), 영문 UI·영문 카피([P2] 검토), 네이티브 앱.

---

## 2. 타깃 페르소나

### 2.1 페르소나 정의 (D-02)

| 항목 | **P1. 디자이너 없는 1인 창업자·프리랜서·소규모 브랜드 운영자** (1차) | **P2. 웹 개발자** (2차) |
|---|---|---|
| 하위 세그먼트 ↔ 용도(D-03) | P1-a SaaS·앱 1인 창업자 → `saas` / P1-b 프리랜서·크리에이터 → `portfolio` / P1-c 카페·식당·공방 운영자 → `local_business` | 사이드 프로젝트·클라이언트 랜딩을 만드는 프론트엔드·풀스택 개발자 → 3용도 모두 |
| 상황(JTBD) | "출시·오픈을 앞두고 랜딩 1장이 필요한데, 디자이너를 쓸 예산·시간이 없다. 내 취향과 맞고 AI 티가 안 나는 시안을 받아 바로 쓰거나 개발자에게 넘기고 싶다." | "기능 구현은 되는데 디자인 결정(서체·색·간격)이 막힌다. shadcn 기본값 같은 결과를 벗어나 바로 붙일 수 있는 코드와 토큰이 필요하다." |
| 핵심 고통 | PR-1, PR-2, PR-4 | PR-2, PR-3 |
| 현재 대안 | 웹빌더 템플릿, 프롬프트 생성기, 지인·크몽 외주 | v0·Lovable 등 프롬프트 생성기, UI 키트, 템플릿 구매 |
| 기기 | 진단은 모바일 60%+ 예상, 생성·편집은 데스크톱(→ 01장). 지원 브라우저는 R-33 | 데스크톱 |
| 성공 경로(채택까지, 화면 ID는 01장 J1) | 진단 S02 → 결과 S03 → 브리프 S06 → 로그인·동의 S04·S05 → 대기·비교 S07·S08 → 편집 S09 → **공유 링크 공개 S11** 또는 **HTML zip 내보내기 S10** | 같은 경로, 채택 수단은 S10의 **React+Tailwind zip** 또는 **DTCG 토큰** |
| 결과만 보고 떠날 때의 가치(출구) | 유형 결과 + "내 유형 디자인 가이드" 카드(서체 페어링·팔레트·모서리 계열 요약, 복사 가능) + 결과 공유 (D-001) | 동일 + 가이드 카드의 토큰 값 복사 |
| 대상 지표 | 채택률(공유 링크 비중), 결과 공감 | 채택률(코드·토큰 내보내기 비중) |

- 획득 채널(페르소나 아님): **공유 유입 사용자** — 결과 공유 링크로 들어와 재미로 진단하는 사용자. 1차 가치 대상이 아니며(D-02), 결과 공유 페이지의 "나도 진단하기" CTA로 퍼널 상단을 채우는 채널로만 다룬다.
- 기능 명세 태그 규칙: 01~09장의 모든 사용자 기능 표에 `대상: P1|P2|P1,P2|운영자` 열을 둔다(AC-00-01).

### 2.2 페르소나별 요구 → 제품 결정 매핑

| 요구 | P1 | P2 | 반영 결정 | 상세 |
|---|---|---|---|---|
| 언어화 없이 방향 지정 | 필수 | 필수 | 4지선다·A/B 진단 16문항 이하 (D-13) | → 02장 |
| AI 티 없는 결과 | 필수 | 필수 | 프리셋 스냅·린터·하드 게이트 (D-21~23) | → 03, 04장 |
| 원시값 몰라도 조정 | 필수 | 선택 | 스텝 컨트롤·후보 카드만 (D-16) | → 01, 04장 |
| 바로 쓰는 산출물 | 공유 링크·HTML | React·토큰 | 내보내기 3종 (D-26) | → 04, 06장 |
| 상업 이용 | 필수 | 필수 | 결과물 상업 이용 허락 (D-51), 라이선스 파일 자동 포함 (D-26) | → 08장 |

### 2.3 수용 기준

- **AC-00-01**: 01~09장의 모든 사용자 기능 명세 표에 `대상` 열이 존재하고 값이 `P1`, `P2`, `P1,P2`, `운영자` 중 하나다(문서 검사 스크립트로 확인 → 09장).
- **AC-00-02**: 랜딩 첫 화면(→ 01장) 카피에 1차 타깃(P1)과 산출물("시안 3개", "코드 내보내기")이 명시되고, 문자열 "MBTI"가 사용자 노출 문자열 전체에서 0건이다(grep CI 검사, D-01).

---

## 3. 가치 제안

### 3.1 가치 제안 문장

- 공통(랜딩 헤드라인 초안): **"4분 동안 마음에 드는 쪽만 고르세요. 내 취향에 맞고 AI 티 없는 랜딩 시안 3개를 코드와 함께 드립니다."**
- 서브카피 초안: "로그인 없이 진단 · 무료 · 약 4분 / 시안은 로그인 후 생성 · 상업적 이용 가능"
- 랜딩·결과 화면의 카피 전체와 배치 → 01장. 위 두 문장은 01장이 그대로 사용하거나, 같은 정보 요소(소요 시간, 무료, 로그인 시점, 산출물 개수, 상업 이용)를 모두 포함해야 한다(AC-00-03).

### 3.2 가치 → 증거 지표

| 가치 요소 | P1 | P2 | 증거 지표(§6) |
|---|---|---|---|
| V1 고르기만 하면 되는 취향 언어화 | ● | ● | 결과 공감률, 진단 완료율, 재검사 일치율 |
| V2 AI 티 없는, 조화가 보장된 시안 | ● | ● | 블라인드 선호율, "AI 같다" 응답률, 시안 선택률 |
| V3 바로 쓰는 산출물(공유 링크·HTML·React·토큰) | ● | ● | 채택률(North Star), 포맷별 내보내기 비중 |
| V4 시안 없이도 남는 결과(유형·가이드 카드) | ● | ○ | 결과 공유율, 가이드 복사율 |

● = 핵심, ○ = 부가

- **AC-00-03**: 랜딩 화면 렌더 결과에 "4분", "무료", "로그인 없이", "시안 3개", "코드" 다섯 키워드가 모두 존재한다(E2E 텍스트 검사).

---

## 4. 경쟁·대체재와 차별점

### 4.1 비교표

> 경쟁 제품의 기능·가격은 작성 시점 작성자 인식 기준이며 **출시 전 각 제품 공식 페이지에서 재확인**한다.

| 대안 | 사용자가 얻는 것 | 한계 = 우리의 기회 | 우리가 피할 영역 |
|---|---|---|---|
| 프롬프트 기반 생성기 (v0, Lovable, Bolt 등) | 빠른 코드 생성, 대화형 수정, 앱 기능까지 | 취향을 **말로** 설명해야 함, 기본 미감이 비슷함(AI 티), 디자인 토큰 일관성 보장 없음 | 대화형 편집·앱 로직 생성(경쟁 열위) |
| AI 사이트 빌더 (Framer AI, Wix AI 등) | 생성+호스팅+편집 일체 | 플랫폼 종속, 템플릿 기반으로 개성 제한, 코드 반출 제약 | 호스팅·자유 편집기 |
| 디자인·와이어 생성 (Relume, Google Stitch 등) | 구조·시안 빠른 탐색 | 취향 진단 없음, 결과 디자인 시스템이 사용자 취향과 연결 안 됨 | 사이트맵·다페이지 구조 설계 |
| 템플릿 마켓 (Framer·Webflow 템플릿, ThemeForest) | 검증된 디자인 품질 | 탐색 비용 큼, 커스터마이즈 난이도, 내 콘텐츠와 불일치 | 대량 템플릿 카탈로그 |
| 레퍼런스 탐색 (Awwwards, Godly, Pinterest) + 직접 구현 | 영감 | 취향을 시스템으로 옮기지 못함(PR-3) | 레퍼런스 갤러리 |
| 외주(크몽·지인 디자이너) | 맞춤 결과 | 비용·기간, 브리핑 언어화 필요(PR-1) | — (보완재: 공유 링크를 브리핑 자료로 사용) |

### 4.2 차별점(지켜야 할 3가지)과 연결 KPI

| # | 차별점 | 구현 근거 | 연결 KPI(§6) | 차별점 붕괴 신호 |
|---|---|---|---|---|
| DF-1 | **언어화 부담 0** — 고르기만 하는 진단 | D-13, D-14 | 진단 완료율 ≥ 65%, 결과 공감률 ≥ 70%, 개인화 선호율(P-4) ≥ 70% | 공감률 < 55% 또는 P-4 미달 (A1·A1b 실패) |
| DF-2 | **AI 티 통제** — LLM은 미적 결정을 하지 않고, 프리셋·린터·게이트가 조화를 책임 | D-21~23, D-28, R-28 | 베이스라인 대비 선호율(P-2) ≥ 70%, AI 느낌 판별률(P-1) ≤ 65% | P-2 Wilson 하한 < 0.60 (A2 실패) |
| DF-3 | **취향 → 디자인 시스템** — 시안과 함께 일관된 토큰(DTCG)과 코드를 반출 | D-26 | 채택률 ≥ 40%, 토큰·코드 내보내기 비중 | 채택률 < 25% (A5 실패) |

### 4.3 포지셔닝

- 포지셔닝 문장: **"빌더가 아니라 취향 → 디자인 시스템·시안 생성기."**
- 보완재 전략: 내보낸 HTML·React·토큰을 다른 도구(v0, Framer, 직접 개발)로 가져가 쓰는 것을 권장한다. 내보내기 README(→ 04장)에 "다음 단계로 쓰는 법" 3가지(정적 호스팅에 업로드, React 프로젝트에 붙이기, 토큰을 기존 프로젝트에 적용)를 넣는다.
- 결과 공유는 획득 채널이며 1차 가치가 아니다(D-02). 따라서 바이럴 장치(카드 디자인 고도화, 궁합 등)는 핵심 경로 완성 후에만 투자한다(§7.3 우선순위 원칙).

---

## 5. 핵심 가정과 검증 계획

### 5.1 가정 레지스터

| ID | 가정 | 검증 방법 | 표본 | 성공 기준 | 실패 기준 → 의사결정 | 시점 |
|---|---|---|---|---|---|---|
| A0 | (선행) 진단 엔진이 시뮬레이션에서 축·유형을 복원한다 | `pnpm sim:survey`(→ 02장 2.16, 07장 7.3.1) | 가상 사용자 1,000명 | R-05 합격선: 유형 중심 근처 모집단 유형 정확도 β=8 ≥85%·β=4 ≥70%, 균일 모집단 top-1 ≥62%·top-2 ≥85%, RMSE β=8 ≤0.12·β=4 ≤0.18, 90% 구간 포함률 85~95%, 적응형 이득 RMSE −5% 이상 + top-1 +3%p 이상, 문항 최대 16·1단계 정확히 8. 일관성 지수 기준은 07장 7.3.1 값 유지 | 미달 → 사람 대상 검증(A1·A1b) 진행 금지, 02장 상수 조정 | 비공개 베타 전(07장 G2) |
| A1 | 시각 선택 16문항 이하로 사용자가 공감하는 유형을 판정할 수 있다 | ① 결과 화면 5점 공감 평가 ② 6~14일 후 재진단 유형 일치율(경계 결과는 2순위 포함, 02장 2.16.3) | ① 결과 도달 n≥60 ② 재진단 n≥15 | ① 4~5점 비율 ≥ 70% 그리고 평균 ≥ 3.8 ② 일치 ≥ 60% | ① < 55% 또는 ② < 40% → 02장 문항·유형 재설계를 최우선, 생성 고도화 작업 중단 | 비공개 베타 |
| A1b | 진단 결과가 시안 선호를 실제로 좌우한다(진단의 효용) | 07장 7.8.5 **P-4 개인화 선호율**: 참가자 프로필 V-TRUE vs 앵커 거리가 먼 유형 3개 중 무작위 1개의 V-TRUE, 라벨 없이 좌우 무작위 | 참가자 ≥15명 × 2쌍 = ≥30응답 | ≥ 70% 그리고 Wilson 95% 하한 ≥ 0.50 | 미달 → 공개 출시 보류(07장 G7b), 진단 단계 축소 또는 "유형 직접 선택" 대안 실험 | 공개 출시 전 |
| A2 | 진단 기반 시안이 일반 프롬프트 시안보다 선호된다 | 07장 7.8.3 **P-2 베이스라인 대비 선호율**: 골든 핵심 20케이스 V-TRUE vs 베이스라인(`eval/blind/baseline_prompt.md`), "실제로 쓰고 싶은 쪽" 강제 선택 | 평가자 ≥5명(비디자이너 ≥3) × 20쌍 = 100응답 | ≥ 70% 그리고 Wilson 95% 하한 ≥ 0.60 | Wilson 하한 < 0.60 → 공개 출시 보류(G7b), Phase 2 트렌드·자동 수집 투자 보류, 04장 생성 품질 개선만 진행 | 공개 출시 전 |
| A3 | 프리셋·린터가 "AI 티"를 줄인다 | 07장 7.8.2 **P-1 AI 느낌 판별률**: 생성 20 + 사람 제작 대조군 20, "사람/AI" 강제 선택 | 5명 × 40항목 = 200응답 | 판별 정확도 ≤ 0.65 (Phase 2 ≤ 0.55) | > 0.65 → 공개 출시 보류(G7b), 평가자 ≥80%가 "AI"로 고른 항목을 03·04장 린터 규칙 후보로 등록 | 공개 출시 전 |
| A4 | 결과 도달자 일부가 결과를 공유한다(획득 채널 성립) | 결과 공유율 F5 | 결과 도달 n≥60 | ≥ 15% | < 5% → 공유 기능 고도화 [P2] 취소, 획득은 커뮤니티 게시로 대체 | 비공개 베타 |
| A5 | 사용자가 시안을 실제로 쓴다 | 채택률 + 채택 7일 후 이메일 설문 "실제로 사용했나요?(배포/외주 전달/참고만/안 씀)" | 채택 n≥20 | 채택률 ≥ 40%, "배포 또는 외주 전달" ≥ 30% | 채택률 < 25% → 편집 범위·내보내기 포맷 재검토(인터뷰 5명) | 비공개 베타 → 공개 출시 |
| A6 | 로그인 벽이 생성 전환을 치명적으로 막지 않는다 | `login_prompt_view` → `login_success` 전환율 | n≥40 | ≥ 60% | < 40% → 1회 체험 생성(로그인 전) 실험 제안(D-41 재검토 안건) | 비공개 베타 |
| A7 | 지불 의향이 있다 | 한도 도달 화면·`/pricing`(S14)의 페이크 도어 "유료 플랜 출시 알림 받기" | `paywall_view` 사용자 n≥50 | 클릭률 ≥ 5% | < 2% → 수익화 실험 [P3] 우선순위 하향 | 공개 출시 후 |

### 5.2 검증 실행 규칙

- A1b·A2·A3의 프로토콜·평가자 구성·무작위화·정답 키 커밋·리포트 형식은 07장 7.8이 단일 원천이다. 도구는 `pnpm eval:blind:pack <P-1|P-2|P-4>`(정적 평가 페이지) 와 `pnpm eval:blind:score`이며, 결과 집계는 어드민 ADM-09(`eval_sets`·`eval_judgments`, DDL → 06장 6.3.3)로도 조회한다.
- 베이스라인 시안은 오프라인 평가 전용이며 서비스 경로에 노출하지 않는다. 베이스라인 HTML은 샌드박스 렌더 후 스크린샷만 보관한다(→ 06장 6.11, R-17).
- 통계 판정: Wilson 95% 구간을 보고하고 위 성공 기준의 하한 조건으로 판정한다(07장 7.8.1). 표본 미달 시 판정 보류이며 단계 전환 조건(§7.2)에서 미충족으로 취급한다.
- 합격선 수치의 기계 판정 원천은 `config/thresholds.json`의 `release` 객체(R-09)이며, 이 표와 다르면 그 파일과 07장을 따른다.
- **AC-00-04**: A1·A4~A7의 각 지표가 §8 이벤트만으로, A1b·A2·A3이 `eval/blind/reports/*.json` 또는 `eval_judgments`만으로 계산된다(§8.5 쿼리 존재, 픽스처 쿼리 테스트 통과).

### 5.3 사용성 테스트 계획 (UX-12)

07장 7.9와 같은 내용이며, 공개 출시 게이트(G7c) 판정은 07장 7.9.2를 따른다. 과제 스크립트는 01장 1.17.

| 항목 | 값 |
|---|---|
| 라운드 | 2회: R1 = 비공개 베타 시작 전(G1~G6 통과 빌드), R2 = R1의 S1·S2 이슈 수정 후 |
| 참가자 | 라운드당 5명: P1 ≥ 3명(비디자이너, 용도 3종 고르게), P2 ≥ 1명. 모바일 진단 수행자 ≥ 2명 |
| 방식 | 원격 화면 공유 + 소리 내어 생각하기, 1인 30분, 도움 없이 완료해야 성공 |
| 과제 | T1 안내 없이 진단 끝내기 / T2 결과 화면의 축 점수 의미를 자기 말로 설명하기 / T3 가게 정보(가상 가능)로 시안 받기 / T4 시안 1개를 골라 모서리를 더 둥글게(스텝 컨트롤), 글꼴 후보 바꾸기 / T5 HTML로 내보내기 |
| 측정 | 과제 성공률, 과제 시간, SEQ(7점), 종료 후 SUS, 진단 소요 시간 |
| 통과 기준(R2) | 과제별 성공률 ≥ 80%(5명 중 ≥ 4명), SUS 평균 ≥ 70, SEQ 과제별 중앙값 ≥ 5, 진단 소요 중앙값 ≤ 4분, S1 이슈 미해결 0 |
| 기록 | `qa/usability/R<n>/`에 과제별 결과표와 이슈 목록(심각도 S1/S2/S3, 07장 7.9.2 정의) |

- **AC-00-05**: R2 통과 기준을 충족하기 전에는 공개 출시(§7.2, 07장 G7c)로 전환하지 않는다.

---

## 6. 성공 지표

### 6.1 North Star (D-04)

| 항목 | 정의 |
|---|---|
| 이름 | **주간 채택 시안 수 (Weekly Adopted Mockups, WAM)** |
| 채택(adopted) | 하나의 `mockup`에 대해 ① 내보내기 성공(`export_complete`, 포맷 무관) 또는 ② 공유 링크 공개 전환(`share_link_enable`, target_type=`mockup`)이 **최초로** 발생한 시점. `mockup_adopted` 서버 이벤트로 시안당 1회만 기록한다 |
| 집계 | KST 기준 ISO 주(월 00:00 ~ 일 23:59:59)에 `mockup_adopted`가 발생한 시안 수 |
| 제외 | `users.is_internal = true`(운영자·테스트 계정), 폴백 시안(`mockups.is_fallback = true`)은 **포함**하되 별도 보조 지표로 비중을 본다(폴백 채택 비중 ≤ 20% 가드레일) |
| 선정 이유 | 진단(V1) → 생성 품질(V2) → 산출물 유용성(V3)을 모두 통과해야만 증가하는 유일한 지표 |

| 단계(§7.2, R-32) | WAM 목표 |
|---|---|
| 비공개 베타(4주, 초대 생성 사용자 ≤ 50명) | 4주 누적 ≥ 30, 4주차 WAM ≥ 10 |
| 공개 출시(8주) | 8주차 WAM ≥ 100 |
| Phase 2 진입 후 | 직전 4주 평균 대비 월 +20% (Phase 2 시작 시 재설정) |

### 6.2 퍼널 KPI

목표는 비공개 베타 기준(진단은 공개, 생성은 초대 코드 보유자 ≤ 50명, D-013→R-32). 판정 최소 표본: 진단 시작 n≥100, 생성 사용자 n≥30(미달 시 판정 보류). 단계별 분모는 직전 단계 도달 고유 주체(익명은 `anon_id`, 로그인 후는 `user_id`로 병합 → §8.4). F6·F7은 초대 코드 보유자만 분모로 한다(`INVITE_REQUIRED`로 거부된 주체 제외). 07장 7.3.4의 "사용 지표" 경보선은 이 표가 우선한다(07장 본문 규정).

| # | 단계 | 정의(분자/분모) | 목표 | 경보선(이하이면 원인 분석) |
|---|---|---|---|---|
| F1 | 유입 | `survey_start` 주체 / `landing_view` 주체 | ≥ 40% | < 25% |
| F2 | 진단 완료 | `survey_complete` / `survey_start` | ≥ 65% | < 50% |
| F3 | 진단 소요 | `survey_complete.duration_s` 중앙값 | ≤ 240초 (D-13) | > 360초 |
| F4 | 결과 공감 | `result_rating.score ∈ {4,5}` / `result_rating` 응답자 | ≥ 70% (평균 ≥ 3.8) | < 55% |
| F5 | 결과 공유 | `result_share` 주체 / `result_view` 주체 | ≥ 15% | < 5% |
| F6 | 로그인 전환 | `login_success` / `login_prompt_view` 주체 | ≥ 60% | < 40% |
| F7 | 생성 전환 | `generate_request` 주체 / `result_view` 주체 | ≥ 35% | < 20% |
| F8 | 시안 선택 | `mockup_select` 잡 수 / `generate_complete`(status ∈ succeeded, partial, fallback) 잡 수 | ≥ 60% | < 40% |
| F9 | 채택 | `mockup_adopted` 시안 수 / `mockup_select` 시안 수 | ≥ 40% | < 25% |
| F10 | 편집 노력 | 선택 → 채택까지 `mockup_edit` 횟수 중앙값 | ≤ 10 (낮을수록 첫 시안 품질 높음) | > 20 |
| F11 | 리텐션 | 첫 `generate_request` 후 D1~D14에 재방문하여 `generate_request`·`mockup_edit`·`survey_start` 중 1개 이상 발생한 사용자 비율 | ≥ 15% | < 8% |
| F12 | 진단 이탈 위치 | `survey_exit` 주체의 `seq` 분포(R-23, 01장 D-0106) | 단일 문항 이탈 집중 ≤ 20% | 특정 `seq` > 30% |

### 6.3 품질·검증 KPI

| # | 지표 | 정의 | 목표 |
|---|---|---|---|
| Q1 | 베이스라인 대비 선호율 | A2 = 07장 P-2 | ≥ 70%, Wilson 하한 ≥ 0.60 |
| Q2 | AI 느낌 판별률 | A3 = 07장 P-1 | ≤ 0.65 |
| Q3 | 개인화 선호율(진단 효용) | A1b = 07장 P-4 | ≥ 70%, Wilson 하한 ≥ 0.50 |
| Q4 | 재검사 일치율 | A1 ② | ≥ 60% |
| Q5 | 생성 성공률 | 생성 잡 중 비폴백 시안 ≥ 1개 노출 비율(status ∈ succeeded, partial, R-15) | ≥ 95% |
| Q6 | 3안 완전 노출률 | 생성 잡 중 `status = succeeded`(비폴백 3개, R-15) 비율 | ≥ 85% |
| Q7 | 시안 좋아요 비율 | `mockup_feedback.rating=up` / 전체 피드백 | ≥ 60% |
| Q8 | 지불 의향 | A7 | ≥ 5% |

### 6.4 가드레일 지표

악화 시 자동 조치 또는 배포 중단. "자동"은 시스템이 즉시 수행, "수동"은 운영자가 24시간 안에 수행한다. 알림 규칙 구현은 06장 6.12.4(A1~A11).

| # | 지표 | 임계값 | 조치 |
|---|---|---|---|
| GR-1 | 생성 1회 원가 | 잡 단위 ≤ US$0.30 (`JOB_COST_CAP_USD`, D-24·R-22) | 자동: 잡 내 누적 원가가 상한에 도달하면 남은 단계 중단 → partial/폴백(§9.2) |
| GR-2 | 일 지출 | 80% 도달 시 알림, `GEN_DAILY_BUDGET_USD` 도달 시 차단 | 자동: 킬 스위치 KS-1 발동(§9.4) |
| GR-3 | 월 지출 | `GEN_MONTHLY_BUDGET_USD` 도달 | 자동: KS-1을 월말까지 유지 |
| GR-4 | 생성 지연(R-25) | 첫 시안 카드 노출 p50 ≤ 45초, 3안 전체 p50 ≤ 60초·p95 ≤ 90초, 1시간 이동창. 120초 초과 시 폴백 경로, 180초 강제 종료 | 수동: p95 > 90초 1시간 지속 시 알림(06장 A2) → 동시성·모델 점검 |
| GR-5 | 생성 실패율 | `generate_complete.status=failed` 비율 ≤ 1%(06장 6.12.5), `fallback` 비율 ≤ 5% | 자동 알림(failed > 10% 또는 fallback > 30%, 06장 A2·A3). 수동: 원인 수정 전 신규 배포 중단 |
| GR-6 | 노출 시안 품질 | 노출 시안의 하드 게이트(04장 G-01~G-12) 통과율 100%, WCAG AA 위반 0건, axe serious/critical 0건(R-28), 원본 유사도 위반 0건(R-20) | 위반 1건이라도 발견 시 수동: 해당 배포 롤백(→ 06장 6.13.5, 07장) |
| GR-7 | 신고율 | 신고 수 / 공개 공유 링크 수 ≤ 1% (주간) | 수동: 초과 시 공유 공개 기본값 재검토, KS-3 검토 |
| GR-8 | 싫어요 비율 | `mockup_feedback.rating=down` ≤ 40% (주간) | 수동: 사유 상위 1개 원인 분석 |
| GR-9 | 폴백 채택 비중 | 채택 시안 중 `is_fallback` 비율 ≤ 20% | 수동: 생성 품질 문제로 간주, 04장 점검 |
| GR-10 | 채택 시안당 LLM 원가 | 주간 LLM 총원가 / WAM ≤ US$1.50 | 수동: 초과 2주 연속 시 후보 수·모델 재검토 안건 |

### 6.5 지표 → 이벤트 매핑 요약

| 지표 | 필요한 이벤트/테이블 |
|---|---|
| WAM, F9 | `mockup_adopted` |
| F1~F5, F12 | `landing_view`, `survey_start`, `survey_complete`, `survey_exit`, `result_view`, `result_rating`, `result_share` |
| F6~F8 | `login_prompt_view`, `login_success`, `generate_request`, `generate_rejected`, `generate_complete`, `mockup_select` |
| F10, F11 | `mockup_edit`, `generate_request`, `survey_start` |
| Q1~Q3 | `eval/blind/reports/*.json`, `eval_judgments`(07장 7.8) |
| Q4 | `survey_complete`(재진단 쌍), `survey_results.type_id`·`type_id_second` |
| Q5, Q6, GR-1~GR-5 | `generate_complete`, `generation_jobs`, `llm_calls` (→ 06장 6.12.3 뷰) |
| GR-6 | `candidates.quality_report`, 07장 골든 리포트 |
| Q7, GR-8 | `mockup_feedback` (+ `mockups.feedback`) |
| GR-7 | `reports`, `share_link_enable` |
| Q8 | `paywall_interest`, `paywall_view` |

### 6.6 목표값 재조정 규칙

- 비공개 베타 종료 시 실측값으로 공개 출시 목표를 재설정한다. 규칙: 새 목표 = max(현재 목표, 실측값 × 1.1). 단, 실측이 경보선 미만인 지표는 목표를 낮추지 않고 원인 분석 문서를 작성한다. 07장 게이트 합격선(`config/thresholds.json`)은 이 규칙으로 바꾸지 않는다(07장 7.12 잠금 절차).
- 재조정 결과는 이 장의 문서 버전을 올려 기록한다(변경 이력 표, → 09장 문서 운영).
- **AC-00-06**: 어드민 KPI 화면(ADM-01)이 §6.1~6.4의 모든 지표를 일·주 단위로 표시하고, 각 수치가 §8.5의 SQL 결과와 일치한다(픽스처 테스트).

---

## 7. MVP 범위와 Phase 로드맵

### 7.1 MVP 범위표 (포함/제외)

| 영역 | [P0] MVP 포함 | MVP 제외 → 단계 | 상세 장 |
|---|---|---|---|
| 서비스 이름·표현 | 취향핏, "디자인 성향 유형" | "MBTI" 표현 사용 금지(전 단계) | 01 |
| 언어·기기 | 한국어 UI·카피, 진단·결과 모바일 우선(375px), 생성·편집 데스크톱 권장(모바일은 미리보기·공유만). 지원 브라우저: Chrome/Edge ≥111, Safari·iOS Safari ≥16.4, Firefox ≥128, Samsung Internet ≥22 (R-33) | 영문 [P2 검토] | 01, 07 |
| 진단 | 1단계 4지선다 정확히 8문항 + 2단계 A/B 최대 8문항(총 ≤16), 조기 종료(σ≤0.08), "다 별로예요"/"차이를 모르겠어요", 뒤로가기 1단계, 이어하기, 결과 화면 "다른 유형 보기"(`anchor_override_type_id`만 저장, 벡터 불변, R-36) | 3단계 요소 미세조정(폐기, D-16), 문항 수 A/B 테스트 [P2] | 02 |
| 자극물 | 사전 렌더 오리지널 이미지(R-06·R-07): 1단계 카드 48장 = 기준 벡터 16개(앵커 8 + 브리지 8) × 콘텐츠 템플릿 3, 2단계 A/B 120쌍(축 수준 {0.2, 0.5, 0.8}). 기기별 2벌(desktop 1280×800 ≤140KB, mobile 780×1560 ≤160KB WebP). 가상 브랜드 "한결"(R-08) | 실시간 렌더(전 단계 제외) | 02, 05, 09 |
| 결과 | 유형 8종(`T1`~`T8`, R-04), 5축 점수, 경계 표기, "닮은 사이트" 텍스트 링크 3곳(L1 벡터 거리 매칭, R-38), 공감 평가(1~2점이면 인접 유형 2개 제안, R-36), 공유 링크·결과 카드 이미지, "내 유형 디자인 가이드" 카드(D-001), 재진단·이전 결과 비교 | 유형 16종 [P3], 유형 궁합 [P2], 카카오 SDK 공유 [P2](MVP는 링크 복사·이미지 저장·Web Share API, D-003) | 01, 02 |
| 계정 | 익명 진단(쿠키), 생성·저장·내보내기 로그인(이메일 매직링크 + Turnstile·Resend 발송, Google, R-29), 익명 결과 귀속, 셀프 탈퇴·삭제 | 카카오·네이버 로그인 [P2], 팀·공유 편집 [P3] | 01, 06, 08 |
| 생성 입력 | 용도 3종(`saas`, `portfolio`, `local_business`, R-02), BrandInput(단일 원천 01장, R-21) | 로고·사진 업로드(MVP 제외, R-21), 쇼핑몰·다페이지·블로그 [P2+] | 01, 04 |
| 생성 | `POST /api/projects/:id/generations` 202 + 폴링(R-14), 후보 6 → 하드 게이트(원본 유사도·axe 포함, R-20·R-28) → 점수 → `v_true`/`v_fit`/`v_bal` 3안(R-03), 재생성 최대 1회, 변형별 결정론적 폴백, 점진 노출, 비전 채점은 기록 전용(`JUDGE_VISION_MODE=log`, R-12·R-37) | SSE [P2](R-14), 비전 채점 순위 반영(가중 ≤0.20) [P2](R-12), 다크모드 쌍 [P2], AI 생성 이미지(제외), 이미지 임베딩·구조 유사도 가드 [P2](R-20) | 04 |
| 편집 | 스텝 컨트롤(검증된 단계 이동)·후보 카드 교체, 섹션 순서 변경·숨김, 텍스트 슬롯 직접 수정(LLM 호출 없음), undo/redo. 미리보기는 클라이언트 컴파일 HTML을 `sandbox=""` iframe `srcdoc`으로 교체, 저장 시 서버 재컴파일·재검사(R-17) | 자연어 편집 [P3], LLM 카피 다시 쓰기 [P2](D-004, 04장 D-0408), 원시값(hex·px) 입력(전 단계 제외) | 01, 04 |
| 내보내기 | 정적 HTML+CSS zip, React+Tailwind zip, DTCG 토큰 JSON, LICENSES.md·CREDITS.md 자동 포함 | Figma [P3], 전체 페이지 PNG [P2], 방향 설명서 PDF [P2] | 04 |
| 공유 | 결과 공유 S03 `/r/[shareId]`(기본 공개), 시안 공유 S13 `/p/[shareId]`(기본 비공개, S11 토글) — route는 01장(R-19) | 공유 페이지 댓글 [제외] | 01, 08 |
| 품질 | 하드 게이트, AI 티 린터(서비스 UI 포함, D-28), 조화 ≥80·취향 일치 ≥75, 골든 세트 32케이스(유형 8 × 용도 3 + 엣지 8, 전체 실행 케이스당 3회, 스모크 8×1, R-11), 임계값 `config/thresholds.json`(R-09) | 카나리 배포(오프라인 승격 규칙으로 대체, D-44·R-24) | 04, 07 |
| 레퍼런스·트렌드 | 수동 시드 60개(사람 라벨, `reference_sites`, R-18), 월 1회 수동 트렌드 리포트, 분기 시즌 릴리스(`YYYY-S{n}`, R-30). 트렌드 집계에 사용자 로그 미사용(R-35) | 자동 크롤러·주간 수집·급등 감지·임베딩 군집 [P2](R-38) | 05 |
| 모델 | 단일 게이트웨이 + models.yaml(역할 `gen_copy`, `gen_layout`, `judge_vision`, `ref_tagger`, R-12) + MockProvider | 자동 라우팅 서비스(전 단계 제외), 자동 승격·롤백 [P2] | 06 |
| 운영 | 최소 어드민 13개 기능(§10.1), 문의 폼, 신고, 권리·삭제 요청, 알림 웹훅 | 자체 CS 헬프데스크 [P2], 자동 악용 탐지 고도화 [P2] | 이 장 §10 |
| 분석 | 단일 `events` 테이블(R-18) + KPI SQL + 어드민 KPI 화면 | 외부 분석 SaaS(MVP 제외, D-005), 코호트 대시보드 [P2] | 이 장 §8, 06 |
| BM | 무료 + 사용량 한도 + 페이크 도어 | 결제 [P3] | 이 장 §9 |
| 법무 | 약관·처리방침·권리자 문의 페이지(S14), 동의 기록, AI 생성 고지 | 사업자·통신판매업 [P3 결제 시] | 08 |

### 7.2 출시 단계와 진입 조건

출시 단계는 07장 7.11과 같다(R-32): **RC → 비공개 베타(≤ 50명) → 공개 출시**. 기술·품질 게이트 G1~G7의 정의와 합격선은 07장 7.11.2가 단일 원천이고, 이 표는 각 단계에 추가로 요구하는 **제품 조건**을 정한다. 기간은 가설값, 구현 마일스톤 → 09장.

| 단계 | 기간 | 대상 | 07장 게이트 | 추가 제품 조건(모두 충족) | 다음 단계 진입 조건 |
|---|---|---|---|---|---|
| **RC** | 구현 완료 후 | 내부 | G1 | ① E2E "익명 진단 → 로그인(Mailpit 매직링크, R-10) → 결과 귀속 → 생성 → 선택 → 편집 → 내보내기 3종 → 공유" 통과 ② 08장 법무 문서 3종 게시 | 비공개 베타 게이트(G1~G6 + G7a, A0 시뮬레이션 R-05는 G2에 포함) 통과, 사용성 R1 완료 |
| **비공개 베타** | 4주 | 초대 코드 보유 생성 사용자 ≤ 50명, 진단은 공개(단 홍보 게시 없음) | G1~G6 + G7a | `BETA_INVITE_ONLY=true` | ① §6.2 F1~F9 중 7개 이상 목표 달성(표본 충족 시), 경보선 미만 0개 ② A1 성공 ③ GR-1~GR-6 위반 미해결 0건 ④ 07장 G7(G7b: P-1·P-2·P-4, G7c: 사용성 R2) 통과 |
| **공개 출시** | 8주 | 전체 | G1~G7 전부 | `BETA_INVITE_ONLY=false`, 페이크 도어 측정 | Phase 2 진입: ① 8주차 WAM ≥ 100 ② F11 ≥ 15% ③ A5 성공 ④ 월 지출 ≤ `GEN_MONTHLY_BUDGET_USD` |
| **Phase 2** | 가설 12주 | — | 07장 Phase 2 기준 | 자동 수집·트렌드 감지, 다페이지, 다크모드 쌍, SSE, 비전 채점 순위 반영, 영문 검토, 카카오 공유·로그인 | A2 성공이 전제(실패 시 트렌드 항목 보류, §5.1). Phase 3 진입: A7 ≥ 5% 그리고 Phase 2 종료 시 WAM ≥ 300 |
| **Phase 3** | 미정 | — | — | Figma 내보내기, 유형 16종, 자연어 편집, 결제 | — |

- 게이트 예외 승인(waiver)은 MVP에서 허용하지 않는다(07장 7.11.2).
- 초대 코드: `invites`·`invite_redemptions`(DDL → 06장 6.3.3). 미보유자의 생성 요청은 403 `INVITE_REQUIRED`(R-13).

### 7.3 우선순위 원칙

1. **핵심 경로 우선**: 진단 → 결과 → 로그인 → 입력 → 생성 → 선택 → 내보내기/공유가 끝까지 동작하기 전에는 품질 고도화·바이럴 장치·Phase 2 항목을 구현하지 않는다.
2. **원가 통제 선행**: 생성 API는 §9의 한도·원가 가드·킬 스위치가 구현된 뒤에만 실제 모델 키로 동작한다(MockProvider로는 언제든 동작).
3. **자율 구현 경계**: AI 코딩 에이전트는 §7.1 "[P0] MVP 포함" 열의 항목만 구현한다. "MVP 제외" 항목의 코드·스키마·플래그를 미리 만들지 않는다(단, 이 장과 06장이 명시한 플래그·enum 값은 예외. 예: `JUDGE_VISION_MODE`의 `rank` 값).
4. 백로그 태그: `P0-Must`(핵심 경로), `P0-Should`(목표 KPI에 직접 영향), `P2`, `P3`. 마일스톤 배정 → 09장.

- **AC-00-07**: 01~09장의 모든 기능 항목이 `[P0]`/`[P2]`/`[P3]`/`MVP 제외` 중 하나로 표시되어 있다(문서 검사).
- **AC-00-08**: P0 기능만 활성화된 빌드에서 RC 추가 제품 조건 ①의 E2E가 통과한다.

---

## 8. 이벤트 로깅 스키마 (KPI 계산용)

### 8.1 원칙

- 단일 저장소: Postgres `events` 테이블(제품 분석 단일 테이블, R-18, D-005). 외부 분석 SDK를 MVP에서 쓰지 않는다. `feedback_events` 테이블은 두지 않는다(편집 신호는 `events` + `mockup_versions`).
- 이벤트 이름의 단일 원천은 이 절 §8.3 레지스트리(R-23)이며, zod 원본은 `@tastefit/api-contract` 패키지에 둔다(06장 D-0601). 07장의 이벤트명(`result_viewed` 등)은 이 레지스트리 이름으로 읽는다.
- 트렌드 집계에는 MVP 동안 이벤트(사용자 로그)를 쓰지 않는다(R-35).
- **권위 이벤트는 서버에서 기록**한다(생성·선택·내보내기·공유·채택·로그인). 클라이언트 이벤트는 화면 노출·클릭에 한정한다.
- 개인정보 최소화: 이벤트 `props`에 브랜드 입력 원문, 이메일, 자유 텍스트, IP 원문을 넣지 않는다. IP는 원문을 어디에도 저장하지 않고 레이트리밋·신고·동의 기록에서 `ip_hmac`(HMAC-SHA256)으로만 다루며, 이벤트에는 넣지 않는다(→ 06장 6.10.1, 08장).
- 중복 제거: 클라이언트가 `event_id`(UUID v4)를 생성, 서버는 `ON CONFLICT (event_id) DO NOTHING`.
- 알 수 없는 이벤트명·스키마 불일치 이벤트는 저장하지 않고 400을 반환하며 `event_rejects` 카운터만 증가시킨다.

### 8.2 테이블 스키마

```sql
create table events (                 -- DDL 원본은 06장 6.3.3(동일)
  event_id      uuid primary key,
  name          text not null,                 -- §8.3 레지스트리의 이름만 허용
  ts            timestamptz not null,          -- 서버 수신 시각(클라이언트 시각은 props.client_ts)
  anon_id       text not null,                 -- httpOnly 쿠키 anon_id (→ 06장)
  user_id       uuid null references users(id) on delete set null,
  session_id    text not null,                 -- 브라우저 탭 세션(30분 무활동 시 갱신)
  source        text not null check (source in ('client','server')),
  app_version   text not null,                 -- git short sha
  taxonomy_version text not null,              -- 시즌/택소노미 버전 (→ 02, 05장)
  device        text not null check (device in ('mobile','tablet','desktop')),
  referrer_host text null,
  utm           jsonb null,                    -- {source, medium, campaign}
  is_internal   boolean not null default false,
  props         jsonb not null default '{}'
);
create index on events (name, ts);
create index on events (user_id, ts);
create index on events (anon_id, ts);
```

- 기기 판별: 뷰포트 너비 < 768 → mobile, 768~1023 → tablet, ≥1024 → desktop(클라이언트가 계산, 서버 이벤트는 요청 헤더 기반 동일 규칙).
- 보관: 이벤트 원본 보관 기간·탈퇴 시 처리는 08장 보관 기간표를 따른다. 제안값은 D-006.
- 수집 API: `POST /api/events` 요청 본문 `{events: Event[]}`(1~20개), 응답 `204`. 클라이언트는 `navigator.sendBeacon` 우선. 레이트 리밋 anon_id당 분당 120개.

### 8.3 이벤트 레지스트리(MVP)

공통 필드는 §8.2 컬럼. 아래는 `props` 스키마(zod로 정의, → `@tastefit/api-contract`).

| 이벤트 | source | props | 사용 지표 |
|---|---|---|---|
| `landing_view` | client | `{ path }` | F1 |
| `survey_start` | server | `{ survey_session_id, entry: 'landing'\|'share'\|'retest'\|'direct', is_resume: bool }` | F1, F2, F11 |
| `survey_answer` | server | `{ survey_session_id, stage: 1\|2, seq, item_id, shown_option_ids: string[], answer: 'option'\|'none_of_these'\|'cant_tell', chosen_option_id?: string, latency_ms, sigma_max_after }` + 01장 D-0106 확장 `{ chosen_position, viewport_class, viewed_option_ids, zoomed_option_ids, descriptions_shown, revised, failed_option_ids }` | 02장 문항 품질, UX-13 |
| `survey_exit` | client | `{ survey_session_id, seq, stage }` (01장 D-0106, R-23) | F12 |
| `survey_back` | server | `{ survey_session_id, from_seq }` | 02장 |
| `survey_complete` | server | `{ survey_session_id, n_questions, duration_s, early_stop: bool, n_none, n_cant_tell }` | F2, F3, Q4 |
| `result_view` | client | `{ result_id, type_id: 'T1'..'T8', is_boundary: bool, is_shared_view: bool }` | F4, F5, F7 |
| `result_rating` | server | `{ result_id, score: 1..5 }` | F4, A1 |
| `result_share` | client | `{ result_id, channel: 'link_copy'\|'image_save'\|'web_share' }` | F5, A4 |
| `guide_copy` | client | `{ result_id, field: 'fonts'\|'palette'\|'radius'\|'all' }` | V4 |
| `share_page_view` | server | `{ target_type: 'result'\|'mockup', share_id }` | 획득 루프 |
| `login_prompt_view` | client | `{ trigger: 'generate'\|'save'\|'export'\|'history' }` | F6, A6 |
| `login_success` | server | `{ provider: 'email'\|'google', is_new_user: bool, merged_anon: bool }` | F6 |
| `generate_request` | server | `{ job_id, project_id, purpose: 'saas'\|'portfolio'\|'local_business', result_id, quota_remaining_day, quota_remaining_month, queue_position }` | F7, F11 |
| `generate_rejected` | server | `{ stage: 'project'\|'generation', code: 'RATE_LIMITED'\|'QUOTA_DAY'\|'QUOTA_MONTH'\|'GEN_BUDGET_EXCEEDED'\|'GEN_DISABLED'\|'JOB_IN_PROGRESS'\|'INVITE_REQUIRED'\|'CONSENT_REQUIRED'\|'ACCOUNT_SUSPENDED'\|'PROJECT_LIMIT'\|'BLOCKED_BRAND'\|'BRAND_ATTESTATION_REQUIRED', reason?: 'high_risk'\|'phishing_term' }` — 코드 값은 06장 6.4.2(R-13). `stage='project'`는 `POST /api/projects` 거부 | GR-2, 운영 |
| `generate_complete` | server | `{ job_id, status: 'succeeded'\|'partial'\|'fallback'\|'failed', n_shown, n_real, variants_shown: ('v_true'\|'v_fit'\|'v_bal')[], first_shown_ms, duration_ms, cost_usd, error_code?, regenerated: bool, quota_refunded: bool }` — `canceled`는 이벤트 없음(06장 6.2.3) | F8, Q5, Q6, GR-1, GR-4, GR-5 |
| `mockup_view` | client | `{ job_id, mockup_id, variant: 'v_true'\|'v_fit'\|'v_bal' }` | 퍼널 보조 |
| `mockup_select` | server | `{ job_id, mockup_id, variant, is_fallback }` | F8, F9 |
| `mockup_edit` | server | `{ mockup_id, kind: 'step'\|'candidate'\|'section_order'\|'section_hide'\|'text'\|'undo'\|'redo', target }` | F10 |
| `export_complete` | server | `{ mockup_id, format: 'html_zip'\|'react_zip'\|'dtcg_json', bytes, duration_ms }` | WAM, V3 |
| `export_failed` | server | `{ mockup_id, format, error_code }` | 운영 |
| `share_link_enable` / `share_link_disable` | server | `{ target_type, target_id, share_id }` | WAM, GR-7 |
| `mockup_adopted` | server | `{ mockup_id, via: 'export'\|'share', format?, is_fallback, variant }` | **WAM**, F9, GR-9 |
| `mockup_feedback` | server | `{ mockup_id, rating: 'up'\|'down', reason?: 'ai_feel'\|'not_my_taste'\|'broken_layout'\|'bad_copy'\|'other' }` | Q7, GR-8 |
| `paywall_view` | client | `{ placement: 'quota_day'\|'quota_month'\|'pricing' }` | A7 |
| `paywall_interest` | server | `{ placement }` | A7, Q8 |
| `report_submit` | server | `{ target_type, reason: 'impersonation'\|'phishing'\|'copyright'\|'trademark'\|'inappropriate'\|'other' }` | GR-7 |
| `account_delete` | server | `{}` (user_id는 기록 직후 비식별화 대상) | 운영 |
| `ui_error_shown` | client | `{ code, screen: 'S01'..'S15' }` (01장 D-0106, R-23) | 운영 |

- 잡 상태 판정(R-15): 비폴백 노출 3 = `succeeded`, 1~2 = `partial`(누락 변형은 폴백으로 채움), 0이면서 폴백 노출 ≥ 1 = `fallback`, 노출 0 = `failed`. 상태 머신 원본은 06장 6.2.3(IF-03).
- `mockup_adopted` 생성 규칙(의사코드):

```ts
// export_complete 또는 share_link_enable(target_type='mockup') 처리 트랜잭션 안에서 (06장 서버 함수 mark_adopted)
const updated = await db.mockups.update({
  where: { id: mockupId, adopted_at: null },
  data:  { adopted_at: now(), adopted_via: via },
});
if (updated.count === 1) emitServerEvent('mockup_adopted', { mockup_id: mockupId, via, format, is_fallback, variant });
```

### 8.4 주체 식별·병합 규칙

- 퍼널 주체 키 `actor = coalesce(user_id::text, anon_id)`. 로그인 시 `login_success` 이후 같은 `anon_id`의 과거 이벤트는 `user_id`를 **갱신하지 않고**, 분석 쿼리에서 `identity_links(anon_id, user_id, linked_at)` 테이블로 병합한다.
- 한 `anon_id`가 여러 `user_id`에 연결되면 최초 연결만 사용한다.

### 8.5 KPI 계산 쿼리(정의 기준)

```sql
-- 공통: 내부 계정 제외, 주체 병합
create view ev as
select e.*, coalesce(e.user_id::text, il.user_id::text, e.anon_id) as actor
from events e left join identity_links il on il.anon_id = e.anon_id
where e.is_internal = false;

-- North Star: 주간 채택 시안 수 (KST ISO 주)
select date_trunc('week', ts at time zone 'Asia/Seoul') as week_kst,
       count(distinct props->>'mockup_id') as wam,
       count(distinct props->>'mockup_id') filter (where (props->>'is_fallback')::bool) as wam_fallback
from ev where name = 'mockup_adopted'
group by 1 order by 1;

-- 퍼널(기간 :from ~ :to) F1~F7: 고유 actor 기준 단계 도달
with s as (
  select actor,
    bool_or(name='landing_view')      as landing,
    bool_or(name='survey_start')      as started,
    bool_or(name='survey_complete')   as completed,
    bool_or(name='result_view')       as result,
    bool_or(name='result_share')      as shared,
    bool_or(name='login_prompt_view') as prompted,
    bool_or(name='login_success')     as logged_in,
    bool_or(name='generate_request')  as generated
  from ev where ts >= :from and ts < :to group by actor)
select
  avg(started::int)   filter (where landing)   as f1_start_rate,
  avg(completed::int) filter (where started)   as f2_complete_rate,
  avg(shared::int)    filter (where result)    as f5_share_rate,
  avg(logged_in::int) filter (where prompted)  as f6_login_rate,
  avg(generated::int) filter (where result)    as f7_generate_rate
from s;

-- F3 진단 소요 중앙값
select percentile_cont(0.5) within group (order by (props->>'duration_s')::int)
from ev where name='survey_complete' and ts >= :from and ts < :to;

-- F4 결과 공감
select avg(((props->>'score')::int >= 4)::int) as f4_top2, avg((props->>'score')::int) as f4_mean
from ev where name='result_rating' and ts >= :from and ts < :to;

-- F8 시안 선택률 (잡 단위), F9 채택률 (시안 단위)
select
  (select count(distinct props->>'job_id') from ev where name='mockup_select' and ts>=:from and ts<:to)::float
  / nullif((select count(*) from ev where name='generate_complete'
            and props->>'status' in ('succeeded','partial','fallback') and ts>=:from and ts<:to),0) as f8,
  (select count(distinct props->>'mockup_id') from ev where name='mockup_adopted' and ts>=:from and ts<:to)::float
  / nullif((select count(distinct props->>'mockup_id') from ev where name='mockup_select' and ts>=:from and ts<:to),0) as f9;

-- Q5/Q6/GR-4/GR-5 생성 품질
select avg((props->>'status' in ('succeeded','partial'))::int) as q5_success,
       avg((props->>'status' = 'succeeded')::int) as q6_full3,
       percentile_cont(0.5)  within group (order by (props->>'first_shown_ms')::int) as first_p50_ms,
       avg((props->>'status' = 'failed')::int) as g5_fail,
       percentile_cont(0.5)  within group (order by (props->>'duration_ms')::int) as p50_ms,
       percentile_cont(0.95) within group (order by (props->>'duration_ms')::int) as p95_ms,
       max((props->>'cost_usd')::numeric) as max_cost
from ev where name='generate_complete' and ts >= :from and ts < :to;

-- F11 D14 리텐션: 첫 생성 후 1~14일 내 재활동
with first_gen as (select actor, min(ts) t0 from ev where name='generate_request' group by actor)
select avg(exists(select 1 from ev e2 where e2.actor=f.actor
         and e2.name in ('generate_request','mockup_edit','survey_start')
         and e2.ts >= f.t0 + interval '1 day' and e2.ts < f.t0 + interval '15 day')::int)
from first_gen f where f.t0 < now() - interval '15 day';
```

- Q4 재검사 일치율: 같은 actor의 `survey_complete` 2건 중 간격 6~14일 쌍에서 `survey_results.type_id` 일치(경계 결과는 `type_id_second` 포함, 06장 DDL·02장 2.16.3, IF-05).

### 8.6 수용 기준

- **AC-00-09**: E2E 핵심 경로 1회 실행 시 다음 12개 이벤트가 정확히 1회 이상 `events`에 저장된다: `landing_view`, `survey_start`, `survey_answer`, `survey_complete`, `result_view`, `login_prompt_view`, `login_success`, `generate_request`, `generate_complete`, `mockup_select`, `export_complete`, `mockup_adopted`.
- **AC-00-10**: 같은 시안을 두 번 내보내고 공유 링크를 켜도 `mockup_adopted`는 1건이다(통합 테스트).
- **AC-00-11**: `events.props` 전체에서 브랜드 입력 필드 값(픽스처의 브랜드명·소개 문자열)이 0건 검색된다(통합 테스트).
- **AC-00-12**: 레지스트리에 없는 이벤트명 또는 props 스키마 위반 요청은 400을 반환하고 저장되지 않는다.
- **AC-00-13**: §8.5의 모든 쿼리가 픽스처(사용자 10명 시나리오)에서 사전 계산한 기대값과 일치한다.

---

## 9. 단위 원가·사용량 한도·킬 스위치

### 9.1 단위 원가 모델

```
잡 원가(USD) C_job = Σ_llm_calls (tokens_in × p_in(model) + tokens_out × p_out(model)) / 1e6
                     + C_render
  p_in, p_out : models.yaml의 모델별 단가(USD / 1M tokens). 공급자 공시 단가를 출시 전 확인해 기록
  C_render    : 워커 고정비를 잡 수로 배분한 값. 계산은 월말 1회: (월 워커 비용) / (월 잡 수). 잡 단위 가드에는 포함하지 않음
상한: C_job(LLM 부분) ≤ US$0.30 (D-24)
```

| 단계(→ 04장) | 원가 예산 배분(잡당, LLM 부분) | 비고 |
|---|---|---|
| 후보 생성 6회 | ≤ US$0.18 | 1차 생성 |
| 재생성(최대 1회, 하드 게이트 실패 후보만) | ≤ US$0.08 | 남은 예산 내에서만 |
| 비전 채점 `judge_vision`(MVP 기록 전용 `JUDGE_VISION_MODE=log`, 생성 모델과 다른 계열·위치 교환 2회, R-12·R-37) | ≤ US$0.04 | `off`이면 0. 예산 부족 시 가장 먼저 생략 |
| **합계 상한** | **≤ US$0.30** | 초과 금지 |

- models.yaml 역할(R-12): `gen_layout`, `gen_copy`(후보 생성·재생성), `judge_vision`(비전 채점), `ref_tagger`(레퍼런스 태깅, 사용자 잡 원가에 포함 안 함). 단계별 토큰 상한(호출당 입력·출력)은 이 예산과 models.yaml 단가에서 04장이 역산해 정한다. 04장은 "선택한 모델 단가 기준 최악 경우 원가 ≤ US$0.30" 계산표를 포함해야 한다(IF-01).

### 9.2 잡 내 원가 가드(런타임)

```ts
// 각 LLM 호출 직전 (워커)
const worst = estimateWorstCost(call.model, call.maxInputTokens, call.maxOutputTokens); // models.yaml 단가
if (job.costUsd + worst > JOB_COST_CAP_USD /* 0.30 */) {
  skipRemainingLlmSteps(job, 'COST_CAP');   // 이미 확보된 후보로 점수·노출 진행
  // 노출 가능 후보 0개면 결정론적 폴백 시안(D-23)
}
// 호출 직후
job.costUsd += actualCost(call.usage);
recordLlmCall(...);                            // llm_calls.cost_usd (→ 06장)
```

- **AC-00-14**: MockProvider에 "호출당 원가 US$0.06" 설정으로 생성 시, 누적 US$0.30을 넘는 호출이 0건이고 잡은 `partial` 또는 `fallback`으로 완료된다.

### 9.3 사용량 한도(MVP 무료)

생성 한도(quota)와 동시성은 이 표가 원천이고, **빈도 레이트리밋 값의 단일 원천은 06장 6.10.1(06장 D-0618, R-31)**이다. 아래 레이트리밋 행은 06장 값을 옮겨 적은 참고이며 다르면 06장을 따른다. 오류 코드는 06장 6.4.2(R-13).

| 대상 | 한도 | 초과 시 응답 | 원천 |
|---|---|---|---|
| 생성 요청(quota) | 계정당 **3회/일**(KST 00:00 리셋), **15회/월**(매월 1일 KST 리셋). `users.quota_*_override` 우선 | 429 `QUOTA_DAY` / `QUOTA_MONTH` + `resetAt` + 페이크 도어(`paywall_view`) | 이 장. 운영자 상향 ADM-06 |
| 사용자당 진행 중 잡 | 1개 | 409 `JOB_IN_PROGRESS` + 기존 `jobId` | 이 장(R-16) |
| 전역 동시 실행 잡 | `GEN_MAX_CONCURRENT_JOBS=5`. 초과 요청은 대기열(`queued`)에 넣고 대기 순번(`queuePosition`)을 S07에 표시. Chromium 컨텍스트는 머신당 3 | 거부 없음(대기) | R-16, 06장 D-0604 |
| 시안 프로젝트 보유 | 계정당 10개 | 409 `PROJECT_LIMIT` + "오래된 프로젝트 삭제" 안내 | 이 장 |
| 생성 요청 빈도 | 계정 2회/분, IP 5회/분 | 429 `RATE_LIMITED` + `Retry-After` | 06장 6.10.1 |
| 진단 세션 생성 / 응답 | IP 20회/일 / 세션 120회/분 | 429 `RATE_LIMITED` | 06장 6.10.1 |
| 프로젝트 생성 · 버전 저장 · 공유 생성 | 30회/일 · 30회/분 · 30회/일 | 429 | 06장 D-0618 |
| 내보내기 | 계정 30회/시간 | 429 `RATE_LIMITED` | 06장 6.10.1 |
| 신고·문의·권리 요청 | anon_id 5회/시간 | 429 | 06장 6.10.1 |
| 매직링크·가입 | IP 10회/일 + Cloudflare Turnstile(R-29) | 429 | 06장 6.10.1 |

**한도 차감·복구 규칙**

| 잡 결과 | 일·월 한도 차감 |
|---|---|
| `succeeded`, `partial` (비폴백 시안 ≥ 1개 노출) | 차감 |
| `fallback` (폴백 시안만 노출) | **복구**(차감 취소) |
| `failed`, `queued`에서 취소 | **복구** |
| `running`에서 취소 | 차감(이미 원가 발생, 06장 6.2.3) |
| 킬 스위치·예산 초과로 접수 거부 | 차감 안 함(잡 미생성) |

- 판정 기준은 R-15(비폴백 노출 수). 차감 시점: 잡 생성 시 예약 차감(`quota_ledger`, `unique(job_id, kind)`, DDL → 06장), 완료 시 위 표에 따라 `refund` 기록. 잔여 한도 = 한도 − (reserve − refund) 건수.
- **AC-00-15**: 같은 날 4번째 생성 요청은 429 `QUOTA_DAY`를 반환하고 `generate_rejected` 이벤트가 기록된다.
- **AC-00-16**: 모델 오류를 주입해 `failed`로 끝난 잡은 잔여 한도를 줄이지 않는다(통합 테스트).

### 9.4 예산 상한과 킬 스위치

**설정값(환경변수 기본값, 어드민에서 런타임 변경 가능 → `feature_flags` 테이블이 우선). 키 이름은 전 장 공통(R-22), 타입·범위는 06장 6.10.4**

| 키 | 기본값 | 의미 |
|---|---|---|
| `JOB_COST_CAP_USD` | 0.30 | 잡당 LLM 원가 상한 (D-24, 하향만 허용) |
| `GEN_DAILY_BUDGET_USD` | 10 | 일 LLM 지출 상한(KST 일) |
| `GEN_MONTHLY_BUDGET_USD` | 150 | 월 LLM 지출 상한 |
| `GEN_ENABLED` | true | 신규 생성 전체 on/off |
| `SIGNUP_ENABLED` | true | 신규 가입 on/off(기존 회원 로그인은 허용) |
| `SHARE_PUBLIC_ENABLED` | true | 공개 공유 페이지 노출 on/off |
| `BETA_INVITE_ONLY` | true (비공개 베타), false (공개 출시) | 초대 코드 보유자만 생성(미보유 403 `INVITE_REQUIRED`) |
| `GEN_MAX_CONCURRENT_JOBS` | 5 | **전역** 동시 실행 잡 수(R-16, 06장 D-0604). 사용자당 1은 고정 규칙 |
| `JUDGE_VISION_MODE` | `log` | `off`\|`log`\|`rank`. MVP는 `log`(기록 전용), `rank`는 Phase 2(R-12, 06장 D-0616) |

- 근거(가설): 비공개 베타 예상 생성 = 초대 사용자 ≤ 50명 × 평균 2.5회 ≈ 125회/4주, 일 피크 30회 × US$0.30 = US$9 → 일 상한 US$10. 월 상한 = 공개 출시 예상 월 생성 500회 × US$0.30 = US$150. staging 환경 live 일 예산은 US$2(06장 D-0607).

**킬 스위치 동작**

| ID | 발동 조건 | 자동/수동 | 동작 | 해제 |
|---|---|---|---|---|
| KS-1 예산 | 당일 누적 LLM 원가 ≥ `GEN_DAILY_BUDGET_USD` 또는 월 누적 ≥ `GEN_MONTHLY_BUDGET_USD` | 자동 | 신규 생성 API → 503 `GEN_BUDGET_EXCEEDED`(잡 생성 시 `spend + 0.30 > 상한`이면 거부), UI 문구 → 01장. **진행 중 잡은 끝까지 수행**하되 호출 직전 일 상한 검사가 실패하면 남은 LLM 호출을 생략하고 폴백으로 마무리(초과 원가 ≤ 진행 중 잡 수 × US$0.30, 06장 6.10.3). 진단·결과·편집·내보내기는 정상 | 일 상한: 다음 KST 00:00 자동. 월 상한: 다음 달 1일 자동 또는 운영자 상향 |
| KS-2 생성 중단 | 운영자 토글 `GEN_ENABLED=false`(장애·악용·공급자 사고) | 수동 | 신규 생성 503 `GEN_DISABLED`, 대기 중(`queued`) 잡은 `failed(GEN_DISABLED)` + 한도 복구 | 운영자 토글 |
| KS-3 공유 차단 | 운영자 토글 `SHARE_PUBLIC_ENABLED=false`(대량 악용 신고) | 수동 | `/r/*`, `/p/*` 모두 503 `SHARE_DISABLED` 안내 페이지(S15), 새 공유 링크 생성 비활성 | 운영자 토글 |
| KS-4 가입 차단 | 운영자 토글 `SIGNUP_ENABLED=false`(봇 가입 폭주) | 수동 | 신규 가입 시 503 `SIGNUP_DISABLED`, "현재 신규 가입을 일시 중단했어요" | 운영자 토글 |

**경보**

규칙 ID·평가 주기·중복 억제는 06장 6.12.4(A1~A11)가 원천이다. 제품 수준 필수 경보:

| 조건 | 06장 규칙 | 채널 |
|---|---|---|
| 일 예산 50%, **80%**(R-22 필수), 100% / 월 예산 80%, 100% | A1 | `ALERT_WEBHOOK_URL` + 운영자 이메일 |
| 1시간 생성 실패율 > 10%, 3안 노출 p95 > 90초 / fallback 비율 > 30% | A2 / A3 | 웹훅 |
| 단일 계정이 일 예산의 20% 이상 소비 | A4 | 웹훅(악용 의심) |
| 신고로 인한 자동 비공개 발생 | A7 | 웹훅 |
| 권리 요청 기한 24시간 이내 미완료 | A10 | 웹훅 |

- 예산 집계 원천: `llm_calls.cost_usd` 합계(KST 기준). 캐시 허용 지연 ≤ 60초.
- **AC-00-17**: `GEN_DAILY_BUDGET_USD=0.5`로 설정 후 생성 요청을 반복하면, 누적 원가가 0.5 이상이 된 뒤의 신규 요청이 503 `GEN_BUDGET_EXCEEDED`를 반환하고 진행 중이던 잡은 정상 완료된다.
- **AC-00-18**: 어드민에서 `GEN_ENABLED=false`로 바꾸면 60초 안에 신규 생성 요청이 503 `GEN_DISABLED`를 반환한다.

### 9.5 어뷰징 대응(요약 — 세부 → 06·08장)

| 위협 | MVP 대응 | 상세 |
|---|---|---|
| 생성 비용 남용 | 로그인 필수(D-41), §9.3 한도, 동시 1잡, Idempotency-Key | 06장 |
| 봇 가입 | 매직링크·Google만, 매직링크 요청에 Cloudflare Turnstile(R-29), `SIGNUP_ENABLED` 킬 스위치, IP당 10회/일 | 06장 |
| 사칭·피싱 페이지 생성 | 프로젝트 생성 시 422 `BLOCKED_BRAND`(`reason: high_risk`\|`phishing_term`), 레퍼런스 사이트명 일치 시 422 `BRAND_ATTESTATION_REQUIRED`(R-13), 고위험 브랜드 목록 ADM-10 관리, 로그인·결제 폼 블록 미제공, 신고 시 자동 비공개(§10.3) | 04, 08장 8.9 |
| 프롬프트 인젝션·XSS | 입력 정규화·데이터 블록 전달(D-43), LLM은 JSON만(D-21), 생성 HTML 스크립트 0·`sandbox=""` 미리보기(R-17) | 04, 06장 6.11 |

### 9.6 페이크 도어(지불 의향, A7)

- 노출 위치: ① 일·월 한도 도달 응답 화면 ② 푸터 "요금 안내" 페이지(S14 `/pricing`, "지금은 무료 베타입니다" + 가상 플랜 1개: "프로 — 생성 월 100회, 우선 처리. 출시 알림 받기").
- 버튼 클릭 시 `paywall_interest` 기록 + "출시되면 이메일로 알려드릴게요" 확인. 로그인 사용자는 계정 이메일 사용, 마케팅 수신 동의(선택)를 별도로 받는다(→ 08장). 가격 숫자를 표시하지 않는다(D-007).

---

## 10. 운영

### 10.1 어드민 기능 목록 (`/admin`)

- 접근: `users.role = 'admin'`인 로그인 계정만(API 경로 → 06장 6.4.3 관리자 표). 최초 admin은 환경변수 `ADMIN_EMAILS`(쉼표 구분)로 부여. 미들웨어에서 서버측 검사, 실패 시 404(존재 은닉).
- 감사 로그: 모든 변경 작업은 `admin_audit_logs`(R-18, DDL → 06장 6.3.3: `id, admin_hash, action, target_type, target_id, before, after, ip_hmac, created_at`)에 기록. 삭제 불가(append-only, RLS로 update/delete 금지).
- 대상 표기: 운영자. UI는 서비스 디자인 시스템을 쓰되 밀도 높은 표 레이아웃 허용(→ 01장).

| ID | 메뉴 | 기능 | 입력/출력 | 단계 |
|---|---|---|---|---|
| ADM-01 | KPI 대시보드 | §6의 WAM·퍼널·품질·가드레일 지표 일/주 표, 기간 선택 | 출력: 지표 표 + CSV 다운로드 | [P0] |
| ADM-02 | 비용·킬 스위치 | 오늘/이번 달 LLM 원가, 상한 대비 %, 계정별 원가 상위 20, `feature_flags` 편집 | 입력: 플래그 값 / 출력: 즉시 반영(≤60초) | [P0] |
| ADM-03 | 생성 모니터 | 최근 잡 목록(상태 R-15, 대기 순번, 소요·첫 노출 시간, 원가, 잡 오류 코드, 모델·프롬프트 버전), 잡 상세(후보별 점수·하드 게이트 G-01~G-12 결과·비전 채점 기록값·스크린샷) | 필터: 상태·기간·오류 코드 | [P0] |
| ADM-04 | 신고 큐 | §10.3 신고 목록, 대상 미리보기, 조치(유지·비공개·삭제·계정 정지) | 출력: 처리 상태·처리 시각 | [P0] |
| ADM-05 | 문의 큐 | §10.2 문의 목록, 상태 변경, 답장은 외부 메일로(답장 시각 수동 기록) | 출력: 첫 응답 경과 시간 | [P0] |
| ADM-06 | 사용자 | 이메일 검색, 프로젝트·잡·한도 조회, 한도 상향(일·월, 사유 필수), 계정 정지/해제, 데이터 삭제 실행 | 삭제는 확인 문구 입력 필요 | [P0] |
| ADM-07 | 레퍼런스 | 시드 60개(`reference_sites`, R-18) 목록·상태·라벨 편집, opt-out 처리(비활성 + 파생값 삭제, 05장 5.13.3 절차) | → 05장 데이터 스키마 | [P0] |
| ADM-08 | 유형·프리셋·자극물 | 유형 `T1`~`T8` 텍스트(02장 원천)·앵커 프리셋 `PS-T1`~`PS-T8`(03장 원천) 조회(편집 불가, 데이터 파일 원천), 자극물 이미지별 노출 수·선택률·"모르겠어요" 비율, 문항 비활성 토글 | 편집 범위 → 02, 03장 | [P0] |
| ADM-09 | 평가 세션 | 07장 7.8 프로토콜(P-1~P-5) 세트 등록·결과 집계(`eval_sets`·`eval_judgments`). 평가 페이지 생성은 `pnpm eval:blind:pack` | 출력: 비율·Wilson 95% 구간·합격 판정 | [P0] |
| ADM-10 | 고위험 브랜드 목록 | `blocked_brands`(canonical·aliases·category·domains) 추가·삭제(초기 `config/high_risk_brands.json`), `BLOCKED_BRAND` 거부 로그 조회 | 매칭 규칙 → 08장 8.9.2 | [P0] |
| ADM-11 | 권리자·삭제 요청 | `rights_requests`(R-18, type: `optout_domain`·`copyright_claim`·`trademark_claim`·`privacy_request`·`abuse_report`) 목록, `due_at` 기한 표시 | §10.4 | [P0] |
| ADM-12 | 초대 코드 | 베타 초대 코드 발급(최대 사용 수·만료일), 사용 현황 | | [P0] |
| ADM-13 | 감사 로그 | `admin_audit_logs` 조회(읽기 전용) | | [P0] |
| — | 트렌드 대시보드, 자동 수집 검수 큐 | | | [P2] |
| — | 자체 헬프데스크(메일 연동) | | | [P2] |

- **AC-00-19**: role이 admin이 아닌 계정으로 `/admin/*` 및 `/api/admin/*` 접근 시 404를 반환한다(통합 테스트, 모든 라우트 열거).
- **AC-00-20**: ADM-02·ADM-04·ADM-06·ADM-07·ADM-10의 모든 변경 작업 1회당 `admin_audit_logs`가 정확히 1행 증가하며 before/after가 채워진다.

### 10.2 CS(문의) 처리

| 항목 | 규칙 |
|---|---|
| 채널 | 서비스 내 문의 폼 단일 채널(S14 `/support`, 모든 페이지 푸터 링크, `POST /api/support`). 운영 이메일 주소는 처리방침에 공개(→ 08장) |
| 입력 | `category: 'account'\|'generation'\|'export'\|'privacy'\|'rights'\|'bug'\|'other'`, `email`(로그인 시 자동), `body` 10~2,000자, 선택 첨부 없음(MVP) |
| 저장 | `support_tickets`(DDL → 06장: `id, user_id?, anon_id?, email, category, body, status: 'open'\|'answered'\|'closed', created_at, first_response_at, closed_at`) + 운영자에게 웹훅 알림 |
| 응답 목표(SLA) | 첫 응답 영업일 3일 이내(사이트에 명시). `privacy` 카테고리는 법정 기한 내 처리(기한 값은 08장, 출시 전 원문 확인). `rights`는 §10.4 |
| 자동 응답 | 접수 즉시 화면에 "접수 번호, 예상 응답 기한" 표시(이메일 자동 발송은 [P2]) |
| FAQ(MVP 6문항) | ① 생성물을 상업적으로 써도 되나요 ② 하루 몇 번 만들 수 있나요 ③ 내 데이터는 얼마나 보관되나요 ④ 진단은 어떻게 작동하나요 ⑤ AI가 만든 결과물인가요(AI 생성 고지) ⑥ 문의·삭제 요청은 어떻게 하나요. 답변 문안 → 01장(카피), 법무 문구 → 08장 |
| 시안 피드백 | 각 시안에 좋아요/싫어요 + 싫어요 사유(enum: `ai_feel`, `not_my_taste`, `broken_layout`, `bad_copy`, `other`) |

- **AC-00-21**: 문의 제출 시 `support_tickets` 1행 생성, 웹훅 1회 호출, 화면에 접수 번호가 표시된다. `first_response_at`이 null이고 접수 후 영업일 3일이 지난 문의는 ADM-05에서 "기한 초과"로 표시된다.

### 10.3 신고 처리

| 항목 | 규칙 |
|---|---|
| 대상 | 공개 결과 페이지 S03 `/r/[shareId]`, 공개 시안 페이지 S13 `/p/[shareId]` (로그인 불필요, `POST /api/share/:shareId/report`) |
| 사유 enum(08장 8.9.5, 06장 D-0612) | `impersonation`(사칭), `phishing`(피싱), `copyright`(저작권), `trademark`(상표), `inappropriate`(불법·유해), `other` |
| 저장 | `reports`(DDL → 06장: `share_id, reason, details ≤1000, reporter_anon_id, reporter_user_id?, reporter_email?, ip_hmac, status: 'open'\|'hidden'\|'dismissed'\|'actioned', handled_by, handled_at, created_at`) |
| 자동 비공개 | ① `reason ∈ {impersonation, phishing}` 신고 1건 → **즉시** 비공개 ② 사유와 관계없이 같은 공유 링크에 서로 다른 `ip_hmac` 신고 3건 이상 → 즉시 비공개(08장 8.9.5). 비공개된 링크는 410 `SHARE_HIDDEN`(R-13) + S15 "신고로 검토 중인 페이지입니다". `share_links.hidden_reason='report_auto'` |
| 운영자 처리 SLA | 모든 사유 접수 후 24시간 안에 판단(LG-13). 자동 비공개되지 않은 신고는 검토 중 공개 유지. 조치: `dismissed`(재공개) / `actioned`(공유 해제 + 필요 시 시안 삭제·계정 정지 `users.status`) |
| 소유자 통지 | `actioned`·`hidden` 시 소유자 계정 이메일로 사유 통지(수동 발송, 템플릿 → 08장) |
| 이의 제기 | 소유자는 문의 폼(`rights` 또는 `other`)으로 이의 제기, 운영자 7일 안에 재검토 |

- **AC-00-22**: `impersonation` 또는 `phishing` 신고 1건 제출 직후 해당 공유 URL이 410 `SHARE_HIDDEN`을 반환한다. `copyright` 신고 2건(서로 다른 `ip_hmac`)은 공개 유지, 3건째에 410이 된다.

### 10.4 삭제 요청 처리

| 요청 유형 | 경로 | 처리 | 기한 |
|---|---|---|---|
| 회원 탈퇴·전체 삭제 | S12 계정 "탈퇴 및 데이터 삭제"(셀프, `DELETE /api/me`) | 즉시 로그인 차단·공유 링크 비공개, 원본 데이터 파기와 이벤트 비식별화는 08장 보관 기간표 기준 | 08장 |
| 익명 진단 결과 삭제 | 결과 화면 S03 "이 결과 삭제"(셀프, `DELETE /api/surveys/:id`, anon_id 쿠키 소유 검증) | 즉시 원본 삭제, 공유 링크 404 | 즉시 |
| 개별 시안·프로젝트 삭제 | S12 "내 기록"에서 삭제(셀프, `DELETE /api/projects/:id`) | 즉시 삭제, 공유 링크 404, 내보내기 파일 스토리지 삭제 | 즉시 |
| 개인정보 열람·정정·삭제 요구(셀프 불가 사항) | 문의 폼 `privacy` → `rights_requests(type='privacy_request')` | 본인 확인(계정 이메일 회신) 후 ADM-06으로 처리 | `due_at` +10일(06장 DDL, 법정 기한 출시 전 원문 확인 → 08장) |
| 레퍼런스 사이트 opt-out·권리 침해 | S14 `/sources` 양식 → `POST /api/rights-requests`(`optout_domain`·`copyright_claim`·`trademark_claim`) | ADM-11 → ADM-07에서 레퍼런스 비활성 + 파생 수치·스크린샷 삭제, "닮은 사이트" 노출 즉시 중단 | **7일 이내** (D-50, `due_at` +7일) |
| 공유 시안의 제3자 권리 침해 신고 | 신고 버튼 `copyright`·`trademark` | §10.3 | 24시간 판단 |

- **AC-00-23**: ADM-07에서 레퍼런스 1건을 opt-out 처리하면 ① 해당 레퍼런스가 "닮은 사이트" 후보에서 즉시 제외되고 ② 스크린샷 파일이 스토리지에서 삭제되며 ③ `rights_requests.status`가 `done`이 되고 `closed_at`이 기록된다.

### 10.5 1인 운영 루틴

| 주기 | 작업 | 소요 목표 | 근거 화면 |
|---|---|---|---|
| 매일 | 비용·킬 스위치 상태, 실패 잡, 신고 큐(24h SLA), 문의 기한 | ≤ 10분 | ADM-02~05 |
| 매주(월) | WAM·퍼널·가드레일 검토, 싫어요 사유 상위, 문항 품질("모르겠어요" > 30% 문항) | ≤ 60분 | ADM-01, 08 |
| 모델·프롬프트 변경 시 | 오프라인 승격 규칙(R-24): 블라인드 40쌍 승률 Wilson 하한 ≥ 0.35 + 골든 세트(32케이스) 회귀 없음 | → 06장 6.15, 07장 7.2.8 | — |
| 매월 | 수동 트렌드 리포트(D-30), 지출 정산, 보관 기간 파기 크론 결과 확인 | ≤ 4시간 | → 05, 08장 |
| 분기 | 시즌 릴리스(`YYYY-S{n}`, 분기 첫 월요일, 동결 14일 전, R-30), 고위험 브랜드 목록 갱신 | → 05장 | ADM-10 |
| 부재 대비 | 3일 이상 부재 시 `BETA_INVITE_ONLY=true` 또는 `GEN_DAILY_BUDGET_USD` 하향, 문의 SLA 안내 문구 변경 | — | ADM-02 |

---

## 11. 리스크 레지스터

ID는 `RK-nn`(decisions_v2의 `R-xx`와 구분). 점수 = 영향(1~5) × 가능성(1~5). 15 이상 = 높음(출시 전 대응 필수), 8~14 = 중간, 7 이하 = 낮음. 담당은 모두 운영자 1인.

| ID | 리스크 | 영향 | 가능성 | 점수 | 선행 지표/트리거 | 예방 | 발생 시 대응 | 관련 |
|---|---|---|---|---|---|---|---|---|
| RK-01 | 생성 품질이 기대 이하(AI 티·조화 붕괴) | 5 | 4 | 20 | Q1 Wilson 하한 < 0.60, GR-8 > 40%, GR-9 > 20% | 프리셋 스냅·린터·하드 게이트·골든 세트 회귀 | A2 실패 규칙(§5.1): Phase 2 보류, 04장 개선 집중 | 03, 04, 07 |
| RK-02 | LLM 비용 폭증(바이럴·악용) | 5 | 3 | 15 | 일 예산 80% 경보, 단일 계정 20% 경보 | §9 한도·원가 가드·KS-1, 로그인 필수 | KS-1 자동, 악용 계정 정지(ADM-06) | 06 |
| RK-03 | 진단 타당성 부족(결과 공감 낮음) | 5 | 3 | 15 | A0 시뮬레이션 미달, F4 < 55%, Q3 미달 | 02장 문항 설계, 시뮬레이션 합격선(R-05), 사전 렌더 자극물 검수 | A0·A1 실패 규칙: 02장 재설계 최우선 | 02 |
| RK-04 | 자극물 제작 병목(카드 48장 + A/B 120쌍, 기기별 2벌) | 4 | 4 | 16 | 구현 1주차 말 `pnpm survey:build` 검수 완료율 < 50% | 템플릿+토큰 자동 렌더(D-14), 고정 카피·가상 브랜드 "한결"(R-08), 채택 판정은 실측 L1 기준(R-06) | 실측 L1 미달 카드·쌍을 비활성하고 같은 기준 벡터의 다른 템플릿으로 대체(풀 축소는 02장 개정 필요) | 02, 05, 09 |
| RK-05 | 사칭·피싱 페이지 생성 악용 | 5 | 2 | 10 | `impersonation`·`phishing` 신고, `BLOCKED_BRAND` 거부 로그 급증 | 고위험 브랜드 거부, 로그인·결제 폼 블록 미제공, AUP | 즉시 비공개(§10.3), 계정 정지, KS-3 | 04, 08 |
| RK-06 | 레퍼런스 저작권·약관 분쟁, 생성물 유사성 분쟁 | 4 | 2 | 8 | 권리자 문의 | 수동 큐레이션, 3도메인 이상 집계값만(D-31), 스크린샷 비노출·90일 삭제, 원본 유사도 하드 게이트(pHash·조합 4/7·카피 8어절, R-20) | opt-out 7일 처리(§10.4), 해당 프리셋 비활성 | 05, 08 |
| RK-07 | 서체·이미지·아이콘 라이선스 위반 | 4 | 2 | 8 | 라이선스 검사 실패 | 화이트리스트(D-27), LICENSES.md 자동 포함 | 해당 자산 제거 후 재배포, 사용자 공지 | 03, 08 |
| RK-08 | 개인정보 유출·국외 이전 고지 누락 | 5 | 2 | 10 | 보안 점검 실패 | 최소 수집, 이벤트 PII 배제(AC-00-11), 처리방침 표 | 08장 사고 대응 절차 | 06, 08 |
| RK-09 | 프롬프트 인젝션·XSS로 미리보기·내보내기 오염 | 4 | 2 | 8 | 인젝션 테스트 실패 | LLM은 JSON만(D-21), 다른 등록 도메인 `sandbox=""` iframe·생성 HTML 스크립트 0·CSP(D-43, R-17) | KS-2 후 패치 | 04, 06 |
| RK-10 | LLM 공급자 단종·가격 인상·정책 변경 | 3 | 3 | 9 | 공급자 공지 | models.yaml 교체 구조, MockProvider, 오프라인 승격 규칙(R-24) | 대체 모델 골든 세트 평가 후 교체 | 06, 07 |
| RK-11 | 1인 운영 가용성(장애·부재 시 대응 지연) | 4 | 3 | 12 | 알림 미확인 > 12시간 | 자동 킬 스위치, 부재 루틴(§10.5) | 생성 중단 후 공지 | 이 장 |
| RK-12 | 로그인 벽에서 생성 전환 이탈 | 4 | 3 | 12 | F6 < 40% | 로그인 직후 입력 화면 복귀·입력값 보존(→ 01장) | A6 실패 규칙: 로그인 전 1회 체험 안건 | 01, 06 |
| RK-13 | 생성 지연 SLO 미달로 대기 이탈 | 3 | 3 | 9 | 첫 카드 p50 > 45초 또는 p95 > 90초 | 병렬 생성, 점진 노출, 120초 폴백·180초 종료(R-25), 대기 순번 표시(R-16) | 동시성 조정, 후보 수 축소 안건 | 04, 06 |
| RK-14 | 상표 표현 리스크("MBTI") | 3 | 2 | 6 | 사용자 노출 문자열 검사 실패 | D-01, grep CI(AC-00-02) | 문자열 교체 배포 | 01, 08 |
| RK-15 | 자율 구현 에이전트의 범위 이탈(Phase 2 선구현·핵심 경로 미완) | 4 | 3 | 12 | 마일스톤별 E2E 미통과 상태에서 비핵심 PR 발생 | §7.3 자율 구현 경계, 09장 마일스톤 게이트, 07장 7.12 기준 잠금(R-09) | 비핵심 변경 되돌림 | 09 |
| RK-16 | 접근성 미달(서비스 UI·생성물) | 3 | 2 | 6 | axe serious/critical > 0 | 하드 게이트 WCAG AA·axe serious/critical 0(R-28), 서비스 UI axe 검사(07장 G4) | 해당 배포 롤백 | 07, 08 |

- **AC-00-24**: 점수 15 이상 리스크(RK-01~RK-04)의 "예방" 항목이 각각 07장 출시 기준 또는 09장 마일스톤의 검증 항목으로 연결되어 있다(교차 참조 존재).

---

## 12. 용어집 (문서 전반 단일 기준)

01~09장은 아래 용어와 코드 식별자를 그대로 사용한다. 새 용어가 필요하면 해당 장의 "추가 결정"에 제안한다.

| 용어 | 코드 식별자 | 정의 | 정의 장 |
|---|---|---|---|
| 취향핏 | — | 서비스 가칭 (D-01) | 00 |
| 디자인 성향 유형(유형) | `type_id` = `T1`~`T8` (+ `slug`, 예 `calm-editorial`) | 진단 결과로 판정되는 8개 고정 유형. 이름·설명 텍스트 원천은 02장, 중심 벡터 원천은 03장 3.4.7 (D-15, R-04) | 02, 03 |
| 진단 | `survey_sessions` / `survey_answers` / `survey_results` | 1단계 4지선다 정확히 8 + 2단계 A/B 최대 8로 취향 벡터를 추정하는 과정 (D-13, R-05). 응답 테이블명은 `survey_answers`(R-18) | 02, 06 |
| 취향 벡터 | `taste_vector` | L1 축 5개의 사후분포(축별 μ, σ) (D-10, D-12) | 02 |
| L1 축 | 코드 키 `expression`, `temperature`, `shape`, `density`, `depth` | 문서 표기 A1 표현성, A2 온도, A3 형태, A4 밀도, A5 깊이. 각 [0,1] (D-10). JSON·DB·코드는 반드시 영문 키 사용(R-01) | 02 |
| L2 파라미터 | `DesignSpec.l2` (18키) | 타이포 페어링·팔레트 구조·radius 계열·depth 종류·레이아웃 패턴·이미지 스타일·모션 수준 등. 매핑표로 결정 (D-11, R-27) | 03, 04 |
| 프리셋 | `preset_id` | 검증된 L2 파라미터·토큰 값 묶음 | 03 |
| 앵커 프리셋 | `anchor_preset_id` = `PS-T1`~`PS-T8` | 유형마다 1개씩 지정된 기준 프리셋. 폴백 시안의 기반 (R-04) | 03 |
| 다른 유형 보기 | `anchor_override_type_id` | 결과 화면에서 사용자가 생성 닻 유형만 바꾸는 기능. 취향 벡터 불변 (R-36) | 01, 02 |
| 시즌 | `taxonomy_version` = 시즌 ID `YYYY-S{1..4}` | 분기 단위 택소노미·자극물 릴리스 버전(패치 `.n`). `normalizer_version` = 시즌 ID (R-30). "클래식↔트렌디"는 축이 아니라 시즌 메타데이터 | 05 |
| 자극물 | `survey_items` | 진단에 쓰는 사전 렌더 오리지널 이미지: 카드 48장(기준 벡터 16 × 템플릿 3), A/B 120쌍(수준 {0.2, 0.5, 0.8}), 기기별 2벌, 메타 `alt_text`·`dominant_colors`·`focus_region` (D-14, R-06, R-07) | 02 |
| 다 별로예요 / 차이를 모르겠어요 | `none_of_these` / `cant_tell` | 4지선다·A/B의 기권형 응답 | 02 |
| 경계 결과 | `is_boundary` | 1·2순위 유형이 경계 규칙에 걸려 "A와 B 사이"로 표기되는 결과 | 02 |
| 내 유형 디자인 가이드 | — | 결과 화면의 서체·팔레트·모서리 계열 요약 카드 (D-001) | 01 |
| 닮은 사이트 | `similar_site_candidates` 뷰 | 결과 화면에 텍스트 링크로만 노출하는 실제 사이트 3곳 + 비제휴 고지 (D-50). MVP 매칭은 L1 벡터 거리 (R-38) | 01, 05 |
| 레퍼런스(시드) | `reference_sites` | 수동 큐레이션한 실제 사이트 60개와 사람 라벨 (D-30, R-18) | 05 |
| 권리 요청 | `rights_requests` (`optout_requests`는 뷰) | opt-out·저작권·상표·개인정보·악용 신고 요청 단일 테이블 (R-18) | 08 |
| 용도 | `purpose` | `saas`, `portfolio`, `local_business`. `local` 표기 금지 (D-03, R-02) | 04 |
| 브랜드 입력 | `BrandInput` | 생성에 쓰는 사용자 입력(브랜드명·소개 등). 스키마 원천은 01장, 업로드는 MVP 제외 (R-21) | 01, 04 |
| 프로젝트 | `project` | 브랜드 입력 1개와 그로부터 생성된 잡·시안의 묶음. 계정당 10개 | 01, 06 |
| 생성 요청(잡) | `generation_jobs` | 시안 생성 1회(`POST /api/projects/:id/generations`, 202 + 폴링, R-14). 상태 `queued`·`running`·`succeeded`·`partial`·`fallback`·`failed`·`canceled` (R-15). 한도·원가 집계 단위 | 04, 06 |
| 후보 | `candidate` | 잡 1건에서 생성되는 6개의 레이아웃 트리 (D-22) | 04 |
| 시안 | `mockup` | 사용자에게 노출되는 후보. 잡당 최대 3개 | 04 |
| 변형 | `variant` | `v_true`(취향 그대로), `v_fit`(용도 최적), `v_bal`(균형). 대문자 `V-TRUE` 등은 문서 설명에서만 허용, 코드·스키마 금지 (D-20, R-03) | 04 |
| 폴백 시안 | `is_fallback` | 게이트 통과 후보가 없을 때 앵커 프리셋+표준 블록으로 결정론적으로 만든 시안 (D-23) | 04 |
| 레이아웃 트리 | `layout_tree` | LLM 출력 JSON(블록 ID, variant, 슬롯 카피, 이미지 슬롯 키) (D-21) | 04 |
| 블록 / 슬롯 | `block_id` / `slot` | 섹션 컴포넌트 단위 / 블록 안의 텍스트·이미지 자리 | 04 |
| 컴파일러 | — | 레이아웃 트리 + 토큰 → HTML/CSS·React 코드를 만드는 결정론적 서버 모듈 (D-21) | 04 |
| 디자인 토큰 | `tokens` | 색·서체·간격·radius 등 디자인 값. 내보내기 형식은 DTCG JSON (D-26). **LLM 토큰과 구분**: 과금 단위는 "LLM 토큰"으로 표기 | 03 |
| 하드 게이트 | `G-01`~`G-12` | 노출 필수 조건: 대비 WCAG AA, 넘침·겹침 0, 스키마 유효, 린터 error 0 (D-23), axe serious/critical 0 (R-28), 원본 유사도 가드 (R-20, 임계값 `config/originality.json`) | 04 |
| 출시 게이트 | `G1`~`G7` | RC·비공개 베타·공개 출시 판정 게이트 (R-32). 합격선 `config/thresholds.json` (R-09) | 07 |
| 비전 채점 | `judge_vision`, `JUDGE_VISION_MODE` | 렌더 스크린샷을 다른 계열 모델로 위치 교환 2회 채점(R-37). MVP는 기록 전용 `log` (R-12) | 04 |
| 조화 점수 / 취향 일치도 | `harmony_score` / `taste_score` | 0~100. 노출 기준 각각 ≥80 / ≥75 (D-23) | 04 |
| AI 티 린터 | `lint` | AI 생성물 특유 패턴을 규칙으로 검출하는 검사기. 서비스 UI에도 적용 (D-28) | 03, 04 |
| 스텝 컨트롤 | — | 편집 화면에서 검증된 단계 사이만 이동하는 조정 UI (D-16) | 01, 04 |
| 채택 | `adopted_at` | 시안의 최초 내보내기 성공 또는 공유 링크 공개 전환 (§6.1) | 00 |
| WAM | — | 주간 채택 시안 수, North Star (D-04) | 00 |
| 공유 링크 | `share_links.id` (`share_id`) | 결과 S03 `/r/[shareId]`(기본 공개), 시안 S13 `/p/[shareId]`(기본 비공개). 랜덤 22자(132비트). 신고·관리자 비공개 시 410 `SHARE_HIDDEN` | 01, 06 |
| 화면 ID | `S01`~`S15` | 화면·route 단일 원천 (R-19) | 01 |
| 오류 코드 | — | 단일 원천은 06장 6.4.2 + `@tastefit/api-contract` (R-13) | 06 |
| 임계값 파일 | `config/thresholds.json` | 품질·SLO·진단·출시(`release`) 합격선 단일 원천, 잠금 `config/lock/locked-hashes.json` + `QA_LOCK_DIGEST` (R-09) | 07 |
| 익명 세션 | `anon_id` | 로그인 전 진단 주체를 식별하는 httpOnly 쿠키 (D-41) | 06 |
| 한도 | `quota_ledger` | 계정당 생성 3회/일·15회/월, 비폴백 ≥1 노출 시에만 확정 (§9.3, R-15) | 00 |
| 레이트리밋 | `rate_limits` | 빈도 제한. 값 원천 06장 6.10.1 (R-31) | 06 |
| 킬 스위치 | `feature_flags` | KS-1~KS-4 (§9.4). 키 이름 R-22 | 00 |
| 골든 세트 | `GS-NN` | 32케이스(유형 8 × 용도 3 + 엣지 8). 전체 실행 케이스당 3회, 스모크 8×1 (R-11). 회귀·모델 승격 평가용 | 07 |
| 오프라인 승격 규칙 | — | 모델·프롬프트 교체 시 블라인드 40쌍 승률 Wilson 하한 ≥ 0.35 + 골든 세트 회귀 없음 (D-44, R-24) | 07 |
| models.yaml | — | 역할(`gen_copy`, `gen_layout`, `judge_vision`, `ref_tagger`) → 모델·파라미터·프롬프트 버전·단가 레지스트리. 프롬프트 `packages/llm/prompts/<role>@v<N>.md` (D-42, R-12) | 06 |
| MockProvider | — | 외부 키 없이 전체 테스트를 통과시키는 가짜 LLM 공급자 (D-42) | 06 |
| 베이스라인 시안 | — | A2(07장 P-2) 검증용, `eval/blind/baseline_prompt.md` 단일 프롬프트로 만든 비교 시안(오프라인 전용) | 07 |
| 고위험 브랜드 목록 | `blocked_brands` | 프로젝트 생성을 거부(422 `BLOCKED_BRAND`, `reason: high_risk`)하는 브랜드명 정규화 목록 (ADM-10, R-13) | 08 |
| 가드레일 / 리스크 | `GR-n` / `RK-nn` | 이 장 §6.4 / §11의 ID | 00 |
| P1 / P2 | — | 1차 타깃(디자이너 없는 1인 창업자·프리랜서·소규모 브랜드) / 2차 타깃(웹 개발자) (D-02) | 00 |
| [P0] / [P2] / [P3] | — | MVP / Phase 2 / Phase 3 (D-05) | 00 |
| RC / 비공개 베타 / 공개 출시 | `BETA_INVITE_ONLY` | MVP 출시 단계 (R-32, §7.2) | 00, 07 |

---

## 13. 추가 결정

decisions_v2.md로 대체된 항목은 "→ R-xx로 대체"로 표시한다. 대체된 항목은 R-xx 값을 따른다.

| ID | 제안 | 근거 | 영향 장 | 상태 |
|---|---|---|---|---|
| D-001 | 결과 화면에 "내 유형 디자인 가이드" 카드를 [P0]로 둔다: 유형 앵커 프리셋의 서체 페어링명, 팔레트 HEX 4~6개, radius 계열명을 표시하고 "복사" 버튼 제공(사용자 선택 대상 아님, 읽기 전용). 시안 생성 없이 떠나는 사용자의 출구 가치 | UX-14, V4 | 01, 02, 03 | 유효(01장 1.5.2 ⑤, 06장 `ResultView.guide` 반영) |
| D-002 | 용도 enum 코드값: `saas`, `portfolio`, `local_business` | D-03의 코드 식별자 통일 | 01, 04, 06 | → R-02로 대체 |
| D-003 | MVP 결과 공유 채널: 링크 복사, 결과 카드 이미지 저장(1080×1350 PNG), Web Share API(지원 브라우저). 카카오 SDK 공유는 [P2] | 외부 SDK 키·심사 부담 제거 | 01, 06 | 유효(01장 1.5.2.3 반영) |
| D-004 | MVP 편집의 카피 수정은 텍스트 슬롯 직접 수정만 허용(LLM 호출 없음). LLM "카피 다시 쓰기"는 [P2] | 원가·한도 단순화, D-16 범위 유지 | 01, 04 | 유효(04장 D-0408과 일치) |
| D-005 | 분석은 자체 `events` 테이블(§8)로 하고 외부 분석 SDK는 MVP 제외 | 국외 이전 항목 축소, KPI 정의 단일화 | 06, 08 | → R-18로 대체(`events` 제품 분석 단일 테이블). 이벤트명 원천은 R-23 |
| D-006 | 이벤트 원본 보관 13개월, 탈퇴 시 해당 user_id 이벤트는 `user_id=null`, `anon_id`는 해시 재생성으로 비식별화 후 집계용 보존 | 연간 비교 가능, 최소 보관 | 08 | 유효(06장 AC-06-44 반영). 기간 값의 최종 원천은 08장 보관 기간표(IF-10) |
| D-007 | 페이크 도어는 가격 숫자를 표시하지 않는다(가상 플랜명·혜택만) | 표시광고 오인 위험 회피 | 01, 08 | 유효(01장 S14 반영) |
| D-008 | 변형 코드값: `v_true`, `v_fit`, `v_bal` (UI 표기 "취향 그대로", "용도 최적", "균형") | D-20 식별자 통일 | 01, 04, 06 | → R-03으로 대체 |
| D-009 | 잡 상태 enum에 `fallback`을 추가: `queued`, `running`, `succeeded`, `partial`, `fallback`, `failed`, `canceled` | 한도 복구·KPI 구분 | 04, 06 | → R-15로 대체 |
| D-010 | 한도: 생성 3회/일·15회/월/계정, 사용자당 동시 1잡, 프로젝트 10개/계정. 일 예산 기본 US$10, 월 US$150 | §9.3~9.4 계산 근거 | 06 | 일부 대체: 플래그명·예산값 → R-22로 대체, 동시성(전역 5·사용자당 1) → R-16으로 대체, 빈도 레이트리밋 → R-31로 대체. 3회/일·15회/월·프로젝트 10개는 유효 |
| D-011 | 한도 차감은 비폴백 시안 ≥1개 노출 시에만 확정, `fallback`·`failed`는 복구 | 사용자 공정성, 품질 책임 | 04, 06 | → R-15로 대체 |
| D-012 | 신고 자동 비공개: 사칭·피싱 1건 즉시, 그 외 서로 다른 신고자 3건. 운영자 판단 SLA 24시간 | LG-13, 1인 운영 | 01, 08 | 유효, 사유 enum·신고자 기준은 08장 8.9.5·06장 D-0612로 정정(`impersonation`·`phishing` 즉시, `ip_hmac` 3건). 비공개 응답 코드 `SHARE_HIDDEN` → R-13 |
| D-013 | 비공개 베타는 초대 코드 기반(`BETA_INVITE_ONLY`)으로 생성만 제한하고 진단은 공개 | 비용 통제 + 퍼널 상단 측정 | 01, 06 | 단계 정의 → R-32로 대체(≤50명, G1~G6 + G7a). 생성만 제한·진단 공개 규칙은 유효(06장 `INVITE_REQUIRED`) |
| D-014 | 결과 레코드에 2순위 유형 `type_id_second` 저장(경계 표기·재검사 일치 계산용) | Q4 계산 | 02, 06 | 유효(06장 `survey_results` 반영) |
| D-015 | 가드레일 ID를 `GR-n`, 리스크 ID를 `RK-nn`으로 바꾼다(07장 출시 게이트 `G1~G7`, 04장 하드 게이트 `G-01~G-12`, decisions_v2 `R-xx`와 충돌 방지) | ID 충돌 | 06, 07, 09 | 신규 |
| D-016 | `generate_complete` props에 `n_real`, `first_shown_ms`, `generate_request`에 `queue_position`을 추가하고, `generate_rejected`를 `{stage, code, reason?}`로 바꿔 프로젝트 생성 거부(`BLOCKED_BRAND` 등)까지 기록한다 | R-25 첫 카드 SLO 측정, R-13 코드 통일 | 01, 06 | 신규 |
| D-017 | 비공개 베타 KPI 목표를 생성 사용자 ≤ 50명 규모로 재설정: WAM 4주 누적 ≥ 30·4주차 ≥ 10, 판정 최소 표본 진단 시작 ≥ 100·생성 사용자 ≥ 30 | R-32 인원 상한 | 07, 09 | 신규 |

---

## 14. 다른 장과 맞춰야 할 인터페이스

| IF | 이름 | 내용 | 상대 장 | 현재 상태(2026-11-17) |
|---|---|---|---|---|
| IF-01 | 원가 계산표 | 선택 모델 단가 기준 잡당 최악 원가 ≤ US$0.30 증명, 단계별 토큰 상한, `judge_vision` 기록 비용 포함 | 04, 06 | 04장 확인 필요 |
| IF-02 | `llm_calls.cost_usd`, `generation_jobs.cost_usd` | 예산 집계·KS-1의 원천 | 06 | 06장 6.10.3 반영 |
| IF-03 | 잡 상태 enum·판정 | R-15와 `generate_complete.status` 일치 | 04, 06 | 06장 6.2.3 반영 |
| IF-04 | `mockups.adopted_at`, `adopted_via`, `is_fallback`, `variant` | 채택 판정·WAM, `mark_adopted` | 04, 06 | 06장 DDL 반영 |
| IF-05 | `survey_results.type_id`, `type_id_second`, `is_boundary` | Q4, `result_view` | 02, 06 | 06장 DDL 반영 |
| IF-06 | 오류 코드 | 단일 원천 06장 6.4.2 + `@tastefit/api-contract`(R-13). 이 장 사용: `QUOTA_DAY`, `QUOTA_MONTH`, `RATE_LIMITED`, `JOB_IN_PROGRESS`, `PROJECT_LIMIT`, `INVITE_REQUIRED`, `CONSENT_REQUIRED`, `BLOCKED_BRAND`(`high_risk`·`phishing_term`), `BRAND_ATTESTATION_REQUIRED`, `SHARE_HIDDEN`, `SHARE_DISABLED`, `SIGNUP_DISABLED`, `GEN_BUDGET_EXCEEDED`, `GEN_DISABLED` | 01, 06 | 06장 반영, 화면 문구 → 01장 |
| IF-07 | 테이블 | `events`, `identity_links`, `quota_ledger`, `feature_flags`, `invites`·`invite_redemptions`, `support_tickets`, `reports`, `rights_requests`, `reference_sites`, `admin_audit_logs`, `eval_sets`·`eval_judgments`, `blocked_brands`, `survey_answers`, `users.role`·`is_internal`·`status`·`quota_*_override` (R-18) | 06 | 06장 DDL은 응답 테이블을 `survey_responses`로 표기 → R-18 `survey_answers`로 정정 필요(06장 소관) |
| IF-08 | 이벤트 레지스트리 zod 스키마 | §8.3 이름·props(+01장 D-0106, D-016), `@tastefit/api-contract` | 01, 06, 07 | 07장 7.3.4·7.9.2의 이벤트명(`result_viewed`, `generation_completed`, `diagnosis_started` 등)을 §8.3 이름으로 정정 필요(R-23, 07장 소관) |
| IF-09 | `feature_flags` 키 | §9.4 표: `JOB_COST_CAP_USD`, `GEN_DAILY_BUDGET_USD`, `GEN_MONTHLY_BUDGET_USD`, `GEN_ENABLED`, `SIGNUP_ENABLED`, `SHARE_PUBLIC_ENABLED`, `BETA_INVITE_ONLY`, `GEN_MAX_CONCURRENT_JOBS`(=5), `JUDGE_VISION_MODE`(=`log`) | 06, 07 | 06장 6.10.4 반영. 07장 `limits.*` 명칭 교체 필요(R-22, 07장 소관) |
| IF-10 | 보관 기간 | 이벤트·문의·신고·감사 로그·`brief_drafts`(24h, R-26)의 보관 기간 단일 출처 | 08 | 08장 확인 필요 |
| IF-11 | 랜딩·결과·한도 도달·킬 스위치·신고 비공개 화면 카피 | §3.1, §9.4, §10.3 | 01 | 01장 S01·S14·S15 반영 |
| IF-12 | 출시 단계·게이트 | §7.2(RC → 비공개 베타 → 공개 출시)의 추가 제품 조건을 07장 7.11 게이트와 09장 마일스톤에 연결(R-32) | 07, 09 | 09장 단계명 정합 확인 필요 |
| IF-13 | 사람 평가 합격선 | A1b·A2·A3 = 07장 P-4·P-2·P-1, 기계 판정 `config/thresholds.json`(R-09) | 07 | 07장 반영 |
| IF-14 | 진단 시뮬레이션 합격선 | A0 = R-05 값. 07장 7.3.1의 구값(유형 정확도 β=8 ≥80%, 적응형 이득 ≥20%, 중앙값 ≤14 등)은 R-05로 정정 필요 | 02, 07 | 07장 소관 |
| IF-15 | 사용성 테스트 | §5.3 = 07장 7.9(T1~T5, S1~S3). 01장 1.17의 "Blocker 0" 표기는 "S1 미해결 0"으로 읽는다 | 01, 07 | 01장 표기 정정 권장 |

---

## 15. 반영 추적

### 15.1 1라운드 리뷰

| 리뷰 ID | 심각도 | 반영 절 | 비고 |
|---|---|---|---|
| PM-01 | Blocker | §1, §2, §3 | 페르소나는 D-02에 따라 P1=비개발 사업자, P2=개발자로 재정의(리뷰 원안의 P3 바이럴 소비자는 획득 채널로 격하) |
| PM-02 | Blocker | §6 | 목표값은 D-13(4분)·R-25(SLO)와 정합화, UX-12 지표 통합 |
| PM-03 | Blocker | §7 | 용도 5종 → 3종(D-03), 후보 4 → 6(D-22), 3단계 슬라이더 → 폐기(D-16), 출시 단계 R-32 |
| PM-04 | Blocker | §7.1(범위), §10.4(삭제), 세부 → 01·06·08장 | 보관 기간 값은 08장 단일 출처 |
| PM-05 | Blocker | §7.1(용도·편집 범위), R-02·D-004, 세부 → 01·04장 | 채택 정의는 §6.1 |
| PM-06 | Blocker | §7.1, 세부 → 02장 | 판정은 D-15(거리 최소), 유형 ID R-04, D-014 |
| PM-07 | Major | decisions.md D-16·D-20·D-14, R-03, §12 용어집 | |
| PM-08 | Major | §7.1, 세부 → 02장 | D-13, R-05 |
| PM-09 | Major | §7.1, RK-04, 세부 → 02·05장 | R-06·R-07 수량·규격 |
| PM-10 | Major | §4 | |
| PM-11 | Major | §9 | 원가 상한 US$0.30(D-24), 플래그 R-22 |
| PM-12 | Major | §5, §11 | |
| PM-13 | Major | §9.3 한도 복구, R-15, 세부 UX → 01·04장 | SLO는 R-25 |
| PM-14 | Major | §10 | |
| PM-15 | Major | §8 | 이벤트명 원천 R-23 |
| PM-16 | Major | §7.1 법무 행, §10.2~10.4, 세부 → 08장 | |
| PM-17 | Minor | §7.1 언어·기기 행 | 브라우저 R-33 |
| PM-18 | Minor | §12 시즌, `events.taxonomy_version`, 세부 → 05장 | 시즌 ID R-30 |
| PM-19 | Minor | AC-00-02, RK-14 | |
| PM-20 | Minor | §7.1 언어·기기 행, 접근성 → 07장 | |
| UX-12 | Major | §5.1(A0, A1, A1b), §5.3, §6.2 | 프로토콜은 07장 7.8·7.9 |
| UX-14 | Major | §2.1(성공 경로·출구), §3.1, D-001, AC-00-03 | 화면 카피 상세 → 01장 |
| LG-11 | Major | §10.4, D-006, IF-10 | 기간 값 → 08장 |
| LG-13 | Major | §9.5, §10.3, ADM-10, D-012 | 기술 통제 상세 → 04·08장 |
| LG-14 | Major | §7.1 법무 행, §10.2 | 문서 본문 → 08장 |
| TL-06(참고) | Blocker | §9.1~9.2 원가 예산·가드 | 수식·토큰 상한 → 04장 |
| TL-20(참고) | Major | §9.3 한도 | 생성 10회/일 제안은 3회/일로 조정, 빈도 값은 R-31 |

### 15.2 decisions_v2.md 반영 (2026-11-17)

| R | 반영 절 |
|---|---|
| R-01 | §12 L1 축 코드 키 |
| R-02 | §7.1, §8.3 `purpose`, §12, D-002 대체 표시 |
| R-03 | §7.1, §8.3 `variant`, §12, D-008 대체 표시 |
| R-04 | §7.1, §8.3 `type_id`, ADM-08, §12 |
| R-05 | §5.1 A0, RK-03, IF-14 |
| R-06·R-07·R-08 | §7.1 자극물 행, RK-04, §12 |
| R-09 | 머리말, §5.2, §6.6, §7.1, §12 |
| R-10 | §7.2 RC 조건 ① |
| R-11 | §7.1 품질 행, §10.5, §12 |
| R-12·R-37 | §7.1 생성·모델 행, §9.1, §9.4 `JUDGE_VISION_MODE`, §12 |
| R-13 | §8.3 `generate_rejected`, §9.5, §10.3 `SHARE_HIDDEN`, IF-06 |
| R-14 | §7.1 생성 행, §12 |
| R-15 | §6.3 Q5·Q6, §8.3, §9.3, §12, D-009·D-011 대체 표시 |
| R-16 | §9.3, §9.4 `GEN_MAX_CONCURRENT_JOBS=5`, D-010 |
| R-17 | §7.1 편집 행, §9.5, RK-09 |
| R-18 | §8.1, §10.1, §10.4, §12, IF-07, D-005 대체 표시 |
| R-19 | 머리말, §2.1, §7.1 공유 행, §10 route 표기 |
| R-20·R-28 | §6.4 GR-6, §7.1 생성 행, RK-06·RK-16, §12 |
| R-21 | §7.1 생성 입력 행, §12 |
| R-22 | §6.4 GR-1·GR-2, §9.4, IF-09, D-010 |
| R-23 | §8.1, §8.3(`survey_exit`, `ui_error_shown`, D-0106 props), IF-08 |
| R-24 | §10.5, RK-10, §12 |
| R-25 | §6.4 GR-4, §8.3 `first_shown_ms`, RK-13 |
| R-29 | §7.1 계정 행, §9.3, §9.5 |
| R-30 | §10.5, §12 |
| R-31 | §9.3(06장 6.10.1 참조), D-010 |
| R-32 | §6.1~6.2, §7.2, §12, D-013, D-017 |
| R-33 | §2.1, §7.1 언어·기기 행 |
| R-35 | §7.1 레퍼런스 행, §8.1 |
| R-36 | §7.1 진단·결과 행, §12 |
| R-38 | §7.1 결과·레퍼런스 행, §12 |
| R-26, R-27, R-34 | 이 장 직접 해당 없음(IF-10, §12 L2 표기만) |
