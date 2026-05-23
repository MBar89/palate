'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'

const ADMIN_EMAIL = 'myles@barhamaviation.co.uk'

export default function AdminPage() {
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.email !== ADMIN_EMAIL) {
        window.location.href = '/'
        return
      }
      setUser(user)
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (data) setPending(data)
      setLoading(false)
    }
    load()
  }, [])

  async function approve(id) {
    await supabase.from('restaurants').update({ status: 'approved' }).eq('id', id)
    setPending(prev => prev.filter(r => r.id !== id))
  }

  async function reject(id) {
    await supabase.from('restaurants').update({ status: 'rejected' }).eq('id', id)
    setPending(prev => prev.filter(r => r.id !== id))
  }

  if (!user) return null

  return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif',paddingBottom:'48px'}}>
      <div style={{background:'#3D2B4F',padding:'16px 24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'24px',color:'#F7F3EE',fontStyle:'italic',margin:0}}>Admin</h1>
        <button onClick={() => window.location.href='/'} style={{background:'transparent',border:'1.5px solid rgba(247,243,238,0.4)',color:'#F7F3EE',borderRadius:'8px',padding:'6px 14px',fontSize:'13px',cursor:'pointer'}}>Back to app</button>
      </div>
      <div style={{padding:'16px 16px 8px',fontSize:'11px',fontWeight:'500',color:'#9A928A',letterSpacing:'0.08em',textTransform:'uppercase'}}>
        Pending submissions — {pending.length} to review
      </div>
      <div style={{padding:'0 16px'}}>
        {loading ? (
          <div style={{padding:'40px',textAlign:'center',color:'#9A928A'}}>Loading...</div>
        ) : pending.length === 0 ? (
          <div style={{padding:'48px 24px',textAlign:'center'}}>
            <div style={{fontSize:'32px',marginBottom:'12px'}}>✓</div>
            <p style={{fontSize:'14px',color:'#9A928A'}}>No pending submissions</p>
          </div>
        ) : (
          pending.map(r => (
            <div key={r.id} style={{background:'white',borderRadius:'16px',padding:'16px',marginBottom:'10px',boxShadow:'0 2px 12px rgba(26,23,20,0.07)'}}>
              <div style={{fontFamily:'Georgia,serif',fontSize:'18px',color:'#1A1714',marginBottom:'2px'}}>{r.name}</div>
              <div style={{fontSize:'12px',color:'#9A928A',marginBottom:'12px'}}>{r.cuisine} · {r.neighbourhood} · {'£'.repeat(r.price_range)}</div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={() => approve(r.id)} style={{flex:1,padding:'10px',borderRadius:'10px',background:'#DCF0E6',border:'1.5px solid #2A6B4F',color:'#2A6B4F',fontSize:'13px',fontWeight:'500',fontFamily:'sans-serif',cursor:'pointer'}}>Approve</button>
                <button onClick={() => reject(r.id)} style={{flex:1,padding:'10px',borderRadius:'10px',background:'#F5E0DC',border:'1.5px solid #A03020',color:'#A03020',fontSize:'13px',fontWeight:'500',fontFamily:'sans-serif',cursor:'pointer'}}>Reject</button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  )
}