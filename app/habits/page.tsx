'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Habit, HabitLog, HabitFrequencyType, QuantityUnit } from '@/lib/types'
import { habitWeekScore, habitWeeklyStreak, habitWeeklyBars } from '@/lib/habitScore'
import { format, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, Trash2, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'

const DAYS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0] // día de la semana (0=dom..6=sáb) en el mismo orden que DAYS
const WEEK_LABELS = ['L','M','X','J','V','S','D']
const COLORS = ['#534AB7','#1D9E75','#185FA5','#D4537E','#BA7517','#993C1D','#0F6E56','#E24B4A']
const ICONS = ['💪','📚','🏃','📱','💼','🎯','🧘','💊','✍️','🎵','🌿','⚡']
const FREQUENCY_OPTIONS: { value: HabitFrequencyType; label: string }[] = [
  { value: 'specific_days', label: 'Días fijos' },
  { value: 'per_week', label: 'X veces/semana' },
  { value: 'quantity', label: 'Cantidad/semana' },
]

// Cuántas semanas atrás se pueden navegar/consultar (racha, barras, calendario)
const HISTORY_WEEKS = 52

const initialForm = {
  name: '',
  icon: ICONS[0],
  color: COLORS[0],
  days_of_week: [1, 2, 3, 4, 5] as number[],
  is_minimum: false,
  frequency_type: 'specific_days' as HabitFrequencyType,
  target_per_week: 3,
  preferred_days: [] as number[],
  quantity_unit: 'min' as QuantityUnit,
  quantity_target: 60,
}

function barColor(pct: number) {
  return pct >= 80 ? '#1D9E75' : pct >= 50 ? '#EF9F27' : '#E24B4A'
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-2)' }}>
      <span className="inline-block rounded-full" style={{ width: 7, height: 7, background: color, flexShrink: 0 }} />
      {label}
    </span>
  )
}

