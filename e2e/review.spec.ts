import { test, expect } from './helpers/fixtures'
import type { Page } from '@playwright/test'
import type { Library } from '../src/lib/types'

const base = new Date('2026-10-22T12:00:00.000Z')
function fixture(): Library {
  const entries = [
    ['a1', 'ta', 'Concordância pendente', -1],
    ['a2', 'ta', 'Concordância futura', 1],
    ['c1', 'tc', 'Crase pendente', -1],
    ['c2', 'tc', 'Crase futura', 1],
    ['h1', 'th', 'História pendente', -1],
    ['h2', 'th', 'História futura', 1],
  ] as const
  return {
    version: 1,
    subjects: [
      { id: 'sa', name: 'Português', icon: 'book', color: 'sage' },
      { id: 'sh', name: 'História', icon: 'landmark', color: 'peach' },
    ],
    topics: [
      { id: 'ta', name: 'Concordância', subjectId: 'sa' },
      { id: 'tc', name: 'Crase', subjectId: 'sa' },
      { id: 'th', name: 'Brasil', subjectId: 'sh' },
    ],
    cards: entries.map(([id, topicId, question, days]) => ({
      id,
      topicId,
      question,
      answer: `Resposta: ${question}`,
      favorite: false,
      createdAt: '2026-10-01T12:00:00.000Z',
      dueAt: new Date(base.getTime() + days * 86400000).toISOString(),
      reviews: 1,
    })),
    history: [],
  }
}
async function preferences(page: Page) {
  const menu = page.getByRole('button', { name: 'Abrir menu' })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('button', { name: 'Preferências', exact: true }).click()
}
async function loadLibrary(page: Page, library = fixture()) {
  await page.clock.install({ time: base })
  await page.goto('/')
  await preferences(page)
  await page.locator('input[type=file]').setInputFiles({
    name: 'review.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(library)),
  })
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Seu próximo passo/ })).toBeVisible()
  await page.getByRole('button', { name: 'Fechar aviso' }).click()
}
async function completeSession(page: Page, count: number) {
  const questions: string[] = []
  for (let index = 0; index < count; index++) {
    await expect(page.locator('.study-progress-head strong')).toHaveText(
      new RegExp(`^${index + 1}\\s+de\\s*${count}$`),
    )
    questions.push(await page.locator('#study-question').innerText())
    await page.locator('.reveal-btn').click()
    await page.getByRole('button', { name: /Lembrei/ }).click()
  }
  await expect(page.getByRole('heading', { name: 'Olha o quanto você aprendeu.' })).toBeVisible()
  return questions.toSorted()
}

