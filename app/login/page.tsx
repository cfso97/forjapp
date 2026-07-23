'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Login() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Correo o contraseña incorrectos.')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0F0F11', padding: '1rem',
    }}>
      <div style={{
        width: '100%', maxWidth: 360,
        background: '#18181C',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16, padding: '2rem 1.5rem',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#F0EFF4', margin: 0 }}>LifeOS</h1>
          <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Tu sistema personal</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Correo</label>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required autoFocus
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 9,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: '#F0EFF4', fontSize: 14,
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Contraseña</label>
            <input
              type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 9,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: '#F0EFF4', fontSize: 14,
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 13, color: '#E24B4A', background: 'rgba(226,75,74,0.1)', padding: '8px 12px', borderRadius: 8, margin: 0 }}>
              {error}
            </p>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              marginTop: 4, padding: '11px', borderRadius: 9, border: 'none',
              background: loading ? '#333' : '#534AB7',
              color: '#fff', fontSize: 14, fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p style={{ fontSize: 11, color: '#444', textAlign: 'center', marginTop: '1.5rem', lineHeight: 1.6 }}>
          Crea tu usuario en Supabase → Authentication → Users → Add user
        </p>
      </div>
    </div>
  )
}
