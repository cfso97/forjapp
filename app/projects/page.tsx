'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Project, Task } from '@/lib/types'
import { Plus, Circle, CheckCircle2, Trash2, ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'

const PROJECT_COLORS = ['#534AB7','#1D9E75','#185FA5','#D4537E','#BA7517','#993C1D','#0F6E56']
const PROJECT_ICONS = ['📁','💼','👓','🛒','💻','📱','🎯','📊','🧠']

export default function Projects() {
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Record<string, Task[]>>({})
  const [loading, setLoading] = useState(true)
  const [addingProject, setAddingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0])
  const [selectedIcon, setSelectedIcon] = useState(PROJECT_ICONS[0])
  const [addingTaskFor, setAddingTaskFor] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [dateMenuFor, setDateMenuFor] = useState<string | null>(null)
  const [showDoneFor, setShowDoneFor] = useState<Record<string, boolean>>({})
  const [editingProject, setEditingProject] = useState<string | null>(null)
  const [editProjectName, setEditProjectName] = useState('')

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data: projs } = await supabase.from('projects').select('*').order('position')
    setProjects(projs || [])
    if (projs?.length) {
      const { data: allTasks } = await supabase.from('tasks').select('*').order('position')
      const map: Record<string, Task[]> = {}
      for (const p of projs) map[p.id] = (allTasks || []).filter(t => t.project_id === p.id)
      setTasks(map)
    }
    setLoading(false)
  }

  async function addProject() {
    if (!newProjectName.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('projects').insert({
      name: newProjectName.trim(), color: selectedColor, icon: selectedIcon, position: projects.length, user_id: user.id
    }).select().single()
    if (data) {
      setProjects(p => [...p, data])
      setTasks(t => ({ ...t, [data.id]: [] }))
    }
    setNewProjectName('')
    setAddingProject(false)
  }

  async function addTask(projectId: string) {
    if (!newTaskTitle.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('tasks').insert({
      project_id: projectId, title: newTaskTitle.trim(),
      position: (tasks[projectId]?.length || 0),
      scheduled_date: format(new Date(), 'yyyy-MM-dd'),
      user_id: user.id,
    }).select().single()
    if (data) setTasks(t => ({ ...t, [projectId]: [...(t[projectId] || []), data] }))
    setNewTaskTitle('')
    setAddingTaskFor(null)
  }

  async function toggleTask(task: Task) {
    const next = task.status === 'done' ? 'pending' : 'done'
    await supabase.from('tasks').update({ status: next }).eq('id', task.id)
    setTasks(t => ({
      ...t,
      [task.project_id]: (t[task.project_id] || []).map(x => x.id === task.id ? { ...x, status: next } : x)
    }))
  }

  async function setTaskDate(task: Task, dateStr: string | null) {
    await supabase.from('tasks').update({ scheduled_date: dateStr }).eq('id', task.id)
    setTasks(t => ({
      ...t,
      [task.project_id]: (t[task.project_id] || []).map(x => x.id === task.id ? { ...x, scheduled_date: dateStr || undefined } : x)
    }))
    setDateMenuFor(null)
  }

  function taskDateLabel(dateStr?: string) {
    if (!dateStr) return 'Agendar'
    if (dateStr === todayStr) return 'Hoy'
    if (dateStr === tomorrowStr) return 'Mañana'
    return format(new Date(`${dateStr}T00:00:00`), 'd MMM', { locale: es })
  }

  function renderTask(task: Task, project: Project) {
    return (
      <div key={task.id}
        className="flex items-start gap-2 px-2 py-2 rounded-lg transition-all group relative"
        style={{ background: 'transparent' }}
      >
        <button onClick={() => toggleTask(task)} className="mt-0.5 flex-shrink-0">
          {task.status === 'done'
            ? <CheckCircle2 size={15} style={{ color: project.color }} />
            : <Circle size={15} style={{ color: 'var(--text-3)' }} />
          }
        </button>
        <span className="text-sm flex-1" style={{
          color: task.status === 'done' ? 'var(--text-3)' : 'var(--text)',
          textDecoration: task.status === 'done' ? 'line-through' : 'none',
          lineHeight: 1.4,
        }}>
          {task.title}
        </span>
        <button
          onClick={() => setDateMenuFor(dateMenuFor === task.id ? null : task.id)}
          className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded transition-opacity"
          style={
            task.scheduled_date
              ? { color: project.color, background: `${project.color}18` }
              : { color: 'var(--text-3)', border: '1px dashed var(--border-2)', opacity: 0.6 }
          }
        >
          {taskDateLabel(task.scheduled_date)}
        </button>

        {dateMenuFor === task.id && (
          <div
            className="absolute right-0 top-7 rounded-lg overflow-hidden z-20"
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border-2)', minWidth: 210 }}
          >
            <button
              onClick={() => setTaskDate(task, todayStr)}
              className="w-full text-left px-3 py-2 text-xs hover:opacity-80"
              style={{ color: 'var(--text)', background: task.scheduled_date === todayStr ? 'var(--bg-2)' : 'transparent' }}
            >
              Hoy
            </button>
            <button
              onClick={() => setTaskDate(task, tomorrowStr)}
              className="w-full text-left px-3 py-2 text-xs hover:opacity-80"
              style={{ color: 'var(--text)', background: task.scheduled_date === tomorrowStr ? 'var(--bg-2)' : 'transparent' }}
            >
              Mañana
            </button>
            <label
              className="flex items-center justify-between gap-2 w-full text-left px-3 py-2 text-xs cursor-pointer hover:opacity-80"
              style={{
                color: 'var(--text)',
                background: task.scheduled_date && task.scheduled_date !== todayStr && task.scheduled_date !== tomorrowStr ? 'var(--bg-2)' : 'transparent',
              }}
            >
              <span className="flex-shrink-0">Otra fecha</span>
              <input
                type="date"
                defaultValue={task.scheduled_date && task.scheduled_date !== todayStr && task.scheduled_date !== tomorrowStr ? task.scheduled_date : ''}
                onChange={e => { if (e.target.value) setTaskDate(task, e.target.value) }}
                onClick={e => e.stopPropagation()}
                className="bg-transparent text-xs outline-none"
                style={{ color: 'var(--text-3)', colorScheme: 'dark', width: 92 }}
              />
            </label>
            {task.scheduled_date && (
              <button
                onClick={() => setTaskDate(task, null)}
                className="w-full text-left px-3 py-2 text-xs hover:opacity-80"
                style={{ color: '#E24B4A' }}
              >
                Quitar de agenda
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  function startEditProject(project: Project) {
    setEditingProject(project.id)
    setEditProjectName(project.name)
  }

  async function saveProjectName(project: Project) {
    const name = editProjectName.trim()
    setEditingProject(null)
    if (!name || name === project.name) return
    await supabase.from('projects').update({ name }).eq('id', project.id)
    setProjects(p => p.map(x => x.id === project.id ? { ...x, name } : x))
  }

  async function deleteProject(id: string) {
    await supabase.from('projects').delete().eq('id', id)
    setProjects(p => p.filter(x => x.id !== id))
    const { [id]: _, ...rest } = tasks
    setTasks(rest)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-3)' }}>
      <span className="text-sm">Cargando proyectos...</span>
    </div>
  )

  return (
    <div className="px-6 py-8 h-full overflow-x-auto">
      {dateMenuFor && (
        <div className="fixed inset-0 z-10" onClick={() => setDateMenuFor(null)} />
      )}
      <div className="flex items-center justify-between mb-8 min-w-0">
        <h1 className="text-2xl font-semibold">Proyectos</h1>
        <button
          onClick={() => setAddingProject(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
        >
          <Plus size={14} /> Nuevo proyecto
        </button>
      </div>

      {/* Nuevo proyecto form */}
      {addingProject && (
        <div
          className="rounded-xl p-4 mb-6 max-w-sm"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
        >
          <input
            autoFocus
            value={newProjectName}
            onChange={e => setNewProjectName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addProject(); if (e.key === 'Escape') setAddingProject(false) }}
            placeholder="Nombre del proyecto"
            className="w-full bg-transparent text-sm mb-3 outline-none"
            style={{ color: 'var(--text)' }}
          />
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {PROJECT_COLORS.map(c => (
              <button key={c} onClick={() => setSelectedColor(c)}
                className="w-5 h-5 rounded-full transition-all"
                style={{ background: c, outline: selectedColor === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
              />
            ))}
          </div>
          <div className="flex gap-1 mb-4 flex-wrap">
            {PROJECT_ICONS.map(i => (
              <button key={i} onClick={() => setSelectedIcon(i)}
                className="w-7 h-7 rounded text-sm flex items-center justify-center transition-all"
                style={{ background: selectedIcon === i ? 'var(--bg-3)' : 'transparent' }}
              >{i}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={addProject}
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={{ background: selectedColor, color: 'white' }}
            >Crear</button>
            <button onClick={() => setAddingProject(false)}
              className="px-3 py-1.5 rounded text-xs"
              style={{ color: 'var(--text-3)' }}
            >Cancelar</button>
          </div>
        </div>
      )}

      {/* Grid de proyectos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {projects.map(project => (
          <div key={project.id}
            className="rounded-xl flex flex-col"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', minHeight: 200 }}
          >
            {/* Header del proyecto */}
            <div className="flex items-center justify-between px-4 py-3 group"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span style={{ fontSize: 16 }} className="flex-shrink-0">{project.icon}</span>
                {editingProject === project.id ? (
                  <input
                    autoFocus
                    value={editProjectName}
                    onChange={e => setEditProjectName(e.target.value)}
                    onBlur={() => saveProjectName(project)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveProjectName(project)
                      if (e.key === 'Escape') setEditingProject(null)
                    }}
                    className="text-sm font-medium bg-transparent outline-none flex-1 min-w-0"
                    style={{ color: project.color, borderBottom: `1px solid ${project.color}` }}
                  />
                ) : (
                  <span
                    onClick={() => startEditProject(project)}
                    className="text-sm font-medium truncate cursor-pointer"
                    style={{ color: project.color }}
                    title="Editar nombre"
                  >
                    {project.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {editingProject !== project.id && (
                  <button onClick={() => startEditProject(project)} className="opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity">
                    <Pencil size={13} style={{ color: 'var(--text-2)' }} />
                  </button>
                )}
                <button onClick={() => deleteProject(project.id)} className="opacity-30 hover:opacity-70 transition-opacity">
                  <Trash2 size={13} style={{ color: 'var(--text-2)' }} />
                </button>
              </div>
            </div>

            {/* Tareas */}
            <div className="flex-1 p-2">
              {(tasks[project.id] || []).filter(t => t.status !== 'done').map(task => renderTask(task, project))}

              {/* Nueva tarea */}
              {addingTaskFor === project.id ? (
                <div className="px-2 mt-1">
                  <input
                    autoFocus
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') addTask(project.id)
                      if (e.key === 'Escape') { setAddingTaskFor(null); setNewTaskTitle('') }
                    }}
                    placeholder="Nueva tarea..."
                    className="w-full bg-transparent text-sm outline-none"
                    style={{ color: 'var(--text)', borderBottom: `1px solid ${project.color}` }}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setAddingTaskFor(project.id)}
                  className="flex items-center gap-2 px-2 py-1.5 w-full text-sm rounded-lg transition-all mt-1"
                  style={{ color: 'var(--text-3)' }}
                >
                  <Plus size={13} /> Agregar tarea
                </button>
              )}

              {/* Completadas (desplegable) */}
              {(() => {
                const doneTasks = (tasks[project.id] || []).filter(t => t.status === 'done')
                if (doneTasks.length === 0) return null
                const open = !!showDoneFor[project.id]
                return (
                  <div className="mt-1 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={() => setShowDoneFor(s => ({ ...s, [project.id]: !s[project.id] }))}
                      className="flex items-center gap-1.5 px-2 py-1.5 w-full text-xs rounded-lg transition-all"
                      style={{ color: 'var(--text-3)' }}
                    >
                      {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      Completadas ({doneTasks.length})
                    </button>
                    {open && doneTasks.map(task => renderTask(task, project))}
                  </div>
                )
              })()}
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && !addingProject && (
        <div className="text-center mt-20" style={{ color: 'var(--text-3)' }}>
          <p className="text-sm mb-3">Sin proyectos aún.</p>
          <button onClick={() => setAddingProject(true)}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
          >
            Crear primer proyecto
          </button>
        </div>
      )}
    </div>
  )
}
