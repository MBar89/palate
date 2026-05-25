import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return Response.json({ predictions: [] }, { status: 401 })
  const { data: { user } } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY).auth.getUser(token)
  if (!user) return Response.json({ predictions: [] }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const input = searchParams.get('input')

  if (!input) return Response.json({ predictions: [] })

  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=restaurant&location=51.5074,-0.1278&radius=50000&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY}`

  const res = await fetch(url)
  const data = await res.json()

  return Response.json(data)
}