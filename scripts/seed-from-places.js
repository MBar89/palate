// Expands the restaurant DB by searching Google Places v1 Nearby Search across London neighbourhoods.
// Uses the new Places API v1 which returns cuisine-specific types (japanese_restaurant, etc.)
// Fetches details, deduplicates against existing place_ids, inserts as approved.
// Run with: node scripts/seed-from-places.js [--dry-run]

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const env = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
env.split('\n').forEach(l => { const [k, ...v] = l.split('='); if (k && v.length) process.env[k.trim()] = v.join('=').trim() })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const PLACES_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY
const DRY_RUN = process.argv.includes('--dry-run')

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Neighbourhoods focused on under-represented areas
const SEARCH_AREAS = [
  { neighbourhood: 'Bermondsey',      area: 'South London',       lat: 51.4990, lng: -0.0801 },
  { neighbourhood: 'Clapham',         area: 'South London',       lat: 51.4618, lng: -0.1384 },
  { neighbourhood: 'Battersea',       area: 'South London',       lat: 51.4817, lng: -0.1472 },
  { neighbourhood: 'Tooting',         area: 'South London',       lat: 51.4278, lng: -0.1685 },
  { neighbourhood: 'Greenwich',       area: 'South East London',  lat: 51.4796, lng: -0.0135 },
  { neighbourhood: 'Deptford',        area: 'South East London',  lat: 51.4769, lng: -0.0225 },
  { neighbourhood: 'Elephant & Castle', area: 'South London',     lat: 51.4952, lng: -0.1004 },
  { neighbourhood: 'Crystal Palace',  area: 'South London',       lat: 51.4153, lng: -0.0742 },
  { neighbourhood: 'Camden',          area: 'North London',       lat: 51.5390, lng: -0.1426 },
  { neighbourhood: 'Stoke Newington', area: 'North London',       lat: 51.5632, lng: -0.0748 },
  { neighbourhood: 'Kentish Town',    area: 'North London',       lat: 51.5512, lng: -0.1429 },
  { neighbourhood: 'Highgate',        area: 'North London',       lat: 51.5710, lng: -0.1470 },
  { neighbourhood: 'Hackney Wick',    area: 'East London',        lat: 51.5408, lng: -0.0265 },
  { neighbourhood: 'Walthamstow',     area: 'East London',        lat: 51.5820, lng: -0.0177 },
  { neighbourhood: 'Stratford',       area: 'East London',        lat: 51.5416, lng:  0.0015 },
  { neighbourhood: "Shepherd's Bush", area: 'West London',        lat: 51.5050, lng: -0.2200 },
  { neighbourhood: 'Fulham',          area: 'West London',        lat: 51.4770, lng: -0.2008 },
  { neighbourhood: 'Ladbroke Grove',  area: 'West London',        lat: 51.5160, lng: -0.2120 },
  { neighbourhood: 'Putney',          area: 'South West London',  lat: 51.4614, lng: -0.2161 },
  { neighbourhood: 'Waterloo',        area: 'Central London',     lat: 51.5035, lng: -0.1141 },
  { neighbourhood: 'Vauxhall',        area: 'South London',       lat: 51.4858, lng: -0.1237 },
  { neighbourhood: 'Borough',         area: 'South London',       lat: 51.5013, lng: -0.0924 },
]

// Maps Places API v1 types → cuisine label
const TYPE_TO_CUISINE = {
  japanese_restaurant: 'Japanese',
  sushi_restaurant: 'Japanese',
  ramen_restaurant: 'Japanese',
  italian_restaurant: 'Italian',
  pizza_restaurant: 'Italian',
  chinese_restaurant: 'Chinese',
  dim_sum_restaurant: 'Chinese',
  indian_restaurant: 'Indian',
  thai_restaurant: 'Thai',
  french_restaurant: 'French',
  mexican_restaurant: 'Mexican',
  turkish_restaurant: 'Turkish',
  korean_restaurant: 'Korean',
  vietnamese_restaurant: 'Vietnamese',
  greek_restaurant: 'Greek',
  spanish_restaurant: 'Spanish',
  tapas_restaurant: 'Spanish',
  middle_eastern_restaurant: 'Middle Eastern',
  lebanese_restaurant: 'Lebanese',
  seafood_restaurant: 'Seafood',
  steak_house: 'Steakhouse',
  american_restaurant: 'American',
  burger_restaurant: 'American',
  barbecue_restaurant: 'BBQ',
  african_restaurant: 'African',
  mediterranean_restaurant: 'Mediterranean',
  brunch_restaurant: 'Brunch',
  breakfast_restaurant: 'Brunch',
  vegetarian_restaurant: 'Vegetarian',
  vegan_restaurant: 'Vegan',
  british_restaurant: 'British',
  gastropub: 'British',
  pub: 'British',
}

