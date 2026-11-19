# 03. 디자인 시스템·택소노미

이 장은 생성 시안(시안 렌더러·설문 자극물·폴백 시안·내보내기)이 쓰는 디자인 시스템의 단일 원천을 정의한다. 범위는 토큰 스키마, L2 이산 파라미터(택소노미), L1→L2 매핑, 프리셋 8종 값, 컴포넌트, 섹션 블록, 서체·아이콘·이미지 자산, 반응형, 다크 테마, 브랜드 컬러 처리, 조화 규칙이다. 서비스 자체 UI 토큰(`--svc-*`)과 화면은 → 01장, 진단 갱신식·유형 판정·유형 텍스트는 → 02장, 명세 컴파일 절차·레이아웃 트리·하드 게이트·린터·조화 점수 계산 실행은 → 04장, 추출기 `extractL2()`/`toL1()`은 → 05장, 저장소·API는 → 06장, 라이선스 정책 원문은 → 08장을 따른다.

표기: [P0] = MVP, [P2] = Phase 2, [P3] = Phase 3. "MVP 제외"는 P0 코드·스키마·UI에 만들지 않는다는 뜻이다(→ 09장 규칙). 색은 OKLCH `L C H`(L 0~1, C 0~0.37, H 도)로 쓰고 sRGB hex를 병기한다. 길이 단위는 px(CSS 출력은 rem = px/16).

---

## 3.0 산출 파일과 소유 관계

| 파일(→ 09장 B 묶음) | 내용 | 정의 절 | 사용처 |
|---|---|---|---|
| `data/taxonomy/taxonomy.json` | L2 키·값 enum, 순서, 값별 의도 L1 기여도 | 3.2, 3.3 | 02(자극물), 04(명세 컴파일·스냅), 05(라벨 enum), 09 |
| `data/taxonomy/mapping.json` (B5) | L1→L2 순방향 매핑표(앵커 상대 단계 이동) | 3.3.2 | 04 `mapL1toL2` |
| `data/taxonomy/presets/<presetId>.json` (B3) | 프리셋 8종: L2 기본값, 허용 대안, 팔레트 4벌, 시그니처, 선호 패턴, 블록 허용 | 3.4 | 02, 04, 05, 07 |
| `data/taxonomy/palettes.json` | 팔레트 32벌(프리셋당 4) 해석값 | 3.4.3 | 04 `deriveTokens` |
| `data/taxonomy/purposes.json` (B4) | 용도 3종: 필수·선택 블록, 표준 hero, 이미지 태그, 금지 L2 | 3.6.5 | 04 |
| `data/taxonomy/blocks.json` | 블록·variant·슬롯 카탈로그와 블록 메타 | 3.6 | 04 `layout-schema`, 컴파일러 |
| `data/taxonomy/components.json` | 컴포넌트·variant·state 매트릭스 | 3.5 | 컴파일러, 시각 회귀(07) |
| `data/taxonomy/signatures.json` | 시그니처 12종, 장식 효과 ID | 3.2.4 | 04 `pickSignature`, H11 |
| `data/taxonomy/harmony.json` | 조화 규칙 상수·배점·상충 목록 | 3.14 | 04 H1~H12, CF |
| `data/tokens/schema.json` | DTCG 호환 TokenSet JSON Schema | 3.1 | 04, 내보내기 |
| `data/fonts/registry.json` (B6), `data/fonts/pairings.json` (B7) | 서체 26종, 페어링 20쌍 | 3.7 | 컴파일러, 07 TC-F-01 |
| `data/icons/map.json` | 의미 아이콘 40개 × 세트 3종 | 3.9 | 컴파일러 |
| `data/images/manifest.json` (B8) | 이미지 팩 192건 메타데이터 | 3.10 | 04 §4.9.4, 08 |
| `data/taxonomy/text-roles.json` (B25) | 텍스트 역할 → 타입 단계·웨이트·행간·자간·요소(S-38) | 3.1.5a | 컴파일러, 블록 템플릿, 04 H7 |

모든 파일은 봉투 `{bundle, taxonomyVersion, items}`(→ 09장 9.2.3)를 따르고 zod 스키마로 로드 시 검증한다. `taxonomyVersion` 형식은 `tx-YYYY.N`(예: `tx-2027.1`, 04장 `taxonomy_version`과 같음), 프리셋 버전(`preset_version`)과 `normalizer_version`은 시즌 ID `YYYY-S{1..4}`(05장 D-053, R-30)이다.

**AC-03-01** 위 파일 14종이 모두 존재하고, 로더가 각 파일을 zod로 검증해 오류 0건으로 통과한다. 어느 파일에서든 다른 파일의 ID를 참조할 때(예: 프리셋의 `pairing_id`) 참조 무결성 검사 오류가 0건이다.

---

## 3.1 토큰 아키텍처와 스키마

### 3.1.1 두 층 구조

```
DesignSpec.l2 (이산 enum만, 사용자·편집기가 바꾸는 유일한 층)  ← 3.2 택소노미
      │  deriveTokens(l2, theme, brand_c)   결정론, 순수 함수
      ▼
TokenSet (DTCG 호환 JSON, 해석 완료된 값)                       ← 3.1.2~3.1.11
      │  emitCss / emitTailwind
      ▼
tokens.css  (:root { --tf-* })   +   theme.css (Tailwind v4 @theme, 내보내기 전용)
```

- 저장되는 사용자 선택은 `l2`뿐이다. `TokenSet`은 `l2`에서 다시 만들 수 있어야 한다(`deriveTokens(l2) == tokens`, 불일치 = 04장 G-12 실패).
- 연속값은 TokenSet 안에만 존재하고, 그 값은 모두 3.4의 프리셋·팔레트 표 또는 3.1의 공식에서 나온다. 사용자가 hex·px를 직접 넣는 경로는 없다(D-11). 예외: 브랜드 컬러 입력(3.13)은 "고정 hue 제약"으로만 반영한다.
- CSS 변수 접두사는 `--tf-`이다(04장 CM-02). 이름 규칙: DTCG 경로의 `.`을 `-`로 바꾼다(`color.fg-muted` → `--tf-color-fg-muted`).

### 3.1.2 DTCG 형식

- 형식: W3C Design Tokens Community Group Format(안정판 2025.10 기준. 출시 전 원문 확인). 각 토큰은 `$type`, `$value`, 선택 `$description`, `$extensions["app.tastefit"]`를 가진다.
- 사용 `$type`: `color`, `dimension`, `fontFamily`, `fontWeight`, `number`, `duration`, `cubicBezier`, `shadow`, `typography`, `border`.
- 색 `$value`: `{ "colorSpace": "oklch", "components": [L, C, H], "alpha": 1, "hex": "#RRGGBB" }`. hex는 sRGB 감마 클리핑 후 반올림 값이며 대비 계산은 hex 기준이다.
- 치수 `$value`: `{ "value": 16, "unit": "px" }`. 시간: `{ "value": 200, "unit": "ms" }`.
- 별칭(alias): 시맨틱 토큰은 가능한 한 원시 토큰을 `{color.neutral.900}` 형식으로 참조한다. 내보내기 `tokens.json`은 별칭을 유지하고, `DesignSpec.tokens`는 해석 완료값을 저장한다.
- `$extensions["app.tastefit"]`: `{ "source": "preset|palette|formula|brand", "l2Key": "...", "contrast": {"against": "color.bg", "ratio": 7.1} }`.

TokenSet 최상위 그룹(필수): `color`, `font`, `type`, `space`, `radius`, `border`, `shadow`, `motion`, `layout`, `media`, `z`, `opacity`. 그 밖의 그룹은 스키마 위반이다.

```jsonc
// data/tokens/schema.json 발췌(JSON Schema 2020-12)
{
  "$id": "https://tastefit.local/schema/tokens-1.json",
  "type": "object",
  "required": ["$schemaVersion","color","font","type","space","radius","border","shadow","motion","layout","media","z","opacity"],
  "additionalProperties": false,
  "properties": {
    "$schemaVersion": { "const": "tokens-1" },
    "color": { "$ref": "#/$defs/colorGroup" },
    "...": "..."
  },
  "$defs": {
    "colorValue": {
      "type": "object", "required": ["colorSpace","components","hex"], "additionalProperties": false,
      "properties": {
        "colorSpace": { "const": "oklch" },
        "components": { "type": "array", "prefixItems": [
          {"type":"number","minimum":0,"maximum":1},
          {"type":"number","minimum":0,"maximum":0.37},
          {"type":"number","minimum":0,"maximum":360}], "minItems": 3, "maxItems": 3 },
        "alpha": { "type": "number", "minimum": 0, "maximum": 1 },
        "hex": { "type": "string", "pattern": "^#[0-9A-F]{6}$" }
      }
    },
    "colorToken": { "type": "object", "required": ["$type","$value"],
      "properties": { "$type": {"const":"color"}, "$value": {"$ref":"#/$defs/colorValue"} } },
    "dimensionToken": { "type": "object", "required": ["$type","$value"],
      "properties": { "$type": {"const":"dimension"},
        "$value": { "type":"object", "properties": { "value": {"type":"number"}, "unit": {"enum":["px"]} } } } }
  }
}
```

### 3.1.3 색 역할과 대비 조건 [P0]

| 토큰 | 용도 | 조건(하드 = 위반 시 04장 G-02/G-03 실패, 컴파일 단계에서 먼저 검사) |
|---|---|---|
| `color.bg` | 페이지 배경 | 라이트: L 0.95~0.995, C ≤ 0.03(tinted-light 팔레트 ≤ 0.035). 다크: 3.12 |
| `color.surface` | 카드·대체 섹션 배경 | \|L(surface) − L(bg)\| 0.02~0.06 |
| `color.surface-inverse` | 반전 섹션(CTA 밴드·푸터 등) | 라이트 테마에서 L ≤ 0.35, 다크 테마에서 L ≥ 0.85 |
| `color.fg` | 본문·제목 | 대 bg, 대 surface 각각 ≥ 7:1(하드 하한 4.5:1, 프리셋은 7:1 이상으로 설계) |
| `color.fg-muted` | 보조 텍스트 | 대 bg, 대 surface ≥ 4.5:1(하드) |
| `color.fg-inverse` | 반전 섹션 텍스트 | 대 surface-inverse ≥ 4.5:1(하드) |
| `color.border` | 장식 구분선 | 대비 요구 없음. 정보 전달(입력 경계 등)에 쓰지 않는다 |
| `color.border-strong` | 입력 필드·체크박스 테두리 | 대 bg ≥ 3:1(하드) |
| `color.primary` | 주 CTA 배경, 링크 | 대 bg ≥ 3:1(하드, 버튼 경계 구분). 링크 텍스트로 쓰면 대 bg ≥ 4.5:1 필요, 미달이면 링크 색 = `color.fg` + 밑줄 |
| `color.on-primary` | primary 위 텍스트 | 대 primary, primary-hover, primary-active 각각 ≥ 4.5:1(하드) |
| `color.primary-hover` | hover | 파생: L(primary) ∓ 0.06(밝은 primary는 +, 어두운 primary는 −; 기준 L 0.6) |
| `color.primary-active` | active | 파생: hover에서 같은 방향 0.04 추가 |
| `color.accent` | 강조(선택, 0~1색) | 화면 면적 ≤ 10%(04장 렌더 측정). 없을 수 있음. **텍스트(링크·라벨) 사용은 `tokens.accentTextSafe`(= accent 대 bg ≥ 4.5:1 ∧ 대 surface ≥ 4.5:1)일 때만**. 미달이면 accent는 채움(+`on-accent`)·괘선·장식 아이콘에만 쓴다(대 bg ≥ 3:1이 필요한 정보 아이콘 제외, T-27) |
| `color.on-accent` | accent 위 텍스트 | ≥ 4.5:1(하드) |
| `color.focus` | 포커스 링 | 대 bg, 대 surface ≥ 3:1(하드) |
| `color.focus-inverse` | 반전 섹션 위 포커스 링 | 파생: = `color.fg-inverse`. 대 surface-inverse ≥ 3:1 |
| `color.success` / `warning` / `danger` (+`on-`) | 폼 상태 | 대 bg ≥ 4.5:1. 브랜드 색 수 집계에서 제외 |
| `color.neutral.{50..950}` | 11단계 무채 | 3.1.4 공식으로 자동 생성 |
| `color.overlay` | 이미지 위 텍스트 오버레이 | = neutral.950, alpha 0.35~0.60(04장 §4.11 자동 보정이 결정) |

대비 계산: WCAG 2.x 상대 휘도 공식, hex 반올림 후 값 기준, 소수 둘째 자리 내림 비교(4.49 → 실패).

**반전 면·이미지 오버레이 위 컴포넌트 매핑(T-27, UI3-01)** — 파생 토큰이며 팔레트 값은 추가·변경하지 않는다. `deriveTokens`가 결정론으로 정한다.

| 요소 | `inverseButtonMode = 'invert'`(기본) | `inverseButtonMode = 'primary'` |
|---|---|---|
| `button.primary@inverse` | bg = `fg-inverse`, 글자 = `surface-inverse`(대비 = fg-inverse 대 surface-inverse ≥ 4.5, 이미 보장), hover = bg α 0.88 | 일반 primary 그대로 |
| `button.secondary@inverse` | 투명 bg + 1px(`depth.border_weight = bold`면 2px) `fg-inverse` 테두리, 글자 `fg-inverse` | 같음 |
| 링크@inverse | `fg-inverse` + 밑줄 | 같음 |

- `inverseButtonMode = 'primary'` ⇔ primary 대 surface-inverse ≥ 3:1 ∧ on-primary 대 primary ≥ 4.5:1(예: T5·T6). 그 밖은 `'invert'`.
- 이미지 오버레이(`text_over_image`) 위 버튼·링크도 `@inverse` 매핑을 쓴다.
- `tokens.accentTextSafe: boolean`, `tokens.inverseButtonMode: 'primary'|'invert'`는 TokenSet에 저장되고 컴파일러(04장 4.9.2)가 이 값으로 분기한다.

### 3.1.4 neutral 램프와 상태색

- neutral 단계 L 고정: 50:0.985, 100:0.965, 200:0.925, 300:0.870, 400:0.710, 500:0.555, 600:0.450, 700:0.370, 800:0.270, 900:0.205, 950:0.145.
- neutral hue = 팔레트 `tintHue`(3.4.3), C = min(0.012, C(bg) + 0.004). `tintHue`가 없으면 C = 0.
- 그림자 기본색 `shadow.color` = neutral.950.

| 상태색 | 라이트 테마 | 다크 테마 | on- 색 |
|---|---|---|---|
| success | `0.50 0.12 150` #21763C (대 #FFFFFF 5.6) | `0.78 0.13 150` #76CF8A | 라이트 #FFFFFF / 다크 = bg |
| warning | `0.53 0.11 65` #975C16 (5.4) | `0.82 0.12 80` #EDBB64 | 동일 |
| danger | `0.53 0.19 27` #C22826 (5.8) | `0.72 0.15 25` #F47B74 | 동일 |

### 3.1.5 타이포그래피 토큰

| 토큰 | 값·공식 | L2 원천 |
|---|---|---|
| `font.heading` / `font.heading-latin`(선택) / `font.body` / `font.mono`(선택) | `fontFamily` 배열. 스택 순서 3.7.4 | `type.pairing_id` |
| `type.base` | `type.body_size` px (16 / 17 / 18) | `type.body_size` |
| `type.ratio` | 1.2 / 1.25 / 1.333 | `type.scale_ratio` |
| `type.display-boost` | 1.0 / 1.25 / 1.5 / 2.0. h1·display 단계에만 곱한다 | `type.display_boost` |
| 단계 n | `t-caption` −2, `t-small` −1, `t-body` 0, `t-lead` 1, `t-4` 2, `t-3` 3, `t-2` 4, `t-1` 5, `t-display` 6. **단계 이름은 시맨틱 수준(h1~h6 요소)과 무관하다**(S-38). 어떤 요소에 어느 단계를 쓰는지는 3.1.5a 역할 표가 정한다. 아래 식의 h1·display는 각각 `t-1`·`t-display` 단계를 뜻한다 | — |
| 데스크톱 크기 | `size(n) = base × ratio^n × (n ≥ 5 ? boost : 1)`. 상한: h1 ≤ 6×base, display ≤ 8×base. 하한: 음수 단계 ≥ 12px. 정수 px 반올림 | — |
| 모바일 크기(375) | `base_m = max(16, base − 1)`, `ratio_m` = 한 단계 낮춤(1.333→1.25, 1.25→1.2, 1.2→1.15), `boost_m = 1 + (boost − 1)/2`. 상한: h1 ≤ 44px, display ≤ 52px(= 375×0.14). 음수 단계는 데스크톱 값 그대로 | — |
| 보간 | `font-size: clamp(m, calc(A + B·vw), d)`, B = (d − m)/9.05 (단위 vw), A = m − B×3.75 (px). 375에서 m, 1280에서 d. **순수 함수 `expectedSize(tokens, step, vw) = clamp(m, A + B·vw/100, d)`**(px, 반올림 없음)를 `packages/design-spec`이 내보내고 04장 G-12·AIL-17이 뷰포트별 기대값으로 쓴다(허용 오차 0.5px, T-28) | — |
| `type.leading.body` | 1.6 / 1.7 / 1.8(한글). 영문 전용 라벨 1.5 | `type.body_leading` |
| `type.leading.heading` | 크기별: < 32px 1.35, 32~47px 1.3, 48~71px 1.2, ≥ 72px 1.1 | 파생 |
| `type.tracking` | 3.8.2 표(크기·서체 분류별) | 파생 |
| `type.weight.heading` | 300~900 중 페어링이 허용한 값 | `type.headline_weight` |
| `type.weight.body` | 400 고정, 강조 = 페어링 `emphasisWeight`(500/600/700 중 1) | 파생 |
| `type.measure` | 본문 최대 폭 `36em`(body 18이면 `34em`). 한글 34~38자 | 파생 |
| `typography.<단계>` | DTCG `typography` 합성: fontFamily, fontSize(데스크톱), fontWeight, lineHeight, letterSpacing. 모바일 크기는 `$extensions["app.tastefit"].mobileSize` | 파생 |

페이지당 font-weight 고유값 ≤ 3(heading weight, 400, emphasisWeight; 같으면 합쳐짐). display/body 비 = `t-display` 토큰 계산값(1280) / base, 2.5~8.0(04장 H7의 원천 정의, S-38). 페이지에 display 단계가 없어도 토큰 계산값으로 판정한다(결정론).

### 3.1.5a 텍스트 역할 표 (`data/taxonomy/text-roles.json`, B25, S-38)

블록 템플릿은 font-size를 직접 쓰지 않고 `data-role`만 지정한다. 컴파일러가 이 표로 단계·웨이트를 정한다. 키 형식: `role → {step_desktop, step_mobile, weight: heading|body|emphasis, leading, tracking_class, element}`.

| role | 단계(데스크톱/모바일) | weight | element(기본) | 비고 |
|---|---|---|---|---|
| `hero.headline` | `t-display`(hero.type-only·full-bleed-image) / 그 외 hero variant `t-1` | heading | h1 | 줄 예산은 3.8.1 `headlineBudget` |
| `section.title` | `t-2` | heading | h2 | |
| `card.title`, `item.title` | `t-4` | heading | h3 | |
| `lead` | `t-lead` | body | p | |
| `body` | `t-body` | body | p | |
| `caption` | `t-caption` | body | p·figcaption | ≥ 12px 하한 |
| `eyebrow` | `t-small` | emphasis | p | 라벨 자간(3.8.2) |
| `stat.value` | `t-2` | heading | p | `font-variant-numeric: tabular-nums` |
| `pricing.price` | `t-3` | heading | p | pricing 블록 전용(옛 `price` → T-29로 이름 변경) |
| `quote` | `t-3` | body | blockquote | |
| `cta.headline` | band = `t-2`, big-type = `t-display` | heading | h2 | |
| `footer.wordmark` | big-type = `t-display`, 그 외 `t-3` | heading | p | |
| `nav.wordmark` | `t-lead`(데스크톱 19~22px, 3.4.6) → 줄 예산 초과 시 `t-body` → 375에서 2줄 허용(04장 4.10.2, T-28·T-30) | heading | a | 3.13.4. 옛 "20~24px 고정(단계 밖)" → T-28로 대체 |
| `button.label` | sm `t-small`, md·lg `t-body` | emphasis | span | T-29 |
| `nav.link` | `t-small`(데스크톱 15px 미만이면 `t-body`) | body | a | T-29 |
| `tag.label` | `t-caption` | emphasis | span | T-29 |
| `form.label` | `t-small` | emphasis | label | T-29 |
| `form.input` | `t-body`(≥ 16px 하한, iOS 확대 방지) | body | input | T-29 |
| `form.help`, `form.error` | `t-caption` | body | p | T-29 |
| `accordion.question` | `t-lead` | heading | button | T-29 |
| `menu.item` | `t-body` | emphasis | p | T-29 |
| `menu.desc` | `t-small` | body | p | T-29 |
| `menu.price` | `t-body` | emphasis | p | `tabular-nums`, 항목명 크기 이하(T-29) |
| `pricing.plan` | `t-4` | heading | h3 | T-29 |
| `stat.label`, `list.index` | `t-small` | emphasis | p·span | `list.index` = 01/02/03(T-29) |
| `proof.name`, `avatar.initials` | `t-small` | emphasis | p·span | T-29 |
| `info.row` | `t-body` | body | p | location 블록(T-29) |
| `footer.link` | `t-small` | body | a | T-29 |
| `footer.legal` | `t-caption` | body | p | T-29 |

