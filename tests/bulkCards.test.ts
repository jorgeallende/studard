import { describe, expect, it } from 'vitest'
import { createBulkCards, parseBulkCards } from '../src/lib/bulkCards'
import { createSeed } from './fixtures/library'
import { isLibrary } from '../src/lib/validation'

const valid = [
  { pergunta: '  O que é crase?  ', resposta: '  Fusão de duas vogais.\nExemplo: "à escola".  ' },
]
describe('Inserção de flashcards em bloco', () => {
  it('preserva acentos, aspas e quebras de linha, removendo apenas espaços nas bordas', () => {
    expect(parseBulkCards(JSON.stringify(valid))).toEqual({
      ok: true,
      cards: [
        { question: 'O que é crase?', answer: 'Fusão de duas vogais.\nExemplo: "à escola".' },
      ],
    })
  })
  it('aceita o JSON copiado com o bloco de código de uma resposta da IA', () => {
    expect(parseBulkCards(`\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\`\n`)).toEqual(
      parseBulkCards(JSON.stringify(valid)),
    )
  })
  it.each([
    '',
    '[',
    '{}',
    'null',
    '[]',
    '[1]',
    '[null]',
    '[[]]',
    '[{"pergunta":12,"resposta":"x"}]',
    '[{"pergunta":" ","resposta":"x"}]',
    '[{"pergunta":"x","resposta":false}]',
    '[{"pergunta":"x"}]',
  ])('recusa conteúdo inválido: %s', (source) => {
    expect(parseBulkCards(source).ok).toBe(false)
  })
  it('recusa o bloco inteiro e identifica o item inválido', () => {
    const result = parseBulkCards(JSON.stringify([...valid, { pergunta: 'x', resposta: '' }]))
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('Item 2') })
    expect(result).not.toHaveProperty('cards')
  })
  it('respeita os mesmos limites de pergunta e resposta do editor', () => {
    expect(parseBulkCards(JSON.stringify([{ pergunta: 'x'.repeat(2001), resposta: 'x' }])).ok).toBe(
      false,
    )
    expect(
      parseBulkCards(JSON.stringify([{ pergunta: 'x', resposta: 'x'.repeat(10001) }])).ok,
    ).toBe(false)
    expect(
      parseBulkCards(JSON.stringify([{ pergunta: 'x'.repeat(2000), resposta: 'x'.repeat(10000) }]))
        .ok,
    ).toBe(true)
  })
  it('cria cards novos no tema de destino sem aceitar metadados do JSON', () => {
    const input = [
      {
        ...valid[0],
        id: 'nao-usar',
        topicId: 'outro-tema',
        favorite: true,
        suspended: true,
        reviews: 99,
      },
    ]
    const parsed = parseBulkCards(JSON.stringify(input))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const now = new Date('2026-10-23T12:00:00Z')
    const cards = createBulkCards([...parsed.cards, ...parsed.cards], 't2', now)
    expect(new Set(cards.map((card) => card.id)).size).toBe(2)
    for (const card of cards) {
      expect(card).toMatchObject({
        topicId: 't2',
        favorite: false,
        reviews: 0,
        createdAt: now.toISOString(),
        dueAt: now.toISOString(),
      })
      expect(card.id).not.toBe('nao-usar')
      expect(card.suspended).toBeUndefined()
    }
    const library = createSeed()
    const combined = { ...library, cards: [...library.cards, ...cards] }
    expect(isLibrary(combined)).toBe(true)
    expect(combined.cards.slice(0, library.cards.length)).toEqual(library.cards)
  })
})
