# Comparison against a plain LLM prompt

**Status: not run yet.** This page defines the protocol so the comparison is repeatable and can't be tuned after the fact.

## Question

Does a structured, rule-based decomposition give better approach recommendations than asking a strong general LLM directly?

## Protocol

1. Use the 15 library use cases. For each one, give the model only the title and the problem statement from `data/use-cases.json`.
2. Start a fresh chat for each use case, with no system prompt and no project context.
3. Use the prompt below verbatim.
4. Score each answer against the engine's output on the criteria below. Where the LLM is better, record that too.

## Prompt

```
I'm an enterprise architect scoping an AI solution for this ERP / supply chain use case:

<title>: <problem statement>

What AI approach and models would you recommend?
```

## Scoring (per use case)

| Criterion | 0 | 1 | 2 |
|---|---|---|---|
| Decomposition | Treats the use case as one thing | Mentions steps loosely | Separates steps with different patterns |
| Non-LLM fit | Defaults to LLM or agent throughout | Mentions ML/rules as options | Assigns rules, ML, or optimization where they fit |
| Autonomy and controls | None | Generic "human in the loop" | Specific approval points and controls tied to risk |
| Evaluation | None | Generic metrics | Metrics plus a baseline and go-live gate |
| Native-first | Not mentioned | Mentioned in passing | Points to existing ERP capability first |

## Results

| Use case | LLM score | Engine score | Notes |
|---|---|---|---|
| _pending_ | | | |

Publish the results as they are, including cases where the plain LLM wins.
