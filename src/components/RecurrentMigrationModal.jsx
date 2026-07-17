import { RefreshCw, AlertTriangle, Check } from 'lucide-react'
import styles from './RecurrentMigrationModal.module.css'

export function RecurrentMigrationModal({ open, onClose }) {
  if (!open) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>

        <div className={styles.handle} />

        {/* Ícono */}
        <div className={styles.iconWrapper}>
          <RefreshCw size={26} color="var(--accent)" />
        </div>

        <div className={styles.title}>
          Mejora en pagos recurrentes
        </div>
        <div className={styles.description}>
          Actualizamos cómo funcionan los pagos recurrentes para hacerlos más inteligentes y editables.
        </div>

        {/* Beneficios */}
        <div className={styles.benefitsList}>
          {[
            'Los pagos se generan automáticamente periodo a periodo',
            'Ahora puedes editar nombre, monto y fechas en cualquier momento',
            'Siempre verás el pago actual y el siguiente en tu lista',
          ].map((text, i) => (
            <div key={i} className={styles.benefitItem}>
              <div className={styles.checkCircle}>
                <Check size={11} color="var(--pay-icon)" strokeWidth={3} />
              </div>
              <span className={styles.benefitText}>{text}</span>
            </div>
          ))}
        </div>

        {/* Aviso */}
        <div className={styles.warningBox}>
          <div className={styles.warningContent}>
            <AlertTriangle size={15} color="var(--warning)" className={styles.warningIcon} />
            <div>
              <div className={styles.warningTitle}>Cambio temporal visible</div>
              <div className={styles.warningText}>
                Es posible que notes algunos ajustes en cómo se muestran tus pagos recurrentes mientras el sistema migra los datos. Tus pagos ya realizados están protegidos y no serán eliminados.
              </div>
            </div>
          </div>
        </div>

        <button onClick={onClose} className="btn-primary">Entendido</button>
      </div>
    </div>
  )
}
