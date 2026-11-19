# 통합 결정 v6 (5라운드 잔여 충돌 해소) — decisions_v5.md 이하보다 우선

5라운드 리뷰(R-A B0·M0·m3, R-B B0·M4·m5, R-C B0·M0·m5)를 반영하기 전에 결정을 고정한다. Major는 R-B 4건뿐이다. 대체된 U-xx 문장에는 각 장에서 "→ V-xx로 대체"를 적는다. decisions_v5.md는 고치지 않는다.

- **읽는 법**: "채택: X 보완안"은 `docs/reviews/round5/r5_RB_tech.md`의 보완안·수용 기준을 원문대로 반영한다는 뜻이다. 표에 따로 적은 값이 원문과 다르면 표가 이긴다. 번호는 V-04가 최종이다.
- **기능 동결**: 새 기능·절 없음. 필드 1개(`trials[].cached`), AC 1개 분할(AC-09-19b)만 더한다.
- **완화 금지**: 합격선·상한(`JOB_COST_CAP_USD 0.30`, `maxTuningTrials 15`, `maxGateRuns 3`)은 그대로다. V-02는 기대값을 계산 결과에 맞추는 정정이고, V-04는 같은 판정을 마일스톤별로 나눈다.
- **Minor**: 기록만 한다. 예외는 V-01과 같은 문장인 RB5 m5("첫 토큰 전에" → "사건 t1 전에")와, V-02가 기대값을 판정하는 데 쓰는 AC-06-62 ③ 수치 RB5 m1(0.23674 → 0.23676) 두 개다.

| ID | 결정 | 고칠 장 |
|---|---|---|
| V-01 | **`cacheState` 판정 = "앞선 `gen_layout`이 t1 시점에 실패하지 않음"**(RB5-01, m5 포함). 채택: RB5-01 보완안. t1 = min(사건 t1, t0 + 3s). 후보 1~5의 `cacheState = cached` ⇔ 같은 잡 후보 0의 `gen_layout`이 t1 시점에 진행 중이거나 완료. 후보 0이 t1 전에 실패하면 `cache_write`. `cost:model`의 "예약 합계 ≤ capEff"는 이 규칙(기본 경로 = 후보 0 `cache_write` + 후보 1~5 `cached`, 합계 0.23676)으로 계산한다. 실제 청구가 추정과 다르면 기존 정산·`usage_overrun` 경로가 처리한다(추가 규칙 없음). 6.2.4 비고 "비스트리밍은 t0 + 3s에 출발". U-01 ③ 문장 → V-01로 대체. 수용 기준은 RB5-01 원문(`MOCK_LLM_LATENCY_MS=4000`)을 AC-06-61에 ④로 더한다. | 06, 09(9.6.2 Mock 지연 변수 1줄) |
| V-02 | **`usage_overrun` 기대 상태 = `succeeded`**(RB5-02, m1 포함). 채택: RB5-02 보완안. 6.9.4 ⑦ 표의 기대 상태를 `succeeded`(n_real 3, V-01/U-01 계산)로 고치고, 이 시나리오를 인용하는 6.17·07 TC-R 문구를 같은 값으로 맞춘다. AC-06-62 ③ 0.23674 → 0.23676. | 06, 07 |
| V-03 | **tuning-log 캐시 필드·AC-02-36 ③ 픽스처**(RB5-03). 채택: RB5-03 보완안 ①②. `trials[] += cached: boolean`. guard 8c는 `cached=false`인 dev 항목만 센다. 같은 구성에 gate를 다시 돌려도 gate 실행 1회로 센다(`maxGateRuns`에 포함). AC-02-36 ③ 픽스처 = "모든 좌표 dev 동률(현재 값 유지) + gate 항상 FAIL" → dev 11·gate 3·BLK `sim-limit`. ⑥ 픽스처 → gate 2·dev 15·`cached=true` ≥ 1. | 02, 07 |
| V-04 | **AC-09-19 분할**(RB5-04). 채택: RB5-04 보완안. AC-09-19(M4) = verify 부분(`pass_blocked`, `blocked`·`blockedBy`, `m4-done`, BLK 닫으면 fail, 재현 명령 없으면 fail). 신규 **AC-09-19b**(M8) = "같은 상태에서 `release:check` 종료 코드 3". 07 `acMilestones`에 AC-09-19b → M8. | 09, 07 |

## 반영 순서

한 단위는 30~45분이다. 단위가 끝나면 PROGRESS 체크박스·로그 1줄·커밋·푸시.

1. **06-a**: V-01 6.9.4 ①③⑥·6.2.4 비고·AC-06-61 ④, V-02 6.9.4 ⑦ 표·6.17·AC-06-62 ③
2. **07+02+09-a**: V-02 07 TC-R, V-03 02 2.16.2·AC-02-36 ③⑥·07 7.12.1 스키마·7.12.2 8c, V-04 09 AC-09-19/19b·07 `acMilestones`, V-01 09 9.6.2 지연 변수
3. **잔여 grep**: `첫 토큰 전에`, `0.23674`, `usage_overrun` 기대 상태 `partial`, `AC-09-19b` 정의 1건·배정 1건, `cached` 필드, `python3 tools/spec_index.py`

## 사람 확인 필요

- 없음.
