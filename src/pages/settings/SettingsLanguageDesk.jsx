import { useTranslation } from 'react-i18next'
import { Check, Languages } from 'lucide-react'
import i18n, { resolveLanguage, LANGUAGE_STORAGE_KEY } from '../../i18n'
import { showToast } from '../../components/Toast'
import { useLanguageOptions } from '../../components/LanguageSheet'
import { DeskSettingsHead, DeskPage } from '../../components/DeskSettingsHead'
import deskStyles from '../../components/SettingsDesk.module.css'
import dk from './SettingsLanguageDesk.module.css'

// Idioma en escritorio (v0.9.836): sección dentro del panel de Ajustes (antes
// era una hoja modal). Aplica al tocar una opción, igual que LanguageSheet.
const SUB = { system: 'systemSub', es: 'esSub', en: 'enSub' }
const MARK = { system: null, es: 'ES', en: 'EN' }

export function SettingsLanguageDesk({ profile, onUpdate }) {
  const { t } = useTranslation()
  const options = useLanguageOptions()
  const current = profile.language || 'system'

  async function handleSelect(langId) {
    if (langId === current) return
    localStorage.setItem(LANGUAGE_STORAGE_KEY, langId)
    i18n.changeLanguage(resolveLanguage(langId))
    const { error } = await onUpdate({ language: langId })
    showToast(error ? (error.message || t('settingsAccount.toast.languageUpdated')) : t('settingsAccount.toast.languageUpdated'))
  }

  return (
    <DeskPage>
      <DeskSettingsHead title={t('settingsLanguage.title')} description={t('settingsLanguage.description')} />
      <div className={dk.grid} role="radiogroup" aria-label={t('settingsLanguage.title')}>
        {options.map(o => (
          <button key={o.id} type="button" role="radio" aria-checked={current === o.id} onClick={() => handleSelect(o.id)} className={`${dk.tile} ${current === o.id ? dk.on : ''}`}>
            <span className={dk.mark}>{MARK[o.id] || <Languages size={26} />}</span>
            <span className={dk.txt}><b>{o.label}</b><em>{t(`settingsLanguage.${SUB[o.id]}`)}</em></span>
            {current === o.id && <span className={`${deskStyles.ic} ${dk.chk}`}><Check size={16} strokeWidth={3} /></span>}
          </button>
        ))}
      </div>
    </DeskPage>
  )
}
