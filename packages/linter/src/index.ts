export const PACKAGE_NAME = "@tastefit/linter";
export * from "./m2.js";
export * from "./types.js";
export { RULES, lintAll, stagesOf } from "./rules.js";
export { matchCliche, type ClicheHit } from "./cliche.js";
export { copyOfTree } from "./tree-copy.js";
export { COPY_RULES, copyRules, type CopyRuleHit } from "./copy-rules.js";
