// Review agent — logs in as a test user and leaves Claude-generated reviews
// Run: node scripts/agents/review.js [adventurous|fine_dining|comfort|casual] [count]

const { chromium } = require('playwright')
const { createClient } = require('@supabase/supabase-js')
const Anthropic = require('@anthropic-ai/sdk')
const path = require('path')
const fs = require('fs')

require('dotenv').config({ path: path.join(__dirname, '../../.env.local') })

const BASE_URL = 'https://palate-zeta.vercel.app'
const PASSWORD = 'TestAgent123!'

const CLUSTER_DESCRIPTIONS = {
  adventurous: 'You love independent, experimental, and culturally diverse restaurants. You actively avoid chains and fast food. You seek out neighbourhood gems and places with real character.',
  fine_dining: 'You value refined, elegant dining experiences. You appreciate exceptional quality, attentive service, and special occasion venues. You would rather go somewhere exceptional once than mediocre often.',
  comfort: 'You love reliable, hearty comfort food. Familiar chains and consistent dishes are your preference. You prioritise value and a relaxed atmosphere over novelty.',
  casual: 'You have broad, unpretentious tastes. You eat across cuisines and settings — casual spots, neighbourhood places, the occasional nicer meal.',
}

// --second flag picks the newer (second) agent; default picks the original (oldest)
const USE_SECOND = process.argv.includes('--second')

async function getTestUser(supabase, cluster) {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const matches = data.users
    .filter(u => u.email?.endsWith('@palate-test.com') && u.email.includes(`agent_${cluster}_`))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) // oldest first
  const match = USE_SECOND ? matches[1] : matches[0]
  if (!match) {
    throw new Error(`No test user found for cluster "${cluster}". Run the onboarding agent first:\n  node scripts/agents/onboarding.js ${cluster}`)
  }
  return match
}

