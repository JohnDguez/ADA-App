import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ShieldCheck, Loader2 } from 'lucide-react'
// Import DIRECTO al archivo del ícono (no el barrel) — mismo criterio que
// las demás sub-páginas de Ajustes (tree-shaking real).
import { CreditCard } from '@phosphor-icons/react/dist/csr/CreditCard'
import { PageHero } from '../../components/PageHero'
import { CreditCardVisual } from '../../components/CreditCardVisual'
import { CardFormModal } from '../../components/CardFormModal'
import { SegmentedControl } from '../../components/SegmentedControl'
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal'
import { EmptyState } from '../../components/EmptyState'
import { getBank } from '../../lib/cardCatalog'
import styles from './SettingsCardsPage.module.css'

// Mis tarjetas (v0.9.486, entrega A — mockups confirmados con Johnatan).
// - Aviso fijo arriba: NO son formas de pago y la app no tiene acceso a
//   ninguna cuenta; solo sirven para identificar y organizar gastos.
// - Dos pilas separadas (Crédito / Débito), cada una estilo cartera.
// - Tocar una tarjeta la sube hasta arriba, con Editar/Eliminar/Cerrar
//   JUSTO debajo; las demás se encogen y se acomodan abajo (antes, en el
//   mockup, los botones quedaban tapados por las tarjetas de atrás).
// Todo animado con entrada y salida (Regla 29): entrada escalonada de las
// tarjetas, reacomodo de la pila, botones con fundido.

const PEEK = 58        // lo que asoma cada tarjeta en la pila cerrada
const OPEN_GAP = 62    // espacio bajo la tarjeta abierta para los botones
const BELOW_PEEK = 18  // lo que asoma cada tarjeta bajo la abierta
const BELOW_SCALE = 0.94

function CardStack({ cards, onEdit, onDelete }) {
  const { t } = useTranslation()
  const wrapRef = useRef(null)
  const [width, setWidth] = useState(0)
  const [openId, setOpenId] = useState(null)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setWidth(el.offsetWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Si la tarjeta abierta desaparece (borrada), la pila se cierra.
  useEffect(() => {
    if (openId && !cards.some(c => c.id === openId)) setOpenId(null)
  }, [cards, openId])

  const H = width / 1.586
  const openIdx = cards.findIndex(c => c.id === openId)
  const isOpen = openIdx >= 0
  const n = cards.length

  let height = 0
  const positions = cards.map((c, i) => {
    if (!isOpen) return { top: i * PEEK, z: i, scale: 1 }
    if (i === openIdx) return { top: 0, z: 50, scale: 1 }
    const k = i < openIdx ? i : i - 1
    return { top: H + OPEN_GAP + k * BELOW_PEEK, z: 10 + k, scale: BELOW_SCALE }
  })
  if (n > 0) {
    height = isOpen
      ? (n > 1 ? H + OPEN_GAP + (n - 2) * BELOW_PEEK + H * BELOW_SCALE : H + OPEN_GAP)
      : (n - 1) * PEEK + H
  }

  const openCard = isOpen ? cards[openIdx] : null

  return (
    <div ref={wrapRef} className={styles.stack} style={{ '--stack-height': `${height}px` }}>
      {width > 0 && cards.map((c, i) => (
        // div con role=button (no <button>): la tarjeta visual lleva bloques
        // adentro, que un <button> no admite como contenido válido.
        <div
          role="button"
          tabIndex={0}
          key={c.id}
          onClick={() => setOpenId(openId === c.id ? null : c.id)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(openId === c.id ? null : c.id) } }}
          className={styles.stackCard}
          style={{
            '--card-top': `${positions[i].top}px`,
            '--card-z': positions[i].z,
            '--card-scale': positions[i].scale,
            '--enter-delay': `${i * 70}ms`,
          }}
          aria-label={getBank(c.bank).name}
        >
          <CreditCardVisual card={c} />
          {c._syncing && (
            <span className={`sync-spinner ${styles.cardSync}`} aria-label={t('sync.syncing')}>
              <Loader2 size={14} color="var(--surface)" />
            </span>
          )}
        </div>
      ))}

      <div
        className={`${styles.actions} ${isOpen ? styles.actionsOpen : ''}`}
        style={{ '--actions-top': `${H + 12}px` }}
      >
        <button type="button" className={styles.actionButton} disabled={!openCard || openCard._syncing} onClick={() => openCard && onEdit(openCard)}>
          {t('buttons.edit')}
        </button>
        <button type="button" className={`${styles.actionButton} ${styles.actionDanger}`} disabled={!openCard || openCard._syncing} onClick={() => openCard && onDelete(openCard)}>
          {t('buttons.delete')}
        </button>
        <button type="button" className={styles.actionButton} onClick={() => setOpenId(null)}>
          {t('buttons.close')}
        </button>
      </div>
    </div>
  )
}

