import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCritiqueSystem,
  buildCritiqueUser,
  buildSystem,
  buildUser,
  defaultUser,
  previewPrompt,
  promptVars,
  renderPrompt,
  renderUserTemplate,
} from '../lib/prompt.js'

const row = { id: 'r-1', name: '博弈论', hint: '激励与均衡' }
const col = { id: 'c-1', name: '产品冷启动', hint: '零预算' }

test('Chinese user prompt carries both axes, theme, hint and previous takeaway', () => {
  const prompt = buildUser({
    row,
    col,
    theme: '独立创作者',
    hint: '写得更具体',
    previous: '上一版结论',
    language: 'zh',
  })
  assert.match(prompt, /博弈论（激励与均衡）/)
  assert.match(prompt, /产品冷启动（零预算）/)
  assert.match(prompt, /独立创作者/)
  assert.match(prompt, /写得更具体/)
  assert.match(prompt, /上一版结论/)
})

test('the default prompt is one sentence naming both axes and the length budget', () => {
  const zh = buildSystem('zh')
  const en = buildSystem('en')
  assert.ok(!zh.includes('\n'), 'zh default prompt must stay a single line')
  assert.ok(!en.includes('\n'), 'en default prompt must stay a single line')
  assert.match(zh, /纵横轴/)
  assert.match(zh, /150 字/)
  assert.match(en, /both axes/i)
  assert.match(en, /150 characters/)
  // The old block spelled out numbered rules and a worked example; those are
  // what produced ~2000-character cells.
  assert.doesNotMatch(zh, /格式（/)
  assert.doesNotMatch(zh, /写 3 条/)
  assert.doesNotMatch(zh, /反直觉洞察/)
  // A sentence, not a document: keep the ceiling close to the sentence itself.
  assert.ok(zh.length < 60, `zh system prompt is ${zh.length} chars`)
  assert.ok(en.length < 140, `en system prompt is ${en.length} chars`)
})

test('English prompt is used when outputLanguage starts with en', () => {
  const prompt = buildUser({ row, col, theme: '', hint: '', language: 'en-US' })
  assert.match(prompt, /Model \(vertical axis\)/)
  assert.match(prompt, /Scene \(horizontal axis\)/)
  assert.doesNotMatch(prompt, /纵轴/)
})

test('user prompt skips empty theme/hint sections', () => {
  const prompt = buildUser({ row, col, theme: '', hint: '', language: 'zh' })
  assert.doesNotMatch(prompt, /主题/)
  assert.doesNotMatch(prompt, /补充要求/)
})

test('critique prompt is a single short sentence too', () => {
  const zh = buildCritiqueSystem('zh')
  assert.match(zh, /假设/)
  assert.match(zh, /反例/)
  assert.match(zh, /80 字/)
  assert.ok(!zh.includes('\n'))
  assert.doesNotMatch(zh, /300 字/)
  const prompt = buildCritiqueUser({ draft: '> 一句话：草稿\n\n正文', row, col, language: 'zh' })
  assert.match(prompt, /草稿/)
  assert.match(prompt, /博弈论 × 产品冷启动/)
})

test('previewPrompt returns both system and user text', () => {
  const preview = previewPrompt({ row, col, theme: 't', hint: 'h', language: 'zh' })
  assert.ok(preview.system.length > 20)
  assert.ok(preview.user.includes('博弈论'))
})

test('promptVars maps every placeholder to the cell content', () => {
  const vars = promptVars({
    row,
    col,
    theme: ' 独立创作者 ',
    title: '测试矩阵',
    hint: '写具体一点',
    previous: '旧结论',
  })
  assert.equal(vars.row, '博弈论')
  assert.equal(vars.rowHint, '激励与均衡')
  assert.equal(vars.col, '产品冷启动')
  assert.equal(vars.colHint, '零预算')
  assert.equal(vars.theme, '独立创作者')
  assert.equal(vars.title, '测试矩阵')
  assert.equal(vars.hint, '写具体一点')
  assert.equal(vars.previous, '旧结论')
  assert.equal(vars.cell, '博弈论 × 产品冷启动')
})

test('renderPrompt replaces Chinese tokens and ASCII aliases, ignoring case', () => {
  const vars = promptVars({ row, col, theme: '独立创作者', title: '测试矩阵', hint: '补充', previous: '旧' })
  const text = renderPrompt(
    '{纵标题} / {ROW} × {横标题} · {主题} · {title} · {rowHint} · {colhint} · {坐标}',
    vars,
  )
  assert.equal(text, '博弈论 / 博弈论 × 产品冷启动 · 独立创作者 · 测试矩阵 · 激励与均衡 · 零预算 · 博弈论 × 产品冷启动')
})

