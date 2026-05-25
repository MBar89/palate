'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '../../lib/supabase'
import NavBar from '../../components/NavBar'

export default function AddRestaurantPage() {
  const [name, setName] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [neighbourhood, setNeighbourhood] = useState('')
  const [area, setArea] = useState('')
  const [priceRange, setPriceRange] = useState(null)
  const [coordinates, setCoordinates] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [placeId, setPlaceId] = useState(null)
  const [duplicate, setDuplicate] = useState(null)
  const searchTimeout = useRef(null)
  const duplicateTimeout = useRef(null)
  const supabase = createClient()

  async function searchPlaces(query) {
    if (!query || query.length < 3) { setSuggestions([]); return }
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(query)}`)
        const data = await res.json()
        if (data.predictions) setSuggestions(data.predictions.slice(0, 5))
      } catch (e) {
        console.error('Places error:', e)
      }
    }, 300)
  }

  async function checkDuplicate(restaurantName) {
    if (!restaurantName || restaurantName.length < 3) { setDuplicate(null); return }
    clearTimeout(duplicateTimeout.current)
    duplicateTimeout.current = setTimeout(async () => {
      const { data } = await supabase
        .from('restaurants')
        .select('id, name, neighbourhood, status')
        .ilike('name', restaurantName.trim())
        .in('status', ['approved', 'pending'])
        .limit(1)
      setDuplicate(data && data.length > 0 ? data[0] : null)
    }, 400)
  }

  async function selectPlace(prediction) {
    const placeName = prediction.structured_formatting.main_text
    setName(placeName)
    setPlaceId(prediction.place_id)
    setSuggestions([])
    checkDuplicate(placeName)

    try {
      const res = await fetch(`/api/places/details?place_id=${prediction.place_id}`)
      const data = await res.json()
      if (data.result) {
        const components = data.result.address_components || []
        const hood = components.find(c => c.types.includes('neighborhood') || c.types.includes('sublocality'))
        const a = components.find(c => c.types.includes('postal_town') || c.types.includes('locality'))
        if (hood) setNeighbourhood(hood.long_name)
        if (a) setArea(a.long_name)
        if (data.result.price_level) setPriceRange(data.result.price_level)
        if (data.result.geometry?.location) {
          setCoordinates({ lat: data.result.geometry.location.lat, lng: data.result.geometry.location.lng })
        }
      }
    } catch (e) {
      console.error('Place details error:', e)
    }
  }

  async function handleSubmit() {
    if (!name || !cuisine || !neighbourhood || !priceRange) {
      setError('Please fill in all fields')
      return
    }
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }

    const { error } = await supabase.from('restaurants').insert({
      name,
      cuisine,
      neighbourhood,
      area: area || neighbourhood,
      price_range: priceRange,
      is_chain: false,
      status: 'pending',
      submitted_by: user.id,
      latitude: coordinates?.lat || null,
      longitude: coordinates?.lng || null,
    })

    if (error) { setError(error.message); setLoading(false); return }
    setSuccess(true)
    setLoading(false)
  }

  if (success) return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif'}}>
      <div style={{background:'#3D2B4F',padding:'16px 24px',display:'flex',alignItems:'center',gap:'12px'}}>
        <button onClick={() => window.location.href='/'} style={{background:'transparent',border:'none',color:'#F7F3EE',cursor:'pointer',fontSize:'20px'}}>←</button>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'20px',color:'#F7F3EE',fontStyle:'italic',margin:0}}>palate</h1>
      </div>
      <div style={{padding:'48px 24px',textAlign:'center'}}>
        <div style={{fontSize:'32px',marginBottom:'12px'}}>✓</div>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:'22px',color:'#1A1714',marginBottom:'8px'}}>Restaurant submitted</h2>
        <p style={{fontSize:'14px',color:'#5A534E',marginBottom:'24px',lineHeight:'1.5'}}>Thanks for contributing. It will appear once approved.</p>
        <button onClick={() => window.location.href='/'} style={{padding:'12px 28px',borderRadius:'14px',background:'#3D2B4F',color:'#F7F3EE',border:'none',fontSize:'14px',cursor:'pointer'}}>Back to feed</button>
      </div>
    </main>
  )

  return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif',paddingBottom:'80px'}}>
      <div style={{background:'#3D2B4F',padding:'16px 24px',display:'flex',alignItems:'center',gap:'12px'}}>
        <button onClick={() => window.location.href='/'} style={{background:'transparent',border:'none',color:'#F7F3EE',cursor:'pointer',fontSize:'20px'}}>←</button>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'20px',color:'#F7F3EE',fontStyle:'italic',margin:0}}>Add a restaurant</h1>
      </div>

      <div style={{padding:'24px 16px',maxWidth:'480px',margin:'0 auto'}}>

        <div style={{marginBottom:'16px',position:'relative'}}>
          <label style={{fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.06em',textTransform:'uppercase',display:'block',marginBottom:'6px'}}>Restaurant name</label>
          <input
            value={name}
            onChange={e => {
              setName(e.target.value)
              searchPlaces(e.target.value)
              checkDuplicate(e.target.value)
            }}
            placeholder="Search for a restaurant..."
            style={{width:'100%',padding:'12px 14px',borderRadius:'12px',border: duplicate ? '1.5px solid #C47A2A' : '1.5px solid #DDD6CC',background:'white',fontSize:'14px',fontFamily:'sans-serif',color:'#1A1714',outline:'none',boxSizing:'border-box'}}
          />
          {suggestions.length > 0 && (
            <div style={{position:'absolute',top:'100%',left:0,right:0,background:'white',borderRadius:'12px',boxShadow:'0 4px 24px rgba(26,23,20,0.12)',zIndex:10,overflow:'hidden',marginTop:'4px'}}>
              {suggestions.map(s => (
                <div key={s.place_id} onClick={() => selectPlace(s)} style={{padding:'12px 14px',cursor:'pointer',borderBottom:'1px solid #EDE8E1',fontSize:'14px',color:'#1A1714'}}>
                  <div style={{fontWeight:'500'}}>{s.structured_formatting.main_text}</div>
                  <div style={{fontSize:'12px',color:'#9A928A',marginTop:'2px'}}>{s.structured_formatting.secondary_text}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {duplicate && (
          <div style={{marginBottom:'16px',background:'#FEF3E2',border:'1.5px solid #C47A2A',borderRadius:'12px',padding:'12px 14px'}}>
            <div style={{fontSize:'13px',fontWeight:'500',color:'#7A4A10',marginBottom:'2px'}}>This restaurant may already exist</div>
            <div style={{fontSize:'12px',color:'#7A4A10',opacity:0.8}}>
              {duplicate.name} · {duplicate.neighbourhood} is {duplicate.status === 'pending' ? 'awaiting approval' : 'already in palate'}. Only submit if this is a different restaurant.
            </div>
          </div>
        )}

        <div style={{display:'flex',gap:'10px',marginBottom:'16px'}}>
          <div style={{flex:1}}>
            <label style={{fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.06em',textTransform:'uppercase',display:'block',marginBottom:'6px'}}>Cuisine</label>
            <input value={cuisine} onChange={e => setCuisine(e.target.value)} placeholder="e.g. British" style={{width:'100%',padding:'12px 14px',borderRadius:'12px',border:'1.5px solid #DDD6CC',background:'white',fontSize:'14px',fontFamily:'sans-serif',color:'#1A1714',outline:'none'}} />
          </div>
          <div style={{flex:1}}>
            <label style={{fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.06em',textTransform:'uppercase',display:'block',marginBottom:'6px'}}>Neighbourhood</label>
            <input value={neighbourhood} onChange={e => setNeighbourhood(e.target.value)} placeholder="e.g. Shoreditch" style={{width:'100%',padding:'12px 14px',borderRadius:'12px',border:'1.5px solid #DDD6CC',background:'white',fontSize:'14px',fontFamily:'sans-serif',color:'#1A1714',outline:'none'}} />
          </div>
        </div>

        <div style={{marginBottom:'16px'}}>
          <label style={{fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.06em',textTransform:'uppercase',display:'block',marginBottom:'6px'}}>Area</label>
          <input value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. East London" style={{width:'100%',padding:'12px 14px',borderRadius:'12px',border:'1.5px solid #DDD6CC',background:'white',fontSize:'14px',fontFamily:'sans-serif',color:'#1A1714',outline:'none'}} />
        </div>

        <div style={{marginBottom:'24px'}}>
          <label style={{fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.06em',textTransform:'uppercase',display:'block',marginBottom:'6px'}}>Price range</label>
          <div style={{display:'flex',gap:'8px'}}>
            {[1,2,3,4,5].map(p => (
              <button key={p} onClick={() => setPriceRange(p)} style={{flex:1,padding:'10px 4px',borderRadius:'10px',border:priceRange===p?'1.5px solid #8B6FAD':'1.5px solid #DDD6CC',background:priceRange===p?'#E8E0F5':'transparent',color:priceRange===p?'#3D2B4F':'#5A534E',fontSize:'13px',fontFamily:'sans-serif',cursor:'pointer',fontWeight:priceRange===p?'500':'400'}}>{'£'.repeat(p)}</button>
            ))}
          </div>
        </div>

        {error && <p style={{fontSize:'13px',color:'#A03020',marginBottom:'12px'}}>{error}</p>}

        <button onClick={handleSubmit} disabled={loading} style={{width:'100%',padding:'14px',borderRadius:'14px',background:'#3D2B4F',color:'#F7F3EE',border:'none',fontSize:'15px',fontWeight:'500',cursor:'pointer'}}>
          {loading ? 'Submitting...' : 'Submit restaurant →'}
        </button>
      </div>
      <NavBar active="" />
    </main>
  )
}
