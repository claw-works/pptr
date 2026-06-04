import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { db, schema } from '../db/index.js'
import { eq, desc, asc } from 'drizzle-orm'
import { getLLMProvider } from '../agent/providers/index.js'
import { exportPresentation } from '../exporter/index.js'
import { getTemplateList } from '../templates/index.js'
import { SYSTEM_SKILL } from '../agent/system-skill.js'
import { runAgentLoop } from '../agent/agent-loop.js'
import { createResearchRound, addResearchItem, updateRoundSummary, getProjectResearchSummary } from '../agent/research-store.js'
import type { Theme } from '../types.js'


const app = new Hono()

// List all projects
app.get('/', async (c) => {
  const result = await db.select().from(schema.projects).orderBy(desc(schema.projects.createdAt))
  return c.json(result)
})

// Create a new project
app.post('/', async (c) => {
  const body = await c.req.json()
  const [project] = await db.insert(schema.projects).values({
    title: body.title ?? '新演示文稿',
    language: body.language ?? '中文',
    theme: body.theme ?? null,
  }).returning()
  return c.json(project)
})

// Get project detail
app.get('/:id', async (c) => {
  const id = c.req.param('id')
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, id))
  if (!project) return c.json({ error: 'Not found' }, 404)
  return c.json(project)
})

// Get project messages
app.get('/:id/messages', async (c) => {
  const id = c.req.param('id')
  const result = await db.select().from(schema.messages)
    .where(eq(schema.messages.projectId, id))
    .orderBy(asc(schema.messages.createdAt))
  return c.json(result)
})

// Get project slides
app.get('/:id/slides', async (c) => {
  const id = c.req.param('id')
  const result = await db.select().from(schema.slides)
    .where(eq(schema.slides.projectId, id))
    .orderBy(asc(schema.slides.index))
  return c.json(result)
})

