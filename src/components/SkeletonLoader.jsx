// ── SkeletonLoader ────────────────────────────────────────────────────────────
// Pantalla de carga ghost que imita el layout real de la app.
// Se muestra mientras authLoading || profileLoading en App.jsx.
// Actualizado en v0.9.153 para reflejar el rediseño de Espacio Compartido
// (v0.9.133+): el switcher de espacios (tarjeta apilada, "Personal"/espacios
// compartidos) ahora vive justo debajo del header, antes de las tabs
// Periodo/Mes — antes no existía y las tabs quedaban pegadas al header.
// Actualizado de nuevo tras el rediseño de la tarjeta "Pagos de este
// periodo"/"Por pagar este mes" (medio anillo tipo gauge, confirmado con
// Johnatan después de descartar el anillo completo y la tarjeta-relleno) y
// el switch Periodo/Mes (ahora píldora deslizante, no 2 botones cuadrados) —
// el esqueleto ya no debe mostrar la barra horizontal ni el toggle de 5px,
// que ya no existen en la pantalla real.
import styles from './SkeletonLoader.module.css'
import dk from './SkeletonDesk.module.css'
import { useIsDesktop } from '../hooks/useIsDesktop'

// `Bone` y `RailSkeleton` se exportan (antes solo vivían aquí, para el
// gate de pantalla completa de App.jsx) — Fase 1 del sistema de carga por
// sección (agosto 2026): cualquier pantalla puede pedir el mismo bone o el
// mismo esqueleto de riel para reemplazar un hueco en blanco durante
// `dataLoading`, en vez de inventar su propia versión. Ver HomePage.jsx
// para el primer uso real.
export function Bone({ w, h, r, dark, style }) {
  return (
    <div
      className={dark ? 'skeleton-bone-dark' : 'skeleton-bone'}
      style={{ width: w, height: h, borderRadius: r ?? 6, flexShrink: 0, ...style }}
    />
  )
}

// Esqueleto de un riel de pagos (mismas clases que ya usaba el gate de
// pantalla completa, `.railWrapper`/`.railLine`/`.railItem`/`.railItemCard`)
// — reutilizable en cualquier lista que hoy muestre un hueco en blanco
// mientras `dataLoading` es true (HomePage, PaymentsPage, etc.).
// `count`: cuántas filas fantasma mostrar (por defecto 3, mismo criterio
// visual que ya traía el gate de pantalla completa).
export function RailSkeleton({ count = 3 }) {
  return (
    <div className={styles.railWrapper}>
      <div className={styles.railLine} />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.railItem}>
          <Bone w={24} h={24} r="50%" />
          <div className={styles.railItemCard}>
            <Bone w="55%" h={13} r={4} />
            <Bone w="30%" h={10} r={4} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Esqueleto de "Por categoría" (mismo layout que `.categoryListItem` de
// PaymentsPage: ícono cuadrado + nombre/monto + barra de progreso) — usado
// mientras `dataLoading` es true, en vez del hueco en blanco que había
// antes en esa sección.
export function CategoryListSkeleton({ count = 4 }) {
  return (
    <div className={styles.categoryListSkelWrapper}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.categoryListSkelItem}>
          <Bone w={36} h={36} r={8} />
          <div className={styles.categoryListSkelContent}>
            <div className={styles.categoryListSkelRow}>
              <Bone w={90} h={13} r={4} />
              <Bone w={50} h={13} r={4} />
            </div>
            <Bone w="100%" h={6} r={999} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Esqueleto de una fila de "Pagos realizados" (mismo layout que
// `.paymentRow` de PaymentsPage: fecha + divisor + nombre/categoría +
// monto) — reemplaza el hueco en blanco de esa lista durante `dataLoading`.
export function PaymentRowSkeleton({ count = 4 }) {
  return (
    <div className={styles.paymentRowSkelWrapper}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.paymentRowSkelItem}>
          <div className={styles.paymentRowSkelDate}>
            <Bone w={20} h={16} r={4} />
            <Bone w={24} h={8} r={3} style={{ marginTop: 4 }} />
          </div>
          <div className={styles.paymentRowSkelDivider} />
          <div className={styles.paymentRowSkelInfo}>
            <Bone w="60%" h={13} r={4} />
            <Bone w="35%" h={11} r={4} style={{ marginTop: 6 }} />
          </div>
          <Bone w={54} h={14} r={4} />
        </div>
      ))}
    </div>
  )
}

