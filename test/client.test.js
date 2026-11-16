import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const bundle = readFileSync(join(root, 'lib/client.js'), 'utf8')

/** Load the served bundle in a minimal browser realm and return its module exports. */
function loadClient() {
  let loaded
  const document = {
    head: { appendChild() {} },
    createElement() {
      return { dataset: {}, textContent: '', remove() {} }
    },
    addEventListener() {},
    removeEventListener() {},
    activeElement: null,
  }
  const React = {
    createElement: () => null,
    useState: () => [undefined, () => {}],
    useEffect: () => {},
    useLayoutEffect: () => {},
    useRef: () => ({ current: undefined }),
  }
  const sandbox = {
    window: { __ModuleLoader__: { load(module) { loaded = module } } },
    document,
    fetch: async () => ({ ok: false, json: async () => null }),
    AbortController,
    setTimeout,
    clearTimeout,
    console,
  }
  vm.runInNewContext(bundle, sandbox)
  assert.ok(loaded, 'bundle registered itself')
  assert.equal(loaded.id, 'dsh-next-message')
  return loaded.factory((id) => {
    if (id === 'react') return React
    throw new Error(`unexpected client import: ${id}`)
  })
}

test('bundle has no unsubstituted build placeholders', () => {
  assert.equal(bundle.includes('__NM_CSS__'), false)
  assert.equal(bundle.includes('__NM_LOCALES__'), false)
  assert.equal(bundle.includes('window.__ModuleLoader__.load'), true)
  // The ghost must leave the real caret visible and keep the composer editable.
  assert.match(bundle, /:has\(\.dsh-nm-ghost\)/)
  assert.match(bundle, /cursor: text/)
  assert.match(bundle, /focus\(\{ preventScroll: true \}\)/)
})

test('client module registers the three intended slots', () => {
  const module = loadClient()
  assert.deepEqual(Array.from(module.inject), ['slots', 'locale', 'configForms'])
  const registrations = []
  const ctx = {
    effect(effect) {
      effect()
      return () => {}
    },
    locale: { register() { return () => {} } },
    configForms: {
      get() {
        return {
          getSnapshot: () => ({ status: 'loading', value: undefined }),
          subscribe: () => () => {},
        }
      },
    },
    slots: {
      inject(name, callback) {
        registrations.push(name)
        callback()
        return () => {}
      },
      register(options) {
        registrations.push(options)
        return () => {}
      },
    },
  }
  module.apply(ctx)
  assert.deepEqual(registrations.filter(entry => typeof entry === 'string'), [
    'conversation.input.overlay',
    'conversation.composer.dock',
    'plugins.bundle.config',
  ])
  const options = registrations.filter(entry => typeof entry === 'object')
  assert.equal(options.length, 3)
  assert.equal(options[0].name, 'conversation.input.overlay')
  assert.equal(options[0].id, 'next-message')
  assert.equal(options[1].name, 'conversation.composer.dock')
  assert.equal(options[2].name, 'plugins.bundle.config')
  assert.equal(options[2].key, 'dsh-next-message')
})
