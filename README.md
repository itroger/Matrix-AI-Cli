# Matrix AI CLI

基于 TypeScript + [Ink](https://github.com/vadimdemedes/ink) 的终端 CLI，通过 HTTP 流式连接本地 Agent（[Matrix-AI-Client](../Matrix-AI-Client) 网关），支持多轮对话、流式输出与 Markdown 渲染。

## 功能

- REPL 多轮对话，回车发送，流式打印 Agent 回复
- `ink-spinner` 加载指示，`marked` + `marked-terminal` 渲染 Markdown
- HTTP 流式通信（Vercel AI SDK UI Message Stream 协议），逐块接收
- 可配置 Agent 地址：命令行参数 / 环境变量 / 默认值
- 斜杠命令：`/help`、`/clear`、`/exit`（或 `/quit`）

## 环境要求

- Node.js ≥ 20
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

CLI 向 `${AGENT_URL}/api/chat` 发送 POST 请求，按 [Vercel AI SDK UI Message Stream](https://sdk.vercel.ai/docs/ai-sdk-ui/streaming) 协议解析流式响应。默认连接 `http://localhost:8000`，即 Matrix-AI-Client 网关。

### 请求

```http
POST /api/chat
Content-Type: application/json

{
  "messages": [
    { "id": "0", "role": "user", "parts": [{ "type": "text", "text": "上一轮问题" }] },
    { "id": "1", "role": "assistant", "parts": [{ "type": "text", "text": "上一轮回答" }] },
    { "id": "2", "role": "user", "parts": [{ "type": "text", "text": "本次输入" }] }
  ],
  "preferCloud": false
}
```

- `messages`：UIMessage 数组（`id` / `role` / `parts`），CLI 自动把当前输入追加到末尾
- `preferCloud`：可选，`true` 强制走云端模型

### 响应（AI SDK UI Message Stream）

SSE 格式，每个事件 `data: {json}\n\n`，结束 `data: [DONE]`：

```
data: {"type":"start"}

data: {"type":"text-delta","id":"0","delta":"第一块文本"}

data: {"type":"text-delta","id":"0","delta":"第二块文本"}

data: {"type":"finish","finishReason":"stop"}

data: [DONE]
```

- `text-delta` → `delta` 文本增量，CLI 顺序拼接并实时渲染
- `finish` → 结束本轮
- `error` → `errorText` 错误信息，CLI 抛出并提示
- 其余事件（`start` / `start-step` / `text-start` / `text-end` / `finish-step` / 工具相关）忽略
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
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  const chunks = ['你好，', '我是本地 Agent。', '这是流式回复示例。']
  res.write('data: {"type":"start"}\n\n')
  let i = 0
  const timer = setInterval(() => {
    if (i < chunks.length) {
      res.write(`data: ${JSON.stringify({ type: 'text-delta', textDelta: chunks[i++] })}\n\n`)
    } else {
      res.write(`data: ${JSON.stringify({ type: 'finish', finishReason: 'stop' })}\n\n`)
      res.write('data: [DONE]\n\n')
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
├── ui/Markdown.tsx           # Markdown 组件（marked + marked-terminal）
└── types/marked-terminal.d.ts
```

## 技术栈

| 用途           | 依赖                          |
| -------------- | ----------------------------- |
| 终端 UI        | ink v8, react 19              |
| 加载动画       | ink-spinner v5                |
| 输入框         | ink-text-input v6             |
| Markdown 渲染  | marked v18, marked-terminal v8 |
| CLI 参数解析   | commander v15                 |
| 开发运行       | tsx v4                        |
| 打包           | tsup v9                       |
| 类型检查       | typescript v7                 |

## 说明

Markdown 渲染用 `marked` v18 + `marked-terminal` v8（均为 ESM，token-based renderer extension，`marked.use(markedTerminal())`）。未使用 `ink-markdown`（CJS，与 ink ESM 不兼容）。
