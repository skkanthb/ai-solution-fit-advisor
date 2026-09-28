# P2P-03: Claude Sonnet 5 (high), run 2

- Run: 2026-09-27 on LMArena, separate fresh chat per run

## Prompt

```
I'm an enterprise architect scoping an AI solution for this ERP / supply chain use case:

Three-way match exception resolution: Invoices that fail PO / goods receipt / invoice matching sit blocked while AP chases buyers and receivers.

What AI approach and models would you recommend?
```

## Answer

# Three-Way Match Exception Resolution — AI Solution Architecture

## 1. Problem Decomposition

Three-way match failures typically fall into recurring root-cause buckets:

| Exception Type | % of Typical Volume | Root Cause |
|---|---|---|
| Price variance | 30-40% | PO price ≠ invoice price (contract update lag, unauthorized change) |
| Quantity variance | 20-30% | Partial receipts, over/under shipment, UOM mismatch |
| Missing/late GR | 15-20% | Goods received but not entered in system |
| Timing mismatch | 10-15% | Invoice arrives before GR posted |
| Vendor/PO data mismatch | 5-10% | Wrong PO number, tax, currency, duplicate invoice |

Each bucket has a different resolution path, so a single "smart matcher" isn't enough — you need a **triage + resolution pipeline**, not one model.

---

## 2. Recommended Architecture (Layered)

```
Invoice Ingestion → Exception Classification → Root-Cause Reasoning
     → Auto-Resolution / Recommended Action → Human-in-Loop Approval
     → Feedback Loop / Learning
```

### Layer 1 — Document Understanding & Data Normalization
- **OCR/IDP (Intelligent Document Processing):** Extract line-item level data from invoices (esp. PDF/email/EDI variants).
  - Models: Azure Document Intelligence, AWS Textract, or Google Document AI; for higher accuracy on messy vendor formats, fine-tuned **LayoutLMv3 / Donut (document transformer)**.
- **Entity resolution:** Match vendor names, PO numbers, item descriptions across ERP, PO, and GR records despite formatting differences (fuzzy matching + embeddings, not just exact match).
  - Use lightweight embedding models (e.g., `sentence-transformers`) for item/description matching where SKU/PO text varies.

### Layer 2 — Exception Classification (the core AI decision)
Use a **gradient-boosted tree classifier** (XGBoost/LightGBM) or a fine-tuned small transformer, trained on historical exception resolutions, to:
- Predict exception category (price/qty/timing/data/duplicate)
- Predict likely root cause
- Predict probability of auto-resolvability vs. needs-human

Features: variance %, historical vendor behavior, PO change history, buyer/receiver patterns, contract terms, seasonality, vendor risk score.

*Why not an LLM here:* this is a structured, tabular, high-volume, low-latency decision — tree ensembles outperform LLMs on cost, speed, and explainability for this step. Reserve LLMs for reasoning/orchestration, not classification of structured data.

### Layer 3 — Root-Cause Reasoning & Resolution Recommendation (LLM layer)
This is where an **LLM agent** adds value — synthesizing across systems and unstructured context:
- Pull PO change logs, email threads, contract terms, prior resolution notes
- Reason: "This price variance matches a contract amendment dated X not yet synced to ERP — recommend auto-approve within tolerance"
- Draft resolution: auto-post, request GR entry, flag for buyer, request credit memo from vendor

**Model choice:**
- Use a capable general LLM (GPT-4.x class / Claude) via **RAG over ERP + contract + email data**, orchestrated as an **agent with tool access** (query ERP APIs, PO history, vendor master, tolerance rules engine).
- Keep it **constrained/tool-using**, not free-form — the LLM should call deterministic tools (tolerance checker, GR lookup) rather than "guess" numeric outcomes. LLMs are poor at reliable arithmetic/business-rule enforcement; use them for reasoning and drafting, not final numeric adjudication.
- Fine-tune or heavily prompt-engineer on your historical exception→resolution pairs for consistency with actual AP policy.

### Layer 4 — Auto-Resolution Engine (Deterministic + ML hybrid)
- Tolerance-based auto-approval (rules engine, not ML) for small variances within policy thresholds.
- ML-predicted confidence score gates what goes to auto-resolution vs. human queue.
- This hybrid (deterministic rules + ML confidence gating) is critical for **audit/compliance** — pure LLM auto-approval of financial transactions is a control risk.

### Layer 5 — Human-in-the-Loop Workflow
- Present AI-ranked exception queue (prioritized by $ value × age × resolution confidence) to AP analysts.
- Generate **draft communications** (LLM) to buyers/receivers requesting missing GR or PO correction — with one-click send.
- Capture analyst decisions as **feedback/training data**.

### Layer 6 — Continuous Learning
- Retrain classifier periodically on resolved exceptions.
- Track model drift by vendor, category, business unit.
- A/B test auto-resolution thresholds.

---

## 3. Model Recommendations Summary

| Function | Recommended Model Type | Notes |
|---|---|---|
| Document extraction | LayoutLMv3 / Donut, or cloud IDP APIs | Fine-tune on your invoice formats |
| Entity/fuzzy matching | Sentence-transformer embeddings + cosine sim | For SKU/vendor/PO matching |
| Exception classification | XGBoost/LightGBM (tabular) | Fast, explainable, cheap at scale |
| Root-cause reasoning & drafting | LLM agent (GPT-4-class/Claude) w/ RAG + tool calls | Don't let it do math/approvals alone |
| Numeric tolerance/approval logic | Deterministic rules engine | Auditability requirement |
| Prioritization/queueing | Simple scoring model (can be regression) | $ impact × age × SLA risk |

---

## 4. Why Hybrid, Not "One Big LLM Agent"

- **Auditability:** Finance/SOX controls require deterministic, explainable logic for actual GL posting decisions — pure LLM decisioning is a control gap auditors will flag.
- **Cost/latency at scale:** High invoice volumes make LLM-per-invoice expensive; use LLM selectively for ambiguous/high-value cases, tree models for bulk triage.
- **Accuracy:** LLMs hallucinate on numeric tolerance math; tree models + rules are deterministic and testable.
- **LLM's real value-add** is unstructured reasoning (emails, contract clauses, vendor communication history) and natural-language drafting — use it there.

---

## 5. Expected Impact Metrics to Track
- % exceptions auto-resolved without human touch
- Average resolution cycle time (days blocked)
- DPO/early payment discount capture improvement
- AP analyst exceptions-per-day throughput
- Vendor dispute/duplicate payment rate reduction

---

## 6. Build vs. Buy Note
If you're on SAP/Oracle/Coupa, check native AI capabilities first (SAP has ML-based invoice matching in S/4HANA; Coupa has invoice AI). Custom build is justified when your exception patterns, vendor mix, or ERP customization make out-of-box models underperform — validate with a **3-month historical exception dataset pilot** before committing to custom model development.

---

Want me to go deeper on any layer — e.g., the LLM agent's tool-calling architecture, the tolerance/rules engine design, or a phased implementation roadmap with effort estimates?
