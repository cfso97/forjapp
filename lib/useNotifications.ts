'use client'
import { useEffect } from 'react'

interface NotificationSchedule {
  id: string
  label: string
  hour: number
  minute: number
  days: number[] // 0=Sun..6=Sat, empty = every day
}

const SCHEDULE: NotificationSchedule[] = [
  { id: 'english',  label: '📚 English Live en 5 minutos',      hour: 6,  minute: 25, days: [1,2,3,4,5,6] },
  { id: 'ventas',   label: '💰 Sesión de ventas online en 5 min', hour: 18, minute: 55, days: [1,2,3,4] },
  { id: 'checkin',  label: '📊 Momento del check-in semanal',     hour: 18, minute: 0,  days: [0] },
  { id: 'gym',      label: '💪 Hora del gym',                     hour: 13, minute: 30, days: [1,3,5,6] },
]

function msUntilNext(hour: number, minute: number, days: number[]): number {
  const now = new Date()
  const candidates: number[] = []
  for (let d = 0; d < 14; d++) {
    const candidate = new Date(now)
    candidate.setDate(now.getDate() + d)
    candidate.setHours(hour, minute, 0, 0)
    if (candidate > now && (days.length === 0 || days.includes(candidate.getDay()))) {
      candidates.push(candidate.getTime() - now.getTime())
      break
    }
  }
  return candidates[0] ?? 0
}

export function useNotifications() {
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').catch(() => {})

    if (Notification.permission !== 'granted') return

    const timers: ReturnType<typeof setTimeout>[] = []

    SCHEDULE.forEach(item => {
      const ms = msUntilNext(item.hour, item.minute, item.days)
      if (!ms) return
      const t = setTimeout(() => {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification('LifeOS', {
            body: item.label,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: item.id,
          })
        })
      }, ms)
      timers.push(t)
    })

    return () => timers.forEach(clearTimeout)
  }, [])
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}
