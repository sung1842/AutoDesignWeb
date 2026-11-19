# R4 리뷰: 법무·개인정보·보안 관점 (R-C)

- 대상: `docs/spec/v2` 중 패킷 ② R-C 배정 절. 06 6.2.5(`account-delete`), 6.3.3 DDL(`users`·`provision_user`·`sanctions`·`abuse_holds`·`rights_requests`·`reports`·`admin_audit_logs`), 6.3.4·6.3.5(쓰기 화이트리스트·권한 스냅샷)·6.3.6, 6.4.2·6.4.3(익명 창구·본인 확인·메일 템플릿), 6.5.2·6.5.4, 6.6(버킷·RetentionRule), 6.10.3~6.10.5, 6.11.2·6.11.4(CSP), 6.13.2. 08 8.7.2·8.7.3·8.7.5·8.7.7·8.7.9·8.7.12·8.9.5·8.14·8.15. 00 §8.1·§10.1.
- 기준: `rubric.md`, `decisions_v4.md` T-11~T-16·T-20·T-21, 3라운드 `r3_legal.md`(LG3-01~05).
- 규칙: 바뀌지 않은 영역은 Blocker만 본다. 새 Major는 이번 라운드 반영이 만든 것이거나 3라운드 항목이 덜 풀린 것만 적는다. Minor는 목록만 적는다. 기능 동결. 해결된 항목은 다시 올리지 않는다. 변호사 판단 항목(Q5·Q6·Q13·Q16)은 Blocker로 세지 않는다. 이 리뷰는 법률 자문이 아니다.

## 총평

3라운드의 Blocker(LG3-01)는 해결됐다. 브라우저 DB 접근이 없어졌고, `authenticated` 쓰기는 두 컬럼 묶음뿐이며, `anon` 쓰기는 0이다. 권한 스냅샷 guard와 심층 방어 트리거가 있다(6.3.5, AC-06-03b·59).
P14 인증 기록(LG3-02)과 익명 창구 계약(LG3-05)도 00·06·08에서 같은 문장으로 맞춰졌다. 관리자 권한 원천(`role` ∧ `ADMIN_EMAILS` ∧ `aal2`)도 00 §10.1·06 6.5.4·6.11.2가 같다.
남은 문제는 새로 넣은 데이터 수명주기의 세부에 있다.
1. 탈퇴 단계표의 ③ → ③b 순서가 ③ 본문과 반대다. 그대로 구현하면 증거가 지워진다(RC4-01).
2. 프로젝트 삭제 경로에서는 증거 보존이 빠졌다(RC4-02, LG3-04 부분).
3. `purge_audit_logs`가 DB 실시계를 써서 `RETENTION_NOW` 테스트와 충돌한다(RC4-03).
4. `abuse_holds`에는 해제·상태 복구 경로가 없다(RC4-04). 미확인 `privacy_request`에는 보관 끝점이 없다(RC4-05).
모두 표 한 줄이나 함수 몇 줄로 고칠 수 있다. 새 인프라는 필요 없다.

---

## 1. 3라운드 항목 해결 현황

| ID | 상태 | 근거 절 | 비고 |
|---|---|---|---|
| LG3-01 RLS 직접 쓰기 | 해결 | 06 6.3.5 쓰기 권한 원칙·`revoke … from anon, authenticated`·컬럼 `grant` 2건·`mockup_versions_service_only`·`db:grants-snapshot`, AC-06-03b, AC-06-59(번들 `@supabase/*` 0), 6.5.2(httpOnly·서버 AuthPort), 6.13.2(`NEXT_PUBLIC_SUPABASE_*` 폐지), 6.11.4 CSP `connect-src 'self'` / 08 8.7.5 | `NEXT_PUBLIC_SUPABASE` 잔존은 폐지 설명 1곳뿐이다(grep) |
| LG3-02 Auth 내부 기록 | 해결 | 08 8.7.2 P14, 8.7.3 근거, 8.7.7 `auth_audit_90d`·IP 문장 범위, AC-08-36 범위, AC-08-55, Q16 / 06 6.2.5 ⑥b, 6.6 규칙, AC-06-54 / 00 §8.1 | 00·06·08의 IP 문장이 같다 |
| LG3-03 감사 로그 1년 파기 | 해결 | 06 6.3.3 `admin_audit_guard`·`purge_audit_logs`, 6.3.4, 6.3.5 표, AC-06-06 / 08 8.7.7, AC-08-56 / 00 §10.1, AC-00-20 | 00·06·08 문장이 같다. 단 시계 주입 테스트와의 새 모순은 RC4-03 |
| LG3-04 증거 보존·탈퇴 순서 | 부분 | 06 6.2.5 순서 ⑤→⑤b→①, ③b, ⑥, 재가입 승계, 6.3.3 `reports.share_id text`·`evidence`·`abuse_holds`, 6.6 `abuse-evidence` / 08 8.7.7, 8.7.9, 8.9.5, AC-08-57, Q6 | 탈퇴 경로는 닫혔다. LG3-04 보완안 2·수용 기준 2의 `DELETE /api/projects/:id` 경로는 빠졌다(RC4-02). 단계표 순서 모순은 RC4-01 |
| LG3-05 익명 창구 계약 | 해결 | 06 6.4.2 `TURNSTILE_FAILED`·`REQUEST_NOT_VERIFIED`·`VERIFY_LINK_INVALID`, 6.4.3 세 창구 `turnstileToken`·verify 엔드포인트·본인 확인 흐름·메일 템플릿 표(사용자 입력 변수 0)·`shareStatus`, 6.3.3 `verify_*`·`awaiting_verification`, AC-06-66 / 08 8.7.9, 8.9.5 | 토큰은 해시만 저장하고 1회용·24시간이다. 계정 존재 여부는 응답 모양으로 드러나지 않는다. 미확인 행의 보관은 RC4-05 |

