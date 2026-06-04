import type { LLMProvider, LLMMessage, LLMResponse, LLMOptions } from './types.js'

export interface BedrockClaudeConfig {
  region?: string
  modelId?: string
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
}

export class BedrockClaudeProvider implements LLMProvider {
  name = 'bedrock-claude'
  private region: string
  private modelId: string

  constructor(private config: BedrockClaudeConfig = {}) {
    this.region = config.region ?? process.env.AWS_REGION ?? 'us-east-1'
    this.modelId = config.modelId ?? process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6'
  }

  async chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime')

    const client = new BedrockRuntimeClient({
      region: this.region,
      ...(this.config.accessKeyId && {
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey!,
          sessionToken: this.config.sessionToken,
        },
      }),
    })

    const systemMsg = messages.find(m => m.role === 'system')
    const chatMessages = messages.filter(m => m.role !== 'system')

    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      system: systemMsg?.content ?? '',
      messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
    })

    const command = new InvokeModelCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: new TextEncoder().encode(body),
    })

    const response = await client.send(command)
    const result = JSON.parse(new TextDecoder().decode(response.body))

    return {
      content: result.content[0].text,
      usage: {
        inputTokens: result.usage?.input_tokens ?? 0,
        outputTokens: result.usage?.output_tokens ?? 0,
      },
    }
  }

  async *chatStream(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<string> {
    const { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } = await import('@aws-sdk/client-bedrock-runtime')

    const client = new BedrockRuntimeClient({
      region: this.region,
      ...(this.config.accessKeyId && {
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey!,
          sessionToken: this.config.sessionToken,
        },
      }),
    })

    const systemMsg = messages.find(m => m.role === 'system')
    const chatMessages = messages.filter(m => m.role !== 'system')

    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      system: systemMsg?.content ?? '',
      messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
    })

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: new TextEncoder().encode(body),
    })

    const response = await client.send(command)

    if (response.body) {
      for await (const event of response.body) {
        if (event.chunk?.bytes) {
          const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes))
          if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
            yield chunk.delta.text
          }
        }
      }
    }
  }
}
