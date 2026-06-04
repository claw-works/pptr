import 'dotenv/config'
import { serve } from '@hono/node-server'
import app from './api/index.js'

const port = Number(process.env.PORT ?? 3210)

console.log(`🎨 pptr-slides starting on http://localhost:${port}`)

serve({ fetch: app.fetch, port })

console.log(`✓ API ready`)
console.log(`  GET  /api/templates       - list templates`)
console.log(`  POST /api/preview         - render full HTML`)
console.log(`  POST /api/preview/slide   - render single slide`)
console.log(`  POST /api/export          - export PPTX/PDF/PNG`)
console.log(`  POST /api/generate        - AI generate (placeholder)`)
