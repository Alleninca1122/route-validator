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

    const { data, error } = await supabase
      .from('evaluations')
      .select('id, target_molecule, evaluation_result, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ history: data });
  } catch (e) {
    console.error('history error:', e);
    return NextResponse.json({ error: '获取历史失败' }, { status: 500 });
  }
}
