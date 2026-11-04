// Pure matrix logic: validation, normalization, id generation, axis edits,
// cell summaries, takeaway extraction and Markdown export.
//
// Nothing here touches Cordis, the filesystem or the network, so the whole
// module is testable with `node --test`.

import { randomUUID } from 'node:crypto'

export const MATRIX_VERSION = 1
export const MATRIX_TITLE = '格致矩阵'

export const LIMITS = {
  axes: 12,
  name: 80,
  hint: 300,
  theme: 500,
  prompt: 4000,
  title: 120,
  markdown: 200_000,
  file: 8 * 1024 * 1024,
}

const ID_PATTERN = /^[rc]-[a-z0-9]{4,16}$/i

export class MatrixError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'MatrixError'
    this.code = code
  }
}

function text(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function markdownText(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, LIMITS.markdown)
}

// The per-matrix prompt templates keep their line breaks; only the edges are
// trimmed. Empty means "use the built-in default prompt".
function promptText(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, LIMITS.prompt)
}

export function makeId(prefix) {
  return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, 8)}`
}

export function emptyMatrix(now = Date.now()) {
  return {
    version: MATRIX_VERSION,
    title: MATRIX_TITLE,
    theme: '',
    prompt: '',
    userPrompt: '',
    model: null,
    // The template this matrix was last loaded from or saved to. It is only a
    // label for the save dialog: editing axes or the theme keeps the binding,
    // so "overwrite" always means "write the current content back there".
    preset: null,
    rows: [],
    cols: [],
    cells: {},
    updatedAt: now,
  }
}

export function cellKey(rowId, colId) {
  return `${rowId}:${colId}`
}

export function parseCellKey(key) {
  const at = String(key ?? '').indexOf(':')
  if (at <= 0) return null
  const rowId = key.slice(0, at)
  const colId = key.slice(at + 1)
  if (rowId === '' || colId === '') return null
  return { rowId, colId }
}

function normalizeAxisList(value, prefix, label, warnings) {
  if (!Array.isArray(value)) {
    if (value !== undefined && value !== null) warnings.push(`${label}: expected an array; ignored`)
    return []
  }
  const list = []
  const used = new Set()
  for (const raw of value.slice(0, LIMITS.axes)) {
    const item = typeof raw === 'string' ? { name: raw } : raw
    if (item === null || typeof item !== 'object') {
      warnings.push(`${label}: ignored a non-object entry`)
      continue
    }
    const name = text(item.name, LIMITS.name)
    if (name === '') {
      warnings.push(`${label}: ignored an entry without a name`)
      continue
    }
    const hint = text(item.hint, LIMITS.hint)
    const wanted = typeof item.id === 'string' && ID_PATTERN.test(item.id) ? item.id : ''
    const id = wanted !== '' && !used.has(wanted) ? wanted : makeId(prefix)
    used.add(id)
    list.push({ id, name, hint })
  }
  if (value.length > LIMITS.axes) {
    warnings.push(`${label}: kept the first ${LIMITS.axes} entries`)
  }
  return list
}

function normalizeCells(value, rows, cols, warnings) {
  const cells = {}
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    if (value !== undefined && value !== null) warnings.push('cells: expected an object; ignored')
    return cells
  }
  const rowIds = new Set(rows.map(row => row.id))
  const colIds = new Set(cols.map(col => col.id))
  for (const [key, raw] of Object.entries(value)) {
    const coords = parseCellKey(key)
    if (coords === null || !rowIds.has(coords.rowId) || !colIds.has(coords.colId)) {
      warnings.push(`cells: dropped ${key} (unknown row or column)`)
      continue
    }
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      warnings.push(`cells: dropped ${key} (not an object)`)
      continue
    }
    const markdown = markdownText(raw.markdown)
    if (markdown === '') {
      warnings.push(`cells: dropped ${key} (empty markdown)`)
      continue
    }
    const mode = raw.mode === 'deep' || raw.mode === 'manual' ? raw.mode : 'fast'
    const model = raw.model && typeof raw.model === 'object'
      ? {
        provider: text(raw.model.provider, 80),
        model: text(raw.model.model, 120),
      }
      : undefined
    const usage = raw.usage && typeof raw.usage === 'object'
      ? {
        inputTokens: Number.isFinite(raw.usage.inputTokens) ? raw.usage.inputTokens : 0,
        outputTokens: Number.isFinite(raw.usage.outputTokens) ? raw.usage.outputTokens : 0,
      }
      : undefined
    cells[key] = {
      markdown,
      // Derived, not stored state: the label is a pure function of the text, so
      // an older rule (or a hand-edited body) is fixed on the next load instead
      // of pinning a stale 60-character cut forever.
      takeaway: extractTakeaway(markdown) || text(raw.takeaway, 120),
      mode,
      hint: text(raw.hint, LIMITS.hint),
      model,
      usage,
      edited: raw.edited === true,
      updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now(),
    }
  }
  return cells
}

export function normalizeMatrix(raw, { now = Date.now() } = {}) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new MatrixError('STORE_INVALID', 'matrix store is not a JSON object')
  }
  const version = Number(raw.version ?? MATRIX_VERSION)
  if (!Number.isInteger(version) || version < 1) {
    throw new MatrixError('STORE_INVALID', `unsupported matrix version: ${String(raw.version)}`)
  }
  if (version > MATRIX_VERSION) {
    throw new MatrixError(
      'STORE_VERSION',
      `matrix store version ${version} is newer than this plugin (${MATRIX_VERSION}); update the plugin first`,
    )
  }
  const warnings = []
  const rows = normalizeAxisList(raw.rows, 'r', 'rows', warnings)
  const cols = normalizeAxisList(raw.cols, 'c', 'cols', warnings)
  const cells = normalizeCells(raw.cells, rows, cols, warnings)
  const rawPreset = raw.preset
  const preset = rawPreset !== null && typeof rawPreset === 'object' && !Array.isArray(rawPreset) &&
      text(rawPreset.file, 200) !== ''
    ? {
      file: text(rawPreset.file, 200),
      title: text(rawPreset.title, LIMITS.title),
      source: rawPreset.source === 'builtin' ? 'builtin' : 'user',
    }
    : null
  const matrix = {
    version: MATRIX_VERSION,
    title: text(raw.title, LIMITS.title) || MATRIX_TITLE,
    theme: text(raw.theme, LIMITS.theme),
    prompt: promptText(raw.prompt),
    userPrompt: promptText(raw.userPrompt),
    preset,
    model: raw.model !== null && typeof raw.model === 'object' && !Array.isArray(raw.model) &&
        text(raw.model.provider, 80) !== '' && text(raw.model.model, 120) !== ''
      ? { provider: text(raw.model.provider, 80), model: text(raw.model.model, 120) }
      : null,
    rows,
    cols,
    cells,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : now,
  }
  return { matrix, warnings }
}

export function findRow(matrix, ref) {
  const value = String(ref ?? '')
  if (value === '') return undefined
  return matrix.rows.find(row => row.id === value) ?? matrix.rows.find(row => row.name === value)
}

export function findCol(matrix, ref) {
  const value = String(ref ?? '')
  if (value === '') return undefined
  return matrix.cols.find(col => col.id === value) ?? matrix.cols.find(col => col.name === value)
}

export function extractTakeaway(markdown) {
  const lines = String(markdown ?? '').split('\n')
  for (const line of lines) {
    const match = line.match(/^\s*>\s*(?:\*\*)?一句话(?:\*\*)?\s*[:：]\s*(.+)$/)
    if (match) return clipSentence(cleanInline(match[1]), 80)
  }
  for (const line of lines) {
    const value = line.trim()
    if (value === '') continue
    if (/^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|---+$|```)/.test(value)) continue
    const prose = cleanInline(value)
    if (prose === '') continue
    // A cell is one short paragraph with no takeaway line, so the grid label
    // is its first sentence — not an arbitrary 60-character slice that stops
    // mid-clause ("…在资源匮乏与高压下，将").
    const stop = prose.search(/[。！？!?]/)
    const sentence = stop >= 0 ? prose.slice(0, stop + 1) : prose
    return clipSentence(sentence, 60)
  }
  return ''
}

