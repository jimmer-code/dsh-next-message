# Next message

`dsh-next-message` shows a predicted next user message inside the DeepSeek
Harness composer. When a turn finishes and the composer is empty, the plugin
asks a model to read the recent conversation and suggests what you are likely
to send next. The suggestion appears as grey ghost text; press **Tab** to fill
the draft. Nothing is sent automatically.

## What it does

- Runs after a completed turn, only while the composer is empty, idle, and
  focused on the main conversation. It stays out of the hero, subagent
  conversations, and touch devices.
- Uses the session's own model by default. Pin a different provider/model in
  the plugin settings when you want a cheaper or faster predictor.
- Fills the draft as one undoable edit. `Esc` dismisses the suggestion, and
  typing anything hides it.
- Never appends to the session log, never sends a message, and shows no errors
  in the composer when a prediction fails.

## Settings

Open **Plugins → dsh-next-message**. The page has three controls:

| Control | Meaning |
|---|---|
| Enable prediction | Turn the feature on or off |
| Prediction model | Follow the current session, or pin a provider/model route |
| Placement | Ghost text inside the composer, or a bar under it |

Static bounds (`maxOutputTokens`, `timeoutMs`, `historyMessages`,
`maxInputChars`, `maxPredictionChars`) live in the plugin row configuration and
default to small, cheap values.

## Privacy

The request contains the recent human user turns and assistant text of the
current session, plus a fixed instruction. It goes to the provider/model you
configure, through the same LLM service the main conversation uses. There is no
telemetry, no server, and no logging of the transcript; failures log one short
message at most once a minute.

## Compatibility

Tested against DeepSeek Harness `0.2.2-rc.3`. The composer integration uses
documented slots (`conversation.input.overlay`, `conversation.composer.dock`)
and the public `InputActions.insertText` API. The inline geometry reads the
composer's own `data-composer-card` / `data-composer-placeholder` markers; when
those change, switch **Placement** to “Below the composer”, which does not rely
on them.

## Install

In DSH open **Plugins → Add plugin** and point it at this directory (or a
published package name), then refresh the page. The bundle stays enabled across
restarts; the Host row id is `next-message`.

## Development

```sh
npm run build   # writes lib/client.js from src/client.js + styles + locales
npm run check   # fails when lib/client.js is stale
npm test        # pure prompt/history/output tests (node:test)
```

The only runtime dependency is `@deepseek-ai/schemastery`, the schema library
DSH already ships; it is declared so a standalone npm install is complete. The
client source is a plain browser module body; the build only wraps it in DSH's
module-loader envelope and inlines CSS and locale JSON.

## License

MIT.
