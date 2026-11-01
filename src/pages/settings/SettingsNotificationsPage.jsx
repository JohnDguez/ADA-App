import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, BellOff, TriangleAlert, ChevronDown } from 'lucide-react'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que las demás
// sub-páginas ya migradas, v0.9.442-448) — import directo para tree-shaking real.
import { Bell as BellDuotone } from '@phosphor-icons/react/dist/csr/Bell'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { needsPwaInstall } from '../../lib/pwa'
import { showToast } from '../../components/Toast'
import { Toggle } from '../../components/SettingsShared'
import { TimeWheelSheet } from '../../components/TimeWheelSheet'
import { Collapse } from '../../components/Collapse'
import { SettingsSubLayout } from '../../components/SettingsSubLayout'
import kit from '../../components/SettingsKit.module.css'
import { switchProps } from '../../lib/a11y'

// Mismo formato de horas que ya usaba el <select> nativo (12:00 am ... 11:00
// pm) — Select.jsx trabaja con opciones como texto, así que se guarda el
// arreglo completo y se convierte de ida (hora → etiqueta) y vuelta
// (etiqueta → hora, vía indexOf, seguro porque cada etiqueta es única).
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12:00 am' : i < 12 ? `${i}:00 am` : i === 12 ? '12:00 pm' : `${i - 12}:00 pm`
)

