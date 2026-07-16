import { Plus, MoveRight } from 'lucide-react'
import styles from './EmptyState.module.css'

// Estado vacío reutilizable — área tipo "drop-zone" (borde punteado, ícono
// circular, título + subtítulo), tocable. Nace en HomePage.jsx v0.9.176 para
// resolver el caso de un usuario que no completó el coach mark y no encontró
// cómo agregar un pago desde una sección vacía; se extrajo aquí para poder
// reutilizarlo en cualquier otra sección vacía de la app (PaymentsPage,
// RecurrentsPage, etc.), no solo en Home.
//
// `icon` es opcional (default Plus) por si en el futuro se usa para un caso
// que no sea "agregar algo" (ej. un estado vacío de búsqueda sin resultados).
// `onClick` es opcional — si no se pasa, el área se ve igual pero sin cursor
// de puntero ni acción (estado vacío puramente informativo).
// `secondaryLabel`/`onSecondaryClick` (ambos opcionales): un link chiquito
// debajo del subtítulo para una SEGUNDA acción relacionada pero distinta a
// la principal (ej. en PaymentsPage → "Por Categoría": la acción principal
// es agregar un pago, pero también tiene sentido invitar a personalizar
// categorías — dos acciones del mismo tamaño hubieran competido por el
// mismo tap, por eso es un link chiquito y no otro botón grande). Lleva su
// propio `stopPropagation` para no disparar también el `onClick` principal.
export function EmptyState({ icon: Icon = Plus, title, subtitle, onClick, secondaryLabel, onSecondaryClick }) {
  return (
    <div onClick={onClick} className={`${styles.container} ${onClick ? styles.clickable : ''}`}>
      <div className={styles.iconWrapper}>
        <Icon size={18} color="var(--surface)" />
      </div>
      <div className={styles.title}>{title}</div>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      {secondaryLabel && onSecondaryClick && (
        <div
          onClick={e => { e.stopPropagation(); onSecondaryClick() }}
          className={styles.secondaryLink}
        >
          {secondaryLabel}
          <MoveRight size={13} color="var(--accent)" />
        </div>
      )}
    </div>
  )
}
