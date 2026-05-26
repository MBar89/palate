'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import NavBar from '../../../components/NavBar'

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
  const [reviewCount, setReviewCount] = useState(0)
  const [existingReviewId, setExistingReviewId] = useState(null)
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
        setReviewCount(reviews.length)
        const tagCounts = {}
        reviews.forEach(rev => { if (rev.tags) rev.tags.forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1 }) })
        const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag, count]) => ({ tag, count }))
        setExistingTags(sorted)
      }

      if (user) {
        const [{ data: t }, { data: feed }, { data: myReview }] = await Promise.all([
          supabase.from('tags').select('*').order('category'),
          supabase.rpc('get_personalised_feed', { user_uuid: user.id }),
          supabase.from('reviews').select('*').eq('user_id', user.id).eq('restaurant_id', params.id).maybeSingle(),
        ])
        setTags(t || [])
        if (feed) {
          const match = feed.find(item => String(item.id) === String(params.id))
          if (match?.match_score) setMatchScore(Math.round(match.match_score))
        }
        if (myReview) {
          setExistingReviewId(myReview.id)
          setSelectedTags(myReview.tags || [])
          setWouldGoBack(myReview.would_go_back ?? null)
          setWorthSpecialTrip(myReview.worth_special_trip ?? null)
          setBetterThanExpected(myReview.better_than_expected ?? null)
          setServiceGood(myReview.service_good ?? null)
          setDiscoveredFavourite(myReview.discovered_favourite ?? null)
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
    const reviewData = {
      tags: selectedTags,
      would_go_back: wouldGoBack,
      worth_special_trip: worthSpecialTrip,
      better_than_expected: betterThanExpected,
      service_good: serviceGood,
      discovered_favourite: discoveredFavourite,
    }
    const { error } = existingReviewId
      ? await supabase.from('reviews').update(reviewData).eq('id', existingReviewId)
      : await supabase.from('reviews').insert({ ...reviewData, user_id: user.id, restaurant_id: params.id })
    if (!error) {
      setSaved(true)
      if (!existingReviewId) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewer_id: user.id, restaurant_id: params.id }),
        }).catch(e => console.error('Notify error:', e))
      }
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
        <h2 style={{fontFamily:'Georgia,serif',fontSize:'22px',color:'#1A1714',marginBottom:'8px'}}>{existingReviewId ? 'Review updated' : 'Review saved'}</h2>
        <p style={{fontSize:'14px',color:'#5A534E',marginBottom:'24px'}}>Your taste profile has been updated.</p>
        <button onClick={() => router.push('/')} style={{padding:'12px 28px',borderRadius:'14px',background:'#3D2B4F',color:'#F7F3EE',border:'none',fontSize:'14px',cursor:'pointer'}}>Back to feed</button>
      </div>
    </main>
  )

  const backDest = user ? '/' : '/explore'

  return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif',paddingBottom:'80px'}}>
      <div style={{background:'#3D2B4F',padding:'16px 24px',display:'flex',alignItems:'center',gap:'12px'}}>
        <button onClick={() => router.push(backDest)} style={{background:'transparent',border:'none',color:'#F7F3EE',cursor:'pointer',fontSize:'20px'}}>←</button>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'20px',color:'#F7F3EE',fontStyle:'italic',margin:0}}>palate</h1>
      </div>

      <div style={{margin:'16px',background:'linear-gradient(135deg,#3D2B4F,#6B4E8A)',borderRadius:'16px',padding:'24px',color:'#F7F3EE'}}>
        <div style={{fontFamily:'Georgia,serif',fontSize:'26px',fontStyle:'italic',marginBottom:'4px'}}>{restaurant.name}</div>
        <div style={{fontSize:'13px',opacity:0.7,marginBottom:(matchScore||reviewCount>0)?'8px':'0'}}>{restaurant.cuisine} · {restaurant.neighbourhood} · {'£'.repeat(restaurant.price_range)}</div>
        {reviewCount > 0 && !matchScore && <div style={{fontSize:'12px',opacity:0.6,marginBottom:'0'}}>{reviewCount} {reviewCount === 1 ? 'Palate member' : 'Palate members'} reviewed this</div>}
        {reviewCount > 0 && matchScore && <div style={{fontSize:'12px',opacity:0.6,marginBottom:'12px'}}>{reviewCount} {reviewCount === 1 ? 'Palate member' : 'Palate members'} reviewed this</div>}
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

      {(restaurant.address || restaurant.phone || restaurant.website || restaurant.opening_hours) && (
        <div style={{margin:'0 16px 16px',background:'white',borderRadius:'16px',padding:'16px',boxShadow:'0 2px 12px rgba(26,23,20,0.06)'}}>
          {restaurant.address && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(restaurant.address)}`} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'flex-start',gap:'10px',textDecoration:'none',marginBottom:restaurant.phone||restaurant.website||restaurant.opening_hours?'12px':'0'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B6FAD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:'1px'}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span style={{fontSize:'13px',color:'#3D2B4F',lineHeight:'1.4'}}>{restaurant.address}</span>
            </a>
          )}
          {restaurant.phone && (
            <a href={`tel:${restaurant.phone}`} style={{display:'flex',alignItems:'center',gap:'10px',textDecoration:'none',marginBottom:restaurant.website||restaurant.opening_hours?'12px':'0'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B6FAD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              <span style={{fontSize:'13px',color:'#3D2B4F'}}>{restaurant.phone}</span>
            </a>
          )}
          {restaurant.website && (
            <a href={restaurant.website} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',gap:'10px',textDecoration:'none',marginBottom:restaurant.opening_hours?'12px':'0'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B6FAD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
              <span style={{fontSize:'13px',color:'#3D2B4F',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{restaurant.website.replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'')}</span>
            </a>
          )}
          {restaurant.opening_hours && (
            <div style={{display:'flex',alignItems:'flex-start',gap:'10px'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B6FAD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:'2px'}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <div>
                {restaurant.opening_hours.map((line, i) => (
                  <div key={i} style={{fontSize:'12px',color:'#5A534E',lineHeight:'1.7'}}>{line}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {existingTags.length > 0 && (
        <div style={{padding:'0 16px 16px'}}>
          <div style={{fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'8px'}}>What people say</div>
          <div>{existingTags.map(({tag, count}) => (
            <span key={tag} style={{display:'inline-flex',alignItems:'center',gap:'5px',fontSize:'12px',padding:'5px 11px',borderRadius:'20px',border:'1.5px solid #8B6FAD',color:'#3D2B4F',background:'#E8E0F5',margin:'3px'}}>
              {tag}
              {count > 1 && <span style={{fontSize:'10px',fontWeight:'600',background:'#8B6FAD',color:'white',borderRadius:'20px',padding:'1px 5px',lineHeight:'1.4'}}>{count}</span>}
            </span>
          ))}</div>
        </div>
      )}

      <div style={{height:'1px',background:'#EDE8E1',margin:'0 16px 16px'}}></div>

      {user ? (
        <>
          <div style={{padding:'0 16px 16px'}}>
            <div style={{fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'10px'}}>{existingReviewId ? 'Your review' : 'Leave your tags'}</div>
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
              {loading ? 'Saving...' : existingReviewId ? 'Update review →' : 'Save review →'}
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
      <NavBar active="" />
    </main>
  )
}
