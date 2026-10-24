// LLM 调用抽象层
// 默认走 Anthropic Messages API；未配置 key 时进入演示模式（返回内置示例）

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export function isLLMConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function isDemoMode(): boolean {
  return !isLLMConfigured() || process.env.DEMO_MODE === 'true';
}

async function callAnthropic(system: string, user: string, temperature = 0): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.LLM_MODEL || 'claude-sonnet-4-6';
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      // B 档报告（判定＋推荐双份五关记录）篇幅长，4096 易触发输出截断→JSON 不完整；
      // 8192 给足余量（2026-10-23 复测 v2.6 时实测截断故障后上调）。
      max_tokens: 8192,
      // 提示缓存：系统提示（评审框架全文）每次调用都相同且远超缓存下限，
      // 标记 ephemeral 后批量/连续调用可命中缓存读（约一折价），降单趟评审成本。
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      // 采样随机度默认 0：评审员调用要可复现——同一条路线每次判出同一结论，
      // 考场重跑的差异才反映框架改动而非抽签（2026-10-24 Allen 定；不改评审标准，不升框架版本）。
      temperature,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM API 错误 (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const block = data.content?.find((b: { type: string }) => b.type === 'text');
  return block?.text ?? '';
}

function extractJSON(text: string): string {
  // 容错：模型可能在 JSON 前后加少量说明，提取第一个 {...} 块
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('LLM 未返回有效 JSON');
  return text.slice(start, end + 1);
}

export async function llmJSON(system: string, user: string): Promise<unknown> {
  // 模型偶发输出不合规 JSON（如字符串内未转义引号）。首选采样随机度 0（可复现）；
  // 但 0 会把一次 malformed 输出"粘住"——贪心路径每次走同一条破路，重试也一样破
  // （2026-10-24 r2-05 实测：温度 0 下连续三次 500，错误均为 JSON 解析失败）。
  // 因此重试必须逐级扰动采样随机度（0 → 0.3 → 0.7），用变化打破粘住的破路；
  // 首选成功时结论仍是 0 的结论，扰动只用于救解析失败，不参与正常评审。
  const ladder = [0, 0.3, 0.7];
  let lastErr: unknown;
  for (const temperature of ladder) {
    const raw = await callAnthropic(system, user, temperature);
    try {
      return JSON.parse(extractJSON(raw));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('LLM 未返回有效 JSON');
}

// ---------- 演示模式内置数据 ----------

export const DEMO_PARSE_RESULT = {
  target_molecule: '2-(4-硝基苯基)乙醇（C8H9NO3）',
  steps: [
    {
      step: 1,
      transformation: 'LiAlH₄ 还原甲酯为伯醇',
      starting_material: '对硝基苯乙酸甲酯',
      reagents: 'LiAlH₄',
      conditions: '',
      product: '2-(4-硝基苯基)乙醇',
      notes: '原文声称硝基不受影响',
    },
  ],
  total_steps: 1,
  raw_notes: '演示模式：未配置 ANTHROPIC_API_KEY，显示内置示例',
};

export const DEMO_EVALUATE_RESULT = {
  verdict: 'eliminated',
  eliminated_at_gate: 1,
  gates: [
    {
      gate: 1,
      name: '化学可能性',
      passed: false,
      reason: 'LiAlH₄ 会同时还原芳香硝基，"硝基不动、只还原酯"的声称违反基本反应规律',
      notes: [],
    },
    { gate: 2, name: '安全红线', passed: null, reason: '未评审（第 1 关已淘汰）', notes: [] },
    { gate: 3, name: '官能团兼容性', passed: null, reason: '未评审（第 1 关已淘汰）', notes: [] },
    { gate: 4, name: '关键步骤先例', passed: null, reason: '未评审（第 1 关已淘汰）', notes: [] },
    { gate: 5, name: '放大可行性', passed: null, reason: '未评审（第 1 关已淘汰）', notes: [] },
  ],
  notes_summary: [],
  next_steps: '重设计方向：改用对硝基选择性的还原体系（如 DIBAL-H 低温控制，或先还原酯再引入硝基），或更换不含硝基的起始物料。',
  one_line_cause: 'LiAlH₄ 还原硝基，路线在化学上不成立',
  recommendation: null,
};

/** 演示模式 · B 档（判定＋推荐）：同一判定 ＋ 一个最小补丁式推荐（只动死因那一处） */
export const DEMO_EVALUATE_RESULT_TIER_B = {
  ...DEMO_EVALUATE_RESULT,
  recommendation: {
    found: true,
    source: 'patch',
    summary:
      '最小补丁：起始物料换成游离羧酸对硝基苯乙酸、还原剂换成 BH₃·THF——硼烷选择性还原羧酸且不碰硝基，死因一处即除，其余不变。',
    route_description:
      'Step 1：对硝基苯乙酸用 BH₃·THF 还原羧基为伯醇，硝基保持不变，一步得到 2-(4-硝基苯基)乙醇。',
    gates: [
      {
        gate: 1,
        name: '化学可能性',
        passed: true,
        reason: 'BH₃ 选择性还原羧酸、对芳香硝基惰性，转化成立',
        notes: [],
      },
      {
        gate: 2,
        name: '安全红线',
        passed: true,
        reason: '无红线物质；BH₃·THF 遇水放氢、易燃，按常规氢化物规程操作可控',
        notes: ['BH₃·THF 须惰气保护、缓慢淬灭，属实验室可控注意项'],
      },
      {
        gate: 3,
        name: '官能团兼容性',
        passed: true,
        reason: '底物仅羧基与硝基两官能团，硼烷对硝基不反应，无冲突',
        notes: [],
      },
      {
        gate: 4,
        name: '关键步骤先例',
        passed: true,
        reason: '硼烷还原羧酸为教科书级转化，硝基底物适用性有充分先例',
        notes: [],
      },
      {
        gate: 5,
        name: '放大可行性',
        passed: true,
        reason: '一步、原料商业可得、无极端条件；硼烷成本只记注意项，不构成死因',
        notes: ['BH₃·THF 价格高于 LiAlH₄，仅为价格注意项'],
      },
    ],
  },
};
