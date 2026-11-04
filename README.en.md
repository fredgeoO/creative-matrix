<p align="center">
  <img src="logo.jpeg" alt="Gezhi Matrix (格致矩阵) logo" width="360">
</p>

[中文](README.zh.md) · [English](README.en.md) · [日本語](README.ja.md)

# Gezhi Matrix (格致矩阵)

> *gewu zhizhi* (格物致知, "investigate things to extend knowledge"). Arrange any two dimensions into a grid, and at every intersection "investigate each thing to exhaust its principle" (即物穷理), generating one deduction per cell.

Lay a row axis and a column axis out as a 2-D grid — the two axes can be anything: mental models, scenario constraints, characters, timelines, hexagrams… Click any intersection and the current model generates a deduction report, saved into the workspace at `data/matrix.json`.

The technical package name is still `@local/creative-matrix`, the tool id is still `creative_matrix`, and the route is still `/creative-matrix/api`; only the display name changed — no migration or reinstall needed.

## The Name

**Gezhi** (格致) is short for *gewu zhizhi* (格物致知, "investigate things to extend knowledge"). **Ge** (格) is a pun: it means both the individual cells of a matrix and the act of investigating/pursuing a thing to the bottom in *gewu*; **zhi** (致) means arriving at, and **zhi** (知) means knowledge. Together: investigate things cell by cell, and thereby arrive at knowledge.

This panel turns exactly that act into a table: the two axes can be anything — the row axis is **things** (mental models, concepts, everyday objects), the column axis is **contexts** (scenarios, constraints, situations); switch to another template and you get another pair of dimensions. Each intersection is one act of *jiwu qiongli* ("investigating each thing to exhaust its principle") — not gluing two words together, but letting one dimension deduce the consequences it must necessarily produce inside the other.

Its original name was "Creative Matrix" (创意矩阵). The rename is not rebranding: "creative" describes the output, "gezhi" describes the method; and what is genuinely scarce about this plugin is the latter.

One more detail worth recording. Zhu Xi read *gewu* as exhaustively investigating the principle of every thing in the world, cell by cell, outward; Wang Yangming actually went to investigate the bamboo in front of his pavilion — seven days of it, until he fell ill — and finally said "天下之物本无可格者，其格物之功只在身心上做" ("there are fundamentally no things under heaven to investigate; the work of investigation is done only on mind and body"). This matrix stands on Zhu Xi's side — it believes that arranging the world into cells and deducing them one by one can force out something real; but it also remembers Wang Yangming's challenge, which is why every cell must state "under what conditions this fails," and deep mode runs an extra independent red-team pass. The name carries its own warning: what comes out of the cells may be a beautiful deduction, not necessarily true knowledge.

## Methodology

### The four steps

1. **Set the axes** (立格): define the row axis first. Each row is a "thing" — a mental model, a mechanism, an everyday object. Rows must be concrete and deducible; don't write adjectives.
2. **Cross them** (交错): then define the column axis. Each column is a "context" — a scenario, a constraint, a situation. Columns must genuinely "push back" against those things.
3. **Exhaust the principle** (穷理): generate at each intersection. What you write is "mechanism → consequence": given this thing in this context, what must happen, and what nonlinear consequences grow out of it.
4. **Falsify** (验伪): every cell must end with one line on "under what conditions this fails"; for important cells, run a red-team pass in deep mode, specifically hunting for counterexamples.

### Why causal deduction, not word-pairing

If "apple × breakfast table" only ever produces "an apple sits on the breakfast table," that is pairing, not gezhi. Gezhi demands: treat the row axis as a causal law (apples oxidize, roll, become ritual), and let it necessarily produce consequences inside the column axis (the time pressure of breakfast, family relations, morning attention). The product should be a piece of reasoning that can be refuted — not a pretty association.

### What it does not do

- No divination promises. The I Ching template uses the 64 hexagrams purely as thinking tools and predicts no fortune.
- No "interdisciplinarity" as decoration. Every cell must answer: what judgment did this dimension actually change here?
- No pursuit of sudden "illumination" in a single cell. Coherence is seen only much later, looking back — one cell cannot give it to you.

## Icon

`icon.svg` is a 3×3 grid with the center cell lit: the grid is the method; the light is what happens when one cell has been exhausted.

## Sources

The name and the method come from these places — please re-check them together when editing any copy:

