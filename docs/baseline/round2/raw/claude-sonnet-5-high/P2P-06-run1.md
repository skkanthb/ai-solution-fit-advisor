# P2P-06: Claude Sonnet 5 (high), run 1

- Run: 2026-09-27 on LMArena, separate fresh chat per run

## Prompt

```
I'm an enterprise architect scoping an AI solution for this ERP / supply chain use case:

Procurement policy and contract Q&A: Buyers and requesters email procurement to ask which policy applies or what a contract says about terms, rebates, or renewal.

What AI approach and models would you recommend?
```

## Answer

# AI Solution Architecture: Procurement Policy & Contract Q&A

## Recommended Approach: RAG (Retrieval-Augmented Generation)

This use case is a textbook RAG application, **not** a fine-tuning problem. You need grounded, auditable answers from a corpus of contracts and policies that changes over time — fine-tuning would bake in stale facts and still hallucinate on specifics like dollar thresholds or renewal dates.

---

## Architecture Components

### 1. Ingestion & Document Processing
- **Sources:** Contract repository (CLM system if you have one — Icertis, SAP Ariba Contracts, Coupa CLM), policy documents (SharePoint, Confluence), rebate schedules, T&Cs, SOWs
- **Parsing:** Use layout-aware extraction (not naive text dump) — contracts have clauses, tables, nested terms, amendments
  - Tools: Azure Document Intelligence, AWS Textract, or open-source `unstructured.io` / `Docling`
- **Chunking strategy:** Semantic/clause-level chunking, not fixed-size — preserve clause boundaries (e.g., "Renewal," "Rebate Tiers," "Payment Terms") with metadata (contract ID, supplier, effective dates, version)
- **Critical:** Track amendments/supersessions — you need effective-dating logic so the system doesn't cite an expired clause

### 2. Metadata & Structure
Tag every chunk with:
- Contract/Policy ID, supplier name, category, effective date, expiration date, region, owner
- This enables **filtered retrieval** (e.g., "only search contracts where supplier = X and status = active")

### 3. Retrieval Layer
- **Hybrid search**: dense vector embeddings + BM25/keyword (contracts have exact terms — SKUs, clause numbers, $ amounts — that embeddings alone miss)
- **Reranking**: cross-encoder rerank (e.g., Cohere Rerank, BGE-reranker) on top-k candidates before passing to LLM
- **Vector store:** Azure AI Search, Pinecone, Elasticsearch/OpenSearch (if already in your stack), or pgvector if you want to stay in existing Postgres

### 4. Generation Layer (LLM)
- **Primary recommendation:** GPT-4o or GPT-4.1 (Azure OpenAI if enterprise/data residency matters) — strong at structured document reasoning and citation formatting
- **Alternatives:**
  - **Claude 3.5/3.7 Sonnet** — excellent at long-context contract reasoning, strong at following strict "don't answer if not in context" instructions, good for handling long full-contract context windows
  - **Azure/AWS-hosted open models** (Llama 3.1/3.3 70B, Mistral Large) if data sovereignty or cost at scale is a driver
- **Embedding model:** `text-embedding-3-large` (OpenAI) or `Cohere embed-v3` — Cohere handles mixed legal/business text well

### 5. Orchestration
- Framework: LangChain, LlamaIndex, or Semantic Kernel (good fit if this integrates with SAP/Microsoft stack)
- **Agentic layer** for query routing:
  - Classify intent first: policy question vs. contract-specific question vs. rebate calculation vs. renewal date lookup
  - Route to different retrieval strategies (structured lookup for dates/values vs. semantic search for "what does this clause mean")

---

## Critical Design Requirements (Given the Domain)

**1. Citation & traceability is non-negotiable**
Every answer must cite the specific contract, clause number, and version. Procurement/legal will not trust ungrounded answers. Enforce this via prompt structure + post-generation validation that citations exist in retrieved context.

**2. Confidence & abstention**
System must say "I don't know" or escalate to a human when confidence is low or documents conflict (e.g., regional policy vs. global policy). Build explicit guardrails against fabricating clause numbers or dollar figures.

**3. Access control at retrieval time**
Contracts have confidentiality tiers — retrieval must respect the requester's entitlements (row-level security in vector store or metadata filtering tied to user role/AD group).

**4. Conflict resolution logic**
When multiple policies could apply (regional vs. global, old vs. amended), you need explicit precedence rules encoded in metadata/retrieval, not left to the LLM to guess.

**5. Numeric accuracy**
Rebate calculations and tiered pricing are error-prone for LLMs. Consider extracting structured terms (rebate tiers, thresholds) into a database during ingestion, and have the LLM query that structured data for calculations rather than reasoning over prose.

---

## Suggested Phased Delivery

| Phase | Scope |
|---|---|
| **Pilot** | Single category (e.g., top 20 supplier contracts + core policies), manual QA loop, internal users only |
| **V1** | Expand corpus, add citation UI, integrate with email/Teams as intake channel, add human-in-loop escalation |
| **V2** | Structured term extraction for rebates/renewals, proactive alerts (e.g., "contract X renews in 30 days"), integration with CLM/ERP for live data |

---

## Governance
- Log every Q&A pair for audit and continuous improvement
- Periodic re-indexing when contracts are amended
- Human review sampling (especially for financial terms) before full trust is established
- Clear disclaimer: outputs are decision support, not legal advice

Would you like me to sketch the reference architecture diagram, or go deeper on any layer (e.g., the structured rebate-extraction pipeline, or vendor comparison for the LLM choice)?
