import { ChevronRight } from 'lucide-react'
import styles from './SettingsShared.module.css'

// Componentes reutilizados por SettingsPage.jsx y sus sub-páginas
// (SettingsAccountPage, SettingsCobroPage, SettingsCategoriesPage,
// SettingsNotificationsPage, SettingsAppearancePage). Antes vivían duplicados
// al final de SettingsPage.jsx.

export function Card({ children }) {
  return <div className={styles.card}>{children}</div>
}

export function SectionLabel({ children }) {
  return <div className={styles.sectionLabel}>{children}</div>
}

// `sub` (opcional): segunda línea chica debajo del label — usado por el
// renglón de feedback en SettingsPage.jsx ("Danos tu feedback" / "Gana 3
// meses de Premium gratis"). El resto de los usos de Row no la pasan y se
// comportan exactamente igual que antes.
export function Row({ label, sub, value, onClick, last, icon: Icon, iconColor }) {
  return (
    <div
      onClick={onClick}
      className={`${styles.row} ${last ? styles.rowLast : ''} ${onClick ? styles.rowClickable : ''}`}
    >
      <div className={styles.rowLeft}>
        {Icon && <Icon size={16} color={iconColor || 'var(--text)'} />}
        <div>
          <span className={styles.rowLabel} style={iconColor ? { color: iconColor } : undefined}>{label}</span>
          {sub && <div className={styles.rowSub} style={iconColor ? { color: iconColor } : undefined}>{sub}</div>}
        </div>
      </div>
      <div className={styles.rowRight}>
        {value && <span className={styles.rowValue}>{value}</span>}
        {onClick && <ChevronRight size={14} color={iconColor || 'var(--text)'} />}
      </div>
    </div>
  )
}

export function Toggle({ on }) {
  return (
    <div className="toggle-track" style={{ background: on ? 'var(--accent)' : 'var(--border)' }}>
      <div className="toggle-thumb" style={{ left: on ? 19 : 3 }} />
    </div>
  )
}

export function NotifToggle({ label, sub, value, onChange, last }) {
  return (
    <div
      onClick={() => onChange(!value)}
      className={`${styles.notifRow} ${last ? styles.notifRowLast : ''}`}
    >
      <div>
        <div className={styles.notifLabel}>{label}</div>
        <div className={styles.notifSub}>{sub}</div>
      </div>
      <Toggle on={value} />
    </div>
  )
}
