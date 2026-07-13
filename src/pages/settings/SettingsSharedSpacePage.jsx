import { useState } from 'react'
import { ChevronLeft, Users, Copy, RefreshCw, LogOut, Trash2, Crown, Plus } from 'lucide-react'
import { Card, Row, NotifToggle, Toggle } from '../../components/SettingsShared'
import { CobroPeriodFields } from '../../components/CobroPeriodFields'
import { showToast } from '../../components/Toast'

// Sub-página de Ajustes → "Espacio Compartido". Sirve para 2 casos a la vez,
// para no duplicar el formulario de crear/unirse en otro lugar (ej. la
// tarjeta vacía del selector de Home solo navega aquí):
// - Si el usuario no pertenece a ningún espacio: formulario de crear
//   (solo Premium, máximo 1 propio) y/o unirse con código.
// - Si ya pertenece a alguno: panel de administración (si es dueño) y/o
//   lista de espacios donde es invitado (con opción de salirse).
export function SettingsSharedSpacePage({ profile, user, sharedSpaces, onBack, slideClass }) {
  const { spaces, createSpace, regenerateCode, redeemCode, updateMemberPermissions, updateSpaceConfig, leaveSpace, removeMember, deleteSpace } = sharedSpaces

  const ownedEntry  = spaces.find(s => s.membership.role === 'owner')
  const guestEntries = spaces.filter(s => s.membership.role === 'guest')

  // ── Crear ──
  const [creating,    setCreating]    = useState(false)
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
    const { error } = await createSpace({
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
    else { setCreating(false); setNewName('') }
  }

  // ── Unirse ──
  const [joinCode,   setJoinCode]   = useState('')
  const [joinError,  setJoinError]  = useState('')
  const [joinSaving, setJoinSaving] = useState(false)

  async function handleJoin() {
    if (joinCode.trim().length !== 6) { setJoinError('El código debe tener 6 dígitos'); return }
    setJoinSaving(true)
    setJoinError('')
    const { error } = await redeemCode(joinCode.trim())
    setJoinSaving(false)
    if (error) setJoinError(typeof error === 'string' ? error : 'Código inválido')
    else setJoinCode('')
  }

  const canCreateMore = profile.is_premium && !ownedEntry
  const canJoinMore   = guestEntries.length < 3

  return (
    <div className={slideClass} style={{ paddingBottom: 120, background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '52px 16px 20px' }}>
        <button onClick={onBack} style={{ width: 32, height: 32, borderRadius: '50%', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft size={20} color="var(--text)" />
        </button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Espacio Compartido</div>
      </div>

      {/* ── Tu espacio (si eres dueño) ── */}
      {ownedEntry && (
        <OwnedSpacePanel
          entry={ownedEntry}
          user={user}
          regenerateCode={regenerateCode}
          updateMemberPermissions={updateMemberPermissions}
          updateSpaceConfig={updateSpaceConfig}
          removeMember={removeMember}
          deleteSpace={deleteSpace}
        />
      )}

      {/* ── Espacios donde te invitaron ── */}
      {guestEntries.length > 0 && (
        <Card>
          <div style={{ padding: '12px 14px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Espacios donde te invitaron
          </div>
          {guestEntries.map((entry, i) => (
            <div key={entry.membership.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', borderBottom: i === guestEntries.length - 1 ? 'none' : '0.5px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Users size={16} color="var(--text)" />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{entry.space.name}</span>
              </div>
              <button
                onClick={() => leaveSpace(entry.membership.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 5, border: '0.5px solid var(--danger)', background: 'none', color: 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              >
                <LogOut size={12} /> Salir
              </button>
            </div>
          ))}
        </Card>
      )}

      {/* ── Crear (solo si es Premium y no tiene ya uno propio) ── */}
      {!ownedEntry && (
        <Card>
          <div style={{ padding: 16 }}>
            {!profile.is_premium ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6, textAlign: 'center' }}>
                  Obtén Premium para crear un Espacio Compartido
                </div>
                <div style={{ fontSize: 12, color: 'var(--text)', textAlign: 'center', marginBottom: 14 }}>
                  Lleva el control de gastos con tu pareja o roomie, en un espacio aparte de tu cuenta personal.
                </div>
              </>
            ) : !creating ? (
              <button
                onClick={() => setCreating(true)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 12, borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}
              >
                <Plus size={16} /> Crear Espacio Compartido
              </button>
            ) : (
              <>
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
                <button onClick={handleCreate} disabled={createSaving} className="btn-primary" style={{ marginBottom: 8, opacity: createSaving ? 0.7 : 1 }}>
                  {createSaving ? 'Creando…' : 'Crear'}
                </button>
                <button onClick={() => { setCreating(false); setCreateError('') }} className="btn-ghost">Cancelar</button>
              </>
            )}
          </div>
        </Card>
      )}

      {/* ── Unirse con código (si no ha llegado a 3) ── */}
      {canJoinMore ? (
        <Card>
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Únete a un Espacio Compartido</div>
            <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 12 }}>El código de acceso debe tener 6 dígitos. Debe proporcionarlo el creador del espacio.</div>
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
        </Card>
      ) : (
        <Card>
          <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text)' }}>
            Ya perteneces al máximo de 3 espacios compartidos como invitado.
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Panel de administración del espacio propio ──────────────────────────────
function OwnedSpacePanel({ entry, user, regenerateCode, updateMemberPermissions, updateSpaceConfig, removeMember, deleteSpace }) {
  const [copied,        setCopied]        = useState(false)
  const [regenerating,  setRegenerating]  = useState(false)
  const [salaryAmount,  setSalaryAmount]  = useState(entry.space.salary_amount || '')
  const [dangerOpen,    setDangerOpen]    = useState(false)
  const [confirmExpel,  setConfirmExpel]  = useState(null)
  const [expelling,     setExpelling]     = useState(false)
  const [dangerPassword,setDangerPassword]= useState('')
  const [dangerError,   setDangerError]   = useState('')
  const [dangerLoading, setDangerLoading] = useState(false)

  const guestMembers = entry.space.members?.filter?.(m => m.role === 'guest') || []

  async function handleCobroChange(updates) {
    await updateSpaceConfig(entry.space.id, updates)
  }

  async function handleSalaryToggle() {
    await updateSpaceConfig(entry.space.id, { salary_enabled: !entry.space.salary_enabled })
  }

  async function handleSalaryAmount() {
    const val = parseFloat(salaryAmount)
    if (isNaN(val)) { showToast('Ingresa un monto válido'); return }
    await updateSpaceConfig(entry.space.id, { salary_amount: val })
    showToast('Ingreso actualizado')
  }

  async function handleExpel(membershipId) {
    setExpelling(true)
    const { error } = await removeMember(membershipId)
    setExpelling(false)
    setConfirmExpel(null)
    if (error) showToast('No se pudo expulsar al invitado')
    else showToast('Invitado expulsado')
  }

  function copyCode() {
    navigator.clipboard?.writeText(entry.space.access_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleRegenerate() {
    setRegenerating(true)
    await regenerateCode(entry.space.id)
    setRegenerating(false)
  }

  // Mismo patrón que SettingsAccountPage.jsx: reautentica con contraseña
  // ANTES de proceder — no se reinventa el estilo, se replica.
  async function handleDelete() {
    if (!dangerPassword) { setDangerError('Ingresa tu contraseña para confirmar'); return }
    setDangerLoading(true)
    setDangerError('')
    const { error } = await deleteSpace(entry.space.id, user?.email, dangerPassword)
    setDangerLoading(false)
    if (error) setDangerError(typeof error === 'string' ? error : 'Contraseña incorrecta')
    else { setDangerOpen(false); setDangerPassword('') }
  }

  return (
    <>
      <Card>
        <div style={{ padding: '14px 16px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Crown size={16} color="var(--premium-gold)" />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{entry.space.name}</span>
        </div>
        <div style={{ padding: '4px 16px 14px' }}>
          <label className="field-label" style={{ marginBottom: 8, display: 'block' }}>Periodo de cobro</label>
          <CobroPeriodFields
            freq={entry.space.cobro_freq}
            day1={entry.space.cobro_day1}
            day2={entry.space.cobro_day2}
            weekday={entry.space.cobro_weekday}
            onChangeFreq={v => handleCobroChange({ cobro_freq: v })}
            onChangeDay1={v => handleCobroChange({ cobro_day1: v })}
            onChangeDay2={v => handleCobroChange({ cobro_day2: v })}
            onChangeWeekday={v => handleCobroChange({ cobro_weekday: v })}
          />
        </div>

        <div style={{ padding: '0 16px 14px' }}>
          <label className="field-label">Código de acceso</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--border)', background: 'var(--bg)', fontSize: 20, fontWeight: 700, letterSpacing: 4, textAlign: 'center', color: 'var(--text)' }}>
              {entry.space.access_code}
            </div>
            <button onClick={copyCode} style={{ width: 44, borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--border)', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Copy size={16} color="var(--text)" />
            </button>
            <button onClick={handleRegenerate} disabled={regenerating} style={{ width: 44, borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--border)', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: regenerating ? 0.6 : 1 }}>
              <RefreshCw size={16} color="var(--text)" />
            </button>
          </div>
          {copied && <div style={{ fontSize: 11, color: 'var(--paid)', marginTop: 4 }}>Copiado</div>}
        </div>
      </Card>

      <Card>
        <div style={{ padding: '13px 14px', borderBottom: entry.space.salary_enabled ? '0.5px solid var(--border)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={handleSalaryToggle}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Ingreso por periodo</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 1 }}>Opcional — además de los Ingresos Extras que cualquier invitado con permiso puede agregar</div>
            </div>
            <Toggle on={entry.space.salary_enabled} />
          </div>
        </div>
        {entry.space.salary_enabled && (
          <div style={{ padding: '13px 14px' }}>
            <label className="field-label">Monto</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input type="number" value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} placeholder="0.00" className="field-input" style={{ flex: 1 }} />
              <button onClick={handleSalaryAmount} className="btn-primary" style={{ width: 'auto', padding: '0 16px' }}>Guardar</button>
            </div>
          </div>
        )}
      </Card>

      {guestMembers.length > 0 && (
        <Card>
          {guestMembers.map((m, i) => {
            const initials = (m.profile?.name || 'Invitado').slice(0, 2).toUpperCase()
            const isConfirming = confirmExpel === m.id
            return (
              <div key={m.id} style={{ borderBottom: i === guestMembers.length - 1 ? 'none' : '1px solid var(--border-mid)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {m.profile?.avatar_url
                      ? <img src={m.profile.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                      : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--surface)' }}>{initials}</div>
                    }
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{m.profile?.name || 'Invitado'}</span>
                  </div>
                  <button
                    onClick={() => setConfirmExpel(m.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 5, border: '0.5px solid var(--danger)', background: 'none', color: 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                  >
                    <LogOut size={12} /> Expulsar
                  </button>
                </div>

                {isConfirming && (
                  <div style={{ padding: '0 14px 12px' }}>
                    <div style={{ background: 'var(--danger-soft)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', marginBottom: 8 }}>
                        ¿Expulsar a {m.profile?.name || 'este invitado'}? Sus pagos ya agregados se quedan en el espacio.
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setConfirmExpel(null)} style={{ flex: 1, padding: '7px', borderRadius: 6, border: '0.5px solid var(--border)', background: 'var(--surface)', fontSize: 12, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                          Cancelar
                        </button>
                        <button onClick={() => handleExpel(m.id)} disabled={expelling} style={{ flex: 1, padding: '7px', borderRadius: 6, border: 'none', background: 'var(--danger)', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: expelling ? 0.7 : 1 }}>
                          {expelling ? 'Expulsando…' : 'Expulsar'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <NotifToggle label="Agregar pagos"        value={m.can_add}        onChange={v => updateMemberPermissions(m.id, { can_add: v })} />
                <NotifToggle label="Editar pagos"          value={m.can_edit}       onChange={v => updateMemberPermissions(m.id, { can_edit: v })} />
                <NotifToggle label="Marcar pagado/no pagado" value={m.can_mark_paid} onChange={v => updateMemberPermissions(m.id, { can_mark_paid: v })} />
                <NotifToggle label="Eliminar pagos"        value={m.can_delete}     onChange={v => updateMemberPermissions(m.id, { can_delete: v })} />
                <NotifToggle label="Agregar ingresos extra" value={m.can_add_income} onChange={v => updateMemberPermissions(m.id, { can_add_income: v })} last />
              </div>
            )
          })}
        </Card>
      )}

      <Card>
        <button onClick={() => { setDangerOpen(true); setDangerPassword(''); setDangerError('') }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer' }}>
          <Trash2 size={16} color="var(--danger)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>Eliminar Espacio Compartido</span>
        </button>
      </Card>

      {dangerOpen && (
        <div onClick={e => e.target === e.currentTarget && setDangerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.45)', zIndex: 250, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px 16px 0 0', width: '100%', padding: '24px 20px', animation: 'modalSlideUp .32s cubic-bezier(0.25, 0.46, 0.45, 0.94) both' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger)', marginBottom: 6 }}>Eliminar Espacio Compartido</div>
            <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 16 }}>
              Se borrará permanentemente para ti y para tu invitado — todos los pagos e ingresos del espacio, sin poder deshacerlo.
            </div>
            <label className="field-label" style={{ marginBottom: 6, display: 'block' }}>Confirma con tu contraseña</label>
            <input
              type="password" className="field-input" value={dangerPassword}
              onChange={e => setDangerPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDelete()}
              placeholder="••••••••" style={{ marginBottom: 10 }}
            />
            {dangerError && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{dangerError}</div>}
            <button
              onClick={handleDelete}
              disabled={dangerLoading || !dangerPassword}
              style={{ width: '100%', padding: 12, background: 'var(--danger)', color: 'var(--surface)', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', marginBottom: 8, opacity: dangerLoading || !dangerPassword ? 0.7 : 1 }}
            >
              {dangerLoading ? 'Verificando…' : 'Eliminar espacio permanentemente'}
            </button>
            <button onClick={() => { setDangerOpen(false); setDangerPassword('') }} className="btn-ghost">Cancelar</button>
          </div>
        </div>
      )}
    </>
  )
}
