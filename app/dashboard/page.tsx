'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { RUBRIC_VERSION } from '@/lib/rubric';
import type { ParsedRoute, EvaluationResult, RouteStep, ServiceTier } from '@/lib/types';

const SUPABASE_ON =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type Stage = 'input' | 'confirm' | 'done';

const SAMPLE = `目标：2-(4-硝基苯基)乙醇
步骤1：对硝基苯乙酸甲酯用 LiAlH₄ 还原，声称甲酯变为伯醇、硝基不受影响。`;

export default function Dashboard() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('input');
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedRoute | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [demo, setDemo] = useState(false);
  const [tier, setTier] = useState<ServiceTier>('verdict');
  const [history, setHistory] = useState<
    {
      id: string;
      target_molecule: string;
      evaluation_result: EvaluationResult;
      service_tier?: ServiceTier;
      created_at: string;
    }[]
  >([]);

  useEffect(() => {
    if (!SUPABASE_ON) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/');
      else {
        setUserEmail(data.user.email ?? null);
        fetch('/api/history')
          .then((r) => r.json())
          .then((d) => d.history && setHistory(d.history))
          .catch(() => {});
      }
    });
  }, [router]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/');
  };

  async function doParse() {
    setErr('');
    setLoading(true);
    try {
      const r = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '解析失败');
      setParsed(d.parsed);
      setDemo(!!d.demo);
      setStage('confirm');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '解析失败');
    } finally {
      setLoading(false);
    }
  }

  async function doEvaluate() {
    if (!parsed) return;
    setErr('');
    setLoading(true);
    try {
      const r = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ route_input: text, parsed, tier }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '评审失败');
      setResult(d.result);
      setDemo(!!d.demo);
      if (d.id) {
        router.push(`/results/${d.id}`);
        return;
      }
      setResultId(null);
      setStage('done');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '评审失败');
    } finally {
      setLoading(false);
    }
  }

  function updateStep(i: number, field: keyof RouteStep, value: string) {
    if (!parsed) return;
    const steps = parsed.steps.map((s, j) => (j === i ? { ...s, [field]: value } : s));
    setParsed({ ...parsed, steps });
  }

  function reset() {
    setStage('input');
    setText('');
    setParsed(null);
    setResult(null);
    setResultId(null);
    setErr('');
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center font-bold">
              ⚗
            </span>
            <span className="font-bold">AI 合成路线验证器</span>
            <span className="text-xs text-slate-400 ml-1">评审框架 {RUBRIC_VERSION}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {demo && (
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">
                演示模式
              </span>
            )}
            {userEmail && <span className="text-slate-500 hidden sm:inline">{userEmail}</span>}
            {SUPABASE_ON && (
              <button onClick={signOut} className="text-slate-500 hover:text-slate-800">
                退出
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {/* 步骤指示 */}
        <div className="flex items-center gap-2 text-sm mb-6">
          {['粘贴路线', '确认步骤', '评审结果'].map((label, i) => {
            const idx = ['input', 'confirm', 'done'].indexOf(stage);
            const active = i === idx;
            const doneStep = i < idx;
            return (
              <div key={label} className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    active
                      ? 'bg-teal-700 text-white'
                      : doneStep
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {i + 1}
                </span>
                <span className={active ? 'font-medium' : 'text-slate-500'}>{label}</span>
                {i < 2 && <span className="w-8 h-px bg-slate-300 mx-1" />}
              </div>
            );
          })}
        </div>

        {err && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {err}
          </div>
        )}

        {stage === 'input' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-bold mb-2">粘贴合成路线描述</h2>
            <p className="text-sm text-slate-500 mb-4">
              自由文本即可：目标分子、每步的转化、试剂、条件。AI 会解析成结构化步骤，由你确认后再评审。
              原文没写的条件请不要编造，留空即可。
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder={SAMPLE}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 text-sm"
            />
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setText(SAMPLE)}
                className="text-sm text-slate-500 hover:text-teal-700"
              >
                填入示例
              </button>
              <button
                onClick={doParse}
                disabled={loading || text.trim().length < 10}
                className="px-6 py-2.5 rounded-lg bg-teal-700 text-white font-medium hover:bg-teal-800 transition disabled:opacity-50"
              >
                {loading ? '解析中…' : '解析路线 →'}
              </button>
            </div>
          </div>
        )}

        {stage === 'confirm' && parsed && (
          <div>
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold">确认解析结果（可直接修改）</h2>
                <button onClick={() => setStage('input')} className="text-sm text-slate-500 hover:text-teal-700">
                  ← 返回修改原文
                </button>
              </div>
              <div className="mb-4">
                <label className="text-sm font-medium text-slate-600">目标分子</label>
                <input
                  value={parsed.target_molecule}
                  onChange={(e) => setParsed({ ...parsed, target_molecule: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 text-sm"
                />
              </div>
              {parsed.steps.map((s, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-4 mb-3 bg-slate-50">
                  <div className="font-medium text-sm mb-3 text-teal-800">Step {s.step}</div>
                  {(
                    [
                      ['transformation', '转化（一句话）'],
                      ['starting_material', '起始物'],
                      ['reagents', '试剂 + 催化剂'],
                      ['conditions', '条件（温度/时间/压力，没有就留空）'],
                      ['product', '产物'],
                      ['notes', '备注'],
                    ] as [keyof RouteStep, string][]
                  ).map(([field, label]) => (
                    <div key={field} className="mb-2">
                      <label className="text-xs text-slate-500">{label}</label>
                      <input
                        value={String(s[field] ?? '')}
                        onChange={(e) => updateStep(i, field, e.target.value)}
                        className="mt-0.5 w-full px-2.5 py-1.5 rounded border border-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-teal-600"
                      />
                    </div>
                  ))}
                </div>
              ))}
              <div className="mb-4">
                <label className="text-sm font-medium text-slate-600">交付档位（判定标准相同，只差交付深度）</label>
                <div className="grid sm:grid-cols-2 gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setTier('verdict')}
                    className={`text-left rounded-lg border p-3 transition ${
                      tier === 'verdict'
                        ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-600'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <span className="font-medium text-sm">A 档 · 仅判定</span>
                    <span className="block text-xs text-slate-500 mt-1">
                      只判定路线可不可行：五关判决＋注意项＋一句话重设计方向。
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTier('verdict_plus')}
                    className={`text-left rounded-lg border p-3 transition ${
                      tier === 'verdict_plus'
                        ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-600'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <span className="font-medium text-sm">B 档 · 判定＋推荐</span>
                    <span className="block text-xs text-slate-500 mt-1">
                      路线不可行时，若有合适的更好路线则一并推荐（同一标准过五关）；没有合适路线只给方向，不硬凑。
                    </span>
                  </button>
                </div>
              </div>
              <button
                onClick={doEvaluate}
                disabled={loading}
                className="w-full py-3 rounded-lg bg-teal-700 text-white font-medium hover:bg-teal-800 transition disabled:opacity-50"
              >
                {loading ? '评审中（约需 30 秒）…' : '开始五关评审 →'}
              </button>
            </div>
          </div>
        )}

        {stage === 'done' && result && (
          <ResultCard result={result} onReset={reset} tier={tier} />
        )}

        {/* 历史记录 */}
        {SUPABASE_ON && history.length > 0 && stage === 'input' && (
          <div className="mt-8">
            <h3 className="font-bold mb-3 text-sm text-slate-600">历史评审</h3>
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => router.push(`/results/${h.id}`)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-sm">{h.target_molecule}</div>
                    <div className="text-xs text-slate-400">
                      {new Date(h.created_at).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.service_tier && <TierBadge tier={h.service_tier} />}
                    <VerdictBadge result={h.evaluation_result} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
import { ResultCard, VerdictBadge, TierBadge } from '@/components/ResultCard';