function guessCuisine(types = [], name = '') {
  // Check types first (new API returns specific cuisine types)
  for (const t of types) {
    if (TYPE_TO_CUISINE[t]) return TYPE_TO_CUISINE[t]
  }
  // Name-based fallback
  const n = name.toLowerCase()
  if (/sushi|ramen|izakaya|yakitori|tempura|udon|tonkatsu/.test(n)) return 'Japanese'
  if (/pizza|trattoria|osteria|pasta|ristorante|gelato/.test(n)) return 'Italian'
  if (/dim sum|dumpling|wonton|peking|cantonese/.test(n)) return 'Chinese'
  if (/curry|tandoor|masala|tikka|biryani|dhaba/.test(n)) return 'Indian'
  if (/taco|burrito|quesadilla|cantina/.test(n)) return 'Mexican'
  if (/kebab|pide|meze|baklava/.test(n)) return 'Turkish'
  if (/pho|bun cha|banh mi|viet/.test(n)) return 'Vietnamese'
  if (/thai|pad thai|tom yum/.test(n)) return 'Thai'
  if (/burger|smash|patty/.test(n)) return 'American'
  if (/steak|chophouse|grill/.test(n)) return 'Steakhouse'
  if (/seafood|oyster|fishmonger/.test(n)) return 'Seafood'
  if (/tapas|paella|bodega/.test(n)) return 'Spanish'
  if (/brasserie|bistro|café|cafe|creperie/.test(n)) return 'French'
  if (/vegan|plant.based/.test(n)) return 'Vegan'
  if (/pie|mash|chippie|chippy|fish.*chip/.test(n)) return 'British'
  return 'Modern European'
}

// Places API v1 price level → our price_range 1–5
const PRICE_LEVEL_MAP = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 4,
  PRICE_LEVEL_VERY_EXPENSIVE: 5,
}

function mapPriceLevel(level) {
  return PRICE_LEVEL_MAP[level] ?? 2
}

const CHAIN_NAMES = [
  'mcdonald', 'kfc', 'burger king', 'subway', 'pret a manger', 'pret ', 'greggs',
  "nando's", 'nandos', 'pizza express', 'wagamama', 'five guys', 'shake shack',
  'honest burger', "bill's", 'zizzi', 'bella italia', 'tgi friday', 'prezzo',
  'côte brasserie', 'cote brasserie', "carluccio's", 'café rouge', 'cafe rouge',
  'byron burger', 'leon restaurant', 'itsu', 'wasabi', 'tortilla', 'chilango',
  'pizza hut', "domino's", 'starbucks', 'caffe nero', 'wetherspoon', 'jd wetherspoon',
  'harvester', 'toby carvery', "frankie & benny", 'chiquito', 'ask italian',
  'busaba', 'vapiano', 'turtle bay', 'ping pong', 'dim t',
]

function detectChain(name) {
  const n = name.toLowerCase()
  return CHAIN_NAMES.some(c => n.includes(c))
}

