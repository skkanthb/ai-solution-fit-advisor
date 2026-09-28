#!/usr/bin/env python3
"""Build self-contained pages from src/ and data/.

Outputs:
  index.html          full HTML document for GitHub Pages (committed)
  dist/artifact.html  body fragment for publishing as a claude.ai artifact (not committed)
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
read = lambda p: (ROOT / p).read_text(encoding="utf-8")

data = {
    "questions": json.loads(read("data/questions.json")),
    "patterns": json.loads(read("data/patterns.json")),
    "registry": json.loads(read("data/registry.json")),
    "useCases": json.loads(read("data/use-cases.json")),
}
data_js = "window.SFA_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + ";"

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700'
         '&family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">')
TITLE = "<title>AI Solution Fit Advisor</title>"
DESC = ('<meta name="description" content="Recommends the right AI approach, or no AI, for each step of '
        'an enterprise business process: rules, ML, optimization, document AI, LLMs, or agents.">')

head_inner = TITLE + "\n" + FONTS + "\n<style>\n" + read("src/styles.css") + "\n</style>"
scripts = ("<script>\n" + data_js + "\n</script>\n<script>\n" + read("src/engine.js") +
           "\n</script>\n<script>\n" + read("src/app.js") + "\n</script>")
body = read("src/body.html")

full = ("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
        + DESC + "\n" + head_inner + "\n</head>\n<body>\n" + body + "\n" + scripts + "\n</body>\n</html>\n")
(ROOT / "index.html").write_text(full, encoding="utf-8")

(ROOT / "dist").mkdir(exist_ok=True)
(ROOT / "dist" / "artifact.html").write_text(head_inner + "\n" + body + "\n" + scripts + "\n", encoding="utf-8")
print("built index.html and dist/artifact.html")
