import type { AgentClientOptions, ChatMessage } from '../types.js'

export class AgentClient {
  readonly url: string
  private timeout: number
  private preferCloud: boolean

  constructor(opts: AgentClientOptions) {
    this.url = opts.url.replace(/\/$/, '')
    this.timeout = opts.timeout ?? 0
    this.preferCloud = opts.preferCloud ?? false
  }

  async *chat(message: string, history: ChatMessage[]): AsyncGenerator<string> {
    const controller = new AbortController()
    const timer = this.timeout > 0
      ? setTimeout(() => controller.abort(), this.timeout)
      : undefined

    try {
      const toUIMessage = (m: ChatMessage, i: number) => ({
        id: String(i),
        role: m.role,
        parts: [{ type: 'text' as const, text: m.content }],
      })
      const messages = [
        ...history.map(toUIMessage),
        toUIMessage({ role: 'user', content: message }, history.length),
      ]

      const res = await fetch(`${this.url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, preferCloud: this.preferCloud }),
        signal: controller.signal,
      })

      if (!res.ok) {
        throw new Error(`Agent 返回 ${res.status}: ${await res.text()}`)
      }
      if (!res.body) throw new Error('Agent 响应没有 body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') return
          let evt: { type?: string; delta?: string; textDelta?: string; errorText?: string }
          try {
            evt = JSON.parse(data)
          } catch {
            continue
          }
          if (evt.type === 'text-delta') {
            const text = evt.delta ?? evt.textDelta
            if (text) yield text
          } else if (evt.type === 'error') {
            throw new Error(`Agent 流错误: ${evt.errorText ?? '未知错误'}`)
          } else if (evt.type === 'finish') {
            return
          }
        }
      }
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}
