import { NextRequest, NextResponse } from 'next/server';

// 评审单次调用常需 50–90 秒（长报告＋温度 0 下输出更长）；平台默认 60 秒会杀掉函数
// 表现为 500（r2-05 在温度 0 验证中复现）。放宽到 300 秒，计划若封顶则另行处理。
export const maxDuration = 300;
import { llmJSON, isDemoMode, DEMO_EVALUATE_RESULT, DEMO_EVALUATE_RESULT_TIER_B } from '@/lib/llm';
import { EVALUATOR_SYSTEM_PROMPT, RUBRIC_VERSION, tierInstruction } from '@/lib/rubric';
import { createServerSupabase, isSupabaseConfigured } from '@/lib/supabase-server';
import type { ParsedRoute, EvaluationResult, ServiceTier } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { route_input, parsed, tier: rawTier } = (await req.json()) as {
      route_input: string;
      parsed: ParsedRoute;
      tier?: string;
    };
    if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      return NextResponse.json({ error: '缺少结构化步骤，请先解析路线' }, { status: 400 });
    }
    const tier: ServiceTier = rawTier === 'verdict_plus' ? 'verdict_plus' : 'verdict';

    let result: EvaluationResult;
    let demo = false;
    // 多数决共识（仅真实评审）：同一评审跑 3 个并行样本，取（结论，死关）出现最多的那份完整结果。
    let consensus: { samples: number; agreement: number } | null = null;

    if (isDemoMode()) {
      result = (tier === 'verdict_plus'
        ? DEMO_EVALUATE_RESULT_TIER_B
        : DEMO_EVALUATE_RESULT) as unknown as EvaluationResult;
      demo = true;
    } else {
      const stepsText = parsed.steps
        .map(
          (s) =>
            `Step ${s.step}：${s.transformation}。起始物：${s.starting_material}；试剂：${s.reagents}；条件：${s.conditions || '（原文未写）'}；产物：${s.product}${s.notes ? `；备注：${s.notes}` : ''}`,
        )
        .join('\n');
      const userPrompt = `目标分子：${parsed.target_molecule}\n共 ${parsed.total_steps} 步：\n${stepsText}\n\n${parsed.raw_notes ? `补充信息：${parsed.raw_notes}\n\n` : ''}请按五关评审框架逐关评审，严格按指定 JSON 格式输出。\n\n${tierInstruction(tier)}`;
      // 多数决（工程决定，2026-10-24）：单次采样的结论翻转率对核心输出不可接受
      // （两遍验证仅 8/12 一致），故同一评审并行跑 3 个样本投票；温度 0 保持，
      // 首选仍是温度 0 的结论，投票只解决采样方差。样本失败时用成功样本投票，
      // 全部失败才抛错；B 档的推荐取自中选样本，不另投票。
      const settled = await Promise.allSettled([
        llmJSON(EVALUATOR_SYSTEM_PROMPT, userPrompt),
        llmJSON(EVALUATOR_SYSTEM_PROMPT, userPrompt),
        llmJSON(EVALUATOR_SYSTEM_PROMPT, userPrompt),
      ]);
      const samples = settled
        .filter((s): s is PromiseFulfilledResult<unknown> => s.status === 'fulfilled')
        .map((s) => s.value as EvaluationResult);
      if (samples.length === 0) {
        const reason = settled.find((s) => s.status === 'rejected') as
          | PromiseRejectedResult
          | undefined;
        throw reason?.reason ?? new Error('评审失败');
      }
      const counts = new Map<string, { n: number; sample: EvaluationResult }>();
      for (const s of samples) {
        const key = `${s.verdict}::${s.eliminated_at_gate ?? ''}`;
        const cur = counts.get(key);
        if (cur) cur.n += 1;
        else counts.set(key, { n: 1, sample: s });
      }
      let best: { n: number; sample: EvaluationResult } | undefined;
      for (const c of counts.values()) if (!best || c.n > best.n) best = c;
      result = best!.sample;
      consensus = { samples: samples.length, agreement: best!.n };
      // 收窄原型（2026-10-24，Allen 批准试跑）：判断依据的结论不硬判，转人工复核。
      // 依据取样本多数（缺失按 judgment 计，平票按 judgment 计——不确定时不硬判）。
      // 注意：lab_feasible 本质死于第 5 关（放大阈值，属判断），故按本规则多半转复核——
      // 该后果已在原型验证中列为观察项，是否给 lab_feasible 开口子由后续裁决定。
      const basisCounts = new Map<string, number>();
      for (const s of samples) {
        const b = s.verdict_basis === 'hard' ? 'hard' : 'judgment';
        basisCounts.set(b, (basisCounts.get(b) ?? 0) + 1);
      }
      const hardN = basisCounts.get('hard') ?? 0;
      const judgmentN = basisCounts.get('judgment') ?? 0;
      const majorityBasis = hardN > judgmentN ? 'hard' : 'judgment';
      const basisReason =
        samples.find((s) => (s.verdict_basis === 'hard' ? 'hard' : 'judgment') === majorityBasis)
          ?.verdict_basis_reason ?? '';
      result.verdict_basis = majorityBasis;
      result.verdict_basis_reason = basisReason;
      if (majorityBasis === 'judgment') {
        // 此处 verdict 恒为三值之一（模型输出的 verdict 枚举不含 needs_review，
        // needs_review 只由本段设置）；cast 仅为满足 widen 后的静态类型。
        result.pre_review_verdict = result.verdict as 'candidate' | 'lab_feasible' | 'eliminated';
        result.pre_review_gate = result.eliminated_at_gate;
        result.verdict = 'needs_review';
        result.eliminated_at_gate = null;
        // 未作判定的路线不给推荐（推荐以判定为前提；B 档同理）。
        result.recommendation = null;
        result.notes_summary = [
          ...result.notes_summary,
          '本结论依赖判断题（见 verdict_basis_reason），转人工复核，不作淘汰／候选判定。',
        ];
      }
      // 档位兜底：A 档强制无推荐；B 档缺字段时补 null
      if (tier === 'verdict') result.recommendation = null;
      else if (result.recommendation === undefined) result.recommendation = null;
    }

    // 持久化（Supabase 已配置时）
    let id: string | null = null;
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createServerSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const base = {
          user_id: user?.id ?? null,
          target_molecule: parsed.target_molecule,
          route_input: route_input ?? '',
          parsed_steps: parsed,
          evaluation_result: result,
          rubric_version: RUBRIC_VERSION,
        };
        let { data, error } = await supabase
          .from('evaluations')
          .insert({ ...base, service_tier: tier })
          .select('id')
          .single();
        if (error) {
          // service_tier 列尚未迁移时回退旧字段集，保证主流程不中断
          console.error('supabase save with tier failed, retrying legacy insert:', error.message);
          ({ data, error } = await supabase.from('evaluations').insert(base).select('id').single());
        }
        if (!error && data) id = data.id;
      } catch (e) {
        console.error('supabase save failed:', e);
        // 不阻断主流程
      }
    }

    return NextResponse.json({ result, id, demo, rubric_version: RUBRIC_VERSION, tier, consensus });
  } catch (e) {
    console.error('evaluate error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '评审失败，请重试' },
      { status: 500 },
    );
  }
}
