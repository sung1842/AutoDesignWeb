# R3 리뷰: 테크 리드 관점

- 대상: `06_architecture.md` 6.1(구성·경계), 6.2.3~6.2.5(잡·큐), 6.3.3~6.3.6(DDL·서버 함수·RLS), 6.4(API), 6.5(인증), 6.6(버킷·보관 실행), 6.9.2~6.9.4(models.yaml·호출 절차·예약-정산), 6.10.3, 6.11.2·6.11.4, 6.13.1(스택 프로파일)·6.13.2, 6.16, 6.19. `09_implementation.md` 9.1, 9.4(M0~M8), 9.5.3·9.5.6·9.5.7, 9.6, 9.8. 04장은 4.7.1·4.17, 07장은 7.4.3 TC-R·7.6·7.11.2를 grep으로 확인했다.
- 기준: `rubric.md`, 2라운드 `r2_tech.md`(TL2-01~10), `decisions_v3.md`(S-01·02·13·14·20 중심)
- 규칙: 2라운드 항목 상태는 decisions_v3가 아니라 **장 본문**을 grep해 판정했다. 새 항목은 이번에 처음 찾은 것과 미해결분만 쓴다. 다른 역할의 3라운드 리뷰(PM·UX)와 겹치는 내용은 쓰지 않는다.

## 실행 환경 재확인과 DDL 실측(2026-11-19)

- 환경: Docker 데몬 없음, `/opt/pw-browsers`에 `chromium-1243`·`chromium_headless_shell-1243`만 있음(webkit·firefox 없음), PostgreSQL 16(pgvector 없음), npm 레지스트리 접근 가능. 2라운드와 같다.
- 06장 6.3.3 SQL 블록 전체(0001~0006 + 9000_local_only)를 추출했다. 6.13.1이 정한 shim(역할 3개, `auth.users`·`auth.identities`, `auth.uid()/role()/jwt()`)을 직접 만든 뒤, 임시 클러스터의 일회용 DB에 적용했다(작업 후 삭제).
  - **오류 0건**, `public` 테이블 49개가 생성됐다. pgvector 제거(S-22)가 실제로 반영됐다.
  - `projects` 삭제와 `auth.users` 삭제(탈퇴 ⑥)의 cascade는 `mockups.candidate_id on delete restrict`와 충돌하지 않았다.
  - DDL 블록에는 RLS 활성화문, 정책, grant, 서버 함수, `users` 생성 트리거가 없다. 6.3.4·6.3.5의 표와 주석으로만 있다. 이것은 결함이 아니다(에이전트가 표로 작성 가능). 다만 TL3-02가 이 트리거와 관련된다.
  - AC-06-02의 `pg_tables.forcerowsecurity` 컬럼은 PG16에 없다. 실제 이름은 `pg_class.relforcerowsecurity`다(TL3-09).

## 총평

2라운드 Blocker 2건은 큰 틀에서 해결됐다.
- 6.13.1에 `STACK_PROFILE` 표, 기동 거부 규칙, CI 위임 목록, AC-06-50~52가 생겼다.
- 09·07장에는 `RENDER_ENV_ID` 기준선, `check-browsers`, needs_ci 허용표가 같은 값으로 들어갔다.
- 예약-정산(S-13), 실효 동시성 2(S-14), 보관 규칙 레코드(S-20), 무인 세션 매핑(9.5.7)도 본문에 반영됐다.

그러나 native 프로파일 설계에 구멍이 하나 남았다. 이 구멍 때문에 M1 이후 구현이 다시 막힌다.

1. **web이 DB를 읽고 쓰는 경로가 native에서 정의되지 않았다(TL3-01, Blocker).**
   - 06장은 web이 `@supabase/ssr`의 "사용자 JWT를 담은 서버 클라이언트"로 RLS 대상 데이터를 읽는다고 쓴다(6.3.5). 9.1.3에서 db 패키지 의존은 `supabase-js`다. 이 경로는 PostgREST를 거친다.
   - native 프로파일은 Auth·Storage·Mail·Turnstile 포트만 바꾸고, PostgREST를 대체하는 수단이 없다.
   - 또 `supabase gen types`(M1 ⑧)는 Docker를 쓴다. 공개 버킷 URL, `auth.admin.*`도 포트에 없다.
2. **원가 모델에 검산 오류가 두 곳 있다(TL3-03·04, Major).**
   - 6개 병렬 호출에서 "캐시 쓰기 1 + 읽기 5"라는 가정은 성립하지 않는다.
   - `cost_spike`의 정의가 04장과 09장에서 다르다. 09장 정의를 따르면 AC-06-56의 "합계 ≤ 0.30"을 수학적으로 만족할 수 없다.
3. **DB 트리거가 env 비밀을 읽어야 하는 설계(TL3-02, Major)**가 있다. 관리자 강등 규칙도 6.5.4와 6.11.2가 서로 반대다.

세 가지 모두 1인 범위에서 문서 몇 절로 고칠 수 있다. 특히 TL3-01은 `DbPort` 하나(직접 SQL + `set local role`·`request.jwt.claims`)로 두 프로파일을 통일하면 된다. 이렇게 하면 supabase 프로파일에서도 같은 코드가 돈다.

**새 항목 집계: Blocker 1 / Major 3 / Minor 7**

---

## 1. 2라운드 항목 해결 현황

