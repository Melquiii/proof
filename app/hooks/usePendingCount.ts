import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function usePendingCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { count: n } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .eq('p2_id', user.id)
        .eq('status', 'pending')

      setCount(n ?? 0)

      // Real-time: watch for new pending matches directed at me
      channel = supabase
        .channel('pending-matches')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `p2_id=eq.${user.id}`,
        }, () => fetch())
        .subscribe()
    }

    fetch()
    return () => { channel?.unsubscribe() }
  }, [])

  return count
}
