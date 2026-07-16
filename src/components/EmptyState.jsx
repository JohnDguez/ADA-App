import { Plus, MoveRight } from 'lucide-react'

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
    <div onClick={onClick} style={{ border: '1.5px dashed var(--border)', borderRadius: 8, padding: '28px 16px', textAlign: 'center', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
        <Icon size={18} color="var(--surface)" />
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)' }}>{subtitle}</div>}
      {secondaryLabel && onSecondaryClick && (
        <div
          onClick={e => { e.stopPropagation(); onSecondaryClick() }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: 'var(--accent)', marginTop: 12, cursor: 'pointer' }}
        >
          {secondaryLabel}
          <MoveRight size={13} color="var(--accent)" />
        </div>
      )}
    </div>
  )
}
