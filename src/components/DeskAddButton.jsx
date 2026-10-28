import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { AddDropdown, addDropdownHasExtras } from './AddDropdown'
import home from '../pages/DeskHome.module.css'

// Botón "Agregar" de escritorio con el menú de a mano / voz / ticket (v0.9.841).
// Antes solo Inicio lo tenía; Pagos y Recurrentes abrían directo el formulario.
export function DeskAddButton({ onAdd, onStartAdd, coachmark }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const extras = !!onStartAdd && addDropdownHasExtras()
  function pick(kind) { setOpen(false); if (kind) onStartAdd?.(kind); else onAdd?.() }
  return (
    <div className={home.addWrap}>
      <button type="button" data-coachmark={coachmark} data-add-trigger className={home.addBtn}
        onClick={() => (extras ? setOpen(o => !o) : onAdd?.())}
        aria-haspopup={extras ? 'menu' : undefined} aria-expanded={open}>
        <Plus size={18} strokeWidth={2.2} />{t('bottomNav.add')}
      </button>
      {extras && <AddDropdown open={open} onClose={() => setOpen(false)} onPick={pick} />}
    </div>
  )
}
