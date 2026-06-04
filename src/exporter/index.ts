import { chromium } from 'playwright'
import PptxGenJS from 'pptxgenjs'
import { PDFDocument } from 'pdf-lib'
import type { Presentation, ExportOptions } from '../types.js'
import { renderPresentation } from '../renderer/index.js'

const DEFAULT_WIDTH = 1920
const DEFAULT_HEIGHT = 1080

export async function exportPresentation(
  presentation: Presentation,
  options: ExportOptions
): Promise<Buffer> {
  const width = options.width ?? DEFAULT_WIDTH
  const height = options.height ?? DEFAULT_HEIGHT
  const html = renderPresentation(presentation)

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
  })

  try {
    const page = await context.newPage()
    await page.setContent(html, { waitUntil: 'networkidle' })

    const slideElements = await page.locator('.slide').all()
    const screenshots: Buffer[] = []

    for (const el of slideElements) {
      const buffer = await el.screenshot({ type: 'png' })
      screenshots.push(buffer)
    }

    switch (options.format) {
      case 'png':
        return screenshots[0]
      case 'pdf':
        return await buildPdf(screenshots, width, height)
      case 'pptx':
        return await buildPptx(screenshots, presentation, width, height)
      default:
        throw new Error(`Unsupported format: ${options.format}`)
    }
  } finally {
    await browser.close()
  }
}

async function buildPdf(screenshots: Buffer[], width: number, height: number): Promise<Buffer> {
  const pdf = await PDFDocument.create()

  for (const png of screenshots) {
    const image = await pdf.embedPng(png)
    const page = pdf.addPage([width, height])
    page.drawImage(image, {
      x: 0,
      y: 0,
      width,
      height,
    })
  }

  const bytes = await pdf.save()
  return Buffer.from(bytes)
}

async function buildPptx(
  screenshots: Buffer[],
  presentation: Presentation,
  width: number,
  height: number
): Promise<Buffer> {
  const pptx = new PptxGenJS()

  const layoutName = `${width}x${height}`
  pptx.defineLayout({ name: layoutName, width: width / 96, height: height / 96 })
  pptx.layout = layoutName
  pptx.title = presentation.title

  for (let i = 0; i < screenshots.length; i++) {
    const slide = pptx.addSlide()
    slide.background = {
      data: `data:image/png;base64,${screenshots[i].toString('base64')}`,
    }
    const note = presentation.slides[i]?.speakerNote
    if (note) {
      slide.addNotes(note)
    }
  }

  const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer
  return buffer
}
