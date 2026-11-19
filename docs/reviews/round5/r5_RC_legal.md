# R5 리뷰: 법무·개인정보·보안 관점 (R-C)

- 대상 절: `git diff dc8ffe2..HEAD`의 R-C 배정 변경. 06 6.2.5(순서·③b/③·`deleteOwnedRenders`·재가입), 6.3.3 변경 줄(`users.suspend_source`·`provision_user`·`abuse_holds.until` 주석), 6.4.3(`DELETE /api/projects/:id`·ADM-04 PATCH·ADM-11 필터·verify 302), 6.6(`abuse-evidence` 쓰기 주체·`renders_orphan`·`abuse_holds_expired`·`rights_unverified_7d`·`admin_audit_1y`·AC-06-54), 6.12.4 A12. 08 8.7.7·8.7.9·8.7.12(AC-08-33·56~59)·8.9.5·8.15. 00 §10.1 ADM-04.
- 기준: `rubric.md`, `decisions_v5.md` U-03~U-07, 4라운드 `r4_RC_legal.md`(RC4-01~05).
- 규칙: 라운드 5 수렴 규칙. 새 Major는 이번 diff가 만든 문제이거나 RC4 항목이 덜 닫힌 경우만 올린다. 바뀌지 않은 영역은 Blocker만 본다. Minor는 기록만 한다. 기능 동결. RC4-06 Minor는 다시 올리지 않는다. 이 리뷰는 법률 자문이 아니다.

## 총평

RC4-01~05는 모두 장 본문으로 닫혔다. 06과 08이 같은 문장을 쓴다.
- 탈퇴 순서: 06 6.2.5, 08 8.7.9, AC-08-57 ⑤가 모두 `⑤ → ⑤b → ① → ② → ③b → ③ → ④ → ⑥ → ⑥b → ⑦`이다.
- 프로젝트 삭제: `deleteOwnedRenders` 하나로 통일됐다. `renders_orphan`은 증거 경로를 제외한다.
- 감사 로그 파기: `least($now, now())`가 06 6.6, 08 8.7.7, AC-06-54, AC-08-56에 같은 문장으로 들어갔다.
- `abuse_holds`: 해제와 복구 경로(PATCH, `suspend_source`, `provision_user` else 분기, A12)가 생겼다.
- 미확인 권리 요청: `rights_unverified_7d`와 AC-08-59가 생겼다.

DDL과 8.7.7 "구현 기준" 열도 맞는다. `rights_requests.received_at`·`status`, `reports.handled_at`, `abuse_holds.until`이 DDL에 있다. AC-08-59의 상태 집합 {received, in_progress, done, rejected}는 DDL CHECK의 나머지 값과 같다.
이번 diff가 만든 Blocker나 Major는 없다. 구현 세부에서 Minor 5건을 기록만 한다.

---

## 1. 4라운드 항목 해결 현황

