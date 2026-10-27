import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, BellOff, TriangleAlert, CircleAlert, CalendarCheck, Clock, Banknote, CreditCard, ChevronDown, ChevronRight } from 'lucide-react'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que las demás
// sub-páginas ya migradas, v0.9.442-448) — import directo para tree-shaking real.
import { Bell as BellDuotone } from '@phosphor-icons/react/dist/csr/Bell'
import { PageHero } from '../../components/PageHero'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { needsPwaInstall } from '../../lib/pwa'
import { showToast } from '../../components/Toast'
import { Card, Toggle } from '../../components/SettingsShared'
import { TimeWheelSheet } from '../../components/TimeWheelSheet'
import { Collapse } from '../../components/Collapse'
import { useDeskSettings } from '../../components/DeskSettingsContext'
import { DeskSettingsHead, DeskPage } from '../../components/DeskSettingsHead'
import deskStyles from '../../components/SettingsDesk.module.css'
import dk from './SettingsNotificationsDesk.module.css'
import styles from './SettingsNotificationsPage.module.css'
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
  const desk = useDeskSettings()
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
  // iPhone/iPad sin instalar: se muestran los pasos en vez de intentar activar.
  const installNeeded = needsPwaInstall()
  // Tablet (≥768px, v0.9.781): distribución propia; el móvil queda intacto.
  const [isTablet, setIsTablet] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const on = e => setIsTablet(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const hour = profile.notif_hour ?? 8
  const daysBefore = profile.notif_days_before ?? 3
  const upcomingOn = profile.notif_upcoming !== false
  const onText = t('settingsNotifications.tileOn')
  const offText = t('settingsNotifications.tileOff')
  const mkTile = (key, Icon, label, field, on, status, wide = false) => ({
    key, Icon, label, on, wide, status: status ?? (on ? onText : offText), onToggle: () => onUpdate({ [field]: !on }),
  })
  const tiles = [
    mkTile('overdue', CircleAlert, t('settingsNotifications.overdueLabel'), 'notif_overdue', profile.notif_overdue !== false),
    mkTile('dueToday', CalendarCheck, t('settingsNotifications.dueTodayLabel'), 'notif_due_today', profile.notif_due_today !== false),
    mkTile('upcoming', Clock, t('settingsNotifications.upcomingLabel'), 'notif_upcoming', upcomingOn,
      upcomingOn ? t('settingsNotifications.tileDaysBefore', { count: daysBefore }) : null),
    mkTile('payDay', Banknote, t('settingsNotifications.payDayLabel'), 'notif_cobro_day', profile.notif_cobro_day !== false),
    // Corte, recordatorio y vencimiento de tarjetas de crédito (v0.9.740).
    mkTile('cards', CreditCard, t('settingsNotifications.cardsLabel'), 'notif_cards', profile.notif_cards !== false,
      profile.notif_cards !== false ? t('settingsNotifications.cardsStatus', { count: daysBefore }) : null, true),
  ]

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

  if (desk) {
    const [hh, ap] = HOUR_LABELS[hour].split(' ')
    const stepList = [
      { key: 'upcoming', cap: t('settingsNotifications.tablet.stepBefore'), Icon: Clock, label: t('settingsNotifications.upcomingLabel'), sub: t('settingsNotifications.tablet.upcomingSub'), field: 'notif_upcoming', on: upcomingOn },
      { key: 'dueToday', cap: t('settingsNotifications.tablet.stepDay'), Icon: CalendarCheck, label: t('settingsNotifications.dueTodayLabel'), sub: t('settingsNotifications.tablet.dueTodaySub'), field: 'notif_due_today', on: profile.notif_due_today !== false },
      { key: 'overdue', cap: t('settingsNotifications.tablet.stepAfter'), Icon: CircleAlert, label: t('settingsNotifications.overdueLabel'), sub: t('settingsNotifications.tablet.overdueSub'), field: 'notif_overdue', on: profile.notif_overdue !== false },
    ]
    const extra = tiles.filter(x => x.key === 'payDay' || x.key === 'cards')
    return (
      <DeskPage>
        <DeskSettingsHead title={t('settingsNotifications.title')} description={t('settingsNotifications.description')} />

        <div className={dk.top}>
          <div {...switchProps(subscribed)} className={`${deskStyles.blue} ${dk.master} ${dk.blueSw}`} onClick={handlePushToggle}>
            <span className={deskStyles.ic}>{subscribed ? <Bell size={24} /> : <BellOff size={24} />}</span>
            <div className={dk.masterText}>
              <b>{subscribed ? t('settingsNotifications.activeLabel') : t('settingsNotifications.enableLabel')}</b>
              <span>{subscribed ? t('settingsNotifications.activeSubtitle') : t('settingsNotifications.enableSubtitle')}</span>
            </div>
            <Toggle on={pushTarget ?? subscribed} instant={!ready} />
          </div>
          <div className={deskStyles.fill}>
            <button type="button" className={`${dk.hour} ${deskStyles.fill}`} style={{ padding: 0, background: 'none' }} onClick={() => setHourOpen(true)}>
              <span><b>{t('settingsNotifications.notifyAt')}</b></span>
              <strong>{hh} <small>{ap}</small></strong>
            </button>
          </div>
        </div>

        {installNeeded && (
          <div className={dk.notice}>
            <TriangleAlert size={18} color="var(--warning)" />
            <div>
              <strong>{t('settingsNotifications.installNeededTitle')}</strong>
              <ol><li>{t('settingsNotifications.installStep1')}</li><li>{t('settingsNotifications.installStep2')}</li><li>{t('settingsNotifications.installStep3')}</li></ol>
            </div>
          </div>
        )}
        {blocked && !subscribed && !installNeeded && (
          <div className={dk.notice}><TriangleAlert size={18} color="var(--warning)" /><span>{t('settingsNotifications.blockedNotice')}</span></div>
        )}

        {subscribed && (
          <>
            <div className={deskStyles.sec}>{t('settingsNotifications.tablet.stepsTitle')}</div>
            <div className={dk.steps}>
              {stepList.map(({ key, cap, Icon, label, sub, field, on }) => (
                <div key={key} className={`${dk.step} ${on ? dk.stepOn : ''}`}>
                  <div className={dk.stepHead}>
                    <span className={deskStyles.ic}><Icon size={22} /></span>
                    <div {...switchProps(on)} className={dk.sw} onClick={() => onUpdate({ [field]: !on })}><Toggle on={on} /></div>
                  </div>
                  <span className={dk.stepLabel}>{label}</span>
                  <span className={dk.stepSub}>{sub}</span>
                  <span className={dk.stepCap}>{cap}</span>
                </div>
              ))}
            </div>

            <div className={dk.bottom}>
              <div className={`${deskStyles.fill} ${dk.days}`}>
                <div>
                  <b>{t('settingsNotifications.daysBeforeLabel')}</b>
                  <span>{t('settingsNotifications.tablet.daysFor')}</span>
                </div>
                <div className={dk.dayBtns}>
                  {[1, 2, 3, 5, 7].map(d => (
                    <button key={d} type="button" onClick={() => onUpdate({ notif_days_before: d })} className={`${dk.dayBtn} ${daysBefore === d ? dk.dayOn : ''}`}>{d}</button>
                  ))}
                </div>
              </div>
              <div className={deskStyles.fill}>
                {extra.map(({ key, label, on, status, onToggle }) => (
                  <div key={key} {...switchProps(on)} className={deskStyles.tgl} onClick={onToggle}>
                    <div><b>{label}</b><span>{status}</span></div>
                    <Toggle on={on} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <TimeWheelSheet open={hourOpen} onClose={() => setHourOpen(false)} value={hour}
          onSelect={h => onUpdate({ notif_hour: h, notif_last_sent: null })} />
      </DeskPage>
    )
  }

  return (
    <div className={`${slideClass} ${styles.pageWrapper}`}>
      <PageHero
        icon={BellDuotone}
        title={t('settingsNotifications.title')}
        description={t('settingsNotifications.description')}
        onBack={onBack}
      />

      <Card>
        <div className={styles.subSection}>
          <div {...switchProps(subscribed)} className={styles.toggleRow} onClick={handlePushToggle}>
            <div className={styles.toggleRowLeft}>
              {subscribed ? <Bell size={18} color="var(--accent)" /> : <BellOff size={18} color="var(--text)" />}
              <div>
                <div className={styles.toggleLabel}>{subscribed ? t('settingsNotifications.activeLabel') : t('settingsNotifications.enableLabel')}</div>
                <div className={styles.toggleSubtitle}>
                  {subscribed ? t('settingsNotifications.activeSubtitle') : t('settingsNotifications.enableSubtitle')}
                </div>
              </div>
            </div>
            <Toggle on={pushTarget ?? subscribed} instant={!ready} />
          </div>
        </div>

        <Collapse open={installNeeded}>
          <div className={styles.blockedNotice}>
            <TriangleAlert size={16} color="var(--warning)" className={styles.blockedIcon} />
            <div>
              <strong>{t('settingsNotifications.installNeededTitle')}</strong>
              <ol className={styles.installSteps}>
                <li>{t('settingsNotifications.installStep1')}</li>
                <li>{t('settingsNotifications.installStep2')}</li>
                <li>{t('settingsNotifications.installStep3')}</li>
              </ol>
            </div>
          </div>
        </Collapse>

        <Collapse open={blocked && !subscribed && !installNeeded}>
          <div className={styles.blockedNotice}>
            <TriangleAlert size={16} color="var(--warning)" className={styles.blockedIcon} />
            <span>{t('settingsNotifications.blockedNotice')}</span>
          </div>
        </Collapse>

      </Card>

      <Collapse open={subscribed}>
        {!isTablet && (<>
        <div className={styles.timeRow}>
          <span className={styles.timeLabel}>{t('settingsNotifications.notifyAt')}</span>
          <button type="button" className={styles.timeButton} onClick={() => setHourOpen(true)}><Clock size={20} color="var(--accent)" />{HOUR_LABELS[hour]}<ChevronDown size={18} className={styles.timeChevron} /></button>
        </div>

        <div className={styles.tiles}>
          {tiles.map(({ key, Icon, label, on, status, wide, onToggle }) => (
            <button key={key} type="button" aria-pressed={on} onClick={onToggle}
              className={`${styles.tile} ${on ? styles.tileOn : ''} ${wide ? styles.tileWide : ''}`}>
              <span className={styles.tileIcon}><Icon size={17} /></span>
              <span>
                <span className={styles.tileLabel}>{label}</span>
                <span className={styles.tileStatus}>{status}</span>
              </span>
            </button>
          ))}
        </div>

        <Collapse open={upcomingOn || profile.notif_cards !== false}>
          <div className={styles.daysRow}>
            <span className={styles.timeLabel}>{t('settingsNotifications.daysBeforeLabel')}</span>
            <div className={styles.daysBeforeRow}>
              {[1, 2, 3, 5, 7].map(d => (
                <button key={d} onClick={() => onUpdate({ notif_days_before: d })}
                  className={`${styles.dayButton} ${daysBefore === d ? styles.dayButtonActive : ''}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        </Collapse>
        </>)}
        {isTablet && (
          <div className={styles.tabWrap}>
            <button type="button" className={styles.hourCard} onClick={() => setHourOpen(true)}>
              <span className={styles.hourIcon}><Clock size={26} /></span>
              <span className={styles.hourText}>
                <span className={styles.hourLabel}>{t('settingsNotifications.notifyAt')}</span>
                <span className={styles.hourValue}>{HOUR_LABELS[hour]}</span>
              </span>
              <ChevronDown size={22} className={styles.timeChevron} />
            </button>

            <div className={styles.stepsPanel}>
              <div className={styles.stepsTitle}>{t('settingsNotifications.tablet.stepsTitle')}</div>
              <div className={styles.steps}>
                {[
                  { key: 'upcoming', cap: t('settingsNotifications.tablet.stepBefore'), Icon: Clock, label: t('settingsNotifications.upcomingLabel'), sub: t('settingsNotifications.tablet.upcomingSub'), field: 'notif_upcoming', on: upcomingOn },
                  { key: 'dueToday', cap: t('settingsNotifications.tablet.stepDay'), Icon: CalendarCheck, label: t('settingsNotifications.dueTodayLabel'), sub: t('settingsNotifications.tablet.dueTodaySub'), field: 'notif_due_today', on: profile.notif_due_today !== false },
                  { key: 'overdue', cap: t('settingsNotifications.tablet.stepAfter'), Icon: CircleAlert, label: t('settingsNotifications.overdueLabel'), sub: t('settingsNotifications.tablet.overdueSub'), field: 'notif_overdue', on: profile.notif_overdue !== false, last: true },
                ].map(({ key, cap, Icon, label, sub, field, on, last }) => (
                  <div key={key} className={`${styles.step} ${on ? styles.stepOn : ''}`}>
                    <div className={styles.stepHead}>
                      <span className={styles.stepCap}>{cap}</span>
                      <div {...switchProps(on)} className={styles.stepSwitch} onClick={() => onUpdate({ [field]: !on })}><Toggle on={on} /></div>
                    </div>
                    <span className={styles.stepIcon}><Icon size={20} /></span>
                    <span className={styles.stepLabel}>{label}</span>
                    <span className={styles.stepSub}>{sub}</span>
                    {!last && <span className={styles.stepArrow}><ChevronRight size={12} /></span>}
                  </div>
                ))}
              </div>
              <div className={styles.daysStrip}>
                <span>
                  <span className={styles.daysStripTitle}>{t('settingsNotifications.daysBeforeLabel')}</span>
                  <span className={styles.stepSub}>{t('settingsNotifications.tablet.daysFor')}</span>
                </span>
<div className={styles.daysBeforeRow}>
              {[1, 2, 3, 5, 7].map(d => (
                <button key={d} onClick={() => onUpdate({ notif_days_before: d })}
                  className={`${styles.dayButton} ${daysBefore === d ? styles.dayButtonActive : ''}`}>
                  {d}
                </button>
              ))}
            </div>
              </div>
            </div>

            <div className={styles.tabTiles}>
              {tiles.filter(x => x.key === 'payDay' || x.key === 'cards').map(({ key, Icon, label, on, status, onToggle }) => (
                <button key={key} type="button" aria-pressed={on} onClick={onToggle}
                  className={`${styles.tile} ${on ? styles.tileOn : ''}`}>
                  <span className={styles.tileIcon}><Icon size={17} /></span>
                  <span>
                    <span className={styles.tileLabel}>{label}</span>
                    <span className={styles.tileStatus}>{status}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Collapse>

      <TimeWheelSheet open={hourOpen} onClose={() => setHourOpen(false)} value={hour}
        onSelect={h => onUpdate({ notif_hour: h, notif_last_sent: null })} />
    </div>
  )
}
