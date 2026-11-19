# 라운드 4 리뷰 — R-A 제품·경험 (PM · 프로덕트 디자이너 · UX · UI)

- **대상(실제로 읽은 절)**: 00 §5.1·§5.4(재검사·A5 문단)·§6.4·§8.5(A5·A7 쿼리)·§9.3 `canceled` 행·§9.4·§14 / 01 1.2·1.3.1·1.4.3·1.5.2·1.6.5·1.7.1~1.7.3·1.8.4·1.9·1.10.3·1.11·1.12.1·1.12.2·1.14.2·1.14.3·1.15.3·1.16(발췌) / 02 2.9.1(발췌)·2.13.1·2.15·2.17 AC-02-34 / 03 3.1.3·3.1.5·3.1.5a·3.1.12·3.4.4·3.4.6·3.6.2(발췌)·3.6.5(발췌)·3.7.3 FP15·3.8.1·3.10 이미지 태그 표 / 04 4.2.1(`image_tags_allowed`)·4.6.2 `hero.headline`·4.8·4.9.4·4.10.2·4.11.1(발췌)·4.13.2 AIL-17·4.16.1 / 06 6.2.3(취소)·6.4.2·6.4.3(`ResultView`·`MeView`·`GenerationView`·`MockupCard`·`ShareView`·verify)·6.10.3·6.10.4 / 07 7.6.2·7.8.3·7.12.1 배정표(발췌) / 09 9.4.6~9.4.10(발췌).
- **기준**: `docs/spec/rubric.md` C1·C2·C3. 판정 근거는 장 본문 grep이고 decisions_v4 문서가 아니다.
- **규칙**: CLAUDE.md 1.1 수렴 규칙. 바뀌지 않은 영역은 Blocker만. 새 Major는 이번 반영이 만든 것이거나 3라운드 미해결인 것만. 기능 동결(새 기능·새 절 요구 없음).

## 총평

- 3라운드 R-A 담당 Major 18건(PM 4, PD 5, UX 5, UI 4)은 본문에 모두 반영됐다. AC도 각 장에 들어갔고 07 배정표에도 있다.
- 장 사이 숫자·키는 대부분 맞는다. 00 §9.4와 06 6.10.4의 예산 키·기본값, 01 1.15.3 카피 키와 본문, 06 `MeView`·`ResultView`·`MockupCard`와 01 S03·S08·S12가 일치한다.
- 다만 이번 반영이 새 결함 3건(Major)을 만들었다.
  ① T-30 `maxChars_job`이 T5·T8에서 8.5자가 되어 헤드라인 최소 길이 8자와 거의 겹친다(RA4-01).
  ② T-34의 업종 매칭 0 폴백 `{storefront}`가 local_business 전용 태그다. 그래서 saas·portfolio의 용도 허용 태그와 충돌한다(RA4-02).
  ③ T-16·T-06·T-20으로 생긴 사용자 노출 오류와 확인 링크 착지 화면이 01장에 없다(RA4-03).
- 셋 다 수식 한 줄, 데이터 한 행, 표 몇 행이면 고칠 수 있다. PM 영역은 Major가 남지 않았다.

## 1. 3라운드 항목 해결 현황

