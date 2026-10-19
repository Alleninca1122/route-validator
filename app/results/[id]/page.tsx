import Link from 'next/link';
import { createServerSupabase, isSupabaseConfigured } from '@/lib/supabase-server';
import { ResultCard } from '@/components/ResultCard';

export const instant = false;

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return <NotFound hint="未配置 Supabase，无法查看历史评审链接。" />;
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('evaluations')
    .select('id, target_molecule, route_input, parsed_steps, evaluation_result, created_at, rubric_version')
    .eq('id', id)
    .single();

  if (error || !data) {
    return <NotFound hint="找不到该评审记录，可能已被删除。" />;
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center font-bold">
              ⚗
            </span>
            <span className="font-bold">AI 合成路线验证器</span>
          </Link>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-teal-700">
            ← 返回
          </Link>
        </div>
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold">{data.target_molecule}</h1>
          <p className="text-xs text-slate-400 mt-1">
            评审于 {new Date(data.created_at).toLocaleString('zh-CN')} · 评审框架 {data.rubric_version ?? 'v2.1'}
          </p>
        </div>
        <ResultCard result={data.evaluation_result} />

        <details className="mt-4 bg-white rounded-xl border border-slate-200 p-6">
          <summary className="font-bold cursor-pointer text-sm">查看原始输入与解析步骤</summary>
          <div className="mt-3 text-sm">
            <p className="font-medium text-slate-600 mb-1">原始输入：</p>
            <pre className="whitespace-pre-wrap bg-slate-50 rounded p-3 text-xs text-slate-600 mb-3">
              {data.route_input}
            </pre>
            <p className="font-medium text-slate-600 mb-1">解析步骤：</p>
            <pre className="whitespace-pre-wrap bg-slate-50 rounded p-3 text-xs text-slate-600">
              {JSON.stringify(data.parsed_steps, null, 2)}
            </pre>
          </div>
        </details>
      </main>
    </div>
  );
}

function NotFound({ hint }: { hint: string }) {
  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="font-bold text-lg mb-2">评审记录不存在</p>
        <p className="text-sm text-slate-500 mb-4">{hint}</p>
        <Link href="/dashboard" className="text-teal-700 hover:underline text-sm">
          返回验证器 →
        </Link>
      </div>
    </main>
  );
}
