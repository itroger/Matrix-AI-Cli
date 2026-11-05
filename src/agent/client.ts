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
      const messages = [
        ...history,
        { role: 'user' as const, content: message },
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
          if (!trimmed) continue
          const colon = trimmed.indexOf(':')
          if (colon < 0) continue
          const type = trimmed.slice(0, colon)
          let payload: unknown
          try {
            payload = JSON.parse(trimmed.slice(colon + 1))
          } catch {
            continue
          }
          if (type === '0') {
            const text = payload as string
            if (text) yield text
          } else if (type === 'd') {
            return
          }
        }
      }
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}
