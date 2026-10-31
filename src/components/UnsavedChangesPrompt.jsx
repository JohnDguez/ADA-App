import { useEffect, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { ConfirmSheet } from './ConfirmSheet'
import { discardAndLeave } from '../lib/unsavedGuard'

// "No guardaste los cambios" (v0.9.969, diseño nuevo). Se abre con el evento
// `ada:unsaved` que dispara requestLeave() (lib/unsavedGuard.js) cuando el
// usuario intenta salir de una pantalla con un campo sin guardar. "Seguir
// editando" (o la ✕ / el fondo) se queda; "Salir sin guardar" descarta y sale.
export function UnsavedChangesPrompt() {
  const { t } = useTranslation()
  const [pending, setPending] = useState(null) // { proceed, field }
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onAsk = e => { setPending(e.detail); setOpen(true) }
    window.addEventListener('ada:unsaved', onAsk)
    return () => window.removeEventListener('ada:unsaved', onAsk)
  }, [])
  const stay = () => setOpen(false)
  const leave = () => { setOpen(false); if (pending) discardAndLeave(pending.proceed) }
  return (
    <ConfirmSheet open={open} title={t('unsavedChanges.title')} onClose={stay} actions={[
      { label: t('unsavedChanges.stay'), onClick: stay },
      { label: t('unsavedChanges.leave'), onClick: leave, variant: 'soft' },
    ]}>
      <Trans i18nKey="unsavedChanges.text" values={{ field: pending?.field || '' }} components={{ b: <strong /> }} />
    </ConfirmSheet>
  )
}
