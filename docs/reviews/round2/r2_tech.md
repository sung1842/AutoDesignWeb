# R2 리뷰: 테크 리드 관점

- 대상: `06_architecture.md` 6.1~6.3(데이터 모델)·6.4(API)·6.8~6.11(워커·게이트웨이·비용·보안)·6.13(배포), `09_implementation.md` 9.1(레포 구조)·9.3~9.6(마일스톤·운영 규칙·Mock)·9.9~9.10. 다른 장은 grep으로 필요한 절만 확인했다(04 4.7.1·4.17, 07 7.1·7.6, 08 8.7.7~8.7.8).
- 기준: `rubric.md`, `decisions_v2.md`(R-01~R-38), 1라운드 `r1_tech.md`(TL-01~28)
- 핵심 질문: **사람 없이 클라우드 컨테이너에서** Claude가 이 기획서만 보고 M0~M8을 구현하고 스스로 검증할 수 있는가?
- 규칙: 1라운드에서 해결된 항목은 다시 쓰지 않는다. 다른 역할의 2라운드 리뷰(PM2·UX2·QA2)와 겹치는 항목도 다시 쓰지 않는다. 예를 들어 보류 상태 enum(QA2-02), 잠금 기준의 순환(QA2-03), 07·09 수치 불일치(QA2-04), 명칭 잔재(QA2-08)는 해당 리뷰를 따른다.

## 실행 환경 실측(2026-11-18, 이 저장소의 작업 컨테이너)

기획서가 "로컬"이라고 부르는 환경이 실제로 무엇인지 확인했다. 리뷰 판단의 근거로 쓴다. 세션마다 환경이 다를 수 있으므로, 기획서는 아래 상태와 "Docker가 있는 상태" 둘 다를 다뤄야 한다.

