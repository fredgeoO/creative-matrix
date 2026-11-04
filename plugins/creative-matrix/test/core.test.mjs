import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createRuntime } from '../lib/core.js'

const FAST_DRAFT = '> 一句话：测试结论\n\n## 机制\n\n正文。'

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function makeRuntime(t, { llm, selection, config = {} } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creative-matrix-'))
  t.after(async () => { await rm(dir, { recursive: true, force: true }) })
  const runtime = createRuntime({
    config: {
      baseDir: dir,
      maxTokens: 500,
      critiqueMaxTokens: 100,
      concurrency: 2,
      timeoutMs: 5000,
      queueTimeoutMs: 5000,
      ...config,
    },
    llm,
    selection: selection ?? (() => ({ provider: 'p', model: 'm' })),
  })
  return { runtime, dir, storePath: path.join(dir, 'data', 'matrix.json') }
}

function llmWith(fn) {
  const calls = []
  return {
    calls,
    stream(options) {
      calls.push(options)
      return fn(options, calls)
    },
  }
}

function stopStream(text, usage = { inputTokens: 10, outputTokens: 5 }) {
  return (async function* () {
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text }
    yield { type: 'usage', usage }
    yield { type: 'finish', reason: { kind: 'stop' } }
  })()
}

test('first open returns the seed matrix and persists it once', async t => {
  const { runtime, storePath } = await makeRuntime(t, { llm: llmWith(() => stopStream(FAST_DRAFT)) })
  const state = await runtime.state()
  assert.equal(state.matrix.rows.length, 6)
  assert.equal(state.matrix.cols.length, 5)
  assert.equal(state.persisted, true)
  assert.equal(state.model.provider, 'p')
  assert.equal(state.storePath, storePath)
  const saved = JSON.parse(await readFile(storePath, 'utf8'))
  assert.equal(saved.rows.length, 6)
  assert.equal(saved.cols.length, 5)
})

test('generate streams, saves the cell and writes data/matrix.json', async t => {
  const { runtime, storePath } = await makeRuntime(t, {
    llm: llmWith(() => stopStream(FAST_DRAFT)),
  })
  const state = await runtime.state()
  const rowId = state.matrix.rows[0].id
  const colId = state.matrix.cols[0].id
  const events = []
  const result = await runtime.generate({ rowId, colId, onEvent: event => events.push(event) })

  assert.equal(result.persisted, true)
  assert.match(result.markdown, /测试结论/)
  assert.deepEqual(events.map(event => event.type), ['meta', 'stage', 'delta', 'done'])

  const saved = JSON.parse(await readFile(storePath, 'utf8'))
  assert.equal(saved.cells[`${rowId}:${colId}`].takeaway, '测试结论')

  const next = await runtime.state()
  assert.equal(next.persisted, true)
  assert.equal(next.matrix.cells[`${rowId}:${colId}`].takeaway, '测试结论')
})

test('a custom prompt is rendered with this cell before the model call', async t => {
  const llm = llmWith(() => stopStream(FAST_DRAFT))
  const { runtime } = await makeRuntime(t, { llm })
  const state = await runtime.state()
  const row = state.matrix.rows[0]
  const col = state.matrix.cols[0]
  await runtime.setPrompt({ prompt: '讨论 {纵标题} × {横标题}，主题：{主题}；坐标 {坐标}。' })
  await runtime.replaceAxes({ theme: '测试主题', rows: state.matrix.rows, cols: state.matrix.cols })

  await runtime.generate({ rowId: row.id, colId: col.id })
  const call = llm.calls.at(-1)
  assert.equal(call.system, `讨论 ${row.name} × ${col.name}，主题：测试主题；坐标 ${row.name} × ${col.name}。`)
  assert.doesNotMatch(call.system, /\{纵标题\}|\{横标题\}|\{主题\}|\{坐标\}/)
  // The stored prompt stays a template: only the outgoing message is filled.
  const next = await runtime.state()
  assert.match(next.matrix.prompt, /\{纵标题\}/)
})

