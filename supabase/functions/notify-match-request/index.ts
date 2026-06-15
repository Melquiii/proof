// Sends an Expo push notification to p2 when p1 logs a match
// Called from the app immediately after inserting the match row

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  try {
    const { matchId } = await req.json()
    if (!matchId) return new Response('matchId required', { status: 400 })

    const { data: match } = await supabase
      .from('matches')
      .select('*, p1:p1_id(display_name), p2:p2_id(push_token)')
      .eq('id', matchId)
      .single()

    if (!match) return new Response('Match not found', { status: 404 })

    const pushToken = (match.p2 as any)?.push_token
    if (!pushToken) return new Response('No push token', { status: 200 })

    const p1Name = (match.p1 as any)?.display_name ?? 'Someone'

    const message = {
      to: pushToken,
      sound: 'default',
      title: 'Match Request',
      body: `${p1Name} logged a match against you. Confirm the score?`,
      data: { type: 'match_request', matchId },
    }

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })

    const result = await res.json()
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response('Internal error', { status: 500 })
  }
})
