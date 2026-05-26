// Onboarding agent — creates a test user, logs in, completes calibration, verifies feed
// Run: node scripts/agents/onboarding.js [adventurous|fine_dining|comfort|casual]

const { chromium } = require('playwright')
const { createClient } = require('@supabase/supabase-js')
const path = require('path')
const fs = require('fs')

require('dotenv').config({ path: path.join(__dirname, '../../.env.local') })

const BASE_URL = 'https://palate-zeta.vercel.app'
const PASSWORD = 'TestAgent123!'

// Ratings designed to deterministically produce each cluster
// adventurous:  lovedIndependent >= 2 AND dislikedChains >= 1
// fine_dining:  lovedFine >= 1 AND dislikedChains >= 1
// comfort:      lovedChains >= 2
// casual:       none of the above
const TASTE_PROFILES = {
  adventurous: {
    'Dishoom': 'love',
    'Wagamama': 'disliked',
    'Hawksmoor': 'love',
    'Pret a Manger': 'never',
    'The Ledbury': 'mixed',
    'Five Guys': 'never',
    'Ottolenghi': 'love',
    'Nobu': 'mixed',
  },
  fine_dining: {
    'Dishoom': 'mixed',
    'Wagamama': 'disliked',
    'Hawksmoor': 'mixed',
    'Pret a Manger': 'never',
    'The Ledbury': 'love',
    'Five Guys': 'never',
    'Ottolenghi': 'mixed',
    'Nobu': 'love',
  },
  comfort: {
    'Dishoom': 'mixed',
    'Wagamama': 'love',
    'Hawksmoor': 'mixed',
    'Pret a Manger': 'love',
    'The Ledbury': 'never',
    'Five Guys': 'love',
    'Ottolenghi': 'never',
    'Nobu': 'never',
  },
  casual: {
    'Dishoom': 'mixed',
    'Wagamama': 'mixed',
    'Hawksmoor': 'mixed',
    'Pret a Manger': 'mixed',
    'The Ledbury': 'never',
    'Five Guys': 'mixed',
    'Ottolenghi': 'mixed',
    'Nobu': 'never',
  },
}

// Must match the order in app/calibration/page.js
const RESTAURANT_ORDER = [
  'Dishoom', 'Wagamama', 'Hawksmoor', 'Pret a Manger',
  'The Ledbury', 'Five Guys', 'Ottolenghi', 'Nobu',
]

const RATING_LABELS = {
  never: 'Never been',
  love: 'Loved it',
  mixed: 'Mixed',
  disliked: 'Disliked',
}

async function run() {
  const profile = process.argv[2] || 'adventurous'

  if (!TASTE_PROFILES[profile]) {
    console.error(`Unknown profile "${profile}". Available: ${Object.keys(TASTE_PROFILES).join(', ')}`)
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  // Create test user via admin API — bypasses email confirmation
  const email = `agent_${profile}_${Date.now()}@palate-test.com`
  console.log(`\nCreating test user: ${email}`)

  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (userError) {
    console.error('Failed to create user:', userError.message)
    process.exit(1)
  }
  const userId = userData.user.id
  console.log(`✓ User created: ${userId}`)

  const screenshotDir = path.join(__dirname, 'screenshots')
  fs.mkdirSync(screenshotDir, { recursive: true })

  const browser = await chromium.launch({ headless: false, slowMo: 400 })
  const page = await browser.newPage()
  page.setDefaultTimeout(20000)

  try {
    // Step 1: Log in
    console.log('\nStep 1: Logging in...')
    await page.goto(`${BASE_URL}/login`)
    await page.waitForLoadState('domcontentloaded')
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(`${BASE_URL}/`, { timeout: 20000 })
    console.log('✓ Logged in')

    // Step 2: Calibrate
    console.log('\nStep 2: Calibrating taste profile...')
    await page.goto(`${BASE_URL}/calibration`)
    await page.waitForLoadState('domcontentloaded')

    const ratings = TASTE_PROFILES[profile]
    for (const name of RESTAURANT_ORDER) {
      const label = RATING_LABELS[ratings[name]]
      const idx = RESTAURANT_ORDER.indexOf(name)
      // Each rating button appears once per card in the same order as RESTAURANT_ORDER
      await page.getByRole('button', { name: label }).nth(idx).click()
      console.log(`  ✓ ${name}: ${label}`)
    }

    await page.getByRole('button', { name: 'See my matches' }).click()
    await page.waitForURL(`${BASE_URL}/`, { timeout: 20000 })
    console.log('✓ Calibration submitted')

    // Step 3: Verify cluster assigned in DB
    const { data: profileData } = await supabase
      .from('profiles')
      .select('cluster')
      .eq('id', userId)
      .single()

    const cluster = profileData?.cluster
    const clusterMatch = cluster === profile || (profile === 'casual' && cluster === 'casual')
    const clusterIcon = clusterMatch ? '✓' : '⚠'
    console.log(`${clusterIcon} Cluster assigned: ${cluster} (expected: ${profile})`)

    await page.screenshot({ path: path.join(screenshotDir, `onboarding-${profile}-success.png`) })

    console.log(`\n✅ Onboarding complete`)
    console.log(`   Email:    ${email}`)
    console.log(`   Password: ${PASSWORD}`)
    console.log(`   Profile:  ${profile}`)
    console.log(`   Cluster:  ${cluster}`)
    console.log(`   User ID:  ${userId}`)
    console.log(`\nTo clean up this user:`)
    console.log(`   node scripts/agents/cleanup.js ${userId}`)
    console.log(`\nTo clean up all test users:`)
    console.log(`   node scripts/agents/cleanup.js --all-agents`)

    await page.waitForTimeout(2000)
  } catch (err) {
    const screenshotPath = path.join(screenshotDir, `onboarding-error-${Date.now()}.png`)
    await page.screenshot({ path: screenshotPath })
    console.error(`\n❌ Agent failed: ${err.message}`)
    console.error(`   Screenshot: ${screenshotPath}`)
    throw err
  } finally {
    await browser.close()
  }
}

run().catch(() => process.exit(1))
