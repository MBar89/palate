// Social agent — assigns usernames to test users, then has each follow the others
// Run: node scripts/agents/social.js

const { chromium } = require('playwright')
const { createClient } = require('@supabase/supabase-js')
const path = require('path')
const fs = require('fs')

require('dotenv').config({ path: path.join(__dirname, '../../.env.local') })

const BASE_URL = 'https://palate-zeta.vercel.app'
const PASSWORD = 'TestAgent123!'

// Usernames for each cluster's test agent
const CLUSTER_USERNAMES = {
  adventurous: 'agent_adv',
  fine_dining: 'agent_fd',
  comfort:     'agent_com',
  casual:      'agent_cas',
}

async function getTestUsers(supabase) {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const testUsers = {}
  for (const cluster of Object.keys(CLUSTER_USERNAMES)) {
    const match = data.users
      .filter(u => u.email?.endsWith('@palate-test.com') && u.email.includes(`agent_${cluster}_`))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
    if (!match) throw new Error(`No test user for cluster "${cluster}". Run onboarding agent first.`)
    testUsers[cluster] = match
  }
  return testUsers
}

async function assignUsernames(supabase, testUsers) {
  console.log('\nAssigning usernames to test users...')
  for (const [cluster, user] of Object.entries(testUsers)) {
    const username = CLUSTER_USERNAMES[cluster]
    const { error } = await supabase
      .from('profiles')
      .update({ username })
      .eq('id', user.id)
    if (error) {
      console.error(`  ✗ ${cluster}: ${error.message}`)
    } else {
      console.log(`  ✓ ${cluster} → @${username}`)
    }
  }
}

async function followOthers(page, currentCluster, testUsers, screenshotDir) {
  await page.goto(`${BASE_URL}/people`)
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1000) // let useEffect load

  let followed = 0
  for (const [cluster, user] of Object.entries(testUsers)) {
    if (cluster === currentCluster) continue // skip self

    const username = CLUSTER_USERNAMES[cluster]

    // Navigate to /people fresh for each search to ensure clean state
    await page.goto(`${BASE_URL}/people`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    // Type username to trigger React's onChange
    const input = page.getByPlaceholder('Search by username...')
    await input.click()
    await page.keyboard.type(username, { delay: 80 })
    await page.waitForTimeout(1200) // wait for search results to load

    // Debug: take a screenshot to see what's on the page
    await page.screenshot({ path: path.join(screenshotDir, `social-debug-${currentCluster}-${username}.png`) })

    // One result per exact username search — just target the first visible button
    const followBtn = page.getByRole('button', { name: 'Follow' })
    const followingBtn = page.getByRole('button', { name: 'Following' })

    if (await followBtn.count() > 0) {
      await followBtn.first().click()
      await page.waitForTimeout(500)
      console.log(`    → followed @${username}`)
      followed++
    } else if (await followingBtn.count() > 0) {
      console.log(`    → already following @${username}`)
      followed++
    } else {
      await page.screenshot({ path: path.join(screenshotDir, `social-debug-${currentCluster}-${username}.png`) })
      console.log(`    ⚠ could not find follow button for @${username}`)
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

  // Get all 4 test users
  console.log('\nLooking up test users...')
  const testUsers = await getTestUsers(supabase)
  for (const [cluster, user] of Object.entries(testUsers)) {
    console.log(`  ✓ ${cluster}: ${user.email}`)
  }

  // Assign usernames via DB
  await assignUsernames(supabase, testUsers)

  const screenshotDir = path.join(__dirname, 'screenshots')
  fs.mkdirSync(screenshotDir, { recursive: true })

  const browser = await chromium.launch({ headless: false, slowMo: 300 })
  const page = await browser.newPage()
  page.setDefaultTimeout(15000)

  let totalFollows = 0

  try {
    for (const [cluster, user] of Object.entries(testUsers)) {
      console.log(`\nLogging in as ${cluster} (@${CLUSTER_USERNAMES[cluster]})...`)

      await page.goto(`${BASE_URL}/login`)
      await page.waitForLoadState('domcontentloaded')
      await page.fill('input[type="email"]', user.email)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(`${BASE_URL}/`, { timeout: 15000 })
      console.log('  ✓ Logged in')

      console.log('  Following others...')
      const followed = await followOthers(page, cluster, testUsers, screenshotDir)
      totalFollows += followed
      console.log(`  ✓ Followed ${followed}/3 other agents`)

      await page.screenshot({ path: path.join(screenshotDir, `social-${cluster}-complete.png`) })

      // Log out before next user
      await supabase.auth.signOut()
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })
    }

    console.log(`\n✅ Social agent complete — ${totalFollows} total follows created`)
    console.log('\nEach agent now follows the other 3. Friend activity feed should be populated.')

    await page.waitForTimeout(2000)
  } finally {
    await browser.close()
  }
}

run().catch(err => { console.error('\n❌ Agent failed:', err.message); process.exit(1) })
