import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError } from '@/lib/api/response'

const FONNTE_TOKEN = process.env.FONNTE_TOKEN || 'Wvg6rbR5oDRWUtFhcTNq' // ganti dengan token asli

// ─── POST /api/webhook/fonnte/send ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Allow internal calls without auth (for webhook confirmations)
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const { error } = await requireAuth()
    if (error) return error
  } else {
    // TODO: Validate internal token
  }

  try {
    const { target, message } = await req.json()

    if (!target || !message) {
      return apiError('Target dan message diperlukan', 400)
    }

    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': FONNTE_TOKEN,
      },
      body: JSON.stringify({
        target,
        message,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return apiError(`Fonnte API error: ${errorData.message || response.statusText}`, response.status)
    }

    const result = await response.json()
    return apiSuccess(result)

  } catch (err) {
    console.error('Send message error:', err)
    return apiError('Internal server error', 500)
  }
}