test('promptFor previews a draft without saving it', async t => {
  const { runtime } = await makeRuntime(t, { llm: llmWith(() => stopStream(FAST_DRAFT)) })
  const state = await runtime.state()
  const row = state.matrix.rows[0]
  const col = state.matrix.cols[0]
  const draft = '草稿：{纵标题} / {横标题}'
  const preview = await runtime.promptFor({ rowId: row.id, colId: col.id, custom: draft })
  assert.equal(preview.template, draft)
  assert.equal(preview.system, `草稿：${row.name} / ${col.name}`)
  assert.equal(preview.vars.row, row.name)
  assert.equal(preview.user.includes(row.name), true)
  const next = await runtime.state()
  assert.equal(next.matrix.prompt, '')
})

test('a provider error preserves the previous cell content', async t => {
  const { runtime } = await makeRuntime(t, {
    llm: llmWith((_options, calls) => {
      if (calls.length === 1) return stopStream('> 一句话：旧结论\n\n旧正文')
      return (async function* () {
        yield { type: 'finish', reason: { kind: 'error', failure: { message: 'boom' } } }
      })()
    }),
  })
  const state = await runtime.state()
  const rowId = state.matrix.rows[0].id
  const colId = state.matrix.cols[0].id
  await runtime.generate({ rowId, colId })

  await assert.rejects(
    runtime.generate({ rowId, colId }),
    error => error.code === 'PROVIDER_ERROR' && /boom/.test(error.message),
  )
  const cell = await runtime.readCell({ rowId, colId })
  assert.equal(cell.cell.takeaway, '旧结论')
})

test('cancel aborts an in-flight generation without saving', async t => {
  const { runtime } = await makeRuntime(t, {
    llm: llmWith(options => (async function* () {
      await delay(80)
      if (options.signal?.aborted) {
        const error = new Error('aborted')
        error.name = 'AbortError'
        throw error
      }
      yield { type: 'text-delta', index: 0, text: FAST_DRAFT }
      yield { type: 'finish', reason: { kind: 'stop' } }
    })()),
  })
  const state = await runtime.state()
  const rowId = state.matrix.rows[0].id
  const colId = state.matrix.cols[0].id
  const running = runtime.generate({ rowId, colId })
  await delay(20)
  assert.equal(runtime.cancel({ rowId, colId }).cancelled, true)
  await assert.rejects(running, error => error.code === 'ABORTED')
  const cell = await runtime.readCell({ rowId, colId })
  assert.equal(cell.cell, null)
})

test('starting a second generation for the same cell aborts the first', async t => {
  const { runtime } = await makeRuntime(t, {
    llm: llmWith(options => (async function* () {
      await delay(60)
      if (options.signal?.aborted) {
        const error = new Error('aborted')
        error.name = 'AbortError'
        throw error
      }
      yield { type: 'text-delta', index: 0, text: FAST_DRAFT }
      yield { type: 'finish', reason: { kind: 'stop' } }
    })()),
  })
  const state = await runtime.state()
  const rowId = state.matrix.rows[0].id
  const colId = state.matrix.cols[0].id
  const first = runtime.generate({ rowId, colId })
  const second = runtime.generate({ rowId, colId })
  const settled = await Promise.allSettled([first, second])
  assert.equal(settled[0].status, 'rejected')
  assert.equal(settled[0].reason.code, 'ABORTED')
  assert.equal(settled[1].status, 'fulfilled')
  const saved = await runtime.state()
  assert.ok(saved.matrix.cells[`${rowId}:${colId}`])
})

