export interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, any>
}

export interface ToolResult {
  tool_use_id: string
  content: string
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'web_search',
    description: 'Search the internet for information about a topic. Use this when you need current/factual information to create accurate presentation content.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_url',
    description: 'Read and extract text content from a URL. Use this to get detailed information from a specific webpage.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to read' },
      },
      required: ['url'],
    },
  },
  {
    name: 'analyze_and_plan',
    description: 'After gathering enough information, use this tool to finalize your response. Put your complete JSON response (action + content) in the result field.',
    input_schema: {
      type: 'object',
      properties: {
        result: { type: 'string', description: 'Your final JSON response' },
      },
      required: ['result'],
    },
  },
]
