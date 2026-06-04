import { z } from 'zod'

export const ThemeSchema = z.object({
  primaryColor: z.string().default('#6366f1'),
  backgroundColor: z.string().default('#ffffff'),
  textColor: z.string().default('#1f2937'),
  headingFont: z.string().default('Inter'),
  bodyFont: z.string().default('Inter'),
})

export const SlideDataSchema = z.object({
  templateId: z.string(),
  content: z.record(z.any()),
  speakerNote: z.string().optional(),
})

export const PresentationSchema = z.object({
  id: z.string(),
  title: z.string(),
  theme: ThemeSchema,
  slides: z.array(SlideDataSchema),
})

export type Theme = z.infer<typeof ThemeSchema>
export type SlideData = z.infer<typeof SlideDataSchema>
export type Presentation = z.infer<typeof PresentationSchema>

export interface SlideTemplate {
  id: string
  name: string
  description: string
  schema: Record<string, any>
  html: string
}

export interface ExportOptions {
  format: 'pptx' | 'pdf' | 'png'
  width?: number
  height?: number
}
