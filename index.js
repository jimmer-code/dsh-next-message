/**
 * Host half of dsh-next-message.
 *
 * Two authenticated routes inside the Connection fence:
 *   POST /api/next-message/predict  - read the session, ask the configured
 *                                     model for the likely next user message
 *   GET  /api/next-message/models   - provider/model catalog for the settings page
 *
 * The plugin never appends to the session log and never sends a message. It
 * only returns one line of text; the browser draws it and fills the draft on Tab.
 */
import z from '@deepseek-ai/schemastery'
import {
  SYSTEM_PROMPT,
  buildPrompt,
  cleanPrediction,
  resolveRoute,
  selectHistory,
} from './src/core.js'

export const inject = ['connection', 'sessions', 'llm']

/** Live settings plus the static prediction bounds. */
export const Config = z.object({
  /** Guess the next message while the composer is idle and empty. */
  enabled: z.boolean().default(true).volatile(),
  /** Explicit provider route; empty follows the session's latest request. */
  provider: z.string().default('').volatile(),
  /** Explicit model id; empty follows the session's latest request. */
  model: z.string().default('').volatile(),
  /** Where the suggestion renders: inside the composer or as a bar below it. */
  placement: z.union(['inline', 'below']).default('inline').volatile(),
  /** Output-token cap; a prediction is one short line. */
  maxOutputTokens: z.number().step(1).min(1).max(4096).default(96),
  /** End-to-end deadline for the auxiliary request. */
  timeoutMs: z.number().step(1).min(100).max(60000).default(8000),
  /** How many recent messages enter the prompt. */
  historyMessages: z.number().step(1).min(1).max(50).default(10),
  /** UTF-16 ceiling for the rendered conversation. */
  maxInputChars: z.number().step(1).min(200).max(20000).default(5000),
  /** Longest accepted prediction. */
  maxPredictionChars: z.number().step(1).min(10).max(500).default(160),
})

const PREDICT_PATH = '/api/next-message/predict'
const MODELS_PATH = '/api/next-message/models'
const CACHE_TTL_MS = 120_000
const CACHE_LIMIT = 200
const CATALOG_TTL_MS = 60_000
const NO_STORE = { 'cache-control': 'no-store' }

/**
 * Answer with JSON that the browser never caches.
 * @param {unknown} value - JSON-compatible payload.
 * @param {number} [status] - HTTP status.
 * @returns {Response} the response.
 */
function reply(value, status = 200) {
  return Response.json(value, { status, headers: NO_STORE })
}

/** Prefer the model's least reasoning effort; leave defaults when it exposes none. */
function leastEffort(controls, model) {
  const effort = model?.reasoning?.efforts?.[0]?.id
  return effort === undefined ? controls : { ...controls, reasoningEffort: effort }
}

/**
 * Produce one prediction for a live session.
 * @param {object} ctx - Host context.
 * @param {object} config - validated live plugin configuration.
 * @param {string} sessionId - addressed session.
 * @param {AbortSignal} signal - request cancellation.
 * @param {Map<string, { seq: number, at: number, text: string }>} cache - per-route cache.
 * @returns {Promise<string | null>} the prediction or null.
 */
async function predict(ctx, config, sessionId, signal, cache) {
  if (config.enabled.get() !== true) return null
  const session = ctx.sessions.get(sessionId)
  if (session === undefined) return null

  const history = selectHistory(session.deriveMessages(), {
    historyMessages: config.historyMessages,
    maxInputChars: config.maxInputChars,
  })
  // A prediction follows an assistant reply; anything else is not a next-message state.
  if (history.length === 0 || history[history.length - 1].role !== 'assistant') return null

  const header = session.requestHeader()
  const route = resolveRoute(
    { provider: config.provider.get(), model: config.model.get() },
    header?.config,
  )
  if (route === null) return null

  const cacheKey = `${sessionId}\0${route.provider}\0${route.model}`
  const cached = cache.get(cacheKey)
  if (cached !== undefined && cached.seq === session.seq && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.text
  }

  const deadline = AbortSignal.any([signal, AbortSignal.timeout(config.timeoutMs)])
  const call = await ctx.llm.prepareCall(
    { ...route, maxTokens: config.maxOutputTokens },
    deadline,
    leastEffort,
  )

  let raw = ''
  for await (const chunk of call.stream({
    ...call.config,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: [{ type: 'text', text: buildPrompt(history) }] }],
    signal: deadline,
  })) {
    if (chunk.type === 'text-delta' && typeof chunk.text === 'string') raw += chunk.text
  }
  deadline.throwIfAborted()

  const text = cleanPrediction(raw, config.maxPredictionChars)
  if (text === null) return null
  cache.delete(cacheKey)
  cache.set(cacheKey, { seq: session.seq, at: Date.now(), text })
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
  return text
}

/**
 * Read the provider/model catalog for the settings page, skipping providers
 * whose adapter cannot advertise one.
 * @param {object} ctx - Host context.
 * @returns {Promise<{ id: string, name: string, models: { id: string, name: string }[] }[]>} the catalog.
 */
async function catalog(ctx) {
  const providers = ctx.llm.listProviders()
  const out = []
  for (const provider of providers) {
    if (provider === null || typeof provider.id !== 'string') continue
    try {
      // An adapter may probe a remote endpoint; bound the catalog so one slow
      // provider cannot hold the settings page open.
      const models = await Promise.race([
        ctx.llm.listModels(provider.id),
        new Promise((_resolve, reject) => {
          setTimeout(() => { reject(new Error('catalog timeout')) }, 5000).unref?.()
        }),
      ])
      out.push({
        id: provider.id,
        name: typeof provider.name === 'string' && provider.name !== '' ? provider.name : provider.id,
        models: models.map(model => ({ id: model.id, name: model.name })),
      })
    } catch (_error) {
      // A provider without a usable catalog stays out; routing still accepts unlisted ids.
    }
  }
  return out
}

/**
 * Activate the Host routes and declare the optional settings page policy.
 * @param {object} ctx - Host plugin context.
 * @param {object} config - validated live configuration.
 */
export function apply(ctx, config) {
  ctx.inject(['settings'], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
  })

  const cache = new Map()
  let lastWarning = 0
  let catalogCache

  ctx.effect(() => () => {
    cache.clear()
    catalogCache = undefined
  }, 'next-message: caches')

  ctx.effect(() => ctx.connection.fetch.register({
    path: PREDICT_PATH,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      let body
      try {
        body = await request.json()
      } catch (_error) {
        return reply({ text: null }, 400)
      }
      const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''
      if (sessionId === '' || sessionId.length > 200) return reply({ text: null }, 400)
      try {
        return reply({ text: await predict(ctx, config, sessionId, request.signal, cache) })
      } catch (error) {
        if (request.signal.aborted) return reply({ text: null })
        const now = Date.now()
        if (now - lastWarning > 60_000) {
          lastWarning = now
          ctx.logger?.warn?.(`next-message: ${error instanceof Error ? error.message : String(error)}`)
        }
        return reply({ text: null })
      }
    },
  }), 'next-message: prediction route')

  ctx.effect(() => ctx.connection.fetch.register({
    path: MODELS_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async () => {
      const now = Date.now()
      if (catalogCache === undefined || now - catalogCache.at > CATALOG_TTL_MS) {
        catalogCache = { at: now, value: await catalog(ctx) }
      }
      return reply({ providers: catalogCache.value })
    },
  }), 'next-message: model catalog route')
}
