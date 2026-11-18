# 05. 레퍼런스·트렌드 데이터

이 장은 실제 웹사이트 레퍼런스 데이터셋(수집·저장·특징 추출·라벨·정규화)과 트렌드 측정(정의·리포트·시즌 릴리스·Phase 2 자동 감지)을 정의한다. 진단 갱신식·유형 판정·닮은 사이트 선택은 → 02장, L2 택소노미·프리셋 토큰·유형 중심 벡터(3.4.7)는 → 03장, 취향 일치도 판정은 → 04장, DDL·잡 큐·버킷·ingest CLI 실행 환경은 → 06장, 원본 유사도 가드 규칙·약관·개인정보·보관 기간 정책 원문은 → 08장을 따른다. 장 간 충돌은 통합 결정 R-01~R-38(decisions_v2)이 우선한다.

## 5.0 범위와 단계 구분

| 기능 | MVP(P0) | Phase 2 | Phase 3 |
|---|---|---|---|
| 시드 레퍼런스 60개 수동 큐레이션 + 사람 라벨 | P0 | 활성 세트 60→최대 150 | — |
| 특징 추출기(원시 특징 → L1 5축) 단일 코드 경로 | P0 | 모바일 375 캡처 추가 | 모션 특징 |
| 비전 태깅(3회 중앙값) | P0 (레퍼런스 전용) | 생성물 채점 편입은 04장 판단 | — |
| 추출기 자기검증(프리셋 왕복) | P0 | — | — |
| 축 정규화기 시즌 고정 | P0 | — | — |
| 월간 수동 트렌드 리포트 | P0 | 자동 집계로 대체 | — |
| 분기 시즌 릴리스 | P0 (수동 체크리스트) | 반자동 | — |
| 소스별 자동 수집(크롤러가 목록 페이지 접근) | **MVP 제외** | P2 (약관 확인 소스만) | — |
| 급등 감지·생애 단계·확산 지연 자동 계산 | **MVP 제외** | P2 | — |
| 이미지 임베딩 계산·저장, 임베딩 군집(새 스타일 발견) | **MVP 제외**(R-38) | P2 | — |
| 원본 유사도 비교용 pHash·7속성 시그니처 저장 | P0(R-20) | 임베딩 추가 | — |
| 사용자 선택 로그의 트렌드 신호 사용 | **MVP 제외** (코드로 금지) | P2 (IPS 보정 + 동의) | — |
| 트렌드 리포트 외부 공개 | **MVP 제외** (내부용) | 법무 확인 후 | — |

용어:
- **레퍼런스(reference)**: 실제 공개 웹사이트 1개(등록 도메인 eTLD+1 단위 1건). 사용자에게는 결과 화면 "닮은 사이트" 텍스트 링크로만 노출된다(D-14, D-50).
- **관측(observation)**: 월간 트렌드 리포트용으로 수집했지만 시드(활성 세트)에 들지 않은 레퍼런스. 사람 축 라벨이 없다.
- **활성 세트(active set)**: 해당 시즌 정규화기의 기준 코퍼스. MVP 최초 시즌은 시드 60개와 같다.
- **L1 축**: D-10의 A1~A5. 코드 키는 R-01을 따른다.
- **티어 vs 유형 표기**: 이 장에서 "티어 T1~T3"은 `reference_sites.tier` 값(선도·확산·대중층)이고, "유형 T1~T8"은 R-04의 디자인 성향 유형 ID다. 혼동을 막기 위해 유형은 항상 "유형 T#", 앵커 프리셋은 `PS-T#`로 쓴다.
- **용도 코드**: `saas`·`portfolio`·`local_business`(R-02).
- **테이블 이름**: 레퍼런스 테이블의 물리 이름은 `reference_sites`(R-18). 이 장의 "레퍼런스"는 이 테이블의 행이다.

| L1 | 코드 키 | 0 | 1 |
|---|---|---|---|
| A1 표현성 | `expression` | 미니멀 | 표현적 |
| A2 온도 | `temperature` | 차가움 | 따뜻함 |
| A3 형태 | `shape` | 날카로움 | 부드러움 |
| A4 밀도 | `density` | 여유 | 밀도 |
| A5 깊이 | `depth` | 평면 | 입체 |

"클래식↔트렌디"는 축이 아니며 레퍼런스의 `era` 메타데이터와 시즌 ID로 관리한다(D-10).

## 5.1 레퍼런스 데이터의 역할과 다른 자산과의 관계

### 5.1.1 데이터 흐름

```
[레퍼런스 60(실제 사이트, 비공개)]
   │ capture → extractL2() → 원시 특징 F
   │ 사람 라벨 y(5축, L2, 유형)
   ├─▶ (a) 매핑 가중치 학습 + 정규화기(시즌 고정)  ──▶ toL1()  ── 모든 객체에 공통 적용
   ├─▶ (b) 유형별 특징 분포 = 프리셋 토큰 근거 리포트(→03장, 3도메인 이상 집계, D-31)
   ├─▶ (c) "닮은 사이트" 후보(링크 허용 플래그가 있는 것만, L1 가중 거리로 선택 →02장 2.14, R-38)
   ├─▶ (d) 원본 유사도 가드 비교 집합(pHash + 7속성 시그니처, 규칙·임계값 →08장 8.3, 실행 →04장, R-20)
   └─▶ (e) 트렌드 리포트(관측 포함, 내부용)

[앵커 프리셋 PS-T1~PS-T8 + 브리지 기준 벡터(02장)] ─ 고정 콘텐츠 템플릿(가상 브랜드 "한결")에 렌더
   ─▶ [1단계 카드 48 = 기준 벡터 16 × 템플릿 3, 2단계 A/B 120쌍(수준 {0.2, 0.5, 0.8}), 앵커 이미지 25장] (R-06)
   └─ extractL2() → toL1() → x_card (설문 갱신에 사용, →02장)

[생성 후보(04장)] ─ 렌더 ─▶ extractL2() → toL1() → v(d) (취향 일치도, →04장)
```

### 5.1.2 규칙

| ID | 규칙 |
|---|---|
| RD-01 | 설문 자극물은 실제 사이트 스크린샷을 쓰지 않는다. 카드와 A/B 이미지는 프리셋 토큰으로 렌더한 오리지널이다(D-14). 레퍼런스 스크린샷은 어떤 사용자 응답에도 포함되지 않는다(D-31). |
| RD-02 | 레퍼런스, 프리셋 렌더, 설문 자극물, 생성 후보의 측정 L1 벡터는 모두 같은 함수 `extractL2()` → `toL1(F, normalizerVersion)`로 계산한다. 코드 경로는 `packages/extractor` 1곳이며 이 패키지는 `packages/llm`에 의존하지 않는다(09장 9.1.3). 비전 태깅은 ingest CLI가 별도로 호출한다. 03장 `predictL1`(L2 → 의도 L1)은 다른 함수이며, 두 값의 차이는 5.9로 관리한다(D-0302). |
| RD-03 | 설문 갱신에 쓰는 카드 벡터는 저자가 의도한 값이 아니라 **렌더 후 측정한 x_card**다. 의도값(`target_l1`)과의 오차는 5.9 자기검증으로 막는다(AI-10의 "x_ref 대신 x_card" 원칙을 D-14 구조에 맞게 적용, R-06·09장 D-0904). |
| RD-04 | 프리셋 토큰은 단일 레퍼런스의 값을 복사하지 않는다. 레퍼런스는 유형별 분포 통계(서로 다른 도메인 ≥3)로만 근거를 제공한다(D-31, R-20, 08장 G1). 초기 프리셋은 `provenance.method='operator'`이고, 5.11 SR-9 근거 리포트로 조정한 프리셋만 `cluster_median` + `provenance.domains`(≥3 eTLD+1)를 갖는다(03장 3.4.1). |
| RD-05 | 생성 후보의 취향 일치도에는 자동 추출값만 쓴다. `ref_tagger` 비전 태깅은 레퍼런스(시드·관측) 라벨 보조에만 쓴다. 생성 후보의 비전 채점(`judge_vision`)은 MVP에서 기록 전용이다(R-12, `JUDGE_VISION_MODE=log`). |

## 5.2 MVP 시드 레퍼런스 60개 구성 규칙

### 5.2.1 선정 기준(전부 충족해야 후보 통과)

| 코드 | 기준 | 판정 방법 |
|---|---|---|
| S-01 | 홈 URL이 HTTP 200, 로그인·페이월·CAPTCHA 없음 | 캡처 CLI 자동 |
| S-02 | robots.txt가 해당 경로 수집을 허용하고 TDM·AI 예약 신호가 없음(`tdm_reserved=false`, 08장 8.1.4) | ingest CLI 자동(5.4.1) |
| S-03 | `excluded_domains`에 없음 | 자동 |
| S-04 | 08장 8.1.5 제외 카테고리 ①~⑥ 모두 "아님"(성인, 도박·사행, 정치 캠페인·정당, 혐오·차별, 불법 의심, 첫 화면에 실명·연락처가 노출된 개인 사이트), 이용약관에 자동 접근 금지 조항 없음. 8.9.2 고위험 브랜드 사이트는 시드 가능하나 `link_allowed=false` | 사람 체크리스트 |
| S-05 | 상단 3뷰포트(1280×2400) 안에 히어로 + 섹션 ≥3 | 사람 체크리스트 |
| S-06 | 첫 뷰포트에서 canvas/WebGL 면적 < 40% (`canvas_ratio`) | 자동. 위반 사이트는 시드 60 중 최대 3개까지 허용, `canvas_heavy` 플래그 |
| S-07 | 캡처 후 `popup_suspect=false` | 자동(5.4.2). 시드 최종본에는 0건 |
| S-08 | 사람 얼굴이 첫 뷰포트의 주 피사체가 아님(면적 ≥ 15%인 얼굴 사진 없음) | 사람 체크리스트(LG-02) |
| S-09 | 사이트 언어가 ko 또는 en | 자동(`<html lang>` + 본문 문자 비율) |
| S-10 | 용도가 D-03의 3종(saas / portfolio / local_business) 중 하나로 분류 가능 | 사람 |

### 5.2.2 분포 할당(쿼터)

모든 쿼터는 최종 60개에 대해 동시에 만족해야 한다. 유형·축 수준 쿼터는 **사람 라벨 기준**으로 판정한다.

| 차원 | 규칙 |
|---|---|
| 총수 | 정확히 60. 등록 도메인(eTLD+1) 중복 0 |
| 티어 | T1 20 / T2 20 / T3 20 (티어 정의 5.10.1) |
| 용도 | saas 20 / portfolio 20 / local_business 20 |
| 티어×용도 셀 | 각 셀 4~10 |
| 유형(유형 T1~T8, 사람이 1순위 유형 지정) | 유형별 6~10. 모든 유형이 서로 다른 도메인 ≥ 6 (D-31·08장 G1의 3도메인 집계를 여유 있게 충족) |
| 축 수준 커버리지 | 축마다 사람 라벨 1·2·3·4·5 각 수준 ≥ 4개, 양 끝(1과 5) 합계 ≥ 12개 |
| 테마 | dark(주 배경 OKLCH L < 0.35) ≥ 9, light ≥ 40 |
| 언어 | ko ≥ 24, en ≥ 18 |
| era | current(최근 대규모 리디자인 ≤ 24개월) ≥ 36, classic(> 24개월간 디자인 유지 + 현재 운영 중) ≥ 12 |
| 발견 소스 집중 | 단일 발견 소스(`source_id`) ≤ 12 |
| 제작 주체 집중 | 같은 에이전시·스튜디오 ≤ 3, 같은 빌더 템플릿 원본 ≤ 2, 빌더(Framer·Webflow·아임웹·Wix 등) 제작 사이트 합계 ≤ 15 |
| 품질 플래그 | `canvas_heavy` ≤ 3, `popup_suspect` 0 |

era 판정: 운영자가 Wayback Machine 등 공개 아카이브를 수동 조회해 마지막 대규모 리디자인 시점을 월 단위로 기록한다(`redesigned_at`). 확인 불가 시 current로 기록하고 `era_uncertain=true`.

### 5.2.3 큐레이션 절차