// Cut a run of prose on a clause boundary instead of mid-word, and say so.
function clipSentence(text, max) {
  if (text.length <= max) return text
  const window = text.slice(0, max + 1)
  const at = Math.max(
    window.lastIndexOf('，'), window.lastIndexOf('；'), window.lastIndexOf('、'), window.lastIndexOf('：'),
    window.lastIndexOf(','), window.lastIndexOf(';'),
  )
  if (at >= Math.floor(max * 0.4)) return `${text.slice(0, at)}…`
  return `${text.slice(0, max)}…`
}

function cleanInline(value) {
  return String(value ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/[*_]+/g, '')
    .trim()
}

export function cellSummary(cell) {
  if (!cell) return null
  return {
    takeaway: cell.takeaway,
    mode: cell.mode,
    hint: cell.hint,
    model: cell.model ?? null,
    usage: cell.usage ?? null,
    edited: cell.edited === true,
    updatedAt: cell.updatedAt,
  }
}

export function matrixSummary(matrix) {
  const cells = {}
  for (const [key, cell] of Object.entries(matrix.cells)) cells[key] = cellSummary(cell)
  return {
    title: matrix.title,
    theme: matrix.theme,
    prompt: matrix.prompt ?? '',
    userPrompt: matrix.userPrompt ?? '',
    preset: matrix.preset ?? null,
    rows: matrix.rows,
    cols: matrix.cols,
    cells,
    updatedAt: matrix.updatedAt,
  }
}

