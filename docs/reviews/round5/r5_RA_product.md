# 라운드 5 리뷰 — R-A 제품·경험 (PM · 프로덕트 디자이너 · UX · UI)

- **대상(실제로 읽은 절)**: `git diff dc8ffe2..HEAD`의 00 10.1 ADM-04 / 01 1.5.2 AC-01-60·1.10.3·1.12.2(기본 규칙·3행)·1.15.3 `support.verified`·1.20 / 03 3.6.5 `defaultImageTag`·3.8.1 줄 예산 함수·3.17·3.18 / 04 4.2.1 `image_tags_allowed`·4.6.2 `hero.headline`·AC-04-46·4.9.4 폴백·AC-04-44·반영 추적. 참조 확인: 03 3.1.5 단계 n·3.1.5a `hero.headline` 행·3.4.6 타입 스케일·3.6.6 heroVariants·3.10.2 태그 키·`space.container` 표, 04 4.10.2 넘침 처리, 01 1.2 S14 route·1.7.1 `photoSubstituted`, 06 6.4.3 verify 행(grep), 07 TC-B-20(grep), decisions_v5 U-11~13.
- **기준**: `docs/spec/rubric.md` C1·C2·C3. 판정 근거는 장 본문이다.
- **규칙**: CLAUDE.md 1.1, 패킷 수렴 규칙. 새 Major는 이번 diff가 만든 것이거나 RA4가 닫히지 않은 경우만. 바뀌지 않은 영역은 Blocker만. 기능 동결. Minor는 기록만 한다.

## 총평

- RA4-01~03(U-11·U-12·U-13)은 모두 장 본문, AC, 반영 추적에 들어갔다. 장 사이 문장도 같다(03↔04, 04↔07 TC-B-20, 01↔06 verify 302).
- U-11 계산 결과를 3.4.6·3.6.6·3.1.5a 값으로 다시 계산했다. 3.8.1 표기와 일치한다. T5는 offset(`t-1` 96px, lg 6)에서 floor(576/91.2)=6, ×2×0.85 → 10이다. full-bleed는 `t-1`로 계산해 11이고, 375(44px, 3줄)는 20이다. 그래서 `maxChars_job ≥ 10`이 성립한다.
- `defaultImageTag` 3값은 모두 3.10.2 태그 표에 있는 키이고 각 용도의 `imageTags` 안에 있다.
- 이번 diff로 생긴 Major/Blocker는 없다. 참조 표기와 문장 정리 수준의 Minor 3건만 기록한다.

## 1. 4라운드 항목 해결 현황

| ID | 상태 | 근거 절(본문 위치) | 비고 |
|---|---|---|---|
| RA4-01 | 해결 | 03 3.8.1 `maxChars` 바깥 `floor`(정수)·`min(space.container,1200)`·`t-display` hero → `t-1` 계산·프리셋별 결과(T5·T8 = 10)·`t-2` 예외 규칙 / 04 4.6.2 `hero.headline` 같은 문장 / AC-04-46 ① 보강(8 프리셋 × 허용 hero ≥ 10, 골든 T5·T8 템플릿 덱 0) | 재계산 결과 일치. ② 비율 표기는 RA5-02(Minor) |
| RA4-02 | 해결 | 04 4.2.1 주석·4.9.4 폴백 조건 "교집합 = ∅(매칭 0 포함)"·값 `{defaultImageTag(p)} ∪ common.texture-*` / 03 3.6.5 `defaultImageTag` 3값·`data:validate`·3.17 `purposes.json` 필드 / 07 TC-B-20 같은 식 / AC-04-44 ① 보강 | 옛 `{storefront}` 문장 0건. 픽스처 문구는 RA5-03(Minor) |
| RA4-03 | 해결 | 01 1.10.3 verify 성공 착지 S14 `/support?verified=1`·`support.verified` 배너(`role="status"`) / 1.12.2 기본 규칙 1줄·`VERIFY_LINK_INVALID`·`SURVEY_ITEMS_INSUFFICIENT`·`JOB_ALREADY_FINISHED` 행 / 1.15.3 키 / AC-01-60 / 06 6.4.3 verify `302 → /support?verified=1` | S14 route `/support`가 1.2 표에 있어 AC-01-03과 충돌하지 않는다. 06 참조 절 번호는 RA5-01(Minor) |

## 2. 새 항목

이번 diff로 생긴 Blocker·Major는 없다. 아래 Minor 3건은 기록만 하고 반영하지 않는다.