| ID | 상태 | 근거 절(본문 확인) | 비고 |
|---|---|---|---|
| TL2-01 | 부분 | 06 6.13.1 스택 프로파일 표·규칙 1~5·AC-06-50~52, 6.3.6 AC-06-01, 6.5.2 테스트 행, 6.11.4 환경별 CSP, 09 9.1.1·9.5.3 환경 실패 행·HALT 제외, 9.6.3 | Auth·Storage·오리진·CI 위임·HALT 모순은 해결됐다. **DB 접근 경로(PostgREST 대체), 타입 생성, 공개 버킷 URL, `auth.admin.*` 대체가 없다** → TL3-01 |
| TL2-02 | 해결 | 09 9.1.1 브라우저 행, 9.4.1 시각 회귀, M6 ④ `--offline`, 9.2.4 B6 `fc-match`, 9.6.3 네트워크 차단, 07 7.1·7.6(9 project, needs_ci), 06 AC-06-34 | `/opt/pw-browsers` 실측과 맞다 |
| TL2-03 | 부분 | 06 6.9.2 `cache_write_per_mtok`·mock 고정 단가, 6.9.4 예약-정산·단일 추정식·단계 생략, 6.10.3, 6.3.3 CHECK 0.36, AC-06-07·56, 04 4.17.2 참조화 | 경쟁 조건과 CHECK 충돌은 해결됐다. 캐시 가정 오류 → TL3-03, `cost_spike` 정의 충돌 → TL3-04, 재시도 시 예약 재사용 → TL3-10 |
| TL2-04 | 해결 | 06 6.2.5 `WORKER_GEN_CONCURRENCY`·라운드로빈, 6.13.2 env, 6.16 근거·p95 식·AC-06-37 | 07 TC-C-02 문구에 "≤5"가 남아 있다(TL3-09) |
| TL2-05 | 해결 | 06 6.6 RetentionRule(`candidates_unexposed_30d`·`renders_orphan`, 1,000행 별도 트랜잭션)·AC-06-54, 08 8.7.7 행 | `survey_sessions`·`visible=false` 0건 확인 |
| TL2-06 | 해결 | 09 9.5.7 매핑 표·AC-09-15·16, 9.4.1 단절 내성, 9.5.3 90분 누적 | |
| TL2-07 | 해결 | 06 6.3.3 주석(S-22), `vector` 확장·컬럼 0건 | PG16(pgvector 없음) 실측 적용 오류 0 |
| TL2-08(Minor) | 미해결 | 06 6.3.3 `identity_links.anon_id text`(주석으로 의도 명시), `events.anon_id text` | → TL3-07 |
| TL2-09(Minor) | 부분 | 06 6.7 `max-age=300, s-maxage=86400` | 6.2.2 본문에는 "1년 immutable"이 남았고 `itemsetHash`는 미반영 → TL3-08 |
| TL2-10(Minor) | 미해결 | 09 9.1.3 web 행 "extractor·pipeline 제외" 그대로, `api-contract` 행 없음 | → TL3-06 |

해결 5 / 부분 3 / 미해결 2(모두 Minor).

---

## 2. 새 항목

| ID | 심각도 | 제목 |
|---|---|---|
| TL3-01 | Blocker | native 프로파일에서 web의 DB 접근 경로(PostgREST 대체)·타입 생성·공개 URL·관리 API가 정의되지 않음 |
| TL3-02 | Major | `auth.users` 트리거가 env 비밀(`ADMIN_EMAILS`·`CONSENT_HASH_KEY`)을 읽어야 하고, 관리자 강등 규칙이 6.5.4와 6.11.2에서 반대 |
| TL3-03 | Major | 병렬 6호출에 "캐시 쓰기 1 + 읽기 5"를 가정함: live 기본 경로 원가 ≈ $0.28로 수정 루프가 상시 생략되고, Mock 기대값($0.23±10%)이 결정되지 않음 |
| TL3-04 | Major | `cost_spike` 정의가 04장(단가 10배)과 09장(usage 10배)에서 다르고, 09장 정의로는 AC-06-56·TC-R-09를 만족할 수 없음 |
| TL3-05 | Minor | "다양성 재호출"·"카피 패치"를 `llm_calls`·`candidates` enum으로 구분할 수 없음(M7 ⑥ 측정 근거 불명확) |
| TL3-06 | Minor | 9.1.2 트리·9.1.3 의존 표에 새 패키지·경로가 없음(TL2-10 포함), 잠금 파일 경로 불일치 |
| TL3-07 | Minor | `anon_id` 타입 불일치 잔존(TL2-08) |
| TL3-08 | Minor | `/api/survey-items` 캐시 규칙이 6.2.2와 6.7에서 다름(TL2-09 잔여) |
| TL3-09 | Minor | 잔여 표기·사실 오류 묶음(09 M0·M1·M3·M5 범위, 6.19 미해결 행, 07 TC-C-02, AC-06-02 컬럼명) |
| TL3-10 | Minor | `callLlm` 재시도가 이미 정산한 예약을 다시 씀 |
| TL3-11 | Minor | local 전용 라우트(`/api/_storage`)의 "조건부 등록"과 preview 3001 포트가 Next 라우팅·`api-parity`와 맞지 않음 |

---

### TL3-01 · Blocker · native 프로파일에서 web의 DB 접근 경로·타입 생성·공개 URL·관리 API가 정의되지 않음

