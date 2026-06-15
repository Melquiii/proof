// Sends an Expo push notification to p2 when p1 logs a match.
// Requires: valid JWT in Authorization header, caller must be match.p1_id, match must be pending.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  try {
    // 1. Verify caller JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401 })

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await callerClient.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    // 2. Validate input
    const { matchId } = await req.json()
    if (!matchId || typeof matchId !== 'string') return new Response('matchId required', { status: 400 })
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_RE.test(matchId)) return new Response('Invalid matchId', { status: 400 })

    // 3. Load match via service client (bypasses RLS for the push_tokens join)
    const { data: match } = await serviceClient
      .from('matches')
      .select('p1_id, p2_id, status, p1:p1_id(display_name)')
      .eq('id', matchId)
      .single()

    if (!match) return new Response('Match not found', { status: 404 })

    // 4. Caller must be p1, match must still be pending
    if (match.p1_id !== user.id) return new Response('Forbidden', { status: 403 })
    if (match.status !== 'pending') return new Response('Match not pending', { status: 409 })

    // 5. Fetch p2 push token from the restricted table (service role reads it)
    const { data: tokenRow } = await serviceClient
      .from('push_tokens')
      .select('token')
      .eq('user_id', match.p2_id)
      .single()

    if (!tokenRow?.token) return new Response(JSON.stringify({ ok: true, sent: false }), {
      headers: { 'Content-Type': 'application/json' },
    })

    const p1Name = (match.p1 as any)?.display_name ?? 'Someone'

    // 6. Send — do not return Expo's response body to caller
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: tokenRow.token,
        sound: 'default',
        title: 'Match Request',
        body: `${p1Name} logged a match against you. Confirm the score?`,
        data: { type: 'match_request', matchId },
      }),
    })

    return new Response(JSON.stringify({ ok: true, sent: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response('Internal error', { status: 500 })
  }
})
