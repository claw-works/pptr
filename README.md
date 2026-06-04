# pptr-slides

AI-powered presentation generator. Conversation-driven PPT creation with web search, intelligent outlining, and one-click export.

## Features

- **Conversation-driven creation** — Describe what you want, AI researches and proposes outlines, you confirm and iterate
- **Agent with tools** — AI autonomously searches the web, reads pages, and synthesizes information before designing slides
- **3-phase workflow** — Discuss outline → Generate skeleton → Polish with images
- **Research persistence** — All research is stored per-project, no redundant searches
- **Multiple templates** — intro, bullets, two-column, image-text, ending (extensible)
- **Export** — PPTX and PDF via Playwright screenshots + PptxGenJS/pdf-lib
- **Real-time preview** — Live canvas rendering as slides are generated

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Frontend (React + Tailwind + Vite)              │
│  - Project list / Conversation UI / Canvas       │
├─────────────────────────────────────────────────┤
│  Backend (Hono + Node.js)                        │
│  - Agent Loop (Bedrock Claude + Converse API)    │
│  - Tools: web_search, read_url, analyze_and_plan │
│  - Research store + Asset management             │
├─────────────────────────────────────────────────┤
│  PostgreSQL                                      │
│  - projects, messages, slides                    │
│  - research_rounds, research_items, assets       │
├─────────────────────────────────────────────────┤
│  Export Engine                                    │
│  - Playwright → PNG screenshots                  │
│  - PptxGenJS → PPTX / pdf-lib → PDF             │
└─────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL (localhost:5432)
- AWS credentials configured (for Bedrock Claude)
- Playwright browsers: `npx playwright install chromium`

### Setup

```bash
# Install dependencies
bun install
cd web && bun install && cd ..

# Create database
npm run db:setup

# Run migrations
npx tsx src/db/migrate-v2.ts

# Configure environment
cp .env.example .env
# Edit .env with your keys
```

### Run

```bash
# Terminal 1 - Backend (Node.js required for AWS SDK)
npm run dev

# Terminal 2 - Frontend
npm run dev:web
```

Open `http://localhost:5173`

## Environment Variables

```env
# Required
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-6

# Optional
TAVILY_API_KEY=tvly-xxx          # For web search (falls back to DuckDuckGo)
DATABASE_URL=postgresql://dev:dev@localhost:5432/pptr_slides
PORT=3210
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create new project |
| GET | `/api/projects/:id` | Get project detail |
| POST | `/api/projects/:id/chat` | Chat with AI (SSE stream) |
| GET | `/api/projects/:id/slides` | Get project slides |
| GET | `/api/projects/:id/export?format=pptx` | Export presentation |
| GET | `/api/templates` | List available templates |
| POST | `/api/export` | Direct export from JSON |

## Project Structure

```
src/
├── index.ts                 # Entry point
├── types.ts                 # Core types
├── api/
│   ├── index.ts             # Main router
│   └── projects.ts          # Project CRUD + chat endpoint
├── agent/
│   ├── agent-loop.ts        # Multi-step agent with tool use
│   ├── system-skill.ts      # AI system prompt & behavior rules
│   ├── tools.ts             # Tool definitions
│   ├── tool-executors.ts    # Tool implementations
│   ├── research-store.ts    # Persist research to DB
│   ├── pipeline.ts          # Slide content generation pipeline
│   ├── prompts.ts           # Prompt templates
│   └── providers/           # LLM & Image provider abstraction
├── templates/               # HTML slide templates
├── renderer/                # Nunjucks → HTML rendering
├── exporter/                # Playwright → PPTX/PDF export
└── db/                      # Schema + migrations

web/                         # React frontend (Vite)
├── src/pages/
│   ├── ProjectList.tsx      # Project list page
│   ├── CreateSession.tsx    # Conversation + canvas page
│   └── Editor.tsx           # Manual editor (WIP)
```

## License

MIT
