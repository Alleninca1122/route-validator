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
      result = (await llmJSON(
        EVALUATOR_SYSTEM_PROMPT,
        `目标分子：${parsed.target_molecule}\n共 ${parsed.total_steps} 步：\n${stepsText}\n\n${parsed.raw_notes ? `补充信息：${parsed.raw_notes}\n\n` : ''}请按五关评审框架逐关评审，严格按指定 JSON 格式输出。\n\n${tierInstruction(tier)}`,
      )) as EvaluationResult;
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

    return NextResponse.json({ result, id, demo, rubric_version: RUBRIC_VERSION, tier });
  } catch (e) {
    console.error('evaluate error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '评审失败，请重试' },
      { status: 500 },
    );
  }
}
