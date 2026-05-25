import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return Response.json({ result: null }, { status: 401 })
  const { data: { user } } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY).auth.getUser(token)
  if (!user) return Response.json({ result: null }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const placeId = searchParams.get('place_id')

  if (!placeId) return Response.json({ result: null })

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,address_components,price_level,geometry,formatted_phone_number,website,formatted_address,opening_hours&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY}`

  const res = await fetch(url)
  const data = await res.json()

  return Response.json(data)
}