async function getReviewPlan(anthropic, cluster, restaurants, tags, alreadyReviewed, count) {
  const unreviewed = restaurants.filter(r => !alreadyReviewed.has(String(r.id)))
  if (unreviewed.length < count) {
    console.warn(`  Only ${unreviewed.length} unreviewed restaurants available (requested ${count})`)
    count = unreviewed.length
  }

  const prompt = `You are simulating a real restaurant-goer with a "${cluster}" taste profile on a restaurant discovery app.

${CLUSTER_DESCRIPTIONS[cluster]}

Choose exactly ${count} restaurants from the list below that this person would have visited, and generate honest, realistic review data for each.

Available restaurants:
${JSON.stringify(unreviewed.map(r => ({
  name: r.name,
  cuisine: r.cuisine,
  neighbourhood: r.neighbourhood,
  price_range: r.price_range,
  is_chain: r.is_chain,
})), null, 2)}

Available tags by category:
${JSON.stringify(
  tags.reduce((acc, t) => {
    acc[t.category] = acc[t.category] || []
    acc[t.category].push(t.label)
    return acc
  }, {}),
  null, 2
)}

For each restaurant return:
- name: the restaurant name exactly as shown above
- tags: array of 3-5 tag labels that feel natural for this person at this place
- would_go_back: true or false
- worth_special_trip: true or false
- better_than_expected: true or false
- service_good: true or false
- discovered_favourite: true or false

Be realistic — not every experience is perfect. Vary the answers. A comfort person should avoid high-end places. An adventurous person should avoid chains and favour neighbourhood independents.

Return ONLY a valid JSON array, no other text.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].text.trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1) throw new Error(`Claude did not return valid JSON: ${text.slice(0, 200)}`)
  const plan = JSON.parse(text.slice(start, end + 1))

  // Map restaurant names back to UUIDs
  const nameToId = Object.fromEntries(unreviewed.map(r => [r.name.toLowerCase(), r.id]))
  return plan
    .map(item => {
      const id = nameToId[item.name?.toLowerCase()]
      if (!id) { console.warn(`  ⚠ Skipping unknown restaurant: "${item.name}"`) ; return null }
      return { ...item, id }
    })
    .filter(Boolean)
}

async function submitReview(page, restaurantId, review) {
  await page.goto(`${BASE_URL}/restaurant/${restaurantId}`)
  await page.waitForLoadState('domcontentloaded')

  // Wait until the review form is ready (submit button visible)
  await page.waitForSelector('button:has-text("Save review"), button:has-text("Update review")', { timeout: 15000 })

  // Click each tag — use .last() to target the interactive section (after "What people say")
  for (const tagLabel of review.tags) {
    const matches = page.getByText(tagLabel, { exact: true })
    const count = await matches.count()
    if (count > 0) {
      await matches.last().click()
      await page.waitForTimeout(100)
    }
  }

  // Answer quick questions by finding the question row, then clicking the button within it
  const questions = [
    { label: 'Would you go back?',         answer: review.would_go_back,        yes: 'Yes', no: 'No' },
    { label: 'Worth a special trip?',       answer: review.worth_special_trip,   yes: 'Yes', no: 'Nearby only' },
    { label: 'Better than expected?',       answer: review.better_than_expected, yes: 'Yes', no: 'No' },
    { label: 'Service good?',               answer: review.service_good,         yes: 'Yes', no: 'Could be better' },
    { label: 'Discovered a new favourite?', answer: review.discovered_favourite, yes: 'Yes', no: 'Not quite' },
  ]

  for (const q of questions) {
    const buttonLabel = q.answer ? q.yes : q.no
    await page.getByText(q.label, { exact: true })
      .locator('xpath=..')
      .getByRole('button', { name: buttonLabel })
      .click()
    await page.waitForTimeout(100)
  }

  // Submit
  await page.getByRole('button', { name: /Save review|Update review/ }).click()

  // Wait for success confirmation
  await page.getByRole('heading', { name: /Review saved|Review updated/ }).waitFor({ timeout: 10000 })
}

async function run() {
  const cluster = process.argv[2] || 'adventurous'
  const countArg = process.argv.slice(3).find(a => /^\d+$/.test(a))
  const count = countArg ? parseInt(countArg, 10) : 5

  if (!CLUSTER_DESCRIPTIONS[cluster]) {
    console.error(`Unknown cluster "${cluster}". Available: ${Object.keys(CLUSTER_DESCRIPTIONS).join(', ')}`)
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Find the most recent test user for this cluster
  console.log(`\nLooking up test user for cluster: ${cluster}`)
  const testUser = await getTestUser(supabase, cluster)
  console.log(`✓ ${testUser.email}`)

  // Fetch data in parallel
  console.log('Fetching restaurants, tags, and existing reviews...')
  const [{ data: allUsers }, { data: restaurants }, { data: tags }, { data: reviewed }] = await Promise.all([
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from('restaurants').select('id, name, cuisine, neighbourhood, price_range, is_chain').eq('status', 'approved'),
    supabase.from('tags').select('label, category').order('category'),
    supabase.from('reviews').select('restaurant_id').eq('user_id', testUser.id),
  ])
  const alreadyReviewed = new Set((reviewed || []).map(r => String(r.restaurant_id)))

  // When running as the second agent, exclude restaurants the first agent has reviewed
  // so peer data covers new restaurants that will actually show up in the first agent's feed
  if (USE_SECOND) {
    const firstAgent = allUsers.users
      .filter(u => u.email?.endsWith('@palate-test.com') && u.email.includes(`agent_${cluster}_`))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0]
    if (firstAgent) {
      const { data: peerReviewed } = await supabase.from('reviews').select('restaurant_id').eq('user_id', firstAgent.id)
      const peerIds = new Set((peerReviewed || []).map(r => String(r.restaurant_id)))
      peerIds.forEach(id => alreadyReviewed.add(id))
      console.log(`✓ ${restaurants.length} restaurants, ${reviewed?.length || 0} reviewed by this user, ${peerIds.size} reviewed by peer (excluded)`)
    }
  } else {
    console.log(`✓ ${restaurants.length} restaurants, ${alreadyReviewed.size} already reviewed by this user`)
  }

  // Generate review plan with Claude
  console.log(`\nAsking Claude to plan ${count} review(s) for a ${cluster} person...`)
  const plan = await getReviewPlan(anthropic, cluster, restaurants, tags, alreadyReviewed, count)
  console.log(`✓ Plan ready (${plan.length} restaurants):`)
  plan.forEach(r => {
    console.log(`  • ${r.name}: [${r.tags.join(', ')}] — go back: ${r.would_go_back ? 'yes' : 'no'}`)
  })

  const screenshotDir = path.join(__dirname, 'screenshots')
  fs.mkdirSync(screenshotDir, { recursive: true })

  const browser = await chromium.launch({ headless: false, slowMo: 250 })
  const page = await browser.newPage()
  page.setDefaultTimeout(20000)

  try {
    // Log in
    console.log('\nLogging in...')
    await page.goto(`${BASE_URL}/login`)
    await page.waitForLoadState('domcontentloaded')
    await page.fill('input[type="email"]', testUser.email)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(`${BASE_URL}/`, { timeout: 20000 })
    console.log('✓ Logged in')

    // Submit each review
    console.log('\nLeaving reviews...')
    let success = 0
    for (const review of plan) {
      const name = review.name || review.id
      try {
        await submitReview(page, review.id, review)
        console.log(`  ✓ ${name}`)
        success++
      } catch (err) {
        const screenshotPath = path.join(screenshotDir, `review-error-${review.id}-${Date.now()}.png`)
        await page.screenshot({ path: screenshotPath })
        console.error(`  ✗ ${name}: ${err.message}`)
      }
    }

    await page.screenshot({ path: path.join(screenshotDir, `review-${cluster}-complete.png`) })
    console.log(`\n✅ Done — ${success}/${plan.length} reviews submitted for ${testUser.email}`)

    await page.waitForTimeout(2000)
  } finally {
    await browser.close()
  }
}

run().catch(err => { console.error('\n❌ Agent failed:', err.message); process.exit(1) })
