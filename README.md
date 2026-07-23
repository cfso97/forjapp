# LifeOS — Tu sistema personal

App personal de productividad: tareas por proyecto, rutina diaria, hábitos. Stack: Next.js 14 + Supabase + Tailwind + Vercel.

## Setup en 3 pasos

### 1. Clonar y instalar
```bash
git clone <tu-repo>
cd lifeos
npm install
```

### 2. Crear proyecto en Supabase
1. Ve a https://supabase.com y crea un proyecto gratis
2. En el SQL Editor, pega y ejecuta el contenido de `supabase/schema.sql`
3. Copia las variables de entorno desde Settings > API

### 3. Variables de entorno
Crea `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

En Vercel, agrega las mismas variables en Settings > Environment Variables.

### 4. Deploy
```bash
git push origin main
# Vercel detecta Next.js automáticamente
```

## Estructura
```
/app
  /dashboard        → Vista principal del día
  /projects         → Tareas por proyecto (estilo Keep/Trello)
  /routine          → Tu rutina semanal
  /habits           → Tracker de hábitos
/components
  /ui               → Componentes base
/lib
  supabase.ts       → Cliente Supabase
  types.ts          → Tipos TypeScript
/supabase
  schema.sql        → Esquema de base de datos
```

## Módulos

| Módulo | Qué hace |
|--------|----------|
| Dashboard | Vista del día: hábitos de hoy + tareas del día + resumen rutina |
| Proyectos | Tablero tipo Keep — columnas por proyecto, tarjetas de tarea |
| Rutina | Tu horario semanal, modos (verde/amarillo/rojo), check-in semanal |
| Hábitos | Tracker diario alineado con tu rutina (gym, inglés, ventas, etc.) |
# forjapp
