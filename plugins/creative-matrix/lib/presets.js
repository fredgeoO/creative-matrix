// Markdown preset files: YAML-ish frontmatter carries the axes, the body is
// the human-readable description shown in the template browser.
//
// The format is deliberately a small subset so a person can edit the files by
// hand and the plugin can parse them without a YAML dependency.

import path from 'node:path'

export const PRESET_MAX = {
  title: 120,
  description: 500,
  theme: 500,
  prompt: 4000,
  body: 20_000,
}

function unquote(value) {
  const text = String(value ?? '').trim()
  if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) {
    try {
      return JSON.parse(text)
    } catch {
      return text.slice(1, -1)
    }
  }
  if (text.startsWith("'") && text.endsWith("'") && text.length >= 2) {
    return text.slice(1, -1).replace(/''/g, "'")
  }
  return text
}

function yamlValue(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim()
  if (text === '') return '""'
  if (/^[^\s\-:#"'\n\\][^:#"'\n\\]*$/.test(text)) return text
  return JSON.stringify(text)
}

export function parsePreset(text, { file = '' } = {}) {
  const raw = String(text ?? '').replace(/\r\n?/g, '\n')
  let front = ''
  let body = raw
  if (raw.startsWith('---\n') || raw.startsWith('---\r\n')) {
    const end = raw.indexOf('\n---', 4)
    if (end < 0) throw new Error('preset frontmatter is not closed')
    front = raw.slice(4, end)
    body = raw.slice(end + 4).replace(/^\n+/, '')
  }
  const fields = { title: '', description: '', theme: '', prompt: '', userPrompt: '' }
  const rows = []
  const cols = []
  let list = null
  let blockKey = null
  let blockLines = []
  const flushBlock = () => {
    if (blockKey === null) return
    const key = blockKey === 'userprompt' || blockKey === 'user_prompt' ? 'userPrompt' : blockKey
    fields[key] = blockLines.join('\n').trim()
    blockKey = null
    blockLines = []
  }
  for (const line of front.split('\n')) {
    if (blockKey !== null) {
      if (line.trim() === '') {
        blockLines.push('')
        continue
      }
      if (/^\s/.test(line)) {
        blockLines.push(line.replace(/^ {1,2}/, ''))
        continue
      }
      flushBlock()
    }
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue
    const top = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/)
    if (top !== null) {
      const key = top[1].toLowerCase()
      const rawValue = top[2].trim()
      if (/^[|>][+-]?$/.test(rawValue)) {
        // Block scalar: the following indented lines belong to this key. This
        // is how a full system prompt is carried inside a template.
        list = null
        blockKey = key
        blockLines = []
        continue
      }
      const value = unquote(rawValue)
      if (key === 'rows' || key === 'cols') {
        list = key === 'rows' ? rows : cols
        continue
      }
      list = null
      if (key === 'title' || key === 'description' || key === 'theme' || key === 'prompt') fields[key] = value
      if (key === 'userprompt' || key === 'user_prompt') fields.userPrompt = value
      continue
    }
    const item = line.match(/^\s*-\s*(?:name:\s*)?(.*)$/)
    if (list !== null && item !== null) {
      const name = unquote(item[1])
      if (name !== '') list.push({ name, hint: '' })
      continue
    }
    const hint = line.match(/^\s+hint:\s*(.*)$/)
    if (list !== null && hint !== null && list.length > 0) {
      list[list.length - 1].hint = unquote(hint[1])
      continue
    }
    const name = line.match(/^\s+name:\s*(.*)$/)
    if (list !== null && name !== null && list.length > 0) {
      list[list.length - 1].name = unquote(name[1])
    }
  }
  flushBlock()
  const fallbackTitle = String(file).replace(/\.md$/i, '').replace(/[-_]+/g, ' ').trim()
  const title = String(fields.title || fallbackTitle || '未命名模板').slice(0, PRESET_MAX.title)
  if (rows.length === 0 || cols.length === 0) {
    throw new Error(`${file || title}: rows and cols must both contain at least one entry`)
  }
  return {
    title,
    description: String(fields.description || '').slice(0, PRESET_MAX.description),
    theme: String(fields.theme || '').slice(0, PRESET_MAX.theme),
    prompt: String(fields.prompt || '').slice(0, PRESET_MAX.prompt),
    userPrompt: String(fields.userPrompt || '').slice(0, PRESET_MAX.prompt),
    rows,
    cols,
    body: body.trim().slice(0, PRESET_MAX.body),
  }
}

export function serializePreset({
  title,
  description = '',
  theme = '',
  prompt = '',
  userPrompt = '',
  rows,
  cols,
  body = '',
}) {
  const lines = ['---']
  lines.push(`title: ${yamlValue(title)}`)
  if (description !== '') lines.push(`description: ${yamlValue(description)}`)
  if (theme !== '') lines.push(`theme: ${yamlValue(theme)}`)
  if (prompt !== '') {
    lines.push('prompt: |')
    for (const line of String(prompt).replace(/\r\n?/g, '\n').split('\n')) {
      lines.push(line === '' ? '' : `  ${line}`)
    }
  }
  if (userPrompt !== '') {
    lines.push('userPrompt: |')
    for (const line of String(userPrompt).replace(/\r\n?/g, '\n').split('\n')) {
      lines.push(line === '' ? '' : `  ${line}`)
    }
  }
  lines.push('rows:')
  for (const row of rows) {
    lines.push(`  - name: ${yamlValue(row.name)}`)
    if (row.hint) lines.push(`    hint: ${yamlValue(row.hint)}`)
  }
  lines.push('cols:')
  for (const col of cols) {
    lines.push(`  - name: ${yamlValue(col.name)}`)
    if (col.hint) lines.push(`    hint: ${yamlValue(col.hint)}`)
  }
  lines.push('---', '')
  const intro = String(body ?? '').trim()
  if (intro !== '') lines.push(intro, '')
  return lines.join('\n')
}

export function presetSlug(title) {
  const base = String(title ?? '')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.\-\s]+|[.\-\s]+$/g, '')
    .slice(0, 60)
  return base === '' ? `preset-${Date.now()}` : base
}