### RA5-01 (Minor) 06 verify 행의 문구 키 참조 절이 틀렸다
- **섹션**: 06 6.4.3 `GET /api/rights-requests/:id/verify` 행, 01 1.10.3·1.12.2·1.15.3.
- **허점**: 06 verify 행은 `support.verified`의 위치를 "01장 1.12.2"로 적었다. 그런데 1.12.2에는 실패 행(`VERIFY_LINK_INVALID`)만 있고, 성공 배너는 1.10.3과 1.15.3에 있다. 에이전트가 1.12.2에서 성공 배너를 찾지 못한다.
- **보완안**: 06 verify 행의 참조를 "01장 1.10.3·1.15.3 `support.verified`"로 고친다.
- **수용 기준**: 06에서 `support.verified`를 언급하는 곳이 모두 1.10.3 또는 1.15.3을 가리킨다(grep).

### RA5-02 (Minor) 3.8.1 문장 중복과 T5·T8 full-bleed ② 비율의 의미
- **섹션**: 03 3.8.1 줄 예산 함수, 04 4.10.2 넘침 처리, AC-03-26.
- **허점**: ① U-11 문장을 삽입하면서 "후보별 넘침 처리는 그 후보의 `maxChars`로 토큰 계산으로 판정한다"는 구절이 한 문단에 두 번 남았다. ② T5·T8의 `full-bleed-image`는 `t-display`(128px)일 때 `maxChars`가 8이다. 그래서 9자 이상 헤드라인이면 ② 하향이 거의 항상 일어난다. AC-03-26과 4.10.2의 "② 비율(≤ 25%)"이 골든 전체 기준인지 프리셋별 기준인지 적혀 있지 않다. T8 골든만 떼어 보면 25%를 넘을 수 있다.
- **보완안**: 중복 구절 하나를 지운다. "② 비율 ≤ 25%는 골든 세트 전체 기준이고 기록용이다(T5·T8 full-bleed 하향은 U-11로 예상된 결과)"라고 한 줄 적는다.
- **수용 기준**: 3.8.1에서 그 구절이 1회만 나온다. AC-03-26 리포트에 ② 비율이 전체 값과 프리셋별 값으로 함께 나온다.

### RA5-03 (Minor) 매칭 0 픽스처 문구가 교집합 0 조건을 반영하지 않았다
- **섹션**: 01 1.7.1·AC-01-58 ③, 04 AC-04-44 ⑤, 1.15.3 `drafts.photoSubstituted`.
- **허점**: U-12로 폴백 조건이 "교집합 = ∅"으로 넓어졌다. 그런데 AC-01-58 ③과 AC-04-44 ⑤는 여전히 "업종 매칭 0 픽스처"만 적고 있다. 1.7.1 본문과 문구("업종에 맞는 사진이 없어")도 업종 매칭만 원인으로 설명한다. 업종 태그는 있지만 용도 밖인 사례(예: saas 브리프에 카페 키워드)에서 `photoSubstituted` 기대값이 AC 문장에 없다. RA4-07 Minor와 같은 계열이다.
- **보완안**: 두 AC의 "매칭 0"을 "교집합 0(매칭 0 포함)"으로 바꾼다.
- **수용 기준**: AC-01-58 ③·AC-04-44 ⑤ 픽스처에 교집합 0 사례가 포함되고 `photoSubstituted = true`다.

## 3. 루브릭 판정

| 역할 | C1 완결성 | C2 AI 구현 가능성 | C3 대기업 통과 |
|---|---|---|---|
| PM | **PASS**: 4라운드 PASS를 유지한다. 00 10.1 ADM-04 변경은 06 PATCH와 같고 제품 범위를 바꾸지 않는다 | **PASS** | **PASS** |
| 프로덕트 디자이너 | **PASS**: RA4-02가 닫혔다. 폴백 결과가 항상 용도 허용 태그 안에 있고 공집합이 없다 | **PASS**: `defaultImageTag` 값·조건·AC가 데이터와 식으로 정해져 있어 에이전트가 정할 것이 없다 | **PASS** |
| UX | **PASS**: RA4-03이 닫혔다. verify 성공·실패, 신규 오류 3종, 표에 없는 코드 기본 규칙까지 화면에 대응한다 | **PASS**: route·문구 키·행동·AC-01-60이 정해져 있다 | **PASS** |
| UI | **PASS**: RA4-01이 닫혔다. 재계산해도 전 조합에서 `maxChars_job ≥ 10`이고 8자 하한과 겹치지 않는다 | **PASS**: 정수 식·container 상한·하향 단계 계산 규칙과 예외(`t-2`)가 본문에 있다 | **PASS** |

**집계**: Blocker 0 · Major 0 · Minor 3 (RA5-01~03). R-A 4역할 모두 C1·C2·C3 PASS.
