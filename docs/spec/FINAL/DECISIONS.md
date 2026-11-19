# 결정 레지스터 통합본 (FINAL)

기준 커밋: `review-pass` = 4519c49 (P2 멈춤, 8역할 PASS). 원본 파일은 `docs/spec/decisions*.md`이며 이 파일은 그 내용을 우선순위 순으로 이어 붙인 사본이다(제목 단계만 한 단계 내렸고 본문은 그대로).

## 읽는 법
- 우선순위: 위에 있는 판이 아래 판을 대체한다(V > U > T > S > R > D). 장별 "추가 결정"(D-0xyy)은 해당 장 범위에서만 유효하고, 자율 세션 결정 AD-xx는 `docs/spec/DECISIONS_LOG.md`에 있다.
- 모든 결정은 FINAL 장 파일에 이미 반영됐다. 구현 판정은 장 본문(특히 수용 기준 AC)을 따른다. 장 본문과 아래 결정이 어긋나 보이면 고치지 말고 `BLOCKED.md`에 `locked-conflict`로 적는다(09장 9.5.3).
- "채택: X 보완안"의 원문은 `docs/reviews/round<N>/` 리뷰 파일에 있다.

## 목차
- [decisions_v6.md](#src-decisions-v6) — V-01~V-04
- [decisions_v5.md](#src-decisions-v5) — U-01~U-13
- [decisions_v4.md](#src-decisions-v4) — T-01~T-36
- [decisions_v3.md](#src-decisions-v3) — S-01~S-41
- [decisions_v2.md](#src-decisions-v2) — R-01~R-38
- [decisions.md](#src-decisions) — D-01~D-51


---

<a id="src-decisions-v6"></a>
## 원본: `docs/spec/decisions_v6.md` (V-01~V-04)

## 통합 결정 v6 (5라운드 잔여 충돌 해소) — decisions_v5.md 이하보다 우선

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

### 반영 순서

한 단위는 30~45분이다. 단위가 끝나면 PROGRESS 체크박스·로그 1줄·커밋·푸시.

1. **06-a**: V-01 6.9.4 ①③⑥·6.2.4 비고·AC-06-61 ④, V-02 6.9.4 ⑦ 표·6.17·AC-06-62 ③
2. **07+02+09-a**: V-02 07 TC-R, V-03 02 2.16.2·AC-02-36 ③⑥·07 7.12.1 스키마·7.12.2 8c, V-04 09 AC-09-19/19b·07 `acMilestones`, V-01 09 9.6.2 지연 변수
3. **잔여 grep**: `첫 토큰 전에`, `0.23674`, `usage_overrun` 기대 상태 `partial`, `AC-09-19b` 정의 1건·배정 1건, `cached` 필드, `python3 tools/spec_index.py`

### 사람 확인 필요

- 없음.

---

<a id="src-decisions-v5"></a>
## 원본: `docs/spec/decisions_v5.md` (U-01~U-13)

## 통합 결정 v5 (4라운드 장 간 충돌 해소) — decisions_v4.md 이하보다 우선

4라운드 리뷰(R-A·R-B·R-C, Blocker 0, Major 13, Minor 22)를 반영하기 전에 결정을 고정한다. 대체된 T-xx 문장에는 각 장에서 "→ U-xx로 대체"를 적는다. decisions_v4.md 파일은 고치지 않는다.

- **읽는 법**: "채택: X 보완안"은 리뷰 파일(`docs/reviews/round4/`)의 보완안·수용 기준을 원문대로 반영한다는 뜻이다. 표에 따로 적은 값·키·경로·번호가 리뷰 원문과 다르면 표가 이긴다. 번호는 U-13이 최종이다.
- **기능 동결(CLAUDE.md 1.1)**: 새 화면·새 기능 없음. 모두 모순 해소·정의 보완이다. 새 컬럼·규칙 몇 개(U-01·U-06·U-07)는 이미 있는 기능의 상태 끝점을 닫는 데 필요한 최소분이다.
- **완화 금지**: 숫자 합격선은 하나도 바꾸지 않는다. 판정 정의가 바뀌는 곳은 U-02(분할), U-05(테스트 행 생성 방식), U-06(AC-08-57 ④)이고 근거를 각 행에 적었다. 모두 같은 기준을 실행 가능하게 하거나 더 엄격하게 한다.
- **Minor**: 기록만 하고 반영하지 않는다(1.1 수렴 규칙). 예외는 Major 수용 기준을 판정하는 데 꼭 필요한 RB4 m1(est 반올림)과 RC4-06 ⑤(미처리 증거, RC4-04와 같은 경로) 두 개다.

| ID | 결정 | 고칠 장 |
|---|---|---|
| U-01 | **캐시 예열 사건·`cacheState`·호출 시각**(RB4-01; m1 포함). 채택: RB4-01 보완안 1~4. ① 사건 **t1** = 스트리밍 공급자는 첫 토큰 수신, 비스트리밍(`generateObject`)과 Mock은 응답 완료. Mock은 완료 시 t1을 낸다. ② 정적 프리픽스 `cacheState` = 같은 잡에서 앞선 `gen_layout`이 t1에 도달했으면 `cached`, 아니면 `cache_write`. 6.9.4 ③의 "첫 cacheWrite 성공" 문장을 이것으로 대체한다. 그래서 후보 1~5의 est는 cached 값(0.02774)이고 예약 누적 최댓값 0.23674가 성립한다. ③ 순서 고정: Mock 카피 지연 = 후보 0 레이아웃 지연 + 1ms(카피 정산은 후보 0 t1 뒤). t1 사건 처리는 **그 호출 정산 → 후속 후보 예약** 순서다(완료 = t1인 공급자). `usage_overrun`의 기대 상태와 거부 호출 집합은 반영 단위가 이 순서와 6.9.4 식으로 계산해 6.9.4 표에 적는다(결과가 기존 기대 {partial, fallback}과 다르면 계산값을 쓰고 "U-01 계산" 주석; 판정 기준이 아니라 사건 정의에서 나오는 값이다). 같은 시드 2회 실행 시 거부 집합 동일(RB4-01 수용 기준). ④ `llm_calls += started_at timestamptz not null, first_token_at timestamptz null`(비스트리밍·Mock은 완료 시각). AC-06-56 ④·AC-06-61의 시각 기준을 이 두 컬럼으로 바꾼다. ⑤ est·비용은 **소수 5자리 반올림 후 합산**(m1). 0.23674는 그 규칙으로 다시 계산한 값으로 적는다(값이 바뀌면 06 표의 계산을 따르고 ±0.00002 허용은 그대로). | 06, 09 |
| U-02 | **AC-06-07 분할**(RB4-02). 채택: RB4-02 보완안. 근거(정의 변경): 한 AC가 M1·M5·M7 기능을 요구해 M1에서 영구 fail이 된다. 내용은 그대로 셋으로 나눈다. **AC-06-07** (M1) = `generation_jobs.cost_usd` CHECK `≥ 0`, 0.9 저장 성공, 음수 실패. **AC-06-07b** (M5) = 워커 정산 경로에서 0.30 초과 시 A11 1건 + 그 잡의 이후 `reserve` 전부 실패, DB 예외 0. **AC-06-07c** (M7) = 직접 UPDATE로 0.30 초과 시 다음 `alerts` 실행에서 A11 1건. 07 `acMilestones`에 07b → M5, 07c → M7(범위 항목 `AC-06-01~07`은 접미사 없는 07만). AC-07-23 ③ 사례는 `AC-06-03b`를 유지한다. 의존 검사는 문서 검사로만(9.4 범위 열 대조 스크립트는 새 기능이라 만들지 않는다). | 06, 07, 09 |
| U-03 | **탈퇴 순서 ③b → ③**(RC4-01). 채택: RC4-01 보완안. 6.2.5 순서 = `⑤ → ⑤b → ① → ② → ③b → ③ → ④ → ⑥ → ⑥b → ⑦`. ③에 "③b가 끝난 경로만 삭제". AC-08-57 += ⑥ "잡 로그에서 ③b 완료 < ③ 시작, ③b 직후 실패 주입 뒤 재시도해도 증거 sha256 = 원본". 08 8.7.9·8.9.5 순서 문장도 06에 맞춘다(RC4-06 ①은 같은 문장이라 함께 고친다). | 06, 08 |
| U-04 | **공통 렌더 삭제 함수**(RC4-02). 채택: RC4-02 보완안. `deleteOwnedRenders(uid, versionIds)` 하나를 `DELETE /api/projects/:id`의 즉시 잡·`account-delete` ③이 함께 쓴다. 함수는 먼저 ⑤b와 같은 조건(`impersonation`·`phishing`, status ∈ {open, hidden, actioned})의 신고가 가리키는 객체를 `abuse-evidence/<report_id>/`로 옮기고(③b 로직을 이 함수로 이동), 그다음 삭제한다. `renders_orphan`은 `reports.evidence.objectPaths`가 가리키는 hash를 제외한다. 6.6 `abuse-evidence` 쓰기 주체 = 이 함수 + `actioned`. 신규 **AC-08-58**(RC4-02 수용 기준). | 06, 08 |
| U-05 | **감사 로그 파기와 주입 시계**(RC4-03). 채택: RC4-03 보완안. 실행기 호출 = `purge_audit_logs(least($now, now()) − interval '1 year')`. DB 함수·트리거는 실시계 그대로(약화 없음). 근거(정의 변경): AC-06-54의 감사 로그 문장은 지금 만든 행을 미래 시계로 지우라는 뜻이 되어 트리거와 충돌한다. 문장을 "`created_at = now() − 400d`·`now() − 300d`로 넣은 행: 400일 행 0건, 300일 행 남음, `RETENTION_NOW=+31d`·`+366d` 두 실행 모두 `admin_audit_1y` 오류 0·종료 코드 0"으로 바꾼다(AC-08-56과 같은 방식). | 06, 08 |
| U-06 | **`abuse_holds` 수명주기**(RC4-04; RC4-06 ⑤ 포함). 채택: RC4-04 보완안. `PATCH /api/admin/reports/:id` 한 트랜잭션: `dismissed`이고 hold의 마지막 신고면 hold 삭제 + 그 `email_hash`로 재가입한 계정이 `status='gen_suspended' ∧ suspend_source='hold'`면 `active`. `actioned`면 `sanctions` upsert(`suspend_source='sanction'`) 후 hold 삭제. `users += suspend_source text null check in ('hold','sanction','admin')`. `provision_user`는 hold·sanction이 없고 `suspend_source='hold'`면 `active`로 복구. 미처리(open·hidden) 신고가 접수 후 90일을 넘으면 알림 **A12 `report_overdue`**(6.12.4 표 1행)를 내고 그동안 `until`·증거 보관을 연장한다(`abuse_holds_expired`·`abuse_evidence_90d`는 검토 종료 신고만 대상). 근거(정의 변경): AC-08-57 ④를 "`dismissed` 즉시 hold 0행, 재가입 계정 `active`, 생성 API 202 / 미처리 91일째 hold 1행 + A12 1건"으로 바꾼다(정당 이용자 제한을 없애는 쪽이고 남용 차단은 미처리 기간 내내 유지되므로 더 엄격). 기존 알림 번호가 A12를 이미 쓰면 다음 빈 번호. | 06, 08, 00 |
| U-07 | **미확인 권리 요청 보관 끝점**(RC4-05). 채택: RC4-05 보완안. 08 8.7.7 행 "미확인 `privacy_request`(`awaiting_verification`): 접수 후 7일, 삭제". 06 6.6 규칙 `rights_unverified_7d`(`status='awaiting_verification' and received_at < $now − 7 days` → DELETE). ADM-11 목록 기본 필터는 미확인 행 숨김. 신규 **AC-08-59**(RC4-05 수용 기준). | 08, 06 |
| U-08 | **튜닝 시도 계수·gate 상한**(RB4-03). 채택: RB4-03 보완안 1~4. 값(15·3)은 그대로. ① 같은 구성의 dev 결과는 캐시하고 다시 세지 않는다(2바퀴 시작점 0회, 1바퀴 = 11회). ② `maxTuningTrials`에 닿으면 남은 좌표는 현재 값으로 고정하고 그 구성으로 gate 1회(이것도 `maxGateRuns`에 센다). ③ 커밋되는 tuned = 항상 마지막 gate 대상 구성. ④ `maxGateRuns` = "gate 실행 수 상한". 02 2.16.2·07 7.12.1 설명·09 M4 ④의 "= 바퀴 수/바퀴 3회" 문구를 지운다. AC-02-36 += RB4-03 사례 ①②. | 02, 07, 09 |
| U-09 | **blockable fail과 verify 연결**(RB4-04). 채택: RB4-04 보완안 1~2. 9.4.1: verify 단계가 `spec:test-policy.blockable`에 있고 결과 `blockedBy`가 재현 명령 있는 open BLK를 가리키면 단계 상태 `blocked`, verify `result = pass_blocked`. `pass_blocked`는 직렬 원칙·`mN-done`·9.9.2 "녹색"에 포함하고 `release:check`는 3. BLK 유형 += `survey-items`(M4 ①), 9.5.3 표·9.9.2 허용 목록에 넣고 HALT 계산에서 뺀다(`sim-limit`과 같음). 07 7.11.2 종료 코드 3 설명에 `pass_blocked` 참조. 신규 **AC-09-19**(RB4-04 메타 테스트: 활성 카드 47장 → `pass_blocked`·`m4-done` 가능·release 3, BLK 닫으면 fail). | 09, 07 |
| U-10 | **`spec:extract` 원천 경로 맵**(RB4-05). 채택: RB4-05 보완안. 코드 상수 1개 = 맵 `{ "review-pass": "docs/spec/v2/07_quality.md", "*": "docs/spec/FINAL/07_quality.md" }`. AC-07-24·9.8.1·7.12.2 P2/P3 행 문장을 "코드 상수 1개(ref별 경로 맵)"로 고친다. AC-07-24 += RB4-05 수용 기준(임시 저장소 재현). | 07, 09 |
| U-11 | **`maxChars_job` 하한**(RA4-01). 채택: RA4-01 보완안. `t-display` hero는 넘침 처리 ②를 적용한 단계(`t-1`)로 `maxChars_job`을 계산, 식 끝 `floor`, `textWidth`의 1200 → `min(space.container, 1200)`. 04 4.6.2와 03 3.8.1 식이 같은 문장. AC-04-46 ① += "8 프리셋 × 허용 hero 전부 `maxChars_job ≥ 10`(정수)" 단위 테스트, 골든 T5·T8 G-01 덱 실패 템플릿 덱 0건. 반영 단위가 표를 계산해 10 미만 조합이 남으면 그 조합만 한 단계 더 내린다(`t-2`)고 적는다(헤드라인 최소 8자는 그대로). | 04, 03 |
| U-12 | **이미지 태그 폴백 = 용도 기본 태그**(RA4-02). 채택: RA4-02 보완안. 폴백 조건 = `industryTags ∩ purposeTags(p) = ∅`(업종 매칭 0 포함). 폴백 값 = `{defaultImageTag(p)} ∪ common.texture-*`. `purposes.json += defaultImageTag`: saas `saas.architecture`, portfolio `portfolio.studio`, local_business `local_business.storefront`(모두 03 이미지 태그 표에 있는 키). 03 3.6.5 필드 목록·04 4.2.1·4.9.4·07 TC-B-20이 같은 식. AC-04-44 ① += RA4-02 수용 기준. | 04, 03, 07 |
| U-13 | **신규 사용자 노출 오류의 화면 대응**(RA4-03). 채택: RA4-03 보완안 ①~④(새 화면 없음). verify 성공 302 → `S14 /support?verified=1`, 키 `support.verified`. verify 410 `VERIFY_LINK_INVALID` → S15, 문구 "확인 링크가 만료됐거나 이미 쓰였어요. 다시 요청해 주세요", 행동 [문의하기]. `SURVEY_ITEMS_INSUFFICIENT` 503 → S15, `INTERNAL`과 같은 문구. `JOB_ALREADY_FINISHED` 409 → 시트 닫고 상태 재폴링(표시 없음). 1.12.2 머리 "표에 없는 코드 = `INTERNAL` 행". 06 6.4.3 verify 302 대상을 S14 route로. 신규 **AC-01-60**(RA4-03 수용 기준: 06 6.4.2 사용자 경로 코드 100% 대응 정적 대조, verify 성공·410 E2E가 1.2 route에서 끝남). | 01, 06 |

### 반영 순서

한 단위는 30~45분이다. 각 단위가 끝나면 PROGRESS 체크박스·로그 1줄·커밋·푸시.

1. **06-a**: U-01 6.9.4 ①③⑦·`llm_calls` 컬럼·AC-06-56·61, U-02 AC-06-07/07b/07c·6.17 표
2. **06-b**: U-03 6.2.5 순서·③, U-04 `deleteOwnedRenders`·6.4.3 삭제·6.6 `renders_orphan`·쓰기 주체, U-05 6.6 호출·AC-06-54, U-06 PATCH·`suspend_source`·`provision_user`·6.12.4 A12, U-07 6.6 규칙, U-13 6.4.3 verify 302
3. **07-a**: U-02 `acMilestones`, U-08 7.12.1 설명, U-09 7.11.2 종료 코드 3, U-10 7.12.2·AC-07-24, U-12 TC-B-20
4. **09-a**: U-09 9.4.1·9.5.3·9.9.2·AC-09-19, U-10 9.5.6·9.8.1, U-08 M4 ④, U-01 9.6.2 Mock t1·카피 지연, U-02 M1/M5/M7 참조
5. **02-a**: U-08 2.16.2·AC-02-36
6. **04-a + 03-a**: U-11 4.6.2·3.8.1·AC-04-46, U-12 4.2.1·4.9.4·3.6.5·AC-04-44
7. **01-a**: U-13 1.2·1.12.2·AC-01-60
8. **08-a**: U-03 8.7.9·8.9.5·AC-08-57 ⑥, U-04 AC-08-58, U-05 AC-08-33/56 문장, U-06 AC-08-57 ④·8.7.7, U-07 8.7.7·AC-08-59; 00 ADM-04 1줄(U-06)
9. **잔여 grep**: `첫 cacheWrite 성공`, `바퀴 3회\|= 바퀴`, `코드 상수 1개 .docs/spec/FINAL`, `{storefront}`, `③ → ③b`, `maxChars_job` 식 2곳 동일, AC-06-07 정의 3건(07·07b·07c), 신규 AC ID 정의 각 1건, `python3 tools/spec_index.py`.

### 사람 확인 필요

- 없음(새 항목 없음). Q6(증거·hold 90일)·Q16(P14 90일)은 기존 HUMAN_TODO 그대로. U-06의 미처리 연장은 Q6 확인 시 함께 본다.

---

<a id="src-decisions-v4"></a>
## 원본: `docs/spec/decisions_v4.md` (T-01~T-36)

## 통합 결정 v4 (3라운드 장 간 충돌 해소) — decisions_v3.md·decisions_v2.md·decisions.md보다 우선

3라운드 리뷰(Blocker 3, Major 37)를 장별로 반영하기 전에 결정을 고정한다. 각 장 편집자는 아래와 다른 부분을 모두 고치고, 대체된 S-xx·R-xx 문장에는 "→ T-xx로 대체"를 적는다. decisions_v3.md 파일 자체는 고치지 않는다.

- **읽는 법**: "채택: X 보완안"은 해당 리뷰 파일의 보완안과 수용 기준을 원문 그대로 반영한다는 뜻이다. 표에 따로 적은 값·키·경로·번호가 리뷰 원문과 다르면 표가 이긴다. 번호는 T-36이 최종이다.
- **완화 금지**: 숫자 합격선은 하나도 낮추지 않았다. 판정 정의가 바뀌는 곳은 T-03, T-04, T-05, T-06, T-08, T-14, T-17, T-18, T-19, T-28 열 곳이다. 모두 "같은 기준을 실제로 실행할 수 있게 하거나 더 엄격하게 하는" 변경이고, 근거를 각 행에 적었다. 튜닝 상수를 잠금 파일 밖으로 옮기는 것(T-03)은 합격선·시드·β 등은 그대로 잠그고, 옮긴 상수도 닫힌 값 집합과 시도 상한으로 자체 잠근다.
- **실행 환경(2026-11-19 실측, v3와 같음)**: Docker 데몬 없음, chromium-1243만 있음(webkit·firefox 없음), PG16에 pgvector 없음, npm 접근 가능, 외부 키 없음(`LLM_MODE=mock`). 06 DDL은 shim 위 PG16에서 오류 0으로 적용됨(TL3 실측).

| ID | 결정 | 고칠 장 |
|---|---|---|
| T-01 | **결정 기록 파일의 잠금 예외**(QA3-01, Blocker). 채택: QA3-01 보완안 **2번(append-only 예외)**. 1번(경로 이동)은 고르지 않는다. 이유: 저장소 CLAUDE.md §1과 세션 규칙이 이미 `docs/spec/DECISIONS_LOG.md`를 가리키므로, 옮기면 경로가 둘이 되는 위험이 더 크다. 07 7.12.2 6단계의 예외는 닫힌 목록이고 이 파일 1개뿐이다(baseRef 내용이 HEAD 내용의 접두어). 기존 줄 수정·삭제는 FAIL. 9.5.7 경로 옆에 "append-only, 7.12.2 예외". 신규 AC-07-25(QA3-01 메타 테스트). | 07, 09 |
| T-02 | **spec 고정점 = 리뷰 통과본**(QA3-08). 채택: QA3-08 보완안 1~3. P2 멈춤 커밋에 `review-pass` 태그를 붙이고 07 두 블록의 SHA-256을 PROGRESS.md에 기록한다. `spec-lock` 직전 `spec:extract --from FINAL`과 `--from review-pass`가 바이트 단위로 같아야 하고(guard 6단계도 검사), 다르면 BLOCKED. 추출 원천은 코드 상수 1개 `docs/spec/FINAL/07_quality.md`, `docs/spec/v2/`는 기록용. 9.8.1의 `docs/spec/00~09*.md` → `docs/spec/FINAL/`. 09 F01·9.5.6 규칙 2·`locked-hashes` 예시는 `baseRef = human-lock ?? spec-lock`(둘 다 없으면 FAIL), `lockedBy` += `spec`, M0 산출물에 `spec:extract`·guard 5~7단계, AC-09-03에 사례 2개. 신규 AC-07-24. S-04 보완. | 07, 09 |
| T-03 | **진단 튜닝 상수 분리 + 결정론 탐색**(QA3-02, AI3-05). 채택: QA3-02 보완안 1~3 + AI3-05 보완안 1~5. 근거(정의 변경): 잠긴 파일 안의 값을 조정하라는 절차는 실행할 수 없어 완화나 우회를 부른다. 합격선·β·σ0·sigmaStop·문항 수·시드는 `diagnosis`(spec 잠금)에 남고, 2.16.2의 6좌표만 `diagnosis.tunable`(값 집합·초기값)로 두며 런타임 값은 `config/diagnosis-tuned.json`이다. 자체 잠금: 값 ∈ 닫힌 집합, `sim/reports/tuning-log.json` dev 시도 ≤ `maxTuningTrials`, `chore(sim-tune):` 단독 커밋, `engine_version`에 tuned 해시. 목적함수는 사전식(미달 수 → 정규화 부족분 합 → 현재 값 → 사전순), 시도 계수는 시작점 포함 11회. **gate는 ①~⑥ 한 바퀴 뒤에만** 돌고 PASS/FAIL만 쓴다(선택 함수는 dev 리포트만 받음). `maxGateRuns` 3 = 바퀴 3회. ⑥은 tuned `bridgeRelocated`. 신규 AC-02-36. S-08 ④ 보완. | 02, 07, 09 |
| T-04 | **골든 `answers`·`muRef` 생성 시점**(QA3-03). 채택: QA3-03 보완안 1~3. 근거(정의 변경): M1에는 엔진이 없어 생성할 수 없고, 튜닝 뒤에는 이른 muRef가 정상 변경을 회귀로 판정한다. M1 ② = 골격 32행(`answers`·`muRef` null) 스키마 유효. `build-answers`는 M4 종료 직전 1회(T-03 확정 후), `m4-done` 커밋에서 `data/golden/**` 자체 잠금. 7.2.2 재생성 조건 = "엔진 major **또는** tuned 변경", 사람 승인(`golden-muref-approval`), tuned와 muRef는 같은 커밋. M1a 기준은 그대로. 신규 AC-09-17. S-07 보완. | 07, 09, 02 |
| T-05 | **`release:check` 단계 카탈로그·종료 코드 3**(QA3-04). 채택: QA3-04 보완안 1~4. 근거(정의 변경): 종료 코드 2가 문서상 도달 불가였고, 단계 분해를 에이전트가 정하면 허용표를 우회할 수 있다. 07 7.11.2 카탈로그를 `spec:test-policy.steps`로 추출·잠금하고, 카탈로그 밖 단계나 누락은 1. 허용표 추가 단계는 T-36 목록(temp·manual·needs_ci). temp 조건 열에 묶음을 적는다(`extractor-roundtrip` = B18). "9.8" → "9.2". **종료 코드 3** = 모든 fail이 `blockable`(`sim-diagnosis-gate`, `survey-items-count`, `locked-conflict` 대상) ∧ open BLK를 `blockedBy`로 가리킴 ∧ 재현 명령 있음. 3은 출시 불가, 9.9.2 완료 = 0·2·3. 신규 AC-07-21. S-03 보완. | 07, 09 |
| T-06 | **추출기 temp 상태 분류**(AI3-01). 채택: AI3-01 보완안 1~4. 근거(정의 변경): 0.10 판정은 그대로 하고 결과 상태만 정한다. 단계 `extractor-roundtrip`은 B18 temp일 때만 실패 축이 `temp`이고, reliable 축 < `reliableAxesMin`(3)이면 fail. human 정규화기는 기존대로 fail(05 5.9 앵커 행에 "(human 정규화기)"). **M4 ①은 완화하지 않는다**: 미달이면 fail + BLK, M5 이후 계속(`survey-items-count`, blockable). 02 2.6.1 후보 0이면 503 `SURVEY_ITEMS_INSUFFICIENT`(빌드에서 사전 검출). 신규 AC-02-37. S-09 보완. | 05, 09, 07, 02, 06 |
| T-07 | **시뮬레이션 자극물 = 배포 x_card**(AI3-03). 채택: AI3-03 보완안 1~3. 2.16.1 자극물 행은 "active x_card만(provenance 무관)". `--synthetic`(target_l1 + 잡음)은 M4 이전 단위 테스트 전용, `verdict:"n/a"`, `--synthetic --gate`는 종료 코드 1. 비차단 행 **V-MEAS**(지각 = target_l1, 갱신 = x_card) 추가. 같은 비차단 표에 AI2-06의 V-LAMBDA·V-POS·V-MIX를 함께 넣는다. 리포트에 `stimulus.source`, `normalizer_version`, `normalizer.provenance`. 신규 AC-02-35. | 02, 07 |
| T-08 | **`qa:trace --audit` 재정의 + 키 없는 합격 수치 키화**(QA3-05; AI3-06·PM3-08·QA3-10 포함). 채택: QA3-05 보완안 1~4. 근거(정의 변경): 문자 그대로의 규칙은 HTTP 상태·수량까지 금지해 테스트를 못 쓰게 하고, 헬퍼로 옮기면 우회된다. 감사 = 비교 매처·비교 연산자 피연산자의 리터럴이 thresholds 잎 값과 같으면 FAIL, 범위 = `tests/acceptance/**` + import 그래프. 예외 리터럴은 `spec:test-policy.auditAllowLiterals`, `forbidden-allowlist.json`은 경로만. 신규 키(현재 본문 값 그대로): `perf.surveyServerP95Ms` 200(서버 처리, D-0608·M4 ⑦), `perf.surveyApiP95Ms` 300 유지(API 관측), `perf.resultServerMs` 200, `perf.mockE2eSubmitToCardsSec` 30, `perf.queueWaitMaxSec` 180(= 2 × `latencyP95Sec`, TC-C-02·AC-06-37, 동시 상한 = S-14 실효), `release.extractor.anchorMinDist` 0.25, `diagnosis.typeCenterMinDist` 0.50, `generation.fallbackAbortToleranceSec` 2, `release.usability.seqMedianMin` 5. 나머지는 7.12.1 "사양 상수" 표로 닫는다. 신규 AC-07-22. | 07, 09, 06, 02, 00 |
| T-09 | **AC → 마일스톤 배정표 + 00장 기능 배정**(QA3-06, PM3-04). 채택: QA3-06 보완안 1~3 + PM3-04 보완안. 배정표 원천은 07 `spec:test-policy.acMilestones`(추출 원천을 07 한 파일로 유지), 09 9.4는 참조. 06 표를 옮겨 00~09장 전 AC를 채운다. 원칙: 그 기능을 처음 만드는 마일스톤, 정할 수 없으면 M8. `qa:trace`: AC는 배정된 `tests/acceptance/m<k>/`에만 매핑되어야 PASS, 정규식 `AC-\d{2}-\d{2,3}[a-z]?`(QA3-09). 09 9.4 범위 추가: M4 이벤트 API·zod·`identity_links`, M5 `quota_ledger`·초대 코드·생성 이벤트·T-20, M6 채택·공유/내보내기 이벤트·페이크 도어·T-22, M7 ADM-01~13·KPI 뷰·문의/신고(통과 조건 AC는 PM3-04 원문). AC-00-01·07은 "문서 검사". 신규 AC-07-23. | 07, 09, 06, 00 |
| T-10 | **수량 잔재와 AC ID 중복**(QA3-07). 채택: QA3-07 보완안. 수량 대신 원천을 참조한다: AC-09-04 "9.2.2 전 묶음", AC-09-07·AC-07-02·7.15 "9.6.2 전 행(기대 결과는 07 TC-R)", "G-01~G-12" → "R-13 하드 게이트 전부(현재 G-01~G-13)". **AC-03-38 중복**은 두 리뷰 안(1421행 → 38b, 3.1.5a → 41)이 다르고 AC-03-41은 이미 쓰인다. 그래서 3.1.5a 쪽을 **AC-03-42**로 바꾸고 조화 쪽은 그대로 둔다(3.15 요약 범위 "38~40" 유지). `qa:trace`는 ID 정의 2개 이상이면 FAIL. | 09, 07, 03, 00, 06, 04 |
| T-11 | **데이터 접근 설계 하나: 서버 전용 `DbPort` + 쓰기 권한 화이트리스트**(TL3-01, LG3-01 Blocker; TL3-11 포함). 채택: TL3-01 보완안 + LG3-01 보완안 1~4, 값은 아래로 고정. ① **브라우저는 DB·PostgREST·supabase-js를 쓰지 않는다.** 로그인(매직링크·Google·TOTP)도 서버 Route Handler가 `AuthPort`로 처리하고 세션 쿠키는 httpOnly다. `NEXT_PUBLIC_SUPABASE_URL`·`_ANON_KEY`는 폐지하고 서버 전용 `SUPABASE_URL`·`SUPABASE_ANON_KEY`(supabase 프로파일·staging·prod만 필수). ② **`DbPort`**(두 프로파일 공통): `withUser(uid, aal, fn)`·`withAnon`·`withService` = 트랜잭션 + `SET LOCAL ROLE` + `request.jwt.claims`. 역할 없는 쿼리는 API로 만들 수 없다. 드라이버 **Kysely + `pg`**, 타입 **kysely-codegen**(`pnpm db:types`, `DATABASE_URL_DIRECT`, Docker 불필요). 접속 사용자: native = shim의 `tastefit_app`(LOGIN, NOBYPASSRLS, 3역할 멤버, shim service_role은 BYPASSRLS), supabase = 기본 사용자(Supavisor 트랜잭션 모드). supabase-js import는 Auth·Storage supabase 드라이버 안에서만(guard). `DATABASE_URL_POOLED` 미설정 시 local만 DIRECT. ③ **쓰기 화이트리스트**: `authenticated`는 `users.display_name`과 `mockups(feedback, feedback_at, selected_at)` 컬럼 UPDATE만, `anon` 쓰기 0. `projects`·`mockup_versions`·`share_links`의 authenticated 쓰기 정책 삭제, 나머지 쓰기는 `withService`나 security definer 함수. 심층 방어 트리거와 권한 덤프 스냅샷은 LG3-01 3·4번. ④ `StoragePort.publicUrl`, fs = `${WEB_ORIGIN}/api/_storage/public/…`, CSP `img-src`는 신규 `STORAGE_PUBLIC_ORIGIN`. `/api/_storage/*`는 항상 존재하고 local·fs가 아니면 404, `api-parity` 제외(TL3-11). preview는 `next start -p 3001` 2번째 프로세스. ⑤ `AuthPort += adminSignOutAll, adminDeleteUser`, local exchange는 `auth.users` upsert 후 T-12 호출. ⑥ native는 AC-06-03·03b를 `withUser` SQL로, supabase CI는 REST 직접 호출까지(needs_ci `supabase-rest-rls`). 신규 AC-06-03b, AC-06-59. S-01 보완. | 06, 09, 08, 07 |
| T-12 | **`provision_user` + 관리자 권한 원천**(TL3-02). 채택: TL3-02 보완안. `auth.users` 트리거는 `users` 생성·관리자 판정·제재 승계를 하지 않는다(`minimize_auth_metadata`는 유지). 로그인 콜백(supabase `/auth/callback`, local `exchange`)마다 web이 `withService`로 `provision_user(p_user_id, p_is_admin, p_email_hash)`(security definer)를 호출해 `users` upsert, `role`을 현재 `ADMIN_EMAILS`에 동기화, `sanctions`·`abuse_holds` 승계를 한 트랜잭션으로 한다. HMAC은 web이 계산하고 키는 DB에 없다. 권한 = `role='admin'` ∧ 요청 시점 `ADMIN_EMAILS` ∧ `aal2`. 6.5.4 "자동 강등하지 않는다"·ADM-06 수동 승격 삭제. 신규 AC-06-60. S-21·S-28 보완. | 06, 00, 08 |
| T-13 | **인증 서버 기록 P14**(LG3-02). 채택: LG3-02 보완안 1~3. 08 8.7.2 P14(인증 이벤트·IP·UA·이메일, Supabase `auth.*`, 정당한 이익), 6.1.3 Supabase 행 P14. "IP 원문을 어디에도 저장하지 않는다"(00·06·08) → "앱 테이블(`public`)에는 미저장, 인증 서버 기록은 P14". 규칙 `auth_audit_90d`, `account-delete` ⑥b, AC-08-36 범위 = `public` + `auth` 보관 기간 밖 행. shim에 `auth.audit_log_entries`·`auth.sessions` 최소 컬럼, GoTrue 실측은 needs_ci → `docs/compliance/auth-metadata.md`. 기본값 90일(Q16). 신규 AC-08-55. | 08, 06, 00 |
| T-14 | **감사 로그 1년 파기**(LG3-03). 채택: LG3-03 보완안 1~3. 근거(정의 변경): AC-08-33(1년 후 0건)과 AC-06-06(DELETE 전면 실패)은 동시에 만족할 수 없고, 고지(1년)와 실제(영구)가 달라진다. UPDATE는 항상 거부, DELETE는 `old.created_at < now() − 1 year`인 행만 `purge_audit_logs(p_before)`(security definer, `p_before ≤ now() − 1 year` 재확인)로 허용. 6.6 규칙 `admin_audit_1y`. AC-06-06 = "UPDATE는 항상 실패, 1년 이내 행 DELETE는 service role에서도 실패". 00 AC-00-20 "append-only" → "1년 보관 후 파기만 허용". 테스트는 `created_at`을 과거로 넣은 행. 신규 AC-08-56. | 06, 08, 00 |
| T-15 | **신고 증거 보존·탈퇴 순서**(LG3-04). 채택: LG3-04 보완안 1~3. `account-delete`는 **⑤ → ①** 순서(`status_before_delete` 컬럼은 두지 않음). `reports.share_id`는 FK 없는 text + `evidence jsonb`. `impersonation`·`phishing` 신고가 `open`/`hidden`/`actioned`인 버전은 삭제 경로에서 객체를 `abuse-evidence/<report_id>/`로 옮기고 `abuse_evidence_90d`(검토 종료 후 90일). ⑤b `abuse_holds(email_hash, report_ids, until)`, `actioned` 처리 시 `sanctions` upsert, 재가입 시 T-12가 승계. 기본값 90일(Q6). 신규 AC-08-57. S-21 보완. | 06, 08 |
| T-16 | **익명 창구 계약**(LG3-05; UX3-09 Turnstile 부분 포함). 채택: LG3-05 보완안 1~3. 세 엔드포인트 입력 `turnstileToken` 필수, 실패 403 `TURNSTILE_FAILED`(R-13 표, 01 1.10.3 위젯). `rights_requests += verify_token_hash, verify_expires_at, verified_at`, status += `awaiting_verification`. 확인 메일은 계정 이메일 일치 시에만(응답은 같은 201), verify 링크 1회·24시간(재사용·만료 410), 미확인 처리 409. 메일 `privacy_verify`·`share_hidden_notice`. S12 "검토 중" + `me.share.underReview`. 신규 AC-06-66. S-27 보완. | 06, 01, 08 |
| T-17 | **원가: 캐시 예열·Mock 캐시·비용 시나리오 3종**(TL3-03, TL3-04; TL3-10·QA3-11 포함). 채택: TL3-03 보완안 **a** + 공통, TL3-04 보완안. 이유(a): b는 생략 임계·cap, 즉 합격선을 다시 정해야 하고 a는 지연 +1~2s(TTFT)뿐이다. ① 레이아웃 후보 0 먼저, 첫 토큰 뒤 나머지 5개, 카피는 처음부터 병렬. 04 4.17.2 표(기본 ≈ $0.23 < `skipVisionUsd`)가 성립하고 식은 06 6.9.4에 둔다. ② Mock usage는 `fixtures/llm/mock-prompt-sizes.json`(블록별 고정 문자 수)로 보고하고 정적 프리픽스는 첫 레이아웃 `cacheWrite`, 나머지 `cached`. 근거(정의 변경): "$0.23 ± 10%"는 프롬프트 길이로 맞출 수 있어 판정이 서지 않으므로 AC-06-56을 **"공식값 ± 1%"**(더 엄격)로. ③ `cost_spike` = 단가 10배(추정 반영) → `budget_skipped`, `sum ≤ 0.30`. `cost_ramp` = 단가 1.15배 → vision → repair 순 생략. `usage_overrun` = usage 3배(추정 미반영) → 진행 호출 정산, A11 1건, 이후 예약 전부 거부. 근거(정의 변경): 실제 청구는 외부 사실이라 저장 제약이 잡을 죽이거나 기록을 깎으면 KS-1 집계가 틀어진다. `generation_jobs.cost_usd` CHECK는 `≥ 0`만(S-13의 ≤ 0.36 대체), AC-06-07 = "0.30 초과 저장 시 A11 + 이후 예약 거부, DB 예외 0". 가드 0.30과 "cost_spike 합 ≤ 0.30"은 그대로. ④ attempt마다 reserve → settle/release(TL3-10). ⑤ 실효 cap = min(`JOB_COST_CAP_USD`, `capUsd`), 생략 기준은 같은 비율로 내린다(더 엄격). 00 §9.2는 06 참조 1줄, AC-00-14는 `cost_spike` 기준. 신규 AC-06-61·62. S-13 일부 → T-17로 대체. | 06, 04, 07, 09, 00 |
| T-18 | **Mock 재호출·수리·인덱스 매핑**(AI3-04; TL3-05·AI3-09 포함). 채택: AI3-04 보완안 1~5. 시드 `hash(designSpec.hash, candidateIndex, role, callKind, attempt)`, 장애는 `initial`에만, `!` 접미사만 재호출에도 유지(`copy_schema_fail@gen_copy`는 `!`). 수리 규칙, `fixtures/llm/mock-variant-effects.json`(B18 정규화기 Δ, 결정론), `fixtures/llm/low-score-trees/`(72조합 H < 80)는 원문. `candidateIndex = variantIndex × 2 + slotIndex`, 순서 `[v_true, v_fit, v_bal]`, 재생성은 같은 인덱스(04 4.8·06·09 같게, TC-R-15에 개수). 재호출도 위반이면 `eligible=false`(`DIVERSITY`). 근거(정의 변경): AC-04-16 "100%(재호출 후)"는 재호출 실패 시 판정 대상이 없었다. "**노출 집합 기준 100%**"로 바꾸며, 위반 후보는 노출될 수 없으므로 더 엄격하다. `call_kind`·`candidates.origin` += `diversity`, 카피 패치 = `gen_copy ∧ repair_quality`, AC-04-23 상한에 diversity 미포함. `judge_vision`은 `hash(sorted(ids))`로 승자 ID → 위치별 A/B, `judge_position_bias@judge_vision` 추가. 신규 AC-04-47, AC-09-18. S-11 일부 → T-18로 대체. | 09, 04, 06, 07 |
| T-19 | **TM·S_free에 `reliable`·`subjective` 반영**(AI3-02). 채택: AI3-02 보완안. 04 4.10.4가 원천: `m_k = reliable_k · (subjective_k ? 0.5 : 1)`, `w_k = m_k·λ_k/(σ_k²+τ²)` 정규화, `F = {A1, A4} ∩ reliable`, `S_free = F = ∅ ? null : …`, 노출 = `TM ≥ 75 ∧ (S_free = null ∨ S_free ≥ 65)`. 근거(정의 변경): 빈 평균은 계산 불가이므로 측정 불가를 명시하는 것이고, null이면 경고 `SFREE_NA`, 골든 M8 최솟값은 null 아닌 값으로 계산하고 null 개수를 리포트에 적는다. 사람 라벨 G2가 이 상태를 확인한다. `axis_gaps`는 reliable 축만. 05 D-056은 "04 4.10.4 m_k" 참조. 신규 AC-04-45. | 04, 05, 07 |
| T-20 | **노출 전 취소 환불 남용 차단**(PM3-02). 채택: PM3-02 보완안. 노출 0 취소 환불은 계정당 하루 **2회**, 3번째부터 차감(01 1.6.5 시트 문구 분기 `gen.cancel.noRefund`). `USER_DAILY_COST_CAP_USD`(기본 1.5, 6.10.4 플래그) 초과 시 그 계정 신규 생성 429 `QUOTA_DAY`(사유 `cost_cap`), A4는 차단 발동을 알림. 취소 즉시 진행 중 LLM 호출 abort, `llm_calls.status='aborted'`(enum 기존 값). 00 §9.3 `canceled` 행과 06 6.2.3이 같은 문장. 신규 AC-06-63. S-16 보완. | 06, 00, 01, 04 |
| T-21 | **평가 LLM 예산**(PM3-03). 채택: PM3-03 보완안. `EVAL_RUN_BUDGET_USD` 30·`EVAL_MONTHLY_BUDGET_USD` 60(06 6.10.4). `llm_calls.purpose ∈ {user_job, eval, ref_tag}`(`job_id not null`은 user_job일 때만). eval·ref_tag는 `GEN_*`와 따로 집계, staging `GEN_DAILY_BUDGET_USD=2`는 사용자 경로 스모크 전용. 00 §9.4 "비사용자 LLM 지출" 표, 월 총 상한 210. `release:check`는 G2 `runsCompleted = 96`을 확인하고 예산 중단 미완료는 fail(미실행 명시). 증액은 사람 결정. 신규 AC-06-64. S-15 보완. | 06, 00, 07, 09 |
| T-22 | **검증 운영 UI·API**(PM3-01, UX3-05). 두 안을 합치고 충돌은 이렇게 정한다. ① S03 소유자 뷰 `result.retestHint`. ② S12 배너 `me.retestBanner`: 로그인 ∧ 최신 결과 후 **6~14일** ∧ 그 뒤 결과 없음, [다시 진단하기] = `entry:'retest'`, 닫기 = `localStorage tf_retest_dismissed_{resultId}`. 이유: 재검사 유효 창이 02 2.16.3의 6~14일이고, 배너는 무해한 안내라 서버 상태가 필요 없다. ③ A5 시트는 **서버 상태**: "1회"를 기기와 무관하게 보장해야 지표가 맞기 때문이다. `mockups += followup_answered_at, followup_dismissed_at`, `GET /api/me.adoptionFollowup`(`adopted_at ≤ now − 7d`, 미응답·미닫힘, 가장 오래된 1건), S12·S09 진입 시 방문당 최대 1개. 엔드포인트는 **1개**: `POST /api/mockups/:id/adoption-followup {answer: deployed\|handed_off\|reference_only\|unused\|dismissed}` → 204(소유자만, 중복 409). `dismissed`는 이벤트 없음. ④ 00 §8.5: A5 = `{deployed, handed_off}` / **응답 시안**(n ≥ 15) + 응답률, A7 = `paywall_interest` / `paywall_view` 주체. ⑤ 1.12.1·1.16 상태와 발화 지점, 키 `followup.*`. 신규 AC-01-59, AC-06-65. S-18 보완. | 01, 06, 00 |
| T-23 | **자극물 크기 규칙**(UX3-01). 채택: UX3-01 보완안 1~5. 1단계 desktop/tablet은 `w2 = min((vw − 2m − 24)/2, 588) < 480`이면 1열 세로 목록(`w1 = min(vw − 2m, 800)`, m = desktop 32·tablet 48), 2단계는 같은 조건에서 토글 비교(desktop 자산, 폭 `w1`). mobile `card_h = 100dvh − 276 − env(safe-area-inset-bottom)`, 하단 바 두 줄, 1.14.3 [이전][다음]은 "썸네일 탭으로 대체", mobile A/B도 같은 고정 창. 회전 안내 판정은 `(pointer: coarse) && vh < 500`. `card_h < 300` 회전 안내는 유지. 07 7.6.2 S02 검증 뷰포트에 리뷰의 7개 뷰포트 + 844×390 추가. 신규 AC-01-55. S-30 일부 → T-23으로 대체. | 01, 07, 02 |
| T-24 | **편집 허용 기기와 내보내기**(UX3-02). 채택: UX3-02 보완안 1~4. 1.9 9번 = "편집 불허 기기(1.3.1)에서만 내보내기 숨김". 판정은 S09 마운트 시 1회, 세션 동안 고정. SSR은 편집 스켈레톤. 1.14.2 "< 768 1열 탭, 768~1023 드로어". 1.12.1 S09 `narrow_edit`. 편집 불허 기기 S08 주 CTA `drafts.mobile.cta` "PC에서 다듬기"(링크 복사 + 안내), 보조 [공유 링크 만들기] = `/edit/[mockupId]?modal=share`. 1.2 S11 진입 "S09, S09 읽기 전용". 07 7.6.2는 01 1.3.1 참조. 신규 AC-01-56. S-31 보완. | 01, 07 |
| T-25 | **결과 안내는 서버가 고른다**(UX3-03). 채택: UX3-03 보완안 1~4. 02 2.13.1 `pickNotice(profile) → 'low_signal'\|'conflict'\|'low_consistency'\|'boundary'\|null`(순수 함수, 순서는 S-29). `ResultView.notice`(같은 enum)·`ResultView.seasonAdjusted: boolean` 추가, `consistency: {C, level}` 삭제. 시즌 "첫 방문 1회"는 `localStorage tf_season_seen_{resultId}`. 02 2.9·2.12.2 문구 원문 3개는 키 참조로, κ < 0.50의 의미는 `lowConsistency`(재진단 권유)로 확정. `notice ∈ {low_signal, low_consistency}`이면 신뢰도 줄 생략. 클라이언트 σ·κ 임계 비교 0. 신규 AC-02-34(픽스처 5종), AC-01-57(S03 표시). S-29 보완. | 02, 06, 01 |
| T-26 | **S08 안내 데이터 원천**(UX3-04). 채택: UX3-04 보완안 1~4. `MockupCard.photoSubstituted: boolean`(04 4.9.4 결정론 결과), `GenerationView.copySource: 'llm'\|'template'`. 안내: 비폴백 < 3이면 `drafts.partial`, `copySource='template'`이면 `drafts.templateCopy`(동시 최대 2줄). 1.7 머리 상태 정의에 "템플릿 덱이면 비폴백 3이어도 `partial`(S-12)". 키 문구는 UX3-04 3번 원문, `labelKey = variant.v_true\|v_fit\|v_bal` + `variant.<v>.label/desc` 6개. 07 TC-R-16 기대 상태는 S-12 문장("R-15 값과 partial 중 낮은 쪽")으로 고친다(QA3-12). 신규 AC-01-58. S-12·S-34 보완. | 06, 01, 04, 07 |
| T-27 | **반전 면 컴포넌트·accent 텍스트**(UI3-01; UI3-06 "라벨" 부분 포함). 채택: UI3-01 보완안 1~3, 3번은 권장안(이미지 오버레이 위 = `@inverse` 매핑). `deriveTokens`가 `tokens.inverseButtonMode: 'primary'\|'invert'`와 `tokens.accentTextSafe: boolean`을 결정론으로 파생. accent 텍스트는 `accentTextSafe`일 때만, 03 3.13.3·3.13.2 (a)의 "라벨"은 이 조건으로 고친다. 팔레트 값은 바꾸지 않는다. 신규 AC-03-44(32 TokenSet 3쌍), AC-03-20에 G-02·G-03 추가. | 03, 04 |
| T-28 | **G-12·AIL-17 뷰포트별 기대값**(UI3-02). 채택: UI3-02 보완안 1~3, 3번은 첫 안(`nav.wordmark` = `t-lead`, heading 웨이트, "20~24px 고정" 삭제). 근거(정의 변경): 지금 정의는 clamp 보간값·중앙 정렬 여백을 위반으로 판정해 정상 시안을 모두 폐기한다. 허용 오차 0.5px와 색·radius 검사는 그대로이고, 스케일 밖 값 픽스처(`padding: 13px`, `font-size: 15px`)는 모든 뷰포트에서 계속 잡혀야 한다. font-size 기대값 = 03이 제공하는 `expectedSize(step, vw)`, spacing 검사 대상 = padding·gap·토큰 margin(`data-layout-auto` 요소 제외). 신규 AC-03-45. | 04, 03 |
| T-29 | **텍스트 역할 확장**(UI3-03). 채택: UI3-03 보완안(역할 행 그대로). 기존 `price`는 `pricing.price`로 이름을 바꾸고 pricing 블록 전용. B25 `text-roles.json` 갱신. 텍스트 역할 AC는 AC-03-42(T-10), 커버리지 교차 검사는 신규 AC-03-46. S-38 보완. | 03, 04, 09 |
| T-30 | **헤드라인 줄 예산 입력·cta·워드마크**(UI3-04). 채택: UI3-04 보완안 1~5. 덱 제약 입력 = `maxChars_job`(변형 3 × hero_variants 허용 목록 × {1280, 375}의 최솟값, S1 확정 후 S2 전에 계산). 하향 판정은 토큰 계산(`len > headlineBudget`)이고 렌더 측정은 AC-03-26 검증 전용. 하향 결과는 확정 트리 섹션 노드 `role_overrides: {slot_id: step}`(04 §4.5.2 스키마). **`spec.render_adjustments[]`는 폐지**(S-39 일부 → T-30으로 대체). `VariantDef.text_cols: {lg, base}` hero 6종(full-bleed-image 7, left-aligned 8, offset 6, split 6, type-only 10, centered 8), 반올림 `floor`. cta big-type·footer·nav 워드마크 규칙은 보완안 4(nav는 `t-lead` → `t-body` → 375 2줄). AIL-24에 "1280 > 2줄". 신규 AC-04-46. | 03, 04, 01 |
| T-31 | **베이스라인 자산 동등화**(PD3-01). 채택: PD3-01 보완안 1~3. 프롬프트 부록(이미지 팩 후보 ≤ 12, `@font-face` 블록)은 잠금 파일 `eval/blind/baseline_assets_appendix.md`. 렌더는 본 시스템과 같은 워커 렌더러·로컬 자산 서버·외부 네트워크 차단, 외부 URL 결정론 제거. 적합성(`imagesLoaded ≥ 1 ∧ systemFontFallback = 0`) 미달은 재요청 최대 2회, 그래도 미달이면 제외 수(기존 ≤ 2 상한 유지). P-2s도 같은 하네스. 신규 AC-07-26. S-36 보완. | 07, 00 |
| T-32 | **styleguide 원천 = 해당 버전 토큰**(PD3-02). 채택: PD3-02 보완안 1~3. 포맷터 `formatGuide(tokens)`를 `ResultView.guide`(입력 = 앵커 프리셋 토큰)와 styleguide(입력 = 그 버전 `tokens`·`l2`)가 같이 쓴다. 앵커 값은 "유형 기본값" 참고 행. E-14에 "팔레트 HEX·페어링 ID·radius 계열이 같은 버전 `tokens.json`과 100% 일치" 추가(AC-04-34 확장). 06 스토리지 표 `exports` 공통 파일에 `styleguide.html`. S-35 보완. | 04, 06, 03 |
| T-33 | **FP15 body = Wanted Sans 400**(PD3-03). 채택: PD3-03 보완안(본안). 대안(Syne 제거)은 '실험 디스플레이' 성격이 사라지므로 고르지 않는다. 패밀리 2종으로 AC-03-25·H4 만점. `pairings.json`·03 3.7.3·3.18 행을 같게 고친다. S-33의 FP15 문장 → T-33으로 대체. | 03, 04 |
| T-34 | **업종 허용 태그 연결·톤 선택식**(PD3-04). 채택: PD3-04 보완안 1~3. 04 4.2.1 `image_tags_allowed = purposeTags(p) ∩ industryTags(BrandInput)`(매칭 0이면 `{storefront} ∪ common.texture-*`), LT-10이 강제. 4.9.4 업종 블록은 "매칭 0일 때 hero 외 사진 슬롯 대체"만. 선택식 단계형(`C1` 같은 톤 → `C2` neutral → `fallback_variant`, 각 집합 `asset_id` 오름차순 후 해시 mod). `pageTone`은 보완안 3. `photoSubstituted`(T-26)는 이 결과에서 나온다. 신규 AC-04-44(수용 기준 3개 + portfolio placeholder 목록). S-34 보완. | 04, 03, 09 |
| T-35 | **S-32~S-34 규칙의 AC 등록**(PD3-05). 채택: PD3-05 보완안. AC-01-54(S08 칩·차이 행, E2E, M6), AC-03-43(`presets:lint-matrix` 리포트·error 0·CF 조합 편집 선택지 `disabled`, CI, M3), AC-04-44(T-34, M5). 07 TC와 T-09 배정표에 넣고, 각 장 반영 추적 표의 S-32~S-34 행에 AC ID를 적는다. | 01, 03, 04, 07 |
| T-36 | **번호·enum·이름 배정**(리뷰 간 번호 충돌 해소. 각 행의 번호가 최종). 신규 AC: AC-01-54~59, AC-02-34~37, AC-03-42(옛 3.1.5a AC-03-38)·43~46, AC-04-44~47, AC-06-03b·59~66, AC-07-21~26, AC-08-55~57, AC-09-17·18. 허용표 단계: temp `data-provenance`·`extractor-roundtrip`, manual `a11y-screenreader`·`device-smoke`·`legal-checklist`·`console-mfa`·`golden-muref-approval`, needs_ci `supabase-rest-rls`. blockable `sim-diagnosis-gate`·`survey-items-count`. 오류·경고: 403 `TURNSTILE_FAILED`, 503 `SURVEY_ITEMS_INSUFFICIENT`, 429 `QUOTA_DAY`(`cost_cap`), `SFREE_NA`, `DIVERSITY`. enum: `diversity`, `llm_calls.purpose`, `awaiting_verification`, `ResultView.notice`. DDL: `reports.share_id text`·`evidence`, `abuse_holds`, `rights_requests.verify_*`, `mockups.followup_*`, `provision_user`, `purge_audit_logs`, 버킷 `abuse-evidence`, 보관 `auth_audit_90d`·`admin_audit_1y`·`abuse_evidence_90d`. env: `SUPABASE_URL`·`SUPABASE_ANON_KEY`, `STORAGE_PUBLIC_ORIGIN`, `USER_DAILY_COST_CAP_USD`, `EVAL_RUN_BUDGET_USD`, `EVAL_MONTHLY_BUDGET_USD`. Mock: `cost_ramp`, `usage_overrun`, `judge_position_bias`. 메일: `privacy_verify`, `share_hidden_notice`. 태그: `review-pass`. | 전 장 |

### 반영 순서

한 단위는 30~45분이다. 원천 장(06 데이터·API, 07 판정)부터 고치고, 다른 장은 키·이름만 참조한다. 각 단위가 끝나면 PROGRESS 체크박스·로그 1줄·커밋·푸시.

1. **06-a**: T-11 `DbPort`·6.1.2·6.3.5 RLS 표 재작성·심층 방어 트리거·6.13.1/6.13.2 env·`StoragePort`/`AuthPort`·`/api/_storage`, T-12 6.5.4·6.11.2 권한 문장
2. **06-b**: DDL·보관(6.3.3·6.3.4·6.6·6.2.5): T-12 `provision_user`, T-13 shim·`auth_audit_90d`·⑥b, T-14 `purge_audit_logs`·AC-06-06, T-15 순서·`reports`·`abuse_holds`, T-16 `rights_requests`, T-22 `mockups.followup_*`, T-17 CHECK·AC-06-07, T-18·T-21 enum·`purpose`, AC-06-02 컬럼명(TL3-09)
3. **06-c**: T-17 6.9.4 예열 순서·식·시나리오·AC-06-56/21/61/62·실효 cap, T-20 6.2.3·6.10.4·AC-06-63, T-21 6.10.4·staging 행·AC-06-64, T-08 D-0608 키
4. **06-d**: API·오류 표(6.4): T-16 엔드포인트·`TURNSTILE_FAILED`, T-22 `GET /api/me`·`adoption-followup`·AC-06-65, T-25 `ResultView`, T-26 `MockupCard`·`GenerationView`, T-32 `guide` 주석·스토리지 표, T-06 `SURVEY_ITEMS_INSUFFICIENT`, T-36 코드, 6.19 미해결 행 정리
5. **07-a**: 7.12.1 블록·7.12.2: T-01 예외 목록·AC-07-25, T-02 review-pass·원천 경로·AC-07-24, T-03 `diagnosis.tunable`, T-08 감사 재정의·신규 키·사양 상수 표·AC-07-22
6. **07-b**: 7.11.2·`spec:test-policy`: T-05 카탈로그·허용표·종료 코드 3·AC-07-21, T-06 단계, T-11 `supabase-rest-rls`, T-21 `runsCompleted`
7. **07-c**: T-09 AC 배정표(`acMilestones`, 00~09 전 장)·AC-07-23·정규식, T-35 TC 등록
8. **07-d**: T-04 7.2.2 재생성 조건, T-17 TC-R-09·신규 TC-R 2행, T-18 TC-R-15 개수, T-19 M8 null, T-26 TC-R-16, T-31 7.8.3·AC-07-26, T-23·T-24 7.6.2, T-07 비차단 행, T-10 "13개·13종·G-01~G-12"
9. **09-a**: T-01 9.5.7 문구, T-02 F01·9.5.6·`lockedBy`·M0 산출물·AC-09-03·9.8.1, T-05 9.9.1·9.9.2, T-03 M4 ④·F 목록
10. **09-b**: 9.4 범위·통과 조건: T-09 M4~M7 기능 배정, T-04 M1 ② 골격·M4 build-answers·AC-09-17, T-06 M3 ③·M4 ①, T-10 AC-09-04·07, T-11 9.1.2·9.1.3·M1 `db:types`·M0 native 기동, T-08 M-행 리터럴 → 키
11. **09-c**: 9.6.2: T-18 시드·수리 규칙·효과표·인덱스·`judge_position_bias`·AC-09-18, T-17 Mock usage 캐시·시나리오 3종, T-34 B24 연결, T-29 B25
12. **01-a**: T-23 1.4.3·1.4.11·1.14.3·AC-01-55, T-24 1.9·1.14.2·1.8.7·1.2·S08 레일·AC-01-56
13. **01-b**: T-22 S03·S12 시트·배너·1.12.1·1.16·AC-01-59, T-25 S03·AC-01-57, T-26 1.7·1.15.3 키·AC-01-58, T-16 S12 "검토 중"·1.10.3, T-20 1.6.5, T-35 AC-01-54, T-30 1.8.4 편집 시 `role_overrides`
14. **04-a**: T-19 4.10.4·AC-04-45, T-18 4.8 매핑·재호출 규칙·AC-04-16·23·47, T-17 4.17.1·4.17.2 참조·AC-04-37, T-34 4.2.1·4.9.4·AC-04-44, T-26 4.9.4
15. **04-b**: T-30 덱 입력·`role_overrides`·AIL-24·AC-04-46, T-28 G-12·AIL-17, T-32 4.16.1·E-14, T-27 4.11.1 주석, T-33, T-10 G-13 표기
16. **03-a**: T-27 3.1.3·3.13.2/3.13.3·AC-03-44, T-28 3.1.5 `expectedSize`·`nav.wordmark`·AC-03-45, T-29 3.1.5a·AC-03-42·46
17. **03-b**: T-30 3.8.1·`VariantDef.text_cols`, T-33 FP15·3.7.3, T-35 AC-03-43, T-32 3.18, 3.15 요약·3.18 반영 추적 표
18. **08-a**: T-13 P14·8.7.7·AC-08-36·55, T-14 8.7.7·AC-08-56, T-15 8.7.7·8.9.5·AC-08-57, T-16 8.7.9·8.9.5, T-11 8.7.5 "서버 경유" 참조, T-12 8.15
19. **02-a**: T-03 2.16.2 목적함수·tuned·AC-02-36, T-07 2.16.1·V-MEAS·AC-02-35, T-06 2.6.1·AC-02-37, T-25 2.13.1·2.9·2.12.2·AC-02-34, T-04 2.15, T-08 AC-02-24·30 키
20. **05-a**: T-06 5.9 앵커 행, T-19 D-056 참조
21. **00-a**: T-20 §9.3, T-17 §9.2·AC-00-14, T-21 §9.4 표, T-22 §8.5 A5·A7, T-13 §8 IP 문장, T-14 AC-00-20, T-12 §10.1, T-10 G-01~G-13, T-31 §5.1 A2, §14 상태·버전 v2.3
22. **잔여 표기 grep**: `render_adjustments`, `supabase gen types`, `NEXT_PUBLIC_SUPABASE`, `\.from\(`(06 예시 제외), `자동 강등하지 않`, `G-01~G-12`, `17개 묶음`, `13개 시나리오\|13종`, `\$0\.23 ± 10%`, `usage를 10배`, `cost_usd <= 0.36`, `IP 원문을 어디에도`, `prompts/\{role\}`, `p95 ≤ (200\|300)ms`(02·09), `docs/spec/00~09`, `AC-03-38`(정의 1건)이 기대 건수와 같아야 한다.

### 사람 확인 필요

에이전트가 결정하지 않는다. HUMAN_TODO로 옮기고, 그동안은 temp·manual·needs_ci 상태로 진행한다. v3 목록은 그대로 유효하다.

- 인증 서버 기록 90일 보관의 적정성(T-13, Q16에 덧붙임)
- 신고 증거·탈퇴 보류 90일 보관의 근거(T-15, Q6에 덧붙임)
- 평가 예산(월 60)과 월 총 LLM 상한 210의 승인, staging 예산(T-21, S-15와 같은 항목)
- 환불 취소 2회/일·계정 일 원가 1.5의 사업 타당성(T-20)
- Supabase 콘솔 Data API 노출 스키마 점검(심층 방어, T-11)과 GoTrue 내부 테이블 실측 덤프(T-13, needs_ci)
- `review-pass` 태그 이후 FINAL 값 검토, tuned 변경 시 muRef 재생성 승인(T-02·T-04)

### 출처 대응표

| 리뷰 항목 | 심각도 | T-ID |
|---|---|---|
| QA3-01 | Blocker | T-01 |
| TL3-01 | Blocker | T-11 |
| LG3-01 | Blocker | T-11 |
| AI3-01 | Major | T-06 |
| AI3-02 | Major | T-19 |
| AI3-03 | Major | T-07 |
| AI3-04 | Major | T-18 |
| AI3-05 | Major | T-03 |
| LG3-02 | Major | T-13 |
| LG3-03 | Major | T-14 |
| LG3-04 | Major | T-15 |
| LG3-05 | Major | T-16 |
| PM3-01 | Major | T-22 |
| PM3-02 | Major | T-20 |
| PM3-03 | Major | T-21 |
| PM3-04 | Major | T-09 |
| PD3-01 | Major | T-31 |
| PD3-02 | Major | T-32 |
| PD3-03 | Major | T-33 |
| PD3-04 | Major | T-34 |
| PD3-05 | Major | T-35 |
| QA3-02 | Major | T-03 |
| QA3-03 | Major | T-04 |
| QA3-04 | Major | T-05 |
| QA3-05 | Major | T-08 |
| QA3-06 | Major | T-09 |
| QA3-07 | Major | T-10 |
| QA3-08 | Major | T-02 |
| TL3-02 | Major | T-12 |
| TL3-03 | Major | T-17 |
| TL3-04 | Major | T-17 |
| UI3-01 | Major | T-27 |
| UI3-02 | Major | T-28 |
| UI3-03 | Major | T-29 |
| UI3-04 | Major | T-30 |
| UX3-01 | Major | T-23 |
| UX3-02 | Major | T-24 |
| UX3-03 | Major | T-25 |
| UX3-04 | Major | T-26 |
| UX3-05 | Major | T-22 |

Blocker 3건과 Major 37건이 각각 정확히 한 T-ID에 대응한다.

### 선택 반영 (Minor)

"포함"은 해당 T 행이 이미 처리한다. "선택"은 해당 장 반영 단위에서 리뷰 원문 보완안대로(괄호 안 한 줄 결정이 있으면 그것으로) 처리하고, 시간이 없으면 다음 라운드로 넘겨도 된다. 레지스터와 충돌하면 레지스터가 이긴다.

| 역할 | 항목별 처리 |
|---|---|
| AI | AI3-06 포함 T-08 · AI3-07 선택(05 "95% ≤ 0.10"은 `release.extractor` 비차단 기록 키, 카드 판정은 0.15 하나) · AI3-08 선택(안 a: argmax면 `beta` 금지, 판별 유니온) · AI3-09 포함 T-18 |
| LG | LG3-06 선택(06 6.1.3 흐름표에서 파생한 예시) · LG3-07 선택 · LG3-08 선택 · LG3-09 선택(LG2-08~11 원문) · LG3-10 선택 |
| PM | PM3-05 00-a에서 처리(reason 4값·G-13·실효 동시 2·aal2, T-12 문장) · PM3-06 선택("예산 상향 결정 후" 단서) · PM3-07 00-a에서 처리(v2.3, 우선순위에 decisions_v4) · PM3-08 포함 T-08 |
| PD | PD3-06 선택(4.4 7키 순서, 순서형 up/down·명목형 changed) · PD3-07 03-b에서 처리 · PD3-08 선택(결과 화면 전 진행, 동일 쌍 제외) · PD3-09 선택([P2]로 00 §7.1에) |
| QA | QA3-09 포함 T-09 · QA3-10 포함 T-08 · QA3-11 포함 T-17 ⑤ · QA3-12 부분 포함(TC-R-16 = T-26, 인덱스 = T-18, M5 키 = T-08). `GM1~GM15` 개명은 하지 않는다(전 장 개명 비용이 큼) |
| TL | TL3-05 포함 T-18 · TL3-06 09-b에서 처리(잠금 파일 경로 `config/lock/locked-hashes.json` 하나) · TL3-07 선택(zod `uuid()`, 틀리면 재발급) · TL3-08 선택(6.7 참조 + `itemsetHash`) · TL3-09 06-b·09-b에서 처리 · TL3-10 포함 T-17 ④ · TL3-11 포함 T-11 ④ |
| UI | UI3-05 선택(registry 3값·런타임 `page`, 확장 face 먼저 선언, S09 폰트 ≤ 1.5MB) · UI3-06 선택(`role` += `tint\|none`, 24개/192건, "라벨"은 T-27) · UI3-07 선택(04 표를 `harmony.json` 생성본으로, ID 중복은 T-10) · UI3-08 선택(데스크톱 크기 기준, AC-03-25 FP20 예외) |
| UX | UX3-06 선택 · UX3-07 선택(`queuedAt` 기준, AC-01-51 Given = 실효 상한) · UX3-08 선택("공백 제외 ≤ 12자", `result.cta` = "내 사이트 시안 만들기") · UX3-09 01-a·01-b에서 처리 · UX3-10 선택(T-09 M5 초대 범위와 함께) |

---

<a id="src-decisions-v3"></a>
## 원본: `docs/spec/decisions_v3.md` (S-01~S-41)

## 통합 결정 v3 (2라운드 장 간 충돌 해소) — decisions_v2.md·decisions.md보다 우선

2라운드 리뷰(Blocker 3, Major 37)를 장별로 반영하기 전에 결정을 고정한다. 각 장 편집자는 아래와 다른 부분을 모두 고치고, 대체된 결정과 R-xx에는 "→ S-xx로 대체"를 적는다.

- **읽는 법**: "채택: X 보완안"이라고 쓴 곳은 해당 리뷰 파일의 보완안과 수용 기준을 원문 그대로 반영한다는 뜻이다. 표에 따로 적은 값·키·경로가 리뷰 원문과 다르면 표가 이긴다.
- **완화 금지**: 숫자 합격선은 하나도 낮추지 않았다. 판정 정의가 바뀌는 곳은 S-07, S-08, S-13, S-38 네 곳뿐이다. 모두 통계적 정합이나 원천 정의 때문에 바꿨고, 그 근거를 각 행에 적었다.
- **실행 환경(2026-11-18 실측)**: Docker 데몬 없음, chromium-1243만 있음(webkit·firefox 없음), PG16에 pgvector 없음, npm 접근 가능.

| ID | 결정 | 고칠 장 |
|---|---|---|
| S-01 | **스택 프로파일**(TL2-01). 채택: TL2-01 보완안. 원천은 06 6.13.1 신설 "스택 프로파일" 절이다. `STACK_PROFILE=supabase\|native`이고, `docker info`가 성공하면 supabase를 고른다(env로 강제 가능). **native**: ① 시스템 PG16(포트 54322) + `packages/db/shim/0000_supabase_shim.sql`(역할 3개, `auth.users`, `auth.identities`, `auth.uid()/role()/jwt()`, supabase 프로파일에서는 건너뜀). ② AC-06-01은 "빈 DB 2회 적용 + `ON_ERROR_STOP`". ③ `StoragePort` 드라이버 `supabase\|fs`. ④ `AuthPort` 드라이버 `supabase\|local`. local은 `dev_mail_outbox`에 매직링크를 기록하고, HS256 JWT(`sub`·`aal`)와 otplib TOTP로 `aal2`를 낸다. E2E는 픽스처 함수로 outbox를 읽으므로 HTTP 우회 라우트는 0개이고 R-10이 유지된다. ⑤ `MailPort`·`TurnstilePort`에도 local 드라이버를 둔다. ⑥ `APP_ENV≠local`에서 local/fs 드라이버가 설정되면 기동을 거부한다. ⑦ 오리진은 `http://localhost:3000`과 `PREVIEW_ORIGIN=http://127.0.0.1:3001`(다른 site)이다. local에서는 HSTS·upgrade-insecure-requests를 끄고, CSP 기대값은 env별 2벌을 둔다. ⑧ worker는 `node apps/worker`로 돌린다. **CI 위임**: 같은 verify를 GitHub Actions에서 `STACK_PROFILE=supabase`로 돌리고 결과는 `gh run watch`로 확인한다. 이 대체가 적용된 `env` 사유는 BLOCKED·HALT 계산에서 뺀다. | 06, 09, 07 |
| S-02 | **렌더 환경·브라우저**(TL2-02). 채택: TL2-02 보완안. ① 시각 회귀 기준선은 `e2e/__screenshots__/<RENDER_ENV_ID>/`에 단독 커밋으로 1회 만들고 자체 잠근다. `RENDER_ENV_ID`는 chromium 리비전·폰트·OS의 해시 12자다. `maxDiffPixelRatio ≤ 0.01`은 유지한다. ② `scripts/env/check-browsers.ts`가 설치 리비전(현재 1243)과 짝이 맞는 `@playwright/test` 정확 버전을 고정한다. 불일치하면 종료 코드 1이다. 고른 버전은 DECISIONS_LOG에 적는다. AC-06-34는 "패키지 버전 → 이미지 태그" 방향으로 검사한다. ③ chromium은 로컬 pass가 필수다. webkit·firefox는 needs_ci로 두고, R-33 지원 범위는 바꾸지 않는다. ④ verify:m8 네트워크 격리는 디스패처 차단, route 차단, 가짜 프록시로 하고, docker 네트워크는 CI 전용이다. ⑤ M6 ④는 `pnpm install --offline`으로 한다. ⑥ B6 temp는 `fc-match` Noto CJK를 쓰고, 없으면 `@fontsource`(OFL)를 쓴다. | 07, 09, 06 |
| S-03 | **보류 상태**(QA2-02). 상태 enum은 `pass\|fail\|temp\|manual\|needs_live\|needs_ci` 하나로 07 7.1.5·7.11.2·09 9.9.1에 같게 쓴다. 종료 코드는 0 = 전부 pass, 2 = fail 0이고 보류가 모두 허용표 안, 1 = 그 밖이다. 허용표는 `config/test-policy.json`의 `deferrable`이고 원천은 07장, 잠금 대상이다. **temp**(해당 묶음 provenance=temp일 때): `font-budget`, `asset-license-verify`, `normalizer-human`, `extractor-human-label`, `fewshot-count`, `high-risk-domains`, `legal-text`. **needs_live**(LLM_MODE≠live): `golden-live`, `judge-vision-live`, `model-promotion`. **manual**: `blind-*`, `usability-*`, `k6-staging`, `processor-approval`. **needs_ci**: `lock-digest`, `supabase-db-lint`, `supabase-storage-policy`, `gotrue-magiclink-e2e`, `gotrue-mfa`, `gotrue-google-metadata`, `worker-image-build`, `visual-docker-baseline`, `browser-webkit`, `browser-firefox`, `net-isolation-docker`. 표에 없는 단계가 보류 상태를 반환하거나 조건이 맞지 않으면 fail이다. 07 7.5.1 진단 API 부하는 로컬 스택에서 10 VU × 5분으로 재고 `perf.surveyApiP95Ms`로 판정한다(k6, 없으면 같은 프로파일의 autocannon). | 07, 09 |
| S-04 | **사람 없는 기준 고정점**(QA2-03, QA2-07 함께). 채택: QA2-03 보완안. `pnpm spec:extract`는 07 7.12.1 JSON 블록과 보류 허용표에서 `config/thresholds.json`·`test-policy.json`을 만든다. guard는 `git diff --exit-code`로 둘이 같은지 확인한다. 잠금 기준 ref는 `human-lock ?? spec-lock`이고, `spec-lock`은 P3 종료 커밋에 에이전트가 붙인다. 둘 다 없으면 FAIL이다. `QA_LOCK_DIGEST`가 없으면 needs_ci이고 종료 코드 0은 불가다. `qa:trace --audit`는 AC 수치 리터럴을 FAIL로 처리한다. 예외 리터럴은 {0, 1, 0.5, 100}뿐이고 `config/forbidden-allowlist.json`에만 둔다. | 07, 09 |
| S-05 | **thresholds 키 구조**(QA2-01). 원천은 07 7.12.1의 완전한 JSON 블록 1개다. 최상위는 `diagnosis`(02 값), `generation`(04), `perf`(SLO·a11y), `release`(출시 전용)뿐이고 키는 camelCase다. 평면 키와 snake_case는 폐지한다. 한 의미는 키 하나에만 둔다. `release.golden`의 `harmonyFloor`·`tasteFloor`·`sFreeFloor`·`costMaxUsd`는 `generation`으로, `firstExposeP50Sec`·`latencyP50Sec`·`latencyP95Sec`는 `perf`로 옮긴다. `release.perf`·`release.a11y`는 최상위 `perf`·`perf.a11y`로 옮긴다. 신규 키: `generation.costGuard{skipVisionUsd 0.24, skipRepairUsd 0.27, capUsd 0.30}`(S-13), `diagnosis.surveyAssetL1AbsMax 0.15`(S-06), `release.surveySim`의 `anchorAccPABeta8Min 0.95`·`priorTypeChangeMax 0.06`·`robustNoneRmseMax 0.13`·`seeds`·`maxTuningTrials 15`·`maxGateRuns 3`(S-08), `release.golden.m1`(S-07), `release.blind.strongBaseline*`(S-36). 다른 장은 키 경로만 참조한다(04 AC-04-43, 02 D-0214, 09 9.5.6·M3·M4). zod strict 검사(`scripts/guard/thresholds-schema.ts`)는 모르는 키나 빠진 키가 있으면 FAIL이다. | 07, 02, 04, 06, 09 |
| S-06 | **09장은 수치를 소유하지 않는다**(QA2-04, QA2-08 일부). 채택: QA2-04 보완안 a~f. a) M3 ③은 `release.extractor.roundtripAbsMax` 0.10(모든 프리셋·축)을 쓴다. 0.15는 `diagnosis.surveyAssetL1AbsMax`(D-0904)에만 쓴다. 05 5.9 왕복도 0.10이다. b) 폴백은 04 AC-04-25의 72조합이고 G-01~G-13 + H ≥ 80으로 판정하며 TM·S_free는 면제한다. c) 골든은 07 7.2.2·7.2.3의 32케이스가 원천이다. B16 스키마를 지우고 temp는 07 구성표를 JSON화한다(답안은 S-07, 01 BrandInput 검증 100%). M7 ⑥은 32다. d·e) 9.6.2 "기대 결과" 열을 지우고 07 TC-R을 참조한다(`low_score@*` 전 후보 = fallback, 환불). f) 골든 리포트 경로는 `eval/reports/<reportId>.json` 하나다. g) M3 ⑤는 04 4.15.2 p95 ≤ 15s를 쓴다. M4 ①은 "≥19쌍"으로 적는다. | 09, 07, 04 |
| S-07 | **골든 M1 재정의**(AI2-03, QA2-05와의 충돌 해소). 채택: AI2-03 보완안. 근거: R-05는 RMSE ≤ 0.12를 허용한다. 정규 오차라면 이때 \|e\| ≤ 0.12 비율은 약 68%다. 95%를 요구하면 RMSE ≈ 0.06을 요구하는 셈이라 R-05와 모순된다(재현 76%). 정확도 차단 판정은 R-05 시뮬레이션 한 곳에만 두고, 골든은 회귀 검출을 맡는다. **M1a(차단)**: typeId 24/24, 그리고 \|μ − `expected.muRef`\| ≤ 0.02인 축 120/120. muRef는 빌드 시 재생값이고 소수 6자리다. **M1b(기록)**: \|μ − θ*\| ≤ 1.645·σ_display 비율이 0.85 미만이면 margin_warning을 남긴다. `muRange`는 폐지한다. **QA2-05의 seed 재시도는 채택하지 않는다**. 운 좋은 로그를 골라내 골든을 오염시키기 때문이다. `build-answers`는 seed = 케이스 번호로 고정하고 typeId만 검사한다. 불일치하면 오프셋 축을 (A1,A2)에서 (A3,A4)로 바꾸는 결정론 규칙을 1회 적용한다. 그래도 불일치하면 빌드 실패이고 BLOCKED다. `engine_version` major가 바뀌면 02 2.15 재생으로 muRef를 갱신하고 사람 승인을 받는다(manual). 변이 테스트: β 8.0 → 8.5에서 M1a가 FAIL해야 한다. | 07, 02, 09 |
| S-08 | **진단 시뮬레이션 판정**(AI2-02). 합격선 숫자는 그대로다. 근거: 시드 간 SD(약 0.002)가 여유(0.001)보다 크다. 또 튜닝과 판정을 같은 표본으로 하면 선택 편향이 생긴다. 아래 변경은 분산과 편향만 줄이므로 판정이 더 엄격해진다. ① 판정은 `gate=[20261117..20261121]` × 1,000명 풀링 점추정으로 한다. 튜닝은 `dev=[20261116, 20261122, 20261123]`로만 한다. 두 집합은 교집합 0이고 잠금 대상이다. ② 적응형 이득은 공통 난수 쌍체로 계산하고 부트스트랩 95% 구간을 리포트에 넣는다. ③ 점추정이 합격선을 충족하면 PASS다. 구간이 합격선에 걸치면 margin_warning(비차단)이다. P-A는 n=800이다. ④ 조정 공간은 AI2-02 보완안 4의 값 집합으로 닫는다. 좌표 순차 탐색으로 dev 시도 ≤ 15회, gate 실행 ≤ 3회다. 상한에 닿으면 HUMAN_TODO에 BLK를 등록하고 G2-진단은 fail로 둔 채 M5 이후를 계속한다(HALT 계산 제외). 시드와 합격선 변경은 F 목록에 넣는다. ⑤ 2.16.2의 모든 행이 `release.surveySim` 키에 연결되는지 `qa:trace`가 검사한다. | 02, 07, 09 |
| S-09 | **AI 기준 자산 temp**(AI2-01). 채택: AI2-01 보완안. 번호는 S-41을 따른다. **B18** `data/normalizers/2026-S0.json`: 프리셋 8 × `allowed` 변형 25(seed 20261116) = 200 렌더로 만든다. 앵커 8, 카드 48, A/B 120은 홀드아웃으로 코퍼스에서 뺀다. 가중치는 `mapping.initial`이고 b0·b1만 최소제곱으로 맞춘다. `provenance:'temp'`, `inter_rater:'unverified'`. **B19** few-shot은 human 전용이다. 0개이면 `[FEWSHOT]` 블록을 빼고 `fewshot-count=temp`로 둔다. **B20** `config/copy_templates.json`·`axis_hints.json`은 `[임시]` 문장(4.6.2 길이 하한 충족)으로 채운다. 05 5.9 temp 분기: 실패 축은 `reliable[k]=false`, 카드·쌍은 draft, TM 가중은 0(D-056)이다. 홀드아웃 실패를 이유로 b0·b1을 재적합하는 것은 금지한다(F). 정규화기 변경은 `seed:temp` 산출 커밋만 허용한다(guard). 04 4.3 "toL1과 동일 계수"는 "predictL1 = 의도값, toL1 = 측정값, 차이는 05 5.9"로 고친다. | 09, 05, 04 |
| S-10 | **법무 경로와 temp 확인 기록**(LG2-07, 08/09 경로 충돌). 08장이 이긴다. 원문은 `legal/{terms,privacy,sources}.md` 3개다. AI 고지·비제휴 문구는 `copy/ko.ts`가 소유한다. 09 B17을 이에 맞추고 `data/legal/` 표기는 0건이어야 한다. 묶음 B21(high_risk_brands, temp ≥ 80개, `domains:[]`), B22(prohibited_categories), B23(`legal/processors.yaml`·`data-flows.yaml`, temp는 `approved:false`, mock에서는 승인 검사 생략)을 둔다. 자산 temp는 `verified_by:'temp-agent'`, `verified_at:null`을 허용한다. 대신 temp가 1건이라도 있으면 `asset-license-verify=temp`이고 종료 코드 0은 나올 수 없다. LG2-07의 "실패"는 "출시 불가(≠0)"로 읽는다. 이렇게 해야 S-03의 종료 코드 2와 AC-09-01이 함께 성립한다. `verified_by≠temp-agent`인데 `verified_at=null`이면 fail이다. AC-08-23은 "release 모드에서 전 항목 사람 확인"으로 고친다. Noto CJK는 temp 레지스트리 항목으로 두고, `LicenseRef-TasteFit-Generated`를 enum에 추가한다. guard는 에이전트가 `verified_by`·`approved`·`tos_checked_at`·`robots_checked_at`·`provenance`를 temp에서 다른 값으로 바꾸면 FAIL이다. `seed:temp`는 HUMAN_TODO에 "법무 문안 확정"을 자동으로 추가한다. | 08, 09 |
| S-11 | **MockProvider 역할별**(AI2-05, QA2-08). 채택: AI2-05 보완안. 9.6.2를 R-12 역할 4개로 다시 쓴다. `gen_layout`은 덱 참조만 쓰고 텍스트 리터럴은 0이다. `judge_vision`은 JudgeResult 형식이다(고정 점수 0.70 폐지). mock은 이미지를 고르지 않는다. 시나리오 `mixed`(후보 0~5 할당은 원문)를 `eval:golden --mode mock` 기본으로 둔다. 시나리오 키는 `scenario@candidateIndex`와 `scenario@role`을 허용한다. M7 ⑥ 추가 조건: `repair_quality` ≥ 1, 다양성 재호출 ≥ 1, partial ≥ 1, 노출 전부 AC-04-20 충족. `page_generate`·`vision_score`·mock `requiredSections` 규칙·`prompts/{role}.v{N}.md`는 0건이어야 하고, 프롬프트 경로는 `<role>@v<N>.md`다. | 09, 04 |
| S-12 | **`gen_copy` 실패**(AI2-04). 채택: AI2-04 보완안. 순서는 repair_schema 1회 → 잡 경과 ≤ 60초일 때만 fallback 모델 1회 → `buildTemplateDeck`. 템플릿 덱을 쓰면 `generation_jobs.copy_source='template'`(enum `llm\|template`)이고, 상태는 R-15 값과 partial 중 낮은 쪽이며, 경고 `COPY_FALLBACK`를 남긴다. 공급자 안전 거부는 우회하지 않는다. failed + `BLOCKED_BRAND{reason:'content_policy'}`이고 환불한다. 시나리오 3종(`copy_*@gen_copy`)을 9.6.2에 넣고, 기대 결과는 07 TC-R에 적는다. | 04, 06, 07, 09, 01 |
| S-13 | **잡 예산 예약-정산**(TL2-03). 채택: TL2-03 보완안. 원천은 06 6.9.4이고 04 4.17.2는 참조만 한다. 판정식은 `spent + reserved + est ≤ generation.costGuard.capUsd`이고, 잡 단위 뮤텍스 아래 reserve/settle/release로 동작한다. `est`는 실측 입력×1.1 기준 식 하나다. `worstCost`는 폐지한다. 기본 경로 추정은 $0.33에서 약 $0.23이 된다. 추정 정확도를 고친 것이고 상한은 그대로다. DB CHECK는 `cost_usd ≤ 0.36`(cap × 1.2)으로 바꾼다. 이 CHECK는 실제 청구가 추정을 넘어도 잡이 죽지 않게 하는 저장 제약이다. 가드 상한 0.30과 "cost_spike 합계 ≤ 0.30" 수용 기준은 유지하고, 0.30 초과는 A11 경고로 잡는다. `pricing`에 `cache_write_per_mtok`를 추가한다. mock 단가는 USD/M 기준 입력 3, 출력 15, 캐시 읽기 0.30, 캐시 쓰기 3.75, 비전 1/5로 고정한다. | 06, 04, 09 |
| S-14 | **동시성·용량**(TL2-04, PM2-01과 정합, R-16 보완). `WORKER_GEN_CONCURRENCY`(기본 2)를 둔다. 실효 상한은 `min(GEN_MAX_CONCURRENT_JOBS=5, 머신 수 × 2)`다. MVP는 머신 1대이므로 실효 2이고, 초과분은 대기 순번으로 표시한다. 유료 머신은 추가하지 않는다. S-15 수요(월 ≤ 600잡, 일 약 20잡)에서 피크 2면 충분하다는 근거를 6.16에 적는다. 렌더 큐는 잡별 라운드로빈이다. 6.16 식은 `p95_est = t_llm_p95 + ceil(C×6/RENDER_MAX_CONTEXTS) × t_render_p95 + t_gate`이고, `pnpm bench:render` 결과(`reports/bench-render.json`)를 넣어 `release:check`가 `p95_est ≤ perf.latencyP95Sec`를 확인한다. | 06, 00, 01 |
| S-15 | **목표를 예산에 맞춘다**(PM2-01). 예산(월 150, 일 10 USD)은 유지한다. 유료 지출 증액은 사람 결정이다. 00 §9.4 검산 표: `WAM_max = (150/0.25)/4.35 × 0.6 × 0.4 ≈ 33`. 공개 출시 8주차 WAM ≥ 30, O2 8주 누적 채택 ≥ 150, Phase 2 진입 ① WAM ≥ 30. WAM 100은 "예산 상향 후" 목표로 옮긴다. "예상 월 생성"은 600이다. Phase 2 진입 ④는 "KS-1로 막힌 날 ≤ 3일/월 + GR-10 4주 평균 충족"으로 바꾼다. | 00 |
| S-16 | **취소 시 한도**(PM2-02). 채택: PM2-02 보완안. 취소 시점 비폴백 노출이 1 이상이면 차감하고 0이면 환불한다. queued와 running은 구분하지 않는다. 00 §9.3, 06 6.2.3, 04 4.12, 01 1.6.5를 같은 문장으로 고치고 통합 테스트 3건을 둔다. | 00, 06, 04, 01 |
| S-17 | **KPI 쿼리**(PM2-03). 채택: PM2-03 보완안. 퍼널 result에서 공유 열람을 뺀다. 베타 기간 F6·F7 분모는 `invite_redemptions` 주체로 한정한다. F4는 결과당 마지막 평가만 센다. F8은 7일 코호트로 센다. AC-00-13 픽스처 4종을 추가하고 모든 비율이 [0,1] 안인지 확인한다. | 00, 07 |
| S-18 | **검증 표본 운영**(PM2-04). 채택: PM2-04 보완안(00 §5.4 신설). 모집 글 1회를 허용하고 §7.2 문구는 "공개 SNS·광고 없음"으로 바꾼다. 재검사는 S03 안내 + S12 배너로 유도하고 이메일은 쓰지 않는다. A5는 인앱 1문항 시트로 받는다. 이벤트 `adoption_followup_answer`를 00 §8.3과 zod에 추가한다. 표본 미달이면 2주 연장을 최대 2회 하고, 그래도 미달이면 베타 2차로 간다. waiver 금지는 유지한다. 07 7.3.1 재검사는 "공개 출시 조건, 자동 게이트 아님"으로 적는다. | 00, 01, 07 |
| S-19 | **출시 단계·명칭·값**(PM2-05). 채택: PM2-05 보완안(원천 00장). 06~09장에서 `P0-α`·`P0-β`·`G0~G4`·`G0 ④⑤`·`공개 베타`를 0건으로 만든다. 07 7.9.1은 00 §5.3 참조 1줄로 줄인다. 07 7.3.1 완료율은 ≥ 65%다. 00 A3·Q2에 P-1b를 추가한다. 07 D-0716의 v1 값 인용은 삭제한다. `BETA_INVITE_ONLY` 설명은 "true(비공개 베타)"로 고친다. 비관리자의 관리자 경로 접근은 **404**로 통일하고 09 M7 ②도 고친다(AC-00-19 원천). | 07, 06, 08, 09, 00 |
| S-20 | **보관 파기**(TL2-05). 채택: TL2-05 보완안. 원천은 06 RetentionRule이다. `candidates_unexposed_30d`는 mockups가 참조하지 않는 후보만 지운다. `renders_orphan`은 참조 0일 때만 지운다. 규칙별 1,000행씩 별도 트랜잭션으로 돌리고, 실패 규칙 ID는 감사 로그에 남긴다. 08 표기는 "노출되지 않은 후보"와 `diagnosis_sessions`로 고친다. `verify:schema-parity`가 08 보관표 구현 기준 열 ⊆ 06 DDL을 검사한다. | 06, 08 |
| S-21 | **탈퇴 절차**(LG2-04). 채택: LG2-04 보완안. 06 6.2.5 `account-delete`는 원문의 ①~⑦ 멱등 단계로 돌고 재시도는 5회다. `consents_archive.user_hash = HMAC-SHA256(user_id, CONSENT_HASH_KEY)`이고 키는 교체하지 않는다. `sanctions(email_hash, level, until, reason_code)`를 두고, 재가입 시 생성 API는 403 `ACCOUNT_SUSPENDED`다. `admin_audit_logs.admin_id` FK는 `admin_hash text`로 바꾼다. 08 8.7.7에 `consents_archive`(1년)와 `sanctions`(until까지, 최대 1년)를 넣고 처리방침 4절에도 적는다. | 06, 08 |
| S-22 | **pgvector 제거**(TL2-07). 06 DDL에서 `vector` 확장과 `embedding`·`embedding_model` 컬럼을 삭제한다. 05 D-055에 "Phase 2 additive 마이그레이션"이라고 적는다. | 06, 05 |
| S-23 | **세션 운영 ↔ 구현 운영 매핑**(TL2-06). 채택: TL2-06 보완안(09 9.5.7 신설). 제품 공백은 `docs/ASSUMPTIONS.md`, 운영·환경 결정(S-01·S-02 적용 포함)은 `docs/spec/DECISIONS_LOG.md`에 쓰고 서로 가리키는 1줄을 둔다. BLOCKED.md가 원본이고 사람이 할 일만 HUMAN_TODO로 복사한다. PROGRESS.md는 P1~P5를 유지하고 P4 안에 9.7 형식을 넣는다(`lock`·`limit` 유지). CLAUDE.md는 "세션 운영"과 "구현 규칙" 두 절이고, 300줄 제한은 "구현 규칙" 절에만 적용한다. verify는 `.partial.json`을 남기고 재시작하면 처음부터 돈다. 3회 연속 녹색은 같은 `gitSha`면 세션이 달라도 인정한다. 90분은 PROGRESS 로그의 누적 시간으로 잰다. | 09 |
| S-24 | **악용 방지 적용 지점·금지 업종**(LG2-01, AI2-04 enum 통합). 채택: LG2-01 보완안. 판정 함수는 `packages/compliance/abuse.ts` 하나다. 08 8.9.2 "입력별 적용 단계 표"가 원천이고 06 6.11.2는 이를 참조한다. 신고·문의 본문은 판정하지 않는다. 하드 게이트 `G-13 abuse_terms`를 두고 R-13 게이트 범위는 G-01~G-13이다. 편집 저장 실패는 422 `EDIT_GATE_FAILED` + `GATE_FAILED:G-13`이다. 금지 범주는 `gambling\|adult\|illegal_loan\|drugs\|weapons\|counterfeit`이고 범주당 ≥ 10 키워드(B22)다. **`BLOCKED_BRAND.reason` = `high_risk\|phishing_term\|prohibited_category\|content_policy`**이고 원천은 06 오류 표다. 01 1.12에 2행을 추가한다. AC-08-41b/c/d를 둔다. | 08, 06, 04, 01 |
| S-25 | **OAuth 메타데이터 삭제**(LG2-02). 채택: LG2-02 보완안. `auth.users`·`auth.identities` INSERT/UPDATE 트리거가 키 집합을 {`email`, `email_verified`, `provider_id`, `sub`, `iss`}로 줄인다. native는 shim에 공급자 형태 행을 직접 넣어 시험하고, 실제 Google 흐름은 `gotrue-google-metadata` needs_ci다. 키 덤프는 `docs/compliance/auth-metadata.md`에 둔다. | 06, 08 |
| S-26 | **데이터 흐름·국외 이전**(LG2-03). 채택: LG2-03 보완안. 06 "구성요소 × P1~P13 흐름표"가 원천이고 `legal/data-flows.yaml`이 그 코드다. `processors.yaml.items`는 여기서 파생하고 CI `compliance:flows`가 검사한다. 최소 기대값: `flyio ⊇ {P2,P4,P5,P6}`, `vercel ⊇ {P1,P2,P3,P4,P8,P9,P11,P13}`, `llm-judge ⊇ {P5}`. 국외 판단은 사람 확인 전까지 보수적으로 표에 넣는다. | 06, 08 |
| S-27 | **익명 창구 방어**(LG2-05). 채택: LG2-05 보완안. 세 창구 모두 Turnstile이 필수다. `rep:day:ip:<hmac>` 10회/일을 06 D-0618 표에 추가한다. 확인 메일은 고정 템플릿이고 수신자당 하루 1통이다. `privacy_request`는 계정 이메일 확인 링크(1회, 24시간) 클릭 후에만 처리한다. 자동 비공개 시 소유자에게 통지하고, `ip_hmac`이 7일에 dismissed 3건을 넘기면 자동 비공개를 하지 않는다. | 08, 06, 01 |
| S-28 | **관리자 접근 통제**(LG2-06, S-19와 정합). 채택: LG2-06 보완안. 관리자 경로는 `aal2`만 허용하고, `aal1`이면 API 404·화면 `/admin/mfa`다. `ADMIN_EMAILS`는 매 요청 재확인한다. PII 열람은 `pii_view` 감사 행을 남긴다. `before/after`는 리댁션한다. 접속기록은 기본 1년 보관 + 월 1회 점검이다(09 운영 체크리스트). 콘솔 MFA는 08 8.15 수동 항목이다. native는 local TOTP로 시험하고 Supabase MFA는 needs_ci다. | 06, 08, 09, 00 |
| S-29 | **결과 화면 안내**(UX2-01, UX2-04 일부). 채택: UX2-01 보완안. 문구는 01 1.15.3(`copy/ko.ts`)이, 조건·우선순위는 02장이 소유한다. 순서 `low_signal → conflict → κ<0.50 → is_boundary` 중 하나만 표시하고 신뢰도 1줄을 붙인다. 백분율은 0건이다. 키 7개는 원문대로다(`result.notice.*` 5, `result.axis.*` 2). open 판정은 서버 `axes[].state`(σ > 0.08, `diagnosis` 키)만 쓰고, 01장의 0.10은 삭제한다. 1.15.3 머리에 "카피 표가 본문을 이긴다"를 적는다. | 01, 02, 06 |
| S-30 | **자극물 표시 크기**(UX2-02). 채택: UX2-02 보완안. mobile은 `card_h = 100dvh − 232`, 하단 고정 바 120, 카드 안 스크롤 0, `card_h < 300`이면 회전 안내다. desktop은 `w_min = 480px`이고, 미달이면 2×2 세로 스크롤로 보여 준다. 응답에 `ux.cardScale`을 기록한다. mobile 자산이 없는 문항은 mobile 후보에서 뺀다. | 01, 02, 06 |
| S-31 | **편집 허용 = 기기, 배치 = 뷰포트**(UX2-03). 채택: UX2-03 보완안. 편집 허용은 `(pointer: fine) \|\| screen.width ≥ 768`이다. 허용 상태에서 뷰포트 < 768이면 1열 탭 레이아웃이다. 01 1.3.1·1.8.7·1.9·D-0112와 00 §7.1을 고친다. | 01, 00 |
| S-32 | **변형 차이·보정 사유**(PD2-01). 채택: PD2-01 보완안. `MockupCard.movedAxes`(최대 2)와 `diffFromTrue`(v_true는 [])는 결정론으로 만든다. 카피 키는 `calib.purpose`·`calib.type`·`calib.distance`와 L2 쉬운 말 사전이다. v_true 문구는 "진단한 취향에 가장 가깝게 만들었어요"로 바꾸고 칩이 붙을 수 있음을 명시한다. "원래대로 보기"는 [P2]이고 00 §7.1에 넣는다. | 06, 01, 04, 00 |
| S-33 | **프리셋 ↔ 린터**(PD2-02). 채택: PD2-02 보완안. `Preset.allowSoftRoundShadow`(T3·T4·T6 = true)를 두고 04 AIL-06 이름을 맞춘다. 카드 그림자 단계 = `depth.shadow_level`, 강조 +1(최대 2)이다. FP15 heading 한글은 Wanted Sans 800이다. CI `presets:lint-matrix` 실패 조합은 `harmony.json.conflicts` CF-13부터 등록해 자동으로 제외한다. 클라이언트 즉시 검사에 AIL-03·06·09·16을 추가한다. | 03, 04 |
| S-34 | **사진 톤·업종**(PD2-03). 채택: PD2-03 보완안. 4.9.4 `tonePref`는 warm(temperature ≥ 0.60) / cool(≤ 0.40) / neutral이고 반대 톤은 제외한다. `config/image_tag_keywords.json`(B24)은 약 50항목이고 temp를 허용한다. 매칭 0이면 사진을 대체한다. 01 안내 키는 `drafts.photoSubstituted`다. portfolio `work`·`showcase` 이미지는 `placeholder:true`다. 03 D-0309는 "반영"으로 바꾼다. | 04, 03, 01 |
| S-35 | **styleguide**(PD2-04). 채택: PD2-04 보완안. 04 4.16.1 공통 파일에 `styleguide.html`을 추가한다. LLM은 쓰지 않고 `ResultView.guide`와 같은 함수를 쓴다. 검사 번호는 **E-14**다(대비값 = G-02 계산값 소수 1자리). 03 3.18과 파일 목록을 같게 둔다. | 04, 03 |
| S-36 | **차별점 비교군**(PD2-05). 채택: PD2-05 보완안. 모두 기록 전용이고 출시 합격선은 바꾸지 않는다. P-2s(`eval/blind/baseline_strong_prompt.md`, 선호 ≥ 0.60·Wilson LB ≥ 0.45, 미달이면 DF-2 붕괴 신호), P-4b(≤ 0.55면 "개인 오프셋 효용 미확인"), P-1a 층화 8/6/6. 00 §5.1에 A2s·A1c를 둔다. | 07, 00 |
| S-37 | **밝은 브랜드 컬러**(UI2-01). 채택: UI2-01 보완안. 사전 가능성 판정 후 primary → accent → tint → ignored 순서로 반드시 종료한다(반복 ≤ 74). `brand_color_notice = null\|adjusted\|demoted_to_accent\|used_as_tint\|ignored`이고 01 카피·06 MockupCard·04 DesignSpec에 같게 쓴다. AC-03-36 픽스처 4색을 추가하고 1회 ≤ 5ms다. | 03, 04, 01, 06 |
| S-38 | **텍스트 역할·H7**(UI2-02). 채택: UI2-02 보완안. `data/taxonomy/text-roles.json`(B25, 03 3.1.5a)을 두고 템플릿은 `data-role`만 쓴다. 단계 이름은 `t-display`, `t-1`… 로 시맨틱 태그와 분리한다. **H7 = display 토큰 계산값 / base(1280)**, 즉 03장 정의로 통일한다. 원천이 `harmony.json`(D-0310)이므로 04 표는 생성본으로 둔다. 범위 2.5~8.0은 그대로다. 04장 h1 정의는 원천과 다른 사본의 오류였다. | 03, 04 |
| S-39 | **헤드라인 줄 예산**(UI2-03). 채택: UI2-03 보완안. `headlineBudget` 식과 계수 0.95·0.85를 쓴다. `blocks.json`에 `text_cols`를 넣는다. 덱 3옵션 중 ≥ 1개는 `maxChars` 이하여야 하고 G-01이 검사한다. 넘침은 교체 → 1단 하향(`spec.render_adjustments[]`) → warn 순서다. AC-03-26은 "③ 0건(골든)"으로 고치고 하향 비율 ≤ 25%를 기록한다. | 03, 04 |
| S-40 | **맥락별 폰트 서브셋**(UI2-04). 채택: UI2-04 보완안. 원천은 03 3.7.5 표다. 편집기와 후보 카드는 `ks-x-1001` 정적 + `page` 보충(디바운스 1초)이다. 내보내기는 `page` + `fonts/extended/` ks-x-1001이다. enum은 `full\|ks-x-1001\|latin\|page`이고 03·09에 같게 쓴다. 측정 iframe은 `document.fonts.ready` 후에 잰다. 반영 p95에서 첫 폰트 로드는 제외한다. 내보낸 코드의 폴백 0 검사는 **E-15**다. | 03, 01, 06, 09, 04 |
| S-41 | **번호·enum 배정**(리뷰 간 번호 충돌 해소). 09 묶음 번호: B18 정규화기, B19 few-shot, B20 copy_templates·axis_hints, B21 high_risk_brands, B22 prohibited_categories, B23 processors·data-flows, B24 image_tag_keywords, B25 text-roles. AI2-01·LG2-07이 각각 제안한 B18·B19는 이 번호로 대체한다. E-14 styleguide, E-15 확장 폰트, G-13 abuse_terms. 코드: `COPY_FALLBACK`(경고), reason 4값(S-24). 신규 테이블·컬럼: `consents_archive`, `sanctions`, `dev_mail_outbox`(local 전용 마이그레이션, prod 세트 제외), `generation_jobs.copy_source`, `admin_audit_logs.admin_hash`. 신규 이벤트: `adoption_followup_answer`. | 09, 04, 06, 00 |

