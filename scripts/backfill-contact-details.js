// Backfills phone, website, address, opening_hours, place_id for existing restaurants
// Run with: node scripts/backfill-contact-details.js

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load .env.local
const envPath = path.join(__dirname, '../.env.local')
const env = fs.readFileSync(envPath, 'utf8')
env.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)
const PLACES_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function findPlaceId(name, neighbourhood) {
  const query = `${name} ${neighbourhood} London`
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=restaurant&key=${PLACES_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  return data.results?.[0]?.place_id || null
}

async function getDetails(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,website,formatted_address,opening_hours,geometry&key=${PLACES_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  return data.result || null
}

async function run() {
  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select('id, name, neighbourhood, latitude, longitude')
    .eq('status', 'approved')
    .is('place_id', null)

  if (error) { console.error('Fetch error:', error); return }
  console.log(`Found ${restaurants.length} restaurants to backfill`)

  let success = 0, failed = 0

  for (const r of restaurants) {
    try {
      const placeId = await findPlaceId(r.name, r.neighbourhood)
      if (!placeId) { console.log(`  ✗ No place found: ${r.name}`); failed++; await sleep(200); continue }

      const details = await getDetails(placeId)
      if (!details) { console.log(`  ✗ No details: ${r.name}`); failed++; await sleep(200); continue }

      const update = {
        place_id: placeId,
        phone: details.formatted_phone_number || null,
        website: details.website || null,
        address: details.formatted_address || null,
        opening_hours: details.opening_hours?.weekday_text || null,
      }

      // Also backfill lat/lng if missing
      if (!r.latitude && details.geometry?.location) {
        update.latitude = details.geometry.location.lat
        update.longitude = details.geometry.location.lng
      }

      const { error: updateError } = await supabase.from('restaurants').update(update).eq('id', r.id)
      if (updateError) { console.log(`  ✗ Update failed: ${r.name} — ${updateError.message}`); failed++; }
      else { console.log(`  ✓ ${r.name}`); success++ }

      await sleep(200) // stay well within Places API rate limits
    } catch (e) {
      console.log(`  ✗ Error: ${r.name} — ${e.message}`)
      failed++
    }
  }

  console.log(`\nDone: ${success} updated, ${failed} failed`)
}

run()
