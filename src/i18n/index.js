import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './es.json'
import en from './en.json'

const SUPPORTED_LANGUAGES = ['es', 'en']
export const LANGUAGE_STORAGE_KEY = 'ada_language'

function resolveSystemLanguage() {
  const navLang = (navigator.language || 'es').slice(0, 2).toLowerCase()
  return SUPPORTED_LANGUAGES.includes(navLang) ? navLang : 'es'
}

// preference viene de profiles.language ('system' | 'es' | 'en') una vez exista esa
// columna (Fase 3); mientras tanto usa el valor guardado localmente o 'system' por default.
export function resolveLanguage(preference) {
  if (!preference || preference === 'system') return resolveSystemLanguage()
  return SUPPORTED_LANGUAGES.includes(preference) ? preference : resolveSystemLanguage()
}

const storedPreference = localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'system'

i18n.use(initReactI18next).init({
  resources: {
    es: { common: es },
    en: { common: en },
  },
  lng: resolveLanguage(storedPreference),
  fallbackLng: 'es',
  defaultNS: 'common',
  ns: ['common'],
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
})

export default i18n
