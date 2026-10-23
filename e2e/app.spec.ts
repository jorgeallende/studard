import { test, expect } from './helpers/fixtures'
import type { Page } from '@playwright/test'

async function navigate(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Abrir menu' })
  if (await menu.isVisible()) await menu.click()
  await page.locator('.main-nav').getByRole('button', { name, exact: false }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Seu próximo passo/ })).toBeVisible()
})

test('creates a subject, topic and card; edits, studies, and persists across reload', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Nova matéria', exact: true }).click()
  await page.getByLabel('Nome da matéria').fill('Inglês')
  await page.getByRole('dialog').getByRole('button', { name: 'Criar matéria', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Inglês.' })).toBeVisible()
  await page.getByRole('button', { name: 'Novo tema' }).click()
  await page.getByLabel('Nome do tema').fill('Phrasal verbs')
  await page.getByRole('button', { name: 'Criar tema', exact: true }).click()
  await page.getByRole('button', { name: 'Novo card', exact: true }).click()
  await page.getByLabel('Frente A pergunta').fill('O que significa “keep going”?')
  await page.getByLabel('Verso A resposta').fill('Continuar. Um passo a cada dia!')
  await page.getByRole('button', { name: 'Criar flashcard', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'O que significa “keep going”?' })).toBeVisible()
  await page.getByRole('button', { name: 'Editar flashcard' }).click()
  await page.getByLabel('Verso A resposta').fill('Continuar; seguir em frente.')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await page.getByRole('button', { name: 'Adicionar aos favoritos' }).click()
  await page.getByRole('button', { name: 'Estudar 1', exact: true }).click()
  await page.locator('.reveal-btn').click()
  await expect(page.getByText('Continuar; seguir em frente.')).toBeVisible()
  await page.getByRole('button', { name: /Lembrei/ }).click()
  await expect(page.getByRole('heading', { name: 'Olha o quanto você aprendeu.' })).toBeVisible()
  await page.getByRole('button', { name: 'Concluir sessão' }).click()
  await expect(page.getByText('Em dia', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('keep going')
  await expect(page.locator('.flashcard-tile')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Remover dos favoritos' })).toBeVisible()
})

test('searches answers, filters themes, and toggles favorites', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('Bastilha')
  await expect(page.locator('.flashcard-tile')).toHaveCount(1)
  await expect(
    page.getByRole('heading', { name: 'Em que ano começou a Revolução Francesa?' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Remover dos favoritos' }).click()
  await navigate(page, 'Favoritos')
  await expect(page.locator('.flashcard-tile')).toHaveCount(3)
  await navigate(page, 'Minhas matérias')
  await page.getByRole('button', { name: /Português.*3 temas/ }).click()
  await page.getByRole('button', { name: 'Crase 3', exact: true }).click()
  await expect(page.locator('.flashcard-tile')).toHaveCount(3)
})

test('cancels deletion, then removes descendants of a subject', async ({ page }) => {
  await navigate(page, 'Minhas matérias')
  await page.getByRole('button', { name: 'Excluir Português' }).click()
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Português', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Excluir Português' }).click()
  await page.getByRole('button', { name: 'Sim, excluir', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Português', exact: true })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('concordância')
  await expect(page.locator('.flashcard-tile')).toHaveCount(0)
})

test('can review offline after a fresh reload from the installed service worker', async ({
  page,
  context,
}) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: /Seu próximo passo/ })).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('Você está offline.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Vamos estudar' }).click()
  await page.locator('.reveal-btn').click()
  await page.getByRole('button', { name: /Foi fácil/ }).click()
  await page.getByRole('button', { name: 'Encerrar sessão' }).click()
  await page.reload()
  await navigate(page, 'Meu progresso')
  await expect(page.getByText('revisões realizadas', { exact: true })).toBeVisible()
  await expect(page.locator('.stat-card').first().locator('strong')).toHaveText('1')
  await context.setOffline(false)
})

test('exports and validates backups, and keeps layout within the viewport', async ({ page }) => {
  const menu = page.getByRole('button', { name: 'Abrir menu' })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('button', { name: 'Preferências', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar biblioteca', exact: false }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/studard-.*\.json/)
  await page.locator('input[type=file]').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":1}'),
  })
  await page.getByRole('button', { name: 'Fechar janela' }).click()
  await expect(page.getByText('Arquivo inválido.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Fechar aviso' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: `test-results/dashboard-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  })
})

test('flips the card with the keyboard and records exactly one rating', async ({ page }) => {
  await page.getByRole('button', { name: 'Vamos estudar' }).click()
  const card = page.locator('.flip-card')
  await card.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /Preciso rever/ })).toBeVisible()
  await page.screenshot({
    path: `test-results/study-${test.info().project.name}.png`,
    animations: 'disabled',
  })
  await page.keyboard.press('2')
  await page.keyboard.press('2')
  await page.getByRole('button', { name: 'Encerrar sessão' }).click()
  await navigate(page, 'Meu progresso')
  await expect(page.locator('.stat-card').first().locator('strong')).toHaveText('1')
})

test('preserves both tabs when another tab changes the local library', async ({
  page,
  context,
}) => {
  const second = await context.newPage()
  await second.goto('/')
  await expect(second.getByRole('heading', { name: /Seu próximo passo/ })).toBeVisible()
  await second.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('Bastilha')
  await second.getByRole('button', { name: 'Remover dos favoritos' }).click()
  await expect(
    page.getByText('A biblioteca foi alterada em outra aba.', { exact: false }),
  ).toBeVisible()
  await page.bringToFront()
  await expect(page.getByRole('button', { name: 'Biblioteca com conflito' })).toBeVisible()
  await page.reload()
  await page.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('Bastilha')
  await expect(page.getByRole('button', { name: 'Adicionar aos favoritos' })).toBeVisible()
  await second.close()
})

test('shuffles a theme automatically, reviews each card once, and reshuffles on restart', async ({
  page,
}) => {
  // Deterministic randomness makes the regression reproducible without relying on chance.
  await page.addInitScript(() => {
    Math.random = () => 0
  })
  await page.reload()
  await page.getByRole('button', { name: /Português.*3 temas/ }).click()
  await page.getByRole('button', { name: 'Crase 3', exact: true }).click()
  await expect(page.locator('.card-question h3')).toHaveCount(3)
  const original = await page.locator('.card-question h3').allTextContents()
  await page.getByRole('button', { name: 'Estudar 3', exact: true }).click()
  await expect(page.locator('#study-question')).not.toHaveText(original[0])

  const visited: string[] = []
  for (let index = 0; index < original.length; index++) {
    await expect(page.locator('.study-progress-head strong')).toHaveText(
      new RegExp(`^${index + 1}\\s+de\\s*3$`),
    )
    const question = await page.locator('#study-question').innerText()
    visited.push(question)
    await page.locator('.reveal-btn').click()
    await expect(page.locator('#study-question')).toHaveText(question)
    await page.getByRole('button', { name: /Lembrei/ }).click()
  }
  await expect(page.getByRole('heading', { name: 'Olha o quanto você aprendeu.' })).toBeVisible()
  expect(visited.toSorted()).toEqual(original.toSorted())
  await page.getByRole('button', { name: 'Estudar novamente' }).click()
  await expect(page.locator('#study-question')).not.toHaveText(visited[0])
  await page.getByRole('button', { name: 'Encerrar sessão' }).click()
  await expect(page.locator('.card-question h3')).toHaveText(original)
})