// Chat endpoint (streaming) - Agent Loop with tools
app.post('/:id/chat', async (c) => {
  const projectId = c.req.param('id')
  const body = await c.req.json()
  const userMessage = body.message

  // Save user message
  await db.insert(schema.messages).values({
    projectId,
    role: 'user',
    content: userMessage,
  })

  // Get project info
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId))
  if (!project) return c.json({ error: 'Project not found' }, 404)

  // Get message history for context
  const history = await db.select().from(schema.messages)
    .where(eq(schema.messages.projectId, projectId))
    .orderBy(asc(schema.messages.createdAt))

  // Get current slides if any
  const currentSlides = await db.select().from(schema.slides)
    .where(eq(schema.slides.projectId, projectId))
    .orderBy(asc(schema.slides.index))

  // Build context
  const templates = getTemplateList()
  const templateInfo = templates.map(t => `- "${t.id}": ${t.name} — ${t.description}`).join('\n')

  let contextSection = ''
  if (currentSlides.length > 0) {
    contextSection = `\n\n## Current Presentation State
Title: "${project.title}"
Total pages generated: ${currentSlides.length}
Slides:
${currentSlides.map(s => `  [Page ${s.index + 1}] template="${s.templateId}" title="${(s.content as any)?.title ?? ''}"`).join('\n')}

Next page to generate: Page ${currentSlides.length + 1}`
  } else if (project.outline) {
    const outline = project.outline as any
    contextSection = `\n\n## Confirmed Outline (ready for Phase 2)
Title: "${outline.title ?? project.title}"
Pages planned: ${outline.slides?.length ?? 0}
${(outline.slides ?? []).map((s: any, i: number) => `  [Page ${i + 1}] ${s.title}`).join('\n')}

No pages generated yet. Start with Page 1.`
  }

  // Inject existing research
  const existingResearch = await getProjectResearchSummary(projectId)
  let researchContext = ''
  if (existingResearch) {
    researchContext = `\n\n## Previously Researched Knowledge\n${existingResearch}\n\nDo NOT re-search topics already covered above.`
  }

  const systemPrompt = SYSTEM_SKILL + `\n\n## Available Templates\n${templateInfo}` + contextSection +
    researchContext +
    `\n\n## Language\nRespond and generate content in: ${project.language ?? '中文'}` +
    `\n\nUse web_search when you need current/factual info. Respond with valid JSON.`

  // Build user prompt with conversation history
  const historyContext = history.slice(-10).map(m => `[${m.role}]: ${m.content}`).join('\n\n')
  const fullUserMessage = historyContext
    ? `Previous conversation:\n${historyContext}\n\nCurrent message: ${userMessage}`
    : userMessage

  return streamSSE(c, async (stream) => {
    try {
      // Create research round for this chat turn
      let currentRound: any = null
      let lastSearchItemId: string | null = null

      const rawResult = await runAgentLoop(systemPrompt, fullUserMessage, async (event) => {
        if (event.type === 'thinking') {
          await stream.writeSSE({ data: JSON.stringify({ type: 'progress', stage: 'thinking' }), event: 'message' })
        } else if (event.type === 'tool_call') {
          await stream.writeSSE({ data: JSON.stringify({ type: 'progress', stage: 'tool_call', tool: event.tool, input: event.input }), event: 'message' })

          // Persist research
          if (event.tool === 'web_search' || event.tool === 'read_url') {
            if (!currentRound) {
              currentRound = await createResearchRound(projectId, userMessage)
            }
            const item = await addResearchItem(currentRound.id, {
              type: event.tool === 'web_search' ? 'search' : 'read_url',
              query: event.tool === 'web_search' ? event.input?.query : event.input?.url,
              parentId: event.tool === 'read_url' ? (lastSearchItemId ?? undefined) : undefined,
            })
            if (event.tool === 'web_search') lastSearchItemId = item.id
          }
        } else if (event.type === 'tool_result') {
          await stream.writeSSE({ data: JSON.stringify({ type: 'progress', stage: 'tool_result', tool: event.tool, result: event.result }), event: 'message' })
        }
      })

      // Parse the result
      let parsed: any
      if (typeof rawResult === 'object' && rawResult !== null) {
        parsed = rawResult
      } else {
        const resultStr = String(rawResult)
        parsed = parseJsonPermissive(resultStr)
        if (!parsed) {
          parsed = { action: 'chat', message: resultStr }
        }
      }
      console.log('[chat] parsed action:', parsed.action)

      // Save research round summary if we did any research
      if (currentRound) {
        const summary = parsed.message?.slice(0, 500) ?? parsed.title ?? ''
        await updateRoundSummary(currentRound.id, summary)
      }

      if (parsed.action === 'chat') {
        let chatContent = parsed.message ?? ''
        // Final safety: if chatContent is still JSON-like, extract message
        if (typeof chatContent !== 'string') chatContent = String(chatContent)
        if (chatContent.trim().startsWith('{') && chatContent.includes('"message"')) {
          try { chatContent = JSON.parse(chatContent).message ?? chatContent } catch {}
        }
        if (!chatContent) chatContent = String(rawResult)
        console.log('[chat] sending content (first 100):', chatContent.slice(0, 100))
        await stream.writeSSE({ data: JSON.stringify({ type: 'text', content: chatContent }), event: 'message' })
        await db.insert(schema.messages).values({ projectId, role: 'assistant', content: chatContent })

      } else if (parsed.action === 'generate' || parsed.action === 'generate_all') {
        const aiTheme: Theme = {
          primaryColor: parsed.theme?.primaryColor ?? '#6366f1',
          backgroundColor: parsed.theme?.backgroundColor ?? '#ffffff',
          textColor: parsed.theme?.textColor ?? '#1f2937',
          headingFont: parsed.theme?.headingFont ?? 'Inter',
          bodyFont: parsed.theme?.bodyFont ?? 'Inter',
        }
        const outline = parsed.slides ?? []
        const title = parsed.title ?? '演示文稿'

        // Content fill: parallel
        await stream.writeSSE({ data: JSON.stringify({ type: 'progress', stage: 'generating', total: outline.length }), event: 'message' })

        const llm = getLLMProvider()
        const imageProvider = (await import('../agent/providers/index.js')).getImageProvider()

        const slideResults = await Promise.all(outline.map(async (slideOutline: any, index: number) => {
          const template = templates.find(t => t.id === slideOutline.templateId)
          if (!template) {
            return { templateId: 'bullets', content: { title: slideOutline.title, items: [{ text: slideOutline.title }] } }
          }

          let imageUrl: string | undefined
          if (slideOutline.imageHint && slideOutline.templateId === 'image-text') {
            const img = await imageProvider.generate(slideOutline.imageHint)
            imageUrl = img.url
          }

          const contentRes = await llm.chat([
            { role: 'system', content: 'You generate slide content as JSON. Output ONLY valid JSON, no markdown fences.' },
            { role: 'user', content: `Generate content for slide.\nTemplate: ${template.id} (${template.name})\nTitle: ${slideOutline.title}\nKey Points: ${(slideOutline.keyPoints || []).join('; ')}\n${imageUrl ? `Image URL: ${imageUrl}` : ''}\n\nSchema:\n${JSON.stringify(template.schema, null, 2)}\n\nLanguage: ${project.language ?? '中文'}` },
          ], { temperature: 0.5, maxTokens: 1024 })

          let content: any
          try { content = JSON.parse(cleanJson(contentRes.content)) } catch { content = { title: slideOutline.title } }
          if (imageUrl && !content.imageUrl) content.imageUrl = imageUrl

          await stream.writeSSE({ data: JSON.stringify({ type: 'progress', stage: 'slide_done', slideIndex: index, title: content.title || slideOutline.title }), event: 'message' })

          return { templateId: slideOutline.templateId, content, speakerNote: (slideOutline.keyPoints || []).join('\n') }
        }))

        // Save to DB
        await db.update(schema.projects).set({ title, status: 'completed', theme: aiTheme, updatedAt: new Date() }).where(eq(schema.projects.id, projectId))
        await db.delete(schema.slides).where(eq(schema.slides.projectId, projectId))
        await db.insert(schema.slides).values(slideResults.map((s: any, i: number) => ({ projectId, index: i, templateId: s.templateId, content: s.content, speakerNote: s.speakerNote ?? null })))

        const responseText = `已生成 "${title}"，共 ${slideResults.length} 页。\n\n` +
          slideResults.map((s: any, i: number) => `${i + 1}. ${s.content?.title ?? s.templateId}`).join('\n') +
          '\n\n您可以告诉我需要修改哪些部分。'

        await stream.writeSSE({ data: JSON.stringify({ type: 'text', content: responseText }), event: 'message' })
        const slidesForFrontend = slideResults.map((s: any, i: number) => ({ index: i, templateId: s.templateId, content: s.content }))
        await stream.writeSSE({ data: JSON.stringify({ type: 'slides_update', slides: slidesForFrontend }), event: 'message' })
        await db.insert(schema.messages).values({ projectId, role: 'assistant', content: responseText, metadata: { slides: slidesForFrontend } })

      } else if (parsed.action === 'generate_slide') {
        // Single page generation (Phase 2 - page by page)
        const slideIndex = parsed.slideIndex ?? currentSlides.length
        const templateId = parsed.templateId ?? 'bullets'
        const content = parsed.content ?? { title: 'Untitled' }
        const speakerNote = parsed.speakerNote ?? null

        // Upsert slide at this index
        const existing = currentSlides.find(s => s.index === slideIndex)
        if (existing) {
          await db.update(schema.slides).set({
            templateId, content, speakerNote, updatedAt: new Date(),
          }).where(eq(schema.slides.id, existing.id))
        } else {
          await db.insert(schema.slides).values({
            projectId, index: slideIndex, templateId, content, speakerNote,
          })
        }

        // Update project status
        await db.update(schema.projects).set({ status: 'generating', updatedAt: new Date() }).where(eq(schema.projects.id, projectId))

        // Send slide update to frontend
        const allSlides = await db.select().from(schema.slides)
          .where(eq(schema.slides.projectId, projectId))
          .orderBy(asc(schema.slides.index))
        const slidesForFrontend = allSlides.map(s => ({
          index: s.index, templateId: s.templateId, content: s.content,
        }))
        await stream.writeSSE({ data: JSON.stringify({ type: 'slides_update', slides: slidesForFrontend }), event: 'message' })

        // Send chat message
        const msg = parsed.message ?? `第 ${slideIndex + 1} 页已生成。`
        await stream.writeSSE({ data: JSON.stringify({ type: 'text', content: msg }), event: 'message' })
        await db.insert(schema.messages).values({ projectId, role: 'assistant', content: msg })

      } else if (parsed.action === 'modify_slide') {
        // Modify an existing page
        const slideIndex = parsed.slideIndex ?? 0
        const existing = currentSlides.find(s => s.index === slideIndex)
        if (existing) {
          const updatedContent = { ...(existing.content as any), ...parsed.content }
          await db.update(schema.slides).set({
            content: updatedContent, updatedAt: new Date(),
          }).where(eq(schema.slides.id, existing.id))

          // Send updated slides
          const allSlides = await db.select().from(schema.slides)
            .where(eq(schema.slides.projectId, projectId))
            .orderBy(asc(schema.slides.index))
          const slidesForFrontend = allSlides.map(s => ({
            index: s.index, templateId: s.templateId, content: s.content,
          }))
          await stream.writeSSE({ data: JSON.stringify({ type: 'slides_update', slides: slidesForFrontend }), event: 'message' })
        }

        const msg = parsed.message ?? `第 ${slideIndex + 1} 页已更新。`
        await stream.writeSSE({ data: JSON.stringify({ type: 'text', content: msg }), event: 'message' })
        await db.insert(schema.messages).values({ projectId, role: 'assistant', content: msg })

      } else if (parsed.action === 'modify') {
        const msg = parsed.message ?? '请告诉我具体要修改哪一页的什么内容。'
        await stream.writeSSE({ data: JSON.stringify({ type: 'text', content: msg }), event: 'message' })
        await db.insert(schema.messages).values({ projectId, role: 'assistant', content: msg })
      }

    } catch (err: any) {
      console.error('[chat error]', err)
      await stream.writeSSE({ data: JSON.stringify({ type: 'text', content: `处理失败: ${err.message}` }), event: 'message' })
    }
  })
})

