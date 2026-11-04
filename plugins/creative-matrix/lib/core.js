// Host runtime for Gezhi Matrix: one in-memory matrix, one serialized
// writer, one generation queue. Both the Web panel and the agent tool call
// these same methods.
//
// Dependencies are injected (`llm`, `selection`) so the whole runtime can be
// exercised with a fake model in `node --test`.

import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  LIMITS,
  MatrixError,
  cellKey,
  cellSummary,
  exportMarkdown,
  extractTakeaway,
  findCol,
  findRow,
  makeId,
  matrixSummary,
  normalizeMatrix,
  parseCellKey,
  replaceAxes,
  upsertAxes,
} from './matrix.js'
import {
  PRESET_MAX,
  parsePreset,
  parseTemplateReply,
  presetAxes,
  presetFilename,
  serializePreset,
} from './presets.js'
import { createSeedMatrix } from './seed.js'
import {
  buildCritiqueSystem,
  buildCritiqueUser,
  buildRefineSystem,
  buildRefineUser,
  buildSystem,
  buildTemplateSystem,
  buildTemplateUser,
  buildUser,
  defaultSystem,
  defaultUser,
  previewPrompt,
  promptVars,
  templateYaml,
} from './prompt.js'

export class RuntimeError extends Error {
  constructor(code, message, status = 500) {
    super(message)
    this.name = 'RuntimeError'
    this.code = code
    this.status = status
  }
}

function clampInt(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

// Built-in templates may ship one translation directory per language
// (`templates/en/`, `templates/ja/`, …). The tag is reduced to its primary
// subtag and kept to ASCII letters so it can never escape the templates
// directory; anything unusable falls back to the matrix content language.
function presetLanguage(value, fallback = 'zh') {
  const primary = String(value ?? '').trim().toLowerCase().split(/[-_]/)[0]
  return /^[a-z]{2,8}$/.test(primary) ? primary : fallback
}

function resolveConfig(input = {}) {
  const baseDir = typeof input.baseDir === 'string' && input.baseDir.trim() !== ''
    ? path.resolve(input.baseDir)
    : path.resolve('.')
  const storePath = typeof input.storePath === 'string' && input.storePath.trim() !== ''
    ? path.resolve(baseDir, input.storePath)
    : path.join(baseDir, 'data', 'matrix.json')
  const presetsDir = typeof input.presetsDir === 'string' && input.presetsDir.trim() !== ''
    ? path.resolve(baseDir, input.presetsDir)
    : path.join(baseDir, 'presets')
  const templatesDir = typeof input.templatesDir === 'string' && input.templatesDir.trim() !== ''
    ? path.resolve(input.templatesDir)
    : ''
  return {
    baseDir,
    storePath,
    presetsDir,
    templatesDir,
    provider: typeof input.provider === 'string' ? input.provider.trim() : '',
    model: typeof input.model === 'string' ? input.model.trim() : '',
    // One cell is ~150 characters plus a takeaway line, so ~250 tokens of text.
    // The cap is headroom, not a length control; it only stops a runaway.
    maxTokens: clampInt(input.maxTokens, 256, 8192, 500),
    critiqueMaxTokens: clampInt(input.critiqueMaxTokens, 128, 4096, 200),
    temperature: (() => {
      const number = Number(input.temperature)
      return Number.isFinite(number) ? Math.min(2, Math.max(0, number)) : 0.85
    })(),
    outputLanguage: String(input.outputLanguage ?? 'zh').toLowerCase().startsWith('en') ? 'en' : 'zh',
    // '' = the least reasoning effort the model supports; 'selection' = the
    // effort carried by agentDefaultModel; any other value is passed through.
    reasoningEffort: typeof input.reasoningEffort === 'string' ? input.reasoningEffort.trim() : '',
    // 0 = no cap: a batch fires every cell at once. The panel exposes a
    // per-run choice; this is the starting value (and the config default).
    concurrency: clampInt(input.concurrency, 0, 32, 0),
    timeoutMs: clampInt(input.timeoutMs, 30_000, 600_000, 180_000),
    queueTimeoutMs: clampInt(input.queueTimeoutMs, 5_000, 120_000, 30_000),
  }
}

function mergeUsage(left, right) {
  if (right === undefined || right === null) return left ?? null
  if (left === undefined || left === null) {
    return {
      inputTokens: Number(right.inputTokens) || 0,
      outputTokens: Number(right.outputTokens) || 0,
    }
  }
  return {
    inputTokens: (Number(left.inputTokens) || 0) + (Number(right.inputTokens) || 0),
    outputTokens: (Number(left.outputTokens) || 0) + (Number(right.outputTokens) || 0),
  }
}

function createLimiter(initialLimit, queueTimeoutMs) {
  let limit = initialLimit
  let active = 0
  const waiting = []

  function pump() {
    while ((limit <= 0 || active < limit) && waiting.length > 0) {
      const item = waiting.shift()
      active += 1
      clearTimeout(item.timer)
      item.signal?.removeEventListener('abort', item.onAbort)
      Promise.resolve()
        .then(item.fn)
        .then(value => item.resolve(value), error => item.reject(error))
        .finally(() => {
          active -= 1
          pump()
        })
    }
  }

  function run(fn, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new RuntimeError('ABORTED', 'generation aborted', 499))
        return
      }
      const item = { fn, signal, resolve, reject }
      item.onAbort = () => {
        const at = waiting.indexOf(item)
        if (at < 0) return
        waiting.splice(at, 1)
        clearTimeout(item.timer)
        reject(new RuntimeError('ABORTED', 'generation aborted', 499))
      }
      item.timer = setTimeout(() => {
        const at = waiting.indexOf(item)
        if (at < 0) return
        waiting.splice(at, 1)
        signal?.removeEventListener('abort', item.onAbort)
        reject(new RuntimeError('TOO_MANY', 'generation queue is full; try again shortly', 429))
      }, queueTimeoutMs)
      signal?.addEventListener('abort', item.onAbort, { once: true })
      waiting.push(item)
      pump()
    })
  }

  run.setLimit = value => {
    limit = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : limit
    pump()
  }
  run.getLimit = () => limit
  return run
}

