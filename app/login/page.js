'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
    } else {
      router.push('/')
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
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit">Log in →</button>
        </form>
        <p style={styles.footer}>No account yet? <a href="/signup" style={styles.link}>Sign up</a></p>
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
  footer: { fontSize: '13px', color: '#9A928A', marginTop: '20px', textAlign: 'center' },
  link: { color: '#3D2B4F', fontWeight: '500' },
}