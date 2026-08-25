import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Receipt, Wallet, Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PremiumLock } from '../../components/PremiumLock'
import { Select } from '../../components/Select'
import { DatePicker } from '../../components/DatePicker'
import { dateToStr, todayStr, dateOf, fmt, getCategoryLabel } from '../../lib/utils'
import { buildCsv, downloadCsv } from '../../lib/exportCsv'
import styles from './SettingsExportPage.module.css'

// Sub-página "Exportar datos" — Fase 1 del módulo de Reportes (ver
// CONTEXT.md, pendiente "Rediseño de PremiumPage.jsx"). Deja elegir qué
// incluir (Gastos/Ingresos), de qué espacio, y un rango de fechas libre;
// descarga un CSV con exactamente esos registros. Función Premium completa
// — todo el contenido va envuelto en <PremiumLock>, mismo patrón que el
// simulador de PaymentModal.jsx.
//
// Fase 2 (reporte PDF con gráficas y Metas) queda fuera de este archivo a
// propósito — es un proyecto aparte, con su propia sesión de mockup.
export function SettingsExportPage({ profile, sharedSpaces, onOpenPremium, onBack, slideClass }) {
  const { t } = useTranslation()
  const { spaces } = sharedSpaces

  const [includeGastos, setIncludeGastos]     = useState(true)
  const [includeIngresos, setIncludeIngresos] = useState(true)
  const [space, setSpace]   = useState('personal') // 'personal' | id de shared_spaces
  const [from, setFrom]     = useState(() => dateToStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [to, setTo]         = useState(() => todayStr())

  const [counts, setCounts]   = useState(null) // { gastos, ingresos } | null mientras carga
  const [counting, setCounting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const debounceRef = useRef(null)

  // Espacios donde el usuario es dueño o invitado — mismas opciones que
  // cualquier otro selector de espacio de la app (Personal + cada
  // shared_spaces del que sea miembro), sin importar cuál esté "activo"
  // ahora mismo en el resto de la app (esto es un filtro propio, no
  // depende de activeSpaceId).
  const spaceOptions = [
    { value: 'personal', label: t('settingsExport.space.personal') },
    ...spaces.map(s => ({ value: s.space.id, label: s.space.name })),
  ]

  const selectedSpaceEntry = space === 'personal' ? null : spaces.find(s => s.space.id === space)

  // Fecha EFECTIVA de un pago para efectos de exportar — mismo criterio
  // que ya usa PaymentsPage.jsx en todos sus filtros por mes/rango: si ya
  // se pagó, es paid_at; si no, due_date. `dateToStr(new Date(paid_at))`
  // convierte el timestamp a fecha LOCAL (Regla 22), nunca UTC directo.
  function effectiveDateStr(p) {
    return p.paid_at ? dateToStr(new Date(p.paid_at)) : p.due_date
  }

  // Trae los gastos que caen en el rango — consulta amplia por due_date
  // con 1 día de colchón (mismo patrón que defaultCutoffStr() en
  // usePayments.js, ya que paid_at es un timestamp UTC y debido a la
  // zona horaria de México un pago puede quedar 1 día antes/después del
  // due_date en la consulta cruda) y filtro EXACTO por fecha efectiva en
  // el cliente, en horario local.
  const fetchGastos = useCallback(async () => {
    const fromBuffered = dateToStr(new Date(dateOf(from).getTime() - 86400000))
    const toBuffered   = dateToStr(new Date(dateOf(to).getTime() + 86400000))

    let query = supabase.from('payments').select('*').eq('is_master', false)
      .gte('due_date', fromBuffered).lte('due_date', toBuffered)
    query = space === 'personal'
      ? query.eq('user_id', profile.id).is('space_id', null)
      : query.eq('space_id', space)

    const { data, error } = await query
    if (error || !data) return []

    return data.filter(p => {
      const d = effectiveDateStr(p)
      return d >= from && d <= to
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space, from, to, profile.id])

  // Trae los ingresos del rango — period_income no tiene fecha exacta de
  // registro, solo `period_start` (primer día del periodo al que
  // pertenece), así que el filtro es directo por esa columna.
  const fetchIngresos = useCallback(async () => {
    let query = supabase.from('period_income').select('*')
      .gte('period_start', from).lte('period_start', to)
    query = space === 'personal'
      ? query.eq('user_id', profile.id).is('space_id', null)
      : query.eq('space_id', space)

    const { data, error } = await query
    return (!error && data) ? data : []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space, from, to, profile.id])

  // Mapa user_id → nombre, para resolver quién aportó en un gasto de
  // Espacio Compartido (payment_contributions solo trae el user_id, no el
  // nombre — igual que en useSharedSpaces.js, se cruza a mano).
  function memberName(userId) {
    const member = selectedSpaceEntry?.space.members?.find(m => m.user_id === userId)
    return member?.profile?.name || t('settingsExport.unknownMember')
  }

  // Arma la columna "Aportantes" de un gasto compartido: "Ana: $200,
  // Luis: $150" en una sola celda — no se puede abrir en columnas propias
  // porque el número de aportantes varía por fila, y una tabla CSV
  // necesita las mismas columnas en todas.
  async function contributionsTextByPaymentId(paymentIds) {
    if (space === 'personal' || paymentIds.length === 0) return {}
    const { data, error } = await supabase
      .from('payment_contributions')
      .select('payment_id, user_id, amount')
      .in('payment_id', paymentIds)
    if (error || !data) return {}
    const map = {}
    for (const c of data) {
      const line = `${memberName(c.user_id)}: ${fmt(c.amount)}`
      map[c.payment_id] = map[c.payment_id] ? `${map[c.payment_id]}, ${line}` : line
    }
    return map
  }

  // Recalcula el contador de "registros encontrados" cada vez que cambia
  // algún filtro — con debounce (Regla 35) para no disparar una consulta
  // por cada tecla/clic mientras el usuario todavía está ajustando fechas.
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!includeGastos && !includeIngresos) { setCounts({ gastos: 0, ingresos: 0 }); return }
    setCounting(true)
    debounceRef.current = setTimeout(async () => {
      const [gastos, ingresos] = await Promise.all([
        includeGastos ? fetchGastos() : Promise.resolve([]),
        includeIngresos ? fetchIngresos() : Promise.resolve([]),
      ])
      setCounts({ gastos: gastos.length, ingresos: ingresos.length })
      setCounting(false)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [includeGastos, includeIngresos, fetchGastos, fetchIngresos])

  async function handleDownload() {
    if (!includeGastos && !includeIngresos) return
    setDownloading(true)

    const headers = [
      t('settingsExport.csv.date'), t('settingsExport.csv.recordType'), t('settingsExport.csv.concept'),
      t('settingsExport.csv.category'), t('settingsExport.csv.amount'), t('settingsExport.csv.paid'),
      t('settingsExport.csv.amountType'), t('settingsExport.csv.space'), t('settingsExport.csv.contributors'),
    ]
    const rows = []
    const spaceLabel = space === 'personal' ? t('settingsExport.space.personal') : (selectedSpaceEntry?.space.name || '')

    if (includeGastos) {
      const gastos = await fetchGastos()
      const contribMap = await contributionsTextByPaymentId(gastos.map(p => p.id))
      for (const p of gastos) {
        rows.push([
          effectiveDateStr(p),
          t('settingsExport.csv.expenseType'),
          p.name,
          getCategoryLabel(p.category),
          fmt(p.amount),
          p.is_paid ? t('settingsExport.csv.yes') : t('settingsExport.csv.no'),
          p.is_variable ? t('settingsExport.csv.variable') : t('settingsExport.csv.fixed'),
          spaceLabel,
          contribMap[p.id] || '',
        ])
      }
    }

    if (includeIngresos) {
      const ingresos = await fetchIngresos()
      for (const inc of ingresos) {
        rows.push([
          inc.period_start,
          t('settingsExport.csv.incomeType'),
          inc.note ? `${inc.type} - ${inc.note}` : inc.type,
          '',
          fmt(inc.amount),
          '',
          '',
          spaceLabel,
          '',
        ])
      }
    }

    rows.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)

    const csv = buildCsv(headers, rows)
    downloadCsv(`lunapay-export-${from}_a_${to}.csv`, csv)
    setDownloading(false)
  }

  const total = counts ? counts.gastos + counts.ingresos : null
  const noneSelected = !includeGastos && !includeIngresos

  return (
    <div className={`${slideClass} ${styles.pageWrapper}`}>
      <div className={styles.header}>
        <button onClick={onBack} className={styles.backButton}>
          <ChevronLeft size={18} color="var(--text)" />
        </button>
        <div className={styles.headerTitle}>{t('settingsExport.title')}</div>
      </div>

      <PremiumLock
        isPremium={profile?.is_premium}
        message={t('settingsExport.premiumMessage')}
        onUpgradeClick={onOpenPremium}
      >
        <div className={styles.content}>
          <p className={styles.intro}>{t('settingsExport.intro')}</p>

          <div className={styles.fieldGroup}>
            <div className="field-label">{t('settingsExport.dataToInclude')}</div>
            <div className={styles.chipRow}>
              <button
                type="button"
                onClick={() => setIncludeGastos(v => !v)}
                className={`${styles.chip} ${includeGastos ? styles.chipActive : ''}`}
              >
                <Receipt size={18} />
                <span>{t('settingsExport.expenses')}</span>
              </button>
              <button
                type="button"
                onClick={() => setIncludeIngresos(v => !v)}
                className={`${styles.chip} ${includeIngresos ? styles.chipActive : ''}`}
              >
                <Wallet size={18} />
                <span>{t('settingsExport.income')}</span>
              </button>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <div className="field-label">{t('settingsExport.spaceLabel')}</div>
            <Select value={space} onChange={setSpace} options={spaceOptions} />
          </div>

          <div className={styles.fieldGroup}>
            <div className="field-label">{t('settingsExport.dateRange')}</div>
            <div className={styles.dateRow}>
              <div className={styles.dateCol}>
                <div className={styles.dateSubLabel}>{t('settingsExport.from')}</div>
                <DatePicker value={from} onChange={setFrom} />
              </div>
              <div className={styles.dateCol}>
                <div className={styles.dateSubLabel}>{t('settingsExport.to')}</div>
                <DatePicker value={to} onChange={setTo} />
              </div>
            </div>
          </div>

          <div className={styles.countCard}>
            <span className={styles.countLabel}>{t('settingsExport.recordsFound')}</span>
            <span className={styles.countValue}>{counting ? '…' : (total ?? 0)}</span>
          </div>

          <button
            onClick={handleDownload}
            disabled={noneSelected || downloading || counting || total === 0}
            className={styles.downloadButton}
          >
            <Download size={16} />
            {downloading ? t('settingsExport.downloading') : t('settingsExport.downloadCsv')}
          </button>
        </div>
      </PremiumLock>
    </div>
  )
}