test('home study includes all cards, even future ones, and review never falls back to free study', async ({
  page,
}) => {
  const data = fixture()
  await loadLibrary(page, data)
  await expect(page.getByRole('button', { name: 'Revisar 3', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Vamos estudar', exact: true }).click()
  expect(await completeSession(page, 6)).toEqual(data.cards.map((c) => c.question).toSorted())
  await page.getByRole('button', { name: 'Concluir sessão' }).click()
  await expect(page.getByRole('button', { name: 'Revisar 0', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Vamos estudar', exact: true }).click()
  await expect(page.locator('.study-progress-head strong')).toHaveText(/1\s+de\s*6/)
})

test('home review includes only due cards across every subject and topic', async ({ page }) => {
  await loadLibrary(page)
  await page.getByRole('button', { name: 'Revisar 3', exact: true }).click()
  expect(await completeSession(page, 3)).toEqual(
    ['Concordância pendente', 'Crase pendente', 'História pendente'].toSorted(),
  )
  await page.getByRole('button', { name: 'Concluir sessão' }).click()
  await expect(page.getByRole('button', { name: 'Revisar 0', exact: true })).toBeDisabled()
})

for (const scope of [
  { topic: true, total: 2, due: 1 },
  { topic: false, total: 4, due: 2 },
]) {
  test(`subject buttons respect ${scope.topic ? 'the selected topic' : 'all topics'} independently of the list filter`, async ({
    page,
  }) => {
    await loadLibrary(page)
    await page.getByRole('button', { name: /Português.*2 temas/ }).click()
    if (scope.topic) await page.getByRole('button', { name: 'Concordância 2', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Só para revisar' }).check()
    await expect(page.locator('.flashcard-tile')).toHaveCount(scope.due)
    await page.getByRole('button', { name: `Estudar ${scope.total}`, exact: true }).click()
    await expect(page.locator('.study-progress-head strong')).toHaveText(
      new RegExp(`1\\s+de\\s*${scope.total}`),
    )
    await page.getByRole('button', { name: 'Encerrar sessão' }).click()
    await page.getByRole('button', { name: `Revisar ${scope.due}`, exact: true }).click()
    const questions = await completeSession(page, scope.due)
    expect(questions).toEqual(
      (scope.topic
        ? ['Concordância pendente']
        : ['Concordância pendente', 'Crase pendente']
      ).toSorted(),
    )
    await page.getByRole('button', { name: 'Concluir sessão' }).click()
    await expect(page.getByRole('button', { name: 'Revisar 0', exact: true })).toBeDisabled()
    await expect(page.getByRole('heading', { name: 'Revisões em dia por aqui' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: `Estudar ${scope.total}`, exact: true }),
    ).toBeEnabled()
  })
}

for (const rating of [
  { name: 'Preciso rever', days: 1, label: 'Amanhã' },
  { name: 'Lembrei', days: 4, label: 'Em 4 dias' },
  { name: 'Foi fácil', days: 7, label: 'Em 1 semana' },
]) {
  test(`persists ${rating.name} as ${rating.days} days after the assessment`, async ({ page }) => {
    await loadLibrary(page)
    await page.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('Concordância pendente')
    await page.locator('.card-question').click()
    await page.locator('.reveal-btn').click()
    const button = page.getByRole('button', { name: new RegExp(rating.name) })
    await expect(button.locator('small')).toHaveText(rating.label)
    await button.click()
    await expect(page.getByRole('heading', { name: 'Olha o quanto você aprendeu.' })).toBeVisible()
    if (rating.days === 1)
      await expect(page.locator('.study-finished > p')).toContainText(
        '1 card volta para revisão amanhã.',
      )
    await page.getByRole('button', { name: 'Concluir sessão' }).click()
    await page.reload()
    await preferences(page)
    const downloaded = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exportar biblioteca' }).click()
    const stream = await (await downloaded).createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
    const saved = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Library
    expect(saved.history).toHaveLength(1)
    const next = new Date(saved.history[0].at)
    next.setDate(next.getDate() + rating.days)
    expect(saved.cards.find((c) => c.id === 'a1')?.dueAt).toBe(next.toISOString())
    expect(saved.cards.find((c) => c.id === 'a1')?.reviews).toBe(2)
    expect(saved.cards.find((c) => c.id === 'a2')).toEqual(
      fixture().cards.find((c) => c.id === 'a2'),
    )
  })
}

test('review becomes available automatically when a deadline passes without reloading', async ({
  page,
}) => {
  const data = fixture()
  data.cards = data.cards.map((card, index) => ({
    ...card,
    dueAt: new Date(base.getTime() + (index === 0 ? 1 : 7) * 86400000).toISOString(),
  }))
  await loadLibrary(page, data)
  await expect(page.getByRole('button', { name: 'Revisar 0', exact: true })).toBeDisabled()
  await page.clock.fastForward(86400000)
  await expect(page.getByRole('button', { name: 'Revisar 1', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Revisar 1', exact: true }).click()
  await expect(page.locator('#study-question')).toHaveText('Concordância pendente')
  await expect(page.locator('.study-progress-head strong')).toHaveText(/1\s+de\s*1/)
})

async function exportLibrary(page: Page): Promise<Library> {
  await preferences(page)
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar biblioteca' }).click()
  const stream = await (await downloaded).createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Library
}

test('takes a card out of sessions, advances, and keeps it accessible without counting an assessment', async ({
  page,
}) => {
  const data = fixture()
  await loadLibrary(page, data)
  await page.getByRole('button', { name: 'Revisar 3', exact: true }).click()
  const hiddenQuestion = await page.locator('#study-question').innerText()
  await page.locator('.reveal-btn').click()
  await page.getByRole('button', { name: 'Não mostrar mais nas sessões', exact: true }).click()
  const remaining: string[] = []
  for (let index = 2; index <= 3; index++) {
    await expect(page.locator('.study-progress-head strong')).toHaveText(
      new RegExp(`^${index}\\s+de\\s*3$`),
    )
    const question = await page.locator('#study-question').innerText()
    expect(question).not.toBe(hiddenQuestion)
    remaining.push(question)
    await page.locator('.reveal-btn').click()
    await page.getByRole('button', { name: /Lembrei/ }).click()
  }
  await expect(page.getByRole('heading', { name: 'Olha o quanto você aprendeu.' })).toBeVisible()
  await expect(page.locator('.finish-stats strong').first()).toHaveText('2')
  await expect(
    page.getByText('1 card ficou fora das sessões e continua na sua listagem.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Estudar novamente' }).click()
  await expect(page.locator('.study-progress-head strong')).toHaveText(/1\s+de\s*2/)
  expect(remaining).toContain(await page.locator('#study-question').innerText())
  await page.getByRole('button', { name: 'Encerrar sessão' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Revisar 0', exact: true })).toBeDisabled()
  await page.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill(hiddenQuestion)
  await expect(page.locator('.flashcard-tile')).toHaveCount(1)
  await expect(page.getByText('Fora das sessões', { exact: true })).toBeVisible()
  await page.locator('.card-question').click()
  const preview = page.getByRole('dialog', { name: 'Consultar flashcard' })
  await expect(preview.getByText(hiddenQuestion, { exact: true })).toBeVisible()
  await expect(preview.getByText(`Resposta: ${hiddenQuestion}`, { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Sessão de estudo' })).toHaveCount(0)
  await preview.getByRole('button', { name: 'Fechar janela' }).click()
  const saved = await exportLibrary(page)
  const card = saved.cards.find((card) => card.question === hiddenQuestion)!
  expect(card.suspended).toBe(true)
  expect(card.dueAt).toBe(data.cards.find((c) => c.id === card.id)?.dueAt)
  expect(card.reviews).toBe(1)
  expect(saved.history).toHaveLength(2)
  expect(saved.history.some((review) => review.cardId === card.id)).toBe(false)
})

test('excludes imported suspended cards from home, subject, topic, review and favorites sessions', async ({
  page,
}) => {
  const data = fixture()
  data.cards = data.cards.map((card) =>
    card.topicId === 'ta' ? { ...card, suspended: true, favorite: true } : card,
  )
  await loadLibrary(page, data)
  await page.getByRole('button', { name: 'Vamos estudar', exact: true }).click()
  await expect(page.locator('.study-progress-head strong')).toHaveText(/1\s+de\s*4/)
  await page.getByRole('button', { name: 'Encerrar sessão' }).click()
  await page.getByRole('button', { name: 'Revisar 2', exact: true }).click()
  expect(await completeSession(page, 2)).toEqual(['Crase pendente', 'História pendente'].toSorted())
  await page.getByRole('button', { name: 'Concluir sessão' }).click()
  await page.getByRole('button', { name: /Português.*2 temas/ }).click()
  await expect(page.getByRole('button', { name: 'Estudar 2', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Concordância 2', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Estudar 0', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Revisar 0', exact: true })).toBeDisabled()
  await expect(page.locator('.flashcard-tile')).toHaveCount(2)
  const menu = page.getByRole('button', { name: 'Abrir menu' })
  if (await menu.isVisible()) await menu.click()
  await page
    .locator('.main-nav')
    .getByRole('button', { name: /Favoritos/ })
    .click()
  await expect(page.locator('.flashcard-tile')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Estudar favoritos', exact: true })).toBeDisabled()
})

test('can suspend the only card, edit it without reactivating it, and restore its original schedule', async ({
  page,
}) => {
  const data = fixture()
  data.cards = [data.cards[0]]
  await loadLibrary(page, data)
  await page.getByRole('button', { name: 'Revisar 1', exact: true }).click()
  await page.locator('.reveal-btn').click()
  await page.getByRole('button', { name: 'Não mostrar mais nas sessões', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sessão concluída.' })).toBeVisible()
  await expect(page.locator('.finish-stats strong').first()).toHaveText('0')
  await expect(page.getByRole('button', { name: 'Estudar novamente' })).toBeDisabled()
  await page.getByRole('button', { name: 'Concluir sessão' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Vamos estudar', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Revisar 0', exact: true })).toBeDisabled()
  await page.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('Concordância pendente')
  await page.getByRole('button', { name: 'Editar flashcard' }).click()
  await page.getByLabel('Frente A pergunta').fill('Concordância pendente (editada)')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Fora das sessões', { exact: true })).toBeVisible()
  await page.locator('.card-question').click()
  const preview = page.getByRole('dialog', { name: 'Consultar flashcard' })
  await expect(
    preview.getByRole('heading', { name: 'Concordância pendente (editada)', exact: true }),
  ).toBeVisible()
  await preview.getByRole('button', { name: 'Voltar às sessões', exact: true }).click()
  await expect(page.getByText('Para revisar', { exact: true })).toBeVisible()
  const saved = await exportLibrary(page)
  expect(saved.cards[0].suspended).toBe(false)
  expect(saved.cards[0].dueAt).toBe(data.cards[0].dueAt)
  expect(saved.cards[0].reviews).toBe(1)
  expect(saved.history).toHaveLength(0)
})

async function goTo(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Abrir menu' })
  if (await menu.isVisible()) await menu.click()
  await page
    .locator('.main-nav')
    .getByRole('button', { name: new RegExp(name) })
    .click()
}

test('takes a whole topic out of every session while keeping its cards available for consultation', async ({
  page,
}) => {
  const data = fixture()
  data.cards = data.cards.map((card) =>
    card.topicId === 'ta' ? { ...card, favorite: true } : card,
  )
  await loadLibrary(page, data)
  await page.getByRole('button', { name: /Português.*2 temas/ }).click()
  await page.getByRole('button', { name: 'Concordância 2', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Só para revisar' }).check()
  await page.getByRole('button', { name: 'Retirar tema das sessões', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Só para revisar' })).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Estudar 0', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Revisar 0', exact: true })).toBeDisabled()
  await expect(page.locator('.flashcard-tile')).toHaveCount(2)
  await expect(page.locator('.card-suspended')).toHaveText([
    'Tema fora das sessões',
    'Tema fora das sessões',
  ])
  await page.getByRole('button', { name: /Todos os temas/ }).click()
  await expect(page.getByRole('button', { name: 'Estudar 2', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Revisar 1', exact: true })).toBeEnabled()
  await goTo(page, 'Visão geral')
  await page.getByRole('button', { name: 'Vamos estudar', exact: true }).click()
  await expect(page.locator('.study-progress-head strong')).toHaveText(/1\s+de\s*4/)
  await page.getByRole('button', { name: 'Encerrar sessão' }).click()
  await page.getByRole('button', { name: 'Revisar 2', exact: true }).click()
  expect(await completeSession(page, 2)).toEqual(['Crase pendente', 'História pendente'].toSorted())
  await page.getByRole('button', { name: 'Concluir sessão' }).click()
  await goTo(page, 'Favoritos')
  await expect(page.locator('.flashcard-tile')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Estudar favoritos', exact: true })).toBeDisabled()
  await page.locator('.card-question').first().click()
  const preview = page.getByRole('dialog', { name: 'Consultar flashcard' })
  await expect(
    preview.getByText('Este tema está fora das sessões.', { exact: false }),
  ).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Sessão de estudo' })).toHaveCount(0)
  await preview.getByRole('button', { name: 'Fechar janela' }).click()
  const saved = await exportLibrary(page)
  expect(saved.topics.find((topic) => topic.id === 'ta')?.suspended).toBe(true)
  expect(saved.cards.filter((card) => card.topicId === 'ta')).toEqual(
    data.cards.filter((card) => card.topicId === 'ta'),
  )
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar janela' }).click()
  await page.locator('.card-question').first().click()
  await page
    .getByRole('dialog', { name: 'Consultar flashcard' })
    .getByRole('button', { name: 'Reativar tema nas sessões', exact: true })
    .click()
  await expect(page.getByRole('button', { name: 'Estudar favoritos', exact: true })).toBeEnabled()
})

test('keeps newly imported cards out of a suspended topic and preserves individual choices when restoring', async ({
  page,
}) => {
  const data = fixture()
  data.cards[0].suspended = true
  await loadLibrary(page, data)
  await page.getByRole('button', { name: /Português.*2 temas/ }).click()
  await page.getByRole('button', { name: 'Concordância 2', exact: true }).click()
  await page.getByRole('button', { name: 'Retirar tema das sessões', exact: true }).click()
  await page.getByRole('button', { name: 'Inserir em bloco', exact: true }).click()
  await page
    .getByLabel('JSON dos flashcards')
    .fill('[{"pergunta":"Novo do tema retirado","resposta":"Deve ficar apenas na listagem"}]')
  await page.getByRole('button', { name: 'Adicionar 1 card', exact: true }).click()
  await expect(page.locator('.flashcard-tile')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Estudar 0', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Revisar 0', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Editar tema', exact: true }).click()
  await page.getByLabel('Nome do tema').fill('Concordância revisada')
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Reativar tema nas sessões', exact: true }),
  ).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /Português.*2 temas/ }).click()
  await page.getByRole('button', { name: 'Concordância revisada 3', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Estudar 0', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Reativar tema nas sessões', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Estudar 2', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Revisar 1', exact: true })).toBeEnabled()
  await expect(page.locator('.card-suspended')).toHaveText(['Fora das sessões'])
  const saved = await exportLibrary(page)
  expect(saved.topics.find((topic) => topic.id === 'ta')).toMatchObject({
    name: 'Concordância revisada',
    suspended: false,
  })
  expect(saved.cards.find((card) => card.id === 'a1')?.suspended).toBe(true)
  expect(saved.cards.find((card) => card.id === 'a2')).toEqual(data.cards[1])
  expect(saved.cards.find((card) => card.question === 'Novo do tema retirado')?.reviews).toBe(0)
  expect(saved.history).toHaveLength(0)
})
