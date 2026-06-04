import { getTemplateList } from '../templates/index.js'

export function getOutlineSystemPrompt(language: string): string {
  const templates = getTemplateList()
  const templateDescriptions = templates
    .map(t => `- "${t.id}": ${t.name} — ${t.description}`)
    .join('\n')

  return `You are a professional presentation designer. Your job is to create an outline for a presentation.

## Available Slide Templates
${templateDescriptions}

## Rules
1. The first slide MUST use template "intro"
2. The last slide MUST use template "ending"
3. Middle slides: choose the best template for the content
4. Each slide should have a clear single focus
5. Generate between 4-8 slides unless the user specifies a number
6. Language: ALL content must be in ${language}
7. For slides using "image-text" template, provide an imageHint describing what image to generate

## Output Format
Respond with ONLY valid JSON, no markdown fences:
{
  "title": "Presentation title",
  "slides": [
    {
      "templateId": "intro",
      "title": "Slide title",
      "keyPoints": ["point 1", "point 2"],
      "imageHint": "optional: description of image needed"
    }
  ]
}`
}

export function getContentSystemPrompt(language: string): string {
  return `You are a presentation content writer. Given a slide outline and its template schema, generate the content that fills the schema.

## Rules
1. Follow the JSON Schema strictly — include all required fields
2. Keep text concise and impactful (presentation style, not essay style)
3. Language: ALL content must be in ${language}
4. For bullet items, aim for 3-5 items unless the schema says otherwise
5. Each bullet/point should be 1-2 short sentences max

## Output Format
Respond with ONLY valid JSON matching the provided schema. No markdown fences.`
}

export function buildOutlineUserPrompt(prompt: string, nSlides?: number): string {
  let msg = `Create a presentation about: ${prompt}`
  if (nSlides) {
    msg += `\n\nGenerate exactly ${nSlides} slides (including intro and ending).`
  }
  return msg
}

export function buildContentUserPrompt(
  slideOutline: { templateId: string; title: string; keyPoints?: string[] | string; imageHint?: string },
  templateSchema: Record<string, any>,
  imageUrl?: string
): string {
  const keyPoints = Array.isArray(slideOutline.keyPoints)
    ? slideOutline.keyPoints.join('; ')
    : (slideOutline.keyPoints ?? '')
  let msg = `## Slide Outline
- Template: ${slideOutline.templateId}
- Title: ${slideOutline.title}
- Key Points: ${keyPoints}

## Template Schema (your output must match this)
${JSON.stringify(templateSchema, null, 2)}`

  if (imageUrl) {
    msg += `\n\n## Image
Use this image URL for any image field: ${imageUrl}`
  }

  return msg
}
