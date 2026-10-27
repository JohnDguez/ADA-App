import { useTranslation } from 'react-i18next'
import { User, Calendar, Tag, Bell, SunMoon, Users, CreditCard, Crown, Download } from 'lucide-react'
import styles from './SettingsQuickNav.module.css'

// Menú rápido flotante de Ajustes (tablet/escritorio, v0.9.801): íconos con
// una mini etiqueta para saltar entre sub-páginas sin volver al menú
// principal. Discreto a propósito (gris en reposo, solo el activo en
// `--accent`, sombra suave). Móvil no lo muestra (lo decide SettingsPage).
const ITEMS = [
  { id: 'account',       icon: User,       key: 'account' },
  { id: 'cobro',         icon: Calendar,   key: 'cobro' },
  { id: 'categories',    icon: Tag,        key: 'categories' },
  { id: 'notifications', icon: Bell,       key: 'notifications' },
  { id: 'appearance',    icon: SunMoon,    key: 'appearance' },
  { id: 'sharedspace',   icon: Users,      key: 'sharedSpace' },
  { id: 'cards',         icon: CreditCard, key: 'cards' },
  { id: 'subscription',  icon: Crown,      key: 'subscription', premiumOnly: true },
  { id: 'export',        icon: Download,   key: 'export' },
]

export function SettingsQuickNav({ active, isPremium, onSelect }) {
  const { t } = useTranslation()
  const items = ITEMS.filter(it => !it.premiumOnly || isPremium)
  return (
    <nav className={styles.nav} aria-label={t('settingsQuickNav.aria')}>
      {items.map(({ id, icon: Icon, key }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          aria-current={id === active ? 'page' : undefined}
          className={`${styles.item} ${id === active ? styles.itemActive : ''}`}
        >
          <Icon size={18} strokeWidth={id === active ? 2.4 : 2} />
          <span className={styles.label}>{t(`settingsQuickNav.${key}`)}</span>
        </button>
      ))}
    </nav>
  )
}
