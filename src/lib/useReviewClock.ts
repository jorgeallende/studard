import { useEffect, useState } from 'react'
import type { Card, Topic } from './types'
import { getStudyCards } from './study'

// Refresh at the next deadline, at midnight, and when returning to the app.
export function useReviewClock(cards: readonly Card[], topics: readonly Topic[]) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const timestamp = Date.now()
      setNow(timestamp)
      const midnight = new Date(timestamp)
      midnight.setHours(24, 0, 0, 0)
      let next = midnight.getTime()
      for (const card of getStudyCards(cards, topics)) {
        const deadline = Date.parse(card.dueAt)
        if (deadline > timestamp && deadline < next) next = deadline
      }
      timer = setTimeout(refresh, Math.min(next - timestamp + 1, 2_147_483_647))
    }
    const visible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', visible)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [cards, topics])

  return new Date(now)
}