- **관련 절**: 06 6.1.1(WEB → DB "SQL(사용자 JWT / service role)"), 6.1.2 R-3, 6.3.4(서버 함수 `service_role`만 EXECUTE), 6.3.5 머리말("사용자 JWT를 담은 서버 클라이언트(`authenticated`)"), 6.4.1 인증 행(`@supabase/ssr`), 6.5.2 세션 행, 6.2.5 ⑥(`auth.admin.signOut`·`auth.admin.deleteUser`), 6.5.2 첫 로그인 행(`auth.admin.deleteUser`), 6.6 `survey-assets` public, 6.11.4 서비스 CSP `img-src … {SUPABASE_URL}`, 6.13.1 스택 프로파일 표, 6.13.2(`NEXT_PUBLIC_SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY`·`DATABASE_URL_POOLED` 필수), 09 9.1.3 db 행(의존 `supabase-js`), M1 범위·⑦⑧(`supabase gen types`, "익명 키로 진단 세션 직접 조회")
- **허점**:
  1. **RLS 대상 조회 경로가 PostgREST다.** 06장은 web이 사용자 데이터를 "사용자 JWT를 담은 서버 클라이언트"로 읽는다고 하고, db 패키지 의존을 `supabase-js`로 정한다. 그 결과 `.from()`·`.rpc()` 호출은 Supabase REST(PostgREST)로 간다.
     - native 프로파일 표에는 DB(시스템 PG), Auth, Storage, Mail, Turnstile 대체만 있고 PostgREST 대체가 없다.
     - shim은 `request.jwt.claims`를 읽는 `auth.uid()`만 제공한다. 그 값을 **누가, 어떤 연결에서** 넣는지가 없다.
     - 에이전트는 "supabase-js 그대로(native에서 동작 불가)"와 "직접 SQL로 전환" 중 하나를 골라야 한다. 이것은 모든 Route Handler에 영향을 주는 아키텍처 결정이고, M1 수용 테스트를 쓰는 순간 자체 잠금으로 굳는다.
  2. **서버 함수 호출 주체가 없다.** 6.3.4 함수는 `service_role`만 EXECUTE할 수 있다. native에서 앱이 어떤 DB 사용자로 접속하고 언제 `set role service_role`을 하는지 정의되지 않았다. 슈퍼유저로 접속하면 RLS 테스트(AC-06-03, M1 ⑦)가 의미를 잃는다.
  3. **타입 생성이 Docker에 의존한다.** M1 범위와 산출물(`types.gen.ts`), ⑧은 `supabase gen types`를 쓴다. 이 명령은 `--db-url`을 줘도 postgres-meta 컨테이너를 띄우므로 native에서는 실행되지 않는다. 대체 생성기가 지정되지 않았다.
  4. **`StoragePort`에 공개 URL이 없다.**
     - `survey-assets`는 public 버킷이고, `SurveyItemView.assets.url`은 공개 URL이어야 한다(서명 없음, 1년 immutable).
     - 6.13.1의 fs 드라이버는 서명 URL만 정의한다. CSP `img-src`는 `{SUPABASE_URL}`을 허용하는데, native에서 이 값이 무엇인지도 없다.
     - 6.13.2는 `NEXT_PUBLIC_SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY`를 "필수"로 둔다. 그래서 native 기동 시 env 검증(AC-06-32)과 충돌한다.
  5. **`AuthPort`에 관리 연산이 없다.** `account-delete` ①⑥과 첫 로그인 거부 처리에는 `auth.admin.signOut(uid,'global')`·`auth.admin.deleteUser`가 필요하다. `AuthPort`(6.13.1)에는 `issueMagicLink·exchange·getUser·signOut·enrollTotp·verifyTotp`만 있다. local 드라이버가 `auth.users` 행을 언제 INSERT하는지(트리거 발화 시점, TL3-02)도 없다.
  6. `DATABASE_URL_POOLED`(Supavisor 6543)의 native 값이 정해져 있지 않다. 사소하지만 env 스키마가 기동을 막는다.
- **왜 문제인가**: S-01의 목적은 "Docker 없는 컨테이너에서 M1 이후 verify 녹색"이었다. 그런데 web의 거의 모든 API가 거치는 데이터 접근 계층이 native에서 성립하지 않는다. 그래서 AC-06-51·52와 M1 ⑦⑧·M4·M5 E2E가 여전히 녹색이 될 수 없거나, 에이전트가 계층 구조를 새로 정해야 한다(C2). 2라운드 TL2-01과 같은 종류의 Blocker가 범위만 줄어든 채 남은 것이다.
- **보완안**(06 6.1.2·6.3.5·6.13.1·6.13.2, 09 9.1.2·9.1.3·M1 갱신):
  ```
  DbPort(@tastefit/db, 두 프로파일 공통 — supabase-js의 .from()/.rpc()는 서버에서도 쓰지 않는다):
    withUser(uid, aal, fn)  = BEGIN; SET LOCAL ROLE authenticated;
                              SELECT set_config('request.jwt.claims', '{"sub":uid,"role":"authenticated","aal":aal}', true); fn(tx); COMMIT
    withAnon(fn)            = 같은 방식, role anon
    withService(fn)         = BEGIN; SET LOCAL ROLE service_role; fn(tx); COMMIT
    드라이버: postgres.js(또는 pg). 접속 사용자 = 로그인 전용 역할 `tastefit_app`(NOINHERIT 아님, anon·authenticated·service_role 멤버).
    supabase 프로파일·운영도 같은 코드(Supavisor 트랜잭션 모드에서 SET LOCAL 유효). supabase-js는 AuthPort·StoragePort supabase 드라이버 안에서만 import(guard).
  타입: kysely-codegen(또는 pg-to-ts)으로 `DATABASE_URL_DIRECT`에서 생성. `supabase gen types`는 쓰지 않는다(M1 ⑧ 문구 교체).
  StoragePort += publicUrl(bucket, path). fs 드라이버 = `${WEB_ORIGIN}/api/_storage/public/<bucket>/<path>`(public 버킷만, 서명 없음).
    CSP img-src의 {SUPABASE_URL}은 STORAGE_PUBLIC_ORIGIN(신규 env, native = WEB_ORIGIN)으로 치환.
  AuthPort += adminSignOutAll(uid), adminDeleteUser(uid). local 드라이버: exchange 성공 시 auth.users upsert(→ TL3-02 provision 호출).
  env: native에서 NEXT_PUBLIC_SUPABASE_URL·SUPABASE_*는 "supabase 프로파일·staging·prod에서만 필수"로 조건부.
       DATABASE_URL_POOLED 미설정 시 DATABASE_URL_DIRECT 사용(local 한정).
  ```
