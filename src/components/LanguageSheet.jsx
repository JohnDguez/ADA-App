import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import i18n, { resolveLanguage, LANGUAGE_STORAGE_KEY } from '../i18n'
import { BottomSheet } from './BottomSheet'
import { showToast } from './Toast'
import styles from './LanguageSheet.module.css'

// Idioma: 'system' | 'es' | 'en' — vive en profiles.language. Aplica al tocar
// una opción (sin botón Guardar): guarda en la cuenta, en localStorage (cache
// de arranque de src/i18n/index.js) y cambia el idioma activo al momento.
// Antes vivía dentro de Ajustes → Cuenta (v0.9.620 lo saca a Preferencias).
export function useLanguageOptions() {
  const { t } = useTranslation()
  return [
    { id: 'system', label: t('settingsAccount.languageModal.system') },
    { id: 'es',     label: t('settingsAccount.languageModal.spanish') },
    { id: 'en',     label: t('settingsAccount.languageModal.english') },
  ]
}

export function LanguageSheet({ open, onClose, profile, onUpdate }) {
  const { t } = useTranslation()
  const options = useLanguageOptions()
  const current = profile.language || 'system'

  async function handleSelect(langId) {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, langId)
    i18n.changeLanguage(resolveLanguage(langId))
    onClose()
    const { error } = await onUpdate({ language: langId })
    if (error) showToast(error.message || t('settingsAccount.toast.languageUpdated'))
    else showToast(t('settingsAccount.toast.languageUpdated'))
  }

  return (
    <BottomSheet open={open} title={t('settingsAccount.languageModal.title')} onClose={onClose}>
      <div className={styles.list}>
        {options.map(opt => (
          <button key={opt.id} type="button" onClick={() => handleSelect(opt.id)} className={styles.option}>
            <span className={styles.label}>{opt.label}</span>
            {current === opt.id && <Check size={18} color="var(--accent)" />}
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}
