import { db, schema } from '../db/index.js'
import { eq, asc } from 'drizzle-orm'

export async function createResearchRound(projectId: string, goal: string) {
  const [round] = await db.insert(schema.researchRounds).values({
    projectId,
    goal,
  }).returning()
  return round
}

export async function addResearchItem(roundId: string, item: {
  type: string
  query: string
  result?: string
  keyFindings?: string
  parentId?: string
}) {
  const [record] = await db.insert(schema.researchItems).values({
    roundId,
    type: item.type,
    query: item.query,
    result: item.result ?? null,
    keyFindings: item.keyFindings ?? null,
    parentId: item.parentId ?? null,
  }).returning()
  return record
}

export async function updateRoundSummary(roundId: string, summary: string) {
  await db.update(schema.researchRounds).set({ summary }).where(eq(schema.researchRounds.id, roundId))
}

export async function getProjectResearch(projectId: string) {
  const rounds = await db.select().from(schema.researchRounds)
    .where(eq(schema.researchRounds.projectId, projectId))
    .orderBy(asc(schema.researchRounds.createdAt))

  return rounds
}

export async function getProjectResearchSummary(projectId: string): Promise<string> {
  const rounds = await getProjectResearch(projectId)
  if (rounds.length === 0) return ''

  return rounds
    .filter(r => r.summary)
    .map(r => `[研究: ${r.goal}] ${r.summary}`)
    .join('\n\n')
}

export async function saveAsset(projectId: string, asset: {
  type: string
  source: string
  url?: string
  prompt?: string
  metadata?: any
  usedInSlide?: number
}) {
  const [record] = await db.insert(schema.assets).values({
    projectId,
    type: asset.type,
    source: asset.source,
    url: asset.url ?? null,
    prompt: asset.prompt ?? null,
    metadata: asset.metadata ?? null,
    usedInSlide: asset.usedInSlide ?? null,
  }).returning()
  return record
}

export async function getProjectAssets(projectId: string) {
  return db.select().from(schema.assets)
    .where(eq(schema.assets.projectId, projectId))
    .orderBy(asc(schema.assets.createdAt))
}
