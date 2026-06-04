import pg from 'pg'

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://dev:dev@localhost:5432/pptr_slides'

async function migrate() {
  const client = new pg.Client({ connectionString: DB_URL })
  await client.connect()

  try {
    await client.query(`
      -- Research Rounds: each round has a goal and summary
      CREATE TABLE IF NOT EXISTS research_rounds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        goal TEXT,
        summary TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- Research Items: individual search/read operations within a round
      CREATE TABLE IF NOT EXISTS research_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        round_id UUID NOT NULL REFERENCES research_rounds(id) ON DELETE CASCADE,
        parent_id UUID REFERENCES research_items(id) ON DELETE SET NULL,
        type TEXT NOT NULL,
        query TEXT NOT NULL,
        result TEXT,
        key_findings TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- Assets: images, icons, charts generated or collected during creation
      CREATE TABLE IF NOT EXISTS assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'image',
        source TEXT NOT NULL DEFAULT 'ai_generated',
        url TEXT,
        prompt TEXT,
        metadata JSONB,
        used_in_slide INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- Add outline field to projects
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS outline JSONB;

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_research_rounds_project ON research_rounds(project_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_research_items_round ON research_items(round_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id, type);
    `)
    console.log('✓ Migration v2 complete: research_rounds, research_items, assets tables created')
  } finally {
    await client.end()
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
