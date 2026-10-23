import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { Library } from '../src/lib/types'
import { createSeed } from '../src/lib/seed'

// Intercept every Auth request: these tests never create accounts or send real e-mails.
async function mockAuth(
  page: Page,
  options: { invalidPassword?: boolean; confirmationRequired?: boolean; library?: Library } = {},
) {
  const calls: { path: string; method: string; body: Record<string, unknown> | null }[] = []
  const user = {
    id: '00000000-0000-4000-8000-000000000010',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'estudante@example.com',
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
  }
  const now = Math.floor(Date.now() / 1000)
  const token = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        aud: 'authenticated',
        role: 'authenticated',
        exp: now + 3600,
        iat: now,
      }),
    ).toString('base64url'),
    'test-signature',
  ].join('.')
  const session = {
    access_token: token,
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    user,
  }
  const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' }

  await page.route('**/auth/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    calls.push({
      path: url.pathname,
      method: request.method(),
      body: request.postData() ? request.postDataJSON() : null,
    })
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    if (url.pathname.endsWith('/token')) {
      if (options.invalidPassword)
        await route.fulfill({
          status: 400,
          headers,
          json: {
            code: 'invalid_credentials',
            error_code: 'invalid_credentials',
            msg: 'Invalid login credentials',
          },
        })
      else await route.fulfill({ headers, json: session })
    } else if (url.pathname.endsWith('/signup')) {
      await route.fulfill({ headers, json: options.confirmationRequired ? user : session })
    } else if (url.pathname.endsWith('/user')) {
      await route.fulfill({ headers, json: user })
    } else if (url.pathname.endsWith('/logout')) {
      await route.fulfill({ status: 204, headers })
    } else {
      await route.abort()
    }
  })
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({
      headers,
      json: options.library ? [{ content: options.library, revision: 1 }] : [],
    }),
  )
  return calls
}

async function openAccount(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Minha conta', exact: true }).click()
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
  await expect(page.getByRole('button', { name: 'Salvo neste dispositivo' })).toBeVisible()
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
  await expect(page.getByRole('button', { name: 'Salvo neste dispositivo' })).toBeVisible()
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