test('deep mode runs a second red-team call and appends it', async t => {
  const calls = []
  const llm = {
    stream() {
      calls.push(1)
      if (calls.length === 1) return stopStream('> 一句话：草稿\n\n草稿正文')
      return stopStream('最脆弱的假设是 X。', { inputTokens: 20, outputTokens: 8 })
    },
  }
  const { runtime } = await makeRuntime(t, { llm })
  const state = await runtime.state()
  const rowId = state.matrix.rows[0].id
  const colId = state.matrix.cols[0].id
  const result = await runtime.generate({ rowId, colId, mode: 'deep' })
  assert.equal(calls.length, 2)
  assert.match(result.markdown, /## 独立红队审阅/)
  assert.match(result.markdown, /最脆弱的假设/)
  assert.equal(result.cell.mode, 'deep')
  assert.deepEqual(result.cell.usage, { inputTokens: 30, outputTokens: 13 })
})

test('axis replacement keeps renamed cells and removes deleted ones', async t => {
  const { runtime } = await makeRuntime(t, { llm: llmWith(() => stopStream(FAST_DRAFT)) })
  const state = await runtime.state()
  const row = state.matrix.rows[0]
  const col = state.matrix.cols[0]
  await runtime.generate({ rowId: row.id, colId: col.id })

  const first = await runtime.replaceAxes({
    theme: '新的主题',
    rows: [{ id: row.id, name: '改名后的模型', hint: row.hint }],
    cols: [{ id: col.id, name: col.name, hint: col.hint }],
  })
  assert.equal(first.matrix.theme, '新的主题')
  assert.ok(first.matrix.cells[`${row.id}:${col.id}`])

  const second = await runtime.replaceAxes({
    rows: [{ id: row.id, name: '改名后的模型', hint: '' }],
    cols: [{ name: '新列', hint: '' }],
  })
  assert.ok(second.removedCells >= 1)
  assert.equal(Object.keys(second.matrix.cells).length, 0)
})

test('upsertAxes adds a row without deleting anything', async t => {
  const { runtime } = await makeRuntime(t, { llm: llmWith(() => stopStream(FAST_DRAFT)) })
  const before = await runtime.state()
  const result = await runtime.upsertAxes({ rows: [{ name: '新模型', hint: '新提示' }] })
  assert.equal(result.matrix.rows.length, before.matrix.rows.length + 1)
  assert.equal(result.matrix.cols.length, before.matrix.cols.length)
})

test('a failed write is reported instead of being silently dropped', async t => {
  const { runtime, storePath } = await makeRuntime(t, { llm: llmWith(() => stopStream(FAST_DRAFT)) })
  await mkdir(storePath, { recursive: true })
  const state = await runtime.state()
  const rowId = state.matrix.rows[0].id
  const colId = state.matrix.cols[0].id
  assert.equal(state.storeError !== null, true)
  const result = await runtime.generate({ rowId, colId })
  assert.equal(result.persisted, false)
  assert.notEqual(result.storeError, null)
})

test('state reloads an externally edited matrix by mtime', async t => {
  const { runtime, storePath } = await makeRuntime(t, { llm: llmWith(() => stopStream(FAST_DRAFT)) })
  const initial = await runtime.state()
  await runtime.generate({ rowId: initial.matrix.rows[0].id, colId: initial.matrix.cols[0].id })
  const saved = JSON.parse(await readFile(storePath, 'utf8'))
  saved.theme = '外部修改'
  await delay(20)
  await writeFile(storePath, JSON.stringify(saved, null, 2), 'utf8')
  const state = await runtime.state()
  assert.equal(state.matrix.theme, '外部修改')
})

test('updateAxis renames an axis, edits its hint and keeps its cells', async t => {
  const { runtime } = await makeRuntime(t, { llm: llmWith(() => stopStream(FAST_DRAFT)) })
  const state = await runtime.state()
  const row = state.matrix.rows[0]
  const col = state.matrix.cols[0]
  await runtime.generate({ rowId: row.id, colId: col.id })
  const renamed = await runtime.updateAxis({ axis: 'row', id: row.id, name: '苹果派' })
  assert.equal(renamed.matrix.rows[0].name, '苹果派')
  assert.equal(renamed.matrix.rows[0].hint, row.hint)
  assert.ok(renamed.matrix.cells[`${row.id}:${col.id}`])
  const hinted = await runtime.updateAxis({ axis: 'row', id: row.id, hint: '  新的 简介  ' })
  assert.equal(hinted.matrix.rows[0].hint, '新的 简介')
  assert.equal(hinted.matrix.rows[0].name, '苹果派')
  await assert.rejects(
    runtime.updateAxis({ axis: 'row', id: row.id, name: state.matrix.rows[1].name }),
    error => error.code === 'DUPLICATE_AXIS',
  )
})

test('setModel stores a matrix-level model and resolves it first', async t => {
  const { runtime } = await makeRuntime(t, { llm: llmWith(() => stopStream(FAST_DRAFT)) })
  await runtime.state()
  const saved = await runtime.setModel({ provider: 'local', model: 'llama' })
  assert.deepEqual(saved.model, { provider: 'local', model: 'llama' })
  assert.equal(saved.persisted, true)
  const state = await runtime.state()
  assert.deepEqual(state.selectedModel, { provider: 'local', model: 'llama' })
  assert.equal(runtime.resolveRoute().provider, 'local')
  await runtime.setModel({ provider: '', model: '' })
  assert.equal((await runtime.state()).selectedModel, null)
})

test('modelsList lists providers, models and per-provider failures', async t => {
  const llm = {
    stream: () => stopStream(FAST_DRAFT),
    listProviders: () => [{ id: 'p', name: 'Provider P' }, { id: 'bad', name: 'Broken' }],
    listModels: async id => {
      if (id === 'bad') throw new Error('provider is offline')
      return [{ id: 'm1', name: 'Model 1' }, { id: 'm2', name: 'Model 2' }]
    },
  }
  const { runtime } = await makeRuntime(t, { llm })
  const result = await runtime.modelsList()
  assert.equal(result.providers.length, 2)
  assert.deepEqual(result.providers[0].models.map(model => model.id), ['m1', 'm2'])
  assert.match(result.providers[1].error, /offline/)
  assert.deepEqual(result.current, { provider: 'p', model: 'm' })
})

test('presets list, apply, save, read and delete', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creative-matrix-presets-'))
  t.after(async () => { await rm(dir, { recursive: true, force: true }) })
  const templates = path.join(dir, 'templates')
  await mkdir(templates, { recursive: true })
  await writeFile(path.join(templates, 'demo.md'), [
    '---',
    'title: 演示模板',
    'description: 一个测试用模板',
    'theme: 测试主题',
    'rows:',
    '  - name: 甲',
    '    hint: 第一个',
    '  - name: 乙',
    'cols:',
    '  - name: 子',
    '  - name: 丑',
    '---',
    '',
    '# 说明',
    '',
    '自定义说明。',
  ].join('\n'), 'utf8')
  const runtime = createRuntime({
    config: { baseDir: dir, templatesDir: templates, concurrency: 2, timeoutMs: 5000 },
    llm: llmWith(() => stopStream(FAST_DRAFT)),
    selection: () => ({ provider: 'p', model: 'm' }),
  })
  const listed = await runtime.listPresets()
  assert.equal(listed.presets.length, 1)
  assert.equal(listed.presets[0].source, 'builtin')
  assert.equal(listed.presets[0].file, 'demo.md')
  const applied = await runtime.applyPreset({ id: 'builtin:demo.md' })
  assert.equal(applied.matrix.rows[0].name, '甲')
  assert.equal(applied.matrix.cols.length, 2)
  assert.equal(applied.removedCells, 0)
  assert.deepEqual(applied.matrix.preset, { file: 'demo.md', title: '演示模板', source: 'builtin' })

  const saved = await runtime.savePreset({
    title: '我的模板',
    description: '我的说明',
    rows: [{ name: '一', hint: 'hint one' }],
    cols: [{ name: '二' }],
    body: '这是正文。',
    bind: true,
  })
  assert.match(saved.file, /我的模板\.md$/)
  assert.deepEqual(saved.matrix.preset, { file: saved.file, title: '我的模板', source: 'user' })
  assert.equal((await runtime.state()).matrix.preset.file, saved.file)
  const read = await runtime.readPreset({ id: `user:${saved.file}` })
  assert.equal(read.title, '我的模板')
  assert.equal(read.body, '这是正文。')
  assert.equal(read.rows[0].hint, 'hint one')
  const userListed = await runtime.listPresets()
  assert.ok(userListed.presets.some(preset => preset.source === 'user' && preset.file === saved.file))

  const duplicate = await runtime.savePreset({ title: '我的模板', rows: [{ name: '三' }], cols: [{ name: '四' }] })
  assert.notEqual(duplicate.file, saved.file)
  assert.match(duplicate.file, /我的模板-2\.md$/)

  await runtime.deletePreset({ file: saved.file })
  assert.ok(!(await runtime.listPresets()).presets.some(preset => preset.file === saved.file))
  assert.equal((await runtime.state()).matrix.preset, null, 'deleting the bound template clears the binding')
  await assert.rejects(runtime.deletePreset({ file: '../escape.md' }), error => error.code === 'BAD_PRESET')
})

