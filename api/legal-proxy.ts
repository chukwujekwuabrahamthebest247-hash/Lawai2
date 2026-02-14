import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { prompt, scope } = req.body;

  // Grab keys from Vercel Dashboard (NO VITE_ prefix needed here)
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
  const SERPER_KEY = process.env.SERPER_API_KEY;
  const TAVILY_KEY = process.env.TAVILY_API_KEY;

  try {
    // 1. Parallel Research (Serper + Tavily)
    const [serperRes, tavilyRes] = await Promise.all([
      fetch("https://google.serper.dev", {
        method: "POST",
        headers: { "X-API-KEY": SERPER_KEY || "", "Content-Type": "application/json" },
        body: JSON.stringify({ q: prompt })
      }).then(r => r.json()),
      fetch("https://api.tavily.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: TAVILY_KEY || "", query: prompt })
      }).then(r => r.json())
    ]);

    // 2. Process Sources
    const sources = [
      ...(serperRes.organic?.map((s: any) => ({ title: s.title, uri: s.link, snippet: s.snippet })) || []),
      ...(tavilyRes.results?.map((s: any) => ({ title: s.title, uri: s.url, snippet: s.content })) || [])
    ];
    
    const context = sources.map(s => s.snippet).join("\n\n");

    // 3. AI Generation (OpenRouter Free)
    const aiRes = await fetch("https://openrouter.ai", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${OPENROUTER_KEY}`, 
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vercel.com" 
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [
          { 
            role: "system", 
            content: `You are OmniSearch Legal Pro. Scope: ${scope}. Answer using the RESEARCH CONTEXT. Provide specific section citations from the 1999 Nigerian Constitution or LFN if applicable.` 
          },
          { role: "user", content: `RESEARCH CONTEXT:\n${context}\n\nUSER QUERY: ${prompt}` }
        ]
      })
    });

    const data = await aiRes.json();
    
    return res.status(200).json({ 
      text: data.choices?.[0]?.message?.content || "No response.", 
      sources: sources.map(s => ({ title: s.title, uri: s.uri }))
    });

  } catch (error: any) {
    return res.status(500).json({ error: "Research failed on server", details: error.message });
  }
}
