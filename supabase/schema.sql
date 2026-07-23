-- LifeOS Schema
-- Ejecuta esto en Supabase SQL Editor

-- Habilitar UUID
create extension if not exists "uuid-ossp";

-- PROYECTOS (tipo Google Keep / Trello)
create table projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  color text default '#534AB7',
  icon text default '📁',
  position int default 0,
  created_at timestamptz default now()
);

-- TAREAS
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  notes text,
  status text default 'pending' check (status in ('pending','in_progress','done')),
  priority text default 'medium' check (priority in ('low','medium','high')),
  due_date date,
  scheduled_date date,   -- día en que aparece en el dashboard
  position int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- HÁBITOS (definición)
create table habits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  icon text default '⚡',
  color text default '#1D9E75',
  days_of_week int[] default '{1,2,3,4,5}',  -- 0=dom, 1=lun ... 6=sáb
  routine_block text,   -- 'morning', 'afternoon', 'evening'
  is_minimum boolean default false,  -- hábito mínimo a mantener en modo rojo
  frequency_type text default 'specific_days',  -- 'specific_days' | 'per_week' | 'quantity'
  target_per_week int default null,             -- para 'per_week': sesiones objetivo por semana
  preferred_days int[] default null,             -- para 'per_week': días sugeridos (no obligatorios)
  quantity_unit text default null,               -- para 'quantity': 'min' | 'reps'
  quantity_target int default null,              -- para 'quantity': meta semanal acumulada
  position int default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- REGISTROS DE HÁBITOS (log diario)
create table habit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  habit_id uuid references habits(id) on delete cascade,
  date date not null,
  status text default 'done' check (status in ('done','partial','skip')),
  quantity_logged int default null,  -- para hábitos de tipo 'quantity' (minutos o repeticiones)
  note text,
  created_at timestamptz default now(),
  unique(habit_id, date)
);

-- RUTINA (bloques horarios semanales)
create table routine_blocks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  label text not null,
  category text not null,  -- 'work','english','gym','gaffo','optica','ventas','study','rest'
  color text default '#534AB7',
  created_at timestamptz default now()
);

-- CHECKS DE RUTINA (marca de "hecho" por bloque y fecha)
create table routine_completions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  routine_block_id uuid references routine_blocks(id) on delete cascade,
  date date not null,
  created_at timestamptz default now(),
  unique(routine_block_id, date)
);

-- MODO DEL DÍA (registro diario)
create table day_modes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  mode text not null check (mode in ('green','yellow','red')),
  note text,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- NOTAS DE SEMANA (check-in semanal)
create table weekly_checkins (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  week_start date not null,  -- lunes de esa semana
  note text,
  summary jsonb,  -- resumen de hábitos de la semana
  created_at timestamptz default now(),
  unique(user_id, week_start)
);

-- ROW LEVEL SECURITY (cada usuario solo ve sus datos)
alter table projects enable row level security;
alter table tasks enable row level security;
alter table habits enable row level security;
alter table habit_logs enable row level security;
alter table routine_blocks enable row level security;
alter table routine_completions enable row level security;
alter table day_modes enable row level security;
alter table weekly_checkins enable row level security;

-- Políticas: solo el dueño accede a sus datos
create policy "own data" on projects for all using (auth.uid() = user_id);
create policy "own data" on tasks for all using (auth.uid() = user_id);
create policy "own data" on habits for all using (auth.uid() = user_id);
create policy "own data" on habit_logs for all using (auth.uid() = user_id);
create policy "own data" on routine_blocks for all using (auth.uid() = user_id);
create policy "own data" on routine_completions for all using (auth.uid() = user_id);
create policy "own data" on day_modes for all using (auth.uid() = user_id);
create policy "own data" on weekly_checkins for all using (auth.uid() = user_id);

-- Función para actualizar updated_at en tasks
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger tasks_updated_at before update on tasks
for each row execute function update_updated_at();

-- MIGRACIÓN v2: hábito mínimo (modo rojo)
-- Ejecutar en Supabase SQL Editor si la tabla habits ya existía.
alter table habits add column if not exists is_minimum boolean default false;

-- MIGRACIÓN v3: tipos de frecuencia de hábito (días fijos / x veces por semana / cantidad)
-- Ejecutar en Supabase SQL Editor si las tablas habits y habit_logs ya existían.
alter table habits add column if not exists frequency_type text default 'specific_days';
alter table habits add column if not exists target_per_week int default null;
alter table habits add column if not exists preferred_days int[] default null;
alter table habits add column if not exists quantity_unit text default null;
alter table habits add column if not exists quantity_target int default null;
alter table habit_logs add column if not exists quantity_logged int default null;

-- MIGRACIÓN v4: check de bloques de rutina
-- Ejecutar en Supabase SQL Editor si la tabla routine_blocks ya existía.
create table if not exists routine_completions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  routine_block_id uuid references routine_blocks(id) on delete cascade,
  date date not null,
  created_at timestamptz default now(),
  unique(routine_block_id, date)
);
alter table routine_completions enable row level security;
drop policy if exists "own data" on routine_completions;
create policy "own data" on routine_completions for all using (auth.uid() = user_id);
NOTIFY pgrst, 'reload schema';
