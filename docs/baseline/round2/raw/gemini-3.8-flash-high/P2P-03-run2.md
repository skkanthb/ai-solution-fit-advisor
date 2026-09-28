# P2P-03: Gemini 3.8 Flash (high), run 2

- Run: 2026-09-27 on LMArena, separate fresh chat per run

## Prompt

```
I'm an enterprise architect scoping an AI solution for this ERP / supply chain use case:

Three-way match exception resolution: Invoices that fail PO / goods receipt / invoice matching sit blocked while AP chases buyers and receivers.

What AI approach and models would you recommend?
```

## Answer

As an Enterprise Architect, you should view this problem through a critical lens: **Do not treat three-way matching as a pure generative AI problem.** 

Three-way match exceptions sit directly in your **SOX compliance boundary** and impact the **GR/IR (Goods Receipt / Invoice Receipt) clearing account**. Pure LLMs are non-deterministic and hallucinate arithmetic. 

The industry-standard approach is a **Hybrid Architecture**: deterministic matching and business rules at the core, combined with **predictive ML** (for root cause analysis), **vector search** (for semantic reconciliation), and **Agentic LLMs** (for stakeholder outreach and autonomous remediation).

Here is the blueprint for an enterprise-grade AI architecture to resolve 3-way match exceptions.

---

### 1. High-Level AI Architecture Pattern

```
  [ ERP (SAP/Oracle) ] ──(CDC/Event)──► [ Event Broker (Kafka) ]
                                                │
         ┌──────────────────────────────────────┴──────────────────────────────────────┐
         ▼                                      ▼                                      ▼
┌──────────────────┐                  ┌──────────────────┐                  ┌──────────────────┐
│ Deterministic    │                  │ Semantic Match   │                  │ ML Root Cause    │
│ Validation       │                  │ Engine           │                  │ Classifier       │
│ - Exact math     │                  │ - Dense Embed.   │                  │ - Tabular ML     │
│ - Hard limits    │                  │ - Cross-Encoder  │                  │ - Predict delay  │
└────────┬─────────┘                  └────────┬─────────┘                  └────────┬─────────┘
         │                                      │                                      │
         └──────────────────────────────────────┼──────────────────────────────────────┘
                                                ▼
                               ┌─────────────────────────────────┐
                               │ Orchestration Engine (Temporal/ │
                               │ LangGraph State Machine)        │
                               └────────────────┬────────────────┘
                                                │
                                                ▼
                               ┌─────────────────────────────────┐
                               │ Agentic Engagement Layer (LLM)  │
                               │ - Teams / Slack / Email Bots    │
                               │ - Vendor Portal Connector       │
                               └────────────────┬────────────────┘
                                                │
                       ┌────────────────────────┴────────────────────────┐
                       ▼                                                 ▼
        [ Low-Confidence / High $ ]                       [ High-Confidence / Low $ ]
                       │                                                 │
                       ▼                                                 ▼
            ┌────────────────────┐                            ┌────────────────────┐
            │ Human-in-the-Loop  │                            │ Automated ERP      │
            │ (AP Worklist UI)   │                            │ Write-Back (BAPI)  │
            └────────────────────┘                            └────────────────────┘
```

---

### 2. Core Components & Model Recommendations

#### A. Ingestion & Semantic Reconciliation (Line-Item Matching)
*The Problem:* The PO says "Pack of 12 Screws, 1/4in," the invoice says "0.25 Fastener Dozen," and the Goods Receipt was booked against a partial shipment. Standard ERP fuzzy text matching fails here.
*   **Technique:** Bi-Encoder retrieval followed by Cross-Encoder re-ranking.
*   **Recommended Models:**
    *   *Bi-Encoder (Embeddings):* **Cohere Embed v3** or **OpenAI `text-embedding-3-large`** (fine-tuned on your historical item masters/procurement taxonomies).
    *   *Re-ranker:* **BGE-Reranker-Large** or **Cohere Rerank**.
    *   *Document Extraction (if scanned PDF/unstructured):* **Azure AI Document Intelligence (Invoice Model)** or **AWS Textract**, supplemented by a multimodal vision model (**Claude 3.5 Sonnet** or **GPT-4o**) for non-standard, tabular line-item extraction.

#### B. Root Cause Classification Engine
*The Problem:* Before bothering a buyer or receiver, the system must diagnose *why* it failed (e.g., true price variance, missing dock receipt, UOM mismatch, freight charge dispute, or dock-to-stock processing lag).
*   **Technique:** Tabular Machine Learning. Do not use an LLM for this; tabular models are faster, cheaper, and explainable for SOX compliance.
*   **Recommended Models:**
    *   **XGBoost / LightGBM:** Trained on historical AP exception logs, vendor master data, buyer IDs, historical dock-to-stock times, and item categories.
    *   *Output:* Root Cause Code + Confidence Score (e.g., `MISSING_GR_TIMING_LAG: 92%`).
    *   *Predictive Rule:* If the model predicts a receipt is typically logged within 48 hours for Vendor $X$ at Plant $Y$, the system automatically suppresses notifications for 48 hours instead of immediately pinging the receiver.

#### C. The Autonomous Resolution Agent (Stakeholder "Chasing")
*The Problem:* The manual overhead of drafting emails/Teams pings to buyers ("PO price is \$12, invoice is \$14, approve?") and receivers ("Did packing slip 982 arrive?").
*   **Technique:** State-Machine Driven Agentic Workflows with dynamic natural language interfaces.
*   **Recommended Models:**
    *   *Primary Agent Brain:* **Claude 3.5 Sonnet** or **GPT-4o**. These excel at instruction-following, structured tool calling (JSON outputs), and navigating ambiguous enterprise policies.
    *   *Edge/Cost-Optimized Alternative:* **Llama-3.3-70B-Instruct** (self-hosted via vLLM if data residency/privacy prevents public cloud APIs).
