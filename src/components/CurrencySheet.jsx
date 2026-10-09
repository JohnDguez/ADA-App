import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { BottomSheet } from './BottomSheet'
import { CURRENCIES, CURRENCY_CODES } from '../lib/currency'
import styles from './CurrencySheet.module.css'

// Hoja de selección de moneda para filas de Ajustes ("Moneda · MXN >").
// Aplica al tocar una opción (sin botón Guardar), igual que LanguageSheet.
export function CurrencySheet({ open, onClose, value, onSelect, title }) {
  const { t } = useTranslation()
  return (
    <BottomSheet open={open} title={title || t('currency.sheetTitle')} onClose={onClose}>
      <div className={styles.list}>
        {CURRENCY_CODES.map(code => (
          <button key={code} type="button" onClick={() => onSelect(code)} className={styles.option}>
            <span className={styles.label}>{`${t(`currency.names.${code}`)} (${CURRENCIES[code].code})`}</span>
            {value === code && <Check size={18} color="var(--accent)" />}
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}