// Return a safe `*.md` basename inside the presets directory, or throw.
export function presetFilename(candidate, fallbackTitle) {
  const value = String(candidate ?? '').trim()
  if (value === '') return `${presetSlug(fallbackTitle)}.md`
  const base = path.basename(value)
  if (base !== value || base.includes('..')) throw new Error('invalid preset file name')
  const cleaned = base
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/^[.\-\s]+|[.\-\s]+$/g, '')
  if (cleaned === '' || cleaned === '.md') throw new Error('invalid preset file name')
  return cleaned.toLowerCase().endsWith('.md') ? cleaned : `${cleaned}.md`
}

export function presetAxes(preset) {
  return {
    rows: preset.rows.map(row => ({ name: row.name, hint: row.hint ?? '' })),
    cols: preset.cols.map(col => ({ name: col.name, hint: col.hint ?? '' })),
  }
}

// Pull the yaml block out of a model reply and run it through parsePreset.
// The authoring prompts ask for exactly one ```yaml fence; a bare document is
// accepted too so a chatty reply still works.
export function parseTemplateReply(text) {
  const raw = String(text ?? '').replace(/\r\n?/g, '\n').trim()
  if (raw === '') throw new Error('empty template reply')
  const fenced = raw.match(/```(?:ya?ml)?\s*\n([\s\S]*?)```/i)
  const inner = (fenced !== null ? fenced[1] : raw).trim()
  if (inner === '') throw new Error('template block is empty')
  const doc = inner.startsWith('---') ? inner : `---\n${inner}\n---\n`
  return parsePreset(doc)
}
