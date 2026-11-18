# 02. 진단 시스템

이 장은 취향 진단의 측정 공간(L1 축), 자극물, 추정 알고리즘, 유형 판정, 결과 신뢰도, 검증 방법을 정의한다. 화면 배치·문구 톤은 01장, L2 토큰 실제 값과 프리셋은 03장, 보조 강도에 따른 생성 동작은 04장, 레퍼런스·추출기·정규화기는 05장, 테이블 DDL·API는 06장, 테스트 하네스는 07장, 보관·고지는 08장, 빌드 순서는 09장을 따른다.

## 2.0 범위와 버전

| 구분 | 내용 | 단계 |
|---|---|---|
| 포함 | L1 5축 정의, L1→L2 매핑 연결, 취향 결과·응답 로그 스키마, 자극물 체계(카드 48장, A/B 120쌍), 가우시안 사후 갱신, 문항 선택, 종료, 콜드 스타트, 일관성 지수 κ, 위치 편향 대응, 유형 8개 텍스트, 판정·동률·경계·상충, 결과 신뢰도, 닮은 사이트 선택, 로그 재생, 시뮬레이션 검증 | P0 |
| 제외 | 3단계 요소 미세조정(→ 편집 화면, D-16), 슬라이더 응답, 완전 공분산 사후, 사용자별 β·λ 추정, 모바일 토너먼트형 설문, 유형 16개 | MVP 제외(Phase 2/3, 2.18) |

화면은 01장 S02(진단)·S03(결과)이 단일 원천이다(R-19). 이 장에서 "01장"은 그 두 화면을 가리킨다.

버전(모든 세션·결과에 저장, 재생·회귀 판정에 사용):

| 키 | 값 형식 | 바뀌는 시점 |
|---|---|---|
| `taxonomy_version` | 시즌 ID `YYYY-S{1..4}`(패치 `.n`), 예 `2027-S1`(R-30, 05장 D-053). 06장 `taxonomy_releases.version` | 유형 중심(03장 3.4.7)·프리셋·자극물 승인 목록(B12)·유형 텍스트가 바뀌는 시즌 릴리스 |
| `normalizer_version` | = 시즌 ID(R-30) | 05장 정규화기 릴리스 |
| `engine_version` | semver, 초기 `diag-1.0.0`(06장 `diagnosis_sessions.versions`) | 2.5~2.12 수식·상수·규칙 변경(상수 = minor, 규칙 = major) |
| `axis_set_version` | `L1-5.v1` | 축 정의·앵커 변경 |

상수의 단일 원천은 `config/thresholds.json`이다(R-09, 해시 잠금 → 09장 9.5.6). 09장이 정한 평면 키 `beta`, `sigma0`, `sigmaStop`, `maxQuestions`는 그대로 쓰고, 나머지 진단 상수는 같은 파일의 `diagnosis` 객체에 둔다. 용도 사전분포 중심은 04장 `config/calibration.json`의 c_p를 읽는다(2.8.1). 엔진 코드에 상수 리터럴 0개(AC-02-30).

```json
{
  "beta": 8, "sigma0": 0.25, "sigmaStop": 0.08, "maxQuestions": 16,
  "diagnosis": {
    "lambda": [1,1,1,1,1], "calibKappa": 1.3, "priorWeight": 0.3,
    "stage1Questions": 8,
    "stage1": { "candidateSamples": 200, "minPairDist": 0.35, "minDistinctTypes": 3, "maxAppearPerVector": 3, "epsilonExplore": 0.10, "typeDiscWeight": 5.0 },
    "noneAvoidDist": 0.35, "noneExploreAfter": 3, "cantTellInsensitiveAfter": 2,
    "consistency": { "llChance": -0.15, "llRef": 0.25, "checkBonus": 0.05, "minScored": 4 },
    "typing": { "tieEps": 0.01, "boundaryEps": 0.05, "conflictMinPicks": 3, "conflictMinCenterDist": 0.60, "lowSignalMinPicks": 4 },
    "positionBias": { "sameSlotRatio": 0.80, "minAnswers": 5 },
    "similarSites": { "maxScore": 0.45, "tau": 0.05, "count": 3 },
    "fastAnswerMs": 1000
  }
}
```

---

## 2.1 L1 축 정의 (D-10)

### 2.1.1 축 표

모든 축은 연속값 [0,1]. 0.5 = 05장 시즌 기준 코퍼스의 중앙값(백분위 정규화). 축 ID·키는 05·09장과 공통이다.

| ID | 키 | 0 ↔ 1 | 결과 화면 쉬운 말(0 / 1) | 시각적 의미(무엇을 보나) | 이 축에서 제외(다른 축 소관) |
|---|---|---|---|---|---|
| A1 | `expression` | 미니멀 ↔ 표현적 | 덜어냄 / 드러냄 | 시각 자극의 양: 헤드라인 크기 대비, 색 수·채도, 장식 요소 수, 비대칭 배치 | 여백·정보량(A4), 그림자(A5) |
| A2 | `temperature` | 차가움 ↔ 따뜻함 | 차분하고 차가운 / 포근하고 따뜻한 | 주조·배경 색상각과 틴트, 서체 인상(기하 산세리프 ↔ 휴머니스트·명조) | 채도 크기(A1) |
| A3 | `shape` | 날카로움 ↔ 부드러움 | 각진 / 둥근 | 모서리 radius 계열, 테두리 두께, 도형 곡률 | 그림자·깊이(A5) |
| A4 | `density` | 여유 ↔ 밀도 | 넉넉한 / 촘촘한 | 섹션 패딩, 요소 간격, 첫 화면당 텍스트 블록 수 | 장식 수(A1), 색(A2) |
| A5 | `depth` | 평면 ↔ 입체 | 납작한 / 입체적인 | z축 표현: 그림자 레벨, 레이어 겹침, 블러·글래스, 오프셋 그림자 | radius(A3) |

- "클래식 ↔ 트렌디"는 축이 아니다. 프리셋·레퍼런스 메타데이터 `era: classic|current`로만 다룬다(D-10, 05장).
- 모션은 L1 축에 포함하지 않는다. 모션 수준은 L2에서 유형·용도로 결정한다(→ 03장).
- 축 독립성: 05장 5.7.4 축 간 상관 규칙(|r| ≥ 0.60이면 릴리스 결정 기록, ≥ 0.75면 차단)을 따른다. 추가로 자극물 기준 벡터 16개(2.4.2)의 축 간 |r| ≤ 0.30(설계값 최대 0.28, 2.4.2).

### 2.1.2 앵커 예시 (5단계)

앵커는 사람 라벨(05장 5.7)과 비전 태깅 기준표의 공통 기준이다. 각 단계의 앵커 이미지는 2.4의 tpl-hero 템플릿으로 렌더한 `anchor-a{k}-{level}.webp` 5장(축당)이며, 해당 축만 바꾸고 나머지 축은 0.5로 둔다(총 25장, `survey:build`가 함께 생성, 사용자 비노출, 라벨 도구·05장 전용).

| 축 | 0.00 | 0.25 | 0.50 | 0.75 | 1.00 |
|---|---|---|---|---|---|
| A1 표현성 | 무채색+포인트 0색, 헤드라인/본문 크기비 ≤2, 장식 0 | 포인트 1색(저채도), 크기비 ~2.5, 장식 0~1 | 포인트 1~2색(중채도), 크기비 ~3.5, 장식 1~2 | 2~3색(고채도), 크기비 ~5, 장식 2~3, 비대칭 섹션 1개 | 3색+대비색, 크기비 ≥6(디스플레이 점프), 장식 3+, 비대칭·겹침 레이아웃 |
| A2 온도 | 청·청록 계열 주조, 쿨그레이 배경, 기하 산세리프 | 중성 회색 배경, 청 계열 포인트, 그로테스크 | 순백·중성, 포인트 색상각 중립 | 아이보리·웜그레이 배경, 주황·테라코타 포인트, 휴머니스트 | 크림·베이지 배경, 적·주황·갈색 주조, 명조·손글씨 느낌 디스플레이 |
| A3 형태 | radius 0px, 테두리 2px, 직각 도형 | radius 2~4px, 헤어라인 | radius 6~8px | radius 12~16px, 테두리 없음 | radius 24px~pill, 원·곡선 도형 |
| A4 밀도 | 섹션 패딩 160px, 첫 화면 텍스트 블록 ≤2 | 128px, 블록 3 | 96px, 블록 4~5 | 64px, 블록 6~8 | 48px 이하, 블록 ≥9, 다열 정보 |
| A5 깊이 | 그림자 0, 단색 면 | 헤어라인 구분, 그림자 레벨 1 | 그림자 레벨 2(카드만) | 다층 그림자 레벨 3, 겹친 카드 | 글래스(블러)·오프셋 그림자·강한 레이어 |

px 값은 앵커 설명용 대표값이다. 실제 토큰 값은 03장 택소노미가 단일 원천이다.

---

## 2.2 L1→L2 매핑 연결 (D-11)

사용자는 L2 원시값을 고르지 않는다. L2 키 18개(R-27)와 값 목록은 03장 3.2.1, 매핑 함수 `mapL1toL2`(앵커 상대 서수 이동)와 표는 03장 3.3, 의도 L1 계산 `predictL1`은 03장 3.2.2, 변형별 목표 벡터와 스냅은 04장 4.3~4.4가 단일 원천이다. 이 장은 진단 결과가 그 함수들에 넘기는 입력만 정한다.

| 진단 출력 | 쓰는 곳 |
|---|---|
| μ(5축), σ(엔진값), κ, `insensitive_axes` | 04장 `calibrate()` 입력 `TasteResult`(4.3) |
| 앵커 유형 = `anchor_override_type_id ?? type_id` | 04장 앵커 a_T(R-36), 03장 허용 L2 집합 3.4.5 |
| 자극물 카드의 L2 | `mapL1toL2(target_l1, baseTypeId)`(03장 3.3, 용도 없음·변형 없음) |

축별 L2 구동 관계(요약, 값은 03장 3.3.2): A1 → `type.scale_ratio`·`type.display_boost`·`type.headline_weight`·`layout.grid_mode`·`motion.level`, A2 → `media.treatment`·`type.pairing_id`·`color.palette_id`, A3 → `shape.radius_family`·`shape.border`, A4 → `type.body_size`·`type.body_leading`·`space.density`·`space.container`, A5 → `depth.style`·`depth.shadow_level`.

- 범주형 L2(페어링·팔레트·depth 종류·레이아웃·이미지 모드)는 평균하지 않고 1순위 유형(또는 override 유형)의 허용 집합에서만 고른다(03장 3.3.1, AC-02-05).
- 표시용 구간(대체 텍스트·쉬운 말 서술 전용, 매핑에는 쓰지 않음): L0 [0,0.2), L1 [0.2,0.4), L2 [0.4,0.6), L3 [0.6,0.8), L4 [0.8,1.0].

---

## 2.3 데이터 스키마

테이블 DDL·RLS는 06장 6.3이 원천이고(2026-11-18 최종 DDL과 대조 완료), 이 절은 필드 의미를 고정한다. 테이블: `diagnosis_sessions`, `survey_answers`(R-18), `impressions`, `diagnosis_results`, `survey_items`(R-18). 축 키는 R-01(`expression`, `temperature`, `shape`, `density`, `depth`)을 쓰며, 배열(`Vec5`)로 저장할 때 순서는 A1→A5(같은 키 순서)다. 진단 엔진 `@tastefit/diagnosis`(`packages/diagnosis`)는 순수 함수이며 DB·LLM·렌더러를 import하지 않는다(09장 의존 규칙).

### 2.3.1 진단 결과 프로필 `TasteProfile`

`diagnosis_results.profile`(jsonb)에 아래 JSON 전체를 저장하고, 조회용으로 `type_id`·`type_id_second`·`is_boundary`·`similar_site_ids`를 컬럼에 중복 저장한다(06장). 04장 입력 `TasteResult {mu, sigma, kappa, insensitive_axes, type_id, anchor_override_type_id?}`는 이 프로필에서 뽑는다.

