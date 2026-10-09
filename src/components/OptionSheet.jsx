import { Check } from 'lucide-react'
import { BottomSheet } from './BottomSheet'
import styles from './OptionSheet.module.css'

// Hoja inferior genérica de selección única para filas de Ajustes
// ("Método de pago · Todos >"). Aplica al tocar una opción y se cierra, igual
// que LanguageSheet/CurrencySheet. `options` = [{ value, label }].
export function OptionSheet({ open, onClose, title, options, value, onSelect }) {
  return (
    <BottomSheet open={open} title={title} onClose={onClose}>
      <div className={styles.list}>
        {options.map(o => (
          <button key={o.value} type="button" onClick={() => { onSelect(o.value); onClose() }} className={styles.option}>
            <span className={styles.label}>{o.label}</span>
            {value === o.value && <Check size={18} color="var(--accent)" />}
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}