export function SettingsCardsPage({ paymentMethods, onBack, slideClass }) {
  const { t } = useTranslation()
  const [kind, setKind] = useState('credit')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const { credit, debit, loaded, addMethod, updateMethod, deleteMethod } = paymentMethods
  const cards = kind === 'credit' ? credit : debit

  function openAdd() { setEditing(null); setFormOpen(true) }
  function openEdit(card) { setEditing(card); setFormOpen(true) }

  // Optimista: la tarjeta aparece/cambia al instante y el formulario cierra
  // sin esperar al servidor (si falla, App.jsx avisa y se revierte).
  function handleSave(data) {
    if (editing) updateMethod(editing.id, data)
    else { addMethod(data); setKind(data.kind) }
    setFormOpen(false)
  }

  function confirmDelete() {
    if (deleting) deleteMethod(deleting.id)
    setDeleting(null)
  }

  const deletingName = deleting
    ? [getBank(deleting.bank).id === 'otro' ? t('cards.otherBank') : getBank(deleting.bank).name, deleting.alias].filter(Boolean).join(' ')
    : ''

  return (
    <>
      <div className={`${slideClass} ${styles.pageWrapper}`}>
        <PageHero
          icon={CreditCard}
          title={t('cards.title')}
          description={t('cards.description')}
          onBack={onBack}
        />

        <div className={styles.content}>
          <div className={styles.disclaimer}>
            <ShieldCheck size={18} color="var(--accent)" className={styles.disclaimerIcon} />
            <div>
              <div className={styles.disclaimerTitle}>{t('cards.disclaimer.title')}</div>
              <div className={styles.disclaimerText}>{t('cards.disclaimer.text')}</div>
            </div>
          </div>

          <SegmentedControl
            value={kind}
            onChange={setKind}
            options={[
              { value: 'credit', label: `${t('cards.kind.credit')} · ${credit.length}` },
              { value: 'debit', label: `${t('cards.kind.debit')} · ${debit.length}` },
            ]}
          />

          {loaded && cards.length === 0 ? (
            <div className={styles.empty}>
              <EmptyState
                icon={Plus}
                title={t(kind === 'credit' ? 'cards.empty.creditTitle' : 'cards.empty.debitTitle')}
                subtitle={t('cards.empty.subtitle')}
                onClick={openAdd}
              />
            </div>
          ) : (
            // `key` por tipo: al cambiar de pila, la nueva entra escalonada.
            <CardStack key={kind} cards={cards} onEdit={openEdit} onDelete={setDeleting} />
          )}
        </div>
      </div>

      {/* Mismo botón flotante que "Agregar categoría"/"Añadir meta" —
          excepción documentada a la Regla 13 (RULES.md). */}
      <div className={styles.addPillRow}>
        <button type="button" onClick={openAdd} className={styles.addPill}>
          <Plus size={18} color="var(--surface)" />
          {t('cards.addButton')}
        </button>
      </div>

      <CardFormModal
        open={formOpen}
        initial={editing}
        onSave={handleSave}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDeleteModal
        open={!!deleting}
        title={t('cards.deleteTitle')}
        message={t('cards.deleteMessage', { name: deletingName })}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}
