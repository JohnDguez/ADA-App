import { useState, useRef, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ShieldCheck, Loader2 } from 'lucide-react'
// Import DIRECTO al archivo del ícono (no el barrel) — mismo criterio que
// las demás sub-páginas de Ajustes (tree-shaking real).
import { CreditCard } from '@phosphor-icons/react/dist/csr/CreditCard'
import { PageHero } from '../../components/PageHero'
import { CreditCardVisual } from '../../components/CreditCardVisual'
import { CardFormModal } from '../../components/CardFormModal'
import { CardDetailPanel } from '../../components/CardDetailPanel'
import { SegmentedControl } from '../../components/SegmentedControl'
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal'
import { EmptyState } from '../../components/EmptyState'
import { getBank } from '../../lib/cardCatalog'
import { totalOwedOnCard } from '../../lib/cardStatements'
import { fmt } from '../../lib/utils'
import styles from './SettingsCardsPage.module.css'

// Mis tarjetas (v0.9.486, entrega A). Actualizado en v0.9.495 (mockups
// confirmados con Johnatan): tocar una tarjeta ya NO la abre en la propia
// pila — navega DIRECTO a `CardDetailPanel.jsx`, con su historial
// filtrable y Editar/Eliminar en el menú de 3 puntos de esa pantalla.
// - Aviso fijo arriba: NO son formas de pago y la app no tiene acceso a
//   ninguna cuenta; solo sirven para identificar y organizar gastos.
// - Dos pilas separadas (Crédito / Débito), cada una estilo cartera —
//   ahora de solo lectura/navegación, sin estado "abierta".
// Todo animado con entrada y salida (Regla 29): entrada escalonada de las
// tarjetas al cambiar de pila.

const PEEK = 58 // lo que asoma cada tarjeta en la pila

function CardStack({ cards, onSelect, personalPayments }) {
  const { t } = useTranslation()
  const wrapRef = useRef(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setWidth(el.offsetWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const H = width / 1.586
  const height = cards.length > 0 ? (cards.length - 1) * PEEK + H : 0

  return (
    <div ref={wrapRef} className={styles.stack} style={{ '--stack-height': `${height}px` }}>
      {width > 0 && cards.map((c, i) => (
        // div con role=button (no <button>): la tarjeta visual lleva bloques
        // adentro, que un <button> no admite como contenido válido.
        <div
          role="button"
          tabIndex={0}
          key={c.id}
          onClick={() => onSelect(c)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c) } }}
          className={styles.stackCard}
          style={{
            '--card-top': `${i * PEEK}px`,
            '--card-z': i,
            '--card-scale': 1,
            '--enter-delay': `${i * 70}ms`,
          }}
          aria-label={getBank(c.bank).name}
        >
          <CreditCardVisual
            card={c}
            cycleSpendLabel={
              // FIX v0.9.502 (reportado por Johnatan: "Debes" es muy
              // informal, y ya no es solo la deuda del ciclo — es el
              // mismo total consolidado que la pastilla "Por pagar" del
              // detalle, `totalOwedOnCard`). `personalPayments === null`
              // (viendo un Espacio Compartido) → no se muestra un número
              // incorrecto.
              c.kind === 'credit' && personalPayments
                ? t('cards.owedChip', { amount: fmt(totalOwedOnCard(c, personalPayments)) })
                : null
            }
          />
          {c._syncing && (
            <span className={`sync-spinner ${styles.cardSync}`} aria-label={t('sync.syncing')}>
              <Loader2 size={14} color="var(--surface)" />
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

export function SettingsCardsPage({ paymentMethods, personalPayments = null, onPayCardNow, onBack, slideClass }) {
  const { t } = useTranslation()
  const [kind, setKind] = useState('credit')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  const { credit, debit, loaded, addMethod, updateMethod, deleteMethod } = paymentMethods
  const cards = kind === 'credit' ? credit : debit
  const selectedCard = selectedId ? paymentMethods.methods.find(m => m.id === selectedId) || null : null

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
    if (selectedId === deleting?.id) setSelectedId(null)
    setDeleting(null)
  }

  const deletingName = deleting
    ? [getBank(deleting.bank).id === 'otro' ? t('cards.otherBank') : getBank(deleting.bank).name, deleting.alias].filter(Boolean).join(' ')
    : ''

  if (selectedCard) {
    return (
      <>
        <div className={`${slideClass} ${styles.pageWrapper}`}>
          <CardDetailPanel
            card={selectedCard}
            payments={personalPayments}
            onBack={() => setSelectedId(null)}
            onEdit={() => openEdit(selectedCard)}
            onDelete={() => setDeleting(selectedCard)}
            onPayNow={onPayCardNow}
          />
        </div>

        <CardFormModal open={formOpen} initial={editing} onSave={handleSave} onClose={() => setFormOpen(false)} />
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

          {/* "Por pagar" (v0.9.502, pedido de Johnatan): antes solo sumaba
              los estados de cuenta YA generados — ahora, igual que la
              pastilla del detalle, suma también el ciclo en curso de cada
              tarjeta (`totalOwedOnCard`, una por tarjeta y luego sumadas). */}
          {kind === 'credit' && personalPayments && (
            <div className={styles.totalPill}>
              <span>{t('cards.pendingCreditTotal')}</span>
              <span className={styles.totalPillAmount}>
                {fmt(credit.reduce((s, c) => s + totalOwedOnCard(c, personalPayments), 0))}
              </span>
            </div>
          )}

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
            <CardStack key={kind} cards={cards} onSelect={c => setSelectedId(c.id)} personalPayments={personalPayments} />
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
