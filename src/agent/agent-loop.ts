// @ts-nocheck — SDK types are complex, using any for pragmatism
import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod/v4'
import path from 'node:path'
import { executeWebSearch, executeReadUrl } from './tool-executors.js'

export interface AgentEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'done' | 'error'
  tool?: string
  input?: any
  result?: string
  content?: string
}

export type AgentEventCallback = (event: AgentEvent) => Promise<void>

const PROJECT_ROOT = path.resolve(process.cwd())
const SKILLS_DIR = path.join(PROJECT_ROOT, 'skills')

export async function runAgentLoop(
  systemPrompt: string,
  userMessage: string,
  onEvent: AgentEventCallback,
): Promise<string> {
  // Define custom tools using the SDK's tool() helper
  const webSearchTool = tool(
    'web_search',
    'Search the internet for information. Use when you need current/factual info.',
    { query: z.string().describe('Search query') },
    async ({ query: q }) => {
      await onEvent({ type: 'tool_call', tool: 'web_search', input: { query: q } })
      const result = await executeWebSearch(q)
      await onEvent({ type: 'tool_result', tool: 'web_search', result: result.slice(0, 200) })
      return { content: [{ type: 'text' as const, text: result }] }
    },
  )

  const readUrlTool = tool(
    'read_url',
    'Read and extract text content from a URL.',
    { url: z.string().describe('URL to read') },
    async ({ url }) => {
      await onEvent({ type: 'tool_call', tool: 'read_url', input: { url } })
      const result = await executeReadUrl(url)
      await onEvent({ type: 'tool_result', tool: 'read_url', result: result.slice(0, 200) })
      return { content: [{ type: 'text' as const, text: result }] }
    },
  )

  // Create MCP server with our tools
  const pptrToolsServer = createSdkMcpServer({
    name: 'pptr-tools',
    alwaysLoad: true,
    tools: [webSearchTool, readUrlTool],
  })

  await onEvent({ type: 'thinking' })

  let fullResponse = ''

  const conversation = query({
    prompt: userMessage,
    options: {
      cwd: PROJECT_ROOT,
      systemPrompt,
      model: process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6',
      effort: 'high',
      maxTurns: 15,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      tools: [],
      mcpServers: { 'pptr-tools': pptrToolsServer },
      env: {
        ...process.env as Record<string, string>,
        CLAUDE_CODE_USE_BEDROCK: '1',
        AWS_REGION: process.env.AWS_REGION ?? 'us-east-1',
      },
      persistSession: false,
      settingSources: [],
    },
  })

  for await (const message of conversation) {
    switch (message.type) {
      case 'assistant': {
        // Full assistant message with content blocks
        const content = message.message?.content
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              fullResponse = block.text
              await onEvent({ type: 'text', content: block.text })
            }
          }
        }
        break
      }

      case 'result': {
        // Final result
        if (message.subtype === 'success') {
          if (message.result && !fullResponse) {
            fullResponse = message.result
          }
        } else if (message.subtype?.startsWith('error')) {
          const errMsg = message.error ?? message.result ?? 'Agent error'
          await onEvent({ type: 'error', content: errMsg })
          if (!fullResponse) fullResponse = JSON.stringify({ action: 'chat', message: `Error: ${errMsg}` })
        }
        break
      }
    }
  }

  await onEvent({ type: 'done' })

  // Parse the response — AI may return JSON wrapped in code fences
  const parsed = tryParseJson(fullResponse)
  return parsed ?? fullResponse
}

function tryParseJson(text: string): any {
  if (!text) return null
  let s = text.trim()
  // Strip markdown code fences
  if (s.startsWith('```json')) s = s.slice(7)
  else if (s.startsWith('```')) s = s.slice(3)
  if (s.endsWith('```')) s = s.slice(0, -3)
  s = s.trim()
  // Extract JSON object
  const first = s.indexOf('{')
  if (first < 0) return null
  if (first > 0) s = s.slice(first)
  const last = s.lastIndexOf('}')
  if (last >= 0 && last < s.length - 1) s = s.slice(0, last + 1)
  // Try strict JSON first
  try { return JSON.parse(s) } catch {}
  // Fix: escape raw newlines inside string values (common with pretty-printed AI output)
  const fixed = s.replace(/(?<=":[ ]*"[^"]*)\n(?=[^"]*")/g, '\\n')
  try { return JSON.parse(fixed) } catch {}
  // Try JSON5 (handles trailing commas, unquoted keys, single quotes, etc.)
  try {
    const JSON5 = require('json5')
    return JSON5.parse(s)
  } catch {}
  // Last resort: Function eval
  try { return new Function(`return (${s})`)() } catch {}
  console.error('[tryParseJson] ALL parsers failed.')
  console.error('  First 200:', s.slice(0, 200))
  console.error('  Last 100:', s.slice(-100))
  console.error('  Length:', s.length)
  return null
}