| ID | 상태 | 근거 절(실제 본문 위치) | 비고 |
|---|---|---|---|
| PM3-01 | 해결 | 01 1.5.2 ⑨ `result.retestHint`, 1.11 재검사 배너·채택 후속 시트, AC-01-59 / 06 `MeView.retest`·`adoptionFollowup`, `POST /api/mockups/:id/adoption-followup`, AC-06-65 / 00 §8.5 A5·A7 SQL | 시트 문구 변수 원천은 RA4-04(Minor) |
| PM3-02 | 해결 | 00 §9.3 `canceled` 행, 06 6.2.3 취소 규칙·6.10.3 계정 일 원가 행·6.10.4 `USER_DAILY_COST_CAP_USD`, 01 1.6.5 3분기·1.12.2 `cost_cap` 행, AC-06-63 | 00·06 문장이 일치 |
| PM3-03 | 해결 | 00 §9.4 "비사용자 LLM 지출" 표, 06 6.10.3 평가 실행 행·집계 분리, 6.10.4 `EVAL_*`, 07 리포트 `evalSpendUsd` | 월 총액 표기는 RA4-05(Minor) |
| PM3-04 | 해결 | 09 9.4.6~9.4.9 범위(이벤트 API·`identity_links`, `quota_ledger`·초대, 페이크 도어·T-22, ADM-01~13·KPI 뷰·문의), 07 `acMilestones` | |
| PD3-01 | 해결 | 07 7.8.3 자산 동등화(부록 잠금 파일·같은 렌더러·적합성·재요청 2회), 00 §5.1 A2 | |
| PD3-02 | 해결 | 04 4.16.1 `formatGuide(tokens)`·E-14·AC-04-34, 03 3.1.12, 06 `ResultView.guide` 주석·`exports` 버킷 | |
| PD3-03 | 해결 | 03 3.7.3 FP15 body = Wanted Sans 400, 3.18 T-33 행 | |
| PD3-04 | 부분 | 04 4.2.1 `image_tags_allowed`, 4.9.4 단계형 선택·`pageTone`, AC-04-44, 07 TC-B-20 | 매칭 0 폴백이 용도 허용 태그와 충돌 → RA4-02 |
| PD3-05 | 해결 | AC-01-54, AC-03-43, AC-04-44 본문 존재, 07 TC-D-08·TC-D-09·TC-B-20, 배정표 M3·M5·M6 | |
| UX3-01 | 해결 | 01 1.4.3 `w2`·`w2t`·`w1`·1열·토글·mobile `card_h`·회전 판정, 1.14.3 썸네일 탭, AC-01-55, 07 7.6.2 S02 8뷰포트 | 여백 m 표기는 RA4-08(Minor) |
| UX3-02 | 해결 | 01 1.3.1 판정 시점, 1.9 9번, 1.14.2 확대 행, 1.12.1 `narrow_edit`, AC-01-56, 07 7.6.2 | "<768 + 내보내기 숨김" 문장 0건 확인 |
| UX3-03 | 해결 | 02 2.13.1 `pickNotice`, AC-02-34, 06 `ResultView.notice`·`seasonAdjusted`(`consistency` 삭제), 01 1.5.2 ②·AC-01-57 | 공개 보기 표시 여부는 RA4-11(Minor) |
| UX3-04 | 해결 | 06 `MockupCard.photoSubstituted`·`labelKey`, `GenerationView.copySource`, 01 1.7.1·1.7.2 머리 상태·안내 순서, AC-01-58, 07 TC-R-16 | 문구 정확도는 RA4-07(Minor) |
| UX3-05 | 해결 | PM3-01과 같다(01 1.11·1.12.1 S12 `retest_banner`·`adoption_sheet`, 1.16 `adoption_followup_answer`) | |
| UI3-01 | 해결 | 03 3.1.3 반전 면 매핑·`inverseButtonMode`·`accentTextSafe`, 3.13.2 (a)·3.13.3, AC-03-44, 04 4.11.1 | hover α는 RA4-10(Minor) |
| UI3-02 | 해결 | 03 3.1.5 `expectedSize`, 3.1.5a `nav.wordmark` = `t-lead`, AC-03-45, 04 G-12·AIL-17 | 함수 시그니처 표기 차이 RA4-09(Minor) |
| UI3-03 | 해결 | 03 3.1.5a 역할 17행 추가·`pricing.price`, AC-03-46, 09 B25 | |
| UI3-04 | 부분 | 03 3.8.1 `text_cols` 6값·토큰 판정, 3.6.2 `VariantDef.text_cols`, 04 4.6.2 `maxChars_job`·4.10.2 넘침 처리·`role_overrides`, AC-04-46, 01 1.8.4 | 구조는 반영됐다. 다만 `maxChars_job` 값이 T5·T8에서 성립하기 어렵다 → RA4-01 |

## 2. 새 항목

