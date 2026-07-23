'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Habit, HabitLog, DayModeRecord } from '@/lib/types'
import { habitWeekScore } from '@/lib/habitScore'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, subWeeks } from 'date-fns'
import { es } from 'date-fns/locale'

const MODE_LABEL: Record<string, string> = { green: '🟢 Verde', yellow: '🟡 Amarillo', red: '🔴 Rojo' }

export default function Checkin() {
  const supabase = createClient()
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [modes, setModes] = useState<DayModeRecord[]>([])
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)

  const weekStart = startOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const weekLabel = `${format(weekStart, "d 'de' MMM", { locale: es })} – ${format(weekEnd, "d 'de' MMM", { locale: es })}`

  useEffect(() => { loadWeek() }, [weekOffset])

  async function loadWeek() {
    setLoading(true)
    const startStr = format(weekStart, 'yyyy-MM-dd')
    const endStr = format(weekEnd, 'yyyy-MM-dd')

    const [habitsRes, logsRes, modesRes, checkinRes] = await Promise.all([
      supabase.from('habits').select('*').eq('active', true).order('position'),
      supabase.from('habit_logs').select('*').gte('date', startStr).lte('date', endStr),
      supabase.from('day_modes').select('*').gte('date', startStr).lte('date', endStr),
      supabase.from('weekly_checkins').select('note').eq('week_start', startStr).maybeSingle(),
    ])

    setHabits(habitsRes.data || [])
    setLogs(logsRes.data || [])
    setModes(modesRes.data || [])
    setNote(checkinRes.data?.note || '')
    setLoading(false)
    setSaved(false)
  }

  function getLog(habitId: string, date: string) {
    return logs.find(l => l.habit_id === habitId && l.date === date)
  }

  function habitScore(habit: Habit) {
    return habitWeekScore(habit, weekDays, logs.filter(l => l.habit_id === habit.id))
  }

  function modeCount(mode: string) {
    return modes.filter(m => m.mode === mode).length
  }

  async function saveCheckin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const startStr = format(weekStart, 'yyyy-MM-dd')
    const summary = Object.fromEntries(habits.map(h => [h.name, habitScore(h)]))
    await supabase.from('weekly_checkins').upsert({
      week_start: startStr, note, summary, user_id: user.id,
    }, { onConflict: 'user_id,week_start' })
    setSaved(true)
  }

  function buildReport() {
    const lines: string[] = [`Reporte semanal: ${weekLabel}\n`]
    lines.push(`Modos de día: ${modeCount('green')} verde · ${modeCount('yellow')} amarillo · ${modeCount('red')} rojo\n`)
    lines.push('Hábitos:')
    habits.forEach(h => {
      const s = habitScore(h)
      lines.push(`  ${h.name}: ${s.done} cumplido / ${s.partial} parcial / ${s.total - s.done - s.partial} saltado (${s.pct}%)`)
    })
    if (note) lines.push(`\nNotas: ${note}`)
    return lines.join('\n')
  }

  function sendToClaudeSite() {
    const report = buildReport()
    const encoded = encodeURIComponent(report)
    window.open(`https://claude.ai/new?q=${encoded}`, '_blank')
  }

  function copyReport() {
    navigator.clipboard.writeText(buildReport())
  }

  const STATUS_COLOR: Record<string, string> = { done: '#1D9E75', partial: '#EF9F27', skip: '#E24B4A' }
  const STATUS_CHAR: Record<string, string> = { done: '✓', partial: '~', skip: '✗' }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
      <span style={{ fontSize: 14 }}>Cargando semana...</span>
    </div>
  )

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Check-in semanal</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{weekLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setWeekOffset(w => w + 1)} style={{ padding: '6px 12px', borderRadius: 8, border: '0.5px solid var(--border-strong)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>← Anterior</button>
          {weekOffset > 0 && (
            <button onClick={() => setWeekOffset(0)} style={{ padding: '6px 12px', borderRadius: 8, border: '0.5px solid var(--border-strong)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Esta semana</button>
          )}
        </div>
      </div>

      {/* Modos del día */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['green','yellow','red'].map(m => (
          <div key={m} style={{ padding: '8px 16px', borderRadius: 10, border: '0.5px solid var(--border)', background: 'var(--surface-1)', fontSize: 13 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{MODE_LABEL[m]}</span>
            <span style={{ fontWeight: 500, marginLeft: 8, color: 'var(--text-primary)' }}>{modeCount(m)} días</span>
          </div>
        ))}
      </div>

      {/* Hábitos — tabla de la semana */}
      <div style={{ borderRadius: 12, border: '0.5px solid var(--border)', overflow: 'hidden', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(7, 1fr)', gap: 1, background: 'var(--border)' }}>
          {/* Headers */}
          <div style={{ background: 'var(--surface-1)', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>Hábito</div>
          {weekDays.map(d => (
            <div key={d.toISOString()} style={{ background: 'var(--surface-1)', padding: '8px 4px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              {format(d, 'EEE', { locale: es }).slice(0,2)}
            </div>
          ))}
          {/* Rows */}
          {habits.map(habit => {
            const score = habitScore(habit)
            return [
              <div key={`${habit.id}-label`} style={{ background: 'var(--surface-2)', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', borderLeft: `3px solid ${habit.color}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>{habit.icon}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.name}</span>
              </div>,
              ...weekDays.map(d => {
                const dateStr = format(d, 'yyyy-MM-dd')
                const applies = habit.days_of_week.includes(d.getDay())
                const log = getLog(habit.id, dateStr)
                return (
                  <div key={`${habit.id}-${dateStr}`} style={{
                    background: !applies ? 'var(--surface-0)' : log ? `${STATUS_COLOR[log.status]}22` : 'var(--surface-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 500,
                    color: log ? STATUS_COLOR[log.status] : 'transparent',
                  }}>
                    {applies ? (log ? STATUS_CHAR[log.status] : '·') : ''}
                  </div>
                )
              })
            ]
          })}
        </div>
      </div>

      {/* Barras de progreso */}
      <div style={{ borderRadius: 12, border: '0.5px solid var(--border)', padding: '1rem 1.25rem', background: 'var(--surface-1)', marginBottom: '1.5rem' }}>
        <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Resumen</p>
        {habits.map(habit => {
          const { done, partial, total, pct } = habitScore(habit)
          return (
            <div key={habit.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 120, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.name}</span>
              <div style={{ flex: 1, height: 6, background: 'var(--surface-0)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: habit.color, borderRadius: 4, transition: 'width 0.4s' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', width: 32, textAlign: 'right' }}>{pct}%</span>
            </div>
          )
        })}
      </div>

      {/* Notas */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Notas de la semana</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="¿Qué funcionó? ¿Qué fue difícil? ¿Días rojos y por qué? ¿Algo a cambiar la próxima semana?"
          style={{ width: '100%', minHeight: 100, padding: '10px 12px', borderRadius: 10, border: '0.5px solid var(--border-strong)', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical', lineHeight: 1.6 }}
        />
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={saveCheckin} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--text-primary)', color: 'var(--surface-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          {saved ? '✓ Guardado' : 'Guardar check-in'}
        </button>
        <button onClick={sendToClaudeSite} style={{ padding: '9px 18px', borderRadius: 9, border: '0.5px solid var(--border-strong)', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}>
          Enviar a Claude ↗
        </button>
        <button onClick={copyReport} style={{ padding: '9px 18px', borderRadius: 9, border: '0.5px solid var(--border-strong)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
          Copiar reporte
        </button>
      </div>
    </div>
  )
}
