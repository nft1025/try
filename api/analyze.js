export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server.' })
  }

  try {
    const { messages, max_tokens } = req.body

    const userMessage = messages[0].content
    const parts = userMessage.map(item => {
      if (item.type === 'text') {
        return { text: item.text }
      }
      if (item.type === 'image') {
        return {
          inlineData: {
            mimeType: item.source.media_type,
            data: item.source.data,
          }
        }
      }
      return null
    }).filter(Boolean)

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            maxOutputTokens: max_tokens || 2000,
            temperature: 0.1,
          }
        })
      }
    )

    // Read as text first to avoid JSON parse crash
    const rawText = await geminiRes.text()

    let data
    try {
      data = JSON.parse(rawText)
    } catch (e) {
      return res.status(500).json({ error: `Gemini returned non-JSON: ${rawText.slice(0, 200)}` })
    }

    if (data.error) {
      return res.status(500).json({ error: data.error.message || JSON.stringify(data.error) })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    return res.status(200).json({
      content: [{ type: 'text', text }]
    })

  } catch (err) {
    console.error('Gemini proxy error:', err)
    return res.status(500).json({ error: err.message })
  }
}
