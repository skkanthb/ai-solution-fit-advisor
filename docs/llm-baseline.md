# Comparison against a plain LLM prompt

**Status:** first run completed 2026-09-27. Small sample (4 use cases × 2 models × 1 run). Read the findings as directional, not conclusive.

## Question

When you ask a general-purpose LLM directly, does it recommend the right approach for each step of an enterprise use case? And where does a structured, rule-based tool add something the LLM doesn't?

## Summary

- **The models did better than expected.** GPT 5.2 broke the use cases into steps, used ML, rules, and optimization where they fit, and proposed specific approval gates. It did not default to "use an LLM for everything."
- **Claude Sonnet 4.5 was weaker and less consistent.** On three-way match it proposed LLMs throughout, including extracting data from purchase orders and goods receipts, which are already structured ERP records.
- **Both models missed the same three things:**
  - checking what the ERP already does before building anything,
  - naming a go-live gate,
  - consistency between answers.
- **Both cited outdated model names** (GPT-4.1, Claude 3.5, Llama 3.1), which supports keeping a dated registry.

What this means for the tool: its value is not that "LLMs get this wrong." It gives the same structured, reviewable answer every time, starts from native ERP capability, and states approval points and go-live gates explicitly.

## Results

Scores are 0–2 per criterion (rubric below), 10 per use case. The owner scored first; the scores were then reviewed line by line against the answer text. The reviewed scores are used below, and both sets are in [`baseline/scores.csv`](baseline/scores.csv).

| Use case | GPT 5.2 | Claude Sonnet 4.5 | Notes |
|---|---|---|---|
| O2C-02 Credit hold release | 7 | 4 | GPT: risk model + policy layer + LLM "not for the score", auto-release only for the lowest-risk band. Claude: ML only, no policy rules layer, unsupported "60–80% auto-released" claim. |
| P2P-03 Three-way match exceptions | 8 | 3 | GPT: tolerances first, ML routing, "LLM cannot post financial documents" without approval. Claude: LLMs for extraction, classification, and routing of structured data. |
| LOG-01 Shipment ETA and delay | 5 | 7 | Both: gradient boosting for ETA, optimization for re-planning. GPT had no approval points. Claude suggested visibility platforms before building, but also reinforcement learning and genetic algorithms. |
| P2P-06 Policy and contract Q&A | 8 | 5 | LLM with retrieval is the right answer; both got there. GPT added hybrid search, permission trimming, and approval for rebate and renewal interpretations. |
| **Total (of 40)** | **28** | **19** | First-pass owner scores were 16 and 16. |

By criterion, totals across the four use cases (maximum 8):

| Criterion | GPT 5.2 | Claude Sonnet 4.5 |
|---|---|---|
| Decomposition | 8 | 5 |
| Non-LLM fit | 8 | 4 |
| Autonomy and controls | 6 | 4 |
| Evaluation | 4 | 4 |
| Native-first | 2 | 2 |

The weakest criteria for both models were **native-first** and **evaluation**. Neither model ever named a go-live gate.

## What the models did better than the tool

These are gaps in the tool, to be added to its content:

- **Credit hold:** a decision layer based on expected loss (probability of non-payment × exposure), rather than a probability threshold alone.
- **Shipment ETA:** quantile ETAs (P50 / P80), so planners act on a range instead of a single date.
- **Contract Q&A evaluation:**
  - test that amendments override the base agreement,
  - test that answers do not leak restricted contracts.
- **Credit hold:** treat master-data changes (bank details, ship-to addresses) as risk signals.

## Limits of this comparison

- **Small sample:** 4 of 15 use cases, one run each. LLM answers vary between runs, so that variation is not yet measured.
- **Model versions:** Claude Sonnet 4.5 is not the current Claude model. The next run should add the current Claude and Gemini models.
- **The rubric is not neutral toward the tool.** It was written from the tool's own output format, so the tool scores near full marks by construction. For that reason the engine is not given a score here. This page reports what the LLMs did, not an engine-vs-LLM score.
- **Scoring is judgment.** Borderline cases were scored conservatively. The raw answers are published so anyone can re-score them.

## Raw answers

- [`baseline/raw/gpt-5.2/`](baseline/raw/gpt-5.2/)
- [`baseline/raw/claude-sonnet-4.5/`](baseline/raw/claude-sonnet-4.5/)

## Protocol

1. For each use case, give the model only the title and problem statement from `data/use-cases.json`.
2. Start a fresh chat for each use case, with no system prompt, no project context, and memory off.
3. Use the prompt below verbatim.
4. Score each answer with the rubric. Record where the LLM did better.

### Running it

Manually: paste the prompt below into a fresh chat per use case.

Automated across models, with one OpenRouter key:

```bash
export OPENROUTER_API_KEY=sk-or-...
python3 scripts/run_baseline.py --list-models claude   # find exact model IDs
python3 scripts/run_baseline.py --models <id1> <id2> <id3> --use-cases O2C-02 P2P-03 LOG-01 P2P-06
```

Raw answers land in `docs/baseline/raw/` and a blank scoring sheet in `docs/baseline/scores.csv`. API calls send no system prompt, so answers can differ from the consumer chat apps.

### Prompt

```
I'm an enterprise architect scoping an AI solution for this ERP / supply chain use case:

<title>: <problem statement>

What AI approach and models would you recommend?
```

### Rubric (per use case)

| Criterion | 0 | 1 | 2 |
|---|---|---|---|
| Decomposition | Treats the use case as one thing | Mentions steps loosely | Separates steps with different approaches |
| Non-LLM fit | Defaults to LLM or agent throughout | Mentions ML/rules as options | Assigns rules, ML, or optimization where they fit |
| Autonomy and controls | None | Generic "human in the loop" | Specific approval points and controls tied to risk |
| Evaluation | None | Generic metrics | Metrics plus a baseline and go-live gate |
| Native-first | Not mentioned | Mentioned in passing | Points to existing ERP capability first |

## Next run

- Add the current Claude and Gemini models, and run each use case twice to see how much answers vary.
- Extend to all 15 use cases.
- Have someone other than the owner score the answers.
