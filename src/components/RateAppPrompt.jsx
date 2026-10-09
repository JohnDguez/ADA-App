import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Capacitor } from '@capacitor/core'
import { useBackClose } from '../lib/backNav'
import { ANDROID_PACKAGE_NAME } from '../lib/constants'
import { ModalSheet, SheetButton } from './ModalSheet'
import { Star } from '@phosphor-icons/react/dist/csr/Star'

// Invitación a calificar LunaPay en Google Play — solo app de Android.
// Reglas (pedidas por Johnatan):
// - Primera vez: 7 días después de la primera apertura en este dispositivo.
// - Luego, una vez cada 7 días. Se evalúa SOLO al abrir la app, así que si
//   alguien no entra en 14 días ve el aviso una sola vez, no dos seguidas.
// - Deja de aparecer para siempre al tocar "Calificar" o "Ya la califiqué".
//   Google NO dice si un usuario ya dejó reseña (no hay API para eso), así que
//   esto es lo más cercano posible. Tope de seguridad: MAX_SHOWS veces.
// La calificación en sí es la ventana nativa de Google Play (estrellas +
// comentario dentro de la app, se publica directo en Play).
const STATE_KEY = 'lunapay_rate_state' // { first, lastShown, count, done }
const WAIT_MS = 7 * 24 * 60 * 60 * 1000
const MAX_SHOWS = 3
const SHOW_DELAY_MS = 4000

function readState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null') || {} } catch { return {} }
}
function writeState(s) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(s)) } catch { /* sin storage */ }
}

export function RateAppPrompt({ blocked = false }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return
    const now = Date.now()
    const s = readState()
    if (!s.first) { writeState({ ...s, first: now }); return }
    if (s.done || (s.count || 0) >= MAX_SHOWS) return
    if (now - s.first < WAIT_MS) return
    if (s.lastShown && now - s.lastShown < WAIT_MS) return
    const timer = setTimeout(() => setOpen(true), SHOW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  // Si justo salió otro aviso (feedback alpha), este espera a la próxima apertura.
  const visible = open && !blocked

  useEffect(() => {
    if (!visible) return
    const s = readState()
    writeState({ ...s, lastShown: Date.now(), count: (s.count || 0) + 1 })
  }, [visible])

  function later() { setOpen(false) }

  useBackClose(visible, later)

  function alreadyRated() {
    writeState({ ...readState(), done: true })
    setOpen(false)
  }

  async function rate() {
    writeState({ ...readState(), done: true })
    setOpen(false)
    try {
      const { InAppReview } = await import('@capacitor-community/in-app-review')
      await InAppReview.requestReview()
    } catch (err) {
      console.error('[RateAppPrompt] no se pudo abrir la calificación nativa', err)
      window.open(`https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`, '_blank')
    }
  }

  if (!visible) return null
  return (
    <ModalSheet icon={Star} title={t('rateApp.title')} onBackdrop={later}>
      <ModalSheet.Text>{t('rateApp.description')}</ModalSheet.Text>
      <SheetButton onClick={rate}>{t('rateApp.rate')}</SheetButton>
      <SheetButton variant="soft" onClick={later}>{t('rateApp.later')}</SheetButton>
      <SheetButton variant="soft" onClick={alreadyRated}>{t('rateApp.alreadyRated')}</SheetButton>
    </ModalSheet>
  )
}
