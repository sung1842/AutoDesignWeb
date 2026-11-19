# R3 리뷰: 법무·개인정보·보안 관점

- 대상: `docs/spec/v2/08_legal.md`(8.7~8.17 정독, 8.1~8.6은 2라운드 이후 바뀐 곳만 확인). 다른 장은 grep으로 법무·보안 관련 절만 봤다. 06 6.1.3 흐름표, 6.2.5 `account-delete`, 6.3.3 DDL(`users`, `consents*`, `sanctions`, `mockup_versions`, `share_links`, `reports`, `rights_requests`, `admin_audit_logs`), 6.3.5 RLS, 6.4.2·6.4.3 API, 6.6 보관 규칙, 6.10.1, 6.11.2, 6.13.2 / 04 4.7.2, 4.10.2 G-13, 4.15.2 / 01 1.12.2 / 09 9.2.2·9.2.4 B17·B21~B23, F18.
- 기준: `rubric.md`, `decisions_v3.md`(S-10, S-20, S-21, S-24~S-28), 2라운드 `r2_legal.md`(LG2-01~11)
- 규칙: 2라운드에서 해결된 항목은 다시 쓰지 않는다. 다른 R3 리뷰가 이미 지적한 항목은 빼고 ID만 적는다. `auth.users` 트리거가 env 비밀을 읽어야 하는 문제와 관리자 강등 규칙이 서로 반대인 문제는 TL3-02, `anon_id` 타입은 TL3-07이 다룬다. 변호사 판단이 필요한 항목(HUMAN_TODO Q5·Q6·Q13·Q16)은 Blocker로 세지 않는다. 확인 전 안전한 기본값과 사람 확인 경로가 있는지만 본다. 이 리뷰는 법률 자문이 아니다.

## 총평

2라운드 Major 7건은 규칙 수준에서 모두 반영됐다. 반영 내용은 다음과 같다.
- 입력별 적용 단계 표와 G-13
- OAuth 메타데이터 최소화 트리거
- 6.1.3 데이터 흐름표와 `compliance:flows`
- `account-delete` ①~⑦과 `consents_archive`·`sanctions`
- 관리자 `aal2`와 `pii_view` 기록
- 법무 경로를 `legal/` 하나로 통일, B21~B23 temp 규칙, F18(확인 필드 위조 금지)

특히 F18과 `asset-license-verify=temp`(종료 코드 0 불가)는 사람 없이 구현할 때 가장 위험한 "증빙 허위 기재" 경로를 잘 막는다.

이번 라운드에서 새로 찾은 문제는 대부분 정책 문장이 아니라 **데이터 계층의 실제 권한과 저장 동작**에 있다.
1. **RLS가 사용자에게 직접 쓰기를 허용한다.** 6.3.5는 `authenticated` 역할에 `projects` 쓰기, `mockup_versions` INSERT, `share_links` 쓰기를 열어 둔다. 브라우저에는 공개 anon 키와 사용자 JWT가 있다. 그래서 사용자는 서버 API를 거치지 않고 Supabase REST로 직접 쓸 수 있다. 이 경로로 마스킹, 고위험 브랜드 차단, G-13, 공유 게이트, 신고 숨김이 모두 우회된다(LG3-01, Blocker).
2. **처리방침과 보관표에 없는 데이터가 있다.** Supabase Auth 내부 테이블은 IP·UA·이메일을 보관한다(LG3-02).
3. **보관표와 DDL이 서로 맞지 않는 곳이 남아 있다.** 감사 로그 1년 파기는 DELETE 금지와 충돌한다(LG3-03). 신고 증거는 cascade로 사라지고, 탈퇴로 제재를 피할 수 있다(LG3-04).
4. **S-27(익명 창구 방어)이 06 API·DDL·01 화면에 전파되지 않았다**(LG3-05).

모두 DDL 몇 줄, 정책 표 수정, 필드 추가로 고칠 수 있다. 새 인프라는 필요 없다.

---

## 1. 2라운드 항목 해결 현황

