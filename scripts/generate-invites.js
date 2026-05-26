// Generates a batch of invite codes and prints the shareable URLs.
// Run: node scripts/generate-invites.js [count]
// Default count: 25

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const env = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
env.split('\n').forEach(l => { const [k, ...v] = l.split('='); if (k && v.length) process.env[k.trim()] = v.join('=').trim() })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const APP_URL = 'https://palate-zeta.vercel.app'
const ADMIN_EMAIL = 'myles@barhamaviation.co.uk'

const count = parseInt(process.argv[2] || '25', 10)

function makeCode() {
  return Math.random().toString(36).substring(2, 10)
}

async function run() {
  // Get admin user ID
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const admin = data.users.find(u => u.email === ADMIN_EMAIL)
  if (!admin) { console.error('Admin user not found'); process.exit(1) }

  // Check existing unused codes
  const { data: existing } = await supabase
    .from('invites')
    .select('code')
    .eq('created_by', admin.id)
    .is('used_by', null)

  if (existing?.length > 0) {
    console.log(`\n${existing.length} unused invite(s) already exist:\n`)
    existing.forEach(({ code }) => console.log(`  ${APP_URL}/invite/${code}`))
    console.log()
  }

  // Generate new codes
  const codes = Array.from({ length: count }, makeCode)
  const rows = codes.map(code => ({ code, created_by: admin.id }))

  const { error } = await supabase.from('invites').insert(rows)
  if (error) { console.error('Insert failed:', error.message); process.exit(1) }

  console.log(`✅ ${count} new invite links generated:\n`)
  codes.forEach(code => console.log(`  ${APP_URL}/invite/${code}`))
  console.log(`\nTotal unused invites: ${(existing?.length || 0) + count}`)
}

run()
