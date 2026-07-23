'use client'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase'
import type { Task, Habit, HabitLog, RoutineBlock, RoutineCompletion, Project } from '@/lib/types'
import { CheckCircle2, Circle, Plus } from 'lucide-react'

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function Dashboard() {
  const supabase = createClient()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const today = now
  const todayStr = format(today, 'yyyy-MM-dd')
  const dayOfWeek = today.getDay()
  const nowMinutes = today.getHours() * 60 + today.getMinutes()

  const [tasks, setTasks] = useState<Task[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [habitLogs, setHabitLogs] = useState<Record<string, HabitLog>>({})
  const [routineBlocks, setRoutineBlocks] = useState<RoutineBlock[]>([])
  const [completions, setCompletions] = useState<RoutineCompletion[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskProject, setNewTaskProject] = useState('')
  const [qtyEditingHabit, setQtyEditingHabit] = useState<string | null>(null)
  const [qtyValue, setQtyValue] = useState('')

  useEffect(() => {
    loadDayData()
  }, [])

  async function loadDayData() {
    setLoading(true)

    const [tasksRes, habitsRes, logsRes, blocksRes, completionsRes, projectsRes] = await Promise.all([
      supabase.from('tasks').select('*, project:projects(name,color,icon)').eq('scheduled_date', todayStr).order('priority'),
      supabase.from('habits').select('*').eq('active', true).contains('days_of_week', [dayOfWeek]),
      supabase.from('habit_logs').select('*').eq('date', todayStr),
      supabase.from('routine_blocks').select('*').eq('day_of_week', dayOfWeek).order('start_time'),
      supabase.from('routine_completions').select('*').eq('date', todayStr),
      supabase.from('projects').select('*').order('position'),
    ])

    setTasks(tasksRes.data || [])
    const todaysHabits = (habitsRes.data || []).filter(h =>
      h.frequency_type !== 'per_week' || !h.preferred_days || h.preferred_days.length === 0 || h.preferred_days.includes(dayOfWeek)
    )
    setHabits(todaysHabits)

    const logsMap: Record<string, HabitLog> = {}
    for (const log of (logsRes.data || [])) logsMap[log.habit_id] = log
    setHabitLogs(logsMap)

    setRoutineBlocks(blocksRes.data || [])
    setCompletions(completionsRes.data || [])
    setProjects(projectsRes.data || [])
    setNewTaskProject(projectsRes.data?.[0]?.id || '')
    setLoading(false)
  }

  async function toggleTask(task: Task) {
    const next = task.status === 'done' ? 'pending' : 'done'
    await supabase.from('tasks').update({ status: next }).eq('id', task.id)
    setTasks(t => t.map(x => x.id === task.id ? { ...x, status: next } : x))
  }

  async function cycleHabit(habit: Habit) {
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
    } else {
      if (current) {
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
  }

  function openQtyEditorToday(habit: Habit) {
    const current = habitLogs[habit.id]
    setQtyEditingHabit(habit.id)
    setQtyValue(current?.quantity_logged ? String(current.quantity_logged) : '')
  }

  async function submitQuantityToday(habit: Habit) {
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

  async function toggleBlockCompletion(block: RoutineBlock) {
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

  async function addQuickTask() {
    if (!newTaskTitle.trim() || !newTaskProject) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('tasks').insert({
      project_id: newTaskProject,
      title: newTaskTitle.trim(),
      scheduled_date: todayStr,
      position: tasks.length,
      user_id: user.id,
    }).select('*, project:projects(name,color,icon)').single()
    if (data) setTasks(t => [...t, data])
    setNewTaskTitle('')
  }

  // Bloque activo / siguiente
  const activeBlock = routineBlocks.find(b => timeToMinutes(b.start_time) <= nowMinutes && nowMinutes <= timeToMinutes(b.end_time))
  const minutesLeft = activeBlock ? timeToMinutes(activeBlock.end_time) - nowMinutes : null
  const nextBlock = routineBlocks
    .filter(b => timeToMinutes(b.start_time) > nowMinutes)
    .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))[0]

  // Resúmenes
  const habitsTotal = habits.length
  const habitsDone = habits.filter(h => habitLogs[h.id]?.status === 'done').length
  const routineTotal = routineBlocks.length
  const routineDone = completions.length
  const tasksTotal = tasks.length
  const tasksDone = tasks.filter(t => t.status === 'done').length

  const greeting = today.getHours() < 12 ? 'Buenos días' : today.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches'

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-3)' }}>
      <span className="text-sm">Cargando tu día...</span>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Cabecera */}
      <div className="mb-8">
        <p className="text-sm mb-1" style={{ color: 'var(--text-3)' }}>
          {format(today, "EEEE, d 'de' MMMM", { locale: es })}
        </p>
        <h1 className="text-2xl font-semibold mb-3">{greeting}</h1>
        <div
          className="rounded-xl p-3 flex items-center justify-between flex-wrap gap-3"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
        >
          {activeBlock ? (
            <div>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Ahora</p>
              <p className="text-sm font-medium" style={{ color: activeBlock.color }}>{activeBlock.label}</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Faltan {minutesLeft} min</p>
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Sin bloque de rutina activo ahora</p>
          )}
          {nextBlock && (
            <div className="text-right">
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Siguiente</p>
              <p className="text-sm font-medium" style={{ color: nextBlock.color }}>{nextBlock.label}</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>{nextBlock.start_time.slice(0, 5)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Resumen del día */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Hábitos</p>
          <p className="text-xl font-semibold">{habitsDone}/{habitsTotal}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Rutina</p>
          <p className="text-xl font-semibold">{routineDone}/{routineTotal}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Tareas</p>
          <p className="text-xl font-semibold">{tasksDone}/{tasksTotal}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Hábitos de hoy */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium" style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hábitos</p>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{habitsDone}/{habitsTotal}</span>
          </div>
          <div
            className="rounded-xl p-1"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
          >
            {habits.length === 0 && (
              <p className="text-sm px-3 py-4" style={{ color: 'var(--text-3)' }}>Sin hábitos para hoy</p>
            )}
            {habits.map(habit => {
              const log = habitLogs[habit.id]
              const isQuantity = habit.frequency_type === 'quantity'
              const statusIcon = !log ? null : log.status === 'done' ? '✓' : log.status === 'partial' ? '~' : '✗'
              const statusColor = !log ? 'var(--text-3)' : log.status === 'done' ? '#1D9E75' : log.status === 'partial' ? '#EF9F27' : '#E24B4A'
              return (
                <div key={habit.id}>
                  <button
                    onClick={() => isQuantity ? openQtyEditorToday(habit) : cycleHabit(habit)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left"
                    style={{ background: log ? `${habit.color}10` : 'transparent' }}
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
                    <div className="flex items-center gap-2 px-3 py-2">
                      <input
                        autoFocus
                        type="number"
                        min={0}
                        value={qtyValue}
                        onChange={e => setQtyValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') submitQuantityToday(habit)
                          if (e.key === 'Escape') { setQtyEditingHabit(null); setQtyValue('') }
                        }}
                        placeholder="0"
                        className="w-16 bg-transparent text-sm outline-none px-2 py-1 rounded"
                        style={{ border: '1px solid var(--border-2)', color: 'var(--text)' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>{habit.quantity_unit === 'reps' ? 'reps' : 'min'}</span>
                      <button onClick={() => submitQuantityToday(habit)}
                        className="text-xs px-2 py-1 rounded font-medium"
                        style={{ background: habit.color, color: 'white' }}
                      >Guardar</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Rutina de hoy */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium" style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rutina</p>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{routineDone}/{routineTotal}</span>
          </div>
          <div className="rounded-xl p-1" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
            {routineBlocks.length === 0 && (
              <p className="text-sm px-3 py-4" style={{ color: 'var(--text-3)' }}>Sin bloques para hoy</p>
            )}
            {routineBlocks.map(block => {
              const done = completions.some(c => c.routine_block_id === block.id)
              return (
                <button
                  key={block.id}
                  onClick={() => toggleBlockCompletion(block)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left"
                  style={{ background: done ? `${block.color}10` : 'transparent' }}
                >
                  {done
                    ? <CheckCircle2 size={16} style={{ color: block.color, flexShrink: 0 }} />
                    : <Circle size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                  }
                  <span className="text-xs tabular-nums flex-shrink-0" style={{ color: 'var(--text-3)' }}>
                    {block.start_time.slice(0, 5)}
                  </span>
                  <span className="flex-1 text-sm" style={{
                    color: done ? 'var(--text-3)' : 'var(--text)',
                    textDecoration: done ? 'line-through' : 'none',
                  }}>
                    {block.label}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Tareas de hoy */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium" style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tareas</p>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{tasksDone}/{tasksTotal}</span>
          </div>
          <div
            className="rounded-xl p-1"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
          >
            {tasks.length === 0 && (
              <p className="text-sm px-3 py-4" style={{ color: 'var(--text-3)' }}>
                Sin tareas programadas para hoy.
              </p>
            )}
            {tasks.map(task => (
              <button
                key={task.id}
                onClick={() => toggleTask(task)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left"
              >
                {task.status === 'done'
                  ? <CheckCircle2 size={16} style={{ color: '#534AB7', flexShrink: 0 }} />
                  : <Circle size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                }
                <span className="flex-1 text-sm" style={{
                  color: task.status === 'done' ? 'var(--text-3)' : 'var(--text)',
                  textDecoration: task.status === 'done' ? 'line-through' : 'none',
                }}>
                  {task.title}
                </span>
                {task.project && (
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      background: `${(task.project as any).color}20`,
                      color: (task.project as any).color,
                    }}
                  >
                    {(task.project as any).icon} {(task.project as any).name}
                  </span>
                )}
              </button>
            ))}

            {/* Agregar tarea rápida */}
            {projects.length > 0 ? (
              <div className="flex items-center gap-2 px-2 py-2 mt-1 flex-wrap">
                <select
                  value={newTaskProject}
                  onChange={e => setNewTaskProject(e.target.value)}
                  className="bg-transparent text-xs rounded px-1.5 py-1.5 outline-none"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-2)', maxWidth: 90 }}
                >
                  {projects.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
                </select>
                <input
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addQuickTask()}
                  placeholder="Nueva tarea..."
                  className="flex-1 bg-transparent text-sm outline-none min-w-0"
                  style={{ color: 'var(--text)' }}
                />
                <button onClick={addQuickTask} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                  <Plus size={16} style={{ color: 'var(--text-2)' }} />
                </button>
              </div>
            ) : (
              <p className="text-xs px-3 py-2" style={{ color: 'var(--text-3)' }}>
                Crea un proyecto primero para poder agregar tareas.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
