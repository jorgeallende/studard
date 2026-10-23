import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { Library } from '../src/lib/types'
import { createSeed } from '../tests/fixtures/library'

import { mockAuth } from './helpers/mockAuth'

async function openAccount(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('textbox', { name: 'Seu e-mail' })).toBeVisible()
}

test('signs in with a password, preserves the session across reload, and signs out', async ({
  page,
}) => {
  const calls = await mockAuth(page)
  await openAccount(page)
  await page.getByLabel('Seu e-mail').fill('estudante@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-estudo')
  await page.getByRole('button', { name: 'Mostrar senha' }).click()
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Ocultar senha' }).click()
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tudo sincronizado' })).toBeVisible()
  expect(calls.find((c) => c.path.endsWith('/token'))?.body).toMatchObject({
    email: 'estudante@example.com',
    password: 'senha-de-estudo',
  })
  expect(calls.some((c) => c.path.endsWith('/otp'))).toBe(false)
  await page.reload()
  await page.getByRole('button', { name: 'Minha conta', exact: true }).click()
  await expect(page.getByText('Conta conectada', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sair desta conta' }).click()
  await expect(
    page.getByRole('button', { name: 'Entrar na minha conta', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.sidebar')).toHaveCount(0)
})

test('opens study with the first click during a background library refresh', async ({ page }) => {
  const library = createSeed()
  await mockAuth(page, { library })
  await openAccount(page)
  await page.getByLabel('Seu e-mail').fill('estudante@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-estudo')
  await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tudo sincronizado' })).toBeVisible()

  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/rest/v1/study_libraries*', async (route) => {
    await gate
    await route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: [{ content: library, revision: 1 }],
    })
  })
  try {
    const refresh = page.waitForRequest((request) =>
      request.url().includes('/rest/v1/study_libraries'),
    )
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await refresh
    const start = page.getByRole('button', { name: 'Vamos estudar', exact: true })
    await expect(start).toBeVisible({ timeout: 1500 })
    await start.click()
    await expect(page.getByRole('dialog', { name: 'Sessão de estudo' })).toBeVisible()
    release()
    await expect(page.getByRole('button', { name: 'Tudo sincronizado' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Sessão de estudo' })).toBeVisible()
  } finally {
    release()
  }
})

test('creates an account and signs in immediately without an e-mail step', async ({ page }) => {
  const calls = await mockAuth(page)
  await openAccount(page)
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await page.getByLabel('Seu e-mail').fill('estudante@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-estudo')
  await page.getByLabel('Confirmar senha').fill('senha-de-estudo')
  await page.getByRole('button', { name: 'Criar minha conta', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tudo sincronizado' })).toBeVisible()
  expect(calls.find((c) => c.path.endsWith('/signup'))?.body).toMatchObject({
    email: 'estudante@example.com',
    password: 'senha-de-estudo',
  })
  expect(calls.some((c) => c.path.endsWith('/otp'))).toBe(false)
})

test('shows incorrect credentials without closing the form or creating an account', async ({
  page,
}) => {
  const calls = await mockAuth(page, { invalidPassword: true })
  await openAccount(page)
  await page.getByLabel('Seu e-mail').fill('estudante@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-errada')
  await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos')
  await expect(
    page.getByRole('button', { name: 'Entrar na minha conta', exact: true }),
  ).toBeEnabled()
  expect(calls.some((c) => c.path.endsWith('/signup'))).toBe(false)
})

test('rejects different passwords locally and clears password fields when changing modes', async ({
  page,
}) => {
  const calls = await mockAuth(page)
  await openAccount(page)
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await page.getByLabel('Seu e-mail').fill('estudante@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-estudo')
  await page.getByLabel('Confirmar senha').fill('outra-senha')
  await page.getByRole('button', { name: 'Criar minha conta', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('As senhas não coincidem')
  expect(calls.some((c) => c.path.endsWith('/signup'))).toBe(false)
  await page
    .getByRole('group', { name: 'Tipo de acesso' })
    .getByRole('button', { name: 'Entrar', exact: true })
    .click()
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Seu e-mail')).toHaveValue('estudante@example.com')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('does not report a successful signup when Supabase still requires confirmation', async ({
  page,
}) => {
  await mockAuth(page, { confirmationRequired: true })
  await openAccount(page)
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await page.getByLabel('Seu e-mail').fill('estudante@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-estudo')
  await page.getByLabel('Confirmar senha').fill('senha-de-estudo')
  await page.getByRole('button', { name: 'Criar minha conta', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Desative a confirmação de e-mail no Supabase',
  )
  await expect(page.getByRole('button', { name: 'Criar minha conta', exact: true })).toBeEnabled()
  await expect(page.locator('.sidebar')).toHaveCount(0)
})

test('keeps edits saved while an older background library response is in flight', async ({
  page,
}) => {
  const library = createSeed()
  await mockAuth(page, { library })
  await openAccount(page)
  await page.getByLabel('Seu e-mail').fill('estudante@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-estudo')
  await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tudo sincronizado' })).toBeVisible()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/rest/v1/study_libraries*', async (route) => {
    await gate
    await route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: [{ content: library, revision: 1 }],
    })
  })
  await page.route('**/rest/v1/rpc/save_study_library', (route) =>
    route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: 2 }),
  )
  try {
    const refresh = page.waitForRequest((request) =>
      request.url().includes('/rest/v1/study_libraries'),
    )
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await refresh
    await page
      .getByRole('textbox', { name: 'Buscar na biblioteca' })
      .fill('O que é concordância verbal?')
    await page.getByRole('button', { name: 'Remover dos favoritos' }).click()
    await expect(page.getByRole('button', { name: 'Tudo sincronizado' })).toBeVisible()
    const response = page.waitForResponse((response) =>
      response.url().includes('/rest/v1/study_libraries'),
    )
    release()
    await response
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    )
    await expect(page.getByRole('button', { name: 'Adicionar aos favoritos' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tudo sincronizado' })).toBeVisible()
  } finally {
    release()
  }
})

test('syncs a suspended card and keeps it out of sessions after reloading from the cloud', async ({
  page,
}) => {
  const library = createSeed()
  await mockAuth(page, { library })
  await page.route('**/rest/v1/rpc/save_study_library', async (route) => {
    const payload = route.request().postDataJSON()
    Object.assign(library, payload.library_content)
    await route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: 2 })
  })
  await openAccount(page)
  await page.getByLabel('Seu e-mail').fill('estudante@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-estudo')
  await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tudo sincronizado' })).toBeVisible()
  await page.getByRole('button', { name: 'Vamos estudar', exact: true }).click()
  const question = await page.locator('#study-question').innerText()
  await page.locator('.reveal-btn').click()
  const saved = page.waitForResponse((response) =>
    response.url().includes('/rpc/save_study_library'),
  )
  await page.getByRole('button', { name: 'Não mostrar mais nas sessões', exact: true }).click()
  await saved
  await expect(page.getByRole('button', { name: 'Tudo sincronizado' })).toBeVisible()
  expect(library.cards.find((card) => card.question === question)?.suspended).toBe(true)
  expect(library.history).toHaveLength(0)
  await page.getByRole('button', { name: 'Encerrar sessão' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Revisar 22', exact: true })).toBeEnabled()
  await page.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill(question)
  await expect(page.getByText('Fora das sessões', { exact: true })).toBeVisible()
  await page.locator('.card-question').click()
  await expect(page.getByRole('dialog', { name: 'Consultar flashcard' })).toBeVisible()
})

test('syncs a JSON batch as one library update with every new card in the intended topic', async ({
  page,
}) => {
  const library = createSeed()
  const existingIds = library.cards.map((card) => card.id)
  const writes: Library[] = []
  await mockAuth(page, { library })
  await page.route('**/rest/v1/rpc/save_study_library', async (route) => {
    const payload = route.request().postDataJSON()
    writes.push(payload.library_content)
    Object.assign(library, payload.library_content)
    await route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: 2 })
  })
  await openAccount(page)
  await page.getByLabel('Seu e-mail').fill('estudante@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-estudo')
  await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tudo sincronizado' })).toBeVisible()
  await page.getByRole('button', { name: /Português.*3 temas/ }).click()
  await page.getByRole('button', { name: 'Crase 3', exact: true }).click()
  await page.getByRole('button', { name: 'Inserir em bloco', exact: true }).click()
  await page
    .getByLabel('JSON dos flashcards')
    .fill(
      '[{"pergunta":"Questão importada A","resposta":"Resposta A"},{"pergunta":"Questão importada B","resposta":"Resposta B"}]',
    )
  const saved = page.waitForResponse((response) =>
    response.url().includes('/rpc/save_study_library'),
  )
  await page.getByRole('button', { name: 'Adicionar 2 cards', exact: true }).click()
  await saved
  await expect(page.getByRole('button', { name: 'Tudo sincronizado' })).toBeVisible()
  expect(writes).toHaveLength(1)
  expect(library.cards).toHaveLength(25)
  expect(library.cards.slice(0, 23).map((card) => card.id)).toEqual(existingIds)
  expect(library.history).toHaveLength(0)
  for (const card of library.cards.slice(23)) {
    expect(card).toMatchObject({ topicId: 't2', favorite: false, reviews: 0 })
    expect(card.dueAt).toBe(card.createdAt)
  }
  await page.reload()
  await page.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('Questão importada')
  await expect(page.locator('.flashcard-tile')).toHaveCount(2)
})

test('syncs the topic exclusion without changing its cards and restores it from the cloud', async ({
  page,
}) => {
  const library = createSeed()
  const cardsBefore = structuredClone(library.cards)
  await mockAuth(page, { library })
  await page.route('**/rest/v1/rpc/save_study_library', async (route) => {
    const payload = route.request().postDataJSON()
    Object.assign(library, payload.library_content)
    await route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: 2 })
  })
  await openAccount(page)
  await page.getByLabel('Seu e-mail').fill('estudante@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-estudo')
  await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tudo sincronizado' })).toBeVisible()
  await page.getByRole('button', { name: /Português.*3 temas/ }).click()
  await page.getByRole('button', { name: 'Concordância verbal 4', exact: true }).click()
  const saved = page.waitForResponse((response) =>
    response.url().includes('/rpc/save_study_library'),
  )
  await page.getByRole('button', { name: 'Retirar tema das sessões', exact: true }).click()
  await saved
  await expect(page.getByRole('button', { name: 'Tudo sincronizado' })).toBeVisible()
  expect(library.topics.find((topic) => topic.id === 't1')?.suspended).toBe(true)
  expect(library.cards).toEqual(cardsBefore)
  expect(library.history).toHaveLength(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Revisar 19', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Vamos estudar', exact: true }).click()
  await expect(page.locator('.study-progress-head strong')).toHaveText(/1\s+de\s*19/)
  await page.getByRole('button', { name: 'Encerrar sessão' }).click()
  await page
    .getByRole('textbox', { name: 'Buscar na biblioteca' })
    .fill('O que é concordância verbal?')
  await expect(page.getByText('Tema fora das sessões', { exact: true })).toBeVisible()
  await page.locator('.card-question').click()
  await expect(page.getByRole('dialog', { name: 'Consultar flashcard' })).toBeVisible()
})

