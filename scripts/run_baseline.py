#!/usr/bin/env python3
"""Run the plain-LLM baseline (docs/llm-baseline.md) across several models via OpenRouter.

Usage:
  export OPENROUTER_API_KEY=sk-or-...
  python3 scripts/run_baseline.py --list-models claude          # find exact model IDs
  python3 scripts/run_baseline.py \
      --models anthropic/<claude-model> openai/<gpt-model> google/<gemini-model> \
      --use-cases O2C-02 P2P-03 LOG-01 P2P-06

Writes:
  docs/baseline/raw/<model>/<use-case>.md   full answer + metadata (model, date, tokens, finish reason)
  docs/baseline/scores.csv                  one row per answer, score columns left blank for a human

No dependencies beyond the Python standard library. No system prompt is sent, on purpose:
the baseline is "what a general model says when asked directly".
"""
import argparse
import csv
import datetime
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
API = "https://openrouter.ai/api/v1"
PROMPT = (
    "I'm an enterprise architect scoping an AI solution for this ERP / supply chain use case:\n\n"
    "{title}: {problem}\n\n"
    "What AI approach and models would you recommend?"
)
CRITERIA = ["decomposition", "non_llm_fit", "autonomy_controls", "evaluation", "native_first"]


def request(path, body=None, key=None):
    req = urllib.request.Request(API + path, method="POST" if body else "GET")
    req.add_header("Content-Type", "application/json")
    if key:
        req.add_header("Authorization", "Bearer " + key)
    data = json.dumps(body).encode() if body else None
    with urllib.request.urlopen(req, data=data, timeout=300) as r:
        return json.loads(r.read())


def list_models(term):
    models = request("/models")["data"]
    for m in sorted(models, key=lambda m: m["id"]):
        if term.lower() in m["id"].lower():
            print(m["id"])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--models", nargs="+", help="OpenRouter model IDs")
    ap.add_argument("--use-cases", nargs="+", default=["O2C-02", "P2P-03", "LOG-01", "P2P-06"])
    ap.add_argument("--max-tokens", type=int, default=6000, help="high on purpose, so answers are not truncated")
    ap.add_argument("--list-models", metavar="TERM", help="print model IDs containing TERM and exit")
    args = ap.parse_args()

    if args.list_models:
        list_models(args.list_models)
        return
    if not args.models:
        ap.error("--models is required (use --list-models to find IDs)")
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        sys.exit("Set OPENROUTER_API_KEY first.")

    known = {m["id"] for m in request("/models")["data"]}
    bad = [m for m in args.models if m not in known]
    if bad:
        sys.exit("Unknown model IDs: " + ", ".join(bad) + ". Run with --list-models <term>.")

    ucs = {u["id"]: u for u in json.loads((ROOT / "data" / "use-cases.json").read_text())}
    missing = [u for u in args.use_cases if u not in ucs]
    if missing:
        sys.exit("Unknown use case IDs: " + ", ".join(missing))

    out = ROOT / "docs" / "baseline"
    rows = []
    for model in args.models:
        for uc_id in args.use_cases:
            uc = ucs[uc_id]
            prompt = PROMPT.format(title=uc["title"], problem=uc["problem"])
            print(f"{model}  {uc_id} ...", end=" ", flush=True)
            t0 = time.time()
            try:
                res = request("/chat/completions", {
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": args.max_tokens,
                }, key)
            except urllib.error.HTTPError as e:
                print("error", e.code, e.read().decode()[:300])
                continue
            choice = res["choices"][0]
            text = choice["message"]["content"] or ""
            finish = choice.get("finish_reason")
            usage = res.get("usage", {})
            path = out / "raw" / model.replace("/", "__") / f"{uc_id}.md"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                f"# {uc_id}: {uc['title']}\n\n"
                f"- Model: `{res.get('model', model)}` (requested `{model}`)\n"
                f"- Run: {datetime.datetime.now().isoformat(timespec='seconds')}\n"
                f"- Finish reason: {finish}\n"
                f"- Tokens: {usage.get('prompt_tokens')} in / {usage.get('completion_tokens')} out\n\n"
                f"## Prompt\n\n```\n{prompt}\n```\n\n## Answer\n\n{text}\n",
                encoding="utf-8",
            )
            warn = "  TRUNCATED, raise --max-tokens" if finish == "length" else ""
            print(f"ok ({time.time() - t0:.0f}s, {usage.get('completion_tokens')} tokens){warn}")
            rows.append({"use_case": uc_id, "model": model, "file": str(path.relative_to(ROOT)), "finish": finish})

    scores = out / "scores.csv"
    existing = []
    if scores.exists():
        with scores.open() as f:
            existing = [r for r in csv.DictReader(f)
                        if (r["use_case"], r["model"]) not in {(x["use_case"], x["model"]) for x in rows}]
    with scores.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["use_case", "model", "file", "finish"] + CRITERIA + ["notes"])
        w.writeheader()
        for r in existing + rows:
            w.writerow({k: r.get(k, "") for k in w.fieldnames})
    print(f"\nSaved {len(rows)} answers. Score them in {scores.relative_to(ROOT)} (0-2 per criterion).")


if __name__ == "__main__":
    main()
