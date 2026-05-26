import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'myles@barhamaviation.co.uk'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )
}

async function getUser(req) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await serviceClient().auth.getUser(token)
  return user
}

export async function GET(req) {
  const user = await getUser(req)
  if (!user || user.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = serviceClient()
  const [{ data: { users } }, { data: profiles }, { data: reviews }] = await Promise.all([
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from('profiles').select('id, username, cluster'),
    supabase.from('reviews').select('user_id'),
  ])

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
  const reviewCounts = {}
  ;(reviews || []).forEach(r => { reviewCounts[r.user_id] = (reviewCounts[r.user_id] || 0) + 1 })

  const result = users
    .map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      username: profileMap[u.id]?.username || null,
      cluster: profileMap[u.id]?.cluster || null,
      review_count: reviewCounts[u.id] || 0,
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return Response.json({ users: result })
}

export async function POST(req) {
  const user = await getUser(req)
  if (!user || user.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { action, id } = await req.json()
  const supabase = serviceClient()

  if (action === 'approve') {
    const { error } = await supabase.from('restaurants').update({ status: 'approved' }).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (action === 'reject') {
    const { error } = await supabase.from('restaurants').update({ status: 'rejected' }).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (action === 'delete') {
    await supabase.from('saves').delete().eq('restaurant_id', id)
    await supabase.from('reviews').delete().eq('restaurant_id', id)
    await supabase.from('calibration_ratings').delete().eq('restaurant_id', id)
    const { error } = await supabase.from('restaurants').delete().eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
