import React from 'react'
import { Text } from 'ink'
import { Marked } from 'marked'
import { markedTerminal } from 'marked-terminal'
import { highlight } from 'cli-highlight'
import type { Theme } from 'cli-highlight'
import chalk from 'chalk'

interface MarkdownProps {
  children: string
  maxLines?: number
}

const customTerminalTheme: Theme = {
  keyword: chalk.hex('#FF7B72').bold,
  built_in: chalk.hex('#79C0FF'),
  string: chalk.hex('#A5D6FF'),
  number: chalk.hex('#FFA657'),
  comment: chalk.hex('#8B949E').italic,
  function: chalk.hex('#D2A8FF'),
  title: chalk.hex('#FFA657').bold,
  params: chalk.hex('#E6EDF3'),
  attr: chalk.hex('#79C0FF'),
  literal: chalk.hex('#FF7B72'),
}

function renderStyledCodeBlock(rawCode: string, lang = 'text', maxColumns = 80): string {
  const cleanLang = (lang || 'TEXT').trim().toLowerCase()
  const width = Math.min(Math.max(maxColumns - 4, 40), 90)

  let highlighted = rawCode
  try {
    highlighted = highlight(rawCode, {
      language: cleanLang,
      theme: customTerminalTheme,
      ignoreIllegals: true,
    })
  } catch {
    highlighted = rawCode
  }

  const lines = highlighted.split('\n')
  const lineNumWidth = String(lines.length).length

  const badge = chalk.bgHex('#238636').hex('#FFFFFF').bold(` ${cleanLang.toUpperCase()} `)
  const visiblePrefixLen = 5 + cleanLang.length
  const topBorderDashes = Math.max(0, width - visiblePrefixLen - 1)
  const topBar = chalk.gray('╭─ ') + badge + chalk.gray(' ' + '─'.repeat(topBorderDashes) + '╮')

  const bodyLines = lines.map((line, idx) => {
    const lineNum = chalk.hex('#484F58')(String(idx + 1).padStart(lineNumWidth, ' '))
    const separator = chalk.gray(' │ ')
    return `${chalk.gray('│')} ${lineNum}${separator}${line}`
  })

  const bottomBar = chalk.gray('╰' + '─'.repeat(width) + '╯')

  return ['\n', topBar, ...bodyLines, bottomBar, '\n'].join('\n')
}

function createCustomMarked(columns: number): Marked {
  const instance = new Marked()
  instance.use(markedTerminal({
    reflowText: true,
    width: columns,
    showSectionPrefix: false,
  }))
  instance.use({
    renderer: {
      code({ text, lang }: { text: string; lang?: string }) {
        return renderStyledCodeBlock(text, lang, columns)
      },
      codespan({ text }: { text: string }) {
        return chalk.hex('#F0883E')(`\`${text}\``)
      },
    },
  })
  return instance
}

const markedParser = createCustomMarked(process.stdout.columns ?? 80)

export function patchIncompleteMarkdown(text: string): string {
  if (!text) return ''
  let patched = text

  const codeFences = patched.match(/^[ \t]*```/gm) || []
  if (codeFences.length % 2 !== 0) {
    return patched + '\n```'
  }

  const singleBackticks = (patched.match(/(?<!`)`(?!`)/g) || []).length
  if (singleBackticks % 2 !== 0) patched += '`'

  const boldMarkers = (patched.match(/\*\*/g) || []).length
  if (boldMarkers % 2 !== 0) patched += '**'

  const strikeMarkers = (patched.match(/~~/g) || []).length
  if (strikeMarkers % 2 !== 0) patched += '~~'

  return patched
}

export function Markdown({ children, maxLines }: MarkdownProps): React.ReactElement {
  const safe = patchIncompleteMarkdown(children)
  const out = (markedParser.parse(safe, { async: false }) as string).trim()
  if (maxLines && maxLines > 0) {
    const lines = out.split('\n')
    if (lines.length > maxLines) {
      return <Text>{lines.slice(-maxLines).join('\n')}</Text>
    }
  }
  return <Text>{out}</Text>
}