// Places API v1 Nearby Search
async function nearbySearch(lat, lng) {
  const url = 'https://places.googleapis.com/v1/places:searchNearby'
  const body = {
    includedTypes: ['restaurant'],
    locationRestriction: {
      circle: { center: { latitude: lat, longitude: lng }, radius: 500 }
    },
    maxResultCount: 20,
    rankPreference: 'POPULARITY',
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.types,places.priceLevel,places.rating,places.userRatingCount,places.formattedAddress,places.location,places.internationalPhoneNumber,places.websiteUri,places.regularOpeningHours',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.error) { console.error('  Nearby search error:', data.error.message); return [] }
  return data.places || []
}

async function run() {
  const { data: existing, error: fetchErr } = await supabase
    .from('restaurants')
    .select('place_id, name')
    .not('place_id', 'is', null)

  if (fetchErr) { console.error('Failed to load existing restaurants:', fetchErr); return }

  const existingPlaceIds = new Set(existing.map(r => r.place_id))
  const existingNames = new Set(existing.map(r => r.name.toLowerCase().trim()))
  console.log(`Loaded ${existingPlaceIds.size} existing place_ids\n`)

  const toInsert = []
  const seenPlaceIds = new Set(existingPlaceIds)

  for (const area of SEARCH_AREAS) {
    console.log(`Searching ${area.neighbourhood}...`)
    const results = await nearbySearch(area.lat, area.lng)
    await sleep(200)

    let areaCount = 0
    for (const place of results) {
      const placeId = place.id
      if (!placeId || seenPlaceIds.has(placeId)) continue

      // Skip non-restaurant types
      if (place.types?.includes('lodging')) continue
      if (!place.types?.includes('restaurant') && !place.types?.includes('food')) continue

      // Skip by name (hotel keywords)
      const name = place.displayName?.text || ''
      if (/\b(hotel|inn|lodge|hostel)\b/i.test(name)) continue

      // Quality filter
      if (place.rating && place.rating < 3.9) continue
      if (place.userRatingCount && place.userRatingCount < 30) continue

      // Dedup by name
      if (existingNames.has(name.toLowerCase().trim())) continue

      seenPlaceIds.add(placeId)

      const cuisine = guessCuisine(place.types || [], name)
      const price_range = mapPriceLevel(place.priceLevel)
      const is_chain = detectChain(name)

      // Build opening hours array
      const opening_hours = place.regularOpeningHours?.weekdayDescriptions || null

      toInsert.push({
        name,
        cuisine,
        neighbourhood: area.neighbourhood,
        area: area.area,
        price_range,
        is_chain,
        status: 'approved',
        latitude: place.location?.latitude || null,
        longitude: place.location?.longitude || null,
        place_id: placeId,
        phone: place.internationalPhoneNumber || null,
        website: place.websiteUri || null,
        address: place.formattedAddress || null,
        opening_hours,
      })
      areaCount++
    }
    console.log(`  → ${areaCount} new restaurants found`)
  }

  console.log(`\n${toInsert.length} restaurants to insert`)

  if (DRY_RUN) {
    console.log('\n[DRY RUN] First 15:')
    toInsert.slice(0, 15).forEach(r =>
      console.log(`  ${r.name} (${r.cuisine}, price ${r.price_range}, chain: ${r.is_chain}) — ${r.neighbourhood}`)
    )
    // Show cuisine breakdown
    const cuisineCounts = {}
    toInsert.forEach(r => { cuisineCounts[r.cuisine] = (cuisineCounts[r.cuisine] || 0) + 1 })
    console.log('\nCuisine breakdown:')
    Object.entries(cuisineCounts).sort((a,b)=>b[1]-a[1]).forEach(([c,n]) => console.log(`  ${c}: ${n}`))
    return
  }

  // Insert in batches of 20
  let inserted = 0, failed = 0
  for (let i = 0; i < toInsert.length; i += 20) {
    const batch = toInsert.slice(i, i + 20)
    const { error } = await supabase.from('restaurants').insert(batch)
    if (error) {
      console.error(`Batch ${Math.floor(i/20)+1} error:`, error.message)
      failed += batch.length
    } else {
      inserted += batch.length
      process.stdout.write(`\rInserted ${inserted}/${toInsert.length}...`)
    }
    await sleep(100)
  }

  console.log(`\n\nDone: ${inserted} inserted, ${failed} failed`)
  console.log(`DB total now approximately ${144 + inserted}`)
}

run()
