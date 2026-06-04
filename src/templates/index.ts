import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SlideTemplate } from '../types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadTemplate(filename: string): string {
  return fs.readFileSync(path.join(__dirname, filename), 'utf-8')
}

export const templates: SlideTemplate[] = [
  {
    id: 'intro',
    name: 'Intro Slide',
    description: 'Title slide with title, subtitle, author name, date, and optional image',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Main presentation title' },
        subtitle: { type: 'string', description: 'Brief subtitle or tagline' },
        author: { type: 'string', description: 'Presenter name' },
        date: { type: 'string', description: 'Presentation date' },
        imageUrl: { type: 'string', description: 'Optional hero image URL' },
      },
      required: ['title', 'subtitle'],
    },
    html: loadTemplate('intro.html'),
  },
  {
    id: 'bullets',
    name: 'Bullet Points',
    description: 'Numbered list with heading and description for each point (3-5 items)',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Slide title' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              heading: { type: 'string' },
              text: { type: 'string' },
            },
            required: ['text'],
          },
        },
      },
      required: ['title', 'items'],
    },
    html: loadTemplate('bullets.html'),
  },
  {
    id: 'two-column',
    name: 'Two Columns',
    description: 'Split layout with bullet points on left and right sides',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Slide title' },
        leftTitle: { type: 'string', description: 'Left column title' },
        leftItems: { type: 'array', items: { type: 'string' } },
        rightTitle: { type: 'string', description: 'Right column title' },
        rightItems: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'leftItems', 'rightItems'],
    },
    html: loadTemplate('two-column.html'),
  },
  {
    id: 'image-text',
    name: 'Image with Text',
    description: 'Left side text with bullets, right side full-height image',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        bullets: { type: 'array', items: { type: 'string' } },
        imageUrl: { type: 'string', description: 'Image URL for right panel' },
      },
      required: ['title', 'description', 'imageUrl'],
    },
    html: loadTemplate('image-text.html'),
  },
  {
    id: 'ending',
    name: 'Ending Slide',
    description: 'Thank you / closing slide with primary color background',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Closing text like "Thank You"' },
        subtitle: { type: 'string', description: 'Optional subtitle' },
        contactInfo: { type: 'string', description: 'Contact info or CTA' },
      },
      required: ['title'],
    },
    html: loadTemplate('ending.html'),
  },
]

export function getTemplate(id: string): SlideTemplate | undefined {
  return templates.find(t => t.id === id)
}

export function getTemplateList() {
  return templates.map(({ id, name, description, schema }) => ({ id, name, description, schema }))
}
