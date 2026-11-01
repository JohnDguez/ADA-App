import { Modal } from './Modal'
import mk from './Modal.module.css'

// Avisos y confirmaciones (salir, descartar, borrar, nueva versión, código de
// invitación, calificar…). Desde v0.9.980 es una capa sobre <Modal
// layout="confirm"> (diseño nuevo, mockup de modales aprobado): ficha de
// color centrada, título, texto y botones en píldora. Se conserva la API
// para no tocar a cada usuario:
//
//   <ModalSheet icon={SignOut} tone="danger" title="…" onBackdrop={fn}>
//     <ModalSheet.Text>descripción</ModalSheet.Text>
//     <SheetButton variant="danger" onClick={…}>Salir</SheetButton>
//     <SheetButton variant="soft" onClick={…}>Cancelar</SheetButton>
//   </ModalSheet>
//
// tone: 'accent' (azul, por defecto) | 'danger' (rojo) | 'gold' | 'paid'.
export function ModalSheet({ icon, tone = 'accent', title, onBackdrop, children, zIndex, pulse = false, open = true, width = 440 }) {
  return (
    <Modal open={open} onClose={onBackdrop} title={title} icon={icon} tone={tone} layout="confirm"
      zIndex={zIndex} pulse={pulse} width={width} backClose={false} closeButton={false} bodyClassName={mk.sheetKids}>
      {children}
    </Modal>
  )
}

ModalSheet.Text = function ModalSheetText({ children }) {
  return <div className={`${mk.cfText} ${mk.sheetText}`}>{children}</div>
}

// variant: 'primary' (azul) | 'danger' (rojo) | 'soft' (relleno neutro) | 'gold'.
export function SheetButton({ variant = 'primary', children, className = '', ...rest }) {
  const cls = variant === 'danger' ? mk.btnRed : variant === 'soft' ? mk.btnSoft : variant === 'gold' ? mk.btnGold : mk.btnPri
  return <button type="button" className={`${mk.btn} ${mk.big} ${cls} ${className}`} {...rest}>{children}</button>
}
