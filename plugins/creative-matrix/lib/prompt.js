// Prompt construction for one matrix cell.
//
// Kept deliberately plain: the vertical axis is a causal mechanism, the
// horizontal axis is the scene it acts on. A short rule list is easier for
// both people and models to follow than a long protocol; "deep" mode adds a
// separate red-team pass.

// The prompt is one sentence, and that sentence is the whole length control:
// "结合纵横轴，用少于 150 字说清……". An earlier revision spelled out six hard
// rules with a worked example; it produced ~2000 characters of Markdown
// headings no matter how loudly each rule said "brief". A single sentence that
// names the task and the budget holds the shape by itself, and it is the same
// thing a person would say to a colleague.
const ZH_SYSTEM = `结合纵横轴，用少于 150 字说清这个模型在这个场景里逼出了什么。`

const EN_SYSTEM = `Combine both axes and, in under 150 characters, say what this mental model forces in this scene.`

const ZH_CRITIQUE_SYSTEM = `用少于 80 字指出这段推演最脆弱的假设，和一个能推翻它的反例。`

const EN_CRITIQUE_SYSTEM = `In under 80 words, name the weakest assumption in this inference and one counter-example that breaks it.`

// One-shot system prompts for authoring a template from a plain idea. The
// model answers with a fenced block carrying `title/description/theme/prompt`
// plus rows/cols; core.js parses that, not free-form prose.
const ZH_TEMPLATE_SYSTEM = [
  '你是矩阵模板作者。用户会给一个想法（可能还有当前矩阵的轴作为参考）。',
  '设计一张新矩阵模板：纵横两轴各 4-8 项，交叉后能产生真正有张力的推演，而不是词语拼贴。',
  '只输出一个 ```yaml 代码块，不要其它文字，格式严格如下（name ≤ 80 字、hint ≤ 300 字）：',
  '```yaml',
  'title: 模板名称',
  'description: 一句话说明这个模板用来做什么',
  'theme: 这张矩阵服务的主题（可为空）',
  'prompt: ×××（15-20字概括任务）。直接写这一段，不要开场白。',
  'rows:',
  '  - name: 纵轴项',
  '    hint: 这一行的推演线索',
  'cols:',
  '  - name: 横轴项',
  '    hint: 这一列的处境或约束',
  '```',
].join('\n')

const EN_TEMPLATE_SYSTEM = [
  'You design matrix templates. The user gives an idea (possibly with the current axes as reference).',
  'Design a new template: 4-8 entries per axis so the crossings create real tension, not word mashups.',
  'Answer with exactly one ```yaml block and nothing else, in this strict format (name ≤ 80 chars, hint ≤ 300 chars):',
  '```yaml',
  'title: template name',
  'description: one line on what the template is for',
  'theme: the theme this matrix serves (may be empty)',
  'prompt: Combine both axes and, in under 150 characters, say … (one complete instruction with a length budget)',
  'rows:',
  '  - name: row entry',
  '    hint: what to probe on this row',
  'cols:',
  '  - name: col entry',
  '    hint: the scene or constraint of this column',
  '```',
].join('\n')

// Follow-up pass: rewrite an existing template from the user’s instruction,
// keeping everything the instruction does not mention.
const ZH_REFINE_SYSTEM = [
  '你是矩阵模板编辑。用户会给出一份现有模板（YAML）和一条修改要求。',
  '按要求改写这份模板；要求没提到的字段保持原样，只输出改写后的完整 ```yaml 代码块，格式与原模板一致，不要其它文字。',
].join('\n')

const EN_REFINE_SYSTEM = [
  'You edit matrix templates. The user gives an existing template (YAML) and one instruction.',
  'Apply the instruction, keep every field it does not mention, and answer with only the full rewritten ```yaml block in the same format.',
].join('\n')

function lang(language) {
  return String(language ?? 'zh').toLowerCase().startsWith('en') ? 'en' : 'zh'
}

