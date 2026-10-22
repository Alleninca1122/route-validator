// 共享类型定义

/** 交付档位（服务模式，框架 v2.3）：verdict = A 档仅判定；verdict_plus = B 档判定＋推荐 */
export type ServiceTier = 'verdict' | 'verdict_plus';

export const SERVICE_TIER_LABELS: Record<ServiceTier, string> = {
  verdict: '仅判定',
  verdict_plus: '判定＋推荐',
};

export interface RouteStep {
  step: number;
  transformation: string;
  starting_material: string;
  reagents: string;
  conditions: string;
  product: string;
  notes: string;
}

export interface ParsedRoute {
  target_molecule: string;
  steps: RouteStep[];
  total_steps: number;
  raw_notes: string;
}

export interface GateResult {
  gate: number;
  name: string;
  passed: boolean | null; // null = 未评审（fail-fast 提前终止）
  reason: string;
  notes: string[];
}

/** B 档（判定＋推荐）交付的推荐部分；A 档时为 null */
export interface Recommendation {
  /** 是否找到合适的推荐路线 */
  found: boolean;
  /** 推荐来源：rerank = 生成器路线树重排；patch = 最小补丁；generated = 另行生成 */
  source: 'rerank' | 'patch' | 'generated' | null;
  /** 一句话说明（找到时为推荐要点；未找到时为如实说明） */
  summary: string;
  /** 推荐路线概述（found 时给出） */
  route_description: string;
  /** 推荐路线的五关闯关记录（found 时给出，与原路线同一标准） */
  gates: GateResult[];
}

export interface EvaluationResult {
  /** candidate = 五关全过；lab_feasible = 过前四关、死于第 5 关（不算淘汰）；eliminated = 死于第 1–4 关 */
  verdict: 'candidate' | 'lab_feasible' | 'eliminated';
  /** 仅淘汰时有值（1–4） */
  eliminated_at_gate: number | null;
  gates: GateResult[];
  notes_summary: string[];
  next_steps: string;
  one_line_cause: string;
  /** B 档才有；A 档为 null。旧记录可能缺失 */
  recommendation?: Recommendation | null;
}

export interface EvaluationRecord {
  id: string;
  user_id: string | null;
  target_molecule: string;
  route_input: string;
  parsed_steps: ParsedRoute;
  evaluation_result: EvaluationResult;
  service_tier: ServiceTier;
  created_at: string;
}

export const GATE_NAMES = ['化学可能性', '安全红线', '官能团兼容性', '关键步骤先例', '放大可行性'];
