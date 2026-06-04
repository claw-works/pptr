// @ts-nocheck
import type { LLMMessage } from './providers/types.js'
import { AGENT_TOOLS } from './tools.js'
import { executeWebSearch, executeReadUrl } from './tool-executors.js'

export interface AgentEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'done'
  tool?: string
  input?: any
  result?: string
  content?: string
}

export type AgentEventCallback = (event: AgentEvent) => Promise<void>

const MAX_ITERATIONS = 8

export async function runAgentLoop(
  messages: LLMMessage[],
  onEvent: AgentEventCallback,
): Promise<string> {
  const { BedrockRuntimeClient, ConverseCommand } = await import('@aws-sdk/client-bedrock-runtime')

  const region = process.env.AWS_REGION ?? 'us-east-1'
  const modelId = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6'

  const client = new BedrockRuntimeClient({ region })

  // Convert our messages format to Converse API format
  const systemPrompt = messages.find(m => m.role === 'system')?.content ?? ''
  const conversationMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: [{ text: m.content }],
    }))

  // Tool config for Converse API
  const toolConfig = {
    tools: AGENT_TOOLS.map(t => ({
      toolSpec: {
        name: t.name,
        description: t.description,
        inputSchema: { json: t.input_schema },
      },
    })),
  }

  let iteration = 0
  let finalResult = ''

  while (iteration < MAX_ITERATIONS) {
    iteration++

    await onEvent({ type: 'thinking' })

    const command = new ConverseCommand({
      modelId,
      system: [{ text: systemPrompt }],
      messages: conversationMessages,
      toolConfig,
      inferenceConfig: { maxTokens: 4096, temperature: 0.7 },
    })

    const response = await client.send(command)
    const output = response.output?.message

    if (!output) break

    // Add assistant response to conversation
    conversationMessages.push(output)

    // Process content blocks
    const contentBlocks = output.content ?? []
    let hasToolUse = false
    const toolResults: any[] = []

    let hasAnalyzePlan = false
    for (const block of contentBlocks) {
      if (block.text && !hasAnalyzePlan) {
        await onEvent({ type: 'text', content: block.text })
        finalResult = block.text
      }

      if (block.toolUse) {
        hasToolUse = true
        const toolName = block.toolUse.name!
        const toolInput = block.toolUse.input as any
        const toolUseId = block.toolUse.toolUseId!

        await onEvent({ type: 'tool_call', tool: toolName, input: toolInput })

        let toolResult = ''
        if (toolName === 'web_search') {
          toolResult = await executeWebSearch(toolInput.query)
        } else if (toolName === 'read_url') {
          toolResult = await executeReadUrl(toolInput.url)
        } else if (toolName === 'analyze_and_plan') {
          hasAnalyzePlan = true
          // toolInput.result may be string or object depending on SDK parsing
          if (typeof toolInput.result === 'object' && toolInput.result !== null) {
            finalResult = toolInput.result // already parsed object
          } else {
            try {
              finalResult = JSON.parse(toolInput.result)
            } catch {
              finalResult = toolInput.result
            }
          }
          toolResult = 'Done.'
        }

        await onEvent({ type: 'tool_result', tool: toolName, result: toolResult.slice(0, 200) })

        toolResults.push({
          toolResult: {
            toolUseId,
            content: [{ text: toolResult }],
          },
        })
      }
    }

    // If no tool use, we're done
    if (!hasToolUse) {
      break
    }

    // Send ALL tool results in a single user message
    if (toolResults.length > 0) {
      conversationMessages.push({
        role: 'user' as const,
        content: toolResults,
      })
    }

    // If analyze_and_plan was called, we're done
    if (contentBlocks.some((b: any) => b.toolUse?.name === 'analyze_and_plan')) {
      break
    }
  }

  await onEvent({ type: 'done' })
  return finalResult
}
