import { useTranslation } from 'react-i18next'
import { Wallet, Plus, Check } from 'lucide-react'
import { bankColorVar } from '../lib/cardCatalog'
import { cardLabel } from './PaymentMethodField'
import mk from './Modal.module.css'

// Lista de métodos de pago para elegir con un toque (v0.9.980, mockup de
// modales): Efectivo + tarjetas, la elegida con fondo gris y check, y
// «Agregar tarjeta» al final. Se usa en «¿Con qué se pagó?» y «¿Con qué
// pagaste?». `value` null = Efectivo.
export function MethodList({ methods, value, onChange, onAddCard, allowCredit = true }) {
  const { t } = useTranslation()
  const list = methods.filter(m => allowCredit || m.kind !== 'credit')
  const row = (id, icon, title, sub) => {
    const on = (value || null) === id
    return (
      <button key={id || 'cash'} type="button" role="radio" aria-checked={on} className={`${mk.opt} ${on ? mk.optOn : ''}`} onClick={() => onChange(id)}>
        {icon}
        <div><b>{title}</b>{sub && <span>{sub}</span>}</div>
        {on && <span className={mk.check}><Check size={13} strokeWidth={3} /></span>}
      </button>
    )
  }
  return (
    <div className={`${mk.pan} ${mk.list}`} role="radiogroup">
      {row(null, <span className={mk.tile}><Wallet size={17} /></span>, t('paymentMethod.cash'))}
      {list.map(m => row(m.id, <span className={mk.swatch} style={{ '--sw': bankColorVar(m.bank) }} />, cardLabel(m, t), t(`cards.kind.${m.kind}`)))}
      {onAddCard && (
        <button type="button" className={`${mk.opt} ${mk.optAdd}`} onClick={onAddCard}>
          <span className={mk.tile}><Plus size={17} /></span>
          <div><b>{t('paymentMethod.addCard')}</b></div>
        </button>
      )}
    </div>
  )
}