*   **Agent Tools / Functions:**
    1.  `check_tolerance_policy(vendor_id, variance_amount)`
    2.  `send_interactive_card(user_id, platform="Teams", payload)`
    3.  `read_vendor_contract_terms(vendor_id)` (RAG over MSA contracts)
    4.  `post_po_price_update(po_id, line_id, new_price)`
    5.  `trigger_goods_receipt(po_id, quantity, packing_slip_ref)`

---

### 3. Agentic Resolution Workflows by Exception Type

Here is how the AI agent acts on the three primary exception types:

| Exception Type | AI Diagnostic Action | Automated Resolution Workflow |
| :--- | :--- | :--- |
| **Missing Goods Receipt (GR)** | Check carrier API (FedEx/UPS tracking) + predict plant dock-to-stock delay. | **If tracking shows delivered:** Agent pings warehouse receiver via MS Teams Interactive Card: *"Tracking shows delivered at Dock B yesterday. Can you confirm receipt of 50 units for PO #10294?"* Clicking **[Confirm]** automatically triggers the ERP `BAPI_GOODSMVT_CREATE` or equivalent API. |
| **Price Variance** | Cross-reference Vendor Master, Contract/Pricelist (via RAG), and small-dollar tolerance limits. | **If within auto-tolerance ($< \$100$ or $<2\%$):** Auto-adjust PO and clear.<br>**If outside tolerance:** Agent drafts a context-rich Slack/Teams notification to the PO Buyer: *"Invoice #55 reflects unit price \$14.00 vs PO price \$12.00. Vendor cited fuel surcharge per Section 4.2 of contract. Click to [Approve PO Amendment] or [Reject with Dispute Letter]."* |
| **Quantity Mismatch (Short/Over)** | Compare line items using vector matching; evaluate against shipping tolerance flags. | **Under-shipment:** Agent checks if vendor flagged a backorder. If yes, auto-approves partial match and keeps PO line open. If no, prompts buyer to accept short fulfillment and close PO balance. |

---

### 4. Enterprise Architecture & Integration Blueprint

#### Orchestration Layer: LangGraph or Temporal
*Avoid raw LLM-driven orchestration (like basic AutoGPT or AutoGen).* 
*   Use **Temporal.io** or **LangGraph**. AP processes are long-running state transactions (a buyer might take 3 days to respond to an email). 
*   A durable execution engine guarantees state persistence, retries, timeout management, and clear escalation paths.

#### The HITL (Human-In-The-Loop) Policy Matrix
Implement an automated gating mechanism based on **Financial Exposure** and **Model Confidence**:

```
Confidence Score
      ▲
 1.0  │   [Auto-Execute]          │   [Human-in-the-Loop]
      │   Low $, High Confidence  │   High $, High Confidence
      │   (Auto-amend PO / Post)  │   (Pre-drafted action for 1-click AP approval)
      ├───────────────────────────┼──────────────────────────────────────────
      │   [Rule-Based Routing]    │   [Escalation]
      │   Low $, Low Confidence   │   High $, Low Confidence
      │   (Standard ERP workflow) │   (Direct to Senior AP Exception Specialist)
 0.0  └───────────────────────────┴──────────────────────────────────────────►
     $0                         $5,000                               Dollar Impact
```

#### Security, Auditing & SOX Compliance Guardrails
1.  **Segregation of Duties (SoD):** The AI Agent must run under an enterprise service identity with constrained RBAC. If the agent updates a PO, it **cannot** also release the payment block for the invoice.
2.  **Immutable Audit Trails:** Store every agent decision, prompt, LLM response, human interaction, and ERP API payload in an immutable datastore (e.g., AWS S3 with Object Lock or an append-only relational table). SOX auditors will require the step-by-step reasoning behind every PO amendment.
3.  **Deterministic Bounding:** The LLM does not write raw SQL or execute unconstrained API updates. It outputs structured JSON parameters into strictly validated, pre-compiled ERP APIs (e.g., SAP OData/BAPIs or Oracle Integration Cloud recipes).

---

### 5. Implementation Roadmap (Phased Value Delivery)

*   **Phase 1: Diagnostic Visibility & Predictive Hold (Weeks 1–6)**
    *   Deploy tabular ML to classify root causes for invoice holds.
    *   Implement "Smart Holds": auto-delay notifications for receipts predicted to clear naturally within 48 hours.
    *   *Value:* Immediately eliminates 20–30% of unnecessary buyer/receiver pings without risk.
*   **Phase 2: Assisted Resolution via Conversational Bots (Weeks 7–14)**
    *   Integrate Document AI + Vector Matching to reconcile line items.
    *   Deploy LLM-powered MS Teams/Slack bots for Buyer/Receiver queries with interactive action cards.
    *   Keep AP in the loop: Agent drafts the solution, human clicks "Approve."
*   **Phase 3: Autonomous Remediation within Tolerances (Weeks 15–24)**
    *   Enable direct ERP write-backs for low-risk, high-confidence scenarios (e.g., standard price tolerances, verified dock receipts).
    *   Establish self-tuning feedback loops where human edits to agent drafts retrain the classifier and refine system prompts.
