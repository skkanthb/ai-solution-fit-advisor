# P2P-06: Gemini 3.8 Flash (high), run 2

- Run: 2026-09-27 on LMArena, separate fresh chat per run

- Note: this answer refers to 'Sonnet vs Flash', which is not in the prompt. It likely picked up context from the testing platform. Treat as not clean.

## Prompt

```
I'm an enterprise architect scoping an AI solution for this ERP / supply chain use case:

Procurement policy and contract Q&A: Buyers and requesters email procurement to ask which policy applies or what a contract says about terms, rebates, or renewal.

What AI approach and models would you recommend?
```

## Answer

For an enterprise procurement and contract Q&A system, a standard "naive" RAG (Retrieval-Augmented Generation) pipeline will fail. Contracts contain complex dependencies (e.g., amendments superseding master agreements), nested pricing/rebate tables, and strict legal liability where hallucinations cannot be tolerated.

Below is the recommended **architectural approach**, **model selection strategy**, and **system design** tailored for an Enterprise Architect.

---

### 1. Recommended AI Architecture: **Agentic, Metadata-Filtered Hybrid RAG**

Instead of treating policies and contracts the same, decouple the architecture into two distinct pipelines coordinated by an **Orchestrator Agent**:

```
[Inbound Email via MS Graph / ERP Webhook]
                     │
                     ▼
             [Orchestrator Agent]
           (Intent / Entity Extraction)
          ┌──────────┴──────────┐
          ▼                     ▼
   [Policy Pipeline]     [Contract Pipeline]
   • Hybrid Search       • Deterministic ERP Lookup (Coupa/SAP)
   • Vector + BM25       • Amendment Chain Assembly
   • Intranet/SOPs       • Table/Rebate Extraction
          └──────────┬──────────┘
                     ▼
          [Synthesis & Verification]
           (Grounding & Attribution)
                     │
                     ▼
    [Draft Email Response + Citations] ──> [HITL Review / Auto-Send]
```

#### Pipeline A: General Procurement Policy Q&A
* **Nature:** Semi-structured, public/internal, low risk of conflicting legal precedence.
* **Approach:** **Hybrid Search (Dense Vector + Sparse BM25)** over chunked policy documents (e.g., "Procurement thresholds", "T&E policies").
* **Chunking:** Semantic chunking with hierarchical headers preserved.

#### Pipeline B: Contract Specific Q&A (Terms, Rebates, Renewals)
* **Nature:** Highly structured legal text, chronological amendments, complex rebate matrices, strict RBAC requirements.
* **Approach:** **ERP-Grounded Agentic Extraction**.
    1. **Entity Linking:** Query ERP metadata (SAP S/4HANA, Coupa, Ivalua) using supplier name/ID to locate the exact Master Services Agreement (MSA), Statements of Work (SOWs), and Amendments.
    2. **Document Assembly:** Pass the *entire relevant contract package* (or relevant sections) to the LLM. Do not rely solely on naive chunk retrieval for contracts—clauses cross-reference each other.
    3. **Pre-processing/OCR:** Use layout-aware document parsers (e.g., Azure AI Document Intelligence or LlamaParse) to convert rebate tables into structured Markdown/HTML tables.

---

### 2. Model Selection Strategy: The "Sonnet vs. Flash" Fit

Your prompt hints at the trade-off between **high-reasoning frontier models (e.g., Claude 3.5/3.7 Sonnet, GPT-4o)** versus **high-speed/low-cost long-context models (e.g., Gemini 1.5/2.0 Flash, GPT-4o-mini)**.

A **two-tier model routing strategy** delivers the best balance of cost, latency, and accuracy:

| Capability Tier | Recommended Archetype | Candidate Models | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| **Tier 1: Triage & Routing** | Fast, cheap, high-throughput | **Gemini 2.0 Flash** / **GPT-4o-mini** | • Email intent classification<br>• Vendor/contract ID extraction<br>• Routing between Policy vs. Contract pipeline<br>• Drafting simple policy answers |
| **Tier 2: Deep Contract Reasoning** | High-reasoning, table-aware, strong instruction following | **Claude 3.5/3.7 Sonnet** | • Cross-referencing amendments (e.g., "Does Amendment 2 override Section 4 of the MSA?")<br>• Rebate tier calculations<br>• Strict grounding and citation verification |

#### Why this split?
* **Why Flash for Triage/Policies?** 80% of inbound emails are simple ("What is the spend threshold for VP approval?"). Flash models handle this at sub-second latency and fraction-of-a-cent costs.
* **Why Sonnet for Contracts & Rebates?** Claude Sonnet consistently outperforms peers in nuanced legal interpretation, code-like reasoning over pricing tiers, and adhering strictly to provided text without hallucinating terms.
* *Alternative for Massive Contracts:* If a single supplier file has 40+ amendments totaling 300+ pages, **Gemini 1.5/2.0 Pro or Flash** is a strong candidate specifically for its **native 1M–2M token context window**, avoiding complex chunking entirely by ingesting the entire document history in one prompt.

---

### 3. Critical Enterprise Considerations

#### A. The "Amendment Precedence" Problem
Contracts are chronological graphs. Amendment 3 might state: *"Section 5.2 of Amendment 1 is hereby deleted."*
* **Solution:** Maintain document versioning and metadata in the vector/document store. When querying a contract, retrieve the base agreement *plus* all active amendments, and instruct the LLM to process them chronologically with explicit instructions on precedence.

#### B. Complex Rebate Grids & Tables
Vector embeddings destroy tabular structures. If a question asks *"What is our rebate if we hit $5M in volume?"*, a standard chunk search often retrieves the wrong row.
* **Solution:**
    * Extract tables to clean Markdown or JSON during ingestion.
    * Use a model with strong table reasoning (Sonnet) to interpret tiered pricing (e.g., marginal vs. cumulative rebate tiers).

#### C. RBAC and Data Segregation
Requester A cannot see executive retainer agreements; Buyer B should only see IT contracts.
* **Solution:** Enforce **pre-retrieval access control filtering**. Embed ERP user entitlements into the search query so the retrieval engine never indexes or surfaces contracts the user is unauthorized to view.

#### D. Hallucination Mitigation & Auditability
Procurement answers lead to financial and legal obligations.
* **Citations:** The model must output exact citations (e.g., `[MSA Section 4.1, page 12]`).
* **Confidence Scoring & HITL (Human-in-the-Loop):** If the model's confidence in locating an exact clause is below a defined threshold, or if the contract has pending unsigned amendments, the agent should draft the reply and route it to a Procurement Category Manager for review rather than auto-replying.

---

### 4. Implementation Blueprint (Phased Rollout)

1. **Phase 1: Policy Bot (Weeks 1–6)**
   * Deploy Tier 1 model (Flash/mini) + Vector Search on procurement intranet policies.
   * Low risk, fast ROI, validates the email-parsing interface.
2. **Phase 2: Contract Q&A with Human-in-the-Loop (Weeks 7–14)**
   * Integrate ERP/CLM APIs (SAP Ariba, Coupa, Ironclad, or DocuSign CLM).
   * Implement high-reasoning model (Sonnet) with Markdown table parsing.
   * Auto-generate draft responses directly in Outlook/ServiceNow for procurement agent approval.
3. **Phase 3: Autonomous Contract Resolution (Weeks 15+)**
   * Enable automated replies for standard contract metadata (renewal notice dates, basic payment terms).
   * Keep complex rebate/liability inquiries routed through human review.
