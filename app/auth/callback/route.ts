import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, isSupabaseConfigured } from '@/lib/supabase-server';

// OAuth / 邮箱 magic link 回调
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/?error=auth`);
}
