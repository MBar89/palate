'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import NavBar from '../../components/NavBar'

export default function PeoplePage() {
  const [user, setUser] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [following, setFollowing] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
      if (follows) setFollowing(new Set(follows.map(f => f.following_id)))
    }
    load()
  }, [])

  async function search(q) {
  setQuery(q)
  if (!q || q.length < 3) { setResults([]); return }
  setLoading(true)
  const { data, error } = await supabase
    .from('profiles')
    .select('id, cluster')
    .neq('id', user?.id)
    .not('cluster', 'is', null)
    .limit(20)
  console.log('Search results:', data, 'Error:', error, 'Current user:', user?.id)
  if (data) setResults(data)
  setLoading(false)
}

  async function toggleFollow(userId) {
    if (following.has(userId)) {
      await supabase.from('follows').delete()
        .eq('follower_id', user.id)
        .eq('following_id', userId)
      setFollowing(prev => { const next = new Set(prev); next.delete(userId); return next })
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: userId })
      setFollowing(prev => new Set([...prev, userId]))
    }
  }

  const clusterLabels = {
    adventurous: 'Adventurous explorer',
    comfort: 'Comfort seeker',
    fine_dining: 'Fine dining enthusiast',
    casual: 'Casual diner',
  }

  return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif',paddingBottom:'80px'}}>
      <div style={{background:'#3D2B4F',padding:'16px 24px'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'28px',color:'#F7F3EE',fontStyle:'italic',margin:0}}>palate</h1>
      </div>

      <div style={{padding:'12px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',background:'white',borderRadius:'12px',padding:'10px 14px',boxShadow:'0 2px 12px rgba(26,23,20,0.06)'}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A928A" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={query} onChange={e => search(e.target.value)} placeholder="Search for people..." style={{flex:1,border:'none',outline:'none',fontSize:'14px',fontFamily:'sans-serif',color:'#1A1714',background:'transparent'}} />
        </div>
      </div>

      <div style={{padding:'0 16px'}}>
        {loading && <div style={{padding:'20px',textAlign:'center',color:'#9A928A',fontSize:'14px'}}>Searching...</div>}

        {!loading && query.length >= 3 && results.length === 0 && (
          <div style={{padding:'40px',textAlign:'center',color:'#9A928A',fontSize:'14px'}}>No people found</div>
        )}

        {!loading && query.length < 3 && (
          <div style={{padding:'40px 24px',textAlign:'center'}}>
            <div style={{fontSize:'32px',marginBottom:'12px'}}>👥</div>
            <p style={{fontSize:'14px',color:'#9A928A'}}>Search for people to follow and see what they love.</p>
          </div>
        )}

        {results.map(r => (
          <div key={r.id} style={{background:'white',borderRadius:'16px',padding:'16px',marginBottom:'10px',boxShadow:'0 2px 12px rgba(26,23,20,0.07)',display:'flex',alignItems:'center',gap:'12px'}}>
            <div style={{width:'40px',height:'40px',borderRadius:'50%',background:'#E8E0F5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:'500',color:'#3D2B4F',flexShrink:0}}>
              {r.id.substring(0,2).toUpperCase()}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:'14px',fontWeight:'500',color:'#1A1714',marginBottom:'2px'}}>palate user</div>
              <div style={{fontSize:'12px',color:'#9A928A'}}>{clusterLabels[r.cluster] || 'Discovering their taste'}</div>
            </div>
            <button onClick={() => toggleFollow(r.id)} style={{padding:'6px 14px',borderRadius:'8px',border: following.has(r.id) ? '1.5px solid #DDD6CC' : '1.5px solid #3D2B4F',background: following.has(r.id) ? 'transparent' : '#3D2B4F',color: following.has(r.id) ? '#9A928A' : '#F7F3EE',fontSize:'12px',fontFamily:'sans-serif',cursor:'pointer',fontWeight:'500'}}>
              {following.has(r.id) ? 'Following' : 'Follow'}
            </button>
          </div>
        ))}
      </div>
      <NavBar active="people" />
    </main>
  )
}