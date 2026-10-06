<div align="center">

  <img src="https://raw.githubusercontent.com/JohnDguez/ADA-App/main/public/Luna-Pay-logo-white.svg" alt="LunaPay" height="120" />

  # LunaPay

  **Organiza. Paga. Relájate.**

  App de control de pagos y recordatorios financieros, organizada por tu periodo de cobro — no por el mes calendario.

  ![Version](https://img.shields.io/badge/version-0.9.555-blue)
  ![Status](https://img.shields.io/badge/status-Alpha-orange)
  ![Stack](https://img.shields.io/badge/stack-React%20%2B%20Supabase-green)
  ![Android](https://img.shields.io/badge/Android-Capacitor-3DDC84)

</div>

---

## ¿Qué es LunaPay?

LunaPay es una PWA (Progressive Web App) —y también app de Android— de control financiero personal, pensada para quien cobra semanal, quincenal o mensual — el trabajador "godín" mexicano, no el mes de calendario. Te ayuda a:

- **Registrar** todos tus compromisos de pago (únicos, recurrentes, en parcialidades o de monto variable)
- **Organizar** los pagos según tu periodo de cobro, no según el mes
- **Ver de un vistazo** qué está vencido, qué falta por pagar este periodo, y qué se viene en el próximo
- **Compartir cuentas** con tu pareja o roomie en un Espacio Compartido aparte de tu cuenta Personal
- **Recibir avisos** push y dentro de la app antes de que algo se venza

---

## Conoce a Luna

Luna es la mascota de LunaPay: una golden retriever que te dice cómo van tus pagos antes de que leas un solo número. Aparece en una franja arriba de las tarjetas de Inicio y cambia de pose según el estado del periodo:

<div align="center">
<table>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/JohnDguez/ADA-App/main/public/luna/luna_happy.webp" height="110" alt="Luna feliz" /><br/><sub><b>Al corriente</b></sub></td>
    <td align="center"><img src="https://raw.githubusercontent.com/JohnDguez/ADA-App/main/public/luna/luna_attentive.webp" height="110" alt="Luna atenta" /><br/><sub><b>Algo vence hoy o mañana</b></sub></td>
    <td align="center"><img src="https://raw.githubusercontent.com/JohnDguez/ADA-App/main/public/luna/luna_worried.webp" height="110" alt="Luna preocupada" /><br/><sub><b>Pagos vencidos</b></sub></td>
    <td align="center"><img src="https://raw.githubusercontent.com/JohnDguez/ADA-App/main/public/luna/luna_celebrating.webp" height="110" alt="Luna celebrando" /><br/><sub><b>Periodo completado</b></sub></td>
  </tr>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/JohnDguez/ADA-App/main/public/luna/luna_sleeping.webp" height="80" alt="Luna dormida" /><br/><sub><b>De noche, sin pendientes</b></sub></td>
    <td align="center"><img src="https://raw.githubusercontent.com/JohnDguez/ADA-App/main/public/luna/luna_waving.webp" height="110" alt="Luna saludando" /><br/><sub><b>Bienvenida</b></sub></td>
    <td align="center"><img src="https://raw.githubusercontent.com/JohnDguez/ADA-App/main/public/luna/luna_dusty.webp" height="80" alt="Luna con telarañas" /><br/><sub><b>Días sin abrir la app</b></sub></td>
    <td align="center"><img src="https://raw.githubusercontent.com/JohnDguez/ADA-App/main/public/luna/luna_away.webp" height="80" alt="Camita vacía de Luna" /><br/><sub><b>Luna salió a pasear</b></sub></td>
  </tr>
</table>
</div>

Junto a Luna, un mini anillo muestra cuántos pagos llevas del periodo. En el **widget de Android** (en desarrollo) Luna llega a la pantalla de inicio del teléfono, y ahí sí se pone dramática: si pasan 3 días sin abrir la app se llena de telarañas, y a los 7 días deja la camita vacía y sale a pasear.

---

## Características

### Tipos de pago
- **Único** — un solo pago en una fecha específica
- **Recurrente** — se repite automáticamente (semanal, quincenal, mensual, bimestral, trimestral, semestral o anual)
- **Parcialidades** — N pagos del mismo compromiso, con fecha de inicio real
- **Variable** — el monto cambia cada periodo (luz, agua, tarjeta de crédito); se captura en cuanto se sabe, sin afectar pagos pasados ni futuros de la misma serie

### Periodo de cobro inteligente
La app organiza tus pagos según tu día de cobro (semanal, quincenal o mensual), no según el mes de calendario. Un switch en Inicio separa claramente **Periodo actual** (vencidos, pendientes y ya pagados) de **Próximo periodo** — sin mezclar los dos.

### Onboarding guiado
Un asistente de 4 pasos recibe a cada usuario nuevo antes de entrar a la app: nombre, frecuencia y día de cobro, ingreso por periodo (opcional) y activación de notificaciones — todo editable después desde Ajustes.

### Tutorial interactivo (coach marks)
Un recorrido guiado, tipo spotlight, señala los controles clave la primera vez que se llega a cada pantalla (Inicio, Gastos, Recurrentes, Perfil, y al crear un pago nuevo). Se puede volver a ver en cualquier momento desde Ajustes → "Ver tutorial de nuevo".

### Espacios Compartidos
Lleva las cuentas de la casa, la renta o el súper junto con tu pareja o roomie, en un espacio aparte de tu cuenta Personal:
- El dueño invita con un código de 6 dígitos y decide qué puede hacer cada invitado — agregar pagos, editarlos, marcarlos como pagados, eliminarlos, o agregar ingresos extra, cada permiso por separado
- **Fondo Compartido** — un ahorro común del espacio, del que se puede pagar directo o completar un pago junto con la nómina de alguien más
- Divide un gasto entre los miembros del espacio, con abonos parciales de cada quien
- Todo se sincroniza al instante entre quienes comparten el espacio, sin recargar la app
- Notificaciones propias del espacio — quién agregó, pagó, aportó o cambió algo, con su foto y nombre reales

### Notificaciones
- Alerta de pagos vencidos y recordatorio de los que vencen hoy
- Aviso anticipado configurable (1, 2, 3, 5 o 7 días antes)
- Resumen del día de cobro
- Hora de notificación configurable por usuario
- Notificaciones in-app y push (nativas del sistema) para todo lo anterior, más los eventos de Espacio Compartido

### Personalización
- Categorías propias, con ícono y color a elegir (además de las 11 predefinidas)
- Foto de perfil — sube la tuya o elige uno de los 8 avatares prediseñados
- Tema claro, oscuro, o según el sistema

### Premium
Crea tu propio Espacio Compartido con periodo de cobro propio (sin Premium, puedes unirte a hasta 3 con un código). Planes mensual y anual, con Stripe en la web y Google Play Billing en la app de Android.

### Tarjetas, metas y exportación
- **Mis tarjetas** — tus tarjetas de crédito y débito, con sus estados de cuenta y pagos
- **Metas compartidas** y Fondo Compartido dentro de un Espacio
- **Exportar tus datos** en CSV o PDF

### Español e inglés
Toda la app está en español e inglés (i18next), incluidas las notificaciones.

### PWA instalable
Instálala en tu celular como una app nativa — ícono, splash screen y notificaciones push incluidos, sin pasar por ninguna tienda de aplicaciones.

### App de Android
Además de la PWA, LunaPay tiene app nativa de Android (Capacitor), hoy en prueba cerrada en Google Play. Trae login de Google nativo, notificaciones push por FCM, compra de Premium con Google Play Billing, exportación de archivos con la hoja de compartir del sistema y, en camino, el widget de Luna para la pantalla de inicio.

---

## Stack

| | Tecnología |
|---|---|
| **Frontend** | React 18 + Vite 5 |
| **Estilos** | CSS Variables + CSS Modules (DM Sans, Lucide React) |
| **Base de datos** | Supabase (PostgreSQL + Row Level Security) |
| **Autenticación** | Supabase Auth (Email + Google OAuth; Google nativo en Android vía Firebase Authentication) |
| **Storage** | Supabase Storage |
| **Deploy** | Vercel (serverless functions + auto-deploy desde `main`) |
| **Push notifications** | Web Push API + VAPID + Service Worker (web) · Firebase Cloud Messaging (Android) |
| **App nativa** | Capacitor 8 (Android) + widget nativo en Java |
| **Pagos de Premium** | Stripe (web) · Google Play Billing (Android) |
| **Idiomas** | i18next (español / inglés) |
| **Automatización** | GitHub Actions (cron de recordatorios) |
| **PWA** | Service Worker + Web App Manifest |

---

## Estructura del proyecto

```
├── public/          # Assets estáticos, Service Worker, manifest, imágenes de Luna (public/luna)
├── api/             # Vercel serverless functions
├── android/         # Proyecto nativo de Android (Capacitor) + widget de Luna
├── .github/         # GitHub Actions (cron de notificaciones)
└── src/
    ├── components/  # Componentes reutilizables
    ├── hooks/       # Custom hooks (datos, notificaciones, espacios compartidos, etc.)
    ├── i18n/        # Traducciones (es.json / en.json)
    ├── lib/         # Cliente Supabase + utilidades (incl. el estado de Luna)
    └── pages/       # Páginas de la app
```

---

## Setup local

### Requisitos
- Node.js 18+
- Cuenta en Supabase
- Cuenta en Vercel

### Instalación

```bash
git clone [repo-url]
cd ADA-App
npm install
```

### Variables de entorno

Crea un archivo `.env` en la raíz con tus credenciales de Supabase y VAPID.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_VAPID_PUBLIC_KEY=
```

> Las funciones serverless en `api/` (envío de push, notificaciones de Espacio Compartido) necesitan variables adicionales del lado del servidor (service role de Supabase, clave privada VAPID) configuradas directo en Vercel, no en este `.env`.

### Correr en local

```bash
npm run dev
```

### App de Android

```bash
npm run build
npm run cap:sync   # copia la web al proyecto nativo
```

Después abre la carpeta `android/` en Android Studio y córrela en un teléfono o emulador. La app de Android lleva dentro una copia de la web, así que cada cambio de la web necesita un build nuevo para llegar a los teléfonos. Requiere tu propio `google-services.json` de Firebase en `android/app/`.

> Para documentación técnica detallada ver `CONTEXT.md`

---

<div align="center">
  Hecho en Culiacán, Sinaloa
</div>