| 단계 | 산출물 | 담당·소요(1인 기준) |
|---|---|---|
| C1 후보 수집 | `data/seed/candidates.csv` 150행(목표의 2.5배). `pnpm ingest add <csv>`로 일괄 등록하거나 어드민 ADM-07(`/admin/references/new`, 08장 8.1.3)에서 1건씩 등록 | 운영자 브라우저 수동 방문, 4h |
| C2 1차 스크리닝 | S-01~S-03, S-06, S-07, S-09 자동 판정 → `screened` | `pnpm ingest capture`, 관리자 로컬(06장 6.11.6) |
| C3 캡처·추출·비전 태깅 | 통과 후보 전체의 F, pHash, 잠정 L1(초기 가중치), VLM 태그 | `pnpm ingest capture`·`pnpm ingest tag`, 관리자 로컬 |
| C4 사람 체크리스트 | S-04, S-05, S-08, S-10, era, 제작 주체 | 운영자, 2h |
| C5 층화 선정 | 시드 60 + 예비 15 | 자동(아래 알고리즘) |
| C6 사람 라벨 | 60개 5축·L2·유형 라벨(5.7) | 운영자, 3h |
| C7 쿼터 재검증 | 사람 라벨 기준 쿼터 판정. 위반 시 예비에서 교체 후 C6 반복 | 자동 + 운영자 |
| C8 동결 | 시즌 코퍼스 등록, 정규화기·매핑 학습(5.8), 자기검증(5.9) | `pnpm ingest season-build <시즌ID>` |

`candidates.csv` 열: `url, tier, source_id, use, lang_guess, era_guess, redesigned_at, maker, found_at, note`. 이 파일에는 플랫폼의 설명문·평점·이미지를 넣지 않는다(LG-01-2).

C5 층화 선정 알고리즘(결정론적):

```
입력: 후보 집합 C(사람 체크리스트 통과), 각 후보의 잠정 유형 m̂(잠정 L1에서 03장 3.4.7 유형 중심까지 유클리드 거리 최소), 잠정 L1 x̂, 쿼터 Q
출력: 시드 S(|S|=60), 예비 R(|R|=15)
S ← ∅
while |S| < 60:
  D ← 현재 S에서 하한 미달인 쿼터 칸 목록 (티어, 용도, 셀, 유형, 테마, 언어, era)
  후보 c의 점수 = (c가 채우는 미달 칸 수) × 10
                + min_{s∈S} ‖x̂_c − x̂_s‖₂            # 다양성(최대-최소 거리)
                − 100 × [c를 넣으면 어느 상한이든 초과]
  c* ← argmax 점수 (동점: url 사전순)
  S ← S ∪ {c*}
R ← 남은 후보 중 같은 점수식으로 15개
```

축 수준 커버리지는 사람 라벨 이후(C7)에만 판정 가능하므로, C5에서는 잠정 L1을 5등분 구간으로 대신 써서 구간별 ≥ 5개를 목표로 넣는다.

## 5.3 레퍼런스 데이터 스키마

테이블 통합·RLS·마이그레이션은 → 06장. 이 절은 컬럼과 제약의 원본이다. 레퍼런스 관련 테이블은 모두 **공개 읽기 금지**(service role·admin만). 사용자 쪽은 5.3.9 뷰만 읽는다.

### 5.3.1 `sources`

| 컬럼 | 타입 | 제약·설명 |
|---|---|---|
| source_id | text PK | 08장 8.1.2 형식: 플랫폼 `awwwards`·`gdweb` 등, 원본 사이트 `site:<eTLD+1>`, 직접 발견 `direct` |
| kind | text | `platform`·`origin_site`·`stats` (08장 법무 필수 필드) |
| name | text | |
| tier | text | `T1`·`T2`·`T3`·`AUX`(관심도 보조 지표, kind=`stats`) |
| url_pattern | text | 허용 경로 정규식. 밖은 요청 금지 |
| access_method | text | `manual`·`extract`·`rss`·`api` (MVP: platform·stats=`manual`, origin_site=`extract`) |
| tos_url | text null | |
| tos_checked_at | date null | 사람이 원문을 읽은 날 |
| tos_allows_automated | text | `yes`·`no`·`unknown` (MVP 초기값 `unknown`) |
| robots_checked_at | timestamptz null | |
| robots_allows | text | `yes`·`no`·`unknown` |
| tdm_reserved | bool null | TDMRep·`noai` 신호 감지(08장 8.1.4) |
| rate_limit_rps | numeric | 기본 0.2 (= 1 req / 5 s), 0.2 초과 금지 |
| stores_screenshot | bool | origin_site만 true 가능. platform·stats는 false |
| status | text | `active`·`manual_only`·`blocked`·`excluded` |
| note | text null | |

제약: kind=`platform`이고 `tos_allows_automated <> 'yes'`이면 `status`는 `manual_only`·`blocked`·`excluded`만 허용(CHECK). 워커·ingest CLI는 `manual_only`·`blocked`·`excluded` 소스에 요청을 보내지 않는다.

### 5.3.2 `reference_sites` (R-18)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| url | text | 정규화(https, 소문자 호스트, 쿼리·해시 제거) |
| domain | text UNIQUE | eTLD+1 |
| title | text | `<title>` 120자 절단. LLM 프롬프트 입력 금지(08장 G5) |
| title_ko | text | 닮은 사이트 표시명(운영자 입력, ≤ 40자, 02장 2.14 `titleKo`) |
| blurb_ko | text null | 운영자가 쓴 설명 1줄(≤ 60자, 사이트 카피 인용 금지) |
| type_primary | text null | 유형 T1~T8. 운영자 `primary` 라벨의 `type_primary`를 복사(02장 2.14 입력) |
| source_id | text FK sources | 발견 소스 |
| tier | text | T1/T2/T3 |
| use | text | `saas`·`portfolio`·`local_business` |
| lang | text | `ko`·`en` |
| era | text | `current`·`classic` |
| era_uncertain | bool | |
| redesigned_at | date null | 월 단위(일=1) |
| maker | text null | 에이전시·빌더명 |
| status | text | `candidate`→`screened`→`captured`→`labeled`→`active` / `observation` / `retired` / `excluded` |
| role | text | `seed`·`observation` |
| season_first | text | 처음 활성화된 시즌 ID |
| seasons_active | text[] | 활성이었던 시즌 목록 |
| link_allowed | bool | "닮은 사이트" 노출 가능(5.3.9 조건) |
| phash_1280 | bit(64) null | 첫 화면 1280×800 그레이스케일 DCT pHash(08장 8.3 G3, D-0802). 스크린샷 삭제 후에도 보관 |
| flags | text[] | `canvas_heavy`, `popup_suspect`, `face_main`, `unstable_vlm`, `era_uncertain` |
| collected_at | timestamptz | 최초 캡처 시각 |
| created_at, updated_at | timestamptz | |

### 5.3.3 `reference_captures`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| reference_id | uuid FK | |
| captured_at | timestamptz | |
| extractor_version | text | semver |
| viewport | text | `1280x800` (D-052) |
| status | text | `ok`·`rejected` |
| reject_reason | text null | `http_4xx`·`http_5xx`·`robots_disallow`·`robots_5xx`·`tdm_reserved`·`login_wall`·`captcha`·`timeout`·`blocked_429_403`·`excluded_category`·`excluded_domain` |
| screenshot_first_path | text null | `ref-screenshots/{ref_id}/{capture_id}/first.webp` |
| screenshot_full_path | text null | 상단 3뷰포트 |
| screenshot_deleted_at | timestamptz null | 90일 배치가 채움(D-31) |
| http_status | int | |
| durations_ms | jsonb | `{load, network_idle, fonts, settle, extract}` |

### 5.3.4 `reference_features`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| capture_id | uuid PK FK | |
| raw | jsonb | 원시 특징 F01~F30 (5.5.3) |
| l2_auto | jsonb | 원시 특징에서 규칙으로 판정한 L2 후보(테마, 폰트 계열, radius 계열) |
| originality_sig | jsonb | 08장 8.3 G2 7속성(D-0802): `{palette_oklab:{primary, accent}, font_substitute_ids:{display, body}, radius_family_id, depth_id, layout_pattern_id}` + P2용 `section_sequence text[]`. ID 값은 03장 택소노미 열거값. 폰트 대체 매핑은 08장 8.4.2 |
| embedding, embedding_model | vector null, text null | **Phase 2 전용**(R-38). MVP에서는 항상 null이며 계산 코드 경로가 없다 |

L1 값은 시즌별로 여러 개가 생기므로 별도 테이블 `reference_l1(capture_id, normalizer_version, vector)`(PK = 두 열)에 저장한다. `vector` = `{expression, temperature, shape, density, depth}`(R-01).

### 5.3.5 `vlm_tags`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| capture_id | uuid FK | |
| run_index | smallint | 1·2·3 |
| model_id, prompt_version | text | models.yaml 역할 `ref_tagger`(→06장) |
| output | jsonb | 5.6.2 스키마 |
| created_at | timestamptz | |

집계 뷰 `vlm_tag_summary(capture_id, axis_median jsonb, axis_range jsonb, l2_majority jsonb, unstable bool)`.

### 5.3.6 `reference_labels`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| reference_id | uuid FK | |
| rater_id | text | `op`(운영자), `r2`(2차 평가자) |
| session_id | text | 라벨링 세션 |
| purpose | text | `primary`·`retest`·`inter_rater` |
| axes | jsonb | `{expression: 1..5|null, ...}` (null = 판단 불가) |
| l2 | jsonb | 03장 L2 카테고리 값 |
| type_primary, type_secondary | text | 유형 ID `T1`~`T8`(R-04) |
| checklist | jsonb | S-04, S-05, S-08, S-10 결과 |
| labeled_at | timestamptz | |

### 5.3.7 `normalizers`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| version | text PK | 시즌 ID 또는 `시즌.패치`(예 `2027-S1`, `2027-S1.1`) |
| status | text | `draft`·`released`·`superseded` |
| body | jsonb | 5.8.2 스키마 |
| corpus_hash | text | 활성 세트 reference_id 정렬 목록의 SHA-256 |
| released_at | timestamptz | |

released 행은 불변(UPDATE 금지 트리거).

### 5.3.8 `excluded_domains`, `optout_requests`

- `excluded_domains(domain PK, reason: optout|claim|policy|category|legal|robots, added_at, request_id null)` — DDL은 06장.
- opt-out 접수는 08장 8.1.6 `rights_requests`(type=`optout_domain`, R-18)가 원본이다. `optout_requests`는 그 위의 읽기 전용 뷰(06장)이며 별도 테이블을 두지 않는다. 처리 기한(7일)·접수 절차는 → 08장, 데이터 측 처리 내용은 5.13.3, 어드민 화면은 ADM-11.

### 5.3.9 사용자 쪽 노출 뷰 `similar_site_candidates`

`SELECT id, domain, url, title_ko, blurb_ko, type_primary, use, l1(현재 released 정규화기) FROM reference_sites WHERE status='active' AND link_allowed AND domain NOT IN excluded_domains`

`link_allowed = true` 조건(모두): status active, `excluded_domains`에 없음, 최근 캡처 `robots_allows='yes'`·`tdm_reserved=false`, S-04 통과, 08장 8.9.2 고위험 브랜드 아님, 운영자 승인. 스크린샷 경로·원시 특징·pHash·발견 소스는 뷰에 포함하지 않는다. 매칭은 L1 가중 거리만 쓴다(02장 2.14, R-38). 비제휴 고지 문구는 → 01장·08장. 현재 06장 DDL의 뷰는 `title`을 내보내므로 `title_ko`·`blurb_ko`·`type_primary` 추가가 필요하다(5.17).

### 5.3.10 트렌드 테이블

- `trend_feature_defs(feature_id PK, version, rule jsonb, description)` — 5.10.3
- `trend_observations` = `reference_sites WHERE role='observation'` + `reference_features` (별도 테이블 없이 role로 구분)
- `trend_reports(id, period 'YYYY-MM', normalizer_version, feature_def_version, body_md text, stats jsonb, created_at)`
- Phase 2: `ingest_runs(id, source_id, started_at, n_fetched, n_ok, n_blocked, success_rate)`

## 5.4 캡처 명세

### 5.4.1 접근 규칙(원본 사이트)

