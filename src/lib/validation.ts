import type { Library } from './types'
const colors = ['sage', 'blue', 'peach', 'lilac', 'yellow']
const ratings = ['again', 'good', 'easy']
const text = (value: unknown, max = 10000): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
export function isLibrary(input: unknown): input is Library {
  if (!input || typeof input !== 'object') return false
  const data = input as Library
  if (
    data.version !== 1 ||
    !Array.isArray(data.subjects) ||
    !Array.isArray(data.topics) ||
    !Array.isArray(data.cards) ||
    !Array.isArray(data.history)
  )
    return false
  if (
    !data.subjects.every(
      (s) =>
        s && text(s.id, 100) && text(s.name, 80) && colors.includes(s.color) && text(s.icon, 30),
    )
  )
    return false
  const subjects = new Set(data.subjects.map((s) => s.id))
  if (subjects.size !== data.subjects.length) return false
  if (
    !data.topics.every(
      (t) =>
        t &&
        text(t.id, 100) &&
        text(t.name, 80) &&
        subjects.has(t.subjectId) &&
        (t.suspended === undefined || typeof t.suspended === 'boolean'),
    )
  )
    return false
  const topics = new Set(data.topics.map((t) => t.id))
  if (topics.size !== data.topics.length) return false
  if (
    !data.cards.every(
      (c) =>
        c &&
        text(c.id, 100) &&
        topics.has(c.topicId) &&
        text(c.question, 2000) &&
        text(c.answer) &&
        typeof c.favorite === 'boolean' &&
        (c.suspended === undefined || typeof c.suspended === 'boolean') &&
        date(c.createdAt) &&
        date(c.dueAt) &&
        Number.isInteger(c.reviews) &&
        c.reviews >= 0 &&
        (!c.lastRating || ratings.includes(c.lastRating)),
    )
  )
    return false
  if (new Set(data.cards.map((c) => c.id)).size !== data.cards.length) return false
  return data.history.every(
    (h) => h && text(h.id, 100) && text(h.cardId, 100) && date(h.at) && ratings.includes(h.rating),
  )
}