```json
{
  "schema": "taste-v2",
  "versions": { "taxonomy_version": "2027-S1", "normalizer_version": "2027-S1", "engine_version": "diag-1.0.0", "axis_set_version": "L1-5.v1" },
  "prior": { "purpose_hint": "local_business", "mu0": { "expression": 0.5, "temperature": 0.56, "shape": 0.515, "density": 0.47, "depth": 0.425 }, "sigma0": 0.25 },
  "axes": {
    "expression":  { "mu": 0.31, "sigma": 0.072, "sigma_display": 0.094, "status": "confirmed" },
    "temperature": { "mu": 0.68, "sigma": 0.091, "sigma_display": 0.118, "status": "open" },
    "shape":       { "mu": 0.27, "sigma": 0.079, "sigma_display": 0.103, "status": "confirmed" },
    "density":     { "mu": 0.30, "sigma": 0.088, "sigma_display": 0.114, "status": "insensitive" },
    "depth":       { "mu": 0.18, "sigma": 0.083, "sigma_display": 0.108, "status": "open" }
  },
  "insensitive_axes": ["density"],
  "type": {
    "type_id": "T1", "type_id_second": "T8", "adjacent_type_ids": ["T8", "T2"],
    "d1": 0.093, "d2": 0.121, "margin": 0.028,
    "is_boundary": true, "is_tie": false, "confidence": "medium", "flags": []
  },
  "kappa": 0.58,
  "consistency_detail": { "ll_mean": 0.082, "n_scored": 13, "check": "consistent", "position_bias": false, "max_slot_ratio": 0.375 },
  "counts": { "answered": 16, "option": 13, "none_of_these": 1, "cant_tell": 1, "check": 1, "back": 1, "fast": 0 },
  "end_reason": "max_questions",
  "computed_at": "2026-11-18T09:12:00Z"
}
```

| 필드 | 규칙 |
|---|---|
| `axes.*.sigma` | 엔진 사후 표준편차. 종료 판정(D-13)과 04장 입력에 사용 |
| `axes.*.sigma_display` | `calibKappa × sigma`(1.3배). 결과 화면 불확실 구간·보정 평가(2.16)에만 사용 |
| `axes.*.status` | `confirmed`(σ ≤ 0.08) / `open` / `insensitive`(2.5.4) |
| `kappa` | 일관성 지수 κ ∈ [0,1](2.9) |
| `type.adjacent_type_ids` | 거리 2·3순위 유형(01장 인접 유형 패널) |
| `type.flags` | `low_signal`, `conflict`, `tie`, `position_bias`, `fast_answers`의 부분집합(07장 골든 `flags`와 같은 문자열) |
| `end_reason` | `converged` / `max_questions` / `user_exit` |

엔진 시그니처(`packages/diagnosis/src/index.ts`):

```ts
export type AxisKey = 'expression'|'temperature'|'shape'|'density'|'depth';   // R-01, A1..A5 순서
export type Vec5 = [number, number, number, number, number];
export type AnswerKind = 'option'|'none_of_these'|'cant_tell';
export interface Posterior { mu: Vec5; var: Vec5 }
export interface EngineState {
  sessionId: string; seed: number; purposeHint: Purpose | null;
  post: Posterior; cantTell: Record<AxisKey, number>;
  answered: ActiveAnswer[];                 // superseded 제외, seq 순
  stage: 1 | 2 | 'done';
}
export function initState(sessionId: string, seed: number, purposeHint: Purpose | null, th: Thresholds): EngineState;   // diagnosis_sessions.state 캐시
export function nextQuestion(s: EngineState, items: SurveyCatalog, th: Thresholds): Question | null;   // null = 종료
export function applyAnswer(s: EngineState, q: Question, a: AnswerInput, items: SurveyCatalog, th: Thresholds): EngineState;
export function update(s: EngineState, a: AnswerInput, items: SurveyCatalog, th: Thresholds): { state: EngineState; next: Question | null }; // 06장 6.2.2가 호출 = applyAnswer → nextQuestion
export function replay(rows: SurveyAnswerRow[], seed: number, purposeHint: Purpose | null, items: SurveyCatalog, th: Thresholds): EngineState;
export function finalize(s: EngineState, types: TypeDef[], refs: SimilarSiteCandidate[], th: Thresholds): TasteProfile;
```

### 2.3.2 진단 세션 `diagnosis_sessions` (06장 DDL)

| 필드 | 설명 |
|---|---|
| `id` | = 이벤트 `survey_session_id` |
| `anon_id` / `user_id` | D-41. 로그인 시 `user_id` 귀속(06·08장) |
| `taxonomy_version` | 2.0, 시즌 ID |
| `seed` | 세션 생성 시 CSPRNG로 1회 발급하는 int32. 문항 선택·위치 셔플의 유일한 난수원 |
| `purpose_hint` | `saas`/`portfolio`/`local_business`/null(2.8.1, R-02) |
| `status` | `in_progress` / `completed` / `abandoned`(마지막 활동 30분 경과, 재방문 시 이어하기) |
| `entry` | 00장 `survey_start.entry` |
| `versions` | 2.0 버전 키 4종 `{taxonomy_version, normalizer_version, engine_version, axis_set_version}` |
| `state` | `EngineState` 캐시. 언제나 응답 로그 재생으로 재구성 가능해야 하며, 재생 결과와 다르면 재생 결과가 이긴다 |
| `last_active_at` | 08장 보관 기준(익명 30일) |

### 2.3.3 응답 로그 `survey_answers` (06장 DDL, R-18, 원본·추가 전용)

응답 로그가 진실의 원천이다. 프로필은 언제나 로그 재생으로 다시 만들 수 있어야 한다(2.15).

| 필드 | 설명 |
|---|---|
| `session_id`, `seq` | `seq` 1~16 = 화면에 제시된 문항 순번. 뒤로가기로 다시 답한 문항은 같은 seq 새 행 |
| `question_id` | `q-{session}-{seq}-{attempt}`. (`session_id`, `question_id`) 유일 = 중복 제출 방지(07장 TC-E-07) |
| `stage`, `kind` | 1·2 / `pick4`·`ab`·`check`(2.6.3 재출제 검증 문항) |
| `item_id` | 1단계: 카드 4장 ID 정렬 결합의 해시, 2단계: `ABP-…` 쌍 ID |
| `shown` | `[{option_id, slot}]`. slot = 화면 위치(0=좌상, 1=우상, 2=좌하, 3=우하 / A/B: 0=좌·위, 1=우·아래) |
| `answer` | `option` / `none_of_these` / `cant_tell`(00장 이벤트와 같은 값) |
| `chosen_option_id` | answer = option일 때만 |
| `latency_ms` | 선택지 이미지가 모두 표시된 시점부터 응답까지 |
| `policy`, `propensity` | `dopt`/`explore`/`ab_fisher`/`check`. explore = 1/(제약 만족 후보 수), dopt = 1 − ε, A/B·check = 1 |
| `superseded` | 뒤로가기로 취소되면 true. 재생 시 제외 |
| `ux` | 01장 D-0106 선택 필드(엔진은 읽지 않음) |
| `client_ts`, `server_ts` | 재생 정렬 = (`seq`, `server_ts`) |

### 2.3.4 노출 로그 `impressions` (06장 DDL)

`{ session_id, seq, item_ids[], slots[], policy, propensity, device_class: 'desktop'|'tablet'|'mobile', ts }`. 응답 행과 1:1(뒤로가기 재노출 시 새 행). 트렌드 집계는 MVP 동안 이 테이블과 `survey_answers`를 입력으로 쓰지 않는다(R-35, 05장 D-05A·AC-05-28).

### 2.3.5 진단 결과 `diagnosis_results` (06장 DDL)

| 필드 | 설명 |
|---|---|
| `id` | = 이벤트 `result_id` |
| `session_id` | 1:1(재진단은 새 세션·새 결과) |
| `taxonomy_version` | 계산에 쓴 시즌 |
| `type_id`, `type_id_second`, `is_boundary` | 2.12. 00장 D-014 |
| `profile` | 2.3.1 JSON 전체(R-01 키) |
| `rating` | 결과 공감 1~5(00장 `result_rating`) |
| `anchor_override_type_id` | "다른 유형 보기"로 고른 유형(R-36, 01장 D-0102). μ·σ·`type_id` 불변 |
| `recomputed_from` | 재생 재계산 시 이전 결과 id(2.15) |
| `similar_site_ids` | 계산 시점 닮은 사이트 레퍼런스 ID ≤ 3(2.14) |

### 2.3.6 자극물 `survey_items` (06장 DDL, R-07)

| 필드 | 설명 |
|---|---|
| `taxonomy_version`, `id` | 복합 키. ID: 카드 `C-SV{nn}-{tpl}`(예 `C-SV09-grid`), A/B 이미지 `AB-{T}-{A}-{lv}`(예 `AB-T3-A2-20`), 쌍 `ABP-{T}-{A}-{lvA}{lvB}`(예 `ABP-T3-A2-2050`), 앵커 참조 `ANC-{A}-{level}` |
| `kind`, `stage` | `card`(1) / `ab_image`(2) / `ab_pair`(2) / `anchor_ref`(null, 사용자 비노출) |
| `template_id` | `tpl-hero` / `tpl-grid` / `tpl-text`(A/B·앵커 참조는 `tpl-hero`) |
| `axis`, `level` | A/B만: 대상 축(R-01 키), 수준 0.2/0.5/0.8(R-06) |
| `pair_image_ids` | `ab_pair`만: 두 `ab_image` ID(수준 낮은 쪽 먼저) |
| `target_l1` | 의도 벡터(R-01 키 객체). 카드 = SV 벡터(2.4.2) |
| `x_card` | 실측 L1(05장 추출기, 그 시즌 정규화기). 갱신 수식의 입력은 반드시 이 값(R-06, 09장 D-0904). `ab_pair`는 null |
| `assets` | `{ desktop: {path, sha256, w:1280, h:800, bytes ≤ 140KB}, mobile: {w:780, h:1560, bytes ≤ 160KB} }`(R-07, `anchor_ref`는 desktop만) |
| `alt_text` | 대체 텍스트 5~160자(R-07, 2.4.6) |
| `dominant_colors` | 대문자 HEX 3개(01장 D-0111, 03장 `colorName()`으로 색 이름 표시). 산출 = 2.4.5 |
| `focus_region` | `{x,y,w,h}` 0~1 비율(R-07). 카드 `{0,0,1,1}`, A/B는 2.4.4 축별 값 |
| `status` | `draft` / `verified` / `active` / `retired`(2.4.7) |
| `stats` | 노출 수, 선택률, slot별 선택률, `cant_tell` 비율, `flag`(ADM-08) |

시즌이 바뀌면 같은 `id`의 새 `taxonomy_version` 행이 생기고 이전 시즌 행은 삭제하지 않는다. 따라서 정규화기별 x_card 이력은 (`taxonomy_version`, `id`) 행으로 보존된다(2.15).

---

## 2.4 설문 자극물 체계 (D-14)

### 2.4.1 원칙

| ID | 규칙 |
|---|---|
| S-01 | 설문 이미지는 모두 "고정 콘텐츠 템플릿 + 프리셋 토큰"으로 사전 렌더한 오리지널이다. 실제 사이트 스크린샷은 설문에 0장(코드·빌드 산출물 검사, AC-02-08). |
| S-02 | 한 문항 안의 이미지는 같은 템플릿·같은 텍스트·같은 이미지 파일을 쓴다. 다른 것은 토큰(L2)뿐이다(콘텐츠 diff 0). |
| S-03 | 카드에 스타일명·유형명·축 이름을 표시하지 않는다. 화면 라벨은 없음(선택은 이미지 탭). 대체 텍스트는 2.4.6 규칙. |
| S-04 | 설문 진행 중 렌더·추출·LLM 호출 0건(09장 M4 ⑥). |
| S-05 | 갱신 수식에는 의도값 `target_l1`이 아니라 실측값 `x_card`를 쓴다. |

