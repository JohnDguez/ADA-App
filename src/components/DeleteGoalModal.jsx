import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash } from '@phosphor-icons/react/dist/csr/Trash'
import { fmt } from '../lib/utils'
import { Modal } from './Modal'

// La resolución del dinero abonado SIEMPRE la elige el usuario aquí —
// nunca se asume 'return' ni 'discard' desde ningún otro lugar del código.
export function DeleteGoalModal({ open, goal, onCancel, onConfirm }) {
  const { t } = useTranslation()
  // Al eliminar, la meta desaparece de la lista mientras el modal sale: se
  // guarda la última para no quedarse sin datos a media animación.
  const lastGoalRef = useRef(goal)
  if (goal) lastGoalRef.current = goal
  const shownGoal = goal || lastGoalRef.current
  if (!shownGoal) return null
  const hasMoney = shownGoal.currentAmount > 0

  // Diseño nuevo (v0.9.980): confirmación con <Modal layout="confirm">.
  return (
    <Modal open={open} onClose={onCancel} layout="confirm" icon={Trash} tone="danger" width={440} closeButton={false}
      title={t('deleteGoalModal.title', { name: shownGoal.name })}
      desc={hasMoney ? t('deleteGoalModal.descriptionWithMoney', { amount: fmt(shownGoal.currentAmount) }) : t('deleteGoalModal.descriptionNoMoney')}
      actions={hasMoney
        ? [
            { label: t('deleteGoalModal.returnAndDelete'), onClick: () => onConfirm('return') },
            { label: t('deleteGoalModal.discardAndDelete'), onClick: () => onConfirm('discard'), variant: 'danger' },
            { label: t('buttons.cancel'), onClick: onCancel, variant: 'soft' },
          ]
        : [
            { label: t('buttons.delete'), onClick: () => onConfirm('discard'), variant: 'danger' },
            { label: t('buttons.cancel'), onClick: onCancel, variant: 'soft' },
          ]} />
  )
}
