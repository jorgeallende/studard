import type { Page, BrowserContext } from '@playwright/test'
import type { Library } from '../../src/lib/types'

// Intercept every Auth request: these tests never create accounts or send real e-mails.
export async function mockAuth(
  page: Page | BrowserContext,
  options: {
    invalidPassword?: boolean
    confirmationRequired?: boolean
    library?: Library
    user?: { id: string; email: string }
  } = {},
) {
  const calls: { path: string; method: string; body: Record<string, unknown> | null }[] = []
  const user = {
    id: options.user?.id || '00000000-0000-4000-8000-000000000010',
    aud: 'authenticated',
    role: 'authenticated',
    email: options.user?.email || 'estudante@example.com',
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
  let library = options.library
  let revision = library ? 1 : 0
  await page.route('**/rest/v1/**', async (route) => {
    if (route.request().url().includes('/rpc/save_study_library')) {
      const payload = route.request().postDataJSON()
      if (payload.expected_revision !== revision) {
        await route.fulfill({
          status: 409,
          headers,
          json: { code: '40001', message: 'Library changed on another device' },
        })
        return
      }
      library = payload.library_content
      revision++
      await route.fulfill({ headers, json: revision })
    } else {
      await route.fulfill({ headers, json: library ? [{ content: library, revision }] : [] })
    }
  })
  return calls
}