### 반영 순서

한 단위는 30~45분이다. 원천 장부터 고친다.

1. **07-a**: S-05 thresholds 블록, S-04 spec:extract·spec-lock
2. **07-b**: S-03 허용표·enum·부하, S-07 골든 M1, S-06 f
3. **07-c**: S-19 명칭, S-11·S-12 TC-R, S-36, S-17·S-18 연결
4. **06-a**: S-01 스택 프로파일·오리진·CSP, S-22
5. **06-b**: DDL (S-20, S-21, S-25, S-41 컬럼)
6. **06-c**: S-13 예산, S-14 용량·6.16, S-16 상태-한도
7. **06-d**: S-24·S-27·S-28 보안·오류 표, S-26 흐름표, S-32·S-37 MockupCard
8. **09-a**: S-01·S-02 환경·HALT, S-23 9.5.7
9. **09-b**: S-09·S-10·S-41 묶음 B17~B25·temp 규칙, S-06 a~e·g
10. **09-c**: S-11 Mock, S-12 시나리오, S-08 M4, S-19 M7 404
11. **04-a**: S-13 참조, S-12 gen_copy, S-16, S-09 4.3
12. **04-b**: S-24 G-13, S-33, S-34, S-38 H7, S-39 덱 제약
13. **04-c**: S-35 E-14, S-40 E-15, S-32, S-37, S-05 키 이름
14. **03**: S-33, S-37, S-38, S-39, S-40, S-35 3.18
15. **02**: S-08, S-07 muRef, S-29 키 참조, S-30 필터, S-05 키
16. **05**: S-09 5.9 temp 분기, S-22, S-06a
17. **01**: S-29, S-30, S-31, S-32·S-34·S-37 카피, S-24 1.12, S-16, S-40 1.8.5
18. **08**: S-10, S-24 적용 표, S-25~S-28, S-20·S-21 보관표
19. **00**: S-15, S-16~S-18, S-19 P-1b, S-31, S-32 [P2], S-36, §14 상태 갱신
20. **검사**: 잔재 grep. `muRange`, `data/legal/`, `page_generate`, `vision_score`, `P0-β`, `vector`, `allow_soft_round_shadow`, 평면 thresholds 키가 0건이어야 한다.

