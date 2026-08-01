import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { ChevronLeft, ChevronRight, AlertTriangle, Eye, EyeOff, Check } from 'lucide-react'
import { showToast } from '../../components/Toast'
import { passwordRequirements, isPasswordStrong } from '../../components/PasswordSetupModal'
import { RequirementRow } from '../../components/RequirementRow'
import { Card, Row, SectionLabel } from '../../components/SettingsShared'
import i18n, { resolveLanguage, LANGUAGE_STORAGE_KEY } from '../../i18n'
import styles from './SettingsAccountPage.module.css'

// Sub-página "Cuenta" dentro de Ajustes: Nombre, Correo/Google, Contraseña,
// Idioma, y la zona de peligro (Eliminar mis datos / Eliminar mi cuenta).
// Antes vivía todo esto (menos Idioma) mezclado directo en SettingsPage.jsx.
export function SettingsAccountPage({ profile, user, onUpdate, onDataDeleted, onBack, slideClass }) {
  const { t } = useTranslation()
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

  // Idioma: 'system' | 'es' | 'en' — vive en profiles.language (columna
  // agregada por Johnatan vía migración manual, ver
  // profiles_language_migration.sql entregado aparte). Mientras el
  // profile no la traiga (undefined), se asume 'system' — mismo default
  // que usa useProfile.js.
  const currentLanguage = profile.language || 'system'
  const LANGUAGE_OPTIONS = [
    { id: 'system', label: t('settingsAccount.languageModal.system') },
    { id: 'es',     label: t('settingsAccount.languageModal.spanish') },
    { id: 'en',     label: t('settingsAccount.languageModal.english') },
  ]

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
      if (!fieldVal.trim()) { setEditError(t('settingsAccount.toast.emptyName')); setSaving(false); return }
      await onUpdate({ name: fieldVal.trim() }); showToast(t('settingsAccount.toast.nameUpdated'))
    } else if (editSection === 'email') {
      if (!fieldVal.trim()) { setEditError(t('settingsAccount.toast.emptyEmail')); setSaving(false); return }
      const { error } = await supabase.auth.updateUser({ email: fieldVal.trim() })
      if (error) { setEditError(error.message); setSaving(false); return }
      showToast(t('settingsAccount.toast.emailUpdated'))
    } else if (editSection === 'password') {
      if (!fieldVal3) { setEditError(t('settingsAccount.toast.currentPasswordRequired')); setSaving(false); return }
      if (!newPassStrong) { setEditError(t('settingsAccount.toast.passwordRequirementsNotMet')); setSaving(false); return }
      if (!newPassMatch)  { setEditError(t('settingsAccount.editModal.passwordMismatch')); setSaving(false); return }
      const valid = await verifyCurrentPassword(fieldVal3)
      if (!valid) { setEditError(t('settingsAccount.toast.wrongCurrentPassword')); setSaving(false); return }
      const { error } = await supabase.auth.updateUser({ password: fieldVal })
      if (error) { setEditError(error.message); setSaving(false); return }
      showToast(t('settingsAccount.toast.passwordUpdated'))
    }
    setSaving(false); setEditSection(null)
  }

  async function handleForgotPassword() {
    await supabase.auth.resetPasswordForEmail(user?.email)
    setForgotSent(true)
  }

  // Idioma: aplica de inmediato al tocar una opción (sin botón "Guardar"
  // aparte, mismo patrón mockeado y confirmado con Johnatan) — guarda en
  // profiles.language, en localStorage (cache de arranque que ya lee
  // src/i18n/index.js) y cambia el idioma activo de i18next en el momento.
  async function handleLanguageSelect(langId) {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, langId)
    i18n.changeLanguage(resolveLanguage(langId))
    setEditSection(null)
    const { error } = await onUpdate({ language: langId })
    if (error) showToast(error.message || t('settingsAccount.toast.wrongPassword'))
    else showToast(t('settingsAccount.toast.languageUpdated'))
  }

  async function handleDeleteData() {
    setDangerError('')
    if (!dangerPassword) { setDangerError(t('settingsAccount.toast.confirmPasswordRequired')); return }
    setDangerLoading(true)
    const valid = await verifyCurrentPassword(dangerPassword)
    if (!valid) { setDangerError(t('settingsAccount.toast.wrongPassword')); setDangerLoading(false); return }
    const [paymentsRes, incomeRes] = await Promise.all([
      supabase.from('payments').delete().eq('user_id', user.id),
      supabase.from('period_income').delete().eq('user_id', user.id),
    ])
    setDangerLoading(false)
    if (paymentsRes.error || incomeRes.error) { setDangerError(t('settingsAccount.toast.deleteDataError')); return }
    setDangerModal(null); setDangerPassword('')
    onDataDeleted && onDataDeleted()
    showToast(t('settingsAccount.toast.allDataDeleted'))
  }

  async function handleDeleteAccount() {
    setDangerError('')
    if (!dangerPassword) { setDangerError(t('settingsAccount.toast.confirmPasswordRequired')); return }
    setDangerLoading(true)
    const valid = await verifyCurrentPassword(dangerPassword)
    if (!valid) { setDangerError(t('settingsAccount.toast.wrongPassword')); setDangerLoading(false); return }
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
    if (!res.ok) { setDangerError(t('settingsAccount.toast.deleteAccountError')); return }
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
          <div className={styles.headerTitle}>{t('settingsAccount.title')}</div>
        </div>

        <Card>
          <Row label={t('settingsAccount.row.name')} value={profile.name} onClick={() => openEdit('name')} />
          {isGoogle
            ? <>
                <Row label={t('settingsAccount.row.account')} value={t('settingsAccount.row.google')} />
                <Row label={t('settingsAccount.row.password')} value="••••••••" onClick={() => openEdit('password')} />
              </>
            : <>
                <Row label={t('settingsAccount.row.email')} value={user?.email} onClick={() => openEdit('email')} />
                <Row label={t('settingsAccount.row.password')} value="••••••••" onClick={() => openEdit('password')} />
              </>
          }
          <Row
            label={t('settingsAccount.row.language')}
            value={LANGUAGE_OPTIONS.find(o => o.id === currentLanguage)?.label}
            onClick={() => setEditSection('language')}
            last
          />
        </Card>

        <SectionLabel>{t('settingsAccount.dangerZone.label')}</SectionLabel>
        <Card>
          <button onClick={() => { setDangerModal('data'); setDangerPassword(''); setDangerError('') }} className={styles.dangerButton}>
            <div className={styles.dangerButtonText}>
              <div className={styles.dangerButtonTitle}>{t('settingsAccount.dangerZone.deleteDataTitle')}</div>
              <div className={styles.dangerButtonSubtitle}>{t('settingsAccount.dangerZone.deleteDataSubtitle')}</div>
            </div>
            <ChevronRight size={14} color="var(--danger)" />
          </button>
          <button onClick={() => { setDangerModal('account'); setDangerPassword(''); setDangerError('') }} className={styles.dangerButtonLast}>
            <div className={styles.dangerButtonText}>
              <div className={styles.dangerButtonTitle}>{t('settingsAccount.dangerZone.deleteAccountTitle')}</div>
              <div className={styles.dangerButtonSubtitle}>{t('settingsAccount.dangerZone.deleteAccountSubtitle')}</div>
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
              {dangerModal === 'data' ? t('settingsAccount.dangerModal.titleData') : t('settingsAccount.dangerModal.titleAccount')}
            </div>
            <div className={styles.dangerDescription}>
              {dangerModal === 'data'
                ? t('settingsAccount.dangerModal.descriptionData')
                : t('settingsAccount.dangerModal.descriptionAccount')
              }
            </div>
            {dangerError && (
              <div className={styles.errorBox}>
                {dangerError}
              </div>
            )}
            <label className={`field-label ${styles.label}`}>{t('settingsAccount.dangerModal.confirmLabel')}</label>
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
              {dangerLoading ? t('settingsAccount.dangerModal.verifying') : dangerModal === 'data' ? t('settingsAccount.dangerModal.deleteDataButton') : t('settingsAccount.dangerModal.deleteAccountButton')}
            </button>
            <button onClick={() => { setDangerModal(null); setDangerPassword('') }} className="btn-ghost">{t('buttons.cancel')}</button>
          </div>
        </div>
      )}

      {editSection && (
        <div onClick={e => e.target === e.currentTarget && setEditSection(null)} className={styles.editOverlay}>
          <div className={styles.modalPanel}>
            <div className={styles.handle} />
            <div className={styles.editTitle}>
              {editSection === 'name' ? t('settingsAccount.editModal.titleName')
                : editSection === 'email' ? t('settingsAccount.editModal.titleEmail')
                : editSection === 'language' ? t('settingsAccount.languageModal.title')
                : t('settingsAccount.editModal.titlePassword')}
            </div>

            {editError  && <div className={styles.errorBox}>{editError}</div>}
            {forgotSent && <div className={styles.successBox}>{t('settingsAccount.editModal.resetLinkSent', { email: user?.email })}</div>}

            {editSection === 'name' && (
              <div className={styles.fieldGroup}>
                <label className="field-label">{t('settingsAccount.editModal.nameLabel')}</label>
                <input autoFocus className="field-input" value={fieldVal} onChange={e => setFieldVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEditSave()} />
              </div>
            )}

            {editSection === 'email' && (
              <div className={styles.fieldGroup}>
                <label className="field-label">{t('settingsAccount.editModal.emailLabel')}</label>
                <input autoFocus className="field-input" type="email" value={fieldVal} onChange={e => setFieldVal(e.target.value)} />
              </div>
            )}

            {editSection === 'password' && (<>
              <div className={styles.fieldGroupSm}>
                <label className="field-label">{t('settingsAccount.editModal.currentPasswordLabel')}</label>
                <div className={styles.inputWrapper}>
                  <input autoFocus className={`field-input ${styles.inputWithToggle}`} type={showPass3 ? 'text' : 'password'} value={fieldVal3} onChange={e => setFieldVal3(e.target.value)} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPass3(v => !v)} className={styles.toggleVisibilityButton}>
                    {showPass3 ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
                  </button>
                </div>
                <button onClick={handleForgotPassword} className={styles.forgotPasswordLink}>
                  {t('settingsAccount.editModal.forgotPassword')}
                </button>
              </div>

              <div className={styles.fieldGroupXs}>
                <label className="field-label">{t('settingsAccount.editModal.newPasswordLabel')}</label>
                <div className={styles.inputWrapper}>
                  <input className={`field-input ${styles.inputWithToggle}`} type={showPass ? 'text' : 'password'} value={fieldVal} onChange={e => setFieldVal(e.target.value)} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPass(v => !v)} className={styles.toggleVisibilityButton}>
                    {showPass ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
                  </button>
                </div>
              </div>

              {fieldVal.length > 0 && (
                <div className={styles.requirementsBox}>
                  <RequirementRow met={newPassReqs.length}    label={t('settingsAccount.editModal.requirementLength')} />
                  <RequirementRow met={newPassReqs.uppercase} label={t('settingsAccount.editModal.requirementUppercase')} />
                  <RequirementRow met={newPassReqs.number}    label={t('settingsAccount.editModal.requirementNumber')} />
                  <RequirementRow met={newPassReqs.symbol}    label={t('settingsAccount.editModal.requirementSymbol')} />
                </div>
              )}

              <div className={styles.fieldGroup}>
                <label className="field-label">{t('settingsAccount.editModal.confirmPasswordLabel')}</label>
                <div className={styles.inputWrapper}>
                  <input className={`field-input ${styles.inputWithToggle} ${fieldVal2 && !newPassMatch ? styles.inputError : ''}`} type={showPass2 ? 'text' : 'password'} value={fieldVal2} onChange={e => setFieldVal2(e.target.value)} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPass2(v => !v)} className={styles.toggleVisibilityButton}>
                    {showPass2 ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
                  </button>
                </div>
                {fieldVal2 && !newPassMatch && <div className={styles.matchError}>{t('settingsAccount.editModal.passwordMismatch')}</div>}
              </div>
            </>)}

            {editSection === 'language' && (
              <div className={styles.fieldGroup}>
                {LANGUAGE_OPTIONS.map((opt, i) => (
                  <div
                    key={opt.id}
                    onClick={() => handleLanguageSelect(opt.id)}
                    className={`${styles.languageOptionRow} ${i === LANGUAGE_OPTIONS.length - 1 ? styles.languageOptionRowLast : ''}`}
                  >
                    <span className={styles.languageOptionLabel}>{opt.label}</span>
                    {currentLanguage === opt.id && <Check size={18} color="var(--accent)" />}
                  </div>
                ))}
              </div>
            )}

            {editSection !== 'language' && (
              <button onClick={handleEditSave} disabled={saving} className={`btn-primary ${styles.saveButton}`}>
                {saving ? t('settingsAccount.editModal.saving') : t('buttons.save')}
              </button>
            )}
            <button onClick={() => setEditSection(null)} className="btn-ghost">{t('buttons.cancel')}</button>
          </div>
        </div>
      )}
    </>
  )
}
