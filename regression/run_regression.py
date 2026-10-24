#!/usr/bin/env python3
"""路线验证器 · 回归考场（一键全考）

把两轮考试的 12 条路线（cases.json，含 Allen 裁决后的标准答案）逐条送进
线上产品（/api/parse → /api/evaluate），自动对答案，输出差异报告。

用法：
  python3 run_regression.py                # A 档全场（默认，2 并发）
  python3 run_regression.py --tier B       # 只跑带 b_check 的 3 条（B 档抽查）
  python3 run_regression.py --tier all     # A 档全场 + B 档抽查
  python3 run_regression.py --only r2-04   # 只跑一条（调试）

结果落在 runs/<时间戳>/：results.json（全量原始响应）＋ report.md（差异表）。
判分口径：verdict 与 eliminated_at_gate 须与标准答案完全一致才算 ✓。
模型输出有采样方差，个别条目 ✗ 先看原文再下结论——考场测的是系统，不是单次运气。
"""
import argparse, concurrent.futures, json, os, sys, time, urllib.request
from datetime import datetime

BASE = os.environ.get("RV_BASE", "https://route-validator-livid.vercel.app")
HERE = os.path.dirname(os.path.abspath(__file__))

def post(path, payload, timeout=290):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))

def call_with_retry(fn, attempts=2):
    last = None
    for _ in range(attempts):
        try:
            return fn()
        except Exception as e:  # 传输层失败重试一次；业务错误由返回值体现
            last = e
            time.sleep(5)
    raise last

def run_case(case, tier):
    """跑一条：parse → evaluate(tier)，返回结果 dict。"""
    t0 = time.time()
    out = {"id": case["id"], "name": case["name"], "tier": tier}
    try:
        parse_resp = call_with_retry(lambda: post("/api/parse", {"text": case["text"]}))
        if parse_resp.get("demo") or not parse_resp.get("parsed"):
            out["error"] = f"parse 异常: demo={parse_resp.get('demo')} error={parse_resp.get('error')}"
            return out
        payload = {"route_input": case["text"], "parsed": parse_resp["parsed"], "tier": tier}
        ev = call_with_retry(lambda: post("/api/evaluate", payload))
        out["rubric_version"] = ev.get("rubric_version")
        out["raw"] = ev
        if ev.get("demo") or ev.get("error") or not ev.get("result"):
            out["error"] = f"evaluate 异常: demo={ev.get('demo')} error={ev.get('error')}"
            return out
        r = ev["result"]
        out["got"] = {"verdict": r.get("verdict"), "eliminated_at_gate": r.get("eliminated_at_gate")}
        out["one_line_cause"] = r.get("one_line_cause")
        exp = case["expected"]
        out["match"] = (out["got"]["verdict"] == exp["verdict"]
                        and out["got"]["eliminated_at_gate"] == exp["eliminated_at_gate"])
        if tier == "verdict_plus" and case.get("b_check"):
            rec = r.get("recommendation") or {}
            chk = case["b_check"]["type"]
            if chk == "rec_must_be_empty":
                out["b_check_pass"] = rec.get("found") is False
                out["b_check_detail"] = f"found={rec.get('found')}"
            elif chk == "rec_identity_screen":
                desc = (rec.get("route_description") or "") + (rec.get("summary") or "")
                bogus = ("2-叠氮乙胺" in desc and not any(
                    k in desc for k in ("重氮转移", "NaN₃", "甲磺酰", "烷基化", "叠氮乙醇", "两步", "二步", "2 步", "3 步", "三步")))
                out["b_check_pass"] = not (rec.get("found") and bogus)
                out["b_check_detail"] = f"found={rec.get('found')} source={rec.get('source')} summary={rec.get('summary')}"
        out["seconds"] = round(time.time() - t0, 1)
        return out
    except Exception as e:
        out["error"] = f"{type(e).__name__}: {e}"
        out["seconds"] = round(time.time() - t0, 1)
        return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tier", choices=["A", "B", "all"], default="A")
    ap.add_argument("--only", default=None)
    ap.add_argument("--workers", type=int, default=2)
    args = ap.parse_args()

    cases = json.load(open(os.path.join(HERE, "cases.json")))
    if args.only:
        cases = [c for c in cases if c["id"] == args.only]
    jobs = []  # (case, tier)
    if args.tier in ("A", "all"):
        jobs += [(c, "verdict") for c in cases]
    if args.tier in ("B", "all"):
        jobs += [(c, "verdict_plus") for c in cases if c.get("b_check")]

    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    outdir = os.path.join(HERE, "runs", stamp)
    os.makedirs(outdir, exist_ok=True)
    print(f"考场开考：{len(jobs)} 条 · 输出 {outdir}", flush=True)

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(run_case, c, t): (c, t) for c, t in jobs}
        for fut in concurrent.futures.as_completed(futs):
            r = fut.result()
            results.append(r)
            tag = "✓" if r.get("match") else ("ERR" if r.get("error") else "✗")
            print(f"[{tag}] {r['id']} ({r['tier']}) {r.get('seconds', '?')}s "
                  f"got={r.get('got')} err={r.get('error') or ''}", flush=True)

    results.sort(key=lambda x: (x["id"], x["tier"]))
    json.dump(results, open(os.path.join(outdir, "results.json"), "w"), ensure_ascii=False, indent=1)

    case_map = {c["id"]: c for c in json.load(open(os.path.join(HERE, "cases.json")))}
    lines = [f"# 回归考场报告 · {stamp}", "",
             f"考场：{BASE}（线上生产） · 框架版本（实测回填）："
             f"{next((r.get('rubric_version') for r in results if r.get('rubric_version')), '—')}", ""]
    n_ok = sum(1 for r in results if r.get("match"))
    lines += [f"**判定一致：{n_ok}/{len(results)}**", "",
              "| 案例 | 档位 | 期望 | 实得 | 结果 | B 档抽查 | 一句话（实得） |",
              "|---|---|---|---|---|---|---|"]
    for r in results:
        exp = case_map[r["id"]]["expected"]
        exp_s = exp["verdict"] + (f"@{exp['eliminated_at_gate']}" if exp["eliminated_at_gate"] else "")
        got = r.get("got") or {}
        got_s = (got.get("verdict") or "ERR") + (f"@{got['eliminated_at_gate']}" if got.get("eliminated_at_gate") else "")
        b = ""
        if "b_check_pass" in r:
            b = ("✓ " if r["b_check_pass"] else "✗ ") + (r.get("b_check_detail") or "")[:60]
        lines.append(f"| {r['id']} {r['name']} | {'B' if r['tier']=='verdict_plus' else 'A'} | {exp_s} | {got_s} | "
                     f"{'✓' if r.get('match') else ('ERR' if r.get('error') else '✗')} | {b} | {(r.get('one_line_cause') or r.get('error') or '')[:80]} |")
    lines += ["", "> 标准答案来源见 cases.json 各条 gold_source。✗ 条目先看 results.json 原始响应再定性（采样方差 vs 框架问题）。"]
    open(os.path.join(outdir, "report.md"), "w").write("\n".join(lines))
    print(f"报告：{outdir}/report.md · 一致 {n_ok}/{len(results)}")
    return 0 if n_ok == len(results) else 1

if __name__ == "__main__":
    sys.exit(main())
