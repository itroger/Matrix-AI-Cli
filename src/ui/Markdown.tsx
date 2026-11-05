import React from 'react'
import { Box, Text } from 'ink'
import { Marked } from 'marked'
import type { Token, Tokens } from 'marked'

interface MarkdownProps {
  children: string
}

const marked = new Marked()

function renderInline(tokens: Token[] | undefined): React.ReactNode {
  if (!tokens || tokens.length === 0) return null
  return tokens.map((t, i) => {
    switch (t.type) {
      case 'strong':
        return <Text key={i} bold>{renderInline(t.tokens)}</Text>
      case 'em':
        return <Text key={i} italic>{renderInline(t.tokens)}</Text>
      case 'codespan':
        return <Text key={i} color="yellow">{(t as Tokens.Codespan).text}</Text>
      case 'link':
        return <Text key={i} color="blue">{renderInline(t.tokens)}</Text>
      case 'del':
        return <Text key={i} strikethrough color="gray">{renderInline(t.tokens)}</Text>
      case 'br':
        return '\n'
      case 'image': {
        const img = t as Tokens.Image
        return <Text key={i} color="cyan">[图片: {img.text || img.href}]</Text>
      }
      case 'text': {
        const tt = t as Tokens.Text
        return tt.tokens ? renderInline(tt.tokens) : tt.text
      }
      case 'escape':
        return (t as Tokens.Escape).text
      case 'checkbox':
        return (t as Tokens.Checkbox).checked ? '[x] ' : '[ ] '
      default:
        return (t as { text?: string }).text ?? ''
    }
  })
}

function renderBlocks(tokens: Token[]): React.ReactNode {
  return tokens.map((t, i) => {
    switch (t.type) {
      case 'heading': {
        const h = t as Tokens.Heading
        return (
          <Text key={i} bold color={h.depth === 1 ? 'magenta' : 'green'}>
            {renderInline(h.tokens)}
          </Text>
        )
      }
      case 'paragraph':
        return <Text key={i}>{renderInline((t as Tokens.Paragraph).tokens)}</Text>
      case 'code':
        return (
          <Box key={i} flexDirection="column">
            <Text color="yellow">{(t as Tokens.Code).text}</Text>
          </Box>
        )
      case 'blockquote':
        return (
          <Box key={i} paddingLeft={1} flexDirection="column">
            {renderBlocks((t as Tokens.Blockquote).tokens)}
          </Box>
        )
      case 'list': {
        const l = t as Tokens.List
        return (
          <Box key={i} flexDirection="column">
            {l.items.map((item, j) => (
              <Box key={j}>
                <Text color="cyan">{l.ordered ? `${j + 1}. ` : '• '}</Text>
                <Box flexDirection="column">{renderBlocks(item.tokens)}</Box>
              </Box>
            ))}
          </Box>
        )
      }
      case 'hr':
        return <Text key={i} color="gray">{'─'.repeat(40)}</Text>
      case 'space':
        return null
      case 'html':
        return <Text key={i} color="gray">{(t as Tokens.HTML).text}</Text>
      case 'text': {
        const tt = t as Tokens.Text
        return <Text key={i}>{tt.tokens ? renderInline(tt.tokens) : tt.text}</Text>
      }
      default:
        return <Text key={i}>{(t as { text?: string }).text ?? ''}</Text>
    }
  })
}

export function Markdown({ children }: MarkdownProps): React.ReactElement {
  let tokens: Token[]
  try {
    tokens = marked.lexer(children)
  } catch {
    return <Text>{children}</Text>
  }
  return <Box flexDirection="column">{renderBlocks(tokens)}</Box>
}
