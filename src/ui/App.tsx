import React, { useCallback, useState } from 'react'
import { Box, Newline, Static, Text, useApp } from 'ink'
import TextInput from 'ink-text-input'
import Spinner from 'ink-spinner'
import { Markdown } from './Markdown.js'
import { AgentClient } from '../agent/client.js'
import type { ChatMessage } from '../types.js'

interface AppProps {
  client: AgentClient
}

const HELP_TEXT = [
  '**Matrix AI CLI 命令**',
  '',
  '- `/help` 查看帮助',
  '- `/clear` 清空当前对话',
  '- `/exit` 或 `/quit` 退出',
].join('\n')

export function App({ client }: AppProps) {
  const { exit } = useApp()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState('')

  const handleSubmit = useCallback(async (value: string) => {
    const text = value.trim()
    setInput('')
    if (!text || loading) return

    if (text === '/exit' || text === '/quit') {
      exit()
      return
    }
    if (text === '/clear') {
      setMessages([])
      return
    }
    if (text === '/help') {
      setMessages((m) => [...m, { role: 'assistant', content: HELP_TEXT }])
      return
    }

    const history = messages
    setMessages((m) => [...m, { role: 'user', content: text }])
    setLoading(true)
    setStreaming('')

    try {
      let acc = ''
      for await (const chunk of client.chat(text, history)) {
        acc += chunk
        setStreaming(acc)
      }
      setMessages((m) => [...m, { role: 'assistant', content: acc || '(空回复)' }])
    } catch (e) {
      const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ 连接失败: ${msg}` }])
    } finally {
      setStreaming('')
      setLoading(false)
    }
  }, [messages, loading, client, exit])

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">Matrix AI CLI</Text>
        <Text> </Text>
        <Text dimColor>→ {client.url}</Text>
      </Box>
      <Newline />

      <Static items={messages}>
        {(m, i) => (
          <Box key={i} flexDirection="column" marginBottom={1}>
            <Text bold color={m.role === 'user' ? 'green' : 'blue'}>
              {m.role === 'user' ? '你' : 'Agent'}
            </Text>
            {m.role === 'assistant' ? (
              <Markdown>{m.content}</Markdown>
            ) : (
              <Text>{m.content}</Text>
            )}
          </Box>
        )}
      </Static>

      {loading && (
        <Box flexDirection="column" marginBottom={1}>
          <Box>
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>
            <Text dimColor> {streaming ? '生成中…' : '思考中…'}</Text>
          </Box>
          {streaming ? <Markdown>{streaming}</Markdown> : null}
        </Box>
      )}

      <Box borderStyle="single" paddingX={1}>
        <Text color="green">❯ </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="输入消息回车发送（/help 查看命令）"
        />
      </Box>
    </Box>
  )
}
