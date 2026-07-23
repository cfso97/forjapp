'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { RoutineBlock, RoutineCompletion, Habit, HabitLog } from '@/lib/types'
import { format } from 'date-fns'
import { Plus, Trash2, Pencil, Circle, CheckCircle2 } from 'lucide-react'

const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const CATEGORIES = [
  { key: 'work',    label: 'Trabajo',        color: '#185FA5' },
  { key: 'english', label: 'English Live',   color: '#3B6D11' },
  { key: 'gym',     label: 'Gym',            color: '#BA7517' },
  { key: 'gaffo',   label: 'Gaffo',          color: '#993C1D' },
  { key: 'optica',  label: 'Óptica',         color: '#534AB7' },
  { key: 'ventas',  label: 'Ventas online',  color: '#D4537E' },
  { key: 'study',   label: 'Tecnología',     color: '#0F6E56' },
  { key: 'rest',    label: 'Descanso',       color: '#5E5C6E' },
]

const DEFAULT_BLOCKS: Omit<RoutineBlock, 'id' | 'user_id'>[] = [
  { day_of_week: 1, start_time: '06:30', end_time: '07:00', label: 'English Live', category: 'english', color: '#3B6D11' },
  { day_of_week: 1, start_time: '08:00', end_time: '13:00', label: 'Trabajo',       category: 'work',    color: '#185FA5' },
  { day_of_week: 1, start_time: '13:30', end_time: '14:30', label: 'Gym',           category: 'gym',     color: '#BA7517' },
  { day_of_week: 1, start_time: '15:00', end_time: '17:00', label: 'Óptica dev',    category: 'optica',  color: '#534AB7' },
  { day_of_week: 1, start_time: '19:00', end_time: '21:00', label: 'Ventas online', category: 'ventas',  color: '#D4537E' },
  { day_of_week: 2, start_time: '06:30', end_time: '07:00', label: 'English Live', category: 'english', color: '#3B6D11' },
  { day_of_week: 2, start_time: '08:00', end_time: '13:00', label: 'Trabajo',       category: 'work',    color: '#185FA5' },
  { day_of_week: 2, start_time: '13:30', end_time: '15:00', label: 'Gaffo / Redes', category: 'gaffo',   color: '#993C1D' },
  { day_of_week: 2, start_time: '15:00', end_time: '16:30', label: 'Tecnología',    category: 'study',   color: '#0F6E56' },
  { day_of_week: 2, start_time: '19:00', end_time: '21:00', label: 'Ventas online', category: 'ventas',  color: '#D4537E' },
  { day_of_week: 3, start_time: '06:30', end_time: '07:00', label: 'English Live', category: 'english', color: '#3B6D11' },
  { day_of_week: 3, start_time: '08:00', end_time: '13:00', label: 'Trabajo',       category: 'work',    color: '#185FA5' },
  { day_of_week: 3, start_time: '13:30', end_time: '14:30', label: 'Gym',           category: 'gym',     color: '#BA7517' },
  { day_of_week: 3, start_time: '15:00', end_time: '16:30', label: 'Gaffo / Videos',category: 'gaffo',   color: '#993C1D' },
  { day_of_week: 3, start_time: '19:00', end_time: '21:00', label: 'Ventas online', category: 'ventas',  color: '#D4537E' },
  { day_of_week: 4, start_time: '06:30', end_time: '07:00', label: 'English Live', category: 'english', color: '#3B6D11' },
  { day_of_week: 4, start_time: '08:00', end_time: '13:00', label: 'Trabajo',       category: 'work',    color: '#185FA5' },
  { day_of_week: 4, start_time: '13:30', end_time: '15:00', label: 'Gaffo / Ads',   category: 'gaffo',   color: '#993C1D' },
  { day_of_week: 4, start_time: '15:00', end_time: '16:30', label: 'Tecnología',    category: 'study',   color: '#0F6E56' },
  { day_of_week: 4, start_time: '19:00', end_time: '21:00', label: 'Ventas online', category: 'ventas',  color: '#D4537E' },
  { day_of_week: 5, start_time: '06:30', end_time: '07:00', label: 'English Live', category: 'english', color: '#3B6D11' },
  { day_of_week: 5, start_time: '08:00', end_time: '13:00', label: 'Trabajo',       category: 'work',    color: '#185FA5' },
  { day_of_week: 5, start_time: '13:30', end_time: '14:30', label: 'Gym',           category: 'gym',     color: '#BA7517' },
  { day_of_week: 5, start_time: '15:00', end_time: '17:00', label: 'Óptica dev',    category: 'optica',  color: '#534AB7' },
  { day_of_week: 6, start_time: '07:00', end_time: '08:30', label: 'Gym',           category: 'gym',     color: '#BA7517' },
  { day_of_week: 6, start_time: '09:00', end_time: '11:00', label: 'Gaffo / Planear',category:'gaffo',   color: '#993C1D' },
  { day_of_week: 6, start_time: '11:00', end_time: '13:00', label: 'Tecnología',    category: 'study',   color: '#0F6E56' },
]

