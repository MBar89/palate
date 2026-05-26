// Feed quality agent — fetches each cluster user's personalised feed and asks
// Claude to assess whether the recommendations match their taste profile.
// Run: node scripts/agents/feed-quality.js

const { createClient } = require('@supabase/supabase-js')
const Anthropic = require('@anthropic-ai/sdk')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '../../.env.local') })

const CLUSTER_DESCRIPTIONS = {
  adventurous: 'Loves independent, experimental, culturally diverse restaurants. Actively dislikes chains and fast food. Seeks neighbourhood gems and places with real character.',
  fine_dining: 'Values refined, elegant dining. Appreciates exceptional quality, attentive service, and special occasion venues.',
  comfort: 'Loves reliable, hearty comfort food. Prefers familiar chains and consistent dishes. Prioritises value and relaxed atmosphere.',
  casual: 'Broad, unpretentious tastes. Eats across cuisines and settings with no strong preferences.',
}

async function getTestUsers(supabase) {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const testUsers = {}
  for (const cluster of Object.keys(CLUSTER_DESCRIPTIONS)) {
    const match = data.users
      .filter(u => u.email?.endsWith('@palate-test.com') && u.email.includes(`agent_${cluster}_`))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
    if (match) testUsers[cluster] = match
  }
  return testUsers
}

async function getFeedForUser(supabase, userId) {
  const { data, error } = await supabase.rpc('get_personalised_feed', { user_uuid: userId })
  if (error) throw new Error(`Feed RPC failed: ${error.message}`)
  return data || []
}

async function assessFeed(anthropic, cluster, feed) {
  if (feed.length === 0) {
    return { score: 0, summary: 'Feed is empty — no data to assess.', flags: [] }
  }

  const top15 = feed.slice(0, 15).map(r => ({
    name: r.name,
    cuisine: r.cuisine,
    neighbourhood: r.neighbourhood,
    price_range: r.price_range,
    is_chain: r.is_chain,
    match_score: Math.round(r.match_score),
    top_tags: r.top_tags || [],
  }))

  const prompt = `You are auditing the personalised restaurant feed for a user with a "${cluster}" taste profile.

Profile: ${CLUSTER_DESCRIPTIONS[cluster]}

Here are their top 15 feed recommendations (ordered by match score):
${JSON.stringify(top15, null, 2)}

Assess the quality of these recommendations. Consider:
1. Are the top-scoring restaurants a good fit for this profile?
2. Are there any obvious mismatches (e.g. chains near the top for an adventurous user, or casual spots for fine dining)?
3. Do the match scores feel calibrated (a 90% match should feel like a near-perfect fit)?

Return JSON with:
- score: integer 0–100 (overall quality of the feed for this profile)
- summary: 2–3 sentence assessment
- flags: array of specific issues found (empty array if none), each as a short string

Return ONLY valid JSON, no other text.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].text.trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  return JSON.parse(text.slice(start, end + 1))
}

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  console.log('\nFeed Quality Report')
  console.log('===================')

  const testUsers = await getTestUsers(supabase)
  const results = []

  for (const [cluster, user] of Object.entries(testUsers)) {
    process.stdout.write(`\n${cluster.toUpperCase()} (@${user.email.split('@')[0]})`)

    const feed = await getFeedForUser(supabase, user.id)
    process.stdout.write(` — ${feed.length} restaurants in feed`)

    const assessment = await assessFeed(anthropic, cluster, feed)
    results.push({ cluster, feed_size: feed.length, ...assessment })

    const scoreBar = '█'.repeat(Math.round(assessment.score / 10)) + '░'.repeat(10 - Math.round(assessment.score / 10))
    console.log(`\n  Score: ${scoreBar} ${assessment.score}/100`)
    console.log(`  ${assessment.summary}`)
    if (assessment.flags.length > 0) {
      assessment.flags.forEach(f => console.log(`  ⚠ ${f}`))
    }
  }

  // Overall summary
  const avg = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
  const allFlags = results.flatMap(r => r.flags)

  console.log('\n───────────────────────────')
  console.log(`Overall feed quality: ${avg}/100`)
  if (allFlags.length === 0) {
    console.log('No issues flagged across any cluster.')
  } else {
    console.log(`${allFlags.length} issue(s) flagged — review above for details.`)
  }
  console.log()
}

run().catch(err => { console.error('\n❌ Agent failed:', err.message); process.exit(1) })