// Sub-página "Notificaciones" dentro de Ajustes. Antes vivía directo en
// SettingsPage.jsx.
export function SettingsNotificationsPage({ profile, user, onUpdate, onBack, slideClass }) {
  const { t } = useTranslation()
  const { subscribed, ready, subscribe, unsubscribe } = usePushNotifications(user?.id)

  // `pushTarget` (v0.9.482): el switch se mueve al instante hacia donde se
  // pidió, en vez de esperar a que termine todo el proceso (registrar el
  // service worker, el permiso del navegador, guardar la suscripción) —
  // eso puede tardar segundos. Al terminar vuelve a mostrar el estado real:
  // si falló o se negó el permiso, regresa solo.
  const [pushTarget, setPushTarget] = useState(null)

  // Permiso bloqueado en el navegador: se avisa con un mensaje fijo (el toast
  // desaparece y el usuario se queda sin saber por qué no funciona).
  const readBlocked = () => typeof Notification !== 'undefined' && Notification.permission === 'denied'
  const [blocked, setBlocked] = useState(readBlocked)
  const [hourOpen, setHourOpen] = useState(false)
  const hourRef = useRef(null)
  // iPhone/iPad sin instalar: se muestran los pasos en vez de intentar activar.
  const installNeeded = needsPwaInstall()
  const hour = profile.notif_hour ?? 8
  const daysBefore = profile.notif_days_before ?? 3
  const upcomingOn = profile.notif_upcoming !== false
  const offText = t('settingsNotifications.tileOff')

  async function handlePushToggle() {
    if (pushTarget !== null) return
    if (installNeeded && !subscribed) return
    if (subscribed) {
      setPushTarget(false)
      await unsubscribe(); showToast(t('settingsNotifications.toast.disabled'))
    } else {
      setPushTarget(true)
      const { error } = await subscribe()
      setBlocked(readBlocked())
      if (error === 'Permiso denegado') showToast(t('settingsNotifications.toast.permissionDenied'))
      else if (error) showToast(t('settingsNotifications.toast.enableError') + (typeof error === 'string' ? ` (${error})` : ''))
      else showToast(t('settingsNotifications.toast.enabled'))
    }
    setPushTarget(null)
  }

  const steps = [
    { key: 'upcoming', cap: t('settingsNotifications.tablet.stepBefore'), label: t('settingsNotifications.upcomingLabel'), sub: t('settingsNotifications.tablet.upcomingSub'), field: 'notif_upcoming', on: upcomingOn },
    { key: 'dueToday', cap: t('settingsNotifications.tablet.stepDay'), label: t('settingsNotifications.dueTodayLabel'), sub: t('settingsNotifications.tablet.dueTodaySub'), field: 'notif_due_today', on: profile.notif_due_today !== false },
    { key: 'overdue', cap: t('settingsNotifications.tablet.stepAfter'), label: t('settingsNotifications.overdueLabel'), sub: t('settingsNotifications.tablet.overdueSub'), field: 'notif_overdue', on: profile.notif_overdue !== false },
  ]
  const extra = [
    { key: 'cards', label: t('settingsNotifications.cardsLabel'), on: profile.notif_cards !== false,
      status: profile.notif_cards !== false ? t('settingsNotifications.cardsStatus', { count: daysBefore }) : offText, field: 'notif_cards' },
    { key: 'payDay', label: t('settingsNotifications.payDayLabel'), on: profile.notif_cobro_day !== false,
      status: t('settingsNotifications.payDaySub'), field: 'notif_cobro_day' },
  ]
  const pushOn = pushTarget ?? subscribed

  // Misma composición en los tres tamaños (v0.9.977, mockup aprobado):
  // héroe azul con el interruptor general + hora; al activar, se despliegan
  // los avisos de un pago (Antes / El día / Después), los días de
  // anticipación y Tarjetas / Día de cobro.
  return (
    <SettingsSubLayout title={t('settingsNotifications.title')} description={t('settingsNotifications.description')}
      icon={BellDuotone} onBack={onBack} slideClass={slideClass}
      after={<TimeWheelSheet open={hourOpen} anchorRef={hourRef} onClose={() => setHourOpen(false)} value={hour}
        onSelect={h => onUpdate({ notif_hour: h, notif_last_sent: null })} />}>
      <div className={`${kit.grid} ${kit.stretch}`}>
        <section {...switchProps(subscribed)} className={`${kit.hero} ${kit.clickable}`} onClick={handlePushToggle}>
          <span className={kit.heroIc}>{pushOn ? <Bell size={20} /> : <BellOff size={20} />}</span>
          <div className={kit.heroText}>
            <b>{subscribed ? t('settingsNotifications.activeLabel') : t('settingsNotifications.enableLabel')}</b>
            <span>{subscribed ? t('settingsNotifications.activeSubtitle') : t('settingsNotifications.enableSubtitle')}</span>
          </div>
          <Toggle on={pushOn} instant={!ready} />
        </section>
        <section className={kit.panel}>
          <div className={kit.pt}>
            <b>{t('settingsNotifications.notifyAt')}</b>
            {!subscribed && <span>{t('settingsNotifications.hourNeedsOn')}</span>}
          </div>
          <button ref={hourRef} type="button" className={kit.chipBig} disabled={!subscribed} onClick={() => setHourOpen(true)}>
            {HOUR_LABELS[hour]}<ChevronDown size={18} />
          </button>
        </section>
      </div>

      <Collapse open={installNeeded}>
        <div className={kit.cstack}>
          <div className={kit.notice}>
            <TriangleAlert size={18} />
            <div>
              <strong>{t('settingsNotifications.installNeededTitle')}</strong>
              <ol><li>{t('settingsNotifications.installStep1')}</li><li>{t('settingsNotifications.installStep2')}</li><li>{t('settingsNotifications.installStep3')}</li></ol>
            </div>
          </div>
        </div>
      </Collapse>
      <Collapse open={blocked && !subscribed && !installNeeded}>
        <div className={kit.cstack}>
          <div className={kit.notice}><TriangleAlert size={18} /><span>{t('settingsNotifications.blockedNotice')}</span></div>
        </div>
      </Collapse>

      <Collapse open={subscribed}>
        <div className={kit.cstack}>
          <section className={kit.panel}>
            <div className={kit.pt}><b>{t('settingsNotifications.tablet.stepsTitle')}</b></div>
            <div className={kit.tiles3}>
              {steps.map(({ key, cap, label, sub, field, on }) => (
                <div key={key} {...switchProps(on)} className={kit.tile} onClick={() => onUpdate({ [field]: !on })}>
                  <em>{cap}</em><b>{label}</b><span>{sub}</span>
                  <span className={kit.tileSw}><Toggle on={on} /></span>
                </div>
              ))}
            </div>
            <Collapse open={upcomingOn || profile.notif_cards !== false}>
              <div className={kit.cstack} style={{ gap: 10 }}>
                <div className={kit.sub2}>{t('settingsNotifications.daysForShort')}</div>
                <div className={`${kit.chips} ${kit.chipsEq}`}>
                  {[1, 2, 3, 5, 7].map(d => (
                    <button key={d} type="button" aria-pressed={daysBefore === d} onClick={() => onUpdate({ notif_days_before: d })}
                      className={`${kit.chip} ${daysBefore === d ? kit.chipOn : ''}`}>
                      {t('settingsNotifications.daysChip', { count: d })}
                    </button>
                  ))}
                </div>
              </div>
            </Collapse>
          </section>
          <section className={kit.panel}>
            {extra.map(({ key, label, on, status, field }, i) => (
              <div key={key} style={{ display: 'contents' }}>
                {i > 0 && <div className={kit.sep} />}
                <div {...switchProps(on)} className={`${kit.row} ${kit.clickable}`} onClick={() => onUpdate({ [field]: !on })}>
                  <div className={kit.rowText}><b>{label}</b><span>{status}</span></div>
                  <Toggle on={on} />
                </div>
              </div>
            ))}
          </section>
        </div>
      </Collapse>
    </SettingsSubLayout>
  )
}
