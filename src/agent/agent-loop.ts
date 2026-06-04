// @ts-nocheck
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod/v4'
import type { LLMMessage } from './providers/types.js'
import { executeWebSearch, executeReadUrl } from './tool-executors.js'

export interface AgentEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'done'
  tool?: string
  input?: any
  result?: string
  content?: string
}

export type AgentEventCallback = (event: AgentEvent) => Promise<void>

const getClient = () => new AnthropicBedrock({
  awsRegion: process.env.AWS_REGION ?? 'us-east-1',
})

const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6'

export async function runAgentLoop(
  messages: LLMMessage[],
  onEvent: AgentEventCallback,
): Promise<any> {
  const client = getClient()

  const systemPrompt = messages.find(m => m.role === 'system')?.content ?? ''
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  await onEvent({ type: 'thinking' })

  const webSearchTool = betaZodTool({
    name: 'web_search',
    description: 'Search the internet for information about a topic. Use when you need current/factual information.',
    inputSchema: z.object({
      query: z.string().describe('Search query'),
    }),
    run: async ({ query }) => {
      await onEvent({ type: 'tool_call', tool: 'web_search', input: { query } })
      const result = await executeWebSearch(query)
      await onEvent({ type: 'tool_result', tool: 'web_search', result: result.slice(0, 200) })
      return result
    },
  })

  const readUrlTool = betaZodTool({
    name: 'read_url',
    description: 'Read and extract text content from a URL.',
    inputSchema: z.object({
      url: z.string().describe('URL to read'),
    }),
    run: async ({ url }) => {
      await onEvent({ type: 'tool_call', tool: 'read_url', input: { url } })
      const result = await executeReadUrl(url)
      await onEvent({ type: 'tool_result', tool: 'read_url', result: result.slice(0, 200) })
      return result
    },
  })

  // Tool Runner handles the loop: call API → detect tool_use → run function → feed result back → repeat
  // When Claude stops calling tools and just outputs text, the loop ends
  const finalMessage = await client.beta.messages.toolRunner({
    model: MODEL_ID,
    max_tokens: 4096,
    system: systemPrompt,
    tools: [webSearchTool, readUrlTool],
    messages: chatMessages,
  })

  await onEvent({ type: 'done' })

  // Extract final text response (the JSON output from AI)
  for (const block of finalMessage.content) {
    if (block.type === 'text' && block.text.trim()) {
      try {
        return JSON.parse(cleanJson(block.text))
      } catch {
        return block.text
      }
    }
  }

  return { action: 'chat', message: 'No response generated.' }
}

function cleanJson(text: string): string {
  let s = text.trim()
  if (s.startsWith('```json')) s = s.slice(7)
  else if (s.startsWith('```')) s = s.slice(3)
  if (s.endsWith('```')) s = s.slice(0, -3)
  s = s.trim()
  const firstBrace = s.indexOf('{')
  if (firstBrace > 0) s = s.slice(firstBrace)
  const lastBrace = s.lastIndexOf('}')
  if (lastBrace >= 0 && lastBrace < s.length - 1) s = s.slice(0, lastBrace + 1)
  return s
}