test('built-in templates resolve per language with English and root fallbacks', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creative-matrix-lang-'))
  t.after(async () => { await rm(dir, { recursive: true, force: true }) })
  const templates = path.join(dir, 'templates')
  await mkdir(path.join(templates, 'en'), { recursive: true })
  const frontmatter = ({ title, row, body }) => [
    '---',
    `title: ${title}`,
    'rows:',
    `  - name: ${row}`,
    'cols:',
    '  - name: 场景',
    '---',
    '',
    body,
  ].join('\n')
  await writeFile(path.join(templates, 'demo.md'), frontmatter({ title: '演示模板', row: '甲', body: '# 说明\n\n中文正文。' }), 'utf8')
  await writeFile(path.join(templates, 'en', 'demo.md'), frontmatter({ title: 'Demo template', row: 'Alpha', body: '# About\n\nEnglish body.' }), 'utf8')
  // No translation for this one: the English list must still show it.
  await writeFile(path.join(templates, 'only-zh.md'), frontmatter({ title: '只有中文', row: '乙', body: '# 说明\n\n只有中文。' }), 'utf8')
  const runtime = createRuntime({
    config: { baseDir: dir, templatesDir: templates, concurrency: 2, timeoutMs: 5000 },
    llm: llmWith(() => stopStream(FAST_DRAFT)),
    selection: () => ({ provider: 'p', model: 'm' }),
  })

  const en = await runtime.listPresets({ lang: 'en-US' })
  assert.equal(en.lang, 'en')
  assert.equal(en.presets.length, 2, 'the same file must not be listed twice per language')
  assert.equal(en.presets.find(preset => preset.file === 'demo.md').title, 'Demo template')
  assert.equal(en.presets.find(preset => preset.file === 'only-zh.md').title, '只有中文')

  const readEn = await runtime.readPreset({ id: 'builtin:demo.md', lang: 'en' })
  assert.equal(readEn.title, 'Demo template')
  assert.match(readEn.body, /English body/)
  const applied = await runtime.applyPreset({ id: 'builtin:demo.md', lang: 'en' })
  assert.equal(applied.matrix.rows[0].name, 'Alpha')
  assert.equal(applied.matrix.preset.file, 'demo.md', 'the bound preset keeps its language-neutral file name')

  // No lang: the configured content language decides.
  const zh = await runtime.listPresets()
  assert.equal(zh.presets.find(preset => preset.file === 'demo.md').title, '演示模板')
  assert.equal((await runtime.readPreset({ id: 'builtin:demo.md' })).title, '演示模板')

  // A language with no directory falls back to English, then to the root copy.
  const ja = await runtime.listPresets({ lang: 'ja' })
  assert.equal(ja.presets.find(preset => preset.file === 'demo.md').title, 'Demo template')
  assert.equal(ja.presets.find(preset => preset.file === 'only-zh.md').title, '只有中文')
})

