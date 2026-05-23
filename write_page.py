content = """'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import NavBar from '../../components/NavBar'

export default function ProfilePage() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [topTags, setTopTags] = useState([])
  const [reviewCount, setReviewCount] = useState(0)
  const [signals, setSignals] = useState([])
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)

      const { data: reviews } = await supabase.from('reviews').select('tags, worth_the_price').eq('user_id', user.id)
      if (reviews) {
        setReviewCount(reviews.length)
        const tagCounts = {}
        let worthCount = 0
        let atmosphereTags = 0
        let chainTolerance = 0
        reviews.forEach(rev => {
          if (rev.worth_the_price) worthCount++
          if (rev.tags) rev.tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1
            if (tag === 'atmosphere over food') atmosphereTags++
            if (tag === 'neighbourhood gem' || tag === 'locals only') chainTolerance++
          })
        })
        const sorted = Object.entries(tagCounts).sort((a,b) => b[1]-a[1]).slice(0,8).map(([t]) => t)
        setTopTags(sorted)
        if (reviews.length > 0) {
          setSignals([
            { name: 'Atmosphere over food', value: Math.min(100, Math.round((atmosphereTags / reviews.length) * 200)), strong: atmosphereTags > reviews.length * 0.3 },
            { name: 'Worth the journey', value: Math.min(100, Math.round((chainTolerance / reviews.length) * 150)), strong: chainTolerance > reviews.length * 0.4 },
            { name: 'Prefers independents', value: p && p.cluster !== 'comfort' ? 85 : 20, strong: p && p.cluster !== 'comfort' },
            { name: 'Price sensitivity', value: Math.min(100, Math.round((worthCount / reviews.length) * 60)), strong: false },
          ])
        }
      }
    }
    load()
  }, [])

  const clusterLabels = {
    adventurous: 'Adventurous explorer',
    comfort: 'Comfort seeker',
    fine_dining: 'Fine dining enthusiast',
    casual: 'Casual diner',
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif',paddingBottom:'80px'}}>
      <div style={{background:'#3D2B4F',padding:'16px 24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'28px',color:'#F7F3EE',fontStyle:'italic',margin:0}}>palate</h1>
        <button onClick={handleSignOut} style={{background:'transparent',border:'1.5px solid rgba(247,243,238,0.4)',color:'#F7F3EE',borderRadius:'8px',padding:'6px 14px',fontSize:'13px',cursor:'pointer'}}>Sign out</button>
      </div>

      <div style={{padding:'16px 16px 8px'}}>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:'22px',color:'#1A1714',fontStyle:'italic',marginBottom:'2px'}}>Your palate</h2>
        <p style={{fontSize:'13px',color:'#9A928A'}}>Built from {reviewCount} place{reviewCount !== 1 ? 's' : ''} reviewed</p>
      </div>

      {profile && profile.cluster && (
        <div style={{margin:'0 16px 16px',background:'linear-gradient(135deg,#3D2B4F,#6B4E8A)',borderRadius:'16px',padding:'20px',color:'#F7F3EE'}}>
          <div style={{fontSize:'11px',opacity:0.6,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'6px'}}>Your taste type</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:'22px',fontStyle:'italic'}}>{clusterLabels[profile.cluster] || profile.cluster}</div>
        </div>
      )}

      {signals.length > 0 && (
        <>
          <div style={{padding:'0 16px 8px',fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase'}}>Your taste signals</div>
          <div style={{margin:'0 16px 16px',background:'white',borderRadius:'16px',padding:'20px',boxShadow:'0 2px 12px rgba(26,23,20,0.06)'}}>
            {signals.map((s, i) => (
              <div key={i} style={{marginBottom: i < signals.length-1 ? '14px' : 0}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                  <span style={{fontSize:'13px',color:'#5A534E'}}>{s.name}</span>
                  <span style={{fontSize:'12px',fontWeight:'500',color:s.strong?'#3D2B4F':'#9A928A'}}>{s.strong ? 'strong' : 'low'}</span>
                </div>
                <div style={{height:'3px',background:'#DDD6CC',borderRadius:'2px',overflow:'hidden'}}>
                  <div style={{height:'100%',background:s.strong?'linear-gradient(90deg,#8B6FAD,#3D2B4F)':'#DDD6CC',borderRadius:'2px',width:s.value+'%'}}></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {topTags.length > 0 && (
        <>
          <div style={{padding:'0 16px 8px',fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase'}}>Your top tags</div>
          <div style={{padding:'0 16px 16px'}}>
            {topTags.map(tag => (
              <span key={tag} style={{display:'inline-block',fontSize:'12px',padding:'5px 11px',borderRadius:'20px',border:'1.5px solid #8B6FAD',color:'#3D2B4F',background:'#E8E0F5',margin:'3px'}}>{tag}</span>
            ))}
          </div>
        </>
      )}

      {reviewCount === 0 && (
        <div style={{padding:'40px 24px',textAlign:'center'}}>
          <p style={{fontSize:'14px',color:'#9A928A',marginBottom:'16px'}}>Review some restaurants to build your taste profile.</p>
          <button onClick={() => window.location.href='/'} style={{padding:'12px 28px',borderRadius:'14px',background:'#3D2B4F',color:'#F7F3EE',border:'none',fontSize:'14px',cursor:'pointer'}}>Browse restaurants</button>
        </div>
      )}

      <NavBar active="profile" />
    </main>
  )
}
"""

with open('app/profile/page.js', 'w') as f:
    f.write(content)

print('Done')