import React from 'react'
import { Text } from 'ink'
import { Marked } from 'marked'
import { markedTerminal } from 'marked-terminal'

interface MarkdownProps {
  children: string
}

export function Markdown({ children }: MarkdownProps): React.ReactElement {
  const marked = new Marked()
  marked.use(markedTerminal())
  const out = marked.parse(children, { async: false }) as string
  return <Text>{out.trim()}</Text>
}