async function enter(page: Page, email = 'estudante@example.com') {
  await page.getByLabel('Seu e-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-estudo')
  await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Seu próximo passo/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tudo sincronizado' })).toBeVisible()
}

test('requires login and ignores the old guest library before and after account creation', async ({
  page,
}) => {
  await mockAuth(page)
  await page.addInitScript((library) => {
    localStorage.setItem(
      'studard:library:guest:v1',
      JSON.stringify({ data: library, revision: 0, dirty: true }),
    )
  }, createSeed())
  const reads: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/')) reads.push(request.url())
  })
  await page.goto('/')
  await expect(page.getByRole('textbox', { name: 'Seu e-mail' })).toBeVisible()
  await expect(page.locator('.sidebar')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Vamos estudar', exact: true })).toHaveCount(0)
  await expect(page.getByText('Português', { exact: true })).toHaveCount(0)
  expect(reads).toHaveLength(0)
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await page.getByLabel('Seu e-mail').fill('estudante@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-estudo')
  await page.getByLabel('Confirmar senha').fill('senha-de-estudo')
  await page.getByRole('button', { name: 'Criar minha conta', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tudo sincronizado' })).toBeVisible()
  await expect(page.locator('.stat-card').first().locator('strong')).toHaveText('0')
  await expect(page.locator('.subjects-nav > button')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: /Seu próximo passo/ })).toBeVisible()
  await expect(page.locator('.stat-card').first().locator('strong')).toHaveText('0')
})