| 항목 | 값 |
|---|---|
| 실행 위치 | ingest CLI(`pnpm ingest`, 관리자 로컬 Docker)만 외부 사이트에 접속한다. 운영 워커는 외부 URL에 접속하지 않는다(06장 P4, 6.11.6) |
| 방문 페이지 | MVP는 홈 1페이지만(08장 8.1.4 상한 3페이지보다 좁게). Phase 2 최대 3페이지(홈 + 운영자 지정 하위 2개) |
| 사전 검사 | `excluded_domains` 일치 → 요청 0건 종료. 이어서 robots·TDM 검사 |
| robots.txt | 매 작업 시작 시 조회(24h 캐시). `TasteFitBot` 그룹이 있으면 그 규칙, 없으면 `*`. Disallow면 `rejected/robots_disallow`. robots.txt 5xx → 도메인 전체 금지로 간주(`robots_5xx`), 404 → 허용 |
| TDM·AI 예약 신호 | `/.well-known/tdmrep.json`의 `tdm-reservation: 1`, 응답 헤더 `tdm-reservation: 1`, `X-Robots-Tag`·`<meta name="robots">`의 `noai`·`noimageai` 중 하나 → `tdm_reserved=true`, 소스 `blocked`, 추출 0건(08장 8.1.4) |
| User-Agent | `TasteFitBot/1.0 (+https://<서비스도메인>/sources)` — 08장 8.1.4 원문 그대로 |
| 요청 속도 | 도메인당 1 req/5s 이하(문서 요청 기준), 도메인당 동시 연결 1, 서로 다른 도메인 동시 캡처 최대 2 |
| 차단 대응 | 401·403·429, 로그인 폼만 있는 페이지, 페이월, CAPTCHA, 연속 5xx 2회 → 즉시 중단, 재시도 없음, 소스 `status='blocked'` + 사유. 우회(프록시 회전, UA 위장, 쿠키 주입) 금지 |
| 저장 허용·금지 | 08장 8.1.4 표를 따른다. 본문 텍스트 원문·HTML·이미지·SVG·폰트 파일은 저장하지 않는다(원시 특징 계산은 메모리 안에서만) |
| 네트워크 격리 | 사설·링크로컬 대역 이그레스 차단, 리다이렉트 ≤ 5회, 다운로드 비활성(08장 S-01, 06장 6.11.6) |
| 로케일 | lang=ko 사이트: `ko-KR`, `Asia/Seoul` / 그 외: `en-US`, `America/Los_Angeles` |

### 5.4.2 캡처 조건과 대기 절차

D-052(제안, 04장 4.x 추출 1280과 일치): 취향 추출용 뷰포트는 모든 객체(레퍼런스, 프리셋 렌더, 설문 자극물, 생성 후보)에 대해 **1280×800, deviceScaleFactor 1**로 고정한다(1280은 D-25 검증 뷰포트에 포함되어 생성 후보의 추가 렌더가 필요 없다). 측정 영역은 상단 3뷰포트(0~2400px)이며, 문서 높이가 2400px보다 짧으면 `[0, 문서 높이]`다(설문 자극물은 1280×800 한 화면). 면적 정규화 특징(F10·F11·F13·F22·F24)은 실제 측정 영역 면적으로 나눈다.

```
capture(url, opts) :
  1. context = newContext({viewport:1280x800, dpr:1, reducedMotion:'reduce',
                           colorScheme:'light', locale, timezoneId, javaScriptEnabled:true})
  2. page.goto(url, {waitUntil:'load', timeout:30s})
  3. waitForNetworkIdle(idle=500ms, timeout=10s)            # 초과 시 계속 진행, flag 'net_busy'
  4. await document.fonts.ready (timeout 5s)
  5. 지연 로딩 유도: 0→2400px를 400px 단위로 스크롤(각 250ms 대기) → scrollTo(0,0) → 500ms
  6. 팝업 처리: config/extractor/popup-selectors.json의 선택자에 display:none 주입.
     이후 position:fixed|sticky 이고 z-index ≥ 100 이며 첫 뷰포트 면적 ≥ 30%를 덮는 요소가
     남아 있으면 flag 'popup_suspect'(시드 불가). 헤더(높이 ≤ 120px, top=0)는 제외.
  7. 애니메이션 정착: document.getAnimations().forEach(a => { try a.finish() catch a.pause() })
     → 1,500ms 대기 → 다시 finish/pause
  8. 스크린샷: first(0~800), full(0~2400) WebP q=80, 폭 1280
  9. extractL2(page) 실행(같은 page 컨텍스트, DOM + 스크린샷 픽셀)
 10. pHash: first를 그레이스케일 32×32 축소 → DCT → 좌상단 8×8(DC 제외 중앙값 기준) 64비트
     → reference_sites.phash_1280 (08장 8.3 G3과 같은 함수 `phash64()`, packages/extractor)
  전체 타임아웃 45s. 타임아웃·네트워크 오류만 1회 재시도(robots·4xx·차단·5xx 사유는 08장 규칙대로 재시도 안 함).
```

생성 후보와 프리셋 렌더·설문 자극물은 1~2·4·7~9단계만 적용한다(로컬 렌더라 네트워크·팝업·스크롤 단계 불필요). 설문 자극물의 x_card는 desktop 1280×800 렌더에서 측정한다(mobile 780×1560 이미지는 측정 대상 아님, R-07). 생성 후보의 pHash는 04장 하드 게이트가 같은 `phash64()`로 계산한다. 다크 테마는 `colorScheme:'light'` 상태에서 사이트가 기본으로 보여주는 테마로 판정한다.

## 5.5 특징 추출기 명세

### 5.5.1 측정 대상 요소

| 집합 | 정의 |
|---|---|
| 가시 요소 V | 측정 영역과 교차, `display≠none`, `visibility=visible`, 누적 opacity ≥ 0.1, bbox 면적 > 0 |
| 표면 Sf(surface) | V 중 (배경색이 부모 실효 배경과 OKLab ΔE ≥ 0.02 이거나 배경 이미지·그라디언트 보유) 또는 (border 폭 ≥ 1px, 색 alpha ≥ 0.3) 이고, 면적 2,000px² 이상 ~ 뷰포트 면적(1,024,000px²)의 60% 이하 |
| 버튼 B | `button`, `[role=button]`, `input[type=submit|button]`, 배경 또는 테두리가 있고 padding-x ≥ 8px인 `a` |
| 텍스트 런 T | 텍스트 노드의 `Range.getClientRects()` 사각형, 글자 수·computed font 정보 보유 |
| 헤드라인 H | `h1~h2` 또는 font-size ≥ 본문 크기 × 1.5 인 T |
| 본문 크기 | T의 font-size 최빈값(글자 수 가중) |
| 미디어 M | `img`, `picture`, `video`, `canvas`, 면적 ≥ 64×64인 비아이콘 `svg`, `background-image`가 url()인 요소 |
| 섹션 Sec | `body`의 자손 중 폭 ≥ 뷰포트 폭 × 0.9, 높이 ≥ 200px인 최상위 블록(중첩 시 가장 바깥) |
| 아이콘 | 24×24~48×48 svg 또는 버튼·링크 내부 svg (장식 수에서 제외) |

픽셀 기반 색: 측정 영역 스크린샷을 폭 320으로 축소 → OKLab 변환 → k-means(k=8, k-means++ 초기화, 고정 시드 42, 최대 50회) → 군집별 면적 비율. ΔE_OK < 0.04인 군집은 병합.

### 5.5.2 폰트 분류 표

`config/font-classes.json`: family 이름(소문자, 따옴표 제거) → `serif`·`sans_geometric`·`sans_neo_grotesque`·`sans_humanist`·`mono`·`display`·`script`. 한글 서체 포함(예: 명조·바탕 계열 → serif, 손글씨 계열 → script). 자체 렌더(프리셋·자극물·생성 후보)의 family 이름은 `tf-<fontId>`(03장 D-0304)이므로 `tf-` 접두는 03장 폰트 레지스트리의 `classification`으로 분류한다(분류값 집합은 03장과 동일). 미등록 family는 generic fallback(`serif`, `monospace` 등)로 판정, 그래도 불명이면 `unknown`. 실제 사용 폰트는 `document.fonts`에서 `status='loaded'`인 첫 family로 정한다. 표에 없는 family가 시드 글자 수의 10% 이상이면 자기검증 리포트에 경고한다. 표의 버전은 정규화기 `body.font_class_table_version`에 기록한다.

### 5.5.3 원시 특징 목록(F)

| ID | 키 | 단위 | 정의 | 주 사용 축 |
|---|---|---|---|---|
| F01 | radius_med | px | Sf∪B의 border-radius(4모서리 평균, min(w,h)/2로 상한) 중앙값 | A3 |
| F02 | pill_ratio | 0~1 | B 중 radius ≥ h/2 − 1 인 비율(B=0이면 0) | A3 |
| F03 | border_ratio | 0~1 | Sf 중 가시 테두리 보유 비율 | L2 |
| F04 | border_w_med | px | 테두리 보유 Sf의 border 폭 중앙값, 없으면 0 | A3 |
| F05 | shadow_ratio | 0~1 | Sf∪B 중 box-shadow 레이어(alpha ≥ 0.05, blur > 0 또는 offset > 0) 보유 비율 | A5 |
| F06 | shadow_blur_med | px | 그림자 보유 요소의 최대 blur 중앙값, 없으면 0 | A5 |
| F07 | hard_shadow_ratio | 0~1 | 그림자 보유 요소 중 blur ≤ 2px & offset ≥ 3px 비율 | A5, L2 |
| F08 | backdrop_count | 개 | `backdrop-filter`에 blur 포함 요소 수 | A5 |
| F09 | gradient_ratio | 0~1 | Sf 중 linear/radial/conic gradient 배경 비율 | A5, A1 |
| F10 | whitespace | 0~1 | 1 − (T ∪ M bbox 합집합 면적 / 측정 영역 면적) | A4 |
| F11 | text_density | 자/10만px² | 측정 영역 내 글자 수 / (면적/100,000), 변환 log1p | A4 |
| F12 | section_pad_med | px | Sec의 첫 콘텐츠 상단·마지막 콘텐츠 하단까지 여백 평균의 중앙값 | A4 |
| F13 | blocks_per_vp | 개 | 측정 영역 내 텍스트 블록(p, li, h1~h6, blockquote, figcaption) 수 / 3 | A4 |
| F14 | warmth | −1~1 | Σ a_i·C_i·cos(h_i − 50°) / Σ a_i·max(C_i, 0.02) (k-means 군집 i, a=면적, C·h=OKLCH) | A2 |
| F15 | bg_warmth | OKLab b | 최대 면적 군집의 OKLab b 값(크림·베이지 양수, 블루그레이 음수) | A2 |
| F16 | serif_humanist | 0~1 | T 글자 중 serif·sans_humanist·script 비율(헤드라인 가중 2) | A2 |
| F17 | serif_head | 0~1 | H 글자 중 serif 비율 | L2, 트렌드 |
| F18 | type_scale | 배 | 첫 뷰포트 최대 H font-size / 본문 크기 | A1 |
| F19 | chroma_mean | OKLCH C | 군집 면적 가중 평균 chroma | A1 |
| F20 | accent_chroma | OKLCH C | 면적 ≥ 1% 군집 중 최대 chroma | A1 |
| F21 | n_colors | 개 | 병합 후 면적 ≥ 1% 군집 수 | A1 |
| F22 | deco_per_vp | 개 | (비아이콘 svg + gradient 요소 + 비사진 background-image + 정착 전 실행 중이던 애니메이션 대상 요소 + canvas) / 3 | A1 |
| F23 | asymmetry | 0~1 | 상위 3개 Sec의 콘텐츠(T∪M) 면적 무게중심 x의 |x − W/2|/(W/2) 평균 | A1 |
| F24 | image_area | 0~1 | M 합집합 면적 / 측정 영역 면적 | L2, 트렌드 |
| F25 | dark | bool | 최대 면적 군집 OKLCH L < 0.35 | L2 |
| F26 | fonts | object | `{heading_family, body_family, heading_class, body_class}` | L2, 가드 |
| F27 | head_tracking | em | H letter-spacing 글자 수 가중 평균 | 참고 |
| F28 | body_line_height | 배 | 본문 line-height / font-size 중앙값 | 참고 |
| F29 | grid_cols_mode | 개 | 같은 top 좌표(±4px)에 나란한 형제 블록 수의 최빈값 | L2 |
| F30 | canvas_ratio | 0~1 | 첫 뷰포트 canvas 면적 비율 | 품질 플래그 |

모든 특징은 `raw` JSON에 키로 저장하며, 측정 불가 시 `null`(0으로 대체 금지). 축 계산 시 null 특징은 해당 가중치를 제외하고 나머지 가중치를 재정규화한다. 축 가중치 합의 50% 이상이 null이면 그 축은 `null`, 해당 레퍼런스는 시드 불가.

### 5.5.4 원시 → L1 매핑 함수

```
N_j(f)  : 특징 j의 시즌 정규화기 경험적 분포함수(5.8.2). 변환(log1p 등) 후 101분위 선형 보간, 범위 밖은 0 또는 1
s_k     : Σ_j w_kj · Ñ_j,  Ñ_j = N_j(f_j) 또는 (1 − N_j(f_j))  (부호표)
x_k     : clip( b0_k + b1_k · s_k , 0, 1 )      # 사람 라벨 척도로 보정
```

초기 가중치(사람 라벨 학습 전 출발점, `mapping.initial`):

