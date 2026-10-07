import { CardFormModal } from './CardFormModal'

// "Añadir tarjeta" desde otro formulario (Nuevo pago, Aportar a una meta,
// Añadir fondos). Abre CardFormModal ENCIMA del formulario de origen — que
// sigue montado, así que no pierde lo ya capturado — y, al guardar, avisa el
// id de la tarjeta nueva con `onAdded` para dejarla seleccionada.
//
// Se espera a que el servidor confirme para entregar el id real: el id
// temporal `tmp-…` de la actualización optimista no sirve como
// `payment_method_id`. Mientras tanto la tarjeta ya aparece en la lista.
// `selectableKinds` (ej. ['debit']): si la tarjeta nueva es de otro tipo se
// guarda igual pero no se avisa con `onAdded` (el formulario de origen no la
// ofrece, así que no podría quedar seleccionada).
export function AddCardModal({ open, onClose, paymentMethods, onAdded, selectableKinds = null }) {
  async function handleSave(data) {
    onClose()
    const res = await paymentMethods.addMethod(data)
    if (!res?.error && res?.id && (!selectableKinds || selectableKinds.includes(data.kind))) onAdded?.(res.id)
  }
  return <CardFormModal open={open} initial={null} onSave={handleSave} onClose={onClose} />
}
