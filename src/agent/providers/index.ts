import type { LLMProvider, ImageProvider } from './types.js'
import { BedrockClaudeProvider } from './bedrock-claude.js'
import { StaticImageProvider } from './static-image.js'

export type { LLMProvider, ImageProvider, LLMMessage, LLMResponse, LLMOptions, ImageOptions, ImageResult } from './types.js'

let llmProvider: LLMProvider | null = null
let imageProvider: ImageProvider | null = null

export function getLLMProvider(): LLMProvider {
  if (!llmProvider) {
    llmProvider = new BedrockClaudeProvider()
  }
  return llmProvider
}

export function setLLMProvider(provider: LLMProvider) {
  llmProvider = provider
}

export function getImageProvider(): ImageProvider {
  if (!imageProvider) {
    imageProvider = new StaticImageProvider()
  }
  return imageProvider
}

export function setImageProvider(provider: ImageProvider) {
  imageProvider = provider
}
