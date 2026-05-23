'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase'

export default function InvitePage() {
  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(true)
  const params = useParams()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('invites')
        .select('*')
        .eq('code', params.code)
        .single()
      setInvite(data)
      setLoading(false)
    }
    load()
  }, [params.code])

  const bgDark = {minHeight:'100vh',background:'#3D2B4F',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'sans-serif'}

  if (loading) return <main style={bgDark}><div style={{color:'#F7F3EE',fontSize:'14px',opacity:0.6}}>Loading...</div></main>

  if (!invite) return (
    <main style={bgDark}>
      <div style={{textAlign:'center',padding:'24px'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'40px',color:'#F7F3EE',fontStyle:'italic',marginBottom:'12px'}}>palate</h1>
        <p style={{color:'#F7F3EE',fontSize:'14px',opacity:0.6}}>This invite link is invalid or has expired.</p>
      </div>
    </main>
  )

  return (
    <main style={bgDark}>
      <div style={{textAlign:'center',padding:'32px 24px',maxWidth:'380px'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'48px',color:'#F7F3EE',fontStyle:'italic',marginBottom:'8px'}}>palate</h1>
        <p style={{color:'#F7F3EE',fontSize:'14px',marginBottom:'32px',letterSpacing:'0.05em',opacity:0.6}}>restaurants people like you love</p>
        <div style={{background:'rgba(255,255,255,0.08)',borderRadius:'16px',padding:'20px',marginBottom:'24px'}}>
          <p style={{color:'#F7F3EE',fontSize:'14px',lineHeight:'1.5',opacity:0.8}}>You have been invited to join palate — taste-matched restaurant recommendations from people who eat like you.</p>
        </div>
        <button onClick={() => window.location.href='/signup?invite=' + params.code} style={{width:'100%',padding:'14px',borderRadius:'14px',background:'#F7F3EE',color:'#3D2B4F',border:'none',fontSize:'15px',fontWeight:'500',cursor:'pointer',marginBottom:'12px'}}>
          Accept invite
        </button>
        <p style={{color:'#F7F3EE',fontSize:'12px',opacity:0.4}}>Already have an account? <a href="/login" style={{color:'#F7F3EE',opacity:0.7}}>Log in</a></p>
      </div>
    </main>
  )
}
