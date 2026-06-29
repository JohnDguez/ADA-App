import { useState, useMemo } from 'react'
import { Pause, Play, Trash2, Search, ChevronDown, CreditCard } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { fmt, RECUR_FREQ, dateOf, MONTHS_SHORT } from '../lib/utils'

const CAT_COLOR = {
  'Servicios':     'var(--cat-servicios)',
  'Suscripciones': 'var(--cat-suscripciones)',
  'Créditos':      'var(--cat-creditos)',
  'Renta':         'var(--cat-renta)',
  'Seguros':       'var(--cat-seguros)',
  'Alimentación':  'var(--cat-alimentacion)',
  'Otros':         'var(--cat-otros)',
}

export function RecurrentsPage({ payments, profile, unreadCount, onOpenNotifs, onGoSettings, onPause, onResume, onDelete }) {
  const [search,        setSearch]        = useState('')
  const [filterStatus,  setFilterStatus]  = useState('todos')
  const [filterType,    setFilterType]    = useState('todos')
  const [expandedCats,  setExpandedCats]  = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Agrupar TODOS los recurrentes por nombre — sin importar si tienen pendientes
  const allGroups = useMemo(() => {
    const map = {}
    payments
      .filter(p => p.is_recurrent)
      .forEach(p => {
        if (!map[p.name]) {
          map[p.name] = {
            name:               p.name,
            category:           p.category,
            recur_freq:         p.recur_freq,
            is_installment:     p.is_installment,
            is_variable:        p.is_variable,
            total_installments: p.total_installments,
            items:              [],
          }
        }
        map[p.name].items.push(p)
      })
    return Object.values(map)
  }, [payments])

  function isPaused(group) {
    const pending = group.items.filter(p => !p.is_paid)
    return pending.length > 0 && pending.every(p => p.paused)
  }

  // Métricas
  const activeGroups = allGroups.filter(g => !isPaused(g))
  const pausedGroups = allGroups.filter(g => isPaused(g))
  const totalMensual = activeGroups.reduce((sum, g) => {
    const rep = g.items.find(p => !p.is_paid && !p.paused)
    return sum + (rep && !g.is_variable ? Number(rep.amount) : 0)
  }, 0)

  // Filtros
  const filtered = useMemo(() => {
    return allGroups.filter(g => {
      const paused = isPaused(g)
      if (filterStatus === 'activos'  && paused)  return false
      if (filterStatus === 'pausados' && !paused)  return false
      if (filterType === 'recurrentes'   && (g.is_installment || g.is_variable)) return false
      if (filterType === 'parcialidades' && !g.is_installment) return false
      if (filterType === 'variables'     && !g.is_variable)    return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!g.name.toLowerCase().includes(q) && !g.category.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [allGroups, filterStatus, filterType, search])

  // Agrupar por categoría
  const byCategory = useMemo(() => {
    const map = {}
    filtered.forEach(g => {
      if (!map[g.category]) map[g.category] = []
      map[g.category].push(g)
    })
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length)
  }, [filtered])

  function toggleCat(cat) {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  function nextPending(items) {
    return items.filter(p => !p.is_paid && !p.paused).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))[0]
  }

  function paidCount(items) {
    return items.filter(p => p.is_paid).length
  }

  function handleDelete(name, isInstallment) {
    if (isInstallment) onDelete && onDelete(null, { name, is_installment: true, is_recurrent: true })
    else               onDelete && onDelete(null, { name, is_recurrent: true, is_installment: false })
    setConfirmDelete(null)
  }

  return (
    <div style={{ paddingBottom: 120, background: 'var(--bg)', minHeight: '100vh' }}>

      <PageHeader profile={profile} unreadCount={unreadCount} onOpenNotifs={onOpenNotifs} onGoSettings={onGoSettings} />

      <div style={{ background: 'var(--bg)', borderRadius: '24px 24px 0 0', marginTop: -24, position: 'relative', zIndex: 10, paddingTop: 20 }}>

        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Gastos Recurrentes</div>
        </div>

        {/* Buscador */}
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 12, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
              <Search size={15} color="var(--text)" />
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o categoría..." className="field-input" style={{ paddingLeft: 36 }} />
          </div>
        </div>

        {/* Resumen */}
        <div style={{ margin: '0 16px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px', display: 'flex' }}>
          <div style={{ flex: 1, borderRight: '0.5px solid var(--border)', paddingRight: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Activos</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{activeGroups.length}</div>
            <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 2 }}>{pausedGroups.length} pausados</div>
          </div>
          <div style={{ flex: 1, paddingLeft: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Suma mensual</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{fmt(totalMensual)}</div>
            <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 2 }}>pagos activos</div>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['todos','Todos'],['activos','Activos'],['pausados','Pausados']].map(([val, label]) => (
              <FilterChip key={val} label={label} active={filterStatus === val} onClick={() => setFilterStatus(val)} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['todos','Todos'],['recurrentes','Recurrentes'],['parcialidades','Parcialidades'],['variables','Variables']].map(([val, label]) => (
              <FilterChip key={val} label={label} active={filterType === val} onClick={() => setFilterType(val)} />
            ))}
          </div>
        </div>

        {/* Lista */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {byCategory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <CreditCard size={32} color="var(--border)" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                {search ? 'Sin resultados para tu búsqueda' : 'Sin gastos recurrentes registrados'}
              </div>
            </div>
          ) : byCategory.map(([cat, groups]) => {
            const isOpen   = !!expandedCats[cat]
            const catTotal = groups.reduce((sum, g) => {
              const rep = g.items.find(p => !p.is_paid && !p.paused)
              return sum + (rep && !g.is_variable ? Number(rep.amount) : 0)
            }, 0)
            const allPaused = groups.every(g => isPaused(g))

            return (
              <div key={cat} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                {/* Header categoría */}
                <div onClick={() => toggleCat(cat)} style={{ display: 'flex', alignItems: 'center', padding: '14px', cursor: 'pointer', borderBottom: isOpen ? '0.5px solid var(--border)' : 'none', minHeight: 58 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: CAT_COLOR[cat] || 'var(--accent)', flexShrink: 0, marginRight: 10 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{cat}</div>
                    <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 1 }}>
                      {groups.length} pago{groups.length !== 1 ? 's' : ''}
                      {catTotal > 0 && ` · ${fmt(catTotal)}/periodo`}
                      {allPaused && ' · Todos pausados'}
                    </div>
                  </div>
                  {/* Acción rápida pausar/reanudar todos */}
                  <button
                    onClick={e => { e.stopPropagation(); groups.forEach(g => allPaused ? onResume(g.name) : onPause(g.name)) }}
                    style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: allPaused ? 'var(--paid)' : 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginRight: 8, flexShrink: 0 }}
                  >
                    {allPaused ? <Play size={14} color="#fff" /> : <Pause size={14} color="#fff" />}
                  </button>
                  {/* Chevron animado */}
                  <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ transition: 'transform .25s ease', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      <ChevronDown size={18} color="var(--text)" />
                    </div>
                  </div>
                </div>

                {/* Contenido con animación */}
                <div style={{ maxHeight: isOpen ? '2000px' : '0px', overflow: 'hidden', transition: 'max-height .3s ease' }}>
                  {groups.map((g, idx) => {
                    const paused       = isPaused(g)
                    const next         = nextPending(g.items)
                    const paid         = paidCount(g.items)
                    const isLast       = idx === groups.length - 1
                    const isConfirming = confirmDelete === g.name

                    return (
                      <div key={g.name}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: isLast && !isConfirming ? 'none' : '0.5px solid var(--border)', gap: 10, opacity: paused ? 0.55 : 1, transition: 'opacity .2s' }}>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Fila 1: nombre + frecuencia */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{g.name}</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>
                                {RECUR_FREQ[g.recur_freq] || '—'}
                              </span>
                            </div>
                            {/* Fila 2: etiqueta tipo + datos */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {/* Etiqueta tipo */}
                              {g.is_installment && (
                                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--accent)', color: '#fff', flexShrink: 0 }}>Parcialidades</span>
                              )}
                              {!g.is_installment && !g.is_variable && (
                                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--paid)', color: '#fff', flexShrink: 0 }}>Recurrente</span>
                              )}
                              {g.is_variable && (
                                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#6884A9', color: '#fff', flexShrink: 0 }}>Variable</span>
                              )}
                              {paused && (
                                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--warning)', color: '#fff', flexShrink: 0 }}>Pausado</span>
                              )}
                              {/* Separador */}
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--border)', lineHeight: 1 }}>·</span>
                              {/* Datos */}
                              {g.is_installment && (
                                <>
                                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)' }}>{paid}/{g.total_installments} Pagos</span>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--border)', lineHeight: 1 }}>·</span>
                                </>
                              )}
                              {!g.is_variable && next && (
                                <>
                                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)' }}>{fmt(next.amount)}/pago</span>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--border)', lineHeight: 1 }}>·</span>
                                </>
                              )}
                              {next ? (
                                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)' }}>Próx. {dateOf(next.due_date).getDate()} {MONTHS_SHORT[dateOf(next.due_date).getMonth()]}</span>
                              ) : (
                                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)' }}>Sin pendientes</span>
                              )}
                            </div>
                          </div>

                          {/* Botones sólidos */}
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button
                              onClick={() => paused ? onResume(g.name) : onPause(g.name)}
                              style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: paused ? 'var(--paid)' : 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                              {paused ? <Play size={14} color="#fff" /> : <Pause size={14} color="#fff" />}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(isConfirming ? null : g.name)}
                              style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                              <Trash2 size={14} color="#fff" />
                            </button>
                          </div>
                        </div>

                        {/* Confirmar eliminación */}
                        {isConfirming && (
                          <div style={{ padding: '12px 14px', background: 'var(--danger-soft)', borderBottom: isLast ? 'none' : '0.5px solid var(--border)' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>¿Eliminar "{g.name}"?</div>
                            <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text)', marginBottom: 10 }}>Los pagos realizados quedan en el historial. Los pendientes se eliminan.</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => handleDelete(g.name, g.is_installment)}
                                style={{ flex: 1, padding: '9px 0', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                                Eliminar
                              </button>
                              <button onClick={() => setConfirmDelete(null)}
                                style={{ flex: 1, padding: '9px 0', background: 'none', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 500, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', color: 'var(--text)' }}>
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 5, border: 'none',
      background: active ? 'var(--accent)' : 'var(--surface)',
      color: active ? '#fff' : 'var(--text)',
      fontSize: 12, fontWeight: active ? 600 : 400,
      fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
      transition: 'background .15s',
    }}>
      {label}
    </button>
  )
}