export function createRuntime({ storePath, config = {}, llm, selection, now = Date.now, log = () => {} }) {
  const resolved = resolveConfig({ ...config, storePath: storePath ?? config.storePath })
  let concurrency = resolved.concurrency
  const limit = createLimiter(concurrency, resolved.queueTimeoutMs)

  let matrix = null
  let loaded = false
  let persisted = false
  let warnings = []
  let storeError = null
  let loadedMtime = 0
  let writeChain = Promise.resolve()
  let modelsCache = { at: 0, value: null }
  let activeBatch = null

  const live = new Map()
  const controllers = new Map()

  function emit(onEvent, event) {
    try {
      onEvent(event)
    } catch (error) {
      log('event listener failed:', error?.message ?? error)
    }
  }

  function mapError(error) {
    if (error instanceof RuntimeError) return error
    if (error instanceof MatrixError) return new RuntimeError(error.code, error.message, 400)
    if (error?.name === 'AbortError') return new RuntimeError('ABORTED', 'generation aborted', 499)
    return new RuntimeError('GENERATION_FAILED', String(error?.message ?? error), 500)
  }

  async function syncFromDisk({ force = false, seedWhenMissing = false } = {}) {
    try {
      const info = await stat(resolved.storePath)
      if (!force && loaded && info.mtimeMs === loadedMtime) return
      if (info.size > LIMITS.file) {
        throw new MatrixError('STORE_TOO_LARGE', `matrix store exceeds ${LIMITS.file} bytes`)
      }
      const raw = await readFile(resolved.storePath, 'utf8')
      const parsed = JSON.parse(raw)
      const normalized = normalizeMatrix(parsed, { now: now() })
      matrix = normalized.matrix
      warnings = normalized.warnings
      persisted = true
      loaded = true
      loadedMtime = info.mtimeMs
      storeError = null
    } catch (error) {
      if (error?.code === 'ENOENT') {
        if (matrix === null && seedWhenMissing) {
          matrix = createSeedMatrix(makeId, now())
          warnings = []
          persisted = false
          loaded = true
          storeError = null
          // Persist the seed once so its ids stay stable across Host reloads.
          await persist()
          return
        }
        loaded = true
        loadedMtime = 0
        storeError = null
        return
      }
      if (matrix === null) {
        matrix = createSeedMatrix(makeId, now())
      }
      loaded = true
      persisted = false
      storeError = {
        code: error instanceof MatrixError
          ? error.code
          : error instanceof SyntaxError
            ? 'STORE_INVALID'
            : 'STORE_IO',
        message: error instanceof SyntaxError
          ? 'matrix file is not valid JSON'
          : String(error?.message ?? error),
      }
    }
  }

  async function ensureLoaded() {
    if (!loaded) await syncFromDisk({ force: true, seedWhenMissing: true })
  }

  async function persist() {
    const snapshot = JSON.stringify(matrix, null, 2)
    const run = writeChain.catch(() => {}).then(async () => {
      await mkdir(path.dirname(resolved.storePath), { recursive: true })
      // A corrupt-but-readable store must not be silently overwritten: keep a
      // backup before the first successful write.
      if (storeError !== null && ['STORE_INVALID', 'STORE_VERSION', 'STORE_TOO_LARGE'].includes(storeError.code)) {
        try {
          await rename(resolved.storePath, `${resolved.storePath}.bak-${now()}`)
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error
        }
      }
      const temporary = `${resolved.storePath}.tmp`
      await writeFile(temporary, snapshot, 'utf8')
      await rename(temporary, resolved.storePath)
      const info = await stat(resolved.storePath)
      loadedMtime = info.mtimeMs
      persisted = true
      storeError = null
    })
    writeChain = run
    try {
      await run
      return true
    } catch (error) {
      persisted = false
      storeError = {
        code: 'STORE_WRITE',
        message: [error?.code, String(error?.message ?? error)].filter(Boolean).join(' '),
      }
      return false
    }
  }

  function resolveRoute() {
    if (resolved.provider !== '' && resolved.model !== '') {
      return { provider: resolved.provider, model: resolved.model, reasoningEffort: undefined }
    }
    if (matrix?.model?.provider && matrix?.model?.model) {
      return { provider: matrix.model.provider, model: matrix.model.model, reasoningEffort: undefined }
    }
    let selected
    try {
      selected = selection?.()
    } catch (error) {
      throw new RuntimeError(
        'NO_MODEL',
        `cannot read the default model selection: ${String(error?.message ?? error)}`,
        409,
      )
    }
    if (selected === null || selected === undefined || selected.provider === undefined || selected.model === undefined) {
      throw new RuntimeError(
        'NO_MODEL',
        'no default model is configured; pick one in Settings or set provider/model in the plugin config',
        409,
      )
    }
    return {
      provider: String(selected.provider),
      model: String(selected.model),
      reasoningEffort: selected.reasoningEffort,
    }
  }

  function assertCell(rowId, colId) {
    const row = findRow(matrix, rowId)
    const col = findCol(matrix, colId)
    if (row === undefined) throw new RuntimeError('UNKNOWN_ROW', `unknown row: ${String(rowId)}`, 404)
    if (col === undefined) throw new RuntimeError('UNKNOWN_COL', `unknown column: ${String(colId)}`, 404)
    return { row, col }
  }

  async function runStage({ route, system, user, maxTokens, signal, onDelta }) {
    const timeout = AbortSignal.timeout(resolved.timeoutMs)
    const combined = AbortSignal.any([signal, timeout])
    let text = ''
    let blockText = ''
    let usage = null
    let finishKind = ''
    try {
      let stream
      if (typeof llm.prepareCall === 'function') {
        // prepareCall materializes adapter defaults and lets us pick the
        // least reasoning effort: high effort can spend the whole output
        // budget before the first text token.
        const prepared = await llm.prepareCall(
          { provider: route.provider, model: route.model, maxTokens, temperature: resolved.temperature },
          combined,
          (controls, model) => {
            const efforts = Array.isArray(model?.reasoning?.efforts) ? model.reasoning.efforts : []
            const chosen = resolved.reasoningEffort === 'selection'
              ? route.reasoningEffort
              : resolved.reasoningEffort !== ''
                ? resolved.reasoningEffort
                : efforts[0]?.id
            return chosen === undefined ? controls : { ...controls, reasoningEffort: chosen }
          },
        )
        // The merged config is the whole call: pass system/messages/signal
        // inside it, not as a second argument. A host that bakes its default
        // system prompt into prepared.config must not silently win over a
        // custom matrix prompt — later spread keys always do, top-level ones
        // may be ignored entirely.
        stream = prepared.stream({
          ...prepared.config,
          system,
          messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
          signal: combined,
        })
      } else {
        stream = llm.stream({
          provider: route.provider,
          model: route.model,
          ...(route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort }),
          system,
          messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
          maxTokens,
          temperature: resolved.temperature,
          signal: combined,
        })
      }
      for await (const chunk of stream) {
        if (chunk?.type === 'text-delta') {
          text += chunk.text
          onDelta(chunk.text)
          continue
        }
        if (chunk?.type === 'block-end' && chunk.block?.type === 'text') {
          // Some adapters deliver the block only here; deltas may be absent.
          blockText += chunk.block.text
          if (text === '') onDelta(chunk.block.text)
          continue
        }
        if (chunk?.type === 'usage') {
          usage = mergeUsage(usage, chunk.usage)
          continue
        }
        if (chunk?.type === 'finish') {
          const reason = chunk.reason
          finishKind = String(reason?.kind ?? '')
          if (reason?.kind === 'error') {
            throw new RuntimeError(
              'PROVIDER_ERROR',
              String(reason.failure?.message ?? 'model call failed'),
              500,
            )
          }
          if (reason?.kind === 'aborted') {
            throw new RuntimeError(
              timeout.aborted ? 'TIMEOUT' : 'ABORTED',
              timeout.aborted ? `model call timed out after ${resolved.timeoutMs} ms` : 'generation aborted',
              timeout.aborted ? 504 : 499,
            )
          }
        }
      }
    } catch (error) {
      if (error instanceof RuntimeError) throw error
      if (combined.aborted) {
        throw new RuntimeError(
          timeout.aborted ? 'TIMEOUT' : 'ABORTED',
          timeout.aborted ? `model call timed out after ${resolved.timeoutMs} ms` : 'generation aborted',
          timeout.aborted ? 504 : 499,
        )
      }
      throw new RuntimeError('PROVIDER_ERROR', String(error?.message ?? error), 500)
    }
    if (combined.aborted) {
      throw new RuntimeError(
        timeout.aborted ? 'TIMEOUT' : 'ABORTED',
        timeout.aborted ? `model call timed out after ${resolved.timeoutMs} ms` : 'generation aborted',
        timeout.aborted ? 504 : 499,
      )
    }
    const finalText = (blockText !== '' ? blockText : text).trim()
    if (finalText === '') {
      throw new RuntimeError(
        'EMPTY_RESPONSE',
        finishKind === 'max-tokens'
          ? 'the model used the whole output budget before writing text; lower reasoningEffort or raise maxTokens'
          : 'the model returned no text',
        502,
      )
    }
    return { text: finalText, usage }
  }

  async function state() {
    await ensureLoaded()
    if (live.size === 0) await syncFromDisk({ force: false })
    let model = null
    let modelError = null
    try {
      const route = resolveRoute()
      model = { provider: route.provider, model: route.model }
    } catch (error) {
      modelError = { code: error.code ?? 'NO_MODEL', message: String(error.message ?? error) }
    }
    return {
      matrix: matrixSummary(matrix),
      persisted,
      storePath: resolved.storePath,
      warning: warnings.length > 0 ? warnings.slice(0, 8) : null,
      storeError,
      model,
      selectedModel: matrix.model ?? null,
      modelError,
      concurrency,
      batch: activeBatch === null
        ? null
        : {
          id: activeBatch.id,
          total: activeBatch.total,
          completed: activeBatch.completed,
          failed: activeBatch.failed,
          skipped: activeBatch.skipped,
          currentKey: activeBatch.currentKey,
          currentKeys: [...activeBatch.currentKeys],
          concurrency: activeBatch.concurrency,
          startedAt: activeBatch.startedAt,
          done: activeBatch.done,
          failures: activeBatch.failures.slice(0, 5),
        },
      generating: [...live.entries()].map(([key, entry]) => ({
        key,
        stage: entry.stage,
        startedAt: entry.startedAt,
        textTail: entry.text.slice(-300),
      })),
    }
  }

  async function readCell({ rowId, colId }) {
    await ensureLoaded()
    const { row, col } = assertCell(rowId, colId)
    const key = cellKey(row.id, col.id)
    return {
      key,
      row,
      col,
      cell: matrix.cells[key] ?? null,
      summary: cellSummary(matrix.cells[key]),
      live: live.get(key) ?? null,
      persisted,
    }
  }

  async function writeCell({ rowId, colId, markdown }) {
    await ensureLoaded()
    const { row, col } = assertCell(rowId, colId)
    const value = String(markdown ?? '').trim()
    if (value === '') throw new RuntimeError('BAD_REQUEST', 'markdown must not be empty', 400)
    if (value.length > LIMITS.markdown) {
      throw new RuntimeError('BAD_REQUEST', `markdown exceeds ${LIMITS.markdown} characters`, 400)
    }
    const key = cellKey(row.id, col.id)
    const previous = matrix.cells[key]
    const cell = {
      markdown: value,
      takeaway: extractTakeaway(value),
      mode: 'manual',
      hint: previous?.hint ?? '',
      model: previous?.model,
      usage: previous?.usage,
      edited: true,
      updatedAt: now(),
    }
    matrix = { ...matrix, cells: { ...matrix.cells, [key]: cell }, updatedAt: now() }
    const saved = await persist()
    return { key, cell: cellSummary(cell), markdown: cell.markdown, persisted: saved, storeError }
  }

  async function clearCell({ rowId, colId }) {
    await ensureLoaded()
    const { row, col } = assertCell(rowId, colId)
    const key = cellKey(row.id, col.id)
    if (matrix.cells[key] !== undefined) {
      const cells = { ...matrix.cells }
      delete cells[key]
      matrix = { ...matrix, cells, updatedAt: now() }
    }
    const saved = await persist()
    return { key, persisted: saved, storeError }
  }

  async function replaceAllAxes(input) {
    await ensureLoaded()
    const result = replaceAxes(matrix, input, { now: now() })
    matrix = result.matrix
    warnings = result.warnings
    const saved = await persist()
    return {
      matrix: matrixSummary(matrix),
      removedCells: result.removedCells,
      persisted: saved,
      storeError,
    }
  }

  async function upsertAllAxes(input) {
    await ensureLoaded()
    const result = upsertAxes(matrix, input, { now: now() })
    matrix = result.matrix
    warnings = result.warnings
    const saved = await persist()
    return { matrix: matrixSummary(matrix), persisted: saved, storeError }
  }

  function providerList() {
    try {
      return typeof llm.listProviders === 'function' ? llm.listProviders() : null
    } catch {
      return null
    }
  }

  function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms)
      Promise.resolve(promise).then(
        value => { clearTimeout(timer); resolve(value) },
        error => { clearTimeout(timer); reject(error) },
      )
    })
  }

  async function modelsList({ refresh = false } = {}) {
    await ensureLoaded()
    if (!refresh && modelsCache.value !== null && now() - modelsCache.at < 60_000) return modelsCache.value
    const providers = providerList()
    const route = (() => {
      try { return resolveRoute() } catch { return null }
    })()
    if (providers === null) {
      const value = {
        providers: [],
        current: route === null ? null : { provider: route.provider, model: route.model },
        selectedModel: matrix.model ?? null,
        error: 'the llm service does not expose listProviders()',
        at: now(),
      }
      modelsCache = { at: now(), value }
      return value
    }
    const entries = await Promise.all(providers.map(async provider => {
      const id = String(provider.id)
      const name = String(provider.name ?? provider.id)
      if (typeof llm.listModels !== 'function') {
        return { id, name, models: [], error: 'model listing is unavailable' }
      }
      try {
        const models = await withTimeout(llm.listModels(id), 12_000, `listing models for ${id}`)
        return {
          id,
          name,
          models: (Array.isArray(models) ? models : []).map(model => ({
            id: String(model.id),
            name: String(model.name ?? model.id),
            description: model.description === undefined ? '' : String(model.description),
          })),
          error: null,
        }
      } catch (error) {
        return { id, name, models: [], error: String(error?.message ?? error) }
      }
    }))
    const value = {
      providers: entries,
      current: route === null ? null : { provider: route.provider, model: route.model },
      selectedModel: matrix.model ?? null,
      error: null,
      at: now(),
    }
    modelsCache = { at: now(), value }
    return value
  }

  async function setModel({ provider = '', model = '' } = {}) {
    await ensureLoaded()
    const nextProvider = String(provider ?? '').trim()
    const nextModel = String(model ?? '').trim()
    if (nextProvider === '' || nextModel === '') {
      matrix = { ...matrix, model: null, updatedAt: now() }
    } else {
      const providers = providerList()
      if (providers !== null && providers.length > 0 && !providers.some(item => String(item.id) === nextProvider)) {
        throw new RuntimeError('BAD_MODEL', `unknown model provider: ${nextProvider}`, 400)
      }
      matrix = {
        ...matrix,
        model: { provider: nextProvider, model: nextModel },
        updatedAt: now(),
      }
    }
    modelsCache = { at: 0, value: null }
    const saved = await persist()
    return { model: matrix.model, selectedModel: matrix.model, persisted: saved, storeError }
  }

  async function updateAxis({ axis, id, name, hint } = {}) {
    await ensureLoaded()
    const which = axis === 'col' ? 'cols' : axis === 'row' ? 'rows' : ''
    if (which === '') throw new RuntimeError('BAD_REQUEST', 'axis must be "row" or "col"', 400)
    const list = matrix[which]
    const index = list.findIndex(item => item.id === String(id))
    if (index < 0) throw new RuntimeError('UNKNOWN_AXIS', `unknown ${which.slice(0, -1)}: ${String(id)}`, 404)
    const current = list[index]
    let nextName = current.name
    if (name !== undefined) {
      nextName = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.name)
      if (nextName === '') throw new RuntimeError('BAD_REQUEST', 'axis name must not be empty', 400)
      if (list.some((item, at) => at !== index && item.name === nextName)) {
        throw new RuntimeError('DUPLICATE_AXIS', `duplicate axis name: ${nextName}`, 400)
      }
    }
    const nextHint = hint === undefined
      ? current.hint
      : String(hint ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.hint)
    const next = list.map((item, at) => at === index
      ? { ...item, name: nextName, hint: nextHint }
      : item)
    matrix = { ...matrix, [which]: next, updatedAt: now() }
    const saved = await persist()
    return { matrix: matrixSummary(matrix), persisted: saved, storeError }
  }

  // The per-matrix system and user prompt templates. Empty string = the
  // built-in default; the panel's prompt editor and templates both write them.
  async function setPrompt({ prompt, userPrompt } = {}) {
    await ensureLoaded()
    const nextPrompt = prompt === undefined
      ? matrix.prompt
      : String(prompt ?? '').replace(/\r\n?/g, '\n').trim().slice(0, LIMITS.prompt)
    const nextUser = userPrompt === undefined
      ? matrix.userPrompt
      : String(userPrompt ?? '').replace(/\r\n?/g, '\n').trim().slice(0, LIMITS.prompt)
    matrix = { ...matrix, prompt: nextPrompt, userPrompt: nextUser, updatedAt: now() }
    const saved = await persist()
    return { matrix: matrixSummary(matrix), persisted: saved, storeError }
  }

  function promptDefault() {
    return {
      system: defaultSystem(resolved.outputLanguage),
      user: defaultUser(resolved.outputLanguage),
    }
  }

  async function fileExists(file) {
    try {
      await stat(file)
      return true
    } catch (error) {
      if (error?.code === 'ENOENT') return false
      throw error
    }
  }

  // A built-in template is stored once per language: the root file is the
  // default (Chinese) copy and `templates/<lang>/<same name>` overrides it for
  // that language. Keeping the logical file name language-free is what lets a
  // bound preset survive a language switch instead of pointing at a stale path.
  //
  // Priority: requested language, then English (the GUI's own fallback), then
  // the root copies — so a language without a translation directory still gets
  // a readable set instead of an empty list.
  function builtinDirs(base, lang) {
    const primary = presetLanguage(lang, resolved.outputLanguage)
    const dirs = [path.join(base, primary)]
    if (primary !== 'zh') dirs.push(path.join(base, 'en'))
    dirs.push(base)
    return [...new Set(dirs)]
  }

  async function presetPath(source, file, lang) {
    const base = source === 'builtin' ? resolved.templatesDir : resolved.presetsDir
    if (base === '') {
      throw new RuntimeError('NO_TEMPLATES', 'the templates directory is not configured', 500)
    }
    const raw = String(file ?? '')
    const name = path.basename(raw)
    if (name === '' || name !== raw || name.includes('..')) {
      throw new RuntimeError('BAD_PRESET', `invalid preset file name: ${raw}`, 400)
    }
    const root = path.resolve(base)
    const plain = path.resolve(root, name)
    if (plain !== path.join(root, name)) {
      throw new RuntimeError('BAD_PRESET', `invalid preset file name: ${raw}`, 400)
    }
    if (source !== 'builtin') return plain
    for (const dir of builtinDirs(root, lang)) {
      const candidate = path.join(dir, name)
      if (await fileExists(candidate)) return candidate
    }
    return plain
  }

  async function readPresetFile(source, file, lang) {
    const full = await presetPath(source, file, lang)
    const [text, info] = await Promise.all([readFile(full, 'utf8'), stat(full)])
    const parsed = parsePreset(text, { file })
    return {
      id: `${source}:${file}`,
      source,
      file,
      ...parsed,
      updatedAt: info.mtimeMs,
    }
  }

  async function listPresetDir(source, lang) {
    const base = source === 'builtin' ? resolved.templatesDir : resolved.presetsDir
    if (base === '') return []
    // Language directory first, then the fallbacks: a translated file wins,
    // and an untranslated one is still listed in the default language instead
    // of silently disappearing from a half-translated set.
    const dirs = source === 'builtin' ? builtinDirs(base, lang) : [base]
    const found = []
    const seen = new Set()
    for (const dir of dirs) {
      let entries
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch (error) {
        if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') continue
        throw new RuntimeError('PRESET_READ', String(error?.message ?? error), 500)
      }
      for (const entry of entries) {
        if (!entry.isFile()) continue
        const file = entry.name
        if (!file.toLowerCase().endsWith('.md') || seen.has(file)) continue
        seen.add(file)
        found.push({ file, full: path.join(dir, file) })
      }
    }
    found.sort((left, right) => (left.file < right.file ? -1 : left.file > right.file ? 1 : 0))
    const out = []
    for (const { file, full } of found.slice(0, 100)) {
      try {
        const [text, info] = await Promise.all([readFile(full, 'utf8'), stat(full)])
        const parsed = parsePreset(text, { file })
        out.push({
          id: `${source}:${file}`,
          source,
          file,
          title: parsed.title,
          description: parsed.description,
          theme: parsed.theme,
          hasPrompt: parsed.prompt !== '',
          rowCount: parsed.rows.length,
          colCount: parsed.cols.length,
          updatedAt: info.mtimeMs,
          error: null,
        })
      } catch (error) {
        out.push({
          id: `${source}:${file}`,
          source,
          file,
          title: file.replace(/\.md$/i, ''),
          description: '',
          theme: '',
          hasPrompt: false,
          rowCount: 0,
          colCount: 0,
          updatedAt: 0,
          error: String(error?.message ?? error),
        })
      }
    }
    return out
  }

  async function listPresets({ lang } = {}) {
    await ensureLoaded()
    const language = presetLanguage(lang, resolved.outputLanguage)
    const [builtin, user] = await Promise.all([
      listPresetDir('builtin', language),
      listPresetDir('user', language),
    ])
    builtin.sort((left, right) => {
      if (left.file === 'starter-simple.md') return -1
      if (right.file === 'starter-simple.md') return 1
      return left.file.localeCompare(right.file)
    })
    user.sort((left, right) => right.updatedAt - left.updatedAt)
    return {
      presets: [...builtin, ...user],
      lang: language,
      templatesDir: resolved.templatesDir,
      presetsDir: resolved.presetsDir,
    }
  }

  async function readPreset({ id, file, lang } = {}) {
    await ensureLoaded()
    const raw = String(id ?? file ?? '')
    const match = raw.match(/^(builtin|user):(.+)$/i)
    if (match !== null) return readPresetFile(match[1].toLowerCase(), match[2], lang)
    if (raw === '') throw new RuntimeError('BAD_PRESET', 'preset id is required', 400)
    return readPresetFile('user', raw, lang)
  }

  function cleanPresetAxes(list, label) {
    if (!Array.isArray(list) || list.length === 0) {
      throw new RuntimeError('BAD_PRESET', `${label} must contain at least one entry`, 400)
    }
    if (list.length > LIMITS.axes) {
      throw new RuntimeError('BAD_PRESET', `${label} supports at most ${LIMITS.axes} entries`, 400)
    }
    const names = new Set()
    return list.map(item => {
      const name = String(item?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.name)
      if (name === '') throw new RuntimeError('BAD_PRESET', `${label} contains an entry without a name`, 400)
      if (names.has(name)) throw new RuntimeError('BAD_PRESET', `${label} contains duplicate name: ${name}`, 400)
      names.add(name)
      return {
        name,
        hint: String(item?.hint ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.hint),
      }
    })
  }

  async function savePreset(input = {}) {
    await ensureLoaded()
    const title = String(input.title ?? '').trim().slice(0, PRESET_MAX.title)
    if (title === '') throw new RuntimeError('BAD_REQUEST', 'preset title must not be empty', 400)
    const rows = cleanPresetAxes(input.rows ?? matrix.rows, 'rows')
    const cols = cleanPresetAxes(input.cols ?? matrix.cols, 'cols')
    const description = String(input.description ?? '').trim().slice(0, PRESET_MAX.description)
    const theme = String(input.theme ?? matrix.theme).trim().slice(0, PRESET_MAX.theme)
    const prompt = String(input.prompt ?? matrix.prompt ?? '').replace(/\r\n?/g, '\n').trim().slice(0, PRESET_MAX.prompt)
    const userPrompt = String(input.userPrompt ?? matrix.userPrompt ?? '').replace(/\r\n?/g, '\n').trim().slice(0, PRESET_MAX.prompt)
    const body = String(input.body ?? '').trim().slice(0, PRESET_MAX.body)
    const text = serializePreset({
      title,
      description,
      theme,
      prompt,
      userPrompt,
      rows,
      cols,
      body: body !== '' ? body : `# ${title}\n\n${description}`,
    })
    await mkdir(resolved.presetsDir, { recursive: true })
    let file = presetFilename(input.file, title)
    let full = await presetPath('user', file)
    if (await fileExists(full)) {
      if (input.overwrite !== true) {
        const stem = file.replace(/\.md$/i, '')
        let counter = 2
        while (await fileExists(path.join(resolved.presetsDir, `${stem}-${counter}.md`))) counter += 1
        file = `${stem}-${counter}.md`
        full = await presetPath('user', file)
      }
    }
    const temporary = `${full}.tmp`
    await writeFile(temporary, text, 'utf8')
    await rename(temporary, full)
    const preset = await readPresetFile('user', file)
    const response = { file, preset, persisted: true }
    // The panel's save dialog asks for the current matrix to stay bound to the
    // template it just wrote, so the next "overwrite" targets the same file.
    if (input.bind === true && matrix !== null) {
      matrix = {
        ...matrix,
        preset: { file, title, source: 'user' },
        updatedAt: now(),
      }
      const savedMatrix = await persist()
      response.matrix = matrixSummary(matrix)
      response.persisted = savedMatrix
      response.storeError = storeError
    }
    return response
  }

  async function deletePreset({ file } = {}) {
    await ensureLoaded()
    const name = String(file ?? '')
    const full = await presetPath('user', name)
    await unlink(full)
    if (matrix !== null && matrix.preset?.source === 'user' && matrix.preset.file === name) {
      matrix = { ...matrix, preset: null, updatedAt: now() }
      await persist()
    }
    return { file: name, deleted: true }
  }

  async function applyPreset({ id, file, lang } = {}) {
    await ensureLoaded()
    const preset = await readPreset({ id, file, lang })
    const axes = presetAxes(preset)
    const result = replaceAxes(matrix, {
      theme: preset.theme,
      prompt: preset.prompt,
      userPrompt: preset.userPrompt,
      rows: axes.rows,
      cols: axes.cols,
    }, { now: now() })
    matrix = result.matrix
    warnings = result.warnings
    matrix = {
      ...matrix,
      preset: {
        file: preset.file,
        title: preset.title,
        source: preset.source,
      },
    }
    const saved = await persist()
    return {
      preset: {
        id: preset.id,
        file: preset.file,
        source: preset.source,
        title: preset.title,
        description: preset.description,
      },
      matrix: matrixSummary(matrix),
      removedCells: result.removedCells,
      persisted: saved,
      storeError,
    }
  }

  // --- template authoring ------------------------------------------------
  // A plain idea in, a template draft out. The model answers with one yaml
  // block (see prompt.js); anything it leaves out falls back to the current
  // matrix or the built-in default prompt. `refine` rewrites an existing
  // preset on the same contract and writes it back to its own file, so a
  // template can be iterated on with prompts instead of hand-editing md.

  async function runTemplateStage({ system, user, signal }) {
    const route = resolveRoute()
    const { text } = await runStage({
      route,
      system,
      user,
      maxTokens: clampInt(resolved.templateMaxTokens, 512, 8192, 1600),
      signal,
      onDelta: () => {},
    })
    return { text, route }
  }

  function draftFromReply(text, fallback = {}) {
    let parsed
    try {
      parsed = parseTemplateReply(text)
    } catch (error) {
      throw new RuntimeError('BAD_TEMPLATE', `the model reply is not a readable template: ${String(error?.message ?? error)}`, 502)
    }
    return {
      title: parsed.title,
      description: parsed.description,
      theme: parsed.theme !== '' ? parsed.theme : (matrix?.theme ?? ''),
      // An omitted prompt means "keep what is in effect", never silently
      // downgrade a custom prompt back to the built-in default.
      prompt: parsed.prompt !== '' ? parsed.prompt : (matrix?.prompt ?? ''),
      userPrompt: parsed.userPrompt !== ''
        ? parsed.userPrompt
        : (fallback.userPrompt ?? matrix?.userPrompt ?? ''),
      rows: parsed.rows,
      cols: parsed.cols,
      body: parsed.body,
    }
  }

  async function draftPreset({ idea, signal, lang } = {}) {
    await ensureLoaded()
    const question = String(idea ?? '').trim().slice(0, PRESET_MAX.description)
    if (question === '') throw new RuntimeError('BAD_REQUEST', 'idea must not be empty', 400)
    // Authoring follows the language asking for the template (the panel's
    // locale); cell generation keeps using the matrix content language.
    const language = presetLanguage(lang, resolved.outputLanguage)
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      const { text, route } = await runTemplateStage({
        system: buildTemplateSystem(language),
        user: buildTemplateUser({
          idea: question,
          language,
          current: matrix === null ? null : {
            title: matrix.title,
            theme: matrix.theme,
            prompt: matrix.prompt,
            userPrompt: matrix.userPrompt,
            rows: matrix.rows.map(row => ({ name: row.name, hint: row.hint })),
            cols: matrix.cols.map(col => ({ name: col.name, hint: col.hint })),
          },
        }),
        signal: controller.signal,
      })
      const draft = draftFromReply(text)
      return { draft, model: { provider: route.provider, model: route.model }, raw: text }
    } finally {
      signal?.removeEventListener('abort', onAbort)
    }
  }

  async function refinePreset({ id, file, idea, signal, lang } = {}) {
    await ensureLoaded()
    const question = String(idea ?? '').trim().slice(0, PRESET_MAX.description)
    if (question === '') throw new RuntimeError('BAD_REQUEST', 'idea must not be empty', 400)
    const language = presetLanguage(lang, resolved.outputLanguage)
    const preset = await readPreset({ id, file, lang: language })
    if (preset.source !== 'user') {
      throw new RuntimeError('BUILTIN_PRESET', 'built-in templates are read-only; load one and save it as your own before editing it by prompt', 400)
    }
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      const { text, route } = await runTemplateStage({
        system: buildRefineSystem(language),
        user: buildRefineUser({
          idea: question,
          language,
          current: {
            title: preset.title,
            description: preset.description,
            theme: preset.theme,
            prompt: preset.prompt,
            userPrompt: preset.userPrompt,
            rows: preset.rows,
            cols: preset.cols,
          },
        }),
        signal: controller.signal,
      })
      const draft = draftFromReply(text, { userPrompt: preset.userPrompt })
      // The refine contract only covers the yaml fields; the prose body and
      // the file name stay exactly as they were.
      draft.body = preset.body
      const saved = await savePreset({
        title: draft.title,
        description: draft.description,
        theme: draft.theme,
        prompt: draft.prompt,
        userPrompt: draft.userPrompt,
        rows: draft.rows,
        cols: draft.cols,
        body: draft.body,
        file: preset.file,
        overwrite: true,
      })
      return { file: saved.file, preset: saved.preset, model: { provider: route.provider, model: route.model }, raw: text, persisted: true }
    } finally {
      signal?.removeEventListener('abort', onAbort)
    }
  }

  async function batchGenerate({
    scope = 'all',
    rowId,
    colId,
    onlyEmpty = true,
    mode = 'fast',
    concurrency: requested,
    onEvent = () => {},
  } = {}) {
    await ensureLoaded()
    if (activeBatch !== null && !activeBatch.done) {
      throw new RuntimeError('BATCH_ACTIVE', 'another batch is still running', 409)
    }
    const runMode = mode === 'deep' ? 'deep' : 'fast'
    // 0 = one shot: every target starts immediately. A positive value is the
    // number of cells in flight at the same time.
    const parallel = requested === undefined || requested === null
      ? concurrency
      : clampInt(requested, 0, 32, concurrency)
    let pairs
    if (scope === 'row') {
      const row = findRow(matrix, rowId)
      if (row === undefined) throw new RuntimeError('UNKNOWN_ROW', `unknown row: ${String(rowId)}`, 404)
      pairs = matrix.cols.map(col => ({ rowId: row.id, colId: col.id }))
    } else if (scope === 'col') {
      const col = findCol(matrix, colId)
      if (col === undefined) throw new RuntimeError('UNKNOWN_COL', `unknown column: ${String(colId)}`, 404)
      pairs = matrix.rows.map(row => ({ rowId: row.id, colId: col.id }))
    } else {
      pairs = []
      for (const row of matrix.rows) {
        for (const col of matrix.cols) pairs.push({ rowId: row.id, colId: col.id })
      }
    }
    const skippedSet = new Set()
    if (onlyEmpty) {
      for (const pair of pairs) {
        const key = cellKey(pair.rowId, pair.colId)
        if (matrix.cells[key] !== undefined) skippedSet.add(key)
      }
    }
    const targets = pairs.filter(pair => !skippedSet.has(cellKey(pair.rowId, pair.colId)))
    const batch = {
      id: `b-${now()}`,
      total: targets.length,
      completed: 0,
      failed: 0,
      skipped: skippedSet.size,
      currentKey: null,
      currentKeys: [],
      concurrency: parallel,
      startedAt: now(),
      done: false,
      cancelled: false,
      fatal: false,
      failures: [],
    }
    activeBatch = batch
    emit(onEvent, {
      type: 'batch.start',
      id: batch.id,
      scope,
      total: batch.total,
      skipped: batch.skipped,
      concurrency: parallel,
    })
    if (targets.length === 0) {
      batch.done = true
      const empty = {
        id: batch.id,
        scope,
        total: 0,
        completed: 0,
        failed: 0,
        skipped: batch.skipped,
        concurrency: parallel,
        failures: [],
        persisted,
      }
      emit(onEvent, { type: 'batch.done', ...empty })
      return empty
    }

    const queue = targets.slice()
    const width = parallel <= 0 ? targets.length : Math.min(parallel, targets.length)

    async function runCell(pair) {
      const key = cellKey(pair.rowId, pair.colId)
      batch.currentKeys.push(key)
      batch.currentKey = batch.currentKeys[0] ?? key
      emit(onEvent, { type: 'cell.start', key, rowId: pair.rowId, colId: pair.colId })
      try {
        const result = await generate({
          rowId: pair.rowId,
          colId: pair.colId,
          mode: runMode,
          unqueue: true,
          onEvent: () => {},
        })
        batch.completed += 1
        emit(onEvent, { type: 'cell.done', key, cell: result.cell, persisted: result.persisted })
      } catch (error) {
        const mapped = mapError(error)
        if (batch.cancelled || mapped.code === 'ABORTED') return
        batch.failed += 1
        batch.failures.push({ key, code: mapped.code, message: mapped.message })
        emit(onEvent, { type: 'cell.error', key, code: mapped.code, message: mapped.message })
        if (mapped.code === 'NO_MODEL') batch.fatal = true
      } finally {
        const at = batch.currentKeys.indexOf(key)
        if (at >= 0) batch.currentKeys.splice(at, 1)
        batch.currentKey = batch.currentKeys[0] ?? null
      }
    }

    async function worker() {
      while (!batch.cancelled && !batch.fatal) {
        const pair = queue.shift()
        if (pair === undefined) return
        await runCell(pair)
      }
    }

    await Promise.all(Array.from({ length: width }, () => worker()))

    batch.currentKey = null
    batch.currentKeys = []
    batch.done = true
    const summary = {
      id: batch.id,
      scope,
      total: batch.total,
      completed: batch.completed,
      failed: batch.failed,
      skipped: batch.skipped,
      concurrency: parallel,
      failures: batch.failures.slice(0, 10),
      persisted,
    }
    emit(onEvent, { type: 'batch.done', ...summary })
    return summary
  }

  function cancelBatch() {
    if (activeBatch === null || activeBatch.done) return { cancelled: false }
    activeBatch.cancelled = true
    for (const key of activeBatch.currentKeys) {
      const coords = parseCellKey(key)
      if (coords !== null) cancel(coords)
    }
    return { cancelled: true }
  }

  function setConcurrency({ concurrency: value } = {}) {
    const next = clampInt(value, 0, 32, concurrency)
    concurrency = next
    limit.setLimit(next)
    return { concurrency: next }
  }

  function clearBatch() {
    if (activeBatch !== null && !activeBatch.done) return { cleared: false }
    activeBatch = null
    return { cleared: true }
  }

  async function promptFor({ rowId, colId, hint = '', custom, userCustom } = {}) {
    await ensureLoaded()
    const { row, col } = assertCell(rowId, colId)
    // `custom` / `userCustom` let the panel preview unsaved drafts; omitting
    // them previews the templates actually stored on the matrix.
    const source = custom === undefined ? matrix.prompt : String(custom ?? '')
    const userSource = userCustom === undefined ? matrix.userPrompt : String(userCustom ?? '')
    return previewPrompt({
      row,
      col,
      theme: matrix.theme,
      title: matrix.title,
      hint,
      previous: matrix.cells[cellKey(row.id, col.id)]?.takeaway ?? '',
      language: resolved.outputLanguage,
      custom: source,
      userCustom: userSource,
    })
  }

  async function exportAll() {
    await ensureLoaded()
    return exportMarkdown(matrix, { now: now() })
  }

  function cancel({ rowId, colId }) {
    const key = cellKey(rowId, colId)
    const controller = controllers.get(key)
    if (controller === undefined) return { cancelled: false }
    controller.abort()
    return { cancelled: true }
  }

  async function reload() {
    await syncFromDisk({ force: true, seedWhenMissing: true })
    return state()
  }

  async function resetStore() {
    const backup = `${resolved.storePath}.bak-${now()}`
    try {
      await rename(resolved.storePath, backup)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw mapError(error)
    }
    matrix = createSeedMatrix(makeId, now())
    warnings = []
    storeError = null
    persisted = false
    loaded = true
    const saved = await persist()
    return { persisted: saved, backup, storePath: resolved.storePath }
  }

  async function generate({ rowId, colId, hint = '', mode = 'fast', unqueue = false, onEvent = () => {} }) {
    await ensureLoaded()
    const { row, col } = assertCell(rowId, colId)
    const runMode = mode === 'deep' ? 'deep' : 'fast'
    const extra = String(hint ?? '').trim().slice(0, LIMITS.hint)
    const route = resolveRoute()
    const key = cellKey(row.id, col.id)

    const previous = controllers.get(key)
    if (previous !== undefined) previous.abort()
    const controller = new AbortController()
    controllers.set(key, controller)
    const entry = { text: '', stage: 'queued', startedAt: now() }
    live.set(key, entry)
    const vars = promptVars({
      row,
      col,
      theme: matrix.theme,
      title: matrix.title,
      hint: extra,
      previous: matrix.cells[key]?.takeaway ?? '',
    })

    try {
      emit(onEvent, { type: 'meta', provider: route.provider, model: route.model })
      // A batch already controls its own parallelism, so its cells skip the
      // shared queue; a single request still goes through the limiter.
      const work = async () => {
        entry.stage = 'draft'
        emit(onEvent, { type: 'stage', stage: 'draft' })
        const draft = await runStage({
          route,
          system: buildSystem(resolved.outputLanguage, matrix.prompt, vars),
          user: buildUser({
            row,
            col,
            theme: matrix.theme,
            title: matrix.title,
            hint: extra,
            previous: matrix.cells[key]?.takeaway ?? '',
            language: resolved.outputLanguage,
            template: matrix.userPrompt,
          }),
          maxTokens: resolved.maxTokens,
          signal: controller.signal,
          onDelta: text => {
            entry.text += text
            emit(onEvent, { type: 'delta', text })
          },
        })
        let markdown = draft.text
        let usage = draft.usage
        if (runMode === 'deep') {
          entry.stage = 'critique'
          emit(onEvent, { type: 'stage', stage: 'critique' })
          const marker = resolved.outputLanguage === 'en' ? 'Independent red-team review' : '独立红队审阅'
          const separator = `\n\n---\n\n## ${marker}\n\n`
          entry.text += separator
          emit(onEvent, { type: 'delta', text: separator })
          const critique = await runStage({
            route,
            system: buildCritiqueSystem(resolved.outputLanguage),
            user: buildCritiqueUser({
              draft: draft.text,
              row,
              col,
              language: resolved.outputLanguage,
            }),
            maxTokens: resolved.critiqueMaxTokens,
            signal: controller.signal,
            onDelta: text => {
              entry.text += text
              emit(onEvent, { type: 'delta', text })
            },
          })
          markdown = `${draft.text}${separator}${critique.text}`
          usage = mergeUsage(usage, critique.usage)
        }
        const cell = {
          markdown: markdown.trim(),
          takeaway: extractTakeaway(markdown),
          mode: runMode,
          hint: extra,
          model: { provider: route.provider, model: route.model },
          usage,
          edited: false,
          updatedAt: now(),
        }
        matrix = { ...matrix, cells: { ...matrix.cells, [key]: cell }, updatedAt: now() }
        const saved = await persist()
        const summary = cellSummary(cell)
        emit(onEvent, { type: 'done', key, cell: summary, persisted: saved, storeError })
        return { key, cell: summary, markdown: cell.markdown, persisted: saved, storeError }
      }
      return unqueue ? await work() : await limit(work, controller.signal)
    } catch (error) {
      const mapped = mapError(error)
      emit(onEvent, { type: 'error', code: mapped.code, message: mapped.message })
      throw mapped
    } finally {
      if (controllers.get(key) === controller) {
        controllers.delete(key)
        live.delete(key)
      }
    }
  }

  return {
    config: resolved,
    state,
    readCell,
    writeCell,
    clearCell,
    replaceAxes: replaceAllAxes,
    upsertAxes: upsertAllAxes,
    updateAxis,
    setPrompt,
    promptDefault,
    modelsList,
    setModel,
    setConcurrency,
    listPresets,
    readPreset,
    savePreset,
    deletePreset,
    applyPreset,
    draftPreset,
    refinePreset,
    batchGenerate,
    cancelBatch,
    clearBatch,
    promptFor,
    exportAll,
    cancel,
    reload,
    resetStore,
    generate,
    resolveRoute,
  }
}
