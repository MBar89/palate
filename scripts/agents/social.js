// Social agent — assigns usernames and creates follows between all test agents directly via Supabase.
// Supports up to 2 agents per cluster.
// Run: node scripts/agents/social.js

const { createClient } = require('@supabase/supabase-js')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '../../.env.local') })

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
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    if (matches.length === 0) throw new Error(`No test user for cluster "${cluster}". Run onboarding agent first.`)
    const base = CLUSTER_USERNAME_BASES[cluster]
    matches.slice(0, 2).forEach((user, i) => {
      allUsers.push({ user, cluster, username: i === 0 ? base : `${base}2` })
    })
  }
  return allUsers
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

  // Assign usernames
  console.log('\nAssigning usernames...')
  for (const { user, username } of agents) {
    const { error } = await supabase.from('profiles').update({ username }).eq('id', user.id)
    if (error) console.error(`  ✗ ${user.email}: ${error.message}`)
    else console.log(`  ✓ @${username}`)
  }

  // Create follows between all agents (each follows every other)
  console.log('\nCreating follows...')
  let created = 0, skipped = 0

  for (const followerAgent of agents) {
    for (const followedAgent of agents) {
      if (followerAgent.user.id === followedAgent.user.id) continue

      const { error } = await supabase.from('follows').upsert(
        { follower_id: followerAgent.user.id, following_id: followedAgent.user.id },
        { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
      )
      if (error) {
        console.error(`  ✗ @${followerAgent.username} → @${followedAgent.username}: ${error.message}`)
      } else {
        console.log(`  ✓ @${followerAgent.username} → @${followedAgent.username}`)
        created++
      }
    }
  }

  console.log(`\n✅ Social agent complete — ${created} follows created/verified`)
  console.log(`   ${agents.length} agents each follow the other ${agents.length - 1}`)
}

run().catch(err => { console.error('\n❌ Agent failed:', err.message); process.exit(1) })
