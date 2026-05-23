import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    )

    const { reviewer_id, restaurant_id } = await request.json()
    console.log('Notify called:', reviewer_id, restaurant_id)

    const { data: restaurant } = await supabase
      .from('restaurants').select('name').eq('id', restaurant_id).single()
    console.log('Restaurant:', restaurant)

    const { data: reviewerProfile } = await supabase
      .from('profiles').select('cluster').eq('id', reviewer_id).single()
    console.log('Reviewer profile:', reviewerProfile)

    const { data: matchedUsers } = await supabase
      .from('profiles').select('id')
      .eq('cluster', reviewerProfile?.cluster)
      .neq('id', reviewer_id)
    console.log('Matched users:', matchedUsers)

    if (!matchedUsers || matchedUsers.length === 0) {
      return Response.json({ sent: 0 })
    }

    const userIds = matchedUsers.map(u => u.id)
    const { data: users } = await supabase.auth.admin.listUsers()
    const matchedEmails = users?.users
      ?.filter(u => userIds.includes(u.id))
      ?.map(u => u.email) || []
    console.log('Matched emails:', matchedEmails)

    let sent = 0
    for (const email of matchedEmails) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'palate <onboarding@resend.dev>',
          to: email,
          subject: `Someone with your taste just reviewed ${restaurant?.name}`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
              <h1 style="font-family:Georgia,serif;font-size:32px;color:#3D2B4F;font-style:italic;margin-bottom:8px;">palate</h1>
              <p style="font-size:14px;color:#5A534E;margin-bottom:24px;">Someone with your taste just reviewed a restaurant you might love.</p>
              <div style="background:#F7F3EE;border-radius:16px;padding:20px;margin-bottom:24px;">
                <p style="font-size:16px;font-weight:500;color:#1A1714;margin-bottom:4px;">${restaurant?.name}</p>
                <p style="font-size:13px;color:#9A928A;">was just reviewed by someone with your taste profile</p>
              </div>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="display:inline-block;padding:12px 28px;background:#3D2B4F;color:#F7F3EE;border-radius:14px;text-decoration:none;font-size:14px;font-weight:500;">See the review</a>
            </div>
          `,
        }),
      })
      const data = await res.json()
      console.log('Email response:', data)
      sent++
    }

    return Response.json({ sent })
  } catch (err) {
    console.error('Notify error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}