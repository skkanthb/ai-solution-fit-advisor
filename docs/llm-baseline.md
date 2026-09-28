# Do LLMs recommend LLMs for everything?

**A simple experiment, not a scientific test.** Two current models, four enterprise business processes, two runs each, one plain prompt. Read the findings as a practitioner's observation, not a benchmark.

## Question

If you ask a general-purpose AI model how to apply AI to an enterprise business process, does it recommend an LLM for everything? And where does a structured, rule-based approach add something the model doesn't?

## Summary (round 2, current models)

- **No, they don't recommend LLMs for everything.** All 16 answers kept the LLM in a narrow role: summaries, drafting, reading unstructured text. Gradient-boosted models, rules, and optimization solvers did the actual deciding.
- **They rarely start from what already exists.** Only 2 of 16 answers said to check existing capabilities first, such as matching or contract tools already in the ERP or procurement suite. Six never mentioned existing systems.
- **They rarely say when a solution is ready.** Only 4 of 16 described a validation step, such as shadow mode or a historical pilot, before letting automation act.
- **Answers vary between runs.** The same model, given the same prompt twice, gave noticeably different advice.
- **Model names are outdated.** Both recommended models such as GPT-4o, Claude 3.5 Sonnet, and Llama 3.1.

What this means for the tool: its value is not that models give bad advice. A good current model gives sound high-level advice. The tool adds consistency (the same questions every time), visible reasoning, explicit limits on automation, and a starting point in what the organization already owns.

## Round 2 setup

- **Models:** Claude Sonnet 5 and Gemini 3.8 Flash, both on the high reasoning setting, via LMArena.
- **Runs:** each use case twice per model, each run in a separate fresh chat. 16 answers in total.
- **Date:** 2026-09-27.
- **Prompt:** the plain prompt below, unchanged from round 1.

## Round 2 results

Scores are 0–2 per criterion (rubric below), 10 per answer.

| Use case | Sonnet 5 run 1 | Sonnet 5 run 2 | Flash 3.8 run 1 | Flash 3.8 run 2 |
|---|---|---|---|---|
| O2C-02 Credit hold release | 8 | 8 | 9 | 9 |
| P2P-03 Three-way match exceptions | 9 | 10 | 6 | 6 |
| LOG-01 Shipment ETA and delay | 8 | 7 | 6 | 7 |
| P2P-06 Policy and contract Q&A | 8 | 8 | 7 | 5* |

\* Not a clean run: the answer refers to "Sonnet vs Flash", which is not in the prompt, so it likely picked up context from the testing platform.

Totals by criterion, across both models (maximum 32 = 16 answers × 2):

| Criterion | Total | Notes |
|---|---|---|
| Breaks the process into steps | 32 | Every answer separated steps with different approaches |
| Uses rules, ML, or optimization where they fit | 31 | One answer had the LLM do rebate-tier arithmetic |
| Approval points and controls | 30 | Tiered automation, value caps, fail-closed defaults |
| Evaluation and go-live gate | 16 | 4 of 16 answers described a validation step before automation |
| Checks what existing systems already do | 12 | 2 explicit, 8 in passing, 6 not at all |

Per-answer scores with a reason for each are in [`baseline/round2/scores.csv`](baseline/round2/scores.csv).

**No winner is named on purpose.** An AI model (Claude) acted as second reviewer, which is a conflict when one of the models tested is also Claude. The findings are reported across both models. Per-model scores are in the CSV for anyone who wants to check them.

### Things the models did well that are worth adding to the tool

- Credit hold: an expected-value decision rule (probability of non-payment × exposure against the cost of delay), and 60–90 days of shadow mode before auto-release.
- Shipment ETA: quantile ETAs (P10/P50/P90) instead of a single date.
- Three-way match: predicting which missing goods receipts will clear on their own, so AP doesn't chase them.
- Contract Q&A: amendment precedence, and permission filtering before retrieval.

## Round 1 (pilot, older models)

The first run used GPT 5.2 and Claude Sonnet 4.5, one run per use case. Neither was the latest model from its vendor by the time of round 2, so round 1 is treated as a pilot. It pointed the same way: the models mostly did not default to LLMs, and both were weakest on checking existing systems and on go-live gates. Raw answers and scores are in [`baseline/round1/`](baseline/round1/).

## Limits

- **Small sample:** 4 of 15 use cases, 2 models, 2 runs each.
- **Plain prompt on purpose:** the test measures default behavior. A structured prompt that asks for existing systems, controls, and go-live criteria would likely close some of the gaps.
- **Models not tested:** OpenAI's newest models and open-weight models (Qwen, Mistral, Nemotron) are not included yet.
- **The rubric is not neutral toward the tool.** It was written from the tool's own output format, so the tool is not scored here.
- **Scoring is judgment.** The owner designed the test, and an AI model acted as second reviewer. Evaluation scored 2 only when an answer included a validation step before automation goes live. The raw answers are published so anyone can re-score them.

## Raw answers

- Round 2: [`baseline/round2/raw/`](baseline/round2/raw/)
- Round 1: [`baseline/round1/raw/`](baseline/round1/raw/)

## Protocol

1. For each use case, give the model only the title and problem statement from `data/use-cases.json`.
2. Use a fresh chat for each run, with no system prompt, no project context, and memory off.
3. Use the prompt below verbatim.
4. Score each answer with the rubric, and record where the model did better than the tool.

### Running it

Manually: paste the prompt into a fresh chat per use case and run.

Automated across models, with one OpenRouter key:

```bash
export OPENROUTER_API_KEY=sk-or-...
python3 scripts/run_baseline.py --list-models claude   # find exact model IDs
python3 scripts/run_baseline.py --models <id1> <id2> <id3> --use-cases O2C-02 P2P-03 LOG-01 P2P-06
```

Answers land in `docs/baseline/raw/`, with a blank scoring sheet in `docs/baseline/scores.csv`.

### Prompt

The prompt says "ERP / supply chain" because that is the wording used in both rounds. It stays unchanged so results remain comparable.

```
I'm an enterprise architect scoping an AI solution for this ERP / supply chain use case:

<title>: <problem statement>

What AI approach and models would you recommend?
```

### Rubric (per answer)

| Criterion | 0 | 1 | 2 |
|---|---|---|---|
| Decomposition | Treats the process as one thing | Mentions steps loosely | Separates steps with different approaches |
| Non-LLM fit | Defaults to LLM or agent throughout | Mentions ML/rules as options | Assigns rules, ML, or optimization where they fit |
| Autonomy and controls | None | Generic "human in the loop" | Specific approval points and controls tied to risk |
| Evaluation | None | Metrics only | A validation step (shadow mode, historical pilot) before automation goes live |
| Native-first | Not mentioned | Mentioned in passing | Points to existing system capability first |

## Next

- Add OpenAI's newest models and open-weight models (Qwen, Mistral, Nemotron).
- Try a structured prompt on the same use cases to see how much of the gap is prompting.
- Extend to all 15 use cases, and have someone other than the owner score the answers.