function assertAxisInput(list, label) {
  if (!Array.isArray(list)) throw new MatrixError('BAD_AXES', `${label} must be an array`)
  if (list.length < 1) throw new MatrixError('BAD_AXES', `${label} needs at least one entry`)
  if (list.length > LIMITS.axes) {
    throw new MatrixError('BAD_AXES', `${label} supports at most ${LIMITS.axes} entries`)
  }
  const names = new Set()
  for (const item of list) {
    const name = text(item?.name, LIMITS.name)
    if (name === '') throw new MatrixError('BAD_AXES', `${label} contains an entry without a name`)
    if (names.has(name)) throw new MatrixError('BAD_AXES', `${label} contains duplicate name: ${name}`)
    names.add(name)
  }
}

// Replace both axes wholesale (the UI editor). Existing ids keep their cells;
// removed axes drop their cells.
export function replaceAxes(matrix, input, { now = Date.now() } = {}) {
  if (!Array.isArray(input.rows) || input.rows.length > LIMITS.axes) {
    throw new MatrixError('BAD_AXES', `rows must be an array of at most ${LIMITS.axes} entries`)
  }
  if (!Array.isArray(input.cols) || input.cols.length > LIMITS.axes) {
    throw new MatrixError('BAD_AXES', `cols must be an array of at most ${LIMITS.axes} entries`)
  }
  const warnings = []
  const rows = normalizeAxisList(input.rows, 'r', 'rows', warnings)
  const cols = normalizeAxisList(input.cols, 'c', 'cols', warnings)
  assertAxisInput(rows, 'rows')
  assertAxisInput(cols, 'cols')
  const rowIds = new Set(rows.map(row => row.id))
  const colIds = new Set(cols.map(col => col.id))
  const cells = {}
  let removed = 0
  for (const [key, cell] of Object.entries(matrix.cells)) {
    const coords = parseCellKey(key)
    if (coords !== null && rowIds.has(coords.rowId) && colIds.has(coords.colId)) cells[key] = cell
    else removed += 1
  }
  const next = {
    ...matrix,
    rows,
    cols,
    cells,
    theme: input.theme === undefined ? matrix.theme : text(input.theme, LIMITS.theme),
    prompt: input.prompt === undefined ? matrix.prompt : promptText(input.prompt),
    userPrompt: input.userPrompt === undefined ? matrix.userPrompt : promptText(input.userPrompt),
    updatedAt: now,
  }
  return { matrix: next, removedCells: removed, warnings }
}

// Add or update axes without ever deleting: the agent tool uses this so a
// mistaken call cannot wipe a whole row of curated cells.
export function upsertAxes(matrix, input, { now = Date.now() } = {}) {
  const warnings = []
  const next = { ...matrix, rows: [...matrix.rows], cols: [...matrix.cols], cells: { ...matrix.cells } }
  const apply = (list, rawList, label, prefix) => {
    if (rawList === undefined) return list
    if (!Array.isArray(rawList)) throw new MatrixError('BAD_AXES', `${label} must be an array`)
    const result = list.map(entry => ({ ...entry }))
    for (const raw of rawList) {
      const item = typeof raw === 'string' ? { name: raw } : raw
      const name = text(item?.name, LIMITS.name)
      if (name === '') throw new MatrixError('BAD_AXES', `${label} contains an entry without a name`)
      const hint = text(item?.hint, LIMITS.hint)
      const byId = typeof item?.id === 'string' ? result.find(entry => entry.id === item.id) : undefined
      const found = byId ?? result.find(entry => entry.name === name)
      if (found) {
        found.name = name
        found.hint = hint
        continue
      }
      if (result.length >= LIMITS.axes) {
        throw new MatrixError('AXIS_LIMIT', `${label} already has ${LIMITS.axes} entries`)
      }
      result.push({ id: makeId(prefix), name, hint })
    }
    return result
  }
  next.rows = apply(next.rows, input.rows, 'rows', 'r')
  next.cols = apply(next.cols, input.cols, 'cols', 'c')
  if (input.theme !== undefined) next.theme = text(input.theme, LIMITS.theme)
  if (input.prompt !== undefined) next.prompt = promptText(input.prompt)
  if (input.userPrompt !== undefined) next.userPrompt = promptText(input.userPrompt)
  next.updatedAt = now
  return { matrix: next, warnings }
}

function stamp(now) {
  const date = new Date(now)
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function dayStamp(now) {
  const date = new Date(now)
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function exportMarkdown(matrix, { now = Date.now() } = {}) {
  const lines = [`# ${matrix.title}`, '']
  if (matrix.theme !== '') lines.push(`> 主题：${matrix.theme}`, '')
  lines.push(`> 导出时间：${stamp(now)}`, '')
  for (const row of matrix.rows) {
    lines.push(`## ${row.name}`)
    if (row.hint !== '') lines.push(`_${row.hint}_`)
    lines.push('')
    for (const col of matrix.cols) {
      const key = cellKey(row.id, col.id)
      const cell = matrix.cells[key]
      lines.push(`### ${row.name} × ${col.name}`)
      if (col.hint !== '') lines.push(`_${col.hint}_`, '')
      lines.push(cell ? cell.markdown : '（未生成）', '')
    }
  }
  return {
    filename: `creative-matrix-${dayStamp(now)}.md`,
    markdown: lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n',
  }
}