| ID | 심각도 | 역할 | 요약 |
|---|---|---|---|
| RA4-01 | Major | UI·PD | `maxChars_job`이 T5·T8에서 8.5자: 헤드라인 최소 8자와 사실상 겹쳐 덱 G-01이 자주 실패 |
| RA4-02 | Major | PD | 업종 매칭 0 폴백 `{storefront}`가 local_business 전용 태그: saas·portfolio 허용 태그와 충돌, 교집합 0 경우 미정 |
| RA4-03 | Major | UX | 3라운드 신규 사용자 노출 코드·확인 링크 착지 화면이 01장(1.2·1.12.2)에 없음 |
| RA4-04 | Minor | UX·PM | `followup.q`의 {브랜드명} 원천이 `MeView.adoptionFollowup`에 없음 |
| RA4-05 | Minor | PM | 월 총 LLM 상한 210과 별도 `REF_TAGGING_BUDGET_USD` 10의 합산 불일치, 출시 전 평가 87달러 > 월 60 |
| RA4-06 | Minor | PM | A5 표본(§5.1 채택 n≥20 vs §8.5 응답 n≥15), §5.4 "6일 이후"와 6~14일 창, A5 쿼리 기간 필터 없음 |
| RA4-07 | Minor | UX·PD | `drafts.photoSubstituted` 문구("업종"·"색면")와 06 주석("대체 사진")이 04 산출 조건(톤 C=∅·shape-graphic)과 다름, 4.9.4 옛 `asset_id` 줄 잔존 |
| RA4-08 | Minor | UX | 1.4.3 m(tablet 48)이 1.3.1 tablet 좌우 여백 24와 다름 |
| RA4-09 | Minor | UI | `expectedSize(tokens, step, vw)`(03)와 `expectedSize(step, vw)`(04·T-28) 시그니처 불일치 |
| RA4-10 | Minor | UI | `button.primary@inverse` hover `bg α 0.88`이 글자 대비를 4.5 아래로 낮출 수 있음 |
| RA4-11 | Minor | UX | 공개 보기(S03)에서 ② 안내·신뢰도 줄 표시 여부 미정(`ShareView` 부분집합에 `notice` 없음) |
| RA4-12 | Minor | PM·UX | 00 §14 IF-09 키 목록에 T-20·T-21 키 없음, 1.12.1 S08에 `template_copy`·`photo_substituted` 상태 없음 |

### RA4-01 (Major) `maxChars_job`이 T5·T8에서 헤드라인 최소 길이와 겹친다
- **관련 절**: 04 4.6.2 `hero.headline`(8–24자, `maxChars_job`), 03 3.8.1 `headlineBudget`·`text_cols`, 3.4.6 타입 스케일, 3.6.5 T5·T8 hero 허용 목록.
- **허점**: T5·T8은 display 128px이고 hero 허용 목록에 `full-bleed-image`(`t-display`, lg 7)가 있다. 계산하면 `textWidth = floor(1200×7/12 − 24) = 676`, `floor(676 / (128×0.95)) = 5`, `5 × 2 × 0.85 = 8.5`다. 그래서 `maxChars_job = 8.5`다. 덱에 8자 옵션이 반드시 하나 있어야 G-01을 통과하는데, 최소 길이도 8자다. LLM이 이 조건을 놓치면 repair를 거쳐 템플릿 덱이 되고 머리 상태가 `partial`이 된다(1.7.2). 8유형 중 2유형(25%)에서 생긴다. 넘침 처리 ②(1단 하향)가 있는데도 덱 제약은 하향 전 값을 쓴다. 덧붙여 `maxChars`에 마지막 floor가 없어 정수가 아니고, `textWidth`가 1200을 고정으로 쓰지만 T2·T5·T7·T8의 `space.container`는 1280이다.
- **보완안**: `maxChars_job`을 계산할 때 `t-display` hero는 넘침 처리 ②를 적용한 단계(`t-1`)로 계산한다. T5 기준 `floor(676/91.2)=7 → 11.9`가 된다. 식 끝에 `floor`를 붙인다. `textWidth`의 1200은 `min(space.container, 1200)`으로 쓴다. 기존 값을 유지한다면 그렇게 둔다고 한 줄 적는다.
- **수용 기준**: AC-04-46 ①에 "8 프리셋 × 허용 hero 전부에서 `maxChars_job ≥ 10`(정수)" 단위 테스트를 추가한다. 골든 T5·T8 케이스에서 G-01 덱 실패로 생긴 템플릿 덱은 0건이다.

