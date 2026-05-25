'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase'

export default function UserProfilePage() {
  const [profile, setProfile] = useState(null)
  const [topTags, setTopTags] = useState([])
  const [reviewedPlaces, setReviewedPlaces] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const params = useParams()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setCurrentUser(user)

      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', params.username)
        .single()

      if (!p) { setNotFound(true); setLoading(false); return }
      setProfile(p)

      const [{ data: reviews }, { data: follow }] = await Promise.all([
        supabase
          .from('reviews')
          .select('tags, restaurant_id, restaurants(name, cuisine, neighbourhood, price_range)')
          .eq('user_id', p.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', p.id)
          .maybeSingle(),
      ])

      if (reviews) {
        setReviewedPlaces(reviews)
        const tagCounts = {}
        reviews.forEach(rev => {
          if (rev.tags) rev.tags.forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1 })
        })
        const sorted = Object.entries(tagCounts).sort((a,b) => b[1]-a[1]).slice(0,8).map(([t]) => t)
        setTopTags(sorted)
      }

      setIsFollowing(!!follow)
      setLoading(false)
    }
    load()
  }, [params.username])

  async function toggleFollow() {
    if (!currentUser || !profile) return
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', profile.id)
      setIsFollowing(false)
    } else {
      await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: profile.id })
      setIsFollowing(true)
    }
  }

  const clusterLabels = {
    adventurous: 'Adventurous explorer',
    comfort: 'Comfort seeker',
    fine_dining: 'Fine dining enthusiast',
    casual: 'Casual diner',
  }

  const header = (
    <div style={{background:'#3D2B4F',padding:'16px 24px',display:'flex',alignItems:'center',gap:'12px'}}>
      <button onClick={() => window.history.back()} style={{background:'transparent',border:'none',color:'#F7F3EE',cursor:'pointer',fontSize:'20px'}}>←</button>
      <h1 style={{fontFamily:'Georgia,serif',fontSize:'20px',color:'#F7F3EE',fontStyle:'italic',margin:0}}>palate</h1>
    </div>
  )

  if (loading) return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif'}}>
      {header}
      <div style={{padding:'40px',textAlign:'center',color:'#9A928A',fontSize:'14px'}}>Loading...</div>
    </main>
  )

  if (notFound) return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif'}}>
      {header}
      <div style={{padding:'48px 24px',textAlign:'center'}}>
        <p style={{fontSize:'14px',color:'#9A928A'}}>User not found.</p>
      </div>
    </main>
  )

  const initials = profile.username ? profile.username.slice(0, 2).toUpperCase() : '?'
  const isOwnProfile = currentUser?.id === profile.id

  return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif',paddingBottom:'48px'}}>
      {header}

      <div style={{padding:'16px 16px 8px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <div style={{width:'48px',height:'48px',borderRadius:'50%',background:'#E8E0F5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:'500',color:'#3D2B4F',flexShrink:0}}>{initials}</div>
          <div>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:'20px',color:'#1A1714',fontStyle:'italic',margin:'0 0 2px'}}>@{profile.username}</h2>
            <p style={{fontSize:'13px',color:'#9A928A',margin:0}}>{reviewedPlaces.length} place{reviewedPlaces.length !== 1 ? 's' : ''} reviewed</p>
          </div>
        </div>
        {!isOwnProfile && (
          <button onClick={toggleFollow} style={{padding:'8px 18px',borderRadius:'10px',border:isFollowing?'1.5px solid #DDD6CC':'1.5px solid #3D2B4F',background:isFollowing?'transparent':'#3D2B4F',color:isFollowing?'#9A928A':'#F7F3EE',fontSize:'13px',fontWeight:'500',fontFamily:'sans-serif',cursor:'pointer',flexShrink:0}}>
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
      </div>

      {profile.cluster && (
        <div style={{margin:'8px 16px 16px',background:'linear-gradient(135deg,#3D2B4F,#6B4E8A)',borderRadius:'16px',padding:'20px',color:'#F7F3EE'}}>
          <div style={{fontSize:'11px',opacity:0.6,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'6px'}}>Taste type</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:'22px',fontStyle:'italic'}}>{clusterLabels[profile.cluster] || profile.cluster}</div>
        </div>
      )}

      {topTags.length > 0 && (
        <>
          <div style={{padding:'0 16px 8px',fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase'}}>Top tags</div>
          <div style={{padding:'0 16px 16px'}}>
            {topTags.map(tag => (
              <span key={tag} style={{display:'inline-block',fontSize:'12px',padding:'5px 11px',borderRadius:'20px',border:'1.5px solid #8B6FAD',color:'#3D2B4F',background:'#E8E0F5',margin:'3px'}}>{tag}</span>
            ))}
          </div>
        </>
      )}

      {reviewedPlaces.length > 0 ? (
        <>
          <div style={{padding:'0 16px 8px',fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase'}}>Places reviewed</div>
          <div style={{padding:'0 16px'}}>
            {reviewedPlaces.map((rev, i) => (
              <div key={i} onClick={() => window.location.href='/restaurant/'+rev.restaurant_id} style={{background:'white',borderRadius:'16px',padding:'14px 16px',marginBottom:'8px',boxShadow:'0 2px 12px rgba(26,23,20,0.06)',cursor:'pointer'}}>
                <div style={{fontFamily:'Georgia,serif',fontSize:'16px',color:'#1A1714',marginBottom:'2px'}}>{rev.restaurants?.name}</div>
                <div style={{fontSize:'12px',color:'#9A928A',marginBottom:rev.tags && rev.tags.length > 0?'8px':0}}>{rev.restaurants?.cuisine} · {rev.restaurants?.neighbourhood} · {'£'.repeat(rev.restaurants?.price_range || 1)}</div>
                {rev.tags && rev.tags.length > 0 && (
                  <div>{rev.tags.slice(0,3).map(tag => (
                    <span key={tag} style={{display:'inline-block',fontSize:'11px',padding:'3px 8px',borderRadius:'20px',border:'1.5px solid #8B6FAD',color:'#3D2B4F',background:'#E8E0F5',margin:'2px'}}>{tag}</span>
                  ))}</div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{padding:'40px 24px',textAlign:'center'}}>
          <p style={{fontSize:'14px',color:'#9A928A'}}>No reviews yet.</p>
        </div>
      )}
    </main>
  )
}
