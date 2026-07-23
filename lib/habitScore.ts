import { format, eachDayOfInterval, startOfWeek, endOfWeek, subWeeks } from 'date-fns'
import type { Habit } from './types'

export interface HabitLogLite {
  habit_id: string
  date: string
  status: string
  quantity_logged?: number | null
}

export interface WeekScore {
  done: number
  partial: number
  total: number
  pct: number
}

// Calcula el % de cumplimiento semanal de un hábito según su frequency_type.
export function habitWeekScore(habit: Habit, weekDays: Date[], logs: HabitLogLite[]): WeekScore {
  const logByDate = new Map(logs.map(l => [l.date, l]))

  if (habit.frequency_type === 'per_week') {
    const target = habit.target_per_week || 1
    const sessions = weekDays.filter(d => logByDate.get(format(d, 'yyyy-MM-dd'))?.status === 'done').length
    return { done: sessions, partial: 0, total: target, pct: Math.min(100, Math.round((sessions / target) * 100)) }
  }

  if (habit.frequency_type === 'quantity') {
    const target = habit.quantity_target || 1
    const sum = weekDays.reduce((acc, d) => acc + (logByDate.get(format(d, 'yyyy-MM-dd'))?.quantity_logged || 0), 0)
    return { done: sum, partial: 0, total: target, pct: Math.min(100, Math.round((sum / target) * 100)) }
  }

  // specific_days
  const applicable = weekDays.filter(d => habit.days_of_week.includes(d.getDay()))
  const done = applicable.filter(d => logByDate.get(format(d, 'yyyy-MM-dd'))?.status === 'done').length
  const partial = applicable.filter(d => logByDate.get(format(d, 'yyyy-MM-dd'))?.status === 'partial').length
  const total = applicable.length
  return { done, partial, total, pct: total ? Math.round(((done + partial * 0.5) / total) * 100) : 0 }
}

function weekRange(weeksAgo: number, from: Date, weekStartsOn: 0 | 1) {
  const start = startOfWeek(subWeeks(from, weeksAgo), { weekStartsOn })
  const end = endOfWeek(start, { weekStartsOn })
  return { start, end, days: eachDayOfInterval({ start, end }) }
}

// Racha en semanas: cuenta semanas consecutivas (hacia atrás, sin contar la actual) con pct >= 80.
export function habitWeeklyStreak(habit: Habit, logs: HabitLogLite[], today: Date, weekStartsOn: 0 | 1 = 1): number {
  let streak = 0
  for (let i = 1; i <= 52; i++) {
    const { start, end, days } = weekRange(i, today, weekStartsOn)
    const startStr = format(start, 'yyyy-MM-dd')
    const endStr = format(end, 'yyyy-MM-dd')
    const logsInWeek = logs.filter(l => l.date >= startStr && l.date <= endStr)
    const { pct } = habitWeekScore(habit, days, logsInWeek)
    if (pct >= 80) streak++
    else break
  }
  return streak
}

export interface WeekBar {
  weekStart: Date
  weekEnd: Date
  pct: number
}

// % de cumplimiento de las últimas N semanas (incluye la actual, en curso).
export function habitWeeklyBars(habit: Habit, logs: HabitLogLite[], today: Date, weeks = 8, weekStartsOn: 0 | 1 = 1): WeekBar[] {
  const bars: WeekBar[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const { start, end, days } = weekRange(i, today, weekStartsOn)
    const startStr = format(start, 'yyyy-MM-dd')
    const endStr = format(end, 'yyyy-MM-dd')
    const logsInWeek = logs.filter(l => l.date >= startStr && l.date <= endStr)
    const { pct } = habitWeekScore(habit, days, logsInWeek)
    bars.push({ weekStart: start, weekEnd: end, pct })
  }
  return bars
}