// Esqueleto de la tarjeta de stats (2 bloques lado a lado — usada en
// Recurrentes hoy, reutilizable en cualquier pantalla con el mismo layout).
export function StatsCardSkeleton() {
  return (
    <div className={styles.statsCardSkelWrapper}>
      <div className={styles.statsCardSkelBlock}>
        <Bone w={60} h={10} r={3} />
        <Bone w={40} h={22} r={4} style={{ marginTop: 5 }} />
        <Bone w={70} h={11} r={4} style={{ marginTop: 4 }} />
      </div>
      <div className={styles.statsCardSkelBlock}>
        <Bone w={80} h={10} r={3} />
        <Bone w={70} h={22} r={4} style={{ marginTop: 5 }} />
        <Bone w={90} h={11} r={4} style={{ marginTop: 4 }} />
      </div>
    </div>
  )
}

// Esqueleto de un acordeón de categoría cerrado (mismo layout que
// `.categoryHeader` de RecurrentsPage: ícono redondo + nombre/meta + hueco
// del chevron) — usado mientras `dataLoading` es true, en vez del hueco en
// blanco/EmptyState prematuro que había antes en esa lista.
export function CategoryAccordionSkeleton({ count = 3 }) {
  return (
    <div className={styles.categoryAccordionSkelWrapper}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.categoryAccordionSkelItem}>
          <Bone w={36} h={36} r={8} />
          <div className={styles.categoryAccordionSkelContent}>
            <Bone w={110} h={14} r={4} />
            <Bone w={80} h={11} r={4} style={{ marginTop: 5 }} />
          </div>
          <Bone w={18} h={18} r={4} />
        </div>
      ))}
    </div>
  )
}

// Esqueleto de una tarjeta de meta (mismo layout que `.card`/`GoalCard` de
// GoalsPage: ícono + nombre/monto meta, barra de progreso, fila inferior) —
// usado mientras `goalsData.loading` es true, en vez del EmptyState "Sin
// metas" prematuro que se mostraría con `activeGoals`/`completedGoals`
// vacíos a propósito durante la carga.
export function GoalCardSkeleton({ count = 2 }) {
  return (
    <div className={styles.goalCardSkelWrapper}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.goalCardSkelItem}>
          <div className={styles.goalCardSkelTop}>
            <Bone w={36} h={36} r={8} />
            <Bone w={110} h={15} r={4} />
            <Bone w={60} h={14} r={4} style={{ marginLeft: 'auto' }} />
          </div>
          <Bone w="100%" h={6} r={999} style={{ marginTop: 12 }} />
          <Bone w={130} h={12} r={4} style={{ marginTop: 10 }} />
        </div>
      ))}
    </div>
  )
}

// Hueso del esqueleto de escritorio (huesos sólidos con brillo; ver SkeletonDesk.module.css).
function DBone({ w, h, r = 8, style }) {
  return <span className={dk.bone} style={{ width: w, height: h, borderRadius: r, ...style }} />
}

