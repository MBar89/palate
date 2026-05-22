'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'

const filters = [
  { label: 'All', value: 'all' },
  { label: 'Independents', value: 'independent' },
  { label: 'Special occasion', value: 'special' },
  { label: 'Neighbourhood gem', value: 'neighbourhood' },
  { label: 'Natural wine', value: 'wine' },
]

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
      <button onClick={() => window.location.href='/profile'} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'4px 16px'}}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active==='profile'?'#3D2B4F':'#9A928A'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span style={{fontSize:'10px',color:active==='profile'?'#3D2B4F':'#9A928A'}}>Profile</span>
      </button>
    </div>
  )
}

export default function ExplorePage() {
  const [restaurants, setRestaurants] = useState([])
  const [filtered, setFiltered] = useState([])
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [tagMap, setTagMap] = useState({})
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      const { data: r } = await supabase.from('restaurants').select('*').order('name')
      setRestaurants(r || [])
      setFiltered(r || [])
      const { data: reviews } = await supabase.from('reviews').select('restaurant_id, tags')
      if (reviews) {
        const map = {}
        reviews.forEach(rev => {
          if (!map[rev.restaurant_id]) map[rev.restaurant_id] = {}
          if (rev.tags) rev.tags.forEach(tag => { map[rev.restaurant_id][tag] = (map[rev.restaurant_id][tag] || 0) + 1 })
        })
        const topTags = {}
        Object.keys(map).forEach(rid => {
          topTags[rid] = Object.entries(map[rid]).sort((a,b) => b[1]-a[1]).slice(0,3).map(([t]) => t)
        })
        setTagMap(topTags)
      }
    }
    load()
  }, [])

  useEffect(() => {
    let results = restaurants
    if (query) {
      const q = query.toLowerCase()
      results = results.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.cuisine.toLowerCase().includes(q) ||
        r.neighbourhood.toLowerCase().includes(q)
      )
    }
    if (activeFilter === 'independent') results = results.filter(r => !r.is_chain)
    if (activeFilter === 'special') results = results.filter(r => (tagMap[r.id] || []).includes('special occasion'))
    if (activeFilter === 'neighbourhood') results = results.filter(r => (tagMap[r.id] || []).includes('neighbourhood gem'))
    if (activeFilter === 'wine') results = results.filter(r => (tagMap[r.id] || []).includes('natural wine list'))
    setFiltered(results)
  }, [query, activeFilter, restaurants, tagMap])

  return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif',paddingBottom:'80px'}}>
      <div style={{background:'#3D2B4F',padding:'16px 24px'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'28px',color:'#F7F3EE',fontStyle:'italic',margin:0}}>palate</h1>
      </div>
      <div style={{padding:'12px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',background:'white',borderRadius:'12px',padding:'10px 14px',boxShadow:'0 2px 12px rgba(26,23,20,0.06)'}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A928A" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search restaurants, cuisines, areas..." style={{flex:1,border:'none',outline:'none',fontSize:'14px',fontFamily:'sans-serif',color:'#1A1714',background:'transparent'}} />
        </div>
      </div>
      <div style={{display:'flex',gap:'8px',padding:'0 16px 12px',overflowX:'auto'}}>
        {filters.map(f => (
          <button key={f.value} onClick={() => setActiveFilter(f.value)} style={{whiteSpace:'nowrap',fontSize:'12px',padding:'6px 14px',borderRadius:'20px',border:activeFilter===f.value?'1.5px solid #8B6FAD':'1.5px solid #DDD6CC',background:activeFilter===f.value?'#E8E0F5':'#F7F3EE',color:activeFilter===f.value?'#3D2B4F':'#5A534E',fontWeight:activeFilter===f.value?'500':'400',cursor:'pointer',flexShrink:0,fontFamily:'sans-serif'}}>{f.label}</button>
        ))}
      </div>
      <div style={{padding:'0 16px'}}>
        {filtered.length === 0 && (
          <div style={{padding:'40px',textAlign:'center',color:'#9A928A',fontSize:'14px'}}>No restaurants found</div>
        )}
        {filtered.map(r => (
          <div key={r.id} onClick={() => window.location.href='/restaurant/'+r.id} style={{background:'white',borderRadius:'16px',padding:'16px',marginBottom:'10px',boxShadow:'0 2px 12px rgba(26,23,20,0.07)',cursor:'pointer'}}>
            <div style={{fontFamily:'Georgia,serif',fontSize:'18px',color:'#1A1714',marginBottom:'2px'}}>{r.name}</div>
            <div style={{fontSize:'12px',color:'#9A928A',marginBottom:'8px'}}>{r.cuisine} · {r.neighbourhood} · {'£'.repeat(r.price_range)}</div>
            {tagMap[r.id] && tagMap[r.id].length > 0 && (
              <div>{tagMap[r.id].map(tag => (
                <span key={tag} style={{display:'inline-block',fontSize:'12px',padding:'4px 10px',borderRadius:'20px',border:'1.5px solid #8B6FAD',color:'#3D2B4F',background:'#E8E0F5',margin:'2px'}}>{tag}</span>
              ))}</div>
            )}
          </div>
        ))}
      </div>
      <NavBar active="explore" />
    </main>
  )
}
