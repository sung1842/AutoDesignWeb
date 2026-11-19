# 취향핏(TasteFit) 최종 기획서 — 목차

디자인 성향 진단 결과와 사이트 용도를 합쳐 원페이지 랜딩 시안 3개를 자동 생성하는 서비스의 확정 기획서다.

- 기준: `review-pass` 커밋 4519c49(리뷰 6라운드, 8개 역할 C1·C2·C3 PASS). 장 파일은 그 시점 `docs/spec/v2/*.md`와 바이트 동일한 사본이다.
- 이 폴더는 spec 잠금 대상이다(09장 9.5.6). 구현 중 고치지 않는다. 틀렸다고 보이면 `BLOCKED.md`(locked-conflict).
- `spec:extract` 원천: `FINAL/07_quality.md`(07장 7.12.1, U-10).

## 우선순위 (충돌 시 위가 이긴다)
1. `CLAUDE.md` 구현 규칙의 금지 항목
2. [DECISIONS.md](DECISIONS.md) — 결정 레지스터 통합본(V > U > T > S > R > D)
3. 해당 영역 장(00~08)과 각 장 "추가 결정"(D-0xyy)
4. 09장(구현 계획)
5. `../DECISIONS_LOG.md` — 자율 세션 운영·환경 결정(AD-xx, append-only)

## 장
| 장 | 파일 | 단일 원천으로 소유하는 것 |
|---|---|---|
| 00 | [00_overview.md](00_overview.md) | 문제·타깃·지표·범위·로드맵·이벤트 레지스트리·용어집·한도 |
| 01 | [01_ux_screens.md](01_ux_screens.md) | 화면 S01~S15·route·상태·마이크로카피·BrandInput 스키마·서비스 UI 토큰 |
| 02 | [02_diagnosis.md](02_diagnosis.md) | 축 정의·진단 알고리즘·자극물 계획·유형 이름/설명·시뮬레이션 |
| 03 | [03_design_system.md](03_design_system.md) | 토큰 스키마·택소노미·프리셋·유형 중심 벡터·블록·서체·이미지·조화 규칙 |
| 04 | [04_generation.md](04_generation.md) | 디자인 명세서·레이아웃 트리·생성 파이프라인·하드 게이트·린터·편집·내보내기 |
| 05 | [05_reference_trend.md](05_reference_trend.md) | 레퍼런스 데이터·추출기·트렌드·시즌 |
| 06 | [06_architecture.md](06_architecture.md) | 아키텍처·DDL·API·오류 코드 카탈로그·models.yaml·보안·배포 |
| 07 | [07_quality.md](07_quality.md) | 테스트 전략·골든 세트·품질 지표·출시 게이트·thresholds/test-policy 원문 블록 |
| 08 | [08_legal.md](08_legal.md) | 법무·개인정보·보관 기간·원본 유사도 정책 |
| 09 | [09_implementation.md](09_implementation.md) | 레포 구조·데이터 묶음·마일스톤 M0~M8·에이전트 운영 규칙·마스터 프롬프트 |

## 찾는 법
- 절 제목 → 줄 번호: `../SECTION_INDEX.md`(v2 기준이지만 FINAL 장은 바이트 동일하므로 줄 번호도 같다).
- 마일스톤별 읽을 장: 09장 9.8.2 "3. 마일스톤별 읽을 장", AC→마일스톤 배정은 07장 7.12.1 "AC 배정표"(`spec:test-policy.acMilestones`).
- 용어집: 00장.

## 작성·리뷰 기록(구현 판정에 쓰지 않음)
- `../v2/`, `../decisions*.md`, `../../reviews/round1~6/`, `../rubric.md`