test('renderPrompt leaves unknown braces untouched and blanks empty values', () => {
  const vars = promptVars({ row, col, theme: '', title: 't', hint: '', previous: '' })
  assert.equal(renderPrompt('{主题}保持', vars), '保持')
  assert.equal(renderPrompt('JSON {"a":1} 与 {未知}', vars), 'JSON {"a":1} 与 {未知}')
  // No placeholders at all: the text is returned unchanged, not re-encoded.
  assert.equal(renderPrompt('普通提示词', vars), '普通提示词')
})

test('a custom system prompt is rendered with the cell variables', () => {
  const vars = promptVars({ row, col, theme: '独立创作者', title: '测试矩阵' })
  const system = buildSystem('zh', '只讨论{纵标题}在{横标题}中的约束。', vars)
  assert.equal(system, '只讨论博弈论在产品冷启动中的约束。')
  // Omitting vars keeps the historical behaviour (raw custom text).
  assert.equal(buildSystem('zh', '只讨论{纵标题}'), '只讨论{纵标题}')
})

test('previewPrompt exposes the raw template and the rendered messages', () => {
  const preview = previewPrompt({
    row,
    col,
    theme: '独立创作者',
    title: '测试矩阵',
    language: 'zh',
    custom: '结合{纵标题}与{横标题}，主题是{主题}。',
  })
  assert.equal(preview.template, '结合{纵标题}与{横标题}，主题是{主题}。')
  assert.equal(preview.system, '结合博弈论与产品冷启动，主题是独立创作者。')
  assert.equal(preview.vars.row, '博弈论')
  assert.match(preview.user, /博弈论/)
})

test('an empty custom prompt previews the built-in default', () => {
  const preview = previewPrompt({ row, col, theme: '', language: 'zh', custom: '   ' })
  assert.match(preview.system, /结合纵横轴/)
  assert.equal(preview.template, preview.system)
})

test('the default user template carries placeholders and matches the old layout', () => {
  const template = defaultUser('zh')
  for (const token of ['{纵标题}', '{纵提示}', '{横标题}', '{横提示}', '{主题}', '{补充要求}', '{上一版}']) {
    assert.ok(template.includes(token), `default user template should contain ${token}`)
  }
  const user = buildUser({
    row,
    col,
    theme: '独立创作者',
    hint: '写具体',
    previous: '旧结论',
    language: 'zh',
  })
  assert.match(user, /纵轴（模型）：博弈论（激励与均衡）/)
  assert.match(user, /横轴（场景）：产品冷启动（零预算）/)
  assert.match(user, /主题：独立创作者/)
  assert.match(user, /补充要求：写具体/)
  assert.match(user, /上一版结论（不要重复）：旧结论/)
  assert.match(user, /直接写这一段/)
})

test('a custom user template is substituted and empty-only lines are dropped', () => {
  const template = [
    '模型：{纵标题}',
    '主题：{主题}',
    '补充：{补充要求}',
    '坐标：{坐标}',
  ].join('\n')
  const user = buildUser({ row, col, theme: '', hint: '', language: 'zh', template })
  assert.equal(user, '模型：博弈论\n坐标：博弈论 × 产品冷启动')
})

test('empty parenthetical hints disappear instead of leaving （）', () => {
  const user = buildUser({ row: { ...row, hint: '' }, col: { ...col, hint: '' }, language: 'zh' })
  assert.match(user, /纵轴（模型）：博弈论/)
  assert.doesNotMatch(user, /（）|\(\)/)
})

test('renderUserTemplate leaves unknown braces and keeps literal lines', () => {
  const vars = promptVars({ row, col, theme: '', title: 't' })
  assert.equal(renderUserTemplate('JSON {"a":1}\n主题：{主题}\n保留', vars), 'JSON {"a":1}\n保留')
})

test('previewPrompt exposes both templates and both rendered messages', () => {
  const preview = previewPrompt({
    row,
    col,
    theme: '独立创作者',
    language: 'zh',
    custom: '系统：{纵标题}',
    userCustom: '用户：{横标题} / {主题}',
  })
  assert.equal(preview.template, '系统：{纵标题}')
  assert.equal(preview.userTemplate, '用户：{横标题} / {主题}')
  assert.equal(preview.system, '系统：博弈论')
  assert.equal(preview.user, '用户：产品冷启动 / 独立创作者')
})
