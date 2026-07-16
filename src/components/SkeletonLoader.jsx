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

function Bone({ w, h, r, dark, style }) {
  return (
    <div
      className={dark ? 'skeleton-bone-dark' : 'skeleton-bone'}
      style={{ width: w, height: h, borderRadius: r ?? 6, flexShrink: 0, ...style }}
    />
  )
}

export function SkeletonLoader() {
  return (
    <div className={styles.pageRoot}>

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

          {/* Campana */}
          <Bone w={40} h={40} r={12} dark />
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