const TEMPLATE_REPLY = [
  '```yaml',
  'title: 谈判推演',
  'description: 把博弈模型放进具体谈判场景。',
  'theme: 商务谈判',
  'prompt: 说清这个模型在谈判里逼出了什么。直接写这一段，不要开场白。',
  'rows:',
  '  - name: 承诺的可信度',
  '    hint: 敢不敢把退路烧掉',
  '  - name: 信息不对称',
  'cols:',
  '  - name: 一对一谈判',
  '  - name: 多方混战',
  '```',
].join('\n')

test('draftPreset turns an idea into a template draft without touching the store', async t => {
  const llm = llmWith(() => stopStream(TEMPLATE_REPLY))
  const { runtime, dir } = await makeRuntime(t, { llm })
  // Force the one-time seed persist so data/matrix.json exists before the call.
  await runtime.state()
  const before = await readFile(path.join(dir, 'data', 'matrix.json'), 'utf8')

  const { draft, model } = await runtime.draftPreset({ idea: '谈判里的博弈模型' })
  assert.equal(draft.title, '谈判推演')
  assert.deepEqual(draft.rows.map(row => row.name), ['承诺的可信度', '信息不对称'])
  assert.match(draft.prompt, /^说清这个模型在谈判里逼出了什么/)
  assert.equal(model.provider, 'p')

  // The current matrix must be untouched and nothing written to presets/.
  assert.equal(await readFile(path.join(dir, 'data', 'matrix.json'), 'utf8'), before)
  assert.deepEqual((await runtime.listPresets()).presets.filter(p => p.source === 'user'), [])
  await assert.rejects(runtime.draftPreset({ idea: '  ' }), error => error.code === 'BAD_REQUEST')
})

