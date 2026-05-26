// Social agent — assigns usernames to test users, then has each follow the others
// Supports up to 2 agents per cluster (agent_adv, agent_adv2, etc.)
// Run: node scripts/agents/social.js

const { chromium } = require('playwright')
const { createClient } = require('@supabase/supabase-js')
const path = require('path')
const fs = require('fs')

require('dotenv').config({ path: path.join(__dirname, '../../.env.local') })

const BASE_URL = 'https://palate-zeta.vercel.app'
const PASSWORD = 'TestAgent123!'

const CLUSTER_USERNAME_BASES = {
  adventurous: 'agent_adv',
  fine_dining:  'agent_fd',
  comfort:      'agent_com',
  casual:       'agent_cas',
}

// Returns up to 2 test users per cluster, sorted oldest first
async function getAllTestUsers(supabase) {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const allUsers = []
  for (const cluster of Object.keys(CLUSTER_USERNAME_BASES)) {
    const matches = data.users
      .filter(u => u.email?.endsWith('@palate-test.com') && u.email.includes(`agent_${cluster}_`))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) // oldest first
    if (matches.length === 0) throw new Error(`No test user for cluster "${cluster}". Run onboarding agent first.`)
    const base = CLUSTER_USERNAME_BASES[cluster]
    matches.slice(0, 2).forEach((user, i) => {
      allUsers.push({ user, cluster, username: i === 0 ? base : `${base}2` })
    })
  }
  return allUsers
}

async function assignUsernames(supabase, agents) {
  console.log('\nAssigning usernames...')
  for (const { user, username } of agents) {
    const { error } = await supabase.from('profiles').update({ username }).eq('id', user.id)
    if (error) console.error(`  ✗ ${user.email}: ${error.message}`)
    else console.log(`  ✓ ${user.email} → @${username}`)
  }
}

async function followOthers(page, currentAgent, allAgents, screenshotDir) {
  let followed = 0
  for (const target of allAgents) {
    if (target.user.id === currentAgent.user.id) continue

    await page.goto(`${BASE_URL}/people`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    const input = page.getByPlaceholder('Search by username...')
    await input.click()
    await page.keyboard.type(target.username, { delay: 80 })
    await page.waitForTimeout(1200)

    const followBtn = page.getByRole('button', { name: 'Follow' })
    const followingBtn = page.getByRole('button', { name: 'Following' })

    if (await followBtn.count() > 0) {
      await followBtn.first().click()
      await page.waitForTimeout(500)
      console.log(`    → followed @${target.username}`)
      followed++
    } else if (await followingBtn.count() > 0) {
      console.log(`    → already following @${target.username}`)
      followed++
    } else {
      await page.screenshot({ path: path.join(screenshotDir, `social-debug-${currentAgent.username}-${target.username}.png`) })
      console.log(`    ⚠ could not find follow button for @${target.username}`)
    }
    await page.waitForTimeout(300)
  }
  return followed
}

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('\nLooking up test users...')
  const agents = await getAllTestUsers(supabase)
  for (const { user, username } of agents) {
    console.log(`  ✓ @${username}: ${user.email}`)
  }

  await assignUsernames(supabase, agents)

  const screenshotDir = path.join(__dirname, 'screenshots')
  fs.mkdirSync(screenshotDir, { recursive: true })

  const browser = await chromium.launch({ headless: false, slowMo: 300 })
  const page = await browser.newPage()
  page.setDefaultTimeout(15000)

  let totalFollows = 0

  try {
    for (const agent of agents) {
      console.log(`\nLogging in as @${agent.username}...`)

      await page.goto(`${BASE_URL}/login`)
      await page.waitForLoadState('domcontentloaded')
      await page.fill('input[type="email"]', agent.user.email)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(`${BASE_URL}/`, { timeout: 15000 })
      console.log('  ✓ Logged in')

      const followed = await followOthers(page, agent, agents, screenshotDir)
      totalFollows += followed
      console.log(`  ✓ Followed ${followed}/${agents.length - 1} others`)

      await supabase.auth.signOut()
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
    }

    console.log(`\n✅ Social agent complete — ${totalFollows} total follows created`)
  } finally {
    await browser.close()
  }
}

run().catch(err => { console.error('\n❌ Agent failed:', err.message); process.exit(1) })
