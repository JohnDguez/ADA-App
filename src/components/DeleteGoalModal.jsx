import { useState, useEffect, useRef } from 'react'
import { fmt } from '../lib/utils'
import styles from './DeleteGoalModal.module.css'

// Debe coincidir con la duración de las animaciones del .module.css.
const ANIM_MS = 320

// La resolución del dinero abonado SIEMPRE la elige el usuario aquí —
// nunca se asume 'return' ni 'discard' desde ningún otro lugar del código.
export function DeleteGoalModal({ open, goal, onCancel, onConfirm }) {
  // Entrada Y salida (regla 29). El `wasOpenRef.current` de `showModal`
  // cubre el frame entre que `open` pasa a false y que el efecto marca
  // `closing` (los efectos corren DESPUÉS del render) — sin él, el DOM se
  // destruye y se vuelve a crear en ese hueco, lo que reinicia la
  // animación y provoca el parpadeo.
  const [closing, setClosing] = useState(false)
  const [entering, setEntering] = useState(false)
  const wasOpenRef = useRef(open)
  const closeTimerRef = useRef(null)
  const enterTimerRef = useRef(null)
  const lastGoalRef = useRef(goal)

  useEffect(() => () => { clearTimeout(closeTimerRef.current); clearTimeout(enterTimerRef.current) }, [])
  useEffect(() => {
    if (!wasOpenRef.current && open) {
      setEntering(true)
      clearTimeout(enterTimerRef.current)
      enterTimerRef.current = setTimeout(() => setEntering(false), ANIM_MS)
    }
    if (wasOpenRef.current && !open) {
      setClosing(true)
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = setTimeout(() => setClosing(false), ANIM_MS)
    }
    wasOpenRef.current = open
  }, [open])

  // Al eliminar, la meta desaparece de la lista mientras el modal todavía
  // está haciendo su animación de salida — se guarda la última que hubo
  // para no quedarse sin datos que mostrar a media animación.
  if (goal) lastGoalRef.current = goal
  const shownGoal = goal || lastGoalRef.current

  const showModal = open || closing || wasOpenRef.current
  if (!showModal || !shownGoal) return null

  const hasMoney = shownGoal.currentAmount > 0

  return (
    <div
      onClick={e => e.target === e.currentTarget && onCancel()}
      className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`}
    >
      <div className={`${styles.modal} ${entering ? styles.modalEntering : ''} ${closing ? styles.modalClosing : ''}`}>
        <div className={styles.handle} />
        <div className={styles.title}>Eliminar "{shownGoal.name}"</div>

        {hasMoney ? (
          <>
            <div className={styles.description}>
              Llevas {fmt(shownGoal.currentAmount)} abonado en esta meta. ¿Qué quieres hacer con ese dinero?
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