### 사람 확인 필요

에이전트가 결정하지 않는다. 각 항목은 HUMAN_TODO로 옮기고, 그동안은 temp·manual·needs_ci 상태로 진행한다.

- 법무 문안 3종 확정과 변호사 검토 (S-10)
- 국내 리전에서 실행하는 국외 법인 호스팅을 국외 이전으로 볼지 (S-26, 8.14 Q5)
- 정지 이력 이메일 해시 1년 보관의 근거 (S-21, Q6)
- 금지 업종 범주·키워드의 적정성 (S-24, Q13)
- 안전성 확보조치 고시의 적용 범위와 접속기록 보관 기간 (S-28, Q16 신설)
- 고위험 브랜드 목록·도메인 사실 확인, 자산 라이선스 확인, 처리위탁 공급자 승인 (S-10)
- few-shot 48개 작성·승인, 정규화기·추출기 사람 라벨 (S-09)
- 콘솔 MFA, service role 키 보관 (S-28)
- `QA_LOCK_DIGEST` 설정, 워크플로 push 권한, CI의 webkit·firefox·Docker 기준선·GoTrue 결과 확인 (S-01·S-02·S-04)
- 베타 모집 글 게시, 평가자·참가자 섭외, 보상 지급 (S-18)
- 예산 증액과 WAM 100 복귀 여부 (S-15·S-14)
- 시뮬레이션 조정 상한 도달 시 판단 (S-08), muRef 갱신 승인 (S-07)
- staging 부하 재측정, 사용성 테스트 R1·R2 (S-03·S-19)

