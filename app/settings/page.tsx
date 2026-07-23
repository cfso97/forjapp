'use client'
export default function Settings() {
  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold mb-8">Ajustes</h1>
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          Próximamente: gestión de cuenta, autenticación, notificaciones, y exportar datos.
        </p>
      </div>
    </div>
  )
}
