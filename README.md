# AI 合成路线验证器 · MVP

用五关评审框架（v2.1）验证 AI 设计的药物合成路线是否可行。

## 快速开始（本地演示模式）

```bash
cd ~/workspace/route-validator-mvp
npm install
npm run dev      # http://localhost:3000
```

未配置任何 key 时自动进入**演示模式**：解析与评审 API 返回内置示例数据，
完整 UI 流程（粘贴 → 确认步骤 → 评审 → 结果展示）可直接走通。

## 接入真实服务

```bash
cp .env.example .env.local
```

| 变量 | 说明 |
|------|------|
| `ANTHROPIC_API_KEY` | 启用真实 LLM 评审/解析（默认模型 `claude-sonnet-4-20250514`，可用 `LLM_MODEL` 覆盖） |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 启用登录（邮箱 magic link + Google OAuth）与评审历史存储 |

Supabase 建表：在 SQL Editor 执行 `supabase/schema.sql`。
Google OAuth：Supabase Dashboard → Authentication → Providers 启用 Google，
Redirect URL 填 `https://<你的域名>/auth/callback`。

## 页面

- `/` — 落地页 + 登录（未配 Supabase 时显示"直接进入"）
- `/dashboard` — 三步流程：粘贴路线 → AI 解析 → 确认/修改步骤 → 五关评审
- `/results/[id]` — 评审报告：结论先行 → 闯关记录 → 注意项 → 下一步

## API

- `POST /api/parse` `{ text }` → `{ parsed, demo }`
- `POST /api/evaluate` `{ route_input, parsed }` → `{ result, id, demo, rubric_version }`
- `GET /api/history` → 当前用户的评审历史（需登录）

## 评审框架

系统提示词见 `lib/rubric.ts`，源自 `~/workspace/your_files/route-validator-rubric-v1.md`（v2.1）。
五关顺序 fail-fast：第 1 关淘汰后，后续关卡标记为未评审。

## 技术栈

Next.js 16（App Router）+ TypeScript + Tailwind CSS + Supabase + Anthropic API。
注意：Next.js 16 中 `middleware.ts` 已更名为 `proxy.ts`。
