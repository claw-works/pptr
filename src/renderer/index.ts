import nunjucks from 'nunjucks'
import type { Presentation, SlideData, Theme } from '../types.js'
import { getTemplate } from '../templates/index.js'

const env = new nunjucks.Environment(null, { autoescape: false })

export function renderSlide(slide: SlideData, theme: Theme): string {
  const template = getTemplate(slide.templateId)
  if (!template) {
    throw new Error(`Template not found: ${slide.templateId}`)
  }
  return env.renderString(template.html, { content: slide.content, theme })
}

export function renderPresentation(presentation: Presentation): string {
  const slidesHtml = presentation.slides
    .map(slide => renderSlide(slide, presentation.theme))
    .join('\n')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1920" />
  <title>${presentation.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(presentation.theme.headingFont)}:wght@400;600;700&family=${encodeURIComponent(presentation.theme.bodyFont)}:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #f0f0f0; }
    .slide { page-break-after: always; }
  </style>
</head>
<body>
${slidesHtml}
</body>
</html>`
}