const initialBlockForm = { day_of_week: 1, start_time: '08:00', end_time: '09:00', label: '', category: 'work' }

function habitAppliesToDay(habit: Habit, dow: number) {
  if (habit.frequency_type === 'per_week') {
    return !habit.preferred_days || habit.preferred_days.length === 0 || habit.preferred_days.includes(dow)
  }
  if (habit.frequency_type === 'quantity') return true
  return habit.days_of_week.includes(dow)
}

export default function Routine() {
  const supabase = createClient()
  const [blocks, setBlocks] = useState<RoutineBlock[]>([])
  const [completions, setCompletions] = useState<RoutineCompletion[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [habitLogs, setHabitLogs] = useState<Record<string, HabitLog>>({})
  const [loading, setLoading] = useState(true)
  const [seeded, setSeeded] = useState(false)
  const [activeDay, setActiveDay] = useState(new Date().getDay())
  const [adding, setAdding] = useState(false)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [form, setForm] = useState(initialBlockForm)
  const [qtyEditingHabit, setQtyEditingHabit] = useState<string | null>(null)
  const [qtyValue, setQtyValue] = useState('')

  const todayDow = new Date().getDay()
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const isViewingToday = activeDay === todayDow

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [blocksRes, completionsRes, habitsRes, logsRes] = await Promise.all([
      supabase.from('routine_blocks').select('*').order('start_time'),
      supabase.from('routine_completions').select('*').eq('date', todayStr),
      supabase.from('habits').select('*').eq('active', true).order('position'),
      supabase.from('habit_logs').select('*').eq('date', todayStr),
    ])
    if (blocksRes.data && blocksRes.data.length > 0) {
      setBlocks(blocksRes.data); setSeeded(true)
    }
    setCompletions(completionsRes.data || [])
    setHabits(habitsRes.data || [])
    const logsMap: Record<string, HabitLog> = {}
    for (const log of (logsRes.data || [])) logsMap[log.habit_id] = log
    setHabitLogs(logsMap)
    setLoading(false)
  }

  async function seedDefaults() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase.from('routine_blocks').insert(DEFAULT_BLOCKS.map(b => ({ ...b, user_id: user.id }))).select()
    if (error) { console.error('Error al cargar rutina base:', error); return }
    if (data) { setBlocks(data); setSeeded(true) }
  }

  function startEditBlock(block: RoutineBlock) {
    setEditingBlockId(block.id)
    setForm({
      day_of_week: block.day_of_week,
      start_time: block.start_time.slice(0, 5),
      end_time: block.end_time.slice(0, 5),
      label: block.label,
      category: block.category,
    })
    setAdding(true)
  }

  function closeForm() {
    setAdding(false)
    setEditingBlockId(null)
    setForm({ ...initialBlockForm, day_of_week: activeDay })
  }

  async function saveBlock() {
    if (!form.label.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const cat = CATEGORIES.find(c => c.key === form.category)
    const payload = { ...form, color: cat?.color || '#534AB7' }

    if (editingBlockId) {
      const { data, error } = await supabase.from('routine_blocks').update(payload).eq('id', editingBlockId).select().single()
      if (error) { console.error('Error al actualizar bloque:', error); return }
      if (data) setBlocks(b => b.map(x => x.id === editingBlockId ? data : x).sort((a, b) => a.start_time.localeCompare(b.start_time)))
    } else {
      const { data, error } = await supabase.from('routine_blocks').insert({ ...payload, user_id: user.id }).select().single()
      if (error) { console.error('Error al crear bloque:', error); return }
      if (data) {
        setBlocks(b => [...b, data].sort((a, b) => a.start_time.localeCompare(b.start_time)))
        setSeeded(true)
      }
    }
    closeForm()
  }

  async function deleteBlock(id: string) {
    const { error } = await supabase.from('routine_blocks').delete().eq('id', id)
    if (error) { console.error('Error al borrar bloque:', error); return }
    setBlocks(b => b.filter(x => x.id !== id))
  }

  async function toggleBlockCompletion(block: RoutineBlock) {
    if (!isViewingToday) return
    const existing = completions.find(c => c.routine_block_id === block.id)
    if (existing) {
      const { error } = await supabase.from('routine_completions').delete().eq('id', existing.id)
      if (error) { console.error('Error al desmarcar bloque:', error); return }
      setCompletions(c => c.filter(x => x.id !== existing.id))
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('routine_completions').insert({ routine_block_id: block.id, date: todayStr, user_id: user.id }).select().single()
      if (error) { console.error('Error al marcar bloque:', error); return }
      if (data) setCompletions(c => [...c, data])
    }
  }

  async function cycleHabitLog(habit: Habit) {
    if (!isViewingToday) return
    const current = habitLogs[habit.id]
    const CYCLE: Array<HabitLog['status'] | null> = [null, 'done', 'partial', 'skip']
    const idx = CYCLE.indexOf(current?.status ?? null)
    const next = CYCLE[(idx + 1) % CYCLE.length]

    if (!next) {
      if (current) {
        const { error } = await supabase.from('habit_logs').delete().eq('id', current.id)
        if (error) { console.error('Error al borrar log:', error); return }
      }
      const { [habit.id]: _, ...rest } = habitLogs
      setHabitLogs(rest)
    } else if (current) {
      const { error } = await supabase.from('habit_logs').update({ status: next }).eq('id', current.id)
      if (error) { console.error('Error al actualizar log:', error); return }
      setHabitLogs(l => ({ ...l, [habit.id]: { ...current, status: next } }))
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('habit_logs').insert({ habit_id: habit.id, date: todayStr, status: next, user_id: user.id }).select().single()
      if (error) { console.error('Error al crear log:', error); return }
      if (data) setHabitLogs(l => ({ ...l, [habit.id]: data }))
    }
  }

  function openQtyEditor(habit: Habit) {
    if (!isViewingToday) return
    const current = habitLogs[habit.id]
    setQtyEditingHabit(habit.id)
    setQtyValue(current?.quantity_logged ? String(current.quantity_logged) : '')
  }

  async function submitQuantity(habit: Habit) {
    const n = Number(qtyValue)
    const current = habitLogs[habit.id]
    if (!qtyValue || isNaN(n) || n <= 0) {
      if (current) {
        const { error } = await supabase.from('habit_logs').delete().eq('id', current.id)
        if (error) console.error('Error al borrar log de cantidad:', error)
        else {
          const { [habit.id]: _, ...rest } = habitLogs
          setHabitLogs(rest)
        }
      }
    } else if (current) {
      const { error } = await supabase.from('habit_logs').update({ quantity_logged: n, status: 'done' }).eq('id', current.id)
      if (error) console.error('Error al actualizar cantidad:', error)
      else setHabitLogs(l => ({ ...l, [habit.id]: { ...current, quantity_logged: n, status: 'done' } }))
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('habit_logs').insert({ habit_id: habit.id, date: todayStr, status: 'done', quantity_logged: n, user_id: user.id }).select().single()
      if (error) console.error('Error al crear log de cantidad:', error)
      if (data) setHabitLogs(l => ({ ...l, [habit.id]: data }))
    }
    setQtyEditingHabit(null)
    setQtyValue('')
  }

  const dayBlocks = blocks.filter(b => b.day_of_week === activeDay)
  const dayHabits = habits.filter(h => habitAppliesToDay(h, activeDay))

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-3)' }}>
      <span className="text-sm">Cargando rutina...</span>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Rutina semanal</h1>
        <button onClick={() => { setEditingBlockId(null); setForm({ ...initialBlockForm, day_of_week: activeDay }); setAdding(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
        >
          <Plus size={14} /> Agregar bloque
        </button>
      </div>

      {/* Seed state */}
      {!seeded && (
        <div className="rounded-xl p-5 mb-6 text-center" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
          <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>¿Quieres cargar tu rutina configurada?</p>
          <button onClick={seedDefaults}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#534AB7', color: 'white' }}
          >
            Cargar mi rutina base
          </button>
        </div>
      )}

      {/* Selector de día */}
      <div className="flex gap-1 mb-2">
        {DAYS.map((d, i) => (
          <button key={i} onClick={() => setActiveDay(i)}
            className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
            style={{
              background: activeDay === i ? 'var(--bg-3)' : 'transparent',
              color: activeDay === i ? 'var(--text)' : 'var(--text-3)',
              border: todayDow === i ? '1px solid var(--border-2)' : '1px solid transparent',
            }}
          >{d}</button>
        ))}
      </div>
      {!isViewingToday && (
        <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>
          Viendo {DAYS[activeDay]} — solo podés marcar como hecho el día de hoy ({DAYS[todayDow]}).
          <button onClick={() => setActiveDay(todayDow)} className="ml-2 underline" style={{ color: 'var(--text-2)' }}>Ir a hoy</button>
        </p>
      )}
      {isViewingToday && <div className="mb-4" />}

      {/* Formulario */}
      {adding && (
        <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {editingBlockId ? 'Editar bloque' : 'Nuevo bloque'}
          </p>
          <div className="mb-3">
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-3)' }}>Día</label>
            <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}
              className="w-full bg-transparent text-sm px-2 py-1.5 rounded"
              style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-3)' }}>Inicio</label>
              <input type="time" value={form.start_time}
                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                className="bg-transparent border rounded px-2 py-1.5 text-sm w-full"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-3)' }}>Fin</label>
              <input type="time" value={form.end_time}
                onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                className="bg-transparent border rounded px-2 py-1.5 text-sm w-full"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>
          </div>
          <input autoFocus value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && saveBlock()}
            placeholder="Nombre del bloque"
            className="w-full bg-transparent text-sm outline-none mb-3 px-2 py-1.5 rounded"
            style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
          />
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            className="w-full bg-transparent text-sm mb-3 px-2 py-1.5 rounded"
            style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={saveBlock} className="px-3 py-1.5 rounded text-xs font-medium" style={{ background: '#534AB7', color: 'white' }}>
              {editingBlockId ? 'Guardar cambios' : 'Agregar'}
            </button>
            <button onClick={closeForm} className="px-3 py-1.5 rounded text-xs" style={{ color: 'var(--text-3)' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Bloques del día */}
      <div className="space-y-2">
        {dayBlocks.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-3)' }}>
            {activeDay === 0 ? 'Domingo libre — descanso total.' : 'Sin bloques para este día.'}
          </p>
        )}
        {dayBlocks.map(block => {
          const done = isViewingToday && completions.some(c => c.routine_block_id === block.id)
          return (
            <div key={block.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl group"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderLeft: `3px solid ${block.color}` }}
            >
              <button
                onClick={() => toggleBlockCompletion(block)}
                disabled={!isViewingToday}
                title={isViewingToday ? undefined : 'Solo podés marcar el día de hoy'}
                className="flex-shrink-0"
                style={{ cursor: isViewingToday ? 'pointer' : 'default', opacity: isViewingToday ? 1 : 0.4 }}
              >
                {done
                  ? <CheckCircle2 size={17} style={{ color: block.color }} />
                  : <Circle size={17} style={{ color: 'var(--text-3)' }} />
                }
              </button>
              <span className="text-xs tabular-nums w-24 flex-shrink-0" style={{ color: 'var(--text-3)' }}>
                {block.start_time.slice(0,5)} – {block.end_time.slice(0,5)}
              </span>
              <span className="text-sm flex-1" style={{
                color: done ? 'var(--text-3)' : 'var(--text)',
                textDecoration: done ? 'line-through' : 'none',
              }}>{block.label}</span>
              <button onClick={() => startEditBlock(block)} className="opacity-0 group-hover:opacity-40 hover:!opacity-70 transition-opacity">
                <Pencil size={13} style={{ color: 'var(--text-2)' }} />
              </button>
              <button onClick={() => deleteBlock(block.id)} className="opacity-0 group-hover:opacity-40 hover:!opacity-70 transition-opacity">
                <Trash2 size={13} style={{ color: 'var(--text-2)' }} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Hábitos programados para este día */}
      {dayHabits.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Hábitos de este día
          </p>
          <div className="space-y-2">
            {dayHabits.map(habit => {
              const log = habitLogs[habit.id]
              const isQuantity = habit.frequency_type === 'quantity'
              const statusIcon = !log ? null : log.status === 'done' ? '✓' : log.status === 'partial' ? '~' : '✗'
              const statusColor = !log ? 'var(--text-3)' : log.status === 'done' ? '#1D9E75' : log.status === 'partial' ? '#EF9F27' : '#E24B4A'
              return (
                <div key={habit.id}>
                  <button
                    onClick={() => isQuantity ? openQtyEditor(habit) : cycleHabitLog(habit)}
                    disabled={!isViewingToday}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left"
                    style={{
                      background: log ? `${habit.color}10` : 'var(--bg-2)',
                      border: '1px solid var(--border)',
                      borderLeft: `3px solid ${habit.color}`,
                      cursor: isViewingToday ? 'pointer' : 'default',
                      opacity: isViewingToday ? 1 : 0.55,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{habit.icon}</span>
                    <span className="flex-1 text-sm" style={{ color: log?.status === 'skip' ? 'var(--text-3)' : 'var(--text)' }}>
                      {habit.name}
                    </span>
                    {isQuantity
                      ? log?.quantity_logged && (
                        <span className="text-sm font-semibold" style={{ color: '#1D9E75' }}>
                          {log.quantity_logged} {habit.quantity_unit === 'reps' ? 'reps' : 'min'}
                        </span>
                      )
                      : statusIcon && (
                        <span className="text-sm font-semibold" style={{ color: statusColor }}>{statusIcon}</span>
                      )}
                  </button>
                  {qtyEditingHabit === habit.id && (
                    <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-3)' }}>
                      <input
                        autoFocus
                        type="number"
                        min={0}
                        value={qtyValue}
                        onChange={e => setQtyValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') submitQuantity(habit)
                          if (e.key === 'Escape') { setQtyEditingHabit(null); setQtyValue('') }
                        }}
                        placeholder="0"
                        className="w-16 bg-transparent text-sm outline-none px-2 py-1 rounded"
                        style={{ border: '1px solid var(--border-2)', color: 'var(--text)' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>{habit.quantity_unit === 'reps' ? 'reps' : 'min'}</span>
                      <button onClick={() => submitQuantity(habit)}
                        className="text-xs px-2 py-1 rounded font-medium"
                        style={{ background: habit.color, color: 'white' }}
                      >Guardar</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Leyenda */}
      {seeded && (
        <div className="flex flex-wrap gap-3 mt-8 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
          {CATEGORIES.map(c => (
            <div key={c.key} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>{c.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
