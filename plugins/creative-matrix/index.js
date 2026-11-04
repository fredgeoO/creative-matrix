// Host half of @local/creative-matrix.
//
// One runtime (lib/core.js) serves two callers:
//   * the Web panel, through POST /creative-matrix/api (JSON + SSE);
//   * the agent, through the `creative_matrix` tool.
//
// The runtime owns the matrix, the model calls and the only writer to
// data/matrix.json, so the two callers can never disagree.

import { fileURLToPath } from 'node:url'

import { createRuntime, RuntimeError } from './lib/core.js'
import { sseComment, sseFrame } from './lib/sse.js'

export const name = 'creative-matrix'
export const inject = ['llm', 'webServer', 'tools']

const PREFIX = '/creative-matrix'
const API = `${PREFIX}/api`
const BODY_LIMIT_BYTES = 512 * 1024
const HEARTBEAT_MS = 15_000
const TEMPLATES_DIR = fileURLToPath(new URL('./templates', import.meta.url))

function isLoopback(value) {
  if (typeof value !== 'string') return false
  return value === '::1' || value === '::ffff:127.0.0.1' || value.startsWith('127.')
}

// Same-origin browser requests only, matching the other local panel plugins.
function trustedRequest(req) {
  if (!isLoopback(req.socket?.remoteAddress)) return false
  const host = req.headers?.host
  const origin = req.headers?.origin
  if (origin !== undefined && origin !== '') {
    try {
      if (new URL(origin).host !== host) return false
    } catch {
      return false
    }
  }
  return true
}

