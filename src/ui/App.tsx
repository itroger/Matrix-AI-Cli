import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Newline, Static, Text, useApp } from 'ink'
import TextInput from 'ink-text-input'
import Spinner from 'ink-spinner'
import { Markdown } from './Markdown.js'
import { AgentClient } from '../agent/client.js'
import type { ChatMessage } from '../types.js'

interface AppProps {
  client: AgentClient
}

const BANNER_LETTERS: Record<string, string[]> = {
  M: ['█   █', '██ ██', '█ █ █', '█   █', '█   █'],
  A: [' ███ ', '█   █', '█████', '█   █', '█   █'],
  T: ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
  R: ['████ ', '█   █', '████ ', '█  █ ', '█   █'],
  I: ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
  X: ['█   █', ' █ █ ', '  █  ', ' █ █ ', '█   █'],
}

const BANNER_LINES = Array.from({ length: 5 }, (_, row) =>
  'MATRIX'.split('').map(ch => BANNER_LETTERS[ch][row]).join(' ')
)

type Block =
  | { kind: 'title' }
  | { kind: 'content'; role: 'user' | 'assistant'; text: string }

const HELP_TEXT = [
  '**Matrix AI CLI 命令**',
  '',
  '- `/help` 查看帮助',
  '- `/clear` 清空当前对话',
  '- `/exit` 或 `/quit` 退出',
].join('\n')

function partitionSafeBlocks(fullText: string): { newFinalized: string[]; remaining: string } {
  const lines = fullText.split('\n')
  let inCodeFence = false
  const newFinalized: string[] = []
  let currentBuffer: string[] = []

  for (const line of lines) {
    if (/^[ \t]*```/.test(line)) {
      inCodeFence = !inCodeFence
    }
    currentBuffer.push(line)
    if (!inCodeFence && line.trim() === '' && currentBuffer.slice(0, -1).some((l) => l.trim() !== '')) {
      const blockContent = currentBuffer.join('\n').trim()
      if (blockContent) newFinalized.push(blockContent)
      currentBuffer = []
    }
  }

  return { newFinalized, remaining: currentBuffer.join('\n') }
}

export function App({ client }: AppProps) {
  const { exit } = useApp()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [blocks, setBlocks] = useState<Block[]>([{ kind: 'title' }])
  const [current, setCurrent] = useState('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [cursorVisible, setCursorVisible] = useState(true)

  useEffect(() => {
    const t = setInterval(() => setCursorVisible(v => !v), 500)
    return () => clearInterval(t)
  }, [])

  const rawStreamTextRef = useRef('')
  const committedIndexRef = useRef(0)

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
      setBlocks([{ kind: 'title' }])
      return
    }
    if (text === '/help') {
      setBlocks((b) => [
        ...b,
        { kind: 'content', role: 'user', text },
        { kind: 'content', role: 'assistant', text: HELP_TEXT },
      ])
      setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: HELP_TEXT }])
      return
    }

    const history = messages
    setBlocks((b) => [...b, { kind: 'content', role: 'user', text }])
    setMessages((m) => [...m, { role: 'user', content: text }])
    setLoading(true)
    setCurrent('')
    rawStreamTextRef.current = ''
    committedIndexRef.current = 0

    const flush = () => {
      const { newFinalized, remaining } = partitionSafeBlocks(rawStreamTextRef.current)
      if (newFinalized.length > committedIndexRef.current) {
        const newly = newFinalized.slice(committedIndexRef.current).map((raw) => ({
          kind: 'content' as const,
          role: 'assistant' as const,
          text: raw,
        }))
        setBlocks((b) => [...b, ...newly])
        committedIndexRef.current = newFinalized.length
      }
      setCurrent(remaining)
    }

    const timer = setInterval(flush, 50)

    try {
      let acc = ''
      for await (const chunk of client.chat(text, history)) {
        acc += chunk
        rawStreamTextRef.current += chunk
      }
      clearInterval(timer)
      const { remaining } = partitionSafeBlocks(rawStreamTextRef.current)
      if (remaining.trim()) {
        setBlocks((b) => [...b, { kind: 'content', role: 'assistant', text: remaining.trim() }])
      }
      setCurrent('')
      setMessages((m) => [...m, { role: 'assistant', content: acc || '(空回复)' }])
    } catch (e) {
      clearInterval(timer)
      const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
      setBlocks((b) => [...b, { kind: 'content', role: 'assistant', text: `⚠️ 连接失败: ${msg}` }])
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ 连接失败: ${msg}` }])
      setCurrent('')
    } finally {
      setLoading(false)
    }
  }, [messages, loading, client, exit])

  return (
    <Box flexDirection="column">
      <Static items={blocks}>
        {(b, i) => {
          if (b.kind === 'title') {
            return (
              <Box key={i} flexDirection="column">
                <Box width={process.stdout.columns ?? 80} flexDirection="column" alignItems="center">
                  {BANNER_LINES.map((line, r) => (
                    <Text key={r} color="magenta">{line}</Text>
                  ))}
                </Box>
                <Newline />
              </Box>
            )
          }
          return (
            <Box key={i} flexDirection="column" marginBottom={1}>
              {b.role === 'assistant' ? (
                <Markdown>{b.text}</Markdown>
              ) : (
                <Text>{b.text}</Text>
              )}
            </Box>
          )
        }}
      </Static>

      {loading && current ? (
        <Box marginBottom={1}>
          <Markdown maxLines={Math.max((process.stdout.rows ?? 24) - 6, 4)}>{current}</Markdown>
        </Box>
      ) : null}

      <Box borderStyle="round" borderColor="magenta" paddingX={1}>
        <Text bold color="green">❯ </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          showCursor={cursorVisible && !loading}
        />
      </Box>

      {loading ? (
        <Box>
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
          <Text dimColor> {current ? '生成中…' : '思考中…'}</Text>
        </Box>
      ) : null}
    </Box>
  )
}