### 출처 대응표

| 리뷰 항목 | 심각도 | S-ID |
|---|---|---|
| TL2-01 | Blocker | S-01, S-03, S-23 |
| TL2-02 | Blocker | S-02, S-03 |
| AI2-01 | Blocker | S-09, S-41 |
| AI2-02 | Major | S-08, S-05 |
| AI2-03 | Major | S-07 |
| AI2-04 | Major | S-12, S-24 |
| AI2-05 | Major | S-11 |
| LG2-01 | Major | S-24 |
| LG2-02 | Major | S-25 |
| LG2-03 | Major | S-26 |
| LG2-04 | Major | S-21 |
| LG2-05 | Major | S-27 |
| LG2-06 | Major | S-28 |
| LG2-07 | Major | S-10, S-41 |
| PD2-01 | Major | S-32 |
| PD2-02 | Major | S-33 |
| PD2-03 | Major | S-34 |
| PD2-04 | Major | S-35 |
| PD2-05 | Major | S-36 |
| PM2-01 | Major | S-15, S-14 |
| PM2-02 | Major | S-16 |
| PM2-03 | Major | S-17 |
| PM2-04 | Major | S-18 |
| PM2-05 | Major | S-19 |
| QA2-01 | Major | S-05 |
| QA2-02 | Major | S-03 |
| QA2-03 | Major | S-04 |
| QA2-04 | Major | S-06 |
| TL2-03 | Major | S-13, S-05 |
| TL2-04 | Major | S-14 |
| TL2-05 | Major | S-20 |
| TL2-06 | Major | S-23 |
| TL2-07 | Major | S-22 |
| UI2-01 | Major | S-37 |
| UI2-02 | Major | S-38 |
| UI2-03 | Major | S-39 |
| UI2-04 | Major | S-40 |
| UX2-01 | Major | S-29 |
| UX2-02 | Major | S-30 |
| UX2-03 | Major | S-31 |
| QA2-05 · QA2-07 · QA2-08 · UX2-04 | Minor | S-07(QA2-05 불채택) · S-04 · S-06 g·S-11 · S-29 |