| ID | 상태 | 근거 절 | 비고 |
|---|---|---|---|
| RC4-01 ③b→③ 순서 | 해결 | 06 6.2.5 순서 문장, 단계표(③b 행이 ③ 행 앞, ③ "③b가 끝난 경로만 삭제") / 08 8.7.9, 8.9.5 "③b → ③", AC-08-57 ⑤⑥ | 08 8.9.5의 "(⑤ → ① 순서)"는 부분 표기지만 06과 모순되지 않는다 |
| RC4-02 프로젝트 삭제 증거 | 해결 | 06 6.2.5 `deleteOwnedRenders`(유일 삭제 함수, guard), 6.4.3 `DELETE /api/projects/:id`, 6.6 `abuse-evidence` 쓰기 주체, `renders_orphan` 증거 경로 제외 / 08 8.7.7, 8.7.9, 8.9.5, AC-08-58 | cascade와 즉시 잡 사이에 `retention`이 돌아도 원본 경로가 `objectPaths`에 있으므로 보호된다 |
| RC4-03 주입 시계 충돌 | 해결 | 06 6.6 `admin_audit_1y` 호출 `least($now, now())`, AC-06-54 문장 교체 / 08 8.7.7, AC-08-33 예외, AC-08-56 ② | DB 함수와 트리거는 실시계를 그대로 쓴다. 약화된 곳은 없다. AC-06-54와 AC-08-56 문장이 같다 |
| RC4-04 hold 수명주기 | 해결 | 06 6.3.3 `users.suspend_source`, `provision_user` 3분기, 6.4.3 ADM-04 PATCH 한 트랜잭션, 6.6 `abuse_holds_expired`(미처리 제외), 6.12.4 A12 / 08 8.7.7, 8.9.5, AC-08-57 ④ / 00 ADM-04 | 연장 메커니즘과 재가입 계정 찾는 방법은 문장만 있고 절차가 없다. RC5-01·02(Minor)로 기록한다 |
| RC4-05 미확인 요청 보관 | 해결 | 06 6.6 `rights_unverified_7d`, 6.4.3 ADM-11 기본 필터(`?includeUnverified=1`), AC-06-54 `+8d` / 08 8.7.7 행, AC-08-59 | 구현 기준 열(`received_at`)이 DDL에 있다 |

---

## 2. 새 항목

| ID | 심각도 | 제목 |
|---|---|---|
| RC5-01 | Minor | 미처리 신고 hold의 `until` 연장이 주석으로만 있다. 절차도 테스트도 없다 |
| RC5-02 | Minor | PATCH가 "재가입 계정"을 `email_hash`로 찾는 방법이 적혀 있지 않다 |
| RC5-03 | Minor | ⑤b "검토 종료 시 갱신"이 U-06과 맞지 않는 옛 문장이다 |
| RC5-04 | Minor | `suspend_source`가 `admin`이거나 기존 계정이 `actioned`인 경우의 값과 정지 단계가 적혀 있지 않다 |
| RC5-05 | Minor | A12의 "신고당 1건" 중복 억제 원천이 정해지지 않았다. 표에서 A12가 A11보다 앞에 있다 |

### RC5-01 · Minor · hold 연장 절차
- **섹션**: 06 6.6 `abuse_holds_expired` 주석, 6.3.3 `abuse_holds.until` 주석·`provision_user`(`until > now()`) / 08 AC-08-57 ④
- **허점**: `RetentionRule`에는 삭제(`where`)만 있다. 그래서 "`until = now()+90d`로 연장"을 어디서 실행하는지 정해져 있지 않다. 연장을 빠뜨려도 AC-08-57 ④("91일째 hold 1행")는 통과한다. 그런데 `provision_user`는 `until > now()`만 보므로, 91일째에 재가입하면 보류가 적용되지 않는다. 주석에 결정이 적혀 있어서 Major로 올리지는 않는다.
- **보완안**: 둘 중 하나를 1줄로 적는다. (a) `retention` 전처리 단계로 `update abuse_holds set until = $now + 90d where <미처리 신고 존재>`를 둔다. (b) `provision_user`의 hold 조건을 `until > now() or 미처리 신고 존재`로 바꾼다.
- **수용 기준**: AC-08-57 ④에 "미처리 91일째 같은 이메일 재가입 → `gen_suspended`"를 1구절 추가한다.

### RC5-02 · Minor · 재가입 계정 찾기
- **섹션**: 06 6.4.3 ADM-04 PATCH("web이 계산한 그 `email_hash`의 재가입 계정")
- **허점**: `users`에 `email_hash` 컬럼이 없다. 그래서 AC-08-57 ④의 "dismissed 즉시 `active`"를 만족하려면 에이전트가 직접 방법을 골라야 한다. 전체 이메일을 HMAC으로 대조하거나 새 컬럼을 넣는 방법이 있다. 다음 로그인 때는 `provision_user`의 else 분기가 상태를 복구한다.
- **보완안**: "후보 = `users where suspend_source='hold'`. 그 계정들의 `auth.users.email`로 HMAC을 계산해 대조한다"를 1줄로 적는다. 스키마는 바꾸지 않는다.
- **수용 기준**: AC-08-57 ④ 그대로 둔다. 재로그인 없이 생성 API가 202를 돌려준다.