| ID | 상태 | 근거 절(실제 본문 grep 확인) | 비고 |
|---|---|---|---|
| LG2-01 악용 검사 편집 우회·금지 업종 | 해결 | 08 8.9.2 입력별 적용 단계 표·금지 업종, AC-08-41b~d / 04 4.10.2 G-13, 4.15.2 저장·렌더 행 / 06 6.4.2 `EDIT_GATE_FAILED`, 6.11.2 / 01 1.12.2 `prohibited_category` | API 경로는 닫혔다. RLS 직접 쓰기 경로는 LG3-01 |
| LG2-02 OAuth 프로필 저장 | 해결 | 06 6.3.3 `minimize_auth_metadata`(auth.users·identities BEFORE INSERT/UPDATE), 6.5.2 Google 범위 행 / 08 AC-08-29 | 트리거 비밀 의존은 TL3-02. Auth의 다른 내부 테이블은 LG3-02 |
| LG2-03 국외 이전 항목·국가 | 부분 | 06 6.1.3 흐름표·`compliance:flows`·AC-06-58 / 08 8.7.6 거부 고지·N1 "국외(미국·일본)" | 08 YAML 예시가 흐름표와 다르다. `llm-judge`·`llm-secondary` 항목이 없고 id가 `turnstile`과 `cloudflare-turnstile`로 다르다(LG3-06, Minor) |
| LG2-04 탈퇴 보존·삭제 순서 | 부분 | 06 6.2.5 ①~⑦, `consents_archive`, `sanctions`, `admin_hash`, AC-06-53 / 08 8.7.7, 8.7.9 | 단계 ①이 `status`를 `deleting`으로 덮어쓴 뒤 단계 ⑤가 정지 여부를 읽는다. 그래서 제재가 남지 않는다(LG3-04). 정지 기간 컬럼이 없다(LG3-07) |
| LG2-05 익명 창구 악용 | 부분 | 08 8.7.9, 8.9.5, AC-08-43b / 06 6.10.1 `rep:day:ip`·`mail:day:to` | API 입력에 Turnstile 필드가 없다. privacy_request 확인 링크의 상태·토큰·엔드포인트, 소유자 통지, S12 "검토 중"도 없다(LG3-05) |
| LG2-06 관리자 접근 통제 | 해결 | 06 6.11.2(aal2, 매 요청 재확인, `pii_view`, 리댁션), AC-06-57 / 08 8.15 콘솔 MFA 수동 항목, Q16 | 6.5.4와 충돌하는 부분은 TL3-02. 1년 파기 불가는 LG3-03 |
| LG2-07 컴플라이언스 temp·경로 | 해결 | 08 8.11.1·8.15 `legal/{terms,privacy,sources}.md` / 09 B17·B21~B23, 9.2.4 `temp-agent`, F18 / `data/legal` 0건(grep) | |
| LG2-08 내려받기 범위(Minor) | 미해결 | 06 6.4.3 `GET /api/me/export` 파일 목록 그대로 | LG3-09로 넘김 |
| LG2-09 일반 상표 확인(Minor) | 미해결 | `brand_attestation`은 레퍼런스 사이트명이 일치할 때만 받는다 | LG3-09로 넘김 |
| LG2-10 열거형 불일치(Minor) | 부분 | 06 DDL·05는 6값, 08 8.1.6 `ExcludedDomain.reason`은 아직 3값 | LG3-09로 넘김. `anon_id`는 TL3-07 |
| LG2-11 얼굴 판정 순서(Minor) | 미해결 | 05·08에 `face_main` 판정과 `ref_tagger` 호출의 순서 규정이 없다 | LG3-09로 넘김 |

요약: 11건 중 해결 4건, 부분 4건, 미해결 3건(모두 Minor). 2라운드 Major 7건 중 핵심 위험이 그대로 남은 것은 없다. 잔여분은 아래 새 항목에서 다룬다.

---

## 2. 새 항목

| ID | 심각도 | 제목 |
|---|---|---|
| LG3-01 | Blocker | RLS 쓰기 정책이 서버 검사(마스킹·차단·G-13·공유 게이트·신고 숨김)를 직접 우회하게 둔다 |
| LG3-02 | Major | Supabase Auth 내부 테이블의 IP·UA·이메일이 수집 항목·보관표·탈퇴·AC-08-36에서 빠져 있다 |
| LG3-03 | Major | `admin_audit_logs` 1년 파기 규칙과 DELETE 전면 금지(AC-06-06)가 충돌한다 |
| LG3-04 | Major | 신고 증거가 cascade로 사라지고, 탈퇴 단계 순서 때문에 제재가 남지 않는다 |
| LG3-05 | Major | S-27 익명 창구 방어가 06 API·DDL·01 화면에 전파되지 않았다 |
| LG3-06 | Minor | 08 `processors.yaml` 예시가 06 6.1.3 흐름표와 다르다(id·항목·LLM 2개 누락) |
| LG3-07 | Minor | 탈퇴 후 남는 데이터 목록·정지 기간·동의 보존본의 조회 가능성 |
| LG3-08 | Minor | 8.13 요약표·로그 규칙·IP 해시 키 교체의 잔재 |
| LG3-09 | Minor | 2라운드 Minor 이월(LG2-08·09·10·11) |
| LG3-10 | Minor | 게시물 임시조치 사유와 처리방침의 "자동화된 결정" 항목 |

### LG3-01 · Blocker · RLS 쓰기 정책이 서버 검사를 직접 우회하게 둔다

