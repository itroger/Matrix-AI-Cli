# Matrix AI CLI

基于 **Rust + Ratatui** 的命令行 AI 对话客户端，连接本地 Agent（Matrix-AI-Client 网关），支持 HTTP 流式（Vercel AI SDK UI Message Stream）。

## 技术栈

| 组件 | 选型 |
|------|------|
| 语言 | Rust（edition 2021） |
| TUI | ratatui 0.29 + crossterm 0.28 |
| 异步运行时 | tokio |
| HTTP 客户端 | reqwest（json + stream） |
| 序列化 | serde / serde_json |
| CLI 参数 | clap（`--url` / `AGENT_URL`） |

## 环境要求

- Rust ≥ 1.89（toolchain stable）
- 本地 Agent 运行于 `http://localhost:8000`（可配置）

## 构建与运行

```bash
# 调试构建并运行
cargo run

# 发布构建
cargo build --release
./target/release/matrix-cli

# 指定 Agent 地址
cargo run -- --url http://localhost:9000
AGENT_URL=http://localhost:9000 cargo run
```

## REPL 命令

| 命令 | 行为 |
|------|------|
| `/help` | 查看帮助 |
| `/clear` | 清空当前对话 |
| `/exit` `/quit` `Esc` | 退出 |

## Agent 通信协议

请求 `POST {url}/api/chat`，body：

```json
{
  "messages": [
    { "id": "0", "role": "user", "parts": [{ "type": "text", "text": "..." }] }
  ],
  "preferCloud": false
}
```

响应为 SSE 流，每行 `data: {json}`，按 `type` 字段分发：

- `text-delta` → 取 `delta` 字段追加显示
- `error` → 抛错
- `finish` / `[DONE]` → 结束

## 项目结构

```
src/
├── main.rs           # 入口 + 事件循环
├── config.rs         # CLI 参数 / 环境变量
├── agent/
│   ├── mod.rs        # AgentEvent
│   ├── types.rs      # UIMessage / Role / Part / ChatRequest / StreamEvent
│   └── client.rs     # HTTP SSE 流式客户端
└── ui/
    ├── mod.rs
    └── app.rs        # App 状态 + Ratatui 渲染 + 按键处理
```

## 配置优先级

命令行参数 `--url` > 环境变量 `AGENT_URL` > 默认值 `http://localhost:8000`
