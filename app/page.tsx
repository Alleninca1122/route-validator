'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

const SUPABASE_ON =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!SUPABASE_ON) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace('/dashboard');
    });
  }, [router]);

  const signInGoogle = async () => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setMsg('Google 登录失败：' + error.message);
    setLoading(false);
  };

  const signInEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setMsg('请输入有效邮箱');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) setMsg('发送失败：' + error.message);
    else setSent(true);
  };

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-700 text-white text-2xl font-bold mb-4">
            ⚗
          </div>
          <h1 className="text-2xl font-bold">AI 合成路线验证器</h1>
          <p className="text-slate-500 mt-2 text-sm leading-relaxed">
            五关排除法评审框架
            <br />
            化学可能性 → 安全红线 → 官能团兼容性 → 关键步骤先例 → 放大可行性
            <br />
            仅判定 / 判定＋推荐，两档交付自选
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {!SUPABASE_ON ? (
            <div>
              <p className="text-sm text-slate-600 mb-4">
                当前为本地演示模式（未配置 Supabase），可直接进入使用全部功能，评审记录仅保存在本次会话。
              </p>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-2.5 rounded-lg bg-teal-700 text-white font-medium hover:bg-teal-800 transition"
              >
                进入验证器
              </button>
            </div>
          ) : sent ? (
            <div className="text-center py-4">
              <p className="text-green-700 font-medium">登录链接已发送</p>
              <p className="text-sm text-slate-500 mt-2">
                请查收 {email} 的邮件，点击链接完成登录。
              </p>
            </div>
          ) : (
            <div>
              <button
                onClick={signInGoogle}
                disabled={loading}
                className="w-full py-2.5 rounded-lg border border-slate-300 font-medium hover:bg-slate-50 transition disabled:opacity-50 mb-3"
              >
                使用 Google 账号登录
              </button>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">或邮箱登录</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <form onSubmit={signInEmail}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 mb-3"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg bg-teal-700 text-white font-medium hover:bg-teal-800 transition disabled:opacity-50"
                >
                  发送登录链接
                </button>
              </form>
              {msg && <p className="text-sm text-red-600 mt-3">{msg}</p>}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          评审框架 v2.3 · 五关排除法 · 仅供研发参考
        </p>
      </div>
    </main>
  );
}