| 축 | 구성(가중치, 합 1.0) |
|---|---|
| A1 expression | F22 deco 0.25 · F18 type_scale 0.25 · F19 chroma 0.20 · F21 n_colors 0.15 · F23 asymmetry 0.15 |
| A2 temperature | F14 warmth 0.40 · F15 bg_warmth 0.30 · F16 serif_humanist 0.30 |
| A3 shape | F01 radius 0.60 · F02 pill 0.15 · (1−F04 border_w) 0.25 |
| A4 density | (1−F10 whitespace) 0.30 · F11 text_density 0.25 · (1−F12 section_pad) 0.25 · F13 blocks 0.20 |
| A5 depth | F05 shadow_ratio 0.35 · F06 shadow_blur 0.20 · F08 backdrop 0.20 · F09 gradient 0.15 · F07 hard_shadow 0.10 |

초기값 b0=0, b1=1. 축 간 특징 공유는 F09(A1에는 미사용, A5만)처럼 축마다 허용 목록을 둬 이중 계산을 막는다. 허용 목록 = 위 표 + 축별 후보 2개(A1: F24, F17 / A2: F20 / A3: F06 / A4: F24 / A5: F03). 다른 축 소관 특징은 학습에서도 쓰지 않는다(밀도 특징 F10은 A1에 쓰지 않음 — 03장 L1 정의와 일치).

### 5.5.5 사람 라벨로 가중치 재학습

```
대상: 활성 세트의 사람 라벨 y_k = (중앙값(rater 라벨) − 1) / 4  (op primary 라벨 사용, retest는 신뢰도 계산 전용)
특징: 축 k의 허용 목록 Ñ_j, 표준화(평균 0, 분산 1)
모형: 비음수 제약 ridge, α ∈ {0.1, 0.3, 1, 3, 10} 중 내부 CV로 선택
검증: 5-fold CV × 3회 반복(층화: 용도), 지표 = 축별 Spearman ρ(예측, y_k)의 평균
채택: ρ_learned ≥ ρ_initial + 0.03 이면 학습 가중치 채택
      아니면 초기 가중치 유지하고 b0, b1만 최소제곱으로 보정
산출: mapping.{k}.{weights, b0, b1, source: 'learned'|'initial', cv_spearman, cv_mae}
재학습 주기: 시즌 릴리스마다 1회(5.11). 시즌 중 재학습 금지.
```

판단 불가(null) 라벨은 해당 축 학습에서 제외한다. 축별 유효 라벨이 50개 미만이면 초기 가중치를 유지한다.

### 5.5.6 성능·결정성

| 항목 | 기준 |
|---|---|
| URL 캡처+추출 전체 | p95 ≤ 45s |
| 이미 렌더된 페이지의 `extractL2()` | p95 ≤ 2.5s (04장 생성 SLO 내 사용) |
| 같은 URL 24시간 내 2회 캡처 | 축 차이 ≤ 0.03(모든 축), 수치 특징 상대 차이 ≤ 5%(값 < 0.05인 특징은 절대 차이 ≤ 0.01) — 시드의 95% 이상 |
| 같은 로컬 렌더 2회 추출 | DOM 기반 특징 완전 일치, 픽셀 기반 특징 차이 ≤ 0.01 |

## 5.6 비전 태깅 절차

### 5.6.1 입력

- 이미지: `full.webp`(1280×2400)를 960×1800으로 축소한 1장만(06장 models.yaml `ref_tagger.max_images = 1`).
- 기준표(텍스트만): 축별 0/1 정의와 5단계 앵커 서술(02장 2.1.2 표의 0.00/0.25/0.50/0.75/1.00 열 원문)과 축별 제외 속성(03장 3.2.2). 실제 사이트 앵커는 쓰지 않는다. 앵커 이미지(`anchor-A{k}-{level}.webp`)를 함께 보내는 방식은 `max_images` 확대가 필요하므로 Phase 2 검토 항목이다.
- 페이지 텍스트·HTML·`title`은 프롬프트에 넣지 않는다(간접 인젝션 방지, 06장 T-03, 08장 S-06).
- 모델: models.yaml 역할 `ref_tagger`(R-12), 프롬프트 `packages/llm/prompts/ref_tagger@v<N>.md`. 파라미터는 06장 값: temperature 0, maxOutputTokens 400, max_input_tokens 3000, timeout 30s.
- 외부 전송 전 조건: models.yaml 항목의 `processor_id`가 `legal/processors.yaml`에서 `approved: true`이고 `effective_from` 경과(08장 D-0809). 아니면 게이트웨이가 호출하지 않는다.

### 5.6.2 출력 스키마(JSON, 검증 실패 시 1회 재요청 후 실패 기록)

```json
{
  "axes": {
    "expression":  {"score": 1, "evidence": "근거(≤30자)"},
    "temperature": {"score": 1, "evidence": "..."},
    "shape":       {"score": 1, "evidence": "..."},
    "density":     {"score": 1, "evidence": "..."},
    "depth":       {"score": 1, "evidence": "..."}
  },
  "l2": {"depth_id": "...", "layout_pattern_id": "...", "palette_structure_id": "...",
         "image_style_id": "...", "texture_grain": false},
  "confidence": 0.0
}
```

score는 1~5 정수. l2 값은 03장 택소노미 열거값만 허용(스키마 enum, 범위 밖 값은 폐기). 출력 토큰 상한 400 안에 들도록 evidence는 30자 이하.

### 5.6.3 집계 규칙

```
각 캡처마다 독립 호출 3회 (run_index 1..3)
축 점수 vlm_k = (median(score_1..3) − 1) / 4
range_k = max − min;  어느 축이든 range_k ≥ 2 이면 unstable = true
l2 속성 = 3회 다수결; 3개 모두 다르면 해당 속성 unstable
unstable 레퍼런스 → 사람 검수 큐(시드는 원래 전량 사람 라벨이므로 기록만)
비용 상한: 시즌 빌드 1회당 태깅 지출 ≤ 플래그 `REF_TAGGING_BUDGET_USD`(기본 10, 제안 D-05C). 초과 예상 시 중단.
이 지출은 ingest CLI(관리자 로컬)에서 발생하며 생성 일일 예산 `GEN_DAILY_BUDGET_USD`(R-22)와 별도로 집계한다.
```

### 5.6.4 융합(사람 라벨이 없는 관측 레퍼런스용)

```
w_auto,k ∝ 1 / MSE_cv(auto_k, y_k),  w_vlm,k ∝ 1 / MSE_cv(vlm_k, y_k),  합 1
x_k = w_auto,k · auto_k + w_vlm,k · vlm_k
시드: x_final = 사람 라벨(우선). auto·vlm 값은 평가용으로 보관.
관측: x_final = 융합값, 출처 'fused'.
```

## 5.7 사람 라벨링 가이드와 신뢰도 목표

### 5.7.1 라벨링 도구(어드민, MVP)

- 화면: 어드민 ADM-07(레퍼런스)의 라벨 모드 `/admin/references/label`(관리자 권한, 라우트 정의 →06장). 구성: 스크린샷(서명 URL 5분), 축 정의 + 해당 축 앵커 이미지 5장(`anchor-A{k}-{level}.webp`, 02장 2.1.2, `survey:build`가 생성), 1~5 키 입력, `N`=판단 불가, `←` 이전.
- 자동·비전 값은 라벨 완료 전까지 숨긴다(블라인드).
- 모드: **축 단위 모드**(한 세션에서 한 축만 모든 사이트에 매김 — 후광 효과 억제)가 기본. L2·유형·체크리스트는 별도 패스.
- 순서: 세션마다 무작위(시드 = session_id). 세션당 최대 20개, 세션 사이 휴식 ≥ 10분.
- 입력 API: `POST /api/admin/references/:id/labels` body = `reference_labels` 행(5.3.6), 응답 201.

### 5.7.2 척도와 판정 규칙

| 점수 | 의미 |
|---|---|
| 1 | 앵커 0.00 이미지에 가장 가까움(또는 더 극단) |
| 2 | 앵커 0.25 이미지에 가장 가까움 |
| 3 | 앵커 0.50 이미지에 가장 가까움 |
| 4 | 앵커 0.75 이미지에 가장 가까움 |
| 5 | 앵커 1.00 이미지에 가장 가까움(또는 더 극단) |

점수 s → L1 값 (s − 1)/4 = {0, 0.25, 0.5, 0.75, 1}로 앵커 수준과 정확히 대응한다.

- 첫 뷰포트 인상 기준이 아니라 측정 영역(상단 3뷰포트) 전체 기준으로 매긴다.
- 한 축을 매길 때 다른 축 속성은 무시한다(예: 밀도 판단에 색을 고려하지 않음). 축별 "제외 속성"은 03장 3.2.2의 축별 제외 속성 목록을 따른다.
- 판단 불가는 축별 5% 이하. 초과 시 해당 축 정의·앵커를 고친다.

### 5.7.3 신뢰도 목표

| 지표 | 대상 | 목표 | 미달 시 |
|---|---|---|---|
| test-retest ICC(2,1) 절대 일치 | 운영자, 1차 라벨 ≥ 14일 후 무작위 30개 재라벨, 축별 | ≥ 0.80 | 해당 축 정의·앵커 수정 후 60개 재라벨, 재측정 |
| 평가자 간 ICC(2,1) | 운영자 vs 2차 평가자(디자인 실무 경력 ≥ 2년) 30개, 축별 | ≥ 0.60 | 해당 축 `subjective=true` 표시, 04장 일치도에서 그 축 λ를 0.5배(D-056) |
| L2 범주 일치 Cohen's κ | 운영자 vs 비전 다수결, 속성별 | ≥ 0.60 | 해당 속성은 비전 값을 관측 레퍼런스에서도 쓰지 않고 `null` |
| 유형 일치율 | 운영자 retest 1순위 유형 | ≥ 80% | 유형 정의 문구 수정 요청(→02장) |

2차 평가자는 출시 전 확보를 원칙으로 한다. 출시일까지 확보하지 못하면 모든 축을 `inter_rater=unverified`로 기록한 채 출시하고, 출시 후 30일 안에 측정한다(D-057). 2차 평가자에게는 스크린샷을 어드민 화면 안에서만 보여주며 파일로 내보내지 않는다.

### 5.7.4 추출기 정확도 목표(사람 라벨 대비, 5-fold CV)

| 지표 | 목표(MVP 출시) | Phase 2 목표 |
|---|---|---|
| 자동 추출 Spearman ρ, 축별 | ≥ 0.70 | ≥ 0.80 |
| 자동 추출 MAE, 축별 | ≤ 0.15 | ≤ 0.12 |
| 비전 태깅 Spearman ρ, 축별 | ≥ 0.60 | ≥ 0.70 |
| 융합 Spearman ρ, 축별 | ≥ 0.75 | ≥ 0.80 |
| 비전 반복 일관성: 3회 축 점수 표준편차 평균(0~1 척도) | ≤ 0.10 | ≤ 0.08 |
| 비전 unstable 비율 | ≤ 10% | ≤ 5% |
| 축 간 |Pearson r|(활성 세트 사람 라벨 기준) | 목표 ≤ 0.40 | 동일 |

축 간 상관 규칙: 0.40 < |r| < 0.60은 리포트 기록, 0.60 ≤ |r| < 0.75는 시즌 리포트에 "조정 또는 수용" 결정을 남겨야 릴리스 가능, |r| ≥ 0.75는 릴리스 차단(축 정의 수정 또는 병합 검토 →02장·03장).

자동 추출 ρ < 0.70인 축은 정규화기 `reliable[k]=false`로 기록한다(D-056, 07장 G2가 채택). 이 경우 출시 차단이 아니라 04장 취향 일치도에서 해당 축 가중치를 0으로 두고, 결과를 `reports/extractor_eval.md`에 표시한다. 5축 중 3축 이상이 false면 출시를 차단한다.

리포트 자동 생성: `pnpm eval:extractor`(07장 G2 실행 명령) → `reports/extractor_eval.md`(위 표의 모든 수치, 축별 산점도 데이터 CSV, 실패 축 목록, 정규화기·추출기·프롬프트 버전).

임계값 등록: 5.5.6·5.7.3·5.7.4·5.9의 모든 수치 기준은 `config/thresholds.json`(R-09 단일 원천)의 `extractor` 객체에 키로 등록하고, 코드·리포트는 이 파일에서만 읽는다(예: `extractor.auto_spearman_min = 0.70`, `extractor.roundtrip_max_err = 0.10`, `extractor.unreliable_axes_block = 3`).

## 5.8 축 정규화와 시즌별 버전 고정

### 5.8.1 원칙

| ID | 규칙 |
|---|---|
| N-01 | 정규화기는 시즌 기준 코퍼스(= 그 시즌 활성 세트, n ≥ 60)에서만 적합한다. 시즌 안에서는 재적합하지 않는다. 관측·생성물·설문 자극물은 released 정규화기로 변환만 한다. |
| N-02 | `normalizer_version` = 시즌 ID(D-053, R-30 채택). 버그 수정만 패치 버전(`2027-S1.1`)을 허용하며, 패치도 5.11의 재계산·재생 절차를 거친다. |
| N-03 | 모든 L1 벡터 저장 위치(레퍼런스, 카드 x_card, 프로필, 생성 후보 점수)는 `normalizer_version`을 함께 저장한다. 버전이 다른 벡터끼리의 거리 계산은 코드에서 예외를 던진다. |
| N-04 | released 정규화기는 불변이며 폐기하지 않는다(재현·감사용). |