- **수용 기준**:
  - `rg "\.from\(|\.rpc\(" apps/web packages --glob '!packages/db/src/drivers/supabase*'` 결과가 0건이다(guard).
  - native에서 AC-06-03을 `DbPort.withUser(B)`로 실행하면 A의 행이 0행이다. 같은 테스트가 supabase 프로파일(CI)에서도 수정 없이 통과한다.
  - native에서 `pnpm db:types`가 Docker 없이 `types.gen.ts`를 만들고, web·worker가 컴파일된다.
  - native에서 `GET /api/survey-items`의 `assets.desktop.url`을 브라우저가 열 수 있다(200, `image/webp`). 서비스 CSP 위반은 0건이다.
  - native에서 계정 삭제 E2E(M7 ③)가 통과한다(`adminDeleteUser` → `auth.users` 0행).
  - native에서 `.env.example`의 supabase 전용 변수를 비워도 기동되고, staging 설정에서 비우면 종료 코드 1이다.

### TL3-02 · Major · `auth.users` 트리거가 env 비밀을 읽어야 하고, 관리자 강등 규칙이 서로 반대

- **관련 절**: 06 6.3.3 `users` 아래 주석("auth.users INSERT 트리거로 users 1행 생성. ADMIN_EMAILS 포함 이메일이면 role='admin'. 같은 트리거가 sanctions에서 email_hash 일치 행을 찾으면…"), `sanctions.email_hash = HMAC-SHA256(lower(trim(email)), CONSENT_HASH_KEY)`, 6.2.5 재가입 행, 6.13.2 `ADMIN_EMAILS`(web)·`CONSENT_HASH_KEY`(web, worker), 6.5.4("목록에서 빠져도 자동 강등하지 않는다"), 6.11.2 S-28("매 요청 `ADMIN_EMAILS` 재확인, 빠지면 즉시 404(자동 강등)"), AC-06-53·57
- **허점**:
  1. DB 트리거는 web의 env를 읽을 수 없다. 그런데 `ADMIN_EMAILS`·`CONSENT_HASH_KEY`를 DB에 두는 방법(GUC·Vault·테이블)이 정의되지 않았다. GUC(`ALTER DATABASE SET`)는 `pg_settings`로 누구나 읽을 수 있어 비밀 보관에 부적합하다. Vault는 native에 없다. 결국 에이전트가 비밀 보관 위치를 정해야 한다.
  2. 06 6.5.4는 "목록에서 빠져도 자동 강등하지 않는다(ADM-06에서 수동)"이고, 6.11.2·AC-06-57은 "빠진 직후 요청 → 404(자동 강등)"다. 반대로 ADM-06에서 수동으로 승격한 사용자가 `ADMIN_EMAILS`에 없으면, 매 요청 검사 때문에 관리자 권한을 쓸 수 없다. `users.role`과 `ADMIN_EMAILS` 중 어느 쪽이 권한의 원천인지 정해지지 않았다.
- **왜 문제인가**: 비밀 키 보관 위치와 권한 원천은 보안 리뷰의 필수 질문이다(C3). 어느 쪽을 고르느냐에 따라 트리거 SQL, 마이그레이션, AC-06-53(정지 계정 재가입 403)의 구현 위치가 달라진다(C2).
- **보완안**:
  - 트리거에서 env 의존을 없앤다. `/auth/callback`(supabase)이나 `AuthPort.exchange`(local) 직후, web이 `DbPort.withService`로 `provision_user(p_user_id, p_is_admin boolean, p_email_hash text)`(security definer)를 호출한다.
    - 이 함수는 `users` 행 생성, `role` 설정, `sanctions` 승계를 한 트랜잭션으로 처리한다.
    - HMAC은 web이 계산한다. 키는 DB에 두지 않는다.
  - 6.3.3 주석은 "트리거 없음, `provision_user`가 원천"으로 바꾼다.
  - 권한 원천은 **`users.role='admin'` ∧ 현재 `ADMIN_EMAILS`에 포함**(AND)으로 정한다. 6.5.4의 "자동 강등하지 않는다"와 ADM-06의 수동 승격은 삭제하고, S-28 문장 하나만 남긴다.
- **수용 기준**:
  - 마이그레이션 SQL에 `ADMIN_EMAILS`·`CONSENT_HASH_KEY`·`current_setting('app.` 문자열이 0건이다.
  - 정지 계정 탈퇴 → 같은 이메일 재가입 → 생성 API 403 `ACCOUNT_SUSPENDED`가 native·supabase 양쪽에서 통과한다.
  - `users.role='admin'`이지만 `ADMIN_EMAILS`에 없는 계정의 `/api/admin/users` 요청은 404다. 06장에서 "자동 강등하지 않" 문구 grep 결과가 0건이다.