// Placeholders a custom prompt may use. Chinese tokens are canonical; the
// ASCII aliases keep an English prompt readable. Substitution happens once per
// cell, immediately before the model call — never when the prompt is saved, so
// the stored template stays reusable across axes and cells.
//
// Keep this table and the docs list in client.ui.js (PROMPT_PLACEHOLDERS) in
// sync: the Host owns the replacement, the panel owns the localized labels.
const PLACEHOLDER_KEYS = new Map()
const PLACEHOLDER_TOKENS = [
  ['纵标题', 'row', 'row'],
  ['纵提示', 'rowHint', 'rowHint'],
  ['横标题', 'col', 'col'],
  ['横提示', 'colHint', 'colHint'],
  ['主题', 'theme', 'theme'],
  ['模板名', 'title', 'title'],
  ['补充要求', 'hint', 'hint'],
  ['上一版', 'previous', 'previous'],
  ['坐标', 'cell', 'cell'],
]
for (const [token, alias, key] of PLACEHOLDER_TOKENS) {
  PLACEHOLDER_KEYS.set(token, key)
  PLACEHOLDER_KEYS.set(alias, key)
  PLACEHOLDER_KEYS.set(alias.toLowerCase(), key)
}

function placeholderKey(raw) {
  const name = String(raw)
  return PLACEHOLDER_KEYS.get(name) ?? PLACEHOLDER_KEYS.get(name.toLowerCase()) ?? null
}

export function promptVars({ row, col, theme = '', title = '', hint = '', previous = '' }) {
  return {
    row: row.name,
    rowHint: row.hint ?? '',
    col: col.name,
    colHint: col.hint ?? '',
    theme: String(theme ?? '').trim(),
    title: String(title ?? '').trim(),
    hint: String(hint ?? '').trim(),
    previous: String(previous ?? '').trim(),
    cell: `${row.name} × ${col.name}`,
  }
}

// Unknown {tokens} are left untouched: they may be ordinary braces (JSON,
// LaTeX) and silently deleting them would corrupt a prompt.
export function renderPrompt(template, vars = {}) {
  const text = String(template ?? '')
  if (!text.includes('{')) return text
  return text.replace(/\{([^{}\n]{1,40})\}/g, (whole, raw) => {
    const key = placeholderKey(raw)
    if (key === null) return whole
    const value = vars[key]
    return value === undefined || value === null ? '' : String(value)
  })
}

export function buildSystem(language = 'zh', custom = '', vars = null) {
  const override = String(custom ?? '').trim()
  const template = override !== '' ? override : (lang(language) === 'en' ? EN_SYSTEM : ZH_SYSTEM)
  return vars === null ? template : renderPrompt(template, vars)
}

// The user message is also a template: same placeholders as the system prompt,
// one line per section. A line whose placeholders are all empty is omitted, so
// "Theme: {theme}" disappears instead of leaving a dangling label, and empty
// parenthetical hints are cleaned up. The default reproduces the old
// hand-built user message exactly for non-empty axes.
const ZH_USER = [
  '纵轴（模型）：{纵标题}（{纵提示}）',
  '横轴（场景）：{横标题}（{横提示}）',
  '主题：{主题}',
  '补充要求：{补充要求}',
  '上一版结论（不要重复）：{上一版}',
  '直接写这一段，不要开场白。',
].join('\n')

const EN_USER = [
  'Model (vertical axis): {row} ({rowHint})',
  'Scene (horizontal axis): {col} ({colHint})',
  'Theme: {theme}',
  'Extra instruction: {hint}',
  'Previous takeaway (do not repeat): {previous}',
  'Write that paragraph now, no preamble.',
].join('\n')

export function defaultSystem(language = 'zh') {
  return lang(language) === 'en' ? EN_SYSTEM : ZH_SYSTEM
}

export function defaultUser(language = 'zh') {
  return lang(language) === 'en' ? EN_USER : ZH_USER
}

function lineHasOnlyEmptyPlaceholders(line, vars) {
  const tokens = [...String(line).matchAll(/\{([^{}\n]{1,40})\}/g)]
  if (tokens.length === 0) return false
  for (const match of tokens) {
    const key = placeholderKey(match[1])
    if (key === null) return false
    if (String(vars[key] ?? '').trim() !== '') return false
  }
  return true
}

