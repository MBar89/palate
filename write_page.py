content = """'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

export default function HomePage() {
  const [restaurants, setRestaurants] = useState([])
  const [user, setUser] = useState(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)

      const { data: ratings } = await supabase
        .from('calibration_ratings')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)

      if (!ratings || ratings.length === 0) {
        window.location.href = '/calibration'
        return
      }

      const { data, error } = await supabase.rpc('get_personalised_feed', { user_uuid: user.id })
      if (error) console.error('Feed error:', error)
      if (data) setRestaurants(data)
    }
    load()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif',padding:'0 0 48px'}}>
      <div style={{background:'#3D2B4F',padding:'16px 24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'28px',color:'#F7F3EE',fontStyle:'italic',margin:0}}>palate</h1>
        {user && <button onClick={handleSignOut} style={{background:'transparent',border:'1.5px solid rgba(247,243,238,0.4)',color:'#F7F3EE',borderRadius:'8px',padding:'6px 14px',fontSize:'13px',cursor:'pointer'}}>Sign out</button>}
      </div>
      <div style={{padding:'16px 16px 8px',fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase'}}>Your matches</div>
      <div style={{padding:'0 16px'}}>
        {restaurants.map(r => (
          <div key={r.id} onClick={() => window.location.href='/restaurant/'+r.id} style={{background:'white',borderRadius:'16px',padding:'16px',marginBottom:'10px',boxShadow:'0 2px 12px rgba(26,23,20,0.07)',cursor:'pointer'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
              <div>
                <div style={{fontFamily:'Georgia,serif',fontSize:'18px',color:'#1A1714',marginBottom:'2px'}}>{r.name}</div>
                <div style={{fontSize:'12px',color:'#9A928A'}}>{r.cuisine} · {r.neighbourhood} · {'£'.repeat(r.price_range)}</div>
              </div>
              <div style={{fontSize:'12px',fontWeight:'500',padding:'4px 10px',borderRadius:'20px',background:'#E8E0F5',color:'#3D2B4F',flexShrink:0,marginLeft:'8px'}}>{r.match_score}% match</div>
            </div>
            <div style={{height:'3px',background:'#DDD6CC',borderRadius:'2px',overflow:'hidden',marginBottom:'8px'}}>
              <div style={{height:'100%',background:'linear-gradient(90deg,#8B6FAD,#3D2B4F)',borderRadius:'2px',width:r.match_score+'%'}}></div>
            </div>
            {r.top_tags && r.top_tags.length > 0 && (
              <div>{r.top_tags.map(tag => (
                <span key={tag} style={{display:'inline-block',fontSize:'12px',padding:'4px 10px',borderRadius:'20px',border:'1.5px solid #8B6FAD',color:'#3D2B4F',background:'#E8E0F5',margin:'2px'}}>{tag}</span>
              ))}</div>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}
"""

with open('app/page.js', 'w') as f:
    f.write(content)

print('Done')