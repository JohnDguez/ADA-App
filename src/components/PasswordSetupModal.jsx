import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { RequirementRow } from './RequirementRow'
import styles from './PasswordSetupModal.module.css'

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
  const [showPass, setShowPass] = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const reqs   = passwordRequirements(password)
  const strong = isPasswordStrong(password)
  const match  = password && confirm && password === confirm

  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [])

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

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Encabezado */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            {t('passwordSetupModal.title')}
          </div>
          <div className={styles.headerDescription}>
            {t('passwordSetupModal.description')}
          </div>
        </div>

        {error && (
          <div className={styles.errorBox}>
            {error}
          </div>
        )}

        {/* Campo contraseña */}
        <div className={styles.passwordField}>
          <label className={styles.fieldLabel}>
            {t('passwordSetupModal.passwordLabel')}
          </label>
          <div className={styles.inputWrapper}>
            <div className={styles.inputIconLeft}>
              <Lock size={15} color="var(--text)" />
            </div>
            <input
              autoFocus
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`field-input ${styles.input}`}
            />
            <button type="button" onClick={() => setShowPass(v => !v)} className={styles.toggleVisibilityButton}>
              {showPass ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
            </button>
          </div>
        </div>

        {/* Requisitos */}
        {password.length > 0 && (
          <div className={styles.requirementsBox}>
            <RequirementRow met={reqs.length}    label={t('settingsAccount.editModal.requirementLength')} />
            <RequirementRow met={reqs.uppercase} label={t('settingsAccount.editModal.requirementUppercase')} />
            <RequirementRow met={reqs.number}    label={t('settingsAccount.editModal.requirementNumber')} />
            <RequirementRow met={reqs.symbol}    label={t('settingsAccount.editModal.requirementSymbol')} />
          </div>
        )}

        {/* Campo confirmar */}
        <div className={styles.confirmField}>
          <label className={styles.fieldLabel}>
            {t('passwordSetupModal.confirmLabel')}
          </label>
          <div className={styles.inputWrapper}>
            <div className={styles.inputIconLeft}>
              <Lock size={15} color="var(--text)" />
            </div>
            <input
              type={showConf ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder={t('passwordSetupModal.confirmPlaceholder')}
              className={`field-input ${styles.input} ${confirm && !match ? styles.inputError : ''}`}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <button type="button" onClick={() => setShowConf(v => !v)} className={styles.toggleVisibilityButton}>
              {showConf ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
            </button>
          </div>
          {confirm && !match && (
            <div className={styles.matchError}>{t('settingsAccount.editModal.passwordMismatch')}</div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={loading || !strong || !match}
          className="btn-primary"
        >
          {loading ? t('settingsCategories.saving') : t('passwordSetupModal.submit')}
        </button>
      </div>
    </div>
  )
}
