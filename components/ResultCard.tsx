'use client';

import type { EvaluationResult } from '@/lib/types';
import { GATE_NAMES } from '@/lib/types';

export function VerdictBadge({ result }: { result: EvaluationResult }) {
  if (result.verdict === 'candidate') {
    return (
      <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium">
        ✅ 候选
      </span>
    );
  }
  return (
    <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 text-sm font-medium">
      ❌ 死于第 {result.eliminated_at_gate} 关
    </span>
  );
}

export function ResultCard({
  result,
  onReset,
}: {
  result: EvaluationResult;
  onReset?: () => void;
}) {
  return (
    <div>
      {/* 结论先行 */}
      <div
        className={`rounded-xl border p-6 mb-4 ${
          result.verdict === 'candidate'
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <VerdictBadge result={result} />
          {onReset && (
            <button onClick={onReset} className="text-sm text-slate-500 hover:text-teal-700">
              评审新路线 →
            </button>
          )}
        </div>
        <p className="mt-3 font-medium">{result.one_line_cause}</p>
      </div>

      {/* 闯关记录 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
        <h3 className="font-bold mb-4">闯关记录</h3>
        <div className="space-y-3">
          {result.gates.map((g) => (
            <div
              key={g.gate}
              className={`flex gap-3 p-3 rounded-lg border ${
                g.passed === null
                  ? 'border-slate-100 bg-slate-50 opacity-60'
                  : g.passed
                    ? 'border-green-200 bg-green-50/50'
                    : 'border-red-200 bg-red-50/50'
              }`}
            >
              <span className="font-bold text-sm whitespace-nowrap">
                第 {g.gate} 关
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{GATE_NAMES[g.gate - 1]}</span>
                  {g.passed === null ? (
                    <span className="text-xs text-slate-400">未评审</span>
                  ) : g.passed ? (
                    <span className="text-xs text-green-700 font-medium">✅ 过关</span>
                  ) : (
                    <span className="text-xs text-red-700 font-medium">❌ 淘汰</span>
                  )}
                </div>
                <p className="text-sm text-slate-600 mt-1">{g.reason}</p>
                {g.notes.length > 0 && (
                  <ul className="mt-1 text-xs text-amber-700 list-disc list-inside">
                    {g.notes.map((n, i) => (
                      <li key={i}>注意：{n}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 注意项汇总 */}
      {result.notes_summary.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
          <h3 className="font-bold mb-3">注意项汇总</h3>
          <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
            {result.notes_summary.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 下一步 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-bold mb-3">下一步</h3>
        <p className="text-sm text-slate-600 whitespace-pre-line">{result.next_steps}</p>
      </div>
    </div>
  );
}
