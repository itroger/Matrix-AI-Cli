import { Command } from 'commander'
import type { CliConfig } from './types.js'

const DEFAULT_URL = 'http://localhost:8000'

export function loadConfig(argv: string[]): CliConfig {
  const program = new Command()
  program
    .option('-u, --url <url>', '本地 Agent 服务地址', process.env.AGENT_URL ?? DEFAULT_URL)
    .helpOption(false)
    .parse(argv)
  const opts = program.opts()
  return { url: String(opts.url).replace(/\/$/, '') }
}