export default function Habits() {
  const supabase = createClient()
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [adding, setAdding] = useState(false)
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null)
  const [editOriginalType, setEditOriginalType] = useState<HabitFrequencyType | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(initialForm)
  const [weekOffset, setWeekOffset] = useState<Record<string, number>>({})
  const [qtyEditing, setQtyEditing] = useState<{ habitId: string; date: string } | null>(null)
  const [qtyValue, setQtyValue] = useState('')
  const [formError, setFormError] = useState('')

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const startDate = format(subWeeks(today, HISTORY_WEEKS), 'yyyy-MM-dd')
    const [habitsRes, logsRes] = await Promise.all([
      supabase.from('habits').select('*').eq('active', true).order('position'),
      supabase.from('habit_logs').select('*').gte('date', startDate),
    ])
    setHabits(habitsRes.data || [])
    setLogs(logsRes.data || [])
    setLoading(false)
  }

  function getLog(habitId: string, date: string) {
    return logs.find(l => l.habit_id === habitId && l.date === date)
  }

  function getStatusColor(status?: string) {
    if (!status) return 'var(--bg-3)'
    return status === 'done' ? '#1D9E75' : status === 'partial' ? '#EF9F27' : '#E24B4A33'
  }

  async function cycleLog(habit: Habit, dateStr: string) {
    const current = getLog(habit.id, dateStr)
    const CYCLE: Array<HabitLog['status'] | null> = [null, 'done', 'partial', 'skip']
    const idx = CYCLE.indexOf(current?.status ?? null)
    const next = CYCLE[(idx + 1) % CYCLE.length]

    if (!next) {
      if (current) {
        const { error } = await supabase.from('habit_logs').delete().eq('id', current.id)
        if (error) { console.error('Error al borrar log:', error); return }
        setLogs(l => l.filter(x => x.id !== current.id))
      }
    } else if (current) {
      const { error } = await supabase.from('habit_logs').update({ status: next }).eq('id', current.id)
      if (error) { console.error('Error al actualizar log:', error); return }
      setLogs(l => l.map(x => x.id === current.id ? { ...x, status: next } : x))
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('habit_logs').insert({ habit_id: habit.id, date: dateStr, status: next, user_id: user.id }).select().single()
      if (error) { console.error('Error al crear log:', error); return }
      if (data) setLogs(l => [...l, data])
    }
  }

  function openQtyEditor(habit: Habit, dateStr: string) {
    const current = getLog(habit.id, dateStr)
    setQtyEditing({ habitId: habit.id, date: dateStr })
    setQtyValue(current?.quantity_logged ? String(current.quantity_logged) : '')
  }

  async function submitQuantity(habit: Habit, dateStr: string) {
    const n = Number(qtyValue)
    const current = getLog(habit.id, dateStr)
    if (!qtyValue || isNaN(n) || n <= 0) {
      if (current) {
        const { error } = await supabase.from('habit_logs').delete().eq('id', current.id)
        if (error) console.error('Error al borrar log de cantidad:', error)
        else setLogs(l => l.filter(x => x.id !== current.id))
      }
    } else if (current) {
      const { error } = await supabase.from('habit_logs').update({ quantity_logged: n, status: 'done' }).eq('id', current.id)
      if (error) console.error('Error al actualizar cantidad:', error)
      else setLogs(l => l.map(x => x.id === current.id ? { ...x, quantity_logged: n, status: 'done' } : x))
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('habit_logs').insert({ habit_id: habit.id, date: dateStr, status: 'done', quantity_logged: n, user_id: user.id }).select().single()
      if (error) console.error('Error al crear log de cantidad:', error)
      if (data) setLogs(l => [...l, data])
    }
    setQtyEditing(null)
    setQtyValue('')
  }

  function startEditHabit(habit: Habit) {
    setEditingHabitId(habit.id)
    setEditOriginalType(habit.frequency_type || 'specific_days')
    setForm({
      name: habit.name,
      icon: habit.icon,
      color: habit.color,
      days_of_week: habit.days_of_week,
      is_minimum: habit.is_minimum,
      frequency_type: habit.frequency_type || 'specific_days',
      target_per_week: habit.target_per_week || 3,
      preferred_days: habit.preferred_days || [1, 2, 3, 4, 5],
      quantity_unit: habit.quantity_unit || 'min',
      quantity_target: habit.quantity_target || 60,
    })
    setFormError('')
    setAdding(true)
  }

  function closeForm() {
    setAdding(false)
    setEditingHabitId(null)
    setEditOriginalType(null)
    setForm(initialForm)
    setFormError('')
  }

  async function saveHabit() {
    if (!form.name.trim()) {
      setFormError('Ponle un nombre al hábito')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setFormError('No se detectó sesión activa. Volvé a iniciar sesión.')
      return
    }

    const payload = {
      name: form.name.trim(),
      icon: form.icon,
      color: form.color,
      is_minimum: form.is_minimum,
      frequency_type: form.frequency_type,
      days_of_week: form.frequency_type === 'specific_days' ? form.days_of_week : [0, 1, 2, 3, 4, 5, 6],
      target_per_week: form.frequency_type === 'per_week' ? form.target_per_week : null,
      preferred_days: form.frequency_type === 'per_week' ? form.preferred_days : null,
      quantity_unit: form.frequency_type === 'quantity' ? form.quantity_unit : null,
      quantity_target: form.frequency_type === 'quantity' ? form.quantity_target : null,
    }

    const switchingToQuantity = editingHabitId && editOriginalType && editOriginalType !== 'quantity' && form.frequency_type === 'quantity'
    if (switchingToQuantity) {
      const habitLogs = logs.filter(l => l.habit_id === editingHabitId)
      if (habitLogs.length > 0) {
        const confirmed = window.confirm(
          `Cambiar este hábito a "Cantidad/semana" borrará los ${habitLogs.length} registro${habitLogs.length === 1 ? '' : 's'} anteriores, porque no son compatibles con el nuevo formato. ¿Continuar?`
        )
        if (!confirmed) return
        const { error: deleteError } = await supabase.from('habit_logs').delete().eq('habit_id', editingHabitId)
        if (deleteError) {
          console.error('Error al borrar registros anteriores:', deleteError)
          setFormError(deleteError.message)
          return
        }
        setLogs(l => l.filter(x => x.habit_id !== editingHabitId))
      }
    }

    if (editingHabitId) {
      const { data, error } = await supabase.from('habits').update(payload).eq('id', editingHabitId).select().single()
      if (error) {
        console.error('Error al actualizar hábito:', error)
        setFormError(error.message)
        return
      }
      if (data) setHabits(h => h.map(x => x.id === editingHabitId ? data : x))
    } else {
      const { data, error } = await supabase.from('habits').insert({ ...payload, position: habits.length, user_id: user.id }).select().single()
      if (error) {
        console.error('Error al guardar hábito:', error)
        setFormError(error.message)
        return
      }
      if (data) setHabits(h => [...h, data])
    }

    closeForm()
  }

  async function deleteHabit(id: string) {
    await supabase.from('habits').update({ active: false }).eq('id', id)
    setHabits(h => h.filter(x => x.id !== id))
  }

  function toggleDay(d: number) {
    setForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(d)
        ? f.days_of_week.filter(x => x !== d)
        : [...f.days_of_week, d]
    }))
  }

  function togglePreferredDay(d: number) {
    setForm(f => {
      if (f.preferred_days.includes(d)) {
        return { ...f, preferred_days: f.preferred_days.filter(x => x !== d) }
      }
      if (f.preferred_days.length >= (f.target_per_week || 0)) return f
      return { ...f, preferred_days: [...f.preferred_days, d] }
    })
  }

  function shiftWeek(habitId: string, delta: number) {
    setWeekOffset(w => {
      const current = w[habitId] || 0
      const next = Math.max(0, Math.min(HISTORY_WEEKS, current + delta))
      return { ...w, [habitId]: next }
    })
  }

  function displayWeek(habitId: string) {
    const offset = weekOffset[habitId] || 0
    const start = startOfWeek(subWeeks(today, offset), { weekStartsOn: 1 })
    const end = endOfWeek(start, { weekStartsOn: 1 })
    return { offset, start, end, days: eachDayOfInterval({ start, end }) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-3)' }}>
      <span className="text-sm">Cargando hábitos...</span>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Hábitos</h1>
        <button onClick={() => { setForm(initialForm); setEditingHabitId(null); setEditOriginalType(null); setAdding(true); setFormError('') }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
        >
          <Plus size={14} /> Nuevo hábito
        </button>
      </div>

      {/* Formulario hábito (modal) */}
      {adding && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-backdrop"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={closeForm}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="modal-sheet w-full sm:max-w-md sm:mx-4 rounded-t-2xl sm:rounded-2xl overflow-y-auto p-4 h-[70vh] sm:h-auto sm:max-h-[85vh]"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
          >
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {editingHabitId ? 'Editar hábito' : 'Nuevo hábito'}
          </p>
          <div className="flex gap-3 mb-4">
            <select value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
              className="bg-transparent border rounded px-2 py-1.5 text-sm"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              {ICONS.map(i => <option key={i}>{i}</option>)}
            </select>
            <input autoFocus value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && saveHabit()}
              placeholder="Nombre del hábito"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ borderBottom: '1px solid var(--border-2)', color: 'var(--text)' }}
            />
          </div>
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {COLORS.map(c => (
              <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                className="w-5 h-5 rounded-full transition-all"
                style={{ background: c, outline: form.color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
              />
            ))}
          </div>

          {/* Tipo de frecuencia */}
          <div className="flex gap-1.5 mb-4">
            {FREQUENCY_OPTIONS.map(opt => (
              <button key={opt.value} type="button"
                onClick={() => setForm(f => ({ ...f, frequency_type: opt.value }))}
                className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: form.frequency_type === opt.value ? form.color : 'var(--bg-3)',
                  color: form.frequency_type === opt.value ? 'white' : 'var(--text-3)',
                }}
              >{opt.label}</button>
            ))}
          </div>

          {editingHabitId && editOriginalType && editOriginalType !== 'quantity' && form.frequency_type === 'quantity' && (
            (() => {
              const count = logs.filter(l => l.habit_id === editingHabitId).length
              return count > 0 ? (
                <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ color: '#EF9F27', background: '#EF9F2718' }}>
                  ⚠ Al guardar se borrarán los {count} registro{count === 1 ? '' : 's'} anteriores de este hábito, porque no son compatibles con "Cantidad/semana".
                </p>
              ) : null
            })()
          )}

          {form.frequency_type === 'specific_days' && (
            <div className="flex gap-1 mb-4">
              {DAYS.map((d, i) => {
                const dayValue = DAY_VALUES[i]
                return (
                  <button key={dayValue} type="button" onClick={() => toggleDay(dayValue)}
                    className="w-8 h-8 rounded text-xs font-medium transition-all"
                    style={{
                      background: form.days_of_week.includes(dayValue) ? form.color : 'var(--bg-3)',
                      color: form.days_of_week.includes(dayValue) ? 'white' : 'var(--text-3)',
                    }}
                  >{d}</button>
                )
              })}
            </div>
          )}

          {form.frequency_type === 'per_week' && (
            <>
              <div className="mb-3">
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-3)' }}>Veces por semana</label>
                <input type="number" min={1} max={7} value={form.target_per_week}
                  onChange={e => {
                    const n = Number(e.target.value)
                    setForm(f => ({ ...f, target_per_week: n, preferred_days: f.preferred_days.slice(0, n) }))
                  }}
                  className="bg-transparent border rounded px-2 py-1.5 text-sm w-20"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div className="mb-4">
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-3)' }}>Recordatorio en días específicos (opcional)</label>
                <p className="text-xs mb-2" style={{ color: 'var(--text-3)', opacity: 0.7 }}>
                  No es obligatorio elegir nada acá: cualquier día que lo completes cuenta para tu meta. Podés marcar hasta {form.target_per_week || 0} día{form.target_per_week === 1 ? '' : 's'} como recordatorio ({form.preferred_days.length}/{form.target_per_week || 0} elegidos).
                </p>
                <div className="flex gap-1">
                  {DAYS.map((d, i) => {
                    const dayValue = DAY_VALUES[i]
                    const selected = form.preferred_days.includes(dayValue)
                    const atLimit = !selected && form.preferred_days.length >= (form.target_per_week || 0)
                    return (
                      <button key={dayValue} type="button" onClick={() => togglePreferredDay(dayValue)}
                        disabled={atLimit}
                        className="w-8 h-8 rounded text-xs font-medium transition-all"
                        style={{
                          background: selected ? form.color : 'var(--bg-3)',
                          color: selected ? 'white' : 'var(--text-3)',
                          opacity: atLimit ? 0.4 : 1,
                          cursor: atLimit ? 'default' : 'pointer',
                        }}
                      >{d}</button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {form.frequency_type === 'quantity' && (
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-3)' }}>Meta semanal</label>
                <input type="number" min={1} value={form.quantity_target}
                  onChange={e => setForm(f => ({ ...f, quantity_target: Number(e.target.value) }))}
                  className="bg-transparent border rounded px-2 py-1.5 text-sm w-full"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-3)' }}>Unidad</label>
                <select value={form.quantity_unit}
                  onChange={e => setForm(f => ({ ...f, quantity_unit: e.target.value as QuantityUnit }))}
                  className="bg-transparent border rounded px-2 py-1.5 text-sm"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  <option value="min">min</option>
                  <option value="reps">reps</option>
                </select>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, is_minimum: !f.is_minimum }))}
            className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg w-full text-left transition-all"
            style={{ background: form.is_minimum ? '#E24B4A18' : 'var(--bg-3)' }}
          >
            <span
              className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
              style={{ background: form.is_minimum ? '#E24B4A' : 'transparent', border: `1.5px solid ${form.is_minimum ? '#E24B4A' : 'var(--border-2)'}` }}
            >
              {form.is_minimum && <span style={{ color: 'white', fontSize: 10, lineHeight: 1 }}>✓</span>}
            </span>
            <span className="text-xs" style={{ color: form.is_minimum ? '#E24B4A' : 'var(--text-2)' }}>
              Hábito mínimo (modo rojo)
            </span>
          </button>
          {formError && (
            <p className="text-xs mb-2" style={{ color: '#E24B4A' }}>Error al guardar: {formError}</p>
          )}
          <div className="flex gap-2">
            <button onClick={saveHabit}
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={{ background: form.color, color: 'white' }}
            >{editingHabitId ? 'Guardar cambios' : 'Crear'}</button>
            <button onClick={closeForm}
              className="px-3 py-1.5 rounded text-xs"
              style={{ color: 'var(--text-3)' }}
            >Cancelar</button>
          </div>
          </div>
        </div>
      )}

      {/* Leyenda de colores */}
      {habits.length > 0 && (
        <div className="rounded-xl px-4 py-3 mb-5 flex flex-wrap items-center gap-x-6 gap-y-2.5"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Días</span>
            <LegendItem color="#1D9E75" label="Hecho" />
            <LegendItem color="#EF9F27" label="Parcial" />
            <LegendItem color="#E24B4A" label="Saltado" />
          </div>
          <div className="hidden sm:block" style={{ width: 1, height: 14, background: 'var(--border)' }} />
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tendencia semanal</span>
            <LegendItem color="#1D9E75" label="≥80%" />
            <LegendItem color="#EF9F27" label="50–79%" />
            <LegendItem color="#E24B4A" label="<50%" />
          </div>
        </div>
      )}

      {/* Lista de hábitos */}
      <div className="space-y-4">
        {habits.map(habit => {
          const logsForHabit = logs.filter(l => l.habit_id === habit.id)
          const streak = habitWeeklyStreak(habit, logsForHabit, today, 1)
          const currentWeekDays = eachDayOfInterval({ start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) })
          const currentScore = habitWeekScore(habit, currentWeekDays, logsForHabit)
          const bars = habitWeeklyBars(habit, logsForHabit, today, 8, 1)
          const { offset, days } = displayWeek(habit.id)
          const monthLabel = (() => {
            const label = format(days[3], 'MMMM yyyy', { locale: es })
            return label.charAt(0).toUpperCase() + label.slice(1)
          })()
          const isQuantity = habit.frequency_type === 'quantity'
          const footerText = habit.frequency_type === 'per_week'
            ? `${currentScore.done}/${currentScore.total} sesiones esta semana (${currentScore.pct}%)`
            : isQuantity
              ? `${currentScore.done}/${currentScore.total} ${habit.quantity_unit === 'reps' ? 'reps' : 'min'} esta semana (${currentScore.pct}%)`
              : `${currentScore.done}/${currentScore.total} días esta semana (${currentScore.pct}%)`

          return (
            <div key={habit.id} className="rounded-xl p-4"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 18 }}>{habit.icon}</span>
                  <span className="text-sm font-medium" style={{ color: habit.color }}>{habit.name}</span>
                  {streak > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded"
                      style={{ background: `${habit.color}20`, color: habit.color }}
                    >🔥 {streak} {streak === 1 ? 'semana' : 'semanas'}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEditHabit(habit)} className="opacity-30 hover:opacity-70">
                    <Pencil size={13} style={{ color: 'var(--text-2)' }} />
                  </button>
                  <button onClick={() => deleteHabit(habit.id)} className="opacity-30 hover:opacity-70">
                    <Trash2 size={13} style={{ color: 'var(--text-2)' }} />
                  </button>
                </div>
              </div>

              {/* Calendario semanal navegable */}
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={() => shiftWeek(habit.id, 1)}
                  className="p-1 rounded hover:opacity-70 transition-opacity" style={{ color: 'var(--text-2)' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{monthLabel}</span>
                <button type="button" onClick={() => shiftWeek(habit.id, -1)} disabled={offset === 0}
                  className="p-1 rounded transition-opacity"
                  style={{ color: 'var(--text-2)', opacity: offset === 0 ? 0.25 : 1, cursor: offset === 0 ? 'default' : 'pointer' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEK_LABELS.map((d, i) => (
                  <div key={i} className="text-center text-[10px]" style={{ color: 'var(--text-3)' }}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map(d => {
                  const dateStr = format(d, 'yyyy-MM-dd')
                  const isToday = dateStr === todayStr
                  const future = dateStr > todayStr
                  const appliesDay = habit.frequency_type === 'specific_days'
                    ? habit.days_of_week.includes(d.getDay())
                    : habit.frequency_type === 'per_week'
                      ? (!habit.preferred_days || habit.preferred_days.length === 0 || habit.preferred_days.includes(d.getDay()))
                      : true
                  const clickable = appliesDay && !future
                  const log = getLog(habit.id, dateStr)
                  return (
                    <button
                      key={dateStr}
                      type="button"
                      disabled={!clickable}
                      onClick={() => {
                        if (!clickable) return
                        isQuantity ? openQtyEditor(habit, dateStr) : cycleLog(habit, dateStr)
                      }}
                      title={
                        isQuantity && log?.quantity_logged
                          ? `${format(d, 'EEE d MMM', { locale: es })}: ${log.quantity_logged} ${habit.quantity_unit || ''}`
                          : format(d, 'EEE d MMM', { locale: es })
                      }
                      className="flex items-center justify-center rounded-full transition-all mx-auto"
                      style={{
                        width: 32, height: 32,
                        background: log?.status ? getStatusColor(log.status) : (isToday ? `${habit.color}25` : 'transparent'),
                        border: !appliesDay ? 'none' : isToday ? `3px solid ${habit.color}` : '1px solid var(--border-2)',
                        opacity: !appliesDay ? 0.25 : future ? 0.3 : 1,
                        color: log?.status === 'done' || log?.status === 'partial' ? 'white' : 'var(--text)',
                        cursor: clickable ? 'pointer' : 'default',
                        fontSize: 12,
                        fontWeight: isToday ? 600 : 400,
                      }}
                    >
                      {d.getDate()}
                    </button>
                  )
                })}
              </div>

              {/* Input de cantidad para hábitos tipo "quantity" */}
              {qtyEditing?.habitId === habit.id && (
                <div className="flex items-center gap-2 mt-2 px-2 py-2 rounded-lg" style={{ background: 'var(--bg-3)' }}>
                  <span className="text-xs flex-1" style={{ color: 'var(--text-2)' }}>
                    {format(new Date(`${qtyEditing.date}T00:00:00`), 'EEE d MMM', { locale: es })}
                  </span>
                  <input
                    autoFocus
                    type="number"
                    min={0}
                    value={qtyValue}
                    onChange={e => setQtyValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') submitQuantity(habit, qtyEditing.date)
                      if (e.key === 'Escape') { setQtyEditing(null); setQtyValue('') }
                    }}
                    placeholder="0"
                    className="w-16 bg-transparent text-sm outline-none px-2 py-1 rounded"
                    style={{ border: '1px solid var(--border-2)', color: 'var(--text)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>{habit.quantity_unit === 'reps' ? 'reps' : 'min'}</span>
                  <button onClick={() => submitQuantity(habit, qtyEditing.date)}
                    className="text-xs px-2 py-1 rounded font-medium"
                    style={{ background: habit.color, color: 'white' }}
                  >Guardar</button>
                </div>
              )}

              {/* Tendencia: últimas 8 semanas */}
              <div className="flex items-end mt-3" style={{ height: 32, gap: 2 }}>
                {bars.map((b, i) => (
                  <div key={i} className="flex-1 rounded-t"
                    title={`${format(b.weekStart, 'd MMM', { locale: es })} – ${format(b.weekEnd, 'd MMM', { locale: es })}: ${b.pct}%`}
                    style={{ height: Math.max(2, Math.round((b.pct / 100) * 32)), background: barColor(b.pct) }}
                  />
                ))}
              </div>

              <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>{footerText}</p>
            </div>
          )
        })}
      </div>

      {habits.length === 0 && !adding && (
        <div className="text-center mt-20" style={{ color: 'var(--text-3)' }}>
          <p className="text-sm mb-3">Sin hábitos configurados.</p>
          <p className="text-xs mb-4">Agrega tus hábitos de la rutina: gym, inglés, ventas online...</p>
          <button onClick={() => setAdding(true)}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
          >
            Crear primer hábito
          </button>
        </div>
      )}
    </div>
  )
}
