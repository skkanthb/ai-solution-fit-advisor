# P2P-06: Gemini 3.8 Flash (high), run 1

- Run: 2026-09-27 on LMArena, separate fresh chat per run

## Prompt

```
I'm an enterprise architect scoping an AI solution for this ERP / supply chain use case:

Procurement policy and contract Q&A: Buyers and requesters email procurement to ask which policy applies or what a contract says about terms, rebates, or renewal.

What AI approach and models would you recommend?
```

## Answer

For an enterprise procurement and supply chain environment, answering contract and policy questions is **not a standard RAG problem**. Contracts have high relational complexity (e.g., Amendment 3 superseding Section 4.2 of an MSA signed four years ago), dense tabular data (rebate tiers, rate cards), and strict legal liabilities.

Here is an enterprise-grade architectural blueprint, recommended AI approach, and model stack tailored for your role as an Enterprise Architect.

---

### 1. Recommended AI Architecture: **Agentic Multi-Stage RAG**

A basic "vector search + LLM" pipeline will fail on contract terms and rebate tiers. You need an **Agentic Hybrid RAG** pattern with structured metadata routing and layout-aware document parsing.

```
[Inbound Email / Portal] 
       │
       ▼
[Triage & Intent Agent] ──(Queries ERP API for PO/Supplier context)
       │
       ├───────────────────────────────┐
       ▼                               ▼
[Policy Engine]               [Contract Engine]
(Hierarchical RAG)            (Graph/Chunk RAG + Layout Parsing)
       │                               │
       └───────────────┬───────────────┘
                       ▼
        [Answer Synthesis & Citation Engine]
                       │
                       ▼
        [Human-in-the-Loop (HITL) Verification] 
                       │
                       ▼
             [Outbound Email Draft]
```

#### Core Components:
1. **Layout-Aware Document Processing (The Critical Foundation):**
   * Contracts are non-linear and contain scanned signatures, side-notes, and complex tables. Standard PDF text extraction destroys table structures (critical for rebate tiers).
   * **Pattern:** Convert PDFs into layout-aware Markdown or JSON, preserving tables in HTML/Markdown formats.
2. **Contract Hierarchy & Relationship Mapping (Graph RAG / Document Linking):**
   * A single vendor relationship often consists of: *NDA $\to$ MSA $\to$ Order Form $\to$ Amendment 1 $\to$ Amendment 2*.
   * Your index must link child documents to parent documents. When an agent queries an MSA, it must automatically pull associated active amendments.
3. **Deterministic ERP Tool-Calling:**
   * Policies frequently depend on state (e.g., *"Purchases over $100k require VP approval"* or *"What is our current volume rebate status?"*).
   * The AI agent must determine the vendor and current spend by querying the ERP (SAP, Coupa, Oracle) via API, rather than relying on the LLM to guess.
4. **Draft-and-Approve (Human-in-the-loop):**
   * Do **not** auto-reply to emails initially. The system should ingest the email, parse intent, retrieve sources, draft the response with strict citations, and present it to a procurement specialist inside Outlook/ServiceNow/Coupa for 1-click approval.

---

### 2. Model Selection Matrix

To balance high reasoning requirements with enterprise data privacy, adopt a tiered model architecture:

| Function | Recommended Model(s) | Justification |
| :--- | :--- | :--- |
| **Primary Reasoning & Synthesis** | **Anthropic Claude 3.5 Sonnet** (via AWS Bedrock or GCP Vertex) | Currently the gold standard for dense instruction following, complex table comprehension, and low hallucination rates in legal/contract text. |
| **Alternative Reasoning (On-Prem/Private Cloud)** | **Llama 3.1 70B / 405B** (Quantized on vLLM / TensorRT-LLM) | If data sovereignty rules prevent sending contract data to public hyperscaler frontier models. |
| **Document Parsing & OCR** | **Azure AI Document Intelligence** (Layout Model) *or* **LlamaParse** | Best-in-class extraction of multi-row/multi-column contract tables (rebate matrices, pricing schedules) directly into Markdown/HTML. |
| **Dense Vector Embeddings** | **Cohere Embed v3** (via Bedrock/Azure) or **text-embedding-3-large** | Cohere Embed v3 allows setting `input_type="search_document"` vs `"search_query"` and excels at distinguishing enterprise jargon. |
| **Reranker (Mandatory)** | **Cohere Rerank 3** or **BGE-Reranker-Large** | Vector search alone will miss subtle clauses. A reranker ensures that out of the top 50 retrieved chunks, the exact clause or amendment lands in the top 3. |