### TL3-03 · Major · 병렬 6호출에 "캐시 쓰기 1 + 읽기 5"를 가정함

- **관련 절**: 04 4.7.1("레이아웃 6개를 병렬로 호출", "정적 프리픽스 … 프롬프트 캐시를 쓴다"), 4.17.2 표("레이아웃 정적 프리픽스 4.5k(캐시 쓰기 1 + 읽기 5) $0.024", 기본 경로 ≈ $0.23), 4.18("few-shot … 잡 간에는 달라짐"), 06 6.9.4 추정식("잡 첫 호출은 cache_write, 캐시 적중분은 cached")·단계 생략·AC-06-56, 09 9.6.2 usage 규칙(`inputTokens = ceil(문자 수/3)`, 캐시 토큰 규칙 없음)
- **허점**:
  1. 공급자 프롬프트 캐시는 첫 요청의 처리가 시작된 뒤에야 다음 요청에서 적중한다. 6개를 동시에 보내면 6개 모두 캐시 쓰기 단가를 낸다. 또 4.18에 따라 few-shot이 잡마다 달라지므로 잡 사이의 적중도 없다.
  2. 04장 자체 토큰표로 다시 계산하면 다음과 같다.

     | 항목 | 계산 | 비용 |
     |---|---|---|
     | 레이아웃 1회 | 4.5k×$3.75 + 2.5k×$3 + 1.0k×$15(/M) | ≈ $0.0394 |
     | 레이아웃 6회 | | ≈ $0.236 |
     | 카피 1회 | | $0.045 |
     | 기본 경로 합계 | | **≈ $0.281** |

     이 값은 `skipVisionUsd` 0.24와 `skipRepairUsd` 0.27을 모두 넘는다. 따라서 live에서는 **비전 채점과 수정 루프가 거의 항상 생략된다.** 4.17.1이 가정한 수정 루프 발생률 35%가 의미를 잃고, AC-04-36·골든 M14의 평균 ≤ $0.25도 넘는다.
  3. 추정식은 "첫 호출만 cache_write"로 계산한다. 그래서 병렬 경로에서는 추정이 실제보다 약 $0.074 낮다. 예약-정산은 추정 기준이므로 실제 합계가 cap에 더 가까워진다.
  4. Mock usage 규칙에는 캐시 토큰이 없다. 그래서 mock 비용은 "에이전트가 쓴 프롬프트 길이 + mock 출력 JSON 길이"로 정해지고, AC-06-56의 "잡 비용 $0.23 ± 10%"는 문서만으로 판정 결과를 정할 수 없다. 에이전트가 이 AC를 맞추려면 프롬프트 길이를 조정해야 한다. 이는 측정 대상을 맞추려고 입력을 바꾸는 것이다.
- **왜 문제인가**: 원가 상한·생략 단계의 수치는 대기업 리뷰에서 반드시 검산하는 숫자다(C3). 지금 숫자로는 "기본 경로에서 품질 루프가 돈다"는 04장의 품질 설계와 비용 설계가 서로 모순된다. 또 잠금되는 Mock AC의 기대값이 결정되지 않는다(C2).
- **보완안**(둘 중 하나를 06 6.9.4에 고정한다. 권장은 a):
  - a) **캐시 예열 순서**: 레이아웃 후보 0을 먼저 보내고 첫 토큰을 받으면(스트리밍) 나머지 5개를 출발시킨다. 카피는 처음부터 병렬로 보낸다. 지연 증가 ≈ TTFT 1~2s를 4.17.1·6.2.4에 반영한다. 이때 4.17.2 표는 그대로 성립한다.
  - b) 병렬을 유지하고, 4.17.2를 "캐시 쓰기 6"으로 다시 계산한다(기본 ≈ $0.28). 생략 임계(0.24/0.27)와 cap 또는 출력 토큰 상한을 다시 정하고, R-22 예산 검산(00 §9.4)에 반영한다.
  - 공통: 9.6.2 Mock usage에 캐시 규칙을 추가한다. 정적 프리픽스 블록의 문자 수를 `cacheWrite`(잡 첫 레이아웃) 또는 `cached`(나머지)로 보고한다. 또 Mock 프롬프트 픽스처(`fixtures/llm/mock-prompt-sizes.json`: 블록별 고정 문자 수)를 두어, AC-06-56 기대값을 **공식으로 계산한 값 ± 1%**로 바꾼다. 상수 $0.23은 쓰지 않는다.
- **수용 기준**:
  - live 단가 가정(04 4.17.2)과 선택한 호출 순서로 계산한 기본 경로 원가가 `skipVisionUsd` 미만이고, 그 계산식이 06 6.9.4에 있다.
  - Mock `ok`에서 `llm_calls`의 `cached_tokens_in > 0`인 `gen_layout` 행이 5개(a안) 또는 0개(b안)이고, 잡 비용이 공식값 ± 1% 안에 든다.
  - 골든 mock 32케이스에서 `repair_quality` 호출이 `costGuard` 생략 없이 1건 이상 실행된다(`COST_CAP` 경고 0).

### TL3-04 · Major · `cost_spike` 정의가 04장과 09장에서 다르고, 09장 정의로는 AC-06-56·TC-R-09를 만족할 수 없음