// Esqueleto de escritorio (≥1100px): sidebar + Inicio de escritorio (3 tarjetas
// de totales, lista de pagos, anillo y barras de 7 días) — aprobado con mockup
// B "fantasma detallado" (v0.9.852).
function DeskSkeleton() {
  const rows = [0, 1, 2, 3, 4]
  return (
    <div className={dk.root} aria-busy="true">
      <aside className={dk.side}>
        <div className={dk.sideTop}><DBone w={34} h={34} r={10} /><DBone w={90} h={16} r={5} /></div>
        <div className={dk.sideLabel}><DBone w={44} h={10} r={4} /></div>
        {[90, 110, 90, 110, 90].map((w, i) => (
          <div key={i} className={dk.sideItem}><DBone w={22} h={22} r={7} /><DBone w={w} h={13} r={5} /></div>
        ))}
        <div className={dk.sideLabel2}><DBone w={60} h={10} r={4} /></div>
        <div className={dk.sideItem}><DBone w={24} h={24} r="50%" /><DBone w={100} h={13} r={5} /></div>
        <div className={dk.sideBottom}>
          <DBone w="100%" h={44} r={22} />
          <div className={dk.sideUser}>
            <DBone w={38} h={38} r="50%" />
            <div className={dk.stack7}><DBone w={90} h={12} r={5} /><DBone w={60} h={10} r={5} /></div>
          </div>
        </div>
      </aside>

      <main className={dk.main}>
        <div className={dk.head}>
          <div className={dk.headText}><DBone w={160} h={13} r={5} /><DBone w={380} h={40} r={12} /></div>
          <DBone w={150} h={46} r={23} />
        </div>

        <div className={dk.tiles}>
          {[0, 1, 2].map(i => (
            <div key={i} className={dk.tile}>
              <DBone w={90} h={14} r={5} />
              <div className={dk.tileNum}><DBone w={190} h={40} r={10} /></div>
              <div className={dk.tileSub}><DBone w={120} h={12} r={5} /></div>
            </div>
          ))}
        </div>

        <div className={dk.body}>
          <section className={dk.card}>
            <DBone w={190} h={20} r={6} />
            <div className={dk.chips}>{[0, 1, 2].map(i => <DBone key={i} w={96} h={36} r={18} />)}</div>
            <div className={dk.secHead}><DBone w={16} h={16} r={5} /><DBone w={150} h={14} r={5} /><DBone w={26} h={18} r={9} /></div>
            {rows.map(i => (
              <div key={i}>
                <div className={dk.row}>
                  <DBone w={40} h={40} r="50%" />
                  <div className={dk.rowText}><DBone w={i % 2 ? '46%' : '38%'} h={14} r={5} /><DBone w="22%" h={11} r={5} /></div>
                  <DBone w={80} h={16} r={5} />
                </div>
                {i < rows.length - 1 && <div className={dk.hair} />}
              </div>
            ))}
          </section>

          <div className={dk.side2}>
            <section className={`${dk.card} ${dk.cardGauge}`}>
              <DBone w={150} h={20} r={6} />
              <svg className={dk.gauge} viewBox="0 0 300 165" aria-hidden="true">
                <path className={dk.gTrack} d="M20,140 A130,130 0 0 1 280,140" />
                <path className={dk.gFill} d="M20,140 A130,130 0 0 1 140,10" />
              </svg>
              <div className={dk.legend}>{[0, 1, 2].map(i => <DBone key={i} w={80} h={11} r={5} />)}</div>
            </section>
            <section className={`${dk.card} ${dk.cardNext}`}>
              <DBone w={150} h={20} r={6} />
              <div style={{ height: 12 }} />
              <DBone w={170} h={38} r={10} />
              <div style={{ height: 10 }} />
              <DBone w={220} h={11} r={5} />
              <div className={dk.bars}>
                {[45, 70, 30, 85, 55, 40, 65].map((h, i) => <span key={i} className={dk.bone} style={{ height: `${h}%` }} />)}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}

export function SkeletonLoader() {
  const isDesk = useIsDesktop()
  if (isDesk) return <DeskSkeleton />
  return (
    <div className={styles.pageRoot}>

      {/* ── Riel lateral — solo ≥768px (tablet/escritorio): ahí no existen el
           header ni el BottomNav, el chrome es NavRail.jsx (72px colapsado). ── */}
      <div className={styles.railSkel}>
        <Bone w={36} h={36} r={10} dark />
        <div className={styles.railSkelItems}>
          {[0, 1, 2, 3, 4].map(i => <Bone key={i} w={24} h={24} r={7} dark />)}
        </div>
        <Bone w={36} h={36} r="50%" dark />
      </div>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerInner}>

          {/* Avatar + nombre */}
          <div className={styles.headerLeft}>
            <Bone w={52} h={52} r="50%" dark />
            <div className={styles.headerTextCol}>
              <Bone w={72} h={11} r={4} dark />
              <Bone w={110} h={17} r={4} dark />
            </div>
          </div>

          {/* Engrane + campana — 2 botones reales (antes solo se
              representaba 1), mismo orden y tamaño que PageHeader.jsx. */}
          <div className={styles.headerActionsSkel}>
            <div className={styles.settingsButtonSkel} />
            <div className={styles.bellButtonSkel} />
          </div>
        </div>
      </div>

      {/* ── Switcher de espacios — tarjeta "Personal" por default (caso más
           común: la mayoría de las cargas no tienen espacios compartidos
           activos todavía). Esquinas redondeadas arriba, fundida con el
           contenido de abajo, igual que la tarjeta activa real. ── */}
      <div className={styles.roundedWrapper}>
        <div className={styles.switcherPlaceholder}>
          <Bone w={90} h={17} r={4} />
        </div>

        <div className={styles.contentPadding}>

        {/* ── Switch Periodo / Mes — píldora deslizante (border-radius: 999),
             ya no el toggle cuadrado de 5px que tenía antes. */}
        <div className={styles.tabsRow}>
          <Bone w="50%" h={30} r={999} />
          <Bone w="50%" h={30} r={999} />
        </div>

        {/* ── Card de métricas — medio anillo tipo gauge (ya no la barra
             horizontal de antes). Fecha arriba a la derecha, el medio
             anillo centrado (un domo con OTRO domo más chico encima, del
             color de la propia tarjeta, "perforando" el hueco — un domo
             sólido sin el hueco se veía como medio círculo relleno, no como
             un anillo, Johnatan lo notó probando en su teléfono), pagado/
             pendiente pegado abajo del anillo, y título/monto/estatus
             debajo. */}
        <div className={styles.metricCard}>
          <div className={styles.metricCardDateRow}>
            <Bone w={100} h={20} r={5} />
          </div>
          <div className={styles.ringWrapper}>
            <div className={styles.ringOuter}>
              <Bone w={180} h={90} r="90px 90px 0 0" style={{ position: 'absolute', top: 0, left: 0 }} />
              <div className={styles.ringInnerCut} />
            </div>
          </div>
          <div className={styles.metricPaidPendingRow}>
            <Bone w={90} h={11} r={4} />
            <Bone w={90} h={11} r={4} />
          </div>
          <div className={styles.metricCenterRowMb6}>
            <Bone w={120} h={11} r={4} />
          </div>
          <div className={styles.metricCenterRowMb8}>
            <Bone w={140} h={26} r={4} />
          </div>
          <div className={styles.metricCenterRow}>
            <Bone w={160} h={11} r={4} />
          </div>
        </div>

        {/* ── Sección "Próximos a vencer" ── */}
        <div className={styles.sectionHeaderRow}>
          <Bone w={130} h={13} r={4} />
          <Bone w={80}  h={13} r={4} />
        </div>

        {/* ── Colapsable de pagados ── */}
        <Bone w="100%" h={40} r={8} style={{ marginBottom: 20 }} />

        {/* ── Sección "Próximos a vencer" (riel vertical) ── */}
        <div className={styles.sectionHeaderRow}>
          <Bone w={130} h={13} r={4} />
          <Bone w={80}  h={13} r={4} />
        </div>
        <div className={styles.railWrapper}>
          <div className={styles.railLine} />
          {[0, 1, 2].map(i => (
            <div key={i} className={styles.railItem}>
              <Bone w={24} h={24} r="50%" />
              <div className={styles.railItemCard}>
                <Bone w="55%" h={13} r={4} />
                <Bone w="30%" h={10} r={4} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Sección "Próximo periodo" (riel vertical) ── */}
        <div className={styles.sectionHeaderRow}>
          <Bone w={120} h={13} r={4} />
          <Bone w={38}  h={20} r={11} />
        </div>
        <div className={styles.railWrapperNoMb}>
          <div className={styles.railLine} />
          {[0, 1].map(i => (
            <div key={i} className={styles.railItem}>
              <Bone w={24} h={24} r="50%" />
              <div className={styles.railItemCard}>
                <Bone w="45%" h={13} r={4} />
                <Bone w="30%" h={10} r={4} />
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>

      {/* ── BottomNav skeleton ── */}
      <div className={styles.bottomNavSkeleton}>
        {[0, 1, 2, 3, 4].map(i => (
          <Bone key={i} w={i === 2 ? 40 : 22} h={i === 2 ? 40 : 22} r={i === 2 ? '50%' : 6} dark />
        ))}
      </div>

    </div>
  )
}