---

### 3. Solving the Hardest Edge Cases

#### A. Complex Tabular Rebates
* **The Problem:** Embeddings flatten tables into strings, scrambling rows, columns, and tier dependencies (e.g., "$1M–$2M = 2% rebate; >$2M = 4%").
* **The Solution:** Use **small-to-large chunking** or **table-to-text augmentation**. When ingesting, extract the table as Markdown, pass it to an LLM to generate a natural language summary (e.g., *"Summary of Supplier X Rebate Schedule for 2024..."*), and index both the raw table and the summary.

#### B. Superseding Amendments
* **The Problem:** The MSA says "Net 30," but Amendment 2 signed two years later says "Net 60." A naive vector query returns both, and the LLM averages or hallucinates.
* **The Solution:** Implement **Temporal Metadata Tagging**.
  * Tag every chunk with: `Supplier_ID`, `Document_Type`, `Effective_Date`, and `Status` (`Active`/`Superseded`).
  * Implement an agent step: *“Verify if Section X has subsequent amendments before returning the answer.”*

#### C. Policy Ambiguity & Routing
* **The Problem:** "Which policy applies to buying laptop stands?"
* **The Solution:** Use an LLM-powered **Query Classifier** to map incoming inquiries to a standard Taxonomy (e.g., UNSPSC code, spend threshold, geography). Retrieve the specific policy document, extract the deterministic rule, and prompt the LLM to output its logical chain of thought showing *why* that rule applies.

---

### 4. Non-Functional & Architecture Requirements (EA Checklist)

1. **Strict Citation Verification:**
   * Configure the model's system prompt to enforce **groundedness**: The LLM must cite the exact document name, page number, and clause heading. If the answer cannot be explicitly derived from the provided context, it must fail safely: *"I could not find a clause governing renewal terms in the active MSA. Please contact the legal team."*
2. **Access Control & RBAC at the Index Level:**
   * Procurement contracts frequently contain highly sensitive financial and pricing terms. Requesters should only see policies and contracts relevant to their department or authorization level.
   * Enforce **metadata filtering** at the vector database retrieval level based on the requester's Active Directory/Okta identity before the chunks are passed to the LLM context.
3. **Data Privacy & Telemetry:**
   * Zero-data-retention agreements must be in place with cloud model providers (AWS Bedrock, Azure OpenAI, GCP Vertex).
   * Integrate an LLM observability layer (e.g., Arize Phoenix, Langfuse, or TruLens) to capture:
     * Hallucination rate
     * Retrieval precision/recall
     * Specialist acceptance/edit rate of generated draft replies

---

### 5. Implementation Roadmap

* **Phase 1 (Proof of Concept – Policy Q&A):**
  * Start with internal Procurement Policies (simpler, lower liability than contracts).
  * Ingest PDF policies $\to$ Chunking $\to$ Hybrid Search (OpenSearch/Pinecone/pgvector) $\to$ Claude 3.5 Sonnet.
  * Deliver as a Teams/Slack bot or ServiceNow plug-in.
* **Phase 2 (Contract Q&A with Human-in-the-Loop):**
  * Ingest high-volume MSAs, SOWs, and Amendments.
  * Implement Document Parsing (Azure Document Intelligence) and Cohere Reranking.
  * Build the Outlook/Email add-in that drafts responses for procurement specialists to review and send.
* **Phase 3 (Agentic ERP Integration):**
  * Connect the Agent to ERP APIs (SAP S/4HANA or Coupa).
  * Automate live spend calculations against contract rebate tiers and trigger renewal alerts based on contract metadata.
