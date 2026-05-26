// Deletes test users created by agents
// Run: node scripts/agents/cleanup.js <user-id>
// Run: node scripts/agents/cleanup.js --all-agents   (deletes all @palate-test.com users)

const { createClient } = require('@supabase/supabase-js')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '../../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function deleteUser(userId, email) {
  await supabase.from('saves').delete().eq('user_id', userId)
  await supabase.from('reviews').delete().eq('user_id', userId)
  await supabase.from('calibration_ratings').delete().eq('user_id', userId)
  await supabase.from('follows').delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`)
  await supabase.from('profiles').delete().eq('id', userId)
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) {
    console.error(`✗ Failed to delete ${email}: ${error.message}`)
  } else {
    console.log(`✓ Deleted ${email} (${userId})`)
  }
}

async function run() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Usage:')
    console.error('  node scripts/agents/cleanup.js <user-id>')
    console.error('  node scripts/agents/cleanup.js --all-agents')
    process.exit(1)
  }

  if (arg === '--all-agents') {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (error) { console.error('Failed to list users:', error.message); process.exit(1) }
    const testUsers = data.users.filter(u => u.email?.endsWith('@palate-test.com'))
    if (testUsers.length === 0) { console.log('No test users found.'); return }
    console.log(`Deleting ${testUsers.length} test user(s)...`)
    for (const u of testUsers) {
      await deleteUser(u.id, u.email)
    }
  } else {
    const { data, error } = await supabase.auth.admin.getUserById(arg)
    if (error || !data.user) { console.error('User not found:', arg); process.exit(1) }
    await deleteUser(data.user.id, data.user.email)
  }
}

run().catch(err => { console.error(err.message); process.exit(1) })