function sendJson(res, status, body) {
  if (res.headersSent) {
    try { res.end() } catch { /* already gone */ }
    return
  }
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

function sendError(res, error) {
  const mapped = error instanceof RuntimeError
    ? error
    : error?.name === 'MatrixError'
      ? new RuntimeError(error.code ?? 'BAD_REQUEST', String(error?.message ?? error), 400)
      : new RuntimeError('GENERATION_FAILED', String(error?.message ?? error), 500)
  sendJson(res, mapped.status, { ok: false, error: mapped.message, code: mapped.code })
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    let bytes = 0
    req.setEncoding('utf8')
    req.on('data', chunk => {
      bytes += Buffer.byteLength(chunk)
      if (bytes > BODY_LIMIT_BYTES) {
        const error = new Error(`request body exceeds ${BODY_LIMIT_BYTES} bytes`)
        error.status = 413
        reject(error)
        req.destroy()
        return
      }
      body += chunk
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function openSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  if (typeof res.flushHeaders === 'function') res.flushHeaders()
  let closed = false
  const send = (event, data) => {
    if (closed) return
    try {
      res.write(sseFrame(event, data))
    } catch {
      closed = true
    }
  }
  const ping = setInterval(() => {
    if (closed) return
    try {
      res.write(sseComment('ping'))
    } catch {
      closed = true
    }
  }, HEARTBEAT_MS)
  ping.unref?.()
  res.on('close', () => {
    closed = true
    clearInterval(ping)
  })
  return {
    send,
    close() {
      clearInterval(ping)
      if (!closed) {
        closed = true
        try { res.end() } catch { /* already gone */ }
      }
    },
  }
}

function normalizeError(error) {
  return error instanceof RuntimeError
    ? error
    : new RuntimeError('GENERATION_FAILED', String(error?.message ?? error), 500)
}

async function streamGenerate(req, res, runtime, args) {
  const stream = openSse(res)
  let errorSent = false
  try {
    await runtime.generate({
      ...args,
      onEvent: event => {
        if (event.type === 'meta') stream.send('meta', { provider: event.provider, model: event.model })
        else if (event.type === 'stage') stream.send('stage', { stage: event.stage })
        else if (event.type === 'delta') stream.send('delta', { text: event.text })
        else if (event.type === 'done') {
          stream.send('done', { key: event.key, cell: event.cell, persisted: event.persisted })
        } else if (event.type === 'error') {
          errorSent = true
          stream.send('error', { code: event.code, message: event.message })
        }
      },
    })
  } catch (error) {
    if (!errorSent) {
      const mapped = normalizeError(error)
      stream.send('error', { code: mapped.code, message: mapped.message })
    }
  } finally {
    stream.close()
  }
}

async function streamBatch(req, res, runtime, args) {
  const stream = openSse(res)
  try {
    await runtime.batchGenerate({
      ...args,
      onEvent: event => {
        if (event.type === 'batch.start') {
          stream.send('batch.start', {
            id: event.id,
            scope: event.scope,
            total: event.total,
            skipped: event.skipped,
            concurrency: event.concurrency,
          })
        } else if (event.type === 'cell.start') {
          stream.send('cell.start', { key: event.key, rowId: event.rowId, colId: event.colId })
        } else if (event.type === 'cell.done') {
          stream.send('cell.done', { key: event.key, cell: event.cell, persisted: event.persisted })
        } else if (event.type === 'cell.error') {
          stream.send('cell.error', { key: event.key, code: event.code, message: event.message })
        } else if (event.type === 'batch.done') {
          stream.send('batch.done', {
            id: event.id,
            scope: event.scope,
            total: event.total,
            completed: event.completed,
            failed: event.failed,
            skipped: event.skipped,
            concurrency: event.concurrency,
            failures: event.failures,
            persisted: event.persisted,
          })
        }
      },
    })
  } catch (error) {
    const mapped = normalizeError(error)
    stream.send('error', { code: mapped.code, message: mapped.message })
  } finally {
    stream.close()
  }
}

function createApiHandler(runtime) {
  return async function handler(req, res) {
    let url
    try {
      url = new URL(req.url ?? '/', 'http://127.0.0.1')
    } catch {
      sendJson(res, 400, { ok: false, error: 'bad request url' })
      return
    }
    if (url.pathname !== API && url.pathname !== `${API}/`) {
      sendJson(res, 404, { ok: false, error: 'not found' })
      return
    }
    if (!trustedRequest(req)) {
      sendJson(res, 403, { ok: false, error: 'forbidden' })
      return
    }
    if (req.method === 'GET') {
      try {
        sendJson(res, 200, { ok: true, value: await runtime.state() })
      } catch (error) {
        sendError(res, error)
      }
      return
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'method not allowed' })
      return
    }
    if (!/^application\/json\b/i.test(String(req.headers?.['content-type'] ?? ''))) {
      sendJson(res, 415, { ok: false, error: 'content-type must be application/json' })
      return
    }

    let payload
    try {
      const body = await readBody(req)
      payload = JSON.parse(body === '' ? '{}' : body)
    } catch (error) {
      const status = error?.status === 413 ? 413 : 400
      sendJson(res, status, { ok: false, error: error?.status === 413 ? error.message : 'invalid JSON body' })
      return
    }

    const method = String(payload?.method ?? '')
    const args = payload?.args ?? {}
    try {
      switch (method) {
        case 'state':
          sendJson(res, 200, { ok: true, value: await runtime.state() })
          return
        case 'models.list':
          sendJson(res, 200, { ok: true, value: await runtime.modelsList(args) })
          return
        case 'model.set':
          sendJson(res, 200, { ok: true, value: await runtime.setModel(args) })
          return
        case 'concurrency.set':
          sendJson(res, 200, { ok: true, value: runtime.setConcurrency(args) })
          return
        case 'cell.read':
          sendJson(res, 200, { ok: true, value: await runtime.readCell(args) })
          return
        case 'cell.write':
          sendJson(res, 200, { ok: true, value: await runtime.writeCell(args) })
          return
        case 'cell.clear':
          sendJson(res, 200, { ok: true, value: await runtime.clearCell(args) })
          return
        case 'cell.cancel':
          sendJson(res, 200, { ok: true, value: runtime.cancel(args) })
          return
        case 'cell.generate': {
          const wantsStream = /text\/event-stream/i.test(String(req.headers?.accept ?? ''))
          if (wantsStream) {
            await streamGenerate(req, res, runtime, args)
            return
          }
          sendJson(res, 200, { ok: true, value: await runtime.generate({ ...args, onEvent: () => {} }) })
          return
        }
        case 'batch.generate': {
          const wantsStream = /text\/event-stream/i.test(String(req.headers?.accept ?? ''))
          if (wantsStream) {
            await streamBatch(req, res, runtime, args)
            return
          }
          sendJson(res, 200, { ok: true, value: await runtime.batchGenerate({ ...args, onEvent: () => {} }) })
          return
        }
        case 'batch.cancel':
          sendJson(res, 200, { ok: true, value: runtime.cancelBatch() })
          return
        case 'batch.clear':
          sendJson(res, 200, { ok: true, value: runtime.clearBatch() })
          return
        case 'axes.replace':
          sendJson(res, 200, { ok: true, value: await runtime.replaceAxes(args) })
          return
        case 'axes.upsert':
          sendJson(res, 200, { ok: true, value: await runtime.upsertAxes(args) })
          return
        case 'axes.update':
          sendJson(res, 200, { ok: true, value: await runtime.updateAxis(args) })
          return
        case 'prompt.set':
          sendJson(res, 200, { ok: true, value: await runtime.setPrompt(args) })
          return
        case 'prompt.default':
          sendJson(res, 200, { ok: true, value: runtime.promptDefault() })
          return
        case 'presets.list':
          // `lang` is the panel's active locale; without it the runtime falls
          // back to the configured content language.
          sendJson(res, 200, { ok: true, value: await runtime.listPresets(args) })
          return
        case 'presets.read':
          sendJson(res, 200, { ok: true, value: await runtime.readPreset(args) })
          return
        case 'presets.save':
          sendJson(res, 200, { ok: true, value: await runtime.savePreset(args) })
          return
        case 'presets.delete':
          sendJson(res, 200, { ok: true, value: await runtime.deletePreset(args) })
          return
        case 'presets.apply':
          sendJson(res, 200, { ok: true, value: await runtime.applyPreset(args) })
          return
        case 'presets.draft':
          sendJson(res, 200, { ok: true, value: await runtime.draftPreset(args) })
          return
        case 'presets.refine':
          sendJson(res, 200, { ok: true, value: await runtime.refinePreset(args) })
          return
        case 'prompt.preview':
          sendJson(res, 200, { ok: true, value: await runtime.promptFor(args) })
          return
        case 'export.markdown':
          sendJson(res, 200, { ok: true, value: await runtime.exportAll() })
          return
        case 'reload':
          sendJson(res, 200, { ok: true, value: await runtime.reload() })
          return
        case 'reset':
          sendJson(res, 200, { ok: true, value: await runtime.resetStore() })
          return
        default:
          sendJson(res, 404, { ok: false, error: `unknown method: ${method}` })
      }
    } catch (error) {
      sendError(res, error)
    }
  }
}

function clip(text, max) {
  const value = String(text ?? '')
  return value.length > max ? `${value.slice(0, max)}\n…（已截断，全文见面板）` : value
}

function renderState(value) {
  if (value?.storeError) {
    return [{ type: 'text', text: `格致矩阵 数据文件读取失败（${value.storeError.code}）：${value.storeError.message}\n路径：${value.storePath}` }]
  }
  const matrix = value?.matrix
  if (matrix === undefined || matrix === null) return [{ type: 'text', text: '格致矩阵 尚未加载。' }]
  const lines = [
    `格致矩阵：${matrix.rows.length} 行 × ${matrix.cols.length} 列，已生成 ${Object.keys(matrix.cells).length} 个单元格。`,
    `主题：${matrix.theme || '（未设置）'}`,
    value.selectedModel
      ? `模型：矩阵选定 ${value.selectedModel.provider}/${value.selectedModel.model}`
      : `模型：跟随默认 ${value.model ? `${value.model.provider}/${value.model.model}` : '（未配置）'}`,
    `并发：${value.concurrency > 0 ? `${value.concurrency} 个单元格同时生成` : '一次过（不限并发）'}`,
    `生成提示词：${matrix.prompt ? `自定义（${matrix.prompt.length} 字）` : '内置默认'}；用户消息模板：${matrix.userPrompt ? `自定义（${matrix.userPrompt.length} 字）` : '内置默认'}`,
    `数据：${value.storePath}${value.persisted ? '' : '（内存中，尚未写盘）'}`,
  ]
  lines.push('', '纵轴（rows）：')
  for (const row of matrix.rows) lines.push(`- ${row.id}  ${row.name}${row.hint ? ` — ${row.hint}` : ''}`)
  lines.push('', '横轴（cols）：')
  for (const col of matrix.cols) lines.push(`- ${col.id}  ${col.name}${col.hint ? ` — ${col.hint}` : ''}`)
  const filled = Object.entries(matrix.cells)
  if (filled.length > 0) {
    lines.push('', '已有单元格：')
    for (const [key, cell] of filled.slice(0, 30)) {
      lines.push(`- ${key}${cell.takeaway ? ` — ${cell.takeaway}` : ''}`)
    }
    if (filled.length > 30) lines.push(`… 另有 ${filled.length - 30} 个`)
  }
  if (value.generating?.length > 0) {
    lines.push('', `正在生成：${value.generating.map(item => `${item.key}(${item.stage})`).join('、')}`)
  }
  return [{ type: 'text', text: lines.join('\n') }]
}

function renderResult(action, args, value) {
  if (action === 'state') return renderState(value)
  if (action === 'read') {
    if (value?.cell === null || value?.cell === undefined) {
      return [{ type: 'text', text: `${value.row.name} × ${value.col.name} 还没有生成内容。` }]
    }
    return [{
      type: 'text',
      text: `## ${value.row.name} × ${value.col.name}\n\n${clip(value.cell.markdown, 8000)}`,
    }]
  }
  if (action === 'generate') {
    const cell = value?.cell
    return [{
      type: 'text',
      text: [
        `已生成 ${args.rowId} × ${args.colId}（${cell?.mode ?? 'fast'}，${value?.persisted ? '已保存' : '未写盘'}）。`,
        cell?.takeaway ? `一句话：${cell.takeaway}` : '',
        '',
        clip(value?.markdown, 8000),
      ].filter(Boolean).join('\n'),
    }]
  }
  if (action === 'write') {
    return [{ type: 'text', text: `已写入 ${value.key}（${value.persisted ? '已保存' : '未写盘'}）。` }]
  }
  if (action === 'clear') {
    return [{ type: 'text', text: `已清空 ${value.key}。` }]
  }
  if (action === 'axes') {
    const matrix = value?.matrix
    const rows = matrix?.rows?.map(row => row.name).join('、') ?? ''
    const cols = matrix?.cols?.map(col => col.name).join('、') ?? ''
    return [{
      type: 'text',
      text: `已更新矩阵轴（${value?.persisted ? '已保存' : '未写盘'}）。\n纵轴：${rows}\n横轴：${cols}\n主题：${matrix?.theme || '（未设置）'}`,
    }]
  }
  if (action === 'model') {
    return [{
      type: 'text',
      text: value?.model
        ? `矩阵模型已设为 ${value.model.provider}/${value.model.model}（${value.persisted ? '已保存' : '未写盘'}）。`
        : `矩阵已改为跟随默认模型（${value?.persisted ? '已保存' : '未写盘'}）。`,
    }]
  }
  if (action === 'template') {
    const draft = value?.draft
    const axes = draft
      ? [`纵轴：${(draft.rows ?? []).map(row => row.name).join('、')}`, `横轴：${(draft.cols ?? []).map(col => col.name).join('、')}`]
      : []
    return [{
      type: 'text',
      text: [
        args?.refineFile
          ? `模板「${value?.preset?.title ?? ''}」已按提示词改写并写回 ${value?.file}（模型 ${value?.model?.provider}/${value?.model?.model}）。`
          : `已按提示词起草模板「${draft?.title ?? ''}」（模型 ${value?.model?.provider}/${value?.model?.model}），尚未保存。`,
        draft ? `说明：${draft.description || '（无）'}` : '',
        ...axes,
        draft?.prompt ? `生成提示词：${draft.prompt}` : '',
        draft?.userPrompt ? `用户消息模板：${clip(draft.userPrompt, 300)}` : '',
        args?.refineFile
          ? ''
          : (args?.save === true
            ? `已保存到 presets/${value?.file}，可在面板的模板弹窗里载入。`
            : '确认后用 template + save=true 保存（可带 file 指定文件名）。'),
      ].filter(Boolean).join('\n'),
    }]
  }
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

function makeTools(runtime) {
  const axesSchema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Existing axis id; omit to add or match by name.' },
        name: { type: 'string' },
        hint: { type: 'string' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  }
  return [
    {
      name: 'creative_matrix',
      description: [
        '读取或操作 格致矩阵（Gezhi Matrix，原名创意矩阵）面板：纵轴是思维模型，横轴是场景约束，每个单元格是一份跨学科推演报告。',
        'state 返回轴、主题、已有单元格摘要和模型；read 返回单个单元格全文；generate 用默认模型生成并保存一个单元格（fast=一次生成，deep=再追加一轮独立红队审阅）；write 手动写入；clear 清空；axes 只增改轴、主题与系统/用户提示词，不删除；model 切换这张矩阵使用的模型（provider/model 留空则跟随默认选择）。',
        'template 用提示词生成/修改模板：idea 描述想要的模板，返回草稿（title/description/theme/prompt/userPrompt/rows/cols）；save=true 直接存成 presets/*.md；refineFile 点名修改某个用户预设（改完写回该文件）。',
        '面板里正在生成同一单元格时，调用 generate 会中止面板那次请求并由本次接管。',
      ].join('\n'),
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['action'],
        properties: {
          action: {
            type: 'string',
            enum: ['state', 'read', 'generate', 'write', 'clear', 'axes', 'model', 'template'],
          },
          rowId: { type: 'string', description: '纵轴 id（state 返回）；也接受精确名称。read/generate/write/clear 必填。' },
          colId: { type: 'string', description: '横轴 id（state 返回）；也接受精确名称。read/generate/write/clear 必填。' },
          hint: { type: 'string', description: 'generate 的本次额外要求，≤300 字。' },
          mode: { type: 'string', enum: ['fast', 'deep'], description: 'generate 模式；默认 fast。' },
          markdown: { type: 'string', description: 'write 的完整 Markdown 内容。' },
          theme: { type: 'string', description: 'axes 的全局主题，≤500 字。' },
          prompt: { type: 'string', description: 'axes 的生成提示词（系统提示），≤4000 字；留空 = 使用内置默认提示词。' },
          userPrompt: { type: 'string', description: 'axes 的用户消息模板（支持 {纵标题} 等占位符），≤4000 字；留空 = 使用内置默认。' },
          rows: { ...axesSchema, description: 'axes 要新增或更新的纵轴；已有 id 按 id 匹配，否则按名称匹配。' },
          cols: { ...axesSchema, description: 'axes 要新增或更新的横轴；已有 id 按 id 匹配，否则按名称匹配。' },
          provider: { type: 'string', description: 'model 的 provider id，如 deepseek-official；留空则跟随默认模型。' },
          model: { type: 'string', description: 'model 的模型 id，如 deepseek-flash；与 provider 一起留空则跟随默认模型。' },
          idea: { type: 'string', description: 'template 的提示词：描述想要的新模板，或对现有预设的修改要求（≤500 字）。' },
          save: { type: 'boolean', description: 'template 起草后是否直接保存为 presets/*.md；默认 false 只返回草稿。' },
          file: { type: 'string', description: 'template + save 时指定保存的文件名（可省略 .md）。' },
          refineFile: { type: 'string', description: 'template 要修改的用户预设文件名；内置模板只读，不能直接改。' },
        },
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (args, value) => renderResult(String(args?.action ?? 'state'), args ?? {}, value),
      },
      timeoutMs: 420_000,
      isConcurrencySafe: () => false,
      presentCall: args => ({
        card: 'generic',
        title: `格致矩阵 · ${String(args?.action ?? 'state')}`,
        kind: args?.action === 'generate' || args?.action === 'write' || args?.action === 'clear' || args?.action === 'axes' || args?.action === 'model' || args?.action === 'template'
          ? 'execute'
          : 'read',
        rawInput: args ?? {},
      }),
      execute: async (args, exec) => {
        const action = String(args?.action ?? 'state')
        switch (action) {
          case 'state':
            return runtime.state()
          case 'read':
            return runtime.readCell({ rowId: args?.rowId, colId: args?.colId })
          case 'generate':
            return runtime.generate({
              rowId: args?.rowId,
              colId: args?.colId,
              hint: args?.hint,
              mode: args?.mode,
              onEvent: () => {},
            })
          case 'write':
            return runtime.writeCell({ rowId: args?.rowId, colId: args?.colId, markdown: args?.markdown })
          case 'clear':
            return runtime.clearCell({ rowId: args?.rowId, colId: args?.colId })
          case 'axes':
            return runtime.upsertAxes({
              theme: args?.theme,
              prompt: args?.prompt,
              userPrompt: args?.userPrompt,
              rows: args?.rows,
              cols: args?.cols,
            })
          case 'model':
            return runtime.setModel({ provider: args?.provider, model: args?.model })
          case 'template': {
            if (args?.refineFile) {
              return runtime.refinePreset({ id: `user:${args.refineFile}`, idea: args?.idea })
            }
            const { draft } = await runtime.draftPreset({ idea: args?.idea })
            if (args?.save !== true) return { draft, saved: false }
            const saved = await runtime.savePreset({
              title: draft.title,
              description: draft.description,
              theme: draft.theme,
              prompt: draft.prompt,
              userPrompt: draft.userPrompt,
              rows: draft.rows,
              cols: draft.cols,
              body: draft.body,
              file: args?.file,
            })
            return { draft, saved: true, file: saved.file, preset: saved.preset }
          }
          default:
            throw new RuntimeError('BAD_REQUEST', `unknown action: ${action}`, 400)
        }
      },
    },
  ]
}

export function apply(ctx, config = {}) {
  const runtime = createRuntime({
    config: { ...config, templatesDir: TEMPLATES_DIR },
    llm: {
      stream: options => ctx.llm.stream(options),
      prepareCall: (config, signal, configure) => ctx.llm.prepareCall(config, signal, configure),
      listProviders: () => ctx.llm.listProviders(),
      listModels: provider => ctx.llm.listModels(provider),
    },
    selection: () => ctx.get('agentDefaultModel')?.currentSelection(),
  })

  for (const definition of makeTools(runtime)) {
    ctx.effect(() => ctx.tools.register(definition))
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: PREFIX,
    handler: createApiHandler(runtime),
  }))
}
