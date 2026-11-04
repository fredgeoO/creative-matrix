// The example matrix shown on first open. Everyday objects crossed with
// everyday scenes, so the first click makes sense without any theory
// background. Seven richer templates ship in `templates/`.

export const SEED_THEME =
  '用身边的东西想出不寻常的点子，每个想法都要能说出为什么。'

export const SEED_ROWS = [
  { name: '苹果', hint: '一种普通水果，能看、能吃、会变色、会腐烂' },
  { name: '水', hint: '会流动、会结冰、会蒸发，也会把东西泡软' },
  { name: '影子', hint: '光被挡住时出现的形状，会跟着人动' },
  { name: '积木', hint: '可以搭高，也可以推倒，搭法比块数更重要' },
  { name: '风筝', hint: '需要风、线和人一起配合，线太紧反而飞不高' },
  { name: '镜子', hint: '会反射，也会让空间看起来更深' },
]

export const SEED_COLS = [
  { name: '早餐桌', hint: '每天早上都会发生的小场景，时间很紧' },
  { name: '下雨天', hint: '计划被打乱，但也能玩出新花样' },
  { name: '游乐场', hint: '有规则、有排队、有意外，也有尖叫' },
  { name: '睡前故事', hint: '要在五分钟内讲完，还要让人想听下一句' },
  { name: '太空旅行', hint: '很多东西会失重、会变贵、会变得不听话' },
]

export function createSeedMatrix(makeId, now = Date.now()) {
  const rows = SEED_ROWS.map(row => ({ id: makeId('r'), ...row }))
  const cols = SEED_COLS.map(col => ({ id: makeId('c'), ...col }))
  return {
    version: 1,
    title: '格致矩阵',
    theme: SEED_THEME,
    prompt: '',
    userPrompt: '',
    model: null,
    rows,
    cols,
    cells: {},
    updatedAt: now,
  }
}
