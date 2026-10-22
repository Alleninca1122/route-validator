'use client';

import type { EvaluationResult, GateResult, ServiceTier } from '@/lib/types';
import { GATE_NAMES, SERVICE_TIER_LABELS } from '@/lib/types';

export function VerdictBadge({ result }: { result: EvaluationResult }) {
  if (result.verdict === 'candidate') {
    return (
      <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium">
        ✅ 候选
      </span>
    );
  }
  if (result.verdict === 'lab_feasible') {
    return (
      <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm font-medium">
        🔬 实验室可行
      </span>
    );
  }
  return (
    <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 text-sm font-medium">
      ❌ 死于第 {result.eliminated_at_gate} 关
    </span>
  );
}

export function TierBadge({ tier }: { tier: ServiceTier }) {
  return (
    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs">
      交付档位：{SERVICE_TIER_LABELS[tier]}
    </span>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  rerank: '路线树重排',
  patch: '最小补丁',
  generated: '替代路线',
};

function GateRow({ g }: { g: GateResult }) {
  return (
    <div
      className={`flex gap-3 p-3 rounded-lg border ${
        g.passed === null
          ? 'border-slate-100 bg-slate-50 opacity-60'
          : g.passed
            ? 'border-green-200 bg-green-50/50'
            : 'border-red-200 bg-red-50/50'
      }`}
    >
      <span className="font-bold text-sm whitespace-nowrap">第 {g.gate} 关</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{GATE_NAMES[g.gate - 1]}</span>
          {g.passed === null ? (
            <span className="text-xs text-slate-400">未评审</span>
          ) : g.passed ? (
            <span className="text-xs text-green-700 font-medium">✅ 过关</span>
          ) : (
            <span className="text-xs text-red-700 font-medium">
              {g.gate === 5 ? '❌ 未过关' : '❌ 淘汰'}
            </span>
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
  );
}

export function ResultCard({
  result,
  onReset,
  tier,
}: {
  result: EvaluationResult;
  onReset?: () => void;
  tier?: ServiceTier;
}) {
  const rec = result.recommendation;
  return (
    <div>
      {/* 结论先行 */}
      <div
        className={`rounded-xl border p-6 mb-4 ${
          result.verdict === 'candidate'
            ? 'bg-green-50 border-green-200'
            : result.verdict === 'lab_feasible'
              ? 'bg-amber-50 border-amber-200'
              : 'bg-red-50 border-red-200'
        }`}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <VerdictBadge result={result} />
            {tier && <TierBadge tier={tier} />}
          </div>
          {onReset && (
            <button onClick={onReset} className="text-sm text-slate-500 hover:text-teal-700">
              评审新路线 →
            </button>
          )}
        </div>
        <p className="mt-3 font-medium">{result.one_line_cause}</p>
        {result.verdict === 'lab_feasible' && (
          <p className="mt-1 text-sm text-amber-800">
            已过前四关，实验室可做出来、能拿样品；仅第 5 关放大不可行，不算淘汰。
          </p>
        )}
      </div>

      {/* 闯关记录 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
        <h3 className="font-bold mb-4">闯关记录</h3>
        <div className="space-y-3">
          {result.gates.map((g) => (
            <GateRow key={g.gate} g={g} />
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
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
        <h3 className="font-bold mb-3">下一步</h3>
        <p className="text-sm text-slate-600 whitespace-pre-line">{result.next_steps}</p>
      </div>

      {/* 推荐路线（B 档：判定＋推荐） */}
      {rec != null && (
        <div className="bg-teal-50/60 rounded-xl border border-teal-200 p-6">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <h3 className="font-bold">推荐路线</h3>
            <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-xs">
              B 档 · 判定＋推荐
            </span>
            {rec.found && rec.source && (
              <span className="px-2 py-0.5 rounded bg-white border border-teal-200 text-teal-800 text-xs">
                来源：{SOURCE_LABELS[rec.source] ?? rec.source}
              </span>
            )}
          </div>
          {rec.found ? (
            <div>
              <p className="text-sm text-slate-700">{rec.summary}</p>
              {rec.route_description && (
                <p className="text-sm text-slate-600 whitespace-pre-line mt-2">
                  {rec.route_description}
                </p>
              )}
              {rec.gates.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-slate-600 mb-2">
                    推荐路线闯关记录（与原路线同一标准）：
                  </p>
                  <div className="space-y-3">
                    {rec.gates.map((g) => (
                      <GateRow key={g.gate} g={g} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-600">{rec.summary}</p>
          )}
        </div>
      )}
    </div>
  );
}
