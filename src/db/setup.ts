import pg from 'pg'

const ADMIN_URL = process.env.DATABASE_ADMIN_URL ?? 'postgresql://dev:dev@localhost:5432/postgres'
const DB_NAME = 'pptr_slides'

async function setup() {
  const client = new pg.Client({ connectionString: ADMIN_URL })
  await client.connect()

  try {
    const result = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`, [DB_NAME]
    )
    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE ${DB_NAME}`)
      console.log(`✓ Database "${DB_NAME}" created`)
    } else {
      console.log(`✓ Database "${DB_NAME}" already exists`)
    }
  } finally {
    await client.end()
  }

  // Now connect to the new db and create tables
  const appClient = new pg.Client({
    connectionString: `postgresql://dev:dev@localhost:5432/${DB_NAME}`
  })
  await appClient.connect()

  try {
    await appClient.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL DEFAULT 'Untitled',
        status TEXT NOT NULL DEFAULT 'draft',
        language TEXT NOT NULL DEFAULT '中文',
        theme JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS slides (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        index INTEGER NOT NULL,
        template_id TEXT NOT NULL,
        content JSONB NOT NULL,
        speaker_note TEXT,
        image_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_slides_project ON slides(project_id, index);
    `)
    console.log('✓ Tables created')
  } finally {
    await appClient.end()
  }
}

setup().catch(err => {
  console.error('Setup failed:', err.message)
  process.exit(1)
})
