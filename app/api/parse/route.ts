import { NextRequest, NextResponse } from 'next/server';
import { llmJSON, isDemoMode, DEMO_PARSE_RESULT } from '@/lib/llm';
import { PARSER_SYSTEM_PROMPT } from '@/lib/rubric';
import type { ParsedRoute } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return NextResponse.json({ error: '请粘贴路线描述（至少 10 个字符）' }, { status: 400 });
    }

    if (isDemoMode()) {
      return NextResponse.json({
        parsed: DEMO_PARSE_RESULT as ParsedRoute,
        demo: true,
      });
    }

    const result = (await llmJSON(
      PARSER_SYSTEM_PROMPT,
      `请解析以下合成路线描述：\n\n${text.trim()}`,
    )) as ParsedRoute;

    if (!result.steps || !Array.isArray(result.steps) || result.steps.length === 0) {
      return NextResponse.json({ error: '解析失败：未能识别出有效步骤，请补充试剂/转化信息后重试' }, { status: 422 });
    }

    return NextResponse.json({ parsed: result, demo: false });
  } catch (e) {
    console.error('parse error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '解析失败，请重试' },
      { status: 500 },
    );
  }
}