test('draftPreset authors in the requested language', async t => {
  const llm = llmWith(() => stopStream(TEMPLATE_REPLY))
  const { runtime } = await makeRuntime(t, { llm })
  const userText = call => call.messages[0].content[0].text
  await runtime.draftPreset({ idea: '谈判里的博弈模型', lang: 'en' })
  assert.match(llm.calls[0].system, /You design matrix templates/)
  assert.match(userText(llm.calls[0]), /^Idea:/m)
  await runtime.draftPreset({ idea: '谈判里的博弈模型', lang: 'zh' })
  assert.match(llm.calls[1].system, /矩阵模板作者/)
  assert.match(userText(llm.calls[1]), /^想法：/m)
})

test('draftPreset keeps the current theme and prompt when the model omits them', async t => {
  const reply = [
    '```yaml',
    'title: 省略主题与提示词',
    'rows:',
    '  - name: 甲',
    'cols:',
    '  - name: 乙',
    '```',
  ].join('\n')
  const llm = llmWith(() => stopStream(reply))
  const { runtime } = await makeRuntime(t, { llm })
  await runtime.setPrompt({ prompt: '自定义提示词。' })
  const state = await runtime.state()
  const theme = state.matrix.theme

  const { draft } = await runtime.draftPreset({ idea: '随便' })
  assert.equal(draft.theme, theme)
  assert.equal(draft.prompt, '自定义提示词。')
})

test('draftPreset reports BAD_TEMPLATE when the model rambles', async t => {
  const { runtime } = await makeRuntime(t, { llm: llmWith(() => stopStream('这个想法很好，但我需要更多信息。')) })
  await assert.rejects(
    runtime.draftPreset({ idea: '随便' }),
    error => error.code === 'BAD_TEMPLATE',
  )
})

test('refinePreset rewrites a user preset in place and keeps its body', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creative-matrix-refine-'))
  t.after(async () => { await rm(dir, { recursive: true, force: true }) })
  const templates = path.join(dir, 'templates')
  await mkdir(templates, { recursive: true })
  await writeFile(path.join(templates, 'demo.md'), [
    '---',
    'title: 演示模板',
    'description: 一个测试用模板',
    'theme: 测试主题',
    'rows:',
    '  - name: 甲',
    'cols:',
    '  - name: 子',
    '---',
    '',
    '# 说明',
    '',
    '自定义说明。',
  ].join('\n'), 'utf8')

  const replies = [TEMPLATE_REPLY]
  const llm = llmWith(() => stopStream(replies[replies.length - 1]))
  const runtime = createRuntime({
    config: { baseDir: dir, templatesDir: templates, concurrency: 2, timeoutMs: 5000 },
    llm,
    selection: () => ({ provider: 'p', model: 'm' }),
  })

  const saved = await runtime.savePreset({
    title: '演示模板副本',
    description: '一个测试用模板',
    rows: [{ name: '甲' }],
    cols: [{ name: '子' }],
    body: '# 说明\n\n自定义说明。',
  })

  const refined = await runtime.refinePreset({ id: `user:${saved.file}`, idea: '换成谈判主题' })
  assert.equal(refined.file, saved.file, 'refine must write back to the same file')
  assert.equal(refined.preset.title, '谈判推演')
  assert.equal(refined.preset.body, '# 说明\n\n自定义说明。', 'the prose body stays as it was')
  const userListed = (await runtime.listPresets()).presets.filter(p => p.source === 'user')
  assert.equal(userListed.length, 1)
  assert.equal(userListed[0].title, '谈判推演')

  await assert.rejects(
    runtime.refinePreset({ id: 'builtin:demo.md', idea: '改一下' }),
    error => error.code === 'BUILTIN_PRESET',
  )
  await assert.rejects(
    runtime.refinePreset({ id: `user:${saved.file}`, idea: '  ' }),
    error => error.code === 'BAD_REQUEST',
  )
})