- 모바일 단계는 3.1.5 모바일 식을 그대로 쓴다(`step_mobile` = `step_desktop`, 크기만 모바일 값).
- **AC-03-42**(T-10으로 번호 변경, 옛 이 절의 AC-03-38) 블록 템플릿 전체에서 font-size 리터럴·`text-*` 크기 클래스 0건(정적 grep), 모든 텍스트 노드에 `data-role`이 있고 이 표의 키다. `text-roles.json`이 zod 검증을 통과한다. (조화 배점의 AC-03-38은 3.14.5에 그대로 둔다.)
- **AC-03-46**(T-29, UI3-03) ① `components.json`·`blocks.json`의 모든 텍스트 슬롯과 컴포넌트 텍스트 요소에 역할 키가 있다(정적 교차 검사, 누락 0) ② 같은 프리셋·뷰포트에서 `button.label` md의 computed font-size가 1종이다 ③ menu.leader 렌더에서 `menu.price` font-size ≤ `menu.item` font-size다 ④ `price` 키 0건(`pricing.price`만).
- **AC-03-45**(T-28, UI3-02) ① `expectedSize` 단위 테스트: 프리셋 8 × 단계 9 × {375, 768, 1024, 1280, 1920}의 기대값이 브라우저 computed 값과 ±0.5px 안 ② 표준 트리 24개 × 뷰포트 5 렌더에서 04장 G-12·AIL-17 위반 0건 ③ 스케일 밖 값 픽스처(`padding: 13px`, `font-size: 15px`)는 모든 뷰포트에서 검출된다 ④ `nav.wordmark`의 computed font-size가 `expectedSize(t-lead)` 또는 하향 단계 값이다.

### 3.1.6 spacing (4pt) [P0]

- 원시 스케일 `space.{0,1,2,3,4,5,6,8,10,12,16,20,24,32,40}` = 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128, 160 px. 이 15개 밖의 margin·padding·gap 값은 금지(04장 H8, AIL-17).
- 시맨틱 간격(밀도별):

| 토큰 | compact | regular | airy |
|---|---|---|---|
| `space.section-y` 데스크톱 / 모바일 | 64 / 48 | 96 / 64 | 128 / 80 |
| `space.section-y` pad −1 / +1(04장 `pad`) | 48 / 80 | 64 / 128 | 96 / 160 |
| `space.stack` (제목↔본문) | 12 | 16 | 24 |
| `space.stack-lg` (섹션 제목 묶음↔콘텐츠) | 32 | 48 | 64 |
| `space.inset` (컴포넌트 내부) | 12 | 16 | 24 |
| `space.card` (카드 패딩) | 16 | 24 | 32 |
| `space.gap` (그리드 항목 간) | 16 | 24 | 32 |

모바일 pad ±1은 데스크톱 표의 한 단계 아래 스케일 값을 쓴다(예: regular +1 모바일 = 80).

### 3.1.7 radius [P0]

| `shape.radius_family` | `radius.sm` (입력·태그·체크박스) | `radius.md` (버튼·카드) | `radius.lg` (이미지·큰 패널) | 버튼 모양 |
|---|---|---|---|---|
| sharp | 0 | 0 | 0 | 각진 |
| soft | 2 | 4 | 8 | 각진(md) |
| round | 6 | 12 | 20 | md 기본, `pill` 버튼 허용(프리셋 `buttonPill=true`일 때) |
| pill | 8 | 999 | 24 | pill 기본(버튼·태그 999) |

- `radius.full` = 999(아바타·토글 전용, 모든 family 공통).
- 중첩 규칙: 안쪽 radius = max(0, 바깥 radius − 바깥 패딩). 계산 결과가 family 집합 {sm, md, lg, 0, full}에 없으면 가장 가까운 작은 값으로 내림.
- 시안 안의 모든 radius 값은 해당 family 집합 안에 있어야 한다(04장 H9).

### 3.1.8 depth(깊이) [P0]

| `depth.style` | level 0 | level 1 (카드 기본) | level 2 (강조 카드·hover) | level 3 (떠 있는 레이어: 스티키 nav, 모바일 drawer) |
|---|---|---|---|---|
| flat | 없음 | 그림자 없음, `border.width.thin` + `color.border` | `color.border-strong` 테두리 | 그림자 없음, border-strong |
| subtle-shadow | 없음 | `0 1px 2px α.06, 0 2px 8px α.04` | `0 4px 12px α.08, 0 12px 32px α.06` | `0 8px 24px α.10` |
| layered-shadow | 없음 | `0 1px 0 α.04, 0 2px 4px α.06, 0 8px 16px α.06` | `0 2px 4px α.06, 0 8px 16px α.08, 0 24px 48px α.10` | `0 16px 48px α.14` |
| brutal-offset | 없음 | `3px 3px 0 0 {color.fg}` + 2px fg 테두리 | `6px 6px 0 0 {color.fg}` | `6px 6px 0 0 {color.fg}` |
| glass | 없음 | 배경 surface α 0.68 + `backdrop-filter: blur(16px)` + 1px fg α 0.12 테두리 | α 0.60, blur 24px | α 0.80, blur 16px |

- α 값의 색은 `shadow.color`(neutral.950). 다크 테마는 3.12 규칙으로 대체.
- neumorph, clay는 MVP 제외(비텍스트 대비 3:1 미충족 구조).
- glass는 아래에 이미지·색면이 있는 요소(hero.full-bleed-image 위 패널, image bg 섹션의 카드)에만 적용하고, 1 뷰포트당 glass 요소 ≤ 2개(성능, UI-22).
- 한 시안의 depth.style은 1종이다(CF-02).
- 카드 그림자 단계 = `depth.shadow_level`이고, 강조 카드·hover = +1(최대 2)이다. level 3은 떠 있는 레이어(스티키 nav, 모바일 drawer) 전용이다(S-33).

### 3.1.9 border [P0]

| `shape.border` | `border.width.thin` | `border.width.thick` | 카드 테두리 | 구분선 |
|---|---|---|---|---|
| none | 1 | 2 | 없음(depth가 구분 담당; flat이면 surface 배경으로 구분) | 없음 또는 space |
| hairline | 1 | 2 | 1px `color.border` | 1px `color.border` |
| bold | 2 | 3 | 2px `color.fg` | 2px `color.fg` |

입력 필드는 shape.border와 무관하게 항상 1px(bold면 2px) `color.border-strong`. style은 solid만(dashed는 플레이스홀더 이미지 전용).

### 3.1.10 motion

| 토큰 | 값 |
|---|---|
| `motion.duration.fast/base/slow` | 120 / 200 / 320 ms |
| `motion.easing.standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| `motion.easing.emphasized` | `cubic-bezier(0.3, 0, 0, 1)` |
| `motion.level = none` [P0] | 상태 전환(hover·focus·accordion)만 fast, 등장 애니메이션 없음 |
| `motion.level = subtle` [P0] | none + 섹션 첫 진입 시 opacity 0→1 & translateY 8px→0, base(200ms), 1회. CSS `@starting-style`/`animation-timeline`이 아니라 컴파일러가 생성한 CSS만, JS 없음(04장 렌더는 JS 비활성) → `animation: tf-enter 200ms both` + `animation-timeline: view()` 지원 브라우저에서만, 미지원 시 정적 |
| `motion.level = expressive` | **MVP 제외**(스크롤 연동·패럴랙스, [P2]) |
| 필수 | `@media (prefers-reduced-motion: reduce)`에서 모든 duration 0, 등장 애니메이션·마키 정지 |
| 반복 애니메이션 | 시그니처 SIG-06(마키)만. 속도 ≤ 40px/s, hover 시 정지 |

### 3.1.11 기타 토큰

| 토큰 | 값 |
|---|---|
| `layout.container` | `space.container` = 1120 / 1200 / 1280 px |
| `layout.gutter`, `layout.margin`, `layout.columns` | 3.11 표 |
| `media.treatment` | none / grayscale(`filter: grayscale(1) contrast(1.05)`) / duotone(사전 처리: 그림자 = neutral.950, 하이라이트 = primary L+0.35 C×0.5, 빌드 시 sharp로 생성한 파생 파일) / warm-tint(`sepia(.18) saturate(1.05)`) |
| `media.texture.grain` | 256×256 WebP 타일(≤ 20KB), opacity 0.04~0.06, `background-image` 반복. SVG feTurbulence 실시간 금지 |
| `z.base/sticky/drawer/overlay` | 0 / 100 / 200 / 300 |
| `opacity.disabled` | 0.45 |
| `opacity.overlay.min/max` | 0.35 / 0.60 |

### 3.1.12 내보내기용 토큰 파일 3종 [P0]

내보내기 패키지 구조·README·LICENSES는 → 04장·08장. 본 장은 토큰 파일 형식만 정한다. 공통 파일 `styleguide.html`(S-35, 04장 4.16.1, E-14)은 아래 토큰 파일과 3.5 컴포넌트 템플릿만으로 컴파일하며, 파일 목록은 04장 4.16.1과 같다.

| 파일 | 형식 |
|---|---|
| `tokens/tokens.json` | DTCG(3.1.2), 별칭 유지, `$schemaVersion: "tokens-1"`, `$extensions["app.tastefit"]`에 `presetId`, `taxonomyVersion`, `l2` 스냅숏 |
| `tokens/tokens.css` | `:root { --tf-*: … }` 단일 블록. 색은 hex(+ `@supports (color: oklch(0 0 0))`에서 oklch 재선언), 크기는 rem, 타입 단계는 clamp 식 |
| `tokens/theme.css` | Tailwind v4 `@theme { --color-bg: var(--tf-color-bg); … --breakpoint-md: 48rem; … }`. Tailwind 기본 팔레트·radius·shadow는 `--color-*: initial;` 등으로 초기화 후 재정의 |

### 3.1.13 기본값 잔존 금지(PD-18, D-28)

시안 렌더러는 shadcn/ui를 쓰지 않는다(D-28). Tailwind 기본 토큰(`--color-zinc-*`, `--radius` 0.5/0.625rem, `shadow-sm/md` 기본값, Inter/Geist 계열)은 `theme.css`에서 초기화하므로 출력 CSS에 나타나면 안 된다. 금지 값 목록은 `data/taxonomy/harmony.json.defaultsBlacklist`에 두고 04장 린터(AIL-16 계열)가 사용한다: `oklch(0.141 0.005 285.823)`, `oklch(0.985 0 0)`(shadcn 기본 fg/bg 쌍이 동시에 쓰일 때), `0.625rem`, `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`, font-family 첫 항목 `Inter`/`Geist`/`Roboto`/`system-ui`.

**AC-03-02** 프리셋 8종 × 팔레트 4벌 = 32개 TokenSet이 `data/tokens/schema.json` 검증을 통과하고, 3.1.3의 하드 대비 조건 13쌍을 전부 만족한다(단위 테스트, 쌍별 결과 리포트 저장).
**AC-03-44**(T-27, UI3-01) 32 TokenSet에서 반전 면 3쌍(버튼 경계 대 surface-inverse ≥ 3:1, 버튼 글자 ≥ 4.5:1, 링크 ≥ 4.5:1)을 `inverseButtonMode`에 따라 계산해 100% 통과하고(AC-03-02 쌍 목록 13 + 3), `accentTextSafe = false`인 TokenSet 렌더에서 accent 색 텍스트 노드가 0건이다. 팔레트 표(3.4.2·3.4.3) 값은 변하지 않는다.
**AC-03-03** `deriveTokens`는 순수 함수이며 같은 입력 1,000회 호출 시 출력 SHA-256이 1종이다. 출력 TokenSet의 모든 margin·padding·gap 후보 값이 3.1.6의 15개 집합에, 모든 radius 값이 3.1.7의 family 집합에 속한다.
**AC-03-04** 모든 프리셋 기본 TokenSet에서 display/body 비가 2.5~8.0, 페이지 font-weight 고유값 ≤ 3이다.
**AC-03-05** 내보낸 `tokens.json`이 DTCG 2025.10 형식 검사(자체 스키마 + `$type` 집합 검사)를 통과하고, `tokens.css`·`theme.css` 이외 CSS 파일에 색·px 리터럴이 0건이다(04장 CM-02 리터럴 검사와 동일 도구).

---
## 3.2 L2 이산 파라미터(택소노미) [P0]

### 3.2.1 전체 목록

D-11의 7개 범주(타이포 페어링, 팔레트 구조, radius 계열, depth 종류, 레이아웃 패턴, 이미지 스타일, 모션 수준)를 18개 키로 구체화한다. 키 이름은 04장 `DesignSpec.l2`와 같다. 값은 모두 문자열로 저장한다(숫자 값도 `"1.25"`처럼, → 09장 `Record<L2Key,string>`). 표의 값 순서가 서수(ordinal) 순서다.

| # | D-11 범주 | 키 | 값(서수 순) | 편집 컨트롤(→ 01장) |
|---|---|---|---|---|
| 1 | 타이포 페어링 | `type.pairing_id` | `FP01`~`FP20`(범주형) | 후보 카드(유형 허용 집합) |
| 2 | 〃 | `type.scale_ratio` | `1.2`, `1.25`, `1.333` | 3단 토글 |
| 3 | 〃 | `type.display_boost` | `1.0`, `1.25`, `1.5`, `2.0` | 3.4.5 허용 범위 안 스텝 |
| 4 | 〃 | `type.headline_weight` | `300`, `400`, `500`, `600`, `700`, `800`, `900`(페어링이 허용한 값만) | 자동(편집 대상 아님) |
| 5 | 〃 | `type.body_size` | `18`, `17`, `16` | 자동 |
| 6 | 〃 | `type.body_leading` | `1.8`, `1.7`, `1.6` | 자동 |
| 7 | 팔레트 구조 | `color.palette_id` | `PAL-T{n}-{0..3}`(범주형, 유형당 4) | 팔레트 카드 4장 |
| 8 | radius 계열 | `shape.radius_family` | `sharp`, `soft`, `round`, `pill` | 4단 스텝 슬라이더 |
| 9 | 〃 | `shape.border` | `bold`, `hairline`, `none` | 자동 |
| 10 | depth 종류 | `depth.style` | `flat`, `subtle-shadow`, `layered-shadow`, `brutal-offset`, `glass` | 유형 허용 집합 안 카드 |
| 11 | 〃 | `depth.shadow_level` | `0`, `1`, `2`, `3`(3은 예약값: 떠 있는 레이어 전용, 페이지 선택값으로 쓰지 않음) | 3단 토글(0~2) |
| 12 | 밀도(레이아웃 패턴 범주에 포함) | `space.density` | `airy`, `regular`, `compact` | 3단 토글 |
| 13 | 〃 | `space.container` | `1120`, `1200`, `1280` | 자동 |
| 14 | 레이아웃 패턴 | `layout.grid_mode` | `symmetric`, `bento`, `asymmetric` | 자동(섹션 편집으로 간접) |
| 15 | 이미지 스타일 | `media.mode` | `type-led`, `photo-led`, `shape-graphic`(범주형) | 자동 |
| 16 | 〃 | `media.treatment` | `grayscale`, `none`, `warm-tint`, `duotone`(duotone은 시그니처 SIG-10일 때만) | 자동 |
| 17 | 모션 수준 | `motion.level` | `none`, `subtle` (`expressive` MVP 제외) | 2단 토글 |
| 18 | (자산) | `icon.set` | `phosphor`, `tabler`, `iconoir`(프리셋 고정) | 없음 |

`color.structure`(mono / accent-on-neutral / analogous / complementary / split-complementary)와 `color.chroma`(muted C<0.10 / medium 0.10~0.16 / vivid >0.16)는 키가 아니라 팔레트의 파생 속성이다(`palettes.json`에 계산해 저장). `color.base`(light / tinted-light / dark)도 팔레트 속성이며 MVP에서 프리셋이 고정한다(D-25).

### 3.2.2 값별 의도 L1 기여(`predictL1`)

`predictL1(l2, palette) → [A1..A5]`는 L2만으로 "의도한" L1을 계산하는 순수 함수다. 05장 `toL1(extractFeatures(render))`(측정값)과 축 구성·가중치 비율을 맞췄으며, 04장 §4.3 3단계 `J`와 앵커 벡터 `anchor_l1`(05장 5.9 왕복 검증의 기준)에 쓴다. 측정 L1과 다를 수 있고, 차이는 05장 5.9 절차(축별 ≤ 0.10)로 관리한다.

```
출력 키(R-01): {expression: A1, temperature: A2, shape: A3, density: A4, depth: A5}. 본문의 A1~A5는 문서 표기다.
A1 표현성 = .25·decor + .25·scale + .20·chroma + .15·ncolors + .15·asym
  decor   = {0개: 0, 1개: 0.5, ≥2개: 1}  (장식 효과 수, 3.2.4. depth glass/brutal-offset, media duotone, 장식형 시그니처 포함)
  scale   = clip((ln R − ln 2.5) / (ln 8 − ln 2.5)),  R = display(1280)/base (3.1.5 상한 적용 후)
  chroma  = clip((Cmax − 0.04) / 0.16),  Cmax = 브랜드 색(C ≥ 0.04) 중 최대 C, 없으면 0
  ncolors = {브랜드 색 0개: 0, 1개: 0.5, ≥2개: 1}
  asym    = {symmetric: 0, bento: 0.5, asymmetric: 1}
A2 온도 = .40·warm + .30·bgwarm + .30·fontTemp
  warm    = 0.5 + 0.5·mean_i( cos(h_i − 50°) · min(1, C_i/0.04) )  (브랜드 색 i), 브랜드 색 없으면 0.5
  bgwarm  = clip(0.5 + b_bg/0.04),  b_bg = C_bg·sin(h_bg)  (OKLab b, 05장 F15와 같은 방향)
  fontTemp= 페어링 sig.temp (3.7.3)
A3 형태 = .60·radius + .15·pill + .25·borderSoft
  radius  = {sharp 0, soft 0.333, round 0.667, pill 1};  pill = {pill 1, round 0.5, 그 외 0}
  borderSoft = {none 1, hairline 0.5, bold 0}
A4 밀도 = .75·density + .25·text
  density = {airy 0, regular 0.5, compact 1};  text = {18: 0, 17: 0.5, 16: 1} (type.body_size)
A5 깊이 = .55·style + .45·level
  style = {flat 0, subtle-shadow 0.35, layered-shadow 0.65, brutal-offset 0.75, glass 1};  level = shadow_level/3