### 5.8.2 정규화기 본문 스키마(`normalizers.body`, 파일 `data/normalizers/<version>.json`과 동일)

```json
{
  "version": "2027-S1",
  "extractor_version": "1.0.0",
  "font_class_table_version": "1",
  "trend_feature_def_version": "1",
  "corpus": {"n": 60, "hash": "sha256:..."},
  "features": {
    "F01": {"transform": "identity", "q": [/* 101개, 0~100 분위 */]},
    "F11": {"transform": "log1p", "q": [/* 101개 */]}
  },
  "mapping": {
    "expression": {"weights": {"F22": 0.25, "F18": 0.25}, "sign": {"F10": -1},
                   "b0": 0.0, "b1": 1.0, "source": "learned", "cv_spearman": 0.74, "cv_mae": 0.12}
  },
  "reliable": {"expression": true, "temperature": true, "shape": true, "density": true, "depth": true},
  "subjective": {"expression": false},
  "inter_rater": "verified"
}
```

분위 테이블은 집계값이며 개별 사이트 행을 포함하지 않는다. 같은 값이 여러 분위에 걸치면 N_j는 해당 구간의 중간 순위를 반환한다.

## 5.9 추출기 자기검증(프리셋 왕복)

"우리가 만든 것을 우리가 다시 읽으면 같은 값"을 보장한다(QA-22). 실행: `pnpm eval:extractor:selfcheck` (CI 필수 단계, `extractor.spec.ts`).

| 대상 | 의도값 출처 | 통과 기준 | 실패 처리 |
|---|---|---|---|
| 앵커 프리셋 `PS-T1`~`PS-T8` 기본 렌더 | 03장 3.4.7 표(`anchor_l1` = `predictL1`(기본 L2), R-04 단일 원천) | 모든 프리셋·모든 축 |x̂_k − x_k| ≤ 0.10 | CI 실패. 아래 실패 절차 |
| 설문 1단계 카드 48장(기준 벡터 16 × 템플릿 3, R-06) | 02장 카드 `target_l1` | 카드×축 95% 이상 ≤ 0.10, 그리고 모든 카드×축 ≤ 0.15(09장 D-0904 채택 상한) | 기준 밖 카드는 `status=draft` 유지(설문 미사용) |
| 2단계 A/B 120쌍(고유 이미지 120장, R-06·09장 D-0903) | 대상 축 수준 {0.2, 0.5, 0.8}, 수준쌍 (0.2,0.5)·(0.5,0.8)·(0.2,0.8) | 대상 축: 측정 차이 부호 일치 & |Δ̂| ≥ 0.5×|Δ의도|(의도 Δ ≥ 0.30), 비대상 축: |Δ̂| ≤ 0.08 | 해당 쌍 비활성. 축별 활성 쌍 ≥ 19/24가 빌드 통과 조건(09장 D-0903, 02장 2.4.4) |
| 앵커 이미지 25장(축 5 × 수준 0/0.25/0.5/0.75/1) | 02장 2.1.2 | 대상 축 측정값이 수준 순서대로 단조 증가, 인접 수준 차 ≥ 0.10 | 라벨 도구 앵커 교체(02장 소관) |
| 토큰 수준 | 프리셋 토큰 | radius ±1px, 주 배경·accent 색 ΔE2000 < 5, 본문 font-family 일치 | CI 실패 |
| 프리셋 간 분리 | — | 모든 프리셋 쌍의 측정 L1 유클리드 거리 ≥ 0.25 | 03장에 프리셋 조정 요청 |

앵커 실패 절차(결정론적):
1. 운영자가 해당 프리셋 렌더를 5.7 방식으로 블라인드 라벨(레퍼런스 라벨 세션에 무작위로 섞음).
2. 사람 라벨이 측정값 x̂_k와 0.125 이내이고 의도값과는 0.125 초과이면 → 의도값(3.4.7 표)이 틀린 것. 03장에 3.4.7 표 수정을 요청한다. 3.4.7 값이 바뀌면 02장 `types_version`을 올리고(02장 2.11) 03장 `predictL1` 계수 또는 기본 L2를 함께 고친다. 05장은 3.4.7 값을 직접 고치지 않는다(R-04).
3. 사람 라벨이 의도값과 0.125 이내이고 측정값과 0.125 초과이면 → 추출기·매핑이 틀린 것. 해당 축의 원시 특징을 점검하고 매핑 허용 목록 또는 특징 정의를 고친 뒤 5.7.4 평가를 다시 통과해야 한다.
4. 둘 다 아니면 → 프리셋 토큰이 의도를 표현하지 못한 것. 03장에 토큰 수정 요청.

설문 자극물의 x_card는 자기검증 통과 후 `survey:build`(→02장·09장)가 released 정규화기로 측정해 저장한다. 설문 진행 중 런타임 추출·렌더 호출은 0건이다(TL-22).

## 5.10 트렌드 정의

### 5.10.1 티어

| 티어 | 정의 | 대표 소스(발견 용도) | MVP 월간 관측 표본 |
|---|---|---|---|
| T1 선도층 | 디자인 어워드·큐레이션 수상작, 유명 스튜디오 자체 사이트 | Awwwards SOTD, FWA, CSSDA, Godly, 스튜디오 사이트 | 15 URL/월 |
| T2 확산층 | 템플릿 마켓·런치 플랫폼·국내 디자인 갤러리에 오른 실제 운영 사이트 | Framer·Webflow 템플릿 갤러리, Product Hunt 런치 제품 홈, 디비컷, GDWEB | 15 URL/월 |
| T3 대중층 | 대형 브랜드·국내 주요 서비스·로컬 사업자의 운영 사이트, 웹빌더 기본 템플릿 | 직접 방문(`direct`), 웹빌더 공식 템플릿 | 10 URL/월 |
| AUX 관심도 | 검색 관심도(디자인 특징이 아님) | Google Trends, 네이버 데이터랩 | 키워드 ≤ 10개 수동 조회 |

Dribbble·Behance 샷 자체는 실제 사이트가 아니므로 특징 추출·점유율 계산 대상에서 제외한다. 샷이 운영 중인 원본 사이트를 링크할 때만 그 원본 URL을 T2 관측으로 기록할 수 있다(08장 8.1.2). 그 밖에는 운영자의 정성 메모(이미지 저장 없이 텍스트)로만 리포트에 쓴다.

AUX 수치는 디자인 특징 점유율과 합산·비교 연산하지 않고 리포트의 별도 절에만 둔다. 08장 8.1.2 매트릭스는 이 소스를 `kind='stats'`, tier `T3`로 적고 있으나, 이 장은 점유율 혼입을 막기 위해 tier `AUX`를 쓴다(06장 DDL 허용값과 일치, 08장 표기 정정 요청 → 5.17).

### 5.10.2 지표

| 지표 | 정의 | MVP | Phase 2 |
|---|---|---|---|
| 점유율 share | 티어 t, 특징 f, 창 w: k = 특징 보유 수, n = 표본 수. 점 추정 p̂ = (k+1)/(n+2) (라플라스), 구간 = 95% Wilson(k, n) | 창 = 최근 3개월 롤링. 소스별 가중 없음 | 창 = 8주, 소스 가중(5.12) |
| 모멘텀 | MVP: Δ = p̂(최근 3개월) − p̂(직전 3개월), 기술 통계만. Phase 2: log OR = logit p̂(최근 8주) − logit p̂(직전 24주) | 6개월 누적 후부터 표시 | 5.12 검정 |
| 확산 지연 | T1과 T2(또는 T2와 T3) 주간 점유율(4주 이동평균) 사이 교차상관이 최대인 지연 L ∈ [0, 52]주. 시계열 ≥ 52주, 최대 상관 ≥ 0.5일 때만 보고 | **MVP 제외**(정성 메모만) | P2 |
| 생애 단계 | 태동/상승/정점/하락, 5.12.4 규칙 | **MVP 제외** | P2 |
| 축 분포 | 티어별 각 L1 축의 중앙값·IQR(관측은 융합값) | 표시 | 표시 |
| 감쇠 가중 | w(age) = 0.5^(age_days/182), 트렌드 점유율 계산에만 적용 | **MVP 제외**(3개월 창은 비가중) | P2 |

"변화 후보"(MVP): 두 창 모두 n ≥ 20이고 두 창의 Wilson 구간이 겹치지 않을 때 표시한다. 이는 통계적 유의 판정이 아니며 운영자 검토 대상 표시일 뿐이다. 한쪽이라도 n < 20이면 "표본 부족"으로 표기하고 Δ를 회색으로 둔다.

표본 해상도 참고: n = 45(T1 3개월)일 때 p = 0.3의 Wilson 반폭 ≈ 0.13, n = 20일 때 ≈ 0.20. MVP 리포트로는 ±0.15 미만 변화를 판별할 수 없음을 리포트 머리말에 고정 문구로 둔다.

### 5.10.3 트렌드 특징 정의(`config/trend-features.json`, 시즌 릴리스에서만 변경)

| ID | 특징 | 규칙 |
|---|---|---|
| TF01 | 세리프 헤드라인 | F17 ≥ 0.5 |
| TF02 | 알약형 버튼 | F02 ≥ 0.5 |
| TF03 | 직각 모서리 | F01 ≤ 2px |
| TF04 | 다크 테마 | F25 = true |
| TF05 | 글래스(배경 블러) | F08 ≥ 1 |
| TF06 | 하드 섀도 | F07 ≥ 0.2 |
| TF07 | 부드러운 그림자 카드 | F05 ≥ 0.5 & F06 ≥ 12px |
| TF08 | 초대형 타이포 | F18 ≥ 4.0 |
| TF09 | 고채도 accent | F20 ≥ 0.20 |
| TF10 | 모노크롬 | F21 ≤ 2 & F20 < 0.05 |
| TF11 | 그라디언트 표면 | F09 ≥ 0.2 |
| TF12 | 비대칭 레이아웃 | F23 ≥ 0.35 |
| TF13 | 넓은 여백 | F10 ≥ 0.60 |
| TF14 | 이미지 주도 | F24 ≥ 0.35 |
| TF15 | 벤토 레이아웃 | 비전 `l2.layout_pattern_id` = 03장 벤토 패턴 ID (다수결, unstable 제외) |
| TF16 | 그레인 질감 | 비전 l2.texture_grain = true (다수결) |
| TF17 | 모노 서체 사용 | mono 계열 글자 비율 ≥ 5% |
| TF18 | 따뜻한 팔레트 | L1 temperature ≥ 0.65 |

null 특징을 가진 표본은 그 특징의 n에서 뺀다.

### 5.10.4 MVP 월간 수동 리포트 절차

| 일정 | 작업 |
|---|---|
| 매월 1~5일 | 운영자가 직전 월에 티어별 소스에서 발견한 URL 40개를 `data/observations/YYYY-MM.csv`에 기록(열은 candidates.csv와 같음). 플랫폼 메타데이터는 URL·수상일·카테고리만(LG-01-2) |
| 매월 6일 | `pnpm ingest trend YYYY-MM` → 스크리닝·캡처·추출·비전 태깅(role=observation) |
| 매월 7일 | `pnpm ingest trend-report YYYY-MM` → `reports/trend/YYYY-MM.md` 초안 자동 생성 + `trend_reports` 저장 |
| 매월 10일까지 | 운영자가 "관찰 메모"·"시즌 백로그" 절 작성 후 확정 |

운영자 소요 목표: 월 3시간 이하. 관측 URL 수가 40개 미만이어도 리포트는 발행하며 n을 그대로 표시한다.

리포트 양식(초안 자동 생성 부분은 `{}`):

```markdown
# 트렌드 월간 리포트 {YYYY-MM} (내부용 — 외부 공개 금지)
- 정규화기 {normalizer_version} · 특징 정의 v{feature_def_version} · 추출기 {extractor_version}
- 해석 주의: 3개월 창 기준. n=45에서 ±0.13 미만 차이는 판별 불가. 사용자 로그 미사용.

## 1. 표본
| 티어 | 이번 달 n | 3개월 창 n | 직전 3개월 n | 소스별 n | 캡처 성공률 |
{rows}

## 2. 특징 점유율 (3개월 창)
| 특징 | T1 p̂ [95% CI] (k/n) | T2 | T3 | Δ T1 vs 직전 | 표시 |
{rows: 표시 = "변화 후보" | "표본 부족" | ""}

## 3. 축 분포 (중앙값 [IQR])
| 축 | T1 | T2 | T3 | 시드(활성 세트) |
{rows}

## 4. 관심도 보조 지표 (AUX, 합산 금지)
| 키워드 | 소스 | 조회일 | 지수 | 비고 |

## 5. 이벤트 메모
(WWDC·Google I/O·Figma Config 등 해당 월 이벤트와 관찰 — 정성)

## 6. 관찰 메모 (운영자, 최대 3건)
- 특징 / 근거 표 행 / 판단(관망 | 시즌 후보)

## 7. 시즌 백로그 반영
- 레퍼런스 추가·은퇴 후보 ID, 프리셋·택소노미 변경 제안(→03장), 트렌드 특징 정의 변경 제안
```