---

## 2. 새 항목

| ID | 심각도 | 제목 |
|---|---|---|
| RC4-01 | Major | `account-delete` 실행 순서 ③ → ③b가 ③ 본문("먼저 ③b로 옮긴다")과 반대다 |
| RC4-02 | Major | 프로젝트 삭제 경로에서 신고 증거가 지워진다(LG3-04 미해결분) |
| RC4-03 | Major | `purge_audit_logs`·`admin_audit_guard`가 DB `now()`를 써서 `RETENTION_NOW` 테스트(AC-06-54)가 항상 실패한다 |
| RC4-04 | Major | `abuse_holds`의 `until` 갱신 주체, 기각 시 해제, 재가입 계정의 상태 복구가 없다 |
| RC4-05 | Major | 미확인 `privacy_request`(`awaiting_verification`)의 보관 끝점이 없다 |
| RC4-06 | Minor | 기타 정합·하드닝 6건 |

### RC4-01 · Major · 탈퇴 단계 ③ → ③b 순서 모순

- **관련 절**: 06 6.2.5 "실행 순서는 ⑤ → ⑤b → ① → ② → ③ → ③b → ④ …", 단계표 ③("⑤b 대상 … 렌더 객체는 먼저 ③b로 옮긴다"), ③b("원본 삭제는 ③이 한다") / 08 AC-08-57 ①
- **허점**: 순서 문장대로 구현하면 ③이 `renders/<uid>/`를 지운 뒤 ③b가 복사를 시도한다. 그러면 복사할 원본이 없고, AC-08-57 ①(증거 객체 존재)이 실패한다. 에이전트는 둘 중 하나를 골라야 한다(C2).
- **보완안**: 순서 문장을 `⑤ → ⑤b → ① → ② → ③b → ③ → ④ → ⑥ → ⑥b → ⑦`로 고친다. ③에 "③b가 끝난 경로만 삭제" 조건을 1줄 추가한다.
- **수용 기준**: AC-08-57에 ⑥ "잡 로그에서 ③b 완료가 ③ 시작보다 먼저다"를 더한다. ③b 직후 실패를 주입하고 재시도해도 증거 객체 sha256이 원본과 같다.

### RC4-02 · Major · 프로젝트 삭제로 증거 소멸

- **관련 절**: 06 6.4.3 `DELETE /api/projects/:id`("Storage 객체 삭제는 … 즉시 잡"), 6.6 `abuse-evidence` 쓰기 주체(③b·`actioned`만), `renders_orphan` / T-15("삭제 경로에서 객체를 옮기고") / r3 LG3-04 보완안 2·수용 기준 2
- **허점**: 피싱 신고(`hidden`)를 받은 소유자가 탈퇴하지 않고 프로젝트만 지우면 문제가 생긴다. `mockup_versions`가 cascade로 지워지고, 렌더 객체는 즉시 잡이나 `renders_orphan`이 지운다. 그러면 `reports.evidence.objectPaths`가 없는 객체를 가리킨다. 탈퇴보다 쉬운 회피 경로가 그대로 남는다(C3 T&S).
- **보완안**: 객체를 삭제하는 공통 함수(`deleteOwnedRenders(uid, versionIds)`) 하나를 둔다. `DELETE /api/projects/:id`, 이 프로젝트 삭제 잡, `account-delete` ③이 모두 이 함수를 쓴다. 이 함수는 ⑤b와 같은 조건의 신고(`impersonation`·`phishing`, status ∈ {open, hidden, actioned})가 가리키는 객체를 먼저 `abuse-evidence/<report_id>/`로 옮긴다. `renders_orphan`은 `reports.evidence.objectPaths`가 가리키는 hash를 제외한다.
- **수용 기준**: `phishing` 신고 1건 → 소유자 `DELETE /api/projects/:id` → `retention:sweep` 후에도 `reports` 1행이 남고, `evidence.objectPaths`의 객체가 `abuse-evidence`에 1개 이상 있다(LG3-04 수용 기준 2 그대로).

