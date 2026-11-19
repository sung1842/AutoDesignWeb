# 허용 의존성 목록 (09장 9.5.5 F12)

- 상태: **초안(provenance: temp)** — 사람이 없어 P3에서 에이전트가 09장 9.1.3 의존 규칙과 06장 스택에서 뽑아 작성했다(2026-11-19, AD-023). 사람 확인 전까지 M0 끝까지는 에이전트가 행을 더할 수 있고(근거를 ASSUMPTIONS.md에 기록), M0 종료 시 잠근다. 잠근 뒤 새 패키지가 필요하면 BLOCKED.md(`locked-conflict`).
- 라이선스: MIT / Apache-2.0 / BSD-2·3-Clause / ISC / OFL-1.1만(`license-checker`). 간접 의존성도 같은 규칙.
- 버전: 아래 범위(작성 시점 npm 최신 major). `playwright`는 컨테이너에 설치된 chromium과 맞춰 정확 고정.
- "쓰는 곳"을 벗어난 import는 9.1.3 의존 규칙 검사(`scripts/guard/deps.ts`)가 막는다.

| 패키지 | 범위 | 쓰는 곳 | 라이선스 |
|---|---|---|---|
| typescript | ^5.9.0 (09장 9.1.1: 5.x) | 전체(dev) | Apache-2.0 |
| tsx | ^4.23.0 | 스크립트 실행(dev) | MIT |
| turbo | ^2.11.0 | 모노레포(dev) | MIT |
| eslint | ^9.0.0 (typescript-eslint 8 호환) | 린트(dev) | MIT |
| typescript-eslint | ^8.0.0 | 린트(dev) | MIT |
| prettier | ^3.10.0 | 서식(dev) | MIT |
| vitest | ^3.2.0 | 단위·수용 테스트(dev) | MIT |
| @playwright/test, playwright, playwright-core | =1.63.0 | e2e, apps/worker, extractor(타입). **apps/web 금지** | Apache-2.0 |
| dependency-cruiser | ^18.0.0 | guard deps(dev) | MIT |
| license-checker | ^25.0.0 | guard 라이선스(dev) | BSD-3-Clause |
| zod | ^4.0.0 | config, data-contracts, layout-schema, api-contract | MIT |
| yaml | ^2.9.0 | models.yaml·processors.yaml 로드 | ISC |
| react, react-dom | ^19.0.0 | renderer, ui, apps/web | MIT |
| next | ^16.0.0 | apps/web | MIT |
| ai | ^5.0.0 | packages/llm만 | Apache-2.0 |
| @ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/provider | 최신 major | packages/llm만 | Apache-2.0 |
| kysely | ^0.29.0 | packages/db | MIT |
| kysely-codegen | ^0.20.0 | packages/db(dev, `db:types`) | MIT |
| pg, @types/pg | ^8.0.0 | packages/db | MIT |
| pg-boss | ^12.0.0 | apps/worker, packages/db(큐 상태) | MIT |
| @supabase/supabase-js | ^2.0.0 | auth·storage의 supabase 드라이버 안에서만 | MIT |
| sharp | ^0.35.0 | data-contracts(B8 플레이스홀더), assets, worker | Apache-2.0 |
| jszip | ^3.10.0 | exporter | MIT 또는 GPL-3.0 이중 → MIT로 사용 |
| @fontsource/noto-sans-kr, @fontsource/noto-serif-kr | ^5.0.0 | temp 폰트 대체(B6, S-02) | OFL-1.1 |
| @radix-ui/* | ^1.0.0 | packages/ui만 | MIT |
| tailwindcss | ^4.0.0 | packages/ui(선택)만. **renderer 금지** | MIT |
| @types/node, @types/react, @types/react-dom | 최신 major | 타입(dev) | MIT |

명시적 금지(9.1.3·D-28): renderer의 `tailwindcss`·shadcn 계열·`lucide-react`, apps/web의 `playwright*`·`chromium`, `packages/llm` 밖의 provider SDK.
