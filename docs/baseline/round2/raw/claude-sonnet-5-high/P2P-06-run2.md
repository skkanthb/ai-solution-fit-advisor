# P2P-06: Claude Sonnet 5 (high), run 2

- Run: 2026-09-27 on LMArena, separate fresh chat per run

## Prompt

```
I'm an enterprise architect scoping an AI solution for this ERP / supply chain use case:

Procurement policy and contract Q&A: Buyers and requesters email procurement to ask which policy applies or what a contract says about terms, rebates, or renewal.

What AI approach and models would you recommend?
```

## Answer

# Procurement Policy & Contract Q&A: Recommended AI Approach

## Core Architecture: RAG (Retrieval-Augmented Generation)

This is a textbook RAG use case — **not** a fine-tuning problem. You need grounded, citable answers from a corpus that changes over time (new contracts, policy updates, amendments).

```
Email → Intent/Entity Extraction → Hybrid Retrieval → LLM Synthesis 
→ Citation Check → Confidence Gate → Response (draft or auto-send)
```

---

## Why RAG Over Alternatives

| Approach | Verdict | Reasoning |
|---|---|---|
| **RAG** | ✅ Recommended | Answers must trace to specific contract clauses/policy sections; corpus updates constantly; need auditability |
| Fine-tuning | ❌ Wrong tool | Doesn't reliably encode facts (contract terms, dates, rebate %), goes stale fast, hallucination risk on specifics |
| Pure prompt-stuffing | ❌ Won't scale | Contract portfolios exceed context windows; no source targeting |
| Agentic (multi-step) | ⚠️ Selective use | Only for cross-document reasoning ("compare rebate terms across our top 5 suppliers") |

---

## Recommended Components

### 1. Ingestion & Indexing
- **Document processing**: Layout-aware parsing (contracts have tables, defined terms, exhibits, amendments) — Azure Document Intelligence / AWS Textract / Unstructured.io
- **Chunking strategy**: Clause-level, not fixed-token — preserve section headers (e.g., "Section 8.2 — Rebate Structure") as metadata
- **Metadata tagging**: Contract ID, supplier, effective/expiry dates, policy category, version/amendment number, governing entity
- **Versioning**: Critical — must retrieve the *currently active* clause, not a superseded one

### 2. Retrieval Layer
- **Hybrid search**: Dense (embeddings) + sparse (BM25/keyword) — contract language has exact terms (defined terms, clause numbers) that pure semantic search misses
- **Metadata filtering**: Pre-filter by supplier/contract before semantic search
- **Embedding model**: `text-embedding-3-large` (OpenAI) or `Cohere embed-v3` — both handle legal/contract language well
- **Reranking**: Add a reranker (Cohere Rerank, or cross-encoder) — precision matters more than recall here; wrong clause = wrong answer to a buyer

### 3. Generation Model
- **Primary**: GPT-4o or Claude 3.5 Sonnet — need strong instruction-following for "cite the exact clause," structured output, and handling nuanced contract language
- **Cost-optimized tier**: Route simple policy lookups (FAQ-style) to GPT-4o-mini / Claude Haiku; escalate complex multi-clause or rebate-calculation questions to the larger model
- **Structured output**: Force citation format — every claim must reference (Contract ID, Section, Page)

### 4. Guardrails (High Priority Here)
- **Grounding/citation enforcement**: Reject or flag answers where generation isn't traceable to retrieved chunks
- **Confidence thresholding**: Low retrieval-confidence → route to human (procurement specialist), don't guess on rebate terms or renewal dates
- **Numeric/date validation**: Extra scrutiny on dollar amounts, percentages, dates — these are the highest-liability errors
- **Freshness check**: Flag if the matched contract is near expiry or superseded

### 5. Human-in-the-Loop
- Auto-answer for high-confidence, policy-lookup questions (low risk)
- Draft-for-review for anything touching **rebates, pricing, renewal terms, or termination clauses** (financial/legal exposure)
- Full escalation for ambiguous supplier/contract matches

---

## Integration Points
- **Email ingestion**: Outlook/Gmail connector or shared mailbox → intent classifier → RAG pipeline
- **Source systems**: Contract Lifecycle Management (CLM) tool (Icertis, SAP Ariba, DocuSign CLM) as source-of-truth feed into the index — don't duplicate storage, sync metadata
- **ERP linkage**: Pull PO/supplier context from SAP/Oracle to auto-scope retrieval (e.g., "this requester's PO ties to Supplier X → filter to Supplier X's contract")

---

## What I'd Avoid
- Fine-tuning an LLM on your contracts (stale, unauditable, doesn't scale as contracts change)
- A single generic chatbot without citation enforcement (liability risk — wrong rebate answer to a buyer is a real financial exposure)
- Skipping the reranking step to save cost (precision failures here are expensive)

---

## Quick Build vs. Buy Note
If you're on SAP Ariba or Coupa already, check their native contract-intelligence add-ons first — may get you 70% there faster than custom RAG, with custom RAG layered on top for gaps (email intake, cross-contract reasoning, ERP-linked context).

Want me to sketch the confidence-scoring/escalation logic in more detail, or compare specific vendor options (build vs. buy)?