## 5.11 분기 시즌 릴리스 절차

D-053(R-30으로 채택): 시즌 ID = `YYYY-S{n}`(S1=1~3월, S2=4~6월, S3=7~9월, S4=10~12월). 릴리스 목표일 = 분기 첫 월요일, 동결일 = 그 14일 전. 최초 시즌은 MVP 출시 분기 ID로 하며, 시드 60개가 그 코퍼스다.

| 단계 | 작업 | 게이트 |
|---|---|---|
| SR-1 동결 | 활성 세트 변경 후보 확정: 추가(관측 중 시즌 후보) ≤ 활성 세트의 20%, 은퇴(접속 불가·opt-out·리디자인으로 유형 변화·제외 카테고리) | 5.2.2 쿼터를 새 활성 세트가 여전히 만족(Phase 2에서 총수가 늘면 비율로 환산) |
| SR-2 재캡처 | 활성 세트 전체 재캡처(스크린샷 90일 삭제 정책 때문에 새로 수집). 접속 불가 사이트는 은퇴 | 캡처 성공률 ≥ 90% |
| SR-3 라벨 | 신규 추가분 사람 라벨. 기존 사이트는 리디자인 감지(축 변화 > 0.15 또는 F26 폰트 변경) 시만 재라벨 | 모든 활성 레퍼런스에 유효 라벨 |
| SR-4 학습 | 5.5.5 매핑 재학습, 새 정규화기 `draft` 생성 | 5.7.4 목표 충족 |
| SR-5 자기검증 | 5.9 전체 | 통과 |
| SR-6 재계산 | 레퍼런스 L1(`reference_l1` 새 버전 행), 카드 x_card(`survey_items.x_card_by_normalizer`, 02장 2.15), 앵커 프리셋 측정 L1. 유형 중심 c_T는 03장 3.4.7 설계값이라 재계산하지 않는다(R-04, 02장 2.11) | — |
| SR-7 프로필 재생 | 기존 사용자 프로필을 원 응답 로그로 새 버전 재계산(재생 로직 →02장) | 유형 유지율 ≥ 85%, 미달 시 릴리스 보류 |
| SR-8 축 상관 | 5.7.4 축 간 상관 규칙 | |r| ≥ 0.75 쌍 0 |
| SR-9 근거 리포트 | 유형별(`type_primary`) 원시 특징 P10/P50/P90(서로 다른 도메인 ≥ 3개 집계), 프리셋 토큰의 범위 이탈 목록 → 03장. 03장이 이 리포트로 토큰을 조정하면 그 프리셋은 `provenance = {method:'cluster_median', domains:[집계에 쓴 eTLD+1 ≥ 3]}`(08장 G1) | 조정하지 않은 프리셋은 `operator` 유지 |
| SR-10 시그니처 | 활성 레퍼런스의 `phash_1280`·`originality_sig` 재계산(재캡처 기준). 은퇴 레퍼런스도 비교 집합에 남긴다(opt-out·excluded 제외). 비교 집합·임계값은 08장 8.3, `config/originality.json` 재보정은 08장 8.3.4 | 08장 보정 절차 통과 |
| SR-11 릴리스 | 정규화기 `released`, 이전 버전 `superseded`, 릴리스 노트 `reports/season/<ID>.md` | 운영자 승인 |
| SR-12 롤백 | 출시 후 7일 안에 이상(결과 유형 분포에서 단일 유형 > 40%, 노출 시안 취향 일치도 TM 중앙값이 직전 시즌 대비 10점 이상 하락) 시 직전 정규화기를 다시 `released`로 전환하고 재생 결과를 폐기 | — |

릴리스 노트 필수 항목: 활성 세트 변경 목록, 5.7.4 지표 전·후, 축 상관 행렬, 재생 유지율, 매핑 가중치 변화, 트렌드 특징 정의 변경, 미해결 경고.

클래식 풀(설문 노출 비율용 정의, 사용처 →02장): 수집 후 ≥ 18개월 & 3개 시즌 이상 연속 활성 & 운영자 승인인 레퍼런스. MVP 최초 1년간은 해당 사이트가 없으므로 `era=classic` 사람 판정으로 대체한다.

## 5.12 Phase 2: 자동 수집·급등 감지의 통계 설계

이 절 전체는 **MVP 제외**다. MVP 스키마는 이 절의 요구를 additive 마이그레이션만으로 수용해야 한다(TL-28).

### 5.12.1 자동 수집

- 대상: `sources.tos_allows_automated='yes'` & `robots_allows='yes'` & `status='active'`인 소스만. 그 외 소스로의 요청은 크롤러가 거부하고 테스트가 실패해야 한다.
- 인터페이스: `SourceAdapter { id; fetchCandidates(since: Date): Promise<{url, discoveredAt, meta:{title?, awardDate?, category?}}[]> }`. 플랫폼의 설명·이미지·평점은 반환 타입에 없다.
- 주기: 매주 월요일 04:00 KST. 수집 후 5.4 캡처 규칙 그대로(원본 사이트에서만 추출).
- 사람 검수 큐: unstable + 무작위 10% + 신규 군집 대표 샘플, 주 30분 상한(초과분은 다음 주로 이월, 미검수 레퍼런스는 관측 전용).
- 수집 품질: 소스별 주간 성공률 ≥ 90% 목표, 50% 미만인 주는 그 소스를 해당 주 지표에서 제외(생존 편향 차단).

### 5.12.2 소스 보정

