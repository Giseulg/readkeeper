import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const target = JSON.parse(await readFile(new URL('../backend/app/production-target.json', import.meta.url), 'utf8'))
const { RELEASE_SHA, DEPLOYMENT_URL,
  VERCEL_AUTOMATION_BYPASS_SECRET } = process.env
const staged = new URL(DEPLOYMENT_URL)
assert.equal(staged.protocol, 'https:')
assert.equal(staged.origin, DEPLOYMENT_URL)
assert.ok(staged.hostname.endsWith('.vercel.app'))
assert.match(RELEASE_SHA, /^[0-9a-f]{40}$/)

async function fetchChecked(url, options = {}) {
  return fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000), ...options })
}
const headers = VERCEL_AUTOMATION_BYPASS_SECRET ? { 'x-vercel-protection-bypass': VERCEL_AUTOMATION_BYPASS_SECRET } : {}
const manifest = await fetchChecked(staged.origin + '/release.json', { headers })
assert.equal(manifest.status, 200)
const frontend = await manifest.json()
assert.equal(frontend.release, RELEASE_SHA)
assert.equal(frontend.apiPath, '/api/reading')
assert.equal(frontend.authOrigin, target.authOrigin)
const library = await fetchChecked(staged.origin + '/library', { headers })
assert.equal(library.status, 200)
const asset = (await library.text()).match(/src="(\/assets\/index-[\w-]+\.js)"/)?.[1]
assert.ok(asset, 'Library page must load a hashed application bundle')
assert.equal((await fetchChecked(staged.origin + asset, { headers })).status, 200)
const api = staged.origin + '/api/reading'
const health = await fetchChecked(api + '/health', { headers })
assert.equal(health.status, 200)
assert.deepEqual(await health.json(), { environment: 'production', release: RELEASE_SHA,
  schema: 1, authOrigin: frontend.authOrigin, databaseId: target.databaseId, analysis: 'on-request' })
assert.equal((await fetchChecked(api + '/me', { headers })).status, 401)
console.log('Verified frontend, same-origin API and database for', RELEASE_SHA)
