# P2P-03: Gemini 3.8 Flash (high), run 1

- Run: 2026-09-27 on LMArena, separate fresh chat per run

## Prompt

```
I'm an enterprise architect scoping an AI solution for this ERP / supply chain use case:

Three-way match exception resolution: Invoices that fail PO / goods receipt / invoice matching sit blocked while AP chases buyers and receivers.

What AI approach and models would you recommend?
```

## Answer

As an Enterprise Architect, you should frame this not as a single monolithic model problem, but as a **Compound AI System**. Three-way match resolution requires a hybrid approach: **deterministic business logic** for mathematical tolerance, **predictive ML** for anomaly categorization and timing predictions, and **Agentic Generative AI** for unstructured data extraction, reasoning, and stakeholder communication.

Below is the recommended architectural blueprint, workflow, and model selection.

---

### 1. High-Level System Architecture

The architecture relies on an **Event-Driven, Human-in-the-Loop (HITL) Agentic Architecture** triggered whenever the ERP (SAP, Oracle, Workday) places an invoice on a matching hold.

```
[ERP Hold Event] 
       │
       ▼
[Layer 1: Exception Triage & Feature Store] (Deterministic Rules + Gradient Boosted Trees)
       │
       ├─► (Known Pattern / Low Risk) ──► [Auto-Resolve via ERP API]
       │
       ▼ (Complex / Ambiguous Variance)
[Layer 2: Cognitive Context Engine] (RAG over Contracts, PO notes, Receiving Slips, Emails)
       │
       ▼
[Layer 3: Agentic Resolution Orchestrator] (Reasoning LLM + Function Calling)
       │
       ├─► Auto-nudge Buyer/Receiver (Slack/Teams/Email with pre-populated diffs)
       ├─► Request Vendor Credit Memo
       └─► Route to AP Specialist UI (with AI-generated root cause & recommendation)
```

---

### 2. Layered Approach & Model Recommendations

#### Layer 1: Ingestion, Normalization & Categorization
Before bringing in expensive LLMs, categorize the *nature* of the mismatch.
* **The Problem:** Is it a unit-of-measure (UOM) mismatch (e.g., EA vs. Box of 10), price variance, missing Goods Receipt (GR), or tax/freight allocation issue?
* **Approach:**
  * **Document AI / Intelligent Document Processing (IDP):** Extract line items, header data, and unstructured terms.
    * *Recommended Models:* **Azure AI Document Intelligence** (Invoice Prebuilt) or **AWS Textract**. If parsing messy, non-standard global invoices, use a multimodal model like **Claude 3.5 Sonnet** or **GPT-4o** for high-accuracy zero-shot extraction.
  * **Predictive Triage (Classification):** 
    * A significant number of missing GRs are simply "timing issues" (invoice arrived before the dock logged the receipt).
    * *Recommended Model:* **XGBoost** or **LightGBM**. Train on historical ERP data (features: vendor lead time, shipping carrier, dock delay history, seasonality) to predict: *“Will the GR arrive within 48 hours without intervention?”* If probability > 90%, suppress the exception and snooze the workflow.

#### Layer 2: Context Retrieval (RAG over Procurement Artifacts)
Exceptions often occur because the ERP lacks unstructured context that exists elsewhere (e.g., a change order agreed via email, price variance allowed in a master services agreement).
* **Approach:** Build an enterprise Retrieval-Augmented Generation (RAG) pipeline indexing:
  * Signed Master Service Agreements (MSAs) and Statements of Work (SOWs).
  * Buyer-vendor email threads (via MS Graph / Google Workspace APIs).
  * Warehouse delivery slips / Bills of Lading (BOL).
* **Recommended Models:**
  * **Embedding Model:** **Cohere Embed v3** or **text-embedding-3-large**. Cohere is exceptionally strong on enterprise/tabular search.
  * **Vector DB:** **Pinecone**, **pgvector**, or your enterprise Databricks/Snowflake vector store.

