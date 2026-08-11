import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { Plus, UserRound, Crown, UsersRound } from 'lucide-react'
import styles from './RailSpaceSwitcher.module.css'

/**
 * Versión para el riel del selector de espacio activo — reemplaza las
 * tarjetas apiladas de SpaceSwitcher.jsx (pensadas para vivir arriba del
 * contenido de cada página) por una lista plana, mismo lugar para las 4
 * pantallas principales ya que el riel es persistente entre tabs.
 *
 * Misma lógica de datos e íconos que SpaceSwitcher.jsx (Crown = dueño,
 * UsersRound = invitado, UserRound = Personal) — sin la animación de
 * stack ni los colores de "asoma", que no tienen sentido en una lista
 * plana. Tampoco muestra el resumen de pendientes/vencidos por espacio
 * (SpaceSwitcher.jsx sí lo hace) — no entra cómodo en el ancho del riel
 * ni siquiera expandido (240px); queda como simplificación intencional.
 */
export function RailSpaceSwitcher({ spaces, activeSpaceId, onSwitch, profile, expanded, onRequestExpand }) {
  const { t } = useTranslation()

  const ownedEntry   = spaces.find(s => s.membership.role === 'owner')
  const guestEntries = spaces.filter(s => s.membership.role === 'guest')
  const canAddMore   = (profile.is_premium && !ownedEntry) || guestEntries.length < 3

  const spaceItems = [...spaces]
    .sort((a, b) => a.space.name.localeCompare(b.space.name, i18n.language))
    .map(s => ({ id: s.space.id, kind: 'space', name: s.space.name, entry: s }))

  const allItems = [
    { id: null, kind: 'personal', name: t('activeSpaceHeader.personalName') },
    ...spaceItems,
    ...(canAddMore ? [{ id: 'new', kind: 'new', name: t('activeSpaceHeader.newSpaceName') }] : []),
  ]

  function iconFor(item) {
    if (item.kind === 'personal') return UserRound
    if (item.kind === 'new') return Plus
    return item.entry.membership.role === 'owner' ? Crown : UsersRound
  }

  if (!expanded) {
    // Colapsado: solo el ícono del espacio activo — tocarlo expande el
    // riel para poder elegir (no hay espacio para una lista de nombres
    // en 72px, mismo criterio que los tabs de navegación sin etiqueta).
    const activeItem = allItems.find(it => it.id === activeSpaceId) || allItems.find(it => it.kind === 'personal')
    const ActiveIcon = iconFor(activeItem)
    return (
      <button
        className={styles.collapsedBadge}
        onClick={onRequestExpand}
        aria-label={activeItem.name}
      >
        <ActiveIcon size={14} strokeWidth={2} />
      </button>
    )
  }

  return (
    <div data-coachmark="home-space-switcher" className={styles.list}>
      <p className={styles.sectionLabel}>{t('spaceSwitcher.railLabel')}</p>
      {allItems.map(item => {
        const Icon = iconFor(item)
        const isActive = item.id === activeSpaceId
        return (
          <button
            key={item.id ?? 'personal'}
            onClick={() => onSwitch(item.kind === 'new' ? 'new' : item.id)}
            className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
          >
            <Icon size={15} strokeWidth={2} />
            <span className={styles.itemName}>{item.name}</span>
          </button>
        )
      })}
    </div>
  )
}