### 2.4.2 1단계 카드 풀 48장 (R-06)

48 = 기준 벡터 16개 × 템플릿 3종. 기준 벡터 = 유형 중심 8개(SV01~SV08, 값은 03장 3.4.7을 그대로 인용) + 공간을 메우는 브리지 8개(SV09~SV16, 이 장 소유). 브리지는 중심 근처 카드만으로는 축 끝 쪽 사용자를 식별하지 못하는 문제(커버리지)와 중심끼리의 축 간 상관(A1–A4 r = 0.71)을 상쇄하기 위해 둔다.

카드 L2 생성: `l2 = mapL1toL2(target_l1, baseTypeId)`(03장 3.3, 용도·변형 없음). 범주형 L2는 기준 유형 허용 집합(03장 3.4.5)에서만 고른다.

| 기준 벡터 | 종류 | 기준 유형 | A1 expression | A2 temperature | A3 shape | A4 density | A5 depth |
|---|---|---|---|---|---|---|---|
| SV01~SV08 | 유형 중심 | T1~T8 | 03장 3.4.7 | 〃 | 〃 | 〃 | 〃 |
| SV09 | 브리지 | T7 | 0.15 | 0.40 | 0.65 | 0.85 | 0.80 |
| SV10 | 브리지 | T7 | 0.85 | 0.65 | 0.15 | 0.30 | 0.85 |
| SV11 | 브리지 | T4 | 0.35 | 0.55 | 0.85 | 0.80 | 0.15 |
| SV12 | 브리지 | T5 | 0.60 | 0.75 | 0.40 | 0.85 | 0.75 |
| SV13 | 브리지 | T5 | 0.75 | 0.15 | 0.40 | 0.85 | 0.15 |
| SV14 | 브리지 | T3 | 0.55 | 0.15 | 0.35 | 0.15 | 0.15 |
| SV15 | 브리지 | T4 | 0.30 | 0.85 | 0.35 | 0.85 | 0.15 |
| SV16 | 브리지 | T7 | 0.15 | 0.30 | 0.25 | 0.20 | 0.65 |

브리지 배치 규칙(시즌마다 03장 3.4.7이 바뀌면 다시 적용):
1. 값은 0.05 단위, [0.15, 0.85] 범위.
2. 기준 유형 = 브리지와 L∞ 거리가 가장 짧은 유형 중심이며, 그 거리 ≤ 0.45(허용 L2 집합으로 도달 가능한 범위).
3. 16개 전체에서 쌍별 유클리드 최소 거리 ≥ 0.45, 축 간 |r| ≤ 0.30, 축별 3구간 [0,0.33)/[0.33,0.67)/[0.67,1] 각각 ≥ 4개.
4. `survey:build`에서 브리지 카드의 실측 x_card가 채택 조건(아래)을 못 넘으면 운영자는 ① 기준 유형을 L∞ 거리 다음 순위 유형으로 바꾸거나 ② 목표 값을 축별 ±0.10 이내로 조정하고 규칙 3을 다시 검사한다. 그래도 실패하면 해당 SV는 `draft`로 남기고 커버리지 조건(아래)으로 판정한다.

설계 검증값(03장 3.4.7 2026-11-17 값 기준): 16개 쌍별 유클리드 최소 거리 0.546(T1–T8, 브리지 쪽은 모두 그 이상), 축 간 |r| 최대 0.28, 축별 3구간 개수 = A1 6/5/5, A2 6/5/5, A3 7/5/4, A4 6/4/6, A5 7/5/4.

카드 ID·벡터:
- 카드 ID = `C-SV{nn}-{tpl}`(예 `C-SV09-grid`). 48장 = SV01~SV16 × {hero, grid, text}.
- `target_l1` = SV 벡터, `x_card` = 렌더 후 05장 추출기 실측값.
- 채택 조건(05장 5.9): 카드×축 95% 이상 |x_card − target_l1| ≤ 0.10, 최대 ≤ 0.15. 밖이면 `draft`.
- 커버리지 조건(시즌마다 `active` 카드 기준 재검사): 템플릿별로 SV 16개 중 `active` ≥ 14, 각 축 3구간 각각 ≥ 25%, 유형별(최근접 유형 기준) 카드 ≥ 3. 미달이면 시즌 릴리스 차단(AC-02-07).

### 2.4.3 콘텐츠 통제: 템플릿 3종과 가상 브랜드 (09장 B9)

가상 브랜드는 용도 중립 문구를 쓴다(특정 업종을 연상시켜 취향 대신 업종을 고르게 만드는 것을 막음). 09장 B9의 임시 브랜드명 "한결"을 유지하되 업종 표현을 쓰지 않는다.

| 템플릿 | 구성(1280×800 첫 화면) | 고정 텍스트 | 이미지 |
|---|---|---|---|
| `tpl-hero` | 내비(로고 텍스트+메뉴 3+버튼) / 히어로(헤드라인 2줄, 본문 2줄, 버튼 2) / 카드 3개 1행(제목+본문 1줄) | 로고 "한결" · 메뉴 "소개 / 이야기 / 문의" · 버튼 "시작하기" · 헤드라인 "매일 쓰는 것을 / 조금 더 오래" · 본문 "한결은 오래 곁에 두고 쓰는 것을 만듭니다. 천천히, 그러나 꾸준히." · 버튼 "둘러보기", "더 알아보기" · 카드 "단단함 / 정직한 재료" "가벼움 / 덜어낸 구성" "꾸준함 / 오래 가는 약속" | 사진 1장(히어로) |
| `tpl-grid` | 섹션 제목 + 설명 1줄 / 2×3 그리드(이미지+제목+보조 텍스트) / 하단 버튼 | 제목 "지금 소개하는 것들" · 설명 "하나씩 직접 써 보고 골랐어요." · 항목 6개 "기본 01"~"기본 06", 보조 "한 줄 설명이 들어갑니다" · 버튼 "모두 보기" | 사진 3장(각 2회 사용) |
| `tpl-text` | 큰 인용문 / 본문 2단락 / 숫자 3개 강조 / 서명 | 인용 "좋은 것은 소리 없이 오래 남는다" · 본문 2단락(각 60자 내외 고정 문장) · 숫자 "12년 / 3,400명 / 98%" + 라벨 "함께한 시간 / 함께한 사람 / 다시 찾는 비율" · 서명 "한결 드림" | 사진 1장(작게) |

이미지 선정 규칙: 03장 이미지 팩에서 고르며 ① 사람 얼굴·로고·문자 없음 ② 평균 OKLCH 채도 C ≤ 0.04(사진 색이 A2 판단을 지배하지 않도록), 원본 보정 금지 ③ 모든 카드에서 같은 파일·같은 크롭(focal point 고정). 사진 선택은 `data/survey/templates.json`의 `imageIds`로 고정한다.

### 2.4.4 2단계 A/B 쌍 120개 (09장 B11)

| 항목 | 규칙 |
|---|---|
| 구성 | 기준 유형 8 × 대상 축 5 × 수준쌍 3 = 120쌍. 고유 이미지 = 8 × 5 × 수준 3 = 120장(슬롯 240) |
| 수준 | 대상 축 값 ∈ {0.2, 0.5, 0.8}, 나머지 4축 = 기준 유형 앵커 값. 수준쌍 (0.2,0.5), (0.5,0.8), (0.2,0.8) |
| 템플릿 | `tpl-hero` 고정 |
| 최소 차이 | 의도 Δ ≥ 0.30(UX-13 deltaRatio 기준 충족). 실측: 대상 축 부호 일치 & |Δ̂| ≥ 0.5×|Δ|, 비대상 축 |Δ̂| ≤ 0.08(05장 5.9) |
| `focus_region` | 축별 고정: A1 = 히어로 전체(0,0.08,1,0.62) / A2 = 전체(0,0,1,1) / A3 = 버튼+카드 행(0,0.45,1,0.55) / A4 = 전체(0,0,1,1) / A5 = 카드 행(0,0.55,1,0.45). 모바일·데스크톱 모두 클라이언트가 이 영역을 우선 노출(01장) |
| 유효 쌍 하한 | (유형, 축)마다 승인 쌍 ≥ 2/3. 미달이면 그 (유형, 축)은 거리 순 다음 유형의 쌍을 대신 사용(2.6.2). 축별 승인 쌍 ≥ 19/24(09장 M4 ①) |
| 품질 감시 | 출시 후 쌍별 노출 ≥ 30이고 `cant_tell` 비율 > 30%면 `stats.flag='low_discrimination'` + 선택 후보에서 자동 제외. 운영자가 ADM-08에서 복원 가능 |
| 문항 제목 | 모든 A/B: "어느 쪽이 더 마음에 드나요?" 고정. 바뀐 부분 강조·화살표·축 이름 표시 금지 |

### 2.4.5 사전 렌더 사양

| 항목 | 데스크톱 자산 | 모바일 자산 |
|---|---|---|
| 렌더 뷰포트 | 1280×800, DPR 1 | 390×780, DPR 2 |
| 출력 | WebP q=80, 1280×800 | WebP q=78, 780×1560 |
| 용량 상한 | ≤ 140KB/장 | ≤ 160KB/장 |
| 사용 조건 | 화면 폭 ≥ 768px | 화면 폭 < 768px |
| 렌더 조건 | Playwright, `document.fonts.ready` + 500ms, `prefers-reduced-motion: reduce`, 애니메이션 정지, 서체는 03장 자체 호스팅 파일 | 동일 |

- 경로 = `survey-assets/<taxonomy_version>/<sha256>.webp`(기기별 2벌이 각각 다른 sha256), Storage 공개·불변·캐시 1년(06장).
- 같은 기기 안에서는 모든 문항이 같은 뷰포트 자산을 쓴다(혼합 금지).
- 메타(R-07): `alt_text`(2.4.6), `dominant_colors` = 데스크톱 자산을 OKLab k-means(k=8, seed 고정)로 묶은 뒤 면적 상위 3색 대문자 HEX(01장 D-0111), `focus_region` = 2.3.6 규칙.
- 총량: 카드 48×2 + A/B 이미지 120×2 + 앵커 참조 25(데스크톱만) = 361파일. 문항당 전송 ≤ 4×160KB = 640KB, 다음 문항 이미지는 응답 직후 선로딩(01장).
- `pnpm survey:build`(09장)가 렌더→추출(x_card)→게이트→업로드→`survey_items` upsert를 멱등 수행한다. `manifest.lock.json`에 id→sha256·x_card를 기록한다.

### 2.4.6 대체 텍스트·접근성

`alt_text`(R-07) 형식: "선택지 {n}: {템플릿 설명}, {축 서술 3개}"(5~120자). 축 서술은 x_card를 2.2 표시용 구간으로 바꿔 고정 사전에서 가져온다(예: A3 L4 → "모서리가 아주 둥근"). 유형명·평가어("세련된" 등) 금지. 이미지 로드 실패 시 alt 표시 + 선택 가능(07장 TC-E-14).

### 2.4.7 자극물 수명주기

`draft`(렌더됨) → `verified`(자동 게이트: 하드 게이트 통과, 린터 error 0, 05장 왕복 오차 기준) → `active`(운영자 승인 B12. temp 모드는 자동 승인) → `retired`(시즌 교체·품질 감시). 문항 선택은 `active`만 사용한다. 신규·교체 카드는 첫 시즌 동안 explore 슬롯(2.6.1)에서만 노출할 수 있게 `stats.explore_only=true`를 둘 수 있다(Phase 2 운영 옵션, MVP 기본 false).

---

## 2.5 갱신 알고리즘 (D-12)

### 2.5.1 모델