모든 값은 소수 둘째 자리 반올림.
```

축별 제외 속성(이중 계산 방지, 05장 라벨 기준표와 공유):

| 축(JSON 키, R-01) | 정의(0 ↔ 1) | 제외 |
|---|---|---|
| A1 `expression` | 미니멀 ↔ 표현적: 장식·크기 대비·채도·색 수·비대칭 | 여백(A4), 그림자(A5) |
| A2 `temperature` | 차가움 ↔ 따뜻함: 브랜드 색 hue, 배경 틴트, 서체 인상 | 채도 크기(A1) |
| A3 `shape` | 날카로움 ↔ 부드러움: radius 계열, pill, 테두리 두께 | 그림자(A5) |
| A4 `density` | 여유 ↔ 밀도: 섹션 여백, 본문 크기 | 색, 장식 |
| A5 `depth` | 평면 ↔ 입체: depth 종류, 그림자 레벨 | radius(A3) |

### 3.2.3 범주형 키의 속성 표

- `type.pairing_id` 속성: `sig = {temp, expr, soft}`(3.7.3), `headlineWeights[]`, `contrastSerif: bool`(CF-04), `classHeading`, `classBody`.
- `color.palette_id` 속성: `warm`(위 공식의 warm 항), `chromaScore`, `structure`, `base`, `tintHue`, `brandColorCount`.
- `media.mode`: `photo-led`(이미지 슬롯을 사진으로 채움), `type-led`(이미지 슬롯 없는 variant 우선, hero는 type-only/left-aligned), `shape-graphic`(이미지 슬롯을 surface/primary 색면 + 3.10.5 패턴으로 채움, 사진 0장).

### 3.2.4 장식 효과와 시그니처 디테일

장식 효과(`DecorId`, 04장 H11 집계 대상. 페이지당 ≤ `decor.max`(1 또는 2, 04장 결정), 신뢰가 중요한 용도는 [P2]):

| DecorId | 효과 | 발생 경로 |
|---|---|---|
| `grain` | 그레인 질감 타일 | SIG-07 |
| `glass` | 반투명 블러 패널 | `depth.style = glass` |
| `brutal-offset` | 하드 오프셋 그림자 | `depth.style = brutal-offset` |
| `oversized-type` | 장식용 거대 숫자·타이포 | SIG-03 |
| `outline-text` | 외곽선 디스플레이 텍스트 | SIG-11 |
| `grid-pattern` | 그리드 라인 노출 배경 | SIG-04 |
| `duotone` | 사진 듀오톤 | SIG-10(`media.treatment = duotone`) |
| `marquee` | 흐르는 텍스트 띠 | SIG-06 |

그라디언트 배경·그라디언트 텍스트·블롭·네온 글로우·커스텀 커서·패럴랙스는 MVP에서 장식 효과로 허용하지 않는다(생성 경로 없음, D-0303).

시그니처 디테일(`signatures.json`, 시안당 정확히 1개, 04장 `pickSignature`):

| ID | 이름 | DecorId | 적용 블록 | 요구 조건 | 충돌(동시 불가) |
|---|---|---|---|---|---|
| SIG-01 | 얇은 괘선 | — | value, feature, faq, menu, footer | `shape.border ≠ bold` | SIG-04 |
| SIG-02 | 섹션 넘버링(01/02) | — | 섹션 제목 eyebrow 전체 | 섹션 수 ≥ 4 | SIG-08 |
| SIG-03 | 거대 숫자 | `oversized-type` | stats, process, value | 숫자 슬롯 존재 | SIG-11 |
| SIG-04 | 그리드 라인 노출 | `grid-pattern` | hero, showcase | `layout.grid_mode ≠ bento` | SIG-01, `glass` |
| SIG-05 | (예약, MVP 미사용) | — | — | — | — |
| SIG-06 | 마키 | `marquee` | cta 위 띠, hero 하단 띠 | `motion.level = subtle` | — |
| SIG-07 | 그레인 | `grain` | 페이지 전체 배경 | `theme = light` | `glass`(CF-05) |
| SIG-08 | 모노 라벨 | — | eyebrow·stats 라벨 | 페어링에 mono 존재 | SIG-02 |
| SIG-09 | 와이드 자간 라벨 | — | eyebrow, nav 링크(라틴 대문자만 +0.08em, 한글은 +0.02em) | — | — |
| SIG-10 | 사진 듀오톤 | `duotone` | 모든 사진 | `color.chroma ≠ vivid`(CF-08) | `media.treatment ≠ duotone` 이외 처리 |
| SIG-11 | 아웃라인 디스플레이 | `outline-text` | hero(display 단계 1줄만), footer big-type | display ≥ 72px | SIG-03 |
| SIG-12 | 비대칭 이미지 오프셋 | — | hero.split, story, about | 이미지 슬롯 존재 | — |

SIG-05는 번호 호환(04장 SIG-06 = 마키)을 위해 비워 둔다.

**AC-03-06** `taxonomy.json`의 키 집합이 04장 `DesignSpec.l2` zod 스키마 키 집합과 같다(단방향 생성: zod enum을 `taxonomy.json`에서 생성). 다른 키가 하나라도 있으면 빌드 실패.
**AC-03-07** `predictL1`은 순수 함수이며 3.4.7의 유형 중심 벡터 8개를 소수 둘째 자리까지 재현한다(단위 테스트 8건).
**AC-03-08** 시그니처 12종 각각 양성 픽스처(요구 조건 충족 → 적용됨)와 음성 픽스처(충돌 → 선택 불가) 테스트가 있다.

---

## 3.3 L1 → L2 매핑 [P0]

### 3.3.1 원칙

1. 매핑은 **앵커 상대 이동**이다. 유형 T의 앵커 프리셋 L2를 출발점으로, 목표 벡터 t(04장 §4.3이 계산)와 앵커 벡터 a_T의 차이만큼 서수 단계를 옮긴다. 따라서 t = a_T이면 결과는 앵커 프리셋과 같다.
2. 결과는 유형 허용 집합(`preset.allowed`, 3.4.5) ∩ 용도 허용 집합(3.6.5)으로 잘린다. `purpose = null`(설문 자극물, 3.4.8)이면 유형 허용 집합으로만 자른다. 02장의 `compileL2(μ, typeId, purpose, variant)`는 이 함수 + 04장 목표 벡터·스냅을 합친 호출 이름이다. 잘린 결과를 04장 `snapToFeasible`이 조화·상충 규칙으로 최종 확정한다.
3. 사용자는 이 결과를 원시값으로 바꿀 수 없다. 편집은 같은 허용 집합 안의 단계 이동만 한다(D-16).

### 3.3.2 매핑표 (`mapping.json`)

서수 키:
```
i(p) = clampToAllowed( i0(p) + round( s_p · (t[a_p] − a_T[a_p]) · k_p ) )
  i0(p)  : 앵커 프리셋 값의 서수 인덱스
  k_p    : 값 개수 − 1 (전 범위 이동 = 축 전 범위)
  clampToAllowed: 허용 집합 밖이면 같은 방향의 가장 가까운 허용 값, 없으면 반대 방향 가장 가까운 허용 값
  round  : 0.5는 0 쪽으로(앵커 유지 우선)
```

| L2 키 | 구동 축 a_p | 방향 s_p | k_p | 비고 |
|---|---|---|---|---|
| `type.scale_ratio` | A1 | + | 2 | |
| `type.display_boost` | A1 | + | 3 | |
| `type.headline_weight` | A1 | + | (페어링 허용 웨이트 수 − 1) | 페어링 확정 후 계산 |
| `type.body_size` | A4 | + | 2 | 값 순서 18→16이므로 밀도↑ = 작은 본문 |
| `type.body_leading` | A4 | + | 2 | 밀도↑ = 좁은 행간 |
| `shape.radius_family` | A3 | + | 3 | |
| `shape.border` | A3 | + | 2 | 값 순서 bold→none |
| `depth.style` | A5 | + | (허용 집합 크기 − 1) | 서수 = 허용 집합 안에서의 순서 |
| `depth.shadow_level` | A5 | + | 2 | 값 0~2만 |
| `space.density` | A4 | + | 2 | |
| `space.container` | A4 | + | 2 | |
| `layout.grid_mode` | A1 | + | (허용 집합 크기 − 1) | 04장: V-FIT에서 bento 금지 |
| `media.treatment` | A2 | + | (허용 집합 크기 − 1, duotone 제외) | duotone은 시그니처로만 |
| `motion.level` | A1 | + | 1 | |

범주형 키:
```
type.pairing_id:
  target = sig(앵커 페어링) + (t − a_T)[A2, A1, A3]          # sig = (temp, expr, soft)
  선택 = argmin_{f ∈ allowed}  0.5·(temp_f − target.temp)² + 0.25·(expr_f − target.expr)² + 0.25·(soft_f − target.soft)²
  동률(차이 < 1e-6) → 앵커 페어링, 그다음 ID 오름차순
color.palette_id:
  target = warm(PAL-T{n}-0) + (t[A2] − a_T[A2])
  선택 = argmin_{q ∈ 유형 팔레트 4벌} |warm(q) − target| + 0.5·|chromaScore(q) − (chromaScore(PAL-0) + t[A1] − a_T[A1])|
  동률 → PAL-0
