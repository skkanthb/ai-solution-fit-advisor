# AI Solution Fit Advisor

Recommends the right approach for each step of an ERP or supply chain use case, before anyone picks a model.

**Live demo:** https://skkanthb.github.io/ai-solution-fit-advisor/

Teams often start with "which LLM should we use?" The earlier question is what kind of problem each step is. A credit hold release process, for example, is a policy rule, a risk score, and an optional summary for the analyst. That's three patterns, and only one of them needs an LLM.

This tool makes that decomposition explicit. For each step it shows:

- **Solution pattern:** rules, fuzzy matching, tabular ML, anomaly detection, forecasting, optimization, document AI, LLM extraction or classification, RAG, LLM drafting, read-only or write-capable agents, or keeping a person in charge.
- **The rule that fired**, and why.
- **Autonomy level** (0–5), with the constraints that capped it.
- **Candidate tools and models**, from a dated registry.
- **Required controls**, "why not" the obvious alternatives, and an **evaluation plan** with a go-live gate.

## Who it is for

AI architects, SI partner practices, and presales teams shaping enterprise AI proposals in order-to-cash, procure-to-pay, and logistics.

## What's in v1

- 15 use cases across O2C, P2P, and Logistics, split into 37 steps.
- An ordered rulebook of 21 rules plus a fallback, over 12 intake questions.
- An "Assess a step" form. You can load any library step, change answers, and see how the recommendation moves.
- Markdown export of any recommendation, for pasting into a solution document.

Across the library, 13 of the 37 steps call for an LLM and 10 need no AI at all. Those counts come from running the engine over the library, not from hand-tagging.

## How it works

```
data/questions.json   12 intake questions and their allowed answers
data/patterns.json    solution patterns, autonomy defaults, why-not text, eval plans
data/registry.json    dated tool and model candidates per pattern
data/use-cases.json   curated use cases, steps, profiles, expected patterns
src/engine.js         ordered rules -> pattern, autonomy caps, controls, candidates
src/app.js            UI
scripts/build.py      inlines everything into one self-contained index.html
tests/engine.test.js  checks the engine reproduces every curated recommendation
```

The engine is deterministic and involves no LLM. The same answers always produce the same result. Curated steps store their expected pattern, and the test suite fails if the rules and the curated judgment disagree.

## Run locally

```bash
python3 scripts/build.py      # writes index.html
node tests/engine.test.js     # no dependencies
open index.html
```

## Limits

- The profiles and notes reflect one practitioner's ERP and supply chain experience. They have not been validated against measured project outcomes.
- Real steps are often borderline between two patterns. Treat the output as a starting position for an architecture review.
- Model names go stale. The registry is dated `2026-09`; check current versions and contract terms.
- No cost or ROI estimate, and no look at your data.
- Planning, manufacturing, and service processes are not covered yet.

## Roadmap

- **v1.1:** free-text intake, where an LLM turns a description into the 12-answer profile and the rules still decide.
- Extend the plain-LLM comparison ([first results](docs/llm-baseline.md)) to all use cases and current models.
- Planning use cases (demand forecasting, inventory rebalancing).

## Contributing

Disagree with a recommendation? Open an issue with the use case, the step, and the answer you think is wrong. Disagreement on real steps is the most useful input.

## License

Code: [MIT](LICENSE). Decision content in `data/`: [CC BY 4.0](LICENSE-CONTENT).
