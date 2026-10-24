# 回归考场（Regression Exam Hall）

两轮考试的 12 条路线已固化成可重复运行的回归包：`cases.json` 是考题＋标准答案
（每条 gold_source 注明裁决出处），`run_regression.py` 把考题逐条送进线上产品
（/api/parse → /api/evaluate）自动对答案，`runs/<时间戳>/report.md` 是差异表，
`results.json` 存全量原始响应。

    python3 run_regression.py            # A 档全场 12 条
    python3 run_regression.py --tier all # 再加 B 档抽查 3 条（r2-01/r2-02 推荐须留空、r2-04 推荐同一性筛查）
    python3 run_regression.py --only r2-04

判分口径：verdict 与 eliminated_at_gate 与标准答案完全一致才算 ✓。
模型有采样方差：单条 ✗ 先看 results.json 的判词再定性（方差 vs 框架问题）。

## 首跑记录（2026-10-23，框架 v2.6）

一致 8/15。7 条不一致的定性（判词原文在当次 results.json）：
- 第 1 关过度判死 ×4：r2-06（DMF 甲基化——校准条款含此例仍被判死）、
  r2-05（图示省略金属化活化被当作转化不成立）、r2-01 A 档（TCAI 后氨解省略
  被升级为原子不守恒；同题 B 档又死于第 4 关——手性无控制由注意项升级为判死）、
  r2-04 B 档（原子账算错：二叠氮 6N 恰平衡，被误判不守恒；A 档同题 ✓@2）。
- 后关漏放 ×2：r1-06（先例关声称"先例充分"未核出处，放行）、
  r1-05（只审所画片段，未按声明的 12 步全程判第 5 关）。
- 结论：校准条款在提示词里有（lib/rubric.ts 第 21–25 行），但模型先验常盖过条款；
  且调用未设 temperature（API 默认高方差）。v2.7 校准方向已于 2026-10-24 由 Allen 撤回，不实施。
