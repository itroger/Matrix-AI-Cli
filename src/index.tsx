import React from 'react'
import { render } from 'ink'
import { loadConfig } from './config.js'
import { AgentClient } from './agent/client.js'
import { App } from './ui/App.js'

function main() {
  const config = loadConfig(process.argv)
  const client = new AgentClient({ url: config.url })
  render(<App client={client} />)
}

main()