Blocker 3건과 Major 37건이 모두 대응된다. 나머지 Minor는 각 장 반영 때 리뷰 원문 보완안대로 처리한다. 레지스터와 충돌하면 레지스터가 이긴다.

---

<a id="src-decisions-v2"></a>
## 원본: `docs/spec/decisions_v2.md` (R-01~R-38)

## 통합 결정 v2 (장 간 충돌 해소) — decisions.md보다 우선

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

---

<a id="src-decisions"></a>
## 원본: `docs/spec/decisions.md` (D-01~D-51)

## 결정 레지스터 (v2 공통 기준) — 모든 장은 이 결정을 따른다

리뷰어 간 상충을 정리한 확정값. 장 작성자는 이 값을 바꾸지 말고, 새 결정이 필요하면 자기 장 끝 "추가 결정" 절에 D-xx 형식으로 기록한다.

### 제품
- D-01 서비스 가칭: "취향핏(TasteFit)". "MBTI"라는 단어는 UI·서비스명·마케팅에 쓰지 않는다(상표). 결과는 "디자인 성향 유형"이라 부른다.
- D-02 1차 타깃(P1): 랜딩 페이지가 필요한 1인 창업자·프리랜서·소규모 브랜드 운영자(디자이너 없음). 2차(P2): 웹 개발자(코드 내보내기 활용). 진단 결과 공유는 획득 채널이지 1차 가치가 아님.
- D-03 MVP 결과물: 원페이지 랜딩 1장. 용도 3종 = ①SaaS·앱 소개 ②포트폴리오·개인 브랜드 ③로컬 비즈니스(카페·식당·공방). 쇼핑몰·다페이지·블로그는 Phase 2 이후.
- D-04 North Star: 주간 "채택 시안 수"(내보내기 또는 공유 링크 생성까지 간 시안). 수치 목표는 PM 장에서 정의.
- D-05 단계: MVP(P0) → Phase 2(자동 수집·트렌드 감지·다페이지·다크모드 쌍) → Phase 3(Figma 내보내기, 16유형, 자연어 편집, 결제).

