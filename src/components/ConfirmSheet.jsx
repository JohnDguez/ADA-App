import { Modal } from './Modal'

// Pregunta corta con 2 respuestas. Desde v0.9.984 es una capa sobre <Modal
// layout="confirm"> (Modal único): hoja con asa en móvil y diálogo en tablet
// y escritorio. Se conserva la API para no tocar a quien la usa.
// `actions`: [{ label, onClick, variant: 'primary' | 'soft' | 'danger' }].
// `icon` / `tone` opcionales (ficha de color arriba).
export function ConfirmSheet({ open, title, children, actions = [], onClose, icon, tone = 'accent' }) {
  // La acción principal va primero (arriba en móvil, a la derecha en
  // tablet/escritorio); las «soft» al final.
  const ordered = [...actions.filter(a => a.variant !== 'soft'), ...actions.filter(a => a.variant === 'soft')]
  return (
    <Modal open={open} onClose={onClose} layout="confirm" title={title} desc={children} icon={icon} tone={tone}
      actions={ordered} width={440} zIndex={550} />
  )
}