- 티어 내 소스별 가중 v_s = 1 / (티어 내 활성 소스 수) / (소스 s의 창 내 표본 수). 한 소스가 티어 점유율을 지배하지 않게 한다.
- 가중 점유율 p̂_w = Σ_i v_{s(i)}·w(age_i)·1[f_i] / Σ_i v_{s(i)}·w(age_i). 유효 표본 n_eff = (Σ w')² / Σ w'² 로 구간 계산.

### 5.12.3 급등 감지(다중 검정 보정 포함)

```
대상: 티어 t × 트렌드 특징 f (18 × 3 = 54 검정/주)
창: 최근 8주(R) vs 직전 24주(B)
조건(모두):
  1) n_eff(R) ≥ 30, n_eff(B) ≥ 30                                  # 최소 표본
  2) 베타-이항 사후 p_R ~ Beta(k_R+1, n_R−k_R+1), p_B 동일.
     몬테카를로 20,000회로 P(OR > 1.5) ≥ 0.95                         # 효과 크기 + 확신
  3) 2) 대응 빈도주의 p값(2×2 Fisher 정확 검정, 단측)에 Benjamini–Hochberg q = 0.10 적용,
     54개 검정 묶음 단위로 보정                                         # 다중 검정
신호 → 사람 검토 큐(자동 시즌 반영 금지). 같은 (t,f) 신호는 4주 내 재발행하지 않음.
```

최소 검출 효과(양측 α=0.05, 검정력 0.8, R:B = 1:3) — 계획 수립용:

| n_R / n_B | p_B=0.05 | 0.10 | 0.20 | 0.30 |
|---|---|---|---|---|
| 30 / 90 | 0.245 | 0.33 | 0.47 | 0.59 |
| 56 / 168 (T1 주 7개 × 8주) | 0.18 | 0.26 | 0.40 | 0.51 |
| 120 / 360 | 0.135 | 0.205 | 0.33 | 0.445 |
| 200 / 600 | 0.11 | 0.18 | 0.30 | 0.41 |

해석: T1 단일 어워드 소스(주 약 7개)만으로는 점유율이 2배 이상 뛰는 변화만 잡힌다. Phase 2 진입 시 T1 주간 유효 표본 ≥ 15를 목표로 소스를 확보하고, 못 하면 T1 창을 12주/36주로 늘린다(설정값).

### 5.12.4 생애 단계(T1 기준, 주 단위)

| 단계 | 규칙 |
|---|---|
| 태동 | T1 p̂ < 0.05 & 5.12.3 신호 |
| 상승 | 신호 & T2 8주 기울기 > 0 (회귀 기울기 95% 구간 하한 > 0) |
| 정점 | T1 8주 기울기 95% 구간이 0 포함 & T1 p̂가 최근 52주 최댓값의 90% 이상 |
| 하락 | T1 8주 기울기 95% 구간 상한 < 0 |
| 선도층 이탈(핵심 신호) | T1 하락 & T2 또는 T3 상승 — 시즌 릴리스에서 해당 특징의 프리셋 `era` 재검토 대상 |

### 5.12.5 새 스타일 발견(임베딩 군집)

- 입력: 레퍼런스 이미지 임베딩(Phase 2에서 도입하는 로컬 오픈 가중치 인코더 1종, 모델·버전 고정, R-38) ⊕ 표준화 원시 특징 F01~F24 → UMAP(10차원, n_neighbors 15, random_state 42) → HDBSCAN(min_cluster_size 8).
- 신규 군집 = 구성원 ≥ 70%가 최근 8주 수집 & 모든 유형 중심과 L1 거리 > 0.30.
- 산출은 사람 검토 큐로만 전달하며, 유형·프리셋 자동 추가는 금지한다.

### 5.12.6 검증(Phase 2 진입 게이트)

| 항목 | 기준 |
|---|---|
| 합성 귀무 데이터(변화 없음) 1,000회 시뮬레이션 | 신호의 FDR ≤ 0.10, 주당 평균 오탐 ≤ 1 |
| 합성 주입(p 0.10→0.25, n_R=120) | 검출률 ≥ 0.8 |
| 과거 12개월 백테스트 | 운영자가 인정한 트렌드 대비 정밀도 ≥ 0.5 |
| 감쇠 단위 테스트 | age 182일 가중치 0.5 ± 0.01 |
| robots·약관 차단 목록 테스트 | 위반 요청 0건 |

## 5.13 피드백 루프·인기 편향·다양성 붕괴 대책

### 5.13.1 위험과 대책

| 위험 | 기제 | MVP 대책 | Phase 2 대책 |
|---|---|---|---|
| 자기강화 루프 | 많이 노출한 스타일이 많이 선택되고 그것이 트렌드 신호가 됨 | 사용자 선택·생성 채택 로그를 트렌드 점유율 계산에서 **코드로 배제**(트렌드 모듈은 `reference_sites`·`reference_*` 외 테이블 참조 금지, 린트 규칙 + 테스트) | IPS 가중: share = Σ 1[chosen has f]/p_i ÷ Σ 1/p_i, p_i = max(propensity, 0.05). 별도 "사용자 선호 지표"로만 표시, 공급 지표와 합산 금지. 학습 이용 동의 필요(→08장) |
| 위치 편향 | 4지선다 좌상단 선택 증가 | 카드 위치 무작위 셔플과 노출 로그 `impressions`(→02장). 주간 위치별 선택률 최대/최소 ≤ 1.3 점검 | 위치 효과를 IPS propensity에 반영 |
| 인기 편향(소스) | T2 인기 목록·템플릿 판매 순위가 이미 인기 있는 스타일을 과대표집 | 시드 쿼터(5.2.2): 단일 발견 소스 ≤ 12, 빌더 템플릿 ≤ 15, 유형별 6~10 | 소스 가중 1/소스 수(5.12.2) |
| 심사 편향 | T1 수상작이 실험적·에이전시 사이트에 치우침 | T1을 20/60으로 제한, T3(실사용) 20 확보, local_business 용도 20 | 티어별 별도 점유율, 티어 간 합산 금지 |
| 다양성 붕괴(레퍼런스) | 시즌마다 트렌드 사이트만 추가 → 활성 세트가 한 스타일로 수렴 | 시즌 교체 ≤ 20%, 유형별 하한 6 유지, era classic ≥ 12 | 활성 세트 유형 분포 엔트로피 ≥ 0.9·ln 8 |
| 다양성 붕괴(생성) | few-shot이 선택된 시안만 강화 | few-shot 순환 규칙은 →04장. 이 장은 레퍼런스를 few-shot으로 쓰지 않는다 | — |
| 다양성 붕괴(결과) | 프리셋 스냅으로 결과 유형이 소수에 몰림 | 주간 결과 유형 분포 모니터링(→02장 지표) | 단일 유형 > 40% 또는 엔트로피 기준선 대비 20% 하락 시 탐색 비율 ε 0.1→0.2(→02장) |
| 생존 편향 | 차단된 사이트가 빠져 특정 스타일(대형 사이트) 과소표집 | 리포트에 티어별 캡처 성공률 표시 | 성공률 < 50% 주 제외(5.12.1) |

### 5.13.2 다양성 지표(활성 세트, 시즌 릴리스마다 계산)

- 유형 분포 엔트로피 H = −Σ p_m ln p_m, 목표 ≥ 0.9 ln 8 (≈ 1.87).
- 평균 쌍 L1 거리(활성 세트 사람 라벨 기준) — 직전 시즌 대비 10% 이상 감소 시 릴리스 노트 경고.
- 축별 사람 라벨 수준 커버리지(5.2.2 규칙) 유지.

### 5.13.3 opt-out 시 데이터 처리(기한·접수 절차는 →08장)

| 대상 | 처리 |
|---|---|
| `reference_sites`, `reference_captures`, `reference_features`, `reference_l1`, `vlm_tags`, `reference_labels` | 해당 도메인 행 삭제 |
| 스크린샷 | 즉시 삭제 |
| `phash_1280`·`originality_sig`(P2: 임베딩) | 삭제(가드 비교 집합에서 제거) |
| 프리셋 `provenance.domains` | 해당 도메인을 포함한 프리셋을 찾아 남은 도메인 < 3이면 `needs_review` + 운영자 알림, 14일 안에 재집계 또는 `operator`로 재검수(08장 8.1.6-4) |
| 저장된 결과의 `similar_site_ids` | 행은 유지, 표시 시점에 `link_allowed`·`excluded_domains`를 다시 확인해 숨김(02장 2.14) |
| `similar_site_candidates` | 즉시 제외(뷰 조건) |
| `excluded_domains` | 등록(재수집 차단) |
| 정규화기 분위 테이블(집계값) | 현 시즌 유지, 다음 시즌 릴리스에서 해당 도메인 없이 재적합. 이 처리의 적법성은 출시 전 법무 확인(→08장) |
| 시드 쿼터 | 미달 발생 시 다음 시즌 릴리스에서 보충 |

## 5.14 소스별 약관 확인 매트릭스

아래 표의 약관 허용 여부는 모두 **미확인(`unknown`)이 초기값이며 출시 전 원문 확인** 대상이다. 확인 결과와 확인일은 `sources` 테이블에 기록하고, 정책 원칙은 → 08장을 따른다. 확인 전까지 모든 플랫폼 소스는 `manual_only`다.

source_id·kind·초기값은 08장 8.1.2 매트릭스와 같다(그 표가 법무 원본, 이 표는 데이터 측 사용 범위를 더한 것).

| source_id | kind | 티어 | MVP 접근 | 기록 허용 항목 | 금지 | 확인할 조항 | Phase 2 자동화 조건 |
|---|---|---|---|---|---|---|---|
| awwwards | platform | T1 | manual | 원본 URL, 수상일, 카테고리 텍스트 | 목록·순위·점수·심사평·이미지 복제 | 스크래핑·자동 접근, 파생 통계 공개 | tos=yes & robots=yes, 또는 공식 피드·API |
| fwa | platform | T1 | manual | 동일 | 동일 | 동일 | 동일 |
| cssda | platform | T1 | manual | 동일 | 동일 | 동일 | 동일 |
| godly | platform | T1 | manual | 원본 URL | 플랫폼 영상·이미지 복제 | 동일 | 동일 |
| dribbble, behance | platform | T2 | manual(참고 열람) | 샷이 링크한 운영 중 원본 사이트 URL만 | 샷·프로젝트 이미지 다운로드, 샷 자체의 특징 추출 | 자동 접근 | 대상 아님 |
| framer-market | platform | T2 | manual | 템플릿 미리보기(공개 데모) URL | 템플릿 파일·이미지 다운로드 | 미리보기 사이트 분석 허용 여부, 자동 접근 | tos=yes |
| webflow-showcase | platform | T2 | manual | 공개 사이트 URL | 동일 | 동일 | tos=yes |
| producthunt | platform | T2 | manual | 제품 공식 사이트 URL, 런치일 | 설명·댓글·투표 수 복제 | API 이용 약관(상업적 이용 범위) | 공식 API 약관 허용 시 |
| dbcut | platform | T2 | manual | 원본 URL, 등록일, 분류 | 갤러리 캡처·설명 복제 | 자동 접근, 출처 표기 요건 | tos=yes |
| gdweb | platform | T2 | manual | 동일 | 동일 | 동일 | tos=yes |
| direct | platform(가상) | T3 | 운영자 직접 방문 | 원본 URL | — | — | 해당 없음 |
| google-trends | stats | AUX | 공식 화면 수동 월 1회 | 집계 지수, 조회일, 출처 | 자동 조회(확인 전) | 자동 조회·재게시 허용 | 공식 API 약관 허용 시 |
| naver-datalab | stats | AUX | 공식 화면 수동 월 1회 | 동일 | 동일 | 동일 + 오픈 API 이용 조건 | 동일 |
| site:<domain> | origin_site | 레퍼런스 tier | extract(ingest CLI만) | 08장 8.1.4 저장 허용 항목(원시 특징, pHash, 비공개 스크린샷 90일, `<title>`) | 08장 8.1.4 저장 금지 항목, 로그인·차단 우회 | robots, TDM 예약 신호, 이용약관의 자동 접근 금지 조항(운영자가 시드 등록 시 1회) | 동일 |

시드 등록 시 운영자는 원본 사이트의 이용약관에 자동 접근 금지 조항이 명시돼 있는지 확인하고, 명시돼 있으면 그 사이트를 시드에서 뺀다(체크리스트 S-04에 포함).

## 5.15 수용 기준

**시드·데이터**
- AC-05-01: Given 시드 동결 후, When `pnpm ingest quota` 실행, Then 5.2.2의 모든 쿼터(총수 60, 도메인 중복 0, 티어·용도·셀·유형·축 수준·테마·언어·era·소스·제작 주체·품질 플래그)가 사람 라벨 기준으로 통과하고 위반 0건을 출력한다.
- AC-05-02: 시드 60개 전부 `reference_labels(purpose=primary)`에 5축(판단 불가 축별 ≤ 5%)·L2·유형·체크리스트가 있다.
- AC-05-03: `candidates.csv`·`observations/*.csv`에 플랫폼 설명·평점·이미지 열이 없다(스키마 검사 테스트).
- AC-05-04: `reference_sites`·`reference_*`·`vlm_tags`·`normalizers` 테이블에 anon/authenticated 역할의 SELECT가 거부된다(RLS 테스트). 사용자 API는 `similar_site_candidates` 뷰 컬럼만 반환한다.

**캡처·준법**
- AC-05-05: Given robots.txt가 `/`를 Disallow하는 픽스처 사이트, When 캡처, Then 문서 요청 0건, `rejected/robots_disallow`.
- AC-05-06: Given 429 또는 403을 반환하는 픽스처, When 캡처, Then 재시도 0회, `rejected/blocked_429_403`, 소스·도메인에 기록.
- AC-05-07: `sources.status ∈ {manual_only, blocked, excluded}`(MVP의 모든 platform·stats 소스)의 URL 패턴으로 자동 요청을 시도하면 ingest CLI가 예외를 던지고 외부 요청 0건이다(테스트).
- AC-05-07a: Given `tdm-reservation: 1` 헤더 또는 `noai` 메타를 내는 픽스처, When 캡처, Then 추출·스크린샷 0건, `rejected/tdm_reserved`, `tdm_reserved=true`. robots.txt가 5xx인 픽스처는 요청 0건으로 `robots_5xx`.
- AC-05-08: 모든 캡처 요청의 User-Agent가 `TasteFitBot/1.0 (+https://<서비스도메인>/sources)` 형식이다. 도메인당 문서 요청 간격 ≥ 5s, 도메인당 동시 연결 1. 운영 워커 코드 경로에서 외부 URL 탐색 0건(06장 P4).
- AC-05-09: `ref-screenshots` 버킷이 public이면 배포 전 점검 스크립트가 실패한다. 일일 배치 후 `captured_at < now() − 90d`인 스크린샷 객체 0건(D-31).
- AC-05-10: 사용자 쪽 라우트(설문·결과·편집·내보내기) 응답 본문과 HTML에서 `ref-screenshots` 경로 참조 0건(E2E).
- AC-05-11: Given opt-out 도메인 등록, When 처리 배치 실행, Then 5.13.3 표의 삭제 대상 행·객체(`phash_1280`·`originality_sig` 포함)가 0건이고 `similar_site_candidates`에 해당 도메인이 없으며, 해당 도메인이 `provenance.domains`에 있던 프리셋 중 남은 도메인 < 3인 프리셋이 `needs_review`다(08장 AC-08-06과 같은 조건).

**추출기**
- AC-05-12: 레퍼런스·프리셋·설문 자극물·생성 후보의 L1 계산이 `packages/extractor`의 `extractL2`·`toL1` 한 경로만 호출한다(다른 패키지의 중복 구현 0 — 의존성 검사). `packages/extractor`의 의존성 트리에 `packages/llm`·provider SDK가 0개다.
- AC-05-12a: 시드 60개 전부 `phash_1280`과 `originality_sig`의 7속성이 채워져 있고, 같은 렌더에 대해 `phash64()`가 결정적이다(같은 입력 → 같은 64비트). MVP에서 `reference_features.embedding`은 전 행 null이며 임베딩 계산 코드 경로가 기능 플래그 off다(R-38).
- AC-05-13: 같은 URL을 24시간 안에 2회 캡처하면 시드의 95% 이상에서 축 차이 ≤ 0.03, 수치 특징 상대 차이 ≤ 5%.
- AC-05-14: 이미 렌더된 페이지의 `extractL2()` p95 ≤ 2.5s, URL 캡처 전체 p95 ≤ 45s(시드 60 측정).
- AC-05-15: `pnpm eval:extractor`이 `reports/extractor_eval.md`를 생성하고, 자동 추출 ρ ≥ 0.70·MAE ≤ 0.15인 축이 3개 이상이다. 미달 축은 정규화기 `reliable=false`로 기록된다.
- AC-05-16: 비전 태깅 3회 표준편차 평균 ≤ 0.10, unstable ≤ 10%, 비전 ρ ≥ 0.60, 융합 ρ ≥ 0.75(축별, 미달 축은 리포트 표시).
- AC-05-17: L2 속성별 운영자 대 비전 다수결 Cohen's κ ≥ 0.60, 미달 속성은 관측 레퍼런스에서 `null`로 저장된다.
- AC-05-18: 비전 출력은 5.6.2 JSON 스키마 검증을 통과한 것만 저장된다. `ref_tagger` 호출 1회당 이미지 1장, 프롬프트에 페이지 텍스트·`title` 0건, `processors.yaml` 미승인 공급자로는 호출 0건. 시즌 빌드 태깅 지출이 `REF_TAGGING_BUDGET_USD`를 넘지 않는다.

**라벨 신뢰도**
- AC-05-19: 운영자 test-retest ICC(2,1) ≥ 0.80(축별, 30개, 간격 ≥ 14일). 결과가 리포트에 있다.
- AC-05-20: 2차 평가자 ICC(2,1)가 리포트에 있거나, 없으면 정규화기 `inter_rater="unverified"`와 측정 기한(출시 +30일)이 기록되어 있다.
- AC-05-21: 활성 세트 사람 라벨의 축 간 |r| ≥ 0.75 쌍이 0이다. 0.60 이상 쌍은 시즌 리포트에 결정 기록이 있다.

**자기검증·정규화**
- AC-05-22: `pnpm eval:extractor:selfcheck`에서 앵커 프리셋 `PS-T1`~`PS-T8` 모두 03장 3.4.7 표 대비 축별 |오차| ≤ 0.10, radius ±1px, 색 ΔE2000 < 5. 실패 시 CI 실패. 테스트는 3.4.7 값을 데이터 파일(`data/taxonomy`)에서 읽으며 테스트 코드에 하드코딩하지 않는다.
- AC-05-23: 설문 카드 48장(기준 벡터 16 × 템플릿 3) 중 활성 카드는 모두 x_card(released 정규화기 버전 포함)를 저장하고 5.9 기준을 통과한 기록이 있다. 2단계 A/B 120쌍의 대상 축 수준이 {0.2, 0.5, 0.8} 밖인 항목 0건, 축별 활성 쌍 ≥ 19. 1단계·2단계 자극물 원본이 레퍼런스 스크린샷이 아님(경로 검사).
- AC-05-24: 프리셋 측정 L1의 모든 쌍 거리 ≥ 0.25.
- AC-05-25: 버전이 다른 L1 벡터 간 거리 함수 호출은 예외를 던진다(단위 테스트). released 정규화기 UPDATE는 DB 트리거로 거부된다.
- AC-05-26: 시즌 릴리스 재생 후 기존 사용자 유형 유지율 ≥ 85%가 릴리스 노트에 있고, 미달이면 정규화기 상태가 `released`로 바뀌지 않는다.

**트렌드**
- AC-05-27: 월간 리포트의 모든 점유율 셀에 k/n과 95% Wilson 구간이 있고, n < 20 셀은 "표본 부족"으로 표시된다(생성기 단위 테스트).
- AC-05-28: 트렌드 집계 모듈이 `survey_answers`·`impressions`·`events`·`generation_jobs`·`candidates`·`mockup_versions`를 참조하지 않는다(import·SQL 린트 + 테스트, R-35). MVP 리포트에 "사용자 로그 미사용" 문구가 있다.
- AC-05-29: AUX 지표는 리포트 4절에만 있고 점유율 계산 입력에 포함되지 않는다(테스트).
- AC-05-30: 리포트 머리말에 "내부용 — 외부 공개 금지" 문구가 있고 플랫폼 로고·이미지 0건(LG-17).
- AC-05-31: MVP 코드베이스에 Phase 2 기능(자동 SourceAdapter 실행 스케줄, 급등 감지, 군집)이 기능 플래그 off 상태이거나 미구현이며, 스키마는 additive 마이그레이션만으로 5.12를 수용한다(마이그레이션 리뷰 체크리스트).

**Phase 2 진입 게이트**(MVP 출시 기준 아님)
- AC-05-32: 5.12.6 표의 모든 항목 통과.

## 5.16 추가 결정

| ID | 결정 제안 | 영향 장 |
|---|---|---|
| D-051 | ~~L1 축 코드 키~~ → R-01로 대체 | — |
| D-052 | 취향 추출 뷰포트 = 1280×800, DPR 1, 측정 영역 상단 최대 2400px. 레퍼런스·프리셋·설문 자극물(desktop 렌더)·생성 후보 공통(04장 4.x "1280에서 extractL2"와 일치) | 02, 04, 06 |
| D-053 | 시즌 ID 규칙 → R-30으로 채택(내용 5.11 그대로) | — |
| D-054 | 시드 쿼터 = 5.2.2 표(티어 20/20/20, 용도 `saas`·`portfolio`·`local_business` 각 20, 유형 T1~T8 각 6~10, ko ≥ 24, dark ≥ 9, classic ≥ 12) | 00, 09 |
| D-055 | ~~MVP 이미지 임베딩·가드 규칙 3~~ → R-38(임베딩은 Phase 2, 닮은 사이트는 L1 거리)·R-20(MVP 시각 유사도는 pHash)으로 대체 | — |
| D-056 | 축 신뢰 플래그: 자동 추출 ρ < 0.70 축은 `reliable=false` → 04장 TM에서 λ_k = 0. 평가자 간 ICC < 0.60 축은 `subjective=true` → λ_k × 0.5. 5축 중 3축 이상 unreliable이면 출시 차단(07장 G2 채택) | 04, 07 |
| D-057 | 2차 평가자(실무 ≥ 2년) 30개 라벨은 출시 전 확보 원칙, 미확보 시 `unverified`로 출시하고 출시 +30일 내 측정 | 07, 09 |
| D-058 | ~~05장이 `anchor_l1`을 사람 라벨로 수정~~ → R-04로 대체(3.4.7 표가 단일 원천, 수정은 03장 소관, 5.9 절차 2는 수정 요청만) | — |
| D-059 | 운영자 운영 예산: 월간 관측 40 URL·월 3시간, 시즌 릴리스 1회 8시간 이하. Phase 2 검수 큐 주 30분 상한 | 00, 09 |
| D-05A | 트렌드 집계에 MVP 동안 사용자 로그 미사용 → R-35로 채택. Phase 2 사용 시 IPS 보정 + 학습·통계 이용 동의 항목 필요(이 부분은 유지) | 02, 08 |
| D-05B | 스크린샷 버킷 이름 `ref-screenshots`(private, 서명 URL 5분, admin 전용) — 06장 6.x 버킷 표와 일치 | 06, 08 |
| D-05C | 플래그 `REF_TAGGING_BUDGET_USD=10`(시즌 빌드 1회당 `ref_tagger` 지출 상한, ingest CLI 전용, 생성 예산 R-22와 별도 집계) | 00, 06 |
| D-05D | ingest CLI 하위 명령 = `pnpm ingest add|capture|tag|quota|trend <YYYY-MM>|trend-report <YYYY-MM>|season-build <시즌ID>`(관리자 로컬 전용). 평가 = `pnpm eval:extractor`(07장 G2), 자기검증 = `pnpm eval:extractor:selfcheck`(CI) | 06, 07, 09 |
| D-05E | 레퍼런스 표시 필드 `reference_sites.title_ko`(≤ 40자)·`blurb_ko`(≤ 60자)·`type_primary`를 두고 `similar_site_candidates` 뷰가 이를 내보낸다(02장 2.14 입력) | 02, 06 |

## 5.17 다른 장과 맞출 인터페이스

| 이름 | 형태 | 상대 장 |
|---|---|---|
| `packages/extractor`: `capture(url, opts)`, `extractL2(page) → Features(원시 F01~F30 + l2_auto)`, `toL1(features, normalizerVersion) → L1Vector`, `phash64(image) → bit(64)` | TS 함수(llm 의존 금지) | 03, 04, 06, 08, 09 |
| `L1Vector {expression, temperature, shape, density, depth}` + `normalizer_version`(R-01, R-30) | JSON 스키마 | 02, 04, 06 |
| 유형 중심·앵커 = 03장 3.4.7(`anchor_l1` = `predictL1`(기본 L2)), 앵커 프리셋 `PS-T1`~`PS-T8`, 프리셋 `provenance {method, domains[]}` | 03장 원천(R-04) | 02, 03, 08 |
| 설문 자극물 `target_l1`, `x_card`, `x_card_by_normalizer`, `status(draft/verified/active/retired)`, 앵커 이미지 `anchor-A{k}-{level}.webp` | `survey_items`·`survey:build`(02장 원천) | 02, 09 |
| 03장 L2 ID: `depth_id`, `layout_pattern_id`, `radius_family_id`, `palette_structure_id`, `image_style_id`, 폰트 `classification` | enum | 03 |
| `reference_sites.phash_1280`, `reference_features.originality_sig {palette_oklab, font_substitute_ids, radius_family_id, depth_id, layout_pattern_id, section_sequence(P2)}` | 컬럼(08장 D-0802) | 04, 06, 08 |
| `similar_site_candidates` 뷰: 06장 DDL에 `title_ko`·`blurb_ko`·`type_primary` 추가 필요(D-05E) | DB 뷰 | 02, 06 |
| 06장 DDL 정합 필요: `sources`에 08장 법무 필드(`kind`, `robots_checked_at`, `tdm_reserved`, status `excluded`, access_method `extract`; 현재 06장은 `crawl`) 추가, `reference_sites.title_ko`·`blurb_ko`·`type_primary`, `reference_captures.reject_reason` 값 확장 | DDL | 06 |
| 08장 표기 정합 필요: 8.1.2의 `references.source`·상태 `pending/approved` → 이 장 `reference_sites.source_id`·`status`(`approved` = `active`), google-trends·naver-datalab tier `T3` → `AUX` | 문서 | 08 |
| 06장 구성요소 표(ingest CLI 행)의 LLM 역할명 `reference_tag` → `ref_tagger`(R-12) | 문서 | 06 |
| 테이블: `sources`, `reference_sites`(R-18), `reference_captures`, `reference_features`, `reference_l1`, `vlm_tags`, `reference_labels`, `normalizers`, `excluded_domains`, `rights_requests`(+뷰 `optout_requests`), `trend_feature_defs`, `trend_reports`, (P2) `ingest_runs` | DDL(06장) | 06, 08 |
| `impressions`, `survey_answers`, `events`(R-18) — 트렌드 모듈 참조 금지 대상 | 02·00장 정의 | 00, 02 |
| models.yaml 역할 `ref_tagger`(R-12, 06장 파라미터), 프롬프트 `packages/llm/prompts/ref_tagger@v<N>.md`, `legal/processors.yaml` 승인(08장 D-0809), 플래그 `REF_TAGGING_BUDGET_USD`(D-05C) | 설정 | 06, 08 |
| 임계값: `config/thresholds.json` `extractor` 객체(R-09), 원본 유사도: `config/originality.json`(08장 소유, R-20) | 설정 | 04, 07, 08 |
| CLI: `pnpm ingest …`(D-05D), `pnpm eval:extractor`, `pnpm eval:extractor:selfcheck`, `pnpm survey:build` | pnpm 스크립트 | 06, 07, 09 |
| 설정 파일: `config/extractor/popup-selectors.json`, `config/font-classes.json`, `config/trend-features.json`, `data/normalizers/<version>.json` | 파일 | 06, 09 |
| 어드민: ADM-07 `/admin/references`(목록·라벨 모드 `/admin/references/label`·신규 `/admin/references/new`), ADM-11 권리 요청, `POST /api/admin/references/:id/labels` | 화면·API | 00, 06, 08 |

## 5.18 반영 추적

| 리뷰 ID | 내용 | 반영 절 |
|---|---|---|
| AI-04 | 캡처 표준, 원시 특징, 매핑 함수, 재학습, 비전 3회 중앙값, 융합, 사람 라벨·ICC, 정확도 목표, 리포트 스크립트 | 5.4, 5.5, 5.6, 5.7 |
| AI-09 | 시즌 정규화기·버전 고정·재생·축 상관 점검 | 5.8, 5.11(SR-7, SR-8), 5.7.4 |
| AI-10 | x_card 사용·충실도 검증(D-14·R-06 구조로 조정: 레퍼런스 → 카드가 아니라 기준 벡터 → 카드, 기준 = 의도값 대비 95% ≤ 0.10·최대 ≤ 0.15) | 5.1.2 RD-03, 5.9 |
| AI-15 | 피드백 루프·위치 편향·다양성 붕괴, 사용자 로그 배제, IPS(P2) | 5.13, AC-05-28 |
| AI-16 | MVP 수동 점유율(라플라스·Wilson·n<20), P2 모멘텀·FDR·최소 표본·확산 지연·생애 단계·소스 보정·군집·백테스트 | 5.10, 5.12 |
| AI-08(아이템 부분) | 카드 draft→verified→active(수명주기 원천 02장 2.4.7) | 5.9 |
| AI-21 | 감쇠 가중(트렌드 전용), 클래식 풀 정의 | 5.10.2, 5.11 |
| AI-22 | 검수 큐 주 30분 상한 | 5.12.1, D-059 |
| AI-23 | 사용자 로그 트렌드 이용 동의 필요 → 08장 | 5.13.1, D-05A |
| TL-09 | 추출 조건·특징·매핑·관리자 CLI·시드 CSV·2회 추출 결정성·프리셋 일치 | 5.2.3, 5.4, 5.5, 5.9 |
| TL-22 | 설문 자산 사전 렌더와 x_card 측정, 런타임 호출 0 (빌드 스크립트 본문 →02·09장) | 5.1, 5.9 |
| TL-28 | P2 골격 스키마 선확보(additive) | 5.3, 5.12, AC-05-31 |
| LG-01 | sources 테이블·manual_only·URL만 기록·원본 사이트에서만 추출·robots·UA·속도·차단 시 중단·opt-out·AUX 수동 | 5.3.1, 5.4.1, 5.13.3, 5.14, AC-05-05~08, 11 |
| LG-02 | 스크린샷 목적 제한·비공개 버킷·90일 삭제·얼굴 제외·승인 처리자만 전송 | 5.2.1(S-08), 5.3.3, 5.6.1, AC-05-09·10 |
| LG-03 | 3도메인 집계 근거(provenance), 가드 비교용 pHash·7속성 시그니처 제공(규칙 →08장 8.3, 실행 →04장, R-20) | 5.1.2 RD-04, 5.3.2, 5.3.4, 5.11(SR-9, SR-10) |
| LG-17 | 리포트 내부용, 로고·이미지 금지 | 5.10.4, AC-05-30 |
| LG-19 | 제외 카테고리 | 5.2.1 S-04 |
| QA-22 | 프리셋 왕복 오차 ≤ 0.10, 실제 사이트 MAE ≤ 0.15 | 5.9, 5.7.4, AC-05-22 |
| QA-23 | 비전 일관성·ρ 기준(레퍼런스 태깅 범위) | 5.6.3, 5.7.4 |
| QA-27 | P2 테스트 기준(성공률, 차단 목록, 감쇠, 합성 데이터) | 5.12.6 |
| PD-01(축 상관 기준) | 축 간 |r| ≤ 0.40 목표 | 5.7.4 |
