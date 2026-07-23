export type TaskStatus = 'pending' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'
export type HabitStatus = 'done' | 'partial' | 'skip'
export type HabitFrequencyType = 'specific_days' | 'per_week' | 'quantity'
export type QuantityUnit = 'min' | 'reps'
export type DayMode = 'green' | 'yellow' | 'red'
export type RoutineCategory = 'work' | 'english' | 'gym' | 'gaffo' | 'optica' | 'ventas' | 'study' | 'rest'

export interface Project {
  id: string
  user_id: string
  name: string
  color: string
  icon: string
  position: number
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  project_id: string
  title: string
  notes?: string
  status: TaskStatus
  priority: TaskPriority
  due_date?: string
  scheduled_date?: string
  position: number
  created_at: string
  updated_at: string
  project?: Project
}

export interface Habit {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  days_of_week: number[]
  routine_block: string
  is_minimum: boolean
  frequency_type: HabitFrequencyType
  target_per_week?: number | null
  preferred_days?: number[] | null
  quantity_unit?: QuantityUnit | null
  quantity_target?: number | null
  position: number
  active: boolean
  created_at: string
  log?: HabitLog
}

export interface HabitLog {
  id: string
  user_id: string
  habit_id: string
  date: string
  status: HabitStatus
  quantity_logged?: number | null
  note?: string
  created_at: string
}

export interface RoutineBlock {
  id: string
  user_id: string
  day_of_week: number
  start_time: string
  end_time: string
  label: string
  category: RoutineCategory
  color: string
}

export interface RoutineCompletion {
  id: string
  user_id: string
  routine_block_id: string
  date: string
  created_at: string
}

export interface DayModeRecord {
  id: string
  user_id: string
  date: string
  mode: DayMode
  note?: string
}

export interface WeeklyCheckin {
  id: string
  user_id: string
  week_start: string
  note?: string
  summary?: Record<string, unknown>
  created_at: string
}
