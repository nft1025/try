export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey      = process.env.AZURE_OPENAI_API_KEY
  const endpoint    = process.env.AZURE_OPENAI_ENDPOINT
  const deployment  = process.env.AZURE_OPENAI_DEPLOYMENT

  if (!apiKey || !endpoint || !deployment) {
    return res.status(500).json({ error: 'Azure OpenAI env vars not configured.' })
  }

  try {
    const { messages, max_tokens } = req.body

    const userMessage = messages[0].content
    const openaiContent = userMessage.map(item => {
      if (item.type === 'text') {
        return { type: 'text', text: item.text }
      }
      if (item.type === 'image') {
        return {
          type: 'image_url',
          image_url: {
            url: `data:${item.source.media_type};base64,${item.source.data}`,
            detail: 'high'
          }
        }
      }
      return null
    }).filter(Boolean)

    const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`

    const openaiRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: openaiContent }],
        max_tokens: max_tokens || 2000,
        temperature: 0.1,
      })
    })

    const data = await openaiRes.json()

    if (data.error) {
      return res.status(500).json({ error: data.error })
    }

    const text = data.choices?.[0]?.message?.content || '{}'
    return res.status(200).json({
      content: [{ type: 'text', text }]
    })

  } catch (err) {
    console.error('Azure OpenAI proxy error:', err)
    return res.status(500).json({ error: err.message })
  }
}
