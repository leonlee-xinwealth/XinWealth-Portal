import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('BROADCAST_FROM_EMAIL') ?? 'no-reply@example.com'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonError('Unauthorized', 401)

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return jsonError('Unauthorized', 401)

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const body = await req.json()

    // Mode: process all due scheduled broadcasts
    if (body.mode === 'process_scheduled') {
      const { data: due } = await serviceClient
        .from('broadcasts')
        .select('id')
        .eq('status', 'scheduled')
        .lte('scheduled_at', new Date().toISOString())

      let processed = 0
      for (const b of (due || [])) {
        await sendBroadcast(b.id, serviceClient)
        processed++
      }
      return jsonOk({ processed })
    }

    // Mode: send a specific broadcast
    const { broadcastId } = body
    if (!broadcastId) return jsonError('broadcastId required', 400)

    const { data: adv } = await serviceClient
      .from('advisors')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!adv) return jsonError('Advisor not found', 403)

    const { data: broadcast } = await serviceClient
      .from('broadcasts')
      .select('advisor_id')
      .eq('id', broadcastId)
      .single()
    if (!broadcast || broadcast.advisor_id !== adv.id) return jsonError('Forbidden', 403)

    const result = await sendBroadcast(broadcastId, serviceClient)
    return jsonOk(result)

  } catch (e: any) {
    return jsonError(e?.message ?? 'Internal error', 500)
  }
})

async function sendBroadcast(broadcastId: string, db: ReturnType<typeof createClient>) {
  const { data: broadcast } = await db
    .from('broadcasts')
    .select('*')
    .eq('id', broadcastId)
    .single()
  if (!broadcast) throw new Error('Broadcast not found')

  let query = db
    .from('clients')
    .select('id, full_name, email')
    .eq('advisor_id', broadcast.advisor_id)
    .eq('status', 'active')
    .not('email', 'is', null)

  const filterType: string = broadcast.recipient_filter?.type ?? 'all'

  if (filterType === 'has_insurance') {
    const { data: policyClients } = await db
      .from('insurance_policies')
      .select('client_id')
      .eq('advisor_id', broadcast.advisor_id)
    const ids = [...new Set((policyClients ?? []).map((r: any) => r.client_id as string))]
    if (ids.length === 0) {
      await markSent(db, broadcastId, 0)
      return { sent: 0 }
    }
    query = query.in('id', ids)
  }

  if (filterType === 'has_investment') {
    const { data: allClients } = await db
      .from('clients')
      .select('id')
      .eq('advisor_id', broadcast.advisor_id)
      .eq('status', 'active')
    const allIds = (allClients ?? []).map((c: any) => c.id as string)
    if (allIds.length === 0) { await markSent(db, broadcastId, 0); return { sent: 0 } }

    const { data: assetClients } = await db
      .from('assets')
      .select('client_id')
      .in('client_id', allIds)
    const ids = [...new Set((assetClients ?? []).map((r: any) => r.client_id as string))]
    if (ids.length === 0) { await markSent(db, broadcastId, 0); return { sent: 0 } }
    query = query.in('id', ids)
  }

  const { data: recipients } = await query
  if (!recipients || recipients.length === 0) {
    await markSent(db, broadcastId, 0)
    return { sent: 0 }
  }

  // Resend batch API — max 100 per call
  const BATCH = 100
  let sentCount = 0
  for (let i = 0; i < recipients.length; i += BATCH) {
    const slice = recipients.slice(i, i + BATCH)
    const emails = slice.map((r: any) => ({
      from: FROM_EMAIL,
      to: r.email as string,
      subject: broadcast.title as string,
      html: wrapHtml(broadcast.content as string),
    }))

    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emails),
    })

    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Resend ${res.status}: ${txt}`)
    }
    sentCount += slice.length
  }

  await markSent(db, broadcastId, sentCount)
  return { sent: sentCount }
}

async function markSent(db: ReturnType<typeof createClient>, id: string, count: number) {
  await db
    .from('broadcasts')
    .update({ status: 'sent', sent_at: new Date().toISOString(), recipient_count: count })
    .eq('id', id)
}

function wrapHtml(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;max-width:600px;margin:0 auto;padding:24px">
  <div style="border-bottom:2px solid #1e3a5f;padding-bottom:16px;margin-bottom:24px">
    <span style="font-size:20px;font-weight:700;color:#1e3a5f">Xin<span style="color:#c9a227">Wealth</span></span>
  </div>
  <div style="line-height:1.7;font-size:15px">${content}</div>
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">
    You are receiving this as a XinWealth client. To unsubscribe, please contact your advisor.
  </div>
</body>
</html>`
}

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

function jsonError(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