1. *Liji · Daxue* (Book of Rites · Great Learning): 「致知在格物。」 「物格而后知至。」 — *"The extension of knowledge lies in the investigation of things." / "Things being investigated, knowledge is extended."*
2. Zhu Xi, supplement to the Great Learning chapter of *Sishu zhangju jizhu* (Collected Commentaries on the Four Books): 「所谓致知在格物者，言欲致吾之知，在即物而穷其理也。」 — *"What is meant by 'the extension of knowledge lies in the investigation of things' is that if we wish to extend our knowledge, we must approach each thing and exhaust its principle."* And: 「至于用力之久，而一旦豁然贯通焉。」 — *"After long application of effort, there comes a moment when everything is suddenly penetrated and understood."*
3. Wang Yangming, *Chuanxi lu* (Instructions for Practical Living), lower volume (recorded by Huang Yifang): investigating the bamboo before the pavilion — 「天下之物本无可格者，其格物之功只在身心上做。」 — *"There are fundamentally no things under heaven to investigate; the work of investigation is done only on mind and body."*
4. In the late Qing, *gezhi* was used to translate "science"; Fu Lan雅 (Young J. Allen) edited *Gezhi huibian* (Scientific American–style Chinese miscellany, 1876, Shanghai); "gezhi studies" meant the natural sciences of the day.

> Item 4 only explains how the word *gezhi* came to be used in the modern era; it does not claim this plugin is equivalent to the scientific method.

## Features

