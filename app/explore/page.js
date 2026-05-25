'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '../../lib/supabase'
import NavBar from '../../components/NavBar'
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/mapbox'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

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
  const [inspirationPick, setInspirationPick] = useState(null)
  const [viewMode, setViewMode] = useState('list')
  const [mapPick, setMapPick] = useState(null)
  const [viewport, setViewport] = useState({ longitude: -0.118, latitude: 51.509, zoom: 11.5 })
  const [trendingIds, setTrendingIds] = useState(new Set())
  const supabase = createClient()

  const filters = [
    { label: 'All', value: 'all' },
    { label: 'Trending', value: 'trending' },
    { label: 'Independents', value: 'independent' },
    { label: 'Special occasion', value: 'special' },
    { label: 'Neighbourhood gem', value: 'neighbourhood' },
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

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: reviews } = await supabase.from('reviews').select('restaurant_id, tags, created_at')
      if (reviews) {
        const map = {}
        const counts = {}
        reviews.forEach(rev => {
          if (!map[rev.restaurant_id]) map[rev.restaurant_id] = {}
          if (rev.tags) rev.tags.forEach(tag => { map[rev.restaurant_id][tag] = (map[rev.restaurant_id][tag] || 0) + 1 })
          if (rev.created_at >= thirtyDaysAgo) counts[rev.restaurant_id] = (counts[rev.restaurant_id] || 0) + 1
        })
        const topTags = {}
        Object.keys(map).forEach(rid => {
          topTags[rid] = Object.entries(map[rid]).sort((a,b) => b[1]-a[1]).slice(0,3).map(([t]) => t)
        })
        setTagMap(topTags)
        setTrendingIds(new Set(Object.entries(counts).filter(([,c]) => c >= 2).map(([id]) => id)))
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
    if (activeFilter === 'trending') results = results.filter(r => trendingIds.has(String(r.id)))
    if (activeFilter === 'independent') results = results.filter(r => !r.is_chain)
    if (activeFilter === 'special') results = results.filter(r => (tagMap[r.id] || []).includes('special occasion'))
    if (activeFilter === 'neighbourhood') results = results.filter(r => (tagMap[r.id] || []).includes('neighbourhood gem'))

    if (selectedCuisine) results = results.filter(r => r.cuisine === selectedCuisine)
    if (selectedNeighbourhood) results = results.filter(r => r.neighbourhood === selectedNeighbourhood)
    if (selectedPrice) results = results.filter(r => r.price_range === selectedPrice)
    setFiltered(results)
    setMapPick(null)
  }, [query, activeFilter, restaurants, tagMap, selectedCuisine, selectedNeighbourhood, selectedPrice])

  const activeFilterCount = [selectedCuisine, selectedNeighbourhood, selectedPrice].filter(Boolean).length

  function clearFilters() {
    setSelectedCuisine(null)
    setSelectedNeighbourhood(null)
    setSelectedPrice(null)
  }

  function pickInspiration() {
    const pool = (filtered.length > 0 ? filtered : restaurants)
    if (pool.length === 0) return
    const available = inspirationPick ? pool.filter(r => r.id !== inspirationPick.id) : pool
    const pick = available[Math.floor(Math.random() * available.length)]
    setInspirationPick(pick)
  }

  const mapRestaurants = filtered.filter(r => r.latitude && r.longitude)

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

      <div style={{padding:'12px 16px 8px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',background:'white',borderRadius:'12px',padding:'10px 14px',boxShadow:'0 2px 12px rgba(26,23,20,0.06)'}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A928A" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search restaurants, cuisines, areas..." style={{flex:1,border:'none',outline:'none',fontSize:'14px',fontFamily:'sans-serif',color:'#1A1714',background:'transparent'}} />
        </div>
      </div>

      <div style={{display:'flex',gap:'8px',padding:'0 16px 8px',overflowX:'auto',scrollbarWidth:'none'}}>
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

      <div style={{padding:'0 16px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <button onClick={pickInspiration} style={{fontSize:'13px',padding:'8px 16px',borderRadius:'20px',background:'white',color:'#3D2B4F',border:'1.5px solid #DDD6CC',cursor:'pointer',fontFamily:'sans-serif',fontWeight:'500',boxShadow:'0 2px 8px rgba(26,23,20,0.06)',display:'flex',alignItems:'center',gap:'6px'}}>
            <span>✦</span> Inspire me
          </button>
          <div style={{display:'flex',background:'white',borderRadius:'20px',border:'1.5px solid #DDD6CC',overflow:'hidden',boxShadow:'0 2px 8px rgba(26,23,20,0.06)'}}>
            <button onClick={() => setViewMode('list')} style={{padding:'7px 14px',border:'none',background:viewMode==='list'?'#3D2B4F':'transparent',color:viewMode==='list'?'#F7F3EE':'#9A928A',fontSize:'12px',cursor:'pointer',fontFamily:'sans-serif',fontWeight:viewMode==='list'?'500':'400',display:'flex',alignItems:'center',gap:'5px'}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              List
            </button>
            <button onClick={() => setViewMode('map')} style={{padding:'7px 14px',border:'none',background:viewMode==='map'?'#3D2B4F':'transparent',color:viewMode==='map'?'#F7F3EE':'#9A928A',fontSize:'12px',cursor:'pointer',fontFamily:'sans-serif',fontWeight:viewMode==='map'?'500':'400',display:'flex',alignItems:'center',gap:'5px'}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
              Map
            </button>
          </div>
        </div>
        {user && (
          <button onClick={() => window.location.href='/add'} style={{fontSize:'13px',padding:'8px 16px',borderRadius:'20px',background:'#3D2B4F',color:'#F7F3EE',border:'none',cursor:'pointer',fontFamily:'sans-serif',fontWeight:'500'}}>+ Add restaurant</button>
        )}
      </div>

      {viewMode === 'list' ? (
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
                <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:'4px'}}>
                  {trendingIds.has(String(r.id)) && <span style={{display:'inline-flex',alignItems:'center',gap:'3px',fontSize:'11px',fontWeight:'500',padding:'3px 8px',borderRadius:'20px',background:'#FEF3E2',border:'1.5px solid #C47A2A',color:'#7A4A10'}}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#C47A2A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>Trending</span>}
                  {tagMap[r.id] && tagMap[r.id].map(tag => (
                    <span key={tag} style={{display:'inline-block',fontSize:'12px',padding:'4px 10px',borderRadius:'20px',border:'1.5px solid #8B6FAD',color:'#3D2B4F',background:'#E8E0F5',margin:'2px'}}>{tag}</span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div style={{position:'relative',height:'calc(100vh - 280px)',minHeight:'400px',margin:'0 16px',borderRadius:'16px',overflow:'hidden',boxShadow:'0 2px 12px rgba(26,23,20,0.1)'}}>
          {!loading && (
            <Map
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={viewport}
              style={{width:'100%',height:'100%'}}
              mapStyle="mapbox://styles/mapbox/light-v11"
              onClick={() => setMapPick(null)}
            >
              <NavigationControl position="top-right" />
              {mapRestaurants.map(r => (
                <Marker
                  key={r.id}
                  longitude={r.longitude}
                  latitude={r.latitude}
                  anchor="bottom"
                  onClick={e => { e.originalEvent.stopPropagation(); setMapPick(r) }}
                >
                  <div style={{width:'10px',height:'10px',borderRadius:'50%',background: mapPick?.id === r.id ? '#3D2B4F' : '#8B6FAD',border:'2px solid white',boxShadow:'0 1px 4px rgba(0,0,0,0.3)',cursor:'pointer',transform: mapPick?.id === r.id ? 'scale(1.5)' : 'scale(1)',transition:'transform 0.15s ease'}}></div>
                </Marker>
              ))}
            </Map>
          )}

          {mapPick && (
            <div style={{position:'absolute',bottom:0,left:0,right:0,background:'#F7F3EE',borderRadius:'16px 16px 0 0',padding:'16px',boxShadow:'0 -4px 24px rgba(26,23,20,0.15)'}}>
              <div style={{width:'32px',height:'3px',borderRadius:'2px',background:'#DDD6CC',margin:'0 auto 12px'}}></div>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'12px',marginBottom:'12px'}}>
                <div style={{flex:1,cursor:'pointer'}} onClick={() => window.location.href='/restaurant/'+mapPick.id}>
                  <div style={{fontFamily:'Georgia,serif',fontSize:'18px',color:'#1A1714',marginBottom:'2px'}}>{mapPick.name}</div>
                  <div style={{fontSize:'12px',color:'#9A928A',marginBottom:tagMap[mapPick.id]?.length>0?'8px':'0'}}>{mapPick.cuisine} · {mapPick.neighbourhood} · {'£'.repeat(mapPick.price_range)}</div>
                  {tagMap[mapPick.id] && tagMap[mapPick.id].length > 0 && (
                    <div>{tagMap[mapPick.id].map(tag => (
                      <span key={tag} style={{display:'inline-block',fontSize:'11px',padding:'3px 8px',borderRadius:'20px',border:'1.5px solid #8B6FAD',color:'#3D2B4F',background:'#E8E0F5',margin:'2px'}}>{tag}</span>
                    ))}</div>
                  )}
                </div>
                <button onClick={() => setMapPick(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#9A928A',fontSize:'18px',lineHeight:1,padding:'2px',flexShrink:0}}>×</button>
              </div>
              <button onClick={() => window.location.href='/restaurant/'+mapPick.id} style={{width:'100%',padding:'12px',borderRadius:'12px',background:'#3D2B4F',color:'#F7F3EE',border:'none',fontSize:'14px',fontWeight:'500',cursor:'pointer',fontFamily:'sans-serif'}}>View restaurant →</button>
            </div>
          )}
        </div>
      )}

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

      {inspirationPick && (
        <div onClick={() => setInspirationPick(null)} style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(26,23,20,0.6)',zIndex:50,display:'flex',alignItems:'flex-end'}}>
          <div onClick={e => e.stopPropagation()} style={{background:'#F7F3EE',borderRadius:'24px 24px 0 0',padding:'0 0 36px',width:'100%'}}>
            <div style={{width:'36px',height:'4px',borderRadius:'2px',background:'#DDD6CC',margin:'12px auto 20px'}}></div>
            <div style={{margin:'0 16px 16px',background:'linear-gradient(135deg,#3D2B4F,#6B4E8A)',borderRadius:'16px',padding:'24px',color:'#F7F3EE'}}>
              <div style={{fontSize:'11px',opacity:0.6,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'8px'}}>Tonight's pick</div>
              <div style={{fontFamily:'Georgia,serif',fontSize:'26px',fontStyle:'italic',marginBottom:'4px'}}>{inspirationPick.name}</div>
              <div style={{fontSize:'13px',opacity:0.7,marginBottom:tagMap[inspirationPick.id]?.length>0?'12px':'0'}}>{inspirationPick.cuisine} · {inspirationPick.neighbourhood} · {'£'.repeat(inspirationPick.price_range)}</div>
              {tagMap[inspirationPick.id] && tagMap[inspirationPick.id].length > 0 && (
                <div>{tagMap[inspirationPick.id].slice(0,3).map(tag => (
                  <span key={tag} style={{display:'inline-block',fontSize:'12px',padding:'4px 10px',borderRadius:'20px',background:'rgba(255,255,255,0.15)',color:'#F7F3EE',margin:'2px'}}>{tag}</span>
                ))}</div>
              )}
            </div>
            <div style={{padding:'0 16px',display:'flex',flexDirection:'column',gap:'10px'}}>
              <button onClick={() => window.location.href='/restaurant/'+inspirationPick.id} style={{width:'100%',padding:'14px',borderRadius:'14px',background:'#3D2B4F',color:'#F7F3EE',border:'none',fontSize:'15px',fontWeight:'500',cursor:'pointer',fontFamily:'sans-serif'}}>Let's go →</button>
              <button onClick={pickInspiration} style={{width:'100%',padding:'14px',borderRadius:'14px',background:'transparent',color:'#3D2B4F',border:'1.5px solid #DDD6CC',fontSize:'15px',fontWeight:'400',cursor:'pointer',fontFamily:'sans-serif'}}>Try another</button>
            </div>
          </div>
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
