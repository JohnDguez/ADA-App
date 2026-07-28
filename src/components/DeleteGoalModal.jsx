import { fmt } from '../lib/utils'
import styles from './DeleteGoalModal.module.css'

// La resolución del dinero abonado SIEMPRE la elige el usuario aquí —
// nunca se asume 'return' ni 'discard' desde ningún otro lugar del código
// (decisión confirmada con Johnatan).
export function DeleteGoalModal({ open, goal, onCancel, onConfirm }) {
  if (!open || !goal) return null
  const hasMoney = goal.currentAmount > 0

  return (
    <div onClick={e => e.target === e.currentTarget && onCancel()} className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.handle} />
        <div className={styles.title}>Eliminar "{goal.name}"</div>

        {hasMoney ? (
          <>
            <div className={styles.description}>
              Llevas {fmt(goal.currentAmount)} abonado en esta meta. ¿Qué quieres hacer con ese dinero?
            </div>
            <button type="button" onClick={() => onConfirm('return')} className="btn-primary">
              Regresar a Disponible y eliminar
            </button>
            <button type="button" onClick={() => onConfirm('discard')} className="btn-danger">
              Eliminar sin regresar el dinero
            </button>
          </>
        ) : (
          <>
            <div className={styles.description}>Esta acción no se puede deshacer.</div>
            <button type="button" onClick={() => onConfirm('discard')} className="btn-danger">
              Eliminar
            </button>
          </>
        )}

        <button type="button" onClick={onCancel} className="btn-ghost">Cancelar</button>
      </div>
    </div>
  )
}
