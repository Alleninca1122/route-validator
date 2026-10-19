-- AI 合成路线验证器 · 评审记录表
-- 在 Supabase SQL Editor 中执行

create table if not exists evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  target_molecule text not null,
  route_input text not null default '',
  parsed_steps jsonb not null,
  evaluation_result jsonb not null,
  rubric_version text not null default 'v2.1',
  created_at timestamptz not null default now()
);

-- 用户只能读写自己的记录；未登录写入的记录 user_id 为 null（演示/本地模式）
alter table evaluations enable row level security;

create policy "users_read_own"
  on evaluations for select
  using (auth.uid() = user_id);

create policy "users_insert_own"
  on evaluations for insert
  with check (auth.uid() = user_id or user_id is null);

create index if not exists evaluations_user_created
  on evaluations (user_id, created_at desc);
