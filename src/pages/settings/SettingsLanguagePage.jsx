import { useTranslation } from 'react-i18next'
import { Check, Languages } from 'lucide-react'
import { Translate } from '@phosphor-icons/react/dist/csr/Translate'
import i18n, { resolveLanguage, LANGUAGE_STORAGE_KEY } from '../../i18n'
import { showToast } from '../../components/Toast'
import { useLanguageOptions } from '../../components/LanguageSheet'
import { SettingsSubLayout, useSettingsMode } from '../../components/SettingsSubLayout'
import kit from '../../components/SettingsKit.module.css'
import styles from './SettingsLanguagePage.module.css'

// Sub-página «Idioma» (v0.9.977, mockup aprobado; antes era una hoja en
// móvil y una sección solo de escritorio). Aplica al tocar una opción.
const SUB = { system: 'systemSub', es: 'esSub', en: 'enSub' }
const MARK = { system: null, es: 'ES', en: 'EN' }

export function SettingsLanguagePage({ profile, onUpdate, onBack, slideClass }) {
  const { t } = useTranslation()
  const mode = useSettingsMode()
  const options = useLanguageOptions()
  const current = profile.language || 'system'

  async function handleSelect(langId) {
    if (langId === current) return
    localStorage.setItem(LANGUAGE_STORAGE_KEY, langId)
    i18n.changeLanguage(resolveLanguage(langId))
    const { error } = await onUpdate({ language: langId })
    showToast(error ? (error.message || t('settingsAccount.toast.languageUpdated')) : t('settingsAccount.toast.languageUpdated'))
  }

  const ico = id => <span className={`${kit.lico} ${styles.ico}`}>{MARK[id] ? <b className={styles.ab}>{MARK[id]}</b> : <Languages size={18} />}</span>
  const check = <span className={`${kit.check} ${styles.ck}`}><Check size={13} strokeWidth={3} /></span>

  return (
    <SettingsSubLayout title={t('settingsLanguage.title')} description={t('settingsLanguage.description')}
      icon={Translate} onBack={onBack} slideClass={slideClass}>
      <section className={`${kit.panel} ${mode === 'mobile' ? styles.list : ''}`} role="radiogroup" aria-label={t('settingsLanguage.title')}>
        {mode === 'mobile' ? options.map(o => (
          <button key={o.id} type="button" role="radio" aria-checked={current === o.id} onClick={() => handleSelect(o.id)}
            className={`${styles.lrow} ${current === o.id ? styles.on : ''}`}>
            {ico(o.id)}
            <span className={styles.txt}><b>{o.label}</b><span className={styles.sub}>{t(`settingsLanguage.${SUB[o.id]}`)}</span></span>
            {current === o.id && check}
          </button>
        )) : (
          <div className={styles.tiles}>
            {options.map(o => (
              <button key={o.id} type="button" role="radio" aria-checked={current === o.id} onClick={() => handleSelect(o.id)}
                className={`${styles.ltile} ${current === o.id ? styles.on : ''}`}>
                {ico(o.id)}
                <b>{o.label}</b>
                <span className={styles.sub}>{t(`settingsLanguage.${SUB[o.id]}`)}</span>
                {current === o.id && check}
              </button>
            ))}
          </div>
        )}
      </section>
    </SettingsSubLayout>
  )
}
