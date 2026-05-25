'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import NavBar from '../../components/NavBar'

export default function ExplorePage() {
  const [user, setUser] = useState(null)
  const [restaurants, setRestaurants] = useState([])
  const [filtered, setFiltered] = useState([])
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [tagMap, setTagMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  const [cuisines, setCuisines] = useState([])
  const [neighbourhoods, setNeighbourhoods] = useState([])
  const [selectedCuisine, setSelectedCuisine] = useState(null)
  const [selectedNeighbourhood, setSelectedNeighbourhood] = useState(null)
  const [selectedPrice, setSelectedPrice] = useState(null)
  const supabase = createClient()

  const filters = [
    { label: 'All', value: 'all' },
    { label: 'Independents', value: 'independent' },
    { label: 'Special occasion', value: 'special' },
    { label: 'Neighbourhood gem', value: 'neighbourhood' },
    { label: 'Natural wine', value: 'wine' },
  ]

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      const { data: r } = await supabase.from('restaurants').select('*').eq('status', 'approved').order('name')
      setRestaurants(r || [])
      setFiltered(r || [])

      const uniqueCuisines = [...new Set((r || []).map(x => x.cuisine).filter(Boolean))].sort()
      const uniqueNeighbourhoods = [...new Set((r || []).map(x => x.neighbourhood).filter(Boolean))].sort()
      setCuisines(uniqueCuisines)
      setNeighbourhoods(uniqueNeighbourhoods)

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
      setLoading(false)
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
    if (selectedCuisine) results = results.filter(r => r.cuisine === selectedCuisine)
    if (selectedNeighbourhood) results = results.filter(r => r.neighbourhood === selectedNeighbourhood)
    if (selectedPrice) results = results.filter(r => r.price_range === selectedPrice)
    setFiltered(results)
  }, [query, activeFilter, restaurants, tagMap, selectedCuisine, selectedNeighbourhood, selectedPrice])

  const activeFilterCount = [selectedCuisine, selectedNeighbourhood, selectedPrice].filter(Boolean).length

  function clearFilters() {
    setSelectedCuisine(null)
    setSelectedNeighbourhood(null)
    setSelectedPrice(null)
  }

  return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif',paddingBottom: user ? '80px' : '80px'}}>
      <div style={{background:'#3D2B4F',padding:'16px 24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'28px',color:'#F7F3EE',fontStyle:'italic',margin:0}}>palate</h1>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <button onClick={() => setShowFilterSheet(true)} style={{position:'relative',background:'transparent',border:'1.5px solid rgba(247,243,238,0.4)',color:'#F7F3EE',borderRadius:'8px',padding:'6px 14px',fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            Filter
            {activeFilterCount > 0 && (
              <span style={{position:'absolute',top:'-6px',right:'-6px',background:'#F7F3EE',color:'#3D2B4F',borderRadius:'50%',width:'16px',height:'16px',fontSize:'10px',fontWeight:'500',display:'flex',alignItems:'center',justifyContent:'center'}}>{activeFilterCount}</span>
            )}
          </button>
          {!user && (
            <button onClick={() => window.location.href='/login'} style={{background:'transparent',border:'1.5px solid rgba(247,243,238,0.4)',color:'#F7F3EE',borderRadius:'8px',padding:'6px 14px',fontSize:'13px',cursor:'pointer'}}>Log in</button>
          )}
        </div>
      </div>

      <div style={{padding:'12px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',background:'white',borderRadius:'12px',padding:'10px 14px',boxShadow:'0 2px 12px rgba(26,23,20,0.06)'}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A928A" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search restaurants, cuisines, areas..." style={{flex:1,border:'none',outline:'none',fontSize:'14px',fontFamily:'sans-serif',color:'#1A1714',background:'transparent'}} />
        </div>
      </div>

      <div style={{display:'flex',gap:'8px',padding:'0 16px 12px',overflowX:'auto',scrollbarWidth:'none'}}>
        {filters.map(f => (
          <button key={f.value} onClick={() => setActiveFilter(f.value)} style={{whiteSpace:'nowrap',fontSize:'12px',padding:'6px 14px',borderRadius:'20px',border:activeFilter===f.value?'1.5px solid #8B6FAD':'1.5px solid #DDD6CC',background:activeFilter===f.value?'#E8E0F5':'#F7F3EE',color:activeFilter===f.value?'#3D2B4F':'#5A534E',fontWeight:activeFilter===f.value?'500':'400',cursor:'pointer',flexShrink:0,fontFamily:'sans-serif'}}>{f.label}</button>
        ))}
      </div>

      {activeFilterCount > 0 && (
        <div style={{padding:'0 16px 8px',display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
          {selectedCuisine && <span style={{fontSize:'12px',padding:'4px 10px',borderRadius:'20px',background:'#3D2B4F',color:'#F7F3EE',display:'flex',alignItems:'center',gap:'6px'}}>{selectedCuisine} <span onClick={() => setSelectedCuisine(null)} style={{cursor:'pointer',opacity:0.7}}>×</span></span>}
          {selectedNeighbourhood && <span style={{fontSize:'12px',padding:'4px 10px',borderRadius:'20px',background:'#3D2B4F',color:'#F7F3EE',display:'flex',alignItems:'center',gap:'6px'}}>{selectedNeighbourhood} <span onClick={() => setSelectedNeighbourhood(null)} style={{cursor:'pointer',opacity:0.7}}>×</span></span>}
          {selectedPrice && <span style={{fontSize:'12px',padding:'4px 10px',borderRadius:'20px',background:'#3D2B4F',color:'#F7F3EE',display:'flex',alignItems:'center',gap:'6px'}}>{'£'.repeat(selectedPrice)} <span onClick={() => setSelectedPrice(null)} style={{cursor:'pointer',opacity:0.7}}>×</span></span>}
          <span onClick={clearFilters} style={{fontSize:'12px',color:'#9A928A',cursor:'pointer',textDecoration:'underline'}}>Clear all</span>
        </div>
      )}

      {user && (
        <div style={{padding:'0 16px 12px',display:'flex',justifyContent:'flex-end'}}>
          <button onClick={() => window.location.href='/add'} style={{fontSize:'13px',padding:'8px 16px',borderRadius:'20px',background:'#3D2B4F',color:'#F7F3EE',border:'none',cursor:'pointer',fontFamily:'sans-serif',fontWeight:'500'}}>+ Add restaurant</button>
        </div>
      )}

      <div style={{padding:'0 16px'}}>
        {loading ? (
          <div style={{padding:'40px',textAlign:'center',color:'#9A928A',fontSize:'14px'}}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{padding:'40px',textAlign:'center',color:'#9A928A',fontSize:'14px'}}>No restaurants found</div>
        ) : (
          filtered.map(r => (
            <div key={r.id} onClick={() => window.location.href='/restaurant/'+r.id} style={{background:'white',borderRadius:'16px',padding:'16px',marginBottom:'10px',boxShadow:'0 2px 12px rgba(26,23,20,0.07)',cursor:'pointer'}}>
              <div style={{fontFamily:'Georgia,serif',fontSize:'18px',color:'#1A1714',marginBottom:'2px'}}>{r.name}</div>
              <div style={{fontSize:'12px',color:'#9A928A',marginBottom:'8px'}}>{r.cuisine} · {r.neighbourhood} · {'£'.repeat(r.price_range)}</div>
              {tagMap[r.id] && tagMap[r.id].length > 0 && (
                <div>{tagMap[r.id].map(tag => (
                  <span key={tag} style={{display:'inline-block',fontSize:'12px',padding:'4px 10px',borderRadius:'20px',border:'1.5px solid #8B6FAD',color:'#3D2B4F',background:'#E8E0F5',margin:'2px'}}>{tag}</span>
                ))}</div>
              )}
            </div>
          ))
        )}
      </div>

      {user ? (
        <NavBar active="explore" />
      ) : (
        <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#3D2B4F',padding:'14px 24px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px'}}>
          <div>
            <div style={{fontSize:'13px',fontWeight:'500',color:'#F7F3EE',marginBottom:'2px'}}>Like what you see?</div>
            <div style={{fontSize:'12px',color:'#F7F3EE',opacity:0.6}}>Sign up for taste-matched recommendations</div>
          </div>
          <button onClick={() => window.location.href='/signup'} style={{background:'#F7F3EE',border:'none',color:'#3D2B4F',borderRadius:'10px',padding:'10px 18px',fontSize:'13px',fontWeight:'500',cursor:'pointer',flexShrink:0}}>Sign up free →</button>
        </div>
      )}

      {showFilterSheet && (
        <div onClick={(e) => { if(e.target === e.currentTarget) setShowFilterSheet(false) }} style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(26,23,20,0.5)',zIndex:50,display:'flex',alignItems:'flex-end'}}>
          <div style={{background:'#F7F3EE',borderRadius:'24px 24px 0 0',padding:'0 0 32px',width:'100%',maxHeight:'80vh',overflowY:'auto'}}>
            <div style={{width:'36px',height:'4px',borderRadius:'2px',background:'#DDD6CC',margin:'12px auto 20px'}}></div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 24px 16px'}}>
              <h2 style={{fontFamily:'Georgia,serif',fontSize:'20px',color:'#1A1714',fontStyle:'italic',margin:0}}>Filter</h2>
              {activeFilterCount > 0 && <span onClick={clearFilters} style={{fontSize:'13px',color:'#3D2B4F',cursor:'pointer',fontWeight:'500'}}>Clear all</span>}
            </div>
            <div style={{padding:'0 24px 20px',borderBottom:'1px solid #EDE8E1'}}>
              <div style={{fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'12px'}}>Cuisine</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                {cuisines.map(c => (
                  <button key={c} onClick={() => setSelectedCuisine(selectedCuisine === c ? null : c)} style={{fontSize:'13px',padding:'6px 14px',borderRadius:'20px',border:selectedCuisine===c?'1.5px solid #3D2B4F':'1.5px solid #DDD6CC',background:selectedCuisine===c?'#3D2B4F':'transparent',color:selectedCuisine===c?'#F7F3EE':'#5A534E',cursor:'pointer',fontFamily:'sans-serif'}}>{c}</button>
                ))}
              </div>
            </div>
            <div style={{padding:'20px 24px 20px',borderBottom:'1px solid #EDE8E1'}}>
              <div style={{fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'12px'}}>Neighbourhood</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                {neighbourhoods.map(n => (
                  <button key={n} onClick={() => setSelectedNeighbourhood(selectedNeighbourhood === n ? null : n)} style={{fontSize:'13px',padding:'6px 14px',borderRadius:'20px',border:selectedNeighbourhood===n?'1.5px solid #3D2B4F':'1.5px solid #DDD6CC',background:selectedNeighbourhood===n?'#3D2B4F':'transparent',color:selectedNeighbourhood===n?'#F7F3EE':'#5A534E',cursor:'pointer',fontFamily:'sans-serif'}}>{n}</button>
                ))}
              </div>
            </div>
            <div style={{padding:'20px 24px 20px'}}>
              <div style={{fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'12px'}}>Price range</div>
              <div style={{display:'flex',gap:'8px'}}>
                {[1,2,3,4,5].map(p => (
                  <button key={p} onClick={() => setSelectedPrice(selectedPrice === p ? null : p)} style={{flex:1,padding:'10px 4px',borderRadius:'10px',border:selectedPrice===p?'1.5px solid #3D2B4F':'1.5px solid #DDD6CC',background:selectedPrice===p?'#3D2B4F':'transparent',color:selectedPrice===p?'#F7F3EE':'#5A534E',fontSize:'13px',fontFamily:'sans-serif',cursor:'pointer',fontWeight:selectedPrice===p?'500':'400'}}>{'£'.repeat(p)}</button>
                ))}
              </div>
            </div>
            <div style={{padding:'0 24px'}}>
              <button onClick={() => setShowFilterSheet(false)} style={{width:'100%',padding:'14px',borderRadius:'14px',background:'#3D2B4F',color:'#F7F3EE',border:'none',fontSize:'15px',fontWeight:'500',cursor:'pointer'}}>
                Show {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
