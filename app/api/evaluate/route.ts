import { NextRequest, NextResponse } from 'next/server';
import { llmJSON, isDemoMode, DEMO_EVALUATE_RESULT } from '@/lib/llm';
import { EVALUATOR_SYSTEM_PROMPT, RUBRIC_VERSION } from '@/lib/rubric';
import { createServerSupabase, isSupabaseConfigured } from '@/lib/supabase-server';
import type { ParsedRoute, EvaluationResult } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { route_input, parsed } = (await req.json()) as {
      route_input: string;
      parsed: ParsedRoute;
    };
    if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      return NextResponse.json({ error: '缺少结构化步骤，请先解析路线' }, { status: 400 });
    }

    let result: EvaluationResult;
    let demo = false;

    if (isDemoMode()) {
      result = DEMO_EVALUATE_RESULT as unknown as EvaluationResult;
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
        `目标分子：${parsed.target_molecule}\n共 ${parsed.total_steps} 步：\n${stepsText}\n\n${parsed.raw_notes ? `补充信息：${parsed.raw_notes}\n\n` : ''}请按五关评审框架逐关评审，严格按指定 JSON 格式输出。`,
      )) as EvaluationResult;
    }

    // 持久化（Supabase 已配置时）
    let id: string | null = null;
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createServerSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('evaluations')
          .insert({
            user_id: user?.id ?? null,
            target_molecule: parsed.target_molecule,
            route_input: route_input ?? '',
            parsed_steps: parsed,
            evaluation_result: result,
            rubric_version: RUBRIC_VERSION,
          })
          .select('id')
          .single();
        if (!error && data) id = data.id;
      } catch (e) {
        console.error('supabase save failed:', e);
        // 不阻断主流程
      }
    }

    return NextResponse.json({ result, id, demo, rubric_version: RUBRIC_VERSION });
  } catch (e) {
    console.error('evaluate error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '评审失败，请重试' },
      { status: 500 },
    );
  }
}