export function renderUserTemplate(template, vars = {}) {
  const lines = String(template ?? '').replace(/\r\n?/g, '\n').split('\n')
  const out = []
  for (const line of lines) {
    if (lineHasOnlyEmptyPlaceholders(line, vars)) continue
    const rendered = renderPrompt(line, vars)
      // "（）" is what a filled template leaves behind when a hint is empty;
      // it is noise for the model, so drop empty pairs after substitution.
      .replace(/（\s*）/g, '')
      .replace(/\(\s*\)/g, '')
    out.push(rendered)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function buildUser({
  row,
  col,
  theme = '',
  title = '',
  hint = '',
  previous = '',
  language = 'zh',
  template = '',
}) {
  const source = String(template ?? '').trim() !== '' ? String(template) : defaultUser(language)
  return renderUserTemplate(source, promptVars({ row, col, theme, title, hint, previous }))
}

export function buildCritiqueSystem(language = 'zh') {
  return lang(language) === 'en' ? EN_CRITIQUE_SYSTEM : ZH_CRITIQUE_SYSTEM
}

export function buildCritiqueUser({ draft, row, col, language = 'zh' }) {
  const en = lang(language) === 'en'
  if (en) {
    return [
      `Draft to review (${row.name} x ${col.name}):`,
      '---',
      draft.trim(),
      '---',
      'Review only the inference above.',
    ].join('\n')
  }
  return [
    `待审阅的推演（${row.name} × ${col.name}）：`,
    '---',
    draft.trim(),
    '---',
    '只审阅上面的推演。',
  ].join('\n')
}

export function previewPrompt({
  row,
  col,
  theme,
  title = '',
  hint,
  previous = '',
  language,
  custom = '',
  userCustom = '',
}) {
  const vars = promptVars({ row, col, theme, title, hint, previous })
  const systemOverride = String(custom ?? '').trim()
  const template = systemOverride !== '' ? systemOverride : defaultSystem(language)
  const userOverride = String(userCustom ?? '').trim()
  const userTemplate = userOverride !== '' ? userOverride : defaultUser(language)
  return {
    template,
    userTemplate,
    system: renderPrompt(template, vars),
    user: renderUserTemplate(userTemplate, vars),
    vars,
  }
}

// --- template authoring -------------------------------------------------
// The model answers with a fenced `yaml` block; parseTemplateReply in
// lib/presets.js turns it back into a preset draft.

export function buildTemplateSystem(language = 'zh') {
  return lang(language) === 'en' ? EN_TEMPLATE_SYSTEM : ZH_TEMPLATE_SYSTEM
}

export function buildRefineSystem(language = 'zh') {
  return lang(language) === 'en' ? EN_REFINE_SYSTEM : ZH_REFINE_SYSTEM
}

export function templateYaml({
  title,
  description = '',
  theme = '',
  prompt = '',
  userPrompt = '',
  rows,
  cols,
}) {
  const lines = [`title: ${title}`]
  if (description !== '') lines.push(`description: ${description}`)
  if (theme !== '') lines.push(`theme: ${theme}`)
  if (prompt !== '') lines.push(`prompt: ${prompt}`)
  if (userPrompt !== '') {
    lines.push('userPrompt: |')
    for (const line of String(userPrompt).replace(/\r\n?/g, '\n').split('\n')) {
      lines.push(`  ${line}`)
    }
  }
  lines.push('rows:')
  for (const row of rows ?? []) {
    lines.push(`  - name: ${row.name}`)
    if (row.hint) lines.push(`    hint: ${row.hint}`)
  }
  lines.push('cols:')
  for (const col of cols ?? []) {
    lines.push(`  - name: ${col.name}`)
    if (col.hint) lines.push(`    hint: ${col.hint}`)
  }
  return lines.join('\n')
}

export function buildTemplateUser({ idea, language = 'zh', current = null }) {
  const en = lang(language) === 'en'
  const lines = [en ? `Idea: ${String(idea ?? '').trim()}` : `想法：${String(idea ?? '').trim()}`]
  if (current !== null && current !== undefined) {
    lines.push(en ? 'Current template, for reference:' : '当前模板（仅供参考）：')
    lines.push('```yaml', templateYaml(current), '```')
  }
  lines.push(en ? 'Now output the yaml block.' : '现在输出 yaml 代码块。')
  return lines.join('\n')
}

export function buildRefineUser({ idea, current, language = 'zh' }) {
  const en = lang(language) === 'en'
  return [
    en ? `Instruction: ${String(idea ?? '').trim()}` : `修改要求：${String(idea ?? '').trim()}`,
    `${en ? 'Existing template:' : '现有模板：'}`,
    '```yaml',
    templateYaml(current),
    '```',
    en ? 'Now output the rewritten yaml block.' : '现在输出改写后的 yaml 代码块。',
  ].join('\n')
}
