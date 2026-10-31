import { useTranslation, Trans } from 'react-i18next'
import { ConfirmSheet } from './ConfirmSheet'
import { AnchoredPop } from './AnchoredPop'
import styles from './SalaryChangePrompt.module.css'

// "¿Desde cuándo cambia tu ingreso?" (v0.9.968, mockup aprobado). Sale al
// cambiar el monto del ingreso por periodo: "Desde el próximo periodo" deja el
// periodo actual con el monto anterior; "Desde este periodo" cambia al
// instante. Cerrar sin elegir cancela el cambio. Móvil y tablet: hoja del
// diseño nuevo (ConfirmSheet, v0.9.969); escritorio: popover anclado al campo
// del monto (Regla 61).
export function SalaryChangePrompt({ open, oldAmount, newAmount, nextDate, asPop, anchorRef, onNext, onNow, onCancel }) {
  const { t } = useTranslation()
  const title = t('salaryChange.title')
  const text = (
    <Trans i18nKey="salaryChange.text" values={{ old: oldAmount, new: newAmount, date: nextDate }} components={{ b: <strong /> }} />
  )

  if (asPop) {
    return (
      <AnchoredPop open={open} onClose={onCancel} anchorRef={anchorRef} width={380} label={title}>
        <div className={styles.title}>{title}</div>
        <p className={styles.text}>{text}</p>
        <div className={styles.btns}>
          <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={onNext}>{t('salaryChange.next')}</button>
          <button type="button" className={`${styles.btn} ${styles.soft}`} onClick={onNow}>{t('salaryChange.now')}</button>
        </div>
      </AnchoredPop>
    )
  }
  return (
    <ConfirmSheet open={open} title={title} onClose={onCancel} actions={[
      { label: t('salaryChange.next'), onClick: onNext },
      { label: t('salaryChange.now'), onClick: onNow, variant: 'soft' },
    ]}>
      {text}
    </ConfirmSheet>
  )
}
