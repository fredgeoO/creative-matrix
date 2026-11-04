/**
 * Client half of @local/creative-matrix — entry and data layer.
 *
 * Registers the sidebar icon and the main panel, but every visual part lives
 * in the lazily loaded sibling chunk `client.ui.js`: the store, the SSE
 * streams and the Host API calls stay here; the React tree and its CSS do not.
 *
 * The panel can unmount when another sidebar entry is selected, so the store,
 * the live buffers and the in-flight fetch all live at module scope. The
 * component tree is only a view over the store owned by this file.
 */

window.__ModuleLoader__.load({
  id: '@local/creative-matrix',
  factory(require) {
    const API = '/creative-matrix/api'
    const POLL_MS = 6000

    const EN = {
      'panel.title': 'Gezhi Matrix',
      'panel.subtitle': 'Gezhi: investigate things to extend knowing. The axes can be anything you choose — each intersection is one causal probe, not a word mashup.',
      'panel.refresh': 'Refresh',
      'panel.editAxes': 'Edit axes',
      'panel.prompt': 'Prompt',
      'panel.export': 'Export .md',
      'panel.exporting': 'Exporting…',
      'panel.theme': 'Global theme',
      'panel.themePlaceholder': 'What is this matrix for? Decisions, writing, consulting…',
      'panel.templates': 'Templates',

      'axis.rows': 'Rows',
      'axis.cols': 'Columns',
      'other.templatesHint': 'Load, save and let the model draft or rewrite templates.',
      'other.promptOn': 'Custom prompt active',
      'other.promptDefault': 'Using the built-in default prompt',
      'other.filledCells': '{n} cells filled',
      'model.label': 'Model',
      'model.default': 'Follow default model',
      'model.defaultWith': 'Follow default · {model}',
      'model.loading': 'Reading models…',
      'model.refresh': 'Refresh models',
      'model.failed': 'Model list failed',
      'model.empty': 'No models returned',
      'templates.title': 'Templates & presets',
      'templates.loadTab': 'Load a template',
      'templates.saveTab': 'Save current axes',
      'templates.builtin': 'Built-in',
      'templates.user': 'Mine',
      'templates.load': 'Load',
      'templates.confirmLoad': 'Load and delete {n} cell(s)',
      'templates.delete': 'Delete template',
      'templates.deleteConfirm': 'Confirm delete',
      'templates.deleteTitle': 'Delete this template file. The current matrix and its generated cells are not touched.',
      'templates.builtinReadonly': 'Built-in templates are read-only. Load one and save it as your own before deleting.',
      'templates.empty': 'No presets found.',
      'templates.error': 'Cannot read presets',
      'templates.axes': '{r} rows × {c} cols',
      'templates.descriptionEmpty': 'No description.',
      'templates.saveTitle': 'Preset name',
      'templates.saveDesc': 'What is it for?',
      'templates.saveBody': 'Notes / how to use (optional)',
      'templates.save': 'Save preset',
      'templates.saving': 'Saving…',
      'templates.saved': 'Preset saved',
      'templates.loaded': 'Template loaded',
      'templates.deleted': 'Preset deleted',
      'templates.close': 'Close',
      'templates.refresh': 'Refresh',
      'templates.cancel': 'Cancel',
      'templates.select': 'Select a template on the left.',
      'prompt.title': 'Generation prompt',
      'prompt.desc': 'These are the system and user message templates for every cell. They show what is in effect right now; saving unedited defaults keeps following the built-in ones.',
      'prompt.placeholder': 'Leave empty to use the built-in default prompt.',
      'prompt.default': 'Load default prompt',
      'prompt.reset': 'Clear',
      'prompt.restore': 'Restore built-in defaults',
      'prompt.count': '{n} characters',
      'prompt.countBoth': 'System {s} characters · user {u} characters',
      'prompt.hint': 'Custom prompt · {n} characters',
      'prompt.defaultHint': 'Currently using the built-in default prompt.',
      'prompt.defaultEditing': 'following the built-in defaults — edit and save to make them custom.',
      'prompt.save': 'Save prompt',
      'prompt.saved': 'Prompt saved',
      'prompt.cancel': 'Cancel',
      'prompt.loading': 'Loading…',
      'prompt.loadFailed': 'Could not load the default prompt',
      'prompt.custom': 'custom prompt',
      'prompt.defaultShort': 'default prompt',
      'prompt.restart': 'Restart Harness to load the new Host half — the running one predates the prompt editor.',
      'prompt.templateLabel': 'System prompt template',
      'prompt.templateHint': 'Sent as the system message. `{…}` placeholders are replaced per cell right before the model call; unknown tokens are sent as-is.',
      'prompt.userLabel': 'User message template',
      'prompt.userHint': 'Sent as the user message. Same placeholders as above; a line whose placeholders are all empty is omitted, and empty （） pairs are removed.',
      'prompt.placeholders': 'Available placeholders',
      'prompt.placeholderHint': 'Click a token to insert it into the last focused box. The value column shows what it becomes in the preview cell.',
      'prompt.phRow': 'Vertical axis title (the model)',
      'prompt.phRowHint': 'Vertical axis hint',
      'prompt.phCol': 'Horizontal axis title (the scene)',
      'prompt.phColHint': 'Horizontal axis hint',
      'prompt.phTheme': 'Global theme',
      'prompt.phTitle': 'Matrix title',
      'prompt.phHint': 'Extra instruction for this generation',
      'prompt.phPrevious': 'Previous takeaway in this cell',
      'prompt.phCell': 'Coordinate, “row × col”',
      'prompt.phEmpty': 'empty',
      'prompt.insert': 'Insert {token}',
      'prompt.unknown': 'Unknown placeholders are sent as-is: {list}',
      'prompt.preview': 'What the model receives',
      'prompt.previewFor': 'Preview cell · {row} × {col}',
      'prompt.previewSystem': 'System message',
      'prompt.previewUser': 'User message',
      'prompt.previewLoading': 'Rendering…',
      'prompt.previewFailed': 'Preview failed',
      'prompt.previewEmpty': 'Add a row and a column to preview the filled prompt.',
      'prompt.previewNote': 'Both messages are sent together. The system message is your template after substitution; the user message is built by the plugin from the axes, theme and hints.',
      'templates.promptBadge': 'prompt',
      'templates.promptSection': 'Generation prompt',
      'templates.userPromptSection': 'User message template',
      'templates.promptNone': 'This template carries no custom prompts — loading it restores the built-in defaults.',
      'templates.saveNote': 'Templates store the theme, both axes and both prompts — never generated cells.',
      'templates.aiTab': 'Generate by prompt',
      'templates.idea': 'Describe the matrix you want (axes, theme, style)',
      'templates.ideaShort': 'What should change about this template?',
      'templates.draft': 'Draft',
      'templates.drafting': 'Drafting…',
      'templates.refining': 'Rewriting…',
      'templates.saveDraft': 'Save as preset',
      'templates.savedDraft': 'Template saved',
      'templates.aiFailed': 'The model could not produce a template',
      'templates.refineTarget': 'Editing: {file}',
      'templates.refined': 'Template rewritten',
      'templates.editByPrompt': 'Edit by prompt',
      'templates.refineHint': 'Type what should change, then press Rewrite — the rewrite overwrites this file.',
      'templates.aiNote': 'The model designs 4-8 entries per axis plus a theme and one-line prompt; review the draft, then save or load it.',
      'batch.label': 'Batch',
      'batch.all': 'Generate all',
      'batch.rows': 'Generate row',
      'batch.cols': 'Generate column',
      'batch.title.all': 'Batch generate',
      'batch.title.row': 'Generate one row (vertical axis)',
      'batch.title.col': 'Generate one column (horizontal axis)',
      'batch.onlyEmpty': 'Only generate empty cells',
      'batch.summary': '{total} cells · {empty} empty · {filled} filled',
      'batch.targets': 'Will generate {n} cell(s).',
      'batch.none': 'Nothing to generate with this option.',
      'batch.start': 'Start',
      'batch.cancel': 'Stop batch',
      'batch.hide': 'Dismiss',
      'batch.running': 'Generating {done}/{total}',
      'batch.done': 'Batch finished',
      'batch.doneSummary': 'Done {done} · failed {failed} · skipped {skipped}',
      'batch.failed': 'Batch failed',
      'batch.stopped': 'Batch stopped',
      'batch.note': 'Unticking “Only generate empty cells” rewrites filled cells in this scope; generation uses the current parallelism and can consume tokens.',
      'batch.current': 'Current: {name}',
      'batch.currentMany': '{n} cells in parallel',
      'batch.concurrencyLine': 'Parallel: {value}',
      'concurrency.label': 'Parallel',
      'concurrency.all': 'All at once',
      'concurrency.hint': 'How many cells one batch generates at the same time. "All at once" starts every cell immediately.',
      'concurrency.restart': 'Restart Harness to load the new Host half — the running one predates this option.',
      'notice.concurrency': 'Parallel updated',
      'batch.close': 'Close',
      'batch.selectAxis': 'Choose the axis item to generate.',
      'axis.renameHint': 'Click to rename',
      'axis.hintHint': 'Click to edit the hint — it feeds both prompts',
      'axis.addHint': 'Add hint',
      'axis.hintPlaceholder': 'What should this item probe? (optional)',
      'axis.generate': 'Generate this axis',
      'axis.generateShort': 'Gen',
      'axis.generateHint': 'Generate the empty cells on this axis.',
      'axis.generateFullHint': 'Regenerate every cell on this axis (overwrites filled cells).',
      'axis.regenerateShort': 'Regen',
      'axis.regenShort': 'All',
      'axis.regenHint': 'Also regenerate filled cells on this axis',
      'axis.noEmpty': 'This axis has no empty cells — tick “All” to regenerate them.',
      'axis.remove': 'Delete this axis',
      'axis.confirmRemove': 'Press again to delete',
      'axis.confirmRemoveWith': 'Press again to delete — {n} generated cell(s) go with it',
      'axis.removeBlocked': 'Keep at least one row and one column.',
      'axis.addRow': 'Add row',
      'axis.addCol': 'Add column',
      'axis.duplicate': 'That name is already used on this axis.',
      'axis.full': 'This axis is at its 12-item limit.',
      'notice.axisAdded': 'Axis added',
      'notice.axisRemoved': 'Axis deleted',
      'notice.axisBusy': 'A batch is still running — wait for it to finish.',
      'notice.renamed': 'Renamed',
      'notice.renameFailed': 'Rename failed',
      'notice.hintSaved': 'Hint saved',
      'notice.hintFailed': 'Hint update failed',
      'notice.model': 'Model updated',
      'notice.loadFailed': 'Could not load the template',
      'panel.modelError': 'Model unavailable',
      'panel.storeMissing': 'Not persisted',
      'corner.title': 'Matrix theme — click to edit',
      'corner.placeholder': 'Theme (optional)',
      'notice.themeSaved': 'Theme saved',
      'cell.empty': 'Not generated',
      'cell.emptyHint': 'Click to generate this collision.',
      'cell.generate': 'Generate',
      'cell.regenerate': 'Regenerate',
      'cell.generating': 'Generating…',
      'cell.queued': 'Queued…',
      'cell.error': 'Failed',
      'cell.noTakeaway': 'Open to read',
      'cell.deep': 'deep',
      'cell.manual': 'manual',
      'cell.tokens': '{n} tok',
      'drawer.title': 'Cell detail',
      'drawer.close': 'Close',
      'drawer.loading': 'Loading…',
      'drawer.empty': 'This cell has no content yet. Generate it, or write it by hand.',
      'drawer.hintPlaceholder': 'Extra instruction for the next generation (optional)',
      'drawer.generate': 'Generate',
      'drawer.deep': 'Deep review',
      'drawer.stop': 'Stop',
      'drawer.edit': 'Edit',
      'drawer.save': 'Save',
      'drawer.cancel': 'Cancel',
      'drawer.copy': 'Copy Markdown',
      'drawer.copyPrompt': 'Copy prompt',
      'drawer.clear': 'Clear',
      'drawer.confirmClear': 'Confirm clear',
      'drawer.mode': 'Mode',
      'drawer.model': 'Model',
      'drawer.updated': 'Updated',
      'drawer.tokens': 'Tokens',
      'drawer.error': 'Generation failed',
      'drawer.retry': 'Retry',
      'editor.rows': 'Rows · vertical axis',
      'editor.cols': 'Columns · horizontal axis',
      'editor.nameRequired': 'Every axis needs a name.',
      'notice.copied': 'Copied',
      'notice.copyFailed': 'Copy failed',
      'notice.saved': 'Saved',
      'notice.generated': 'Cell generated',
      'notice.exported': 'Exported',
      'notice.exportFailed': 'Export failed',
      'error.load': 'Cannot load the matrix',
      'error.retry': 'Retry',
      'error.streamEnded': 'The stream ended before the result arrived. Generation may still be running in the background.',
      'error.noModel': 'No default model is configured. Pick one in Settings, or set provider/model in the plugin config.',
      'empty.title': 'This matrix is empty',
      'empty.body': 'Add a row and a column to start.',
      'warning.unsaved': 'Content is in memory only — writing to disk failed.',
      'warning.store': 'Matrix file problem',
      'warning.rebuild': 'Rebuild sample matrix',
      'warning.rebuildConfirm': 'Confirm rebuild',
      'warning.lines': 'Loaded with {n} warning(s).',
      'time.now': 'just now',
      'time.min': '{n} min ago',
      'time.hour': '{n} h ago',
      'time.date': '{n}',

      'tab.matrix': 'Matrix',
      'tab.templates': 'Templates',
      'tab.prompt': 'Prompt',
      'head.more': 'More actions',
      'head.batch': 'Batch generate…',
      'head.preset': 'Template · {name}',
      'head.noPreset': 'No template bound',
      'head.progress': 'Generating {done}/{total}',
      'head.filled': '{filled}/{total} cells',
      'save.button': 'Save template',
      'save.title': 'Save as template',
      'save.desc': 'Save the current theme, both axes and both prompts as a template. Generated cells are never written into a template.',
      'save.overwrite': 'Overwrite the current template',
      'save.overwriteHint': 'Write the current content into {file}',
      'save.new': 'Save as a new template',
      'save.newHint': 'Leave the current template alone and create a new file.',
      'save.noPreset': 'No template is bound yet — save as a new template.',
      'save.builtin': 'Built-in templates are read-only — save as a new template.',
      'save.name': 'Template name',
      'save.descLabel': 'Description',
      'save.body': 'Notes / how to use (optional)',
      'save.copySuffix': ' copy',
      'save.untitled': 'My matrix template',
      'save.confirm': 'Save template',
      'save.saving': 'Saving…',
      'save.saved': 'Template saved',
      'save.skipBody': 'Add notes / how to use',
      'save.summary': '{r} rows × {c} cols',
      'save.themeNone': 'No theme',
      'save.promptOn': 'Custom prompts',
      'save.promptDefault': 'Default prompts',
      'corner.all': 'Generate all',
      'corner.allRegen': 'Regenerate all',
      'corner.includeFilled': 'Include filled cells',
      'corner.includeHint': 'Checked: regenerate every cell in scope. Unchecked: fill empty cells only.',
      'corner.fullHint': 'Regenerate all {n} cells, overwriting their current content.',
      'corner.allHint': 'Fill every empty cell. Tick “Include filled cells” to redo filled ones too.',
      'corner.allFull': 'No empty cells — tick “Include filled cells” to redo them.',
      'corner.running': 'Generating {done}/{total}',
      'corner.stop': 'Stop',
      'prompt.subtitle': 'The system and user message templates for every cell; placeholders are filled from the cell just before the model call.',
      'prompt.note': 'Saving updates both prompts on the matrix. Use Save template to write them into a template. The preview always uses the first cell.',
      'templates.subtitle': 'Loading a template replaces the theme, both axes and both prompts; cells on the axes that survive are kept.',
    }

    const ZH = {
      'panel.title': '格致矩阵',
      'panel.subtitle': '格物致知：纵横两轴可以是任何东西，每个交叉点都是一次即物穷理的推演，而不是两个词的拼接。',
      'panel.refresh': '刷新',
      'panel.editAxes': '编辑维度',
      'panel.prompt': '提示词',
      'panel.export': '导出 .md',
      'panel.exporting': '导出中…',
      'panel.theme': '全局主题',
      'panel.themePlaceholder': '这张矩阵为什么服务？决策、写作、咨询……',
      'panel.templates': '模板',

      'axis.rows': '纵轴',
      'axis.cols': '横轴',
      'other.templatesHint': '加载、保存模板，或让模型起草与改写。',
      'other.promptOn': '已启用自定义提示词',
      'other.promptDefault': '使用内置默认提示词',
      'other.filledCells': '已生成 {n} 格',
      'model.label': '模型',
      'model.default': '跟随默认模型',
      'model.defaultWith': '跟随默认模型 · {model}',
      'model.loading': '读取模型中…',
      'model.refresh': '刷新模型',
      'model.failed': '模型列表读取失败',
      'model.empty': '没有可用模型',
      'templates.title': '模板与预设',
      'templates.loadTab': '载入模板',
      'templates.saveTab': '保存当前维度',
      'templates.builtin': '内置',
      'templates.user': '我的',
      'templates.load': '载入',
      'templates.confirmLoad': '确认载入并删除 {n} 个单元格',
      'templates.delete': '删除模板',
      'templates.deleteConfirm': '确认删除',
      'templates.deleteTitle': '删除这个模板文件；不会影响当前矩阵和已生成的单元格。',
      'templates.builtinReadonly': '内置模板只读。先载入并另存为自己的模板，才能删除。',
      'templates.empty': '还没有预设。',
      'templates.error': '预设读取失败',
      'templates.axes': '{r} 行 × {c} 列',
      'templates.descriptionEmpty': '没有说明。',
      'templates.saveTitle': '预设名称',
      'templates.saveDesc': '这个模板用来做什么？',
      'templates.saveBody': '说明 / 怎么用（可选）',
      'templates.save': '保存预设',
      'templates.saving': '保存中…',
      'templates.saved': '预设已保存',
      'templates.loaded': '模板已载入',
      'templates.deleted': '预设已删除',
      'templates.close': '关闭',
      'templates.refresh': '刷新',
      'templates.cancel': '取消',
      'templates.select': '在左边选一个模板。',
      'prompt.title': '生成提示词',
      'prompt.desc': '这两段文字会成为每个格子的系统提示词和用户消息模板。这里显示当前真正生效的内容；不动它直接保存，就继续跟随内置默认。',
      'prompt.placeholder': '留空 = 使用内置默认提示词',
      'prompt.default': '填入默认提示词',
      'prompt.reset': '清空',
      'prompt.restore': '恢复内置默认',
      'prompt.count': '{n} 字',
      'prompt.countBoth': '系统 {s} 字 · 用户 {u} 字',
      'prompt.hint': '自定义提示词 · {n} 字',
      'prompt.defaultHint': '当前使用内置默认提示词。',
      'prompt.defaultEditing': '跟随内置默认，改完保存即成自定义。',
      'prompt.save': '保存提示词',
      'prompt.saved': '提示词已保存',
      'prompt.cancel': '取消',
      'prompt.loading': '读取中…',
      'prompt.loadFailed': '默认提示词读取失败',
      'prompt.custom': '自定义提示词',
      'prompt.defaultShort': '内置默认',
      'prompt.restart': '重启 Harness 后可用：当前 Host 还没加载提示词编辑器。',
      'prompt.templateLabel': '系统提示词模板',
      'prompt.templateHint': '这段文字会作为系统消息发送。`{…}` 占位符在调用模型前按单元格替换；不认识的占位符原样发送。',
      'prompt.userLabel': '用户消息模板',
      'prompt.userHint': '这段文字会作为用户消息发送；占位符同上。一行里的占位符全为空时整行省略，空的「（）」也会去掉。',
      'prompt.placeholders': '可用占位符',
      'prompt.placeholderHint': '点一下即可插入到最近编辑的框；右侧显示它在预览单元格里的实际内容。',
      'prompt.phRow': '纵轴标题（思维模型）',
      'prompt.phRowHint': '纵轴提示',
      'prompt.phCol': '横轴标题（场景）',
      'prompt.phColHint': '横轴提示',
      'prompt.phTheme': '全局主题',
      'prompt.phTitle': '矩阵标题',
      'prompt.phHint': '本次生成的补充要求',
      'prompt.phPrevious': '这个格子上一版的一句话结论',
      'prompt.phCell': '坐标「纵 × 横」',
      'prompt.phEmpty': '空',
      'prompt.insert': '插入 {token}',
      'prompt.unknown': '不认识的占位符会原样发送：{list}',
      'prompt.preview': '送进模型的内容',
      'prompt.previewFor': '预览单元格 · {row} × {col}',
      'prompt.previewSystem': '系统消息',
      'prompt.previewUser': '用户消息',
      'prompt.previewLoading': '生成预览中…',
      'prompt.previewFailed': '预览失败',
      'prompt.previewEmpty': '先添加一行和一列，才能预览替换后的提示词。',
      'prompt.previewNote': '两条消息会一起发送：系统消息是替换后的模板，用户消息由插件按纵横轴、主题和提示生成。',
      'templates.promptBadge': '含提示词',
      'templates.promptSection': '生成提示词',
      'templates.userPromptSection': '用户消息模板',
      'templates.promptNone': '这个模板不带走自定义提示词，载入后回到内置默认的两段模板。',
      'templates.saveNote': '模板会保存主题、纵横轴和两段提示词，不会保存已生成的格子。',
      'templates.aiTab': '用提示词生成',
      'templates.idea': '描述你想要的矩阵：主题、两轴、风格……',
      'templates.ideaShort': '这个模板要往什么方向改？',
      'templates.draft': '起草',
      'templates.drafting': '起草中…',
      'templates.refining': '改写中…',
      'templates.saveDraft': '保存为预设',
      'templates.savedDraft': '模板已保存',
      'templates.aiFailed': '模型没能产出模板',
      'templates.refineTarget': '正在修改：{file}',
      'templates.refined': '模板已改写',
      'templates.editByPrompt': '用提示词修改',
      'templates.refineHint': '写下要改什么，再按「改写」；改写会直接覆盖这个文件。',
      'templates.aiNote': '模型会设计 4–8 项纵横轴、主题和一句生成提示词；先看草稿，满意再保存或载入。',
      'batch.label': '批量',
      'batch.all': '全生成',
      'batch.rows': '纵轴生成',
      'batch.cols': '横轴生成',
      'batch.title.all': '批量生成',
      'batch.title.row': '纵轴生成：选一行',
      'batch.title.col': '横轴生成：选一列',
      'batch.onlyEmpty': '只生成空单元格',
      'batch.summary': '{total} 格 · 空 {empty} · 已有 {filled}',
      'batch.targets': '将生成 {n} 个单元格。',
      'batch.none': '按当前选项没有要生成的单元格。',
      'batch.start': '开始生成',
      'batch.cancel': '停止批量',
      'batch.hide': '收起',
      'batch.running': '批量生成中 {done}/{total}',
      'batch.done': '批量生成完成',
      'batch.doneSummary': '完成 {done} · 失败 {failed} · 跳过 {skipped}',
      'batch.failed': '批量生成失败',
      'batch.stopped': '批量已停止',
      'batch.note': '取消勾选「只生成空单元格」会重写这个范围里的已有内容；生成按当前并发进行，会消耗 token。',
      'batch.current': '当前：{name}',
      'batch.currentMany': '并行生成 {n} 格',
      'batch.concurrencyLine': '并发：{value}',
      'concurrency.label': '并发',
      'concurrency.all': '一次过（不限）',
      'concurrency.hint': '批量生成时同时跑几格；「一次过」= 所有格子同时开始。',
      'concurrency.restart': '重启 Harness 后可用：当前 Host 还没加载新代码。',
      'notice.concurrency': '并发已更新',
      'batch.close': '关闭',
      'batch.selectAxis': '选一个要生成的轴项目。',
      'axis.renameHint': '点击改名',
      'axis.hintHint': '点击编辑简介；简介会进入提示词',
      'axis.addHint': '添加简介',
      'axis.hintPlaceholder': '这一项要推演什么？（可选）',
      'axis.generate': '生成这条轴',
      'axis.generateShort': '生成',
      'axis.generateHint': '生成这条轴上的空单元格。',
      'axis.generateFullHint': '重生成这条轴上的全部格子（会覆盖已有内容）。',
      'axis.regenerateShort': '重生成',
      'axis.regenShort': '全',
      'axis.regenHint': '连已生成的格子一起重生成',
      'axis.noEmpty': '这条轴没有空缺单元格；勾选「全」即可重生成。',
      'axis.remove': '删除这条轴',
      'axis.confirmRemove': '再按一次删除',
      'axis.confirmRemoveWith': '再按一次删除 · 会连同 {n} 个已生成单元格一起删掉',
      'axis.removeBlocked': '至少保留一行和一列。',
      'axis.addRow': '添加纵轴',
      'axis.addCol': '添加横轴',
      'axis.duplicate': '这条轴上已有同名维度。',
      'axis.full': '每条轴最多 12 项。',
      'notice.axisAdded': '已添加维度',
      'notice.axisRemoved': '已删除维度',
      'notice.axisBusy': '正在批量生成，请等这一批结束。',
      'notice.renamed': '已改名',
      'notice.renameFailed': '改名失败',
      'notice.hintSaved': '简介已保存',
      'notice.hintFailed': '简介更新失败',
      'notice.model': '模型已更新',
      'notice.loadFailed': '模板载入失败',
      'panel.modelError': '模型不可用',
      'panel.storeMissing': '未持久化',
      'corner.title': '这张矩阵的主题 — 点击编辑',
      'corner.placeholder': '主题（可选）',
      'notice.themeSaved': '主题已保存',
      'cell.empty': '尚未生成',
      'cell.emptyHint': '点开生成这份交叉推演。',
      'cell.generate': '生成',
      'cell.regenerate': '重生成',
      'cell.generating': '生成中…',
      'cell.queued': '排队中…',
      'cell.error': '失败',
      'cell.noTakeaway': '点开阅读',
      'cell.deep': '深度',
      'cell.manual': '手写',
      'cell.tokens': '{n} tok',
      'drawer.title': '单元格详情',
      'drawer.close': '关闭',
      'drawer.loading': '加载中…',
      'drawer.empty': '这个交叉点还没有内容。可以生成，也可以手写。',
      'drawer.hintPlaceholder': '下一次生成的额外要求（可选）',
      'drawer.generate': '生成',
      'drawer.deep': '深度审阅',
      'drawer.stop': '停止',
      'drawer.edit': '编辑',
      'drawer.save': '保存',
      'drawer.cancel': '取消',
      'drawer.copy': '复制 Markdown',
      'drawer.copyPrompt': '复制提示词',
      'drawer.clear': '清空',
      'drawer.confirmClear': '确认清空',
      'drawer.mode': '模式',
      'drawer.model': '模型',
      'drawer.updated': '更新于',
      'drawer.tokens': 'Tokens',
      'drawer.error': '生成失败',
      'drawer.retry': '重试',
      'editor.rows': '纵轴（可以是任何东西）',
      'editor.cols': '横轴（可以是任何东西）',
      'editor.nameRequired': '每一项都需要名称。',
      'notice.copied': '已复制',
      'notice.copyFailed': '复制失败',
      'notice.saved': '已保存',
      'notice.generated': '生成完成',
      'notice.exported': '已导出',
      'notice.exportFailed': '导出失败',
      'error.load': '矩阵加载失败',
      'error.retry': '重试',
      'error.streamEnded': '连接提前结束，生成可能仍在后台进行。',
      'error.noModel': '没有配置默认模型。请先在设置里选择模型，或在插件配置里写 provider/model。',
      'empty.title': '矩阵还是空的',
      'empty.body': '先添加一行和一列。',
      'warning.unsaved': '内容只在内存里，写盘失败。',
      'warning.store': '矩阵文件有问题',
      'warning.rebuild': '重建示例矩阵',
      'warning.rebuildConfirm': '确认重建',
      'warning.lines': '加载时有 {n} 条提示。',
      'time.now': '刚刚',
      'time.min': '{n} 分钟前',
      'time.hour': '{n} 小时前',
      'time.date': '{n}',

      'tab.matrix': '矩阵',
      'tab.templates': '模板',
      'tab.prompt': '提示词',
      'head.more': '更多操作',
      'head.batch': '批量生成…',
      'head.preset': '模板 · {name}',
      'head.noPreset': '未绑定模板',
      'head.progress': '生成中 {done}/{total}',
      'head.filled': '{filled}/{total} 已生成',
      'save.button': '保存模板',
      'save.title': '保存模板',
      'save.desc': '把当前主题、纵横轴和两段提示词保存成模板。已生成的单元格不会写入模板。',
      'save.overwrite': '覆盖当前模板',
      'save.overwriteHint': '把当前内容写入 {file}',
      'save.new': '另存为新模板',
      'save.newHint': '保留当前模板，另建一个新文件。',
      'save.noPreset': '当前还没有绑定模板，请选择「另存为新模板」。',
      'save.builtin': '内置模板只读，请另存为新模板。',
      'save.name': '模板名称',
      'save.descLabel': '说明',
      'save.body': '备注 / 使用说明（可选）',
      'save.copySuffix': ' 副本',
      'save.untitled': '我的矩阵模板',
      'save.confirm': '保存模板',
      'save.saving': '保存中…',
      'save.saved': '模板已保存',
      'save.skipBody': '补充备注 / 使用说明',
      'save.summary': '{r} 行 × {c} 列',
      'save.themeNone': '未填写主题',
      'save.promptOn': '自定义提示词',
      'save.promptDefault': '默认提示词',
      'corner.all': '全生成',
      'corner.allRegen': '全部重生成',
      'corner.includeFilled': '包含已生成格子',
      'corner.includeHint': '勾选 = 重生成作用域内全部格子；不勾 = 只补空缺。',
      'corner.fullHint': '重生成全部 {n} 个格子，覆盖现有内容。',
      'corner.allHint': '补齐所有空白单元格。要连已有内容一起重做，勾选「包含已生成格子」。',
      'corner.allFull': '没有空白单元格了；勾选「包含已生成格子」即可全部重做。',
      'corner.running': '生成中 {done}/{total}',
      'corner.stop': '停止',
      'prompt.subtitle': '每个单元格的系统提示词与用户消息模板；占位符会在调用模型前按格子替换。',
      'prompt.note': '保存会同时更新矩阵里的两段提示词；要让模板同步，用顶部「保存模板」。预览固定使用第一个单元格。',
      'templates.subtitle': '载入模板会替换主题、两条轴和两段提示词；保留下来的轴上的单元格会跟着保留。',
    }

    let bound = null
    let fallback = ZH

    function t(key, vars) {
      let value = bound ? bound(key) : (fallback[key] ?? key)
      if (typeof value !== 'string') value = String(value)
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          value = value.split(`{${name}}`).join(String(replacement))
        }
      }
      return value
    }

    // ---------------------------------------------------------------- store

    const S = {
      snapshot: {
        loading: true,
        loaded: false,
        error: null,
        warning: null,
        storeError: null,
        matrix: null,
        persisted: false,
        storePath: '',
        model: null,
        modelError: null,
        selectedModel: null,
        activeModel: null,
        concurrency: 0,
        concurrencySupported: true,
        batch: null,
        generating: [],
        live: {},
        notice: null,
      },
      listeners: new Set(),
      controllers: new Map(),
      tokens: {},
      revision: 0,
      batchController: null,
      loaded: false,
      noticeTimer: null,
      pollTimer: null,
      mounts: 0,
    }

    function getSnapshot() {
      return S.snapshot
    }

    function subscribe(listener) {
      S.listeners.add(listener)
      return () => S.listeners.delete(listener)
    }

    function setState(patch) {
      S.snapshot = Object.assign({}, S.snapshot, patch)
      for (const listener of [...S.listeners]) {
        try { listener() } catch { /* a view must not break the store */ }
      }
    }

    function notify(text) {
      setState({ notice: text })
      if (S.noticeTimer !== null) clearTimeout(S.noticeTimer)
      S.noticeTimer = setTimeout(() => {
        S.noticeTimer = null
        setState({ notice: null })
      }, 2600)
    }

    async function request(method, args) {
      let response
      try {
        response = await fetch(API, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ method, args: args ?? {} }),
        })
      } catch (error) {
        throw new Error(String(error?.message ?? error))
      }
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload === null || payload.ok !== true) {
        const error = new Error(payload?.error ?? `HTTP ${response.status}`)
        error.code = payload?.code
        throw error
      }
      return payload.value
    }

    async function load({ silent = false } = {}) {
      if (!silent) setState({ loading: true })
      const revisionAtStart = S.revision
      try {
        const value = await request('state')
        S.loaded = true
        setState({
          loading: false,
          loaded: true,
          error: null,
          matrix: S.revision === revisionAtStart ? value.matrix : S.snapshot.matrix,
          persisted: value.persisted,
          storePath: value.storePath,
          warning: value.warning,
          storeError: value.storeError,
          model: value.model,
          modelError: value.modelError,
          selectedModel: value.selectedModel ?? null,
          concurrency: value.concurrency ?? 0,
          concurrencySupported: typeof value.concurrency === 'number',
          batch: value.batch ?? null,
          generating: Array.isArray(value.generating) ? value.generating : [],
        })
      } catch (error) {
        setState({ loading: false, error: String(error?.message ?? error) })
      }
    }

    function liveKey(rowId, colId) {
      return `${rowId}:${colId}`
    }

    function setLive(key, patch) {
      const current = S.snapshot.live[key] ?? { text: '', stage: 'queued', startedAt: Date.now(), error: null }
      const next = Object.assign({}, current, patch)
      setState({ live: Object.assign({}, S.snapshot.live, { [key]: next }) })
    }

    function appendLive(key, text) {
      const current = S.snapshot.live[key]
      if (current === undefined) return
      setLive(key, { text: current.text + text })
    }

    function removeLive(key) {
      if (S.snapshot.live[key] === undefined) return
      const live = Object.assign({}, S.snapshot.live)
      delete live[key]
      setState({ live })
    }

    function applyCell(key, summary) {
      const matrix = S.snapshot.matrix
      if (matrix === null) return
      const cells = Object.assign({}, matrix.cells)
      if (summary === null || summary === undefined) delete cells[key]
      else cells[key] = summary
      S.revision += 1
      setState({ matrix: Object.assign({}, matrix, { cells }) })
    }

    function parseFrame(frame, onEvent) {
      if (frame.trim() === '') return
      let event = 'message'
      const data = []
      for (const line of frame.split(/\r?\n/)) {
        if (line.startsWith(':')) continue
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
      }
      if (data.length === 0) return
      let payload
      try {
        payload = JSON.parse(data.join('\n'))
      } catch {
        return
      }
      onEvent(event, payload)
    }

    async function readSse(response, onEvent) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let at
        while ((at = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, at)
          buffer = buffer.slice(at + 2)
          parseFrame(frame.replace(/^\uFEFF/, ''), onEvent)
        }
      }
      if (buffer.trim() !== '') parseFrame(buffer, onEvent)
    }

    async function startGenerate(rowId, colId, { hint = '', mode = 'fast' } = {}) {
      const key = liveKey(rowId, colId)
      const token = (S.tokens[key] ?? 0) + 1
      S.tokens[key] = token
      const current = () => S.tokens[key] === token
      const previous = S.controllers.get(key)
      if (previous !== undefined) previous.abort()
      const controller = new AbortController()
      S.controllers.set(key, controller)
      setLive(key, { text: '', stage: 'queued', startedAt: Date.now(), error: null, mode })
      let finished = false
      try {
        const response = await fetch(API, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
          body: JSON.stringify({ method: 'cell.generate', args: { rowId, colId, hint, mode } }),
          signal: controller.signal,
        })
        if (!response.ok || response.body === null) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? `HTTP ${response.status}`)
        }
        await readSse(response, (event, data) => {
          if (!current()) return
          if (event === 'meta') {
            setState({ activeModel: { provider: data.provider, model: data.model } })
            setLive(key, { stage: 'draft' })
          } else if (event === 'stage') {
            setLive(key, { stage: String(data?.stage ?? 'draft') })
          } else if (event === 'delta') {
            appendLive(key, String(data?.text ?? ''))
          } else if (event === 'done') {
            finished = true
            applyCell(key, data?.cell ?? null)
            setState({ persisted: data?.persisted === true })
            removeLive(key)
            notify(t('notice.generated'))
          } else if (event === 'error') {
            finished = true
            setLive(key, { error: String(data?.message ?? 'generation failed'), stage: '' })
          }
        })
        if (!finished && current()) {
          setLive(key, { error: t('error.streamEnded'), stage: '' })
          load({ silent: true })
        }
      } catch (error) {
        if (current() && error?.name !== 'AbortError') {
          setLive(key, { error: String(error?.message ?? error), stage: '' })
        }
      } finally {
        if (S.controllers.get(key) === controller) S.controllers.delete(key)
      }
    }

    async function cancelGenerate(rowId, colId) {
      const key = liveKey(rowId, colId)
      S.tokens[key] = (S.tokens[key] ?? 0) + 1
      try {
        await request('cell.cancel', { rowId, colId })
      } catch { /* the generation may already be gone */ }
      const controller = S.controllers.get(key)
      if (controller !== undefined) controller.abort()
      S.controllers.delete(key)
      removeLive(key)
    }

    async function startBatch({ scope, rowId, colId, onlyEmpty = true }) {
      if (S.batchController !== null) return
      const controller = new AbortController()
      S.batchController = controller
      setState({
        batch: {
          total: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          currentKey: null,
          currentKeys: [],
          concurrency: S.snapshot.concurrency ?? 0,
          startedAt: Date.now(),
          done: false,
          failures: [],
        },
      })
      let sawDone = false
      try {
        const response = await fetch(API, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
          body: JSON.stringify({
            method: 'batch.generate',
            args: { scope, rowId, colId, onlyEmpty },
          }),
          signal: controller.signal,
        })
        if (!response.ok || response.body === null) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? `HTTP ${response.status}`)
        }
        await readSse(response, (event, data) => {
          if (event === 'batch.start') {
            setState({
              batch: {
                id: data.id,
                scope: data.scope,
                total: data.total,
                completed: 0,
                failed: 0,
                skipped: data.skipped,
                currentKey: null,
                currentKeys: [],
                concurrency: data.concurrency ?? S.snapshot.concurrency ?? 0,
                startedAt: Date.now(),
                done: false,
                failures: [],
              },
            })
          } else if (event === 'cell.start') {
            const batch = S.snapshot.batch
            if (batch !== null) {
              const keys = (batch.currentKeys ?? []).filter(key => key !== data.key)
              keys.push(data.key)
              setState({ batch: Object.assign({}, batch, { currentKey: data.key, currentKeys: keys }) })
            }
          } else if (event === 'cell.done') {
            applyCell(data.key, data.cell ?? null)
            const batch = S.snapshot.batch
            if (batch !== null) {
              const keys = (batch.currentKeys ?? []).filter(key => key !== data.key)
              setState({
                batch: Object.assign({}, batch, {
                  completed: batch.completed + 1,
                  persisted: data.persisted === true,
                  currentKeys: keys,
                  currentKey: keys[0] ?? null,
                }),
              })
            }
          } else if (event === 'cell.error') {
            const batch = S.snapshot.batch
            if (batch !== null) {
              const keys = (batch.currentKeys ?? []).filter(key => key !== data.key)
              setState({
                batch: Object.assign({}, batch, {
                  failed: batch.failed + 1,
                  currentKeys: keys,
                  currentKey: keys[0] ?? null,
                  failures: (batch.failures ?? []).concat([{ key: data.key, message: data.message }]).slice(0, 5),
                }),
              })
            }
          } else if (event === 'batch.done') {
            sawDone = true
            setState({
              batch: Object.assign({}, data, {
                currentKey: null,
                done: true,
                failures: Array.isArray(data.failures) ? data.failures : [],
              }),
            })
            notify(data.failed > 0 ? `${t('batch.done')} · ${t('batch.doneSummary', { done: data.completed, failed: data.failed, skipped: data.skipped })}` : t('batch.done'))
            load({ silent: true })
          } else if (event === 'error') {
            sawDone = true
            const batch = S.snapshot.batch
            setState({
              batch: batch === null
                ? null
                : Object.assign({}, batch, { done: true, currentKey: null, error: data.message }),
            })
            notify(`${t('batch.failed')}: ${data.message}`)
          }
        })
        if (!sawDone) {
          const batch = S.snapshot.batch
          if (batch !== null && !batch.done) {
            setState({ batch: Object.assign({}, batch, { done: true, currentKey: null }) })
            notify(t('batch.stopped'))
            load({ silent: true })
          }
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          notify(`${t('batch.failed')}: ${String(error?.message ?? error)}`)
        }
        const batch = S.snapshot.batch
        if (batch !== null && !batch.done) {
          setState({ batch: Object.assign({}, batch, { done: true, currentKey: null }) })
        }
        load({ silent: true })
      } finally {
        if (S.batchController === controller) S.batchController = null
      }
    }

    async function cancelBatch() {
      try {
        await request('batch.cancel')
      } catch { /* the batch may already be gone */ }
    }

    async function dismissBatch() {
      try {
        await request('batch.clear')
      } catch { /* ignore */ }
      setState({ batch: null })
    }

    async function saveCell(rowId, colId, markdown) {
      const value = await request('cell.write', { rowId, colId, markdown })
      applyCell(value.key, value.cell)
      setState({ persisted: value.persisted === true })
      notify(t('notice.saved'))
      return value
    }

    async function clearCell(rowId, colId) {
      const value = await request('cell.clear', { rowId, colId })
      applyCell(value.key, null)
      setState({ persisted: value.persisted === true })
      return value
    }

    async function saveAxes({ theme, rows, cols }) {
      const value = await request('axes.replace', { theme, rows, cols })
      S.revision += 1
      setState({ matrix: value.matrix, persisted: value.persisted === true })
      notify(t('notice.saved'))
      return value
    }

    async function loadCell(rowId, colId) {
      return request('cell.read', { rowId, colId })
    }

    async function copyText(text) {
      try {
        if (navigator.clipboard !== undefined && navigator.clipboard.writeText !== undefined) {
          await navigator.clipboard.writeText(text)
        } else {
          const area = document.createElement('textarea')
          area.value = text
          area.style.position = 'fixed'
          area.style.opacity = '0'
          document.body.appendChild(area)
          area.select()
          document.execCommand('copy')
          area.remove()
        }
        notify(t('notice.copied'))
      } catch {
        notify(t('notice.copyFailed'))
      }
    }

    function download(filename, text) {
      const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    function startPolling() {
      if (S.pollTimer !== null) return
      const tick = async () => {
        S.pollTimer = null
        if (!document.hidden) await load({ silent: true })
        if (S.mounts <= 0) return
        const batch = S.snapshot.batch
        const delay = batch !== null && batch !== undefined && batch.done !== true ? 2000 : POLL_MS
        S.pollTimer = setTimeout(tick, delay)
      }
      S.pollTimer = setTimeout(tick, POLL_MS)
    }

    function stopPolling() {
      if (S.pollTimer === null) return
      clearTimeout(S.pollTimer)
      S.pollTimer = null
    }

    /**
     * The one seam this file hands to the UI chunk: state accessors, Host
     * actions and the panel's mount lifecycle. Everything visual stays behind
     * `client.ui.js`; the store internals never cross it.
     */
    function uiDeps() {
      return {
        t,
        request,
        notify,
        load,
        liveKey,
        startGenerate,
        cancelGenerate,
        startBatch,
        cancelBatch,
        dismissBatch,
        saveCell,
        clearCell,
        saveAxes,
        loadCell,
        copyText,
        download,
        getSnapshot,
        subscribe,
        setState,
        bumpRevision() { S.revision += 1 },
        enterPanel() {
          S.mounts += 1
          startPolling()
          load({ silent: S.loaded })
        },
        leavePanel() {
          S.mounts = Math.max(0, S.mounts - 1)
          if (S.mounts === 0) stopPolling()
        },
      }
    }

    let ui = null

    async function apply(ctx) {
      const locale = ctx.get('locale')
      if (locale !== undefined && locale !== null) {
        const localeId = typeof locale.getLocale === 'function' ? locale.getLocale()?.id : undefined
        fallback = String(localeId ?? 'zh').toLowerCase().startsWith('en') ? EN : ZH
        ctx.effect(() => locale.register('creative-matrix', 'en', EN))
        ctx.effect(() => locale.register('creative-matrix', 'zh', ZH))
        if (typeof locale.bind === 'function') bound = locale.bind('creative-matrix')
      }

      const slots = ctx.get('slots')
      if (slots === undefined || slots === null) return

      // The React tree arrives on demand; the sidebar entry and the panel are
      // registered only once the chunk is materialized.
      const chunk = await require.async('./client.ui.js')
      ui = chunk.createUi(uiDeps())

      // One sidebar entry, one main panel. The four-tab workspace (matrix /
      // templates / axes / prompt) lives inside the panel itself (see
      // client.ui.js), not in the outer shell.
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: 'creative-matrix',
        order: 40,
        label: () => t('panel.title'),
      }, ui.MatrixIcon))

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: 'creative-matrix',
      }, ui.Panel))
    }

    const exported = { inject: ['slots', 'locale'], apply }
    Object.defineProperty(exported, '__components', { get: () => ui ?? {} })
    return exported
  },
})
