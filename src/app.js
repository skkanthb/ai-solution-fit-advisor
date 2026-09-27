(function () {
  "use strict";
  var D = window.SFA_DATA;
  var E = window.SFAEngine;
  var data = { patterns: D.patterns, registry: D.registry };
  var PAT = {}; D.patterns.forEach(function (p) { PAT[p.id] = p; });
  var Q = {}; D.questions.forEach(function (q) { Q[q.id] = q; });
  var FAMILY = { deterministic: "No AI", ml: "Machine learning", optimization: "Optimization", document: "Document AI", llm: "LLM", agentic: "Agentic", human: "Human" };

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(sel) { return document.querySelector(sel); }
  function famVars(f) { return "--c:var(--f-" + f + ");--cb:var(--f-bg-" + f + ")"; }
  function chip(p) { return '<span class="chip" style="' + famVars(p.family) + '">' + esc(p.name) + "</span>"; }
  function optLabel(qid, v) { var o = Q[qid].options.filter(function (x) { return x.v === v; })[0]; return o ? o.label : v; }
  function short(label) { return label.replace(/\s*\(.*\)\s*$/, ""); }
  function slug(id) { return id.toLowerCase(); }

  // ---------- Results rendering (shared by Library and Assess) ----------
  function renderResult(r) {
    var p = r.pattern, a = r.autonomy;
    var meter = "";
    for (var i = 0; i <= 5; i++) meter += '<span class="' + (i <= a.level ? "on" : (i <= a.base ? "cap" : "")) + '"></span>';
    var caps = a.caps.length ? '<ul class="caps">' + a.caps.map(function (c) { return "<li>Capped: " + esc(c.reason) + "</li>"; }).join("") + "</ul>" : "";
    var cands = r.candidates.items.length
      ? (r.candidates.tier ? '<p class="tier">Model tier: <b>' + esc(r.candidates.tier) + "</b></p>" : "") +
        '<div class="cands">' + r.candidates.items.map(function (c) {
          return '<div class="cand"><span class="n">' + esc(c.name) + '</span><span class="k">' + esc(c.supporting ? "supporting" : c.kind) + "</span>" + (c.note ? '<span class="note">' + esc(c.note) + "</span>" : "") + "</div>";
        }).join("") + "</div>" +
        '<p class="disclaimer" style="margin-top:6px">Registry as of ' + esc(D.registry.asOf) + ". " + esc(D.registry.disclaimer) + "</p>"
      : '<p class="disclaimer">No model to select. The work is in process design and recording decisions.</p>';
    return '<div class="rec">' +
      '<div class="rec-head">' + chip(p) +
        "<h3>" + esc(p.name) + "</h3>" +
        '<p class="summary">' + esc(p.summary) + "</p>" +
        '<p class="rule-fired"><code>' + esc(r.rule.id) + "</code>" + esc(r.rule.label) + ". " + esc(r.rule.why) + "</p>" +
      "</div>" +
      (r.notes.length ? '<div class="notes"><ul class="plain">' + r.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul></div>" : "") +
      '<div class="block"><h4>Autonomy</h4><div class="meter" aria-label="Autonomy level ' + a.level + ' of 5">' + meter + '</div>' +
        '<div class="meter-legend"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>' +
        '<p class="auto-text"><b>Level ' + a.level + ": " + esc(a.name) + ".</b> " + esc(a.text) + "</p>" + caps + "</div>" +
      '<div class="block"><h4>Candidates</h4>' + cands + "</div>" +
      '<div class="block"><h4>Required controls</h4><ul class="plain">' + r.controls.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></div>" +
      '<div class="block"><h4>Why not something else</h4><div class="whynot">' + r.whyNot.map(function (w) { return "<div><b>" + esc(w.alt) + ":</b> " + esc(w.text) + "</div>"; }).join("") + "</div></div>" +
      '<div class="block"><h4>Evaluation plan</h4><dl class="evalp"><dt>Measure</dt><dd>' + r.evalPlan.metrics.map(esc).join("<br>") + "</dd><dt>Baseline</dt><dd>" + esc(r.evalPlan.baseline) + "</dd><dt>Go-live gate</dt><dd>" + esc(r.evalPlan.gate) + "</dd></dl></div>" +
    "</div>";
  }

  function toMarkdown(title, profile, r) {
    var L = [];
    L.push("## " + title, "");
    L.push("**Recommended pattern:** " + r.pattern.name + " (" + FAMILY[r.pattern.family] + ")");
    L.push("**Rule:** " + r.rule.id + " " + r.rule.label + ". " + r.rule.why);
    L.push("**Autonomy:** Level " + r.autonomy.level + " (" + r.autonomy.name + "). " + r.autonomy.text, "");
    L.push("### Profile");
    D.questions.forEach(function (q) { L.push("- " + q.label + " " + short(optLabel(q.id, profile[q.id]))); });
    if (r.notes.length) { L.push("", "### Notes"); r.notes.forEach(function (n) { L.push("- " + n); }); }
    if (r.candidates.items.length) {
      L.push("", "### Candidates" + (r.candidates.tier ? " (" + r.candidates.tier + ")" : ""));
      r.candidates.items.forEach(function (c) { L.push("- " + c.name + (c.note ? ": " + c.note : "")); });
    }
    L.push("", "### Required controls"); r.controls.forEach(function (c) { L.push("- " + c); });
    L.push("", "### Why not something else"); r.whyNot.forEach(function (w) { L.push("- **" + w.alt + ":** " + w.text); });
    L.push("", "### Evaluation plan", "- Measure: " + r.evalPlan.metrics.join("; "), "- Baseline: " + r.evalPlan.baseline, "- Go-live gate: " + r.evalPlan.gate);
    L.push("", "_Generated by AI Solution Fit Advisor. Registry as of " + D.registry.asOf + "._");
    return L.join("\n");
  }

  var toastTimer;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }
  function copy(text, btn) {
    var done = function () { toast("Copied as Markdown"); };
    try {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); });
    } catch (e) { fallbackCopy(text); }
  }
  function fallbackCopy(text) {
    var ta = $("#copy-fallback"); ta.hidden = false; ta.value = text; ta.focus(); ta.select();
    toast("Select all and copy the text below");
  }

  // ---------- Stats ----------
  var allTasks = [];
  D.useCases.forEach(function (uc) { uc.tasks.forEach(function (t) { allTasks.push({ uc: uc, t: t, r: E.assess(t.profile, data) }); }); });
  var llmCount = allTasks.filter(function (x) { return x.r.pattern.usesLLM; }).length;
  var noAiCount = allTasks.filter(function (x) { return x.r.pattern.family === "deterministic"; }).length;
  $("#stat-uc").textContent = D.useCases.length;
  $("#stat-steps").textContent = allTasks.length;
  $("#stat-llm").textContent = llmCount;
  $("#stat-noai").textContent = noAiCount;

  // ---------- Library ----------
  var current = { uc: D.useCases[0], task: 0 };
  function renderNav() {
    var groups = {};
    D.useCases.forEach(function (uc) { (groups[uc.process] = groups[uc.process] || []).push(uc); });
    var html = "", sel = "";
    Object.keys(groups).forEach(function (g) {
      html += '<div class="uc-group"><h3>' + esc(g) + "</h3>";
      sel += '<optgroup label="' + esc(g) + '">';
      groups[g].forEach(function (uc) {
        var dots = uc.tasks.map(function (t) { var f = E.assess(t.profile, data).pattern.family; return '<span class="dot" style="--c:var(--f-' + f + ')"></span>'; }).join("");
        html += '<button class="uc-item" data-uc="' + esc(uc.id) + '"' + (uc === current.uc ? ' aria-current="true"' : "") + "><span>" + esc(uc.title) + '</span><span class="dots" aria-hidden="true">' + dots + "</span></button>";
        sel += '<option value="' + esc(uc.id) + '"' + (uc === current.uc ? " selected" : "") + ">" + esc(uc.title) + "</option>";
      });
      html += "</div>"; sel += "</optgroup>";
    });
    $("#uc-groups").innerHTML = html;
    $("#uc-select").innerHTML = sel;
  }

  function renderUseCase() {
    var uc = current.uc;
    var flow = uc.tasks.map(function (t, i) {
      var r = E.assess(t.profile, data);
      return '<button class="step" data-task="' + i + '" aria-pressed="' + (i === current.task) + '">' +
        '<span class="sid">' + esc(t.id) + "</span>" +
        '<span class="sname">' + esc(t.name) + "</span>" +
        "<span>" + chip(r.pattern) + "</span>" +
        '<span class="llm-flag' + (r.pattern.usesLLM ? " yes" : "") + '">' + (r.pattern.usesLLM ? "Uses an LLM" : "No LLM") + "</span>" +
      "</button>";
    }).join("");
    var t = uc.tasks[current.task];
    var r = E.assess(t.profile, data);
    var dl = D.questions.map(function (q) { return "<dt>" + esc(q.label.replace(/\?$/, "")) + "</dt><dd>" + esc(short(optLabel(q.id, t.profile[q.id]))) + "</dd>"; }).join("");
    $("#uc-detail").innerHTML =
      '<div class="uc-head"><span class="eyebrow">' + esc(uc.id) + " · " + esc(uc.process) + "</span>" +
        "<h2>" + esc(uc.title) + "</h2>" +
        '<p class="problem">' + esc(uc.problem) + "</p>" +
        '<div class="kpis">' + uc.kpis.map(function (k) { return '<span class="kpi">' + esc(k) + "</span>"; }).join("") + "</div>" +
        '<p class="native"><b>Check native first.</b> ' + esc(uc.nativeFirst) + "</p>" +
      "</div>" +
      '<p class="section-label">Steps, each with its own pattern</p>' +
      '<div class="flow" role="group" aria-label="Steps">' + flow + "</div>" +
      '<div class="result">' +
        '<div class="card profile"><div class="block"><h4>' + esc(t.id) + " profile</h4><dl>" + dl + "</dl></div>" +
          '<div class="curator"><b>Practitioner note</b>' + esc(t.note) + "</div>" +
          '<div class="btn-row"><button class="btn primary" id="btn-edit">Change answers</button><button class="btn" id="btn-copy-lib">Copy as Markdown</button></div>' +
        "</div>" +
        '<div class="card">' + renderResult(r) + "</div>" +
      "</div>";
    document.querySelectorAll(".step").forEach(function (b) {
      b.addEventListener("click", function () { current.task = +b.dataset.task; renderUseCase(); });
    });
    $("#btn-edit").addEventListener("click", function () { loadIntoAssess(t.profile, uc.title + " / " + t.name); showView("assess"); });
    $("#btn-copy-lib").addEventListener("click", function () { copy(toMarkdown(uc.title + ": " + t.name, t.profile, r)); });
  }

  function selectUseCase(id) {
    var uc = D.useCases.filter(function (u) { return u.id === id; })[0];
    if (!uc) return;
    current = { uc: uc, task: 0 };
    renderNav(); renderUseCase();
    setHash(slug(id));
  }
  $("#uc-groups").addEventListener("click", function (e) { var b = e.target.closest(".uc-item"); if (b) selectUseCase(b.dataset.uc); });
  $("#uc-select").addEventListener("change", function (e) { selectUseCase(e.target.value); });

  // ---------- Assess ----------
  var baseProfile = null;
  function renderForm() {
    $("#assess-fields").innerHTML = D.questions.map(function (q) {
      return '<div class="field" id="f-' + q.id + '"><label for="q-' + q.id + '">' + esc(q.label) + "</label>" +
        (q.help ? '<span class="help">' + esc(q.help) + "</span>" : "") +
        '<select id="q-' + q.id + '" name="' + q.id + '">' + q.options.map(function (o) { return '<option value="' + esc(o.v) + '">' + esc(o.label) + "</option>"; }).join("") + "</select></div>";
    }).join("");
    $("#assess-fields").addEventListener("change", runAssess);
  }
  function readForm() { var p = {}; D.questions.forEach(function (q) { p[q.id] = $("#q-" + q.id).value; }); return p; }
  function loadIntoAssess(profile, from) {
    baseProfile = Object.assign({}, profile);
    D.questions.forEach(function (q) { $("#q-" + q.id).value = profile[q.id]; });
    $("#loaded-from").textContent = from ? "Loaded from: " + from + ". Changed answers are highlighted." : "";
    runAssess();
  }
  var lastAssess = null;
  function runAssess() {
    var p = readForm();
    D.questions.forEach(function (q) { $("#f-" + q.id).classList.toggle("changed", !!baseProfile && baseProfile[q.id] !== p[q.id]); });
    var r = E.assess(p, data);
    lastAssess = { p: p, r: r };
    $("#assess-result").innerHTML = renderResult(r);
  }
  $("#btn-copy-assess").addEventListener("click", function () { if (lastAssess) copy(toMarkdown("Assessment", lastAssess.p, lastAssess.r)); });
  $("#btn-reset").addEventListener("click", function () { var s = D.useCases[1].tasks[1]; loadIntoAssess(s.profile, D.useCases[1].title + " / " + s.name); });

  // ---------- Rulebook ----------
  function renderRulebook() {
    $("#rules-body").innerHTML = E.rulebook().map(function (r) {
      return "<tr><td><code>" + esc(r.id) + "</code></td><td>" + esc(r.label) + "</td><td>" + chip(PAT[r.pattern]) + "</td><td>" + esc(r.why) + "</td></tr>";
    }).join("");
    $("#auto-body").innerHTML = E.AUTONOMY.map(function (a) { return "<tr><td><code>" + a.level + "</code></td><td>" + esc(a.name) + "</td><td>" + esc(a.text) + "</td></tr>"; }).join("");
    $("#pat-body").innerHTML = D.patterns.map(function (p) {
      var n = allTasks.filter(function (x) { return x.r.pattern.id === p.id; }).length;
      return "<tr><td>" + chip(p) + "</td><td>" + (p.usesLLM ? "Yes" : "No") + "</td><td>" + esc(p.summary) + '</td><td style="font-variant-numeric:tabular-nums">' + n + "</td></tr>";
    }).join("");
  }

  // ---------- Tabs and deep links ----------
  var VIEWS = ["library", "assess", "rules", "about"];
  function showView(v) {
    VIEWS.forEach(function (x) {
      $("#view-" + x).hidden = x !== v;
      $("#tab-" + x).setAttribute("aria-selected", x === v ? "true" : "false");
    });
    setHash(v === "library" ? slug(current.uc.id) : v);
    window.scrollTo(0, 0);
  }
  function setHash(h) { try { history.replaceState(null, "", "#" + h); } catch (e) { /* ignore */ } }
  VIEWS.forEach(function (v) { $("#tab-" + v).addEventListener("click", function () { showView(v); }); });

  renderNav(); renderForm(); renderRulebook();
  var sample = D.useCases[1].tasks[1];
  loadIntoAssess(sample.profile, D.useCases[1].title + " / " + sample.name);
  var h = (location.hash || "").slice(1).toLowerCase();
  var hit = D.useCases.filter(function (u) { return slug(u.id) === h; })[0];
  if (hit) current = { uc: hit, task: 0 };
  renderNav(); renderUseCase();
  if (VIEWS.indexOf(h) !== -1 && h !== "library") showView(h);
})();