test('custom prompt is persisted, used by generate and carried by presets', async t => {
  const llm = llmWith(() => stopStream(FAST_DRAFT))
  const { runtime, dir } = await makeRuntime(t, { llm })
  const state = await runtime.state()
  const rowId = state.matrix.rows[0].id
  const colId = state.matrix.cols[0].id
  const custom = '你是测试助手。\n只输出一句话。'

  const promptResult = await runtime.setPrompt({ prompt: custom })
  assert.equal(promptResult.matrix.prompt, custom)
  assert.equal((await runtime.state()).matrix.prompt, custom)

  await runtime.generate({ rowId, colId })
  assert.equal(llm.calls[llm.calls.length - 1].system, custom)

  const saved = await runtime.savePreset({ title: '带提示词模板' })
  assert.equal(saved.preset.prompt, custom)
  const file = await readFile(path.join(dir, 'presets', saved.file), 'utf8')
  assert.match(file, /prompt: \|/)
  assert.doesNotMatch(file, /测试结论/, 'templates must not store generated cells')

  await runtime.setPrompt({ prompt: '' })
  await runtime.applyPreset({ id: `user:${saved.file}` })
  assert.equal((await runtime.state()).matrix.prompt, custom)
})

test('custom user prompt is persisted, used by generate and carried by presets', async t => {
  const llm = llmWith(() => stopStream(FAST_DRAFT))
  const { runtime, dir } = await makeRuntime(t, { llm })
  const state = await runtime.state()
  const row = state.matrix.rows[0]
  const col = state.matrix.cols[0]
  const customUser = '模型：{纵标题}\n主题：{主题}'

  const result = await runtime.setPrompt({ prompt: '系统提示。', userPrompt: customUser })
  assert.equal(result.matrix.userPrompt, customUser)
  assert.equal((await runtime.state()).matrix.userPrompt, customUser)

  await runtime.generate({ rowId: row.id, colId: col.id })
  const call = llm.calls.at(-1)
  assert.equal(call.system, '系统提示。')
  const user = call.messages[0].content[0].text
  assert.match(user, new RegExp(`模型：${row.name}`))
  assert.match(user, /主题：/)
  assert.doesNotMatch(user, /\{纵标题\}|\{主题\}/)

  const saved = await runtime.savePreset({ title: '带用户模板' })
  assert.equal(saved.preset.userPrompt, customUser)
  const file = await readFile(path.join(dir, 'presets', saved.file), 'utf8')
  assert.match(file, /userPrompt: \|/)

  const preview = await runtime.promptFor({
    rowId: row.id,
    colId: col.id,
    custom: 'S {横标题}',
    userCustom: 'U {横标题}',
  })
  assert.equal(preview.userTemplate, 'U {横标题}')
  assert.equal(preview.user, `U ${col.name}`)

  await runtime.setPrompt({ prompt: '', userPrompt: '' })
  await runtime.applyPreset({ id: `user:${saved.file}` })
  assert.equal((await runtime.state()).matrix.userPrompt, customUser)
})

test('batchGenerate generates a row, skips filled cells and reports progress', async t => {
  const { runtime } = await makeRuntime(t, { llm: llmWith(() => stopStream(FAST_DRAFT)) })
  const state = await runtime.state()
  const rowId = state.matrix.rows[0].id
  const events = []
  const summary = await runtime.batchGenerate({
    scope: 'row',
    rowId,
    onEvent: event => events.push(event),
  })
  assert.equal(summary.total, 5)
  assert.equal(summary.completed, 5)
  assert.equal(summary.failed, 0)
  assert.equal(events.filter(event => event.type === 'cell.done').length, 5)
  const after = await runtime.state()
  assert.equal(Object.keys(after.matrix.cells).length, 5)
  assert.equal(after.batch.done, true)
  const again = await runtime.batchGenerate({ scope: 'row', rowId, onlyEmpty: true })
  assert.equal(again.total, 0)
  assert.equal(again.skipped, 5)
})

