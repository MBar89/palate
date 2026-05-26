// Guest flow agent — walks through the app as an unauthenticated user and
// verifies that public pages work and auth-gated pages redirect correctly.
// Run: node scripts/agents/guest-flow.js

const { chromium } = require('playwright')
const Anthropic = require('@anthropic-ai/sdk')
const path = require('path')
const fs = require('fs')

require('dotenv').config({ path: path.join(__dirname, '../../.env.local') })

const BASE_URL = 'https://palate-zeta.vercel.app'
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'guest-flow')

async function screenshot(page, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: false })
}

async function check(label, fn) {
  try {
    await fn()
    console.log(`  ✓ ${label}`)
    return { label, pass: true }
  } catch (e) {
    console.log(`  ✗ ${label}: ${e.message}`)
    return { label, pass: false, error: e.message }
  }
}

async function run() {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const browser = await chromium.launch({ headless: false, slowMo: 200 })
  const context = await browser.newContext()
  const page = await context.newPage()
  const results = []

  console.log('\nGuest Flow Report')
  console.log('=================')

  // ── Landing page ──────────────────────────────────────────────────────────
  console.log('\nLanding page')
  await page.goto(BASE_URL)
  await page.waitForLoadState('networkidle')
  await screenshot(page, '01-landing')

  results.push(await check('Shows landing page (not feed)', async () => {
    await page.getByText('Browse restaurants first', { exact: false }).waitFor({ timeout: 5000 })
  }))
  results.push(await check('"Browse restaurants first" link exists', async () => {
    await page.getByText('Browse restaurants first', { exact: false }).waitFor({ timeout: 3000 })
  }))

  // ── Explore page ──────────────────────────────────────────────────────────
  console.log('\nExplore page')
  await page.goto(`${BASE_URL}/explore`)
  await page.waitForLoadState('networkidle')
  await screenshot(page, '02-explore')

  results.push(await check('Explore page loads for guests', async () => {
    await page.waitForSelector('input[placeholder*="Search"]', { timeout: 8000 })
  }))
  results.push(await check('Log in button visible in header', async () => {
    await page.getByRole('button', { name: /log in/i }).or(page.getByRole('link', { name: /log in/i })).first().waitFor({ timeout: 5000 })
  }))
  results.push(await check('Restaurant cards are visible', async () => {
    await page.locator('div').filter({ hasText: /£/ }).first().waitFor({ timeout: 8000 })
  }))
  results.push(await check('Signup banner visible at bottom', async () => {
    await page.getByText(/sign up for taste-matched/i).first().waitFor({ timeout: 5000 })
  }))
  results.push(await check('Inspire me button visible', async () => {
    await page.getByRole('button', { name: /inspire me/i }).waitFor({ timeout: 5000 })
  }))
  results.push(await check('Filter button visible', async () => {
    await page.getByRole('button', { name: /filter/i }).waitFor({ timeout: 5000 })
  }))

  // Test Inspire me button
  console.log('\nInspire me button')
  try {
    await page.getByRole('button', { name: /inspire me/i }).click()
    await page.waitForTimeout(1500)
    await screenshot(page, '03-inspire-me')
    results.push(await check('Inspire me shows a restaurant', async () => {
      await page.getByRole('button', { name: /let.?s go|view restaurant/i }).waitFor({ timeout: 5000 })
    }))
    // Dismiss by clicking outside the sheet
    await page.mouse.click(10, 10)
    await page.waitForTimeout(800)
  } catch (e) {
    results.push({ label: 'Inspire me shows a restaurant', pass: false, error: e.message })
    await page.mouse.click(10, 10)
    await page.waitForTimeout(500)
  }

  // Test filter sheet
  console.log('\nFilter sheet')
  try {
    const filterBtn = page.getByRole('button', { name: /filter/i }).first()
    await filterBtn.scrollIntoViewIfNeeded()
    await filterBtn.click({ force: true })
    await page.waitForTimeout(1000)
    await screenshot(page, '04-filter-sheet')
    results.push(await check('Filter sheet opens', async () => {
      await page.getByText('Price range', { exact: true }).waitFor({ timeout: 5000 })
    }))
    await page.mouse.click(10, 10)
    await page.waitForTimeout(500)
  } catch (e) {
    results.push({ label: 'Filter sheet opens', pass: false, error: e.message })
  }

  // ── Restaurant detail page ────────────────────────────────────────────────
  console.log('\nRestaurant detail page')
  await page.goto(`${BASE_URL}/explore`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  let restaurantUrl = null
  try {
    // Cards use onClick + window.location.href — click the first one and capture navigation
    const card = page.locator('div[style*="cursor: pointer"]').filter({ hasText: /£/ }).first()
    await card.waitFor({ timeout: 8000 })
    await Promise.all([
      page.waitForURL('**/restaurant/**', { timeout: 10000 }),
      card.click(),
    ])
    restaurantUrl = new URL(page.url()).pathname
    await page.waitForLoadState('networkidle')
    await screenshot(page, '05-restaurant-detail')
  } catch (e) {
    console.log(`  Could not navigate to restaurant detail: ${e.message}`)
  }

  if (restaurantUrl) {
    results.push(await check('Restaurant detail page loads', async () => {
      await page.waitForURL(`**${restaurantUrl}`, { timeout: 8000 })
    }))
    results.push(await check('Restaurant name visible', async () => {
      await page.locator('h1, h2').first().waitFor({ timeout: 5000 })
    }))
    results.push(await check('Signup CTA shown (no review form)', async () => {
      await page.getByText(/sign up|join palate|log in to/i).waitFor({ timeout: 5000 })
    }))
    results.push(await check('No review form visible for guests', async () => {
      const reviewForm = page.getByRole('button', { name: /save review|update review/i })
      const count = await reviewForm.count()
      if (count > 0) throw new Error('Review form is visible to guests')
    }))
    results.push(await check('Cuisine and price info visible', async () => {
      await page.getByText(/£/).first().waitFor({ timeout: 5000 })
    }))
  }

  // ── Auth-gated routes ────────────────────────────────────────────────────
  console.log('\nAuth-gated routes (should redirect)')
  for (const [label, path] of [
    ['Profile', '/profile'],
    ['Saved', '/saved'],
    ['People', '/people'],
    ['Add restaurant', '/add'],
  ]) {
    await page.goto(`${BASE_URL}${path}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
    const finalUrl = page.url()
    results.push(await check(`${label} redirects guests to login`, async () => {
      if (!finalUrl.includes('/login') && !finalUrl.includes('/signup')) {
        throw new Error(`Stayed on ${finalUrl} instead of redirecting`)
      }
    }))
  }
  await screenshot(page, '06-auth-redirect')

  await browser.close()

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass)
  console.log(`\n${passed}/${results.length} checks passed`)
  if (failed.length > 0) {
    console.log('Failed:')
    failed.forEach(r => console.log(`  ✗ ${r.label}: ${r.error}`))
  }

  // ── Claude assessment ─────────────────────────────────────────────────────
  console.log('\nAsking Claude to assess the guest experience...')
  const prompt = `You are auditing the guest (unauthenticated) experience of Palate, a taste-matched restaurant discovery app.

Here are the automated check results:
${results.map(r => `${r.pass ? '✓' : '✗'} ${r.label}${r.error ? ': ' + r.error : ''}`).join('\n')}

The guest flow is:
1. Landing page — shows the app concept, "Browse restaurants first →" link, and login/signup prompts
2. Explore page — guests can browse restaurants, search, filter, and use "Inspire me"
3. Restaurant detail — guests see the restaurant info and tags but get a signup CTA instead of the review form
4. Auth-gated routes (/profile, /saved, /people, /add) — should redirect to login

Assess the guest experience quality. Consider:
1. Is the public value clear — can a guest understand what the app does and see real data before signing up?
2. Are auth gates working correctly?
3. Are there any friction points or missing signals that would put a guest off signing up?

Return JSON:
- score: integer 0–100
- summary: 2–3 sentence assessment
- flags: array of specific issues (empty if none)

Return ONLY valid JSON.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].text.trim()
  const assessment = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))

  const bar = '█'.repeat(Math.round(assessment.score / 10)) + '░'.repeat(10 - Math.round(assessment.score / 10))
  console.log(`\nGuest experience score: ${bar} ${assessment.score}/100`)
  console.log(`${assessment.summary}`)
  if (assessment.flags.length > 0) {
    assessment.flags.forEach(f => console.log(`  ⚠ ${typeof f === 'string' ? f : JSON.stringify(f)}`))
  }
  console.log()
}

run().catch(err => { console.error('\n❌ Agent failed:', err.message); process.exit(1) })
