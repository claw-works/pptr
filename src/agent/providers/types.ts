export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMResponse {
  content: string
  usage?: { inputTokens: number; outputTokens: number }
}

export interface LLMProvider {
  name: string
  chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>
  chatStream(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<string>
}

export interface LLMOptions {
  temperature?: number
  maxTokens?: number
  jsonMode?: boolean
}

export interface ImageProvider {
  name: string
  generate(prompt: string, options?: ImageOptions): Promise<ImageResult>
}

export interface ImageOptions {
  width?: number
  height?: number
  style?: string
}

export interface ImageResult {
  url: string
  base64?: string
}
