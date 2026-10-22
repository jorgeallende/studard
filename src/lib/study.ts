import type { Card, Library, Rating } from './types'

export function isDue(card: Card, now = new Date()) {
  return new Date(card.dueAt).getTime() <= now.getTime()
}
export function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function scheduleCard(card: Card, rating: Rating, now = new Date()): Card {
  const due = new Date(now)
  if (rating === 'again') due.setMinutes(due.getMinutes() + 10)
  else due.setDate(due.getDate() + (rating === 'good' ? 1 : 4))
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
