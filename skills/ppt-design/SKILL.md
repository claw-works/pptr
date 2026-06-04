---
name: ppt-design
description: Use when creating or designing presentation slides. Covers design principles, color palettes, typography, layout rules, and template usage for professional PPT generation.
---

# PPT Design Skill

You are designing slides for a professional presentation. Follow these principles.

## Available Templates

Use these template IDs when calling the `save_slide` tool:

- `intro` — Title slide with title, subtitle, author, date, optional image
- `bullets` — Numbered list with heading + description per item (3-5 items)
- `two-column` — Split layout with bullet points on left and right
- `image-text` — Left text + right full-height image
- `ending` — Closing slide with primary color background

## Color Palettes — Match the Topic

NEVER default to generic blue. Pick a palette that reflects the content:

| Theme | Primary | Background | Text | Good for |
|-------|---------|------------|------|----------|
| Midnight Executive | #1E2761 | #FFFFFF | #1E2761 | Business, finance |
| Forest & Moss | #2C5F2D | #F5F5F5 | #2C5F2D | Nature, health, sustainability |
| Coral Energy | #F96167 | #FFFFFF | #2F3C7E | Marketing, social media |
| Warm Terracotta | #B85042 | #E7E8D1 | #3D3D3D | Culture, food, lifestyle |
| Ocean Gradient | #065A82 | #FFFFFF | #21295C | Technology, science |
| Charcoal Minimal | #36454F | #F2F2F2 | #212121 | Architecture, design |
| Teal Trust | #028090 | #FFFFFF | #1A1A2E | Healthcare, education |
| Berry & Cream | #6D2E46 | #FCF6F5 | #3D3D3D | Fashion, beauty |
| Sage Calm | #84B59F | #FFFFFF | #2D4739 | Wellness, meditation |
| Cherry Bold | #990011 | #FCF6F5 | #2F3C7E | Urgent, important |

## Content Rules

- Each bullet point: 1-2 short sentences MAX
- 3-5 items per list, never more than 6
- Use concrete numbers and specifics, not vague claims
- Every slide has ONE clear focus
- NEVER repeat the same template on consecutive slides

## Typography

- Slide title: 48-72pt bold
- Body text: 18-22pt
- Keep text concise — presentations are visual, not documents

## Layout Rules

- NEVER create text-only slides — every slide needs visual interest
- Vary layouts: don't use `bullets` three times in a row
- First slide MUST be `intro`, last slide MUST be `ending`
- Use `two-column` for comparisons (pros/cons, before/after)
- Use `image-text` when the topic benefits from visual illustration

## Avoid

- Generic blue color schemes
- Walls of text (max 5 bullet points)
- Repeated layouts on consecutive slides
- Vague content ("solutions" instead of specific features)
- Emoji as bullet markers
