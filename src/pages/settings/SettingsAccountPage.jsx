import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ChevronLeft, ChevronRight, AlertTriangle, Eye, EyeOff, Check, X } from 'lucide-react'
import { showToast } from '../../components/Toast'
import { passwordRequirements, isPasswordStrong } from '../../components/PasswordSetupModal'
import { Card, Row, SectionLabel } from '../../components/SettingsShared'

function RequirementRow({ met, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
        background: met ? 'var(--paid)' : 'var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background .15s',
      }}>
        {met ? <Check size={10} color="#fff" strokeWidth={3} /> : <X size={10} color="var(--text)" strokeWidth={2.5} />}
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
    </div>
  )
}

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
      <div className={slideClass} style={{ paddingBottom: 120, background: 'var(--bg)', minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '52px 16px 20px' }}>
          <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <ChevronLeft size={18} color="var(--text)" />
          </button>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Cuenta</div>
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
          <button onClick={() => { setDangerModal('data'); setDangerPassword(''); setDangerError('') }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>Eliminar todos mis datos</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 1 }}>Borra todos tus pagos e ingresos. Tu cuenta se mantiene.</div>
            </div>
            <ChevronRight size={14} color="var(--danger)" />
          </button>
          <button onClick={() => { setDangerModal('account'); setDangerPassword(''); setDangerError('') }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>Eliminar mi cuenta</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 1 }}>Elimina tu cuenta y todos tus datos permanentemente.</div>
            </div>
            <ChevronRight size={14} color="var(--danger)" />
          </button>
        </Card>
      </div>

      {dangerModal && (
        <div onClick={e => e.target === e.currentTarget && setDangerModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, padding: '20px 16px 32px', animation: 'modalSlideUp .3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both' }}>
            <div style={{ width: 34, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--danger-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <AlertTriangle size={22} color="var(--danger)" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger)', marginBottom: 6 }}>
              {dangerModal === 'data' ? 'Eliminar todos los datos' : 'Eliminar cuenta'}
            </div>
            <div style={{ fontSize: 13, fontWeight: 400, color: 'var(--text)', marginBottom: 16, lineHeight: 1.6 }}>
              {dangerModal === 'data'
                ? 'Esta acción eliminará todos tus pagos e ingresos permanentemente. Tu cuenta se mantendrá activa. Esta acción no se puede deshacer.'
                : 'Esta acción eliminará tu cuenta y todos tus datos permanentemente. No podrás recuperarlos. Esta acción no se puede deshacer.'
              }
            </div>
            {dangerError && (
              <div style={{ background: 'var(--danger-soft)', border: '0.5px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
                {dangerError}
              </div>
            )}
            <label className="field-label" style={{ marginBottom: 6, display: 'block' }}>Confirma con tu contraseña</label>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <input
                autoFocus
                type={showDangerPass ? 'text' : 'password'}
                className="field-input"
                value={dangerPassword}
                onChange={e => setDangerPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && (dangerModal === 'data' ? handleDeleteData() : handleDeleteAccount())}
                style={{ borderColor: 'var(--danger-border)', paddingRight: 40 }}
              />
              <button type="button" onClick={() => setShowDangerPass(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
                {showDangerPass ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
              </button>
            </div>
            <button
              onClick={dangerModal === 'data' ? handleDeleteData : handleDeleteAccount}
              disabled={dangerLoading || !dangerPassword}
              style={{ width: '100%', padding: 12, background: 'var(--danger)', color: 'var(--surface)', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', marginBottom: 8, opacity: dangerLoading || !dangerPassword ? 0.7 : 1 }}>
              {dangerLoading ? 'Verificando…' : dangerModal === 'data' ? 'Eliminar todos mis datos' : 'Eliminar mi cuenta'}
            </button>
            <button onClick={() => { setDangerModal(null); setDangerPassword('') }} className="btn-ghost">Cancelar</button>
          </div>
        </div>
      )}

      {editSection && (
        <div onClick={e => e.target === e.currentTarget && setEditSection(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, padding: '20px 16px 32px', animation: 'modalSlideUp .3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both' }}>
            <div style={{ width: 34, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
              {editSection === 'name' ? 'Editar nombre' : editSection === 'email' ? 'Cambiar correo' : 'Cambiar contraseña'}
            </div>

            {editError  && <div style={{ background: 'var(--danger-soft)', border: '0.5px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{editError}</div>}
            {forgotSent && <div style={{ background: 'var(--paid-soft)', border: '0.5px solid var(--paid-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13, color: 'var(--paid)', marginBottom: 12 }}>Te enviamos un enlace a {user?.email}</div>}

            {editSection === 'name' && (
              <div style={{ marginBottom: 14 }}>
                <label className="field-label">Nombre</label>
                <input autoFocus className="field-input" value={fieldVal} onChange={e => setFieldVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEditSave()} />
              </div>
            )}

            {editSection === 'email' && (
              <div style={{ marginBottom: 14 }}>
                <label className="field-label">Nuevo correo</label>
                <input autoFocus className="field-input" type="email" value={fieldVal} onChange={e => setFieldVal(e.target.value)} />
              </div>
            )}

            {editSection === 'password' && (<>
              <div style={{ marginBottom: 12 }}>
                <label className="field-label">Contraseña actual</label>
                <div style={{ position: 'relative' }}>
                  <input autoFocus className="field-input" type={showPass3 ? 'text' : 'password'} value={fieldVal3} onChange={e => setFieldVal3(e.target.value)} placeholder="••••••••" style={{ paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowPass3(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
                    {showPass3 ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
                  </button>
                </div>
                <button onClick={handleForgotPassword} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', marginTop: 6, fontFamily: 'DM Sans, sans-serif', padding: 0 }}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <div style={{ marginBottom: 8 }}>
                <label className="field-label">Nueva contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input className="field-input" type={showPass ? 'text' : 'password'} value={fieldVal} onChange={e => setFieldVal(e.target.value)} placeholder="••••••••" style={{ paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
                    {showPass ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
                  </button>
                </div>
              </div>

              {fieldVal.length > 0 && (
                <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 10 }}>
                  <RequirementRow met={newPassReqs.length}    label="Mínimo 8 caracteres" />
                  <RequirementRow met={newPassReqs.uppercase} label="Al menos una mayúscula" />
                  <RequirementRow met={newPassReqs.number}    label="Al menos un número" />
                  <RequirementRow met={newPassReqs.symbol}    label="Al menos un símbolo especial (!@#$...)" />
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label className="field-label">Confirmar nueva contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input className="field-input" type={showPass2 ? 'text' : 'password'} value={fieldVal2} onChange={e => setFieldVal2(e.target.value)} placeholder="••••••••" style={{ paddingRight: 40, borderColor: fieldVal2 && !newPassMatch ? 'var(--danger)' : undefined }} />
                  <button type="button" onClick={() => setShowPass2(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
                    {showPass2 ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
                  </button>
                </div>
                {fieldVal2 && !newPassMatch && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Las contraseñas no coinciden</div>}
              </div>
            </>)}

            <button onClick={handleEditSave} disabled={saving} className="btn-primary" style={{ marginBottom: 8 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setEditSection(null)} className="btn-ghost">Cancelar</button>
          </div>
        </div>
      )}
    </>
  )
}
