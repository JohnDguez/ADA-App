import { Check, X } from 'lucide-react'
import styles from './RequirementRow.module.css'

// Fila de un requisito de contraseña (ej. "Mínimo 8 caracteres"), con círculo
// verde/gris + check/x según se cumpla. Antes vivía duplicado como componente
// local en PasswordSetupModal.jsx y SettingsAccountPage.jsx — extraído aquí
// para tener un solo lugar que mantener.
export function RequirementRow({ met, label }) {
  return (
    <div className={styles.row}>
      <div className={`${styles.circle} ${met ? styles.circleMet : ''}`}>
        {met
          ? <Check size={10} color="var(--pay-icon)" strokeWidth={3} />
          : <X size={10} color="var(--text)" strokeWidth={2.5} />
        }
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  )
}