- **관련 절**: 04 AC-04-37("MockProvider **단가**를 10배(`cost_spike`)로 설정"), 09 9.6.2 `cost_spike`("**usage**를 10배 보고"), 06 6.9.4 AC-06-56("7개 병렬 호출 후에도 `sum(llm_calls.cost_usd) ≤ 0.30`"), "실제 청구가 추정을 넘어 합계가 cap을 넘으면 예외 없이 저장하고 A11", 07 TC-R-09(`cost_usd ≤ 0.30`), 09 M5 ②(모든 시나리오 기대 결과 일치)
- **허점**:
  - **09장 정의(usage 10배)를 따르는 경우**: 추정식은 조립된 프롬프트 길이와 `maxOutputTokens`만 안다. 7개 호출은 모두 정상 추정(합 ≈ $0.24)으로 예약을 통과한다. 정산 시점에 실제 비용이 10배(≈ $2.4)로 기록된다. 결국 "합계 ≤ 0.30"은 불가능하다. 이는 06장 스스로 "실제 청구가 추정을 넘으면 cap 초과를 저장하고 A11"이라고 인정한 상황이다.
  - **04장 정의(단가 10배)를 따르는 경우**: 추정도 10배가 되어 첫 호출부터 `budget_skipped`가 난다. 그러면 결과는 fallback, 비용 $0이다. AC-04-37의 "비전 채점·수정 루프가 **순서대로** 생략"을 관찰할 수 없다.
  - 결국 어느 정의를 써도 세 장의 AC 문장이 함께 성립하지 않는다. M5 ②는 잠금되므로, 에이전트는 BLOCKED(`locked-conflict`)로 가거나 9.5.3 우선순위 규칙으로 04장 정의를 골라야 한다.
- **왜 문제인가**: 비용 상한 시나리오는 원가 통제의 유일한 자동 검증이다. 정의가 둘이면 같은 이름의 테스트가 서로 다른 것을 검증한다(C2). "추정 초과 청구"라는 실제 위험(공급자 usage가 예상보다 큰 경우)을 검증하는 시나리오도 없어진다.
- **보완안**: 시나리오를 둘로 나누고 기대값을 06장에 고정한다.
  - `cost_spike`(단가 10배, 추정에도 반영): 처음 판정에서 넘는 호출은 `budget_skipped`이고 `sum ≤ 0.30`, 상태 ∈ {partial, fallback}이다. "순서대로 생략"은 별도 시나리오 `cost_ramp`로 옮긴다. `cost_ramp`는 단가를 1.15배로 올려 vision → repair 순서로 생략되는지를 본다.
  - `usage_overrun`(usage 3배, 추정 미반영): 진행 중 호출은 끝까지 정산한다. 그 결과 `cost_usd`가 0.30을 넘어도 0.36 이하이면 저장되고, A11이 1건 뜨며, 이후 예약은 전부 거부된다. 3배로 0.36을 넘을 수 있으면, 병렬 출발 전 예약의 합 상한을 `capUsd / overrunFactor` 같은 방식으로 정한다. 그러지 않으려면 CHECK 대신 클램프 + A11로 정한다.
  - 04 AC-04-37, 07 TC-R-09, 09 9.6.2를 이 두 시나리오의 참조로 바꾼다.
- **수용 기준**:
  - 9.6.2·04·07에서 `cost_spike`의 정의 문장이 같다(단가 10배).
  - `cost_ramp`에서 `llm_calls`의 생략 순서가 `judge_vision`(budget_skipped) → `repair_quality`(budget_skipped)다.
  - `usage_overrun`에서 DB 예외 0, `WORKER_LOST` 0, A11 1건, 초과 이후 `status='ok'` 신규 호출 0이다.

### TL3-05 · Minor · "다양성 재호출"·"카피 패치"를 enum으로 구분할 수 없음

- **관련 절**: 04 4.8 다양성 조건("위반 시 해당 후보만 재호출 1회, 비용은 수정 루프 예산에서 차감"), 4.7.1 `gen_copy`(repair) `CopyDeckPatch`, 06 6.3.3 `llm_calls.call_kind ∈ {initial, repair_schema, repair_quality}`·`candidates.origin ∈ {llm, repair, fallback}`, 09 M7 ⑥·07 TC-R-15("다양성 재호출 ≥1"), M1 ⑨ schema-parity(DDL 차이 0)
- **허점**: 다양성 재호출이 `initial`인지 `repair_quality`인지 정해져 있지 않다. 후자라면 AC-04-23(잡당 `repair_quality` ≤ 3)의 계수에 들어간다. schema-parity 때문에 enum을 넓힐 수도 없다. 같은 slot의 round 0 후보가 2개인 것으로 추론할 수는 있지만, 잠금 AC의 계수 기준으로는 약하다.
- **보완안**: `call_kind`에 `diversity`를, `candidates.origin`에 `diversity`를 추가한다(additive). 카피 패치는 `role='gen_copy' ∧ call_kind='repair_quality'`로 명시한다. AC-04-23의 상한 3에 diversity가 포함되는지도 적는다.
- **수용 기준**: TC-R-15 mock에서 `call_kind='diversity'` 행이 1개 이상이고, `repair_quality` 계수와 섞이지 않는다.

### TL3-06 · Minor · 9.1.2 트리·9.1.3 의존 표에 새 패키지·경로가 없음, 잠금 파일 경로 불일치

