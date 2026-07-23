'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useNotifications, requestNotificationPermission } from '@/lib/useNotifications'

const NAV = [
  { href: '/',          icon: '☀️',  label: 'Hoy' },
  { href: '/projects',  icon: '📁',  label: 'Proyectos' },
  { href: '/habits',    icon: '🔥',  label: 'Hábitos' },
  { href: '/routine',   icon: '📅',  label: 'Rutina' },
  { href: '/checkin',   icon: '📊',  label: 'Semanal' },
]

export default function Sidebar() {
  const path = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [notifGranted, setNotifGranted] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useNotifications()

  useEffect(() => {
    if ('Notification' in window) setNotifGranted(Notification.permission === 'granted')
  }, [])

  async function handleNotifToggle() {
    const granted = await requestNotificationPermission()
    setNotifGranted(granted)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const NavLinks = () => (
    <>
      {NAV.map(({ href, icon, label }) => {
        const active = path === href
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 9, textDecoration: 'none',
              fontSize: 14,
              background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
              color: active ? '#F0EFF4' : '#888',
              fontWeight: active ? 500 : 400,
              transition: 'all 0.1s',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
            <span>{label}</span>
          </Link>
        )
      })}
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside style={{
        width: 200, flexShrink: 0,
        background: '#18181C', borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', padding: '1rem 0.75rem',
      }} className="desktop-sidebar">
        <div style={{ padding: '4px 12px', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: 18, fontWeight: 500, color: '#F0EFF4' }}>⚡ LifeOS</span>
        </div>
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <NavLinks />
        </nav>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {!notifGranted && (
            <button onClick={handleNotifToggle} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 9, border: 'none',
              background: 'rgba(83,74,183,0.2)', color: '#AFA9EC',
              fontSize: 12, cursor: 'pointer', width: '100%', textAlign: 'left',
            }}>
              🔔 Activar alertas
            </button>
          )}
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 9, border: 'none',
            background: 'transparent', color: '#555', fontSize: 13, cursor: 'pointer', width: '100%',
          }}>
            ↩ Salir
          </button>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="mobile-nav">
        {NAV.map(({ href, icon, label }) => {
          const active = path === href
          return (
            <Link key={href} href={href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '8px 4px', textDecoration: 'none', flex: 1,
              color: active ? '#AFA9EC' : '#555', fontSize: 10, fontWeight: active ? 500 : 400,
            }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              {label}
            </Link>
          )
        })}
        <button onClick={handleLogout} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          padding: '8px 4px', flex: 1, background: 'none', border: 'none',
          color: '#555', fontSize: 10, cursor: 'pointer',
        }}>
          <span style={{ fontSize: 20 }}>↩</span>
          Salir
        </button>
      </nav>
    </>
  )
}
