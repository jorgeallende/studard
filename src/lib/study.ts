import type { Card, Library, Rating } from './types'

export const REVIEW_INTERVALS = {
  again: { days: 1, label: 'Amanhã' },
  good: { days: 4, label: 'Em 4 dias' },
  easy: { days: 7, label: 'Em 1 semana' },
} as const

export function shuffleCards(cards: readonly Card[]): Card[] {
  const shuffled = [...cards]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function isStudyActive(card: Card) {
  return card.suspended !== true
}
export function isDue(card: Card, now = new Date()) {
  return isStudyActive(card) && new Date(card.dueAt).getTime() <= now.getTime()
}
export function setCardSuspended(library: Library, id: string, suspended: boolean): Library {
  return {
    ...library,
    cards: library.cards.map((card) => (card.id === id ? { ...card, suspended } : card)),
  }
}
export function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function scheduleCard(card: Card, rating: Rating, now = new Date()): Card {
  const due = new Date(now)
  due.setDate(due.getDate() + REVIEW_INTERVALS[rating].days)
  return { ...card, dueAt: due.toISOString(), reviews: card.reviews + 1, lastRating: rating }
}
export function reviewCard(
  library: Library,
  cardId: string,
  rating: Rating,
  now = new Date(),
): Library {
  return {
    ...library,
    cards: library.cards.map((card) =>
      card.id === cardId ? scheduleCard(card, rating, now) : card,
    ),
    history: [
      ...library.history,
      { id: crypto.randomUUID(), cardId, rating, at: now.toISOString() },
    ],
  }
}
export function streak(library: Library, now = new Date()) {
  const days = new Set(library.history.map((item) => localDay(new Date(item.at))))
  const date = new Date(now)
  if (!days.has(localDay(date))) date.setDate(date.getDate() - 1)
  let count = 0
  while (days.has(localDay(date))) {
    count++
    date.setDate(date.getDate() - 1)
  }
  return count
}
export function deleteSubject(library: Library, id: string): Library {
  const topicIds = new Set(
    library.topics.filter((topic) => topic.subjectId === id).map((topic) => topic.id),
  )
  return {
    ...library,
    subjects: library.subjects.filter((subject) => subject.id !== id),
    topics: library.topics.filter((topic) => !topicIds.has(topic.id)),
    cards: library.cards.filter((card) => !topicIds.has(card.topicId)),
  }
}
export function deleteTopic(library: Library, id: string): Library {
  return {
    ...library,
    topics: library.topics.filter((topic) => topic.id !== id),
    cards: library.cards.filter((card) => card.topicId !== id),
  }
}
