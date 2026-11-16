import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPrompt,
  cleanPrediction,
  resolveRoute,
  selectHistory,
  textOf,
} from '../src/core.js'

const user = text => ({ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] })
const injected = text => ({ role: 'user', source: { kind: 'system-inject' }, content: [{ type: 'text', text }] })
const assistant = (text, extra = []) => ({
  role: 'assistant',
  source: { kind: 'model' },
  content: [{ type: 'text', text }, ...extra],
})

test('textOf joins text blocks and ignores other blocks', () => {
  assert.equal(textOf({ content: [{ type: 'text', text: 'a' }, { type: 'tool-call' }, { type: 'text', text: 'b' }] }), 'ab')
  assert.equal(textOf({ content: [] }), '')
  assert.equal(textOf({}), '')
  assert.equal(textOf(null), '')
})

test('selectHistory keeps human turns and assistant text only', () => {
  const history = selectHistory([
    user('fix the build'),
    injected('reminder: follow the style guide'),
    assistant('The build fails on a missing import.'),
    { role: 'tool', content: [{ type: 'text', text: 'exit 1' }] },
    user('ok'),
    assistant('Fixed and verified.', [{ type: 'reasoning', text: 'thinking' }]),
  ])
  assert.deepEqual(history, [
    { role: 'user', text: 'fix the build' },
    { role: 'assistant', text: 'The build fails on a missing import.' },
    { role: 'user', text: 'ok' },
    { role: 'assistant', text: 'Fixed and verified.' },
  ])
})

test('selectHistory bounds the message count from the end', () => {
  const messages = []
  for (let index = 0; index < 10; index += 1) {
    messages.push(user(`u${index}`))
    messages.push(assistant(`a${index}`))
  }
  const history = selectHistory(messages, { historyMessages: 3 })
  assert.deepEqual(history, [
    { role: 'assistant', text: 'a8' },
    { role: 'user', text: 'u9' },
    { role: 'assistant', text: 'a9' },
  ])
})

test('selectHistory keeps the newest messages when the character budget is tight', () => {
  const history = selectHistory([
    user('an older message that should be dropped'),
    assistant('the recent reply that must survive'),
  ], { historyMessages: 10, maxInputChars: 30 })
  assert.deepEqual(history, [{ role: 'assistant', text: 'the recent reply that must su…' }])
})

test('buildPrompt labels roles in order', () => {
  const prompt = buildPrompt([
    { role: 'user', text: 'hello' },
    { role: 'assistant', text: 'hi' },
  ])
  assert.match(prompt, /^Conversation:/)
  assert.match(prompt, /User: hello\n\nAssistant: hi/)
})

test('cleanPrediction keeps one clean line', () => {
  assert.equal(cleanPrediction('  "run the tests"\nsecond line'), 'run the tests')
  assert.equal(cleanPrediction('User: 继续'), '继续')
  assert.equal(cleanPrediction('用户：提交 PR'), '提交 PR')
  assert.equal(cleanPrediction('`fix the type error`'), 'fix the type error')
  assert.equal(cleanPrediction('   '), null)
})

test('cleanPrediction rejects unsafe or oversized output', () => {
  assert.equal(cleanPrediction('/goal resume'), null)
  assert.equal(cleanPrediction('@src/index.ts'), null)
  assert.equal(cleanPrediction('x'.repeat(200), 160), null)
  assert.equal(cleanPrediction(null), null)
})

test('resolveRoute prefers the explicit pair and otherwise follows the session', () => {
  assert.deepEqual(
    resolveRoute({ provider: 'opencode-go', model: 'deepseek-v4.1-flash' }, { provider: 'other', model: 'm' }),
    { provider: 'opencode-go', model: 'deepseek-v4.1-flash' },
  )
  assert.deepEqual(
    resolveRoute({ provider: '', model: '' }, { provider: 'deepseek-official', model: 'deepseek-v4.1-flash' }),
    { provider: 'deepseek-official', model: 'deepseek-v4.1-flash' },
  )
  assert.equal(resolveRoute({ provider: 'only-provider', model: '' }, { provider: 'p', model: 'm' }), null)
  assert.equal(resolveRoute({ provider: '', model: '' }, undefined), null)
  assert.deepEqual(
    resolveRoute({ provider: '  ', model: '  ' }, { provider: 'p', model: 'm' }),
    { provider: 'p', model: 'm' },
  )
})
