// variant 템플릿 등록(CM-01). compile.ts는 블록 모듈을 import하지 않는다(순환 방지) → 패키지 진입점에서 1회 등록.
import { registerContentA } from "./content-a.js";
import { registerContentB } from "./content-b.js";
import { registerHero } from "./hero.js";

registerHero();
registerContentA();
registerContentB();