- 사용자 이상점 θ ∈ [0,1]^5, 사후분포 θ ~ N(μ, diag(σ²)).
- 이미지 i의 실측 벡터 x_i. 효용(이상점 모델): u_i(θ) = −Σ_k λ_k (x_ik − θ_k)².
- 같은 문항의 모든 선택지에서 −λ_k θ_k² 항은 공통이므로 선택 확률은 θ에 대해 선형 로짓이 된다:
  - z_ik = 2 λ_k x_ik, b_i = −Σ_k λ_k x_ik², u_i ≡ z_i·θ + b_i (상수 제외)
- 선택 확률(다항 로짓): P(c | θ, S) = exp(β u_c) / Σ_{j∈S} exp(β u_j), β = 8, λ_k = 1.
- 사전: μ0 = 2.8의 용도 사전(없으면 0.5), σ0 = 0.25.

### 2.5.2 1-step 근사 갱신 (가정밀도 Laplace/ADF)

응답 직전 사후 (μ, σ²)에서:

```
p_j  = softmax_j( β (z_j·μ + b_j) ),   j ∈ S
z̄_k  = Σ_j p_j z_jk
g_k  = β (z_ck − z̄_k)                                  # 로그우도 기울기
H_kk = β² ( Σ_j p_j z_jk² − z̄_k² )                     # Fisher 정보 대각
σ'_k² = 1 / ( 1/σ_k² + H_kk )
μ'_k  = clip( μ_k + σ'_k² · g_k , 0, 1 )
```

- "고른 쪽으로 이동·안 고른 쪽에서 멀어짐"은 g = β(z_c − z̄)에 들어 있다. 학습률은 σ'² 자체이며 정보가 쌓일수록 작아진다.
- H는 선택 결과와 무관하므로 σ는 응답 내용과 관계없이 제시된 선택지에 따라서만 줄어든다(종료 판정이 응답 조작에 흔들리지 않음).
- 수치 규칙: softmax는 최댓값을 빼고 계산, 모든 연산 float64, 결과 저장 시 소수 6자리 반올림. 반올림 값이 재생의 입력이 되지 않도록 엔진 내부 상태는 반올림하지 않는다.

### 2.5.3 의사코드

```ts
function updateMNL(post: Posterior, X: Vec5[], chosen: number, beta: number, lam: Vec5): Posterior {
  const z = X.map(x => x.map((v, k) => 2 * lam[k] * v));
  const b = X.map(x => -x.reduce((s, v, k) => s + lam[k] * v * v, 0));
  const util = z.map((zi, i) => beta * (dot(zi, post.mu) + b[i]));
  const p = softmax(util);
  const mu = [...post.mu] as Vec5, v = [...post.var] as Vec5;
  for (let k = 0; k < 5; k++) {
    const zbar = sum(p.map((pj, j) => pj * z[j][k]));
    const ez2  = sum(p.map((pj, j) => pj * z[j][k] ** 2));
    const H = beta ** 2 * (ez2 - zbar ** 2);
    const g = beta * (z[chosen][k] - zbar);
    v[k]  = 1 / (1 / post.var[k] + H);
    mu[k] = clamp(post.mu[k] + v[k] * g, 0, 1);
  }
  return { mu, var: v };
}
```

### 2.5.4 응답 유형별 처리

| 응답 | 대상 | μ·σ 처리 | 부수 상태 | 일관성 계산 | 문항 예산 |
|---|---|---|---|---|---|
| 선택(`option`) | 4지 | `updateMNL(S, c, β)` | — | 포함 | 1 소모 |
| 선택(`option`) | A/B | `updateMNL(S={A,B}, c, β)` | — | 포함 | 1 소모 |
| 다 별로예요(`none_of_these`) | 4지 | 변경 없음(07장 TC-E-01·GS-25와 일치. "4장 모두 싫음"은 이상점 위치에 대한 증거가 약하고 방향이 모호해 갱신하면 잡음만 늘어남) | `none_streak` +1, `last_none_mean` = 4장 실측 평균 x̄_S. 다음 1단계 문항은 "x̄_S와 거리 ≥ 0.35인 카드 ≥ 2장" 제약 추가. 세션 누적 3회째부터 다음 1단계 문항은 explore 정책(2.6.1) | 제외 | 1 소모 |
| 차이를 모르겠어요(`cant_tell`) | A/B | 변경 없음 | `insensitive[k]` +1(k = 그 쌍의 대상 축). 1회: 같은 축 재질문 시 Δ 최대 쌍(0.2,0.8)만 허용. 2회: 축 상태 `insensitive` → 이후 A/B 대상에서 제외, 종료 판정에서 확정으로 간주, 생성 시 이 축은 04장 용도 기본값 사용 | 제외 | 1 소모 |
| 검증 문항 응답(`check`) | A/B | 변경 없음(같은 증거 이중 계산 방지) | `check` = consistent / inconsistent / cant_tell | ±0.05 보정(2.9) | 1 소모 |
| 뒤로(`back`) | 전체 | 직전 응답 1건 `superseded=true` → 남은 로그 재생으로 상태 재계산 | 같은 seq 문항을 같은 선택지·같은 위치로 다시 표시(seed 결정론), 이전 선택을 선택 상태로 표시 | 취소분 제외 | 취소분은 예산에서 환원 |

뒤로가기 규칙(D-13 "1단계"):
- 직전 1문항까지만 되돌린다. 되돌린 뒤 새 응답을 하기 전에는 "뒤로"가 비활성(07장 TC-E-09). 브라우저 뒤로가기도 같은 핸들러로 처리한다.
- 첫 문항에서는 비활성. 2단계 첫 문항에서 뒤로 가면 1단계 8번째 문항으로 돌아간다.
- 결과 화면 진입 후에는 뒤로가기로 설문에 돌아가지 않는다(재진단만 가능, 01장).

빠른 응답: latency < 1,000ms 응답이 연속 3회면 클라이언트 안내 1회(01장 문구), `counts.fast` 기록. 갱신 수식은 바꾸지 않는다(가중치 변경 없음 — 수식 단순성 유지). 세션 응답의 50% 이상이 fast면 `flags`에 `fast_answers`를 넣고 신뢰도 표시를 한 단계 낮춘다(2.13).

---

## 2.6 문항 선택 (정보량 기준)

난수는 모두 `seed`에서 파생한다: `rng(seq, attempt) = mulberry32(hash32(seed, seq, attempt))`. 같은 로그 재생 시 같은 문항이 다시 나온다(attempt는 같은 seq를 뒤로가기로 다시 열 때도 증가하지 않는다 — 뒤로가기 후 재표시는 동일 문항).

### 2.6.1 1단계(4지선다, 8문항 고정)

```
template(seq) = ['tpl-hero','tpl-grid','tpl-text'][(seq-1) % 3]
후보 생성: 해당 템플릿의 active 카드 중 4장 조합을 rng로 R=200개 샘플링, 아래 제약 위반 시 버림
  (a) 4장 실측 벡터 쌍별 유클리드 거리 ≥ 0.35
  (b) 4장의 최근접 유형(2.12 판정 함수) 서로 다른 것 ≥ 3
  (c) 직전 문항에 나온 SV 제외
  (d) 1단계 전체에서 SV별 등장 ≤ 3회
  (e) none_of_these 직후면 2.5.4 추가 제약
정책: rng < ε(0.10) 이거나 none_streak ≥ 3 이면 explore = 제약 만족 첫 조합
      그 외 dopt = argmax_S  score(S)
        score(S) = Σ_k log( 1/σ_k² + H_kk(S; μ) )                       # D-최적(대각)
                 + w_type · Σ_{i∈S} | P(i | c_m1, S) − P(i | c_m2, S) |  # 유형 판별 항, w_type = 5.0
        m1, m2 = 현재 μ의 거리 1·2순위 유형, P(·|c,S) = β=8 다항 로짓 확률(2.5.1)을 θ = c로 계산
동점: 조합 ID(카드 ID 정렬 후 결합 문자열) 사전순 첫 번째
제약 만족 후보 0개: (c)(d)(e) 순으로 하나씩 해제해 재시도. (a)(b)는 해제하지 않음
위치: 선택된 4장을 rng 셔플해 slot 0~3 배정
```

- 유형 판별 항은 "현재 가장 헷갈리는 두 유형 중 어느 쪽인지"를 가르는 조합을 우대한다. 03장 3.4.7 중심 기준 사전 시뮬레이션에서 이 항이 없으면 유형형 모집단 β=8 top-1이 0.76~0.85로 R-05 합격선(85%)을 안정적으로 넘지 못했고, w_type = 5에서 0.92로 올랐다(2.16.4).

### 2.6.2 2단계(A/B, 최대 8문항)

```
open = { k : σ_k > 0.08 그리고 상태 ≠ insensitive }
open = ∅ → 종료
k* = argmax_{k∈open} σ_k²          (동점: 축 ID 오름차순)
기준 유형 a = μ의 최근접 유형(2.12 판정 함수). (a, k*)의 승인 쌍이 2개 미만이면 거리 순 다음 유형
후보 = (a, k*)의 승인 쌍 (insensitive[k*]=1이면 (0.2,0.8)만)
선택 = argmax_pair H_k*k*(pair; μ)  (동점: 수준쌍 순서 (0.2,0.5)→(0.5,0.8)→(0.2,0.8))
위치: rng로 A/B 좌우 배정
```

- 직관: 쌍의 두 수준 중점이 현재 μ_k*에 가까울수록 H가 커진다. 즉 사후의 좌우를 가르는 질문을 자동으로 고른다.
- 대상 축 외 축도 실측 x로 함께 갱신된다(통제가 완벽하지 않은 잔차를 그대로 반영).

### 2.6.3 검증 문항(재출제, 최대 1개)

- 2단계 3번째 문항 차례에 종료 조건이 아직 충족되지 않았고 총 응답 수 ≤ 14이면, 2단계 1번째 A/B 쌍을 좌우를 바꿔 다시 제시한다(`kind='check'`, policy `check`).
- 1번째 A/B가 `cant_tell`이었으면 검증 문항을 내지 않는다.
- 검증 문항도 16문항 상한에 포함된다(UX-02, D-13).

---

## 2.7 종료 조건

| 단계 | 규칙 |
|---|---|
| 1단계 | 정확히 8문항(뒤로가기 취소분 제외 유효 응답 8개). 조기 종료 없음 |
| 2단계 | 매 응답 후 판정: ① 모든 축이 `confirmed`(σ ≤ 0.08) 또는 `insensitive` → `converged` ② 유효 응답 16 → `max_questions` |
| 이탈 | "나가기" 또는 `pagehide` 시 `survey_exit` 이벤트(01장 D-0106). 30분 무활동 → `abandoned`. 재방문 시 같은 문항에서 이어하기(01장). 결과 미생성 |

- 진행률(01장 표시): 1단계 `seq/8`, 2단계 `8 + n2` / 16, 종료 시 100%로 이동. 진행률은 감소하지 않는다(뒤로가기 시 숫자는 바뀌어도 바 길이는 최대값 유지).
- 기대 동작(사전 시뮬레이션, 2.16.4): β=8에서 대부분 16문항에 도달하고 조기 종료는 드물다. 문항 수 상한 16과 소요 시간 목표(중앙값 ≤ 4분: 4지 8문항 × 약 15초 + A/B 8문항 × 약 8초 ≈ 3분)는 이 동작에서 충족된다.

---

## 2.8 콜드 스타트

### 2.8.1 사용자: 용도 사전분포(선택 입력)

- 진단 시작 직전(S02 첫 화면, 01장)에 선택 칩 1개를 둔다: "어떤 사이트를 생각하고 있나요? (선택)" — `saas` / `portfolio` / `local_business` / "아직 모르겠어요"(null). 기본값 null, 건너뛰기 가능. 값은 `survey_sessions.purpose_hint`에 저장하고 S06 브리프 입력의 용도 기본값으로 미리 채운다. 정식 용도 입력은 00장 성공 경로대로 결과 이후(S06)다.
- 사전: μ0 = (1 − w)·0.5 + w·c_p, w = 0.3, σ0 = 0.25(모든 축). c_p = 04장 `config/calibration.json`의 용도 중심(단일 원천). null이면 μ0 = 0.5.

