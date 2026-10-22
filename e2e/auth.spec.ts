import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Intercept every Auth request: these tests never create accounts or send real e-mails.
async function mockAuth(
  page: Page,
  options: { invalidPassword?: boolean; confirmationRequired?: boolean } = {},
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
  await page.route('**/rest/v1/**', (route) => route.fulfill({ headers, json: [] }))
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
