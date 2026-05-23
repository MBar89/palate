export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const input = searchParams.get('input')

  if (!input) return Response.json({ predictions: [] })

  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=restaurant&location=51.5074,-0.1278&radius=50000&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY}`

  const res = await fetch(url)
  const data = await res.json()

  return Response.json(data)
}