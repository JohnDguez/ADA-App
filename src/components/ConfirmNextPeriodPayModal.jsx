import { useTranslation } from 'react-i18next'
import { dateOf, getMonths } from '../lib/utils'
import { ModalSheet, SheetButton } from './ModalSheet'
import { CalendarCheck } from '@phosphor-icons/react/dist/csr/CalendarCheck'

// Confirmación antes de marcar como pagado un pago que en realidad vence en
// el PRÓXIMO periodo (riel de "Pagos del próximo periodo" en Home) —
// previene que alguien pague por error algo de un periodo que aún no
// arranca, confundido de qué switch tiene activo (Periodo actual / Próximo
// periodo). Se abre vía una Promise con resolver (mismo patrón que
// requestVariableAmount en App.jsx) — PayCard espera `true`/`false` antes
// de decidir si continúa con la animación de pagar. Mismo lenguaje visual
// que VariableAmountModal (overlay + panel centrado, z-index 250, animación
// modalPopIn) — sin ConfirmCloseModal de por medio, porque aquí no hay
// ningún dato capturado que se pueda perder al cancelar, solo una pregunta
// de sí/no.
export function ConfirmNextPeriodPayModal({ open, payment, onConfirm, onCancel }) {
  const { t } = useTranslation()
  if (!payment) return null
  const d = dateOf(payment.due_date)

  return (
    <ModalSheet open={open} icon={CalendarCheck} title={t('confirmNextPeriodPayModal.title')} onBackdrop={onCancel}>
        <ModalSheet.Text>
          <strong>{payment.name}</strong> {t('confirmNextPeriodPayModal.descriptionPrefix', { day: d.getDate(), month: getMonths()[d.getMonth()] })} <strong>{t('confirmNextPeriodPayModal.nextPeriodPhrase')}</strong>. {t('confirmNextPeriodPayModal.descriptionSuffix')}
        </ModalSheet.Text>
        <SheetButton onClick={onConfirm}>{t('confirmNextPeriodPayModal.confirm')}</SheetButton>
        <SheetButton variant="soft" onClick={onCancel}>{t('buttons.cancel')}</SheetButton>
    </ModalSheet>
  )
}
