export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  // ── Same-origin guard ──
  // Only allow requests coming from this app itself (or local dev).
  // Interim protection until the bar app has login; prevents off-site
  // callers from burning the Anthropic API key.
  const hostOf = (u) => { try { return new URL(u).host } catch { return '' } }
  const host = req.headers.host || ''
  const originHost = hostOf(req.headers.origin || '')
  const refererHost = hostOf(req.headers.referer || '')
  const isLocal = [host, originHost, refererHost].some((h) => h.startsWith('localhost') || h.startsWith('127.0.0.1'))
  const sameOrigin = (originHost && originHost === host) || (refererHost && refererHost === host)
  if (!sameOrigin && !isLocal) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const { base64, mediaType } = req.body

    if (!base64 || !mediaType) {
      return res.status(400).json({ error: 'Missing base64 or mediaType' })
    }

    const isImage = mediaType !== 'application/pdf'
    const prompt = `You are a restaurant invoice parser. Extract ALL line items from this invoice. Return ONLY valid JSON, no markdown, no explanation:
{
  "supplier": "string",
  "invoiceDate": "YYYY-MM-DD",
  "invoiceNumber": "string or null",
  "items": [
    {
      "rawName": "ITEM NAME AS SHOWN ON INVOICE",
      "sku": "ITEM/PRODUCT CODE from item number column (e.g. MEAT768, CHEE083) or null",
      "packSize": "PACK SIZE as shown on invoice (e.g. 6/#10, 35 LB, 4/1 GAL, 12/4 OZ) or null",
      "qty": 1,
      "unit": "each",
      "unitCost": 0.00,
      "totalCost": 0.00,
      "category": "one of: Proteins, Dairy, Produce, Bread & Pasta, Grocery, Herbs & Spices, Condiments, Desserts, Beverages, Paper & Packaging, Cleaning Supplies, Kitchen Equipment"
    }
  ],
  "invoiceTotal": 0.00
}`

    const content = isImage
      ? [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: prompt },
        ]
      : [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: prompt },
        ]

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        messages: [{ role: 'user', content }],
      }),
    })

    const data = await response.json()

    if (data.error) {
      return res.status(500).json({ error: data.error.message })
    }

    const text = data.content?.find((b) => b.type === 'text')?.text || ''

    // Try to extract JSON from the response
    let parsed = null
    const attempts = [
      text.trim(),
      text.replace(/```json/g, '').replace(/```/g, '').trim(),
      text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1),
    ]

    for (const attempt of attempts) {
      try {
        parsed = JSON.parse(attempt)
        break
      } catch {}
    }

    if (!parsed) {
      return res.status(500).json({ error: 'Could not parse invoice', raw: text.slice(0, 500) })
    }

    return res.status(200).json(parsed)
  } catch (err) {
    console.error('Invoice scan error:', err)
    return res.status(500).json({ error: err.message || 'Unknown error' })
  }
}
