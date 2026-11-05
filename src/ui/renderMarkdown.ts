import chalk from 'chalk'

function inline(s: string): string {
  let out = s
    .replace(/`([^`]+)`/g, (_, c) => chalk.yellow(c))
    .replace(/\*\*([^*]+)\*\*/g, (_, c) => chalk.bold(c))
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_, c) => chalk.italic(c))
    .replace(/__([^_]+)__/g, (_, c) => chalk.bold(c))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t) => chalk.blue.underline(t))
  return out
}

export function renderMarkdown(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inCode = false
  let codeBuf: string[] = []

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        out.push(chalk.gray(codeBuf.join('\n')))
        codeBuf = []
        inCode = false
      } else {
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      out.push(chalk.bold.cyan(heading[2]))
      continue
    }

    const quote = /^>\s?(.*)$/.exec(line)
    if (quote) {
      out.push(chalk.gray(`│ ${quote[1]}`))
      continue
    }

    const unordered = /^[-*+]\s+(.*)$/.exec(line)
    if (unordered) {
      out.push(`${chalk.cyan('•')} ${inline(unordered[1])}`)
      continue
    }

    const ordered = /^\d+\.\s+(.*)$/.exec(line)
    if (ordered) {
      out.push(`${chalk.cyan('·')} ${inline(ordered[1])}`)
      continue
    }

    const hr = /^(-{3,}|\*{3,}|_{3,})$/.exec(line)
    if (hr) {
      out.push(chalk.dim('─'.repeat(40)))
      continue
    }

    if (line.trim() === '') {
      out.push('')
      continue
    }

    out.push(inline(line))
  }

  if (inCode && codeBuf.length > 0) {
    out.push(chalk.gray(codeBuf.join('\n')))
  }

  return out.join('\n')
}
