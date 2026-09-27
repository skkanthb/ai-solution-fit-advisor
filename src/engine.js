/*
 * AI Solution Fit Advisor — decision engine.
 * Pure functions, no dependencies. Runs in the browser and in Node.
 * The engine is deterministic: same profile in, same recommendation out.
 */
(function (root) {
  "use strict";

  var STRUCTURED = ["structured", "timeseries"];
  function isStructured(p) { return STRUCTURED.indexOf(p.modality) !== -1; }

  // Ordered rulebook. First match wins. Order encodes precedence:
  // explicit logic beats learned logic; problem shape beats input format.
  var RULES = [
    { id: "R01", pattern: "HUMAN", when: function (p) { return p.task === "forecast" && p.labels === "none"; },
      label: "Forecast with no history",
      why: "There is no history to learn from. Start with planner judgment and a naive baseline, and start recording actuals." },
    { id: "R02", pattern: "TS", when: function (p) { return p.task === "forecast"; },
      label: "Forecast with history",
      why: "Predicting values over time from history is a forecasting problem. Use purpose-built forecasters benchmarked against a naive baseline." },
    { id: "R03", pattern: "OPT", when: function (p) { return p.task === "optimize" && p.constraints === "yes"; },
      label: "Choose a plan under hard constraints",
      why: "Choosing the best plan under hard constraints needs a solver that guarantees feasibility." },
    { id: "R04", pattern: "RULES", when: function (p) { return p.task === "optimize"; },
      label: "Choose a plan, no hard constraints",
      why: "Without binding constraints, ranking by a cost or value formula is usually enough." },
    { id: "R05", pattern: "RULES",
      when: function (p) { return p.logic === "full" && (isStructured(p) || p.task === "act" || p.task === "generate"); },
      label: "Logic fully explicit",
      why: "The logic can already be written down. If you can write the rule, write the rule. For actions, that means a fixed workflow; for text, a template." },
    { id: "R06", pattern: "HUMAN", when: function (p) { return p.task === "decide" && p.errorCost === "high"; },
      label: "Judgment call with high error cost",
      why: "The decision is not fully explicit and a wrong call is costly. Keep the decision with a person and automate the preparation." },
    { id: "R07", pattern: "TABML", when: function (p) { return p.task === "decide" && isStructured(p) && p.labels === "yes"; },
      label: "Judgment call, structured data, recorded outcomes",
      why: "Past decisions on structured data can train a model that imitates them, with reason codes." },
    { id: "R08", pattern: "HUMAN", when: function (p) { return p.task === "decide"; },
      label: "Judgment call, no basis to automate",
      why: "There is neither explicit logic nor enough recorded outcomes to automate this decision yet." },
    { id: "R09", pattern: "FUZZY", when: function (p) { return p.task === "match"; },
      label: "Link records across sources",
      why: "Linking records is a scoring problem over keys and tolerances: exact rules first, similarity for the rest." },
    { id: "R10", pattern: "TABML", when: function (p) { return p.task === "anomaly" && p.labels === "yes"; },
      label: "Unusual records with confirmed past cases",
      why: "Confirmed past cases make this a supervised classification problem." },
    { id: "R11", pattern: "ANOM", when: function (p) { return p.task === "anomaly"; },
      label: "Unusual records, no confirmed cases",
      why: "Without confirmed past cases, score unusualness statistically and build labels from reviewer verdicts." },
    { id: "R12", pattern: "TABML",
      when: function (p) { return (p.task === "predict" || p.task === "classify") && isStructured(p) && p.labels !== "none"; },
      label: "Score or classify structured records with history",
      why: "Structured records with historical outcomes are the home ground of gradient-boosted models." },
    { id: "R13", pattern: "HUMAN",
      when: function (p) { return (p.task === "predict" || p.task === "classify") && isStructured(p); },
      label: "Score structured records, no history",
      why: "No outcomes to learn from. Use simple heuristics, let people decide, and record outcomes so a model becomes possible." },
    { id: "R14", pattern: "SMALL",
      when: function (p) { return (p.task === "predict" || p.task === "classify") && p.labels === "yes"; },
      label: "Classify text with many labeled examples",
      why: "Labeled text lets a small classifier do the job consistently and cheaply." },
    { id: "R15", pattern: "LLMCLS", when: function (p) { return p.task === "predict" || p.task === "classify"; },
      label: "Classify text with few or no labels",
      why: "Too few labels to train a classifier. A small LLM can classify few-shot while reviewed outputs build the label set." },
    { id: "R16", pattern: "DOCAI", when: function (p) { return p.task === "extract" && p.modality === "documents" && p.variability !== "high"; },
      label: "Extract from documents with known layouts",
      why: "Known document types with a limited set of layouts are well served by pretrained document models with field confidence." },
    { id: "R17", pattern: "LLMEXT", when: function (p) { return p.task === "extract"; },
      label: "Extract from highly varied documents or free text",
      why: "Layouts vary too much, or the source is free text. A vision-capable LLM with a fixed output schema covers the variety." },
    { id: "R18", pattern: "RAG", when: function (p) { return p.task === "answer"; },
      label: "Answer questions from documents",
      why: "Answers must come from your documents. Retrieve first, then generate with citations." },
    { id: "R19", pattern: "LLMGEN", when: function (p) { return p.task === "generate"; },
      label: "Draft text that varies by case",
      why: "Drafting varied text is what LLMs are good at. Facts come from upstream systems; a person reviews." },
    { id: "R20", pattern: "AGENTRO", when: function (p) { return p.task === "act" && p.writes === "none"; },
      label: "Variable multi-step lookups, no writes",
      why: "The steps vary by case, so a tool-using LLM plans them. It needs only read access." },
    { id: "R21", pattern: "AGENTACT", when: function (p) { return p.task === "act"; },
      label: "Variable multi-step actions with writes",
      why: "The steps vary by case and change systems of record. Use a bounded agent with approval on every write." }
  ];
  var FALLBACK = { id: "R99", pattern: "HUMAN", label: "No rule matched", why: "The profile did not match a known pattern. Keep a person in the loop and refine the step definition." };

  var AUTONOMY = [
    { level: 0, name: "No automation", text: "People do the work." },
    { level: 1, name: "Informs", text: "The system surfaces scores, flags, or context. A person decides and acts." },
    { level: 2, name: "Recommends", text: "The system proposes a specific result. A person approves every item." },
    { level: 3, name: "Conditional", text: "High-confidence, low-value items flow automatically. Everything else goes to a person." },
    { level: 4, name: "Supervised", text: "Acts on all items within limits. People review exceptions and samples." },
    { level: 5, name: "Autonomous", text: "Deterministic and fully automated, with monitoring." }
  ];

  function indexBy(list, key) { var o = {}; list.forEach(function (x) { o[x[key]] = x; }); return o; }

  function classify(profile) {
    for (var i = 0; i < RULES.length; i++) { if (RULES[i].when(profile)) return RULES[i]; }
    return FALLBACK;
  }

  function autonomy(pattern, p) {
    var base = pattern.baseAutonomy;
    var caps = [];
    var deterministic = pattern.id === "RULES";
    if (p.writes === "irreversible") caps.push({ max: deterministic ? 4 : 2, reason: "Writes that are hard to reverse need a person to approve each one." });
    if (!deterministic && p.errorCost === "high") caps.push({ max: 3, reason: "High error cost: only high-confidence items may flow without review." });
    if (pattern.usesLLM && p.explain === "required") caps.push({ max: 3, reason: "LLM outputs cannot be fully explained, so auditable results need review." });
    if (pattern.usesLLM && p.writes !== "none" && p.errorCost !== "low") caps.push({ max: 3, reason: "LLM output that changes a record needs a checkpoint when errors cost more than rework." });
    var level = caps.reduce(function (m, c) { return Math.min(m, c.max); }, base);
    var binding = caps.filter(function (c) { return c.max === level && level < base; });
    return { level: level, base: base, name: AUTONOMY[level].name, text: AUTONOMY[level].text, caps: binding };
  }

  function controls(pattern, p, level) {
    var c = [];
    var fam = pattern.family;
    c.push("Audit log of inputs, output, and model or rule version for every decision");
    if (p.writes !== "none" && level <= 2) c.push("Human approval before anything is posted or sent");
    if (p.writes !== "none" && level >= 3) c.push("Value and volume limits on automatic actions, with a kill switch");
    if (["TABML", "SMALL", "DOCAI", "LLMEXT", "FUZZY", "LLMCLS"].indexOf(pattern.id) !== -1) c.push("Confidence threshold: items below it route to a person");
    if (p.explain === "required") {
      var how = { TABML: "SHAP reason codes per prediction", RULES: "the rule ID that fired", FUZZY: "the fields and scores behind each match", RAG: "citations to the source clause" }[pattern.id] || "a recorded rationale";
      c.push("Explainability: store " + how);
    }
    if (fam === "ml" || pattern.id === "DOCAI") c.push("Monitor accuracy and data drift; set a retraining cadence");
    if (pattern.usesLLM) c.push("Version prompts and models; rerun the evaluation set before any model change");
    if (pattern.usesLLM && ["documents", "text", "mixed"].indexOf(p.modality) !== -1) c.push("Treat document and email content as untrusted input (prompt-injection defense)");
    if (pattern.id === "LLMEXT") c.push("Validate extracted values against master data before use");
    if (pattern.id === "RAG") c.push("Permission-aware retrieval: users see only documents they can already access");
    if (pattern.id === "RAG") c.push("Answer 'not covered' when sources do not contain the answer");
    if (fam === "agentic") c.push("Least-privilege tools; step and cost limits per task");
    if (pattern.id === "AGENTACT") c.push("Separate read and write tools; idempotent writes; segregation of duties");
    if (p.sensitivity === "regulated") c.push("Regulated data: redact or keep in-region; contract for no training and minimal retention");
    if (p.errorCost === "high" && level >= 3) c.push("Periodic sample audit of automatic decisions");
    return c;
  }

  function llmTier(id, p) {
    if (id === "LLMCLS") return "small";
    if (id === "LLMGEN") return p.errorCost === "high" ? "mid" : "small";
    if (id === "LLMEXT") return p.volume === "high" && p.variability !== "high" ? "small" : "mid";
    if (id === "RAG") return p.volume === "high" && p.errorCost === "low" ? "small" : "mid";
    return "mid";
  }

  function candidates(pattern, p, registry) {
    var out = [];
    var regulated = p.sensitivity === "regulated";
    var tier = null;
    if (pattern.usesLLM) {
      tier = llmTier(pattern.id, p);
      var opts = registry.llmTiers[tier].options.slice();
      if (regulated) opts.sort(function (a, b) { return (a.kind === "self-hosted" ? 0 : 1) - (b.kind === "self-hosted" ? 0 : 1); });
      opts.forEach(function (o) {
        out.push({ name: o.name, kind: o.kind, note: o.kind === "api" && regulated ? "Only under an enterprise agreement with in-region processing and no training on your data." : (o.kind === "self-hosted" ? "Pick the current release; check the license." : "") });
      });
      if (pattern.id === "AGENTACT") out.push({ name: registry.llmTiers.frontier.label + " for long multi-step tasks", kind: "api", note: registry.llmTiers.frontier.options.map(function (o) { return o.name; }).join(", ") });
    } else {
      (registry.patterns[pattern.id] || []).forEach(function (o) {
        out.push({ name: o.name, kind: o.kind, note: o.note + (o.kind === "cloud" && regulated ? " Use an in-region deployment." : "") });
      });
    }
    (registry.supporting[pattern.id] || []).forEach(function (o) { out.push({ name: o.name, kind: o.kind, note: o.note, supporting: true }); });
    return { tier: tier ? registry.llmTiers[tier].label : null, items: out };
  }

  function notes(pattern, p) {
    var n = [];
    if (p.logic === "partial" && ["RULES", "HUMAN"].indexOf(pattern.id) === -1) n.push("Put the explicit rules in front. They settle the cases they can; this pattern handles the rest.");
    if (p.labels === "some" && (pattern.family === "ml")) n.push("Labels are sparse. Start with a simple model and invest in label quality before tuning.");
    if (p.volume === "low" && pattern.family === "ml") n.push("Under 100 items a day, confirm the build and upkeep cost is justified against a person doing it.");
    if (pattern.usesLLM && p.volume === "high") n.push("At over 10,000 items a day, per-call cost matters. Measure it, and consider distilling to a smaller model.");
    if (pattern.usesLLM && p.latency === "interactive" && pattern.id !== "LLMCLS") n.push("Interactive latency: stream responses and cap the number of tool calls or retrieved passages.");
    return n;
  }

  function assess(profile, data) {
    var pats = indexBy(data.patterns, "id");
    var rule = classify(profile);
    var pattern = pats[rule.pattern];
    var auto = autonomy(pattern, profile);
    return {
      rule: { id: rule.id, label: rule.label, why: rule.why },
      pattern: pattern,
      autonomy: auto,
      controls: controls(pattern, profile, auto.level),
      candidates: candidates(pattern, profile, data.registry),
      notes: notes(pattern, profile),
      whyNot: pattern.whyNot,
      evalPlan: pattern.eval
    };
  }

  function rulebook() {
    return RULES.concat([FALLBACK]).map(function (r) { return { id: r.id, pattern: r.pattern, label: r.label, why: r.why }; });
  }

  var api = { assess: assess, classify: classify, rulebook: rulebook, AUTONOMY: AUTONOMY };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SFAEngine = api;
})(this);
