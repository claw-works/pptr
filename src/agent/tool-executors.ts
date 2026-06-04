export async function executeWebSearch(query: string): Promise<string> {
  // Try Tavily first, fallback to a simple fetch-based search
  const tavilyKey = process.env.TAVILY_API_KEY
  if (tavilyKey) {
    return await tavilySearch(query, tavilyKey)
  }
  // Fallback: use DuckDuckGo instant answer API
  return await duckduckgoSearch(query)
}

async function tavilySearch(query: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 5,
      include_answer: true,
    }),
  })
  const data = await res.json()
  let result = ''
  if (data.answer) result += `Summary: ${data.answer}\n\n`
  if (data.results) {
    for (const r of data.results.slice(0, 5)) {
      result += `- ${r.title}: ${r.content?.slice(0, 200)}\n  URL: ${r.url}\n\n`
    }
  }
  return result || 'No results found.'
}

async function duckduckgoSearch(query: string): Promise<string> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`
    const res = await fetch(url)
    const data = await res.json()
    let result = ''
    if (data.Abstract) result += `${data.Abstract}\n\n`
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic.Text) result += `- ${topic.Text}\n`
      }
    }
    return result || `Search completed for "${query}" but no detailed results available. Proceed with your existing knowledge.`
  } catch {
    return `Search unavailable. Proceed with your existing knowledge about "${query}".`
  }
}

export async function executeReadUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; pptr-slides/1.0)' },
    })
    const html = await res.text()
    // Simple HTML to text extraction
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000)
    return text || 'Could not extract content from URL.'
  } catch (err: any) {
    return `Failed to read URL: ${err.message}`
  }
}