function cleanJson(text: string): string {
  let s = text.trim()
  // Remove markdown code fences
  if (s.startsWith('```json')) s = s.slice(7)
  else if (s.startsWith('```')) s = s.slice(3)
  if (s.endsWith('```')) s = s.slice(0, -3)
  s = s.trim()
  // If there's text before the first {, strip it
  const firstBrace = s.indexOf('{')
  if (firstBrace > 0) s = s.slice(firstBrace)
  // If there's text after the last }, strip it
  const lastBrace = s.lastIndexOf('}')
  if (lastBrace >= 0 && lastBrace < s.length - 1) s = s.slice(0, lastBrace + 1)
  return s
}

function parseJsonPermissive(text: string): any {
  const cleaned = cleanJson(text)
  // Try strict parse first
  try { return JSON.parse(cleaned) } catch {}
  // Try fixing common issues: unescaped quotes inside strings
  // Replace Chinese quotes that break JSON
  const fixed = cleaned
    .replace(/(?<=:\s*"[^"]*)"(?=[^"]*"[^"]*(?:,|\}))/g, '\\"')
  try { return JSON.parse(fixed) } catch {}
  // Last resort: eval-safe approach with Function
  try {
    return new Function(`return (${cleaned})`)()
  } catch {}
  return null
}

