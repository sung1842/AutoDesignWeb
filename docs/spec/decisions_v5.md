# 통합 결정 v5 (4라운드 장 간 충돌 해소) — decisions_v4.md 이하보다 우선

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

## 반영 순서

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

## 사람 확인 필요

- 없음(새 항목 없음). Q6(증거·hold 90일)·Q16(P14 90일)은 기존 HUMAN_TODO 그대로. U-06의 미처리 연장은 Q6 확인 시 함께 본다.
