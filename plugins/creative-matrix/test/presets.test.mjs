import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { parsePreset, parseTemplateReply, presetFilename, presetSlug, serializePreset } from '../lib/presets.js'

const here = path.dirname(fileURLToPath(import.meta.url))

test('parses a shipped template with hints and body', async () => {
  const text = await readFile(path.join(here, '..', 'templates', 'starter-simple.md'), 'utf8')
  const preset = parsePreset(text, { file: 'starter-simple.md' })
  assert.equal(preset.title, '身边的小创意')
  assert.equal(preset.rows.length, 6)
  assert.equal(preset.cols.length, 5)
  assert.equal(preset.rows[0].name, '苹果')
  assert.match(preset.rows[0].hint, /水果/)
  assert.match(preset.body, /怎么用/)
})

test('parses a shipped template whose prompt is one sentence', async () => {
  const text = await readFile(path.join(here, '..', 'templates', 'story-craft.md'), 'utf8')
  const preset = parsePreset(text, { file: 'story-craft.md' })
  assert.match(preset.prompt, /^用这个叙事工具写这个场景/)
  assert.match(preset.prompt, /直接写这一段，不要开场白。$/)
  assert.equal(preset.rows.length, 6)
})

test('every shipped template carries a one-sentence prompt', async () => {
  const dir = path.join(here, '..', 'templates')
  const files = (await readdir(dir)).filter(name => name.endsWith('.md'))
  assert.ok(files.length >= 5, `only found ${files.length} templates`)
  for (const file of files) {
    const preset = parsePreset(await readFile(path.join(dir, file), 'utf8'), { file })
    assert.ok(preset.prompt !== '', `${file}: template has no prompt`)
    assert.ok(!preset.prompt.includes('\n'), `${file}: prompt must be a single line`)
    assert.match(preset.prompt, /直接写这一段，不要开场白。$/, `${file}: prompt must forbid a preamble`)
    const core = preset.prompt
      .replace(/。直接写这一段，不要开场白。$/, '')
    assert.ok([...core].length <= 30, `${file}: task summary is ${[...core].length} chars, keep it 15-20`)
    assert.ok(preset.prompt.length <= 80, `${file}: prompt is ${preset.prompt.length} chars`)
  }
})

test('quoted values survive a serialize/parse round trip', () => {
  const source = {
    title: 'A: B — 带冒号',
    description: '他说："先做小实验"',
    theme: '# 不是注释',
    prompt: '你是故事教练。\n\n规则：\n1. 第一行写结论\n2. 空行要保留\n  - 缩进子项',
    userPrompt: '模型：{纵标题}\n场景：{横标题}\n\n主题：{主题}',
    rows: [{ name: '甲: 乙', hint: 'hint: value' }],
    cols: [{ name: '一', hint: '' }],
    body: '# 说明\n\n- 列表项保留',
  }
  const text = serializePreset(source)
  const parsed = parsePreset(text, { file: 'x.md' })
  assert.equal(parsed.title, source.title)
  assert.equal(parsed.description, source.description)
  assert.equal(parsed.theme, source.theme)
  assert.equal(parsed.prompt, source.prompt)
  assert.equal(parsed.userPrompt, source.userPrompt)
  assert.equal(parsed.rows[0].name, source.rows[0].name)
  assert.equal(parsed.rows[0].hint, source.rows[0].hint)
  assert.equal(parsed.body, source.body)
})

test('parses userPrompt in camelCase, snake_case and block form', () => {
  const base = ['title: t', 'rows:', '  - name: 甲', 'cols:', '  - name: 乙']
  const camel = parsePreset(['---', ...base, 'userPrompt: 单行 {主题}', '---'].join('\n'))
  assert.equal(camel.userPrompt, '单行 {主题}')
  const snake = parsePreset(['---', ...base, 'user_prompt: |', '  第一行', '  第二行', '---'].join('\n'))
  assert.equal(snake.userPrompt, '第一行\n第二行')
  const missing = parsePreset(['---', ...base, '---'].join('\n'))
  assert.equal(missing.userPrompt, '')
})

test('rejects an unclosed frontmatter and empty axes', () => {
  assert.throws(() => parsePreset('---\ntitle: x\n'), /not closed/)
  assert.throws(() => parsePreset('---\ntitle: x\n---\nbody'), /rows and cols/)
})

test('preset filenames stay inside the directory and end with .md', () => {
  assert.equal(presetFilename('', '我的 模板'), '我的-模板.md')
  assert.equal(presetFilename('abc', 'x'), 'abc.md')
  assert.throws(() => presetFilename('../escape.md', 'x'), /invalid/)
  assert.throws(() => presetFilename('a/b.md', 'x'), /invalid/)
  assert.equal(presetSlug('a/b:c'), 'a-b-c')
})

test('parseTemplateReply accepts a fenced yaml block with prose around it', () => {
  const reply = [
    '好的，这是模板：',
    '```yaml',
    'title: 谈判推演',
    'description: 把博弈模型放进具体谈判场景。',
    'theme: 商务谈判',
    'prompt: 说清这个模型在这个谈判里逼出了什么。直接写这一段，不要开场白。',
    'rows:',
    '  - name: 承诺的可信度',
    '    hint: 敢不敢把退路烧掉',
    '  - name: 信息不对称',
    'cols:',
    '  - name: 一对一谈判',
    '  - name: 多方混战',
    '    hint: 联盟随时倒戈',
    '```',
    '希望有帮助。',
  ].join('\n')
  const parsed = parseTemplateReply(reply)
  assert.equal(parsed.title, '谈判推演')
  assert.match(parsed.prompt, /^说清这个模型在这个谈判里逼出了什么/)
  assert.deepEqual(parsed.rows.map(row => row.name), ['承诺的可信度', '信息不对称'])
  assert.equal(parsed.rows[0].hint, '敢不敢把退路烧掉')
  assert.equal(parsed.cols[1].hint, '联盟随时倒戈')
})

test('parseTemplateReply accepts a bare frontmatter document and rejects junk', () => {
  const bare = parseTemplateReply([
    '---',
    'title: 裸文档',
    'rows:',
    '  - name: 甲',
    'cols:',
    '  - name: 乙',
    '---',
  ].join('\n'))
  assert.equal(bare.title, '裸文档')
  assert.throws(() => parseTemplateReply('   '), /empty/)
  assert.throws(() => parseTemplateReply('```yaml\n\n```'), /empty/)
  assert.throws(() => parseTemplateReply('抱歉，我没法设计。'), /rows and cols/)
})
