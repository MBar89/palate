// Expands restaurant coverage in Soho, Mayfair, Covent Garden, Marylebone
// Uses multiple tiled search points per area to cover each neighbourhood fully.
// Run: node scripts/seed-central.js [--dry-run]

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const env = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
env.split('\n').forEach(l => { const [k, ...v] = l.split('='); if (k && v.length) process.env[k.trim()] = v.join('=').trim() })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const PLACES_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY
const DRY_RUN = process.argv.includes('--dry-run')

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Multiple tiled search points per area — 400m radius each for dense coverage
const SEARCH_POINTS = [
  // Soho — tiled across the full neighbourhood
  { neighbourhood: 'Soho', area: 'West End', lat: 51.5130, lng: -0.1340 }, // Carnaby St / western Soho
  { neighbourhood: 'Soho', area: 'West End', lat: 51.5130, lng: -0.1275 }, // Old Compton St / eastern Soho
  { neighbourhood: 'Soho', area: 'West End', lat: 51.5152, lng: -0.1308 }, // northern Soho / Oxford St end
  { neighbourhood: 'Soho', area: 'West End', lat: 51.5108, lng: -0.1308 }, // southern Soho / Shaftesbury Ave

  // Mayfair — tiled across the full neighbourhood
  { neighbourhood: 'Mayfair', area: 'West End', lat: 51.5118, lng: -0.1500 }, // northern Mayfair / Brook St
  { neighbourhood: 'Mayfair', area: 'West End', lat: 51.5083, lng: -0.1463 }, // southern Mayfair / Shepherd Market
  { neighbourhood: 'Mayfair', area: 'West End', lat: 51.5100, lng: -0.1540 }, // western Mayfair / Park Lane
  { neighbourhood: 'Mayfair', area: 'West End', lat: 51.5095, lng: -0.1410 }, // eastern Mayfair / Bond St

  // Covent Garden — tiled across the full neighbourhood
  { neighbourhood: 'Covent Garden', area: 'West End', lat: 51.5127, lng: -0.1233 }, // the piazza
  { neighbourhood: 'Covent Garden', area: 'West End', lat: 51.5120, lng: -0.1170 }, // eastern / Strand end
  { neighbourhood: 'Covent Garden', area: 'West End', lat: 51.5108, lng: -0.1255 }, // southern / Aldwych
  { neighbourhood: 'Covent Garden', area: 'West End', lat: 51.5140, lng: -0.1290 }, // western / Seven Dials

  // Marylebone — tiled across the full neighbourhood
  { neighbourhood: 'Marylebone', area: 'West End', lat: 51.5200, lng: -0.1555 }, // high street
  { neighbourhood: 'Marylebone', area: 'West End', lat: 51.5215, lng: -0.1490 }, // eastern Marylebone
  { neighbourhood: 'Marylebone', area: 'West End', lat: 51.5175, lng: -0.1610 }, // western Marylebone
  { neighbourhood: 'Marylebone', area: 'West End', lat: 51.5240, lng: -0.1545 }, // northern Marylebone
]

const TYPE_TO_CUISINE = {
  japanese_restaurant: 'Japanese', sushi_restaurant: 'Japanese', ramen_restaurant: 'Japanese',
  italian_restaurant: 'Italian', pizza_restaurant: 'Italian',
  chinese_restaurant: 'Chinese', dim_sum_restaurant: 'Chinese',
  indian_restaurant: 'Indian', thai_restaurant: 'Thai', french_restaurant: 'French',
  mexican_restaurant: 'Mexican', turkish_restaurant: 'Turkish', korean_restaurant: 'Korean',
  vietnamese_restaurant: 'Vietnamese', greek_restaurant: 'Greek',
  spanish_restaurant: 'Spanish', tapas_restaurant: 'Spanish',
  middle_eastern_restaurant: 'Middle Eastern', lebanese_restaurant: 'Lebanese',
  seafood_restaurant: 'Seafood', steak_house: 'Steakhouse',
  american_restaurant: 'American', burger_restaurant: 'American',
  barbecue_restaurant: 'BBQ', african_restaurant: 'African',
  mediterranean_restaurant: 'Mediterranean', brunch_restaurant: 'Brunch',
  breakfast_restaurant: 'Brunch', vegetarian_restaurant: 'Vegetarian',
  vegan_restaurant: 'Vegan', british_restaurant: 'British', gastropub: 'British', pub: 'British',
}

function guessCuisine(types = [], name = '') {
  for (const t of types) { if (TYPE_TO_CUISINE[t]) return TYPE_TO_CUISINE[t] }
  const n = name.toLowerCase()
  if (/sushi|ramen|izakaya|yakitori|tempura|udon/.test(n)) return 'Japanese'
  if (/pizza|trattoria|osteria|pasta|ristorante/.test(n)) return 'Italian'
  if (/dim sum|dumpling|wonton|cantonese/.test(n)) return 'Chinese'
  if (/curry|tandoor|masala|tikka|biryani/.test(n)) return 'Indian'
  if (/taco|burrito|cantina/.test(n)) return 'Mexican'
  if (/kebab|pide|meze/.test(n)) return 'Turkish'
  if (/pho|bun cha|banh mi/.test(n)) return 'Vietnamese'
  if (/thai|pad thai/.test(n)) return 'Thai'
  if (/burger|smash/.test(n)) return 'American'
  if (/steak|chophouse|grill/.test(n)) return 'Steakhouse'
  if (/seafood|oyster/.test(n)) return 'Seafood'
  if (/tapas|paella/.test(n)) return 'Spanish'
  if (/brasserie|bistro|café|cafe|creperie/.test(n)) return 'French'
  if (/vegan|plant.based/.test(n)) return 'Vegan'
  if (/pie|mash|fish.*chip/.test(n)) return 'British'
  return 'Modern European'
}

