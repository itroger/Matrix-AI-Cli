import React from 'react'
import { Text } from 'ink'
import { renderMarkdown } from './renderMarkdown.js'

interface MarkdownProps {
  children: string
}

export function Markdown({ children }: MarkdownProps): React.ReactElement {
  return <Text>{renderMarkdown(children)}</Text>
}