#### Layer 3: Reasoning & Agentic Resolution
This is where you replace AP manually chasing people. The agent understands the discrepancy, formulates a hypothesis, gathers evidence, and takes action.
* **The Problem:** The buyer needs to approve a price variance, or the receiver needs to confirm physical delivery.
* **Approach:** An LLM Agent utilizing **Tool Use / Function Calling**.
  * The agent analyzes: `Invoice Line 3 ($1,200) vs PO Line 3 ($1,000)`.
  * Checks MSA via RAG: "Contract permits up to a 10% fuel surcharge."
  * Formulates action: Variance is 20%. Exceeds contract. Generates a drafted communication.
* **Recommended Models:**
  * **Primary (Reasoning & Orchestration):** **Anthropic Claude 3.5 Sonnet**. Currently best-in-class for complex reasoning, tool calling, and structured JSON output without hallucinations.
  * **Secondary / On-Premise Alternative:** **Llama 3.1 70B Instruct** (hosted via vLLM / AWS Bedrock / Azure AI) if data residency or strict enterprise data controls prevent external API calls.

---

### 3. Concrete Functional Workflows

#### Scenario A: Missing Goods Receipt (Dock Lag vs. Real Issue)
1. **Detection:** Invoice arrives; PO exists; GR is missing.
2. **Predictive Check:** ML model estimates a 92% chance the shipment is on the dock based on carrier tracking API data.
3. **Action:** Workflow snoozes for 48 hours. If still missing, the Agent drafts an interactive message to the warehouse receiver via Slack/Teams: 
   * *"Tracking indicates Carrier X delivered 5 pallets for PO 789 on Tuesday. Can you confirm physical receipt so we can release Invoice 101 for payment? [Confirm Received] [Report Not Found]"*
4. **Resolution:** Receiver clicks "Confirm," agent triggers ERP BAPI/API to post the GR, invoice unblocks automatically.

#### Scenario B: Price / Quantity Variance (The "Chase the Buyer" Loop)
1. **Detection:** Price variance of $450 exceeds automated tolerance thresholds ($50).
2. **Context Search:** Agent checks PO line notes and buyer emails. Finds an email where the buyer agreed to expedited freight of $450.
3. **Action:** Agent initiates a workflow to the buyer:
   * *"Invoice 554 from Vendor Y has a $450 variance for freight. We matched this to your email approval on Oct 12th. Reply 'Approve' to update the PO line or 'Reject' to dispute with vendor."*
4. **Resolution:** Upon approval, the Agent triggers the ERP workflow to append the PO freight line and clears the hold.

---

### 4. Enterprise Architecture & Governance Guardrails

As an EA, you must design for auditability and compliance (especially for SOX / internal financial controls):

1. **Deterministic Financial Math:** **Never** let the LLM calculate line-item totals, taxes, or tolerances. Write these in code (Python/Java). Use the LLM only for semantic understanding, classification, and drafting.
2. **Auditability (SOX Compliance):** 
   * Every automated release or adjustment must log a complete audit trail: the prompt, retrieved context, confidence score, and ERP transaction ID.
   * AI should **recommend** PO changes; actual financial ledger updates should execute under a strictly scoped service account with explicit tolerance caps (e.g., Agent can auto-adjust up to $250; anything higher requires 1-click human sign-off).
3. **Integration Pattern:**
   * **Source Systems:** Decouple from core ERP via CDC (Change Data Capture like Debezium) or ERP Event Mesh (e.g., SAP Event Mesh listening to `MRBR` hold events).
   * **Interaction Layer:** Integrate with Teams/Slack (via Bot Framework) for internal buyer/receiver chasing, reducing email latency.

### 5. Recommended Phased Implementation

* **Phase 1 (Quick Win): Predictive Snoozing & IDP**
  * Modernize extraction using Cloud IDP + Claude 3.5 Sonnet.
  * Implement predictive ML to stop AP from chasing missing GRs that naturally resolve within 72 hours (typically eliminates 30-40% of manual touches).
* **Phase 2 (Context & Nudge): HITL Resolution Agent**
  * Implement RAG over procurement contracts.
  * Have the Agent construct the context and pre-draft Slack/Teams/Email messages for AP specialists to review before sending.
* **Phase 3 (Autonomous Agent): Closed-Loop Execution**
  * Allow low-risk exceptions (e.g., price variance < $100 with clear contractual basis) to update the ERP and release payments fully autonomously.
