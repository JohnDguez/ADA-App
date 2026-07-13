import { useState } from 'react'
import { Crown } from 'lucide-react'
import { CobroPeriodFields } from './CobroPeriodFields'
import { Toggle } from './SettingsShared'

// Panel que reemplaza el contenido normal de Inicio/Gastos/Recurrentes
// cuando la tarjeta "Nuevo espacio compartido" del switcher está activa.
// Mismos formularios/textos que `SettingsSharedSpacePage.jsx` (no se
// reinventa el estilo) — con 2 diferencias a propósito, confirmadas por
// Johnatan: (1) el formulario de crear aparece directo, sin el paso extra
// de "Crear Espacio Compartido" → clic → formulario, porque aquí sí hay
// espacio de sobra; (2) el mensaje de "únete con código" dice cuántos
// espacios más puede unirse (dinámico), no solo un tope fijo de 3.
export function NewSharedSpacePanel({ profile, sharedSpaces, onOpenPremium, onCreated, onJoined }) {
  const { spaces, createSpace, redeemCode } = sharedSpaces
  const ownedEntry   = spaces.find(s => s.membership.role === 'owner')
  const guestEntries = spaces.filter(s => s.membership.role === 'guest')
  const slotsLeft    = 3 - guestEntries.length

  // ── Crear ──
  const [newName,     setNewName]     = useState('')
  const [newFreq,     setNewFreq]     = useState('biweekly')
  const [newDay1,     setNewDay1]     = useState(1)
  const [newDay2,     setNewDay2]     = useState(16)
  const [newWeekday,  setNewWeekday]  = useState(5)
  const [newSalaryEnabled, setNewSalaryEnabled] = useState(false)
  const [newSalaryAmount,  setNewSalaryAmount]  = useState('')
  const [createError, setCreateError] = useState('')
  const [createSaving,setCreateSaving]= useState(false)

  async function handleCreate() {
    if (!newName.trim()) { setCreateError('Ponle un nombre al espacio'); return }
    setCreateSaving(true)
    setCreateError('')
    const { data, error } = await createSpace({
      name: newName.trim(),
      isPremium: profile.is_premium,
      cobroFreq: newFreq,
      cobroDay1: newFreq !== 'weekly' ? newDay1 : undefined,
      cobroDay2: newFreq === 'biweekly' ? newDay2 : undefined,
      cobroWeekday: newFreq === 'weekly' ? newWeekday : undefined,
      salaryEnabled: newSalaryEnabled,
      salaryAmount: newSalaryEnabled ? (parseFloat(newSalaryAmount) || 0) : null,
    })
    setCreateSaving(false)
    if (error) setCreateError(typeof error === 'string' ? error : 'No se pudo crear el espacio')
    else { setNewName(''); onCreated && data?.id && onCreated(data.id) }
  }

  // ── Unirse ──
  const [joinCode,   setJoinCode]   = useState('')
  const [joinError,  setJoinError]  = useState('')
  const [joinSaving, setJoinSaving] = useState(false)

  async function handleJoin() {
    if (joinCode.trim().length !== 6) { setJoinError('El código debe tener 6 dígitos'); return }
    setJoinSaving(true)
    setJoinError('')
    const { data, error } = await redeemCode(joinCode.trim())
    setJoinSaving(false)
    if (error) setJoinError(typeof error === 'string' ? error : 'Código inválido')
    else { setJoinCode(''); onJoined && data?.space_id && onJoined(data.space_id) }
  }

  return (
    <div style={{ padding: '0 16px 16px' }}>
      {/* Escenario 1: no Premium */}
      {!profile.is_premium && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px 16px', textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            Obtén Premium para crear un Espacio Compartido
          </div>
          <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 14 }}>
            Lleva el control de gastos con tu pareja, tus roomies, o quien tú quieras — hasta 2 personas más, en un espacio aparte de tu cuenta personal.
          </div>
          <button
            onClick={onOpenPremium}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 12, borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--premium-gold)', color: 'var(--premium-gold-text)', fontSize: 14, fontWeight: 700, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}
          >
            <Crown size={16} fill="currentColor" /> Prueba Premium GRATIS 7 días
          </button>
        </div>
      )}

      {/* Escenario 2: Premium sin espacio propio — formulario directo */}
      {profile.is_premium && !ownedEntry && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Crear Espacio Compartido</div>
          <label className="field-label">Nombre del espacio</label>
          <input className="field-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej. Depa con Ale" style={{ marginBottom: 16 }} />
          <label className="field-label" style={{ marginBottom: 8, display: 'block' }}>Periodo de cobro</label>
          <div style={{ marginBottom: 16 }}>
            <CobroPeriodFields
              freq={newFreq} day1={newDay1} day2={newDay2} weekday={newWeekday}
              onChangeFreq={setNewFreq} onChangeDay1={setNewDay1} onChangeDay2={setNewDay2} onChangeWeekday={setNewWeekday}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: newSalaryEnabled ? 10 : 14 }} onClick={() => setNewSalaryEnabled(v => !v)}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Ingreso por periodo</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 1 }}>Opcional — además de los Ingresos Extras que cualquier invitado con permiso puede agregar</div>
            </div>
            <Toggle on={newSalaryEnabled} />
          </div>
          {newSalaryEnabled && (
            <div style={{ marginBottom: 14 }}>
              <label className="field-label">Monto</label>
              <input type="number" value={newSalaryAmount} onChange={e => setNewSalaryAmount(e.target.value)} placeholder="0.00" className="field-input" />
            </div>
          )}

          {createError && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{createError}</div>}
          <button onClick={handleCreate} disabled={createSaving} className="btn-primary" style={{ opacity: createSaving ? 0.7 : 1 }}>
            {createSaving ? 'Creando…' : 'Crear'}
          </button>
        </div>
      )}

      {/* Escenario 3: Premium y ya tiene su espacio propio */}
      {profile.is_premium && ownedEntry && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            Ya eres dueño de un Espacio Compartido — solo puedes tener uno propio.
          </div>
        </div>
      )}

      {/* Unirse con código — siempre visible, para los 3 escenarios */}
      {slotsLeft > 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Únete a un Espacio Compartido</div>
          <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 12 }}>
            Puedes unirte a {slotsLeft} espacio{slotsLeft !== 1 ? 's' : ''} compartido{slotsLeft !== 1 ? 's' : ''} más. El código de acceso debe tener 6 dígitos — debe proporcionarlo el creador del espacio.
          </div>
          <input
            className="field-input" inputMode="numeric" maxLength={6}
            value={joinCode} onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000" style={{ textAlign: 'center', fontSize: 20, letterSpacing: 4, marginBottom: 10 }}
          />
          {joinError && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{joinError}</div>}
          <button onClick={handleJoin} disabled={joinSaving || joinCode.length !== 6} className="btn-primary" style={{ opacity: (joinSaving || joinCode.length !== 6) ? 0.6 : 1 }}>
            {joinSaving ? 'Uniendo…' : 'Unirme'}
          </button>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text)' }}>
          Ya perteneces al máximo de 3 espacios compartidos como invitado.
        </div>
      )}
    </div>
  )
}