- **관련 절**: 06 6.3.5 RLS 표(`projects` "INSERT·UPDATE·DELETE `owner_id = auth.uid()`(INSERT는 `create_project()` 경유 **권장**)", `mockup_versions INSERT … owner_id = auth.uid()`, `share_links` "INSERT/UPDATE/DELETE `owner_user_id = auth.uid()`"), 6.3.3 `mockup_versions.gate_status`, `share_links.hidden_reason·hidden_at·is_public`, 6.1 R-3(번들의 `.from(` 0건), 6.13.2 `NEXT_PUBLIC_SUPABASE_ANON_KEY` / 08 8.7.5, 8.9.2, 8.9.5 / 04 4.15.2
- **허점**: 브라우저에는 공개 anon 키와 로그인 사용자의 access token이 있다(`auth.*`를 브라우저에서 호출한다). 공격자는 우리 번들을 쓰지 않고 `https://<project>.supabase.co/rest/v1/...`에 직접 요청할 수 있다. 그래서 R-3 정적 검사는 방어가 되지 않는다. **RLS가 유일한 경계다.** 그런데 RLS가 다음을 허용한다.
  1. `projects` INSERT·UPDATE: `brand`에 마스킹하지 않은 연락처나 "KB국민은행"을 직접 쓸 수 있다. 이후 생성 API는 저장된 `projects.brand`를 LLM에 보낸다. 그러면 8.7.5(원문 미보관·국외 전송 전 마스킹)와 8.9.2(브리프 차단)가 둘 다 무력해진다.
  2. `mockup_versions` INSERT: `gate_status='passed'`와 임의 `layout_tree`(피싱 문구)를 가진 행을 직접 만들 수 있다. 그 행을 `POST /api/share`에 넣으면 `VERSION_GATE_NOT_PASSED` 검사를 통과한다.
  3. `share_links` INSERT·UPDATE: 게이트를 거치지 않은 `version_id`로 `is_public=true` 공유를 직접 만들 수 있다. 신고로 자동 비공개된 링크를 `hidden_at=null`로 직접 되살릴 수도 있다.
- **왜 문제인가**: 사칭·피싱 페이지 호스팅은 이 서비스의 대표 위험이다(06 T-09, 00 RK). 2라운드에서 막은 G-13·공유 게이트·신고 숨김이 REST 한 번으로 모두 우회된다. 마스킹 우회는 처리방침의 "원문 미보관·마스킹 후 국외 전송" 고지를 거짓으로 만든다. 대기업 보안 리뷰는 "클라이언트가 쓸 수 있는 컬럼"을 맨 먼저 본다(C3). 게다가 06이 이 정책을 명시적으로 허용했으므로, 구현 에이전트는 이대로 만든다(C2).
- **보완안 [MVP]**(반나절):
  1. **원칙 한 줄**을 6.3.5 머리에 넣는다. "`authenticated`·`anon` 역할의 쓰기 정책은 `users.display_name`과 `mockups`의 `feedback*`·`selected_at` 컬럼 권한만 둔다. 나머지 쓰기는 모두 서버 API → service role(또는 6.3.4 security definer 함수)로 한다."
  2. `projects`·`mockup_versions`·`share_links`의 `authenticated` 쓰기 정책을 지운다. 이 세 테이블의 쓰기는 이미 서버 API(`POST /api/projects`, `POST /api/mockups/:id/versions`, `POST/DELETE /api/share`)가 하므로 기능 손실이 없다. `mockups` UPDATE는 `grant update (feedback, feedback_at, selected_at) on mockups to authenticated`처럼 컬럼 권한으로 좁힌다.
  3. 심층 방어로 트리거를 둔다. `mockup_versions` INSERT 시 `current_user <> 'service_role'`이면 예외를 낸다. `share_links`의 `hidden_at`·`hidden_reason` 변경은 service role만 할 수 있다.
  4. 09 guard에 "6.3.5 허용 목록 밖의 `authenticated`/`anon` INSERT·UPDATE·DELETE 정책이나 테이블 권한이 있으면 FAIL"을 추가한다(`pg_policies`·`information_schema.role_table_grants`·`column_privileges` 조회).
- **수용 기준**:
  - AC-06-03b: 사용자 A의 JWT와 anon 키로 REST를 직접 호출한다. ① `projects` INSERT·UPDATE ② `mockup_versions` INSERT(`gate_status='passed'`) ③ `share_links` INSERT, 그리고 `hidden_at=null` UPDATE ④ `mockups.current_version_id` UPDATE. 네 경우 모두 권한 오류이고 DB 변경은 0이다. `mockups.feedback` UPDATE는 성공한다.
  - `pg_policies`와 테이블·컬럼 권한 덤프가 6.3.5 허용 목록과 같다(스냅샷 테스트). 다르면 `verify:m1`이 FAIL이다.
  - native 프로파일에서는 TL3-01이 정하는 DB 접근 경로에서 같은 권한 테스트를 돈다. PostgREST가 없으면 `authenticated` 역할로 `SET ROLE` 후 SQL을 실행해 검사한다.

### LG3-02 · Major · Supabase Auth 내부 테이블의 IP·UA·이메일이 수집 항목·보관·탈퇴에서 빠져 있다

