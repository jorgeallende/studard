// PGlite runs the actual migration in PostgreSQL, with a small Supabase Auth stub.
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const db = new PGlite()
const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
const library = JSON.stringify({ version: 1, subjects: [], topics: [], cards: [], history: [] })
async function asUser(id: string) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id])
  await db.exec('set role authenticated')
}
async function save(revision: number) {
  return db.query<{ save_study_library: number }>(
    'select public.save_study_library($1::jsonb, $2::bigint)',
    [library, revision],
  )
}
beforeAll(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    insert into auth.users values ('${alice}'), ('${bob}');
  `)
  await db.exec(
    readFileSync(
      new URL('../supabase/migrations/202610220001_study_library.sql', import.meta.url),
      'utf8',
    ),
  )
}, 30000)
afterAll(async () => {
  await db.close()
})
describe.sequential('Supabase: isolation and atomic updates', () => {
  it('creates a library for the authenticated owner and increments the revision', async () => {
    await asUser(alice)
    expect((await save(0)).rows[0].save_study_library).toBe(1)
    expect((await save(1)).rows[0].save_study_library).toBe(2)
  })
  it('rejects a stale revision without losing the existing document', async () => {
    await asUser(alice)
    await expect(save(1)).rejects.toMatchObject({ code: '40001' })
    const result = await db.query<{ revision: number }>(
      'select revision from public.study_libraries',
    )
    expect(result.rows[0].revision).toBe(2)
  })
  it('prevents reading or updating another user’s library', async () => {
    await asUser(bob)
    expect((await db.query('select * from public.study_libraries')).rows).toHaveLength(0)
    await expect(db.query('update public.study_libraries set revision = 10')).rejects.toMatchObject(
      { code: '42501' },
    )
    await save(0)
    expect((await db.query('select * from public.study_libraries')).rows).toHaveLength(1)
  })
  it('rejects anonymous access and malformed libraries', async () => {
    await asUser(bob)
    await expect(
      db.query("select public.save_study_library('{}'::jsonb, 1)"),
    ).rejects.toMatchObject({ code: '23514' })
    await db.exec('reset role; set role anon')
    await expect(db.query('select * from public.study_libraries')).rejects.toMatchObject({
      code: '42501',
    })
    await expect(save(0)).rejects.toMatchObject({ code: '42501' })
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub', '', false)")
    await expect(save(0)).rejects.toMatchObject({ code: '28000' })
  })
})
