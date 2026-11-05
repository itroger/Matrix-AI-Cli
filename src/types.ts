export type Role = 'user' | 'assistant'

export interface ChatMessage {
  role: Role
  content: string
}

export interface AgentClientOptions {
  url: string
  timeout?: number
  preferCloud?: boolean
}

export interface CliConfig {
  url: string
}
