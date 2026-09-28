# P2P-03: Claude Sonnet 5 (high), run 1

- Run: 2026-09-27 on LMArena, separate fresh chat per run

## Prompt

```
I'm an enterprise architect scoping an AI solution for this ERP / supply chain use case:

Three-way match exception resolution: Invoices that fail PO / goods receipt / invoice matching sit blocked while AP chases buyers and receivers.

What AI approach and models would you recommend?
```

## Answer

# Three-Way Match Exception Resolution: AI Architecture Recommendation

## Problem Framing

Before jumping to models, decompose what's actually happening in a blocked three-way match:

- **Price variance** — invoice price ≠ PO price
- **Quantity variance** — invoiced qty ≠ received qty
- **Missing GR** — goods receipt not yet posted
- **Timing mismatches** — partial shipments, split invoices, back-orders
- **Vendor/data quality issues** — wrong PO reference, UOM mismatches, currency/tax discrepancies
- **Routing/ownership ambiguity** — unclear who (buyer, receiving dock, AP) needs to act

This is a **classification + root-cause diagnosis + workflow orchestration** problem, not a single-model problem. Recommend a layered architecture rather than one "AI model."

---

## Recommended Architecture (4 Layers)

### Layer 1: Exception Classification & Triage (the core ML layer)
**Task:** Given invoice/PO/GR data, classify exception type and predict likely root cause + resolution path.

- **Model type:** Gradient-boosted trees (XGBoost/LightGBM) on structured features — this is tabular data, not a place to reach for deep learning first.
- **Features:** variance amount/%, vendor history, buyer/category, UOM, historical resolution patterns, PO line type (standard/blanket/service), aging.
- **Output:** exception category + confidence + suggested resolution path (auto-correct, route to buyer, route to receiving, route to AP for vendor contact).
- Train on historical resolved exceptions (label = how it was actually resolved) — most ERPs (SAP, Oracle, Coupa) have years of this in match history tables.

**Why not an LLM here:** this is a well-bounded, high-volume, structured decision. Gradient boosting is cheaper, faster, more auditable, and typically outperforms LLMs on tabular classification with enough history.

### Layer 2: Document/Data Extraction & Normalization
For invoices arriving as PDFs/email/EDI with inconsistent formatting:
- **Model type:** Specialized document AI (Azure Document Intelligence, AWS Textract, or Google Document AI) or fine-tuned layout-aware transformer (LayoutLMv3) for invoice field extraction.
- Handles PO number extraction, line-item parsing, tax/currency normalization before matching logic runs.
- Critical if a meaningful % of exceptions stem from OCR/parsing errors rather than true business variance.

### Layer 3: Reasoning & Narrative Layer (LLM, used narrowly)
Use an LLM **on top of** structured outputs from Layers 1–2, not as the matcher itself:
- Generate human-readable explanation of *why* an exception occurred, referencing actual PO/GR/invoice line data (RAG-style grounding against ERP records — no hallucinated numbers).
- Draft the outreach email/message to buyer or vendor with context pre-filled.
- Summarize AP analyst's queue: "12 exceptions, 8 auto-resolvable, 4 need buyer input for PO #12345 due to qty variance."
- **Model choice:** GPT-4o-class or Claude-class model via API, with strict tool-calling/function-calling to pull grounded data — not freeform generation of match decisions.

### Layer 4: Agentic Workflow Orchestration
- Use a workflow/agent layer (could be LLM-orchestrated with tool use, or simpler rules+RPA) to:
  - Auto-resolve low-risk exceptions within tolerance (e.g., price variance <2% and under $X → auto-approve per policy).
  - Route ambiguous ones with pre-populated context to the right human.
  - Chase (send reminders, escalate after SLA) without manual AP follow-up.
- This is where most of the *cycle-time* ROI comes from — not smarter classification, but removing the manual chasing loop.

---

## Suggested Build Sequence (de-risked rollout)

1. **Start with auto-resolution of tolerance-based exceptions** (rules + simple ML) — fastest ROI, lowest risk, builds trust.
2. **Add classification/routing model** trained on historical resolutions — reduces AP triage time.
3. **Add LLM explanation/drafting layer** — improves buyer/vendor response speed, reduces email ping-pong.
4. **Add predictive layer**: flag *likely-to-fail* matches before invoice even posts, by watching PO/GR patterns (e.g., partial receipts, known problem vendors) — shifts from reactive to preventive.

---

## Key Architectural Principles

- **Don't use an LLM for the match decision itself** — keep that deterministic/ML-scored and auditable for SOX/audit trail reasons. Finance controls will require explainability.
- **Ground any generative output in retrieved ERP data** (RAG against PO/GR/invoice tables), never let the LLM "recall" numbers.
- **Human-in-the-loop by default**, auto-resolve only within board-approved tolerance policies, with full audit logging.
- **Feedback loop:** every human resolution becomes new training data for Layer 1 — this compounds over time.
- **Integration point matters more than model choice** — value comes from embedding this in the ERP/AP workflow (SAP MM/FI, Oracle P2P, Coupa, etc.), not from a standalone chatbot.

---

## What I'd Push Back On

If your org is being sold a "GenAI agent that resolves three-way match exceptions end-to-end," push for a POC on **auto-resolution rate and false-positive rate on real historical data first**. The unglamorous gradient-boosted classifier + workflow automation typically delivers 60-80% of the value at a fraction of the cost and risk of a full agentic LLM system. The LLM layer is a genuine value-add for communication/explanation, not a replacement for deterministic matching logic.

---

Want me to sketch the data schema/feature set needed for Layer 1, or the tolerance-policy design for auto-resolution?