test('returns to login after signout even with cached cards and browser history', async ({
  page,
}) => {
  await mockAuth(page, { library: createSeed() })
  await page.goto('/')
  await enter(page)
  await page.getByRole('button', { name: 'Minha conta', exact: true }).click()
  await page.getByRole('button', { name: 'Sair desta conta', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Seu e-mail' })).toBeVisible()
  await expect(page.locator('.sidebar')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Seu e-mail' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Seu próximo passo/ })).toHaveCount(0)
  await page.goto('/?from=history')
  await page.goBack()
  await expect(page.getByRole('textbox', { name: 'Seu e-mail' })).toBeVisible()
  await expect(page.locator('.subject-tile')).toHaveCount(0)
})

test('does not show the previous account library when another user signs in on the same device', async ({
  page,
}) => {
  await mockAuth(page, { library: createSeed() })
  await page.goto('/')
  await enter(page)
  await expect(page.locator('.stat-card').first().locator('strong')).toHaveText('23')
  await page.getByRole('button', { name: 'Minha conta', exact: true }).click()
  await page.getByRole('button', { name: 'Sair desta conta', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Seu e-mail' })).toBeVisible()
  await mockAuth(page, {
    user: { id: '00000000-0000-4000-8000-000000000020', email: 'outra-conta@example.com' },
  })
  await enter(page, 'outra-conta@example.com')
  await expect(page.locator('.stat-card').first().locator('strong')).toHaveText('0')
  await expect(page.locator('.subjects-nav > button')).toHaveCount(0)
  await page.getByRole('button', { name: 'Minha conta', exact: true }).click()
  await expect(page.getByText('outra-conta@example.com', { exact: true })).toBeVisible()
})

test('locks the workspace when an expired session cannot be refreshed', async ({ page }) => {
  await page.clock.install({ time: new Date() })
  await mockAuth(page, { library: createSeed() })
  await page.route('**/auth/v1/token*', (route) => {
    if (new URL(route.request().url()).searchParams.get('grant_type') === 'refresh_token') {
      return route.fulfill({
        status: 400,
        headers: { 'access-control-allow-origin': '*' },
        json: { error_code: 'refresh_token_not_found', msg: 'Invalid refresh token' },
      })
    }
    return route.fallback()
  })
  await page.goto('/')
  await enter(page)
  await page.clock.fastForward(2 * 60 * 60 * 1000)
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Seu e-mail' })).toBeVisible()
  await expect(page.locator('.sidebar')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /Seu próximo passo/ })).toHaveCount(0)
})

test('signing out also locks the workspace in another open tab', async ({ page, context }) => {
  await mockAuth(context, { library: createSeed() })
  await page.goto('/')
  await enter(page)
  const second = await context.newPage()
  await second.goto('/')
  await expect(second.getByRole('heading', { name: /Seu próximo passo/ })).toBeVisible()
  await page.getByRole('button', { name: 'Minha conta', exact: true }).click()
  await page.getByRole('button', { name: 'Sair desta conta', exact: true }).click()
  await expect(second.getByRole('textbox', { name: 'Seu e-mail' })).toBeVisible()
  await expect(second.locator('.sidebar')).toHaveCount(0)
  await second.close()
})
