'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import NavBar from '../../components/NavBar'

function getInitials(email) {
  if (!email) return '?'
  const parts = email.split('@')[0].split(/[._-]/)
  return parts.map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

export default function ProfilePage() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [topTags, setTopTags] = useState([])
  const [reviewCount, setReviewCount] = useState(0)
  const [signals, setSignals] = useState([])
  const [reviewedPlaces, setReviewedPlaces] = useState([])
  const [inviteCopied, setInviteCopied] = useState(false)
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameError, setUsernameError] = useState(null)
  const [usernameSaved, setUsernameSaved] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)

      const { data: reviews } = await supabase
        .from('reviews')
        .select('tags, worth_the_price, restaurant_id, restaurants(name, cuisine, neighbourhood, price_range)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (reviews) {
        setReviewCount(reviews.length)
        setReviewedPlaces(reviews)
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
    window.location.href = '/'
  }

  async function saveUsername() {
    setUsernameError(null)
    const cleaned = usernameInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (!cleaned || cleaned.length < 3) { setUsernameError('Username must be at least 3 characters'); return }
    if (cleaned.length > 20) { setUsernameError('Username must be 20 characters or less'); return }
    const { error } = await supabase.from('profiles').update({ username: cleaned, display_name: cleaned }).eq('id', user.id)
    if (error) { setUsernameError(error.message.includes('unique') ? 'That username is already taken' : error.message); return }
    setProfile(prev => ({ ...prev, username: cleaned, display_name: cleaned }))
    setUsernameSaved(true)
  }

  async function generateInvite() {
    const code = Math.random().toString(36).substring(2, 10)
    const { error } = await supabase.from('invites').insert({ code, created_by: user.id })
    if (error) { alert('Could not generate invite: ' + error.message); return }
    const link = window.location.origin + '/invite/' + code
    if (navigator.share) {
      navigator.share({ title: 'Join me on palate', text: 'I think you would love this — taste-matched restaurant recommendations.', url: link }).catch(() => {})
    } else {
      try {
        await navigator.clipboard.writeText(link)
      } catch {
        prompt('Copy your invite link:', link)
      }
    }
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 3000)
  }

  const initials = getInitials(user?.email)
  const displayName = profile?.display_name || profile?.username || initials

  return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif',paddingBottom:'80px'}}>
      <div style={{background:'#3D2B4F',padding:'16px 24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'28px',color:'#F7F3EE',fontStyle:'italic',margin:0}}>palate</h1>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          {user?.email === 'myles@barhamaviation.co.uk' && (
            <button onClick={() => window.location.href='/admin'} style={{background:'transparent',border:'1.5px solid rgba(247,243,238,0.3)',color:'rgba(247,243,238,0.6)',borderRadius:'8px',padding:'6px 14px',fontSize:'13px',cursor:'pointer'}}>Admin</button>
          )}
          <button onClick={handleSignOut} style={{background:'transparent',border:'1.5px solid rgba(247,243,238,0.4)',color:'#F7F3EE',borderRadius:'8px',padding:'6px 14px',fontSize:'13px',cursor:'pointer'}}>Sign out</button>
        </div>
      </div>

      <div style={{padding:'16px 16px 8px',display:'flex',alignItems:'center',gap:'12px'}}>
        <div style={{width:'48px',height:'48px',borderRadius:'50%',background:'#E8E0F5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:'500',color:'#3D2B4F',flexShrink:0}}>{initials}</div>
        <div>
          <h2 style={{fontFamily:'Georgia,serif',fontSize:'20px',color:'#1A1714',fontStyle:'italic',marginBottom:'2px'}}>{displayName}</h2>
          <p style={{fontSize:'13px',color:'#9A928A'}}>Built from {reviewCount} place{reviewCount !== 1 ? 's' : ''} reviewed</p>
        </div>
      </div>

      {!profile?.username && !usernameSaved && (
        <div style={{margin:'8px 16px 16px',background:'white',borderRadius:'16px',padding:'16px',boxShadow:'0 2px 12px rgba(26,23,20,0.06)',border:'1.5px solid #E8E0F5'}}>
          <div style={{fontSize:'14px',fontWeight:'500',color:'#1A1714',marginBottom:'4px'}}>Set your username</div>
          <div style={{fontSize:'13px',color:'#9A928A',marginBottom:'12px'}}>So people can find you on palate.</div>
          <div style={{display:'flex',gap:'8px'}}>
            <input
              value={usernameInput}
              onChange={e => setUsernameInput(e.target.value)}
              placeholder="e.g. myles_eats"
              style={{flex:1,padding:'10px 12px',borderRadius:'10px',border:'1.5px solid #DDD6CC',fontSize:'14px',fontFamily:'sans-serif',color:'#1A1714',outline:'none'}}
              onKeyDown={e => e.key === 'Enter' && saveUsername()}
            />
            <button onClick={saveUsername} style={{padding:'10px 16px',borderRadius:'10px',background:'#3D2B4F',color:'#F7F3EE',border:'none',fontSize:'13px',fontWeight:'500',cursor:'pointer',fontFamily:'sans-serif'}}>Save</button>
          </div>
          {usernameError && <p style={{fontSize:'12px',color:'#A03020',marginTop:'6px'}}>{usernameError}</p>}
        </div>
      )}

      {usernameSaved && (
        <div style={{margin:'0 16px 16px',background:'#DCF0E6',borderRadius:'12px',padding:'12px 16px',fontSize:'13px',color:'#2A6B4F',fontWeight:'500'}}>
          Username set — people can now find you as @{profile?.username}
        </div>
      )}

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
              <span key={tag} onClick={() => window.location.href='/explore?tag='+encodeURIComponent(tag)} style={{display:'inline-block',fontSize:'12px',padding:'5px 11px',borderRadius:'20px',border:'1.5px solid #8B6FAD',color:'#3D2B4F',background:'#E8E0F5',margin:'3px',cursor:'pointer'}}>{tag}</span>
            ))}
          </div>
        </>
      )}

      {reviewedPlaces.length > 0 && (
        <>
          <div style={{padding:'0 16px 8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase'}}>Places you have reviewed</div>
            {reviewedPlaces.length > 5 && (
              <span onClick={() => setShowAllReviews(prev => !prev)} style={{fontSize:'12px',color:'#3D2B4F',cursor:'pointer',fontWeight:'500'}}>
                {showAllReviews ? 'Show less' : `See all ${reviewedPlaces.length}`}
              </span>
            )}
          </div>
          <div style={{padding:'0 16px 16px'}}>
            {(showAllReviews ? reviewedPlaces : reviewedPlaces.slice(0,5)).map((rev, i) => (
              <div key={i} onClick={() => window.location.href='/restaurant/'+rev.restaurant_id} style={{background:'white',borderRadius:'16px',padding:'14px 16px',marginBottom:'8px',boxShadow:'0 2px 12px rgba(26,23,20,0.06)',cursor:'pointer'}}>
                <div style={{fontFamily:'Georgia,serif',fontSize:'16px',color:'#1A1714',marginBottom:'2px'}}>{rev.restaurants?.name}</div>
                <div style={{fontSize:'12px',color:'#9A928A',marginBottom:rev.tags && rev.tags.length > 0 ? '8px' : 0}}>{rev.restaurants?.cuisine} · {rev.restaurants?.neighbourhood} · {'£'.repeat(rev.restaurants?.price_range || 1)}</div>
                {rev.tags && rev.tags.length > 0 && (
                  <div>{rev.tags.slice(0,3).map(tag => (
                    <span key={tag} style={{display:'inline-block',fontSize:'11px',padding:'3px 8px',borderRadius:'20px',border:'1.5px solid #8B6FAD',color:'#3D2B4F',background:'#E8E0F5',margin:'2px'}}>{tag}</span>
                  ))}</div>
                )}
              </div>
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

      <div style={{padding:'0 16px 8px'}}>
        <button onClick={generateInvite} style={{width:'100%',padding:'14px',borderRadius:'14px',background:'white',color:'#3D2B4F',border:'1.5px solid #DDD6CC',fontSize:'15px',fontWeight:'500',cursor:'pointer',boxShadow:'0 2px 12px rgba(26,23,20,0.06)'}}>
          {inviteCopied ? 'Link copied!' : 'Share invite link ↗'}
        </button>
      </div>
      <div style={{padding:'0 16px 16px'}}>
        <a href="mailto:myles@barhamaviation.co.uk?subject=Palate feedback&body=What do you think%3F What's missing%3F" style={{display:'block',width:'100%',padding:'14px',borderRadius:'14px',background:'white',color:'#9A928A',border:'1.5px solid #DDD6CC',fontSize:'14px',fontWeight:'400',cursor:'pointer',boxShadow:'0 2px 12px rgba(26,23,20,0.06)',textAlign:'center',textDecoration:'none',boxSizing:'border-box'}}>Send feedback ↗</a>
      </div>

      <NavBar active="profile" />
    </main>
  )
}