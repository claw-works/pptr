import type { Presentation, SlideData, Theme } from '../types.js'
import type { LLMMessage } from './providers/types.js'
import { getLLMProvider, getImageProvider } from './providers/index.js'
import { getTemplate } from '../templates/index.js'
import {
  getOutlineSystemPrompt,
  getContentSystemPrompt,
  buildOutlineUserPrompt,
  buildContentUserPrompt,
} from './prompts.js'

export interface GenerateOptions {
  prompt: string
  nSlides?: number
  language?: string
  theme?: Partial<Theme>
  onProgress?: (event: ProgressEvent) => void
}

export interface ProgressEvent {
  stage: 'outline' | 'content' | 'image' | 'done'
  slideIndex?: number
  totalSlides?: number
  data?: any
}

interface SlideOutline {
  templateId: string
  title: string
  keyPoints: string[]
  imageHint?: string
}

interface OutlineResult {
  title: string
  slides: SlideOutline[]
}

export async function generatePresentation(options: GenerateOptions): Promise<Presentation> {
  const { prompt, nSlides, language = '中文', theme: themeOverride, onProgress } = options
  const llm = getLLMProvider()
  const imageProvider = getImageProvider()

  // Step 1: Generate outline
  onProgress?.({ stage: 'outline' })

  const outlineMessages: LLMMessage[] = [
    { role: 'system', content: getOutlineSystemPrompt(language) },
    { role: 'user', content: buildOutlineUserPrompt(prompt, nSlides) },
  ]

  const outlineResponse = await llm.chat(outlineMessages, {
    temperature: 0.7,
    maxTokens: 2048,
    jsonMode: true,
  })

  const outline: OutlineResult = JSON.parse(cleanJsonResponse(outlineResponse.content))

  onProgress?.({
    stage: 'outline',
    totalSlides: outline.slides.length,
    data: outline,
  })

  // Step 2: Generate images for slides that need them (parallel)
  const imageUrls: (string | undefined)[] = await Promise.all(
    outline.slides.map(async (slide) => {
      if (slide.imageHint && slide.templateId === 'image-text') {
        onProgress?.({ stage: 'image', slideIndex: outline.slides.indexOf(slide) })
        const result = await imageProvider.generate(slide.imageHint)
        return result.url
      }
      return undefined
    })
  )

  // Step 3: Generate content for each slide (parallel)
  const slideContents: SlideData[] = await Promise.all(
    outline.slides.map(async (slideOutline, index) => {
      onProgress?.({
        stage: 'content',
        slideIndex: index,
        totalSlides: outline.slides.length,
      })

      const template = getTemplate(slideOutline.templateId)
      if (!template) {
        const points = Array.isArray(slideOutline.keyPoints) ? slideOutline.keyPoints : []
        return {
          templateId: 'bullets',
          content: { title: slideOutline.title, items: points.map(p => ({ text: p })) },
        }
      }

      const contentMessages: LLMMessage[] = [
        { role: 'system', content: getContentSystemPrompt(language) },
        {
          role: 'user',
          content: buildContentUserPrompt(slideOutline, template.schema, imageUrls[index]),
        },
      ]

      const contentResponse = await llm.chat(contentMessages, {
        temperature: 0.5,
        maxTokens: 1024,
        jsonMode: true,
      })

      const content = JSON.parse(cleanJsonResponse(contentResponse.content))

      const notes = Array.isArray(slideOutline.keyPoints)
        ? slideOutline.keyPoints.join('\n')
        : (slideOutline.keyPoints ?? '')

      return {
        templateId: slideOutline.templateId,
        content,
        speakerNote: notes,
      }
    })
  )

  // Build final presentation
  const theme: Theme = {
    primaryColor: themeOverride?.primaryColor ?? '#6366f1',
    backgroundColor: themeOverride?.backgroundColor ?? '#ffffff',
    textColor: themeOverride?.textColor ?? '#1f2937',
    headingFont: themeOverride?.headingFont ?? 'Inter',
    bodyFont: themeOverride?.bodyFont ?? 'Inter',
  }

  const presentation: Presentation = {
    id: crypto.randomUUID(),
    title: outline.title,
    theme,
    slides: slideContents,
  }

  onProgress?.({ stage: 'done', data: presentation })

  return presentation
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  return cleaned.trim()
}