media.mode: 앵커 값. 단 용도 금지값이면 3.6.5 대체값
icon.set:   앵커 값(유형 고정)
```

**AC-03-09** 8유형 × t = a_T 입력에서 `mapL1toL2` 결과가 앵커 프리셋 L2와 18개 키 모두 같다(8/8).
**AC-03-10** 8유형 × 5축 × (±0.10, ±0.30) = 160개 입력에서 결과 L2 값이 100% 유형 허용 집합 안에 있고, 같은 입력 반복 시 결과가 동일하다.
**AC-03-11** 단조성: 다른 축을 고정하고 한 축만 증가시킬 때 그 축이 구동하는 서수 키의 인덱스가 감소하는 경우 0건(8유형 × 5축 × 11점 격자).

---

## 3.4 프리셋 8종 [P0]

### 3.4.1 프리셋 ↔ 유형 대응과 메타

유형 ID·slug·이름·설명 텍스트의 단일 원천은 02장 2.11이다(R-04). 이 장은 앵커 프리셋 값과 유형 중심 벡터(3.4.7, R-04 단일 원천)를 소유한다. 각 앵커 프리셋은 02장 유형 설명의 성격을 토큰으로 구현한다.

| 유형 ID | slug(02장) | 프리셋 ID | 테마 | 아이콘 | 시그니처 후보(우선순) | 원본(08장 G1) | `allowSoftRoundShadow`(S-33) |
|---|---|---|---|---|---|---|---|
| T1 | calm-editorial | PS-T1 | light | phosphor | SIG-01, SIG-02, SIG-09 | operator | false |
| T2 | precise-system | PS-T2 | light | tabler | SIG-02, SIG-03, SIG-04, SIG-08 | operator | false |
| T3 | fresh-minimal | PS-T3 | light | phosphor | SIG-12, SIG-01 | operator | true |
| T4 | cozy-lifestyle | PS-T4 | light(tinted) | iconoir | SIG-12, SIG-07, SIG-10 | operator | true |
| T5 | bold-brutal | PS-T5 | light(tinted) | tabler | SIG-06, SIG-03, SIG-11, SIG-02 | operator | false |
| T6 | vivid-playful | PS-T6 | light(tinted) | phosphor | SIG-06, SIG-03, SIG-12 | operator | true |
| T7 | crisp-tech | PS-T7 | dark | tabler | SIG-08, SIG-04, SIG-11 | operator | false |
| T8 | elegant-magazine | PS-T8 | light | phosphor | SIG-11, SIG-09, SIG-12 | operator | false |

- `allowSoftRoundShadow = true`인 프리셋(T3·T4·T6)은 유형 정체성상 soft radius + 흐린 그림자가 의도된 조합이므로 04장 AIL-06을 warn으로 낮춘다(S-33, PD2-02).
- CI `presets:lint-matrix`(S-33): 8개 프리셋 각각에서 3.4.5 허용 집합 중 값 1개만 바꾼 조합 전부를 `standardTree`로 렌더해 AIL error 0을 요구한다. 실패 조합은 `harmony.json.conflicts`에 CF-13부터 등록해 F 집합(04장 4.3)과 편집 선택지에서 자동으로 제외한다.
- 초기 프리셋은 운영자 설계(`provenance.method = 'operator'`, 08장 G1)이며 특정 사이트 값을 복사하지 않는다. 시즌 릴리스에서 05장 근거 리포트(도메인 ≥ 3 집계)로 조정하면 `cluster_median`으로 바뀐다.
- 각 유형의 시그니처 후보에는 장식 효과가 아닌 시그니처가 1개 이상 있거나 장식 효과가 1개 이하로 끝나는 조합이 있다(04장 v_fit `decor.max = 1` 대응: T5는 SIG-02, T7은 SIG-08).
- 프리셋 JSON 형식(→ 09장 B3 확장):

```ts
interface Preset {
  id: 'PS-T1' | … | 'PS-T8'; typeId: 'T1' | … | 'T8'; slug: string;   // slug = 02장 유형 slug
  version: string;                         // 시즌 ID 'YYYY-S{n}'(05장 D-053, R-30)
  theme: 'light' | 'dark';
  l1: { expression: number; temperature: number; shape: number; density: number; depth: number };  // anchor_l1, 3.4.7 (R-01 키)
  l2: Record<L2Key, string>;               // 3.4.4
  allowed: Record<L2Key, string[]>;         // 3.4.5 (기본값 포함)
  palettes: [PaletteId, PaletteId, PaletteId, PaletteId];   // [0] = 기본
  signatureIds: SignatureId[];             // 우선순
  preferredPatterns: Record<'saas'|'portfolio'|'local_business', [PatternId, PatternId]>;  // 3.6.6
  heroVariants: VariantId[];               // 3.6.6
  buttonPill: boolean;
  provenance: { method: 'operator' | 'cluster_median'; domains: string[] };      // 08장
}
```

### 3.4.2 기본 팔레트(PAL-T{n}-0) 전체 값

셀: OKLCH `L C H` / hex. 모든 hex는 sRGB 색역 안이다.

| 역할 | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 |
|---|---|---|---|---|---|---|---|---|
| `bg` | `.975 .008 85` #F9F6F1 | `.99 0 0` #FCFCFC | `.985 .006 220` #F6FBFD | `.955 .022 75` #F9EEE0 | `.97 .015 100` #F7F6EA | `.97 .02 85` #FBF4E6 | `.17 .012 250` #0B1015 | `.97 .004 80` #F6F5F2 |
| `surface` | `.945 .01 85` #F0ECE5 | `.955 0 0` #F0F0F0 | `.955 .016 200` #E5F4F4 | `.925 .028 70` #F3E3D3 | `.93 .03 100` #ECE9D2 | `.93 .04 85` #F4E6CA | `.21 .014 250` #13191F | `.935 .01 80` #EDE9E2 |
| `surface-inverse` | `.24 .012 60` #241E1A | `.17 0 0` #0F0F0F | `.30 .04 210` #113339 | `.30 .04 45` #3F271D | `.15 0 0` #0B0B0B | `.25 .03 30` #2F1C19 | `.93 .01 250` #E3E8EE | `.18 .004 80` #121110 |
| `fg` | `.22 .01 60` #1E1A16 | `.17 0 0` #0F0F0F | `.24 .02 230` #152127 | `.25 .028 50` #2D1E15 | `.15 0 0` #0B0B0B | `.22 .02 30` #231715 | `.93 .008 250` #E4E8ED | `.18 .004 80` #121110 |
| `fg-muted` | `.46 .01 60` #5C5753 | `.45 0 0` #555555 | `.47 .02 230` #505D64 | `.46 .03 55` #665448 | `.40 0 0` #484848 | `.45 .03 40` #645049 | `.72 .015 250` #9EA6AE | `.46 .006 80` #5A5854 |
| `fg-inverse` | `.96 .008 85` #F4F1EC | `.99 0 0` #FCFCFC | `.98 .006 220` #F4F9FB | `.955 .02 75` #F8EFE2 | `.97 .015 100` #F7F6EA | `.97 .02 85` #FBF4E6 | `.17 .012 250` #0B1015 | `.97 .004 80` #F6F5F2 |
| `border` | `.88 .01 85` #DAD7D0 | `.88 0 0` #D7D7D7 | `.90 .015 210` #D3E1E3 | `.86 .03 70` #DECEBC | `.15 0 0` #0B0B0B | `.87 .04 80` #E2D2B7 | `.30 .015 250` #282F35 | `.88 .01 80` #DBD7D0 |
| `border-strong` | `.60 .01 60` #857F7A | `.55 0 0` #717171 | `.58 .03 210` #668084 | `.58 .035 55` #8B7567 | `.15 0 0` #0B0B0B | `.56 .05 50` #8D6C5A | `.52 .015 250` #636A71 | `.58 .008 80` #7D7A75 |
| `primary` | `.26 .012 60` #29231E | `.48 .15 258` #1D5AB0 | `.47 .08 195` #016869 | `.50 .13 40` #9E4421 | `.50 .21 262` #1256D8 | `.55 .19 28` #C93029 | `.80 .14 165` #51DAA7 | `.18 .004 80` #121110 |
| `on-primary` | `.975 .008 85` #F9F6F1 | `1 0 0` #FFFFFF | `.99 .004 220` #F9FCFE | `.99 .005 75` #FEFBF8 | `1 0 0` #FFFFFF | `1 0 0` #FFFFFF | `.17 .012 250` #0B1015 | `.97 .004 80` #F6F5F2 |
| `primary-hover` | `.34 .012 60` #3D3732 | `.42 .14 258` #104A97 | `.41 .07 195` #005656 | `.44 .12 40` #873616 | `.44 .20 262` #0244BE | `.49 .18 28` #B01F1C | `.86 .12 165` #7DEABD | `.28 .005 80` #2A2926 |
| `accent` | `.50 .085 32` #8D5044 | — | — | `.66 .11 80` #B58A3A | `.90 .17 105` #EFE345 | `.72 .11 200` #35B9C0 | — | `.48 .12 15` #953C47 |
| `on-accent` | `.985 .005 85` #FCFAF6 | — | — | `.22 .03 50` #26160E | `.15 0 0` #0B0B0B | `.22 .02 30` #231715 | — | `.97 .004 80` #F6F5F2 |
| `focus` | = accent #8D5044 | = primary #1D5AB0 | = primary #016869 | `.40 .10 40` #733119 | = fg #0B0B0B | = fg #231715 | = primary #51DAA7 | = fg #121110 |
| structure / chroma | accent-on-neutral / muted | accent-on-neutral / medium | accent-on-neutral / muted | analogous(40°) / medium | split-compl.(157°) / vivid | complementary(172°) / vivid | accent-on-neutral / medium | accent-on-neutral / medium |

대비 검증(hex 기준, 하드 기준 대비 모두 통과):

| 쌍 | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | 기준 |
|---|---|---|---|---|---|---|---|---|---|
| fg / bg | 16.0 | 18.7 | 15.7 | 14.0 | 18.1 | 15.9 | 15.5 | 17.3 | ≥ 7 |
| fg / surface | 14.7 | 16.8 | 14.5 | 12.8 | 16.1 | 14.1 | 14.4 | 15.6 | ≥ 7 |
| fg-muted / bg | 6.6 | 7.3 | 6.5 | 6.3 | 8.4 | 6.9 | 7.8 | 6.5 | ≥ 4.5 |
| fg-muted / surface | 6.1 | 6.5 | 6.0 | 5.7 | 7.5 | 6.1 | 7.2 | 5.9 | ≥ 4.5 |
| fg-inverse / surface-inverse | 14.6 | 18.7 | 12.7 | 12.1 | 18.1 | 14.7 | 15.5 | 17.3 | ≥ 4.5 |
| on-primary / primary | 14.4 | 6.7 | 6.4 | 6.2 | 6.3 | 5.3 | 10.9 | 17.3 | ≥ 4.5 |
| on-primary / primary-hover | 10.9 | 8.6 | 8.3 | 7.9 | 8.2 | 6.9 | 13.1 | 13.3 | ≥ 4.5 |
| on-accent / accent | 6.0 | — | — | 5.5 | 14.8 | 7.3 | — | 6.4 | ≥ 4.5 |
| border-strong / bg | 3.7 | 4.8 | 4.0 | 3.8 | 18.1 | 4.3 | 3.5 | 3.9 | ≥ 3 |
| focus / bg | 5.8 | 6.5 | 6.3 | 8.4 | 18.1 | 15.9 | 10.9 | 17.3 | ≥ 3 |
| primary / bg | 14.4 | 6.5 | 6.3 | 5.5 | 5.8 | 4.9 | 10.9 | 17.3 | ≥ 3 |

`primary-active`, `focus-inverse`, neutral 램프, 상태색은 3.1.3~3.1.4 공식으로 파생한다.

### 3.4.3 대안 팔레트(PAL-T{n}-1~3)

대안 팔레트는 기본 팔레트의 L·C를 유지하고 hue만 바꾼다. 열 의미: tintHue = surface·surface-inverse·fg·fg-muted·border·border-strong의 hue(bg는 유지), primaryHue = primary·primary-hover(focus가 primary 연동이면 focus 포함), accentHue = accent. "유지"는 기본 hue 그대로. 색역 밖이면 C를 0.005씩 낮춘다. 빌드 스크립트 `pnpm taxonomy:palettes`가 해석값을 `palettes.json`에 기록하고 3.1.3 대비를 다시 검사한다(아래 24벌 모두 L 보정 없이 통과함을 확인함. 예외 표기 행은 L·C를 명시값으로 둔다).

| 팔레트 | tintHue | primaryHue | accentHue | primary hex | accent hex | 비고 |
|---|---|---|---|---|---|---|
| PAL-T1-1 | 유지 | 유지 | 145 | #29231E | #427044 | 올리브 |
| PAL-T1-2 | 유지 | 유지 | 250 | #29231E | #3B6692 | 잉크 블루 |
| PAL-T1-3 | 유지 | 유지 | 65 | #29231E | #84582A | 오커 |
| PAL-T2-1 | 유지 | 29 | — | #A13126 | — | 시그널 레드 |
| PAL-T2-2 | 유지 | 155 | — | #0B703F | — | 그린 |
| PAL-T2-3 | 유지 | 50 | — | #934404 | — | 번트 오렌지 |
| PAL-T3-1 | 150 | 150 | — | #376742 | — | 세이지 |
| PAL-T3-2 | 255 | 255 | — | #3B5C87 | — | 스카이 슬레이트 |
| PAL-T3-3 | 40 | 40 | — | #814A37 | — | 클레이 |
| PAL-T4-1 | 60 | 25 | 65 | #A03F3C | #C08343 | 벽돌 |
| PAL-T4-2 | 유지 | 60 | 100 | #915006 | #A2933B | 호박(primary C 0.115) |
| PAL-T4-3 | 100 | 140 | 100 | #357426 | #A2933B | 세이지 |
| PAL-T5-1 | 유지 | 29 | 200 | #BC0002 | #63F7FF | accent C 0.125 |
| PAL-T5-2 | 유지 | 145 | 320 | #06791F | #F5CFFD | accent C 0.075 |
| PAL-T5-3 | 유지 | 300 | 120 | #7935C6 | #D0EE5F | |
| PAL-T6-1 | 유지 | 345 | 165 | #B8338A | #58BA93 | 핑크 + 민트 |
| PAL-T6-2 | 유지 | 145 | 325 | #1B7E2A | #C88CCB | 예외: primary `.52 .15 145`, hover `.46 .14 145` #0A6B1D (on-primary 5.2, 대 bg 4.7) |
| PAL-T6-3 | 유지 | 55 | 235 | #AB5803 | #57AFE0 | 오렌지 + 스카이 |
| PAL-T7-1 | 유지 | 75 | — | #F2AF48 | — | 앰버 |
| PAL-T7-2 | 유지 | 230 | — | #59CCFE | — | 시안(C 0.125) |
| PAL-T7-3 | 유지 | 25 | — | #FDA19A | — | 코랄(C 0.11) |
| PAL-T8-1 | 유지 | 유지 | 145 | #121110 | #286F2F | 포레스트 |
| PAL-T8-2 | 유지 | 유지 | 250 | #121110 | #1A609E | 잉크 블루 |
| PAL-T8-3 | 유지 | 유지 | 65 | #121110 | #854F06 | 브론즈 |

PAL-T{n}-0의 `tintHue`: T1 85, T2 없음(무채), T3 210, T4 75, T5 100, T6 30~85(역할별 표 값), T7 250, T8 80. 보라(hue 270~310)와 파랑(220~260)을 함께 쓰는 팔레트는 없다(AIL-01 예방).

### 3.4.4 프리셋 L2 기본값

| L2 키 | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 |
|---|---|---|---|---|---|---|---|---|
| `type.pairing_id` | FP01 | FP09 | FP12 | FP04 | FP13 | FP11 | FP16 | FP20 |
| `type.scale_ratio` | 1.2 | 1.2 | 1.2 | 1.25 | 1.333 | 1.25 | 1.25 | 1.333 |
| `type.display_boost` | 1.5 | 1.25 | 1.0 | 1.25 | 2.0 | 1.5 | 1.25 | 2.0 |
| `type.headline_weight` | 600 | 700 | 700 | 700 | 400 | 400 | 700 | 300 |
| `type.body_size` | 18 | 16 | 17 | 17 | 16 | 16 | 16 | 16 |
| `type.body_leading` | 1.8 | 1.6 | 1.7 | 1.7 | 1.6 | 1.6 | 1.6 | 1.7 |
| `color.palette_id` | PAL-T1-0 | PAL-T2-0 | PAL-T3-0 | PAL-T4-0 | PAL-T5-0 | PAL-T6-0 | PAL-T7-0 | PAL-T8-0 |
| `shape.radius_family` | sharp | sharp | round | round | sharp | pill | soft | sharp |
| `shape.border` | hairline | hairline | none | none | bold | none | hairline | none |
| `depth.style` | flat | flat | subtle-shadow | subtle-shadow | brutal-offset | layered-shadow | glass | flat |
| `depth.shadow_level` | 0 | 0 | 1 | 1 | 1 | 2 | 1 | 0 |
| `space.density` | airy | regular | airy | regular | compact | regular | regular | airy |
| `space.container` | 1200 | 1280 | 1200 | 1200 | 1280 | 1200 | 1280 | 1280 |
| `layout.grid_mode` | symmetric | symmetric | symmetric | symmetric | asymmetric | asymmetric | bento | asymmetric |
| `media.mode` | photo-led | type-led | photo-led | photo-led | shape-graphic | photo-led | shape-graphic | photo-led |
| `media.treatment` | none | grayscale | none | warm-tint | none | none | grayscale | grayscale |
| `motion.level` | none | none | subtle | subtle | subtle | subtle | subtle | none |
| `icon.set` | phosphor | tabler | phosphor | iconoir | tabler | phosphor | tabler | phosphor |
| 기본 시그니처 | SIG-01 | SIG-02 | SIG-12 | SIG-12 | SIG-06 | SIG-06 | SIG-08 | SIG-11 |
| 장식 효과 수(기본) | 0 | 0 | 0 | 0 | 2(brutal-offset, marquee) | 1(marquee) | 1(glass) | 1(outline-text) |
| `buttonPill` | false | false | true | false | false | true | false | false |

`type.headline_weight` 300은 FP20(MaruBuri Light, 크기 ≥ 48px 단계에만)에서만 허용한다. 48px 미만 제목 단계는 400을 쓴다.

### 3.4.5 유형 허용 범위(개인화 허용 L2 집합)

굵게 = 기본값. 집합 밖 값은 매핑·편집·스냅 어디서도 선택되지 않는다(04장 F 집합).

| L2 키 | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 |
|---|---|---|---|---|---|---|---|---|
| pairing | **FP01**, FP02, FP03, FP19 | **FP09**, FP07, FP08, FP17, FP18 | **FP12**, FP10, FP18, FP17 | **FP04**, FP05, FP06, FP03, FP10 | **FP13**, FP14, FP15, FP08, FP11 | **FP11**, FP10, FP15, FP12 | **FP16**, FP07, FP09, FP14, FP17 | **FP20**, FP02, FP06, FP19 |
| scale_ratio | **1.2**, 1.25 | **1.2**, 1.25 | **1.2**, 1.25 | 1.2, **1.25** | 1.25, **1.333** | **1.25**, 1.333 | 1.2, **1.25**, 1.333 | 1.25, **1.333** |
| display_boost | 1.25, **1.5**, 2.0 | 1.0, **1.25**, 1.5 | **1.0**, 1.25 | 1.0, **1.25**, 1.5 | 1.5, **2.0** | 1.25, **1.5**, 2.0 | 1.0, **1.25**, 1.5 | 1.5, **2.0** |
| body_size | 17, **18** | **16**, 17 | 16, **17**, 18 | 16, **17**, 18 | **16** | **16**, 17 | **16**, 17 | **16**, 17 |
| body_leading | 1.7, **1.8** | **1.6**, 1.7 | **1.7**, 1.8 | 1.6, **1.7**, 1.8 | **1.6**, 1.7 | **1.6**, 1.7 | **1.6**, 1.7 | **1.7**, 1.8 |
| radius_family | **sharp**, soft | **sharp**, soft | **round**, pill | soft, **round** | **sharp** | round, **pill** | **soft**, round | **sharp** |
| border | **hairline**, none | **hairline**, bold | **none**, hairline | **none**, hairline | **bold** | **none**, hairline | **hairline**, none | **none**, hairline |
| depth.style | **flat** | **flat**, subtle-shadow | flat, **subtle-shadow**, layered-shadow | flat, **subtle-shadow** | flat, **brutal-offset** | subtle-shadow, **layered-shadow** | flat, **glass** | **flat** |
| shadow_level | **0**, 1 | **0**, 1 | **1**, 2 | **1**, 2 | **1**, 2 | 1, **2** | 0, **1**, 2 | **0** |
| density | **airy**, regular | **regular**, compact | **airy**, regular | airy, **regular** | regular, **compact** | **regular**, compact | **regular**, compact | **airy**, regular |
| container | 1120, **1200** | 1200, **1280** | 1120, **1200** | 1120, **1200** | **1280** | **1200**, 1280 | 1200, **1280** | 1200, **1280** |
| grid_mode | **symmetric**, asymmetric | **symmetric**, bento | **symmetric** | **symmetric**, asymmetric | bento, **asymmetric** | symmetric, bento, **asymmetric** | symmetric, **bento** | symmetric, **asymmetric** |
| media.mode | **photo-led**, type-led | **type-led**, photo-led | **photo-led**, shape-graphic | **photo-led** | **shape-graphic**, photo-led | **photo-led**, shape-graphic | **shape-graphic**, photo-led | **photo-led**, type-led |
| media.treatment | **none**, grayscale | **grayscale**, none | **none** | none, **warm-tint** | **none**, grayscale | **none** | **grayscale**, none | **grayscale**, none |
| motion.level | **none**, subtle | **none**, subtle | none, **subtle** | none, **subtle** | **subtle** | **subtle** | none, **subtle** | **none**, subtle |
| headline_weight | 페어링 허용값 전체 | 〃 | 〃 | 〃 | 〃 | 〃 | 〃 | 〃 |

서수 키의 허용 집합 값은 3.2.1 서수 순서로 정렬해 저장한다(표의 나열 순서는 의미 없음). 다크 테마(T7)에서 `subtle-shadow`·`layered-shadow`·`brutal-offset`은 허용하지 않는다(3.12).

### 3.4.6 타입 스케일(기본값, 데스크톱/모바일 px)

| 프리셋 | ratio·boost·base | caption | small | body | lead | h4 | h3 | h2 | h1 | display | D/B |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 1.2·1.5·18 | 13/13 | 15/15 | 18/17 | 22/20 | 26/22 | 31/26 | 37/30 | 67/43 | 81/49 | 4.5 |
| T2 | 1.2·1.25·16 | 12/12 | 13/13 | 16/16 | 19/18 | 23/21 | 28/24 | 33/28 | 50/36 | 60/42 | 3.7 |
| T3 | 1.2·1.0·17 | 12/12 | 14/14 | 17/16 | 20/18 | 24/21 | 29/24 | 35/28 | 42/32 | 51/37 | 3.0 |
| T4 | 1.25·1.25·17 | 12/12 | 14/14 | 17/16 | 21/19 | 27/23 | 33/28 | 42/33 | 65/44 | 81/52 | 4.8 |
| T5 | 1.333·2.0·16 | 12/12 | 12/12 | 16/16 | 21/20 | 28/25 | 38/31 | 51/39 | 96/44 | 128/52 | 8.0 |
| T6 | 1.25·1.5·16 | 12/12 | 13/13 | 16/16 | 20/19 | 25/23 | 31/28 | 39/33 | 73/44 | 92/52 | 5.7 |
| T7 | 1.25·1.25·16 | 12/12 | 13/13 | 16/16 | 20/19 | 25/23 | 31/28 | 39/33 | 61/44 | 76/52 | 4.8 |
| T8 | 1.333·2.0·16 | 12/12 | 12/12 | 16/16 | 21/20 | 28/25 | 38/31 | 51/39 | 96/44 | 128/52 | 8.0 |

### 3.4.7 유형 중심 벡터(= `anchor_l1` = `predictL1`(기본 L2)) — 단일 원천(R-04)

JSON 키는 R-01을 따른다(A1 `expression`, A2 `temperature`, A3 `shape`, A4 `density`, A5 `depth`). 02장 유형 판정의 중심 c_T, 04장 앵커 a_T, 05장 `anchor_l1`, 07장 골든 θ* 생성, 09장 `TypeDef.centroid`는 모두 이 표를 쓴다.

| 유형 | expression | temperature | shape | density | depth | 범위 제안 [lo, hi] |
|---|---|---|---|---|---|---|
| T1 | 0.26 | 0.81 | 0.12 | 0.00 | 0.00 | 각 축 중심 ± 0.20, [0,1]로 자름 |
| T2 | 0.30 | 0.23 | 0.12 | 0.62 | 0.00 | 〃 |
| T3 | 0.16 | 0.31 | 0.72 | 0.12 | 0.34 | 〃 |
| T4 | 0.40 | 0.96 | 0.72 | 0.50 | 0.34 | 〃 |
| T5 | 1.00 | 0.57 | 0.00 | 1.00 | 0.56 | 〃 |
| T6 | 0.79 | 0.70 | 1.00 | 0.62 | 0.66 | 〃 |
| T7 | 0.54 | 0.23 | 0.32 | 0.62 | 0.70 | 〃 |
| T8 | 0.70 | 0.65 | 0.25 | 0.25 | 0.00 | 〃 |

- 쌍별 유클리드 거리 최솟값 0.546(T1–T8), 다음 0.644(T4–T6), 0.70(T2–T8). 05장 5.9 분리 기준(측정 ≥ 0.25)에 여유 0.30을 둔다.
- 이 값은 02장 2.11 표의 초기 제안값과 다르다. R-04에 따라 이 표가 원천이며, 02장 표·브리지 기준 벡터(SV09~SV16) 배치의 재검토는 02장 소관이다.
- 05장 왕복 검증에서 측정값이 이 값과 0.10 넘게 다르면 05장 5.9 절차로 이 표 또는 토큰을 고친다.

### 3.4.8 설문 자극물 지원(R-06)

1단계 카드 풀 48장 = 기준 벡터 16개(앵커 8 + 브리지 8) × 콘텐츠 템플릿 3(02장 D-0202). 이 장은 다음만 보장한다.
- 앵커 카드(SV01~SV08)의 L2 = 해당 프리셋 기본 L2(3.4.4).
- 브리지 카드의 L2 = `mapL1toL2(target_l1, baseTypeId, purpose = null)`(3.3.2, 용도 클리핑 없음) → 04장 스냅 → `deriveTokens`. 범주형 L2는 기준 유형 허용 집합(3.4.5)에서만 고른다.
- 2단계 A/B 수준 {0.2, 0.5, 0.8}, 쌍 구성(120쌍)은 09장 D-0903. 카드·쌍 채택 여부는 렌더 실측 L1(`x_card`, 05장 추출기) 기준(09장 D-0904)이며 의도값(`predictL1`)으로 판정하지 않는다.
- 자극물 템플릿은 3.6 블록만으로 구성하며, 렌더 이미지 규격(R-07)은 → 06장·09장.

**AC-03-12** 8개 프리셋 JSON이 스키마·3.1.3 대비·04장 조화 점수 H = 100(표준 트리 기준, 3.6.7)·상충 0건을 모두 통과한다.
**AC-03-13** 유형 중심 8개의 쌍별 거리 최솟값 ≥ 0.25(설계값 0.546), 각 앵커가 최근접 중심 판정에서 자기 유형으로 판정된다(8/8).
**AC-03-14** 같은 고정 콘텐츠 트리를 8개 프리셋으로 렌더했을 때 모든 프리셋 쌍(28쌍)이 {radius 집합, depth.style, heading font-family 첫 항목, body font-family 첫 항목, primary 색(ΔE_OK ≥ 0.05), border 두께} 6속성 중 ≥ 3개에서 다르다(PD-18 구별성).

---

## 3.5 컴포넌트 라이브러리 [P0]

컴포넌트는 블록 템플릿(04장 CM-01) 안에서만 쓰이는 사람 작성 부품이다. LLM은 컴포넌트를 직접 지정하지 않고 블록·variant·슬롯만 고른다. 모든 시각 값은 토큰에서만 온다.

### 3.5.1 목록 (MVP 18종)

| # | 컴포넌트 | variant | size | 규칙 |
|---|---|---|---|---|
| C01 | Button | primary / secondary(outline) / ghost | sm 36 / md 44 / lg 52 (높이 px), 좌우 패딩 12 / 20 / 24 | 페이지당 primary ≤ 2개 노출(뷰포트당 ≤ 1). 아이콘 위치 none / trailing(arrow-right만). 라벨 2~10자. 모양 = 3.1.7 |
| C02 | TextLink | inline / standalone(뒤 화살표) | — | 밑줄 기본(inline), hover 시 밑줄 두께 1→2px |
| C03 | Tag | outline / subtle | sm 24 / md 28 | "New", "신규", "출시", "✨" 단독 금지(AIL-04) |
| C04 | Input | default | md 44 / lg 52 | 글자 크기 ≥ 16px, 라벨 필수(placeholder 대체 금지) |
| C05 | Textarea | default | 4~6행 | 〃 |
| C06 | Select | native 래핑 | md 44 | 화살표 = 아이콘 세트 caret-down |
| C07 | Checkbox | default | 20 | 개인정보 수집 동의 1개용 |
| C08 | NavBar | split(로고 좌·링크·CTA 우) / center(로고 중앙) / minimal(로고 + 메뉴 버튼) | 높이 64(모바일 56) | 768 미만 모두 drawer. 링크 ≤ 5(04장 nav 자동 생성). sticky = 프리셋 T2·T7만, 스크롤 시 bg 불투명 + level 3 |
| C09 | Drawer | right | 폭 min(360, 100vw) | 열림 시 focus trap, Esc 닫기, 배경 overlay α 0.4. JS 없는 정적 내보내기에서는 `<details>` 기반 |
| C10 | Footer | minimal / columns / big-type | — | 사업자 정보 슬롯(상호·대표자·사업자등록번호·주소·연락처, 미입력 시 04장 CP-10 가상값) |
| C11 | Card | plain / media-top / media-left | — | 링크 카드만 hover 변화 1종(3.5.3) |
| C12 | MediaFrame | 1:1 / 4:5 / 3:2 / 16:9 / 21:9 | — | `object-fit: cover` + focal point. 이미지 없으면 3.10.5 플레이스홀더 |
| C13 | Avatar | initials | sm 32 / md 48 | 사진 아바타 MVP 제외(얼굴 금지, 08장). 이니셜 = 성 1자 + "○○"의 첫 글자 |
| C14 | PriceTag | default / per-period | — | 형식 `12,000원` / `월 9,900원`(천 단위 쉼표, `tabular-nums`). "시가" 등 텍스트 허용(≤ 6자) |
| C15 | Stat | value+label / value+label+note | — | 값은 브랜드 입력 숫자만(04장 CP-03). `tabular-nums` |
| C16 | Accordion | bordered / plain | — | `<details><summary>`, 키보드 Enter/Space, 아이콘 회전 fast |
| C17 | Divider | line / space / ornament(SIG-01 전용) | — | |
| C18 | Wordmark | text | nav `t-lead`(3.1.5a) / footer `t-3` / big-type = `t-display`(T-28) | 브랜드명을 `font.heading`으로 조판. 로고 업로드 MVP 제외(D-0803). 심볼 생성 금지 |
| — | Icon | (3.9) | 16 / 20 / 24 / 32 | 컴포넌트가 아니라 자산 참조 |

MVP 제외: Rating(별점, 가상 평점 노출 위험 → 08장), Tabs, Carousel, Modal, Toast, Table, 지도 임베드, 예약 위젯, 사진 Avatar, 로고 클라우드의 실제 로고.

### 3.5.2 variant × state 매트릭스

● = 정의 필수, — = 해당 없음.

| 컴포넌트 | default | hover | active | focus-visible | disabled | error | checked/selected | expanded | open |
|---|---|---|---|---|---|---|---|---|---|
| Button(3 variant) | ● | ● | ● | ● | ● | — | — | — | — |
| TextLink | ● | ● | ● | ● | — | — | — | — | — |
| Tag | ● | — | — | — | — | — | — | — | — |
| Input / Textarea / Select | ● | ● | — | ● | ● | ● | — | — | — |
| Checkbox | ● | ● | — | ● | ● | ● | ● | — | — |
| NavBar | ● | 링크 ● | — | ● | — | — | 현재 섹션 ● | — | — |
| Drawer | — | — | — | ● | — | — | — | — | ● |
| Card(링크) | ● | ● | — | ● | — | — | — | — | — |
| Accordion | ● | ● | — | ● | — | — | — | ● | — |
| MediaFrame | ● | — | — | — | — | — | — | — | — (placeholder 상태 ●) |
| 기타(PriceTag, Stat, Divider, Avatar, Wordmark, Footer) | ● | 링크만 ● | — | 링크만 ● | — | — | — | — | — |

18종 × variant × state 총 렌더 케이스 수는 `components.json`에서 계산하며, 시각 회귀 대상은 이 케이스 × 프리셋 8이다.

### 3.5.3 state 파생 규칙(모든 프리셋 공통)

| state | 규칙 |
|---|---|
| hover(primary) | bg = `primary-hover`. 다른 변화 없음 |
| hover(secondary) | bg = `surface`, 테두리 = `border-strong` |
| hover(ghost) | bg = fg α 0.06(라이트) / α 0.10(다크) |
| active | bg = `primary-active` |
| focus-visible | `outline: 2px solid var(--tf-color-focus); outline-offset: 2px`. inverse 섹션 안에서는 `focus-inverse`. 포커스 링 제거 금지 |
| disabled | opacity 0.45, `cursor: not-allowed`, 대비 요구 면제(WCAG 1.4.3 예외) |
| error | 테두리·도움말 텍스트 = `danger`, 아이콘 warning-circle, `aria-invalid="true"` |
| checked | bg = `primary`, 체크 = `on-primary` |
| 링크 카드 hover | depth.style별 1종: flat → 테두리 `border-strong` / subtle·layered → level +1 / brutal-offset → translate(−2px,−2px) + 오프셋 +2px / glass → 배경 α +0.10 |
| 전환 시간 | `motion.duration.fast`, `easing.standard`. reduce 모션에서 0 |

### 3.5.4 슬롯 텍스트 길이(컴포넌트 수준)

길이는 04장 카피 덱과 같은 기준(한글 글자 수, 공백 포함)이다. 블록 슬롯 `maxLength`(3.6.4)는 덱 상한 이상이어야 하므로 컴포넌트는 그 상한에서 넘침이 없도록 설계한다: Button 라벨 10자를 lg/md/sm 모두 1줄, Tag 8자 1줄, Stat 값 10자 1줄(375px에서 Stat 2열 배치 시 포함).

**AC-03-15** `/dev/components` 페이지(또는 Storybook)에서 18종 × 모든 variant × 3.5.2의 ● state가 프리셋 8종으로 렌더되고, 각 렌더에서 axe-core serious/critical 0건이다.
**AC-03-16** 모든 state의 색·그림자·radius 값이 토큰 변수 참조만으로 구성된다(컴포넌트 CSS 리터럴 검사 0건, 허용 목록은 04장 CM-02).
**AC-03-17** 상한 길이 카피(Button 10자, Tag 8자, Stat 값 10자)로 375/768/1280에서 넘침·잘림 0건(04장 G-04·G-05 측정 함수 재사용).

---

## 3.6 섹션 블록 라이브러리 [P0]

### 3.6.1 블록 카탈로그 (MVP 20블록(nav·footer 포함), 50 variant)

블록 ID는 04장 패턴 카탈로그(§4.8)의 이름과 같다. nav는 컴파일러가 만든다(04장). `align`: left / center / asym. `skeleton`: 리듬 검사용 골격 분류(split / grid / list / full / type). `img`: 이미지 슬롯 수. `fallback`: 이미지 후보가 없을 때 대체 variant(04장 §4.9.4).

| 블록 | variant | align | skeleton | img | 메타 | fallback |
|---|---|---|---|---|---|---|
| nav | split / center / minimal | left / center / left | — | 0 | 컴파일러 생성 | — |
| hero | split | left | split | 1(4:5 또는 1:1) | | left-aligned |
| | type-only | left | type | 0 | 거대 타이포, 이미지 없음 | — |
| | full-bleed-image | left | full | 1(16:9 / 21:9) | `text_over_image` | type-only |
| | left-aligned | left | type | 0~1(3:2 작게, 우하단) | | type-only |
| | offset | asym | split | 2(4:5 + 1:1) | | split |
| | centered | center | type | 0~1(16:9 아래) | 그라디언트 배경·Tag eyebrow 불가 | left-aligned |
| value | numbered | left | list | 0 | 01/02/03 번호 | — |
| | rule-list | left | list | 0 | 2열 괘선 목록 | — |
| | icon-grid | left | grid | 0 | `icon_grid`(페이지당 ≤ 1, AIL-05) | — |
| | bento | asym | grid | 항목별 1 | `grid_mode = bento`일 때만, 항목 ≥ 4이고 항목마다 고유 이미지 또는 수치(AIL-12) | numbered |
| feature | zigzag | asym | split | 항목별 1(3:2) | | stack |
| | stack | left | full | 1(16:9) | | 블록 제거(용도 필수가 아닐 때). saas에서 value가 없으면 value.numbered로 치환 |
| | split-list | left | split | 1(4:5) | | stack |
| showcase | wide | left | full | 1(21:9) | 대표작·제품 화면 1장 | type-only 대체 불가 → 블록 제거 후 G-01 재검사 |
| | framed | center | full | 1(16:9) + 캡션 | | 〃 |
| stats | row | left | grid | 0 | 3~4개 가로 | — |
| | split | asym | split | 0 | 제목·리드 좌 + 수치 우 | — |
| process | horizontal | left | grid | 0 | 3~5단계 | — |
| | vertical | left | list | 0 | 3~6단계 | — |
| proof | quote-large | center | type | 0 | 인용 1개 | — |
| | cards | left | grid | 0 | 2~3개, 이니셜 아바타 | — |
| pricing | cards | left | grid | 0 | 2~3 플랜, 강조 ≤ 1 | — |
| | single | center | type | 0 | 1 플랜 | — |
| faq | accordion | left | list | 0 | 1열 | — |
| | two-col | asym | split | 0 | 좌 제목 고정 + 우 목록 | — |
| cta | band | center | type | 0 | `bg = inverse` 고정 | — |
| | big-type | left | type | 0 | display 단계 제목 | — |
| | image | left | full | 1(21:9) | `text_over_image` | band |
| menu | leader | left | list | 0 | 점선 리더 + 가격 | — |
| | cards | left | grid | 항목별 1(1:1) | 항목 3~8 | leader |
| | columns | left | list | 0 | 그룹 2~4를 2열 | — |
| highlight | trio | left | grid | 항목별 1(4:5) | 항목 3 | text-trio |
| | text-trio | left | grid | 0 | | — |
| | split | asym | split | 1(4:5) + 목록 | | text-trio |
| gallery | grid | left | grid | 6/8/9(1:1 또는 4:5 균일) | | 블록 제거 |
| | masonry | asym | grid | 5~9(혼합 비율) | | grid |
| | feature | asym | grid | 5(대 1 + 소 4) | | grid |
| location | info-map | asym | split | 1(지도 플레이스홀더 3:2) | 지도 임베드 MVP 제외 | info-only |
| | info-only | left | list | 0 | 주소·영업시간·전화 | — |
| story | split | asym | split | 1(4:5) | | text |
| | text | left | type | 0 | 본문 2단락, measure 적용 | — |
| about | split | asym | split | 1(4:5) | | text |
| | text | left | type | 0 | | — |
| service | list | left | list | 0 | 3개 | — |
| | cards | left | grid | 0 | 3개 카드 | — |
| contact | split-form | asym | split | 0 | 폼 + 연락처. 정적 내보내기 폼은 `action` 미지정 + README 안내 | simple |
| | simple | left | type | 0 | 연락처 + CTA | — |
| footer | minimal / columns / big-type | left | — | 0 | big-type은 Wordmark를 display 크기로 | — |

### 3.6.2 섹션 노드 공통 필드

섹션 노드 스키마(`SectionRaw`)는 04장 §4.5.2가 정의한다(`id, block, variant, bg, pad, slots`). 이 장은 `blocks.json`으로 다음을 제공한다.

```ts
interface BlockDef {
  id: BlockId; nameKo: string;
  default_heading_ko: string;        // 카피 덱에 제목 키가 없을 때 컴파일러가 쓰는 고정 제목(예: faq "자주 묻는 질문")
  nav_label: string | null;          // nav 링크 라벨(예: menu "메뉴", location "오시는 길"), null = nav 제외
  variants: VariantDef[];
}
interface VariantDef {
  id: VariantId;                    // '<block>.<variant>' 예: 'hero.split'
  align: 'left'|'center'|'asym'; skeleton: 'split'|'grid'|'list'|'full'|'type';
  icon_grid: boolean; text_over_image: boolean; fallback_variant: VariantId | null;
  allowed_bg: ('bg'|'surface'|'inverse'|'image')[];
  decor_slots: SignatureId[];        // 이 variant에 적용 가능한 시그니처
  slots: SlotDef[];
  mobile: MobileRule;               // 3.11.3
}
interface SlotDef {
  id: string; kind: 'copy'|'list'|'image'|'link';
  deckKeys: string[];               // 허용 카피 덱 키(04장 §4.6.2)
  required: boolean;
  list?: { min: number; max: number };
  maxLength?: number;               // 한글 글자 수(공백 포함), 덱 상한 이상
  image?: { tags: ImageTag[]; ratios: Ratio[] };
}
```

### 3.6.3 블록별 슬롯 정의

길이는 04장 카피 덱 상한을 따르고, 슬롯 `maxLength` = 덱 상한(같은 값). 제목 키가 덱에 없는 블록은 `default_heading_ko`를 쓴다(D-0305로 덱 제목 키 추가 제안).

| 블록 | 슬롯(필수 ●) | 덱 키 | 목록 범위 |
|---|---|---|---|
| hero | eyebrow, headline ●, sub ●, primaryCta ●, secondaryCta, media(variant별) | hero.eyebrow, hero.headline, hero.sub, cta.primary, cta.secondary | — |
| value | items ● | value.items | 3~4(icon-grid 정확히 3, bento 4) |
| feature | items ●, media | feature.items | zigzag 2~3, stack·split-list 3~5 |
| showcase | media ●, caption | work.items[0] 캡션 또는 hero.sub | — |
| stats | items ● | stats.items | 3~4(row), 2~4(split) |
| process | items ● | feature.items 또는 service.items | 3~5 / 3~6 |
| proof | items ● | proof.items(항상 placeholder, 04장 CP-09) | 1(quote-large), 2~3(cards) |
| pricing | plans ● | 브랜드 입력 가격만(없으면 블록 금지) | 1 / 2~3 |
| faq | items ● | faq.items | 3~6 |
| cta | headline ●, primaryCta ● | hero.headline(미사용 옵션) 또는 about.title, cta.primary | — |
| menu | groups ● | menu.groups | 그룹 1~4, 항목 2~10 |
| highlight | items ● | highlight.items | 정확히 3 |
| gallery | media ● ×n, captions | work.items(portfolio) | 3.6.1 수량 |
| location | address ●, hours ●, phone, mapPlaceholder | contact.* | hours 1~7행 |
| story | body ●, media | story.body | — |
| about | title ●, body ●, media | about.title, about.body | — |
| service | items ● | service.items | 정확히 3 |
| contact | title, body, contactInfo ●, form(split-form) | about.title, contact.* | 폼 필드 고정: 이름·연락처·문의 내용·동의 체크 |
| footer | wordmark ●, tagline, businessInfo ●, links | footer.tagline, contact.* | links 0~6 |

링크 슬롯 대상은 04장 §4.5.2 규칙(페이지 앵커, 브랜드 입력 URL·전화·이메일)만. SNS 링크는 텍스트 라벨로 표시하고 브랜드 로고 아이콘은 쓰지 않는다(상표, 08장).

### 3.6.4 이미지 슬롯 비율과 태그

비율 enum은 04장과 같은 `1:1 | 4:5 | 3:2 | 16:9 | 21:9`이며 4:3은 쓰지 않는다. 태그는 3.10.2 enum.

### 3.6.5 용도별 블록 구성 (`purposes.json`)

섹션 수는 nav·footer 제외(04장 LT-03과 같음).

| 용도 | 필수 | 필수 중 택1 | 선택 | 금지 | 섹션 수 | 표준 hero(V-FIT) | 금지·대체 L2 |
|---|---|---|---|---|---|---|---|
| saas | hero, cta | value 또는 feature | value, feature, showcase, stats, process, proof, pricing, faq | menu, highlight, gallery, location, story | 6~8 | split, left-aligned | — |
| local_business | hero, menu, location | — | highlight, gallery, story, about, proof, faq, cta, contact | pricing, process, showcase, value | 6~7 | full-bleed-image, split | `media.mode = type-led` 금지 → `photo-led`(사진 0장이면 `shape-graphic`) |
| portfolio | hero, gallery, contact | — | about, service, showcase, stats, proof, process, cta | menu, location, pricing | 5~7 | type-only, split | — |

- "필수 중 택1"은 `requiredAny` 필드로 둔다(04장 LT-01 확장, D-0306).
- 정렬 순서 규칙: hero는 첫 섹션(04장 LT-04). cta는 마지막 2개 섹션 안. contact·location은 마지막 3개 섹션 안. 나머지 순서는 패턴(04장 §4.8)이 정한다.
- 용도별 이미지 태그 허용(`imageTags`): saas = `saas.*`, `common.*` / local_business = `local_business.*`, `common.*` / portfolio = `portfolio.*`, `common.*`.

### 3.6.6 유형별 블록 선호 (`presets/*.json`)

| 유형 | heroVariants(허용) | preferredPatterns saas | local_business | portfolio | 블록 variant 제외 |
|---|---|---|---|---|---|
| T1 | type-only, split, left-aligned | PS-1, PS-4 | PL-2, PL-3 | PP-2, PP-1 | value.icon-grid, value.bento |
| T2 | left-aligned, type-only, split | PS-2, PS-4 | PL-1, PL-4 | PP-1, PP-3 | gallery.masonry |
| T3 | split, centered, left-aligned | PS-1, PS-3 | PL-2, PL-1 | PP-2, PP-3 | value.bento |
| T4 | split, full-bleed-image, offset | PS-3, PS-1 | PL-2, PL-1 | PP-4, PP-2 | value.bento |
| T5 | type-only, offset, full-bleed-image | PS-2, PS-3 | PL-3, PL-4 | PP-4, PP-1 | value.rule-list |
| T6 | offset, split, centered | PS-4, PS-3 | PL-4, PL-3 | PP-3, PP-4 | menu.leader, value.rule-list |
| T7 | left-aligned, split, full-bleed-image | PS-3, PS-2 | PL-3, PL-1 | PP-1, PP-4 | menu.leader |
| T8 | full-bleed-image, type-only, offset | PS-3, PS-1 | PL-3, PL-2 | PP-4, PP-1 | value.icon-grid, value.bento, stats.row |

`hero.centered`는 T3·T6만 허용한다(정중앙 히어로 AI 티 억제).

### 3.6.7 섹션 리듬 규칙

04장 LT-05~LT-08이 검사한다. 이 장은 그 근거 메타를 제공하고 아래 2개를 추가한다(04장 H12 집계 대상으로 제안, D-0307).

| ID | 규칙 | 메타 |
|---|---|---|
| LT-05 | 인접 섹션 같은 `block.variant` 금지 | variant ID |
| LT-06 | `bg` 같은 값 3연속 금지, 6섹션 이상에서 bg/surface 엄격 교대 금지, inverse 1~2개(다크 테마는 0~1) | `allowed_bg` |
| LT-07 | `pad ≠ 0` 섹션 ≥ 1 | — |
| LT-08 | `align = center` variant 비율 ≤ 40% | `align` |
| RH-01(추가) | 같은 `skeleton` 3연속 금지(예: grid-grid-grid) | `skeleton` |
| RH-02(추가) | 이미지 없는 섹션(img = 0) 4연속 금지, 이미지 섹션 4연속 금지 | `img` |

표준 트리(조화 점수 100 기준선, AC-03-12): 용도별 패턴 1번(PS-1 / PL-1 / PP-1) + 각 블록 첫 번째 허용 variant + 위 규칙을 만족하는 bg 배치(bg → surface → bg → inverse(cta) 순환 규칙을 컴파일러 `standardTree(typeId, purpose)`가 결정론적으로 생성). 04장 폴백 시안(`buildFallback`)도 이 함수를 쓴다.

**AC-03-18** `blocks.json`의 50개 variant 각각이 3개 용도 중 허용되는 모든 용도 × 프리셋 8종 × 검증 뷰포트 5종(D-25)에서 슬롯 상한 길이 카피로 렌더될 때 G-04(가로 넘침)·G-05(잘림)·G-06(겹침) 0건이다.
**AC-03-19** 모든 슬롯의 `maxLength`가 04장 카피 덱 상한 이상이다(정적 비교 테스트). 덱에 없는 키를 참조하는 슬롯은 0개다.
**AC-03-20** `standardTree`가 8유형 × 3용도 = 24개 트리를 만들고, 24개 모두 04장 G-01·G-02·G-03(T-27)·LT-01~08·RH-01~02 위반 0건, 조화 점수 H = 100이다.
**AC-03-21** `fallback_variant` 체인이 순환하지 않고, 모든 체인이 이미지 0장 variant 또는 "블록 제거"로 끝난다(그래프 검사).

---
## 3.7 서체 [P0]

### 3.7.1 원칙

- 라이선스: SIL OFL 1.1만 사용한다(D-27). 상업 이용·웹 임베딩·zip 동봉 재배포가 가능해야 한다. 각 폰트의 라이선스 원문·RFN(Reserved Font Name) 여부·확인일을 `registry.json`의 `licenseUrl`, `reservedFontName`, `verifiedAt`에 기록한다. **출시 전 원문 확인**(→ 08장 8.4).
- 서브셋은 원본의 수정본이다. RFN 유무와 관계없이 서브셋 파일의 패밀리 이름을 `tf-<fontId>`로 바꿔 배포하고, 원본 저작권 표시와 OFL 전문을 `fonts/LICENSES/`에 동봉한다(D-0304).
- 자체 호스팅만. 외부 CDN 0(D-26). 기업 자체 라이선스 무료 폰트(재배포·수정 제한이 있는 것)는 MVP 제외.
- 기본값 서체 제외: Inter, Geist, Roboto, Poppins, Montserrat, Noto Sans KR, 시스템 폰트 단독. Pretendard는 화이트리스트에 있으나 heading·body 모두 Pretendard이고 라틴 디스플레이가 없는 조합은 페어링으로 두지 않는다(국내판 "전부 Inter").

### 3.7.2 화이트리스트 (한글 12 · 영문 14)

`classification`은 05장 `font-classes.json` 분류값과 같다. "빌드 웨이트" = `registry.json`에 원본을 보관하는 웨이트. 한 시안이 실제로 로드하는 웨이트는 패밀리당 ≤ 3.

| ID | 패밀리 | script | classification | 빌드 웨이트 | 출처(원문 확인) | 비고 |
|---|---|---|---|---|---|---|
| kr-pretendard | Pretendard | hangul | sans_neo_grotesque | 400, 500, 700, 800 | github.com/orioncactus/pretendard | |
| kr-suit | SUIT | hangul | sans_geometric | 400, 500, 700, 800 | github.com/sun-typeface/SUIT | |
| kr-wanted | Wanted Sans | hangul | sans_neo_grotesque | 400, 500, 700, 800, 900 | github.com/wanteddev/wanted-sans | |
| kr-plex | IBM Plex Sans KR | hangul | sans_humanist | 400, 500, 600, 700 | github.com/IBM/plex | |
| kr-gothic-a1 | Gothic A1 | hangul | sans_neo_grotesque | 400, 500, 700 | fonts.google.com | |
| kr-noto-serif | Noto Serif KR | hangul | serif | 400, 500, 600, 700 | github.com/notofonts/noto-cjk | |
| kr-maruburi | MaruBuri(마루 부리) | hangul | serif | 300, 400, 600, 700 | hangeul.naver.com | 배포 라이선스 OFL 여부 원문 확인 필수 |
| kr-hahmlet | Hahmlet | hangul | serif | 400, 500, 600 | fonts.google.com | |
| kr-gowun-batang | Gowun Batang(고운바탕) | hangul | serif | 400, 700 | fonts.google.com | |
| kr-gowun-dodum | Gowun Dodum(고운돋움) | hangul | sans_humanist | 400 | fonts.google.com | 굵기 1종 |
| kr-black-han | Black Han Sans | hangul | display | 400 | fonts.google.com | 헤드라인 전용 |
| kr-do-hyeon | Do Hyeon | hangul | display | 400 | fonts.google.com | 헤드라인 전용 |
| en-fraunces | Fraunces | latin | serif | 600, 700 | fonts.google.com | |
| en-instrument-serif | Instrument Serif | latin | serif | 400 | fonts.google.com | 고대비 |
| en-newsreader | Newsreader | latin | serif | 600 | fonts.google.com | |
| en-dm-serif | DM Serif Display | latin | serif | 400 | fonts.google.com | 고대비 |
| en-cormorant | Cormorant | latin | serif | 400, 500 | fonts.google.com | 고대비 |
| en-space-grotesk | Space Grotesk | latin | sans_neo_grotesque | 600, 700 | fonts.google.com | |
| en-dm-sans | DM Sans | latin | sans_geometric | 700 | fonts.google.com | |
| en-manrope | Manrope | latin | sans_geometric | 600 | fonts.google.com | |
| en-jakarta | Plus Jakarta Sans | latin | sans_geometric | 700 | fonts.google.com | |
| en-bricolage | Bricolage Grotesque | latin | display | 800 | fonts.google.com | |
| en-archivo | Archivo | latin | sans_neo_grotesque | 800 | fonts.google.com | |
| en-syne | Syne | latin | display | 700 | fonts.google.com | |
| en-plex-mono | IBM Plex Mono | latin | mono | 400, 500 | github.com/IBM/plex | |
| en-jetbrains-mono | JetBrains Mono | latin | mono | 400, 500 | github.com/JetBrains/JetBrainsMono | |

영문 서체는 단독 사용하지 않는다. 라틴 디스플레이로 헤드라인의 라틴 글자만 담당하거나 mono 라벨로만 쓴다(QA-10).

### 3.7.3 페어링 20쌍 (`pairings.json`)

모든 페어링은 heading과 body에 한글 서체를 반드시 가진다(D-27). 비 mono 패밀리 수 ≤ 2(04장 H4 만점 조건). heading 라틴 서체는 같은 heading 요소 안에서 라틴 글자만 렌더한다.

| ID | 이름 | heading 한글(허용 웨이트, **기본**) | heading 라틴(size-adjust) | body | mono | emphasis | sig temp·expr·soft | contrastSerif | 허용 유형 |
|---|---|---|---|---|---|---|---|---|---|
| FP01 | 에디토리얼 명조 | MaruBuri 400, **600**, 700 | — | Pretendard 400 | — | 700 | .70 .45 .35 | N | T1 |
| FP02 | 갤러리 세리프 | Noto Serif KR 400, **500**, 600 | Instrument Serif(104%) | Noto Serif KR 400 | — | 600 | .55 .55 .25 | Y | T1, T8 |
| FP03 | 개성 명조 | Hahmlet 400, **500**, 600 | — | IBM Plex Sans KR 400 | — | 600 | .60 .55 .40 | N | T1, T4 |
| FP04 | 포근한 바탕 | Gowun Batang **700** | — | Gowun Dodum 400 | — | heading 서체 700 | .90 .40 .70 | N | T4 |
| FP05 | 따뜻한 바탕 | Gowun Batang 400, **700** | Fraunces(98%) | Gowun Batang 400 | — | 700 | .85 .50 .55 | N | T4 |
| FP06 | 손맛 세리프 | Hahmlet 500, **600** | DM Serif Display(100%) | Hahmlet 400 | — | 600 | .75 .65 .40 | Y | T4, T8 |
| FP07 | 스위스 고딕 | SUIT 700, **800** | Space Grotesk(100%) | SUIT 400 | — | 700 | .20 .50 .20 | N | T2, T7 |
| FP08 | 단단한 그로테스크 | Wanted Sans 700, **800**, 900 | Archivo(100%) | Wanted Sans 400 | — | 700 | .30 .65 .30 | N | T2, T5 |
| FP09 | 시스템 플렉스 | IBM Plex Sans KR 500, 600, **700** | — | IBM Plex Sans KR 400 | IBM Plex Mono 400 | 600 | .20 .35 .25 | N | T2, T7 |
| FP10 | 다정한 기하 | SUIT 500, **700**, 800 | Plus Jakarta Sans(100%) | SUIT 400 | — | 700 | .55 .45 .75 | N | T3, T4, T6 |
| FP11 | 말랑한 포스터 | Do Hyeon **400** | — | SUIT 400 | — | 700 | .65 .75 .85 | N | T5, T6 |
| FP12 | 친근한 고딕 | Gothic A1 500, **700** | DM Sans(100%) | Gothic A1 400 | — | 700 | .50 .40 .60 | N | T3, T6 |
| FP13 | 포스터 | Black Han Sans **400** | — | Pretendard 400 | — | 700 | .45 .95 .15 | N | T5 |
| FP14 | 볼드 그로테스크 | Wanted Sans 800, **900** | Bricolage Grotesque(96%) | Wanted Sans 400 | — | 700 | .35 .85 .30 | N | T5, T7 |
| FP15 | 실험 디스플레이 | Wanted Sans 700, **800** | Syne(96%) | Pretendard 400 | — | 700 | .40 .80 .35 | N | T5, T6 |
| FP16 | 테크 그로테스크 | Wanted Sans 500, **700**, 800 | Space Grotesk(100%) | Wanted Sans 400 | JetBrains Mono 400 | 700 | .15 .55 .35 | N | T7 |
| FP17 | 콘솔 | SUIT 500, **700**, 800 | — | SUIT 400 | JetBrains Mono 400 | 700 | .20 .40 .40 | N | T2, T3, T7 |
| FP18 | 단정한 휴머니스트 | IBM Plex Sans KR 500, **600**, 700 | Manrope(100%) | IBM Plex Sans KR 400 | — | 600 | .40 .35 .45 | N | T2, T3 |
| FP19 | 신문 명조 | Noto Serif KR 500, **600**, 700 | Newsreader(100%) | Noto Serif KR 400 | — | 700 | .60 .45 .30 | N | T1, T8 |
| FP20 | 럭셔리 세리프 | MaruBuri **300**(≥ 48px 단계만), 400 | Cormorant(105%) | MaruBuri 400 | — | 600 | .35 .60 .15 | Y | T8 |

- 라틴 heading 파일은 한글 heading의 CSS `font-weight` 값과 같은 웨이트 디스크립터로 등록한다(예: FP05 Fraunces 600 파일을 `font-weight: 700`으로 선언). 그래서 heading 요소의 computed font-weight는 1종이고 페이지 웨이트 고유값 ≤ 3이 유지된다(04장 H5).
- size-adjust는 라틴 글자의 x-height를 한글 글자 높이에 맞추는 보정이며 범위 90~105%다(Instrument Serif는 104%, Cormorant 105% 상한). 골든 세트 시각 검수에서 ±5%p 안에서 조정할 수 있다.
- 서체 9종(Pretendard, SUIT, Wanted Sans, IBM Plex Sans KR, Noto Serif KR, MaruBuri, Gowun Batang, Hahmlet, Gothic A1)이 body로 쓰이고, Black Han Sans·Do Hyeon은 heading 전용이다.

### 3.7.4 font-family 스택과 폴백

```
heading: "tf-<heading라틴>"(있으면), "tf-<heading한글>", "tf-fb-<heading 분류>", <generic>
body:    "tf-<body>", "tf-fb-<body 분류>", <generic>
mono:    "tf-<mono>", ui-monospace, monospace
tf-fb-sans  = @font-face { src: local("Apple SD Gothic Neo"), local("Malgun Gothic"), local("Noto Sans KR"); size-adjust: 100%; ascent-override: 88%; descent-override: 22%; }
tf-fb-serif = @font-face { src: local("AppleMyungjo"), local("Batang"), local("Noto Serif KR"); size-adjust: 100%; ascent-override: 88%; descent-override: 22%; }
generic: sans-serif | serif
```
- `font-synthesis: none`(가짜 굵게·기울임 금지). 한글에 italic을 쓰지 않는다(강조 = emphasis 웨이트 또는 `color.fg` + 밑줄).
- 폼 입력처럼 사용자가 새 글자를 입력하는 요소는 body 서체 스택을 쓰되, 서브셋 밖 글자는 `tf-fb-*`로 표시된다(허용).

### 3.7.5 서브셋과 로딩 예산

| 항목 | 규칙 |
|---|---|
| 원본 보관 | `registry.json.files[].subset = 'full'`(빌드 원천, 서빙 금지), `'latin'`(라틴 서체 Basic Latin + Latin-1 + 일반 문장부호) |
| 페이지 서브셋 | 컴파일러가 시안마다 사용 글자 집합(확정 트리 텍스트 + ASCII 95자 + 한글 문장부호 「·…–“”‘’」)으로 woff2 서브셋을 생성한다(`subset = 'page'`, D-0308) |
| `subset` enum | `'full' \| 'ks-x-1001' \| 'latin' \| 'page'`(03·09장 같은 값, S-40) |
| 맥락별 서브셋(S-40, 이 표가 원천) | ① 생성 렌더·공유·결과 미리보기: `page`. ② 편집 미리보기(S09)·후보 카드: 패밀리·웨이트별 `ks-x-1001` 정적 서브셋(완성형 2,350자 + ASCII + 문장부호, 빌드 시 1회 생성, 해시 파일명 immutable) + `unicode-range`로 나눈 `page` 보충 파일 1개(서브셋 밖 글자만, 디바운스 1초 뒤 갱신). ③ 내보내기: `page` 기본 + `fonts/extended/`에 `ks-x-1001`, 두 번째 `@font-face`를 `unicode-range: U+AC00-D7A3`로 선언(04장 4.16.1, E-15) |
| 측정 | 편집 측정용 iframe은 `document.fonts.ready` 이후 `slotRects`를 계산한다. 편집 반영 p95(R-17)에서 폰트 첫 로드는 제외하고, 같은 서체 재사용 시에는 포함한다(01장 1.8.5) |
| 웨이트 수 | 시안당 로드 파일: heading 1 + body 2(400, emphasis) + mono 1(선택) + heading 라틴 1(선택) ≤ 5파일 |
| preload | heading 웨이트 1 + body 400 = 2파일(04장 CM-09) |
| `font-display` | `swap` |
| 예산 | 첫 화면(1280×800, 375×812) 폰트 전송 합 ≤ 300KB(D-27). 시안 전체 폰트 ≤ 450KB |
| CLS | 폴백 메트릭 오버라이드로 CLS ≤ 0.05 |
| 편집 후 | 카피가 바뀌면 다음 컴파일에서 서브셋을 다시 만든다(결정론, 같은 글자 집합 → 같은 해시) |

**AC-03-22** `registry.json`의 26종 모두 `license = 'OFL-1.1'`, `licenseUrl`, `verifiedAt`, `reservedFontName`이 채워져 있고 하나라도 비면 빌드가 실패한다.
**AC-03-23** 페어링 20쌍 × 허용 프리셋 전 조합에서 렌더 후 한글 텍스트 노드의 실제 사용 폰트(CDP `CSS.getPlatformFontsForNode`)가 지정 한글 서체이고 시스템 폴백이 0건이다(07장 TC-F-01).
**AC-03-24** 골든 세트 시안의 첫 화면 폰트 전송량 최댓값 ≤ 300KB, CLS ≤ 0.05(Playwright 네트워크·PerformanceObserver 측정).
**AC-03-25** 모든 페어링의 비 mono 패밀리 수 ≤ 2, heading 요소의 computed font-weight가 1종이다(정적 검사 + 렌더 검사).

---

## 3.8 한글 조판 규칙 [P0]

### 3.8.1 줄바꿈·정렬

| 규칙 | 값 | 검사 |
|---|---|---|
| 단어 단위 줄바꿈 | 모든 텍스트 `word-break: keep-all; overflow-wrap: anywhere;` | 04장 CM-07 |
| 헤드라인 균형 | h1~h4·display `text-wrap: balance` | CM-07 |
| 본문 | `text-wrap: pretty` | CM-07 |
| 언어 | `<html lang="ko">`, 라틴 문장은 쓰지 않음(04장 CP-08) | 컴파일러 |
| 본문 정렬 | 왼쪽 정렬만. 양쪽 정렬(justify) 금지. 가운데 정렬 본문은 3줄 이하일 때만 | 블록 템플릿 |
| 본문 폭 | `type.measure` 36em(한글 34~38자), body 18px이면 34em | 토큰 |
| 헤드라인 줄 수 | 데스크톱 1280에서 ≤ 2줄, 375에서 ≤ 3줄. 초과 시 결정론 순서: ① 짧은 덱 옵션 교체 → ② 해당 role 단계 1단 하향(`t-display` → `t-1` → `t-2`, 최대 1회, `spec.render_adjustments[]` 기록, H6 위반 아님) → ③ warn(S-39) | 렌더 측정 |
| 고아 글자 | 헤드라인 마지막 줄이 1~2글자면 위반(덱 옵션 교체) | 렌더 측정 |
| 하이픈 | `hyphens: manual` | — |

### 3.8.2 자간(letter-spacing, em)

| 글자 크기 | 고딕·display 계열 | 명조(serif) 계열 | 라틴 heading |
|---|---|---|---|
| < 24px(본문·라벨) | 0 | 0 | 0 |
| 24~31px | −0.01 | −0.005 | 0 |
| 32~47px | −0.02 | −0.01 | −0.01 |
| 48~71px | −0.03 | −0.015 | −0.015 |
| ≥ 72px | −0.04 | −0.02 | −0.02 |
| 라틴 대문자 라벨(eyebrow 등) | +0.06(SIG-09 +0.08) | 〃 | 〃 |
| 한글 라벨(SIG-09) | +0.02 | 〃 | — |

크기는 해당 뷰포트의 계산값 기준이므로 clamp로 크기가 바뀌면 자간도 단계별로 바뀐다(컴파일러가 브레이크포인트별 값 출력).

### 3.8.3 행간

본문 `type.body_leading`(1.6~1.8), 제목 3.1.5 크기별 값(1.1~1.35), 버튼·태그 1.2, 캡션 1.5. 한 블록 안에서 한글·라틴이 섞인 heading은 한글 서체 메트릭 기준 행간을 쓴다.

### 3.8.4 숫자·기호 표기

| 대상 | 규칙 |
|---|---|
| 가격 | `12,000원`, `월 9,900원`. 천 단위 쉼표, `font-variant-numeric: tabular-nums` |
| 수치(Stat) | 숫자와 단위 사이 공백 없음(`3분`, `120개`). `tabular-nums` |
| 범위 | 시간·가격 범위는 en dash, 앞뒤 공백 없음(`11:00–21:00`) |
| 날짜 | `2026. 11. 17.` 또는 `11월 17일`(블록 템플릿 고정) |
| 따옴표 | 인용 블록 “ ”, 내부 ‘ ’ |
| 가운데 점 | `·`(U+00B7) |
| 말줄임 | `…`(U+2026), 마침표 3개 금지 |
| 전화번호 | `02-000-0000` 형식, `tel:` 링크 |
| 이모지 | 제목·버튼·태그·카드 제목 안 0개(AIL-10) |

**줄 예산 함수(S-39, UI2-03)**: `headlineBudget(presetTokens, variant, viewport) → maxChars = floor(textWidth / (size × 0.95)) × maxLines × 0.85`. 0.95 = 한글 평균 글자 폭 계수, 0.85 = keep-all 손실 계수(골든 세트로 보정, 변경 시 결정 기록). `textWidth`는 variant 메타 `text_cols`(`blocks.json`, 예: split 6/12, type-only 10/12, centered 8/12)로 계산하고 1280과 375 중 작은 `maxChars`를 쓴다. 04장 카피 덱의 `hero.headline` 3옵션 중 ≥ 1개는 `maxChars` 이하여야 한다(G-01).

**AC-03-26** 골든 세트 렌더에서 고아 글자 헤드라인 0건, 375px 4줄 이상 헤드라인 0건, justify 0건(렌더 측정). 줄 넘침은 위 ① 또는 ②로 100% 해소되어 ③ 발생 0건이고, ② 비율(≤ 25%)을 기록한다(S-39).
**AC-03-27** 3.8.2 자간 표를 크기 경계값(23/24/31/32/47/48/71/72px) × 서체 분류 3종으로 검사하는 단위 테스트가 통과한다.

---

## 3.9 아이콘 [P0]

### 3.9.1 세트와 프리셋 매핑

| 세트 | 라이선스(출시 전 원문 확인) | 패키지 | 굵기 표현 | 매핑 유형 |
|---|---|---|---|---|
| Phosphor | MIT | `@phosphor-icons/core`(SVG) | weight: regular(≈1.5px@24) / bold(≈2.25px@24) | T1, T3, T6, T8 |
| Tabler | MIT | `@tabler/icons`(SVG) | `stroke-width` 1.5 / 2 | T2, T5, T7 |
| Iconoir | MIT | `iconoir`(SVG) | `stroke-width` 1.5 / 2 | T4 |

- 굵기: 04장 §4.9.3에 따라 radius family 연동(sharp·soft → 1.5, round·pill → 2). Phosphor는 1.5 → regular, 2 → bold.
- 한 시안: 세트 1종, 굵기 1종, 색 = `currentColor`(텍스트 색 상속). `data-icon-set` 속성 필수(08장).
- 크기: 16(인라인 라벨), 20(본문 옆·nav), 24(목록·연락처), 32(value.icon-grid 전용). 24px 그리드 기준.
- 사용 제한: 섹션당 ≤ 4개(value.icon-grid 3개, location·contact 연락처 행 ≤ 5개 예외). 장식용 원형 배경(아이콘 칩)은 T6만 허용. 이모지 아이콘 금지. 브랜드 로고 아이콘(SNS 등) 금지. Lucide는 쓰지 않는다(D-27 목록 밖).
- 의미 아이콘만 쓴다: 아이콘이 없어도 텍스트로 뜻이 전달되어야 하며 아이콘은 `aria-hidden="true"`.

### 3.9.2 의미 아이콘 40개 매핑 (`data/icons/map.json`)

| 의미 ID | Phosphor | Tabler | Iconoir |
|---|---|---|---|
| arrow-right | arrow-right | arrow-right | arrow-right |
| arrow-up-right | arrow-up-right | arrow-up-right | arrow-up-right |
| chevron-down | caret-down | chevron-down | nav-arrow-down |
| plus / minus | plus / minus | plus / minus | plus / minus |
| close | x | x | xmark |
| menu | list | menu-2 | menu |
| check | check | check | check |
| phone | phone | phone | phone |
| mail | envelope-simple | mail | mail |
| map-pin | map-pin | map-pin | map-pin |
| clock | clock | clock | clock |
| calendar | calendar-blank | calendar | calendar |
| chat | chat-circle | message-circle | chat-bubble |
| globe | globe-simple | world | globe |
| lock | lock-simple | lock | lock |
| shield-check | shield-check | shield-check | shield-check |
| bolt | lightning | bolt | flash |
| chart | chart-line-up | chart-line | graph-up |
| users | users-three | users | group |
| settings | gear-six | settings | settings |
| code | code | code | code |
| download | download-simple | download | download |
| coffee | coffee | coffee | coffee-cup |
| utensils | fork-knife | tools-kitchen-2 | cutlery† |
| store | storefront | building-store | shop |
| camera | camera | camera | camera |
| brush | paint-brush | brush | design-pencil† |
| leaf | leaf | leaf | leaf |
| package | package | package | package |
| truck | truck | truck | delivery-truck |
| card | credit-card | credit-card | credit-card |
| heart | heart | heart | heart |
| quote | quotes | quote | quote |
| image | image | photo | media-image |
| link | link-simple | link | link |
| warning-circle | warning-circle | alert-circle | warning-circle |
| info | info | info-circle | info-circle |
| car(주차) | car | car | car |
| wifi | wifi-high | wifi | wifi |

† 표시는 설치 버전에서 이름 확인이 필요한 항목이다. 빌드 스크립트가 40개 × 3세트 = 120개 이름을 패키지에서 해석하고, 하나라도 실패하면 빌드가 실패한다. 대체 이름은 `map.json`에 기록한다.

**AC-03-28** 120개 아이콘 이름이 모두 해석되어 인라인 SVG로 변환된다. 한 시안 DOM의 모든 `svg[data-icon-set]`이 같은 세트·같은 stroke(또는 weight)이다.
**AC-03-29** 이모지(Unicode `Emoji_Presentation`)가 버튼·태그·카드 제목에 0건, 섹션당 아이콘 수 상한 위반 0건(골든 세트).

---

## 3.10 이미지 팩 [P0]

### 3.10.1 원칙

- 소스: CC0 1.0 또는 Unsplash License 이미지만, 운영자가 수동 다운로드해 자체 저장소에 둔다(D-27, 08장 8.4.3). 핫링크·스톡 API·AI 생성 이미지 MVP 제외. 사용자 업로드 MVP 제외(D-0803).
- Unsplash License의 "유사·경쟁 서비스 구성 금지" 조항과 이미지 팩·zip 동봉의 관계는 **출시 전 원문 확인**(08장 Q8).
- 등록 제외(08장 8.4.4와 동일): 식별 가능한 얼굴(정면·측면, 얼굴 면적 ≥ 이미지의 2%), 판독 가능한 상표·로고·간판, 실제 브랜드 매장 식별 가능, 미성년자, 의료·사고 장면, 이미지 속 글자(간판·메뉴판 판독 가능), 화면에 실제 UI·로고가 보이는 기기.

### 3.10.2 수량·카테고리 (총 192건 = 사진 180 + 질감 12)

| 태그(`ImageTag`) | 장수 | 장면 설명 | 용도 |
|---|---|---|---|
| saas.workspace | 10 | 책상·작업 공간(화면 내용 없음) | saas |
| saas.hands-device | 8 | 기기를 든 손, 화면 꺼짐 또는 흐림 | saas |
| saas.architecture | 10 | 현대 건축·구조 | saas |
| saas.material | 10 | 종이·콘크리트·유리 근접 | saas |
| saas.meeting-back | 10 | 회의 장면 뒷모습·원경 | saas |
| portfolio.studio | 10 | 작업실 | portfolio |
| portfolio.tools | 10 | 도구·재료 | portfolio |
| portfolio.still-life | 10 | 정물 | portfolio |
| portfolio.interior | 10 | 실내 공간 | portfolio |
| portfolio.nature | 8 | 자연 질감·풍경 | portfolio |
| local_business.cafe-interior | 12 | 카페 내부(간판 없음) | local_business |
| local_business.coffee | 12 | 커피·음료 | local_business |
| local_business.bakery | 10 | 빵·디저트 | local_business |
| local_business.food | 12 | 한식·양식 플레이팅 | local_business |
| local_business.restaurant-interior | 10 | 식당 내부 | local_business |
| local_business.craft | 10 | 공방 작업(손·도구) | local_business |
| local_business.flower | 8 | 꽃·식물 | local_business |
| local_business.storefront | 10 | 상점 외관(간판 판독 불가) | local_business |
| common.texture-paper / -concrete / -fabric | 4 / 4 / 4 | 질감 배경(shape-graphic·glass 배경) | 공통 |

카테고리 내 분포 기준: 톤 태그(`tone.warm` / `tone.neutral` / `tone.cool`) 각 ≥ 30%(질감 제외), 방향(`orient.landscape` ≥ 40%, `orient.portrait` ≥ 30%), 비율 크롭 가능성(focal point 기준 5개 비율 중 ≥ 3개 크롭 가능).

### 3.10.3 파일·메타데이터 사양

| 항목 | 값 |
|---|---|
| 원본 | 장변 ≥ 2400px 권장, 최소 1600px(09장 B8), JPEG/PNG 원본 비공개 보관 |
| 파생 | WebP q80, 폭 640 / 960 / 1280 / 1920 / 2560(원본 이하만). 첫 화면 이미지 1280 폭 ≤ 250KB. duotone 파생은 팔레트별 빌드 시 생성 |
| `srcset` | 슬롯 표시 폭 기준 1x·2x 2단계(04장 CM-10) |
| 메타(09장 `ImageEntry` + 확장) | `id`(`img:<tag>-<nnn>`), `tags[]`(ImageTag 1개 + tone + orient), `focalPoint`, `dominantColor`(hex) + `dominantOKLCH`, `altKo`(10~60자, 장면 묘사, "사진" 단어 제외), `source`, `sourceUrl`, `author`, `license`, `licenseUrl`, `downloadedAt`, `hasPeople`(뒷모습·원경만 true 허용), `hasRecognizableFace: false`, `hasLogoOrTrademark: false` |
| 톤 일치 | 한 시안의 사진은 같은 `tone` 태그 우선 선택, 반대 톤 제외(04장 §4.9.4 `tonePref`, D-0309 → S-34로 반영). warm↔cool 혼용 금지 |

### 3.10.4 이미지 처리

`media.treatment`(3.1.11)는 시안 안 모든 사진에 같은 처리를 적용한다. 이미지 위 텍스트는 04장 G-02(5퍼센타일 휘도) 기준이며 오버레이 α 0.35~0.60. 0.60에서도 미달이면 `fallback_variant`로 바꾼다.

### 3.10.5 플레이스홀더 규칙

| 상황 | 처리 |
|---|---|
| 슬롯 태그 후보 0개 | 04장 §4.9.4에 따라 `fallback_variant`로 치환. 치환 대상이 없을 때만 플레이스홀더 |
| `media.mode = shape-graphic` | 사진 대신 색면 구성: surface 바탕 + primary(α 1)·accent(α 1)·surface-inverse 직사각형 2~3개를 12열 그리드에 맞춰 배치한 4가지 고정 구성(G1~G4) 중 `sha256(job_seed‖slot) mod 4` 선택. 원·블롭·그라디언트 금지 |
| 플레이스홀더 렌더 | surface 바탕 + 프리셋별 패턴: 사선 헤어라인(1px `border`, 12px 간격; T1·T2·T8), 점 격자(2px 점, 16px 간격; T3·T4·T6), 그리드 라인(24px; T5·T7) + 캡션 "<장면 한국어> 사진 · <비율>"(`fg-muted`, small) |
| 내보내기 | 캡션 제거, `<!-- placeholder: local_business.coffee 4:5 -->` 주석 + README "교체 필요 이미지" 목록 |
| 금지 | 회색 X 박스, 외부 플레이스홀더 서비스, 무작위 추상 블롭, 그라디언트, AI 생성 이미지 |
| 접근성 | 플레이스홀더·색면은 `role="img"` + `aria-label="<장면> 이미지 자리"`(미리보기), 내보내기에서는 `alt=""` |

**AC-03-30** manifest 192건 전부 필수 메타가 채워져 있고 `license ∈ {CC0-1.0, LicenseRef-Unsplash}`, `hasRecognizableFace = false`, `hasLogoOrTrademark = false`다. 카테고리별 장수가 3.10.2 표와 같다.
**AC-03-31** 렌더된 시안의 모든 `<img>` src가 이미지 팩 파생 파일 또는 플레이스홀더다(외부 요청 0건). local_business 용도 골든 시안 100%에 사진 또는 shape-graphic 구성이 있고 빈 이미지 슬롯은 0건이다.
**AC-03-32** 첫 화면 이미지 전송량 ≤ 250KB(1280 기준), CLS 기여 0(모든 img에 width·height).

---
## 3.11 반응형 브레이크포인트·그리드 [P0]

### 3.11.1 브레이크포인트

| 이름 | min-width | 컬럼 | 거터 | 바깥 여백 | 콘텐츠 폭 | 검증 뷰포트(D-25) |
|---|---|---|---|---|---|---|
| base | 0 | 4 | 16 | 20 | 100% − 40 | 375×812 |
| md | 768 | 8 | 24 | 32 | 100% − 64 | 768×1024 |
| lg | 1024 | 12 | 24 | 40 | 100% − 80 | 1024×768 |
| xl | 1280 | 12 | 32 | max(40, (100vw − container)/2) | `space.container` | 1280×800 |
| 2xl | 1536 | 12 | 32 | (100vw − container)/2 | `space.container` | 1920×1080 |

- Tailwind v4 `@theme`: `--breakpoint-md: 48rem; --breakpoint-lg: 64rem; --breakpoint-xl: 80rem; --breakpoint-2xl: 96rem;`(내보내기 theme.css). 컴파일러 CSS도 같은 값.
- 지원 하한 360px: 게이트 대상은 아니지만 골든 세트에서 360×780 가로 넘침을 경고로 기록한다.
- 풀블리드 섹션(배경·이미지)은 100vw, 콘텐츠는 컨테이너 안. 1920에서 hero.full-bleed-image 높이 상한 900px.

### 3.11.2 공통 반응형 규칙

| 항목 | 규칙 |
|---|---|
| 터치 타깃 | 인터랙티브 요소 ≥ 44×44px(375·768) |
| 입력 글자 크기 | ≥ 16px(iOS 확대 방지) |
| 본문 크기 | 모바일 ≥ 16px(3.1.5) |
| nav | 768 미만 drawer(C09), 768 이상 variant 그대로 |
| 섹션 여백 | 3.1.6 모바일 값 |
| display 상한 | 모바일 52px(= 375 × 14%), 04장 CM-08 |

### 3.11.3 skeleton별 모바일 변환(768 미만)

| skeleton / variant | 변환 |
|---|---|
| split(일반) | 세로 스택, 텍스트 → 이미지 순 |
| hero.split, story/about.split | 텍스트 → 이미지. 이미지 비율 4:5 → 4:5 유지, 1:1 유지 |
| hero.offset | 주 이미지만 표시(보조 1:1 이미지 숨김), 텍스트 → 이미지 |
| hero.full-bleed-image, cta.image | 이미지 비율 16:9·21:9 → 4:5로 재크롭(focal point), 텍스트 오버레이 유지 |
| grid(일반) | 1열 |
| gallery.*, menu.cards, highlight.trio | 2열(gallery.feature는 대 1 + 소 2×2) |
| stats.row | 2×2 |
| pricing.cards | 1열 스택, 강조 플랜 먼저 |
| faq.two-col, stats.split, location.info-map | 1열(제목 → 목록/지도) |
| feature.zigzag | 항목마다 텍스트 → 이미지, 교차 해제 |
| list, type | 1열 그대로, 모바일 타입 스케일 적용 |
| 768~1023 | 12열 기준 split은 6/6, grid 3~4열은 2열 |

**AC-03-33** 50 variant × 프리셋 8 × 검증 뷰포트 5에서 가로 넘침·잘림·겹침 0건(AC-03-18과 같은 실행), 375·768에서 터치 타깃 44px 미만 인터랙티브 요소 0건.
**AC-03-34** `theme.css`·컴파일러 CSS의 브레이크포인트 값이 3.11.1과 일치한다(정적 검사).

---

## 3.12 다크 테마 [P0 단일 테마 / P2 쌍 생성]

- MVP: 시안당 테마 1벌이며 프리셋이 정한다(D-25). 다크 프리셋은 T7 1종. `prefers-color-scheme` 자동 전환 없음. 라이트·다크 쌍 생성과 `[data-theme]` 토글은 **MVP 제외**([P2]).

| 항목 | 다크 테마 규칙 |
|---|---|
| bg | L 0.12~0.22, C ≤ 0.02. 순흑(L < 0.05) 금지 |
| fg | L 0.90~0.96. 순백 금지 |
| surface | L(bg) + 0.03~0.06 |
| 깊이 | 그림자 대신 surface 명도 상승(level 1 = +0.04, level 2 = +0.07). `subtle-shadow`·`layered-shadow`·`brutal-offset` 금지. `glass` 허용(테두리 fg α 0.16) |
| primary | L 0.70~0.88, C ≤ 0.18(형광 금지), on-primary = bg 계열 |
| inverse 섹션 | 0~1개(밝은 밴드) |
| 이미지 | 텍스트 오버레이 α 하한 0.45. grain(SIG-07) 금지 |
| 브랜드 컬러 | hue 유지, L을 0.70~0.88 범위로 옮긴 뒤 3.13 대비 보정 |
| 대비 | 3.1.3 하드 조건 동일 적용 |

[P2] 쌍 생성 규칙(기록만): 라이트 팔레트에서 bg L 0.17, surface +0.04, fg L 0.93, primary L를 0.78 기준으로 반전, accent C −10%, 대비 재검사 통과 팔레트만 노출.

**AC-03-35** T7의 4개 팔레트가 다크 규칙 표를 모두 만족하고 3.1.3 하드 대비를 통과한다. MVP 시안 TokenSet에 테마가 1벌만 있다(`color` 그룹 하위에 테마 분기 없음).

---

## 3.13 브랜드 컬러·로고 처리 [P0]

브랜드 컬러 입력 필드의 수집 여부·UI는 → 01장(08장 P4 "브랜드 컬러(선택)"). 이 절은 입력이 있을 때의 결정론적 처리 규칙이며 04장 §4.2.2 `applyBrandColor`와 같은 규칙이다(04장이 실행).

### 3.13.1 입력 정규화

- 최대 2개, 형식 `#RGB` 또는 `#RRGGBB`(대소문자 무시) → `#RRGGBB` 대문자. 그 외 형식은 거부(01장 입력 검증).
- OKLCH로 변환. C < 0.04인 색은 "무채 브랜드 색"으로 분류해 primary에 쓰지 않는다. 무채 브랜드 색은 `surface-inverse`의 L만 그 색의 L로 바꾸고(라이트 테마에서 L ≤ 0.35일 때만), 그 외에는 무시하며 사유를 기록한다.

### 3.13.2 첫 번째 색 → primary

```
h_b = hue(brand1)                           # 고정, 최종 오차 ≤ 5°
if hueDiff(h_b, hue(palette.primary)) ≥ 60° and type ∈ VIVID_FORBIDDEN and C(brand1) > 0.15:
    → accent로 강등(3.13.3), primary는 팔레트 값 유지
else:
    p = (L_b, C_b, h_b)
    on = palette.on-primary;  필요하면 on을 반대 극(라이트 ↔ 다크)으로 바꾼 경우와 비교해 대비가 큰 쪽 선택
    while contrast(on, p) < 4.5 or contrast(p, bg) < 3.0:   # L을 0.01씩, 대비가 커지는 방향으로, 최대 ±0.25
        L_b ± 0.01
    then while 미충족: C_b − 0.01 (≥ 0)
    색역 밖이면 C를 0.005씩 낮춤
    primary-hover/active는 3.1.3 공식으로 다시 파생
    ΔE_OK(원본, 결과) > 0.05 → brand_color_notice = "adjusted", 편집 화면 고지(→ 01장)

# 사전 가능성 판정과 종료 순서(S-37, UI2-01). 위 루프 전에 먼저 실행한다. 예외 없이 반드시 끝난다.
feasible_primary = 시작 L에서 ±0.25 경계 2점 중 하나라도 두 대비 조건을 만족(대비는 L에 단조)
if not feasible_primary:
    (a) accent 경로: accent는 괘선·장식 아이콘에만 쓰고 텍스트(라벨·링크)는 accentTextSafe일 때만 쓰므로(3.1.3, T-27) accent 대 bg 비텍스트 ≥ 3:1만 요구,
        on-accent 쓰임(배지 채움) 금지 → 성공하면 brand_color_notice = "demoted_to_accent"
    (b) 실패하면 tint 경로: surface 틴트(hue = h_b, C ≤ 0.035, 3.1.3 bg 조건 안) 또는
        shape-graphic 색면 1개에만 적용 → brand_color_notice = "used_as_tint"
    (c) 그것도 불가하면 반영하지 않음 → brand_color_notice = "ignored"
# 반복 상한: L 이동 ≤ 25 + C 감소 ≤ 15 + 색역 보정 ≤ 34 → 합계 ≤ 74. 상한 도달은 예외가 아니라 다음 분기로 넘어간다.
# brand_color_notice = null | adjusted | demoted_to_accent | used_as_tint | ignored  (01 카피·06 MockupCard·04 DesignSpec 같은 값)
VIVID_FORBIDDEN = {T1, T2, T3, T4, T7, T8}   # 허용 팔레트 중 vivid가 없는 유형(vivid = T5, T6)
다크 테마(T7): 시작 L을 clip(L_b, 0.70, 0.88)로 옮긴 뒤 같은 절차
```

### 3.13.3 두 번째 색·강등된 색 → accent

- accent는 primary와의 hue 차가 3.14.1 관계 범위(15~45°, 135~165°, 160~200°) 안일 때만 쓴다. 밖이면 무시하고 사유 기록.
- accent 대비: on-accent ≥ 4.5:1이 되도록 같은 L 보정. 면적 ≤ 10%(컴파일러가 accent를 CTA 보조·괘선·장식 아이콘에 사용하고, 링크·라벨 텍스트는 `accentTextSafe`일 때만 사용, T-27). 보정 후 `accentTextSafe`를 다시 파생한다.
- accent C > primary C × 1.3이면 accent C를 primary C × 1.3으로 낮춘다(04장 H3).

### 3.13.4 로고

- 로고 업로드는 **MVP 제외**(D-0803). 로고 자리는 Wordmark(C18): 브랜드명을 `font.heading`, heading 웨이트, nav = `t-lead` 단계(3.1.5a, 줄 예산 하향 규칙 04장 4.10.2)로 조판한다(T-28). 가짜 심볼·이니셜 마크 생성 금지.
- [P2] 로고 업로드 도입 시 규칙(기록만): SVG(새니타이즈)·PNG, ≤ 2MB, nav 표시 높이 24~40px, 최대 폭 160px, 로고 평균 휘도 대 nav 배경 대비 ≥ 3:1 미달 시 nav 배경을 surface/inverse 중 통과하는 쪽으로 전환, 로고 색 변경은 사용자 동의 시에만.

**AC-03-36** 브랜드 hex 24개(순흑·순백·형광 핑크 #FF00FF·형광 연두 #39FF14·저채도 회청·노랑 #FFFF00 등 극단값 + 밝은 색 픽스처 `#FFFF00`·`#FDFD96`·`#AAF0D1`·`#FFF5CC`, S-37 — 모든 결과가 primary 적용·accent 강등·`used_as_tint`·`ignored` 중 하나로 종료, 예외·타임아웃 0, 1회 호출 ≤ 5ms) × 8유형 = 160건에서 결과 TokenSet 100%가 3.1.3 하드 대비를 통과하고, 강등되지 않은 경우 primary hue 오차 ≤ 5°다(04장 AC-04-03과 같은 픽스처 사용).
**AC-03-37** 무채 브랜드 색 입력 시 primary가 바뀌지 않고 사유 코드 `brand_neutral_ignored` 또는 `brand_neutral_inverse`가 기록된다.

---

### 3.13.5 색 이름 `colorName(hex)` [P0] (01장 D-0111)

색각 이상 사용자용 "색 이름 함께 보기"(01장 S02)와 브랜드 컬러 입력 칩(01장 S06)에 쓴다. 순수 함수이고 `packages/taxonomy/colorName.ts`에 둔다(서버·브라우저 공용).

1. 입력 HEX를 OKLCH로 변환한다.
2. 무채색 판정: C < 0.03 이면 L로 이름을 정한다. L ≥ 0.95 흰색, 0.80~0.95 밝은 회색, 0.45~0.80 회색, 0.20~0.45 짙은 회색, < 0.20 검정.
3. 유채색: `config/color-names.ko.json`의 기본 색 사전(≥ 40개, 각 항목 `{name, h: [시작, 끝]}`, 예: 빨강 15~35, 주황 35~65, 노랑 80~105, 초록 125~165, 청록 165~200, 파랑 220~265, 남색 265~285, 보라 285~320, 분홍 330~360·0~15)에서 h 구간으로 기본 이름을 고른다. 갈색·베이지·카키·올리브처럼 h와 L·C를 함께 보는 이름은 사전 항목에 `l`·`c` 범위를 두고 우선 매칭한다.
4. 수식어: L ≥ 0.80 "밝은", L < 0.40 "짙은", C < 0.08 "탁한", C ≥ 0.20 "선명한". 수식어는 최대 1개이고, 우선순위는 명도 > 채도다.
5. 출력: `"짙은 남색"` 같은 한국어 문자열.

**AC-03-41** 사전 항목 40개 이상, 0~360° 전 구간이 빈틈없이 덮인다. 고정 샘플 60색(`fixtures/color-names.json`, 사람 라벨)에서 기본 이름 일치율 ≥ 85%. 같은 입력에 항상 같은 출력.

## 3.14 조화 규칙과 조화 점수 [P0]

조화 점수 H의 계산 실행·노출 게이트(H ≥ 80, D-23)·자동 보정은 04장이 맡는다. 이 절은 규칙 상수의 원천(`data/taxonomy/harmony.json`)이며, 04장 §4.10.3의 H1~H12·CF 표와 같은 값이다. 둘이 다르면 이 파일이 원천이고 04장 표는 이 파일에서 생성한 문서로 본다(D-0310).

### 3.14.1 색 규칙(OKLCH)

| 규칙 | 값 |
|---|---|
| 색 공간 | OKLCH. hue 차 = 원 위 최소 각도 |
| 브랜드 색 | C ≥ 0.04인 고유 색(ΔE_OK < 0.02 병합). neutral·상태색·사진 제외. 허용 ≤ 3(H1 만점) |
| primary↔accent 관계 | 유사 15~45°, 분할보색 135~165°, 보색 160~200°, accent 없음(단색). primary C < 0.04(무채 primary)이면 관계 검사 면제(만점) |
| 채도 균형 | accent C ≤ primary C × 1.3(primary C < 0.04이면 면제), bg C ≤ 0.03(tinted-light 팔레트 ≤ 0.035, 컬러 배경 팔레트 [P2] ≤ 0.08) |
| surface | \|ΔL(surface, bg)\| 0.02~0.06 (팔레트 빌드 검사) |
| accent 면적 | ≤ 10%(1280 전체 페이지 픽셀 기준, 04장 렌더 측정) |
| AA 우선 | 미적 선택과 대비가 충돌하면 대비가 이긴다(연회색 본문, neumorph 불가) |
| 금지 hue 조합 | 그라디언트 생성 경로 없음(MVP). 팔레트 안에 hue 270~310과 220~260 브랜드 색 동시 사용 금지(AIL-01 예방) |

### 3.14.2 타이포·형태·간격 규칙

display/body 2.5~8.0, 페이지 font-weight ≤ 3종, 비 mono 패밀리 ≤ 2, 모든 font-size ∈ 토큰 단계(±0.5px), 모든 spacing ∈ 4pt 스케일(3.1.6), 모든 radius ∈ family 집합(3.1.7), depth.style 1종, icon 세트·굵기 1종, 사진 처리 1종.

### 3.14.3 조화 점수 공식 (`harmony.json.items`, 04장 H1~H12와 동일)

```
H = Σ_{i=1..12} points_i          (0~100)
if 상충 위반 수 ≥ 1: H = min(H, 79)   # 노출 불가(H ≥ 80 조건)
```

| ID | 항목 | 배점 | 득점 규칙 |
|---|---|---|---|
| H1 | 브랜드 색 수 | 12 | ≤ 3: 12, 4: 4, ≥ 5: 0 |
| H2 | 색 관계 | 10 | 범위 안(또는 단색·무채 primary) 10, 밖 0 |
| H3 | 채도 균형 | 5 | 조건 2개 각 2.5 |
| H4 | 폰트 패밀리(mono 제외) | 8 | ≤ 2: 8, 3 이상: 0 |
| H5 | weight 종류 | 5 | ≤ 3: 5, 4: 2, ≥ 5: 0 |
| H6 | 타입 스케일 준수 | 10 | ≥ 95%: 10, 90~95%: 5, < 90%: 0 |
| H7 | display/body 비(1280) | 8 | 2.5~8.0: 8, 밖: 0 |
| H8 | 간격 준수(4pt) | 10 | ≥ 95%: 10, 90~95%: 5, < 90%: 0 |
| H9 | radius 계열 | 8 | 100%: 8, ≥ 95%: 4, 미만 0 |
| H10 | 상충 조합 | 10 | 0건: 10, ≥ 1건: 0 + 상한 79 |
| H11 | 장식 예산 | 6 | `decor` 수 ≤ `decor.max`: 6, 초과 1개당 −3 |
| H12 | 리듬 | 8 | LT-05~08 위반 1건당 −2(최소 0). RH-01·RH-02 포함 제안(D-0307) |

### 3.14.4 상충 조합 목록 (`harmony.json.conflicts`)

| ID | 조합 | 예방 위치 |
|---|---|---|
| CF-01 | glass + 뒤 배경이 단색 | 컴파일러: glass는 이미지·색면 위 요소에만 |
| CF-02 | brutal-offset + subtle/layered 그림자 혼용 | depth.style 1종 |
| CF-03 | sharp family + pill 버튼 | `buttonPill`은 round·pill만 |
| CF-04 | `contrastSerif` 페어링(FP02, FP06, FP20) + 기하 고딕 본문 + round/pill family | 허용 집합에서 제외: contrastSerif 페어링을 허용하는 유형은 T1·T4·T8이며 T1·T8은 round/pill 불허, T4의 FP06은 본문이 serif(Hahmlet)라 해당 없음 |
| CF-05 | grain + glass | SIG-07 충돌 규칙 |
| CF-06 | 다크 bg + 순흑(L < 0.05) 그림자 | 3.12(다크에서 그림자 없음) |
| CF-07 | 보라→파랑 그라디언트 | 그라디언트 생성 경로 없음 |
| CF-08 | duotone + vivid 팔레트 | SIG-10 요구 조건 |
| CF-09 | 장식 효과 3종 이상 | decor.max ≤ 2 |
| CF-10(추가) | 다크 테마 + brutal-offset | 3.12 |
| CF-11(추가) | SIG-06 마키 + `motion.level = none` | SIG-06 요구 조건 |
| CF-12(추가) | hero.centered + eyebrow Tag("New/신규/출시/✨/Introducing" 포함) | 04장 AIL-04와 동일 판정 |

CF-10~12는 04장 `config/conflicts.json`에 추가를 제안한다(D-0310).

### 3.14.5 입력·출력 인터페이스

```ts
// packages/scoring(04장)이 호출, 상수는 data/taxonomy/harmony.json
interface HarmonyInput {
  spec: DesignSpec;                       // l2, tokens, signature, decor
  tree: LayoutTree;                       // 확정 트리(리듬·블록 메타)
  render: {                               // 1280 렌더 측정(04장 §4.10.1)
    brandColors: OKLCH[]; accentAreaRatio: number;
    fontFamilies: string[]; fontWeights: number[];
    fontSizes: number[]; spacings: number[]; radii: number[];
    displayPx: number; bodyPx: number; decorEffects: DecorId[];
  };
}
interface HarmonyResult { score: number; items: {id: string; points: number; max: number; measured: unknown}[]; conflicts: string[]; capped: boolean; }
```

**AC-03-38** `harmony.json`의 H1~H12 배점 합이 100이고, 04장 문서 표와 생성 스크립트 비교 결과 차이 0건이다.
**AC-03-39** 표준 트리 24개(AC-03-20)의 H = 100, 상충 0건. 각 CF-01~12에 위반 픽스처 1개 이상이 있고 그 픽스처의 H ≤ 79다.
**AC-03-40** 골든 세트 30건 사람 라벨(좋음/나쁨)과 "H ≥ 80 ↔ 좋음" 일치율 ≥ 80%(07장 7.8.7 P-6 운영자 라벨 검증에서 측정, 비공개 베타 게이트 G7a).

---

## 3.15 수용 기준 요약

| 범주 | AC |
|---|---|
| 파일·스키마 | AC-03-01, 06 |
| 토큰 | AC-03-02~05 |
| 택소노미·매핑 | AC-03-07~11 |
| 프리셋 | AC-03-12~14 |
| 컴포넌트 | AC-03-15~17 |
| 블록 | AC-03-18~21 |
| 서체·조판 | AC-03-22~27 |
| 아이콘·이미지 | AC-03-28~32 |
| 반응형·다크 | AC-03-33~35 |
| 브랜드 | AC-03-36~37 |
| 조화 | AC-03-38~40 |

AC-03-01~39는 L1 결정론 테스트 또는 렌더 테스트로 매 PR에서 실행한다(07장 7.1 L1·시각 회귀). AC-03-40은 비공개 베타 전 평가(G7a)에서 1회 측정한다.

---

## 3.16 추가 결정

| ID | 결정 | 근거 | 영향 장 |
|---|---|---|---|
| D-0301 | ~~유형·프리셋 ID와 중심 벡터 소유~~ → R-04로 대체(유형 ID `T1`~`T8`+slug·이름은 02장, 중심 벡터는 3.4.7) | — | — |
| D-0302 | `predictL1`(L2 → 의도 L1, 3.2.2)은 `packages/taxonomy`에 두고 04장 J·05장 `anchor_l1`이 공유한다. 05장 측정 `toL1`과는 별개 함수이며 차이는 05장 5.9로 관리 | 04장 "03장 L2→L1 가중치표" 요구 | 04, 05 |
| D-0303 | 그라디언트(배경·텍스트)·블롭·네온 글로우·커스텀 커서·패럴랙스는 MVP에서 생성 경로가 없다(장식 효과 목록에서 제외) | AI 티 억제, CF-07 원천 차단 | 04 |
| D-0304 | 폰트 서브셋 파일의 패밀리 이름은 항상 `tf-<fontId>`로 바꾼다(RFN 유무 무관) | OFL 수정본 규정 안전측 | 08 |
| D-0305 | 카피 덱에 블록 제목 키 `<block>.title`(1개, 4~20자) 추가를 제안. 채택 전에는 `default_heading_ko` 고정 제목 사용 | 섹션마다 h2 필요(04장 CM-06) | 04 |
| D-0306 | `purposes.json`에 `requiredAny`(필수 중 택1, saas: value 또는 feature) 필드 추가, 04장 LT-01이 함께 검사 | 04장 패턴 PS-2·PS-3과 필수 블록 정합 | 04, 09 |
| D-0307 | 리듬 규칙 RH-01(같은 skeleton 3연속 금지)·RH-02(이미지 유무 4연속 금지)를 04장 H12 집계에 포함 | "같은 섹션 리듬" AI 티 | 04 |
| D-0308 | `registry.json.files[].subset`에 `'page'`(시안별 사용 글자 서브셋, 런타임 생성) 추가. 서빙은 page 서브셋만 | 첫 화면 300KB 예산 | 06, 09 |
| D-0309 | 이미지 선택 후보집합에 `tone` 필터(시안 첫 사진의 tone과 같은 태그 우선) 추가. **반영**(S-34, 04장 4.9.4 `tonePref`) | 사진 톤 일관성 | 04 |
| D-0310 | 조화 규칙 상수 원천 = `data/taxonomy/harmony.json`. 상충 조합 CF-10~12 추가 | 04장 표와 단일 원천화 | 04 |
| D-0311 | Rating(별점)·사진 Avatar·지도 임베드·실제 로고 클라우드는 MVP 컴포넌트에서 제외 | 가상 평점·얼굴·상표 위험 | 01, 08 |
| D-0312 | 가격 표기는 `12,000원` 형식(₩ 기호 미사용) | 국내 랜딩 관행, 한글 조판 일관 | 04 |

---

## 3.17 다른 장과 맞춰야 할 인터페이스

| 이름 | 형식 | 상대 장 | 비고 |
|---|---|---|---|
| L2 키·값 enum | `taxonomy.json` 18키(3.2.1) | 04(`DesignSpec.l2`), 05(라벨 l2), 09(`L2Key`) | 18키(R-27) |
| `mapL1toL2(t, typeId, purpose)` | 3.3.2 | 04 | 출력 = 스냅 전 l2_0 |
| `predictL1(l2, palette)` | 3.2.2 | 04(J), 05(anchor_l1) | D-0302 |
| `deriveTokens(l2, theme, brand_c) → TokenSet` | 3.1 | 04(G-12) | `--tf-*` 출력 |
| TokenSet JSON Schema | `data/tokens/schema.json` | 04, 내보내기 | DTCG 2025.10 |
| Preset | 3.4.1 `interface Preset` | 09(B3), 02, 04 | `slug`, `palettes`, `preferredPatterns`, `heroVariants`, `buttonPill`, `provenance` 필드 추가. `l1`은 R-01 키 객체 |
| 유형 ID·중심 벡터 | `T1~T8`(+02장 slug), 3.4.7(R-01 키) | 02, 04, 05, 07, 09 | R-04 |
| 팔레트 | `PAL-T{n}-{0..3}`, `palettes.json` | 04(`color.palette_id`) | |
| 블록 카탈로그 | `blocks.json`(`BlockDef`, `VariantDef`, `SlotDef`) | 04(layout-schema, 패턴, 컴파일러) | 블록 ID = 04장 패턴 이름 |
| 용도 | `purposes.json`: `required`, `requiredAny`, `optional`, `forbidden`, `sectionCount`, `standardHero`, `imageTags`, `forbiddenL2` | 04, 09(B4) | 용도 enum `saas`·`portfolio`·`local_business`(R-02) |
| 시그니처·장식 | `SIG-01~12`, `DecorId` 8종 | 04(`pickSignature`, H11, CM-11 SIG-06) | |
| 조화 상수 | `harmony.json`(H1~H12, CF-01~12, `defaultsBlacklist`) | 04 | D-0310 |
| 리듬 메타 | variant `align`, `skeleton`, `img` | 04(LT-05~08, RH-01~02) | |
| 서체 | `registry.json`(26), `pairings.json`(20: `headingFontId`, `headingLatinFontId?`, `bodyFontId`, `labelFontId?`, `headingWeights`, `emphasisWeight`, `sig`, `contrastSerif`, `allowedTypes`) | 07(TC-F-01), 08, 09(B6·B7) | 09장 `FontPairing`에 필드 추가 |
| 아이콘 | `data/icons/map.json` 40 × 3 | 04(§4.9.3), 08 | |
| 이미지 | `manifest.json` 192건, `ImageTag` enum 21종 | 04(§4.9.4), 08, 09(B8) | `altKo`, `tone`, `dominantOKLCH` 필드 추가. 192건·21종 = R-34. `local_business.*` 태그 |
| 설문 자극물 L2 | 앵커 = 프리셋 L2, 브리지 = `mapL1toL2(target, baseTypeId, null)`(3.4.8) | 02, 05, 09 | R-06, 채택은 실측 `x_card` |
| 표준 트리 | `standardTree(typeId, purpose) → LayoutTree` | 04(`buildFallback`), 07 | |
| 브랜드 컬러 | `applyBrandColor`(3.13) | 01(입력), 04(실행) | 04장 §4.2.2와 동일 규칙 |

---

## 3.18 반영 추적

| 리뷰 ID | 심각도 | 반영 절 | 비고 |
|---|---|---|---|
| UI-03 token 스키마 | Blocker | 3.1 전체 | DTCG, 색 역할·대비, 타입, spacing, radius, depth, border, motion |
| UI-04 컴포넌트 | Blocker | 3.5 | 18종, variant×state |
| UI-05 섹션 블록 | Blocker | 3.6 | 20블록 50 variant, 용도별 구성, 리듬. 트리 스키마는 04장 §4.5 |
| UI-06 폰트·라이선스 | Blocker | 3.7 | 한글 12·영문 14, 페어링 20, 서브셋·예산 |
| UI-07 조화 수치 | Major | 3.14, 3.1.5 | 1.25 고정 폐기, OKLCH 규칙, 점수 공식, 상충 목록 |
| UI-08 프리셋 | Major | 3.4 | 8종 전체 값, 허용 범위, 앵커 벡터 |
| UI-12 이미지 | Major | 3.10 | 업로드는 D-0803으로 MVP 제외 |
| UI-13 아이콘 | Major | 3.9 | Lucide 미사용(D-27) |
| UI-14 반응형 | Major | 3.11 | 검증 뷰포트 D-25 |
| UI-15 다크 모드 | Major | 3.12 | |
| UI-16 내보내기 | Major | 3.1.12(토큰 파일) | 패키지·코드 품질 기준 → 04장·06장 |
| UI-17 AI 티 린터 | Major | 3.1.13, 3.14.4 상수 | 규칙 판정 로직 → 04장 §4.13 |
| UI-18 브랜드 자산 | Major | 3.13 | 로고는 D-0803 |
| UI-20 시그니처 | Minor | 3.2.4 | |
| UI-21 DTCG | Minor | 3.1.2 | |
| UI-22 질감 성능 | Minor | 3.1.8(glass ≤ 2), 3.1.11(grain 타일) | |
| UI-24 카피 길이 | Minor | 3.5.4, 3.6.3, 3.8.1 | 길이 원천은 04장 카피 덱 |
| PD-02 택소노미 | Blocker | 3.2, 3.3 | neumorph·clay 제외, 1.25 고정 삭제 |
| PD-11 한글 타이포 | Major | 3.7, 3.8 | Pretendard 단독 조합 배제 |
| PD-14 산출물 형식 | Major | 3.1.12 | styleguide.html 등 패키지 → 04장 |
| PD-16 이미지·아이콘 | Major | 3.9, 3.10 | |
| PD-18 shadcn 기본값 | Major | 3.1.13, AC-03-14 | |
| decisions_v2 R-01 | — | 3.2.2, 3.4.1, 3.4.7 | L1 JSON 키 |
| decisions_v2 R-02 | — | 3.4.1, 3.6.5, 3.6.6, 3.10.2, 3.17 | `local_business` |
| decisions_v2 R-04 | — | 3.4.1, 3.4.7, 3.16 | 유형 이름·slug는 02장, 프리셋을 02장 유형 성격에 맞춰 재배치(T2·T3·T6 신규 설계, T4·T7·T8 재할당) |
| decisions_v2 R-06 | — | 3.4.8 | 카드 풀 48 = 16 × 3 |
| decisions_v2 R-27, R-30, R-34 | — | 3.2.1, 3.4.1, 3.10.2 | |
| QA-10 한글 폰트 대응 | Major | 3.7.3(한글 필수), 3.7.4(스택), AC-03-23 | |
| S-33(03) | — | 3.1.8 카드 그림자 단계, 3.4.1 `allowSoftRoundShadow`·`presets:lint-matrix`, FP15 Wanted Sans 800 | |
| S-34(03) | — | 3.10 톤 일치, D-0309 반영 | |
| S-35(03) | — | 3.1.12 styleguide.html | |
| S-37 | — | 3.13.2 사전 가능성 판정·종료 순서·notice 5값, AC-03-36 픽스처 | |
| S-38 | — | 3.1.5 단계 이름 t-*, 3.1.5a 텍스트 역할 표(B25), H7 정의, AC-03-42(옛 3.1.5a의 AC-03-38, T-10) | |
| S-39 | — | 3.8.1 넘침 처리 순서, headlineBudget, AC-03-26 | |
| S-40 | — | 3.7.5 subset enum·맥락별 서브셋·측정 규칙 | |
| T-27(UI3-01) | — | 3.1.3 accent 텍스트 조건·반전 면 매핑·`inverseButtonMode`·`accentTextSafe`, 3.13.2 (a)·3.13.3 라벨 조건, AC-03-20 G-02·03, AC-03-44 | 팔레트 값 불변 |
| T-28(UI3-02) | — | 3.1.5 `expectedSize`, 3.1.5a `nav.wordmark` = `t-lead`, C18·3.13.4, AC-03-45 | |
| T-29(UI3-03) | — | 3.1.5a 역할 17행 추가·`price` → `pricing.price`, AC-03-46 | B25 갱신 |
| T-10(QA3-07) | — | 3.1.5a AC-03-38 → AC-03-42(조화 쪽 AC-03-38 유지) | ID 정의 1건 |
