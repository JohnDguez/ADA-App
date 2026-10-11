// v0.9.663 — al abrir un selector (desplegable u hoja inferior), la lista se
// desplaza para dejar a la vista la opción seleccionada (antes siempre
// arrancaba en el primer elemento: abrir "Mes" estando en octubre mostraba
// enero). Las opciones seleccionadas llevan `data-selected="true"`.
// Sin animación (la lista aparece ya en su lugar) y solo mueve el contenedor
// con scroll más cercano — nunca la página.
function scrollParent(el, stopAt) {
  let node = el.parentElement
  while (node && node !== stopAt?.parentElement) {
    const oy = getComputedStyle(node).overflowY
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) return node
    node = node.parentElement
  }
  return null
}

export function scrollSelectedIntoView(container) {
  if (!container) return
  const el = container.querySelector('[data-selected="true"]')
  if (!el) return
  const sp = scrollParent(el, container)
  if (!sp) return
  const spRect = sp.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const offset = elRect.top - spRect.top + sp.scrollTop
  sp.scrollTop = Math.max(0, offset - (sp.clientHeight - el.offsetHeight) / 2)
}