### RA4-02 (Major) 업종 매칭 0 폴백이 용도 허용 태그와 충돌한다
- **관련 절**: 04 4.2.1 `image_tags_allowed` 주석, 4.9.4 업종 블록, 03 3.6.5 `imageTags`, 03 이미지 태그 표, 07 TC-B-20.
- **허점**: ① 매칭 0 폴백 `{storefront} ∪ common.texture-*`의 `storefront`는 ImageTag 키가 아니다. 실제 키는 `local_business.storefront`이고 local_business 전용이다. saas·portfolio 브리프에서 업종 매칭이 0이면 용도 허용 태그(`saas.*`·`portfolio.*`) 밖의 상점 외관 사진이 hero에 들어간다. ② `industryTags`는 있는데 `purposeTags`와의 교집합이 0인 경우는 정의되지 않았다. 이때 허용 집합이 비면 LT-10이 모든 slot.tag를 거부한다.
- **보완안**: 폴백 조건을 "교집합 = ∅"으로 바꾼다. 폴백 값은 `{defaultImageTag(p)} ∪ common.texture-*`로 한다. `purposes.json`에 `defaultImageTag`를 1개씩 둔다. 권장값은 saas `saas.architecture`, portfolio `portfolio.studio`, local_business `local_business.storefront`다. 이 값은 용도 허용 태그 안에 있다. 04 4.2.1·4.9.4와 07 TC-B-20 문장을 같은 식으로 맞춘다.
- **수용 기준**: AC-04-44 ①의 픽스처에 세 용도별 매칭 0 사례와 교집합 0 사례를 하나씩 추가한다. 그때 `image_tags_allowed ⊆ purposeTags(p) ∪ common.*`이고 공집합은 0건이다. saas·portfolio 골든 시안에서 `local_business.*` 이미지는 0건이다.

### RA4-03 (Major) 3라운드 신규 사용자 노출 오류와 확인 링크 착지 화면이 01장에 없다
- **관련 절**: 01 1.2(화면 목록과 "표 외 route 금지", AC-01-03), 1.12.2, 1.6.5 / 06 6.4.2 `VERIFY_LINK_INVALID`·`SURVEY_ITEMS_INSUFFICIENT`·`JOB_ALREADY_FINISHED`, 6.4.3 `GET /api/rights-requests/:id/verify`("확인 완료 화면으로 302").
- **허점**: 06은 verify 성공 시 "확인 완료 화면"으로 302하고 실패 시 410을 준다. 그런데 01 1.2에는 그 화면이나 route가 없고, 1.2는 표 밖의 route를 금지한다. 1.12.2에는 `VERIFY_LINK_INVALID`(410, 메일 링크를 누른 사용자가 보는 화면), `SURVEY_ITEMS_INSUFFICIENT`(503, S01·S02), `JOB_ALREADY_FINISHED`(409, S07 취소)의 행도 없다. 1.12.2에는 표에 없는 코드를 처리하는 기본 규칙도 없다. 그래서 에이전트가 화면·문구·행동을 직접 정해야 한다.
- **보완안**: 새 화면을 만들지 않고 기존 화면에 매핑한다. ① verify 302의 대상은 `S14 /support?verified=1`이고, 문구 키는 `support.verified`("요청 확인이 끝났어요. 처리 결과는 메일로 알려드릴게요")다. 410은 S15이고 문구는 "확인 링크가 만료됐거나 이미 쓰였어요. 다시 요청해 주세요"이며 행동은 [문의하기]다. ② `SURVEY_ITEMS_INSUFFICIENT`는 S15 503에 `INTERNAL`과 같은 문구를 쓴다. ③ `JOB_ALREADY_FINISHED`는 시트를 닫고 상태를 다시 폴링한다(사용자 표시 없음). ④ 1.12.2 머리에 "표에 없는 코드 = `INTERNAL` 행" 한 줄을 넣는다.
- **수용 기준**: 06 6.4.2의 코드 중 사용자 경로에서 날 수 있는 코드는 1.12.2 행 또는 기본 규칙으로 100% 대응한다(정적 대조 스크립트). verify 성공·410 E2E가 1.2에 있는 route에서 끝난다(AC-01-03 유지).