### 진단
- D-10 취향 벡터 = L1 인지 축 5개, 각 연속값 [0,1]: A1 표현성(미니멀0↔표현적1), A2 온도(차가움0↔따뜻함1), A3 형태(날카로움0↔부드러움1), A4 밀도(여유0↔밀도1), A5 깊이(평면0↔입체1). "클래식↔트렌디"는 축이 아니라 시즌 메타데이터.
- D-11 L2 이산 파라미터(타이포 페어링, 팔레트 구조, radius 계열, depth 종류, 레이아웃 패턴, 이미지 스타일, 모션 수준)는 L1 벡터+유형+용도에서 매핑표로 결정된다. 사용자는 L2 원시값(hex, px)을 직접 고르지 않는다.
- D-12 갱신 알고리즘: 축별 가우시안 사후분포(평균 μ, 표준편차 σ). 초기 μ=0.5, σ0=0.25(용도별 약한 사전분포 허용). 선택은 이상점 다항 로짓(β=8)으로 모델링, 1-step 근사 갱신. 세부 수식은 진단 장에서.
- D-13 문항: 1단계 4지선다 8문항 + 2단계 A/B 최대 8문항 = 총 16문항 이하. 종료: 모든 축 σ≤0.08 이거나 16문항 도달. 목표 소요 중앙값 4분 이내. 응답 선택지에 "다 별로예요"(4지), "차이를 모르겠어요"(A/B), 뒤로가기 1단계 허용.
- D-14 설문 자극물: 실제 사이트 스크린샷이 아니라, 콘텐츠를 고정한 템플릿에 프리셋 토큰만 바꿔 사전 렌더한 오리지널 이미지. 1단계 카드 풀 48장, 2단계 A/B 쌍은 축별 수준 조합으로 사전 렌더(약 240장). 실제 사이트는 결과 화면 "닮은 사이트" 텍스트 링크로만 노출.
- D-15 유형: MVP 8개 고정(Phase 3에서 16개). 각 유형 = 이름·설명 고정 텍스트 + 앵커 프리셋 1개. 판정은 벡터와 유형 중심 간 거리 최소(결정론적), 동률·경계 처리 규칙은 진단 장에서.
- D-16 "3단계 요소 미세조정"은 진단에서 제거하고 편집 화면으로 이동. 편집은 검증된 단계 사이 이동(스텝 컨트롤)과 후보 카드 선택만. 자연어 편집은 Phase 3.

