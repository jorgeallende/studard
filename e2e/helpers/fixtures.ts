import { test as base, expect } from '@playwright/test'
import { mockAuth } from './mockAuth'
import { createSeed } from '../../tests/fixtures/library'

// Example content exists only in test fixtures. The app itself always starts empty.
export const test = base.extend({
  page: async ({ page, context }, use) => {
    await mockAuth(context, { library: createSeed() })
    await page.goto('/')
    await page.getByLabel('Seu e-mail').fill('estudante@example.com')
    await page.getByLabel('Senha', { exact: true }).fill('senha-de-estudo')
    await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).click()
    await expect(page.getByRole('heading', { name: /Seu próximo passo/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tudo sincronizado' })).toBeVisible()
    await use(page)
  },
})
export { expect }
