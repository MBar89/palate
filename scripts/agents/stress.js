// Stress testing agent — fires concurrent requests at key endpoints and the
// feed RPC, measures response times, and reports p50/p95 + any errors.
// Run: node scripts/agents/stress.js

const { createClient } = require('@supabase/supabase-js')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '../../.env.local') })

const BASE_URL = 'https://palate-zeta.vercel.app'
const CONCURRENCY = 10  // simultaneous requests per test
const ROUNDS = 3        // repeat each test this many times

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

function stats(times) {
  const sorted = [...times].sort((a, b) => a - b)
  return {
    min: sorted[0],
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1],
    errors: 0,
  }
}

async function timed(fn) {
  const start = Date.now()
  try {
    await fn()
    return { ms: Date.now() - start, error: null }
  } catch (e) {
    return { ms: Date.now() - start, error: e.message }
  }
}

async function runBatch(label, fn, concurrency = CONCURRENCY) {
  process.stdout.write(`  ${label}`)
  const allTimes = []
  let errorCount = 0

  for (let r = 0; r < ROUNDS; r++) {
    const batch = Array.from({ length: concurrency }, () => timed(fn))
    const results = await Promise.all(batch)
    results.forEach(({ ms, error }) => {
      allTimes.push(ms)
      if (error) errorCount++
    })
    process.stdout.write('.')
  }

  const s = stats(allTimes)
  s.errors = errorCount
  const total = ROUNDS * concurrency
  const errStr = errorCount > 0 ? ` ⚠ ${errorCount}/${total} errors` : ''
  console.log(` — p50: ${s.p50}ms  p95: ${s.p95}ms  max: ${s.max}ms${errStr}`)
  return { label, ...s, total }
}

async function getTestUsers(supabase) {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  return (data.users || [])
    .filter(u => u.email?.endsWith('@palate-test.com'))
    .slice(0, 4)
}

async function loginUser(supabase, email) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: 'TestAgent123!',
  })
  if (error) throw new Error(`Login failed: ${error.message}`)
  return data.session.access_token
}

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('\nStress Test Report')
  console.log('==================')
  console.log(`${CONCURRENCY} concurrent · ${ROUNDS} rounds · ${CONCURRENCY * ROUNDS} total per test\n`)

  // Get test users and log in to get tokens
  const testUsers = await getTestUsers(supabase)
  if (testUsers.length === 0) {
    console.error('No test users found — run the onboarding agent first')
    process.exit(1)
  }

  // Log in as first test user for authenticated endpoint tests
  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const token = await loginUser(anonClient, testUsers[0].email)
  const userIds = testUsers.map(u => u.id)

  const results = []

  // ── Database: personalised feed RPC ──────────────────────────────────────
  console.log('Database (Supabase RPC)')
  let uidIdx = 0
  results.push(await runBatch('get_personalised_feed (rotating users)', async () => {
    const uid = userIds[uidIdx++ % userIds.length]
    const { error } = await supabase.rpc('get_personalised_feed', { user_uuid: uid })
    if (error) throw new Error(error.message)
  }))

  results.push(await runBatch('restaurants table read (all approved)', async () => {
    const { error } = await supabase
      .from('restaurants')
      .select('id, name, cuisine, neighbourhood, price_range, is_chain')
      .eq('status', 'approved')
    if (error) throw new Error(error.message)
  }))

  results.push(await runBatch('reviews table read (all)', async () => {
    const { error } = await supabase
      .from('reviews')
      .select('id, user_id, restaurant_id, would_go_back, tags')
    if (error) throw new Error(error.message)
  }))

  // ── Public API endpoints ──────────────────────────────────────────────────
  console.log('\nPublic pages (HTTP GET)')
  results.push(await runBatch('GET /explore', async () => {
    const res = await fetch(`${BASE_URL}/explore`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  }))

  results.push(await runBatch('GET / (home/landing)', async () => {
    const res = await fetch(BASE_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  }))

  // ── Auth-protected API endpoints ──────────────────────────────────────────
  console.log('\nAPI routes (authenticated)')

  // Get a restaurant ID for the detail page test
  const { data: sampleRestaurants } = await supabase
    .from('restaurants').select('id').eq('status', 'approved').limit(5)
  let rIdx = 0

  results.push(await runBatch('GET /restaurant/[id] (detail page)', async () => {
    const id = sampleRestaurants[rIdx++ % sampleRestaurants.length].id
    const res = await fetch(`${BASE_URL}/restaurant/${id}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  }))

  // ── Concurrent write: saves insert/delete ────────────────────────────────
  console.log('\nConcurrent writes')
  // Use a restaurant the test user hasn't saved (insert then delete)
  const { data: unsaved } = await supabase
    .from('restaurants')
    .select('id')
    .eq('status', 'approved')
    .limit(10)

  let saveIdx = 0
  results.push(await runBatch('save insert + delete (concurrent)', async () => {
    const restaurantId = unsaved[saveIdx++ % unsaved.length].id
    const { error: ie } = await anonClient.from('saves').insert({ user_id: testUsers[0].id, restaurant_id: restaurantId })
    if (ie && ie.code !== '23505') throw new Error(`insert: ${ie.message}`) // ignore duplicate
    const { error: de } = await anonClient.from('saves').delete().eq('user_id', testUsers[0].id).eq('restaurant_id', restaurantId)
    if (de) throw new Error(`delete: ${de.message}`)
  }, 5))


  // ── Summary ───────────────────────────────────────────────────────────────
  const allErrors = results.reduce((sum, r) => sum + r.errors, 0)
  const slowTests = results.filter(r => r.p95 > 3000)

  console.log('\n───────────────────────────')
  if (allErrors === 0) {
    console.log('No errors across all tests.')
  } else {
    console.log(`⚠ ${allErrors} total error(s) — check above for details.`)
  }
  if (slowTests.length > 0) {
    console.log('Slow tests (p95 > 3s):')
    slowTests.forEach(r => console.log(`  ${r.label}: p95 ${r.p95}ms`))
  } else {
    console.log('All tests p95 < 3s.')
  }
  console.log()
}

run().catch(err => { console.error('\n❌ Agent failed:', err.message); process.exit(1) })
