import assert from 'node:assert/strict'
import test from 'node:test'
import { apply, Config } from '../index.js'

const user = text => ({ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] })
const assistant = text => ({ role: 'assistant', source: { kind: 'model' }, content: [{ type: 'text', text }] })

/** Minimal Host context: real route objects, fake sessions, LLM, and connection. */
function harness({ reply = 'run the tests', input = {}, messages, header, live = true, sessionQuery } = {}) {
  const routes = new Map()
  const calls = []
  const session = {
    seq: 7,
    deriveMessages: () => messages ?? [user('fix the build'), assistant('The build fails on a missing import.')],
    requestHeader: () => header ?? { config: { provider: 'deepseek-official', model: 'deepseek-v4.1-flash' } },
  }
  const ctx = {
    fiber: {},
    logger: { warn() {} },
    inject(services, callback) {
      if (services.every(service => service in this)) callback(this)
    },
    effect(effect) {
      effect()
      return () => {}
    },
    connection: {
      fetch: {
        register(route) {
          routes.set(route.path, route)
        },
      },
    },
    get: name => (name === 'sessionQuery' ? sessionQuery : undefined),
    sessions: {
      get: id => (live && id === 's1' ? session : undefined),
    },
    llm: {
      listProviders: () => [{ id: 'deepseek-official', name: 'DeepSeek' }],
      listModels: async () => [{ id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash' }],
      prepareCall: async (config, _signal, configure) => {
        calls.push({ config, configure })
        return {
          config,
          stream: async function* stream() {
            yield { type: 'reasoning-delta', index: 0, text: 'thinking' }
            yield { type: 'text-delta', index: 0, text: reply }
            yield { type: 'finish', reason: { kind: 'stop' } }
          },
        }
      },
    },
  }
  const config = Config(input)
  apply(ctx, config)
  return { routes, calls, config }
}

async function predict(routes, body) {
  const route = routes.get('/api/next-message/predict')
  assert.ok(route, 'predict route registered')
  const response = await route.fetch(new Request('http://dsh.invalid/api/next-message/predict', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
  return { status: response.status, body: await response.json() }
}

test('editable configuration fields are live volatile references', () => {
  const config = Config({})
  for (const field of ['enabled', 'provider', 'model', 'placement']) {
    assert.equal(typeof config[field].get, 'function', `${field} is volatile`)
  }
  assert.equal(config.enabled.get(), true)
  assert.equal(config.placement.get(), 'inline')
  assert.equal(config.maxOutputTokens, 96)
})

test('predict route answers with the cleaned model line', async () => {
  const { routes, calls } = harness({ reply: '  "fix the import"\nextra' })
  const { status, body } = await predict(routes, { sessionId: 's1' })
  assert.equal(status, 200)
  assert.equal(body.text, 'fix the import')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].config.provider, 'deepseek-official')
  assert.equal(calls[0].config.model, 'deepseek-v4.1-flash')
  assert.equal(calls[0].config.maxTokens, 96)
})

test('predict route rejects a missing or malformed session id', async () => {
  const { routes } = harness()
  assert.equal((await predict(routes, {})).status, 400)
  assert.equal((await predict(routes, { sessionId: 42 })).status, 400)
})

test('predict route stays silent without a live session', async () => {
  const { routes } = harness()
  assert.equal((await predict(routes, { sessionId: 'missing' })).body.text, null)
})

test('predict route waits for an assistant reply', async () => {
  const { routes, calls } = harness({ messages: [user('only a prompt')] })
  assert.equal((await predict(routes, { sessionId: 's1' })).body.text, null)
  assert.equal(calls.length, 0)
})

test('predict route stays silent when no model route is known', async () => {
  const { routes, calls } = harness({ header: { config: {} } })
  assert.equal((await predict(routes, { sessionId: 's1' })).body.text, null)
  assert.equal(calls.length, 0)
})

test('predicts from a cold session through Session Query', async () => {
  let disposed = false
  const events = [
    { seq: 1, type: 'user/message', data: user('fix the build') },
    { seq: 2, type: 'assistant/message', data: { message: assistant('The build fails on a missing import.') } },
    {
      seq: 3,
      type: 'request/header',
      data: { header: { config: { provider: 'opencode-go', model: 'deepseek-v4.1-flash' } } },
    },
  ]
  const { routes, calls } = harness({
    live: false,
    sessionQuery: {
      observeSession: async () => ({
        events,
        cursor: 3,
        [Symbol.dispose]() { disposed = true },
      }),
    },
  })
  const { status, body } = await predict(routes, { sessionId: 's1' })
  assert.equal(status, 200)
  assert.equal(body.text, 'run the tests')
  assert.equal(disposed, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].config.provider, 'opencode-go')
  assert.equal(calls[0].config.model, 'deepseek-v4.1-flash')
})

test('model catalog route groups provider models', async () => {
  const { routes } = harness()
  const route = routes.get('/api/next-message/models')
  assert.ok(route, 'catalog route registered')
  const response = await route.fetch(new Request('http://dsh.invalid/api/next-message/models'))
  assert.deepEqual(await response.json(), {
    providers: [
      { id: 'deepseek-official', name: 'DeepSeek', models: [{ id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash' }] },
    ],
  })
})

test('an explicit provider/model pair overrides the session route', async () => {
  const { routes, calls } = harness({ input: { provider: 'opencode-go', model: 'deepseek-v4.1-flash' } })
  await predict(routes, { sessionId: 's1' })
  assert.equal(calls[0].config.provider, 'opencode-go')
  assert.equal(calls[0].config.model, 'deepseek-v4.1-flash')
})

test('disabled predictions skip the model entirely', async () => {
  const { routes, calls } = harness({ input: { enabled: false } })
  assert.equal((await predict(routes, { sessionId: 's1' })).body.text, null)
  assert.equal(calls.length, 0)
})