### 생성
- D-20 최종 시안 3개 = V-TRUE(취향 그대로) / V-FIT(용도 최적) / V-BAL(균형). 1장의 "과감하게/안정적으로" 표현은 폐기.
- D-21 LLM은 CSS·HTML을 출력하지 않는다. 출력 = 레이아웃 트리 JSON(섹션 블록 ID, variant, 슬롯 카피, 이미지 슬롯 키). 코드는 서버의 결정론적 컴파일러가 token+블록으로 생성.
- D-22 후보 6개 생성 → 렌더 → 하드 게이트 → 점수 → 상위에서 변형별 1개씩 3개 노출.
- D-23 품질 게이트: 하드 게이트(대비 WCAG AA, 넘침·겹침 0, 스키마 유효, 린터 error 0) 통과 필수. 조화 점수 ≥80, 취향 일치도 ≥75(100점 만점) 노출. 미달 시 재생성 최대 1회 → 그래도 없으면 결정론적 기본 시안(앵커 프리셋+표준 블록)으로 폴백해 최소 1개 보장.
- D-24 생성 SLO: p50 ≤60초, p95 ≤90초, 120초 초과 시 폴백 경로, 180초 강제 종료. 원가 상한: 생성 요청 1회 ≤ US$0.30, 일 전체 지출 상한(킬 스위치) 설정값.
- D-25 검증 뷰포트: 375, 768, 1024, 1280, 1920. 다크 모드: MVP는 시안당 테마 1벌(프리셋이 라이트/다크 결정), 쌍 생성은 Phase 2.
- D-26 내보내기: ①정적 HTML+CSS(zip) ②React+Tailwind(zip) ③DTCG design tokens JSON. 외부 CDN 의존 0, LICENSES.md·CREDITS.md 자동 포함.
- D-27 서체: OFL 등 상업 이용·재배포 가능한 라이선스만, 자체 호스팅. 한글 12종·영문 14종·검증 페어링 20쌍(모든 페어링은 한글 폰트를 필수 포함). 첫 화면 폰트 전송 ≤300KB. 아이콘: Phosphor/Tabler/Iconoir(MIT 계열). 이미지: 직접 큐레이션한 라이선스 확인 이미지 팩(CC0/Unsplash 라이선스), AI 생성 이미지 MVP 제외.
- D-28 서비스 자체 UI도 AI 티 린터를 통과해야 하며 shadcn 기본 스타일 그대로 사용 금지(시안 렌더러에는 shadcn 미사용).

