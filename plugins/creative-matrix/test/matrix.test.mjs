import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MatrixError,
  cellKey,
  exportMarkdown,
  extractTakeaway,
  makeId,
  matrixSummary,
  normalizeMatrix,
  replaceAxes,
  upsertAxes,
} from '../lib/matrix.js'
import { createSeedMatrix } from '../lib/seed.js'

function ids() {
  let n = 0
  return prefix => `${prefix}-abcd${String(++n).padStart(4, '0')}`
}

test('normalizeMatrix keeps valid cells and drops dangling ones', () => {
  const raw = {
    version: 1,
    title: 'T',
    theme: 'theme',
    rows: [{ id: 'r-aaaa1111', name: 'Row', hint: 'hint' }],
    cols: [{ id: 'c-bbbb2222', name: 'Col' }],
    cells: {
      'r-aaaa1111:c-bbbb2222': { markdown: '> 一句话：结论\n\n正文', mode: 'deep', updatedAt: 5 },
      'r-aaaa1111:c-missing': { markdown: 'dangling' },
      'bad-key': { markdown: 'nope' },
      'r-aaaa1111:c-bbbb2222x': { markdown: '' },
    },
  }
  const { matrix, warnings } = normalizeMatrix(raw, { now: 10 })
  assert.equal(matrix.rows.length, 1)
  assert.equal(matrix.cols.length, 1)
  assert.deepEqual(Object.keys(matrix.cells), ['r-aaaa1111:c-bbbb2222'])
  assert.equal(matrix.cells['r-aaaa1111:c-bbbb2222'].takeaway, '结论')
  assert.equal(matrix.cells['r-aaaa1111:c-bbbb2222'].mode, 'deep')
  assert.ok(warnings.length >= 2)
})

test('normalizeMatrix rejects newer store versions', () => {
  assert.throws(() => normalizeMatrix({ version: 2 }), error => {
    assert.ok(error instanceof MatrixError)
    assert.equal(error.code, 'STORE_VERSION')
    return true
  })
})

test('extractTakeaway prefers the 一句话 line and falls back to the first prose line', () => {
  assert.equal(extractTakeaway('# 标题\n\n> 一句话：这是一个结论。\n\n正文'), '这是一个结论。')
  assert.equal(extractTakeaway('# 标题\n\n- 列表项\n\n普通第一行\n第二行'), '普通第一行')
  assert.equal(extractTakeaway(''), '')
})

test('a one-paragraph cell is labelled by its first sentence, clipped on a clause', () => {
  assert.equal(
    extractTakeaway('不易：坚守核心愿景。在资源匮乏时，把刚健转化为执行的敏捷。'),
    '不易：坚守核心愿景。',
  )
  const long = extractTakeaway(`甲乙丙丁戊己庚辛，${'子丑寅卯辰巳午未，'.repeat(8)}申酉戌亥。`)
  assert.ok(long.endsWith('…'), `expected a clipped label, got ${long}`)
  assert.ok(!long.endsWith('，…'), `clipped mid-clause: ${long}`)
  assert.ok(long.length <= 61, `label is ${long.length} chars`)
})

test('replaceAxes keeps cells for renamed axes and drops cells of removed axes', () => {
  const matrix = createSeedMatrix(ids(), 1)
  const row = matrix.rows[0]
  const col = matrix.cols[0]
  const otherCol = matrix.cols[1]
  const key = cellKey(row.id, col.id)
  matrix.cells[key] = { markdown: '> 一句话：保留\n\n正文', takeaway: '保留', mode: 'fast', hint: '', updatedAt: 1 }

  const result = replaceAxes(matrix, {
    theme: '新主题',
    rows: [{ id: row.id, name: '改名后的行', hint: '新提示' }],
    cols: [{ id: col.id, name: col.name, hint: '' }],
  }, { now: 2 })
  assert.equal(result.removedCells, 0)
  assert.equal(result.matrix.rows[0].name, '改名后的行')
  assert.equal(result.matrix.theme, '新主题')
  assert.ok(result.matrix.cells[key])

  const removed = replaceAxes(result.matrix, {
    rows: [{ id: row.id, name: '改名后的行', hint: '' }],
    cols: [{ id: otherCol.id, name: otherCol.name, hint: '' }],
  }, { now: 3 })
  assert.equal(removed.removedCells, 1)
  assert.equal(Object.keys(removed.matrix.cells).length, 0)
})

