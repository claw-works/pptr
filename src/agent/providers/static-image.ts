import type { ImageProvider, ImageOptions, ImageResult } from './types.js'

const PLACEHOLDER_IMAGES: Record<string, string> = {
  technology: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',
  business: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
  nature: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80',
  team: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80',
  data: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',
  creative: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80',
  office: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
  abstract: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=800&q=80',
  default: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80',
}

export class StaticImageProvider implements ImageProvider {
  name = 'static'

  async generate(prompt: string, _options?: ImageOptions): Promise<ImageResult> {
    const lowerPrompt = prompt.toLowerCase()
    let category = 'default'

    for (const [key] of Object.entries(PLACEHOLDER_IMAGES)) {
      if (lowerPrompt.includes(key)) {
        category = key
        break
      }
    }

    return { url: PLACEHOLDER_IMAGES[category] }
  }
}
