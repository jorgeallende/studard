import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

async function openTheme(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Português.*3 temas/ }).click()
  await page.getByRole('button', { name: 'Crase 3', exact: true }).click()
  await expect(page.locator('.flashcard-tile')).toHaveCount(3)
}

test('inserts the whole JSON into the selected theme, preserves existing cards, and persists after reload', async ({
  page,
}) => {
  await openTheme(page)
  await page.getByRole('button', { name: 'Inserir em bloco', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Inserir cards em bloco' })
  await expect(modal.getByLabel('Tema de destino')).toHaveValue('t2')
  await expect(modal.getByRole('button', { name: 'Adicionar cards', exact: true })).toBeDisabled()
  const items = [
    {
      pergunta: ' O que é uma oração? ',
      resposta: 'É um enunciado organizado em torno de um verbo.\nExemplo: "Ela estudou".',
    },
    {
      pergunta: 'O que é uma locução verbal?',
      resposta: 'É a combinação de dois ou mais verbos com valor de um só.',
    },
  ]
  await modal
    .getByLabel('JSON dos flashcards')
    .fill(`\`\`\`json\n${JSON.stringify(items, null, 2)}\n\`\`\``)
  await expect(modal.getByRole('status')).toHaveText('2 cards prontos para adicionar')
  await expect(
    modal
      .getByRole('region', { name: 'Prévia dos cards' })
      .getByText('O que é uma oração?', { exact: true }),
  ).toBeVisible()
  await modal.getByRole('button', { name: 'Adicionar 2 cards', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.flashcard-tile')).toHaveCount(5)
  await expect(page.getByRole('heading', { name: 'O que é crase?', exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'O que é uma oração?', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Estudar 5', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Concordância verbal 4', exact: true }).click()
  await expect(page.locator('.flashcard-tile')).toHaveCount(4)
  await page.reload()
  await page.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('O que é uma oração?')
  await expect(page.locator('.flashcard-tile')).toHaveCount(1)
  await page.locator('.card-question').click()
  await page.locator('.reveal-btn').click()
  await expect(page.locator('#study-answer')).toHaveText(items[0].resposta)
})

test('requires a destination in All themes and switches to the chosen theme after insertion', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Português.*3 temas/ }).click()
  await page.getByRole('button', { name: 'Inserir em bloco', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Inserir cards em bloco' })
  await expect(modal.getByLabel('Tema de destino')).toHaveValue('')
  await modal
    .getByLabel('JSON dos flashcards')
    .fill('[{"pergunta":"O que é uma antítese?","resposta":"É a aproximação de ideias opostas."}]')
  await expect(modal.getByRole('button', { name: 'Adicionar 1 card', exact: true })).toBeDisabled()
  await modal.getByLabel('Tema de destino').selectOption('t3')
  await modal.getByRole('button', { name: 'Adicionar 1 card', exact: true }).click()
  await expect(page.locator('.topic-tabs > button.selected')).toContainText('Figuras de linguagem')
  await expect(page.locator('.flashcard-tile')).toHaveCount(3)
  await expect(
    page.getByRole('heading', { name: 'O que é uma antítese?', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Crase 3', exact: true }).click()
  await expect(page.locator('.flashcard-tile')).toHaveCount(3)
})

test('rejects malformed batches atomically and lets the user correct the JSON or cancel', async ({
  page,
}) => {
  await openTheme(page)
  await page.getByRole('button', { name: 'Inserir em bloco', exact: true }).click()
  let modal = page.getByRole('dialog', { name: 'Inserir cards em bloco' })
  await modal
    .getByLabel('JSON dos flashcards')
    .fill(
      '[{"pergunta":"Não importar parcialmente","resposta":"Item válido"},{"pergunta":"Incompleto"}]',
    )
  await expect(modal.getByRole('alert')).toContainText('Item 2')
  await expect(modal.getByRole('button', { name: 'Adicionar cards', exact: true })).toBeDisabled()
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.locator('.flashcard-tile')).toHaveCount(3)
  await page.getByRole('button', { name: 'Inserir em bloco', exact: true }).click()
  modal = page.getByRole('dialog', { name: 'Inserir cards em bloco' })
  await expect(modal.getByLabel('JSON dos flashcards')).toHaveValue('')
  await modal
    .getByLabel('JSON dos flashcards')
    .fill('{"pergunta":"Objeto solto","resposta":"Não é uma lista"}')
  await expect(modal.getByRole('alert')).toContainText('lista entre colchetes')
  await modal
    .getByLabel('JSON dos flashcards')
    .fill('[{"pergunta":"Importa depois de corrigir","resposta":"Agora está válido"}]')
  await expect(modal.getByRole('alert')).toHaveCount(0)
  await modal.getByRole('button', { name: 'Adicionar 1 card', exact: true }).click()
  await expect(page.locator('.flashcard-tile')).toHaveCount(4)
  await expect(
    page.getByRole('heading', { name: 'Não importar parcialmente', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Importa depois de corrigir', exact: true }),
  ).toBeVisible()
})