- **Row axis / column axis**: by default everyday concepts like apple, water, shadow × breakfast table, rainy day, playground. The header shows each axis item's title and blurb; click a title to rename it, click the blurb to edit it — blurbs also feed into the prompt. Adding and deleting axes also happens in the header.
- **Three views**: below the page header are three tabs — Templates / Matrix / Prompt. The default tab is Templates; after you pick one and load it, the panel jumps to the Matrix automatically. In the Matrix tab you can edit the theme, axis names, axis blurbs, and add/remove axes; templates and prompts no longer open as modals — switching tabs gives you a full-page workspace. Only the current tab is mounted, and unsaved drafts are discarded when you switch away.
- **Header controls**, left to right: a **Model** dropdown (lists every provider / model DSH can reach, including local NInfer and Strata; each matrix remembers its own model — choosing "Follow default model" returns to DSH's default selection), a **Concurrency** dropdown (0 = all at once, or 1/2/3/4/6/8/12), a **Save template** button, **Refresh**, and a ⋯ menu (export Markdown; a "Batch generate…" dialog, which likewise offers a checkbox for generating only empty cells, checked by default).
- **Theme in the top-left corner**: the top-left cell of the grid shows this matrix's theme; click it to edit in place (Enter / blur saves, Esc cancels). Below the theme sit an "Include generated cells" checkbox and a whole-matrix "Generate all" button: solid brand color, by default filling only empty cells; once checked, the button becomes "Regenerate everything", redoing every cell and overwriting existing content. While a batch runs, the same button shows "Generating x/y · Stop".
- **Each axis carries its own generate button**: every row/column header has a "▷ Generate" button and an "All" checkbox; by default only empty cells on that axis are generated, while checking "All" regenerates the whole axis. The neighboring "×" deletes the axis after two clicks to confirm (at least 1 row and 1 column must remain).
- **Grid size is always adjustable**: "+ Add column" in the rightmost header cell and "+ Add row" at the bottom of the table add axes directly; deleting any rows/columns immediately resizes the matrix — 1×1 is the minimum.
- **Prompts are customizable**: the Prompt tab edits two templates separately — the **system prompt** and the **user message template** — and **opening it shows the full text currently in effect** (if never modified, that's the built-in default). Both accept placeholders such as `{纵标题}` / `{row}`, `{横标题}` / `{col}`, `{主题}` / `{theme}`, substituted per current cell before each model call; the right side lists every placeholder, its meaning and an example value, and live-previews the actual system / user messages being sent. Saving without touching them = keep following the built-in default. Both prompts are saved with the matrix and travel with templates too.
- **Templates**: 7 built-ins — Small Ideas Around You, Future Forecasting, Latticework Theory, Story Craft, Life Planning, I Ching Hexagrams, Zen Principles; each ships with a description and usage notes, and **each carries its own one-line generation prompt** (a uniform phrasing: "…write this passage directly, no preamble."; loading a template swaps the prompt in).
- **Generate / rewrite templates from a prompt**: the Templates tab has two sub-tabs, "Load templates" and "Generate from prompt". In "Generate from prompt", describe the matrix you want in one sentence; the model produces a draft (two axes + theme + prompts), and after confirmation you save it as a preset. The detail page of a "Mine" preset offers "Modify with a prompt": write what to change and it rewrites that file in place. On the agent side this maps to `creative_matrix(action:'template', idea, save?, file?, refineFile?)`.
- **Save template**: the header's "Save template" writes the current row axis / column axis / theme / prompts into `presets/*.md`; the dialog lets you either **overwrite the current template** (user templates only) or **save as a new template**. The file is plain Markdown — hand-editable, git-friendly. Templates store only titles, axes, and prompts — never generated cells.
- **Delete template**: select one of your own templates in the Templates tab; its detail page has a red "Delete template" button: the first click turns it into "Confirm delete", the second actually deletes. Built-in templates are read-only — the button is disabled with an explanation. Deletion removes only `presets/*.md`; the current matrix and generated cells are untouched, and if the deleted template was the bound one, the binding is cleared too.
- **Batch generation**: the top-left "Generate all" runs the entire matrix; single rows/columns use each axis's own generate button. All batch buttons fill only empty cells by default — checking "Include generated cells / All" is what redoes existing content. Default is all-at-once (fully parallel); the header "Concurrency" dropdown can limit it to 1/2/3/4/6/8/12, batches can be stopped at any time, and a progress bar plus failure count appear above the matrix.
- **Cells**: treat the row axis as a causal law and deduce the nonlinear consequences it must produce inside the column-axis scenario; end with one line on "under what conditions this fails".
- **Deep review** (深度审阅): after the draft finishes, run an extra independent red-team pass that appends an "Independent red-team review".
- **Agent tool**: `creative_matrix` — read the matrix, generate/write cells, and switch models from any session.
- **Autosave**: every generation/edit writes back to `data/matrix.json`; if the write fails, a not-persisted warning appears above the matrix.

## Structure

| File | Purpose |
|---|---|
| `index.js` | Host entry: registers the `creative_matrix` tool and the `/creative-matrix/api` route |
| `lib/core.js` | Runtime: matrix read/write, generation queue, single-flight, SSE, disk writes, model listing, preset read/write |
| `lib/matrix.js` | Pure logic: validation/normalization, ids, axis diffing, summaries, template-binding fields, export |
| `lib/presets.js` | Frontmatter parsing/serialization for Markdown presets, filename sanitizing, model reply → template draft (`parseTemplateReply`) |
| `lib/prompt.js` | System prompt / user prompt / red-team prompt / template drafting & rewriting prompts |
| `lib/seed.js` | The 6×5 everyday-concept example shown on first open |
| `lib/sse.js` | SSE frame encoding |
| `templates/*.md` | 7 built-in templates (read-only) |
| `client.js` | Client entry + data layer: store, SSE, Host API actions, sidebar icon and `main` panel registration; embeds both zh/en UI strings |
| `client.ui.js` | The client UI half: three-tab workspace (Templates / Matrix / Prompt), save-template dialog, batch-generate modal, cell drawer, Markdown rendering and panel CSS. Lazily loaded by `client.js` via `require.async('./client.ui.js')` (ModuleLoader chunk format) |
| `cordis.patch.yml` | Plugin line and configuration |
| `locale/{en,zh}.json` | Title/description for the plugin management page |
| `test/*.test.mjs` | `node --test` unit tests (run files directly, no subprocess) |

Data is written by default to:

```
<baseDir>/data/matrix.json       # current matrix and generated results
<baseDir>/presets/*.md           # axis presets saved by the user
```

`baseDir` defaults to the `polymath_matrix` workspace in the patch. The matrix file is plain JSON — readable directly, git-friendly, and readable by the agent's fs tools. `reset` renames the old file to `matrix.json.bak-<ts>`; it never silently deletes.

## Data Model

```jsonc
{
  "version": 1,
  "title": "格致矩阵",                     // "Gezhi Matrix"
  "theme": "体现身边事物的组合变化。",        // "Reflect the combinatorial changes of everyday things."
  "prompt": "结合纵横轴，用少于 150 字说清这个模型在这个场景里逼出了什么。",   // empty string = follow built-in default system prompt
  "userPrompt": "纵轴（模型）：{纵标题}（{纵提示}）\n横轴（场景）：{横标题}（{横提示}）\n主题：{主题}", // empty = built-in default user message template
  "model": { "provider": "strata", "model": "qwen3.8-flash-next-iq3_s" },  // may be null = follow default
  "preset": { "file": "gezhimatrix.md", "title": "格致矩阵", "source": "user" },  // bound template; null = unbound
  "rows": [{ "id": "r-ab12cd34", "name": "苹果", "hint": "一种普通水果……" }],
  "cols": [{ "id": "c-ef56gh78", "name": "早餐桌", "hint": "每天早上都会发生的小场景" }],
  "cells": {
    "r-ab12cd34:c-ef56gh78": {
      "markdown": "纯阳之象，象征天道刚健、自强不息；放到资源少的局面里，先立方向再补执行。",
      "takeaway": "纯阳之象，象征天道刚健、自强不息；",   // first sentence of the body, truncated at punctuation
      "mode": "fast",              // fast | deep | manual
      "hint": "",
      "model": { "provider": "deepseek-official", "model": "deepseek-flash" },
      "usage": { "inputTokens": 1200, "outputTokens": 900 },
      "edited": false,
      "updatedAt": 1760000000000
    }
  },
  "updatedAt": 1760000000000
}
```

Limits: rows and columns 1–12 each; name ≤ 80 characters, hint ≤ 300, theme ≤ 500, prompt / userPrompt ≤ 4000; a single cell's markdown ≤ 200 KB; file ≤ 8 MB; names must not repeat within one axis. On read the data is normalized; cells pointing at nonexistent axes are dropped and reported in `warning`.

Disk writes use `tmp + rename`, serialized within one runtime; after an external edit of the file, the next `state` call reloads it by mtime.

## Templates & Presets

Built-in templates live in `templates/`; user presets are written to `presets/`. Both are Markdown plus a small frontmatter block:

```md
---
title: 身边的小创意                    // "Small Ideas Around You"
description: 身边事物 × 日常场景，练习把两个普通概念撞出新点子。  // "Everyday things × everyday scenes: practice clashing two ordinary concepts into new ideas."
theme: 体现身边事物的组合变化。          // "Reflect the combinatorial changes of everyday things."
prompt: |
  用身边的东西想出不寻常的点子，每个想法都要能说出为什么。直接写这一段，不要开场白。
rows:
  - name: 苹果                        // "Apple"
    hint: 一种普通水果，能看、能吃、会变色、会腐烂
  - name: 水                         // "Water"
    hint: 会流动、会结冰、会蒸发，也会把东西泡软
cols:
  - name: 早餐桌                      // "Breakfast table"
    hint: 每天早上都会发生的小场景，时间很紧
  - name: 下雨天                      // "Rainy day"
    hint: 计划被打乱，但也能玩出新花样
---

# 怎么用                             // "How to use"

先挑一个普通东西，再挑一个普通场景……
```

- **What a template stores**: title, description, theme, row/column axis titles (with hints), the **system prompt**, and the **user message template**; it stores **no generated cell content whatsoever**.
- `prompt` is **one line, one sentence** — exactly the system prompt handed to the model at generation time; omit it and the built-in default sentence is used. It may contain placeholders such as `{纵标题}` / `{row}`, `{主题}` / `{theme}` (see the "Generation prompts" section); what gets saved remains a template. Multi-line also parses, but one sentence is more usable — length is controlled by the word count you write into that sentence. All 7 built-in templates use the uniform phrasing "…write this passage directly, no preamble."
- `userPrompt` holds the user message template (placeholders supported too; usually multi-line); omit it and the built-in default is used. When every placeholder on a line resolves to empty, the whole line is omitted, and empty "( )" pairs are stripped.
- Built-in templates are read-only; "Save template" only writes to `presets/`, or overwrites one of your own user templates.
- Loading a template replaces the current matrix's rows/cols/theme/prompt/userPrompt with the template's; old cells go away along with the old axes, and the panel asks for confirmation twice while showing how many cells will be deleted.
- **Save template**: header "Save template" → "Overwrite current template" (only when the matrix came from a user template) or "Save as new template". Writes the current theme, rows/cols, and both prompts; description and body remain editable together. Name collisions on new files automatically get `-2`, `-3` suffixes — never a silent overwrite.
- **Delete template**: Templates tab → select your own template → red "Delete template" in the detail → click "Confirm delete". Only `presets/*.md` is deleted; the current matrix and cells are unchanged. If the deleted template was the bound one, `preset` in `data/matrix.json` is cleared and the header falls back to "No template bound". Built-in templates are read-only — the delete button is disabled.
- `data/matrix.json` records `preset: {file,title,source}`, so after reopening the panel the app still knows which file "Overwrite" should write.
- The file's `description`, both prompts, and the body all show up on the template detail page.

### Generating and modifying templates from a prompt

When you don't want to hand-write frontmatter, let the model write it:

- **New**: Templates tab → "Generate from prompt" sub-tab → describe the matrix you want (theme, two axes, style) → "Draft". The model returns a draft (title, description, theme, 4–8 items per axis, one-line generation prompt), with a preview listed below; when satisfied, press "Save as preset" to write it into `presets/`, after which it loads like any other template.
- **Modify**: select a user preset under "Mine" → "Modify with a prompt" in its detail → write what to change (e.g. "swap the column axis for remote-work scenarios", "make the tone harsher") → "Draft" rewrites that file in place. The body description and filename stay unchanged; fields the model omits fall back to the current matrix or existing values, so custom prompts never get silently downgraded.
- **Built-in templates are read-only**: to change one, load it first, then use the header's "Save template → Save as new template" to store it as your own preset, and modify that with a prompt.
- Drafting/rewriting uses the model currently in effect for this matrix (switchable in the panel), with an output budget of about 1600 tokens per call.

Corresponding APIs: `presets.draft` (`{idea}` → `{draft,model,raw}`) and `presets.refine` (`{id,idea}` → writes back to the original file and returns the new `preset`).

Built-in templates:

| File | Purpose |
|---|---|
| `starter-simple.md` | Everyday-concept starter: apple, water, shadow × breakfast table, rainy day… (6 rows × 5 cols) |
| `future-forecast.md` | Future forecasting: scenario planning, signals vs. noise, second-order consequences (6×5) |
| `latticework.md` | Latticework theory: compounding, probability, incentives, evolution, opportunity cost, engineering redundancy (6×6) |
| `story-craft.md` | Story craft: three acts, hero's journey, iceberg, Chekhov's gun (6×6) |
| `life-planning.md` | Life planning: decision trees, opportunity cost, antifragility, life course (6×6) |
| `iching.md` | I Ching hexagrams: the eight trigrams crossed into 64 hexagrams — a thinking tool, no divination promises (8×8) |
| `zen.md` | Zen principles: impermanence, non-self, not setting up words and letters, ordinary mind (6×6) |

## Generation Prompts

Each cell can edit two prompts: the **system prompt** (usually one sentence) and the **user message template** (usually multi-line). What the two editors store is a **template**, not final text: placeholders are substituted with the current cell's contents before every model call.

| Placeholder | Alias | Stands for |
|---|---|---|
| `{纵标题}` | `{row}` | Row axis title (mental-model name) |
| `{纵提示}` | `{rowHint}` | Row axis hint |
| `{横标题}` | `{col}` | Column axis title (scenario name) |
| `{横提示}` | `{colHint}` | Column axis hint |
| `{主题}` | `{theme}` | This matrix's global theme |
| `{模板名}` | `{title}` | Matrix title (from the template or the default title) |
| `{补充要求}` | `{hint}` | Extra requirement for this generation (the hint in the cell drawer; empty during batch generation) |
| `{上一版}` | `{previous}` | This cell's one-line takeaway from the previous version |
| `{坐标}` | `{cell}` | `row title × column title` |

Rules:

- Chinese placeholders match exactly; ASCII aliases are case-insensitive (`{ROW}` equals `{row}`).
- Unknown `{…}` sequences are **kept verbatim**, to avoid damaging ordinary braces in JSON, LaTeX, etc.; empty values substitute as the empty string.
- The user message template is processed line by line: when every placeholder on a line resolves to **empty**, the whole line is omitted, and empty "( )" pairs are stripped too. That way `主题：{主题}` / `Theme: {theme}` leaves no dangling label when there is no theme.
- Substitution happens only before sending; what `data/matrix.json` and `presets/*.md` store is always the templated text with placeholders, so it keeps working when you swap in a different set of axes.
- The right side of the Prompt tab lists every placeholder; clicking one inserts it into the **most recently edited box** (system or user) and shows its actual value in the preview cell; below, a live preview shows the **system** and **user** messages actually sent (the "copy prompt" action in subagents/chat goes through the same substitution).
- Both boxes follow "what you see on open is the full text currently in effect": with no customization they show the built-in default; saving without touching them = keep following the built-in default, never freezing the default text into a copy; "Restore built-in defaults" refills both boxes in one click.
- Saving prompts writes both `prompt` and `userPrompt` in `data/matrix.json`; every later generation (single cell, per-axis batches, the agent tool) uses these two. Loading a template replaces both at once; if a template has no `userPrompt`, it falls back to the built-in default.
- The built-in default system prompt is a single sentence: "结合纵横轴，用少于 150 字说清这个模型在这个场景里逼出了什么。" ("Combining the two axes, explain in under 150 characters what this model forces out in this scenario.") The default user message template is "纵轴（模型）：{纵标题}（{纵提示}）/ 横轴（场景）：{横标题}（{横提示}）/ 主题：{主题} / 补充要求：{补充要求} / 上一版结论（不要重复）：{上一版} / 直接写这一段，不要开场白。" ("Row axis (model): {row} ({rowHint}) / Column axis (scenario): {col} ({colHint}) / Theme: {theme} / Extra requirement: {hint} / Previous takeaway (do not repeat): {previous} / Write this passage directly, no preamble."), with empty lines omitted automatically.

## Batch Generation

Every row/column header has a generate button — no need to pick an axis in the page header first:

- **Header "▷ Generate"**: by default generates every empty cell on that row (row-axis item) or column (column-axis item); cells that already have content are skipped automatically. When there are no empty cells it won't silently redo anything — it prompts you to check "All".
- **Header "All" checkbox**: once checked, the same button becomes "▷ Regenerate", redoing every cell on the whole axis and overwriting existing content; unchecked, it only fills gaps.
- **Top-left "Generate all"**: by default fills every empty cell in the entire matrix; with the "Include generated cells" checkbox above the button ticked, it becomes "Regenerate everything" and redoes the whole matrix, and its color shifts from brand color to warning color.
- **⋯ → "Batch generate…"**: opens the batch dialog, with "Only empty cells" checked by default; uncheck it to rewrite existing content within scope.

Once a batch starts:

- **All at once by default**: every target cell in one batch begins generating simultaneously; the header "Concurrency" dropdown can cap simultaneous cells at 1/2/3/4/6/8/12 (0 = all at once).
- Each cell is persisted and updates the grid as soon as it finishes; the concurrency value is fixed when the batch starts, and the dropdown is disabled while running.
- A progress bar appears above the matrix and a progress chip in the header, showing parallel cell count plus success/failure/skip counts;
- "Stop batch" works at any time; stopping aborts all in-flight cells while completed ones are kept;
- Refreshing the page mid-batch loses no progress: `state.batch` keeps reporting, and the panel recovers by polling.
- A failed cell never interrupts the whole batch; failure reasons are listed under the progress bar and can be retried individually.

Corresponding APIs: `batch.generate` (SSE or a final JSON result, optionally with `concurrency`), `batch.cancel`, `batch.clear`. SSE events: `batch.start`, `cell.start`, `cell.done`, `cell.error`, `batch.done`.

## Adding / Removing Axes, Renaming, and Blurbs

- Click a header title → rename in place (Enter saves, Esc cancels).
- Click the blurb under a title → edit in place (Enter saves, Esc cancels, blur saves); blurbs feed into `{纵提示}` / `{rowHint}` and `{横提示}` / `{colHint}` in the system prompt and user message template, and also show up in template details.
- The rightmost header cell "+ Add column" and the last row "+ Add row" → type a name and press Enter to append an axis directly.
- Header "×" → first click turns it red ("press again to delete"), second click actually deletes; deleting an axis cascades to its cells; at least one item per axis must remain, minimum matrix size 1×1.
- All these edits happen inside the Matrix tab and write back to `data/matrix.json` immediately — no separate dimension-editing page anymore.

## HTTP API

Prefix `/creative-matrix/api`; available only same-origin (loopback + matching Origin/Host).

| method | Description |
|---|---|
| `GET /creative-matrix/api` | Same as `state` |
| `state` | Axes, theme, cell summaries, effective model, `selectedModel`, `concurrency`, `batch` progress, `persisted`, `storePath`, `generating`, warning, `storeError` |
| `models.list` | List providers and models reachable from DSH; `{refresh:true}` bypasses the 60 s cache |
| `model.set` | `{provider,model}` writes the matrix model; both empty = follow default |
| `concurrency.set` | `{concurrency}` sets how many cells generate simultaneously; `0` = all at once (unlimited) |
| `cell.read` / `cell.write` / `cell.clear` | Read/write/clear a cell |
| `cell.generate` | Generate; SSE when `Accept: text/event-stream`, otherwise wait for the final JSON result |
| `cell.cancel` | Abort this cell's generation |
| `batch.generate` | Batch generation; `{scope:'all'\|'row'\|'col', rowId?, colId?, onlyEmpty?, mode?, concurrency?}`; SSE or JSON |
| `batch.cancel` | Stop the running batch (aborts all cells currently generating) |
| `batch.clear` | Dismiss the finished batch summary |
| `axes.replace` | Replace axes wholesale (header "×" axis deletion, theme saving): deleting an axis cascades to its cells |
| `axes.upsert` | Add/update only, never delete (agent tool and header "+ Add axis"): matched by id or name |
| `axes.update` | Inline header edit: `{axis:'row'\|'col', id, name?, hint?}`, passing only the fields to change |
| `prompt.set` | `{prompt,userPrompt}` writes this matrix's system prompt and user message template; omitting a field keeps its old value, empty string = built-in default |
| `prompt.default` | Returns the two built-in default templates `{system,user}` in the current language |
| `presets.list` / `presets.read` | List/read built-in templates and user presets |
| `presets.save` | Save the current theme/rows/cols/prompt/userPrompt as `presets/<title>.md`; may carry `file` + `overwrite:true` to overwrite a user template, and `bind:true` to bind the matrix to that template |
| `presets.draft` | Draft a template from a prompt: `{idea}` → `{draft,model,raw}`, nothing written to disk |
| `presets.refine` | Rewrite a user preset with a prompt: `{id,idea}`, written back to the original file; built-in templates return `BUILTIN_PRESET` |
| `presets.delete` | Delete a user preset |
| `presets.apply` | Apply a template to the current matrix; returns `removedCells` |
| `prompt.preview` | Preview the two messages finally sent for a cell: `{rowId,colId,hint?,custom?,userCustom?}` → `{template,userTemplate,system,user,vars}`; the two `custom` fields preview unsaved system / user drafts respectively |
| `export.markdown` | Assemble the whole matrix into Markdown |
| `reload` | Force a re-read of the file |
| `reset` | Rename the existing file to `.bak-<ts>`, then rebuild the example matrix |

Request body: `{"method":"cell.generate","args":{...}}`; success `{"ok":true,"value":...}`, failure `{"ok":false,"error":"...","code":"..."}`.

SSE events:

```
event: meta    data: {"provider":"…","model":"…"}
event: stage   data: {"stage":"draft"|"critique"}
event: delta   data: {"text":"…"}
event: done    data: {"key":"r-…:c-…","cell":{…},"persisted":true}
event: error   data: {"code":"…","message":"…"}
```

Single-flight: clicking generate again on the same cell aborts the older request (latest wins). Manual requests are bound by the `concurrency.set` cap, default 0 = unlimited; requests beyond the cap queue, and returning `429` if still not scheduled after 30 s. Batch generation brings its own concurrency pool and running batches are never squeezed out by single-cell requests. A client disconnect does not abort generation — it persists normally when done, and remains visible via `state.generating` after a page refresh.

## Agent Tool

```
creative_matrix(
  action: 'state' | 'read' | 'generate' | 'write' | 'clear' | 'axes' | 'model' | 'template',
  rowId?, colId?, hint?, mode?: 'fast'|'deep',
  markdown?, theme?, prompt?, userPrompt?, rows?: [{id?,name,hint?}], cols?: [{id?,name,hint?}],
  provider?, model?, idea?, save?, file?, refineFile?
)
```

- `state` returns axis ids/names/hints, the theme, the status of both prompts, cell summaries and the effective model; it does not return full texts.
- `read` returns one cell's full text (truncated above 8000 characters).
- `generate` shares the same runtime as the panel and saves by default.
- `axes` only adds/updates, never deletes; it can also write `prompt` (system prompt) and `userPrompt` (user message template) along the way; deleting axes is possible only in the panel.
- `model` switches this matrix's model; leaving both `provider` and `model` empty follows the default.
- `template` drafts templates from a prompt: `idea` is required and returns a draft (nothing written to disk); `save: true` stores it directly as `presets/*.md` (with `file` you can name the file); `refineFile` names a user preset to rewrite, written back to that file.

## Configuration

```yaml
- insert:
    - id: creative-matrix
      name: '@local/creative-matrix'
      config:
        baseDir: 'C:\Users\zgw31\Documents\deepseek-harness\polymath_matrix'
        maxTokens: 500         # ~150 characters per cell; 500 is headroom, not a length controller
        critiqueMaxTokens: 200
        temperature: 0.85
        outputLanguage: zh      # zh | en
        concurrency: 0          # 0 = all at once (everything generates simultaneously); 1–32 also allowed
```

`cordis.patch.yml` actually configures only the six items above. The runtime also supports these optional keys (defaults apply when omitted):

| Config | Default | Description |
|---|---|---|
| `reasoningEffort` | `''` | `''` = lowest reasoning tier the model supports; `'selection'` = keep the default selection; a specific id also works |
| `storePath` | `data/matrix.json` | Relative to `baseDir`, or absolute |
| `presetsDir` | `presets` | Relative to `baseDir`, or absolute |
| `provider` / `model` | empty | Override the default model (the panel's selection takes precedence over this) |
| `timeoutMs` | 180000 | Timeout for a single model call |
| `queueTimeoutMs` | 30000 | Wait cap for queued requests; timeout returns 429 |

`concurrency` is only the startup value; the "Concurrency" dropdown at the top of the panel can change it at runtime (`concurrency.set`), effective for the next batch immediately, reverting to the configured value after a Host restart.

Model resolution order: `config.provider` + `config.model` → the `model` saved in the matrix → `ctx.agentDefaultModel.currentSelection()`. If none exist, the panel shows `NO_MODEL` and will not pick a model on its own.

The reasoning tier defaults to "the lowest tier the model supports": creative deduction needs the output budget spent on the body text, not burned by the reasoning trace. For deeper thinking, set `reasoningEffort` to `'selection'` or a concrete effort id, and raise `maxTokens` accordingly.

## Install / Upgrade

```powershell
# Inside Harness (requires Full access or per-call approval)
# plugin_manager install_bundle target = absolute path of this directory
```

- After installing, refresh the page once: the "Gezhi Matrix" (格致矩阵) icon appears in the sidebar.
- Only `client.js` changed: a page refresh is enough.
- Only `client.ui.js` changed: the chunk URL's `rev` derives from `client.js`'s mtime/size, so touch `client.js` first, then refresh; if you still see the old UI, restart Harness.
- Only `index.js` / `lib/*.js` / `templates/*.md` changed: toggle the plugin line off and on again, or restart Harness, to reload the Host modules.
- Local plugins install via symlink; moving the workspace breaks them.

## Testing

```powershell
cd plugins/creative-matrix
node --test test        # in some sandboxes this fails with spawn EPERM
node test/matrix.test.mjs
node test/prompt.test.mjs
node test/presets.test.mjs
node test/core.test.mjs
node --check index.js; node --check client.js; node --check client.ui.js
```

Note: this workspace's system Node (v24.15) is a build with broken ESM — running `node lib/core.js` directly fails with `ERR_UNKNOWN_FILE_EXTENSION`. For unit tests use the Electron Node bundled with Harness: set `ELECTRON_RUN_AS_NODE=1`, then `"C:\Users\zgw31\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe" test/<name>.test.mjs` (syntax checking with `--check` is unaffected).

`createRuntime` takes dependency injection (`llm`, `selection`), and the unit tests cover it with a fake model: streaming saves, provider failures keeping old content, cancellation, single-flight, deep appended review, axis replace/upsert/rename/blurb-edit, write failures, mtime reload, no model, model listing, preset read/write and template application, template binding (apply binds built-in / save(bind) binds user / delete clears the binding), batch concurrency (all-at-once / throttled / cancelled), custom system/user prompts (persisted / generation / stored & restored with templates / templates store no cells / placeholder substitution / draft preview / empty-line omission), drafting templates from a prompt (draft not persisted / missing fields fall back / bad reply BAD_TEMPLATE), rewriting presets with a prompt (in-place write-back / body preserved / built-in read-only).

## Design Notes

- **UI and data are layered**: `client.js` keeps only the store, SSE, Host API actions and slot registration; `client.ui.js` is the lazily loaded React half, dealing only with components, Markdown rendering and CSS. Between them sits a single `deps` facade (state reads + actions + panel mount lifecycle); the UI never touches `fetch` or store internals directly. Future UI reshuffles only touch `client.ui.js`.
- **Three-tab workspace**: Templates / Matrix / Prompt each occupy a tab, with Templates open by default; only the current tab is mounted and unsaved drafts are discarded on switch-away. In the Matrix tab, theme, axis names, blurbs, and adding/removing axes all save immediately — there is no "Apply" step. Model and concurrency selection live in the header's right side (no longer hidden under the grid), because they are global settings for the whole matrix.
- **Matrix editing and template writing are separate**: header edits (renames, blurbs, add/remove axes), the theme, and both prompts write only to `data/matrix.json`; only "Save template" writes to `presets/`, avoiding a new template file for every single keystroke-level change.
- **Main panel, not chat-inline**: the grid needs horizontal space, and generation should not pollute the conversation.
- **The system prompt is one sentence**: by default just "结合纵横轴，用少于 150 字说清这个模型在这个场景里逼出了什么。" ("Combining the two axes, explain in under 150 characters what this model forces out in this scenario.") We tried steering format with 6 hard rules plus examples; the result was a steady 2000 characters per cell with five subheadings. Swapping to one sentence with the length written into the sentence itself — same model — lands steadily at 90–150 characters. To change it, edit it in the panel; it saves with the matrix and templates, no code change needed.
- **The user message is editable too, but its default structure is unchanged**: the default user template reproduces the original hand-written "row axis / column axis / theme / extra requirement / previous version / write directly" structure; empty-valued lines are omitted and empty parentheses stripped, so default output matches the old version. Want an extra field? Add it in the user template — no code change.
- **Prompts are templates; substitution happens before sending**: what the editors and `presets/*.md` store is always the raw text with placeholders; on every generation, batch, prompt-copy, and panel preview, `lib/prompt.js` substitutes per current cell using the same `promptVars` / `renderPrompt`. Unknown `{…}` sequences are kept verbatim to avoid damaging JSON/LaTeX; the panel only displays the `vars` returned by the Host instead of maintaining its own second substitution logic.
- **Batch scope defaults to filling gaps**: the top-left and per-axis checkboxes default to unchecked, which means "fill gaps only"; checking one regenerates that scope and overwrites existing content. An axis with no empty cells gets an explicit prompt to check "All", instead of triggering overwrite through a hidden "press again" state.
- **Markdown rather than JSON**: SSE streaming is natural, avoiding JSON-repair retries; the cell label (takeaway) takes the body's first sentence, truncating at punctuation when too long rather than hard-cutting at 60 characters. The legacy `> 一句话：` ("One-liner:") line format is still recognized with priority.
- **Generation lives on the Host**: the panel and the agent tool share `lib/core.js`, so the two call paths never grow into two separate implementations.
- **Templates are Markdown files**: human-readable, hand-editable, version-controllable; built-ins and user presets share one parser.
- **No iframe**: React renders directly in the main panel, inheriting theme tokens and locale.
- **Safe rendering**: a self-written Markdown subset, all React text nodes, no `dangerouslySetInnerHTML`.

## Possible Next Steps

- A multi-matrix library (switch between several matrices in one workspace);
- Template variables (replace years/names in the theme with form inputs);
- One-click push of a cell into chat for further digging;
- An export to DOCX/PDF as a consulting deliverable.
