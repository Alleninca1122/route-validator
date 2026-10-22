import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, isSupabaseConfigured } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: '未配置 Supabase' }, { status: 503 });
  }
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const withTier = await supabase
      .from('evaluations')
      .select('id, target_molecule, evaluation_result, service_tier, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!withTier.error) {
      return NextResponse.json({ history: withTier.data });
    }
    // service_tier 列尚未迁移时回退旧字段集，档位按 A 档呈现
    const legacy = await supabase
      .from('evaluations')
      .select('id, target_molecule, evaluation_result, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (legacy.error) throw legacy.error;
    const history = (legacy.data ?? []).map((row) => ({ ...row, service_tier: 'verdict' }));
    return NextResponse.json({ history });
  } catch (e) {
    console.error('history error:', e);
    return NextResponse.json({ error: '获取历史失败' }, { status: 500 });
  }
}
