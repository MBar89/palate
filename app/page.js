'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

function SkeletonCard() {
  return (
    <div style={{background:'white',borderRadius:'16px',padding:'16px',marginBottom:'10px',boxShadow:'0 2px 12px rgba(26,23,20,0.07)'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}>
        <div style={{height:'20px',width:'140px',background:'#EDE8E1',borderRadius:'6px'}}></div>
        <div style={{height:'20px',width:'70px',background:'#EDE8E1',borderRadius:'20px'}}></div>
      </div>
      <div style={{height:'12px',width:'180px',background:'#EDE8E1',borderRadius:'4px',marginBottom:'8px'}}></div>
      <div style={{height:'3px',background:'#EDE8E1',borderRadius:'2px',marginBottom:'8px'}}></div>
      <div style={{display:'flex',gap:'6px'}}>
        <div style={{height:'24px',width:'80px',background:'#EDE8E1',borderRadius:'20px'}}></div>
        <div style={{height:'24px',width:'100px',background:'#EDE8E1',borderRadius:'20px'}}></div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const [restaurants, setRestaurants] = useState([])
  const [friendActivity, setFriendActivity] = useState([])
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savedIds, setSavedIds] = useState(new Set())
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

      const [{ data: feed }, { data: saves }, { data: friends }] = await Promise.all([
        supabase.rpc('get_personalised_feed', { user_uuid: user.id }),
        supabase.from('saves').select('restaurant_id').eq('user_id', user.id),
        supabase.rpc('get_friend_activity', { user_uuid: user.id }),
      ])

      if (feed) setRestaurants(feed)
      if (saves) setSavedIds(new Set(saves.map(s => s.restaurant_id)))
      if (friends) setFriendActivity(friends)
      setLoading(false)
    }
    load()
  }, [])

  async function toggleSave(e, restaurantId) {
    e.stopPropagation()
    const { data: { user } } = await supabase.auth.getUser()
    if (savedIds.has(restaurantId)) {
      await supabase.from('saves').delete().eq('user_id', user.id).eq('restaurant_id', restaurantId)
      setSavedIds(prev => { const next = new Set(prev); next.delete(restaurantId); return next })
    } else {
      await supabase.from('saves').insert({ user_id: user.id, restaurant_id: restaurantId })
      setSavedIds(prev => new Set([...prev, restaurantId]))
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif',padding:'0 0 80px'}}>
      <div style={{background:'#3D2B4F',padding:'16px 24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'28px',color:'#F7F3EE',fontStyle:'italic',margin:0}}>palate</h1>
        {user && <button onClick={handleSignOut} style={{background:'transparent',border:'1.5px solid rgba(247,243,238,0.4)',color:'#F7F3EE',borderRadius:'8px',padding:'6px 14px',fontSize:'13px',cursor:'pointer'}}>Sign out</button>}
      </div>

      {friendActivity.length > 0 && (
        <>
          <div style={{padding:'16px 16px 8px',fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase'}}>From people you follow</div>
          <div style={{padding:'0 16px'}}>
            {friendActivity.map((r, i) => (
              <div key={i} onClick={() => window.location.href='/restaurant/'+r.restaurant_id} style={{background:'white',borderRadius:'16px',padding:'16px',marginBottom:'10px',boxShadow:'0 2px 12px rgba(26,23,20,0.07)',cursor:'pointer'}}>
                <div style={{fontFamily:'Georgia,serif',fontSize:'17px',color:'#1A1714',marginBottom:'2px'}}>{r.restaurant_name}</div>
                <div style={{fontSize:'12px',color:'#9A928A',marginBottom:'8px'}}>{r.cuisine} · {r.neighbourhood} · {'£'.repeat(r.price_range)}</div>
                {r.tags && r.tags.length > 0 && (
                  <div>{r.tags.slice(0,3).map(tag => (
                    <span key={tag} style={{display:'inline-block',fontSize:'12px',padding:'4px 10px',borderRadius:'20px',border:'1.5px solid #8B6FAD',color:'#3D2B4F',background:'#E8E0F5',margin:'2px'}}>{tag}</span>
                  ))}</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{padding:'16px 16px 8px',fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase'}}>Your matches</div>

      <div style={{padding:'0 16px'}}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : restaurants.length === 0 ? (
          <div style={{padding:'48px 24px',textAlign:'center'}}>
            <div style={{fontSize:'32px',marginBottom:'12px'}}>🍽</div>
            <h3 style={{fontFamily:'Georgia,serif',fontSize:'18px',color:'#1A1714',marginBottom:'8px'}}>No matches yet</h3>
            <p style={{fontSize:'14px',color:'#9A928A',marginBottom:'20px'}}>Review some restaurants to improve your matches.</p>
            <button onClick={() => window.location.href='/explore'} style={{padding:'12px 28px',borderRadius:'14px',background:'#3D2B4F',color:'#F7F3EE',border:'none',fontSize:'14px',cursor:'pointer'}}>Browse restaurants</button>
          </div>
        ) : (
          restaurants.map(r => (
            <div key={r.id} onClick={() => window.location.href='/restaurant/'+r.id} style={{background:'white',borderRadius:'16px',padding:'16px',marginBottom:'10px',boxShadow:'0 2px 12px rgba(26,23,20,0.07)',cursor:'pointer'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
                <div style={{flex:1}}>
                  <div style={{fontFamily:'Georgia,serif',fontSize:'18px',color:'#1A1714',marginBottom:'2px'}}>{r.name}</div>
                  <div style={{fontSize:'12px',color:'#9A928A'}}>{r.cuisine} · {r.neighbourhood} · {'£'.repeat(r.price_range)}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'8px',flexShrink:0,marginLeft:'8px'}}>
                  <div style={{fontSize:'12px',fontWeight:'500',padding:'4px 10px',borderRadius:'20px',background:'#E8E0F5',color:'#3D2B4F'}}>{r.match_score}% match</div>
                  <button onClick={(e) => toggleSave(e, r.id)} style={{background:'none',border:'none',cursor:'pointer',padding:'2px',lineHeight:0}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={savedIds.has(r.id)?'#3D2B4F':'none'} stroke="#3D2B4F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                  </button>
                </div>
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
          ))
        )}
      </div>

      <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#F7F3EE',borderTop:'1px solid #DDD6CC',display:'flex',justifyContent:'space-around',padding:'10px 0 20px'}}>
        <button onClick={() => window.location.href='/'} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'4px 10px'}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3D2B4F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span style={{fontSize:'10px',color:'#3D2B4F'}}>Home</span>
        </button>
        <button onClick={() => window.location.href='/explore'} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'4px 10px'}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9A928A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span style={{fontSize:'10px',color:'#9A928A'}}>Explore</span>
        </button>
        <button onClick={() => window.location.href='/saved'} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'4px 10px'}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9A928A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          <span style={{fontSize:'10px',color:'#9A928A'}}>Saved</span>
        </button>
        <button onClick={() => window.location.href='/people'} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'4px 10px'}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9A928A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          <span style={{fontSize:'10px',color:'#9A928A'}}>People</span>
        </button>
        <button onClick={() => window.location.href='/profile'} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'4px 10px'}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9A928A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span style={{fontSize:'10px',color:'#9A928A'}}>Profile</span>
        </button>
      </div>
    </main>
  )
}