- **관련 절**: 08 8.7.2 P3·P10·P11, 8.7.7, 8.7.9 "계정 삭제 시 함께 삭제", AC-08-36("앱 DB 어디에도 IP 원문 저장 0건") / 06 6.3.1 개인정보 행("원문 IP 미저장"), 6.1.3 Supabase 행(P11 빈칸), 6.2.5 ⑥ / 00 §8("IP는 원문을 어디에도 저장하지 않고")
- **허점**: Supabase Auth(GoTrue)는 같은 DB의 `auth` 스키마에 다음을 저장한다. 버전에 따라 다르다.
  - `auth.audit_log_entries`: `ip_address`, `payload`(행위자 이메일·user_id·행동). 사용자 FK가 없어 `deleteUser` 후에도 남는다.
  - `auth.sessions`: `ip`, `user_agent`
  - `auth.refresh_tokens`, `auth.one_time_tokens`, `auth.flow_state`, `auth.mfa_factors`, `auth.mfa_challenges`(`ip_address`)

  2라운드 LG2-02는 `raw_user_meta_data`만 다뤘다. 이 테이블들은 처리 항목표(P10·P11)에도, 보관표에도, 탈퇴 삭제 목록에도 없다. AC-08-36의 "IP 원문 0건" 검사는 대상 스키마를 정하지 않았다. `auth`까지 덤프하면 실패하고, `public`만 보면 거짓으로 통과한다. native shim에는 이 테이블들이 없어서 로컬 테스트로는 드러나지도 않는다.
- **왜 문제인가**: 처리방침·고지("IP 원문을 어디에도 저장하지 않는다")와 실제 보유가 다르다(개인정보보호법 제30조). 탈퇴 후에도 이메일이 기한 없이 남는다(제21조 파기). 대기업 개인정보 심사는 IdP·인증 서버의 로그 보관을 따로 묻는다(C3). 에이전트는 AC-08-36의 범위를 스스로 정해야 한다(C2).
- **보완안 [MVP]**:
  1. 8.7.2에 P14 "인증 기록"을 추가한다. 내용: 로그인·토큰 갱신·MFA 이벤트, IP, UA, 이메일 / 저장 위치 Supabase `auth.*` / 근거 정당한 이익(보안). 6.1.3 흐름표의 Supabase 행에도 P14를 ●로 넣는다. 00·06·08의 "IP 원문을 어디에도 저장하지 않는다"는 "앱 테이블(`public` 스키마)에는 IP 원문을 저장하지 않는다. 인증 서버 기록은 P14"로 고친다.
  2. 보관 규칙 `auth_audit_90d`를 추가한다. `auth.audit_log_entries where created_at < now-90d`를 지우고, 만료·폐기된 `auth.sessions`·`auth.refresh_tokens`·`auth.flow_state`는 30일 뒤 지운다. `account-delete`에 단계 ⑥b를 넣어 `auth.audit_log_entries where payload->>'actor_id' = :uid`를 지운다. 단계 ⑥ 뒤에 두고, 멱등이다. 보관 90일의 적정성은 Q16에 덧붙인다(확인 전 기본값 90일).
  3. AC-08-36의 검사 범위를 "`public` 스키마 전체 + `auth`의 위 테이블 중 보관 기간 밖 행"으로 고친다. native shim에는 `auth.audit_log_entries`와 `auth.sessions`의 최소 컬럼을 추가한다. 실제 GoTrue 테이블 목록은 `gotrue-google-metadata`와 같은 needs_ci 단계에서 덤프해 `docs/compliance/auth-metadata.md`에 기록한다.
- **수용 기준**:
  - 계정 삭제 E2E 후 `auth.audit_log_entries`에서 해당 `actor_id`나 이메일이 들어간 행이 0건이다(supabase 프로파일 needs_ci, native는 shim).
  - `RETENTION_NOW=+91d`에서 `auth.audit_log_entries`의 만료 행이 0건이다.
  - 처리방침 렌더 결과의 처리 항목표와 보관표에 P14 행이 있다(스냅샷).

### LG3-03 · Major · `admin_audit_logs` 1년 파기와 DELETE 전면 금지가 충돌한다