### RC5-03 · Minor · ⑤b 문장
- **섹션**: 06 6.2.5 ⑤b(`until` "미종료면 `now()+90d` 후 검토 종료 시 갱신") / 08 8.7.7(종료 시 삭제 또는 이관)
- **허점**: U-06 이후에는 검토가 끝나면 hold를 삭제하거나 `sanctions`로 옮긴다. 그래서 "검토 종료 + 90일"과 "갱신"은 쓰이지 않는 경로다.
- **보완안**: ⑤b를 "`until = now()+90d`(미처리 중 연장, 종료 시 PATCH가 삭제 또는 이관, U-06)"로 바꾼다. 6.3.3 `abuse_holds.until` 주석도 같은 문장으로 바꾼다.
- **수용 기준**: `grep "검토 종료 시 갱신"` 0건.

### RC5-04 · Minor · `suspend_source` 나머지 값
- **섹션**: 06 6.3.3 `users.suspend_source`, 6.4.3 ADM-04 `actioned`·ADM-06 정지 / 08 8.9.5 "위반 확정 시 `gen_suspended`, 2회면 `suspended`"
- **허점**: 다음 두 경우의 값이 적혀 있지 않다. (1) 탈퇴하지 않은 계정이 `actioned`될 때 `suspend_source`와 `status` (2) ADM-06 수동 정지 때 `admin`. PATCH는 재가입 계정의 `suspend_source='sanction'`만 쓰고 `status`는 그대로 둔다. 그래서 `sanctions.level='suspended'`가 들어와도 상태는 `gen_suspended`에 머문다. 복구 분기는 `hold`일 때만 실행되므로 해제 쪽은 안전하다.
- **보완안**: `actioned`일 때 `status = sanctions.level`, `suspend_source='sanction'`. ADM-06 정지일 때 `suspend_source='admin'`. 해제하면 둘 다 `null`. 이 내용을 1줄로 적는다.
- **수용 기준**: 동일 위반 2회 `actioned` → `status='suspended'`, `suspend_source='sanction'`.

### RC5-05 · Minor · A12 중복 억제
- **섹션**: 06 6.12.4 A12("`retention` 실행 시, 신고당 1건"), 같은 표 머리 `alert_state` 1시간 규칙
- **허점**: `alert_state`는 규칙 단위로 중복을 억제한다. 그래서 "신고당 1건"을 무엇으로 막는지 정해져 있지 않다. 매일 다시 알림이 갈 수도 있다. 표 순서도 A10 → A12 → A11이다.
- **보완안**: `alert_state` 키를 `A12:<report_id>`로 정한다. 행을 A11 뒤로 옮긴다.
- **수용 기준**: `retention`을 연속 2일 실행해도 같은 신고의 A12가 1건이다.

사람 확인 항목은 바뀌지 않았다. Q6(증거·hold 90일, 미처리 연장의 비례성)과 Q16은 기존 HUMAN_TODO 그대로다. 새 처리자나 국외 이전은 없다.

---

## 3. 루브릭 판정

| 역할 | C1 완결성 | C2 AI 구현 가능성 | C3 대기업 통과 |
|---|---|---|---|
| **법무·개인정보·보안** | **PASS**: Blocker 0, Major 0. RC4-01~05 모두 해결 | **PASS**: 순서·삭제 함수·시계·hold 해제·미확인 요청 보관이 06·08에서 같은 문장이다. DDL과 보관표 구현 기준 열, 상태 enum이 맞는다. 남은 것은 절차 1줄 수준의 Minor(RC5-01·02)다 | **PASS**: 탈퇴·프로젝트 삭제 두 경로 모두 증거 회피가 막혔다. 기각되면 정당한 이용자의 제한이 즉시 풀린다. 고지된 보관 기간과 실제 규칙이 1:1이다 |