### RC4-03 · Major · 감사 로그 파기와 주입 시계 충돌

- **관련 절**: 06 6.3.3 `purge_audit_logs`(`p_before > now() − 1 year`면 예외), `admin_audit_guard`(`old.created_at >= now() − 1 year`면 거부), 6.6 `admin_audit_1y`("실행기는 `purge_audit_logs($now − 1 year)` 호출"), AC-06-54("`RETENTION_NOW=+31d` … 종료 코드 0", "`+366d` … 366일 전 행 0건") / 08 AC-08-33
- **허점**: `$now`가 실제 시각보다 미래면 `p_before = $now − 1y`는 `now() − 1y`보다 크다. 그래서 `purge_audit_logs`는 항상 예외를 낸다. 규칙이 실패하면 잡도 실패로 끝나므로 AC-06-54의 "+31d 종료 코드 0"을 만족할 수 없다. "+366d에서 366일 전 행 0건"은 실제로 지금 만든 행을 뜻한다. 그런데 트리거가 실시계로 이 행의 삭제를 거부한다. 에이전트는 트리거나 AC 중 하나를 완화하게 된다. 이는 금지 행동에 해당한다(C2).
- **보완안**: 실행기는 `purge_audit_logs(least($now, db_now()) − interval '1 year')`를 호출한다. 그래서 주입 시계가 DB 검사를 넘지 못한다. AC-06-54의 감사 로그 문장은 AC-08-56처럼 "`created_at = now() − 400d`로 넣은 행"으로 바꾼다. DB 함수와 트리거는 실시계를 그대로 쓴다. 이 방식이 안전하다.
- **수용 기준**: `RETENTION_NOW=+31d`·`+366d` 두 실행 모두 `admin_audit_1y` 규칙 오류 0, 종료 코드 0이다. 400일 전 행은 0건, 300일 전 행은 남는다.

### RC4-04 · Major · `abuse_holds` 수명주기 미정

- **관련 절**: 06 6.2.5 ⑤b("미종료면 `now()+90d` 후 검토 종료 시 갱신"), 6.3.3 `provision_user`(`status='active'`일 때만 `gen_suspended`로 바꿈), 6.6 `abuse_holds_expired` / 08 8.7.7, 8.9.5, AC-08-57 ④ / 00 ADM-04·ADM-06
- **허점**:
  1. 검토가 끝났을 때 `until`을 갱신하는 주체(ADM-04 처리 API)가 정해지지 않았다. 검토가 90일을 넘기면 신고가 미처리인데도 보류가 사라진다.
  2. `dismissed`(혐의 없음)로 끝나도 보류가 90일 더 남는다. 그동안 재가입한 사용자는 생성 기능이 막힌다.
  3. 보류가 끝나거나 기각돼도 `users.status`를 `active`로 되돌리는 경로가 없다. 그래서 수동 해제 전까지 영구 정지된다. 정당한 이용자를 근거 없이 제한하는 셈이다(C3, Q13 관련).
- **보완안**: `PATCH /api/admin/reports/:id`에서 처리할 때 한 트랜잭션으로 다음을 한다.
  - `dismissed`이고 그 신고가 hold의 마지막 신고면 `abuse_holds` 행을 삭제한다. 그 이메일 해시로 재가입한 `users.status='gen_suspended'`이고 `sanctions`가 없으면 `active`로 되돌린다. 일치 판정은 web이 계산한 hash로 한다.
  - `actioned`면 `sanctions`를 upsert한 뒤 hold를 삭제한다.

  `provision_user`는 hold·sanction이 없고 상태가 `gen_suspended`이면서 사유가 hold인 경우 `active`로 복구한다. 사유 구분을 위해 `users.suspend_source ∈ {hold, sanction, admin}`를 추가한다. 미처리 신고가 90일을 넘으면 A-알림을 보내고, 그동안 `until`은 연장한다.
- **수용 기준**: AC-08-57 ④를 "신고 `dismissed` 즉시 `abuse_holds` 0행, 재가입 계정 `status='active'`, 생성 API 202"로 바꾼다. 미처리 91일째에도 hold 1행이 남고 알림이 1건 뜬다.

### RC4-05 · Major · 미확인 권리 요청의 보관 끝점 없음

