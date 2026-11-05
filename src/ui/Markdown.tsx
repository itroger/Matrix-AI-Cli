import React from 'react'
import { Text } from 'ink'
import { Marked } from 'marked'
import { markedTerminal } from 'marked-terminal'

interface MarkdownProps {
  children: string
}

const marked = new Marked()
marked.use(markedTerminal())

export function Markdown({ children }: MarkdownProps): React.ReactElement {
  const out = marked.parse(children, { async: false }) as string
  return <Text>{out.trim()}</Text>
}