| 용도 | c_p(A1..A5, 04장 4.3) | μ0 |
|---|---|---|
| `saas` | 0.40, 0.40, 0.50, 0.55, 0.35 | 0.470, 0.470, 0.500, 0.515, 0.455 |
| `portfolio` | 0.55, 0.50, 0.45, 0.30, 0.30 | 0.515, 0.500, 0.485, 0.440, 0.440 |
| `local_business` | 0.50, 0.70, 0.55, 0.40, 0.25 | 0.500, 0.560, 0.515, 0.470, 0.425 |

- 사전은 약하게 둔다: 사전 시뮬레이션에서 같은 응답 로그를 중립 사전으로 재생했을 때 유형이 바뀐 비율 2.0~3.8%(2.16.4). 기준: 유형 변경률 ≤ 6%(AC-02-22). 넘으면 w를 0.2로 낮춘다(`engine_version` minor).
- 04장이 c_p를 바꾸면 μ0도 같이 바뀌므로 `engine_version` minor를 올리고 V-PRIOR 시뮬레이션을 다시 돌린다.

### 2.8.2 아이템

신규 자극물은 2.4.7 수명주기를 따른다. 사용자 응답 통계가 0이어도 x_card(실측)만으로 문항 선택이 동작한다.

### 2.8.3 시스템

사용자 로그가 0건이어도 전체 진단이 동작한다(E2E). MVP 동안 `survey_answers`·`impressions`는 트렌드 집계·모델 학습·β 추정에 쓰지 않는다(R-35, 05장 D-05A). β·λ의 로그 기반 추정은 Phase 2(2.18).

---

## 2.9 선택 일관성 지수 κ와 보조 강도 (→ 04장)

### 2.9.1 정의

계산 대상 응답 T = `option` 응답(4지·A/B, `check` 제외). ℓ_t = 응답 직전 사후 평균으로 계산한 실제 선택 확률 P(c_t | μ_{t−1}, S_t).

```
L   = mean_t log( ℓ_t · |S_t| )                    # 우연 수준이면 0 근처
κ0  = clip( (L − llChance) / (llRef − llChance), 0, 1 ),  llChance = −0.15, llRef = 0.25
κ   = clip( κ0 + check_adj, 0, 1 ),  check_adj = +0.05(검증 일치) / −0.05(불일치) / 0(없음·cant_tell)
위치 편향(2.10)이면 κ ← 한 구간 아래 상한으로 자름: κ ≥ 0.75 → 0.74, 0.50 ≤ κ < 0.75 → 0.49
|T| < 4 이면 κ = 0, flags += low_signal
```

- κ는 `diagnosis_results.profile.kappa`에 저장하고 04장 `TasteResult.kappa`로 넘긴다.
- 보조 강도 구간과 동작은 04장 4.3 4단계가 단일 원천이다: κ ≥ 0.75 낮음(자유도 높음) / 0.50 ≤ κ < 0.75 보통 / κ < 0.50 높음. 결과 화면 안내 문구는 01장 S03 ②("여러 스타일을 고르게 좋아하는 편이에요…")를 κ < 0.50일 때 표시한다.
- 진단 문항은 16을 넘기지 않는다. κ가 낮다고 문항을 추가하지 않는다(D-13, UX-02).
- 시뮬레이션 기준(07장 값 유지, R-05): 균일 모집단 평균 κ가 β=16 ≥ 0.50, β=2 ≤ 0.25. 사전 시뮬레이션: β=16 0.94, β=8 0.72, β=4 0.38, β=2 0.18.

---

## 2.10 위치 편향 대응

| 장치 | 규칙 |
|---|---|
| 셔플 | 모든 문항의 선택지 위치를 seed 기반으로 무작위 배정, `shown[].slot` 기록 |
| 세션 감지 | 1단계 `option` 응답 중 같은 slot 비율 ≥ 80%(8개 중 ≥ 7, option 응답이 5개 이상일 때만 판정) → `consistency_detail.position_bias=true`, `flags += position_bias`. A/B는 같은 쪽 ≥ 80%(응답 ≥ 5)도 동일 |
| 처리 | 갱신 수식은 바꾸지 않는다(셔플로 위치와 내용이 독립이므로 기대값상 편향 없음). κ를 한 구간 아래로 자름(2.9.1), 그 결과 결과 신뢰도도 낮아짐(2.13.1) |
| 집계 감시 | 주간 slot별 선택률 최대/최소 ≤ 1.3(05장 기준과 동일). 1단계 slot별 선택률이 표본 ≥ 200에서 20~30% 밖이면 운영 경보(01장 레이아웃 재검토) |
| 표시 | 카드 크기·여백 동일, 호버 확대 없음, 선택 시 300ms 확인 애니메이션(01장) |

---

## 2.11 유형 8개 (D-15)

### 2.11.1 유형 표 (`data/taxonomy/types.json`, 09장 B2)

- `id`는 `T1`~`T8`, `slug`는 영문 kebab-case, 앵커 프리셋은 `PS-T1`~`PS-T8`(R-04). 이름·요약·설명·강점·키워드 텍스트의 단일 원천은 이 장이다(R-04). LLM이 생성·변경하지 않으며 "MBTI" 단어를 쓰지 않는다(D-01).
- 중심 벡터 c_T의 단일 원천은 03장 3.4.7이다(R-04). 이 장은 값을 복제하지 않고, `types.json`의 `centroid`는 빌드 시 03장 프리셋 `l1`에서 채운다(`pnpm data:validate`가 일치 검사). 아래 표의 "근접·최원 유형"은 2026-11-17 값으로 계산한 참고 정보다.
- 중심 간 쌍별 유클리드 최소 거리 기준 ≥ 0.45(AC-02-12). 03장 현재 값 0.546(T1–T8).

| id | slug | 이름(nameKo) | 키워드(3) | 앵커 프리셋 | 잘 맞는 용도 | 가장 가까운 유형 | 가장 먼 유형 |
|---|---|---|---|---|---|---|---|
| T1 | calm-editorial | 고요한 에디토리얼형 | 명조, 넓은 여백, 얇은 괘선 | PS-T1 | portfolio, local_business | T8 | T5 |
| T2 | precise-system | 정밀한 시스템형 | 그리드, 각진 모서리, 정보 밀도 | PS-T2 | saas | T8 | T6 |
| T3 | fresh-minimal | 산뜻한 미니멀형 | 둥근 모서리, 밝은 여백, 짧은 문장 | PS-T3 | saas, portfolio | T4 | T5 |
| T4 | cozy-lifestyle | 포근한 라이프스타일형 | 크림색, 둥근 형태, 따뜻한 사진 | PS-T4 | local_business | T6 | T5 |
| T5 | bold-brutal | 대담한 브루탈형 | 굵은 글자, 두꺼운 테두리, 오프셋 그림자 | PS-T5 | portfolio | T7 | T3 |
| T6 | vivid-playful | 생동하는 플레이풀형 | 선명한 색, 알약형 버튼, 겹친 카드 | PS-T6 | local_business, saas | T4 | T1 |
| T7 | crisp-tech | 선명한 테크형 | 어두운 바탕, 반투명 면, 벤토 그리드 | PS-T7 | saas | T2 | T1 |
| T8 | elegant-magazine | 우아한 매거진형 | 큰 제목, 비대칭 배치, 디스플레이 서체 | PS-T8 | portfolio, local_business | T1 | T6 |

### 2.11.2 유형 텍스트

결과 화면 S03 ① 유형 헤더의 "설명 2문장"은 descriptionKo의 앞 2문장을 그대로 쓴다(앞 2문장만으로 뜻이 완결되게 작성). 키워드 3개는 2.11.1 표.

| id | summaryKo(≤60자) | strengthsKo(3개, 각 ≤30자) |
|---|---|---|
| T1 | 글이 주인공인, 숨 쉬는 지면을 좋아해요 | 읽기 편한 긴 글 / 차분한 신뢰감 / 오래 봐도 질리지 않음 |
| T2 | 정보가 질서 있게 맞물린 화면을 좋아해요 | 많은 정보도 한눈에 / 정확하고 믿음직함 / 기능이 잘 드러남 |
| T3 | 가볍고 깨끗한, 부드러운 여백을 좋아해요 | 첫인상이 깔끔함 / 핵심만 빠르게 전달 / 누구에게나 편안함 |
| T4 | 손으로 만진 듯 따뜻하고 둥근 화면을 좋아해요 | 친근하고 다정한 인상 / 공간·물건의 분위기 / 다시 찾고 싶은 느낌 |
| T5 | 규칙을 비트는 굵고 직선적인 화면을 좋아해요 | 강한 기억에 남음 / 개성이 분명함 / 작업물이 돋보임 |
| T6 | 색과 곡선이 통통 튀는 즐거운 화면을 좋아해요 | 즐겁고 활기찬 인상 / 젊은 고객에게 친근 / 행동을 유도함 |
| T7 | 차갑고 매끈한, 깊이감 있는 화면을 좋아해요 | 앞선 기술의 인상 / 제품이 정교해 보임 / 몰입감 |
| T8 | 큰 글자와 대비로 우아하게 말하는 화면을 좋아해요 | 고급스러운 인상 / 이야기가 있는 구성 / 사진·작품이 빛남 |

descriptionKo(200~400자, 고정):

- **T1 고요한 에디토리얼형** — 넉넉한 여백과 절제된 색 속에서 글과 사진이 천천히 읽히는 화면을 편안하게 느끼는 성향이에요. 명조나 단정한 본문 서체, 얇은 구분선, 채도를 낮춘 따뜻한 바탕처럼 눈에 띄지 않는 디테일로 품위를 만드는 쪽을 고르셨어요. 화려한 효과보다 정돈된 리듬과 읽기 좋은 행간이 중요하고, 방문자가 내용을 오래 들여다보게 만드는 사이트와 잘 맞아요.
- **T2 정밀한 시스템형** — 많은 정보가 촘촘하지만 흐트러짐 없이 정렬된 화면에서 신뢰를 느끼는 성향이에요. 차가운 무채색과 한 가지 포인트 색, 각진 모서리, 또렷한 그리드와 표처럼 구조가 드러나는 요소를 고르셨어요. 장식보다 정확함과 효율을 중요하게 보고, 기능과 수치를 분명하게 보여줘야 하는 서비스 소개 페이지와 잘 맞아요.
- **T3 산뜻한 미니멀형** — 꼭 필요한 것만 남긴 깨끗한 화면을 좋아하지만, 차갑게 느껴지지 않도록 부드러운 모서리와 밝은 여백을 함께 고르는 성향이에요. 색은 적게, 글은 짧게, 버튼과 카드는 둥글고 가볍게 표현된 쪽을 선택하셨어요. 처음 방문한 사람도 바로 이해할 수 있는 명료함이 강점이고, 앱·서비스 소개나 간결한 포트폴리오와 잘 맞아요.
- **T4 포근한 라이프스타일형** — 크림색 바탕, 따뜻한 색감, 둥근 형태처럼 손으로 만진 듯한 온기가 있는 화면에 끌리는 성향이에요. 사진 속 공간과 물건의 분위기를 살리고, 부드러운 그림자와 여유 있는 간격으로 편안함을 주는 쪽을 고르셨어요. 방문자가 그곳에 가 보고 싶다고 느끼게 만드는 카페·공방·가게 사이트와 특히 잘 맞아요.
- **T5 대담한 브루탈형** — 굵은 글자, 직각의 면, 강한 대비와 촘촘한 배치처럼 규칙을 비트는 직설적인 화면을 좋아하는 성향이에요. 매끈하게 다듬은 것보다 거칠고 힘 있는 표현, 오프셋 그림자나 두꺼운 테두리 같은 분명한 장치를 고르셨어요. 한 번 보면 잊히지 않는 개성이 강점이고, 작업물과 태도를 함께 보여줘야 하는 포트폴리오와 잘 맞아요.
- **T6 생동하는 플레이풀형** — 선명한 색, 동글동글한 형태, 겹쳐진 요소처럼 보는 것만으로 즐거운 화면에 끌리는 성향이에요. 여러 색을 과감하게 쓰고, 둥근 카드와 입체감 있는 버튼으로 손이 가게 만드는 쪽을 고르셨어요. 친근함과 활기가 강점이라 젊은 고객을 만나는 가게나 가볍게 써 보는 앱 서비스 소개와 잘 맞아요.
- **T7 선명한 테크형** — 차가운 색 위에 레이어와 깊이감이 살아 있는 매끈한 화면에서 정교함을 느끼는 성향이에요. 은은한 다층 그림자, 반투명 면, 적당히 둥근 모서리처럼 제품이 앞에 떠 있는 듯한 표현을 고르셨어요. 기술력과 완성도를 보여줘야 하는 SaaS·앱 소개 페이지에서 특히 강점을 발휘해요.
- **T8 우아한 매거진형** — 아주 큰 제목과 작은 본문이 만드는 대비, 여유 있는 배치와 절제된 장식으로 이야기를 전하는 화면을 좋아하는 성향이에요. 디스플레이 서체와 넓은 여백, 비대칭으로 놓인 사진처럼 잡지 지면 같은 구성을 고르셨어요. 고급스러운 인상과 이야기의 흐름이 강점이고, 작품·브랜드 이야기를 보여주는 포트폴리오나 공간 소개와 잘 맞아요.

