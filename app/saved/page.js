'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'

function NavBar({ active }) {
  return (
    <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#F7F3EE',borderTop:'1px solid #DDD6CC',display:'flex',justifyContent:'space-around',padding:'10px 0 20px'}}>
      <button onClick={() => window.location.href='/'} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'4px 16px'}}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active==='home'?'#3D2B4F':'#9A928A'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span style={{fontSize:'10px',color:active==='home'?'#3D2B4F':'#9A928A'}}>Home</span>
      </button>
      <button onClick={() => window.location.href='/explore'} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'4px 16px'}}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active==='explore'?'#3D2B4F':'#9A928A'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span style={{fontSize:'10px',color:active==='explore'?'#3D2B4F':'#9A928A'}}>Explore</span>
      </button>
      <button onClick={() => window.location.href='/saved'} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'4px 16px'}}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active==='saved'?'#3D2B4F':'none'} stroke={active==='saved'?'#3D2B4F':'#9A928A'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        <span style={{fontSize:'10px',color:active==='saved'?'#3D2B4F':'#9A928A'}}>Saved</span>
      </button>
      <button onClick={() => window.location.href='/profile'} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'4px 16px'}}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active==='profile'?'#3D2B4F':'#9A928A'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span style={{fontSize:'10px',color:active==='profile'?'#3D2B4F':'#9A928A'}}>Profile</span>
      </button>
    </div>
  )
}

export default function SavedPage() {
  const [saved, setSaved] = useState([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      const { data } = await supabase
        .from('saves')
        .select('restaurant_id, restaurants(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (data) setSaved(data)
      setLoading(false)
    }
    load()
  }, [])

  async function unsave(restaurantId) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('saves').delete().eq('user_id', user.id).eq('restaurant_id', restaurantId)
    setSaved(prev => prev.filter(s => s.restaurant_id !== restaurantId))
  }

  return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif',paddingBottom:'80px'}}>
      <div style={{background:'#3D2B4F',padding:'16px 24px'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'28px',color:'#F7F3EE',fontStyle:'italic',margin:0}}>palate</h1>
      </div>
      <div style={{padding:'16px 16px 8px',fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase'}}>Saved places</div>
      <div style={{padding:'0 16px'}}>
        {loading ? (
          <div style={{padding:'40px',textAlign:'center',color:'#9A928A',fontSize:'14px'}}>Loading...</div>
        ) : saved.length === 0 ? (
          <div style={{padding:'48px 24px',textAlign:'center'}}>
            <div style={{fontSize:'32px',marginBottom:'12px'}}>♡</div>
            <h3 style={{fontFamily:'Georgia,serif',fontSize:'18px',color:'#1A1714',marginBottom:'8px'}}>Nothing saved yet</h3>
            <p style={{fontSize:'14px',color:'#9A928A',marginBottom:'20px'}}>Tap the heart on any restaurant to save it.</p>
            <button onClick={() => window.location.href='/'} style={{padding:'12px 28px',borderRadius:'14px',background:'#3D2B4F',color:'#F7F3EE',border:'none',fontSize:'14px',cursor:'pointer'}}>Browse feed</button>
          </div>
        ) : (
          saved.map(s => (
            <div key={s.restaurant_id} style={{background:'white',borderRadius:'16px',padding:'16px',marginBottom:'10px',boxShadow:'0 2px 12px rgba(26,23,20,0.07)',display:'flex',alignItems:'center',gap:'12px'}}>
              <div style={{flex:1,cursor:'pointer'}} onClick={() => window.location.href='/restaurant/'+s.restaurant_id}>
                <div style={{fontFamily:'Georgia,serif',fontSize:'17px',color:'#1A1714',marginBottom:'2px'}}>{s.restaurants.name}</div>
                <div style={{fontSize:'12px',color:'#9A928A'}}>{s.restaurants.cuisine} · {s.restaurants.neighbourhood} · {'£'.repeat(s.restaurants.price_range)}</div>
              </div>
              <button onClick={() => unsave(s.restaurant_id)} style={{background:'none',border:'none',cursor:'pointer',padding:'4px',flexShrink:0}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#3D2B4F" stroke="#3D2B4F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
              </button>
            </div>
          ))
        )}
      </div>
      <NavBar active="saved" />
    </main>
  )
}
