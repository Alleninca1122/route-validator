-- 迁移 002：框架 v2.3 服务模式 —— evaluations 增加交付档位列
-- 适用：已按 schema.sql（v2.1 时期）建过库的环境，在 Supabase SQL Editor 中执行一次即可。
-- 说明：service_tier = 'verdict'（A 档仅判定）| 'verdict_plus'（B 档判定＋推荐）。
-- 旧记录回填为 'verdict'。应用代码对未迁移的库有回退逻辑（写入/读取自动降级），
-- 但历史记录的档位展示需要本迁移执行后才完整。

alter table evaluations
  add column if not exists service_tier text not null default 'verdict';

alter table evaluations
  drop constraint if exists evaluations_service_tier_check;

alter table evaluations
  add constraint evaluations_service_tier_check
  check (service_tier in ('verdict', 'verdict_plus'));

alter table evaluations
  alter column rubric_version set default 'v2.3';