`keywords`·`signature_candidates`·`forbidden_combos`는 프리셋 속성이므로 03장 `presets.json`에 둔다(PS-T1~PS-T8).

---

## 2.12 유형 판정·동률·경계·상충

### 2.12.1 판정 함수 (결정론)

```
d_m      = ‖ μ − c_m ‖₂                         (m = T1..T8, 중심 c_m은 03장 3.4.7, R-04)
정렬     : d_m 오름차순. 비교 전 d를 소수 6자리 반올림
1순위 m1, 2순위 m2, margin = d_m2 − d_m1
동률     : margin < 0.01 → is_tie, flags += tie
           타이브레이크 ① 정밀도 가중 거리 d'_m = sqrt( Σ_k (μ_k − c_mk)² / σ_k² ) 가 작은 쪽
                       ② |d'| 차 < 1e-6 이면 types.json 순서(T1 < … < T8)
경계     : margin < 0.05 → is_boundary = true (동률 포함)
type_id_second = m2 (항상 저장, 00장 D-014)
```

판정 함수 `nearestType(v)`는 1단계 후보 제약(2.6.1 (b)), 2단계 기준 유형 선택(2.6.2), 상충 판정(2.12.2)에서 같은 코드를 쓴다.

### 2.12.2 특수 규칙 (적용 순서대로 하나만)

| 순서 | 조건 | 결과 |
|---|---|---|
| 1 | 신호 부족: `option` 응답 < 4 | 판정 함수 결과 그대로(μ ≈ 사전 평균). `flags += low_signal`, 신뢰도 `low`, 결과에 "취향 신호가 부족해요" 안내 + 다시 하기(01장). 시안 생성은 허용(07장 GS-25) |
| 2 | 상충: 1단계 `option` 응답의 선택 카드별 `nearestType(x_card)`를 셀 때, 서로 다른 두 유형 A·B가 각각 ≥ 3회이고 ‖c_A − c_B‖ ≥ 0.60 | 1순위 = {A, B} 중 d가 작은 쪽(같으면 선택 횟수 많은 쪽 → types.json 순서), 2순위 = 나머지. 판정 함수가 제3의 유형을 가리켜도 무시(평균 취향 회피, v1 §8). `flags += conflict`, `is_boundary = true`, 안내 "두 가지 성향이 함께 보여 {A} 기준으로 정리했어요"(07장 GS-28) |
| 3 | 그 외 | 2.12.1 결과 |

- 생성은 항상 1순위 유형의 앵커 프리셋 하나를 닻으로 쓴다(두 유형 평균 금지, → 04장).
- 앵커 자기 판정: 중심 벡터 8개를 그대로 넣으면 각자 자기 유형(07장 TC-E-13).

---

## 2.13 결과 신뢰도 표시 (→ 01장 S03)

### 2.13.1 전체 신뢰도 `type.confidence`

| 값 | 조건 |
|---|---|
| `high` | margin ≥ 0.10 그리고 κ ≥ 0.75 그리고 flags = ∅ |
| `low` | `low_signal` 또는 `conflict` 또는 κ < 0.50 또는 (`fast_answers` 그리고 margin < 0.10) |
| `medium` | 그 외 |

S03 ② 안내 문구 선택(문구 원문은 01장): `low_signal` → 신호 부족 문구 + [다시 진단하기] / `conflict` → "두 가지 성향이 함께 보여 {1순위} 기준으로 정리했어요" / κ < 0.50 → 일관성 낮음 문구 / `is_boundary` → "{1순위}에 가깝고, {2순위} 성향도 있어요". 여러 개가 해당하면 이 순서로 첫 번째 하나만 표시한다. 백분율 표기는 하지 않는다(01장).

### 2.13.2 축 표시

- 점수 = round(μ_k × 100). 양극 막대(레이더 차트 금지), 양 끝 라벨은 01장 1.5.2.1.
- 상태 표시: `open`(σ > 0.08) → 속 빈 원 + 점선 트랙 + "이 축은 아직 확실하지 않아요". `insensitive` → "이 부분은 크게 가리지 않는 편이에요"(01장 문구).
- 불확실 구간 음영 = μ_k ± 1.645·σ_display,k를 [0,1]로 자른 범위(표시 선택 사항, 01장이 쓰면 이 값을 쓴다).
- 화면에 "σ", "벡터", "토큰" 같은 용어를 노출하지 않는다(01장 MC-8).

### 2.13.3 사용자 보정 경로 (R-36)

결과 공감 평가 1~2점이면 `adjacent_type_ids`(거리 2·3순위) 유형 카드 2개를 제안한다(01장 1.5.2.2). 사용자가 하나를 고르면 `anchor_override_type_id`에 저장하고 생성 앵커만 바꾼다. μ·σ·`type_id`는 바꾸지 않는다. 덮어쓰기 비율을 주간 지표로 본다(ADM-08, 목표 ≤ 20%).

---

## 2.14 닮은 사이트 매칭 (R-38: L1 벡터 거리)

| 단계 | 규칙 |
|---|---|
| 후보 | 05장 뷰 `similar_site_candidates`(5.3.9: `status=active` 그리고 `link_allowed`, 현재 released 정규화기의 L1). 원본 테이블은 `reference_sites`(R-18) |
| 점수 | w_k = 1/(σ_display,k² + τ²), τ = 0.05, 합 1로 정규화. s = sqrt( Σ_k w_k (r_k − μ_k)² ), r = 레퍼런스 L1 |
| 선택 | s 오름차순(동점은 레퍼런스 id 사전순)으로 최대 3개. 제약: ① 도메인 중복 0 ② s ≤ 0.45 |
| `match_axes` | 선택된 사이트마다 w_k·(r_k − μ_k)²가 가장 작은 2축(01장 "닮은 축 태그", 쉬운 말 라벨) |
| 부족 | 0~2개만 남으면 남은 수만 표시. 0개면 "아직 비슷한 사이트를 찾지 못했어요"(01장) |
| 출력 | `{title, domain, url, match_axes[2]}` × ≤3(01장 인터페이스). 이미지·로고·파비콘 0, 외부 링크 `rel="noopener noreferrer nofollow"`, 비제휴 고지(08장 8.10.2) |
| 저장 | 계산 시 `diagnosis_results.similar_site_ids` 저장. 표시 시점에 뷰에 여전히 있는지 다시 확인해 없으면 숨김(opt-out 즉시 반영) |
| 시점 | 결과 계산 API 안에서 동기 계산. 임베딩·LLM 호출 없음(R-38) |

---

## 2.15 응답 로그 재생으로 벡터 재계산

```ts
function replay(log, purpose, items, cfg): EngineState {
  let s = initState(log.sessionId, purpose, cfg);
  for (const row of rows.filter(r => !r.superseded).sort(bySeqThenServerTs)) {
    const X = [...row.shown].sort(bySlot).map(o => items.xCard(o.option_id, s.taxonomyVersion));
    s = applyAnswer(s, { kind: row.kind, X, shownIds: row.shown }, toAnswerInput(row), cfg);
  }
  return s;   // finalize(s, types, cfg) 로 TasteProfile 생성
}
```

| 사용처 | 동작 |
|---|---|
| 뒤로가기 | 직전 행 `superseded=true` 후 재생(2.5.4). `diagnosis_sessions.state`는 캐시이며 재생 결과와 6자리 일치해야 함 |
| 새로고침·재방문·기기 변경 | 서버가 로그 재생으로 상태 복원, 같은 seq 문항 재표시(07장 TC-N) |
| 로그인 귀속 | `user_id`만 채우고 재생 불필요. 검증용으로 재생 결과가 저장 프로필과 6자리까지 같아야 함 |
| 시즌 릴리스(05장 SR-7) | 새 시즌 `survey_items` 행의 x_card(같은 id)로 전체 완료 세션 재생 → 새 결과 행(`recomputed_from`). 유형 유지율 ≥ 85% 미달 시 릴리스 보류(05장) |
| 알고리즘 변경(`engine_version` major) | 골든 32케이스 로그(07장, R-11)와 전체 세션 재생 리포트(유형 변경률) 첨부 후 배포 |

- 재생 입력은 로그 행과 `survey_items.x_card`뿐이다. 문항 선택 함수는 재생 중 호출하지 않는다(제시된 선택지는 로그에 있음).
- `survey_items`는 시즌(`taxonomy_version`)별 행으로 x_card 이력을 보존한다(2.3.6). 은퇴 자극물도 행 삭제 금지.
- 사용자가 본 유형이 재생으로 바뀌면 다음 결과 화면 방문 시 1회 "디자인 기준 업데이트로 결과가 조정되었어요" 안내(01장).

---

## 2.16 시뮬레이션 기반 검증

### 2.16.1 시뮬레이터 (`pnpm sim:survey`, `packages/diagnosis/sim/`)

| 항목 | 사양 |
|---|---|
| 엔진 | 실제 `@tastefit/diagnosis` 함수를 그대로 호출(재구현 금지) |
| 자극물 | `survey_items`의 active x_card. temp 모드에서는 target_l1 + U(−0.05, 0.05)(카드), ±0.03(A/B) 잡음, seed 고정 |
| 유형 중심 | 03장 3.4.7(빌드된 `types.json` centroid) |
| 모집단 | P-U: θ* ~ U[0.1, 0.9]^5 / P-C: m ~ U{T1..T8}, θ* = clip(c_m + N(0, 0.10²), 0.02, 0.98) / P-A: θ* = c_m 그대로(유형당 동수) |
| 응답 모델 | 이상점 MNL, β_true ∈ {16, 8, 4, 2}, 엔진과 같은 x 사용 |
| 변형 | V-NONE: 1단계 문항마다 10% `none_of_these`, A/B마다 10% `cant_tell` / V-RAND: 1단계 explore만·2단계 축과 수준쌍 무작위(이득 비교용) / V-PRIOR: 용도 3종 사전 + 같은 로그를 중립 사전으로 재생 |
| 규모 | 조건당 가상 사용자 1,000명, PRNG 시드 20261116 |
| 정답 | 축: θ*. 유형: nearestType(θ*) |
| 산출 | `sim/reports/<date>.json`(07장 AC-07-08) + 같은 이름 `.md`. 조건별 표, 문항 수 대비 RMSE 곡선(1~16) |
| 판정 | 합격선은 `config/thresholds.json`의 `release.surveySim`(R-09)에서 읽는다 |

### 2.16.2 지표와 합격선 (R-05)