// Export project
app.get('/:id/export', async (c) => {
  const projectId = c.req.param('id')
  const format = (c.req.query('format') ?? 'pptx') as 'pptx' | 'pdf' | 'png'

  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId))
  if (!project) return c.json({ error: 'Not found' }, 404)

  const slideRecords = await db.select().from(schema.slides)
    .where(eq(schema.slides.projectId, projectId))
    .orderBy(asc(schema.slides.index))

  if (slideRecords.length === 0) return c.json({ error: 'No slides' }, 400)

  const theme: Theme = (project.theme as Theme) ?? {
    primaryColor: '#6366f1',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    headingFont: 'Inter',
    bodyFont: 'Inter',
  }

  const presentation = {
    id: projectId,
    title: project.title,
    theme,
    slides: slideRecords.map(s => ({
      templateId: s.templateId,
      content: s.content as Record<string, any>,
      speakerNote: s.speakerNote ?? undefined,
    })),
  }

  const buffer = await exportPresentation(presentation, { format })

  const contentTypes: Record<string, string> = {
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    pdf: 'application/pdf',
    png: 'image/png',
  }

  c.header('Content-Type', contentTypes[format])
  c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(project.title)}.${format}"`)
  return c.body(buffer as unknown as ArrayBuffer)
})

export default app
