import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Presentation } from '../types.js'
import { PresentationSchema } from '../types.js'
import { renderPresentation, renderSlide } from '../renderer/index.js'
import { exportPresentation } from '../exporter/index.js'
import { getTemplateList, getTemplate } from '../templates/index.js'
import { generatePresentation } from '../agent/index.js'
import projectsRouter from './projects.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = new Hono()

app.use('*', cors())

// Projects API
app.route('/api/projects', projectsRouter)

// Serve editor UI (legacy)
app.get('/old-editor', (c) => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'editor', 'index.html'), 'utf-8')
  return c.html(html)
})

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

// List available templates
app.get('/api/templates', (c) => {
  return c.json(getTemplateList())
})

// Get single template detail
app.get('/api/templates/:id', (c) => {
  const template = getTemplate(c.req.param('id'))
  if (!template) return c.json({ error: 'Template not found' }, 404)
  return c.json(template)
})

// Preview a single slide (returns HTML)
app.post('/api/preview/slide', async (c) => {
  const body = await c.req.json()
  const { templateId, content, theme } = body
  const html = renderSlide({ templateId, content }, theme ?? {})
  return c.html(html)
})

// Preview full presentation (returns HTML)
app.post('/api/preview', async (c) => {
  const body = await c.req.json()
  const presentation = PresentationSchema.parse({
    id: body.id ?? crypto.randomUUID(),
    ...body,
  })
  const html = renderPresentation(presentation)
  return c.html(html)
})

// Export presentation (returns file)
app.post('/api/export', async (c) => {
  try {
    const body = await c.req.json()
    const { format = 'pptx', ...rest } = body
    const presentation: Presentation = PresentationSchema.parse({
      id: rest.id ?? crypto.randomUUID(),
      ...rest,
    })

    const buffer = await exportPresentation(presentation, { format })

    const contentTypes: Record<string, string> = {
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      pdf: 'application/pdf',
      png: 'image/png',
    }

    const extensions: Record<string, string> = { pptx: 'pptx', pdf: 'pdf', png: 'png' }
    const filename = `${presentation.title}.${extensions[format]}`

    c.header('Content-Type', contentTypes[format])
    c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    return c.body(buffer as unknown as ArrayBuffer)
  } catch (err: any) {
    console.error('[export error]', err)
    return c.json({ error: err.message, stack: err.stack }, 500)
  }
})

// Generate presentation with AI (streaming SSE)
app.post('/api/generate', async (c) => {
  const body = await c.req.json()
  const { prompt, n_slides, language = '中文', theme } = body

  if (!prompt) {
    return c.json({ error: 'prompt is required' }, 400)
  }

  return streamSSE(c, async (stream) => {
    try {
      const presentation = await generatePresentation({
        prompt,
        nSlides: n_slides,
        language,
        theme,
        onProgress: (event) => {
          stream.writeSSE({ data: JSON.stringify(event), event: 'progress' })
        },
      })
      await stream.writeSSE({ data: JSON.stringify(presentation), event: 'result' })
    } catch (err: any) {
      console.error('[generate error]', err)
      await stream.writeSSE({ data: JSON.stringify({ error: err.message }), event: 'error' })
    }
  })
})

// Generate presentation (non-streaming, simple JSON response)
app.post('/api/generate/sync', async (c) => {
  const body = await c.req.json()
  const { prompt, n_slides, language = '中文', theme } = body

  if (!prompt) {
    return c.json({ error: 'prompt is required' }, 400)
  }

  try {
    const presentation = await generatePresentation({
      prompt,
      nSlides: n_slides,
      language,
      theme,
    })
    return c.json(presentation)
  } catch (err: any) {
    console.error('[generate error]', err)
    return c.json({ error: err.message }, 500)
  }
})

export default app
