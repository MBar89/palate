'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'

const ADMIN_EMAIL = 'myles@barhamaviation.co.uk'

export default function AdminPage() {
  const [pending, setPending] = useState([])
  const [approved, setApproved] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('pending')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [approvedSearch, setApprovedSearch] = useState('')
  const [users, setUsers] = useState([])
  const [usersLoaded, setUsersLoaded] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.email !== ADMIN_EMAIL) {
        window.location.href = '/'
        return
      }
      setUser(user)
      const [{ data: pend }, { data: appr }] = await Promise.all([
        supabase.from('restaurants').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('restaurants').select('*').eq('status', 'approved').order('name'),
      ])
      if (pend) setPending(pend)
      if (appr) setApproved(appr)
      setLoading(false)
    }
    load()
  }, [])

  async function adminAction(action, id) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ action, id }),
    })
    return res.ok
  }

  async function loadUsers() {
    if (usersLoaded) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin', { headers: { 'Authorization': `Bearer ${session.access_token}` } })
      const json = await res.json()
      setUsers(json.users || [])
    } catch (e) {
      console.error('loadUsers failed:', e)
    } finally {
      setUsersLoaded(true)
    }
  }

  async function approve(id) {
    const ok = await adminAction('approve', id)
    if (!ok) return
    const restaurant = pending.find(r => r.id === id)
    setPending(prev => prev.filter(r => r.id !== id))
    if (restaurant) setApproved(prev => [...prev, { ...restaurant, status: 'approved' }].sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function reject(id) {
    const ok = await adminAction('reject', id)
    if (ok) setPending(prev => prev.filter(r => r.id !== id))
  }

  async function deleteRestaurant(id) {
    setDeleting(true)
    const ok = await adminAction('delete', id)
    if (ok) setApproved(prev => prev.filter(r => r.id !== id))
    setDeleteConfirm(null)
    setDeleting(false)
  }

  if (!user) return null

  return (
    <main style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:'sans-serif',paddingBottom:'48px'}}>
      <div style={{background:'#3D2B4F',padding:'16px 24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'24px',color:'#F7F3EE',fontStyle:'italic',margin:0}}>Admin</h1>
        <button onClick={() => window.location.href='/'} style={{background:'transparent',border:'1.5px solid rgba(247,243,238,0.4)',color:'#F7F3EE',borderRadius:'8px',padding:'6px 14px',fontSize:'13px',cursor:'pointer'}}>Back to app</button>
      </div>

      <div style={{display:'flex',gap:'0',padding:'16px 16px 0',borderBottom:'1px solid #DDD6CC',marginBottom:'0'}}>
        <button onClick={() => setActiveTab('pending')} style={{padding:'8px 20px',borderRadius:'8px 8px 0 0',border:'none',background:activeTab==='pending'?'white':'transparent',color:activeTab==='pending'?'#1A1714':'#9A928A',fontSize:'13px',fontWeight:activeTab==='pending'?'500':'400',cursor:'pointer',fontFamily:'sans-serif',borderBottom:activeTab==='pending'?'2px solid #3D2B4F':'2px solid transparent',marginBottom:'-1px'}}>
          Pending {pending.length > 0 && <span style={{background:'#3D2B4F',color:'#F7F3EE',borderRadius:'20px',padding:'1px 7px',fontSize:'11px',marginLeft:'4px'}}>{pending.length}</span>}
        </button>
        <button onClick={() => setActiveTab('approved')} style={{padding:'8px 20px',borderRadius:'8px 8px 0 0',border:'none',background:activeTab==='approved'?'white':'transparent',color:activeTab==='approved'?'#1A1714':'#9A928A',fontSize:'13px',fontWeight:activeTab==='approved'?'500':'400',cursor:'pointer',fontFamily:'sans-serif',borderBottom:activeTab==='approved'?'2px solid #3D2B4F':'2px solid transparent',marginBottom:'-1px'}}>
          Approved ({approved.length})
        </button>
        <button onClick={() => { setActiveTab('users'); loadUsers() }} style={{padding:'8px 20px',borderRadius:'8px 8px 0 0',border:'none',background:activeTab==='users'?'white':'transparent',color:activeTab==='users'?'#1A1714':'#9A928A',fontSize:'13px',fontWeight:activeTab==='users'?'500':'400',cursor:'pointer',fontFamily:'sans-serif',borderBottom:activeTab==='users'?'2px solid #3D2B4F':'2px solid transparent',marginBottom:'-1px'}}>
          Users
        </button>
      </div>

      <div style={{padding:'16px'}}>
        {loading ? (
          <div style={{padding:'40px',textAlign:'center',color:'#9A928A'}}>Loading...</div>
        ) : activeTab === 'pending' ? (
          pending.length === 0 ? (
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
          )
        ) : (
          activeTab === 'users' ? (
          <>
            {!usersLoaded ? (
              <div style={{padding:'40px',textAlign:'center',color:'#9A928A'}}>Loading...</div>
            ) : (
              <>
                <div style={{fontSize:'12px',color:'#9A928A',marginBottom:'12px'}}>{users.length} users total · {users.filter(u => u.cluster).length} calibrated · {users.filter(u => u.review_count > 0).length} with reviews</div>
                {users.map(u => {
                  const isTest = u.email?.endsWith('@palate-test.com')
                  const initials = u.username ? u.username.slice(0,2).toUpperCase() : u.email?.slice(0,2).toUpperCase()
                  const clusterLabels = { adventurous:'Adventurous', comfort:'Comfort', fine_dining:'Fine dining', casual:'Casual' }
                  const joined = new Date(u.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
                  return (
                    <div key={u.id} style={{background:isTest?'#FAF8F5':'white',borderRadius:'16px',padding:'14px 16px',marginBottom:'8px',boxShadow:'0 2px 12px rgba(26,23,20,0.06)',display:'flex',alignItems:'center',gap:'12px',opacity:isTest?0.7:1}}>
                      <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'#E8E0F5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:'600',color:'#3D2B4F',flexShrink:0}}>{initials}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'2px'}}>
                          {u.username && <span style={{fontSize:'13px',fontWeight:'500',color:'#1A1714'}}>@{u.username}</span>}
                          {isTest && <span style={{fontSize:'10px',background:'#EDE8E1',color:'#9A928A',borderRadius:'4px',padding:'1px 5px'}}>test</span>}
                        </div>
                        <div style={{fontSize:'12px',color:'#9A928A',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.email}</div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        {u.cluster ? (
                          <div style={{fontSize:'11px',background:'#E8E0F5',color:'#3D2B4F',borderRadius:'6px',padding:'2px 7px',marginBottom:'3px',display:'inline-block'}}>{clusterLabels[u.cluster]}</div>
                        ) : (
                          <div style={{fontSize:'11px',color:'#DDD6CC',marginBottom:'3px'}}>Not calibrated</div>
                        )}
                        <div style={{fontSize:'11px',color:'#9A928A'}}>{u.review_count} review{u.review_count !== 1 ? 's' : ''} · {joined}</div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </>
          ) : (
          <>
            <input
              value={approvedSearch}
              onChange={e => setApprovedSearch(e.target.value)}
              placeholder="Search approved restaurants..."
              style={{width:'100%',padding:'11px 14px',borderRadius:'12px',border:'1.5px solid #DDD6CC',background:'white',fontSize:'14px',fontFamily:'sans-serif',color:'#1A1714',outline:'none',boxSizing:'border-box',marginBottom:'12px'}}
            />
            {approved.filter(r => r.name.toLowerCase().includes(approvedSearch.toLowerCase()) || r.neighbourhood?.toLowerCase().includes(approvedSearch.toLowerCase()) || r.cuisine?.toLowerCase().includes(approvedSearch.toLowerCase())).length === 0 ? (
              <div style={{padding:'48px 24px',textAlign:'center'}}>
                <p style={{fontSize:'14px',color:'#9A928A'}}>{approved.length === 0 ? 'No approved restaurants' : 'No results'}</p>
              </div>
            ) : (
            approved.filter(r => r.name.toLowerCase().includes(approvedSearch.toLowerCase()) || r.neighbourhood?.toLowerCase().includes(approvedSearch.toLowerCase()) || r.cuisine?.toLowerCase().includes(approvedSearch.toLowerCase())).map(r => (
              <div key={r.id} style={{background:'white',borderRadius:'16px',padding:'16px',marginBottom:'10px',boxShadow:'0 2px 12px rgba(26,23,20,0.07)'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'12px'}}>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:'Georgia,serif',fontSize:'17px',color:'#1A1714',marginBottom:'2px'}}>{r.name}</div>
                    <div style={{fontSize:'12px',color:'#9A928A'}}>{r.cuisine} · {r.neighbourhood} · {'£'.repeat(r.price_range)}</div>
                  </div>
                  {deleteConfirm === r.id ? (
                    <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                      <button onClick={() => deleteRestaurant(r.id)} disabled={deleting} style={{padding:'6px 12px',borderRadius:'8px',background:'#A03020',border:'none',color:'white',fontSize:'12px',fontWeight:'500',fontFamily:'sans-serif',cursor:'pointer'}}>
                        {deleting ? '...' : 'Confirm'}
                      </button>
                      <button onClick={() => setDeleteConfirm(null)} style={{padding:'6px 12px',borderRadius:'8px',background:'transparent',border:'1.5px solid #DDD6CC',color:'#9A928A',fontSize:'12px',fontFamily:'sans-serif',cursor:'pointer'}}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(r.id)} style={{padding:'6px 12px',borderRadius:'8px',background:'transparent',border:'1.5px solid #DDD6CC',color:'#9A928A',fontSize:'12px',fontFamily:'sans-serif',cursor:'pointer',flexShrink:0}}>Delete</button>
                  )}
                </div>
                {deleteConfirm === r.id && (
                  <div style={{marginTop:'10px',fontSize:'12px',color:'#A03020',background:'#F5E0DC',borderRadius:'8px',padding:'8px 10px'}}>
                    This will permanently delete the restaurant and all its reviews and saves.
                  </div>
                )}
              </div>
            ))
            )}
          </>
          )}
        )}
      </div>
    </main>
  )
}
