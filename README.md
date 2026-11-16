# 下一条消息

`dsh-next-message` 是一个 DeepSeek Harness 插件：在输入框里显示根据对话预测的下一条用户消息，按 `Tab` 填入草稿。

一个回合结束后、输入框为空时，插件让模型读最近的对话，给出一行建议。建议以灰色文字显示在输入框里，不会自动发送。

## 用 AI 助手安装

把下面整段复制给能执行命令、能操作 DSH 插件页的 AI 助手：

```text
请帮我把 DeepSeek Harness 插件 dsh-next-message 装好：在 DSH 的「插件 → 添加插件」里填 github:jimmer-code/dsh-next-message 并安装，确认 dsh-next-message 插件包已启用；刷新页面，如果设置页没出现就重启一次 DSH；最后确认「插件 → dsh-next-message」里有「启用预测 / 预测模型 / 显示位置」三项，并且空输入框在回合结束后能出现建议、按 Tab 能填入。
```

## 安装

### 桌面版（推荐）

打开「插件 → 添加插件」，在输入框里填：

```text
github:jimmer-code/dsh-next-message
```

点安装。DSH 会用 pnpm 安装这个包，并自动把 `dsh-next-message` 加进当前 profile 的插件包列表（通常也会自动启用）。**不需要先 `git clone`，也不需要手动 `npm install`。** 装完刷新页面；如果设置页没出现，重启一次 DSH。

### 命令行 / Web profile

```sh
dsh plugin --profile <profile> add github:jimmer-code/dsh-next-message
```

`dsh plugin` 会把参数转发给 profile 目录里的 pnpm，并根据安装结果自动更新 `dsh.profile.bundles`。Git/npm 地址不需要先 clone 或 `npm install`。Desktop 的 profile 由桌面应用管理，不能用 CLI 装，请用上面的「插件 → 添加插件」。

### 本地开发安装

如果改的是这个仓库的源码，而不是装已发布的包：

```sh
git clone https://github.com/jimmer-code/dsh-next-message.git
cd dsh-next-message
npm install
npm test
npm run check
```

然后在「插件 → 添加插件」里选择这个本地目录。通过链接安装的 checkout 会保留自己的 `node_modules`，所以本地开发要先 `npm install`。

### 从 npm 安装（尚未发布）

发布到 npm 之后可以：

```sh
dsh plugin --profile <profile> add dsh-next-message
```

或在「插件 → 添加插件」里填包名 `dsh-next-message`。

### 为什么 Git 安装不用先构建

仓库里提交了构建好的 `lib/client.js`，并且没有 `prepare` 脚本，所以 pnpm 从 GitHub 安装时不需要额外的构建授权；DSH 直接加载预构建产物。

## 功能

- 只在回合结束、主会话输入框为空且空闲时出现；空会话、子代理会话、触屏设备不会出现。
- 默认使用当前会话最后一次请求的模型；想更便宜或更快，可以在设置页固定一个模型路由。
- `Tab` 把建议填入草稿，作为一次可撤销编辑；不会发送。
- 接受不等于消耗：删回空输入框后，同一条建议会重新出现，不会重新请求模型。
- `Esc` 收起建议，本回合不再出现；直接输入任意字符也会隐藏建议。
- 建议显示期间输入框仍然可编辑：光标保留可见，点击建议区域会把焦点放回输入框。
- 不写会话日志、不发送消息；预测失败时不会在输入框里弹错误。

## 设置

打开「插件 → dsh-next-message」，页面上有三个控件：

| 控件 | 作用 |
|---|---|
| 启用预测 | 打开或关闭 |
| 预测模型 | 默认跟随当前会话；也可以固定某个模型 |
| 显示位置 | 输入框内的灰色建议文字，或输入框下方的一条建议栏 |

其余上限（`maxOutputTokens`、`timeoutMs`、`historyMessages`、`maxInputChars`、`maxPredictionChars`）在插件行配置里，默认值都很小。

## 隐私

请求内容包括：当前会话最近的人类用户消息和助手文本，加上一段固定指令。请求发给你配置的模型服务，走主对话同一个模型调用通道。

没有遥测、没有外部服务器、不记录对话内容；失败日志最多一分钟一条，只包含错误信息，不包含对话正文。

## 兼容性

在 DeepSeek Harness `0.2.2-rc.3` 上测试。

输入框内的显示位置依赖输入框的 `data-composer-card` / `data-composer-placeholder` 标记；DSH 升级后如果对不齐，把「显示位置」切换到「下方」。下方模式只依赖公开的输入框插槽，不依赖这些内部标记。

## 工作原理

浏览器侧注册三个入口：

- `conversation.input.overlay`：灰色建议文字和请求生命周期；
- `conversation.composer.dock`：输入框下方的建议栏；
- `plugins.bundle.config`：设置页。

回合结束后，浏览器向宿主侧的 `POST /api/next-message/predict` 发送 `{ sessionId }`。宿主读取 `session.deriveMessages()`，筛出真人用户消息和助手文本，按条数与字符数裁剪，用 `ctx.llm` 请求一行结果，清洗后返回。

按 `Tab` 时调用公开的 `InputActions.insertText`，带插入位置和版本校验，所以填入是一次可撤销编辑，也不会触发发送。

## 常见问题

- **设置页不出现**：刷新页面；如果插件是在 DSH 运行中安装的，重启一次 DSH。确认「插件」里这个插件包是启用的。
- **没有建议出现**：输入框要为空、回合已经结束，并且不能是空会话或子代理会话；确认「启用预测」开着，再把「显示位置」切到「下方」试试。
- **输入框内的建议位置不对**：DSH 改了输入框的内部标记；把「显示位置」切到「下方」。
- **模型设置保存不了**：当前配置文档不可写；设置页会显示只读。

## 开发

```sh
npm run build   # 从 src/client.js、样式和语言包生成 lib/client.js
npm run check   # 检查 lib/client.js 是否最新
npm test        # 纯函数测试（node:test）
```

运行时只依赖 DSH 自带的 `@deepseek-ai/schemastery`，已在 `package.json` 里声明，单独用 npm 安装也能装全。

客户端源码是普通浏览器模块体；构建只负责包上 DSH 的模块加载外壳，并内联样式和语言包。

## 许可证

MIT 许可证。
