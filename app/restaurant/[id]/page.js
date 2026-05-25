'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase'

export default function RestaurantPage() {
  const [user, setUser] = useState(null)
  const [restaurant, setRestaurant] = useState(null)
  const [matchScore, setMatchScore] = useState(null)
  const [tags, setTags] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [wouldGoBack, setWouldGoBack] = useState(null)
  const [worthSpecialTrip, setWorthSpecialTrip] = useState(null)
  const [betterThanExpected, setBetterThanExpected] = useState(null)
  const [serviceGood, setServiceGood] = useState(null)
  const [discoveredFavourite, setDiscoveredFavourite] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [existingTags, setExistingTags] = useState([])
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      const { data: r } = await supabase.from('restaurants').select('*').eq('id', params.id).single()
      setRestaurant(r)

      const { data: reviews } = await supabase.from('reviews').select('tags').eq('restaurant_id', params.id)
      if (reviews) {
        const tagCounts = {}
        reviews.forEach(rev => { if (rev.tags) rev.tags.forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1 }) })
        const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag]) => tag)
        setExistingTags(sorted)
      }

      if (user) {
        const { data: t } = await supabase.from('tags').select('*').order('category')
        setTags(t || [])
        const { data: feed } = await supabase.rpc('get_personalised_feed', { user_uuid: user.id })
        if (feed) {
          const match = feed.find(item => String(item.id) === String(params.id))
          if (match?.match_score) setMatchScore(Math.round(match.match_score))
        }
      }
    }
    load()
  }, [params.id])

  function toggleTag(label) {
    setSelectedTags(prev => prev.includes(label) ? prev.filter(t => t !== label) : [...prev, label])
  }

  async function handleSubmit() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('reviews').insert({
      user_id: user.id,
      restaurant_id: params.id,
      tags: selectedTags,
      would_go_back: wouldGoBack,
      worth_special_trip: worthSpecialTrip,
      better_than_expected: betterThanExpected,
      service_good: serviceGood,
      discovered_favourite: discoveredFavourite,
    })
    if (!error) {
      setSaved(true)
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer_id: user.id, restaurant_id: params.id }),
      }).catch(e => console.error('Notify error:', e))
    }
    setLoading(false)
  }

  if (!restaurant) return <div style={{padding:'40px',textAlign:'center',color:'#9A928A'}}>Loading...</div>

  if (saved) return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif'}}>
      <div style={{background:'#3D2B4F',padding:'16px 24px',display:'flex',alignItems:'center',gap:'12px'}}>
        <button onClick={() => router.push('/')} style={{background:'transparent',border:'none',color:'#F7F3EE',cursor:'pointer',fontSize:'20px'}}>←</button>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'20px',color:'#F7F3EE',fontStyle:'italic',margin:0}}>palate</h1>
      </div>
      <div style={{padding:'48px 24px',textAlign:'center'}}>
        <div style={{fontSize:'32px',marginBottom:'12px'}}>✓</div>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:'22px',color:'#1A1714',marginBottom:'8px'}}>Review saved</h2>
        <p style={{fontSize:'14px',color:'#5A534E',marginBottom:'24px'}}>Your taste profile has been updated.</p>
        <button onClick={() => router.push('/')} style={{padding:'12px 28px',borderRadius:'14px',background:'#3D2B4F',color:'#F7F3EE',border:'none',fontSize:'14px',cursor:'pointer'}}>Back to feed</button>
      </div>
    </main>
  )

  const backDest = user ? '/' : '/explore'

  return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif',paddingBottom:'48px'}}>
      <div style={{background:'#3D2B4F',padding:'16px 24px',display:'flex',alignItems:'center',gap:'12px'}}>
        <button onClick={() => router.push(backDest)} style={{background:'transparent',border:'none',color:'#F7F3EE',cursor:'pointer',fontSize:'20px'}}>←</button>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'20px',color:'#F7F3EE',fontStyle:'italic',margin:0}}>palate</h1>
      </div>

      <div style={{margin:'16px',background:'linear-gradient(135deg,#3D2B4F,#6B4E8A)',borderRadius:'16px',padding:'24px',color:'#F7F3EE'}}>
        <div style={{fontFamily:'Georgia,serif',fontSize:'26px',fontStyle:'italic',marginBottom:'4px'}}>{restaurant.name}</div>
        <div style={{fontSize:'13px',opacity:0.7,marginBottom:matchScore?'16px':'0'}}>{restaurant.cuisine} · {restaurant.neighbourhood} · {'£'.repeat(restaurant.price_range)}</div>
        {matchScore && (
          <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px'}}>
              <span style={{fontSize:'13px',opacity:0.7}}>Match for you</span>
              <span style={{fontSize:'14px',fontWeight:'500'}}>{matchScore}%</span>
            </div>
            <div style={{height:'3px',background:'rgba(255,255,255,0.2)',borderRadius:'2px',overflow:'hidden'}}>
              <div style={{height:'100%',width:`${matchScore}%`,background:'rgba(255,255,255,0.8)',borderRadius:'2px',transition:'width 0.6s ease'}}></div>
            </div>
          </>
        )}
      </div>

      {existingTags.length > 0 && (
        <div style={{padding:'0 16px 16px'}}>
          <div style={{fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'8px'}}>What people say</div>
          <div>{existingTags.map(tag => (<span key={tag} style={{display:'inline-block',fontSize:'12px',padding:'5px 11px',borderRadius:'20px',border:'1.5px solid #8B6FAD',color:'#3D2B4F',background:'#E8E0F5',margin:'3px'}}>{tag}</span>))}</div>
        </div>
      )}

      <div style={{height:'1px',background:'#EDE8E1',margin:'0 16px 16px'}}></div>

      {user ? (
        <>
          <div style={{padding:'0 16px 16px'}}>
            <div style={{fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'10px'}}>Leave your tags</div>
            <div>{tags.map(tag => (<span key={tag.id} onClick={() => toggleTag(tag.label)} style={{display:'inline-block',fontSize:'12px',padding:'5px 11px',borderRadius:'20px',border:selectedTags.includes(tag.label)?'1.5px solid #8B6FAD':'1.5px solid #DDD6CC',color:selectedTags.includes(tag.label)?'#3D2B4F':'#5A534E',background:selectedTags.includes(tag.label)?'#E8E0F5':'#F7F3EE',margin:'3px',cursor:'pointer'}}>{tag.label}</span>))}</div>
          </div>

          <div style={{height:'1px',background:'#EDE8E1',margin:'0 16px 16px'}}></div>

          <div style={{padding:'0 16px 16px'}}>
            <div style={{fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'10px'}}>Quick questions</div>
            <div style={{background:'white',borderRadius:'16px',padding:'4px 0',boxShadow:'0 2px 12px rgba(26,23,20,0.06)'}}>
              {[
                { label: 'Would you go back?', value: wouldGoBack, setter: setWouldGoBack, opts: [{ v: true, l: 'Yes' }, { v: false, l: 'No' }] },
                { label: 'Worth a special trip?', value: worthSpecialTrip, setter: setWorthSpecialTrip, opts: [{ v: true, l: 'Yes' }, { v: false, l: 'Nearby only' }] },
                { label: 'Better than expected?', value: betterThanExpected, setter: setBetterThanExpected, opts: [{ v: true, l: 'Yes' }, { v: false, l: 'No' }] },
                { label: 'Service good?', value: serviceGood, setter: setServiceGood, opts: [{ v: true, l: 'Yes' }, { v: false, l: 'Could be better' }] },
                { label: 'Discovered a new favourite?', value: discoveredFavourite, setter: setDiscoveredFavourite, opts: [{ v: true, l: 'Yes' }, { v: false, l: 'Not quite' }] },
              ].map((q, i, arr) => (
                <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:i < arr.length - 1 ? '1px solid #EDE8E1' : 'none'}}>
                  <span style={{fontSize:'14px',color:'#1A1714'}}>{q.label}</span>
                  <div style={{display:'flex',gap:'6px'}}>
                    {q.opts.map(opt => (
                      <button key={opt.l} onClick={() => q.setter(q.value === opt.v ? null : opt.v)} style={{padding:'6px 14px',borderRadius:'8px',border:q.value===opt.v?'1.5px solid #2A6B4F':'1.5px solid #DDD6CC',background:q.value===opt.v?'#DCF0E6':'transparent',color:q.value===opt.v?'#2A6B4F':'#5A534E',fontSize:'13px',fontFamily:'sans-serif',cursor:'pointer',fontWeight:q.value===opt.v?'500':'400'}}>{opt.l}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{padding:'0 16px'}}>
            <button onClick={handleSubmit} disabled={loading} style={{width:'100%',padding:'14px',borderRadius:'14px',background:'#3D2B4F',color:'#F7F3EE',border:'none',fontSize:'15px',fontWeight:'500',cursor:'pointer'}}>
              {loading ? 'Saving...' : 'Save review →'}
            </button>
          </div>
        </>
      ) : (
        <div style={{margin:'0 16px',background:'linear-gradient(135deg,#3D2B4F,#6B4E8A)',borderRadius:'16px',padding:'24px',color:'#F7F3EE',textAlign:'center'}}>
          <div style={{fontFamily:'Georgia,serif',fontSize:'20px',fontStyle:'italic',marginBottom:'8px'}}>Been here?</div>
          <p style={{fontSize:'14px',opacity:0.8,lineHeight:'1.5',marginBottom:'20px'}}>Sign up free to leave a review, get taste-matched recommendations, and see what people like you love.</p>
          <button onClick={() => window.location.href='/signup'} style={{width:'100%',padding:'13px',borderRadius:'12px',background:'#F7F3EE',color:'#3D2B4F',border:'none',fontSize:'15px',fontWeight:'500',cursor:'pointer',marginBottom:'10px'}}>Create a free account →</button>
          <button onClick={() => window.location.href='/login'} style={{background:'transparent',border:'none',color:'#F7F3EE',fontSize:'13px',opacity:0.6,cursor:'pointer'}}>Already have an account? Log in</button>
        </div>
      )}
    </main>
  )
}
