'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

export default function HomePage() {
  const [restaurants, setRestaurants] = useState([])
  const [user, setUser] = useState(null)
  const supabase = createClient()

  useEffect(() => {
  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/login'
      return
    }
    setUser(user)
    const { data } = await supabase.from('restaurants').select('*').limit(20)
    if (data) setRestaurants(data)
  }
  load()
}, [])

  return (
    <main style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.logo}>palate</h1>
        {user && <button onClick={handleSignOut} style={styles.signOut}>Sign out</button>}
      </div>
      <p style={styles.welcome}>Welcome{user ? `, ${user.email}` : ''}. Here are some restaurants for you.</p>
      <div style={styles.list}>
        {restaurants.map(r => (
          <div key={r.id} style={styles.card}>
            <div style={styles.cardName}>{r.name}</div>
            <div style={styles.cardMeta}>{r.cuisine} · {r.neighbourhood} · {'£'.repeat(r.price_range)}</div>
          </div>
        ))}
      </div>
    </main>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#F7F3EE', fontFamily: 'sans-serif', padding: '0 0 48px' },
  header: { background: '#3D2B4F', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontFamily: 'Georgia, serif', fontSize: '28px', color: '#F7F3EE', fontStyle: 'italic', margin: 0 },
  signOut: { background: 'transparent', border: '1.5px solid rgba(247,243,238,0.4)', color: '#F7F3EE', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer' },
  welcome: { fontSize: '14px', color: '#5A534E', padding: '20px 24px 8px' },
  list: { padding: '0 16px' },
card: { background: 'white', borderRadius: '16px', padding: '16px', marginBottom: '10px', boxShadow: '0 2px 12px rgba(26,23,20,0.06)' },
cardName: { fontFamily: 'Georgia, serif', fontSize: '18px', color: '#1A1714', marginBottom: '4px' },
  cardMeta: { fontSize: '12px', color: '#9A928A' },
}