const PRICE_LEVEL_MAP = {
  PRICE_LEVEL_FREE: 1, PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 4, PRICE_LEVEL_VERY_EXPENSIVE: 5,
}

const CHAIN_NAMES = [
  'mcdonald', 'kfc', 'burger king', 'subway', 'pret a manger', 'pret ', 'greggs',
  "nando's", 'nandos', 'pizza express', 'wagamama', 'five guys', 'shake shack',
  'honest burger', "bill's", 'zizzi', 'bella italia', 'tgi friday', 'prezzo',
  'côte brasserie', 'cote brasserie', "carluccio's", 'café rouge', 'cafe rouge',
  'byron burger', 'leon restaurant', 'itsu', 'wasabi', 'tortilla',
  'pizza hut', "domino's", 'starbucks', 'caffe nero', 'wetherspoon',
  'harvester', 'toby carvery', "frankie & benny", 'chiquito', 'ask italian',
  'busaba', 'vapiano', 'turtle bay', 'ping pong',
]

function detectChain(name) {
  const n = name.toLowerCase()
  return CHAIN_NAMES.some(c => n.includes(c))
}

async function nearbySearch(lat, lng) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.types,places.priceLevel,places.rating,places.userRatingCount,places.formattedAddress,places.location,places.internationalPhoneNumber,places.websiteUri,places.regularOpeningHours',
    },
    body: JSON.stringify({
      includedTypes: ['restaurant'],
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 400 } },
      maxResultCount: 20,
      rankPreference: 'POPULARITY',
    }),
  })
  const data = await res.json()
  if (data.error) { console.error('  API error:', data.error.message); return [] }
  return data.places || []
}

async function run() {
  const { data: existing } = await supabase
    .from('restaurants').select('place_id, name').not('place_id', 'is', null)

  const existingPlaceIds = new Set(existing.map(r => r.place_id))
  const existingNames = new Set(existing.map(r => r.name.toLowerCase().trim()))
  console.log(`Loaded ${existingPlaceIds.size} existing place_ids\n`)

  const toInsert = []
  const seenPlaceIds = new Set(existingPlaceIds)
  const areaCounts = {}

  for (const point of SEARCH_POINTS) {
    process.stdout.write(`Searching ${point.neighbourhood} (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})... `)
    const results = await nearbySearch(point.lat, point.lng)
    await sleep(200)

    let found = 0
    for (const place of results) {
      const placeId = place.id
      if (!placeId || seenPlaceIds.has(placeId)) continue
      if (place.types?.includes('lodging')) continue
      if (!place.types?.includes('restaurant') && !place.types?.includes('food')) continue

      const name = place.displayName?.text || ''
      if (/\b(hotel|inn|lodge|hostel)\b/i.test(name)) continue
      if (place.rating && place.rating < 3.9) continue
      if (place.userRatingCount && place.userRatingCount < 30) continue
      if (existingNames.has(name.toLowerCase().trim())) continue

      seenPlaceIds.add(placeId)

      toInsert.push({
        name,
        cuisine: guessCuisine(place.types || [], name),
        neighbourhood: point.neighbourhood,
        area: point.area,
        price_range: PRICE_LEVEL_MAP[place.priceLevel] ?? 2,
        is_chain: detectChain(name),
        status: 'approved',
        latitude: place.location?.latitude || null,
        longitude: place.location?.longitude || null,
        place_id: placeId,
        phone: place.internationalPhoneNumber || null,
        website: place.websiteUri || null,
        address: place.formattedAddress || null,
        opening_hours: place.regularOpeningHours?.weekdayDescriptions || null,
      })
      areaCounts[point.neighbourhood] = (areaCounts[point.neighbourhood] || 0) + 1
      found++
    }
    console.log(`${found} new`)
  }

  console.log(`\n${toInsert.length} restaurants to insert`)
  console.log('Breakdown:', Object.entries(areaCounts).map(([k,v]) => `${k}: ${v}`).join(', '))

  if (DRY_RUN) {
    console.log('\n[DRY RUN] First 10:')
    toInsert.slice(0, 10).forEach(r =>
      console.log(`  ${r.name} (${r.cuisine}, £${r.price_range}) — ${r.neighbourhood}`)
    )
    return
  }

  let inserted = 0, failed = 0
  for (let i = 0; i < toInsert.length; i += 20) {
    const batch = toInsert.slice(i, i + 20)
    const { error } = await supabase.from('restaurants').insert(batch)
    if (error) { console.error(`Batch error:`, error.message); failed += batch.length }
    else { inserted += batch.length; process.stdout.write(`\rInserted ${inserted}/${toInsert.length}...`) }
    await sleep(100)
  }

  console.log(`\n\nDone: ${inserted} inserted, ${failed} failed`)
  console.log('New counts — Soho: ~' + (26 + (areaCounts['Soho']||0)) +
    ', Mayfair: ~' + (19 + (areaCounts['Mayfair']||0)) +
    ', Covent Garden: ~' + (16 + (areaCounts['Covent Garden']||0)) +
    ', Marylebone: ~' + (11 + (areaCounts['Marylebone']||0)))
}

run()
