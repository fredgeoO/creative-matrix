/**
 * UI half of @local/creative-matrix — everything the user sees.
 *
 * Loaded on demand by `client.js` through `require.async('./client.ui.js')`.
 * This chunk owns the React components, the markdown renderer and the panel
 * CSS. It receives the store and the Host actions as one `deps` facade, so it
 * never talks to `fetch`, the SSE streams or the store internals directly.
 */

window.__ModuleLoader__.load({
  id: '@local/creative-matrix',
  chunk: 'client.ui.js',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /**
     * Build the component tree once from the entry facade.
     *
     * @param deps Store accessors, Host actions and locale lookup owned by client.js.
     * @returns The slot components plus the panel stylesheet.
     */
    function createUi(deps) {
      const {
        t, request, notify, load, liveKey,
        startGenerate, cancelGenerate, startBatch, cancelBatch, dismissBatch,
        saveCell, clearCell, saveAxes, loadCell, copyText, download,
        getSnapshot, subscribe, setState, bumpRevision, enterPanel, leavePanel,
      } = deps

      function useStore() {
        const [snapshot, setSnapshot] = React.useState(getSnapshot)
        React.useEffect(() => subscribe(() => setSnapshot(getSnapshot())), [])
        return snapshot
      }

      // ------------------------------------------------------------ rendering

      function timeAgo(timestamp) {
        const value = Number(timestamp)
        if (!Number.isFinite(value) || value <= 0) return ''
        const diff = Date.now() - value
        if (diff < 60_000) return t('time.now')
        if (diff < 3_600_000) return t('time.min', { n: Math.floor(diff / 60_000) })
        if (diff < 86_400_000) return t('time.hour', { n: Math.floor(diff / 3_600_000) })
        return t('time.date', { n: new Date(value).toLocaleDateString() })
      }

      function inlineNodes(value) {
        const text = String(value ?? '')
        const nodes = []
        const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
        let last = 0
        let index = 0
        let match
        while ((match = pattern.exec(text)) !== null) {
          if (match.index > last) nodes.push(text.slice(last, match.index))
          const token = match[0]
          if (token.startsWith('**')) nodes.push(h('strong', { key: `b${index++}` }, token.slice(2, -2)))
          else if (token.startsWith('`')) nodes.push(h('code', { key: `c${index++}` }, token.slice(1, -1)))
          else nodes.push(h('em', { key: `i${index++}` }, token.slice(1, -1)))
          last = match.index + token.length
        }
        if (last < text.length) nodes.push(text.slice(last))
        return nodes
      }

      function MarkdownView({ text }) {
        const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n')
        const blocks = []
        let index = 0
        let key = 0
        const isSpecial = line => /^(#{1,4}\s|```|\s*>|\s*[-*+]\s|\s*\d+[.)]\s|---)/.test(line)
        while (index < lines.length) {
          const line = lines[index]
          if (line.trim() === '') { index += 1; continue }
          if (/^\s*```/.test(line)) {
            const code = []
            index += 1
            while (index < lines.length && !/^\s*```/.test(lines[index])) { code.push(lines[index]); index += 1 }
            index += 1
            blocks.push(h('pre', { key: key++ }, h('code', null, code.join('\n'))))
            continue
          }
          const heading = line.match(/^(#{1,4})\s+(.*)$/)
          if (heading !== null) {
            const level = heading[1].length
            blocks.push(h(`h${level}`, { key: key++ }, ...inlineNodes(heading[2])))
            index += 1
            continue
          }
          if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
            blocks.push(h('hr', { key: key++ }))
            index += 1
            continue
          }
          if (/^\s*>\s?/.test(line)) {
            const quote = []
            while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
              quote.push(lines[index].replace(/^\s*>\s?/, ''))
              index += 1
            }
            blocks.push(h('blockquote', { key: key++ }, ...inlineNodes(quote.join('\n'))))
            continue
          }
          if (/^\s*[-*+]\s+/.test(line)) {
            const items = []
            while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
              items.push(h('li', { key: key++ }, ...inlineNodes(lines[index].replace(/^\s*[-*+]\s+/, ''))))
              index += 1
            }
            blocks.push(h('ul', { key: key++ }, items))
            continue
          }
          if (/^\s*\d+[.)]\s+/.test(line)) {
            const items = []
            while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
              items.push(h('li', { key: key++ }, ...inlineNodes(lines[index].replace(/^\s*\d+[.)]\s+/, ''))))
              index += 1
            }
            blocks.push(h('ol', { key: key++ }, items))
            continue
          }
          const paragraph = []
          while (index < lines.length && lines[index].trim() !== '' && !isSpecial(lines[index])) {
            paragraph.push(lines[index])
            index += 1
          }
          if (paragraph.length === 0) { paragraph.push(line); index += 1 }
          blocks.push(h('p', { key: key++ }, ...inlineNodes(paragraph.join('\n'))))
        }
        return h('div', { className: 'cm-md' }, blocks)
      }

      function MatrixIcon(props) {
        const size = props && typeof props.size === 'number' ? props.size : 18
        const active = props && props.active === true
        const color = active ? 'var(--dsw-alias-brand-primary)' : 'currentColor'
        return h('svg', {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          'aria-hidden': true,
          style: { color },
        },
          h('rect', { x: 2.7, y: 2.7, width: 7.6, height: 7.6, rx: 1.8, fill: 'none', stroke: color, strokeWidth: 1.5 }),
          h('rect', { x: 13.7, y: 2.7, width: 7.6, height: 7.6, rx: 1.8, fill: 'none', stroke: color, strokeWidth: 1.5 }),
          h('rect', { x: 2.7, y: 13.7, width: 7.6, height: 7.6, rx: 1.8, fill: 'none', stroke: color, strokeWidth: 1.5 }),
          h('rect', { x: 13.7, y: 13.7, width: 7.6, height: 7.6, rx: 1.8, fill: active ? color : 'none', stroke: color, strokeWidth: 1.5 }),
        )
      }

      function ModelSelect({ snapshot }) {
        const [models, setModels] = React.useState(null)
        const [loading, setLoading] = React.useState(true)
        const [error, setError] = React.useState(null)

        const load = React.useCallback(async (refresh = false) => {
          setLoading(true)
          try {
            const value = await request('models.list', { refresh })
            setModels(value)
            setError(value?.error ?? null)
          } catch (loadError) {
            setError(String(loadError?.message ?? loadError))
          } finally {
            setLoading(false)
          }
        }, [])

        React.useEffect(() => { load(false) }, [load])

        const selected = snapshot.selectedModel
        const value = selected ? `${selected.provider}::${selected.model}` : ''
        const providers = models?.providers ?? []
        const known = new Set()
        for (const provider of providers) {
          for (const model of provider.models ?? []) known.add(`${provider.id}::${model.id}`)
        }
        const effective = snapshot.model
        const defaultLabel = effective
          ? t('model.defaultWith', { model: `${effective.provider}/${effective.model}` })
          : t('model.default')

        async function change(event) {
          const raw = event.target.value
          try {
            if (raw === '') {
              const result = await request('model.set', { provider: '', model: '' })
              setState({ selectedModel: result.model, model: models?.current ?? snapshot.model, activeModel: null })
            } else {
              const at = raw.indexOf('::')
              const result = await request('model.set', {
                provider: raw.slice(0, at),
                model: raw.slice(at + 2),
              })
              setState({ selectedModel: result.model, model: result.model, activeModel: null })
            }
            notify(t('notice.model'))
          } catch (setError) {
            notify(String(setError?.message ?? setError))
          }
        }

        return h('div', { className: 'cm-model' },
          h('span', { className: 'cm-theme-label' }, t('model.label')),
          h('select', {
            className: 'cm-select',
            value: loading ? '' : value,
            disabled: loading,
            onChange: change,
            'aria-label': t('model.label'),
          },
            h('option', { value: '' }, loading ? t('model.loading') : defaultLabel),
            providers.map(provider => h('optgroup', { key: provider.id, label: provider.name },
              (provider.models ?? []).map(model => h('option', {
                key: `${provider.id}::${model.id}`,
                value: `${provider.id}::${model.id}`,
              }, model.name !== '' && model.name !== model.id ? `${model.name} (${model.id})` : model.id)))),
            selected !== null && value !== '' && !known.has(value)
              ? h('option', { value }, `${selected.model} · ${selected.provider}`)
              : null),
          h('button', {
            type: 'button',
            className: 'cm-mini',
            disabled: loading,
            title: t('model.refresh'),
            'aria-label': t('model.refresh'),
            onClick: () => load(true),
          }, loading ? '…' : '↻'),
          error !== null ? h('span', { className: 'cm-chip warn', title: error }, t('model.failed')) : null,
          models !== null && providers.length === 0 && !loading
            ? h('span', { className: 'cm-meta' }, t('model.empty'))
            : null)
      }

      function ConcurrencySelect({ snapshot }) {
        const value = snapshot.concurrency ?? 0
        const supported = snapshot.concurrencySupported !== false
        const batchRunning = snapshot.batch !== null && snapshot.batch !== undefined && snapshot.batch.done !== true
        const options = [0, 1, 2, 3, 4, 6, 8, 12]

        async function change(event) {
          const next = Number(event.target.value)
          try {
            const result = await request('concurrency.set', { concurrency: next })
            setState({ concurrency: result.concurrency })
            notify(t('notice.concurrency'))
          } catch (error) {
            notify(String(error?.message ?? error))
          }
        }

        return h('div', { className: 'cm-concurrency' },
          h('span', { className: 'cm-theme-label' }, t('concurrency.label')),
          h('select', {
            className: 'cm-select',
            value: String(value),
            disabled: batchRunning || !supported,
            title: supported ? t('concurrency.hint') : t('concurrency.restart'),
            onChange: change,
            'aria-label': t('concurrency.label'),
          },
            options.map(option => h('option', { key: option, value: String(option) },
              option === 0 ? t('concurrency.all') : String(option)))))
      }

      // The panel side of the prompt contract. The Host owns substitution
      // (lib/prompt.js); this table only supplies labels and the example value
      // shown next to each token, so both sides must name the same tokens.
      const PROMPT_PLACEHOLDERS = [
        { key: 'row', token: '纵标题', alias: 'row', descKey: 'prompt.phRow' },
        { key: 'rowHint', token: '纵提示', alias: 'rowHint', descKey: 'prompt.phRowHint' },
        { key: 'col', token: '横标题', alias: 'col', descKey: 'prompt.phCol' },
        { key: 'colHint', token: '横提示', alias: 'colHint', descKey: 'prompt.phColHint' },
        { key: 'theme', token: '主题', alias: 'theme', descKey: 'prompt.phTheme' },
        { key: 'title', token: '模板名', alias: 'title', descKey: 'prompt.phTitle' },
        { key: 'hint', token: '补充要求', alias: 'hint', descKey: 'prompt.phHint' },
        { key: 'previous', token: '上一版', alias: 'previous', descKey: 'prompt.phPrevious' },
        { key: 'cell', token: '坐标', alias: 'cell', descKey: 'prompt.phCell' },
      ]
      const KNOWN_PLACEHOLDERS = new Set()
      for (const item of PROMPT_PLACEHOLDERS) {
        KNOWN_PLACEHOLDERS.add(item.token)
        KNOWN_PLACEHOLDERS.add(item.alias)
        KNOWN_PLACEHOLDERS.add(item.alias.toLowerCase())
      }

      function unknownPlaceholders(text) {
        const found = []
        for (const match of String(text ?? '').matchAll(/\{([^{}\n]{1,40})\}/g)) {
          const raw = match[1]
          if (!KNOWN_PLACEHOLDERS.has(raw) && !KNOWN_PLACEHOLDERS.has(raw.toLowerCase())) found.push(raw)
        }
        return [...new Set(found)]
      }

      function shortValue(value) {
        const text = String(value ?? '').replace(/\s+/g, ' ').trim()
        return text.length > 46 ? `${text.slice(0, 46)}…` : text
      }

      function PromptPane({ snapshot }) {
        const matrix = snapshot.matrix
        const stored = matrix?.prompt ?? ''
        const storedUser = matrix?.userPrompt ?? ''
        const [value, setValue] = React.useState(stored)
        const [userValue, setUserValue] = React.useState(storedUser)
        const [fallback, setFallback] = React.useState({ system: null, user: null })
        const [error, setError] = React.useState(null)
        const [saving, setSaving] = React.useState(false)
        const [loading, setLoading] = React.useState(stored === '' || storedUser === '')
        const [activeField, setActiveField] = React.useState('system')
        const [preview, setPreview] = React.useState({ loading: true, data: null, error: null })
        const systemRef = React.useRef(null)
        const userRef = React.useRef(null)
        const sampleRow = matrix?.rows?.[0] ?? null
        const sampleCol = matrix?.cols?.[0] ?? null
        const sampleKey = sampleRow === null || sampleCol === null ? '' : `${sampleRow.id}:${sampleCol.id}`
        const samplePrevious = matrix?.cells?.[sampleKey]?.takeaway ?? ''

        const loadDefault = React.useCallback(async () => {
          setLoading(true)
          try {
            const previewValue = await request('prompt.default')
            const defaults = {
              system: String(previewValue.system ?? ''),
              user: String(previewValue.user ?? ''),
            }
            setFallback(defaults)
            setError(null)
            return defaults
          } catch (loadError) {
            setError(`${t('prompt.loadFailed')}: ${String(loadError?.message ?? loadError)}`)
            return { system: '', user: '' }
          } finally {
            setLoading(false)
          }
        }, [])

        // An empty stored prompt means "follow the built-in default", so each
        // box has to show its default: an empty field hides what is actually
        // sent until you save an edit, which is the whole point of the pane.
        React.useEffect(() => {
          let alive = true
          loadDefault().then(defaults => {
            if (!alive) return
            setValue(current => (current === '' ? defaults.system : current))
            setUserValue(current => (current === '' ? defaults.user : current))
          })
          return () => { alive = false }
        }, [])

        // Preview the drafts, not the saved prompts: the point is to see both
        // substitutions before committing. Requests are debounced and stale
        // replies are dropped, so typing stays local and cheap.
        React.useEffect(() => {
          if (sampleRow === null || sampleCol === null) return undefined
          let alive = true
          setPreview(current => Object.assign({}, current, { loading: true }))
          const timer = setTimeout(() => {
            request('prompt.preview', {
              rowId: sampleRow.id,
              colId: sampleCol.id,
              hint: '',
              custom: value,
              userCustom: userValue,
            }).then(data => {
              if (alive) setPreview({ loading: false, data, error: null })
            }).catch(previewError => {
              if (alive) setPreview({ loading: false, data: null, error: String(previewError?.message ?? previewError) })
            })
          }, 220)
          return () => { alive = false; clearTimeout(timer) }
        }, [value, userValue, sampleRow?.id, sampleRow?.name, sampleRow?.hint, sampleCol?.id, sampleCol?.name, sampleCol?.hint, matrix?.theme, matrix?.title, samplePrevious])

        async function restoreDefault() {
          const defaults = fallback.system !== null && fallback.user !== null
            ? fallback
            : await loadDefault()
          if (defaults.system !== '') setValue(defaults.system)
          if (defaults.user !== '') setUserValue(defaults.user)
        }

        async function save() {
          setSaving(true)
          setError(null)
          try {
            // Saving an untouched default stores an empty template, so the
            // matrix keeps following the built-in one instead of freezing a copy.
            const systemSame = fallback.system !== null && value.trim() === fallback.system.trim()
            const userSame = fallback.user !== null && userValue.trim() === fallback.user.trim()
            const result = await request('prompt.set', {
              prompt: systemSame ? '' : value,
              userPrompt: userSame ? '' : userValue,
            })
            bumpRevision()
            setState({ matrix: result.matrix, persisted: result.persisted === true })
            notify(t('prompt.saved'))
          } catch (saveError) {
            setError(String(saveError?.message ?? saveError))
          } finally {
            setSaving(false)
          }
        }

        function insertPlaceholder(token) {
          const snippet = `{${token}}`
          const field = activeField === 'user' ? 'user' : 'system'
          const element = (field === 'user' ? userRef : systemRef).current
          const current = field === 'user' ? userValue : value
          const setter = field === 'user' ? setUserValue : setValue
          if (element === null) {
            setter(text => text + snippet)
            return
          }
          const start = element.selectionStart ?? current.length
          const end = element.selectionEnd ?? start
          setter(current.slice(0, start) + snippet + current.slice(end))
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
              const next = (field === 'user' ? userRef : systemRef).current
              if (next === null) return
              next.focus()
              const at = start + snippet.length
              next.setSelectionRange(at, at)
            })
          }
        }

        const custom = stored !== '' || storedUser !== ''
          || (fallback.system !== null && value.trim() !== fallback.system.trim())
          || (fallback.user !== null && userValue.trim() !== fallback.user.trim())
        const vars = preview.data?.vars ?? {}
        const unknownSystem = unknownPlaceholders(value)
        const unknownUser = unknownPlaceholders(userValue)
        const sampleLabel = sampleRow === null || sampleCol === null
          ? t('prompt.previewEmpty')
          : t('prompt.previewFor', { row: sampleRow.name, col: sampleCol.name })

        const placeholderList = h('section', { className: 'cm-prompt-section' },
          h('h3', { className: 'cm-prompt-section-title' }, t('prompt.placeholders')),
          h('p', { className: 'cm-meta' }, t('prompt.placeholderHint')),
          h('ul', { className: 'cm-ph-list' },
            PROMPT_PLACEHOLDERS.map(item => {
              const raw = vars[item.key]
              const text = String(raw ?? '').trim()
              return h('li', { key: item.key, className: 'cm-ph-item' },
                h('div', { className: 'cm-ph-tokens' },
                  h('button', {
                    type: 'button',
                    className: 'cm-ph-token',
                    title: t('prompt.insert', { token: `{${item.token}}` }),
                    onClick: () => insertPlaceholder(item.token),
                  }, `{${item.token}}`),
                  h('span', { className: 'cm-ph-alias' }, `{${item.alias}}`)),
                h('div', { className: 'cm-ph-desc' }, t(item.descKey)),
                h('div', {
                  className: `cm-ph-value${text === '' ? ' empty' : ''}`,
                  title: text === '' ? t('prompt.phEmpty') : String(raw),
                }, text === '' ? t('prompt.phEmpty') : shortValue(raw)))
            })))

        const previewPane = h('section', { className: 'cm-prompt-section' },
          h('h3', { className: 'cm-prompt-section-title' }, t('prompt.preview')),
          h('div', { className: 'cm-meta' }, sampleLabel),
          preview.error !== null
            ? h('div', { className: 'cm-error-line' }, `${t('prompt.previewFailed')}: ${preview.error}`)
            : null,
          preview.data === null
            ? (sampleRow !== null && sampleCol !== null && preview.loading
              ? h('div', { className: 'cm-meta' }, t('prompt.previewLoading'))
              : null)
            : h('div', { className: `cm-preview${preview.loading ? ' loading' : ''}` },
              h('div', { className: 'cm-preview-label' }, t('prompt.previewSystem')),
              h('pre', { className: 'cm-preview-text' }, preview.data.system ?? ''),
              h('div', { className: 'cm-preview-label' }, t('prompt.previewUser')),
              h('pre', { className: 'cm-preview-text' }, preview.data.user ?? '')),
          h('p', { className: 'cm-meta cm-preview-note' }, t('prompt.previewNote')))

        return h('div', { className: 'cm-pane', role: 'tabpanel', 'aria-label': t('tab.prompt') },
          h('div', { className: 'cm-pane-head' },
            h('div', { className: 'cm-head-main' },
              h('h2', { className: 'cm-pane-title' }, t('prompt.title')),
              h('p', { className: 'cm-pane-sub' }, t('prompt.subtitle'))),
            h('span', { className: `cm-chip${custom ? '' : ' ok'}` }, custom ? t('prompt.custom') : t('prompt.defaultShort'))),
          h('div', { className: 'cm-prompt-layout' },
            h('div', { className: 'cm-prompt-main' },
              h('div', { className: 'cm-prompt-field' },
                h('label', { className: 'cm-prompt-label', htmlFor: 'cm-prompt-system' }, t('prompt.templateLabel')),
                h('p', { className: 'cm-meta' }, t('prompt.templateHint')),
                h('textarea', {
                  id: 'cm-prompt-system',
                  ref: systemRef,
                  className: 'cm-textarea cm-prompt-textarea cm-prompt-system',
                  value,
                  maxLength: 4000,
                  placeholder: loading ? t('prompt.loading') : t('prompt.placeholder'),
                  spellCheck: false,
                  onFocus: () => setActiveField('system'),
                  onChange: event => setValue(event.target.value),
                }),
                unknownSystem.length > 0
                  ? h('div', { className: 'cm-warn-line' }, t('prompt.unknown', {
                    list: unknownSystem.map(token => `{${token}}`).join('、'),
                  }))
                  : null),
              h('div', { className: 'cm-prompt-field' },
                h('label', { className: 'cm-prompt-label', htmlFor: 'cm-prompt-user' }, t('prompt.userLabel')),
                h('p', { className: 'cm-meta' }, t('prompt.userHint')),
                h('textarea', {
                  id: 'cm-prompt-user',
                  ref: userRef,
                  className: 'cm-textarea cm-prompt-textarea cm-prompt-user',
                  value: userValue,
                  maxLength: 4000,
                  placeholder: loading ? t('prompt.loading') : t('prompt.placeholder'),
                  spellCheck: false,
                  onFocus: () => setActiveField('user'),
                  onChange: event => setUserValue(event.target.value),
                }),
                unknownUser.length > 0
                  ? h('div', { className: 'cm-warn-line' }, t('prompt.unknown', {
                    list: unknownUser.map(token => `{${token}}`).join('、'),
                  }))
                  : null),
              h('div', { className: 'cm-meta' }, loading
                ? t('prompt.loading')
                : custom
                  ? t('prompt.countBoth', { s: value.trim().length, u: userValue.trim().length })
                  : t('prompt.defaultEditing')),
              error !== null ? h('div', { className: 'cm-error-line' }, error) : null,
              h('div', { className: 'cm-pane-actions' },
                h('button', {
                  type: 'button',
                  className: 'cm-btn',
                  disabled: loading,
                  onClick: restoreDefault,
                }, t('prompt.restore')),
                h('button', {
                  type: 'button',
                  className: 'cm-btn primary',
                  disabled: saving || loading,
                  onClick: save,
                }, saving ? '…' : t('prompt.save')))),
            h('div', { className: 'cm-prompt-side' }, placeholderList, previewPane)),
          h('div', { className: 'cm-pane-note' }, t('prompt.note')))
      }

      function AxisTitle({ axis, item }) {
        const [editing, setEditing] = React.useState(false)
        const [value, setValue] = React.useState(item.name)
        const inputRef = React.useRef(null)
        const busy = React.useRef(false)

        React.useEffect(() => { setValue(item.name) }, [item.name])
        React.useEffect(() => {
          if (editing && inputRef.current !== null) {
            inputRef.current.focus()
            inputRef.current.select()
          }
        }, [editing])

        async function commit() {
          if (busy.current) return
          const name = value.trim()
          if (name === '' || name === item.name) {
            setEditing(false)
            setValue(item.name)
            return
          }
          busy.current = true
          try {
            const result = await request('axes.update', { axis, id: item.id, name })
            bumpRevision()
            setState({ matrix: result.matrix, persisted: result.persisted === true })
            setEditing(false)
            notify(t('notice.renamed'))
          } catch (error) {
            notify(`${t('notice.renameFailed')}: ${String(error?.message ?? error)}`)
            setEditing(false)
            setValue(item.name)
          } finally {
            busy.current = false
          }
        }

        if (!editing) {
          return h('div', {
            className: 'cm-axis-name cm-axis-editable',
            title: item.hint ? `${t('axis.renameHint')} · ${item.hint}` : t('axis.renameHint'),
            onClick: () => { setValue(item.name); setEditing(true) },
          }, item.name)
        }
        return h('input', {
          ref: inputRef,
          className: 'cm-input cm-axis-input',
          value,
          maxLength: 80,
          'aria-label': t('axis.renameHint'),
          onChange: event => setValue(event.target.value),
          onBlur: commit,
          onKeyDown: event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            } else if (event.key === 'Escape') {
              setEditing(false)
              setValue(item.name)
            }
          },
        })
      }

      function AxisHint({ axis, item }) {
        const [editing, setEditing] = React.useState(false)
        const [value, setValue] = React.useState(item.hint ?? '')
        const inputRef = React.useRef(null)
        const busy = React.useRef(false)

        React.useEffect(() => { setValue(item.hint ?? '') }, [item.hint])
        React.useEffect(() => {
          if (editing && inputRef.current !== null) inputRef.current.focus()
        }, [editing])

        async function commit() {
          if (busy.current) return
          const hint = value.replace(/\s+/g, ' ').trim().slice(0, 300)
          if (hint === (item.hint ?? '')) {
            setEditing(false)
            setValue(item.hint ?? '')
            return
          }
          busy.current = true
          try {
            const result = await request('axes.update', { axis, id: item.id, hint })
            bumpRevision()
            setState({ matrix: result.matrix, persisted: result.persisted === true })
            setEditing(false)
            setValue(hint)
            notify(t('notice.hintSaved'))
          } catch (error) {
            notify(`${t('notice.hintFailed')}: ${String(error?.message ?? error)}`)
            setEditing(false)
            setValue(item.hint ?? '')
          } finally {
            busy.current = false
          }
        }

        if (!editing) {
          return h('div', {
            className: `cm-axis-hint${item.hint ? '' : ' empty'}`,
            role: 'button',
            tabIndex: 0,
            title: t('axis.hintHint'),
            onClick: () => { setValue(item.hint ?? ''); setEditing(true) },
            onKeyDown: event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setValue(item.hint ?? '')
                setEditing(true)
              }
            },
          }, item.hint || `＋ ${t('axis.addHint')}`)
        }
        return h('input', {
          ref: inputRef,
          className: 'cm-input cm-axis-hint-input',
          value,
          maxLength: 300,
          placeholder: t('axis.hintPlaceholder'),
          'aria-label': t('axis.hintHint'),
          onChange: event => setValue(event.target.value),
          onBlur: commit,
          onKeyDown: event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            } else if (event.key === 'Escape') {
              setEditing(false)
              setValue(item.hint ?? '')
            }
          },
        })
      }

      function CellView({ snapshot, row, col, onOpen }) {
        const key = liveKey(row.id, col.id)
        const summary = snapshot.matrix.cells[key]
        const live = snapshot.live[key]
        const generating = live !== undefined && live.error === null
        const failed = live !== undefined && live.error !== null
        const body = generating
          ? (live.text !== '' ? live.text : '…')
          : failed
            ? live.error
            : summary
              ? (summary.takeaway || t('cell.noTakeaway'))
              : t('cell.emptyHint')
        return h('div', {
          className: `cm-cell${summary ? ' filled' : ''}${generating ? ' live' : ''}${failed ? ' failed' : ''}`,
          role: 'button',
          tabIndex: 0,
          onClick: onOpen,
          onKeyDown: event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onOpen()
            }
          },
        },
          h('div', { className: 'cm-cell-top' },
            h('span', { className: 'cm-cell-state' },
              generating
                ? (live.stage === 'queued' ? t('cell.queued') : t('cell.generating'))
                : failed
                  ? t('cell.error')
                  : summary
                    ? timeAgo(summary.updatedAt)
                    : t('cell.empty')),
            h('button', {
              type: 'button',
              className: 'cm-mini',
              onClick: event => {
                event.stopPropagation()
                startGenerate(row.id, col.id, { hint: summary?.hint ?? '', mode: 'fast' })
              },
            }, summary ? t('cell.regenerate') : t('cell.generate'))),
          h('div', { className: 'cm-cell-body' }, body),
          summary
            ? h('div', { className: 'cm-cell-foot' },
              summary.model ? h('span', null, `${summary.model.provider}/${summary.model.model}`) : null,
              summary.mode === 'deep' ? h('span', null, t('cell.deep')) : null,
              summary.edited ? h('span', null, t('cell.manual')) : null,
              summary.usage ? h('span', null, t('cell.tokens', { n: (summary.usage.inputTokens ?? 0) + (summary.usage.outputTokens ?? 0) })) : null)
            : null)
      }

      function Drawer({ snapshot, row, col, onClose }) {
        const key = liveKey(row.id, col.id)
        const live = snapshot.live[key]
        const summary = snapshot.matrix.cells[key]
        const updatedAt = summary?.updatedAt ?? 0
        const [detail, setDetail] = React.useState({ loading: true, cell: null, error: null })
        const [editing, setEditing] = React.useState(false)
        const [draft, setDraft] = React.useState('')
        const [hint, setHint] = React.useState(summary?.hint ?? '')
        const [confirmClear, setConfirmClear] = React.useState(false)

        React.useEffect(() => {
          let alive = true
          setDetail(current => (current.loading ? current : Object.assign({}, current, { loading: true })))
          loadCell(row.id, col.id)
            .then(value => { if (alive) setDetail({ loading: false, cell: value.cell, error: null }) })
            .catch(error => { if (alive) setDetail({ loading: false, cell: null, error: String(error?.message ?? error) }) })
          return () => { alive = false }
        }, [row.id, col.id, updatedAt])

        React.useEffect(() => {
          setEditing(false)
          setConfirmClear(false)
          setHint(summary?.hint ?? '')
        }, [row.id, col.id])

        React.useEffect(() => {
          const onKey = event => { if (event.key === 'Escape') onClose() }
          window.addEventListener('keydown', onKey)
          return () => window.removeEventListener('keydown', onKey)
        }, [onClose])

        const generating = live !== undefined && live.error === null
        const failed = live !== undefined && live.error !== null
        const text = live !== undefined && live.text !== '' ? live.text : detail.cell?.markdown ?? ''

        function generate(mode) {
          setConfirmClear(false)
          startGenerate(row.id, col.id, { hint, mode })
        }

        async function saveEdit() {
          try {
            const value = await saveCell(row.id, col.id, draft)
            setDetail({ loading: false, cell: value.cell ? Object.assign({ markdown: value.markdown }, value.cell) : null, error: null })
            setEditing(false)
          } catch (error) {
            setDetail(current => Object.assign({}, current, { error: String(error?.message ?? error) }))
          }
        }

        async function copyPrompt() {
          try {
            const preview = await request('prompt.preview', { rowId: row.id, colId: col.id, hint })
            await copyText(`${preview.system}\n\n---\n\n${preview.user}`)
          } catch (error) {
            notify(String(error?.message ?? error))
          }
        }

        async function doClear() {
          try {
            await clearCell(row.id, col.id)
            setDetail({ loading: false, cell: null, error: null })
            setConfirmClear(false)
            setEditing(false)
          } catch (error) {
            setDetail(current => Object.assign({}, current, { error: String(error?.message ?? error) }))
          }
        }

        const modeLabel = detail.cell?.mode ?? summary?.mode ?? ''
        const modelLabel = detail.cell?.model ? `${detail.cell.model.provider}/${detail.cell.model.model}` : summary?.model ? `${summary.model.provider}/${summary.model.model}` : ''
        const usage = detail.cell?.usage ?? summary?.usage ?? null

        return h('aside', { className: 'cm-drawer', role: 'dialog', 'aria-label': t('drawer.title') },
          h('div', { className: 'cm-drawer-head' },
            h('div', { className: 'cm-drawer-titles' },
              h('div', { className: 'cm-drawer-kicker' }, t('drawer.title')),
              h('div', { className: 'cm-drawer-title' }, `${row.name} × ${col.name}`),
              h('div', { className: 'cm-drawer-meta' },
                modeLabel ? h('span', null, `${t('drawer.mode')}: ${modeLabel}`) : null,
                modelLabel ? h('span', null, `${t('drawer.model')}: ${modelLabel}`) : null,
                summary ? h('span', null, `${t('drawer.updated')}: ${timeAgo(summary.updatedAt)}`) : null,
                usage ? h('span', null, `${t('drawer.tokens')}: ${(usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)}`) : null)),
            h('button', { type: 'button', className: 'cm-btn', onClick: onClose, 'aria-label': t('drawer.close') }, '×')),

          h('div', { className: 'cm-drawer-hint' },
            h('input', {
              className: 'cm-input',
              value: hint,
              placeholder: t('drawer.hintPlaceholder'),
              maxLength: 300,
              onChange: event => setHint(event.target.value),
            })),

          h('div', { className: 'cm-drawer-actions' },
            h('button', {
              type: 'button',
              className: 'cm-btn primary',
              disabled: generating,
              onClick: () => generate('fast'),
            }, t('drawer.generate')),
            h('button', {
              type: 'button',
              className: 'cm-btn',
              disabled: generating,
              onClick: () => generate('deep'),
            }, t('drawer.deep')),
            generating
              ? h('button', {
                type: 'button',
                className: 'cm-btn danger',
                onClick: () => cancelGenerate(row.id, col.id),
              }, t('drawer.stop'))
              : null,
            !generating && !editing && detail.cell !== null
              ? h('button', {
                type: 'button',
                className: 'cm-btn',
                onClick: () => { setDraft(detail.cell?.markdown ?? ''); setEditing(true); setConfirmClear(false) },
              }, t('drawer.edit'))
              : null,
            !generating && detail.cell !== null
              ? h('button', {
                type: 'button',
                className: 'cm-btn',
                onClick: () => copyText(detail.cell?.markdown ?? ''),
              }, t('drawer.copy'))
              : null,
            !generating
              ? h('button', { type: 'button', className: 'cm-btn', onClick: copyPrompt }, t('drawer.copyPrompt'))
              : null,
            !generating && !editing && detail.cell !== null
              ? h('button', {
                type: 'button',
                className: `cm-btn${confirmClear ? ' danger' : ''}`,
                onClick: () => { if (confirmClear) doClear(); else setConfirmClear(true) },
              }, confirmClear ? t('drawer.confirmClear') : t('drawer.clear'))
              : null),

          h('div', { className: 'cm-drawer-body' },
            failed ? h('div', { className: 'cm-error-line' }, `${t('drawer.error')}: ${live.error}`) : null,
            detail.error !== null && detail.error !== undefined ? h('div', { className: 'cm-error-line' }, detail.error) : null,
            editing
              ? h('div', { className: 'cm-edit' },
                h('textarea', {
                  className: 'cm-textarea',
                  value: draft,
                  onChange: event => setDraft(event.target.value),
                  spellCheck: false,
                }),
                h('div', { className: 'cm-drawer-actions' },
                  h('button', { type: 'button', className: 'cm-btn primary', onClick: saveEdit }, t('drawer.save')),
                  h('button', { type: 'button', className: 'cm-btn', onClick: () => setEditing(false) }, t('drawer.cancel'))))
              : generating
                ? h('div', { className: 'cm-live' },
                  h('div', { className: 'cm-live-stage' }, live.stage === 'critique' ? t('drawer.deep') : t('cell.generating')),
                  h('pre', { className: 'cm-live-text' }, text !== '' ? text : '…'))
                : detail.loading
                  ? h('div', { className: 'cm-meta' }, t('drawer.loading'))
                  : text !== ''
                    ? h(MarkdownView, { text })
                    : h('div', { className: 'cm-empty' }, t('drawer.empty'))),

          h('div', { className: 'cm-drawer-foot' }))
      }

      function TemplatesPane({ snapshot, onLoaded }) {
        const [tab, setTab] = React.useState('load')
        const [list, setList] = React.useState(null)
        const [loading, setLoading] = React.useState(true)
        const [error, setError] = React.useState(null)
        const [selectedId, setSelectedId] = React.useState(null)
        const [detail, setDetail] = React.useState(null)
        const [detailLoading, setDetailLoading] = React.useState(false)
        const [confirmLoad, setConfirmLoad] = React.useState(false)
        const [confirmDelete, setConfirmDelete] = React.useState(false)
        const [saving, setSaving] = React.useState(false)
        // AI authoring: a new template from an idea (draft tab), or a rewrite
        // of the selected user preset (refine field in the detail pane).
        const [idea, setIdea] = React.useState('')
        const [draft, setDraft] = React.useState(null)
        const [drafting, setDrafting] = React.useState(false)
        const [refineBusy, setRefineBusy] = React.useState(false)
        const [refineIdea, setRefineIdea] = React.useState('')
        // Built-in templates are per-language: the list and the open detail
        // must refresh when the panel locale changes.
        const lang = snapshot.lang ?? 'zh'
        const cellCount = Object.keys(snapshot.matrix?.cells ?? {}).length
        // Loading a template replaces the axes and clears their cells, so it is
        // blocked while a batch still targets the old row/col ids.
        const batchRunning = snapshot.batch !== null && snapshot.batch !== undefined && snapshot.batch.done !== true

        const refresh = React.useCallback(async () => {
          setLoading(true)
          try {
            const value = await request('presets.list')
            setList(value.presets ?? [])
            setError(null)
          } catch (loadError) {
            setError(String(loadError?.message ?? loadError))
          } finally {
            setLoading(false)
          }
        }, [])

        React.useEffect(() => { refresh() }, [refresh, lang])

        // Re-read the open template after a locale switch so the detail pane
        // shows the new language instead of the copy fetched a moment ago. The
        // ref keeps this effect out of the normal selection path (which reads
        // the template itself) while still seeing the current selection.
        const selectedIdRef = React.useRef(null)
        React.useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])
        React.useEffect(() => {
          const id = selectedIdRef.current
          if (id === null) return undefined
          let cancelled = false
          setDetailLoading(true)
          request('presets.read', { id })
            .then(value => { if (!cancelled) setDetail(value) })
            .catch(readError => { if (!cancelled) setError(String(readError?.message ?? readError)) })
            .finally(() => { if (!cancelled) setDetailLoading(false) })
          return () => { cancelled = true }
        }, [lang])

        async function select(item) {
          setSelectedId(item.id)
          setDetail(null)
          setDetailLoading(true)
          setConfirmLoad(false)
          setConfirmDelete(false)
          setRefineIdea('')
          try {
            const value = await request('presets.read', { id: item.id })
            setDetail(value)
          } catch (readError) {
            setError(String(readError?.message ?? readError))
          } finally {
            setDetailLoading(false)
          }
        }

        async function apply() {
          if (detail === null) return
          if (batchRunning) { notify(t('notice.axisBusy')); return }
          if (cellCount > 0 && !confirmLoad) {
            setConfirmLoad(true)
            return
          }
          try {
            const value = await request('presets.apply', { id: detail.id })
            bumpRevision()
            setState({ matrix: value.matrix, persisted: value.persisted === true })
            notify(t('templates.loaded'))
            onLoaded()
          } catch (applyError) {
            notify(`${t('notice.loadFailed')}: ${String(applyError?.message ?? applyError)}`)
          }
        }

        async function remove() {
          if (detail === null || detail.source !== 'user') return
          if (!confirmDelete) {
            setConfirmDelete(true)
            return
          }
          try {
            await request('presets.delete', { file: detail.file })
            // The Host un-binds the deleted template when it was the current
            // one; mirror that locally so the header and the save dialog do not
            // keep offering a file that no longer exists.
            bumpRevision()
            const current = snapshot.matrix
            if (current !== null && current !== undefined
              && current.preset !== null && current.preset !== undefined
              && current.preset.source === 'user' && current.preset.file === detail.file) {
              setState({ matrix: Object.assign({}, current, { preset: null }) })
            }
            notify(t('templates.deleted'))
            setDetail(null)
            setSelectedId(null)
            setConfirmDelete(false)
            await refresh()
          } catch (deleteError) {
            notify(String(deleteError?.message ?? deleteError))
          }
        }

        async function makeDraft() {
          const text = idea.trim()
          if (text === '') {
            setError(t('editor.nameRequired'))
            return
          }
          setDrafting(true)
          setError(null)
          try {
            const value = await request('presets.draft', { idea: text })
            setDraft(value.draft ?? null)
          } catch (draftError) {
            setError(`${t('templates.aiFailed')}: ${String(draftError?.message ?? draftError)}`)
          } finally {
            setDrafting(false)
          }
        }

        async function saveDraft() {
          if (draft === null) return
          setSaving(true)
          setError(null)
          try {
            const value = await request('presets.save', {
              title: draft.title,
              description: draft.description,
              theme: draft.theme,
              prompt: draft.prompt,
              userPrompt: draft.userPrompt,
              rows: draft.rows,
              cols: draft.cols,
              body: draft.body,
            })
            notify(t('templates.savedDraft'))
            setDraft(null)
            setIdea('')
            await refresh()
            setTab('load')
            setSelectedId(value.preset.id)
            setDetail(value.preset)
          } catch (saveError) {
            setError(String(saveError?.message ?? saveError))
          } finally {
            setSaving(false)
          }
        }

        async function refine() {
          if (detail === null) return
          const text = refineIdea.trim()
          if (text === '') {
            setError(t('editor.nameRequired'))
            return
          }
          setRefineBusy(true)
          setError(null)
          try {
            const value = await request('presets.refine', { id: detail.id, idea: text })
            setDetail(value.preset)
            setRefineIdea('')
            notify(t('templates.refined'))
            await refresh()
          } catch (refineError) {
            setError(`${t('templates.aiFailed')}: ${String(refineError?.message ?? refineError)}`)
          } finally {
            setRefineBusy(false)
          }
        }

        const listPane = loading
          ? h('div', { className: 'cm-meta', style: { padding: '12px' } }, t('drawer.loading'))
          : list === null || list.length === 0
            ? h('div', { className: 'cm-meta', style: { padding: '12px' } }, t('templates.empty'))
            : h('div', { className: 'cm-template-list' }, list.map(item => h('button', {
              key: item.id,
              type: 'button',
              className: `cm-template-item${selectedId === item.id ? ' active' : ''}`,
              onClick: () => select(item),
            },
              h('div', { className: 'cm-template-item-head' },
                h('span', { className: 'cm-template-name' }, item.title),
                h('div', { className: 'cm-template-tags' },
                  h('span', { className: 'cm-chip' }, item.source === 'builtin' ? t('templates.builtin') : t('templates.user')),
                  item.hasPrompt ? h('span', { className: 'cm-chip' }, t('templates.promptBadge')) : null)),
              h('div', { className: 'cm-template-desc' }, item.description || t('templates.descriptionEmpty')),
              h('div', { className: 'cm-template-meta' },
                `${t('templates.axes', { r: item.rowCount, c: item.colCount })} · ${item.file}`),
              item.error !== null && item.error !== undefined
                ? h('div', { className: 'cm-error-line' }, item.error)
                : null)))

        const detailPane = detailLoading
          ? h('div', { className: 'cm-meta' }, t('drawer.loading'))
          : detail === null
            ? h('div', { className: 'cm-meta' }, t('templates.select'))
            : h('div', null,
              h('h3', { className: 'cm-template-detail-title' }, detail.title),
              h('div', { className: 'cm-template-meta' },
                `${detail.file} · ${t('templates.axes', { r: detail.rows.length, c: detail.cols.length })}${detail.source === 'builtin' ? ` · ${t('templates.builtin')}` : ''}`),
              h('div', { className: 'cm-template-desc' }, detail.description || t('templates.descriptionEmpty')),
              h('div', { className: 'cm-template-actions' },
                h('button', {
                  type: 'button',
                  className: 'cm-btn primary',
                  disabled: batchRunning,
                  title: batchRunning ? t('notice.axisBusy') : undefined,
                  onClick: apply,
                },
                  confirmLoad && cellCount > 0
                    ? t('templates.confirmLoad', { n: cellCount })
                    : t('templates.load')),
                h('button', {
                  type: 'button',
                  className: `cm-btn danger${confirmDelete ? ' confirm' : ''}`,
                  disabled: detail.source !== 'user',
                  title: detail.source === 'user'
                    ? t('templates.deleteTitle')
                    : t('templates.builtinReadonly'),
                  onClick: remove,
                }, confirmDelete ? t('templates.deleteConfirm') : t('templates.delete'))),
              detail.source === 'user'
                ? h('div', { className: 'cm-template-refine' },
                  h('details', { open: refineIdea !== '' || refineBusy },
                    h('summary', null, t('templates.editByPrompt')),
                    h('div', { className: 'cm-meta' }, t('templates.refineHint')),
                    h('textarea', {
                      className: 'cm-textarea cm-template-refine-input',
                      value: refineIdea,
                      maxLength: 500,
                      placeholder: `${t('templates.ideaShort')} · ${t('templates.refineTarget', { file: detail.file })}`,
                      disabled: refineBusy,
                      onChange: event => setRefineIdea(event.target.value),
                    }),
                    h('button', {
                      type: 'button',
                      className: 'cm-btn primary',
                      disabled: refineBusy || refineIdea.trim() === '',
                      onClick: refine,
                    }, refineBusy ? t('templates.refining') : t('templates.draft'))))
                : null,
              detail.prompt !== '' && detail.prompt !== undefined
                ? h('details', { className: 'cm-template-prompt', open: true },
                  h('summary', null, t('templates.promptSection')),
                  h('pre', { className: 'cm-template-prompt-body' }, detail.prompt))
                : (detail.userPrompt === '' || detail.userPrompt === undefined
                  ? h('div', { className: 'cm-meta' }, t('templates.promptNone'))
                  : null),
              detail.userPrompt !== '' && detail.userPrompt !== undefined
                ? h('details', { className: 'cm-template-prompt', open: true },
                  h('summary', null, t('templates.userPromptSection')),
                  h('pre', { className: 'cm-template-prompt-body' }, detail.userPrompt))
                : null,
              detail.body !== ''
                ? h(MarkdownView, { text: detail.body })
                : null)

        const draftPane = h('div', { className: 'cm-template-save cm-template-save-inline' },
          h('div', { className: 'cm-meta' }, t('templates.aiNote')),
          h('div', { className: 'cm-field' },
            h('label', null, t('templates.idea')),
            h('textarea', {
              className: 'cm-textarea cm-template-body',
              value: idea,
              maxLength: 500,
              placeholder: t('templates.idea'),
              disabled: drafting,
              onChange: event => setIdea(event.target.value),
            })),
          h('div', { className: 'cm-template-actions' },
            h('button', {
              type: 'button',
              className: 'cm-btn primary',
              disabled: drafting || idea.trim() === '',
              onClick: makeDraft,
            }, drafting ? t('templates.drafting') : t('templates.draft')),
            draft !== null
              ? h('button', {
                type: 'button',
                className: 'cm-btn',
                disabled: saving,
                onClick: saveDraft,
              }, saving ? t('templates.saving') : t('templates.saveDraft'))
              : null),
          draft === null
            ? null
            : h('div', { className: 'cm-template-draft' },
              h('h3', { className: 'cm-template-detail-title' }, draft.title),
              h('div', { className: 'cm-template-desc' }, draft.description || t('templates.descriptionEmpty')),
              h('div', { className: 'cm-template-meta' },
                t('templates.axes', { r: (draft.rows ?? []).length, c: (draft.cols ?? []).length })),
              h('details', { open: true },
                h('summary', null, t('templates.promptSection')),
                h('pre', { className: 'cm-template-prompt-body' }, draft.prompt || t('templates.promptNone'))),
              h('div', { className: 'cm-axis-grid' },
                renderDraftAxis(t('editor.rows'), draft.rows ?? []),
                renderDraftAxis(t('editor.cols'), draft.cols ?? []))))

        function renderDraftAxis(label, items) {
          return h('div', { className: 'cm-field' },
            h('label', null, `${label} · ${items.length}`),
            ...items.map((item, index) => h('div', { key: index, className: 'cm-meta' },
              `· ${item.name}${item.hint ? ` — ${item.hint}` : ''}`)))
        }

        return h('div', { className: 'cm-pane', role: 'tabpanel', 'aria-label': t('tab.templates') },
          h('div', { className: 'cm-pane-head' },
            h('div', { className: 'cm-head-main' },
              h('h2', { className: 'cm-pane-title' }, t('templates.title')),
              h('p', { className: 'cm-pane-sub' }, t('templates.subtitle'))),
            h('button', { type: 'button', className: 'cm-btn', onClick: refresh }, t('templates.refresh'))),
          h('div', { className: 'cm-template-tabs cm-template-tabs-inline' },
            h('button', {
              type: 'button',
              className: `cm-tab${tab === 'load' ? ' active' : ''}`,
              onClick: () => setTab('load'),
            }, t('templates.loadTab')),
            h('button', {
              type: 'button',
              className: `cm-tab${tab === 'ai' ? ' active' : ''}`,
              onClick: () => setTab('ai'),
            }, t('templates.aiTab'))),
          error !== null
            ? h('div', { className: 'cm-error-line' }, `${t('templates.error')}: ${error}`)
            : null,
          tab === 'load'
            ? h('div', { className: 'cm-template-main cm-template-main-inline' },
              listPane,
              h('div', { className: 'cm-template-detail' }, detailPane))
            : draftPane)
      }

      function BatchDialog({ scope, snapshot, onClose, onStart, initialOnlyEmpty = true }) {
        const [onlyEmpty, setOnlyEmpty] = React.useState(initialOnlyEmpty)
        const [selected, setSelected] = React.useState(scope === 'row'
          ? snapshot.matrix.rows[0]?.id ?? null
          : scope === 'col'
            ? snapshot.matrix.cols[0]?.id ?? null
            : null)

        React.useEffect(() => {
          const onKey = event => { if (event.key === 'Escape') onClose() }
          window.addEventListener('keydown', onKey)
          return () => window.removeEventListener('keydown', onKey)
        }, [onClose])

        const axes = scope === 'row' ? snapshot.matrix.rows : scope === 'col' ? snapshot.matrix.cols : []
        const totalPairs = scope === 'all'
          ? snapshot.matrix.rows.length * snapshot.matrix.cols.length
          : scope === 'row'
            ? snapshot.matrix.cols.length
            : snapshot.matrix.rows.length
        const cells = Object.keys(snapshot.matrix.cells)
        const filled = scope === 'all'
          ? cells.length
          : scope === 'row'
            ? (selected === null ? 0 : cells.filter(key => key.startsWith(`${selected}:`)).length)
            : (selected === null ? 0 : cells.filter(key => key.endsWith(`:${selected}`)).length)
        const empty = totalPairs - filled
        const targets = onlyEmpty ? empty : totalPairs
        const title = t(`batch.title.${scope}`)

        function start() {
          if (targets === 0) return
          onStart({
            scope,
            rowId: scope === 'row' ? selected : undefined,
            colId: scope === 'col' ? selected : undefined,
            onlyEmpty,
          })
        }

        return h('div', {
          className: 'cm-modal-back',
          onClick: event => { if (event.target === event.currentTarget) onClose() },
        },
          h('div', { className: 'cm-modal cm-batch-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
            h('div', { className: 'cm-modal-head' },
              h('h2', null, title),
              h('button', { type: 'button', className: 'cm-btn', onClick: onClose, 'aria-label': t('batch.close') }, '×')),
            h('div', { className: 'cm-batch-body' },
              h('div', { className: 'cm-meta' }, t('batch.summary', { total: totalPairs, empty, filled })),
              scope === 'all' ? null : h('div', null,
                h('div', { className: 'cm-meta', style: { marginBottom: '6px' } }, t('batch.selectAxis')),
                axes.map(item => h('button', {
                  key: item.id,
                  type: 'button',
                  className: `cm-axis-pick${selected === item.id ? ' active' : ''}`,
                  onClick: () => setSelected(item.id),
                },
                  h('div', { className: 'cm-axis-pick-name' }, item.name),
                  item.hint !== '' ? h('div', { className: 'cm-axis-pick-hint' }, item.hint) : null))),
              h('label', { className: 'cm-check' },
                h('input', {
                  type: 'checkbox',
                  checked: onlyEmpty,
                  onChange: event => setOnlyEmpty(event.target.checked),
                }),
                t('batch.onlyEmpty')),
              h('div', { className: 'cm-meta' },
                t('batch.concurrencyLine', {
                  value: snapshot.concurrency > 0 ? snapshot.concurrency : t('concurrency.all'),
                })),
              h('div', { className: targets === 0 ? 'cm-warn-line' : 'cm-meta' },
                targets === 0 ? t('batch.none') : t('batch.targets', { n: targets })),
              h('div', { className: 'cm-batch-note' }, t('batch.note'))),
            h('div', { className: 'cm-batch-footer' },
              h('button', { type: 'button', className: 'cm-btn', onClick: onClose }, t('batch.close')),
              h('button', { type: 'button', className: 'cm-btn primary', disabled: targets === 0, onClick: start }, t('batch.start')))))
      }

      function SaveTemplateDialog({ snapshot, onClose }) {
        const matrix = snapshot.matrix
        const preset = matrix?.preset ?? null
        const canOverwrite = preset !== null && preset.source === 'user'
        const [mode, setMode] = React.useState(canOverwrite ? 'overwrite' : 'new')
        const [title, setTitle] = React.useState(
          preset !== null ? `${preset.title}${t('save.copySuffix')}` : t('save.untitled'))
        const [description, setDescription] = React.useState('')
        const [body, setBody] = React.useState('')
        const [detail, setDetail] = React.useState(null)
        const [detailState, setDetailState] = React.useState(preset === null ? 'idle' : 'loading')
        const [busy, setBusy] = React.useState(false)
        const [error, setError] = React.useState(null)
        // The read below may land after the user started typing; these refs keep
        // the arriving defaults from overwriting what was already written.
        const typed = React.useRef({ description: false, body: false })
        // An overwrite has to write the template's existing description/body
        // back. Saving before that read settles would blank them, so keep the
        // pending promise around and let save wait for (or retry) it.
        const detailPromise = React.useRef(null)

        React.useEffect(() => {
          const onKey = event => { if (event.key === 'Escape') onClose() }
          window.addEventListener('keydown', onKey)
          return () => window.removeEventListener('keydown', onKey)
        }, [onClose])

        // Only once, on mount: pick up the bound template's description and
        // notes as defaults. A failed read falls back to retrying it on save
        // before an overwrite writes anything.
        React.useEffect(() => {
          if (preset === null) return undefined
          let alive = true
          const pending = request('presets.read', { id: `${preset.source}:${preset.file}` })
            .then(value => {
              if (alive) { setDetail(value); setDetailState('ready') }
              return value
            })
            .catch(() => {
              if (alive) setDetailState('failed')
              return null
            })
          detailPromise.current = pending
          return () => { alive = false }
        }, [])

        React.useEffect(() => {
          if (detail === null) return
          if (!typed.current.description && typeof detail.description === 'string') {
            setDescription(detail.description)
          }
          if (!typed.current.body && typeof detail.body === 'string') {
            setBody(detail.body)
          }
        }, [detail])

        const themeText = String(matrix?.theme ?? '').trim()
        const customPrompt = String(matrix?.prompt ?? '') !== '' || String(matrix?.userPrompt ?? '') !== ''

        async function save() {
          if (matrix === null || busy) return
          const name = title.trim()
          if (mode === 'new' && name === '') {
            setError(t('editor.nameRequired'))
            return
          }
          setBusy(true)
          setError(null)
          try {
            // Overwrite must preserve the template's notes unless the user
            // edited them here; never send empty strings just because the
            // initial read has not landed yet.
            let existing = detail
            if (mode === 'overwrite' && preset !== null && existing === null) {
              existing = detailPromise.current !== null ? await detailPromise.current : null
              if (existing === null) {
                existing = await request('presets.read', { id: `${preset.source}:${preset.file}` })
                setDetail(existing)
                setDetailState('ready')
              }
            }
            const descriptionText = mode === 'overwrite' && existing !== null && !typed.current.description
              ? (typeof existing.description === 'string' ? existing.description : '')
              : description
            const bodyText = mode === 'overwrite' && existing !== null && !typed.current.body
              ? (typeof existing.body === 'string' ? existing.body : '')
              : body
            const payload = {
              title: mode === 'overwrite' && preset !== null ? preset.title : name,
              description: descriptionText,
              theme: matrix.theme,
              prompt: matrix.prompt ?? '',
              rows: matrix.rows.map(row => ({ name: row.name, hint: row.hint })),
              cols: matrix.cols.map(col => ({ name: col.name, hint: col.hint })),
              body: bodyText,
              bind: true,
            }
            if (mode === 'overwrite' && preset !== null && preset.source === 'user') {
              payload.file = preset.file
              payload.overwrite = true
            }
            const value = await request('presets.save', payload)
            bumpRevision()
            if (value !== null && value !== undefined && value.matrix !== undefined && value.matrix !== null) {
              setState({ matrix: value.matrix, persisted: value.persisted === true })
            } else {
              await load({ silent: true })
            }
            notify(t('save.saved'))
            onClose()
          } catch (saveError) {
            setError(String(saveError?.message ?? saveError))
          } finally {
            setBusy(false)
          }
        }

        const choice = (key, enabled, titleText, hintText) => h('label', {
          className: `cm-save-choice${mode === key ? ' active' : ''}${enabled ? '' : ' disabled'}`,
        },
          h('input', {
            type: 'radio',
            name: 'cm-save-mode',
            value: key,
            checked: mode === key,
            disabled: !enabled,
            onChange: () => { if (enabled) setMode(key) },
          }),
          h('span', { className: 'cm-save-choice-body' },
            h('span', { className: 'cm-save-choice-title' }, titleText),
            h('span', { className: 'cm-save-choice-hint' }, hintText)))

        return h('div', {
          className: 'cm-modal-back',
          onClick: event => { if (event.target === event.currentTarget) onClose() },
        },
          h('div', {
            className: 'cm-modal cm-save-modal',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('save.title'),
          },
            h('div', { className: 'cm-modal-head' },
              h('h2', null, t('save.title')),
              h('button', { type: 'button', className: 'cm-btn', onClick: onClose, 'aria-label': t('templates.close') }, '×')),
            h('div', { className: 'cm-modal-body' },
              h('div', { className: 'cm-meta' }, t('save.desc')),
              h('div', { className: 'cm-save-summary' },
                h('span', { className: 'cm-chip' }, t('save.summary', {
                  r: matrix?.rows.length ?? 0,
                  c: matrix?.cols.length ?? 0,
                })),
                h('span', { className: 'cm-chip', title: themeText }, themeText === ''
                  ? t('save.themeNone')
                  : themeText.length > 60 ? `${themeText.slice(0, 60)}…` : themeText),
                h('span', { className: 'cm-chip' }, customPrompt ? t('save.promptOn') : t('save.promptDefault'))),
              h('div', { className: 'cm-save-list' },
                choice('overwrite', canOverwrite, t('save.overwrite'), canOverwrite
                  ? `${preset.title} · ${t('save.overwriteHint', { file: preset.file })}`
                  : preset === null ? t('save.noPreset') : t('save.builtin')),
                choice('new', true, t('save.new'), t('save.newHint'))),
              mode === 'new'
                ? h('div', { className: 'cm-field' },
                  h('label', null, t('save.name')),
                  h('input', {
                    className: 'cm-input',
                    value: title,
                    maxLength: 120,
                    placeholder: t('save.name'),
                    onChange: event => setTitle(event.target.value),
                  }))
                : null,
              h('div', { className: 'cm-field' },
                h('label', null, t('save.descLabel')),
                h('input', {
                  className: 'cm-input',
                  value: description,
                  maxLength: 500,
                  placeholder: t('save.descLabel'),
                  onChange: event => {
                    typed.current.description = true
                    setDescription(event.target.value)
                  },
                })),
              h('details', { className: 'cm-save-body' },
                h('summary', null, t('save.skipBody')),
                h('textarea', {
                  className: 'cm-textarea cm-template-body',
                  value: body,
                  placeholder: t('save.body'),
                  onChange: event => {
                    typed.current.body = true
                    setBody(event.target.value)
                  },
                })),
              error !== null ? h('div', { className: 'cm-error-line' }, error) : null),
            h('div', { className: 'cm-modal-foot' },
              h('button', { type: 'button', className: 'cm-btn', onClick: onClose }, t('templates.cancel')),
              h('button', {
                type: 'button',
                className: 'cm-btn primary',
                disabled: busy
                  || (mode === 'new' && title.trim() === '')
                  || (mode === 'overwrite' && detailState === 'loading'),
                onClick: save,
              }, busy ? t('save.saving') : t('save.confirm')))))
      }

      function Panel() {
        const snapshot = useStore()
        // Templates are the entry point: pick one, load it, then the panel
        // switches to the matrix tab automatically (see onLoaded below).
        const [tab, setTab] = React.useState('templates')
        const [selected, setSelected] = React.useState(null)
        const [saveOpen, setSaveOpen] = React.useState(false)
        const [batchDialog, setBatchDialog] = React.useState(null)
        const [exporting, setExporting] = React.useState(false)
        const [refreshing, setRefreshing] = React.useState(false)
        // The matrix theme lives in the grid corner cell: shown as its text,
        // clicked into a textarea. No separate toolbar input any more.
        const [themeEditing, setThemeEditing] = React.useState(false)
        const [themeDraft, setThemeDraft] = React.useState('')
        const themeSaving = React.useRef(false)
        const [rebuildConfirm, setRebuildConfirm] = React.useState(false)
        const [addingAxis, setAddingAxis] = React.useState(null)
        const [axisDraft, setAxisDraft] = React.useState('')
        const [pendingRemove, setPendingRemove] = React.useState(null)
        // Per-axis "include filled cells" choice and the same choice for the
        // corner button. All default to false: generate only what is missing.
        const [axisRegen, setAxisRegen] = React.useState({})
        const [cornerFull, setCornerFull] = React.useState(false)
        const addBusy = React.useRef(false)
        const removeTimer = React.useRef(null)
        const menuRef = React.useRef(null)
        const pageRef = React.useRef(null)

        // A long matrix can leave the page scrolled far down; a tab switch
        // should start the new pane at its top instead of mid-content.
        React.useEffect(() => {
          if (pageRef.current !== null) pageRef.current.scrollTop = 0
        }, [tab])

        React.useEffect(() => () => {
          if (removeTimer.current !== null) clearTimeout(removeTimer.current)
        }, [])

        React.useEffect(() => {
          enterPanel()
          return () => leavePanel()
        }, [])

        const matrix = snapshot.matrix
        const preset = matrix?.preset ?? null
        const batch = snapshot.batch ?? null
        const batchRunning = batch !== null && batch.done !== true
        const batchFinished = batch === null ? 0 : (batch.completed ?? 0) + (batch.failed ?? 0)
        const total = matrix === null ? 0 : matrix.rows.length * matrix.cols.length
        const filled = matrix === null ? 0 : Object.keys(matrix.cells).length
        const emptyCells = total - filled
        const selectedRow = selected === null || matrix === null ? null : matrix.rows.find(row => row.id === selected.rowId) ?? null
        const selectedCol = selected === null || matrix === null ? null : matrix.cols.find(col => col.id === selected.colId) ?? null

        async function refresh() {
          setRefreshing(true)
          await load({ silent: false })
          setRefreshing(false)
        }

        function startThemeEdit() {
          if (matrix === null) return
          setThemeDraft(matrix.theme ?? '')
          setThemeEditing(true)
        }

        async function commitTheme(close = false) {
          if (themeSaving.current || matrix === null) return
          const value = themeDraft.replace(/\s+/g, ' ').trim()
          if (value !== (matrix.theme ?? '')) {
            themeSaving.current = true
            try {
              await saveAxes({ theme: value, rows: matrix.rows, cols: matrix.cols })
              notify(t('notice.themeSaved'))
            } catch (error) {
              notify(String(error?.message ?? error))
              return
            } finally {
              themeSaving.current = false
            }
          }
          if (close) setThemeEditing(false)
        }

        function cancelThemeEdit() {
          setThemeDraft(matrix === null ? '' : matrix.theme ?? '')
          setThemeEditing(false)
        }

        function closeMenu() {
          if (menuRef.current !== null) menuRef.current.open = false
        }

        async function doExport() {
          setExporting(true)
          try {
            const value = await request('export.markdown')
            download(value.filename, value.markdown)
            notify(t('notice.exported'))
          } catch (error) {
            notify(`${t('notice.exportFailed')}: ${String(error?.message ?? error)}`)
          } finally {
            setExporting(false)
          }
        }

        async function rebuild() {
          if (!rebuildConfirm) { setRebuildConfirm(true); return }
          try {
            await request('reset')
            setRebuildConfirm(false)
            await load({ silent: false })
          } catch (error) {
            notify(String(error?.message ?? error))
          }
        }

        // ------------------------------------------------- per-axis controls
        // Every row and column header carries its own generate / delete
        // controls, so one press acts on that axis instead of opening a picker.

        function axisEmptyCount(axis, id) {
          if (matrix === null) return 0
          const peers = axis === 'row' ? matrix.cols : matrix.rows
          let empty = 0
          for (const peer of peers) {
            const key = axis === 'row' ? `${id}:${peer.id}` : `${peer.id}:${id}`
            if (matrix.cells[key] === undefined) empty += 1
          }
          return empty
        }

        function axisFilledCount(axis, id) {
          if (matrix === null) return 0
          let filledCount = 0
          for (const key of Object.keys(matrix.cells)) {
            if (axis === 'row' ? key.startsWith(`${id}:`) : key.endsWith(`:${id}`)) filledCount += 1
          }
          return filledCount
        }

        function axisIncludesFilled(axis, id) {
          return axisRegen[`${axis}:${id}`] === true
        }

        function toggleAxisRegen(axis, id, include) {
          const key = `${axis}:${id}`
          setAxisRegen(current => Object.assign({}, current, { [key]: include }))
        }

        function generateAxis(axis, id) {
          if (matrix === null) return
          if (batchRunning) { notify(t('notice.axisBusy')); return }
          const includeFilled = axisIncludesFilled(axis, id)
          if (!includeFilled && axisEmptyCount(axis, id) === 0) {
            notify(t('axis.noEmpty'))
            return
          }
          startBatch({
            scope: axis,
            rowId: axis === 'row' ? id : undefined,
            colId: axis === 'col' ? id : undefined,
            onlyEmpty: !includeFilled,
          })
        }

        function removeAxis(axis, id) {
          if (matrix === null) return
          const list = axis === 'row' ? matrix.rows : matrix.cols
          if (list.length <= 1) { notify(t('axis.removeBlocked')); return }
          const key = `${axis}:${id}`
          if (pendingRemove !== key) {
            setPendingRemove(key)
            if (removeTimer.current !== null) clearTimeout(removeTimer.current)
            removeTimer.current = setTimeout(() => {
              removeTimer.current = null
              setPendingRemove(null)
            }, 4000)
            return
          }
          setPendingRemove(null)
          if (removeTimer.current !== null) { clearTimeout(removeTimer.current); removeTimer.current = null }
          const rows = axis === 'row' ? matrix.rows.filter(item => item.id !== id) : matrix.rows
          const cols = axis === 'col' ? matrix.cols.filter(item => item.id !== id) : matrix.cols
          request('axes.replace', { theme: matrix.theme, rows, cols })
            .then(value => {
              bumpRevision()
              setState({ matrix: value.matrix, persisted: value.persisted === true })
              notify(t('notice.axisRemoved'))
            })
            .catch(error => notify(String(error?.message ?? error)))
        }

        function startAddAxis(axis) {
          setPendingRemove(null)
          setAxisDraft('')
          setAddingAxis(axis)
        }

        function cancelAddAxis() {
          setAddingAxis(null)
          setAxisDraft('')
        }

        async function commitAddAxis(axis) {
          if (addBusy.current || matrix === null) return
          const name = axisDraft.replace(/\s+/g, ' ').trim()
          if (name === '') { cancelAddAxis(); return }
          const list = axis === 'row' ? matrix.rows : matrix.cols
          if (list.some(item => item.name === name)) { notify(t('axis.duplicate')); return }
          if (list.length >= 12) { notify(t('axis.full')); return }
          addBusy.current = true
          try {
            const value = await request('axes.upsert', axis === 'row' ? { rows: [{ name }] } : { cols: [{ name }] })
            bumpRevision()
            setState({ matrix: value.matrix, persisted: value.persisted === true })
            setAddingAxis(null)
            setAxisDraft('')
            notify(t('notice.axisAdded'))
          } catch (error) {
            notify(String(error?.message ?? error))
          } finally {
            addBusy.current = false
          }
        }

        // ---- Header: title + meta on the left, every global control on the
        // right. Model / concurrency used to live under the grid; the table has
        // its own entry point now, so they belong with the page-level actions.
        const header = h('div', { className: 'cm-head' },
          h('div', { className: 'cm-head-main' },
            h('h1', { className: 'cm-title', title: t('panel.subtitle') }, t('panel.title')),
            h('div', { className: 'cm-head-meta' },
              h('span', { className: 'cm-chip' }, preset !== null
                ? t('head.preset', { name: preset.title })
                : t('head.noPreset')),
              matrix === null ? null : h('span', { className: 'cm-chip' }, t('head.filled', { filled, total })),
              batchRunning ? h('span', { className: 'cm-chip warn' }, t('head.progress', {
                done: batchFinished,
                total: batch.total,
              })) : null)),
          h('div', { className: 'cm-head-actions' },
            matrix === null ? null : h(ModelSelect, { snapshot }),
            matrix === null ? null : h(ConcurrencySelect, { snapshot }),
            h('button', {
              key: 'save',
              type: 'button',
              className: 'cm-btn',
              disabled: matrix === null,
              onClick: () => setSaveOpen(true),
            }, t('save.button')),
            h('button', {
              key: 'refresh',
              type: 'button',
              className: 'cm-btn',
              disabled: refreshing,
              onClick: refresh,
            }, refreshing ? '…' : t('panel.refresh')),
            matrix === null
              ? null
              : h('details', { key: 'menu', className: 'cm-menu', ref: menuRef },
                h('summary', { className: 'cm-btn', 'aria-label': t('head.more'), title: t('head.more') }, '⋯'),
                h('div', { className: 'cm-menu-pop' },
                  h('button', {
                    type: 'button',
                    disabled: exporting,
                    onClick: () => { closeMenu(); doExport() },
                  }, exporting ? t('panel.exporting') : t('panel.export')),
                  h('button', {
                    type: 'button',
                    disabled: batchRunning,
                    onClick: () => { closeMenu(); setBatchDialog('all') },
                  }, t('head.batch'))))))

        const tabList = [
          ['templates', t('tab.templates'), preset !== null],
          ['matrix', t('tab.matrix'), false],
          ['prompt', t('tab.prompt'), matrix !== null && String(matrix.prompt ?? '') !== ''],
        ]
        const tabs = h('div', { className: 'cm-tabs', role: 'tablist', 'aria-label': t('panel.title') },
          tabList.map(([key, label, dot]) => h('button', {
            key,
            type: 'button',
            role: 'tab',
            'aria-selected': tab === key,
            className: `cm-tab${tab === key ? ' active' : ''}`,
            onClick: () => setTab(key),
          }, dot ? h('span', null, label, h('span', { className: 'cm-tab-dot' })) : label)))

        const banners = []
        if (snapshot.error !== null) {
          banners.push(h('div', { className: 'cm-banner error', key: 'load' },
            h('div', { className: 'cm-banner-title' }, t('error.load')),
            h('div', { className: 'cm-meta' }, snapshot.error),
            h('button', { type: 'button', className: 'cm-btn', onClick: () => load() }, t('error.retry'))))
        }
        if (snapshot.modelError !== null && snapshot.modelError !== undefined) {
          banners.push(h('div', { className: 'cm-banner warn', key: 'model' },
            h('div', { className: 'cm-banner-title' }, t('panel.modelError')),
            h('div', { className: 'cm-meta' }, snapshot.modelError.message ?? t('error.noModel'))))
        }
        if (snapshot.storeError !== null && snapshot.storeError !== undefined) {
          banners.push(h('div', { className: 'cm-banner error', key: 'store' },
            h('div', { className: 'cm-banner-title' }, t('warning.store')),
            h('div', { className: 'cm-meta' }, `${snapshot.storeError.code}: ${snapshot.storeError.message}`),
            h('div', { className: 'cm-meta cm-mono' }, snapshot.storePath),
            h('button', { type: 'button', className: 'cm-btn', onClick: rebuild }, rebuildConfirm ? t('warning.rebuildConfirm') : t('warning.rebuild'))))
        }
        if (snapshot.persisted === false && matrix !== null && (snapshot.storeError === null || snapshot.storeError === undefined)) {
          banners.push(h('div', { className: 'cm-banner', key: 'unsaved' },
            h('div', { className: 'cm-meta' }, t('warning.unsaved'))))
        }
        if (Array.isArray(snapshot.warning) && snapshot.warning.length > 0) {
          banners.push(h('div', { className: 'cm-banner', key: 'warning' },
            h('div', { className: 'cm-meta' }, t('warning.lines', { n: snapshot.warning.length }))))
        }
        if (batch !== null) {
          const finished = batchFinished
          const pct = batch.total > 0 ? Math.min(100, Math.round((finished / batch.total) * 100)) : 100
          const runningKeys = Array.isArray(batch.currentKeys)
            ? batch.currentKeys
            : (batch.currentKey ? [batch.currentKey] : [])
          let currentName = ''
          if (runningKeys.length === 1 && matrix !== null) {
            const at = String(runningKeys[0]).indexOf(':')
            const row = matrix.rows.find(item => item.id === String(runningKeys[0]).slice(0, at))
            const col = matrix.cols.find(item => item.id === String(runningKeys[0]).slice(at + 1))
            if (row !== undefined && col !== undefined) currentName = `${row.name} × ${col.name}`
          }
          banners.push(h('div', { className: `cm-batch-banner${batch.done ? ' done' : ''}`, key: 'batch' },
            h('div', { className: 'cm-batch-head' },
              h('span', { className: 'cm-batch-title' }, batch.done
                ? t('batch.done')
                : t('batch.running', { done: finished, total: batch.total })),
              h('span', { className: 'cm-meta' }, t('batch.doneSummary', {
                done: batch.completed ?? 0,
                failed: batch.failed ?? 0,
                skipped: batch.skipped ?? 0,
              })),
              batch.done
                ? h('button', { type: 'button', className: 'cm-btn', onClick: dismissBatch }, t('batch.hide'))
                : h('button', { type: 'button', className: 'cm-btn danger', onClick: cancelBatch }, t('batch.cancel'))),
            h('div', { className: 'cm-batch-bar' }, h('i', { style: { width: `${pct}%` } })),
            !batch.done && runningKeys.length > 1
              ? h('div', { className: 'cm-meta' }, t('batch.currentMany', { n: runningKeys.length }))
              : !batch.done && currentName !== ''
                ? h('div', { className: 'cm-meta' }, t('batch.current', { name: currentName }))
                : null,
            batch.error ? h('div', { className: 'cm-error-line' }, String(batch.error)) : null,
            Array.isArray(batch.failures) && batch.failures.length > 0
              ? h('div', { className: 'cm-error-line' }, batch.failures.map(item => item.message).join(' / '))
              : null))
        }

        let content
        if (matrix === null) {
          content = snapshot.loading
            ? h('div', { className: 'cm-empty' }, t('drawer.loading'))
            : h('div', { className: 'cm-empty' }, t('error.load'))
        } else if (matrix.rows.length === 0 || matrix.cols.length === 0) {
          content = h('div', { className: 'cm-empty' }, h('div', { className: 'cm-empty-title' }, t('empty.title')), h('div', null, t('empty.body')))
        } else {
          const axisAddControl = axis => addingAxis === axis
            ? h('input', {
              className: 'cm-input cm-axis-add-input',
              value: axisDraft,
              maxLength: 80,
              autoFocus: true,
              placeholder: axis === 'row' ? t('axis.addRow') : t('axis.addCol'),
              'aria-label': axis === 'row' ? t('axis.addRow') : t('axis.addCol'),
              onChange: event => setAxisDraft(event.target.value),
              onKeyDown: event => {
                if (event.key === 'Enter') { event.preventDefault(); commitAddAxis(axis) }
                else if (event.key === 'Escape') { event.preventDefault(); cancelAddAxis() }
              },
              onBlur: () => commitAddAxis(axis),
            })
            : h('button', {
              type: 'button',
              className: 'cm-axis-add-btn',
              disabled: batchRunning,
              'aria-label': axis === 'row' ? t('axis.addRow') : t('axis.addCol'),
              onClick: () => startAddAxis(axis),
            }, `+ ${axis === 'row' ? t('axis.addRow') : t('axis.addCol')}`)

          const axisTools = (axis, item, count) => {
            const includeFilled = axisIncludesFilled(axis, item.id)
            return h('div', { className: 'cm-axis-tools' },
              h('label', {
                className: `cm-axis-regen${includeFilled ? ' on' : ''}`,
                title: t('axis.regenHint'),
              },
                h('input', {
                  type: 'checkbox',
                  checked: includeFilled,
                  disabled: batchRunning,
                  'aria-label': t('axis.regenHint'),
                  onChange: event => toggleAxisRegen(axis, item.id, event.target.checked),
                }),
                h('span', null, t('axis.regenShort'))),
              h('button', {
                type: 'button',
                className: `cm-axis-act${includeFilled ? ' warn' : ''}`,
                disabled: batchRunning,
                title: includeFilled ? t('axis.generateFullHint') : t('axis.generateHint'),
                'aria-label': t('axis.generate'),
                onClick: () => generateAxis(axis, item.id),
              }, `▷ ${includeFilled ? t('axis.regenerateShort') : t('axis.generateShort')}`),
              h('button', {
                type: 'button',
                className: `cm-axis-act danger${pendingRemove === `${axis}:${item.id}` ? ' armed' : ''}`,
                disabled: batchRunning || count <= 1,
                title: count <= 1
                  ? t('axis.removeBlocked')
                  : pendingRemove === `${axis}:${item.id}`
                    ? (axisFilledCount(axis, item.id) > 0
                      ? t('axis.confirmRemoveWith', { n: axisFilledCount(axis, item.id) })
                      : t('axis.confirmRemove'))
                    : t('axis.remove'),
                'aria-label': t('axis.remove'),
                onClick: () => removeAxis(axis, item.id),
              }, pendingRemove === `${axis}:${item.id}` ? '×!' : '×'))
          }

          const cornerCell = themeEditing
            ? h('textarea', {
              className: 'cm-corner-input',
              value: themeDraft,
              maxLength: 500,
              autoFocus: true,
              rows: 3,
              placeholder: t('corner.placeholder'),
              'aria-label': t('panel.theme'),
              onChange: event => setThemeDraft(event.target.value),
              onBlur: () => commitTheme(true),
              onKeyDown: event => {
                if (event.key === 'Escape') { event.preventDefault(); cancelThemeEdit() }
                else if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); commitTheme(true) }
              },
            })
            : h('div', {
              className: `cm-corner${matrix.theme ? '' : ' empty'}`,
              role: 'button',
              tabIndex: 0,
              title: t('corner.title'),
              'aria-label': t('corner.title'),
              onClick: startThemeEdit,
              onKeyDown: event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); startThemeEdit() }
              },
            }, h('span', null, matrix.theme || t('panel.themePlaceholder')))

          // The filled, brand-coloured action of the page. The checkbox above
          // it decides the scope: empty cells only (default) or every cell.
          // While a batch runs the button turns into its own stop control, so
          // the grid never needs a separate toolbar.
          const allToggle = h('label', {
            className: `cm-all-toggle${cornerFull ? ' on' : ''}`,
            title: t('corner.includeHint'),
          },
            h('input', {
              type: 'checkbox',
              checked: cornerFull,
              disabled: batchRunning,
              'aria-label': t('corner.includeFilled'),
              onChange: event => setCornerFull(event.target.checked),
            }),
            h('span', null, t('corner.includeFilled')))

          const allButton = h('button', {
            type: 'button',
            className: `cm-all-btn${batchRunning ? ' running' : cornerFull ? ' full' : ''}`,
            title: batchRunning
              ? t('corner.stop')
              : cornerFull
                ? t('corner.fullHint', { n: total })
                : t('corner.allHint'),
            'aria-label': batchRunning
              ? `${t('corner.running', { done: batchFinished, total: batch.total })} · ${t('corner.stop')}`
              : cornerFull
                ? t('corner.allRegen')
                : t('corner.all'),
            onClick: () => {
              if (batchRunning) { cancelBatch(); return }
              if (!cornerFull && emptyCells <= 0) { notify(t('corner.allFull')); return }
              startBatch({ scope: 'all', onlyEmpty: !cornerFull })
            },
          }, batchRunning
            ? `${t('corner.running', { done: batchFinished, total: batch.total })} · ${t('corner.stop')}`
            : `⚡ ${cornerFull ? t('corner.allRegen') : t('corner.all')}`)

          content = h('div', { className: 'cm-grid-wrap' },
            h('table', { className: 'cm-grid' },
              h('thead', null,
                h('tr', null,
                  h('th', { className: 'cm-corner-th' },
                    h('div', { className: 'cm-corner-box' }, cornerCell, allToggle, allButton)),
                  matrix.cols.map(col => h('th', { key: col.id, className: 'cm-axis-th' },
                    h('div', { className: 'cm-axis-head' },
                      h(AxisTitle, { axis: 'col', item: col }),
                      h(AxisHint, { axis: 'col', item: col }),
                      axisTools('col', col, matrix.cols.length)))),
                  h('th', { key: '__add-col', className: 'cm-axis-add' }, axisAddControl('col')))),
              h('tbody', null,
                matrix.rows.map(row => h('tr', { key: row.id },
                  h('th', { scope: 'row', className: 'cm-axis-th' },
                    h('div', { className: 'cm-axis-head' },
                      h(AxisTitle, { axis: 'row', item: row }),
                      h(AxisHint, { axis: 'row', item: row }),
                      axisTools('row', row, matrix.rows.length))),
                  matrix.cols.map(col => h('td', { key: col.id },
                    h(CellView, {
                      snapshot,
                      row,
                      col,
                      onOpen: () => setSelected({ rowId: row.id, colId: col.id }),
                    }))))),
                h('tr', { key: '__add-row', className: 'cm-axis-add-row' },
                  h('th', null, axisAddControl('row')),
                  h('td', { colSpan: Math.max(matrix.cols.length, 1) })))))
        }

        // Only the active tab is mounted: an unsaved template draft is
        // intentionally dropped when you switch away, and every pane says how
        // it persists.
        let pane
        if (tab === 'matrix') {
          pane = h('div', { className: 'cm-pane', role: 'tabpanel', 'aria-label': t('tab.matrix') }, banners, content)
        } else if (matrix !== null && tab === 'templates') {
          pane = h(TemplatesPane, { snapshot, onLoaded: () => setTab('matrix') })
        } else if (matrix !== null && tab === 'prompt') {
          pane = h(PromptPane, { snapshot })
        } else {
          pane = h('div', { className: 'cm-pane', role: 'tabpanel', 'aria-label': t('panel.title') },
            h('div', { className: 'cm-empty' }, snapshot.loading ? t('drawer.loading') : t('error.load')))
        }

        return h('div', { className: 'cm-page', ref: pageRef },
          h('style', null, CSS),
          header,
          tabs,
          pane,
          selectedRow !== null && selectedCol !== null
            ? h(Drawer, {
              snapshot,
              row: selectedRow,
              col: selectedCol,
              onClose: () => setSelected(null),
            })
            : null,
          saveOpen && matrix !== null
            ? h(SaveTemplateDialog, { snapshot, onClose: () => setSaveOpen(false) })
            : null,
          batchDialog !== null && matrix !== null
            ? h(BatchDialog, {
              scope: batchDialog,
              snapshot,
              onClose: () => setBatchDialog(null),
              onStart: args => { setBatchDialog(null); startBatch(args) },
            })
            : null,
          snapshot.notice !== null ? h('div', { className: 'cm-toast' }, snapshot.notice) : null)
      }

      const CSS = `
  .cm-page{position:relative;height:100%;box-sizing:border-box;overflow:auto;padding:26px 30px 40px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit}
  .cm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:14px}
  .cm-title{margin:0;font-size:20px;font-weight:650;letter-spacing:.01em;line-height:1.3}
  .cm-head-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;flex:none}
  .cm-head-main{min-width:0}
  .cm-meta{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary)}
  .cm-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-layer-1);padding:2px 9px;font-size:11.5px;line-height:1.7;color:var(--dsw-alias-label-secondary);white-space:nowrap;max-width:340px;overflow:hidden;text-overflow:ellipsis}
  .cm-chip.ok{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
  .cm-chip.warn{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}
  .cm-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .cm-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;font-weight:550;padding:6px 13px;cursor:pointer;white-space:nowrap}
  .cm-btn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
  .cm-btn:disabled{opacity:.45;cursor:default}
  .cm-btn.primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
  .cm-btn.danger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
  .cm-btn.danger.confirm{border-color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-bg-base);font-weight:650}
  .cm-btn.danger.confirm:hover:not(:disabled){border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-bg-base);opacity:.9}
  .cm-mini{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:1;padding:4px 8px;cursor:pointer;white-space:nowrap;flex:none}
  .cm-mini:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
  .cm-mini.danger:hover{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
  .cm-model{display:flex;align-items:center;gap:8px;min-width:0;max-width:480px;flex-wrap:wrap}
  .cm-concurrency{display:flex;align-items:center;gap:8px;flex:none}
  .cm-concurrency .cm-select{min-width:104px;max-width:170px}
  .cm-select{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:1.5;padding:6px 8px;min-width:190px;max-width:340px;outline:none;text-overflow:ellipsis}
  .cm-select:focus{border-color:var(--dsw-alias-brand-primary)}
  .cm-theme-label{font-size:11.5px;font-weight:650;color:var(--dsw-alias-label-secondary);letter-spacing:.02em;white-space:nowrap}
  .cm-input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;line-height:1.5;padding:6px 10px;min-width:0;outline:none}
  .cm-input:focus{border-color:var(--dsw-alias-brand-primary)}
  .cm-grid-wrap{overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
  .cm-grid{border-collapse:separate;border-spacing:0;width:100%;min-width:max-content;table-layout:fixed}
  .cm-grid th,.cm-grid td{border-right:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1);vertical-align:top;padding:0}
  .cm-grid thead th{position:sticky;top:0;z-index:2;background:var(--dsw-alias-bg-layer-2);text-align:left;padding:10px 12px;min-width:220px;max-width:280px}
  .cm-grid thead th.cm-axis-th{width:260px}
  .cm-grid td{width:260px}
  .cm-grid tbody th{position:sticky;left:0;z-index:1;background:var(--dsw-alias-bg-layer-2);text-align:left;padding:10px 12px;width:160px;min-width:160px;max-width:180px}
  .cm-grid thead th.cm-corner-th{left:0;z-index:3;width:240px;min-width:240px;max-width:280px}
  .cm-corner{font-size:12px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary);cursor:text;border-radius:6px;padding:2px 4px;margin:-2px -4px;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
  .cm-corner:hover{background:var(--dsw-alias-bg-layer-1);box-shadow:0 0 0 1px var(--dsw-alias-border-l1)}
  .cm-corner.empty{font-weight:400;color:var(--dsw-alias-label-secondary);opacity:.8}
  .cm-corner-input{width:100%;box-sizing:border-box;resize:vertical;min-height:56px;font:inherit;font-size:12px;line-height:1.5;padding:4px 6px;border:1px solid var(--dsw-alias-brand-primary);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);outline:none}
  .cm-grid tr:last-child th,.cm-grid tr:last-child td{border-bottom:none}
  .cm-grid th:last-child,.cm-grid td:last-child{border-right:none}
  .cm-axis-name{font-size:13px;font-weight:600;line-height:1.4;overflow-wrap:anywhere}
  .cm-axis-editable{cursor:text;border-radius:4px;padding:1px 3px;margin:-1px -3px}
  .cm-axis-editable:hover{background:var(--dsw-alias-bg-layer-1);box-shadow:0 0 0 1px var(--dsw-alias-border-l1)}
  .cm-axis-input{width:100%;box-sizing:border-box;font-size:13px;font-weight:600;line-height:1.4;padding:2px 4px}
  .cm-axis-hint{font-size:10.5px;line-height:1.4;color:var(--dsw-alias-label-secondary);cursor:text;border-radius:4px;padding:1px 3px;margin:-1px -3px 0;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .cm-axis-hint:hover{background:var(--dsw-alias-bg-layer-1);box-shadow:0 0 0 1px var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary)}
  .cm-axis-hint.empty{opacity:.6;font-style:italic}
  .cm-axis-hint-input{width:100%;box-sizing:border-box;font-size:11px;line-height:1.4;padding:2px 4px}
  .cm-axis-head{display:flex;flex-direction:column;gap:6px;min-width:0}
  .cm-axis-tools{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
  .cm-axis-act{display:inline-flex;align-items:center;gap:3px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;line-height:1;padding:3px 7px;cursor:pointer;white-space:nowrap}
  .cm-axis-act:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
  .cm-axis-act:disabled{opacity:.35;cursor:default}
  .cm-axis-act.armed{border-color:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary);background:var(--dsw-alias-bg-layer-1)}
  .cm-axis-act.warn{border-color:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary)}
  .cm-axis-act.danger:hover:not(:disabled){border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
  .cm-axis-act.danger.armed{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
  .cm-axis-regen{display:inline-flex;align-items:center;gap:3px;font-size:10px;line-height:1;color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none;white-space:nowrap}
  .cm-axis-regen input{width:12px;height:12px;margin:0;accent-color:var(--dsw-alias-state-warn-primary)}
  .cm-axis-regen.on{color:var(--dsw-alias-state-warn-primary)}
  .cm-axis-regen input:disabled{cursor:default}
  .cm-grid thead th.cm-axis-add{position:sticky;right:0;z-index:3;min-width:112px;max-width:150px;vertical-align:middle;background:var(--dsw-alias-bg-layer-2);box-shadow:inset 1px 0 0 var(--dsw-alias-border-l1)}
  .cm-grid tbody tr.cm-axis-add-row th{vertical-align:middle}
  .cm-grid tbody tr.cm-axis-add-row td{background:var(--dsw-alias-bg-layer-1)}
  .cm-axis-add-btn{display:inline-flex;align-items:center;justify-content:center;border:1px dashed var(--dsw-alias-border-l2);border-radius:8px;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;line-height:1.4;padding:5px 9px;cursor:pointer;white-space:nowrap}
  .cm-axis-add-btn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
  .cm-axis-add-btn:disabled{opacity:.35;cursor:default}
  .cm-axis-add-input{width:100%;font-size:12px}
  .cm-cell{display:flex;flex-direction:column;gap:6px;min-height:92px;margin:6px;padding:9px 10px;border:1px solid transparent;border-radius:9px;background:var(--dsw-alias-bg-base);cursor:pointer;box-sizing:border-box}
  .cm-cell:hover{border-color:var(--dsw-alias-border-l2)}
  .cm-cell.filled{background:var(--dsw-alias-bg-layer-1)}
  .cm-cell.live{border-color:var(--dsw-alias-brand-primary)}
  .cm-cell.failed{border-color:var(--dsw-alias-state-error-primary)}
  .cm-cell-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .cm-cell-state{font-size:10.5px;line-height:1.4;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cm-cell-body{flex:1;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-primary);white-space:pre-wrap;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
  .cm-cell.live .cm-cell-body{color:var(--dsw-alias-brand-primary)}
  .cm-cell.failed .cm-cell-body{color:var(--dsw-alias-state-error-primary)}
  .cm-cell-foot{display:flex;flex-wrap:wrap;gap:8px;font-size:10.5px;line-height:1.4;color:var(--dsw-alias-label-secondary);word-break:break-all}
  .cm-banner{display:flex;flex-direction:column;align-items:flex-start;gap:6px;margin:0 0 10px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}
  .cm-banner.warn{border-color:var(--dsw-alias-state-warn-primary)}
  .cm-banner.error{border-color:var(--dsw-alias-state-error-primary)}
  .cm-banner-title{font-size:12.5px;font-weight:650;line-height:1.4}
  .cm-banner .cm-btn{margin-top:2px}
  .cm-empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:44px 20px;border:1px dashed var(--dsw-alias-border-l2);border-radius:12px;color:var(--dsw-alias-label-secondary);text-align:center;font-size:12.5px;line-height:1.6}
  .cm-empty-title{font-size:14px;font-weight:650;color:var(--dsw-alias-label-primary)}
  .cm-drawer{position:fixed;top:0;right:0;bottom:0;width:min(560px,94vw);z-index:45;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);border-left:1px solid var(--dsw-alias-border-l2);box-shadow:-18px 0 40px rgba(0,0,0,.18);color:var(--dsw-alias-label-primary)}
  .cm-drawer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 18px 10px;border-bottom:1px solid var(--dsw-alias-border-l1)}
  .cm-drawer-titles{min-width:0}
  .cm-drawer-kicker{font-size:10.5px;font-weight:650;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}
  .cm-drawer-title{margin-top:3px;font-size:16px;font-weight:650;line-height:1.35;overflow-wrap:anywhere}
  .cm-drawer-meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:5px;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary);word-break:break-all}
  .cm-drawer-hint{padding:10px 18px 0}
  .cm-drawer-hint .cm-input{width:100%}
  .cm-drawer-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 18px}
  .cm-drawer-body{flex:1;min-height:0;overflow:auto;padding:4px 18px 18px;font-size:13px;line-height:1.65}
  .cm-drawer-foot{padding:8px 18px;border-top:1px solid var(--dsw-alias-border-l1);min-height:16px}
  .cm-live{display:flex;flex-direction:column;gap:8px}
  .cm-live-stage{font-size:11.5px;font-weight:650;color:var(--dsw-alias-brand-primary)}
  .cm-live-text{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.65 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px}
  .cm-edit{display:flex;flex-direction:column;gap:8px}
  .cm-textarea{box-sizing:border-box;width:100%;min-height:340px;resize:vertical;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:12.5px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:10px;outline:none}
  .cm-textarea:focus{border-color:var(--dsw-alias-brand-primary)}
  .cm-md h1,.cm-md h2,.cm-md h3,.cm-md h4{margin:16px 0 6px;line-height:1.35;font-weight:650}
  .cm-md h1{font-size:18px}.cm-md h2{font-size:16px}.cm-md h3{font-size:14px}.cm-md h4{font-size:13px}
  .cm-md p{margin:7px 0;white-space:pre-wrap;overflow-wrap:anywhere}
  .cm-md ul,.cm-md ol{margin:7px 0;padding-left:22px}
  .cm-md li{margin:3px 0}
  .cm-md blockquote{margin:9px 0;padding:6px 12px;border-left:3px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-base);border-radius:0 8px 8px 0;color:var(--dsw-alias-label-primary)}
  .cm-md pre{margin:9px 0;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);overflow:auto;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .cm-md code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;background:var(--dsw-alias-bg-layer-2);border-radius:4px;padding:1px 4px}
  .cm-md pre code{background:none;padding:0;font-size:12px}
  .cm-md hr{border:none;border-top:1px solid var(--dsw-alias-border-l1);margin:14px 0}
  .cm-error-line{margin:8px 0;padding:8px 10px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:8px;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
  .cm-warn-line{margin:8px 0;padding:8px 10px;border:1px solid var(--dsw-alias-state-warn-primary);border-radius:8px;color:var(--dsw-alias-state-warn-primary);font-size:12px;line-height:1.5}
  .cm-modal-back{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.42)}
  .cm-modal{display:flex;flex-direction:column;width:min(900px,96vw);max-height:90vh;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.32);color:var(--dsw-alias-label-primary)}
  .cm-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--dsw-alias-border-l1)}
  .cm-modal-head h2{margin:0;font-size:16px;font-weight:650}
  .cm-modal-body{padding:16px 18px;overflow:auto;display:flex;flex-direction:column;gap:12px}
  .cm-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--dsw-alias-border-l1)}
  .cm-field{display:flex;flex-direction:column;gap:6px}
  .cm-field label{font-size:11.5px;font-weight:650;color:var(--dsw-alias-label-secondary);letter-spacing:.02em}
  .cm-axis-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px}
  .cm-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:80;padding:8px 16px;border-radius:999px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font-size:12.5px;box-shadow:0 8px 24px rgba(0,0,0,.25);white-space:nowrap;max-width:90vw;overflow:hidden;text-overflow:ellipsis}
  .cm-template-modal{width:min(1000px,96vw);height:min(720px,88vh);max-height:88vh;overflow:hidden}
  .cm-template-tabs{display:flex;gap:6px;padding:10px 18px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
  .cm-tab{border:none;border-bottom:2px solid transparent;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;font-weight:600;padding:6px 4px 8px;margin-bottom:-1px;cursor:pointer}
  .cm-tab.active{color:var(--dsw-alias-brand-primary);border-bottom-color:var(--dsw-alias-brand-primary)}
  .cm-template-main{flex:1;min-height:0;display:grid;grid-template-columns:minmax(280px,40%) minmax(0,1fr);overflow:hidden}
  .cm-template-list{overflow:auto;border-right:1px solid var(--dsw-alias-border-l1);padding:8px}
  .cm-template-item{display:block;width:100%;text-align:left;border:1px solid transparent;border-radius:9px;background:none;color:inherit;font:inherit;padding:9px 10px;cursor:pointer;margin-bottom:4px}
  .cm-template-item:hover{background:var(--dsw-alias-bg-layer-2)}
  .cm-template-item.active{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}
  .cm-template-item-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .cm-template-name{font-size:13px;font-weight:650;line-height:1.4;overflow-wrap:anywhere}
  .cm-template-tags{display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:flex-end}
  .cm-template-prompt{margin:10px 0;font-size:12.5px}
  .cm-template-prompt summary{cursor:pointer;font-weight:650;color:var(--dsw-alias-label-secondary)}
  .cm-template-prompt-body{margin:6px 0 0;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--dsw-alias-label-secondary);max-height:260px;overflow:auto}
  .cm-prompt-textarea{min-height:170px}
  .cm-prompt-user{min-height:240px}
  .cm-prompt-field{display:flex;flex-direction:column;gap:5px;min-width:0}
  .cm-prompt-layout{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:18px;align-items:start}
  .cm-prompt-main{display:flex;flex-direction:column;gap:8px;min-width:0}
  .cm-prompt-label{font-size:12px;font-weight:650;line-height:1.4;color:var(--dsw-alias-label-secondary);letter-spacing:.02em}
  .cm-prompt-side{display:flex;flex-direction:column;gap:12px;min-width:0}
  .cm-prompt-section{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:12px 13px;min-width:0}
  .cm-prompt-section-title{margin:0 0 5px;font-size:12.5px;font-weight:650;line-height:1.4}
  .cm-prompt-section .cm-meta{line-height:1.5}
  .cm-ph-list{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:7px;max-height:330px;overflow:auto}
  .cm-ph-item{border-top:1px solid var(--dsw-alias-border-l1);padding-top:7px;min-width:0}
  .cm-ph-item:first-child{border-top:none;padding-top:0}
  .cm-ph-tokens{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .cm-ph-token{border:1px solid var(--dsw-alias-brand-primary);border-radius:5px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-brand-primary);font:11px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:2px 5px;cursor:pointer}
  .cm-ph-token:hover{background:var(--dsw-alias-bg-layer-2)}
  .cm-ph-alias{font:10.5px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--dsw-alias-label-secondary)}
  .cm-ph-desc{margin-top:3px;font-size:11px;line-height:1.45;color:var(--dsw-alias-label-secondary)}
  .cm-ph-value{margin-top:2px;font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cm-ph-value.empty{color:var(--dsw-alias-label-secondary);font-style:italic}
  .cm-preview{margin-top:8px}
  .cm-preview.loading{opacity:.55}
  .cm-preview-label{margin-top:8px;font-size:10.5px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}
  .cm-preview-text{margin:3px 0 0;padding:8px;max-height:150px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-base);font:11px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--dsw-alias-label-primary)}
  .cm-preview-note{margin-top:8px}
  .cm-template-desc{margin-top:3px;font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
  .cm-template-meta{margin-top:4px;font-size:10.5px;line-height:1.45;color:var(--dsw-alias-label-secondary);word-break:break-all}
  .cm-template-detail{overflow:auto;padding:16px 18px;font-size:13px;line-height:1.65;min-width:0}
  .cm-template-detail-title{margin:0 0 4px;font-size:17px;font-weight:650;line-height:1.35}
  .cm-template-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 0 14px}
  .cm-template-save{overflow:auto;padding:16px 18px;display:flex;flex-direction:column;gap:12px}
  .cm-template-body{min-height:160px}
  .cm-template-refine{margin:4px 0 10px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}
  .cm-template-refine summary{font-size:12.5px;font-weight:600;cursor:pointer;color:var(--dsw-alias-label-primary)}
  .cm-template-refine .cm-meta{margin:6px 0}
  .cm-template-refine-input{min-height:72px;margin-bottom:8px}
  .cm-template-draft{border-top:1px solid var(--dsw-alias-border-l1);padding-top:10px}
  .cm-batch-banner{display:flex;flex-direction:column;gap:6px;margin:0 0 10px;padding:10px 12px;border:1px solid var(--dsw-alias-brand-primary);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}
  .cm-batch-banner.done{border-color:var(--dsw-alias-border-l2)}
  .cm-batch-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
  .cm-batch-title{font-size:12.5px;font-weight:650;line-height:1.4}
  .cm-batch-bar{height:6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}
  .cm-batch-bar i{display:block;height:100%;border-radius:999px;background:var(--dsw-alias-brand-primary);transition:width .3s ease}
  .cm-batch-modal{width:min(620px,96vw);max-height:86vh}
  .cm-batch-body{padding:16px 18px;overflow:auto;display:flex;flex-direction:column;gap:12px}
  .cm-batch-footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--dsw-alias-border-l1)}
  .cm-batch-note{font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-secondary)}
  .cm-axis-pick{display:block;width:100%;text-align:left;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:inherit;font:inherit;padding:7px 9px;cursor:pointer;margin-bottom:4px}
  .cm-axis-pick:hover{background:var(--dsw-alias-bg-layer-2)}
  .cm-axis-pick.active{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}
  .cm-axis-pick-name{font-size:12.5px;font-weight:600;line-height:1.4;overflow-wrap:anywhere}
  .cm-axis-pick-hint{margin-top:2px;font-size:11px;line-height:1.4;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
  .cm-check{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--dsw-alias-label-primary);cursor:pointer}
  .cm-head-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:7px}
  .cm-tabs{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:2px;border-bottom:1px solid var(--dsw-alias-border-l1);margin:0 0 16px;overflow-x:auto;background:var(--dsw-alias-bg-base)}
  .cm-tabs .cm-tab{padding:9px 14px;font-size:13px;white-space:nowrap}
  .cm-tab-dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-brand-primary);margin-left:5px;vertical-align:middle}
  .cm-pane{display:flex;flex-direction:column;gap:14px;min-height:0}
  .cm-pane-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
  .cm-pane-title{margin:0;font-size:16px;font-weight:650;line-height:1.35}
  .cm-pane-sub{margin:4px 0 0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);max-width:820px}
  .cm-pane-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;padding-top:4px}
  .cm-pane-note{font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-secondary)}
  .cm-menu{position:relative}
  .cm-menu>summary{list-style:none;cursor:pointer}
  .cm-menu>summary::-webkit-details-marker{display:none}
  .cm-menu-pop{position:absolute;right:0;top:calc(100% + 6px);z-index:30;min-width:190px;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-overlay);box-shadow:0 12px 32px rgba(0,0,0,.22);display:flex;flex-direction:column}
  .cm-menu-pop button{text-align:left;border:none;background:none;color:inherit;font:inherit;font-size:12.5px;line-height:1.5;padding:7px 10px;border-radius:7px;cursor:pointer;white-space:nowrap}
  .cm-menu-pop button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
  .cm-menu-pop button:disabled{opacity:.45;cursor:default}
  .cm-menu-pop button.danger{color:var(--dsw-alias-state-error-primary)}
  .cm-corner-box{display:flex;flex-direction:column;gap:8px;min-width:0}
  .cm-all-toggle{display:flex;align-items:center;gap:6px;font-size:10.5px;line-height:1.3;color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none;white-space:nowrap}
  .cm-all-toggle input{flex:none;margin:0;accent-color:var(--dsw-alias-state-warn-primary)}
  .cm-all-toggle.on{color:var(--dsw-alias-state-warn-primary)}
  .cm-all-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;width:100%;border:1px solid var(--dsw-alias-brand-primary);border-radius:7px;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font:inherit;font-size:11.5px;font-weight:650;line-height:1.3;padding:6px 8px;cursor:pointer;white-space:nowrap;box-sizing:border-box}
  .cm-all-btn:hover:not(:disabled){opacity:.9}
  .cm-all-btn:disabled{opacity:.5;cursor:default}
  .cm-all-btn.running{border-color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-state-error-primary)}
  .cm-all-btn.full{border-color:var(--dsw-alias-state-warn-primary);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-warn-primary)}
  .cm-save-modal{width:min(620px,96vw)}
  .cm-save-summary{display:flex;flex-wrap:wrap;gap:6px}
  .cm-save-list{display:flex;flex-direction:column;gap:8px}
  .cm-save-choice{display:flex;align-items:flex-start;gap:9px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;cursor:pointer;background:var(--dsw-alias-bg-base)}
  .cm-save-choice.active{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-1)}
  .cm-save-choice.disabled{opacity:.55;cursor:default}
  .cm-save-choice input{margin-top:2px}
  .cm-save-choice-body{display:flex;flex-direction:column;gap:2px;min-width:0}
  .cm-save-choice-title{font-size:12.5px;font-weight:650;line-height:1.4}
  .cm-save-choice-hint{font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
  .cm-save-body summary{cursor:pointer;font-size:11.5px;font-weight:650;color:var(--dsw-alias-label-secondary)}
  .cm-save-body .cm-textarea{min-height:120px;margin-top:8px}
  .cm-template-tabs-inline{padding:0;border-bottom:1px solid var(--dsw-alias-border-l1)}
  .cm-template-save-inline{padding:0;overflow:visible}
  .cm-template-main-inline{display:grid;grid-template-columns:minmax(260px,38%) minmax(0,1fr);min-height:420px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden}
  .cm-template-main-inline .cm-template-list{max-height:560px}
  .cm-template-main-inline .cm-template-detail{border-left:1px solid var(--dsw-alias-border-l1)}
  @media (max-width:1100px){
    .cm-prompt-layout{grid-template-columns:1fr}
    .cm-ph-list{max-height:none}
  }
  @media (max-width:900px){
    .cm-head{flex-direction:column}
    .cm-head-actions{width:100%;justify-content:flex-start}
    .cm-template-main-inline{grid-template-columns:1fr}
    .cm-template-main-inline .cm-template-detail{border-left:none;border-top:1px solid var(--dsw-alias-border-l1)}
  }
  `

      return { Panel, Drawer, MarkdownView, MatrixIcon, CSS }
    }

    return { createUi }
  },
})
