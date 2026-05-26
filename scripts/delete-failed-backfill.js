const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const env = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
env.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const FAILED = ["Lyle's", "Rawduck", "Oklava", "Xu", "Texture", "The Providores", "Pachamama", "Roganic", "Eneko Basque Kitchen", "Frenchie", "Flat Three", "Bright"]

async function run() {
  const { data: restaurants } = await supabase.from('restaurants').select('id, name').in('name', FAILED)
  console.log(`Found ${restaurants.length} to delete`)

  for (const r of restaurants) {
    await supabase.from('saves').delete().eq('restaurant_id', r.id)
    await supabase.from('reviews').delete().eq('restaurant_id', r.id)
    await supabase.from('calibration_ratings').delete().eq('restaurant_id', r.id)
    const { error } = await supabase.from('restaurants').delete().eq('id', r.id)
    console.log(error ? `  ✗ ${r.name}: ${error.message}` : `  ✓ Deleted: ${r.name}`)
  }
}

run()
