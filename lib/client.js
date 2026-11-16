window.__ModuleLoader__.load({
	id: "dsh-next-message",
	factory: (require) => {
/**
 * Browser half of dsh-next-message.
 *
 * Registers three entries:
 *   conversation.input.overlay  - drives the prediction request and draws the
 *                                 inline ghost text over the empty composer
 *   conversation.composer.dock  - optional "below" bar for the same prediction
 *   plugins.bundle.config       - the bundle's settings page
 *
 * This source is a plain browser script defining `create(require)`. The build
 * wraps it in DSH's module-loader envelope and inlines CSS and locale JSON.
 */
const CSS = "/* dsh-next-message: composer ghost text and bundle settings page. */\n\n.dsh-nm-anchor {\n  display: contents;\n}\n\n/* Inline ghost text. Absolute coordinates are measured from the composer card\n   and applied inline; this rule owns typography, masking, and the keycap. */\n.dsh-nm-ghost {\n  position: absolute;\n  z-index: 4;\n  box-sizing: border-box;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  color: var(--dsw-alias-label-tertiary);\n  pointer-events: none;\n  white-space: nowrap;\n}\n\n/* Opaque patch over the composer placeholder so only the suggestion shows. */\n.dsh-nm-ghost::before {\n  content: '';\n  position: absolute;\n  inset: -2px -6px;\n  z-index: -1;\n  border-radius: 6px;\n  background: var(--dsw-specific-input-major, var(--dsw-alias-bg-module-platform));\n}\n\n.dsh-nm-ghost-text {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dsh-nm-key {\n  flex: none;\n  display: inline-flex;\n  align-items: center;\n  height: 16px;\n  padding: 0 5px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 5px;\n  background: var(--dsw-alias-bg-module-platform);\n  color: var(--dsw-alias-label-caption);\n  font-family: inherit;\n  font-size: 10.5px;\n  line-height: 14px;\n  letter-spacing: 0.01em;\n}\n\n.dsh-nm-key-button {\n  cursor: pointer;\n}\n\n.dsh-nm-key-button:hover {\n  color: var(--dsw-alias-label-primary);\n}\n\n/* Below-composer suggestion bar, rendered in the composer dock. */\n.dsh-nm-bar {\n  box-sizing: border-box;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  max-width: 100%;\n  height: 22px;\n  padding: 0 2px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n  line-height: 18px;\n}\n\n.dsh-nm-bar-label {\n  flex: none;\n  color: var(--dsw-alias-label-caption);\n  font-size: 11px;\n}\n\n.dsh-nm-bar-text {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n/* Settings page under Plugins -> dsh-next-message. */\n.dsh-nm-settings {\n  display: flex;\n  flex-direction: column;\n  gap: 16px;\n}\n\n.dsh-nm-settings-desc {\n  margin: 0;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12.5px;\n  line-height: 19px;\n}\n\n.dsh-nm-row {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 20px;\n}\n\n.dsh-nm-row-text {\n  min-width: 0;\n}\n\n.dsh-nm-row-label {\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  line-height: 20px;\n}\n\n.dsh-nm-row-hint {\n  margin-top: 1px;\n  color: var(--dsw-alias-label-caption);\n  font-size: 12px;\n  line-height: 18px;\n}\n\n.dsh-nm-select {\n  flex: none;\n  max-width: 280px;\n  height: 30px;\n  padding: 0 8px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 8px;\n  background: var(--dsw-alias-bg-module-platform);\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  font-size: 12.5px;\n}\n\n.dsh-nm-select:focus-visible {\n  outline: 2px solid var(--dsw-alias-state-business-primary);\n  outline-offset: 1px;\n}\n\n.dsh-nm-switch {\n  flex: none;\n  box-sizing: border-box;\n  width: 36px;\n  height: 20px;\n  padding: 2px;\n  border: 0;\n  border-radius: 999px;\n  background: var(--dsw-alias-border-l2);\n  cursor: pointer;\n  transition: background 140ms ease;\n}\n\n.dsh-nm-switch[aria-checked='true'] {\n  background: var(--dsw-alias-state-business-primary);\n}\n\n.dsh-nm-switch:disabled {\n  cursor: default;\n  opacity: 0.55;\n}\n\n.dsh-nm-switch:focus-visible {\n  outline: 2px solid var(--dsw-alias-state-business-primary);\n  outline-offset: 2px;\n}\n\n.dsh-nm-switch-knob {\n  display: block;\n  width: 16px;\n  height: 16px;\n  border-radius: 50%;\n  background: #fff;\n  box-shadow: 0 1px 2px rgb(0 0 0 / 18%);\n  transition: transform 140ms ease;\n}\n\n.dsh-nm-switch[aria-checked='true'] .dsh-nm-switch-knob {\n  transform: translateX(16px);\n}\n\n.dsh-nm-settings-footer {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  min-height: 18px;\n}\n\n.dsh-nm-settings-status {\n  color: var(--dsw-alias-label-caption);\n  font-size: 12px;\n}\n\n.dsh-nm-settings-note {\n  margin: 0;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12.5px;\n  line-height: 19px;\n}\n"
const LOCALES = {"en":{"title":"Next message","description":"When the session is idle and the composer is empty, predicts what you are likely to send next. Press Tab to fill the draft; nothing is sent automatically.","enabled":"Enable prediction","enabledHint":"Show one suggestion in the empty composer after each completed turn.","model":"Prediction model","modelHint":"Follows the model of the current session by default. Pin a faster, cheaper route if you prefer.","follow":"Follow the current session","placement":"Placement","placementInline":"Inside the composer (grey ghost text)","placementBelow":"Below the composer (a suggestion bar)","saved":"Saved","saveFailed":"Could not save. Try again.","loading":"Reading configuration…","unavailable":"Configuration is unavailable. Check that the plugin is enabled and DSH finished loading.","readOnly":"This configuration is read-only.","suggestion":"Prediction"},"zh":{"title":"下一条消息推测","description":"空闲且输入框为空时，根据对话推测你接下来可能发送的消息。按 Tab 填入草稿，不会自动发送。","enabled":"启用推测","enabledHint":"每个回合结束后，在空输入框里显示一条建议。","model":"推测模型","modelHint":"默认跟随当前会话使用的模型；也可以固定成一个更快、更便宜的模型。","follow":"跟随当前会话","placement":"显示位置","placementInline":"输入框内（灰色 ghost 文字）","placementBelow":"输入框下方（一条建议栏）","saved":"已保存","saveFailed":"保存失败，请重试","loading":"正在读取配置…","unavailable":"配置暂不可用，确认插件已启用且 DSH 已完成加载。","readOnly":"当前配置不可写。","suggestion":"预测"}}

/**
 * Build the browser module exports.
 * @param {(id: string) => any} require - module table accessor.
 * @returns {{ inject: string[], apply: (ctx: any) => void }} the module.
 */
function create(require) {
  const React = require('react')
  const h = React.createElement
  const { useEffect, useLayoutEffect, useRef, useState } = React

  const NS = 'next-message'
  const ENTRY_ID = 'next-message'
  const BUNDLE = 'dsh-next-message'
  const PREDICT_PATH = 'api/next-message/predict'
  const MODELS_PATH = 'api/next-message/models'
  const CARD = '[data-composer-card]'
  const PLACEHOLDER = '[data-composer-placeholder]'
  const SCROLL = '[data-input-scroll]'

  const IDLE = Object.freeze({ status: 'idle', text: '' })

  /** Per-session predictions shared by the inline and below views. */
  const predictions = new Map()
  const predictionListeners = new Set()

  /**
   * @param {string} sessionId - session identity.
   * @returns {{ status: 'idle' | 'loading' | 'ready', text: string }} current prediction.
   */
  function predictionOf(sessionId) {
    return predictions.get(sessionId) ?? IDLE
  }

  /**
   * Publish one prediction change to every mounted view.
   * @param {string} sessionId - session identity.
   * @param {{ status: 'idle' | 'loading' | 'ready', text: string }} next - replacement.
   */
  function publishPrediction(sessionId, next) {
    const previous = predictionOf(sessionId)
    if (previous.status === next.status && previous.text === next.text) return
    if (next.status === 'idle' && next.text === '') predictions.delete(sessionId)
    else predictions.set(sessionId, next)
    for (const listener of [...predictionListeners]) {
      try {
        listener(sessionId)
      } catch (_error) {
        // A throwing view must not strand the other subscribers.
      }
    }
  }

  /**
   * @param {(sessionId: string) => void} listener - change listener.
   * @returns {() => void} the disposer.
   */
  function subscribePredictions(listener) {
    predictionListeners.add(listener)
    return () => { predictionListeners.delete(listener) }
  }

  /**
   * Subscribe to one session's prediction.
   * @param {string} sessionId - session identity.
   * @returns {{ status: 'idle' | 'loading' | 'ready', text: string }} current prediction.
   */
  function usePrediction(sessionId) {
    const [state, setState] = useState(() => predictionOf(sessionId))
    useEffect(() => {
      setState(predictionOf(sessionId))
      return subscribePredictions((changed) => {
        if (changed === sessionId) setState(predictionOf(sessionId))
      })
    }, [sessionId])
    return state
  }

  /**
   * Follow one live configuration form.
   * @param {any} form - config form controller.
   * @returns {any} the latest snapshot.
   */
  function useConfigForm(form) {
    const [snapshot, setSnapshot] = useState(() => form.getSnapshot())
    useEffect(() => {
      setSnapshot(form.getSnapshot())
      return form.subscribe(() => setSnapshot(form.getSnapshot()))
    }, [form])
    return snapshot
  }

  /**
   * @param {any} snapshot - configuration snapshot.
   * @returns {{ enabled: boolean, placement: 'inline' | 'below' }} presentation facts.
   */
  function presentationOf(snapshot) {
    const value = snapshot?.value ?? {}
    return {
      enabled: value.enabled !== false,
      placement: value.placement === 'below' ? 'below' : 'inline',
    }
  }

  /** Touch devices have no Tab key; the suggestion would be dead weight. */
  function coarsePointer() {
    try {
      return window.matchMedia('(pointer: coarse)').matches
    } catch (_error) {
      return false
    }
  }

  /**
   * Focus the editor inside one composer card.
   * @param {Element | null | undefined} card - composer card.
   */
  function focusEditor(card) {
    const editor = card?.querySelector('[contenteditable="true"]')
    if (editor instanceof HTMLElement) editor.focus()
  }

  /**
   * Inline ghost text and the request lifecycle.
   * @param {any} props - slot props.
   * @returns {any} the slot content.
   */
  function InlineSuggestion(props) {
    const { sessionId, useSession, useInput, inputActions, form } = props
    const snapshot = useConfigForm(form)
    const settings = presentationOf(snapshot)
    const running = useSession(state => state.running === true)
    const blank = useSession(state => state.blank === true)
    const subagent = useSession(state => state.subagent !== null)
    const draft = useInput(state => state.draft)
    const phase = useInput(state => state.phase)
    const attachments = useInput(state => state.attachmentIds.length)
    const prediction = usePrediction(sessionId)
    const anchor = useRef(null)
    const armed = useRef(true)
    const sessionRef = useRef(sessionId)
    const latestDraft = useRef(draft)
    latestDraft.current = draft
    const [rect, setRect] = useState(null)

    useEffect(() => {
      if (sessionRef.current === sessionId) return
      sessionRef.current = sessionId
      armed.current = true
      setRect(null)
    }, [sessionId])

    useEffect(() => {
      if (running) armed.current = true
      const blocked = !settings.enabled || running || blank || subagent
        || draft !== '' || attachments > 0 || phase !== 'plain' || coarsePointer()
      if (blocked) {
        publishPrediction(sessionId, IDLE)
        return undefined
      }
      if (!armed.current) return undefined
      let cancelled = false
      const controller = new AbortController()
      const timer = setTimeout(() => {
        armed.current = false
        publishPrediction(sessionId, { status: 'loading', text: '' })
        void (async () => {
          try {
            const response = await fetch(PREDICT_PATH, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ sessionId }),
              signal: controller.signal,
            })
            if (cancelled) return
            if (!response.ok) {
              publishPrediction(sessionId, IDLE)
              return
            }
            const body = await response.json().catch(() => null)
            if (cancelled) return
            const text = typeof body?.text === 'string' ? body.text.trim() : ''
            publishPrediction(sessionId, text === '' ? IDLE : { status: 'ready', text })
          } catch (_error) {
            if (!cancelled) publishPrediction(sessionId, IDLE)
          }
        })()
      }, 600)
      return () => {
        cancelled = true
        clearTimeout(timer)
        controller.abort()
      }
    }, [settings.enabled, running, blank, subagent, draft, attachments, phase, sessionId])

    useLayoutEffect(() => {
      if (prediction.status !== 'ready') {
        setRect(null)
        return undefined
      }
      const root = anchor.current
      const card = root?.closest(CARD)
      if (card === null || card === undefined) {
        setRect(null)
        return undefined
      }
      const measure = () => {
        const placeholder = card.querySelector(PLACEHOLDER)
        if (placeholder === null) {
          setRect(null)
          return
        }
        const line = placeholder.getBoundingClientRect()
        const frame = card.getBoundingClientRect()
        if (line.width <= 0 || frame.width <= 0) {
          setRect(null)
          return
        }
        setRect({
          top: line.top - frame.top,
          left: line.left - frame.left,
          width: line.width,
          height: line.height,
        })
      }
      measure()
      const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
      observer?.observe(card)
      window.addEventListener('resize', measure)
      return () => {
        observer?.disconnect()
        window.removeEventListener('resize', measure)
      }
    }, [prediction.status, prediction.text, sessionId])

    useEffect(() => {
      if (prediction.status !== 'ready') return undefined
      const root = anchor.current
      const card = root?.closest(CARD)
      if (card === null || card === undefined) return undefined
      const onKeyDown = (event) => {
        if (event.defaultPrevented || event.isComposing) return
        if (event.key === 'Escape') {
          armed.current = false
          publishPrediction(sessionId, IDLE)
          return
        }
        if (event.key !== 'Tab' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
        if (latestDraft.current !== '') return
        const active = document.activeElement
        if (!(active instanceof Element) || active.closest(SCROLL) === null) return
        const current = predictionOf(sessionId)
        if (current.status !== 'ready' || current.text === '') return
        event.preventDefault()
        const span = inputActions.captureInsertion()
        if (!inputActions.insertText(current.text, span)) return
        armed.current = false
        publishPrediction(sessionId, IDLE)
      }
      card.addEventListener('keydown', onKeyDown)
      return () => { card.removeEventListener('keydown', onKeyDown) }
    }, [prediction.status, prediction.text, sessionId, inputActions])

    const visible = settings.enabled && settings.placement === 'inline'
      && prediction.status === 'ready' && rect !== null

    return h('span', { ref: anchor, className: 'dsh-nm-anchor' },
      visible
        ? h('div', {
          className: 'dsh-nm-ghost',
          style: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          'aria-hidden': 'true',
        },
        h('span', { className: 'dsh-nm-ghost-text' }, prediction.text),
        h('kbd', { className: 'dsh-nm-key' }, 'Tab'))
        : null)
  }

  /**
   * Optional suggestion bar under the composer.
   * @param {any} props - slot props.
   * @returns {any} the slot content.
   */
  function BelowSuggestion(props) {
    const { sessionId, inputActions, form, t } = props
    const snapshot = useConfigForm(form)
    const settings = presentationOf(snapshot)
    const prediction = usePrediction(sessionId)
    if (!settings.enabled || settings.placement !== 'below' || prediction.status !== 'ready') return null
    const accept = (event) => {
      event.preventDefault()
      const dock = event.currentTarget.closest('[data-composer-dock]')
      const card = dock?.parentElement?.querySelector(CARD) ?? null
      inputActions.setDraft(prediction.text)
      focusEditor(card)
      publishPrediction(sessionId, IDLE)
    }
    return h('div', { className: 'dsh-nm-bar' },
      h('span', { className: 'dsh-nm-bar-label' }, t('suggestion')),
      h('span', { className: 'dsh-nm-bar-text' }, prediction.text),
      h('button', { type: 'button', className: 'dsh-nm-key dsh-nm-key-button', onMouseDown: accept }, 'Tab'))
  }

  /**
   * Bundle settings page.
   * @param {any} props - slot props.
   * @returns {any} the page content.
   */
  function SettingsPage(props) {
    const { form, t } = props
    const snapshot = useConfigForm(form)
    const value = snapshot.value ?? {}
    const writable = snapshot.writable !== false
    const disabled = !writable || snapshot.status !== 'ready'
    const [catalog, setCatalog] = useState(null)
    const [busy, setBusy] = useState(false)
    const [notice, setNotice] = useState('')

    useEffect(() => {
      let cancelled = false
      fetch(MODELS_PATH)
        .then(response => (response.ok ? response.json() : null))
        .then((body) => {
          if (cancelled) return
          setCatalog(Array.isArray(body?.providers) ? body.providers : [])
        })
        .catch(() => { if (!cancelled) setCatalog([]) })
      return () => { cancelled = true }
    }, [])

    const save = async (operation) => {
      setBusy(true)
      setNotice('')
      try {
        const accepted = await operation()
        setNotice(accepted ? t('saved') : t('saveFailed'))
      } catch (_error) {
        setNotice(t('saveFailed'))
      } finally {
        setBusy(false)
      }
    }

    if (snapshot.status === 'loading') {
      return h('p', { className: 'dsh-nm-settings-note' }, t('loading'))
    }
    if (snapshot.status === 'unavailable') {
      return h('p', { className: 'dsh-nm-settings-note' }, t('unavailable'))
    }

    const providers = (Array.isArray(catalog) ? catalog : [])
      .filter(provider => Array.isArray(provider.models) && provider.models.length > 0)
    const pairOf = (provider, model) => JSON.stringify([provider, model])
    const configuredPair = value.provider !== undefined && value.model !== undefined
      && value.provider !== '' && value.model !== ''
      ? pairOf(value.provider, value.model)
      : ''
    const known = configuredPair === '' || providers.some(provider =>
      provider.models.some(model => pairOf(provider.id, model.id) === configuredPair))

    const onModel = (event) => {
      const raw = event.target.value
      const pair = raw === '' ? ['', ''] : JSON.parse(raw)
      void save(() => form.mutate([
        { op: 'set', path: ['provider'], value: pair[0] },
        { op: 'set', path: ['model'], value: pair[1] },
      ]))
    }

    const modelOptions = providers.map(provider => h('optgroup', {
      key: provider.id,
      label: provider.name ?? provider.id,
    }, provider.models.map(model => h('option', {
      key: `${provider.id}/${model.id}`,
      value: pairOf(provider.id, model.id),
    }, model.name ?? model.id))))

    if (!known) {
      modelOptions.push(h('option', {
        key: 'configured',
        value: configuredPair,
      }, `${value.provider} · ${value.model}`))
    }

    return h('div', { className: 'dsh-nm-settings' },
      h('p', { className: 'dsh-nm-settings-desc' }, t('description')),

      h('div', { className: 'dsh-nm-row' },
        h('div', { className: 'dsh-nm-row-text' },
          h('div', { className: 'dsh-nm-row-label' }, t('enabled')),
          h('div', { className: 'dsh-nm-row-hint' }, t('enabledHint'))),
        h('button', {
          type: 'button',
          role: 'switch',
          'aria-label': t('enabled'),
          'aria-checked': value.enabled !== false,
          className: 'dsh-nm-switch',
          disabled: disabled || busy,
          onClick: () => { void save(() => form.set('enabled', value.enabled === false)) },
        }, h('span', { className: 'dsh-nm-switch-knob' }))),

      h('div', { className: 'dsh-nm-row' },
        h('div', { className: 'dsh-nm-row-text' },
          h('div', { className: 'dsh-nm-row-label' }, t('model')),
          h('div', { className: 'dsh-nm-row-hint' }, t('modelHint'))),
        h('select', {
          className: 'dsh-nm-select',
          'aria-label': t('model'),
          value: configuredPair,
          disabled: disabled || busy,
          onChange: onModel,
        },
        h('option', { value: '' }, t('follow')),
        ...modelOptions)),

      h('div', { className: 'dsh-nm-row' },
        h('div', { className: 'dsh-nm-row-text' },
          h('div', { className: 'dsh-nm-row-label' }, t('placement'))),
        h('select', {
          className: 'dsh-nm-select',
          'aria-label': t('placement'),
          value: value.placement === 'below' ? 'below' : 'inline',
          disabled: disabled || busy,
          onChange: (event) => {
            void save(() => form.set('placement', event.target.value))
          },
        },
        h('option', { value: 'inline' }, t('placementInline')),
        h('option', { value: 'below' }, t('placementBelow')))),

      h('div', { className: 'dsh-nm-settings-footer' },
        !writable ? h('span', { className: 'dsh-nm-settings-status' }, t('readOnly')) : null,
        notice === '' ? null : h('span', { className: 'dsh-nm-settings-status', role: 'status' }, notice)))
  }

  /**
   * Mount styles, dictionaries, and the three slot entries.
   * @param {any} ctx - Client plugin context.
   */
  function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, LOCALES), 'next-message: dictionaries')
    ctx.effect(() => {
      const tag = document.createElement('style')
      tag.dataset.plugin = BUNDLE
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => { tag.remove() }
    }, 'next-message: styles')

    const form = ctx.configForms.get(ENTRY_ID)
    const injected = () => ({ form })

    ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({
      name: 'conversation.input.overlay',
      id: 'next-message',
      order: 20,
      locale: NS,
      inject: injected,
    }, InlineSuggestion))

    ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
      name: 'conversation.composer.dock',
      id: 'next-message-below',
      order: 20,
      locale: NS,
      inject: injected,
    }, BelowSuggestion))

    ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
      name: 'plugins.bundle.config',
      key: BUNDLE,
      locale: NS,
      inject: injected,
    }, SettingsPage))
  }

  return {
    inject: ['slots', 'locale', 'configForms'],
    apply,
  }
}

		return create(require)
	}
});
