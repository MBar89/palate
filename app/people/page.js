'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import NavBar from '../../components/NavBar'

export default function PeoplePage() {
  const [user, setUser] = useState(null)
  const [userCluster, setUserCluster] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [following, setFollowing] = useState(new Set())
  const [followingProfiles, setFollowingProfiles] = useState([])
  const [recommended, setRecommended] = useState([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('cluster')
        .eq('id', user.id)
        .single()
      const cluster = profile?.cluster
      setUserCluster(cluster)

      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
      const followingIds = follows ? follows.map(f => f.following_id) : []
      setFollowing(new Set(followingIds))

      if (followingIds.length > 0) {
        const { data: followingProfs } = await supabase
          .from('profiles')
          .select('id, cluster, username, display_name')
          .in('id', followingIds)
        setFollowingProfiles(followingProfs || [])
      }

      if (cluster) {
        const { data: recs } = await supabase
          .from('profiles')
          .select('id, cluster, username, display_name')
          .eq('cluster', cluster)
          .neq('id', user.id)
          .not('username', 'is', null)
          .limit(10)
        if (recs) {
          const notFollowing = recs.filter(p => !followingIds.includes(p.id))
          setRecommended(notFollowing.slice(0, 5))
        }
      }
    }
    load()
  }, [])

  async function search(q) {
    setQuery(q)
    if (!q || q.length < 2) { setResults([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, cluster, username, display_name')
      .neq('id', user?.id)
      .not('cluster', 'is', null)
      .ilike('username', `%${q}%`)
      .limit(20)
    if (data) setResults(data)
    setLoading(false)
  }

  async function toggleFollow(profile) {
    const userId = profile.id
    if (following.has(userId)) {
      await supabase.from('follows').delete()
        .eq('follower_id', user.id)
        .eq('following_id', userId)
      setFollowing(prev => { const next = new Set(prev); next.delete(userId); return next })
      setFollowingProfiles(prev => prev.filter(p => p.id !== userId))
      if (profile.cluster === userCluster && recommended.length < 5) {
        setRecommended(prev => [...prev, profile])
      }
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: userId })
      setFollowing(prev => new Set([...prev, userId]))
      setFollowingProfiles(prev => [...prev, profile])
      setRecommended(prev => prev.filter(p => p.id !== userId))
    }
  }

  const clusterLabels = {
    adventurous: 'Adventurous explorer',
    comfort: 'Comfort seeker',
    fine_dining: 'Fine dining enthusiast',
    casual: 'Casual diner',
  }

  function PersonCard({ profile, isFollowing }) {
    return (
      <div onClick={() => profile.username && (window.location.href='/user/'+profile.username)} style={{background:'white',borderRadius:'16px',padding:'16px',marginBottom:'10px',boxShadow:'0 2px 12px rgba(26,23,20,0.07)',display:'flex',alignItems:'center',gap:'12px',cursor:profile.username?'pointer':'default'}}>
        <div style={{width:'40px',height:'40px',borderRadius:'50%',background:'#E8E0F5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:'500',color:'#3D2B4F',flexShrink:0}}>
          {profile.username ? profile.username.slice(0,2).toUpperCase() : '?'}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:'14px',fontWeight:'500',color:'#1A1714',marginBottom:'2px'}}>@{profile.username || 'unknown'}</div>
          <div style={{fontSize:'12px',color:'#9A928A'}}>{clusterLabels[profile.cluster] || 'Discovering their taste'}</div>
        </div>
        <button onClick={e => { e.stopPropagation(); toggleFollow(profile) }} style={{padding:'6px 14px',borderRadius:'8px',border:isFollowing?'1.5px solid #DDD6CC':'1.5px solid #3D2B4F',background:isFollowing?'transparent':'#3D2B4F',color:isFollowing?'#9A928A':'#F7F3EE',fontSize:'12px',fontFamily:'sans-serif',cursor:'pointer',fontWeight:'500',flexShrink:0}}>
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      </div>
    )
  }

  const showingSearchResults = query.length >= 2

  return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif',paddingBottom:'80px'}}>
      <div style={{background:'#3D2B4F',padding:'16px 24px'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'28px',color:'#F7F3EE',fontStyle:'italic',margin:0}}>palate</h1>
      </div>

      <div style={{padding:'12px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',background:'white',borderRadius:'12px',padding:'10px 14px',boxShadow:'0 2px 12px rgba(26,23,20,0.06)'}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A928A" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={query} onChange={e => search(e.target.value)} placeholder="Search by username..." style={{flex:1,border:'none',outline:'none',fontSize:'14px',fontFamily:'sans-serif',color:'#1A1714',background:'transparent'}} />
          {query.length > 0 && (
            <button onClick={() => { setQuery(''); setResults([]) }} style={{background:'none',border:'none',cursor:'pointer',color:'#9A928A',fontSize:'16px',lineHeight:1,padding:'0 2px'}}>✕</button>
          )}
        </div>
      </div>

      <div style={{padding:'0 16px'}}>
        {showingSearchResults ? (
          <>
            {loading && <div style={{padding:'20px',textAlign:'center',color:'#9A928A',fontSize:'14px'}}>Searching...</div>}
            {!loading && results.length === 0 && (
              <div style={{padding:'40px',textAlign:'center',color:'#9A928A',fontSize:'14px'}}>No users found matching "{query}"</div>
            )}
            {results.map(r => (
              <PersonCard key={r.id} profile={r} isFollowing={following.has(r.id)} />
            ))}
          </>
        ) : (
          <>
            {recommended.length > 0 && (
              <>
                <div style={{fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase',padding:'8px 0 10px'}}>Recommended for you</div>
                {recommended.map(r => (
                  <PersonCard key={r.id} profile={r} isFollowing={false} />
                ))}
              </>
            )}

            {followingProfiles.length > 0 && (
              <>
                <div style={{fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase',padding:'16px 0 10px'}}>Following</div>
                {followingProfiles.map(r => (
                  <PersonCard key={r.id} profile={r} isFollowing={true} />
                ))}
              </>
            )}

            {recommended.length === 0 && followingProfiles.length === 0 && (
              <div style={{padding:'40px 24px',textAlign:'center'}}>
                <div style={{fontSize:'32px',marginBottom:'12px'}}>👥</div>
                <p style={{fontSize:'14px',color:'#9A928A'}}>Search by username to find people to follow.</p>
              </div>
            )}
          </>
        )}
      </div>
      <NavBar active="people" />
    </main>
  )
} 