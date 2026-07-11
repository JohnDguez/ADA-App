import { useState } from 'react'
import { MoreVertical, Pencil, Trash2, LogOut } from 'lucide-react'

// Selector de espacio activo — tarjetas apiladas (patrón que Johnatan mostró
// de la app de Banamex). La tarjeta AL FRENTE usa el color de fondo de la
// app (se funde sin costura con el contenido de abajo); las de atrás se
// asoman con un color fijo de "inactivo" — el color es del ESTADO
// (activo/inactivo), no de la identidad del espacio, para que cualquier
// tarjeta se vea igual sin importar cuál sea.
//
// v2 (rediseño de boceto): las tarjetas que asoman ahora muestran un
// resumen mini de pendientes/vencidos (vía el hook `useSpaceStats`,
// incluyendo Personal); la tarjeta activa muestra 3 puntitos con
// "Editar"/"Eliminar" (dueño) o "Editar"/"Salir" (invitado) — no aplica a
// Personal ni a la tarjeta "Nuevo espacio compartido". Esta última siempre
// se acomoda hasta arriba del stack (primera en asomar); los espacios
// compartidos reales van alfabéticamente; Personal siempre al final —
// mismo orden confirmado en el boceto de Johnatan.
export function SpaceSwitcher({ spaces, activeSpaceId, onSwitch, onManage, profile, user, stats = {}, deleteSpace, leaveSpace }) {
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [dangerOpen,  setDangerOpen]  = useState(false)
  const [dangerPassword, setDangerPassword] = useState('')
  const [dangerError, setDangerError] = useState('')
  const [dangerLoading, setDangerLoading] = useState(false)

  const ownedEntry   = spaces.find(s => s.membership.role === 'owner')
  const guestEntries = spaces.filter(s => s.membership.role === 'guest')
  const canAddMore   = (profile.is_premium && !ownedEntry) || guestEntries.length < 3

  const spaceItems = [...spaces]
    .sort((a, b) => a.space.name.localeCompare(b.space.name, 'es'))
    .map(s => ({ id: s.space.id, kind: 'space', name: s.space.name, entry: s }))

  const allItems = [
    ...(canAddMore ? [{ id: 'new', kind: 'new', name: 'Nuevo espacio compartido' }] : []),
    ...spaceItems,
    { id: null, kind: 'personal', name: 'Personal' },
  ]

  const peekItems  = allItems.filter(it => it.id !== activeSpaceId)
  const frontItem  = allItems.find(it => it.id === activeSpaceId) || allItems.find(it => it.kind === 'personal')
  const ordered    = [...peekItems, frontItem]

  function statFor(item) {
    const s = stats[item.id ?? 'personal']
    if (!s) return null
    if (s.pending === 0) return 'Sin pagos pendientes'
    return `${s.pending} pago${s.pending !== 1 ? 's' : ''} pendiente${s.pending !== 1 ? 's' : ''}` + (s.overdue > 0 ? ` · ${s.overdue} vencido${s.overdue !== 1 ? 's' : ''}` : '')
  }

  function openDanger() {
    setMenuOpen(false)
    setDangerOpen(true)
    setDangerPassword('')
    setDangerError('')
  }

  async function handleDeleteOrLeave() {
    if (frontItem.entry.membership.role === 'owner') {
      if (!dangerPassword) { setDangerError('Ingresa tu contraseña para confirmar'); return }
      setDangerLoading(true)
      setDangerError('')
      const { error } = await deleteSpace(frontItem.id, user?.email, dangerPassword)
      setDangerLoading(false)
      if (error) setDangerError(typeof error === 'string' ? error : 'Contraseña incorrecta')
      else { setDangerOpen(false); setDangerPassword(''); onSwitch(null) }
    } else {
      setDangerLoading(true)
      const { error } = await leaveSpace(frontItem.entry.membership.id)
      setDangerLoading(false)
      if (error) setDangerError('No se pudo salir del espacio')
      else { setDangerOpen(false); onSwitch(null) }
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      {ordered.map((item, i) => {
        const isFront = item === frontItem
        const isRealSpace = isFront && item.kind === 'space'
        const isOwner = isRealSpace && item.entry.membership.role === 'owner'
        return (
          <div
            key={item.id ?? 'personal'}
            onClick={() => !isFront && onSwitch(item.id === 'new' ? 'new' : item.id)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px',
              borderRadius: '18px 18px 0 0',
              background: isFront ? 'var(--bg)' : 'var(--label-variable)',
              position: 'relative',
              zIndex: ordered.length - i,
              marginBottom: isFront ? 0 : -16,
              paddingBottom: isFront ? 16 : 30,
              cursor: isFront ? 'default' : 'pointer',
              borderBottom: isFront ? '1px solid var(--border)' : 'none',
            }}
          >
            <span style={{ fontSize: 17, fontWeight: 700, color: isFront ? 'var(--text)' : '#fff' }}>{item.name}</span>

            {!isFront && item.kind !== 'new' && (
              <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{statFor(item)}</span>
            )}

            {isRealSpace && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
                  style={{ background: 'none', border: 'none', padding: 4, display: 'flex', alignItems: 'center', cursor: 'pointer', borderRadius: 4 }}
                >
                  <MoreVertical size={18} color="var(--text)" />
                </button>
                {menuOpen && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 20,
                      background: 'var(--menu-bg)', border: '0.5px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      minWidth: 170, overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => { setMenuOpen(false); onManage() }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--bg)', fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <Pencil size={14} /> Editar
                    </button>
                    {isOwner ? (
                      <button
                        onClick={openDanger}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', fontSize: 13, fontWeight: 500, color: 'var(--danger)', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <Trash2 size={14} /> Eliminar
                      </button>
                    ) : (
                      <button
                        onClick={openDanger}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', fontSize: 13, fontWeight: 500, color: 'var(--danger)', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <LogOut size={14} /> Salir del espacio
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Confirmación de Eliminar (dueño, con contraseña) / Salir (invitado) ── */}
      {dangerOpen && (
        <div onClick={e => e.target === e.currentTarget && setDangerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.45)', zIndex: 250, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px 16px 0 0', width: '100%', padding: '24px 20px', animation: 'modalSlideUp .32s cubic-bezier(0.25, 0.46, 0.45, 0.94) both' }}>
            {frontItem.entry?.membership.role === 'owner' ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger)', marginBottom: 6 }}>Eliminar Espacio Compartido</div>
                <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 16 }}>
                  Se borrará permanentemente para ti y para tu invitado — todos los pagos e ingresos del espacio, sin poder deshacerlo.
                </div>
                <label className="field-label" style={{ marginBottom: 6, display: 'block' }}>Confirma con tu contraseña</label>
                <input
                  type="password" className="field-input" value={dangerPassword}
                  onChange={e => setDangerPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDeleteOrLeave()}
                  placeholder="••••••••" style={{ marginBottom: 10 }}
                />
                {dangerError && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{dangerError}</div>}
                <button
                  onClick={handleDeleteOrLeave}
                  disabled={dangerLoading || !dangerPassword}
                  style={{ width: '100%', padding: 12, background: 'var(--danger)', color: 'var(--surface)', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', marginBottom: 8, opacity: dangerLoading || !dangerPassword ? 0.7 : 1 }}
                >
                  {dangerLoading ? 'Verificando…' : 'Eliminar espacio permanentemente'}
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger)', marginBottom: 6 }}>Salir del Espacio Compartido</div>
                <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 16 }}>
                  Dejarás de pertenecer a "{frontItem.name}". Tus pagos ya agregados se quedan en el espacio para el dueño.
                </div>
                {dangerError && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{dangerError}</div>}
                <button
                  onClick={handleDeleteOrLeave}
                  disabled={dangerLoading}
                  style={{ width: '100%', padding: 12, background: 'var(--danger)', color: 'var(--surface)', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', marginBottom: 8, opacity: dangerLoading ? 0.7 : 1 }}
                >
                  {dangerLoading ? 'Saliendo…' : 'Salir del espacio'}
                </button>
              </>
            )}
            <button onClick={() => setDangerOpen(false)} className="btn-ghost">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