- **관련 절**: 06 6.3.3 `rights_requests.status` `awaiting_verification`, 6.4.3 본인 확인 흐름(불일치면 토큰·메일 없이 201) / 08 8.7.7 P13 "처리 완료 후 1년(`rights_requests.closed_at`)", 8.7.9
- **허점**: 계정 이메일과 다른 주소로 들어왔거나 24시간 안에 확인하지 않은 `privacy_request`는 상태가 끝나지 않는다. `closed_at`이 채워지지 않으니 P13 보관 규칙이 영원히 적용되지 않는다. 그동안 제3자 이메일과 2,000자 본문이 남고, ADM-11에는 처리할 수 없는(409) 행이 쌓인다. 고지된 보관 기간과 실제 보관이 달라진다(T-16이 만든 상태).
- **보완안**: 8.7.7에 "미확인 `privacy_request`: 접수 후 7일" 행을 추가하고 처리는 삭제로 한다. 6.6에 `rights_unverified_7d`(`status='awaiting_verification' and received_at < $now − 7d`) 규칙을 넣는다. ADM-11 목록 기본 필터는 미확인 행을 숨긴다.
- **수용 기준**: `RETENTION_NOW=+8d`에서 미확인 `privacy_request` 0행, 확인된 행은 남는다. `verify:schema-parity`가 새 행을 인식한다.

### RC4-06 · Minor · 정합·하드닝(기록만)

1. 08 8.7.9·8.9.5에는 "⑤ 공유 비공개·신고 보류 → ①"로 적혀 있다. 06에서는 공유 비공개가 ①에 있고, ⑤는 `sanctions`, ⑤b는 `abuse_holds`다. 08의 문구를 06에 맞춘다.
2. `account-delete` 큐 페이로드는 `{userId}`인데 ⑤는 "`email_hash`를 잡 페이로드로 넘긴다"고 쓴다. 페이로드를 `{userId, emailHash}`로 통일한다. pg-boss 완료 잡 보관 기간(`archiveCompletedAfterSeconds`)도 8.7.7에 적는다.
3. verify 링크가 GET 한 번으로 소모된다. 메일 보안 스캐너가 링크를 미리 열면 정상 사용자가 410을 받는다. GET은 확인 버튼 화면만 보여 주고, 소모는 POST로 한다.
4. 이메일이 일치할 때만 토큰 생성·메일 발송을 동기로 하면 응답 시간 차이로 계정 존재가 드러날 수 있다. 메일은 큐로 보내고 두 분기의 응답 경로를 같게 한다.
5. `abuse_evidence_90d`는 `dismissed`·`actioned`만 본다. `open`·`hidden`으로 방치된 신고의 증거는 무기한 남는다. 미처리 경과 알림(RC4-04)으로 함께 다룬다.
6. `sanctions`의 CHECK `until <= created_at + 1 year`는 upsert 갱신 때 `created_at`이 예전 값이라 실패할 수 있다. upsert에서 `created_at`도 갱신하거나 CHECK 기준을 `now()`로 둔다.

사람 확인 항목: Q6(신고 증거·`abuse_holds` 90일, 보류 중 생성 제한의 비례성 추가 제안), Q16(P14 90일)은 기본값과 확인 경로가 있다. 이번 라운드에 새 처리자나 국외 이전은 없다(Kysely·`pg`는 라이브러리이고 데이터 흐름이 바뀌지 않는다).

---

## 3. 루브릭 판정

| 역할 | C1 완결성 | C2 AI 구현 가능성 | C3 대기업 통과 |
|---|---|---|---|
| **법무·개인정보·보안** | **FAIL**: Blocker 0, Major 5(RC4-01~05). LG3-04가 부분 해결이다 | **FAIL**: 단계 순서 모순(RC4-01)과 실시계·주입 시계 충돌(RC4-03) 때문에 에이전트가 AC나 트리거 중 하나를 골라 완화해야 한다 | **FAIL**: 프로젝트 삭제로 증거를 없앨 수 있다(RC4-02). 기각 후에도 생성 제한이 계속된다(RC4-04). 고지와 다른 무기한 보관이 있다(RC4-05). 근간 보안 구조(쓰기 화이트리스트·관리자 권한)는 통과 수준이다 |

**다음 라운드 PASS를 위한 최소 조건**: ① 6.2.5 순서 문장 수정(③b → ③) ② 공통 삭제 함수로 프로젝트 삭제에서도 증거 이동, `renders_orphan` 예외 ③ `purge_audit_logs` 호출에 `least($now, now())`, AC-06-54 문장 정리 ④ 신고 처리 PATCH의 hold 해제·상태 복구와 AC-08-57 ④ 개정 ⑤ `rights_unverified_7d` 규칙과 보관표 행 추가. 1인 기준 반나절 분량이다.