test('concurrency 0 starts every cell at once and setConcurrency throttles later batches', async t => {
  let active = 0
  let peak = 0
  const llm = {
    stream: options => (async function* () {
      active += 1
      peak = Math.max(peak, active)
      try {
        await delay(25)
        if (options.signal?.aborted) {
          const error = new Error('aborted')
          error.name = 'AbortError'
          throw error
        }
        yield { type: 'text-delta', index: 0, text: FAST_DRAFT }
        yield { type: 'finish', reason: { kind: 'stop' } }
      } finally {
        active -= 1
      }
    })(),
  }
  const { runtime } = await makeRuntime(t, { llm, config: { concurrency: 0 } })
  const state = await runtime.state()
  assert.equal(state.concurrency, 0)
  const rowId = state.matrix.rows[0].id

  const first = await runtime.batchGenerate({ scope: 'row', rowId })
  assert.equal(first.completed, 5)
  assert.equal(peak, 5, 'the default batch starts every cell at once')

  peak = 0
  assert.deepEqual(runtime.setConcurrency({ concurrency: 1 }), { concurrency: 1 })
  assert.equal((await runtime.state()).concurrency, 1)
  const second = await runtime.batchGenerate({ scope: 'row', rowId, onlyEmpty: false })
  assert.equal(second.completed, 5)
  assert.equal(peak, 1, 'a limit of 1 runs the batch one cell at a time')
})

test('cancelBatch stops the loop after the current cell', async t => {
  const llm = {
    stream: options => (async function* () {
      await delay(60)
      if (options.signal?.aborted) {
        const error = new Error('aborted')
        error.name = 'AbortError'
        throw error
      }
      yield { type: 'text-delta', index: 0, text: FAST_DRAFT }
      yield { type: 'finish', reason: { kind: 'stop' } }
    })(),
  }
  const { runtime } = await makeRuntime(t, { llm })
  const state = await runtime.state()
  const rowId = state.matrix.rows[0].id
  const running = runtime.batchGenerate({ scope: 'row', rowId })
  await delay(20)
  assert.equal(runtime.cancelBatch().cancelled, true)
  const summary = await running
  assert.ok(summary.completed < 5)
  assert.equal((await runtime.state()).batch.done, true)
})

test('missing model selection fails with NO_MODEL before calling the model', async t => {
  const llm = llmWith(() => stopStream(FAST_DRAFT))
  const { runtime } = await makeRuntime(t, {
    llm,
    selection: () => { throw new Error('not configured') },
  })
  const state = await runtime.state()
  assert.equal(state.modelError.code, 'NO_MODEL')
  const rowId = state.matrix.rows[0].id
  const colId = state.matrix.cols[0].id
  await assert.rejects(runtime.generate({ rowId, colId }), error => error.code === 'NO_MODEL')
  assert.equal(llm.calls.length, 0)
})
test('prepareCall is used and selects the least reasoning effort by default', async t => {
  const prepared = []
  const llm = {
    stream() { throw new Error('direct stream must not be used when prepareCall exists') },
    async prepareCall(config, _signal, configure) {
      const controls = configure(
        { maxTokens: config.maxTokens, temperature: config.temperature },
        { reasoning: { efforts: [{ id: 'low' }, { id: 'high' }] } },
      )
      prepared.push(controls)
      return {
        config: { ...config, ...controls },
        stream: () => stopStream(FAST_DRAFT),
      }
    },
  }
  const { runtime } = await makeRuntime(t, { llm })
  const state = await runtime.state()
  const rowId = state.matrix.rows[0].id
  const colId = state.matrix.cols[0].id
  const result = await runtime.generate({ rowId, colId })
  assert.equal(prepared.length, 1)
  assert.equal(prepared[0].reasoningEffort, 'low')
  assert.match(result.markdown, /测试结论/)
})

test('a custom matrix prompt reaches the model through prepareCall', async t => {
  const custom = '你是自定义助手。只输出一句话。'
  let streamedConfig = null
  const llm = {
    stream() { throw new Error('direct stream must not be used when prepareCall exists') },
    async prepareCall(config, _signal, configure) {
      const controls = configure(
        { maxTokens: config.maxTokens, temperature: config.temperature },
        { reasoning: { efforts: [{ id: 'low' }] } },
      )
      return {
        // A host that materializes adapter defaults must not be able to bake a
        // default system prompt in here and silently outrank the matrix one.
        config: { ...config, system: '宿主默认 system', ...controls },
        stream: callConfig => {
          streamedConfig = callConfig
          return stopStream(FAST_DRAFT)
        },
      }
    },
  }
  const { runtime } = await makeRuntime(t, { llm })
  const state = await runtime.state()
  const rowId = state.matrix.rows[0].id
  const colId = state.matrix.cols[0].id
  await runtime.setPrompt({ prompt: custom })
  await runtime.generate({ rowId, colId })
  assert.equal(streamedConfig.system, custom)
})