- **관련 절**: 09 9.1.2(트리에 `packages/api-contract`·`packages/compliance`(06 6.4.5·6.11.2 `packages/compliance/abuse.ts`)·`packages/db/shim`·`scripts/env/check-browsers.ts`·`legal/`·`copy/ko.ts` 없음, `.guard/locked-hashes.json`), 9.1.3(web 행 "extractor·pipeline 제외", api-contract·compliance 행 없음), 9.5.5 F01·9.5.6·07 7.12(`config/lock/locked-hashes.json`)
- **허점**: `scripts/guard/deps.ts`는 9.1.3 표를 원천으로 M0에서 자체 잠금된다. 표에 없는 패키지의 허용·금지가 정해져 있지 않다. TL2-10(web의 `llm`·`exporter` 허용)도 그대로 남아 06 R-1과 충돌한다. 잠금 파일 경로도 트리와 F01이 서로 다르다.
- **보완안**: 트리에 위 6개 경로를 추가하고 `.guard/locked-hashes.json`은 `config/lock/locked-hashes.json`으로 고친다. 9.1.3에 다음 두 행을 추가한다.
  - `api-contract`: 의존 허용 zod, layout-schema(타입). 의존 금지 db·llm·renderer.
  - `compliance`: 의존 허용 config·taxonomy. 의존 금지 llm·db.

  web 행은 "extractor·pipeline·llm·exporter 제외"로 고친다.
- **수용 기준**: 9.1.2 트리의 패키지 집합이 9.1.3 표의 행 집합과 같다. web에 `@tastefit/llm` import 픽스처를 넣으면 deps 검사와 ESLint가 모두 실패한다. 잠금 파일 경로 grep 결과는 한 가지뿐이다.

### TL3-07 · Minor · `anon_id` 타입 불일치 잔존(TL2-08)

- **관련 절**: 06 6.3.3 `identity_links.anon_id text`(주석 "events.anon_id와 같은 text 표기"), `events.anon_id text`. 그 밖의 6곳은 `uuid`다.
- **허점·보완안·수용 기준**: 2라운드 TL2-08과 같다. 주석으로 의도를 적었지만, 위조 쿠키가 uuid 컬럼 INSERT에서 500을 내는 문제는 남아 있다. 최소 조치로 6.5.1에 "API 경계에서 zod `uuid()` 검증, 형식이 틀리면 재발급"을 명시한다. 수용 기준은 `anon_id=not-a-uuid` 쿠키로 `POST /api/surveys` → 201 + 새 쿠키, 500 0건이다.

### TL3-08 · Minor · `/api/survey-items` 캐시 규칙 불일치(TL2-09 잔여)

- **관련 절**: 06 6.2.2 마지막 항목("공개, 1년 immutable 캐시"), 6.7 표(`max-age=300, s-maxage=86400`)
- **허점**: 두 절의 값이 다르다. 6.7 값이라면 관리자 토글 후 최대 하루 동안 CDN 캐시가 옛 풀을 준다. 그동안 `survey_desync`는 "정상 0건" 가정을 깬다.
- **보완안**: 6.2.2를 6.7 참조로 바꾸고, TL2-09의 `itemsetHash` 쿼리 키를 채택한다. MVP에서 이것이 과하다면 "토글 시 `VERCEL_PURGE_TOKEN`으로 무효화"를 적는다.
- **수용 기준**: 06장에서 survey-items 캐시 값이 한 가지다. 토글 직후 다음 응답에서 `survey_desync`가 0이다.

### TL3-09 · Minor · 잔여 표기·사실 오류 묶음

- 09 M0 범위: "docker compose + Supabase CLI 로컬 스택"만 있다. native 기동(`initdb`·shim·`node apps/worker`)을 함께 적어야 한다.
- 09 M1 범위: "B1~B17 zod"로 되어 있는데 ①은 25개 묶음이다. "B1~B25"로 고친다.
- 09 M5 범위: `prompts/{role}.v{N}.md`가 남아 있다. S-11은 이 표기를 0건으로 정했다. `<role>@v<N>.md`로 고친다.
- 09 M3 범위: `V-TRUE/V-FIT/V-BAL` 표기가 남아 있다. R-03의 `v_true…`로 고친다.
- 09 M5 ④: "조화 ≥80, 취향 ≥75" 리터럴이 있다(S-06에 따르면 09는 수치를 소유하지 않는다). 키 경로로 바꾼다.
- 06 6.19: "09장 표기 수정 필요", "02장 2.3.1이 아직 A1~A5", "01장 1.8.4 문구" 같은 미해결 행이 남아 있다. 반영됐으면 행을 지우고, 아니면 해당 장을 고친다.
- 07 TC-C-02와 7.6 동시성 행: "동시 `running` ≤ 5", "전역 5"로 되어 있다. S-14의 실효 상한 2(06 AC-06-37)와 맞춘다. 2이면 10건 × 잡 ≈ 40s에서 최대 대기 ≈ 4 × 40 = 160s다. "≤ 2 × p95(180s)"와의 여유가 작으므로 bench 값으로 확인한다.
- 06 AC-06-02: `pg_tables`에는 `forcerowsecurity` 컬럼이 없다(PG16 실측). `pg_class.relrowsecurity`·`relforcerowsecurity`로 고친다.
- 06 6.4.2: `BLOCKED_BRAND{reason:'content_policy'}`를 잡 오류로 쓴다고 했지만, `generation_jobs`에는 `details` 컬럼이 없다. `error_code='BLOCKED_BRAND'` + `error_message`에 reason을 넣는다는 식으로 저장 위치를 적는다.
- 6.16 `bench:render`·`p95_est`: 09 M8·9.9.1 `release:check` 단계 목록에 없다. G3 단계 ID를 추가한다.
- **수용 기준**: 위 항목의 grep 결과가 0건이거나 수정 문구가 반영돼 있다.

### TL3-10 · Minor · `callLlm` 재시도가 이미 정산한 예약을 다시 씀

