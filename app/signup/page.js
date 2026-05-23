'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignUp(e) {
  e.preventDefault()
  setError(null)
  const params = new URLSearchParams(window.location.search)
  const inviteCode = params.get('invite')

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) {
    setError(error.message)
    return
  }

  if (inviteCode && data.user) {
    await supabase
      .from('invites')
      .update({ used_by: data.user.id })
      .eq('code', inviteCode)
  }

  setSuccess(true)
}

  if (success) return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>palate</h1>
        <p style={styles.message}>Check your email to confirm your account, then <a href="/login" style={styles.link}>log in</a>.</p>
      </div>
    </main>
  )

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>palate</h1>
        <p style={styles.tagline}>restaurants people like you love</p>
        <form onSubmit={handleSignUp} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit">Create account →</button>
        </form>
        <p style={styles.footer}>Already have an account? <a href="/login" style={styles.link}>Log in</a></p>
      </div>
    </main>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#3D2B4F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' },
  card: { background: '#F7F3EE', borderRadius: '24px', padding: '40px 32px', width: '100%', maxWidth: '380px' },
  logo: { fontFamily: 'Georgia, serif', fontSize: '40px', color: '#3D2B4F', fontStyle: 'italic', marginBottom: '4px' },
  tagline: { fontSize: '13px', color: '#9A928A', marginBottom: '28px' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
  input: { padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #DDD6CC', fontSize: '14px', fontFamily: 'sans-serif', outline: 'none' },
  button: { padding: '14px', borderRadius: '14px', background: '#3D2B4F', color: '#F7F3EE', border: 'none', fontSize: '15px', fontWeight: '500', cursor: 'pointer', marginTop: '4px' },
  error: { fontSize: '13px', color: '#A03020' },
  message: { fontSize: '14px', color: '#5A534E', lineHeight: '1.5' },
  footer: { fontSize: '13px', color: '#9A928A', marginTop: '20px', textAlign: 'center' },
  link: { color: '#3D2B4F', fontWeight: '500' },
}