| 항목 | 결과 | 기획서가 가정한 것 |
|---|---|---|
| Docker | 클라이언트만 있음. 데몬 없음(`/var/run/docker.sock` 없음). `registry-1.docker.io`·`public.ecr.aws` 연결은 프록시가 거부(403) | Supabase CLI 로컬 스택, docker compose worker, worker 이미지 안에서 시각 회귀 실행 |
| Playwright 브라우저 | 다운로드 CDN 차단(403). 대신 `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`에 **chromium-1243만** 사전 설치, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` | `mcr.microsoft.com/playwright` 이미지, chromium·webkit·firefox 매트릭스 |
| PostgreSQL | 16 바이너리 있음. `pgcrypto` 있음, **`pgvector` 없음** | Supabase Postgres(`vector` 포함) |
| npm 레지스트리 | 접근 가능 | — |
| 한글 폰트 | Noto CJK가 시스템에 설치돼 있음 | worker 이미지의 `fonts-noto-cjk` |
| GitHub | 원격 저장소 있음(`gh` 사전 설정) | CI(GitHub Actions)에서 통합·E2E 실행 |

06장 6.3.3 DDL을 이 컨테이너의 PostgreSQL 16에 직접 적용해 봤다. `auth` 스키마 스텁(`auth.users`, `auth.uid()`)과 역할 3개(`anon`·`authenticated`·`service_role`)만 미리 만들었다. 결과는 다음과 같다.

- `vector` 확장과 `reference_features.embedding` 두 곳만 실패했고, 나머지 46개 테이블·뷰·함수·인덱스는 오류 없이 만들어졌다.
- DDL 자체는 Docker 없이도 성립한다. 그러나 이 대체 경로가 기획서에 없다.
- 이 실험에서 실제 결함 2개를 재현했다(TL2-03, TL2-05).

## 총평

06장은 1라운드에서 지적한 시스템 경계, DDL, API, 잡 상태, 보안 위협 모델, 관측성, 배포·롤백, 스택 근거를 모두 갖췄다. 대기업 기술 리뷰 문서로서 구성은 충분하다. 09장도 마일스톤, verify, guard, MockProvider로 "키 없이 끝까지 검증"하는 구조를 세웠다.

남은 문제는 두 가지다.

1. **검증 경로 전체가 Docker를 전제로 한다.** 위 실측대로 이 프로젝트를 실제로 구현할 컨테이너에는 Docker 데몬이 없고, 이미지 레지스트리와 브라우저 CDN도 막혀 있다.
   - Supabase CLI 로컬 스택(Postgres·Auth·Storage·Mailpit)을 띄울 수 없다.
   - worker 이미지 안에서만 만든다는 시각 회귀 기준선도 만들 수 없다.
   - 결과적으로 M1 ⑤, M2 ⑤, M5 ①, M7 ⑧, M8 ③은 처음부터 통과할 수 없다.
   - 기획서의 대응은 "BLOCKED 기록 후 다른 작업"뿐이다. 그런데 서로 다른 마일스톤 3개에 BLOCKED가 생기면 HALT 규칙에 걸린다. 그래서 자율 구현은 M4~M5 근처에서 멈춘다.
   - CLAUDE.md는 "09장 의도를 지키는 대안을 고르라"고 하지만, 대안이 무엇인지는 에이전트가 정해야 한다. 이것은 아키텍처 결정이므로 C2 위반이다.
2. **비용 가드·용량·보관 파기에 설계 결함이 있다.** 병렬 호출의 예산 경쟁, 머신당 동시 잡과 Chromium 컨텍스트의 불일치, 보관 파기 규칙과 FK 제약의 충돌이다. 앞의 둘은 대기업 기술 리뷰에서 반드시 묻는 "원가 상한의 정확성"과 "SLO 용량 근거"에 해당한다.

둘 다 1인 범위에서 고칠 수 있다. 문서 몇 절과 어댑터 2개(DB 스텁·저장소/인증 드라이버)를 더하면 된다.

**새 항목 집계: Blocker 2 / Major 5 / Minor 3**

---

## 1. 1라운드 항목 해결 현황

| ID | 상태 | 근거 절 | 비고 |
|---|---|---|---|
| TL-01 | 해결 | 00 범위·비목표, R-03 | 라벨·개수·설문 이미지 출처 단일화 |
| TL-02 | 해결 | 06 6.1·6.2, P1 | 설계는 해결. 이 컨테이너에서 검증하는 경로는 TL2-01 |
| TL-03 | 해결 | 06 6.3.3~6.3.6 | 보관 파기 정합 → TL2-05, `vector` → TL2-07 |
| TL-04 | 해결 | 02, 03 3.4.7, R-01 | |
| TL-05 | 해결 | 04 PageSchema, 6.11.3 | |
| TL-06 | 부분 | 04 4.17, 06 6.2.4·6.10.3 | 예산·SLO 수치는 있다. 병렬 호출 예산 가드 결함 → TL2-03, 용량 산식 → TL2-04 |
| TL-07 | 해결 | 06 6.11 | |
| TL-08 | 해결 | 09 9.1~9.5 | 실행 환경 대안 → TL2-01·02, 운영 규칙 이중화 → TL2-06 |
| TL-09 | 해결 | 05 5.4~5.5, 06 6.11.6 | |
| TL-10 | 해결 | 06 6.4, `@tastefit/api-contract` | |
| TL-11 | 해결 | 06 6.5 | |
| TL-12 | 해결 | 06 6.9, 09 9.6 | Mock 단가 미정 → TL2-03 |
| TL-13 | 해결 | 06 6.6·6.7 | |
| TL-14 | 해결 | 06 6.12 | |
| TL-15 | 부분 | 07 7.1, 09 9.4 | 테스트 전략은 있다. 그러나 통합·E2E·시각 회귀가 Docker 전용이라 실행 환경에서 녹색을 낼 수 없음 → TL2-01·02 |
| TL-16 | 해결 | 04 4.13 | |
| TL-17 | 해결 | 03, 08, 06 6.8.3 | |
| TL-18 | 해결 | 06 `mockup_versions`, 04 4.15 | |
| TL-19 | 부분 | 06 6.13 | 배포·환경 변수는 해결. 수용 기준 "클린 클론에서 로컬 전체 흐름 실행"을 실제 환경에서 달성할 경로가 없음 → TL2-01 |
| TL-20 | 해결 | 06 6.10 | |
| TL-21 | 해결 | 06 6.14 | |
| TL-22 | 해결 | 02, 09 M4 `survey:build` | |
| TL-23(Minor) | 해결 | 06 6.16 | 동시성 산식 오류 → TL2-04 |
| TL-24(Minor) | 부분 | 08 8.7.7~8.7.8, 06 `retention` | 파기 규칙이 스키마와 맞지 않아 실행 시 실패 → TL2-05 |
| TL-25(Minor) | 해결 | 03 3.8, 04 AIL-24 | |
| TL-26(Minor) | 해결 | 06 6.5.1 | |
| TL-27(Minor) | 해결 | 07 7.7 | |
| TL-28(Minor) | 해결 | 05, R-38 | |

해결 24 / 부분 4 / 미해결 0.

---

## 2. 새 항목

| ID | 심각도 | 제목 |
|---|---|---|
| TL2-01 | Blocker | Docker·Supabase 로컬 스택을 쓸 수 없는 실행 환경의 대체 프로파일이 없음 |
| TL2-02 | Blocker | 브라우저·worker 이미지 전용 검증(시각 회귀 기준선, 브라우저 매트릭스, Playwright 버전 고정)의 대안이 없음 |
| TL2-03 | Major | 병렬 LLM 호출에서 잡 예산 가드가 경쟁하고, 원가 추정식이 04·06장에서 달라 DB CHECK 위반으로 잡이 죽음 |
| TL2-04 | Major | 머신당 동시 생성 잡 5개 대 Chromium 컨텍스트 3개: SLO 산식이 피크에서 성립하지 않음 |
| TL2-05 | Major | 보관 파기 규칙(미선택 후보 30일)이 스키마와 맞지 않아 `retention`이 매일 실패함 |
| TL2-06 | Major | 저장소 CLAUDE.md(세션 운영)와 09장(구현 운영)의 규칙이 이중으로 존재하고 서로 다름 |
| TL2-07 | Major | MVP DDL에 Phase 2 전용 `pgvector` 확장·컬럼이 있음(09장 P0 원칙 위반, 네이티브 PG에서 마이그레이션 실패) |
| TL2-08 | Minor | `anon_id` 타입이 테이블마다 다름(uuid / text) |
| TL2-09 | Minor | `/api/survey-items` 1년 immutable 캐시와 관리자 문항 활성 토글(ADM-08)의 충돌 |
| TL2-10 | Minor | 09장 9.1.3 의존 규칙이 06장 R-1과 다름(web의 `llm`·`exporter` 허용) |

---

### TL2-01 · Blocker · Docker·Supabase 로컬 스택을 쓸 수 없는 실행 환경의 대체 프로파일이 없음

- **관련 절**: 06 6.13.1(local = Supabase CLI 로컬 + docker compose), 6.3.6 AC-06-01(`supabase db reset`·`db lint`), 6.5.2(E2E = Mailpit), 6.11.4·6.13.2(오리진), 09 9.1.1, 9.4 M0 ③·M1 ⑤⑦⑧·M5 ①, 9.5.3(환경 실패·HALT), 9.6.3, 9.9.2, 07 7.1(통합 = Supabase 로컬(Docker)), 저장소 CLAUDE.md P4
- **허점**:
  1. 기획서의 모든 통합·E2E 검증은 Supabase CLI 로컬 스택이 있어야 돌아간다. 이 스택은 Postgres, GoTrue(Auth), Storage API, Mailpit으로 이루어지며 Docker가 필요하다. 그런데 실제 구현 컨테이너에는 Docker 데몬이 없고 이미지 레지스트리도 막혀 있다(위 실측).
  2. 9.5.3의 대응은 "재시도 2회 → BLOCKED(`env`) → 순수 패키지 작업으로 이동"뿐이다. 스택이 필요한 마일스톤은 M1, M4, M5, M6, M7이므로, 같은 규칙의 HALT 조건("BLOCKED가 서로 다른 마일스톤 3개")에 반드시 걸린다. 반면 9.9.2는 `env` 유형의 open BLOCKED를 허용한다. 두 규칙이 서로 모순이다.
  3. CLAUDE.md P4는 "09장 의도를 지키는 대안을 고르라"고 한다. 그러나 다음은 모두 아키텍처 결정인데 문서에 없다(C2 위반).
     - 대안 DB를 무엇으로 할지
     - `auth.users`·`auth.uid()`·RLS 역할을 어떻게 흉내 낼지
     - Storage와 서명 URL을 무엇으로 대체할지
     - R-10(테스트 로그인 우회 라우트 금지)을 지키면서 Mailpit 없이 로그인을 어떻게 검증할지
  4. 로컬 오리진이 정해져 있지 않다. 다음이 모두 열려 있다.
     - PREVIEW_ORIGIN은 "다른 등록 도메인"이어야 하는데, 로컬에서 그 값이 무엇인지
     - `Secure` 쿠키, HSTS, `upgrade-insecure-requests`를 http 로컬에서 어떻게 다루는지
     - AC-06-25(CSP 바이트 비교)의 오리진을 어떻게 치환하는지
  5. 수용 테스트와 verify 스크립트는 작성 직후 자체 잠금된다. 따라서 에이전트가 처음에 고른 방식(예: `supabase db reset` 호출)이 그대로 굳고, 나중에 바꿀 수 없다.
- **이유**: 이 프로젝트의 운영 전제는 "사람 없이 클라우드 컨테이너에서 자율 구현"이다. 이 전제에서 M1 이후의 verify는 녹색이 될 수 없고, 자율 루프가 스스로 검증하지 못한 채 멈춘다. 1라운드 TL-15·TL-19의 수용 기준("키 없이 verify 녹색", "클린 클론에서 로컬 전체 흐름")도 실제 환경에서는 달성할 수 없다.
- **보완안**(06 6.13.1에 "스택 프로파일" 절, 09 9.1.1·9.5.3·9.6.3 갱신):
  ```
  STACK_PROFILE = supabase | native   (기동 시 자동 판정: docker info 성공 → supabase, 아니면 native. 강제 지정 가능)

  native 프로파일(Docker 없음):
  - DB: 시스템 PostgreSQL 16. `pnpm dev:stack`이 initdb → /tmp/tastefit-pg(포트 54322) → 기동.
        마이그레이션 전에 packages/db/shim/0000_supabase_shim.sql 적용:
        역할 anon·authenticated·service_role(bypassrls), schema auth,
        auth.users(id uuid pk, email text, created_at), auth.uid()·auth.role()
        = current_setting('request.jwt.claims', true)::jsonb의 sub·role.
        shim은 supabase 프로파일에서는 적용하지 않는다(파일 상단 가드).
        RLS 테스트는 `set local role authenticated; set local request.jwt.claims = '{"sub":…}'`로 실행.
  - 마이그레이션 검사: AC-06-01을 "빈 DB 적용 2회(drop/create) 성공 + plpgsql_check 대신 psql ON_ERROR_STOP"으로 대체.
        `supabase db lint`는 needs_ci.
  - Storage: StoragePort 인터페이스(put/get/delete/list/signUrl) + 드라이버 supabase | fs.
        fs 드라이버 = /tmp/tastefit-storage/<bucket>/<path>, 서명 URL = web의 /api/_storage/<bucket>/<path>?exp&sig
        (HMAC, APP_ENV=local에서만 라우트 등록, prod 기동 시 STORAGE_DRIVER=fs면 거부).
  - Auth: AuthPort(issueMagicLink / exchange / getUser / signOut) + 드라이버 supabase | local.
        local 드라이버: 매직링크를 발송하지 않고 dev 메일함 테이블 dev_mail_outbox(to, subject, body, created_at)에
        기록한다. 링크는 실제와 같은 /auth/callback 경로를 쓰고, 세션 = HS256 JWT(LOCAL_JWT_SECRET).
        E2E는 Mailpit HTTP API 대신 DB 메일함을 읽는다(테스트 픽스처 함수, HTTP 라우트 아님).
        이렇게 하면 "로그인 우회 라우트 없음"(R-10)을 지킨다. 우회 경로가 아니라 같은 매직링크 흐름의 발송 수단만 바뀐다.
        APP_ENV≠local에서 AUTH_DRIVER=local이면 기동 거부(AC-09-13과 같은 방식).
  - 오리진: WEB_ORIGIN=http://localhost:3000, PREVIEW_ORIGIN=http://127.0.0.1:3000(서로 다른 site).
        APP_ENV=local에서는 HSTS·upgrade-insecure-requests를 빼고, anon_id의 Secure는 localhost에서 유지한다.
        AC-06-25는 env별 기대 문자열(local/prod) 2개를 둔다.
  - worker: docker compose 대신 `node apps/worker` 프로세스. 브라우저는 TL2-02.

  CI 위임(supabase 프로파일 전용 검증):
  - 다음 단계는 native에서 `needs_ci`로 기록한다(목록은 test-policy.json에 고정, QA2-02 허용표에 추가):
    supabase db lint, Supabase Storage 정책 테스트, GoTrue 실제 매직링크(Mailpit) E2E 1건, worker 이미지 빌드, 시각 회귀 Docker 기준선.
  - GitHub Actions(ubuntu, Docker 있음)에서 같은 verify를 STACK_PROFILE=supabase로 실행한다.
    에이전트는 push 후 `gh run watch`로 결과를 받아 PROGRESS에 기록한다.
    워크플로 파일 push가 권한(workflow scope)으로 거부되면 HUMAN_TODO에 적고 needs_ci 상태로 계속 진행한다.

  9.5.3 수정: 프로파일 대체가 적용된 `env` BLOCKED는 HALT 계산(마일스톤 3개)에서 제외한다.
  대체 결정은 ASSUMPTIONS.md(`env`)가 아니라 이 절의 규칙을 따르므로 새 결정이 아니다.
  ```
- **수용 기준**:
  - Docker 데몬이 없는 컨테이너에서 `pnpm dev:stack`이 120초 안에 native 프로파일로 기동하고, `GET /api/health`가 200 `{db:"ok", queue:"ok"}`를 반환한다.
  - native에서 `verify:m1`이 녹색이다. 06장 DDL 전체(TL2-07 반영)가 shim 위에 적용되고, AC-06-02·03·04·05·06·07의 RLS·제약 테스트가 통과한다.
  - native에서 M5 ① E2E가 통과한다(익명 진단 → 매직링크(dev 메일함) → 귀속 → 시안 3개). 프로덕션 빌드에 `dev_mail_outbox`를 읽는 HTTP 라우트가 0개이고, `APP_ENV=prod` + `AUTH_DRIVER=local`이면 기동이 거부된다.
  - `needs_ci` 목록이 문서에 고정돼 있고, 목록 밖 단계는 native에서 pass/fail만 반환한다.
  - 9.5.3과 9.9.2에서 `env` BLOCKED를 다루는 규칙이 서로 모순되지 않는다.

### TL2-02 · Blocker · 브라우저·worker 이미지 전용 검증의 대안이 없음

- **관련 절**: 09 9.4.1(시각 회귀는 worker Docker 이미지 안에서만), D-0910, M2 ⑤, M6 ④(React zip을 worker 이미지 의존성으로 오프라인 빌드), M7 ⑧(이미지 빌드), M8 ③(chromium·webkit·firefox 매트릭스), 9.6.3(verify:m8을 docker 내부 네트워크에서 재실행), 06 6.8.1·AC-06-34(Playwright 버전 = 이미지 태그), 07 7.1(시각 회귀), 7.6(9개 project), 9.2.4 B6(worker 이미지의 `fonts-noto-cjk`)
- **허점**:
  1. 시각 회귀 기준선을 "worker Docker 이미지에서만" 만든다고 했다. Docker가 없으면 기준선을 만들 수 없으므로 M2 ⑤는 영구 실패한다.
  2. 브라우저 CDN이 막힌 환경에는 사전 설치된 chromium 리비전 1개만 있다. 이 때문에 다음이 성립하지 않는다.
     - `@playwright/test` 버전이 그 리비전과 다르면 브라우저를 찾지 못하고 내려받기도 할 수 없다. 그런데 기획서는 Playwright 버전을 Docker 이미지 태그에 맞추라고만 한다(AC-06-34).
     - webkit·firefox는 없다. 그래서 M8 ③과 07 7.6 매트릭스를 로컬에서 판정할 수 없고, 이 항목은 QA2-02의 보류 상태 어디에도 속하지 않는다.
  3. 다음 검증도 이미지가 전제다. M6 ④는 worker 이미지에 사전 설치된 의존성으로 React zip을 빌드하고, verify:m8은 docker 네트워크에서 재실행하며, B6 temp는 이미지의 폰트를 쓴다. 이미지가 없을 때의 대체가 없다.
- **이유**: TL2-01과 같은 이유로 M2·M6·M8 verify가 녹색이 될 수 없다. 특히 기준선 생성은 첫 커밋부터 막히고, 이후 마일스톤의 누적 verify가 모두 실패한다.
- **보완안**(07 7.1·7.6, 09 9.4.1·D-0910 갱신):
  ```
  렌더 환경 지문 RENDER_ENV_ID = sha256(chromium 리비전 + 폰트 파일 목록·해시 + OS id)의 앞 12자.
  - 시각 회귀 기준선은 e2e/__screenshots__/<RENDER_ENV_ID>/에 저장한다. 현재 지문의 기준선이 없으면
    `chore(visual): baseline <RENDER_ENV_ID>` 단독 커밋으로 1회 생성한다(자체 잠금, 이후 변경은 D-0910 규칙).
    Docker 이미지 기준선은 CI에서 별도 지문으로 관리한다(needs_ci).
  - Playwright 버전: PLAYWRIGHT_BROWSERS_PATH에 사전 설치된 리비전이 있으면, 그 리비전과 짝이 맞는
    playwright 버전을 package.json에 고정한다(scripts/env/check-browsers.ts가 일치를 검사).
    worker 이미지 태그는 이 버전에서 파생한다(AC-06-34는 이 방향으로 검사).
  - 브라우저 매트릭스: 로컬에 있는 엔진만 실행하고, 없는 엔진의 project는 needs_ci로 기록한다(목록 고정: webkit, firefox).
    chromium은 반드시 로컬에서 pass여야 한다.
  - 네트워크 격리(verify:m8): native에서는 NO_EXTERNAL_NETWORK 디스패처 + Chromium route 전면 차단 + 테스트 프로세스의
    HTTP(S)_PROXY를 존재하지 않는 주소로 덮어써 대체한다. docker 내부 네트워크 재실행은 CI 전용.
  - React zip 오프라인 빌드(M6 ④): 워크스페이스에 고정한 템플릿 의존성(pnpm store)으로 `pnpm install --offline` 후 빌드한다.
    이미지 의존이 아니다.
  - 폰트(B6 temp): 시스템에 설치된 Noto CJK를 fc-match로 찾고, 없으면 @fontsource 계열 npm 패키지(OFL)에서 가져온다.
  ```
- **수용 기준**:
  - Docker가 없고 chromium 1개만 사전 설치된 환경에서 `verify:m2`가 녹색이다. 기준선 24장이 `e2e/__screenshots__/<RENDER_ENV_ID>/`에 있고, 재실행 시 `maxDiffPixelRatio ≤ 0.01`이다.
  - `check-browsers`가 Playwright 버전과 설치 리비전의 불일치를 종료 코드 1로 잡는다.
  - native의 `release:check`에서 webkit·firefox 매트릭스는 `needs_ci`로, chromium 매트릭스는 pass/fail로 기록된다.
  - native에서 M6 ④가 외부 네트워크 없이 통과한다.

### TL2-03 · Major · 병렬 LLM 호출에서 잡 예산 가드가 경쟁하고, 원가 추정식이 04·06장에서 달라 DB CHECK 위반으로 잡이 죽음

- **관련 절**: 06 6.9.4(`budget.canSpend(worst)` → 호출 → `budget.add(cost)`), 6.10.3, 6.3.3 `generation_jobs.cost_usd check (≤ 0.30)`·AC-06-07, 6.9.2 `pricing`(캐시 쓰기 단가 없음, mock 단가 `<운영 기본 모델과 동일>`), 04 4.7.1(카피 1 + 레이아웃 6 **병렬**), 4.17.2(추정 = 입력 실측 + 최대 출력, 캐시 쓰기 $3.75/M), 09 9.6.2 ⑥
- **허점**:
  1. **경쟁 조건**: 카피 1개와 레이아웃 6개, 모두 7개 호출이 동시에 출발한다. 각 호출은 "누적 비용 + 이번 최악 원가 ≤ 상한"을 검사하는데, 검사 시점의 누적은 모두 0이다. 다른 호출의 비용은 끝난 뒤에야 더해진다. 그래서 7개가 모두 통과하고, 실제 합계가 상한을 넘을 수 있다.
  2. **DB CHECK가 실패를 키운다**: 넘친 원가를 `generation_jobs.cost_usd`에 원자적으로 더하는 순간 CHECK(≤0.30)가 실패한다. 이 컨테이너에서 0.29 + 0.045를 더해 위반을 재현했다. 결과적으로 원가는 이미 나갔는데 잡 갱신은 예외로 끝나고, 잡은 `WORKER_LOST`가 되거나 처리되지 않은 예외로 남는다. AC-06-07이 "최종 차단선"이라고 부르는 장치가 오히려 잡을 죽인다.
  3. **추정식이 둘이다**:
     - 06장 `worstCost`는 `max_input_tokens`(레이아웃 9,000, 카피 6,000)와 최대 출력을 쓴다. 04장 가정 단가로 계산하면 레이아웃 1회 ≈ $0.045, 카피 ≈ $0.063이고, 기본 경로 7개 합계 ≈ $0.33이다. 이것만으로 상한을 넘는다.
     - 경쟁을 고치려고 예약 방식을 넣으면, 06장 식으로는 기본 경로의 마지막 호출이 매번 `budget_skipped`가 된다.
     - 04장 식은 "입력 실측 + 최대 출력"이다. 04장 생략 단계($0.24 비전 생략, $0.27 수정 루프 생략)는 06장 가드 코드에 없다.
  4. **단가 모델이 부족하다**: `pricing`에 캐시 쓰기 단가가 없어서 04장 원가표(캐시 쓰기 $3.75/M)를 재현할 수 없다. 또 Mock 단가가 "운영 모델과 동일"인데, 운영 모델은 사람이 승격 절차로 나중에 정한다. 사람 없는 구현에서는 Mock 단가가 정해지지 않으므로 AC-04-37("단가 10배"), AC-06-21, M5 ⑤의 기대값이 열려 있다.
- **이유**: 원가 상한은 이 서비스의 단위 경제와 대기업 리뷰의 핵심 통제 장치다(TL-06). 지금 설계로는 병렬 경로에서 상한을 넘거나, 넘는 순간 잡이 실패한다. 고치는 방향도 두 장의 식 중 무엇을 고르느냐에 따라 달라진다(C2).
- **보완안**(06 6.9.4·6.10.3·6.9.2, 04 4.17.2는 참조만 남김):
  ```
  1) 예약-정산: JobBudget을 잡 단위 뮤텍스로 보호한다.
     reserve(est) → 호출 → settle(reservationId, actual). 판정 = spent + reserved + est ≤ cap.
     호출 실패·abort 시 release(reservationId).
  2) 추정식 단일화(06이 원본): est = (실측 입력 토큰 × 1.1) × 입력 단가(캐시 적중분은 캐시 읽기, 첫 호출은 캐시 쓰기)
                          + maxOutputTokens × 출력 단가 + 이미지 수 × per_image.
     입력은 프롬프트 조립 후 토크나이저(또는 문자 수/3 근사)로 계산하고, max_input_tokens 초과 시 호출 전 실패.
  3) 단계 생략 임계(0.24 / 0.27 / 0.30)는 config/thresholds.json `generation.cost_guard_*` 키로 가드 코드가 읽는다.
  4) DB 제약: generation_jobs.cost_usd CHECK를 `≤ JOB_COST_CAP_USD × 1.2`(0.36)로 넓힌다.
     0.30 초과는 예외가 아니라 A11과 같은 경고 알림 + llm_calls 기준 사후 집계로 잡는다.
     (실제 청구 usage가 추정을 넘는 경우를 잡이 죽지 않고 기록한다.)
  5) pricing 스키마에 cache_write_per_mtok를 추가한다. mock/mock-page 단가를 04 4.17.2 가정값
     (입력 3, 출력 15, 캐시 읽기 0.30, 캐시 쓰기 3.75, 비전 입력 1·출력 5 USD/M)으로 고정한다.
     "운영 모델과 동일" 문구는 삭제한다.
  ```
- **수용 기준**:
  - Mock `ok` 시나리오에서 기본 경로 7개 호출 중 `budget_skipped`가 0건이고, 잡 비용이 04장 기본 경로 추정(≈$0.23)의 ±10% 안에 든다.
  - Mock `cost_spike` 시나리오에서 7개 병렬 호출 후에도 `sum(llm_calls.cost_usd where job) ≤ 0.30`이고, DB 예외와 `WORKER_LOST`가 0건이며, 상태는 {partial, fallback} 중 하나다.
  - 예약 동시성 단위 테스트: 동시 `reserve` 20회에서 `spent + reserved`가 상한을 넘는 순간이 0회다.
  - `models.yaml`의 mock 단가가 숫자로 고정돼 있고, AC-04-37을 이 값으로 실행할 수 있다.

### TL2-04 · Major · 머신당 동시 생성 잡 5개 대 Chromium 컨텍스트 3개: SLO 산식이 피크에서 성립하지 않음

- **관련 절**: 06 6.2.5(`generate` 머신당 동시 처리 = 전역 `GEN_MAX_CONCURRENT_JOBS` 5), 6.8.1(머신 1대, 2 vCPU), 6.8.2(`RENDER_MAX_CONTEXTS` 3), 6.2.4·04 4.17.1(렌더 ×6을 "동시 3"으로 9~14s), 6.16(피크 동시 5, 머신 1), AC-06-37
- **허점**:
  - 지연 예산은 "잡 하나가 컨텍스트 3개를 독점한다"는 전제로 계산했다. 후보 6개 × 후보당 ≤5s를 동시 3으로 처리해 약 10s다.
  - 그런데 컨텍스트 세마포어는 **머신 단위**이고, 피크에는 한 머신에서 잡 5개가 동시에 돈다.
  - 그러면 렌더 대기가 생긴다. 잡 5개 × 후보 6개 = 30개 렌더를 컨텍스트 3개로 처리하면 약 50s다. 2 vCPU에서 Chromium 3개가 동시에 레이아웃·스크린샷을 하면 후보당 5s도 보장되지 않는다.
  - 결과적으로 피크에서 p95 ≤ 90s는 산술적으로 성립하지 않고, 120s 폴백 경로로 밀린다.
  - AC-06-37은 Mock LLM 지연만 주고 실제 렌더 부하를 재지 않으므로 이 문제를 잡지 못한다.
- **이유**: 대기업 기술 리뷰는 SLO를 용량 근거와 함께 본다. 지금 숫자로는 SLO와 동시성 설정이 서로 모순되고, 에이전트가 어느 쪽을 조정할지 정해야 한다.
- **보완안**:
  - 6.2.5에 `WORKER_GEN_CONCURRENCY`(머신당 동시 잡, 기본 2)를 추가한다. 전역 상한은 `min(GEN_MAX_CONCURRENT_JOBS, 머신 수 × WORKER_GEN_CONCURRENCY)`로 정한다.
  - 공개 베타 피크 동시 5를 유지하려면 머신 3대(또는 `performance-4x` 1대 + 컨텍스트 6)가 필요하다. 이 사실을 6.16 표에 원가와 함께 적는다.
  - 렌더 큐는 잡 사이에서 공정하게 배분한다(잡별 라운드로빈). 그래야 먼저 시작한 잡의 첫 카드 노출(R-25 p50 ≤45s)이 뒤 잡 때문에 밀리지 않는다.
  - `pnpm bench:render`를 둔다. 이 명령은 후보 1개의 렌더 + 게이트(5 뷰포트) 시간을 컨텍스트 수 1·2·3에서 측정해 `reports/bench-render.json`에 남긴다. `release:check`는 이 값으로 계산한 "피크 동시 잡의 예상 p95"가 ≤ 90s인지 확인한다(산식은 6.16에 명시).
- **수용 기준**:
  - 6.16에 동시 잡 수·머신 수·컨텍스트 수·후보당 렌더 시간으로 p95를 계산하는 식이 있고, 현재 설정값을 넣으면 ≤ 90s다.
  - 통합 테스트(실제 렌더, Mock LLM 지연 0, `WORKER_GEN_CONCURRENCY=2`): 잡 5개를 동시에 요청하면 각 잡의 첫 `mockups.created_at − started_at` 최대값이 단독 실행 대비 ≤ 1.5배다.
  - 머신당 동시 `running` 잡 수가 `WORKER_GEN_CONCURRENCY`를 넘지 않는다.

### TL2-05 · Major · 보관 파기 규칙(미선택 후보 30일)이 스키마와 맞지 않아 `retention`이 매일 실패함

- **관련 절**: 08 8.7.7("미선택 후보(`candidates`, `visible=false` 포함)와 그 스크린샷, 생성 후 30일 삭제"), 8.7.8, 06 6.3.3 `candidates`(`visible` 컬럼 없음, `eligible`만 있음)·`mockups.candidate_id … on delete restrict`, 6.6 `renders/<owner_id>/<render_hash>/`(후보·버전 공용 캐시), 6.7
- **허점**:
  1. 08장의 대상 정의에 나오는 `visible` 컬럼이 DDL에 없다. "미선택"의 판정 기준도 열려 있다. 노출됐지만 사용자가 고르지 않은 시안(`mockups.selected_at is null`)이 여기에 포함되는지, 노출되지 않은 후보만 대상인지 알 수 없다.
  2. 노출된 후보를 지우려 하면 `mockups.candidate_id`의 `on delete restrict`에 걸린다. 이 컨테이너에서 30일 지난 후보를 일괄 삭제하는 쿼리로 FK 위반을 재현했다. 일괄 DELETE 한 문장이면 배치 전체가 롤백된다. 그러면 `retention`이 매일 실패하고 A8 알림이 뜨며, 08장이 요구하는 파기가 실행되지 않는다.
  3. 스크린샷 경로는 `render_hash` 기반 공용 캐시다. 후보 v1을 선택하면 같은 해시를 쓰는 버전이 생긴다. 그래서 후보의 `created_at`만 보고 객체를 지우면 계정 존속 기간 동안 보관해야 하는 버전 썸네일까지 사라질 수 있다.
  4. (참고) 08장 표의 구현 기준 열에 옛 테이블명 `survey_sessions.last_active_at`이 남아 있다(06장은 `diagnosis_sessions`).
- **이유**: 보관 기간 이행은 법무 요구(TL-24, 08장)를 기술로 실현하는 부분이다. 지금은 에이전트가 대상 정의를 스스로 정해야 하고(C2), 그대로 구현하면 운영에서 배치가 실패한다(C1).
- **보완안**(08 8.7.7 행 정의를 06 `RetentionRule`로 구체화):
  ```
  rule candidates_unexposed_30d:
    delete from candidates c
    where c.created_at < now_kst() - interval '30 days'
      and not exists (select 1 from mockups m where m.candidate_id = c.id)
    -- 노출된 시안(mockups)과 그 후보는 "시안" 범주(계정 존속 기간)로 본다.
  rule renders_orphan:
    renders/<owner>/<hash>/ 객체는 같은 hash를 참조하는 candidates·mockup_versions 행이 0개일 때만 삭제.
  배치 단위: 규칙별 1,000행씩 별도 트랜잭션. 한 규칙의 실패가 다른 규칙을 막지 않고, 실패 규칙 ID를 감사 로그에 남김.
  ```
  08장 표의 대상 표기를 "노출되지 않은 후보(`mockups` 미참조)"로 바꾸고 `survey_sessions`를 `diagnosis_sessions`로 고친다.
- **수용 기준**:
  - `RETENTION_NOW=+31d`에서 노출되지 않은 후보 행과 그 전용 렌더 객체는 0개가 되고, 노출 시안의 후보·버전·썸네일은 남는다. 배치 종료 코드는 0이다.
  - 일부러 실패하는 규칙 1개를 주입해도 다른 규칙의 삭제 건수가 감사 로그에 기록된다.
  - 08장 보관 기간표의 "구현 기준" 열에 있는 테이블·컬럼명이 06장 DDL에 모두 존재한다(`verify:schema-parity`가 추가 검사).

### TL2-06 · Major · 저장소 CLAUDE.md(세션 운영)와 09장(구현 운영)의 규칙이 이중으로 존재하고 서로 다름

- **관련 절**: 저장소 `CLAUDE.md` §0~§3(세션 잠금 90분, 5시간 한도 재개 예약, `docs/spec/DECISIONS_LOG.md` AD-xx, `HUMAN_TODO.md`, P3에서 CLAUDE.md 하단에 "구현 규칙" 추가), 09 9.5.3(BLOCKED.md·ASSUMPTIONS.md·HALT), 9.7(PROGRESS.md 형식), 9.8(CLAUDE.md 골격, "잠금", 300줄 이하 AC-09-14), 9.4.1(verify 시간 상한 20분), 9.9.2(`verify:m8` 3회 연속)
- **허점**: 구현 단계(P4)에 들어가면 두 운영 규칙이 한 저장소에서 동시에 적용된다. 둘은 다음 지점에서 다르다.

  | 주제 | 저장소 CLAUDE.md | 09장 |
  |---|---|---|
  | 결정 기록 | `docs/spec/DECISIONS_LOG.md`(AD-xx) | `docs/ASSUMPTIONS.md`(ASM-xxx) |
  | 막힘 | `HUMAN_TODO.md`에 적고 계속 | `BLOCKED.md` + HALT(마일스톤 3개) |
  | PROGRESS.md | P1~P5 체크리스트 + `lock`·`limit` | 9.7 상태 표(M0~M8) + append-only 로그 |
  | CLAUDE.md | P3에서 "구현 규칙"을 덧붙이며 계속 갱신 | 마스터 프롬프트, 사람 잠금, 300줄 이하 |
  | 세션 단절 | 사용량 한도로 언제든 끊김, 잠금 90분 | 끊김을 고려하지 않음(90분 막힘 판정, `verify:m8` 3회 연속 ≈ 60분) |

  세션이 verify 도중 끊겼을 때 처리가 정해져 있지 않다. 그 전까지의 결과가 `reports/verify-mN.json`에 반영되는지, 3회 연속 녹색 판정이 세션을 넘어 이어지는지, 잠금 90분 만료 뒤 다음 세션이 같은 verify를 다시 시작하는지가 모두 열려 있다. "한 작업에 90분 경과" 기준을 세션 사이에서 어떻게 재는지도 없다.
- **이유**: 에이전트는 두 문서 중 어느 쪽을 따를지 매 세션 판단해야 한다(C2). 판단이 세션마다 달라지면 PROGRESS 형식이 섞이고 결정 기록이 두 곳으로 흩어진다. 그러면 다음 세션이 상태를 복원하지 못한다. 이는 "모든 진행 상태는 저장소 안에만 있다"는 운영 전제를 깨뜨린다.
- **보완안**: 09장에 "9.5.7 무인 세션 운용 매핑" 표를 추가한다. P3에서 CLAUDE.md "구현 규칙"을 이 표대로 생성한다.
  - 결정 기록은 하나로 정한다. 제품 공백·충돌은 `docs/ASSUMPTIONS.md`에 쓰고, 운영·환경 결정(TL2-01 프로파일 선택 등)은 `DECISIONS_LOG.md`에 쓴다. 각 파일이 다른 파일을 가리키는 1줄을 둔다.
  - 막힘은 `BLOCKED.md`를 원본으로 한다. 사람이 해야 하는 일만 `HUMAN_TODO.md`로 복사한다. HALT 규칙은 TL2-01 수정본을 따른다.
  - PROGRESS.md는 P1~P5 헤더 아래 P4 절에 9.7 형식을 그대로 넣는다. `lock`·`limit` 필드는 유지한다.
  - CLAUDE.md는 "세션 운영"(현행, 사람 잠금)과 "구현 규칙"(9.8 골격, P3에 1회 생성 후 잠금)의 두 절로 고정한다. AC-09-14의 300줄은 "구현 규칙" 절에만 적용한다.
  - 세션 단절 내성을 정한다.
    - verify는 단계마다 `reports/verify-mN.partial.json`을 갱신하고, 재시작하면 처음부터 다시 돈다(부분 재사용 없음, 판정 단순화).
    - 3회 연속 녹색은 `reports/verify-m8-<n>.json` 3개의 `gitSha`가 같으면 세션이 달라도 인정한다.
    - 막힘 판정 "90분"은 PROGRESS 로그에서 해당 작업의 누적 시간으로 계산한다.
- **수용 기준**:
  - 09장과 CLAUDE.md 양쪽을 grep했을 때 결정 기록·막힘·사람 할 일의 경로가 위 매핑과 1:1이다.
  - P3 산출 CLAUDE.md가 두 절 구조이고, "구현 규칙" 절이 9.8.2의 8개 절을 포함하며 300줄 이하다.
  - 메타 테스트: `verify:m8`을 2회 실행한 뒤 프로세스를 강제 종료하고 새 세션에서 1회를 더 실행하면, 같은 `gitSha`일 때 완료 체크리스트의 "3회 연속"이 충족된다. `gitSha`가 다르면 충족되지 않는다.

### TL2-07 · Major · MVP DDL에 Phase 2 전용 `pgvector` 확장·컬럼이 있음

- **관련 절**: 06 6.3.3 `create extension if not exists vector`, `reference_features.embedding vector null -- Phase 2 전용(R-38). MVP에서 항상 null`, 09 머리말("Phase 2/3 항목은 코드·스키마·UI 어디에도 만들지 않는다"), 09 M1 ⑨ `verify:schema-parity`(06장 DDL과 차이 0)
- **허점**: R-38은 임베딩을 Phase 2로 미뤘다. 그런데 DDL에는 확장과 컬럼이 남아 있어, 09장 원칙과 직접 충돌한다. `schema-parity`가 06장 DDL과 차이 0을 요구하므로, 에이전트가 09장 원칙을 따라 이 컬럼을 빼면 M1 ⑨가 실패한다. 반대로 넣으면 `pgvector`가 없는 PostgreSQL(이 컨테이너, TL2-01의 native 프로파일)에서 마이그레이션 전체가 실패한다.
- **이유**: 잠금되는 대조 기준(schema-parity)과 범위 원칙이 서로 모순이다. 그리고 이 한 줄 때문에 대체 실행 환경 전체가 막힌다.
- **보완안**: 06 DDL에서 `create extension vector`와 `embedding`·`embedding_model` 컬럼을 삭제한다. Phase 2 노트(05 D-055)에 "additive 마이그레이션으로 추가"라고 적는다. TL-28의 수용 기준(additive만으로 수용)을 그대로 만족한다.
- **수용 기준**: `rg -n "vector" docs/spec/v2/06_architecture.md`의 DDL 블록 결과가 0건이다. `pgvector`가 없는 PostgreSQL 16에 shim + 전체 마이그레이션이 오류 0으로 적용된다.

### TL2-08 · Minor · `anon_id` 타입이 테이블마다 다름

- **관련 절**: 06 6.3.3 — `identity_links.anon_id text`·`events.anon_id text` 대 `diagnosis_sessions`·`brief_drafts`·`consents`·`share_links.owner_anon_id`·`reports.reporter_anon_id`·`support_tickets.anon_id`는 `uuid`
- **허점**: 같은 쿠키 값을 두 타입으로 저장한다. 조인하거나 `attach_anon`에서 비교할 때 캐스팅이 필요하다. 쿠키 위조로 uuid가 아닌 값이 들어오면 uuid 컬럼 INSERT에서 500이 난다.
- **보완안**: 전부 `uuid`로 통일한다. `events.anon_id`도 uuid로 바꾸고, API 경계에서 zod `uuid()`로 쿠키를 검증한다. 형식이 틀린 쿠키는 재발급한다.
- **수용 기준**: DDL의 `*anon_id*` 컬럼 타입이 모두 uuid다. 쿠키 `anon_id=not-a-uuid`로 `POST /api/surveys`를 보내면 새 쿠키와 201이 반환되고, 500은 0건이다.

### TL2-09 · Minor · `/api/survey-items` 1년 immutable 캐시와 관리자 문항 활성 토글의 충돌

- **관련 절**: 06 6.2.2(`GET /api/survey-items?taxonomyVersion=` 공개, 1년 immutable), 6.4.3 관리자 `PATCH /api/admin/survey-items/:id`(ADM-08 활성 토글)
- **허점**: 캐시 키가 시즌뿐이다. 그래서 관리자가 문항을 비활성화해도 이미 캐시한 브라우저는 1년 동안 옛 문항 풀로 낙관 계산을 한다. 서버 권위 규칙 덕분에 결과는 맞지만, `survey_desync`가 "정상 0건" 가정을 깨고 매 문항 교체가 일어난다.
- **보완안**: `SurveyView.state`에 `itemsetHash`(활성 문항 ID 정렬 해시)를 싣는다. 요청 URL을 `?taxonomyVersion=&itemset=<hash>`로 바꿔 immutable 캐시를 유지한다. 해시가 다르면 클라이언트가 다시 받는다.
- **수용 기준**: 문항 1개를 비활성화한 뒤 진행 중 세션의 다음 응답에서 `itemsetHash`가 바뀌고, 클라이언트가 새 목록을 1회 받는다. 이후 `survey_desync`는 0건이다.

### TL2-10 · Minor · 09장 9.1.3 의존 규칙이 06장 R-1과 다름

- **관련 절**: 09 9.1.3 `apps/web` 의존 허용 "위 패키지(단, extractor·pipeline 제외)", 06 6.1.2 R-1(web에서 `@tastefit/llm` import 금지), R-2(`@tastefit/api-contract`는 9.1.3 표에 없음)
- **허점**: `scripts/guard/deps.ts`는 9.1.3 표를 원본으로 구현된다. 이 표에 따르면 web이 `llm`과 `exporter`를 import할 수 있다. 반면 06장 ESLint 규칙은 `llm` import를 금지하므로 두 검사가 서로 다른 답을 낸다. 또 `api-contract` 패키지가 9.1.2 트리와 9.1.3 표에 없다.
- **보완안**: 9.1.3 web 행을 "extractor·pipeline·llm·exporter 제외"로 바꾸고, `api-contract` 행을 추가한다(06 R-2 그대로).
- **수용 기준**: 9.1.3 표와 06 R-1~R-4를 기계적으로 비교했을 때 차이가 0이다. web에 `@tastefit/llm` import를 넣은 픽스처에서 deps 검사와 ESLint가 모두 실패한다.

---

## 3. 루브릭 판정

### C1 완결성 — **FAIL**

- 담당 영역의 설계 문서(아키텍처·DDL·API·보안·배포)는 완결에 가깝다.
- 그러나 Blocker 2건(TL2-01·02)과 Major 5건이 남아 있다.
  - 원가 상한의 병렬 경쟁과 DB CHECK 충돌(TL2-03)
  - 피크 SLO 용량 모순(TL2-04)
  - 보관 파기 배치 실패(TL2-05)
  - 범위 원칙과 DDL의 모순(TL2-07)
- 모두 구현 결과의 정확성에 직접 영향을 준다.

### C2 AI 구현 가능성 — **FAIL**

- 이 프로젝트의 실제 실행 환경(Docker 없음, 브라우저 다운로드 차단, chromium 1개, pgvector 없음)에서는 M1 이후 verify를 녹색으로 만들 경로가 문서에 없다.
- 그래서 에이전트가 다음 아키텍처 결정을 직접 내려야 한다.
  - 대체 DB·Auth·Storage
  - 로그인 검증 방식
  - 로컬 오리진
  - 시각 회귀 기준선 위치
  - Playwright 버전 고정
- 결정한 뒤에는 자체 잠금으로 굳는다.
- 운영 규칙도 두 벌(CLAUDE.md 대 09장)이라 결정 기록·막힘·HALT를 어디에 따를지 정해야 한다(TL2-06).
- 비용 가드는 04·06장 식 중 하나를 골라야 한다(TL2-03).

### C3 대기업 통과 — **FAIL**

- 기술 리뷰 게이트의 필수 항목(구성도, 데이터 모델·API 계약, 위협 모델, 비용 상한, SLO, 관측성, 배포·롤백, 스택 근거)은 모두 갖췄다. 1라운드 대비 크게 개선됐다.
- 그러나 리뷰어가 숫자를 검산하면 두 곳에서 걸린다.
  - "잡당 원가 ≤ $0.30"이 병렬 경로에서 보장되지 않는다(TL2-03).
  - "피크 동시 5에서 p95 ≤ 90s"가 머신 1대·컨텍스트 3으로 성립하지 않는다(TL2-04).
- 개인정보 보관 기간 이행이 스키마와 맞지 않는 것(TL2-05)도 보안·개인정보 리뷰에서 지적될 수준이다.

### PASS로 가기 위한 최소 조건

1. TL2-01·02를 반영한다: 06 6.13.1에 스택 프로파일(native/supabase)과 CI 위임 목록, 09 9.1.1·9.4.1·9.5.3·9.6.3에 대체 규칙을 넣는다. 그다음 native에서 `verify:m1`·`verify:m2`가 실제로 녹색이 되는지 이 컨테이너에서 확인한다.
2. TL2-03·04·05·07을 06장 본문(6.9.4·6.10.3·6.2.5·6.16·DDL)과 08 8.7.7 대상 정의에 반영한다.
3. TL2-06 매핑 표를 09장에 추가하고 P3의 CLAUDE.md 생성 규칙에 연결한다.
4. Minor 3건은 반영하면 좋지만 PASS 판단에는 영향이 없다.