### Minor (반영하지 않음, 기록만)
- **RA4-04**: 06 `MeView.adoptionFollowup`에 `brandName`을 추가한다. S09에서는 다른 시안의 프로젝트를 조회해야 하기 때문이다.
- **RA4-05**: 6.10.3에서 `ref_tag`는 별도 키(월 10)로 집계된다. 그래서 실제 월 최대 지출은 150 + 60 + 10 = 220이다. "월 총 210" 문장을 220으로 고치거나 `ref_tag`를 `EVAL_MONTHLY`에 합산한다고 정한다. 출시 전 1회성 지출 87달러는 월 60을 넘는다. 따라서 "최소 2개월에 나눠 실행"을 일정(§7.2)에 적는다.
- **RA4-06**: §5.1 A5 표본 칸에 "사용 비율은 응답 n ≥ 15"를 넣는다. §5.4의 "6일 이후 첫 방문"은 "6~14일"로 맞춘다. A5 쿼리의 `ans`에 기간(`ts`) 필터를 넣는다.
- **RA4-07**: `drafts.photoSubstituted` 문구는 "어울리는 사진이 부족해 일부는 다른 구성으로 바꿨어요"처럼 원인을 특정하지 않는 쪽이 정확하다. 06 `photoSubstituted` 주석의 "대체 사진을 씀"을 04 정의에 맞춘다. 04 4.9.4 코드 블록 첫 부분의 옛 `asset_id = 후보집합[...]` 줄을 지운다(단계형 식과 중복).
- **RA4-08**: 1.4.3의 m에 "S02 전용 여백(1.3.1 그리드 여백과 다름)"이라고 적는다.
- **RA4-09**: 04 G-12·AIL-17과 T-28의 `expectedSize(step, vw)`를 03 시그니처 `expectedSize(tokens, step, vw)`로 통일한다.
- **RA4-10**: invert hover는 `bg α 0.88` 대신 `fg-inverse`의 L 보정(±0.06)으로 정의한다. 또는 AC-03-44 쌍에 hover 상태를 추가한다.
- **RA4-11**: 1.5.2 공개 모드 "차이"에 ② 표시 여부를 적는다. 권장은 숨김이다. 그러면 `ShareView` 부분집합과도 맞는다.
- **RA4-12**: 00 §14 IF-09 목록에 `USER_DAILY_COST_CAP_USD`·`EVAL_RUN_BUDGET_USD`·`EVAL_MONTHLY_BUDGET_USD`·`REF_TAGGING_BUDGET_USD`를 넣는다. 1.12.1 S08 기타 칸에 `template_copy`·`photo_substituted`를 넣는다. 이 상태는 AC-01-58의 시각 회귀 대상이다.

## 3. 루브릭 판정

| 역할 | C1 완결성 | C2 AI 구현 가능성 | C3 대기업 통과 |
|---|---|---|---|
| PM | **PASS**: PM3-01~04가 본문·AC·마일스톤에 모두 반영됐다. 남은 것은 Minor(RA4-05·06)뿐이다 | **PASS**: 후속 시트 API·A5/A7 분모·취소 상한·평가 예산 키와 값·마일스톤 배정이 모두 문서에 있다 | **PASS**: 환불 남용 차단과 출시 전 실험 비용이 예산 모델 안에 들어왔다 |
| 프로덕트 디자이너 | **FAIL**: RA4-02(매칭 0 폴백이 용도 허용 태그를 어겨 saas·portfolio hero에 상점 사진이 들어감) | **FAIL**: RA4-02(교집합 0일 때 허용 집합 미정 → 에이전트가 직접 결정) | **PASS**: P-2 자산 동등화·styleguide 원천·FP15가 해결됐다. RA4-02는 국소 데이터 결함이다 |
| UX | **FAIL**: RA4-03(확인 링크 착지 화면과 신규 오류 3종의 화면 대응 없음) | **FAIL**: RA4-03(route·문구·행동을 에이전트가 정해야 하고 AC-01-03과 충돌) | **PASS**: 자극물 크기·확대 시 편집·S03/S08 데이터 계약·검증 운영 UI가 게이트 수준이다 |
| UI | **FAIL**: RA4-01(T5·T8 줄 예산 8.5자로 덱 제약이 사실상 성립하지 않음) | **FAIL**: RA4-01(그대로 구현하면 T5·T8 잡의 덱 G-01 실패가 잦고 템플릿 덱 `partial`로 떨어짐) | **PASS**: 반전 면 매핑·뷰포트별 기대값·역할 표 확장이 디자인 시스템 리뷰 수준이다 |

**다음 라운드 PASS 최소 조건**: RA4-01(04 4.6.2·03 3.8.1 식 1줄과 AC-04-46 ① 보강), RA4-02(04 4.2.1·4.9.4·07 TC-B-20 식과 `purposes.json` `defaultImageTag` 1필드), RA4-03(01 1.2 S14 진입·1.12.2 3행과 기본 규칙 1줄, 06 verify 302 대상)을 반영한다. 모두 문서와 데이터 수정이고 1인 기준 반나절 안쪽이다.

**집계**: Blocker 0 · Major 3 · Minor 9