- **관련 절**: 08 8.7.7 `admin_audit_logs` 행("1년 … 삭제"), AC-08-33("만료 대상 레코드가 규칙별로 0건") / 06 6.3.5("`UPDATE`·`DELETE` 권한을 service role에서도 `revoke`하고 트리거로 거부"), AC-06-06("UPDATE·DELETE는 service role에서도 실패"), 6.6 RetentionRule 예시(감사 로그 규칙 없음) / 00 AC-00-20
- **허점**: 08장은 감사 로그를 1년 뒤 삭제한다고 쓰고, 06장은 누구도 지울 수 없게 막는다. `retention` 잡은 매일 `admin_audit_logs`에 행을 쌓기만 한다. 이 로그에는 `pii_view`의 `target_id`(사용자 ID), `ip_hmac`, `brand_blocked`의 브랜드 해시가 들어가므로 무기한 남게 된다. AC-08-33과 AC-06-06을 둘 다 통과하는 구현은 없다.
- **왜 문제인가**: 처리방침 4절에 "1년"을 고지하면서 실제로는 영구 보관하게 된다. 두 잠금 수용 기준이 모순이라, 에이전트는 둘 중 하나를 완화해야 한다. 그런데 CLAUDE.md는 수용 기준 완화를 금지한다(C2).
- **보완안 [MVP]**:
  1. 트리거 규칙을 바꾼다. "UPDATE는 항상 거부한다. DELETE는 `old.created_at < now() - interval '1 year'`인 행만 허용하고, 그 밖은 거부한다." DELETE 권한은 `purge_audit_logs(p_before timestamptz)`(security definer, 소유자 권한) 하나에만 준다. 이 함수는 `p_before ≤ now() - 1 year`를 다시 확인한다.
  2. 6.6에 `admin_audit_1y` 규칙을 추가한다. 이 규칙은 위 함수를 부른다. 테스트는 시계 주입 대신 `created_at`을 과거로 넣은 행으로 한다(트리거는 DB의 `now()`를 쓰기 때문이다).
  3. AC-06-06을 "UPDATE는 항상 실패하고, 1년 이내 행의 DELETE는 service role에서도 실패한다"로 고친다. 00 AC-00-20의 "append-only"도 "1년 보관 후 파기만 허용"으로 맞춘다.
- **수용 기준**: 생성 시각이 400일 전인 행 1개와 10일 전인 행 1개를 넣고 `retention:sweep`을 돌리면 앞의 행만 삭제된다. 10일 전 행을 직접 DELETE하면 service role에서도 예외가 난다. UPDATE는 항상 예외다.

### LG3-04 · Major · 신고 증거가 cascade로 사라지고, 탈퇴 단계 순서 때문에 제재가 남지 않는다

- **관련 절**: 06 6.3.3 `reports.share_id … on delete cascade`, `share_links.mockup_id/version_id … on delete cascade`, 6.2.5 ①("`users.status='deleting'`")·⑤("`users.status ∈ {gen_suspended, suspended}`였으면 `sanctions` upsert") / 08 8.7.7 P13("처리 완료 후 1년"), 8.9.5
- **허점**:
  1. **단계 순서 결함**: ①이 `status`를 `deleting`으로 바꾼 뒤에 ⑤가 같은 컬럼을 읽는다. 그래서 ⑤의 조건은 항상 거짓이고 `sanctions`는 한 번도 기록되지 않는다. 재시도해도 같다. AC-06-53의 "정지 계정 탈퇴 → 재가입 403"을 통과하는 구현이 나올 수 없거나, 에이전트가 임의로 순서를 바꾸게 된다.
  2. **증거 소멸**: 피싱 신고를 받은 사용자가 시안·프로젝트를 지우거나 탈퇴하면 `share_links`가 cascade로 지워진다. 그와 함께 `reports`(신고 원문·사유)와 대상 `mockup_versions`가 즉시 사라진다. 보관표의 "P13 처리 완료 후 1년"과 맞지 않는다. 운영자는 검토할 대상도, 수사기관 요청에 낼 자료도 잃는다.
  3. **검토 전 탈퇴로 제재 회피**: 신고가 `open`/`hidden` 상태일 때는 아직 `gen_suspended`가 아니다. 이때 탈퇴하면 `sanctions`가 남지 않는다. 같은 이메일로 다시 가입하면 아무 제약이 없다. 8.9.5 "동일 위반 2회면 정지"도 횟수가 초기화된다.
- **왜 문제인가**: 피싱 운영자가 가장 먼저 쓸 회피 경로다. 정보통신망법상 불법정보 유통 방지 관점과 대기업 Trust & Safety 리뷰는 "신고 대상 콘텐츠의 증거 보존"과 "탈퇴로 제재를 피할 수 있는가"를 반드시 묻는다(C3). 보관표와 DDL이 다르므로 C2 결정 지점이기도 하다.
- **보완안 [MVP]**:
  1. 6.2.5 ①에서 기존 상태를 `users.status_before_delete`에 보존하거나, ⑤를 ① 앞으로 옮긴다(멱등 upsert라 순서를 바꿔도 안전하다). 권장은 "⑤ → ①" 순서다.
  2. `reports.share_id` FK를 없애고 `share_id text`만 둔다. 신고 접수 시 `evidence jsonb {version_id, render_hash, brand_hash, owner_hash}`를 같이 기록한다. `impersonation`·`phishing` 신고가 `open`/`hidden`/`actioned`인 버전은 삭제 경로(`DELETE /api/projects/:id`, `account-delete` ③)에서 Storage 객체를 지우는 대신 `abuse-evidence/<report_id>/`로 옮긴다. 이것을 8.7.7에 "신고 증거: 검토 종료 후 90일"로 넣는다.
  3. `account-delete`에 단계 ⑤b를 넣는다. "`impersonation`·`phishing` 신고가 미처리인 공유 링크가 있으면 `abuse_holds(email_hash, report_ids, until = now()+90d)`에 기록한다." 운영자가 그 신고를 `actioned`로 처리하면 `sanctions`를 upsert한다. 보관 근거(정당한 이익·수사 협조)는 사람 확인 대상으로 Q6에 덧붙인다(확인 전 기본값 90일).
