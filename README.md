# Matrix AI CLI

基于 TypeScript + [Ink](https://github.com/vadimdemedes/ink) 的终端 CLI，通过 HTTP 流式连接本地 Agent（[Matrix-AI-Client](../Matrix-AI-Client) 网关），支持多轮对话、流式输出与 Markdown 渲染。

## 功能

- REPL 多轮对话，回车发送，流式打印 Agent 回复
- `ink-spinner` 加载指示，`marked` + `marked-terminal` 渲染 Markdown
- HTTP 流式通信（Vercel AI SDK Data Stream 协议），逐块接收
- 可配置 Agent 地址：命令行参数 / 环境变量 / 默认值
- 斜杠命令：`/help`、`/clear`、`/exit`（或 `/quit`）

## 环境要求

- Node.js ≥ 18（推荐 20+）
- npm

## 安装

```bash
npm install
```

## 使用

### 开发模式（tsx 直跑）

```bash
npm run dev
```

### 构建后运行

```bash
npm run build
node dist/index.js
```

### 类型检查

```bash
npm run typecheck
```

## 配置 Agent 地址

优先级：命令行参数 > 环境变量 > 默认值（`http://localhost:8000`）。

```bash
# 命令行参数
npm run dev -- --url http://localhost:9000
node dist/index.js --url http://localhost:9000

# 环境变量
AGENT_URL=http://localhost:9000 npm run dev
```

## REPL 命令

| 命令     | 作用           |
| -------- | -------------- |
| `/help`  | 查看帮助       |
| `/clear` | 清空当前对话   |
| `/exit`  | 退出（同 `/quit`） |

## Agent 端约定

CLI 向 `${AGENT_URL}/api/chat` 发送 POST 请求，按 [Vercel AI SDK Data Stream](https://sdk.vercel.ai/docs/ai-sdk-ui/streaming) 协议解析流式响应。默认连接 `http://localhost:8000`，即 Matrix-AI-Client 网关。

### 请求

```http
POST /api/chat
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "上一轮问题" },
    { "role": "assistant", "content": "上一轮回答" },
    { "role": "user", "content": "本次输入" }
  ],
  "preferCloud": false
}
```

- `messages`：对话历史 + 本次输入（CLI 自动把当前输入追加到末尾）
- `preferCloud`：可选，`true` 强制走云端模型

### 响应（AI SDK Data Stream）

`Content-Type: text/plain; charset=utf-8`，每行 `<type>:<json>`：

```
0:"第一块文本"
2:[{"toolCallId":"t1","toolName":"time","args":{}}]
0:"第二块文本"
d:{"finishReason":"stop"}
```

- `0:` 文本增量，CLI 顺序拼接并实时渲染
- `2:` 工具调用，CLI 忽略（不在终端展示）
- `e:` 流错误，CLI 抛出并提示
- `d:` 结束本轮
- 非 2xx 状态码以 `⚠️ 连接失败` 提示

### 最小 Mock Agent 示例（Node 原生）

```js
// mock-agent.mjs  —  node mock-agent.mjs
import { createServer } from 'node:http'

createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/api/chat') {
    res.statusCode = 404
    return res.end('not found')
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
  const chunks = ['你好，', '我是本地 Agent。', '这是流式回复示例。']
  let i = 0
  const timer = setInterval(() => {
    if (i < chunks.length) {
      res.write(`0:${JSON.stringify(chunks[i++])}\n`)
    } else {
      res.write(`d:${JSON.stringify({ finishReason: 'stop' })}\n`)
      clearInterval(timer)
      res.end()
    }
  }, 300)
}).listen(8000, () => console.log('mock agent on http://localhost:8000'))
```

启动 mock agent 后另开终端运行 `npm run dev` 即可联调。

## 项目结构

```
src/
├── index.tsx                 # 入口：解析配置 → 创建 client → render
├── types.ts                  # 共享类型
├── config.ts                 # --url / AGENT_URL / 默认值
├── agent/client.ts           # HTTP 流式客户端（AI SDK Data Stream）
├── ui/App.tsx                # REPL 主组件
├── ui/Markdown.tsx           # Markdown 组件（基于 renderMarkdown）
├── ui/renderMarkdown.ts      # 轻量 markdown→ANSI 渲染（chalk）
└── types/
```

## 技术栈

| 用途           | 依赖            |
| -------------- | --------------- |
| 终端 UI        | ink, react      |
| 加载动画       | ink-spinner     |
| 输入框         | ink-text-input  |
| Markdown 渲染  | chalk（自实现 renderMarkdown） |
| CLI 参数解析   | commander       |
| 开发运行       | tsx             |
| 打包           | tsup            |

## 说明

- `ink-markdown` 官方包为 CJS 且 `require('ink')`，与 ink v5 的 ESM + top-level await 不兼容。
- `marked-terminal` v6 的 renderer 是旧字符串接口，与 marked v5+ 不兼容（marked 会把 custom renderer 的方法拷贝到自身 Renderer 实例，导致 `this` 丢失，报 `this.o.text is not a function`）。
- 故用 `chalk` 自实现轻量 markdown→ANSI 渲染（`src/ui/renderMarkdown.ts`），覆盖标题/加粗/斜体/列表/代码块/行内代码/引用/链接等常见语法。