### 데이터·트렌드
- D-30 MVP 레퍼런스: 수동 큐레이션 시드 60개(티어·스타일 고르게), 사람 라벨 포함. 자동 크롤러·주간 수집·급등 감지·임베딩 군집은 Phase 2. MVP 트렌드 갱신 = 월 1회 수동 리포트 + 분기 시즌 릴리스.
- D-31 스크린샷: 비공개 저장, 사용자 비노출, 90일 후 자동 삭제. 시안 token은 단일 사이트 복제 금지(서로 다른 도메인 3곳 이상 집계값만).

### 기술
- D-40 스택: Next.js(App Router, TypeScript) 웹앱 + 별도 Node 워커(Playwright, 렌더·채점·추출) + Postgres(Supabase) + 잡 큐 pg-boss + Supabase Storage + Supabase Auth.
- D-41 인증: 진단은 익명(쿠키 세션), 시안 생성·저장·내보내기는 로그인(이메일 매직링크, Google). 로그인 시 익명 세션을 계정에 귀속.
- D-42 LLM: Vercel AI SDK 단일 게이트웨이 + models.yaml(역할→모델·파라미터·프롬프트 버전) + MockProvider(외부 키 없이 전체 테스트 통과). 학습 미사용 API 티어만, 승인된 공급자만(자동 라우팅 서비스 미사용).
- D-43 미리보기: 별도 오리진 sandbox iframe + 엄격 CSP. 브랜드 입력은 길이 제한·정규화·인젝션 방어 후 LLM에 데이터 블록으로만 전달.
- D-44 모델 교체: 카나리 대신 오프라인 승격 규칙(골든 세트 + 블라인드 평가)으로 MVP 운영.

### 법무
- D-50 MVP 레퍼런스는 수동 큐레이션만, robots·약관 존중, opt-out 7일 내 처리. 닮은 사이트는 텍스트 링크 + 비제휴 고지.
- D-51 개인정보 최소 수집, 국외 이전 고지, 데이터별 보관 기간표, 삭제 기능, AI 생성물 고지·라벨. 결과물은 사용자에게 상업 이용 허락.