- **수용 기준**:
  - `gen_suspended` 계정을 탈퇴시키면 `sanctions`가 1행 생긴다. 같은 이메일로 재가입하면 생성 API가 403 `ACCOUNT_SUSPENDED`다. 단계 ① 직후 실패를 주입해도 결과가 같다.
  - `phishing` 신고 1건 후 소유자가 프로젝트를 지워도 `reports`가 1행 남고, 증거 객체가 1개 있다.
  - 미처리 신고가 있는 계정이 탈퇴한 뒤 운영자가 그 신고를 `actioned`로 바꾸면 `sanctions`가 1행 생긴다.
  - `RETENTION_NOW=+91d`(검토 종료 기준)에서 증거 객체가 0개다.

### LG3-05 · Major · S-27 익명 창구 방어가 06 API·DDL·01 화면에 전파되지 않았다

- **관련 절**: 08 8.7.9(privacy_request 본인 확인), 8.9.5(Turnstile 필수, 소유자 통지, S12 "검토 중"), AC-08-43b / 06 6.4.3 `POST /api/share/:shareId/report` 입력 `{reason, details?, email?}`, `POST /api/rights-requests`(입력 = 8.1.6 필드), `POST /api/support`, 6.3.3 `rights_requests`(확인 상태 컬럼 없음) / 01 S12, S14 `/support`, 1.12.2
- **허점**:
  1. 세 엔드포인트의 요청 스키마에 Turnstile 토큰 필드가 없고, 실패 시 오류 코드도 없다. 08장은 "거부"라고만 쓴다(400인지 403인지 정해지지 않음).
  2. privacy_request 본인 확인에 필요한 것이 하나도 정의되지 않았다.
     - 확인 링크의 토큰을 둘 곳(컬럼 또는 테이블)
     - 확인 엔드포인트(`GET /api/rights-requests/:id/verify?token=`)
     - 상태 값(`awaiting_verification`)
     - "계정 이메일과 일치" 판정 방법
     - 메일 템플릿

     그래서 AC-08-43b의 "확인 링크 클릭 전 처리 0건"을 데이터로 검사할 수 없다.
  3. 자동 비공개 시 소유자에게 보내는 통지 메일 템플릿과, S12의 "검토 중" 상태 표시·필드가 01·06에 없다.
- **왜 문제인가**: 2라운드의 결정(S-27)은 채택됐지만, 구현 원천인 API 계약과 DDL에 빠져서 에이전트가 토큰 형식·만료·상태 값을 스스로 정해야 한다(C2). 본인 확인 없는 개인정보 요청 처리는 그 자체가 유출 경로다(C3).
- **보완안 [MVP]**:
  1. 06 6.4.3의 세 엔드포인트 입력에 `turnstileToken: string`(필수)을 추가하고, 실패는 403 `TURNSTILE_FAILED`(R-13 표에 추가)로 한다. local 프로파일은 `TurnstilePort` local 드라이버(S-01)를 쓴다.
  2. `rights_requests`에 다음을 추가한다.
     - `verify_token_hash text null`
     - `verify_expires_at timestamptz null`
     - `verified_at timestamptz null`
     - status 값 `awaiting_verification`

     `type='privacy_request'`이면 접수 시 상태를 `awaiting_verification`으로 둔다. 확인 메일은 `requester_email`이 `auth.users.email`과 일치할 때만 보낸다(일치하지 않아도 응답은 같게 해서 계정 존재 여부를 숨긴다). 확인 엔드포인트는 1회용이고 24시간 동안 유효하다. 관리자 API는 `verified_at is null`이면 처리 PATCH에 409를 돌려준다.
  3. 01 S12에 공유 링크 상태 "검토 중(신고로 비공개)" 행과 카피 키를 추가하고, 06 메일 템플릿 목록에 `share_hidden_notice`를 추가한다(고정 문구, 신고 내용은 넣지 않음).
- **수용 기준**:
  - 세 엔드포인트를 토큰 없이 호출하면 403 `TURNSTILE_FAILED`이고 DB 변경과 메일 발송이 0이다.
  - 계정 이메일과 다른 주소의 privacy_request는 응답이 201로 같고, 메일 발송은 0이다.
  - 확인 전 관리자 처리 PATCH는 409다. 토큰을 두 번째로 쓰거나 25시간 뒤에 쓰면 410이다.
  - 자동 비공개가 일어나면 소유자 목 메일이 1통 가고, S12 E2E에 "검토 중"이 보인다.

### LG3-06 · Minor · 08 `processors.yaml` 예시가 06 6.1.3 흐름표와 다르다