test('replaceAxes validates empty, duplicate and oversized axes', () => {
  const matrix = createSeedMatrix(ids(), 1)
  assert.throws(() => replaceAxes(matrix, { rows: [], cols: matrix.cols }), /at least one/)
  assert.throws(
    () => replaceAxes(matrix, { rows: [{ name: 'A' }, { name: 'A' }], cols: matrix.cols }),
    /duplicate/,
  )
  const many = Array.from({ length: 20 }, (_, i) => ({ name: `row ${i}` }))
  assert.throws(() => replaceAxes(matrix, { rows: many, cols: matrix.cols }), /at most/)
})

test('upsertAxes adds and updates but never deletes', () => {
  const matrix = createSeedMatrix(ids(), 1)
  const before = matrix.rows.length
  const result = upsertAxes(matrix, {
    theme: 'T2',
    rows: [{ name: '新模型', hint: '新提示' }],
    cols: [{ name: matrix.cols[0].name, hint: '更新后的提示' }],
  }, { now: 2 })
  assert.equal(result.matrix.rows.length, before + 1)
  assert.equal(result.matrix.cols.length, matrix.cols.length)
  assert.equal(result.matrix.cols[0].hint, '更新后的提示')
  assert.equal(result.matrix.theme, 'T2')
  assert.equal(matrix.rows.length, before, 'input matrix must not be mutated')
})

test('custom prompt is normalized, summarized and only replaced when provided', () => {
  const matrix = createSeedMatrix(ids(), 1)
  assert.equal(matrix.prompt, '')
  const custom = '你是测试助手。\n规则：\n1. 第一行写结论\n2. 保留空行\n\n  缩进也保留'
  const customUser = '纵轴：{纵标题}\n主题：{主题}'
  const replaced = replaceAxes(
    matrix,
    { rows: matrix.rows, cols: matrix.cols, prompt: custom, userPrompt: customUser },
    { now: 2 },
  )
  assert.equal(replaced.matrix.prompt, custom)
  assert.equal(replaced.matrix.userPrompt, customUser)
  assert.equal(matrixSummary(replaced.matrix).prompt, custom)
  assert.equal(matrixSummary(replaced.matrix).userPrompt, customUser)
  assert.equal(upsertAxes(replaced.matrix, { theme: 'x' }).matrix.userPrompt, customUser)
  const normalized = normalizeMatrix({ ...replaced.matrix }).matrix
  assert.equal(normalized.prompt, custom)
  assert.equal(normalized.userPrompt, customUser)
  assert.equal(
    replaceAxes(replaced.matrix, { rows: matrix.rows, cols: matrix.cols, userPrompt: '' }).matrix.userPrompt,
    '',
  )
})

test('exportMarkdown contains every axis pair and the takeaway', () => {
  const matrix = createSeedMatrix(ids(), 1)
  const key = cellKey(matrix.rows[0].id, matrix.cols[0].id)
  matrix.cells[key] = { markdown: '> 一句话：测试\n\n正文', takeaway: '测试', mode: 'fast', hint: '', updatedAt: 1 }
  const exported = exportMarkdown(matrix, { now: new Date('2026-01-02T03:04:05').getTime() })
  assert.match(exported.filename, /^creative-matrix-2026-01-02\.md$/)
  assert.match(exported.markdown, /### 苹果 × 早餐桌/)
  assert.match(exported.markdown, /正文/)
  assert.match(exported.markdown, /（未生成）/)
})

test('seed matrix has stable ids for every axis pair', () => {
  const matrix = createSeedMatrix(makeId, 1)
  assert.equal(matrix.rows.length, 6)
  assert.equal(matrix.cols.length, 5)
  const rowIds = new Set(matrix.rows.map(row => row.id))
  const colIds = new Set(matrix.cols.map(col => col.id))
  assert.equal(rowIds.size, 6)
  assert.equal(colIds.size, 5)
  assert.equal(Object.keys(matrix.cells).length, 0)
})
