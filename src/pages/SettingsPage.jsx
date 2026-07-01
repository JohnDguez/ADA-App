import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { WEEKDAYS_SHORT } from '../lib/utils'
import { ChevronRight, LogOut, Camera, Bell, BellOff, AlertTriangle, Eye, EyeOff, Check, X } from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { showToast } from '../components/Toast'
import { passwordRequirements, isPasswordStrong } from '../components/PasswordSetupModal'

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

export function SettingsPage({ profile, user, onUpdate, onUploadAvatar, onDataDeleted, slideClass }) {
  const [salaryAmount,    setSalaryAmount]    = useState(profile.salary_amount || '')
  const [editSection,     setEditSection]     = useState(null)
  const [fieldVal,        setFieldVal]        = useState('')
  const [fieldVal2,       setFieldVal2]       = useState('')
  const [fieldVal3,       setFieldVal3]       = useState('')
  const [showPass,        setShowPass]        = useState(false)
  const [showPass2,       setShowPass2]       = useState(false)
  const [showPass3,       setShowPass3]       = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [editError,       setEditError]       = useState('')
  const [forgotSent,      setForgotSent]      = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [dangerModal,     setDangerModal]     = useState(null)
  const [dangerPassword,  setDangerPassword]  = useState('')
  const [showDangerPass,  setShowDangerPass]  = useState(false)
  const [dangerLoading,   setDangerLoading]   = useState(false)
  const [dangerError,     setDangerError]     = useState('')
  const [biweeklyCustom,  setBiweeklyCustom]  = useState(() => {
    const PRESETS = [{ d1: 1, d2: 16 }, { d1: 13, d2: 28 }, { d1: 15, d2: 30 }]
    return !PRESETS.some(p => p.d1 === (profile.cobro_day1 ?? 1) && p.d2 === (profile.cobro_day2 ?? 16))
  })

  const fileRef  = useRef(null)
  const initials = (profile.name || user?.email || 'U').slice(0, 2).toUpperCase()
  const isGoogle = user?.app_metadata?.provider === 'google'

  const { subscribed, subscribe, unsubscribe } = usePushNotifications(user?.id)

  const BIWEEKLY_PRESETS = [
    { label: '1 y 16',  d1: 1,  d2: 16 },
    { label: '13 y 28', d1: 13, d2: 28 },
    { label: '15 y 30', d1: 15, d2: 30 },
  ]

  const newPassReqs   = passwordRequirements(fieldVal)
  const newPassStrong = isPasswordStrong(fieldVal)
  const newPassMatch  = fieldVal && fieldVal2 && fieldVal === fieldVal2

  useEffect(() => {
    if (dangerModal || editSection) document.body.classList.add('modal-open')
    else                            document.body.classList.remove('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [dangerModal, editSection])

  function isCustomBiweekly() {
    return !BIWEEKLY_PRESETS.some(p => p.d1 === (profile.cobro_day1 ?? 1) && p.d2 === (profile.cobro_day2 ?? 16))
  }

  async function handleFreq(freq)     { await onUpdate({ cobro_freq: freq }) }
  async function handleWeekday(day)   { await onUpdate({ cobro_weekday: day }) }
  async function handleSalaryToggle() { await onUpdate({ salary_enabled: !profile.salary_enabled }) }
  async function handleSalaryAmount() {
    const val = parseFloat(salaryAmount)
    if (isNaN(val)) { showToast('Ingresa un monto válido'); return }
    await onUpdate({ salary_amount: val }); showToast('Salario actualizado')
  }

  async function verifyCurrentPassword(password) {
    const email = user?.email
    if (!email || !password) return false
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return !error
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

  async function handleLogout() {
    sessionStorage.removeItem('ada_tab')
    sessionStorage.removeItem('ada_session')
    sessionStorage.removeItem('ada_user_id')
    await supabase.auth.signOut()
  }

  async function handlePushToggle() {
    if (subscribed) {
      await unsubscribe(); showToast('Notificaciones desactivadas')
    } else {
      const { error } = await subscribe()
      if (error === 'Permiso denegado') showToast('Permiso denegado — actívalo en ajustes del navegador')
      else if (error) showToast('Error al activar notificaciones')
      else showToast('Notificaciones activadas')
    }
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

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const { error } = await onUploadAvatar(file)
    setUploadingAvatar(false)
    if (error) showToast(error.message || 'Error al subir imagen')
    else showToast('Foto actualizada')
  }

  return (
    <>
      {/* ── Contenido principal (animado) ── */}
      <div className={slideClass} style={{ paddingBottom: 120, background: 'var(--bg)', minHeight: '100vh' }}>
        <div style={{ padding: '52px 16px 20px' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Perfil</div>
        </div>

        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ position: 'relative' }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="avatar" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: 'var(--surface)' }}>{initials}</div>
            }
            <button onClick={() => fileRef.current?.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: 'var(--surface)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              {uploadingAvatar
                ? <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent' }} />
                : <Camera size={14} color="var(--text)" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginTop: 10 }}>{profile.name}</div>
          <div style={{ fontSize: 13, fontWeight: 400, color: 'var(--text)' }}>{user?.email}</div>
        </div>

        {/* Cuenta */}
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

        {/* Periodo de cobro */}
        <SectionLabel>Periodo de cobro</SectionLabel>
        <Card>
          <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Frecuencia</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['weekly','Semanal'],['biweekly','Quincenal'],['monthly','Mensual']].map(([val, label]) => (
                <button key={val} onClick={() => handleFreq(val)} style={{ flex: 1, padding: '8px 0', borderRadius: 5, border: 'none', background: profile.cobro_freq === val ? 'var(--accent)' : 'var(--bg)', color: profile.cobro_freq === val ? 'var(--surface)' : 'var(--text)', fontWeight: profile.cobro_freq === val ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {profile.cobro_freq === 'weekly' && (
            <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Día de cobro</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {WEEKDAYS_SHORT.map((day, i) => (
                  <button key={i} onClick={() => handleWeekday(i)}
                    style={{ width: 38, height: 38, borderRadius: 5, border: 'none', background: profile.cobro_weekday === i ? 'var(--accent)' : 'var(--bg)', color: profile.cobro_weekday === i ? 'var(--surface)' : 'var(--text)', fontWeight: profile.cobro_weekday === i ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {profile.cobro_freq === 'biweekly' && (
            <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Días de cobro</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {BIWEEKLY_PRESETS.map(p => (
                  <button key={p.label} onClick={() => { onUpdate({ cobro_day1: p.d1, cobro_day2: p.d2 }); setBiweeklyCustom(false) }}
                    style={{ padding: '7px 12px', borderRadius: 5, border: 'none', background: !isCustomBiweekly() && profile.cobro_day1 === p.d1 && profile.cobro_day2 === p.d2 ? 'var(--accent)' : 'var(--bg)', color: !isCustomBiweekly() && profile.cobro_day1 === p.d1 && profile.cobro_day2 === p.d2 ? 'var(--surface)' : 'var(--text)', fontWeight: !isCustomBiweekly() && profile.cobro_day1 === p.d1 && profile.cobro_day2 === p.d2 ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                    {p.label}
                  </button>
                ))}
                <button onClick={() => setBiweeklyCustom(true)}
                  style={{ padding: '7px 12px', borderRadius: 5, border: 'none', background: isCustomBiweekly() ? 'var(--accent)' : 'var(--bg)', color: isCustomBiweekly() ? 'var(--surface)' : 'var(--text)', fontWeight: isCustomBiweekly() ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                  Otro
                </button>
              </div>
              {isCustomBiweekly() && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Día 1 (1–31)</label>
                    <input type="number" min="1" max="31" defaultValue={profile.cobro_day1 ?? ''} onBlur={e => { const v = Math.min(31, Math.max(1, parseInt(e.target.value)||1)); e.target.value=v; onUpdate({ cobro_day1: v }) }} placeholder="ej. 13" className="field-input" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Día 2 (1–31)</label>
                    <input type="number" min="1" max="31" defaultValue={profile.cobro_day2 ?? ''} onBlur={e => { const v = Math.min(31, Math.max(1, parseInt(e.target.value)||1)); e.target.value=v; onUpdate({ cobro_day2: v }) }} placeholder="ej. 28" className="field-input" />
                  </div>
                </div>
              )}
            </div>
          )}

          {profile.cobro_freq === 'monthly' && (
            <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Día de cobro</div>
              <input type="number" min="1" max="31" defaultValue={profile.cobro_day1 ?? 1} onBlur={e => onUpdate({ cobro_day1: parseInt(e.target.value) || 1 })} placeholder="ej. 5" className="field-input" style={{ maxWidth: 120 }} />
              {profile.cobro_day1 && (
                <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text)', marginTop: 6 }}>
                  Tu periodo de cobro empieza el día <strong>{profile.cobro_day1}</strong> de cada mes.
                </div>
              )}
            </div>
          )}

          <Row label="Moneda" value="MXN $" last />
        </Card>

        {/* Ingreso */}
        <SectionLabel>Ingreso por periodo</SectionLabel>
        <Card>
          <div style={{ padding: '13px 14px', borderBottom: profile.salary_enabled ? '0.5px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={handleSalaryToggle}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Ingreso por periodo</div>
                <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 1 }}>Activa para ver alertas de presupuesto</div>
              </div>
              <Toggle on={profile.salary_enabled} />
            </div>
          </div>
          {profile.salary_enabled && (
            <div style={{ padding: '13px 14px' }}>
              <label className="field-label">Monto</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <input type="number" value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} placeholder="0.00" className="field-input" style={{ flex: 1 }} />
                <button onClick={handleSalaryAmount} className="btn-primary" style={{ width: 'auto', padding: '0 16px' }}>Guardar</button>
              </div>
            </div>
          )}
        </Card>

        {/* Notificaciones */}
        <SectionLabel>Notificaciones</SectionLabel>
        <Card>
          <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={handlePushToggle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {subscribed ? <Bell size={18} color="var(--accent)" /> : <BellOff size={18} color="var(--text)" />}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{subscribed ? 'Notificaciones activas' : 'Activar notificaciones'}</div>
                  <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 1 }}>
                    {subscribed ? 'Recibes alertas en este dispositivo' : 'Recibe recordatorios de pagos'}
                  </div>
                </div>
              </div>
              <Toggle on={subscribed} />
            </div>
          </div>

          {subscribed && (<>
            <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Hora de notificación</div>
              <select value={profile.notif_hour ?? 8} onChange={e => onUpdate({ notif_hour: parseInt(e.target.value), notif_last_sent: null })} className="field-input" style={{ maxWidth: 140 }}>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i === 0 ? '12:00 am' : i < 12 ? `${i}:00 am` : i === 12 ? '12:00 pm' : `${i - 12}:00 pm`}</option>
                ))}
              </select>
            </div>

            <NotifToggle label="Pagos vencidos"  sub="Cuando un pago no se cubrió a tiempo"    value={profile.notif_overdue    !== false} onChange={v => onUpdate({ notif_overdue:    v })} />
            <NotifToggle label="Vencen hoy"      sub="Pagos que llegan a su fecha límite hoy"  value={profile.notif_due_today  !== false} onChange={v => onUpdate({ notif_due_today:  v })} />
            <NotifToggle label="Próximos pagos"  sub="Recordatorio días antes del vencimiento" value={profile.notif_upcoming   !== false} onChange={v => onUpdate({ notif_upcoming:   v })} />

            {profile.notif_upcoming !== false && (
              <div style={{ padding: '0 14px 13px' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>Días de anticipación</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 5, 7].map(d => (
                    <button key={d} onClick={() => onUpdate({ notif_days_before: d })}
                      style={{ width: 36, height: 36, borderRadius: 5, border: 'none', background: (profile.notif_days_before ?? 3) === d ? 'var(--accent)' : 'var(--bg)', color: (profile.notif_days_before ?? 3) === d ? 'var(--surface)' : 'var(--text)', fontWeight: (profile.notif_days_before ?? 3) === d ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <NotifToggle label="Día de cobro" sub="Resumen de pagos pendientes al cobrar" value={profile.notif_cobro_day !== false} onChange={v => onUpdate({ notif_cobro_day: v })} last />
          </>)}
        </Card>

        {/* Sesión */}
        <SectionLabel>Sesión</SectionLabel>
        <Card>
          <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer' }}>
            <LogOut size={16} color="var(--danger)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>Cerrar sesión</span>
          </button>
        </Card>

        {/* Zona de peligro */}
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

        {/* Versión */}
        <div style={{ textAlign: 'center', padding: '8px 0 24px', fontSize: 11, fontWeight: 500, color: 'var(--text)', opacity: 0.4 }}>
          ADA Pay v0.9.19 — Alpha
        </div>
      </div>

      {/* ── Modales fuera del div animado ──────────────────────────────────────────
          IMPORTANTE: los modales van aquí, FUERA del div con slideClass.
          Dentro del div animado, `transform` crea stacking context y atrapa
          los `position:fixed` hijos. Al sacarlos, el z-index funciona correctamente.
      ─────────────────────────────────────────────────────────────────────────── */}

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

function Card({ children }) {
  return <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', margin: '0 16px 12px', overflow: 'hidden' }}>{children}</div>
}
function SectionLabel({ children }) {
  return <div style={{ padding: '8px 20px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</div>
}
function Row({ label, value, onClick, last }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', borderBottom: last ? 'none' : '0.5px solid var(--border)', cursor: onClick ? 'pointer' : 'default' }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text)' }}>{value}</span>
        {onClick && <ChevronRight size={14} color="var(--text)" />}
      </div>
    </div>
  )
}
function Toggle({ on }) {
  return (
    <div className="toggle-track" style={{ background: on ? 'var(--accent)' : 'var(--border)', flexShrink: 0 }}>
      <div className="toggle-thumb" style={{ left: on ? 19 : 3 }} />
    </div>
  )
}
function NotifToggle({ label, sub, value, onChange, last }) {
  return (
    <div onClick={() => onChange(!value)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: last ? 'none' : '0.5px solid var(--border)', cursor: 'pointer' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 1 }}>{sub}</div>
      </div>
      <Toggle on={value} />
    </div>
  )
}