- **관련 절**: 06 6.9.4 코드(`reserve`가 대상 루프 바깥, `settle(resv, cost)`가 attempt 루프 안)
- **허점**: attempt 1이 실패하면(5xx) 그 예약은 settle된다. 그런데 attempt 2는 새 예약 없이 출발한다. 병렬 상황에서는 이 재시도분이 판정식 밖에서 지출된다.
- **보완안**: attempt마다 `reserve → call → settle/release`를 한다. 이렇게 하면 재시도 직전에도 판정식이 다시 적용된다.
- **수용 기준**: 단위 테스트에서 7개 병렬 호출 중 3개가 `server_error` 후 재시도할 때, 모든 시점에서 `spent + reserved ≤ cap`이다.

### TL3-11 · Minor · local 전용 라우트의 "조건부 등록"과 preview 3001 포트

- **관련 절**: 06 6.13.1 Storage 행("`/api/_storage/…` 이 라우트는 `APP_ENV=local`일 때만 등록"), 규칙 1("미리보기 서버는 web 프로세스가 3001 포트에서 함께 연다"), AC-06-08(Next 빌드 매니페스트에서 라우트 수집), 09 M7 ⑪ `verify:api-parity`
- **허점**:
  - Next App Router는 파일 기반이라 env로 라우트를 "등록"할 수 없다. 매니페스트에는 항상 포함되므로 AC-06-08·`api-parity`와 충돌한다.
  - `next dev`·`next start`는 한 포트만 연다. 그래서 "같은 프로세스가 3001을 연다"는 커스텀 서버 또는 2번째 프로세스를 뜻하는데, 어느 쪽인지 정해지지 않았다.
- **보완안**:
  - 라우트는 항상 존재하게 두고, `APP_ENV≠local` 또는 `STORAGE_DRIVER≠fs`이면 404를 반환한다. 6.4.3에 "local 전용" 표시로 넣고 계약 테스트에서 제외 목록에 둔다.
  - preview는 `pnpm dev:stack`이 `next start -p 3001`(같은 빌드)을 2번째 프로세스로 띄우는 것으로 정한다. Host 분기 미들웨어는 그대로 쓴다.
- **수용 기준**: prod 빌드에서 `/api/_storage/*` 요청이 404이고, `api-parity`가 이 라우트를 누락이나 초과로 보고하지 않는다. native에서 `curl http://127.0.0.1:3001/healthz`가 200이다.

---

## 3. 루브릭 판정

| 기준 | 판정 | 이유 |
|---|---|---|
| C1 완결성 | **FAIL** | 담당 영역의 문서 구성(경계, DDL, API, 잡, 보안, 배포, 프로파일)은 갖췄고, DDL은 PG16 실측에서 오류 0이다. 그러나 native 데이터 접근 계층(TL3-01)이 비어 있다. 원가 모델(TL3-03·04)과 비밀 보관·권한 원천(TL3-02)은 구현 결과의 정확성에 직접 영향을 준다. |
| C2 AI 구현 가능성 | **FAIL** | 에이전트가 다음 결정을 직접 내려야 하고, 그 결정은 M1 수용 테스트를 쓰는 즉시 잠금으로 굳는다. ① supabase-js(PostgREST)와 직접 SQL 중 무엇을 쓸지, `request.jwt.claims` 주입 방식, 타입 생성기, 공개 URL ② 트리거용 비밀 보관 위치와 관리자 권한 원천 ③ `cost_spike` 정의 선택과 Mock 비용 기대값 |
| C3 대기업 통과 | **FAIL** | 리뷰어가 원가표를 검산하면 "병렬 6호출의 캐시 읽기 5회"가 성립하지 않는다. 그 결과 기본 경로가 생략 임계를 넘고 품질 루프가 상시 꺼진다(TL3-03). DB 트리거가 env 비밀에 의존하고 관리자 강등 규칙이 서로 반대인 점(TL3-02)은 보안 리뷰에서 지적된다. 그 밖의 게이트 항목(SLO 용량 근거, 보관 파기, 위협 모델, 롤백)은 2라운드 대비 통과 수준이다. |

## 4. 다음 라운드 PASS를 위한 최소 조건

1. **TL3-01**: 06 6.13.1·6.3.5에 `DbPort`(`withUser`·`withAnon`·`withService`, 직접 SQL + `SET LOCAL ROLE` + `request.jwt.claims`)를 두 프로파일 공통 원천으로 넣는다. 함께 타입 생성기, `StoragePort.publicUrl`, `AuthPort.admin*`, 조건부 필수 env를 정한다. 그다음 이 컨테이너(native)에서 shim + DDL + `withUser` RLS 테스트 1건이 실제로 도는지 확인한다.
2. **TL3-02**: `provision_user()` 함수로 트리거의 env 의존을 없애고, 관리자 권한 원천을 "role ∧ ADMIN_EMAILS" 한 문장으로 통일한다.
3. **TL3-03·04**: 06 6.9.4에서 호출 순서(캐시 예열 또는 재계산) 중 하나를 고정하고, Mock usage에 캐시 규칙을 추가해 AC-06-56 기대값을 공식으로 정한다. `cost_spike` / `cost_ramp` / `usage_overrun` 세 시나리오로 정의를 통일한다(04·07·09 동시 수정).
4. Minor 7건(TL3-05~11)은 반영하면 좋지만 PASS 판단에는 영향이 없다. 특히 TL3-06(트리·의존 표)과 TL3-09(AC-06-02 컬럼명)는 M0·M1에서 바로 잠금되는 산출물에 영향을 주므로, 같은 반영 커밋에서 함께 고치기를 권한다.
