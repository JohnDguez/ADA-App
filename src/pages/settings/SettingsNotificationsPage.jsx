import { ChevronLeft, Bell, BellOff } from 'lucide-react'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { showToast } from '../../components/Toast'
import { Card, Toggle, NotifToggle } from '../../components/SettingsShared'

// Sub-página "Notificaciones" dentro de Ajustes. Antes vivía directo en
// SettingsPage.jsx.
export function SettingsNotificationsPage({ profile, user, onUpdate, onBack, slideClass }) {
  const { subscribed, subscribe, unsubscribe } = usePushNotifications(user?.id)

  async function handlePushToggle() {
    if (subscribed) {
      await unsubscribe(); showToast('Notificaciones desactivadas')
    } else {
      const { error } = await subscribe()
      if (error === 'Permiso denegado') showToast('Permiso denegado — actívalo en ajustes del navegador')
      else if (error) showToast('Error al activar notificaciones')
      else showToast('Notificaciones activadas')
    }
  }

  return (
    <div className={slideClass} style={{ paddingBottom: 120, background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '52px 16px 20px' }}>
        <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ChevronLeft size={18} color="var(--text)" />
        </button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Notificaciones</div>
      </div>

      <Card>
        <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={handlePushToggle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {subscribed ? <Bell size={18} color="var(--accent)" /> : <BellOff size={18} color="var(--text)" />}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{subscribed ? 'Notificaciones activas' : 'Activar notificaciones'}</div>
                <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 1 }}>
                  {subscribed ? 'Recibes alertas en este dispositivo' : 'Recibe recordatorios de pagos'}
                </div>
              </div>
            </div>
            <Toggle on={subscribed} />
          </div>
        </div>

        {subscribed && (<>
          <div style={{ padding: '13px 14px', borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Hora de notificación</div>
            <select value={profile.notif_hour ?? 8} onChange={e => onUpdate({ notif_hour: parseInt(e.target.value), notif_last_sent: null })} className="field-input" style={{ maxWidth: 140 }}>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{i === 0 ? '12:00 am' : i < 12 ? `${i}:00 am` : i === 12 ? '12:00 pm' : `${i - 12}:00 pm`}</option>
              ))}
            </select>
          </div>

          <NotifToggle label="Pagos vencidos"  sub="Cuando un pago no se cubrió a tiempo"    value={profile.notif_overdue    !== false} onChange={v => onUpdate({ notif_overdue:    v })} />
          <NotifToggle label="Vencen hoy"      sub="Pagos que llegan a su fecha límite hoy"  value={profile.notif_due_today  !== false} onChange={v => onUpdate({ notif_due_today:  v })} />
          <NotifToggle label="Próximos pagos"  sub="Recordatorio días antes del vencimiento" value={profile.notif_upcoming   !== false} onChange={v => onUpdate({ notif_upcoming:   v })} />

          {profile.notif_upcoming !== false && (
            <div style={{ padding: '0 14px 13px' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>Días de anticipación</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 5, 7].map(d => (
                  <button key={d} onClick={() => onUpdate({ notif_days_before: d })}
                    style={{ width: 36, height: 36, borderRadius: 5, border: 'none', background: (profile.notif_days_before ?? 3) === d ? 'var(--accent)' : 'var(--bg)', color: (profile.notif_days_before ?? 3) === d ? 'var(--surface)' : 'var(--text)', fontWeight: (profile.notif_days_before ?? 3) === d ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          <NotifToggle label="Día de cobro" sub="Resumen de pagos pendientes al cobrar" value={profile.notif_cobro_day !== false} onChange={v => onUpdate({ notif_cobro_day: v })} last />
        </>)}
      </Card>
    </div>
  )
}
