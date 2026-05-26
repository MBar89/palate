// Inserts a batch of well-known London chain restaurants
// Run: node scripts/seed-chains.js

const { createClient } = require('@supabase/supabase-js')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const chains = [
  // Price range 1 — budget
  { name: "McDonald's Oxford Street",   cuisine: 'Fast Food',    neighbourhood: 'Oxford Street',   area: 'Central London', price_range: 1 },
  { name: "McDonald's Brixton",          cuisine: 'Fast Food',    neighbourhood: 'Brixton',          area: 'South London',  price_range: 1 },
  { name: "Pret A Manger Canary Wharf", cuisine: 'Sandwiches',   neighbourhood: 'Canary Wharf',     area: 'East London',   price_range: 1 },
  { name: "KFC Leicester Square",        cuisine: 'Fast Food',    neighbourhood: 'Leicester Square', area: 'Central London', price_range: 1 },
  { name: "Subway Victoria",             cuisine: 'Fast Food',    neighbourhood: 'Victoria',         area: 'Central London', price_range: 1 },

  // Price range 2 — casual chains
  { name: 'Nando\'s Clapham',           cuisine: 'Portuguese',   neighbourhood: 'Clapham',          area: 'South London',  price_range: 2 },
  { name: 'Nando\'s Shoreditch',        cuisine: 'Portuguese',   neighbourhood: 'Shoreditch',       area: 'East London',   price_range: 2 },
  { name: 'Pizza Express Soho',         cuisine: 'Italian',      neighbourhood: 'Soho',             area: 'Central London', price_range: 2 },
  { name: 'Pizza Express Islington',    cuisine: 'Italian',      neighbourhood: 'Islington',        area: 'North London',  price_range: 2 },
  { name: 'Wagamama Southbank',         cuisine: 'Japanese',     neighbourhood: 'Southbank',        area: 'South London',  price_range: 2 },
  { name: 'Wagamama Covent Garden',     cuisine: 'Japanese',     neighbourhood: 'Covent Garden',    area: 'Central London', price_range: 2 },
  { name: 'Five Guys Covent Garden',    cuisine: 'Burgers',      neighbourhood: 'Covent Garden',    area: 'Central London', price_range: 2 },
  { name: 'Shake Shack Oxford Circus',  cuisine: 'American',     neighbourhood: 'Oxford Street',    area: 'Central London', price_range: 2 },
  { name: 'Honest Burgers Brixton',     cuisine: 'Burgers',      neighbourhood: 'Brixton',          area: 'South London',  price_range: 2 },
  { name: 'Honest Burgers Hackney',     cuisine: 'Burgers',      neighbourhood: 'Hackney',          area: 'East London',   price_range: 2 },
  { name: "Bill's Covent Garden",       cuisine: 'British',      neighbourhood: 'Covent Garden',    area: 'Central London', price_range: 2 },
  { name: 'Zizzi Islington',            cuisine: 'Italian',      neighbourhood: 'Islington',        area: 'North London',  price_range: 2 },
  { name: 'Bella Italia Waterloo',      cuisine: 'Italian',      neighbourhood: 'Waterloo',         area: 'South London',  price_range: 2 },
  { name: 'TGI Fridays Leicester Square', cuisine: 'American',   neighbourhood: 'Leicester Square', area: 'Central London', price_range: 2 },
  { name: 'Prezzo Kensington',          cuisine: 'Italian',      neighbourhood: 'Kensington',       area: 'West London',   price_range: 2 },

  // Price range 3 — mid-range chains
  { name: "Côte Brasserie Soho",        cuisine: 'French',       neighbourhood: 'Soho',             area: 'Central London', price_range: 3 },
  { name: "Côte Brasserie Chelsea",     cuisine: 'French',       neighbourhood: 'Chelsea',          area: 'West London',   price_range: 3 },
  { name: 'Carluccio\'s Covent Garden', cuisine: 'Italian',      neighbourhood: 'Covent Garden',    area: 'Central London', price_range: 3 },
  { name: 'Café Rouge Canary Wharf',    cuisine: 'French',       neighbourhood: 'Canary Wharf',     area: 'East London',   price_range: 3 },
  { name: 'Byron Burger Soho',          cuisine: 'Burgers',      neighbourhood: 'Soho',             area: 'Central London', price_range: 3 },
]

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  const rows = chains.map(c => ({
    ...c,
    is_chain: true,
    status: 'approved',
  }))

  const { data, error } = await supabase
    .from('restaurants')
    .insert(rows)
    .select('id, name')

  if (error) {
    console.error('Insert failed:', error.message)
    process.exit(1)
  }

  console.log(`Inserted ${data.length} chain restaurants:`)
  data.forEach(r => console.log(`  ${r.name}`))
}

run().catch(err => { console.error(err.message); process.exit(1) })
