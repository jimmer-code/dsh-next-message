# dsh-next-message — 细节说明

## 它在哪里出现

主对话输入框为空、当前回合已结束、且会话不是空会话/子代理会话时，插件会在输入框里显示一行灰色预测文字，尾部带一个小 `Tab` 键帽。

- **Tab**：把预测文字插入草稿，作为一次可撤销编辑（`Cmd/Ctrl+Z` 可撤销）。不会发送。
- **Esc**：收起这条预测，本回合不再出现。
- **输入任意字符**：预测立即消失。
- **新回合开始 / 切换会话 / 插件关闭**：预测消失。

触屏设备（`pointer: coarse`）不启用，因为 Tab 填入依赖键盘。

## 它怎么工作

1. 浏览器侧监听 `session.running` 从 true 变为 false，并确认草稿为空、没有附件、阶段为 `plain`。
2. 防抖 600ms 后，向 Host 的 `POST /api/next-message/predict` 发送 `{ sessionId }`。
3. Host 读取该会话的派生消息，保留真人用户消息和 assistant 文本，按条数与字符数裁剪。
4. 用插件配置的 `provider`/`model` 调用 `ctx.llm`；没有配置时使用会话最近一次 `request/header` 的模型。
5. 模型只被要求输出一行。Host 取第一行、去掉引号和前缀、拒绝以 `/` 或 `@` 开头的结果。
6. 浏览器把结果画在输入框占位文字的位置；按 Tab 时调用 `inputActions.insertText(text, captureInsertion())`。

Host 侧按“会话 + 模型 + 会话日志长度”缓存 2 分钟，避免同一回合重复请求。

## 设置页

设置页注册在 `plugins.bundle.config`，键是 bundle 名 `dsh-next-message`。可编辑字段在 Host 的 Config 里标记为 `.volatile()`，因此由 DSH 的 Settings 服务持久化到 profile 的 Cordis patch，写入是逐字段、带 revision 校验的。

三个控件：

- **启用推测**
- **推测模型**：跟随当前会话，或固定为某个 provider/model（列表来自 `GET /api/next-message/models`）
- **显示位置**：输入框内 / 输入框下方

其余限制是普通 Config 字段，可在 `cordis.patch.yml` 的 `next-message` 行里改：

```yaml
- id: next-message
  name: dsh-next-message
  config:
    maxOutputTokens: 48
    timeoutMs: 8000
    historyMessages: 10
    maxInputChars: 5000
    maxPredictionChars: 160
```

## 兼容与降级

输入框内的 ghost 文字通过测量 `[data-composer-placeholder]` 的位置来对齐。这些是 DSH composer 的内部标记，不是公开 API；DSH 升级后如果对不齐，把设置里的“显示位置”改成“输入框下方”即可，该模式只依赖 `conversation.composer.dock` 这个公开插槽。

Tab 拦截只在预测可见、编辑器聚焦、事件未被 `/`、`@` 菜单消费时生效，因此不会抢走输入触发器菜单的 Tab。

## 隐私

- 发送给模型的内容：最近 10 条真人用户消息和 assistant 文本，总共不超过 5000 字符，加上固定 system prompt。
- 不发送：工具结果、系统提示、注入内容、图片、附件、会话元数据。
- 不记录对话内容到日志；失败日志最多一分钟一条，只包含错误消息。
- 无遥测、无外部服务器；请求只经过 DSH 已配置的模型 provider。
