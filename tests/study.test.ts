import { describe, expect, it } from 'vitest'
import { createSeed } from '../src/lib/seed'
import {
  deleteSubject,
  deleteTopic,
  isDue,
  isStudyActive,
  reviewCard,
  scheduleCard,
  setCardSuspended,
  streak,
} from '../src/lib/study'
import { isLibrary } from '../src/lib/validation'

const now = new Date('2026-10-22T12:00:00.000Z')
describe('Sessões e calendário de revisão', () => {
  it.each([
    ['again', '2026-10-23T12:00:00.000Z'],
    ['good', '2026-10-26T12:00:00.000Z'],
    ['easy', '2026-10-29T12:00:00.000Z'],
  ] as const)('agenda %s e só libera o card no prazo exato', (rating, expected) => {
    const card = createSeed().cards[0]
    const scheduled = scheduleCard(card, rating, now)
    expect(scheduled.dueAt).toBe(expected)
    expect(isDue(scheduled, new Date(Date.parse(expected) - 1))).toBe(false)
    expect(isDue(scheduled, new Date(expected))).toBe(true)
    expect(isDue(scheduled, new Date(Date.parse(expected) + 1))).toBe(true)
  })
  it('mantém o horário ao atravessar a virada do ano', () => {
    const scheduled = scheduleCard(createSeed().cards[0], 'easy', new Date('2026-12-28T12:00:00Z'))
    expect(scheduled.dueAt).toBe('2027-01-04T12:00:00.000Z')
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
  it('retira um card das sessões sem mudar seu conteúdo, prazo ou histórico', () => {
    const before = createSeed()
    before.cards[0].dueAt = now.toISOString()
    const after = setCardSuspended(before, before.cards[0].id, true)
    expect(after.cards).toHaveLength(before.cards.length)
    expect(after.cards[0]).toEqual({ ...before.cards[0], suspended: true })
    expect(after.history).toEqual(before.history)
    expect(isStudyActive(after.cards[0])).toBe(false)
    expect(isDue(after.cards[0], new Date('2099-01-01T12:00:00Z'))).toBe(false)
    expect(before.cards[0].suspended).toBeUndefined()
  })
  it('reativa o card com a mesma data de revisão que estava salva', () => {
    const before = createSeed()
    before.cards[0].dueAt = now.toISOString()
    const after = setCardSuspended(
      setCardSuspended(before, before.cards[0].id, true),
      before.cards[0].id,
      false,
    )
    expect(isStudyActive(after.cards[0])).toBe(true)
    expect(isDue(after.cards[0], now)).toBe(true)
    expect(after.cards[0].dueAt).toBe(before.cards[0].dueAt)
    expect(after.history).toEqual(before.history)
    expect(after.cards[1]).toEqual(before.cards[1])
  })
  it('aceita bibliotecas antigas e exige booleano para cards fora das sessões', () => {
    const data = createSeed()
    expect(isLibrary(data)).toBe(true)
    expect(isLibrary(setCardSuspended(data, data.cards[0].id, true))).toBe(true)
    expect(isLibrary(setCardSuspended(data, data.cards[0].id, false))).toBe(true)
    for (const invalid of [null, 'true', 1]) {
      expect(isLibrary({ ...data, cards: [{ ...data.cards[0], suspended: invalid }] })).toBe(false)
    }
  })
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
