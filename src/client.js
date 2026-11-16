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
const CSS = __NM_CSS__
const LOCALES = __NM_LOCALES__

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
  const MOBILE_KEY = 'dsh-next-message:mobile-enabled'

  const IDLE = Object.freeze({ status: 'idle', text: '', dismissed: false })

  /** Per-session predictions shared by the inline and below views. */
  const predictions = new Map()
  const predictionListeners = new Set()

  /**
   * @param {string} sessionId - session identity.
   * @returns {{ status: 'idle' | 'loading' | 'ready', text: string, dismissed: boolean }} current prediction.
   */
  function predictionOf(sessionId) {
    return predictions.get(sessionId) ?? IDLE
  }

  /**
   * Publish one prediction change to every mounted view.
   * @param {string} sessionId - session identity.
   * @param {{ status: 'idle' | 'loading' | 'ready', text: string, dismissed: boolean }} next - replacement.
   */
  function publishPrediction(sessionId, next) {
    const previous = predictionOf(sessionId)
    if (previous.status === next.status && previous.text === next.text && previous.dismissed === next.dismissed) return
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
   * @returns {{ status: 'idle' | 'loading' | 'ready', text: string, dismissed: boolean }} current prediction.
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

  /** Whether this device opted into predictions; persisted per browser origin. */
  function readMobileEnabled() {
    try {
      const raw = window.localStorage.getItem(MOBILE_KEY)
      return raw === '1'
    } catch (_error) {
      return false
    }
  }

  let mobileEnabled = readMobileEnabled()
  const mobileListeners = new Set()

  /**
   * Persist the per-device mobile preference and notify every mounted view.
   * @param {boolean} value - whether mobile predictions are on.
   */
  function setMobileEnabled(value) {
    const next = value === true
    if (next === mobileEnabled) return
    mobileEnabled = next
    try {
      window.localStorage.setItem(MOBILE_KEY, next ? '1' : '0')
    } catch (_error) {
      // Storage can be unavailable in private or embedded webviews.
    }
    for (const listener of [...mobileListeners]) {
      try {
        listener()
      } catch (_error) {
        // One failing view must not strand the others.
      }
    }
  }

  /**
   * Subscribe to the per-device mobile preference.
   * @returns {boolean} whether mobile predictions are on.
   */
  function useMobileEnabled() {
    const [value, setValue] = useState(mobileEnabled)
    useEffect(() => {
      setValue(mobileEnabled)
      const listener = () => setValue(mobileEnabled)
      mobileListeners.add(listener)
      return () => { mobileListeners.delete(listener) }
    }, [])
    return value
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
    if (editor instanceof HTMLElement) editor.focus({ preventScroll: true })
  }

  /**
   * Find the composer card that owns a bar, whether the bar sits above the card
   * (mobile input dock) or below it (desktop composer dock).
   * @param {Element | null | undefined} element - bar element.
   * @returns {Element | null} the nearest enclosing composer card.
   */
  function findComposerCard(element) {
    let node = element
    while (node !== null && node !== undefined) {
      if (typeof node.querySelector === 'function') {
        const card = node.querySelector(CARD)
        if (card !== null) return card
      }
      node = node.parentElement
    }
    return null
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
    const mobileEnabled = useMobileEnabled()
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

    // Enabling mobile predictions should ask once without waiting for the next
    // turn when no usable suggestion is cached already.
    useEffect(() => {
      if (!coarsePointer() || !mobileEnabled) return
      const current = predictionOf(sessionId)
      if (current.status === 'ready' && !current.dismissed) return
      armed.current = true
    }, [mobileEnabled, sessionId])

    useEffect(() => {
      if (running) {
        armed.current = true
        publishPrediction(sessionId, IDLE)
        return undefined
      }
      const blocked = !settings.enabled || blank || subagent
        || (coarsePointer() && !mobileEnabled)
        || draft !== '' || attachments > 0 || phase !== 'plain'
      if (blocked) {
        // Typing during an in-flight request aborts it; let the next free,
        // empty composer ask again instead of leaving a loading placeholder.
        if (predictionOf(sessionId).status === 'loading') {
          armed.current = true
          publishPrediction(sessionId, IDLE)
        }
        if (!settings.enabled || blank || subagent || (coarsePointer() && !mobileEnabled)) {
          publishPrediction(sessionId, IDLE)
        }
        return undefined
      }
      if (!armed.current) return undefined
      let cancelled = false
      const controller = new AbortController()
      const timer = setTimeout(() => {
        armed.current = false
        publishPrediction(sessionId, { status: 'loading', text: '', dismissed: false })
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
            publishPrediction(sessionId, text === '' ? IDLE : { status: 'ready', text, dismissed: false })
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
    }, [settings.enabled, running, blank, subagent, mobileEnabled, draft, attachments, phase, sessionId])

    useLayoutEffect(() => {
      if (prediction.status !== 'ready' || prediction.dismissed
        || draft !== '' || attachments > 0 || phase !== 'plain') {
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
    }, [prediction.status, prediction.text, prediction.dismissed, draft, attachments, phase, sessionId])

    // DSH may leave focus on the send/stop button (or the body) after a turn.
    // Put the caret back in the editor when the suggestion appears, but never
    // take focus away from the transcript, another editable control, or a
    // panel the user moved to.
    useEffect(() => {
      if (coarsePointer() || prediction.status !== 'ready' || prediction.dismissed) return
      const card = anchor.current?.closest(CARD)
      if (card === null || card === undefined) return
      const active = document.activeElement
      const editable = active instanceof HTMLElement
        && (active.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName))
      if (editable) return
      if (active !== null && active !== document.body && !(active instanceof Element && card.contains(active))) return
      focusEditor(card)
    }, [prediction.status, prediction.dismissed, sessionId])

    useEffect(() => {
      if (prediction.status !== 'ready' || prediction.dismissed) return undefined
      const root = anchor.current
      const card = root?.closest(CARD)
      if (card === null || card === undefined) return undefined
      const onKeyDown = (event) => {
        if (event.defaultPrevented || event.isComposing) return
        if (event.key === 'Escape') {
          // Only the visible suggestion is dismissible; Escape in a non-empty
          // draft belongs to the host (menus, stopping, clearing a draft).
          if (latestDraft.current !== '') return
          const current = predictionOf(sessionId)
          if (current.status !== 'ready' || current.dismissed) return
          armed.current = false
          publishPrediction(sessionId, {
            status: 'ready',
            text: current.text,
            dismissed: true,
          })
          return
        }
        if (event.key !== 'Tab' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
        if (latestDraft.current !== '') return
        const active = document.activeElement
        if (!(active instanceof Element) || active.closest(SCROLL) === null) return
        const current = predictionOf(sessionId)
        if (current.status !== 'ready' || current.text === '' || current.dismissed) return
        event.preventDefault()
        const span = inputActions.captureInsertion()
        if (!inputActions.insertText(current.text, span)) return
        // Tab fills the draft but does not consume the suggestion: deleting the
        // text brings the same cached suggestion back until the next turn.
        armed.current = false
      }
      card.addEventListener('keydown', onKeyDown)
      return () => { card.removeEventListener('keydown', onKeyDown) }
    }, [prediction.status, prediction.text, prediction.dismissed, sessionId, inputActions])

    const visible = settings.enabled && !coarsePointer() && settings.placement === 'inline'
      && prediction.status === 'ready' && !prediction.dismissed
      && draft === '' && attachments === 0 && phase === 'plain'
      && rect !== null

    return h('span', { ref: anchor, className: 'dsh-nm-anchor' },
      visible
        ? h('div', {
          className: 'dsh-nm-ghost',
          style: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          'aria-hidden': 'true',
          // The ghost sits over the editor's placeholder line. A click focuses
          // the editor instead of landing on the overlay, so the caret appears
          // and the draft stays editable while the suggestion is shown.
          onMouseDown: (event) => {
            event.preventDefault()
            focusEditor(event.currentTarget.closest(CARD))
          },
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
    const { sessionId, useInput, inputActions, form, surface = 'dock', t } = props
    const snapshot = useConfigForm(form)
    const settings = presentationOf(snapshot)
    const prediction = usePrediction(sessionId)
    const mobileEnabled = useMobileEnabled()
    const touch = coarsePointer()
    const draft = useInput(state => state.draft)
    const phase = useInput(state => state.phase)
    const attachments = useInput(state => state.attachmentIds.length)
    if (surface === 'input') {
      if (!touch || !mobileEnabled) return null
    } else if (touch) {
      return null
    }
    if (!settings.enabled || prediction.status !== 'ready') return null
    if (surface === 'dock' && settings.placement !== 'below') return null
    if (prediction.dismissed || draft !== '' || phase !== 'plain' || attachments > 0) return null
    const accept = (event) => {
      inputActions.setDraft(prediction.text)
      focusEditor(findComposerCard(event.currentTarget))
    }
    const dismiss = () => {
      publishPrediction(sessionId, {
        status: 'ready',
        text: prediction.text,
        dismissed: true,
      })
    }
    return h('div', { className: surface === 'input' ? 'dsh-nm-bar dsh-nm-bar-mobile' : 'dsh-nm-bar' },
      h('span', { className: 'dsh-nm-bar-label' }, t('suggestion')),
      h('button', { type: 'button', className: 'dsh-nm-bar-text', onClick: accept }, prediction.text),
      h('span', { className: 'dsh-nm-bar-actions' },
        h('button', {
          type: 'button',
          className: 'dsh-nm-key dsh-nm-key-button',
          onClick: accept,
        }, touch ? t('fill') : 'Tab'),
        touch
          ? h('button', {
            type: 'button',
            className: 'dsh-nm-bar-close',
            'aria-label': t('dismiss'),
            onClick: dismiss,
          }, '×')
          : null))
  }

  /**
   * Composer-toolbar toggle for phone and tablet layouts. Hidden on desktop.
   * The preference is per browser origin, so the phone can differ from desktop.
   * @param {any} props - slot props.
   * @returns {any} the slot content.
   */
  function MobileToggle(props) {
    const { sessionId, form, t } = props
    const snapshot = useConfigForm(form)
    const settings = presentationOf(snapshot)
    const mobileEnabled = useMobileEnabled()
    const prediction = usePrediction(sessionId)
    if (!coarsePointer() || !settings.enabled) return null
    const busy = mobileEnabled && prediction.status === 'loading'
    const label = busy
      ? t('mobilePredicting')
      : t(mobileEnabled ? 'mobileToggleOn' : 'mobileToggleOff')
    const toggle = () => {
      const next = !mobileEnabled
      setMobileEnabled(next)
      if (!next) publishPrediction(sessionId, IDLE)
    }
    return h('button', {
      type: 'button',
      className: 'dsh-nm-mobile-toggle',
      'aria-label': label,
      'aria-pressed': mobileEnabled,
      title: label,
      onClick: toggle,
    },
    h('svg', { viewBox: '0 0 16 16', width: 13, height: 13, 'aria-hidden': true },
      h('path', {
        d: 'M8 1.6 9.55 6.45 14.4 8 9.55 9.55 8 14.4 6.45 9.55 1.6 8 6.45 6.45Z',
        fill: 'currentColor',
      })),
    h('span', { className: 'dsh-nm-mobile-toggle-text' }, label))
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

    const currentPlacement = value.placement === 'below' ? 'below' : 'inline'
    const row = (label, control) => h('div', { className: 'dsh-nm-row' },
      h('div', { className: 'dsh-nm-row-label' }, label),
      control)

    return h('div', { className: 'dsh-nm-settings' },
      row(t('enabled'),
        h('button', {
          type: 'button',
          role: 'switch',
          'aria-label': t('enabled'),
          'aria-checked': value.enabled !== false,
          className: 'dsh-nm-switch',
          disabled: disabled || busy,
          onClick: () => { void save(() => form.set('enabled', value.enabled === false)) },
        }, h('span', { className: 'dsh-nm-switch-knob' }))),

      row(t('model'),
        h('select', {
          className: 'dsh-nm-select',
          'aria-label': t('model'),
          value: configuredPair,
          disabled: disabled || busy,
          onChange: onModel,
        },
        h('option', { value: '' }, t('follow')),
        ...modelOptions)),

      row(t('placement'),
        h('div', { className: 'dsh-nm-segmented', role: 'group', 'aria-label': t('placement') },
          ['inline', 'below'].map(option => h('button', {
            key: option,
            type: 'button',
            className: 'dsh-nm-segment',
            'aria-pressed': currentPlacement === option,
            disabled: disabled || busy,
            onClick: () => { void save(() => form.set('placement', option)) },
          }, t(option === 'inline' ? 'placementInline' : 'placementBelow'))))),

      writable && notice === '' ? null : h('div', { className: 'dsh-nm-settings-footer' },
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
      inject: () => ({ form, surface: 'dock' }),
    }, BelowSuggestion))

    ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
      name: 'conversation.input.dock',
      id: 'next-message-mobile-bar',
      order: 10,
      locale: NS,
      inject: () => ({ form, surface: 'input' }),
    }, BelowSuggestion))

    ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
      name: 'conversation.input.right',
      id: 'next-message-mobile-toggle',
      order: 10,
      locale: NS,
      inject: injected,
    }, MobileToggle))

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
