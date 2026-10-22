import { describe, expect, it } from 'vitest'
import { createSeed } from '../src/lib/seed'
import {
  deleteSubject,
  deleteTopic,
  isDue,
  reviewCard,
  scheduleCard,
  streak,
} from '../src/lib/study'
import { isLibrary } from '../src/lib/validation'

const now = new Date('2026-10-22T12:00:00.000Z')
describe('Sessões e calendário de revisão', () => {
  it('agenda respostas difíceis para dez minutos e as outras para dias futuros', () => {
    const card = createSeed().cards[0]
    expect(scheduleCard(card, 'again', now).dueAt).toBe('2026-10-22T12:10:00.000Z')
    expect(scheduleCard(card, 'good', now).dueAt).toBe('2026-10-23T12:00:00.000Z')
    expect(scheduleCard(card, 'easy', now).dueAt).toBe('2026-10-26T12:00:00.000Z')
    expect(isDue(scheduleCard(card, 'again', now), now)).toBe(false)
  })
  it('registra uma revisão sem alterar os outros cards', () => {
    const before = createSeed()
    const after = reviewCard(before, before.cards[0].id, 'good', now)
    expect(after.history).toHaveLength(1)
    expect(after.cards[0].reviews).toBe(1)
    expect(after.cards[1]).toEqual(before.cards[1])
    expect(before.history).toHaveLength(0)
  })
  it('conta dias consecutivos e preserva a sequência antes de estudar hoje', () => {
    let data = createSeed()
    for (const date of ['2026-10-20T12:00:00Z', '2026-10-21T12:00:00Z', '2026-10-21T13:00:00Z'])
      data = reviewCard(data, data.cards[0].id, 'good', new Date(date))
    expect(streak(data, now)).toBe(2)
    expect(streak(reviewCard(data, data.cards[0].id, 'easy', now), now)).toBe(3)
    expect(streak(data, new Date('2026-10-24T12:00:00Z'))).toBe(0)
  })
})
describe('Integridade da biblioteca', () => {
  it('remove os temas e cards descendentes ao excluir uma matéria', () => {
    const before = createSeed()
    const topicIds = before.topics.filter((t) => t.subjectId === 's1').map((t) => t.id)
    const after = deleteSubject(before, 's1')
    expect(after.topics.some((t) => t.subjectId === 's1')).toBe(false)
    expect(after.cards.some((c) => topicIds.includes(c.topicId))).toBe(false)
    expect(after.cards.length).toBeGreaterThan(0)
    expect(isLibrary(after)).toBe(true)
  })
  it('exclui apenas os cards do tema selecionado', () => {
    const after = deleteTopic(createSeed(), 't1')
    expect(after.cards.some((c) => c.topicId === 't1')).toBe(false)
    expect(after.cards.some((c) => c.topicId === 't2')).toBe(true)
    expect(isLibrary(after)).toBe(true)
  })
  it('recusa backups inválidos, duplicados e referências quebradas', () => {
    const data = createSeed()
    expect(isLibrary(data)).toBe(true)
    expect(isLibrary({ ...data, cards: [...data.cards, data.cards[0]] })).toBe(false)
    expect(isLibrary({ ...data, subjects: [] })).toBe(false)
    expect(isLibrary({ ...data, cards: [{ ...data.cards[0], dueAt: 'x' }] })).toBe(false)
    expect(isLibrary({ ...data, cards: [{ ...data.cards[0], question: '' }] })).toBe(false)
    expect(isLibrary(null)).toBe(false)
    expect(isLibrary({ version: 1 })).toBe(false)
  })
})
