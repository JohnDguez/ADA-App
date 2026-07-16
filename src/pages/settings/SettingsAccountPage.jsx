import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ChevronLeft, ChevronRight, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { showToast } from '../../components/Toast'
import { passwordRequirements, isPasswordStrong } from '../../components/PasswordSetupModal'
import { RequirementRow } from '../../components/RequirementRow'
import { Card, Row, SectionLabel } from '../../components/SettingsShared'
import styles from './SettingsAccountPage.module.css'

// Sub-página "Cuenta" dentro de Ajustes: Nombre, Correo/Google, Contraseña, y
// la zona de peligro (Eliminar mis datos / Eliminar mi cuenta). Antes vivía
// todo esto mezclado directo en SettingsPage.jsx.
export function SettingsAccountPage({ profile, user, onUpdate, onDataDeleted, onBack, slideClass }) {
  const [editSection, setEditSection] = useState(null)
  const [fieldVal,    setFieldVal]    = useState('')
  const [fieldVal2,   setFieldVal2]   = useState('')
  const [fieldVal3,   setFieldVal3]   = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [showPass2,   setShowPass2]   = useState(false)
  const [showPass3,   setShowPass3]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [editError,   setEditError]   = useState('')
  const [forgotSent,  setForgotSent]  = useState(false)

  const [dangerModal,    setDangerModal]    = useState(null)
  const [dangerPassword, setDangerPassword] = useState('')
  const [showDangerPass, setShowDangerPass] = useState(false)
  const [dangerLoading,  setDangerLoading]  = useState(false)
  const [dangerError,    setDangerError]    = useState('')

  const isGoogle = user?.app_metadata?.provider === 'google'

  const newPassReqs   = passwordRequirements(fieldVal)
  const newPassStrong = isPasswordStrong(fieldVal)
  const newPassMatch  = fieldVal && fieldVal2 && fieldVal === fieldVal2

  useEffect(() => {
    if (dangerModal || editSection) document.body.classList.add('modal-open')
    else                            document.body.classList.remove('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [dangerModal, editSection])

  async function verifyCurrentPassword(password) {
    const email = user?.email
    if (!email || !password) return false
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return !error
  }

  function openEdit(section) {
    setEditSection(section)
    setFieldVal(section === 'name' ? profile.name || '' : section === 'email' ? user?.email || '' : '')
    setFieldVal2(''); setFieldVal3(''); setEditError(''); setForgotSent(false)
    setShowPass(false); setShowPass2(false); setShowPass3(false)
  }

  async function handleEditSave() {
    setEditError(''); setSaving(true)
    if (editSection === 'name') {
      if (!fieldVal.trim()) { setEditError('Escribe un nombre'); setSaving(false); return }
      await onUpdate({ name: fieldVal.trim() }); showToast('Nombre actualizado')
    } else if (editSection === 'email') {
      if (!fieldVal.trim()) { setEditError('Escribe un correo'); setSaving(false); return }
      const { error } = await supabase.auth.updateUser({ email: fieldVal.trim() })
      if (error) { setEditError(error.message); setSaving(false); return }
      showToast('Correo actualizado — revisa tu bandeja')
    } else if (editSection === 'password') {
      if (!fieldVal3) { setEditError('Ingresa tu contraseña actual'); setSaving(false); return }
      if (!newPassStrong) { setEditError('La nueva contraseña no cumple los requisitos'); setSaving(false); return }
      if (!newPassMatch)  { setEditError('Las contraseñas no coinciden'); setSaving(false); return }
      const valid = await verifyCurrentPassword(fieldVal3)
      if (!valid) { setEditError('Contraseña actual incorrecta'); setSaving(false); return }
      const { error } = await supabase.auth.updateUser({ password: fieldVal })
      if (error) { setEditError(error.message); setSaving(false); return }
      showToast('Contraseña actualizada')
    }
    setSaving(false); setEditSection(null)
  }

  async function handleForgotPassword() {
    await supabase.auth.resetPasswordForEmail(user?.email)
    setForgotSent(true)
  }

  async function handleDeleteData() {
    setDangerError('')
    if (!dangerPassword) { setDangerError('Ingresa tu contraseña para confirmar'); return }
    setDangerLoading(true)
    const valid = await verifyCurrentPassword(dangerPassword)
    if (!valid) { setDangerError('Contraseña incorrecta'); setDangerLoading(false); return }
    const [paymentsRes, incomeRes] = await Promise.all([
      supabase.from('payments').delete().eq('user_id', user.id),
      supabase.from('period_income').delete().eq('user_id', user.id),
    ])
    setDangerLoading(false)
    if (paymentsRes.error || incomeRes.error) { setDangerError('Error al eliminar los datos'); return }
    setDangerModal(null); setDangerPassword('')
    onDataDeleted && onDataDeleted()
    showToast('Todos tus datos han sido eliminados')
  }

  async function handleDeleteAccount() {
    setDangerError('')
    if (!dangerPassword) { setDangerError('Ingresa tu contraseña para confirmar'); return }
    setDangerLoading(true)
    const valid = await verifyCurrentPassword(dangerPassword)
    if (!valid) { setDangerError('Contraseña incorrecta'); setDangerLoading(false); return }
    await Promise.all([
      supabase.from('payments').delete().eq('user_id', user.id),
      supabase.from('notifications').delete().eq('user_id', user.id),
      supabase.from('push_subscriptions').delete().eq('user_id', user.id),
      supabase.from('period_income').delete().eq('user_id', user.id),
    ])
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ userId: user.id }),
    })
    setDangerLoading(false)
    if (!res.ok) { setDangerError('Error al eliminar la cuenta'); return }
    sessionStorage.removeItem('ada_tab')
    sessionStorage.removeItem('ada_session')
    sessionStorage.removeItem('ada_user_id')
    await supabase.auth.signOut()
  }

  return (
    <>
      <div className={`${slideClass} ${styles.pageWrapper}`}>
        <div className={styles.header}>
          <button onClick={onBack} className={styles.backButton}>
            <ChevronLeft size={18} color="var(--text)" />
          </button>
          <div className={styles.headerTitle}>Cuenta</div>
        </div>

        <Card>
          <Row label="Nombre" value={profile.name} onClick={() => openEdit('name')} />
          {isGoogle
            ? <>
                <Row label="Cuenta" value="Google" />
                <Row label="Contraseña" value="••••••••" onClick={() => openEdit('password')} last />
              </>
            : <>
                <Row label="Correo" value={user?.email} onClick={() => openEdit('email')} />
                <Row label="Contraseña" value="••••••••" onClick={() => openEdit('password')} last />
              </>
          }
        </Card>

        <SectionLabel>Zona de peligro</SectionLabel>
        <Card>
          <button onClick={() => { setDangerModal('data'); setDangerPassword(''); setDangerError('') }} className={styles.dangerButton}>
            <div className={styles.dangerButtonText}>
              <div className={styles.dangerButtonTitle}>Eliminar todos mis datos</div>
              <div className={styles.dangerButtonSubtitle}>Borra todos tus pagos e ingresos. Tu cuenta se mantiene.</div>
            </div>
            <ChevronRight size={14} color="var(--danger)" />
          </button>
          <button onClick={() => { setDangerModal('account'); setDangerPassword(''); setDangerError('') }} className={styles.dangerButtonLast}>
            <div className={styles.dangerButtonText}>
              <div className={styles.dangerButtonTitle}>Eliminar mi cuenta</div>
              <div className={styles.dangerButtonSubtitle}>Elimina tu cuenta y todos tus datos permanentemente.</div>
            </div>
            <ChevronRight size={14} color="var(--danger)" />
          </button>
        </Card>
      </div>

      {dangerModal && (
        <div onClick={e => e.target === e.currentTarget && setDangerModal(null)} className={styles.dangerOverlay}>
          <div className={styles.modalPanel}>
            <div className={styles.handle} />
            <div className={styles.dangerIconWrapper}>
              <AlertTriangle size={22} color="var(--danger)" />
            </div>
            <div className={styles.dangerTitle}>
              {dangerModal === 'data' ? 'Eliminar todos los datos' : 'Eliminar cuenta'}
            </div>
            <div className={styles.dangerDescription}>
              {dangerModal === 'data'
                ? 'Esta acción eliminará todos tus pagos e ingresos permanentemente. Tu cuenta se mantendrá activa. Esta acción no se puede deshacer.'
                : 'Esta acción eliminará tu cuenta y todos tus datos permanentemente. No podrás recuperarlos. Esta acción no se puede deshacer.'
              }
            </div>
            {dangerError && (
              <div className={styles.errorBox}>
                {dangerError}
              </div>
            )}
            <label className={`field-label ${styles.label}`}>Confirma con tu contraseña</label>
            <div className={styles.inputWrapperSpaced}>
              <input
                autoFocus
                type={showDangerPass ? 'text' : 'password'}
                className={`field-input ${styles.dangerPasswordInput}`}
                value={dangerPassword}
                onChange={e => setDangerPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && (dangerModal === 'data' ? handleDeleteData() : handleDeleteAccount())}
              />
              <button type="button" onClick={() => setShowDangerPass(v => !v)} className={styles.toggleVisibilityButton}>
                {showDangerPass ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
              </button>
            </div>
            <button
              onClick={dangerModal === 'data' ? handleDeleteData : handleDeleteAccount}
              disabled={dangerLoading || !dangerPassword}
              className={styles.deleteConfirmButton}>
              {dangerLoading ? 'Verificando…' : dangerModal === 'data' ? 'Eliminar todos mis datos' : 'Eliminar mi cuenta'}
            </button>
            <button onClick={() => { setDangerModal(null); setDangerPassword('') }} className="btn-ghost">Cancelar</button>
          </div>
        </div>
      )}

      {editSection && (
        <div onClick={e => e.target === e.currentTarget && setEditSection(null)} className={styles.editOverlay}>
          <div className={styles.modalPanel}>
            <div className={styles.handle} />
            <div className={styles.editTitle}>
              {editSection === 'name' ? 'Editar nombre' : editSection === 'email' ? 'Cambiar correo' : 'Cambiar contraseña'}
            </div>

            {editError  && <div className={styles.errorBox}>{editError}</div>}
            {forgotSent && <div className={styles.successBox}>Te enviamos un enlace a {user?.email}</div>}

            {editSection === 'name' && (
              <div className={styles.fieldGroup}>
                <label className="field-label">Nombre</label>
                <input autoFocus className="field-input" value={fieldVal} onChange={e => setFieldVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEditSave()} />
              </div>
            )}

            {editSection === 'email' && (
              <div className={styles.fieldGroup}>
                <label className="field-label">Nuevo correo</label>
                <input autoFocus className="field-input" type="email" value={fieldVal} onChange={e => setFieldVal(e.target.value)} />
              </div>
            )}

            {editSection === 'password' && (<>
              <div className={styles.fieldGroupSm}>
                <label className="field-label">Contraseña actual</label>
                <div className={styles.inputWrapper}>
                  <input autoFocus className={`field-input ${styles.inputWithToggle}`} type={showPass3 ? 'text' : 'password'} value={fieldVal3} onChange={e => setFieldVal3(e.target.value)} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPass3(v => !v)} className={styles.toggleVisibilityButton}>
                    {showPass3 ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
                  </button>
                </div>
                <button onClick={handleForgotPassword} className={styles.forgotPasswordLink}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <div className={styles.fieldGroupXs}>
                <label className="field-label">Nueva contraseña</label>
                <div className={styles.inputWrapper}>
                  <input className={`field-input ${styles.inputWithToggle}`} type={showPass ? 'text' : 'password'} value={fieldVal} onChange={e => setFieldVal(e.target.value)} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPass(v => !v)} className={styles.toggleVisibilityButton}>
                    {showPass ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
                  </button>
                </div>
              </div>

              {fieldVal.length > 0 && (
                <div className={styles.requirementsBox}>
                  <RequirementRow met={newPassReqs.length}    label="Mínimo 8 caracteres" />
                  <RequirementRow met={newPassReqs.uppercase} label="Al menos una mayúscula" />
                  <RequirementRow met={newPassReqs.number}    label="Al menos un número" />
                  <RequirementRow met={newPassReqs.symbol}    label="Al menos un símbolo especial (!@#$...)" />
                </div>
              )}

              <div className={styles.fieldGroup}>
                <label className="field-label">Confirmar nueva contraseña</label>
                <div className={styles.inputWrapper}>
                  <input className={`field-input ${styles.inputWithToggle} ${fieldVal2 && !newPassMatch ? styles.inputError : ''}`} type={showPass2 ? 'text' : 'password'} value={fieldVal2} onChange={e => setFieldVal2(e.target.value)} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPass2(v => !v)} className={styles.toggleVisibilityButton}>
                    {showPass2 ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
                  </button>
                </div>
                {fieldVal2 && !newPassMatch && <div className={styles.matchError}>Las contraseñas no coinciden</div>}
              </div>
            </>)}

            <button onClick={handleEditSave} disabled={saving} className={`btn-primary ${styles.saveButton}`}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setEditSection(null)} className="btn-ghost">Cancelar</button>
          </div>
        </div>
      )}
    </>
  )
}
