import i18n from '../i18n'

// Contenido de los coach marks — un arreglo de pasos por pantalla/modal.
// Separado del motor (components/Coachmarks.jsx) para que editar el texto
// de un paso no implique tocar la lógica del componente.
//
// Cada paso: { target, title, text, placement }
// - `target`: valor del atributo data-coachmark="..." del elemento a señalar
//   (el motor hace document.querySelector(`[data-coachmark="${target}"]`))
// - `placement`: 'top' | 'bottom' — de qué lado del elemento aparece la burbuja
//
// Las keys de este objeto son las mismas que usa App.jsx para decidir qué
// secuencia mostrar (mapeadas desde `tab`, o 'nuevo-pago' cuando se abre
// PaymentModal) y las mismas que se guardan en profile.coachmarks_seen.
//
// getCoachmarkSteps() en vez de un objeto exportado directo — mismo motivo
// que getMonths()/getCategoryLabel() en lib/utils.js: un objeto a nivel de
// módulo se evalúa UNA sola vez al importar el archivo, capturando
// cualquier texto de i18n.t() con el idioma que estuviera activo en ese
// momento y sin enterarse nunca de un cambio posterior. Como función, se
// recalcula fresco cada vez que Coachmarks.jsx la llama (en cada render).
export function getCoachmarkSteps() {
  const t = i18n.t.bind(i18n)
  return {
  home: [
    {
      target: 'home-metric-card',
      title: t('coachmarks.home.metricCard.title'),
      text: t('coachmarks.home.metricCard.text'),
      placement: 'bottom',
    },
    // El botón "+" vive en BottomNav.jsx, que no tengo en esta sesión, así
    // que no puedo agregarle un data-coachmark directamente. En vez de
    // quitar el paso (es de los más importantes), se ancla por una vía
    // alterna: fallbackSelector. Lucide genera automáticamente la clase
    // `lucide-plus` en el SVG de cualquier ícono <Plus/>, así que se ubica
    // por ahí y se sube al <button> o <a> más cercano para resaltar el
    // botón completo, no solo el ícono. Si algún día se sube BottomNav.jsx
    // y se le agrega el atributo real, `target` tomaría prioridad sola.
    {
      target: 'home-add-button',
      fallbackSelector: '.lucide-plus',
      title: t('coachmarks.home.addButton.title'),
      text: t('coachmarks.home.addButton.text'),
      placement: 'top',
    },
    {
      target: 'home-rail',
      title: t('coachmarks.home.rail.title'),
      text: t('coachmarks.home.rail.text'),
      placement: 'top',
    },
    {
      target: 'home-paid-collapse',
      title: t('coachmarks.home.paidCollapse.title'),
      text: t('coachmarks.home.paidCollapse.text'),
      placement: 'bottom',
    },
    // Pendiente: paso señalando el bottom nav — falta BottomNav.jsx en esta
    // sesión para agregarle el atributo data-coachmark correctamente (un
    // <div> envolvente no sirve porque BottomNav usa position:fixed
    // internamente, y un wrapper sin ese position colapsa a tamaño 0).
  ],

  'nuevo-pago': [
    {
      target: 'modal-payment-type-tabs',
      title: t('coachmarks.nuevoPago.tabs.title'),
      text: t('coachmarks.nuevoPago.tabs.text'),
      placement: 'bottom',
    },
    {
      target: 'modal-category-field',
      title: t('coachmarks.nuevoPago.category.title'),
      text: t('coachmarks.nuevoPago.category.text'),
      placement: 'bottom',
    },
    {
      target: 'modal-variable-toggle',
      title: t('coachmarks.nuevoPago.variable.title'),
      text: t('coachmarks.nuevoPago.variable.text'),
      placement: 'bottom',
    },
  ],

  gastos: [
    {
      target: 'gastos-disponible-card',
      title: t('coachmarks.gastos.disponible.title'),
      text: t('coachmarks.gastos.disponible.text'),
      placement: 'bottom',
    },
    {
      target: 'gastos-add-income-button',
      title: t('coachmarks.gastos.addIncome.title'),
      text: t('coachmarks.gastos.addIncome.text'),
      placement: 'bottom',
    },
    {
      target: 'gastos-category-chips',
      title: t('coachmarks.gastos.categoryChips.title'),
      text: t('coachmarks.gastos.categoryChips.text'),
      placement: 'bottom',
    },
    {
      target: 'gastos-monthly-chart',
      title: t('coachmarks.gastos.monthlyChart.title'),
      text: t('coachmarks.gastos.monthlyChart.text'),
      placement: 'top',
    },
  ],

  recurrentes: [
    {
      target: 'recurrentes-stats',
      title: t('coachmarks.recurrentes.stats.title'),
      text: t('coachmarks.recurrentes.stats.text'),
      placement: 'bottom',
    },
    {
      target: 'recurrentes-filtro-tipo',
      title: t('coachmarks.recurrentes.filtroTipo.title'),
      text: t('coachmarks.recurrentes.filtroTipo.text'),
      placement: 'bottom',
    },
  ],

  perfil: [
    {
      target: 'perfil-cobro-row',
      title: t('coachmarks.perfil.cobro.title'),
      text: t('coachmarks.perfil.cobro.text'),
      placement: 'bottom',
    },
    {
      target: 'perfil-categorias-row',
      title: t('coachmarks.perfil.categorias.title'),
      text: t('coachmarks.perfil.categorias.text'),
      placement: 'bottom',
    },
    {
      target: 'perfil-notificaciones-row',
      title: t('coachmarks.perfil.notificaciones.title'),
      text: t('coachmarks.perfil.notificaciones.text'),
      placement: 'bottom',
    },
  ],
  }
}
