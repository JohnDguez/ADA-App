import styles from './SettingsDesk.module.css'

// Encabezado de sub-página de Ajustes en escritorio: título, descripción y
// acciones a la derecha (v0.9.835).
export function DeskSettingsHead({ title, description, actions }) {
  return (
    <div className={styles.head}>
      <div>
        <h2 className={styles.title}>{title}</h2>
        {description && <p className={styles.desc}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}

// Raíz de una sub-página de Ajustes rediseñada para escritorio. El atributo
// la distingue de las páginas antiguas, a las que DeskSettings.module.css les
// quita fondo y márgenes (v0.9.835).
export function DeskPage({ children }) {
  return <div data-dp="">{children}</div>
}