- **관련 절**: 08 8.7.6 YAML 예시 / 06 6.1.3, 6.9.2 `models.yaml`(`llm-secondary` fallback) / 04 4.7.2 `[DESIGN_SPEC].type_id`
- **허점·보완**:
  - 예시는 `vercel.items: [P11]`, `flyio.items: [P5, P6]`이고 `llm-judge`·`llm-secondary` 항목이 없다. Turnstile id도 08은 `cloudflare-turnstile`, 06은 `turnstile`이다. 예시를 시드로 쓰면 `compliance:flows`가 바로 실패한다. 08 예시에서 `items`를 지우고 "items는 `data-flows.yaml`에서 생성"으로 적는다. `llm-judge`·`llm-secondary` 항목(country 포함)을 추가하고 id는 `turnstile` 하나로 맞춘다.
  - 반대로 6.1.3은 LLM 행에 P4만 표시한다. 그런데 4.7.2 `DESIGN_SPEC`이 `type_id`(P2)를 보내므로, 흐름표가 실제 전송보다 좁다. `llm-primary`·`llm-secondary` 행의 P2에 ○를 넣는다.
- **수용 기준**: 08 예시를 그대로 `processors.yaml`로 쓰고 `compliance:flows`를 돌리면 PASS다. 6.1.3의 LLM 행에 P2가 있다.

### LG3-07 · Minor · 탈퇴 후 남는 데이터 목록·정지 기간·동의 보존본의 조회 가능성

- **관련 절**: 08 8.7.9 "남는 것", 8.9.5 / 06 `support_tickets.user_id … set null`(email 남음), `rights_requests.requester_email`, `reports.reporter_email`, `events.anon_id`, `users`(정지 종료 시각 컬럼 없음), `consents_archive.user_hash`
- **허점·보완**:
  1. "남는 것" 목록에 P13(문의·신고·권리 요청의 회신 이메일, 처리 완료 후 1년)과 `events.anon_id`(1년 후 집계)가 빠져 있다. 목록에 추가하고 처리방침에도 적는다.
  2. `sanctions.until`은 "남은 정지 기간"인데 `users`에 정지 종료 시각이 없다. `users.suspended_until timestamptz null`을 추가하고, 8.9.5에 기본값을 적는다(`gen_suspended` 30일, `suspended` 1년. 적정성은 Q13).
  3. `consents_archive`는 `HMAC(user_id)`로만 찾을 수 있다. 그런데 탈퇴 후에는 user_id가 어디에도 남지 않으므로, 분쟁이 생겨도 해당 기록을 찾을 수 없다. 보관 목적(동의 증빙)을 이룰 수 없다. `sanctions`와 같은 `email_hash` 컬럼을 추가하거나, 그렇게 할 수 없다면 보관 자체를 다시 판단한다(Q6).
- **수용 기준**: 탈퇴한 사용자의 이메일로 `email_hash`를 계산하면 `consents_archive` 행을 찾을 수 있다. `gen_suspended` 30일이 지난 계정은 생성 API가 200이다.

### LG3-08 · Minor · 8.13 요약표·로그 규칙·IP 해시 키 교체의 잔재

- 8.13 S-10은 "어드민은 `ADMIN_EMAILS` 허용 목록 + `admin_audit_logs`"라고만 쓰고 `aal2`·`pii_view`(S-28)를 빼먹었다. S-10a는 "E2E 로그인은 Mailpit"이라고만 써서 native `dev_mail_outbox`(S-01)와 맞지 않는다. 둘 다 고친다.
- 8.7.2 P11은 "앱 로그(pino)"에 IP가 들어간다고 쓰고, 06 로그 규칙(1923행)과 8.13 S-14는 IP 원문을 금지한다. P11 저장 위치를 "호스팅 공급자 로그만"으로 고친다.
- `IP_HMAC_KEY`를 90일마다 교체하면 같은 IP가 교체 전후로 다른 해시가 된다. 그러면 교체 시점에 걸친 "서로 다른 `ip_hmac` 3건", "7일 `dismissed` 3건", `rep:day:ip` 판정이 틀어진다. 직전 키를 7일 동안 함께 쓰는 규칙(두 해시 모두 조회)을 넣는다.
- **수용 기준**: 키 교체 직후 같은 IP로 낸 신고 3건이 "서로 다른 IP 3건"으로 세어지지 않는다(단위 테스트).

### LG3-09 · Minor · 2라운드 Minor 이월

- LG2-08: `GET /api/me/export`에 `events.json`(본인, 최근 1년), `share_links.json`, `support_tickets.json`, `reports.json`(본인 접수), `invites.json`을 추가한다.
- LG2-09: 일반 상표에 대한 소유·사용권 확인(첫 프로젝트에서 `brand_attestation` 1회)을 넣는다.
- LG2-10: 08 8.1.6 `ExcludedDomain.reason`을 06 DDL의 6값으로 고친다.
- LG2-11: ingest 순서를 "로컬 `face_main` 판정 → 해당하면 비전 호출 없이 삭제 → `ref_tagger`"로 05장에 적는다.
- 수용 기준은 2라운드 원문과 같다.

