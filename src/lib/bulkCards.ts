import type { Card } from './types'

export type BulkCardDraft = Pick<Card, 'question' | 'answer'>
export type BulkParseResult = { ok: true; cards: BulkCardDraft[] } | { ok: false; error: string }

export function parseBulkCards(source: string): BulkParseResult {
  const text = source
    .trim()
    .replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1')
    .trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {
      ok: false,
      error: 'JSON inválido. Confira as aspas duplas, as vírgulas e os colchetes.',
    }
  }
  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      error: 'O JSON deve ser uma lista entre colchetes, com um objeto para cada card.',
    }
  }
  if (!parsed.length) return { ok: false, error: 'Adicione pelo menos um item à lista.' }
  const cards: BulkCardDraft[] = []
  for (let index = 0; index < parsed.length; index++) {
    const entry: unknown = parsed[index]
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return {
        ok: false,
        error: `Item ${index + 1}: use um objeto com os campos "pergunta" e "resposta".`,
      }
    }
    const item = entry as Record<string, unknown>
    if (typeof item.pergunta !== 'string' || !item.pergunta.trim()) {
      return { ok: false, error: `Item ${index + 1}: "pergunta" deve ser um texto preenchido.` }
    }
    if (typeof item.resposta !== 'string' || !item.resposta.trim()) {
      return { ok: false, error: `Item ${index + 1}: "resposta" deve ser um texto preenchido.` }
    }
    const question = item.pergunta.trim()
    const answer = item.resposta.trim()
    if (question.length > 2000)
      return { ok: false, error: `Item ${index + 1}: a pergunta deve ter até 2.000 caracteres.` }
    if (answer.length > 10000)
      return { ok: false, error: `Item ${index + 1}: a resposta deve ter até 10.000 caracteres.` }
    cards.push({ question, answer })
  }
  return { ok: true, cards }
}

export function createBulkCards(
  drafts: readonly BulkCardDraft[],
  topicId: string,
  now = new Date(),
): Card[] {
  return drafts.map(({ question, answer }) => ({
    id: crypto.randomUUID(),
    topicId,
    question,
    answer,
    favorite: false,
    createdAt: now.toISOString(),
    dueAt: now.toISOString(),
    reviews: 0,
  }))
}
