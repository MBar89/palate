'use client'

import { useState } from 'react'
import { createClient } from '../../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const supabase = createClient()

  async function handleLogin(e) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
    } else {
      window.location.href = '/'
    }
  }

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>palate</h1>
        <p style={styles.tagline}>restaurants people like you love</p>
        <form onSubmit={handleLogin} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <div style={{position:'relative'}}>
            <input
              style={{...styles.input, paddingRight:'44px', width:'100%'}}
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',padding:'4px',color:'#9A928A'}}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit">Log in →</button>
        </form>
        <p style={styles.footer}>No account yet? <a href="/signup" style={styles.link}>Sign up</a></p>
      </div>
    </main>
  )
}

const styles = {
  container: { minHeight:'100vh', background:'#3D2B4F', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif' },
  card: { background:'#F7F3EE', borderRadius:'24px', padding:'40px 32px', width:'100%', maxWidth:'380px' },
  logo: { fontFamily:'Georgia, serif', fontSize:'40px', color:'#3D2B4F', fontStyle:'italic', marginBottom:'4px' },
  tagline: { fontSize:'13px', color:'#9A928A', marginBottom:'28px' },
  form: { display:'flex', flexDirection:'column', gap:'12px' },
  input: { padding:'12px 14px', borderRadius:'12px', border:'1.5px solid #DDD6CC', fontSize:'14px', fontFamily:'sans-serif', outline:'none', boxSizing:'border-box' },
  button: { padding:'14px', borderRadius:'14px', background:'#3D2B4F', color:'#F7F3EE', border:'none', fontSize:'15px', fontWeight:'500', cursor:'pointer', marginTop:'4px' },
  error: { fontSize:'13px', color:'#A03020' },
  footer: { fontSize:'13px', color:'#9A928A', marginTop:'20px', textAlign:'center' },
  link: { color:'#3D2B4F', fontWeight:'500' },
}