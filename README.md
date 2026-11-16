# Next message

`dsh-next-message` shows a predicted next user message inside the DeepSeek
Harness composer. When a turn finishes and the composer is empty, the plugin
asks a model to read the recent conversation and suggests what you are likely
to send next. The suggestion appears as grey ghost text; press **Tab** to fill
the draft. Nothing is sent automatically.

## Install with an AI agent

Copy the whole prompt below into an agent that can run commands and use the DSH
**Plugins** page:

```text
请帮我把 https://github.com/jimmer-code/dsh-next-message 这个 DeepSeek Harness 插件装好：git clone 到工作区，进入目录运行 npm install、npm test、npm run check；然后在 DSH 的 Plugins → Add plugin 里选择这个本地目录，启用 dsh-next-message bundle；如果设置页没出现就重启一次 DSH；最后确认 Plugins → dsh-next-message 里有「启用预测 / 预测模型 / 显示位置」三项，并且空输入框在回合结束后能出现预测、按 Tab 能填入。
```

For an English-speaking agent:

```text
Install the DeepSeek Harness plugin at https://github.com/jimmer-code/dsh-next-message: clone it, run `npm install && npm test && npm run check`, install the local directory through Plugins → Add plugin, enable the `dsh-next-message` bundle, restart DSH once if its settings page does not appear, then verify the three settings and that an empty composer shows a suggestion after a turn and Tab fills it.
```

## Manual install

```sh
git clone https://github.com/jimmer-code/dsh-next-message.git
cd dsh-next-message
npm install
npm test
npm run check
```

Then open **Plugins → Add plugin** in DSH and choose the local directory.
Reload the page; if the settings page does not appear, restart DSH once.

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
- Keeps the composer editable while the suggestion shows: the caret stays
  visible, typing clears the suggestion, and clicking the suggestion focuses
  the input again.

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
published package name). Reload the page; if the bundle was installed while DSH
was already running and its settings page does not appear, restart DSH once so
the client module graph includes it. The bundle stays enabled across restarts;
the Host row id is `next-message`.

## How it works

The browser half registers three entries: `conversation.input.overlay` (the
ghost text and its request lifecycle), `conversation.composer.dock` (the
optional bar), and `plugins.bundle.config` (the settings page). After a turn
ends it sends `{ sessionId }` to the Host's authenticated
`POST /api/next-message/predict`; the Host reads the session's derived messages,
asks `ctx.llm` for one line, cleans it, and returns it. Tab calls the public
`InputActions.insertText` with a captured insertion span, so the fill is one
undoable edit and never a send.

## Troubleshooting

- **The settings page does not appear** — reload DSH; if the bundle was
  installed into a running DSH, restart it once. Check that the bundle is
  enabled under Plugins.
- **No suggestion appears** — the composer must be empty, the turn finished,
  and the session must not be the blank home or a subagent chat. Check
  **Enable prediction**, then try **Placement → Below the composer**.
- **The inline ghost is misaligned** — DSH changed the composer's internal
  placeholder markers; switch Placement to Below. The Host row id is
  `next-message`, and the same id names the settings namespace.
- **The model setting cannot be saved** — the settings document must be
  writable; DSH reports read-only profiles in the page.

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
