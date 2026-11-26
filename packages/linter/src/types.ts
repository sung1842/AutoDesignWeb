// 04장 4.13 AI 티 린터 공통 타입(ASM-077). 렌더 단계(D·P) 스냅숏은 worker 하네스 lintSnapshot이 만든다.
import type { LintFinding } from "./stage-s.js";

export type { LintFinding };
export type Stage = "S" | "C" | "T" | "D" | "P";
export type Severity = "error" | "warn";
export type Obj = { [k: string]: unknown };

/** 카피 1건. role은 슬롯 역할(hero.headline·hero.eyebrow·heading·button·badge·card.title·body·proof.quote·proof.author…). */
export interface CopyItem {
  role: string;
  text: string;
  /** llm = LLM 생성 슬롯(기본), user = 사용자 원문 슬롯(4.6.4). */
  source?: "llm" | "user";
  /** eyebrow 표시 형태(pill 등, AIL-04). */
  style?: string;
}

/** 렌더 DOM 요소 1개의 computed style 요약(단계 D). */
export interface SnapEl {
  tag: string;
  /** data-role(없으면 null). */
  role: string | null;
  /** 가장 가까운 section의 순번(0부터, 없으면 -1). */
  section: number;
  /** 요소 자신의 텍스트 노드(공백 축약). */
  text: string;
  heading: boolean;
  button: boolean;
  badge: boolean;
  cardTitle: boolean;
  card: boolean;
  wordmark: boolean;
  decorative: boolean;
  layoutAuto: boolean;
  /** 클래스의 타입 스텝(t-1·t-lead…, 없으면 null). */
  step: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  position: string;
  bgImage: string;
  bgClip: string;
  filter: string;
  backdropFilter: string;
  boxShadow: string;
  textShadow: string;
  radius: number;
  fontFamily: string;
  fontSize: number;
  color: string;
  bgColor: string;
  borderColor: string;
  borderWidth: number;
  padding: number[];
  gap: number[];
  margin: number[];
  marginAuto: boolean;
  /** svg 아이콘 정보(아이콘이 아니면 null). */
  icon: { set: string | null; size: number; stroke: number | null } | null;
}

/** 형제 아이콘 카드 행(AIL-05 D): 부모 아래 자식이 전부 아이콘+제목+본문 카드인 경우. */
export interface IconCardRow {
  section: number;
  n: number;
  /** (최대 너비 − 최소 너비) / 최대 너비. */
  widthSpread: number;
}

/** 토큰 허용 집합(AIL-17). 하네스가 spec.tokens에서 만든다. */
export interface TokenSet {
  colors: string[];
  radii: number[];
  spacing: number[];
  /** 타입 스텝 → 이 뷰포트의 기대 px(expectedSize). */
  fontSizes: Record<string, number>;
}

export interface Snapshot {
  vw: number;
  vh: number;
  /** :root custom property 원문 값. */
  rootVars: Record<string, string>;
  elements: SnapEl[];
  iconCardRows: IconCardRow[];
  headlines: { role: string; lines: number; lastLineChars: number }[];
  /** 단계 P: backdrop-filter 요소 뒤 영역 휘도 표준편차(0–255). */
  glass: { lumStd: number }[];
  tokens: TokenSet | null;
}

export interface LintInput {
  spec?: unknown;
  tree?: unknown;
  copy?: CopyItem[] | { items: CopyItem[] };
  brand?: unknown;
  snapshot?: Snapshot;
  [k: string]: unknown;
}

export interface RuleCtx {
  spec: Obj | null;
  tree: Obj | null;
  copy: CopyItem[] | null;
  brand: Obj | null;
  snapshot: Snapshot | null;
  /** 이번 실행에서 이 규칙이 돌릴 단계. */
  stages: ReadonlySet<Stage>;
}

export interface Rule {
  id: string;
  stage: Stage[];
  severity: Severity[];
  appliesTo: ("M" | "U")[];
  messageKo: string;
  fixHint: string;
  check(ctx: RuleCtx): LintFinding[];
}
