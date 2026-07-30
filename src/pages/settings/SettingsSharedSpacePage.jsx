import { useState } from 'react'
import { ChevronLeft, ChevronDown, ChevronUp, Users, Copy, RefreshCw, LogOut, Trash2, Crown, Plus } from 'lucide-react'
import { Card, Row, NotifToggle, Toggle } from '../../components/SettingsShared'
import { CobroPeriodFields } from '../../components/CobroPeriodFields'
import { showToast } from '../../components/Toast'
import styles from './SettingsSharedSpacePage.module.css'

// Sub-página de Ajustes → "Espacio Compartido". Sirve para 2 casos a la vez,
// para no duplicar el formulario de crear/unirse en otro lugar (ej. la
// tarjeta vacía del selector de Home solo navega aquí):
// - Si el usuario no pertenece a ningún espacio: formulario de crear
//   (solo Premium, máximo 1 propio) y/o unirse con código.
// - Si ya pertenece a alguno: panel de administración (si es dueño) y/o
//   lista de espacios donde es invitado (con opción de salirse).
export function SettingsSharedSpacePage({ profile, user, sharedSpaces, onBack, slideClass }) {
  const { spaces, createSpace, regenerateCode, redeemCode, updateMemberPermissions, updateSpaceConfig, leaveSpace, removeMember, deleteSpace, clearSpaceData } = sharedSpaces

  const ownedEntry  = spaces.find(s => s.membership.role === 'owner')
  const guestEntries = spaces.filter(s => s.membership.role === 'guest')

  // ── Crear ──
  const [creating,    setCreating]    = useState(false)
  const [newName,     setNewName]     = useState('')
  const [newFreq,     setNewFreq]     = useState('biweekly')
  const [newDay1,     setNewDay1]     = useState(1)
  const [newDay2,     setNewDay2]     = useState(16)
  const [newWeekday,  setNewWeekday]  = useState(5)
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
    <div className={`${slideClass} ${styles.pageRoot}`}>
      <div className={styles.header}>
        <button onClick={onBack} className={styles.backButton}>
          <ChevronLeft size={20} color="var(--text)" />
        </button>
        <div className={styles.headerTitle}>Espacio Compartido</div>
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
          clearSpaceData={clearSpaceData}
        />
      )}

      {/* ── Espacios donde te invitaron ── */}
      {guestEntries.length > 0 && (
        <div className={styles.guestWrapper}>
          <div className={styles.sectionLabel}>
            Espacios donde te invitaron
          </div>
          {guestEntries.map(entry => (
            <GuestSpaceRow
              key={entry.membership.id}
              entry={entry}
              onLeave={() => leaveSpace(entry.membership.id)}
              onToggleNotify={() => updateMemberPermissions(entry.membership.id, { notify_on_changes: !entry.membership.notify_on_changes })}
            />
          ))}
        </div>
      )}

      {/* ── Crear (solo si es Premium y no tiene ya uno propio) ── */}
      {!ownedEntry && (
        <Card>
          <div className={styles.cardPadding}>
            {!profile.is_premium ? (
              <>
                <div className={styles.premiumTitle}>
                  Obtén Premium para crear un Espacio Compartido
                </div>
                <div className={styles.premiumDescription}>
                  Lleva el control de gastos con tu pareja, tus roomies, o quien tú quieras — hasta 2 personas más, en un espacio aparte de tu cuenta personal.
                </div>
              </>
            ) : !creating ? (
              <button onClick={() => setCreating(true)} className={styles.createSpaceButton}>
                <Plus size={16} /> Crear Espacio Compartido
              </button>
            ) : (
              <>
                <label className="field-label">Nombre del espacio</label>
                <input className={`field-input ${styles.fieldMb16}`} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej. Depa con Ale" />
                <label className={`field-label ${styles.labelBlock}`}>Periodo de cobro</label>
                <div className={styles.fieldMb16}>
                  <CobroPeriodFields
                    freq={newFreq} day1={newDay1} day2={newDay2} weekday={newWeekday}
                    onChangeFreq={setNewFreq} onChangeDay1={setNewDay1} onChangeDay2={setNewDay2} onChangeWeekday={setNewWeekday}
                  />
                </div>
                {createError && <div className={styles.errorText}>{createError}</div>}
                <button onClick={handleCreate} disabled={createSaving} className={`btn-primary ${styles.createConfirmMb} ${createSaving ? styles.savingOpacity : ''}`}>
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
          <div className={styles.cardPadding}>
            <div className={styles.joinTitle}>Únete a un Espacio Compartido</div>
            <div className={styles.joinDescription}>El código de acceso debe tener 6 dígitos. Debe proporcionarlo el creador del espacio.</div>
            <input
              className={`field-input ${styles.joinCodeInput}`} inputMode="numeric" maxLength={6}
              value={joinCode} onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
            />
            {joinError && <div className={styles.errorText}>{joinError}</div>}
            <button onClick={handleJoin} disabled={joinSaving || joinCode.length !== 6} className={`btn-primary ${(joinSaving || joinCode.length !== 6) ? styles.disabledOpacity : ''}`}>
              {joinSaving ? 'Uniendo…' : 'Unirme'}
            </button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className={styles.joinMaxedCard}>
            Ya perteneces al máximo de 3 espacios compartidos como invitado.
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Fila plegable de un espacio donde te invitaron ──────────────────────────
const FREQ_LABEL = { weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual' }

function GuestSpaceRow({ entry, onLeave, onToggleNotify }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={styles.guestRowMargin}>
      <button
        onClick={() => setExpanded(v => !v)}
        className={`${styles.guestRowButton} ${expanded ? styles.guestRowButtonExpanded : ''}`}
      >
        <div className={styles.guestRowLeft}>
          <Users size={16} color="var(--text)" />
          <span className={styles.guestRowTitle}>{entry.space.name}</span>
        </div>
        {expanded ? <ChevronUp size={16} color="var(--text)" /> : <ChevronDown size={16} color="var(--text)" />}
      </button>

      {expanded && (
        <div className={styles.guestRowBody}>
          <div className={styles.guestRowPeriod}>
            Periodo: {FREQ_LABEL[entry.space.cobro_freq] || entry.space.cobro_freq}
          </div>
          <div className={`${styles.notifyRow} ${styles.notifyRowMb}`} onClick={onToggleNotify}>
            <div>
              <div className={styles.notifyRowTitle}>Notificarme de cambios</div>
              <div className={styles.notifyRowSubtitle}>Avisos cuando el dueño agregue, marque pagado, o elimine un pago aquí</div>
            </div>
            <Toggle on={entry.membership.notify_on_changes} />
          </div>
          <button onClick={onLeave} className={styles.smallDangerButton}>
            <LogOut size={12} /> Salir
          </button>
        </div>
      )}
    </div>
  )
}

// ── Panel de administración del espacio propio ──────────────────────────────
function OwnedSpacePanel({ entry, user, regenerateCode, updateMemberPermissions, updateSpaceConfig, removeMember, deleteSpace, clearSpaceData }) {
  const [expanded,      setExpanded]      = useState(false)
  const [copied,        setCopied]        = useState(false)
  const [regenerating,  setRegenerating]  = useState(false)
  const [nameInput,     setNameInput]     = useState(entry.space.name)
  const [dangerOpen,    setDangerOpen]    = useState(false)
  const [confirmExpel,  setConfirmExpel]  = useState(null)
  const [expelling,     setExpelling]     = useState(false)
  const [confirmClear,  setConfirmClear]  = useState(false)
  const [clearing,      setClearing]      = useState(false)
  const [dangerPassword,setDangerPassword]= useState('')
  const [dangerError,   setDangerError]   = useState('')
  const [dangerLoading, setDangerLoading] = useState(false)

  const guestMembers = entry.space.members?.filter?.(m => m.role === 'guest') || []

  async function handleCobroChange(updates) {
    await updateSpaceConfig(entry.space.id, updates)
  }

  async function handleNameBlur() {
    const trimmed = nameInput.trim()
    if (!trimmed) { setNameInput(entry.space.name); return }
    if (trimmed === entry.space.name) return
    await updateSpaceConfig(entry.space.id, { name: trimmed })
    showToast('Cambios guardados')
  }

  async function handleExpel(membershipId) {
    setExpelling(true)
    const { error } = await removeMember(membershipId)
    setExpelling(false)
    setConfirmExpel(null)
    if (error) showToast('No se pudo expulsar al invitado')
    else showToast('Invitado expulsado')
  }

  async function handleClearData() {
    setClearing(true)
    const { error } = await clearSpaceData(entry.space.id)
    setClearing(false)
    setConfirmClear(false)
    if (error) showToast('No se pudieron borrar los datos')
    else showToast('Pagos e ingresos del espacio borrados')
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
      <div className={styles.ownedWrapper}>
        <button
          onClick={() => setExpanded(v => !v)}
          className={`${styles.ownedHeaderButton} ${expanded ? styles.ownedHeaderButtonExpanded : ''}`}
        >
          <div className={styles.ownedHeaderLeft}>
            <Crown size={16} color="var(--premium-gold)" />
            <span className={styles.ownedHeaderTitle}>{entry.space.name}</span>
          </div>
          {expanded ? <ChevronUp size={18} color="var(--text)" /> : <ChevronDown size={18} color="var(--text)" />}
        </button>

        {expanded && (
          <div className={styles.ownedBody}>
            <div className={styles.fieldRow}>
              <label className="field-label">Nombre del espacio</label>
              <input
                className="field-input" value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={e => e.key === 'Enter' && e.target.blur()}
              />
            </div>

            <div className={styles.fieldRow}>
              <label className={`field-label ${styles.labelBlock}`}>Periodo de cobro</label>
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

            <div className={styles.fieldRow}>
              <label className="field-label">Código de acceso</label>
              <div className={styles.codeRow}>
                <div className={styles.codeDisplay}>
                  {entry.space.access_code}
                </div>
                <button onClick={copyCode} className={styles.codeIconButton}>
                  <Copy size={16} color="var(--text)" />
                </button>
                <button onClick={handleRegenerate} disabled={regenerating} className={`${styles.codeIconButton} ${regenerating ? styles.disabledOpacity : ''}`}>
                  <RefreshCw size={16} color="var(--text)" />
                </button>
              </div>
              {copied && <div className={styles.copiedText}>Copiado</div>}
              {(() => {
                const remaining = 2 - guestMembers.length
                if (remaining > 0) {
                  return <div className={styles.inviteHintText}>Puedes invitar a {remaining} usuario{remaining !== 1 ? 's' : ''} más</div>
                }
                return <div className={styles.spaceFullText}>Espacio lleno — expulsa a alguien para hacerle lugar a otra persona</div>
              })()}
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.notifyRow} onClick={() => updateMemberPermissions(entry.membership.id, { notify_on_changes: !entry.membership.notify_on_changes })}>
                <div>
                  <div className={styles.notifyRowTitle}>Notificarme de cambios</div>
                  <div className={styles.notifyRowSubtitle}>Avisos cuando tu invitado agregue, marque pagado, o elimine un pago aquí</div>
                </div>
                <Toggle on={entry.membership.notify_on_changes} />
              </div>
            </div>

            {guestMembers.length > 0 && guestMembers.map((m) => {
              const initials = (m.profile?.name || 'Invitado').slice(0, 2).toUpperCase()
              const isConfirming = confirmExpel === m.id
              return (
                <div key={m.id} className={styles.memberRow}>
                  <div className={styles.memberRowTop}>
                    <div className={styles.memberRowLeft}>
                      {m.profile?.avatar_url
                        ? <img src={m.profile.avatar_url} alt="" className={styles.memberAvatarImg} />
                        : <div className={styles.memberAvatarFallback}>{initials}</div>
                      }
                      <span className={styles.memberName}>{m.profile?.name || 'Invitado'}</span>
                    </div>
                    <button onClick={() => setConfirmExpel(m.id)} className={styles.smallDangerButton}>
                      <LogOut size={12} /> Expulsar
                    </button>
                  </div>

                  {isConfirming && (
                    <div className={styles.confirmBoxWrapper}>
                      <div className={styles.confirmBoxInner}>
                        <div className={styles.confirmBoxText}>
                          ¿Expulsar a {m.profile?.name || 'este invitado'}? Sus pagos ya agregados se quedan en el espacio.
                        </div>
                        <div className={styles.confirmButtonsRow}>
                          <button onClick={() => setConfirmExpel(null)} className={styles.confirmCancelButton}>
                            Cancelar
                          </button>
                          <button onClick={() => handleExpel(m.id)} disabled={expelling} className={`${styles.confirmDangerButton} ${expelling ? styles.savingOpacity : ''}`}>
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
                  <NotifToggle label="Agregar ingresos extra" value={m.can_add_income} onChange={v => updateMemberPermissions(m.id, { can_add_income: v })} />
                  <NotifToggle label="Añadir fondos al Fondo Compartido" value={m.can_add_funds} onChange={v => updateMemberPermissions(m.id, { can_add_funds: v })} last />
                </div>
              )
            })}

            <div className={styles.dangerSectionWrapper}>
              <button onClick={() => setConfirmClear(v => !v)} className={styles.dangerButtonRow}>
                <Trash2 size={16} color="var(--danger)" />
                <span className={styles.dangerButtonText}>Borrar todos los pagos e ingresos</span>
              </button>
              {confirmClear && (
                <div className={styles.confirmBoxWrapper}>
                  <div className={styles.confirmBoxInner}>
                    <div className={styles.confirmBoxText}>
                      Se borrarán TODOS los pagos e ingresos de "{entry.space.name}", sin poder deshacerlo. El espacio, el código y los miembros se quedan igual.
                    </div>
                    <div className={styles.confirmButtonsRow}>
                      <button onClick={() => setConfirmClear(false)} className={styles.confirmCancelButton}>
                        Cancelar
                      </button>
                      <button onClick={handleClearData} disabled={clearing} className={`${styles.confirmDangerButton} ${clearing ? styles.savingOpacity : ''}`}>
                        {clearing ? 'Borrando…' : 'Borrar todo'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.dangerSectionWrapper}>
              <button onClick={() => { setDangerOpen(true); setDangerPassword(''); setDangerError('') }} className={styles.dangerButtonRow}>
                <Trash2 size={16} color="var(--danger)" />
                <span className={styles.dangerButtonText}>Eliminar Espacio Compartido</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {dangerOpen && (
        <div onClick={e => e.target === e.currentTarget && setDangerOpen(false)} className={styles.deleteModalOverlay}>
          <div className={styles.deleteModalSheet}>
            <div className={styles.deleteModalTitle}>Eliminar Espacio Compartido</div>
            <div className={styles.deleteModalDescription}>
              Se borrará permanentemente para ti y para tu invitado — todos los pagos e ingresos del espacio, sin poder deshacerlo.
            </div>
            <label className={`field-label ${styles.labelBlock}`}>Confirma con tu contraseña</label>
            <input
              type="password" className={`field-input ${styles.deleteModalPasswordInput}`} value={dangerPassword}
              onChange={e => setDangerPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDelete()}
              placeholder="••••••••"
            />
            {dangerError && <div className={styles.errorText}>{dangerError}</div>}
            <button
              onClick={handleDelete}
              disabled={dangerLoading || !dangerPassword}
              className={`${styles.deleteModalConfirmButton} ${(dangerLoading || !dangerPassword) ? styles.savingOpacity : ''}`}
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