### LG3-10 · Minor · 게시물 임시조치 사유와 처리방침의 "자동화된 결정" 항목

- 공개 공유 링크는 이용자 게시물이다. 사생활 침해·명예훼손 삭제 요청(정보통신망법 제44조의2 임시조치)에 대응하는 신고 사유와 처리 기한이 없다. `reports.reason`에 `privacy_defamation`을 추가하고, 접수 즉시 비공개·30일 안에 검토를 기본값으로 둔다. 적용 여부는 Q13에 덧붙인다.
- 2023년 개정법의 자동화된 결정(제37조의2)과 관련해, 처리방침 8.11.2에 "취향 진단은 디자인 추천에만 쓰며, 정보주체의 권리·의무에 영향을 주는 자동화된 결정에 해당하지 않음" 1줄을 넣을지 Q5에 덧붙인다. 확인 전 기본값은 1줄 고지다.
- **수용 기준**: `/privacy` 스냅샷에 자동화된 결정 문구가 있다. `privacy_defamation` 신고 1건이면 해당 링크가 410이다.

---

## 3. 루브릭 판정

| 기준 | 판정 | 이유 |
|---|---|---|
| **C1 완결성** | **FAIL** | Blocker 1건(LG3-01: RLS 직접 쓰기로 악용 방지·마스킹·게이트가 우회됨)과 Major 4건이 남았다. 4건은 Auth 내부 기록 누락(LG3-02), 감사 로그 파기 모순(LG3-03), 신고 증거 소멸과 제재 회피(LG3-04), S-27 미전파(LG3-05)다. 2라운드 Major 7건은 규칙 수준에서 모두 반영됐다. |
| **C2 AI 구현 가능성** | **FAIL** | 수용 기준끼리 모순되어 에이전트가 하나를 완화해야 하는 곳이 있다(AC-08-33과 AC-06-06, LG3-03). 단계 순서 결함 때문에 AC-06-53을 정의대로 만족할 수 없다(LG3-04). AC-08-36의 검사 범위가 정해지지 않았다(LG3-02). privacy_request 확인 링크·Turnstile 필드는 스키마가 없다(LG3-05). LG3-01은 06이 위험한 정책을 명시적으로 허용하므로, 에이전트가 그대로 구현하게 된다. |
| **C3 대기업 통과** | **FAIL** | 정책의 폭과 깊이는 대기업 심사 수준이다. 처리방침·보관표·국외 이전·관리자 통제·temp 증빙 위조 방지까지 갖췄다. 다만 "클라이언트가 게이트 상태를 직접 쓸 수 있다"(LG3-01)는 보안 리뷰에서 즉시 탈락할 사유다. 고지와 실제 보유가 다른 점(LG3-02·03)과 탈퇴로 제재를 피할 수 있는 점(LG3-04)도 심사에서 바로 지적된다. |

**사람 확인 필요(기존 Q에 덧붙이기 제안, Blocker로 세지 않음)**: Auth 기록 90일 보관(LG3-02 → Q16), 신고 증거·`abuse_holds` 90일 보관 근거(LG3-04 → Q6), 정지 기간 기본값과 임시조치 적용 여부(LG3-07·10 → Q13), 자동화된 결정 고지(LG3-10 → Q5). 모두 확인 전 기본값이 정해져 있다.

**다음 라운드 PASS를 위한 최소 조건**
1. LG3-01: 6.3.5에서 `projects`·`mockup_versions`·`share_links`의 `authenticated` 쓰기 정책을 지우고, `mockups`는 컬럼 권한으로 좁힌다. AC-06-03b(REST 직접 쓰기 거부)와 정책·권한 스냅샷 guard를 넣는다.
2. LG3-02: 8.7.2에 P14(인증 기록)를 넣는다. 보관 규칙 `auth_audit_90d`와 `account-delete` ⑥b를 추가하고, AC-08-36의 검사 범위를 명시한다.
3. LG3-03: 감사 로그 트리거를 "1년 지난 행만 DELETE 허용"으로 바꾸고 AC-06-06·AC-00-20을 고친다.
4. LG3-04: `account-delete` 순서를 ⑤ → ①로 바꾼다. `reports`의 FK를 없애고 증거 스냅샷을 남기며, `abuse_holds`를 둔다.
5. LG3-05: 세 엔드포인트에 `turnstileToken`과 `TURNSTILE_FAILED`를 넣는다. `rights_requests`에 확인 컬럼·상태·엔드포인트를 추가하고, `share_hidden_notice` 템플릿과 S12 상태를 정의한다.

대부분 06장 DDL·RLS 표와 08장 표를 고치는 일이다. 1인 기준 약 1일 분량이다. Minor(LG3-06~10)는 같은 편집 때 함께 처리하면 되고, PASS 판단에는 영향이 없다.
