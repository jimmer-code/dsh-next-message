# dsh-next-message

DeepSeek Harness 插件：根据对话预测下一条用户消息，在输入框里显示 ghost 文字，按 Tab 填入草稿。

## 状态

首个可用版本。默认跟随会话当前模型；设置页可启用/关闭、固定预测模型、切换显示位置。

## 结构

- `index.js` — Host 侧：Config（可编辑字段 `volatile`）、`/api/next-message/predict`、`/api/next-message/models`、LLM 调用与缓存。
- `src/core.js` — 纯函数：历史筛选、prompt、输出清洗、模型路由。无 DSH 依赖，可单测。
- `src/client.js` — 浏览器侧：ghost 文字、Tab/Esc、设置页；DSH 模块外壳由 `src/build.mjs` 包裹。
- `src/styles.css` — 全部样式，`dsh-nm-` 前缀，只用 `--dsw-alias-*` / `--dsw-specific-*` token。
- `lib/client.js` — 构建产物，必须与源码同步；`npm run check` 会检查。
- `cordis.patch.yml` — 插入 `id: next-message` 的 Host 行。
- `node_modules/@deepseek-ai/schemastery` — 本地开发用的软链（指向 profile 的同版本副本）；发布到 npm 时由 `dependencies` 安装，不要提交 `node_modules`。

## 命令

```sh
npm test          # node --test，纯函数测试
npm run build     # 重新生成 lib/client.js
npm run check     # 校验 lib/client.js 是否最新
```

## 关键约束

- 不改 DSH 本体，全部通过 profile bundle 安装。
- Host 侧只返回一行文本，不写 session、不发送消息。
- 浏览器侧只通过公开插槽和 `InputActions` 交互；`data-composer-*` 只用于测量位置，量不到就不显示。
- Tab 只在预测可见、编辑器聚焦、`defaultPrevented` 为 false 时拦截。
- 请求与设置都走带鉴权的 `/api` 路由，不新增端口、不依赖外网服务。
- 预测失败静默处理，不在输入框里弹错误。

## 已知限制

- 只在空草稿时预测；不支持半句话续写。
- 只对主对话启用，跳过子代理会话；手机端默认开启，输入栏「预测」按钮按设备开关（localStorage），手机固定用下方建议栏。
- 依赖会话已有 assistant 文本；最后一个回合失败或被中断时不预测。
- DSH 升级后 `data-composer-placeholder` 若改名，内联模式会退化为不显示；用设置里的“输入框下方”兜底。

## 发布

`package.json` 已包含 `dsh.bundle.patch`、`dsh.client`、`files`、`manifestVersion`。发布到 npm 后用户可以用 Plugins → Add plugin 安装；本地目录也可以直接安装。
