/**
 * Pure prediction helpers: history selection, prompt construction, output
 * cleaning, and model-route resolution. No DSH or Node imports, so the
 * module is unit-testable outside the Harness.
 */

/**
 * Instruction sent as the auxiliary request's system prompt. The two examples
 * anchor the user's voice: short, imperative, grounded in the assistant's
 * last message.
 */
export const SYSTEM_PROMPT = [
  'You predict the user\'s next message in a chat with a coding assistant.',
  'Read the conversation and output the single message the user is most likely to type next.',
  '',
  'Rules:',
  '- Output only that message, exactly as the user would type it.',
  '- One line, at most about 12 words (30 CJK characters).',
  '- Use the language of the user\'s most recent message.',
  '- Prefer a concrete next action grounded in the assistant\'s last message.',
  '- Do not explain, quote, number, prefix, or use markdown.',
  '- Never start with "/" or "@".',
  '- If no clear next step exists, output nothing.',
  '',
  'Examples:',
  'Conversation:',
  'User: 把 auth 的测试修一下',
  'Assistant: I fixed the failing test in auth.spec.ts and the whole suite passes now.',
  'Next user message: 提交一下，然后开个 PR',
  '',
  'Conversation:',
  'User: build 挂了',
  'Assistant: The build fails because src/index.ts imports a missing module.',
  'Next user message: fix the import and re-run the build',
].join('\n')

/** Default history and output policy used when a caller omits one. */
export const HISTORY_DEFAULTS = Object.freeze({
  historyMessages: 10,
  maxInputChars: 5000,
  perMessageChars: 1600,
})

/**
 * Text blocks of one model message, joined in block order.
 * @param {{ content?: readonly { type?: string, text?: string }[] }} message - model message.
 * @returns the visible text; tool calls, reasoning, and images contribute nothing.
 */
export function textOf(message) {
  if (message === null || typeof message !== 'object' || !Array.isArray(message.content)) return ''
  let text = ''
  for (const block of message.content) {
    if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
      text += block.text
    }
  }
  return text
}

/**
 * Keep recent genuine conversation messages: human user turns and assistant
 * text. Injected user-role context, tool results, and reasoning are skipped.
 * @param {readonly object[]} messages - derived session messages in log order.
 * @param {{ historyMessages?: number, maxInputChars?: number, perMessageChars?: number }} [options] - bounds.
 * @returns {{ role: 'user' | 'assistant', text: string }[]} oldest first.
 */
export function selectHistory(messages, options = {}) {
  const historyMessages = options.historyMessages ?? HISTORY_DEFAULTS.historyMessages
  const maxInputChars = options.maxInputChars ?? HISTORY_DEFAULTS.maxInputChars
  const perMessageChars = options.perMessageChars ?? HISTORY_DEFAULTS.perMessageChars
  if (!Array.isArray(messages)) return []

  const candidates = []
  for (const message of messages) {
    if (message === null || typeof message !== 'object') continue
    if (message.role === 'user') {
      if (message.source?.kind !== 'user') continue
    } else if (message.role !== 'assistant') {
      continue
    }
    const text = textOf(message).trim()
    if (text === '') continue
    candidates.push({ role: message.role, text })
  }

  const recent = candidates.slice(-historyMessages)
  const kept = []
  let total = 0
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const item = recent[index]
    let text = item.text
    if (text.length > perMessageChars) text = `${text.slice(0, perMessageChars - 1)}…`
    const room = maxInputChars - total
    if (room <= 0) break
    if (text.length > room) {
      if (kept.length === 0) {
        kept.unshift({ role: item.role, text: `${text.slice(0, Math.max(0, room - 1))}…` })
      }
      break
    }
    kept.unshift({ role: item.role, text })
    total += text.length
  }
  return kept
}

/**
 * Render the conversation for the predictor model.
 * @param {readonly { role: 'user' | 'assistant', text: string }[]} history - selected messages, oldest first.
 * @returns the user-input text of the auxiliary request.
 */
export function buildPrompt(history) {
  const lines = history.map(message => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.text}`)
  return [
    'Conversation:',
    lines.join('\n\n'),
    '',
    'Predict the user\'s next message. Output only the message text.',
  ].join('\n')
}

/**
 * Turn a model reply into one insertable line.
 * @param {string} raw - model output.
 * @param {number} [maxChars] - longest accepted prediction.
 * @returns {string | null} the cleaned message, or null when nothing usable remains.
 */
export function cleanPrediction(raw, maxChars = 160) {
  if (typeof raw !== 'string') return null
  let text = raw.trim()
  if (text === '') return null
  text = text.split(/\r?\n/).map(line => line.trim()).find(line => line !== '') ?? ''
  text = text.replace(/^(?:user|you|用户)\s*[:：]\s*/i, '')
  text = text.replace(/^[`"'“”‘’]+/, '').replace(/[`"'“”‘’]+$/, '')
  text = text.replace(/\s+/g, ' ').trim()
  if (text === '' || text.length > maxChars) return null
  // A leading command or reference token would change the composer's mode.
  if (/^[/@]/.test(text)) return null
  return text
}

/**
 * Choose the prediction route: the plugin's explicit pair, else the exact
 * route of the session's latest logged request.
 * @param {{ provider?: string, model?: string }} configured - live plugin configuration.
 * @param {{ provider?: string, model?: string } | undefined} sessionRoute - latest request header config.
 * @returns {{ provider: string, model: string } | null} the route, or null when none is known.
 */
export function resolveRoute(configured, sessionRoute) {
  const provider = typeof configured?.provider === 'string' ? configured.provider.trim() : ''
  const model = typeof configured?.model === 'string' ? configured.model.trim() : ''
  if (provider !== '' && model !== '') return { provider, model }
  if (provider !== '' || model !== '') return null
  const fallbackProvider = typeof sessionRoute?.provider === 'string' ? sessionRoute.provider.trim() : ''
  const fallbackModel = typeof sessionRoute?.model === 'string' ? sessionRoute.model.trim() : ''
  if (fallbackProvider === '' || fallbackModel === '') return null
  return { provider: fallbackProvider, model: fallbackModel }
}
