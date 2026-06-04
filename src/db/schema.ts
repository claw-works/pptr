import { pgTable, uuid, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core'

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull().default('Untitled'),
  status: text('status').notNull().default('draft'),
  language: text('language').notNull().default('中文'),
  theme: jsonb('theme'),
  outline: jsonb('outline'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const slides = pgTable('slides', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  index: integer('index').notNull(),
  templateId: text('template_id').notNull(),
  content: jsonb('content').notNull(),
  speakerNote: text('speaker_note'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const researchRounds = pgTable('research_rounds', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  goal: text('goal'),
  summary: text('summary'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const researchItems = pgTable('research_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  roundId: uuid('round_id').notNull().references(() => researchRounds.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  type: text('type').notNull(),
  query: text('query').notNull(),
  result: text('result'),
  keyFindings: text('key_findings'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('image'),
  source: text('source').notNull().default('ai_generated'),
  url: text('url'),
  prompt: text('prompt'),
  metadata: jsonb('metadata'),
  usedInSlide: integer('used_in_slide'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
