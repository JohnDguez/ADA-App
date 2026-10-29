import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, PiggyBank, X as XIcon } from 'lucide-react'
import { fmt } from '../lib/utils'
import AmountInput from './AmountInput'
import { PaymentMethodField } from './PaymentMethodField'
import styles from './SplitContributionsModal.module.css'
import { AvatarImg } from './AvatarImg'
import { usePresence } from '../lib/usePresence'
import { useScrollLock } from '../lib/scrollLock'
import { kbd } from '../lib/a11y'
import { AnchoredPop, useAnchor } from './AnchoredPop'
import { useIsDesktop } from '../hooks/useIsDesktop'

// Registro de "quién puso cuánto" en un gasto del Espacio Compartido —
// deliberadamente NO es un split planeado de antemano (montos fijos por
// acuerdo): es una bitácora que se llena una persona a la vez, cuando cada
// quien se acuerda, y cualquier miembro puede editar la entrada de
// cualquier otro (confirmado con Johnatan). Nunca es obligatorio llenar a
// todos de un jalón — el progreso mostrado es informativo, nunca bloquea.
const PRESET_PERCENTAGES = [25, 50, 60, 75]

export function SplitContributionsModal({ open, payment: paymentProp, spaceMembers, currentUserId, getContributions, onCommit, onSetTotalAmount, onForceSettle, fundBalance, onSetFundContribution, openedBecauseFundInsufficient, paymentMethods = [], onClose }) {
  const { t } = useTranslation()
  // Escritorio (≥1100px, v0.9.927): popover anclado a lo que lo abrió; sin ancla
  // (apertura por código) o en móvil/tablet sigue siendo la hoja de siempre.
  // Se conserva el último pago para que la animación de salida no se corte
  // cuando App.jsx limpia el id al cerrar.
  const desk = useIsDesktop()
  const anchorRef = useAnchor(open, paymentProp?.id)
  const asPop = desk && !!anchorRef.current
  const lastPay = useRef(null)
  if (paymentProp) lastPay.current = paymentProp
  const payment = paymentProp || lastPay.current
  // Método de pago de MI parte (v0.9.547): solo se muestra en mi propia fila
  // y solo con mis tarjetas. `methodTouched` evita pisar el método ya
  // guardado al editar solo el monto.
  const [methodDraft, setMethodDraft] = useState(null)
  const [methodTouched, setMethodTouched] = useState(false)
  const [contributions, setContributions] = useState({}) // { [user_id]: amount } (lo ya guardado en el servidor)
  // Cambios pendientes de confirmar (v0.9.746): editar una fila ya NO guarda
  // al instante; se acumulan aquí y se envían juntos con "Confirmar", que cierra
  // el modal y deja que el pago se marque como pagado en segundo plano.
  const [staged, setStaged] = useState({})          // { [user_id]: { amount, methodId } }
  const [stagedFund, setStagedFund] = useState(undefined)
  const [loading,  setLoading]  = useState(false)
  const [openId,   setOpenId]   = useState(null)
  const [draft,    setDraft]    = useState('')
  const [error,    setError]    = useState('')
  const [settling, setSettling] = useState(false)

  // Solo para pagos variables — el monto no se sabe de antemano, así que se
  // captura/edita aquí mismo (antes vivía solo en "Agregar monto", un
  // camino totalmente aparte que nunca revisaba si los abonos ya cubrían el
  // total; ahora todo pasa por el mismo lugar).
  const [totalDraft,  setTotalDraft]  = useState('')
  const [totalSaving, setTotalSaving] = useState(false)

  useEffect(() => {
    if (!open || !payment) return
    setOpenId(null); setDraft(''); setError(''); setStaged({}); setStagedFund(undefined)
    setTotalDraft(payment.amount ? String(payment.amount) : '')
    setLoading(true)
    getContributions(payment.id).then(({ contributions: rows }) => {
      const map = {}
      for (const r of rows) map[r.user_id] = Number(r.amount)
      setContributions(map)
      setLoading(false)
    })
  }, [open, payment?.id])

  // Cambios de OTRO miembro mientras este modal está abierto (v0.9.743): el
  // realtime refresca el pago (contributed_amount/fund_amount/is_paid) pero las
  // contribuciones se leían una sola vez al abrir, así que el modal mostraba
  // montos viejos. Se recargan sin tocar la fila que se está editando.
  const liveKey = payment ? `${payment.contributed_amount}|${payment.fund_amount}|${payment.amount}|${payment.is_paid}` : ''
  const firstLiveRun = useRef(true)
  useEffect(() => {
    if (firstLiveRun.current) { firstLiveRun.current = false; return }
    if (!open || !payment || loading) return
    let cancelled = false
    getContributions(payment.id).then(({ contributions: rows }) => {
      if (cancelled) return
      const map = {}
      for (const r of rows) map[r.user_id] = Number(r.amount)
      setContributions(map)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey])

  const { render, closing } = usePresence(open)
  useScrollLock(open && !asPop)
  if (!render || !payment) return null

  async function handleSaveTotal() {
    const val = parseFloat(totalDraft)
    if (isNaN(val) || val <= 0) { setError(t('settingsCobro.toast.invalidAmount')); return }
    setTotalSaving(true)
    const { error: err } = await onSetTotalAmount(payment.id, val)
    setTotalSaving(false)
    if (err) { setError(err.message || t('splitContributionsModal.saveTotalError')); return }
    setError('')
  }

  async function handlePagar() {
    setSettling(true)
    const { error: err } = await onForceSettle(payment.id)
    setSettling(false)
    if (err) { setError(err.message || t('splitContributionsModal.settleError')); return }
    onClose()
  }

  const total = Number(payment.amount) || 0
  const needsTotal = payment.is_variable && total <= 0
  const fundAmount = stagedFund !== undefined ? stagedFund : (Number(payment.fund_amount) || 0)
  // Lo guardado + lo pendiente de confirmar
  const eff = { ...contributions }
  for (const [id, st] of Object.entries(staged)) {
    if (st.amount > 0) eff[id] = st.amount
    else delete eff[id]
  }
  const hasChanges = Object.keys(staged).length > 0 || stagedFund !== undefined
  const registrado = Object.values(eff).reduce((s, v) => s + v, 0) + fundAmount
  const restan = total - registrado
  const done = !needsTotal && restan <= 0

  function openRow(memberId) {
    if (openId === memberId) { setOpenId(null); return }
    setOpenId(memberId)
    setMethodDraft(null)
    setMethodTouched(false)
    setDraft(eff[memberId] != null ? String(eff[memberId]) : '')
    setError('')
  }

  const FUND_ROW_ID = '__fund__'
  function openFundRow() {
    if (openId === FUND_ROW_ID) { setOpenId(null); return }
    setOpenId(FUND_ROW_ID)
    setDraft(fundAmount > 0 ? String(fundAmount) : '')
    setError('')
  }

  function handleSaveFund() {
    const val = parseFloat(draft)
    if (draft !== '' && (isNaN(val) || val < 0)) { setError(t('settingsCobro.toast.invalidAmount')); return }
    const numVal = val || 0
    // Mientras el pago sigue pendiente, no puede exceder ni lo que falta
    // del pago ni lo que el Fondo en verdad tiene ahorrado — el servidor ya
    // valida esto también, esto es solo para no hacer un viaje de más.
    if (!payment.is_paid && numVal > 0) {
      const availableForPayment = total - (registrado - fundAmount)
      const cap = Math.min(availableForPayment, fundBalance + fundAmount)
      if (Math.round(numVal * 100) > Math.round(cap * 100) + 1) {
        setError(t('splitContributionsModal.exceedsAvailable', { amount: fmt(Math.max(0, cap)) }))
        return
      }
    }
    setStagedFund(numVal)
    setOpenId(null)
  }

  function handleSave(memberId) {
    const val = parseFloat(draft)
    if (draft !== '' && (isNaN(val) || val < 0)) { setError(t('settingsCobro.toast.invalidAmount')); return }
    // Mientras el pago sigue PENDIENTE, nadie puede poner más de lo que en
    // verdad queda disponible — si ya está pagado (se está agregando un
    // contribuyente nuevo a uno ya completo), sí se permite exceder: el
    // servidor resta el sobrante de los demás contribuyentes (ver
    // register-contribution.js, es harina de otro costal).
    if (!payment.is_paid && val > 0) {
      const available = total - (registrado - (eff[memberId] || 0))
      if (Math.round(val * 100) > Math.round(available * 100) + 1) {
        setError(t('splitContributionsModal.exceedsAvailable', { amount: fmt(Math.max(0, available)) }))
        return
      }
    }
    setStaged(prev => ({
      ...prev,
      [memberId]: {
        amount: val || 0,
        methodId: memberId === currentUserId && paymentMethods.length > 0
          ? (methodTouched ? methodDraft : (contributions[memberId] == null ? null : undefined))
          : undefined,
      },
    }))
    setError('')
    setOpenId(null)
  }

  // Confirmar: se cierra el modal al instante y el guardado (con el pago
  // marcándose como pagado si ya se cubrió) corre en segundo plano.
  function handleConfirm() {
    const rows = Object.entries(staged).map(([memberId, st]) => ({ memberId, amount: st.amount, methodId: st.methodId }))
    onClose()
    onCommit(payment.id, { rows, fund: stagedFund })
  }

  const body = (
    <div className={asPop ? styles.deskRoot : undefined}>
        {asPop ? (
          <div className={styles.deskHead}>
            <div>
              <h2 className={styles.deskTitle}>{t('paymentsPage.menuSplit')}</h2>
              <div className={styles.deskSub}>{payment.name}</div>
            </div>
            <button type="button" className={styles.deskClose} onClick={onClose} aria-label={t('buttons.close')}><XIcon size={16} /></button>
          </div>
        ) : (
          <>
            <div className={styles.handle} />
            <div className={styles.title}>{t('paymentsPage.menuSplit')}</div>
            <div className={styles.description}>{payment.name}</div>
          </>
        )}

        {payment.is_variable && (
          <>
            <label className="field-label">{t('paymentModal.totalAmountToPay')}</label>
            <div className={styles.editRow}>
              <AmountInput value={totalDraft} onChange={e => setTotalDraft(e.target.value)} placeholder="0.00" onKeyDown={e => e.key === 'Enter' && handleSaveTotal()} className={`field-input ${styles.grow}`} />
              <button onClick={handleSaveTotal} disabled={totalSaving} className={`btn-primary ${styles.saveInline}`}>{t('buttons.save')}</button>
            </div>
          </>
        )}

        {error && <div className={styles.errorBox}>{error}</div>}

        {openedBecauseFundInsufficient && (
          <div className={styles.fundInsufficientNotice}>
            {t('splitContributionsModal.fundInsufficientNotice', { amount: fmt(fundAmount) })}
          </div>
        )}

        {!loading && !needsTotal && (
          <div className={`${styles.progress} ${done ? styles.progressDone : ''}`}>
            <div className={styles.progressAmounts}>{fmt(registrado)} / {fmt(total)}</div>
            <div className={styles.progressStatus}>{done ? t('splitContributionsModal.complete') : t('splitContributionsModal.remaining', { amount: fmt(restan) })}</div>
            {asPop && <div className={styles.bar}><i style={{ width: `${total > 0 ? Math.min(100, Math.max(0, (registrado / total) * 100)) : 0}%` }} /></div>}
          </div>
        )}

        {!needsTotal && (
          <>
            <label className="field-label">{t('splitContributionsModal.membersLabel')}</label>
            <div className={styles.members}>
              {onSetFundContribution && (
                <div className={styles.memberCard}>
                  <div {...kbd}
                    onClick={() => (fundBalance > 0 || fundAmount > 0) && openFundRow()}
                    className={`${styles.memberRow} ${fundBalance <= 0 && fundAmount <= 0 ? styles.memberRowLocked : ''}`}
                  >
                    <span className={styles.memberNameRow}>
                      <span className={styles.fundAvatar}>
                        <PiggyBank size={14} color="var(--surface)" strokeWidth={2} />
                      </span>
                      <span className={styles.memberName}>
                        {t('splitContributionsModal.sharedFundName')}
                        {fundBalance <= 0 && fundAmount <= 0 && <Lock size={12} className={styles.fundLockIcon} />}
                      </span>
                    </span>
                    {fundAmount > 0
                      ? <span className={styles.memberAmount}>{fmt(fundAmount)} <span className={styles.editLabel}>{t('buttons.edit')}</span></span>
                      : fundBalance > 0
                        ? <span className={styles.memberEmpty}>{t('splitContributionsModal.notRegistered')}</span>
                        : <span className={styles.memberEmpty}>{t('splitContributionsModal.noBalance')}</span>}
                  </div>
                  {openId === FUND_ROW_ID && (
                    <div className={styles.editRow}>
                      <AmountInput autoFocus value={draft} onChange={e => setDraft(e.target.value)} placeholder="0.00" onKeyDown={e => e.key === 'Enter' && handleSaveFund()} className={`field-input ${styles.grow}`} />
                      <button onClick={handleSaveFund} className={`btn-primary ${styles.saveInline}`}>{t('splitContributionsModal.rowDone')}</button>
                    </div>
                  )}
                </div>
              )}
              {spaceMembers.map(m => {
                const isOpen = openId === m.user_id
                const amount = eff[m.user_id]
                return (
                  <div key={m.user_id} className={styles.memberCard}>
                    <div {...kbd} onClick={() => openRow(m.user_id)} className={styles.memberRow}>
                      <span className={styles.memberNameRow}>
                        <span className={styles.memberAvatar}>
                          <AvatarImg
                            src={m.profile?.avatar_url}
                            className={styles.memberAvatarImg}
                            fallback={<span className={styles.memberAvatarInitial}>{(m.profile?.name || '?').charAt(0).toUpperCase()}</span>}
                          />
                        </span>
                        <span className={styles.memberName}>{m.profile?.name || t('splitContributionsModal.memberFallback')}{m.user_id === currentUserId ? t('splitContributionsModal.youSuffix') : ''}</span>
                      </span>
                      {amount != null
                        ? <span className={styles.memberAmount}>{fmt(amount)} <span className={styles.editLabel}>{t('buttons.edit')}</span></span>
                        : <span className={styles.memberEmpty}>{t('splitContributionsModal.notRegistered')}</span>}
                    </div>
                    {isOpen && (
                      <div>
                        {/* Porcentajes SIEMPRE sobre el total fijo, nunca
                            sobre lo que resta — pero se bloquean los que se
                            pasarían de lo que en verdad queda disponible,
                            contando lo que ya pusieron los demás miembros. */}
                        <div className={styles.availableHint}>{t('splitContributionsModal.availableHint', { available: fmt(Math.max(0, total - (registrado - (amount || 0)))), total: fmt(total) })}</div>
                        <div className={styles.presetRow}>
                          {PRESET_PERCENTAGES.map(pct => {
                            const presetAmt = Math.round(total * pct) / 100
                            const available = total - (registrado - (amount || 0))
                            const disabled = Math.round(presetAmt * 100) > Math.round(available * 100) + 1
                            return (
                              <button
                                key={pct}
                                type="button"
                                disabled={disabled}
                                onClick={() => setDraft(String(presetAmt))}
                                className={styles.presetButton}
                              >
                                {pct}%
                              </button>
                            )
                          })}
                        </div>
                        {(() => {
                          // "Completar" (v0.9.927): rellena con lo que de verdad falta,
                          // sin tener que calcularlo ni teclear centavos.
                          const left = Math.round((total - (registrado - (amount || 0))) * 100) / 100
                          return (
                            <div className={styles.fillWrap}>
                              <button type="button" disabled={left <= 0} onClick={() => setDraft(String(left))} className={styles.fillButton}>
                                {t('splitContributionsModal.fillRemaining', { amount: fmt(Math.max(0, left)) })}
                              </button>
                            </div>
                          )
                        })()}
                        {m.user_id === currentUserId && paymentMethods.length > 0 && (
                          <div className={styles.methodFieldWrap}>
                            <PaymentMethodField methods={paymentMethods} value={methodDraft} onChange={id => { setMethodDraft(id); setMethodTouched(true) }} />
                          </div>
                        )}
                        <div className={styles.editRow}>
                          <AmountInput autoFocus value={draft} onChange={e => setDraft(e.target.value)} placeholder="0.00" onKeyDown={e => e.key === 'Enter' && handleSave(m.user_id)} className={`field-input ${styles.grow}`} />
                          <button onClick={() => handleSave(m.user_id)} className={`btn-primary ${styles.saveInline}`}>{t('splitContributionsModal.rowDone')}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div className={asPop ? styles.deskFoot : undefined}>
          {asPop && <button onClick={onClose} className={styles.deskCancel}>{hasChanges ? t('buttons.cancel') : t('buttons.close')}</button>}
          {hasChanges && (
            <button onClick={handleConfirm} className={styles.payButton}>
              {t('splitContributionsModal.confirm')}
            </button>
          )}
          {!hasChanges && done && !payment.is_paid && (
            <button onClick={handlePagar} disabled={settling} className={styles.payButton}>
              {settling ? t('splitContributionsModal.marking') : t('splitContributionsModal.pay')}
            </button>
          )}
          {!asPop && <button onClick={onClose} className="btn-ghost">{hasChanges ? t('buttons.cancel') : t('buttons.close')}</button>}
        </div>
    </div>
  )

  if (asPop) {
    return <AnchoredPop open={!!open} onClose={onClose} anchorRef={anchorRef} width={420} label={t('paymentsPage.menuSplit')}>{body}</AnchoredPop>
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} className={styles.overlay} data-presence="overlay" data-closing={closing ? '' : undefined}>
      <div className={styles.modal} data-presence="panel" data-closing={closing ? '' : undefined}>
        {body}
      </div>
    </div>
  )
}
