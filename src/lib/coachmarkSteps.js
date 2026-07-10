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
export const COACHMARK_STEPS = {
  home: [
    {
      target: 'home-metric-card',
      title: 'Tu quincena de un vistazo',
      text: 'Aquí ves cuánto tienes que pagar este periodo. Toca "Periodo" o "Mes" para cambiar la vista.',
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
      title: 'Agrega tu primer pago',
      text: 'Todo empieza aquí — desde este botón registras cualquier gasto, sea único, recurrente o a meses.',
      placement: 'top',
    },
    {
      target: 'home-rail',
      title: 'La línea de tu quincena',
      text: 'Cada punto es un pago. El color te dice si ya venció, si vence este periodo, o si es del próximo.',
      placement: 'top',
    },
    {
      target: 'home-paid-collapse',
      title: 'Lo que ya pagaste',
      text: 'Se guarda aquí, colapsado, para no estorbar — pero puedes revisarlo o deshacerlo cuando quieras.',
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
      title: '3 formas de registrar un pago',
      text: '"Único" es un gasto de una sola vez. "Recurrente" se repite cada semana/quincena/mes. "Parcialidades" es para pagos a meses con un número fijo de cuotas.',
      placement: 'bottom',
    },
    {
      target: 'modal-category-field',
      title: 'Elige o crea una categoría',
      text: 'Cada categoría trae su propio ícono y color — puedes personalizarlos después desde Ajustes.',
      placement: 'bottom',
    },
    {
      target: 'modal-variable-toggle',
      title: '¿El monto cambia cada vez?',
      text: 'Actívalo para pagos como luz o agua, donde no sabes el monto exacto hasta que llega el recibo.',
      placement: 'bottom',
    },
  ],

  gastos: [
    {
      target: 'gastos-disponible-card',
      title: 'Lo que te queda disponible',
      text: 'Se calcula con tu salario (si lo configuraste) más cualquier ingreso extra que registres este periodo.',
      placement: 'bottom',
    },
    {
      target: 'gastos-add-income-button',
      title: 'Registra tus ingresos',
      text: '¿Freelance, un bono, o sobró algo del periodo pasado? Añádelo aquí para que el disponible sea exacto.',
      placement: 'bottom',
    },
    {
      target: 'gastos-category-chips',
      title: 'Filtra por categoría',
      text: 'Toca cualquiera para ver solo esos gastos en la gráfica de abajo.',
      placement: 'bottom',
    },
    {
      target: 'gastos-monthly-chart',
      title: 'Tu tendencia mensual',
      text: 'Compara cuánto has gastado mes a mes — útil para detectar patrones.',
      placement: 'top',
    },
  ],

  recurrentes: [
    {
      target: 'recurrentes-stats',
      title: 'Tus pagos activos, de un vistazo',
      text: 'Aquí ves cuántos recurrentes tienes activos o pausados, y cuánto suman al mes.',
      placement: 'bottom',
    },
    {
      target: 'recurrentes-filtro-tipo',
      title: 'Recurrentes vs. Parcialidades',
      text: 'Un recurrente no tiene fecha final (como Netflix). Una parcialidad sí — un número fijo de pagos, como un celular a 12 meses.',
      placement: 'bottom',
    },
  ],

  perfil: [
    {
      target: 'perfil-cobro-row',
      title: 'Configura tu quincena',
      text: 'Aquí defines cada cuándo te pagan — semanal, quincenal o mensual — para que la app organice todo alrededor de eso.',
      placement: 'bottom',
    },
    {
      target: 'perfil-categorias-row',
      title: 'Haz tuyas las categorías',
      text: 'Cambia el ícono y color de cualquier categoría, o crea las tuyas propias.',
      placement: 'bottom',
    },
    {
      target: 'perfil-notificaciones-row',
      title: 'No se te vaya a pasar un pago',
      text: 'Activa los recordatorios para que la app te avise antes de que venza cada pago.',
      placement: 'bottom',
    },
  ],
}