| 지표 | 조건 | 합격선(MVP) |
|---|---|---|
| 축 RMSE(μ, θ*) | P-U, β=8 | ≤ 0.12 |
| 축 RMSE | P-U, β=4 | ≤ 0.18 |
| 유형 top-1 | P-C, β=8 | ≥ 85% |
| 유형 top-1 | P-C, β=4 | ≥ 70% |
| 유형 top-1 / top-2 | P-U, β=8 | ≥ 62% / ≥ 85% |
| 앵커 정답 | P-A, β=8, 유형당 20명 × 시드 | ≥ 95%(09장 M4 ④) |
| 불확실성 보정 | P-U, β=8, μ ± 1.645·σ_display 포함률 | 85~95% |
| 일관성 분리 | P-U 평균 κ | β=16 ≥ 0.50, β=2 ≤ 0.25(07장 값) |
| 적응형 이득 | P-U, β=8, V-RAND 대비 | RMSE ≥ 5% 감소 그리고 top-1 ≥ +3%p |
| 사전 영향 | V-PRIOR, 용도별 | 유형 변경률 ≤ 6% |
| 문항 수 | 전 조건 | 최대 16(100%), 1단계 정확히 8 |
| 강건성 | V-NONE, β=8 | RMSE ≤ 0.13, 오류 0 |
| 성능 | `nextQuestion`+`applyAnswer` 1회 | Node p95 ≤ 20ms(1단계 후보 200개 포함) |

미달 시 조정 순서(상수만, `engine_version` minor): ① `typeDiscWeight`(1단계 유형 판별 가중, 범위 2~8) ② consistency 상수(llChance, llRef) ③ calibKappa ④ 1단계 R ⑤ priorWeight ⑥ 브리지 SV 재배치(2.4.2 규칙). β·σ0·sigmaStop·문항 수는 결정 레지스터 값이므로 바꾸지 않는다.

### 2.16.3 실사용 검증 (출시 전후, 비차단 기록)

재검사(지인 n ≥ 15, 6~14일 간격): 유형 일치(경계 결과는 2순위 포함) ≥ 60%, 축별 Pearson r ≥ 0.6. 결과 공감 4점 이상 ≥ 70%(00장 F4). 수치는 07장 7.3.1에 기록한다.

### 2.16.4 설계 시점 사전 시뮬레이션 (참고, 2026-11-18)

03장 3.4.7(2026-11-17 값)의 중심, 2.4.2 브리지, 2.6.1 선택 규칙(w_type = 5)으로 파이썬 프로토타입(같은 수식, 조건당 500명)을 돌린 결과다. 구현 후 `sim:survey`가 공식 수치를 대체한다.

| 조건 | RMSE | top-1 | top-2 | 평균 κ | 90% 포함률(κ_cal=1.3) | 판정 |
|---|---|---|---|---|---|---|
| P-U β=16 | 0.104 | 0.82 | 0.95 | 0.94 | 0.93 | κ PASS |
| P-U β=8 | **0.119** | 0.73 | 0.91 | 0.72 | 0.875 | PASS(RMSE 여유 0.001) |
| P-U β=4 | 0.155 | 0.63 | 0.79 | 0.38 | 0.74 | PASS |
| P-U β=2 | 0.195 | 0.50 | 0.72 | 0.18 | 0.60 | κ PASS |
| P-C β=8 | 0.139 | 0.91 | 0.99 | 0.84 | 0.81 | PASS |
| P-C β=4 | 0.176 | 0.76 | 0.94 | 0.52 | 0.67 | PASS |
| P-A β=8 | 0.138 | **0.946** | 1.00 | 0.88 | 0.82 | 09장 M4 ④(95%) 경계 |
| V-RAND P-U β=8 | 0.126 | 0.68 | 0.88 | 0.70 | 0.91 | 이득: RMSE −5.6%, top-1 +5%p → PASS(여유 작음) |
| V-PRIOR β=8 | — | 유형 변경 saas 2.0%, portfolio 2.2%, local_business 3.8% | — | — | — | PASS |

해석:
1. β=8에서 16문항 전에 σ ≤ 0.08로 끝나는 세션은 0~2%다(정보량 상한). 소요 시간 목표(중앙값 ≤ 4분)는 16문항에서도 충족한다(2.7).
2. 03장 중심은 0.00·1.00 같은 축 끝 값을 포함한다(T1 density·depth 0, T5 expression·density 1, T6 shape 1). 사전분포 0.5 쪽으로 당겨지는 1-step 근사의 수축 때문에 유형형 모집단 RMSE(0.139)가 균일 모집단보다 크다. 유형 판정에는 영향이 작다(top-1 0.91).
3. 유형 판별 항(w_type) 없이 D-최적만 쓰면 P-C β=8 top-1 0.85, P-A 0.86으로 R-05 85% 경계, 09장 95% 미달이었다. 브리지를 축 끝(0.05/0.95)까지 넓히면 σ가 과소추정되어 포함률 0.80, P-C top-1 0.76으로 나빠졌다. 그래서 브리지를 [0.15, 0.85]로 제한했다.
4. 여유가 작은 항목: P-U β=8 RMSE(0.119/0.12), 적응형 이득(5.6%/5%), P-A 앵커 정답(94.6%/95%). 1,000명 공식 실행에서 미달하면 2.16.2 조정 순서를 따른다.

---

## 2.17 수용 기준

| ID | 기준 |
|---|---|
| AC-02-01 | `types.json`·`config/thresholds.json`(`diagnosis` 객체)·`templates.json`·`card_plan.json`·`ab_plan.json`이 zod 검증을 통과하고, 축 5(R-01 키), 유형 8(텍스트는 2.11, centroid는 03장 3.4.7과 일치), SV 16, 카드 48, A/B 쌍 120이다. |
| AC-02-02 | Given 사전 (μ=0.5, σ=0.25), When 4장 중 x_c의 A3가 가장 큰 카드를 선택, Then μ_A3 증가, 모든 축 σ' ≤ σ. |
| AC-02-03 | 모든 `option` 응답 후 각 축 σ는 증가하지 않는다(1,000 무작위 시퀀스 속성 테스트). |
| AC-02-04 | `none_of_these`·`cant_tell`·`check` 응답은 μ·σ를 바꾸지 않는다(07장 TC-E-01). |
| AC-02-05 | 범주형 L2 값을 평균하는 코드 경로 0(정적 검사: 카드 생성 경로는 03장 `mapL1toL2`만 호출) 그리고 같은 입력의 카드 L2가 100회 동일. |
| AC-02-06 | 같은 응답 집합을 무작위 순서로 50회 재생했을 때 최종 μ의 축별 최대 차이 ≤ 0.05. |
| AC-02-07 | 시즌 릴리스 전 커버리지 검사(2.4.2)가 자동 실행되고 미달 시 종료 코드 1. |
| AC-02-08 | 설문 화면에 쓰이는 이미지 URL은 100% `survey-assets` 버킷 경로이며 레퍼런스 스크린샷 경로 0(빌드 산출물·API 응답 검사). |
| AC-02-09 | 같은 문항의 이미지들은 렌더 DOM 텍스트와 이미지 src 집합이 동일하다(빌드 시 DOM diff 0). |
| AC-02-10 | 데스크톱 자산 ≤ 140KB, 모바일 자산 ≤ 160KB, 규격 1280×800 / 780×1560 위반 0. |
| AC-02-11 | 갱신 입력은 `x_card`다(target_l1을 바꿔도 결과 불변, x_card를 바꾸면 결과 변함 — 단위 테스트). |
| AC-02-12 | 03장 3.4.7 유형 중심의 쌍별 최소 거리 ≥ 0.45(미달 시 03장에 보고), 중심 8개 입력 시 자기 유형 판정 8/8, 브리지 SV가 2.4.2 규칙 1~3을 만족. |
| AC-02-13 | 1단계는 정확히 8문항이고 각 문항이 2.6.1 제약 (a)(b)를 만족한다(시뮬레이션 1,000세션 전수 검사). |
| AC-02-14 | 2단계 대상 축은 항상 open 축 중 σ 최대 축이며, insensitive 축은 다시 묻지 않는다. |
| AC-02-15 | 유효 응답이 16에 도달하면 다음 문항 요청이 null을 반환하고 결과가 생성된다(07장 TC-E-11). 모든 축 confirmed/insensitive가 되는 즉시 종료(TC-E-10). |
| AC-02-16 | 뒤로가기: 직전 1건만 취소, 연속 2회 불가, 재표시 문항의 선택지·위치가 원래와 동일, 재생 μ가 "취소 응답이 없던 로그"의 μ와 6자리 동일. |
| AC-02-17 | 같은 `(session_id, question_id)` 중복 제출은 1행만 저장(07장 TC-E-07). |
| AC-02-18 | 응답 로그 재생 결과(μ, σ, type_id, type_id_second, κ)가 저장 프로필과 소수 6자리까지 동일(전체 세션 대상 야간 배치에서 불일치 0). |
| AC-02-19 | 상충 시나리오(07장 GS-28)에서 1순위는 두 유형 중 하나, `flags`에 conflict, 생성 요청의 닻은 1순위 앵커 하나. |
| AC-02-20 | 동률 시나리오(GS-29) 10회 재생 결과 동일, `flags`에 tie, `is_boundary=true`. |
| AC-02-21 | 1단계 8문항 모두 같은 slot 선택 시 `consistency_detail.position_bias=true`·`flags`에 position_bias, 셔플 seed가 세션에 저장(TC-E-02). |
| AC-02-22 | 2.16.2의 모든 합격선을 `sim:survey` 리포트가 충족한다(G2 게이트). |
| AC-02-23 | 진단 진행 중 LLM·렌더러·추출기 호출 0(스파이 테스트). |
| AC-02-24 | `nextQuestion`+`applyAnswer` p95 ≤ 20ms, 응답 제출 API p95 ≤ 300ms(06장). |
| AC-02-25 | 결과에 `type_id`, `type_id_second`, `adjacent_type_ids`, `is_boundary`, `confidence`, R-01 키 5축 μ·σ·σ_display, `kappa`, `insensitive_axes`, 버전 4종(2.0)이 모두 있다. |
| AC-02-26 | 닮은 사이트는 `similar_site_candidates` 뷰에서만 읽고, 도메인 중복 0, 뷰에 없는 레퍼런스 노출 0, s > 0.45 노출 0, 항목마다 `match_axes` 2개, 비제휴 고지가 함께 표시된다. |
| AC-02-27 | 결과 텍스트(이름·요약·설명·강점)가 `types.json` 문자열과 바이트 동일하고 "MBTI" 0건. |
| AC-02-28 | 2단계 A/B 쌍 중 출시 후 노출 ≥ 30 그리고 cant_tell > 30%인 쌍은 다음 문항 선택에서 제외된다(통합 테스트). |
| AC-02-29 | 용도 힌트가 null이면 μ0 = 0.5, 각 용도면 2.8.1 표의 μ0(6자리). |
| AC-02-30 | `packages/diagnosis`에 2.0 상수(`config/thresholds.json`)의 리터럴 하드코딩 0(린트 규칙: config 키 목록의 숫자와 같은 리터럴 금지, 예외 0·1·0.5 clamp용). |
| AC-02-32 | 트렌드 집계 모듈이 `survey_answers`·`impressions`를 import·조회하지 않는다(R-35, 05장 AC-05-28과 같은 린트). |
| AC-02-33 | 1단계 문항 점수가 2.6.1 식(D-최적 + w_type 유형 판별 항)과 일치한다(고정 상태 10개에 대한 골든 값 단위 테스트). |
| AC-02-31 | 이벤트 `survey_answer`(00장 §8.3 + 01장 D-0106 확장 필드)의 `answer` 값과 `survey_answers.answer` 값 집합이 같다(`option`/`none_of_these`/`cant_tell`), `sigma_max_after` = 응답 후 max_k σ_k, `chosen_position` = `shown`에서 선택 항목의 slot. |

---

