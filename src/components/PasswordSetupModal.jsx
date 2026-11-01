import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Modal } from './Modal'
import { PasswordField, PasswordReqs } from './PasswordField'
import mk from './Modal.module.css'

// ── Validador de fortaleza de contraseña ─────────────────────────────────────
export function passwordRequirements(pwd) {
  return {
    length:    pwd.length >= 8,
    uppercase: /[A-Z]/.test(pwd),
    number:    /[0-9]/.test(pwd),
    symbol:    /[^A-Za-z0-9]/.test(pwd),
  }
}

export function isPasswordStrong(pwd) {
  const r = passwordRequirements(pwd)
  return r.length && r.uppercase && r.number && r.symbol
}

// ── Modal de configuración de contraseña (Google users) ──────────────────────
export function PasswordSetupModal({ userId, onDone }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const strong = isPasswordStrong(password)
  const match  = password && confirm && password === confirm

  async function handleSave() {
    setError('')
    if (!strong) { setError(t('passwordSetupModal.notStrong')); return }
    if (!match)  { setError(t('settingsAccount.editModal.passwordMismatch')); return }

    setLoading(true)
    const { error: updErr } = await supabase.auth.updateUser({ password })
    if (updErr) { setError(updErr.message); setLoading(false); return }

    await supabase.from('profiles').update({ has_password: true }).eq('id', userId)
    setLoading(false)
    onDone()
  }

  // Diseño nuevo (v0.9.984): <Modal> sin ✕ ni cierre por fondo (es
  // obligatorio crearla para seguir).
  return (
    <Modal open onClose={null} layout="confirm" icon={Lock} title={t('passwordSetupModal.title')} desc={t('passwordSetupModal.description')}
      width={460} backClose={false} closeButton={false}
      actions={[{ label: loading ? t('settingsCategories.saving') : t('passwordSetupModal.submit'), onClick: handleSave, disabled: loading || !strong || !match }]}>
      <div className={`${mk.pan} ${mk.panFlat}`}>
        {error && <div className={mk.err}>{error}</div>}
        <div className={mk.lab}><span>{t('passwordSetupModal.passwordLabel')}</span></div>
        <PasswordField value={password} onChange={setPassword} label={t('passwordSetupModal.passwordLabel')} autoFocus />
        {password.length > 0 && <PasswordReqs password={password} />}
        <div className={mk.lab}><span>{t('passwordSetupModal.confirmLabel')}</span></div>
        <PasswordField value={confirm} onChange={setConfirm} label={t('passwordSetupModal.confirmLabel')} placeholder={t('passwordSetupModal.confirmPlaceholder')} bad={!!confirm && !match} onEnter={handleSave} />
        {confirm && !match && <div className={mk.err}>{t('settingsAccount.editModal.passwordMismatch')}</div>}
      </div>
    </Modal>
  )
}
