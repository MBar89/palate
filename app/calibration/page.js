'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { assignCluster } from '../../lib/clustering'

const calibrationPlaces = [
  { id: 'dishoom', name: 'Dishoom', meta: 'Indian · Shoreditch' },
  { id: 'wagamama', name: 'Wagamama', meta: 'Pan-Asian · Chain' },
  { id: 'hawksmoor', name: 'Hawksmoor', meta: 'Steakhouse · Various' },
  { id: 'pret', name: 'Pret a Manger', meta: 'Cafe · Chain' },
  { id: 'ledbury', name: 'The Ledbury', meta: 'European · Notting Hill' },
  { id: 'fiveguys', name: 'Five Guys', meta: 'Burgers · Chain' },
  { id: 'ottolenghi', name: 'Ottolenghi', meta: 'Mediterranean · Various' },
  { id: 'nobu', name: 'Nobu', meta: 'Japanese · Mayfair' },
]

export default function CalibrationPage() {
  const [ratings, setRatings] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const router = useRouter()
  const supabase = createClient()

  function selectRating(placeId, rating) {
    setRatings(prev => ({ ...prev, [placeId]: rating }))
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: existing } = await supabase.from('restaurants').select('id, name')
    const restaurantMap = {}
    existing.forEach(r => { restaurantMap[r.name] = r.id })
    const rows = calibrationPlaces
      .filter(p => ratings[p.id])
      .map(p => ({ user_id: user.id, restaurant_id: restaurantMap[p.name], rating: ratings[p.id] }))
      .filter(r => r.restaurant_id)
    if (rows.length === 0) { setError('Please rate at least one place to continue'); setLoading(false); return }
    const { error: insertError } = await supabase.from('calibration_ratings').insert(rows)
    if (insertError) { setError(insertError.message); setLoading(false); return }
    const ratingsWithNames = calibrationPlaces
      .filter(p => ratings[p.id])
      .map(p => ({ name: p.name, rating: ratings[p.id] }))
    const cluster = assignCluster(ratingsWithNames)
    await supabase.from('profiles').upsert({ id: user.id, cluster })
    router.push('/')
  }

  const rated = Object.keys(ratings).length

  return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif'}}>
      <div style={{background:'#3D2B4F',padding:'16px 24px'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'28px',color:'#F7F3EE',fontStyle:'italic',margin:0}}>palate</h1>
      </div>
      <div style={{padding:'24px 16px 48px',maxWidth:'480px',margin:'0 auto'}}>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:'26px',color:'#1A1714',marginBottom:'6px'}}>Rate places you know</h2>
        <p style={{fontSize:'14px',color:'#5A534E',marginBottom:'16px',lineHeight:'1.5'}}>We will find people with your taste and show you what they love.</p>
        <div style={{display:'flex',gap:'4px',marginBottom:'16px'}}>
          {calibrationPlaces.map((p, i) => (
            <div key={i} style={{height:'3px',flex:1,background: ratings[p.id] ? '#3D2B4F' : '#DDD6CC',borderRadius:'2px'}} />
          ))}
        </div>
        {calibrationPlaces.map(place => (
          <div key={place.id} style={{background:'white',borderRadius:'16px',padding:'16px',marginBottom:'10px',boxShadow:'0 2px 12px rgba(26,23,20,0.07)'}}>
            <div style={{fontFamily:'Georgia,serif',fontSize:'17px',color:'#1A1714',marginBottom:'2px'}}>{place.name}</div>
            <div style={{fontSize:'12px',color:'#9A928A',marginBottom:'12px'}}>{place.meta}</div>
            <div style={{display:'flex',gap:'6px'}}>
              {['never', 'love', 'mixed', 'disliked'].map(option => (
                <button key={option} onClick={() => selectRating(place.id, option)} style={{flex:1,padding:'8px 4px',borderRadius:'10px',border: ratings[place.id] === option ? '1.5px solid ' + (option === 'love' ? '#8B6FAD' : option === 'mixed' ? '#C8882A' : option === 'disliked' ? '#A03020' : '#9A928A') : '1.5px solid #DDD6CC',background: ratings[place.id] === option ? (option === 'love' ? '#E8E0F5' : option === 'mixed' ? '#FAF0DC' : option === 'disliked' ? '#F5E0DC' : '#EDE8E1') : 'transparent',fontSize:'12px',fontFamily:'sans-serif',color: ratings[place.id] === option ? (option === 'love' ? '#3D2B4F' : option === 'mixed' ? '#C8882A' : option === 'disliked' ? '#A03020' : '#9A928A') : '#5A534E',cursor:'pointer',textAlign:'center'}}>
                  {option === 'never' ? 'Never been' : option === 'love' ? 'Loved it' : option === 'mixed' ? 'Mixed' : 'Disliked'}
                </button>
              ))}
            </div>
          </div>
        ))}
        {error && <p style={{fontSize:'13px',color:'#A03020'}}>{error}</p>}
        <button onClick={handleSubmit} disabled={loading} style={{width:'100%',padding:'14px',borderRadius:'14px',background: rated === 0 ? '#9A928A' : '#3D2B4F',color:'#F7F3EE',border:'none',fontSize:'15px',fontWeight:'500',cursor: rated === 0 ? 'not-allowed' : 'pointer',marginTop:'16px'}}>
          {loading ? 'Saving...' : 'See my matches'}
        </button>
      </div>
    </main>
  )
}
