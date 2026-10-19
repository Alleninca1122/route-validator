// 共享类型定义

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

export interface EvaluationResult {
  verdict: 'candidate' | 'eliminated';
  eliminated_at_gate: number | null;
  gates: GateResult[];
  notes_summary: string[];
  next_steps: string;
  one_line_cause: string;
}

export interface EvaluationRecord {
  id: string;
  user_id: string | null;
  target_molecule: string;
  route_input: string;
  parsed_steps: ParsedRoute;
  evaluation_result: EvaluationResult;
  created_at: string;
}

export const GATE_NAMES = ['化学可能性', '安全红线', '放大与经济性', '官能团兼容性', '关键步骤先例'];