## 2.18 MVP / Phase 구분

| 항목 | MVP(P0) | Phase 2 | Phase 3 |
|---|---|---|---|
| 축 | L1 5축 | 축 간 상관 반영(완전 공분산 사후) | — |
| 응답 | 4지·A/B·다 별로·모르겠음·뒤로 1단계 | 모바일 2장 토너먼트형 1단계 A/B 실험 | — |
| 파라미터 | β=8, λ=1 고정 | 로그 기반 β·λ MLE 보정(β 허용 4~16), 사용자별 β를 일관성으로 사용 | — |
| 유형 | 8개 | 유형당 프리셋 2~3개 | 16개 |
| 자극물 | 카드 48, A/B 120쌍, 사전 렌더 | 시즌별 교체·트렌드 풀 비율 운영(05장) | — |
| 피드백 반영 | 진단 프로필만 사용 | 생성 후 선택·편집을 "용도별 조정 프로필"로 별도 저장(진단 프로필 불변) | 자연어 편집 반영 |
| 슬라이더 응답 | MVP 제외 | MVP 제외 | 편집 화면에서만(D-16) |

---

## 2.19 추가 결정

| ID | 결정 | 이유 | 영향 장 | 상태 |
|---|---|---|---|---|
| D-0201 | 진단 시작 화면(S02 첫 화면)에 선택형 용도 힌트 칩(`purpose_hint`)을 둔다. 정식 용도 입력은 결과 이후 S06이며 힌트로 미리 채운다. | 콜드 스타트 사전분포(D-12 "용도별 약한 사전" 허용)를 쓰려면 진단 전에 값이 필요. 선택형이라 퍼널 부담 최소 | 01, 04, 06 | 유효(01·06장 반영 필요) |
| D-0202 | 1단계 카드 48장 = 기준 벡터 16개 × 템플릿 3 | 커버리지 | 03, 05, 09 | → R-06로 대체 |
| D-0203 | 유형 정확도 합격선(유형형 모집단 기준) | 16문항 정보량 한계 | 07 | → R-05로 대체 |
| D-0204 | 문항 수 기준은 최대 16·1단계 8만 게이트 | 조기 종료 드묾 | 07, 00 | → R-05로 대체 |
| D-0205 | 적응형 이득 RMSE ≥ 5% + top-1 ≥ +3%p | 고정 풀 제약 | 07 | → R-05로 대체 |
| D-0206 | A/B 수준 {0.2, 0.5, 0.8} | 장 간 불일치 해소 | 05 | → R-06로 대체 |
| D-0207 | 표시·보정 평가용 σ_display = 1.3 × σ. 종료 판정과 04장 입력은 엔진 σ | 1-step 근사의 불확실성 과소추정 보정(포함률 0.76 → 0.875) | 01, 07 | 유효 |
| D-0208 | 유형 ID `T1`~`T8` + slug, 앵커 `PS-T1`~`PS-T8` | 식별자 통일 | 03, 07, 09 | → R-04로 대체 |
| D-0209 | 용도 enum·응답 테이블명 통일 | 식별자 통일 | 06~09 | → R-02, R-18로 대체 |
| D-0210 | 설문 가상 브랜드 "한결"(업종 표현 없음) | 업종 연상 오염 방지 | 09 | → R-08로 대체 |
| D-0211 | "다른 유형 보기" = `anchor_override_type_id`, μ 불변 | 이탈 방지·재검사 신뢰도 | 01, 04 | → R-36로 대체 |
| D-0212 | 1단계 문항 점수에 유형 판별 항(w_type = 5.0, `diagnosis.stage1.typeDiscWeight`)을 더한다(2.6.1). | 03장 3.4.7 새 중심에서 D-최적만으로는 R-05 유형 정확도·09장 앵커 정답 기준에 미달(2.16.4) | 07, 09 | 신규 |
| D-0213 | 브리지 기준 벡터는 [0.15, 0.85], 기준 유형은 L∞ 최근접(≤ 0.45)으로 배치하고 03장 3.4.7이 바뀌면 2.4.2 규칙으로 다시 배치한다. | 축 끝 브리지는 σ 과소추정과 유형 정확도 하락을 일으킴(2.16.4) | 03, 05, 09 | 신규 |
| D-0214 | 진단 상수는 `config/thresholds.json`의 평면 키(beta, sigma0, sigmaStop, maxQuestions) + `diagnosis` 객체, 시뮬레이션 합격선은 `release.surveySim` 객체에 둔다. | R-09 단일 원천 안에서 키 위치 확정 | 07, 09 | 신규 |

---

## 2.20 다른 장과 맞출 인터페이스

| 인터페이스 | 이 장의 정의 | 상대 장 | 맞출 내용 |
|---|---|---|---|
| `TasteProfile`(2.3.1) → `TasteResult {mu, sigma, kappa, insensitive_axes, type_id, anchor_override_type_id?}` | 확정 | 04 | 04장 4.3 입력 이름과 일치(확인됨) |
| `diagnosis_sessions.purpose_hint`, `versions`(키 4종: taxonomy·normalizer·engine·axis_set) | 2.0, 2.3.2 | 06 | 06장 DDL 주석 "버전 5종" → 4종으로 정정 필요(R-30으로 시즌 ID 하나가 자극물·유형 버전을 겸함) |
| `survey_answers` 컬럼(question_id, kind, item_id, shown, policy, propensity, superseded, ux) | 2.3.3 | 06 | 06장 최종 DDL과 일치(확인됨) |
| `diagnosis_results`(profile, anchor_override_type_id, recomputed_from, similar_site_ids) | 2.3.5 | 06, 01 | 06장 최종 DDL과 일치(확인됨). 01장 D-0102의 `taste_results` 표기 → `diagnosis_results`로 정정 필요 |
| `survey_items`(ID 규칙, kind 4종, axis = R-01 키, assets 2벌, alt_text, dominant_colors HEX 3개, focus_region, status) | 2.3.6 | 06, 01 | 06장 최종 DDL과 일치(확인됨) |
| `impressions` 테이블 | 2.3.4 | 06, 05 | 06장 최종 DDL과 일치(확인됨). 05장은 미참조(R-35) |
| 엔진 `update(state, answer)` = `applyAnswer` → `nextQuestion` | 2.3.1 | 06 | 06장 6.2.2 호출 이름과 일치 |
| 유형 중심 = 03장 3.4.7, 텍스트 = 2.11 | R-04 | 03, 07, 09 | 09장 B2 `TypeDef`에 `slug`, `keywordsKo[3]` 필드 추가 필요 |
| 자극물 계획(SV 16, 카드 48, A/B 120, 템플릿 3, 렌더 사양) | 2.4 | 03, 05, 09 | 09장 B10을 SV 16 × 템플릿 3으로(R-06), B9 브랜드 "한결"(R-08) |
| 1단계 유형 판별 항, 브리지 배치 규칙 | 2.6.1, 2.4.2 | 07, 09 | D-0212, D-0213 |
| 용도 사전 c_p = 04장 `config/calibration.json` | 2.8.1 | 04 | 04장 값 변경 시 V-PRIOR 재실행 |
| κ 구간(0.75 / 0.50)과 보조 동작 | 04장 4.3 | 04, 01 | 이 장은 κ만 산출 |
| 닮은 사이트 입력 `similar_site_candidates`, 출력 `{title, domain, url, match_axes[2]}` | 2.14 | 05, 01 | 확인됨 |
| 이벤트 `survey_answer`(00장 §8.3 + 01장 D-0106 확장), `survey_back`, `survey_exit`, `survey_complete`, `result_view` | 2.3.3, 2.5.4 | 00, 01 | `answer` 값 집합 동일, `sigma_max_after` = 응답 후 max σ |
| 시뮬레이션 리포트 `sim/reports/<date>.json`, 합격선 `release.surveySim` | 2.16 | 07, 09 | 07장 AC-07-08의 `qa/thresholds.yaml` 표기 → R-09에 따라 교체 필요 |

---

## 2.21 반영 추적

| 리뷰 ID | 심각도 | 반영 절 |
|---|---|---|
| AI-01 | Blocker | 2.1, 2.2, 2.3.1 (6축 → D-10 5축, L2 범주는 확률분포 대신 유형 허용 목록 선택) |
| AI-02 | Blocker | 2.5 (슬라이더 갱신은 D-16에 따라 MVP 제외, 범주형 Dirichlet 대신 유형 판정) |
| AI-03 | Blocker | 2.6, 2.7, 2.16 (문항 수는 D-13, 합격선은 사전 시뮬레이션으로 재설정) |
| AI-07 | Major | 2.11, 2.12, 2.13 |
| AI-08 | Major | 2.8 |
| AI-09 | Major | 2.0 버전, 2.15 |
| AI-10 | Major | 2.4.1 S-05, 2.4.2, 2.4.7 |
| AI-15 | Major | 2.3.4, 2.10 |
| AI-17 | Major | 2.9 |
| AI-20 | Minor | 2.14 |
| AI-24 | Minor | 2.18 |
| PD-01 | Blocker | 2.1 |
| PD-03 | Blocker | 2.11, 2.12 (D-15에 따라 16유형 → 8유형, 4글자 코드 대신 거리 판정) |
| PD-06 | Blocker | 2.4 |
| PD-08 | Major | 2.5~2.9 (단순 규칙 대신 D-12 가우시안 사후) |
| QA-03 | Blocker | 2.5, 2.15, 2.17 |
| QA-08 | Major | 2.5.4, 2.10, 2.12.2, 2.17 |
| QA-18 | Major | 2.11, 2.12, 2.14 |
| UX-04 | Major | 2.5.4 ("다 별로" 갱신은 07장 TC-E-01과 맞춰 갱신 없음 + 다음 문항 제약) |
| UX-13 | Major | 2.4.4 |
| UX-03 | Blocker(부분: 통제·렌더) | 2.4.3, 2.4.5 (기기별 화면 배치 → 01장) |
| UX-07 | Major(부분: 신뢰도·유형 텍스트) | 2.11.2, 2.13 |
| R-01 축 키 | 결정 v2 | 2.1.1, 2.3 (JSON·코드 키 `expression`·`temperature`·`shape`·`density`·`depth`) |
| R-02 용도 코드 | 결정 v2 | 2.3.2, 2.8.1 (`local_business`) |
| R-04 유형 ID·중심 원천 | 결정 v2 | 2.4.2(SV01~08 = 03장 3.4.7 인용), 2.11.1(중심 복제 제거, 텍스트는 이 장), 2.16.4(새 중심으로 재시뮬레이션) |
| R-05 시뮬레이션 합격선 | 결정 v2 | 2.16.2 |
| R-06 카드 풀·A/B 구성 | 결정 v2 | 2.4.2, 2.4.4 |
| R-07 자극물 이미지·메타 | 결정 v2 | 2.3.6, 2.4.5, 2.4.6 (`alt_text`, `dominant_colors`, `focus_region`) |
| R-08 가상 브랜드 | 결정 v2 | 2.4.3 |
| R-09 임계값 단일 원천 | 결정 v2 | 2.0 (`config/thresholds.json`), 2.16.1 |
| R-11 골든 32케이스 | 결정 v2 | 2.15 |
| R-18 테이블명 | 결정 v2 | 2.3 (`survey_answers`, `survey_items`, `reference_sites` 경유 뷰) |
| R-19 화면 ID | 결정 v2 | 2.0, 2.8.1, 2.13 (S02·S03·S06) |
| R-23 이벤트 | 결정 v2 | 2.7, AC-02-31 |
| R-30 시즌 ID | 결정 v2 | 2.0 (`taxonomy_version`·`normalizer_version` = `YYYY-S{n}`) |
| R-35 사용자 로그 미사용 | 결정 v2 | 2.3.4, 2.8.3, AC-02-32 |
| R-36 다른 유형 보기 | 결정 v2 | 2.13.3 |
| R-38 닮은 사이트 = L1 거리 | 결정 v2 | 2.14 |
