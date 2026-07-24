<div align="center">

  <img src="https://raw.githubusercontent.com/JohnDguez/ADA-App/main/public/Luna-Pay-logo-white.svg" alt="LunaPay" height="120" />

  # LunaPay

  **No controles tus gastos. Controla tu quincena.**

  App de control de pagos y recordatorios financieros, organizada por tu periodo de cobro — no por el mes calendario.

  ![Version](https://img.shields.io/badge/version-0.9.183-blue)
  ![Status](https://img.shields.io/badge/status-Alpha-orange)
  ![Stack](https://img.shields.io/badge/stack-React%20%2B%20Supabase-green)

</div>

---

## ¿Qué es LunaPay?

LunaPay es una PWA (Progressive Web App) de control financiero personal, pensada para quien cobra semanal, quincenal o mensual — el trabajador "godín" mexicano, no el mes de calendario. Te ayuda a:

- **Registrar** todos tus compromisos de pago (únicos, recurrentes, en parcialidades o de monto variable)
- **Organizar** los pagos según tu periodo de cobro, no según el mes
- **Ver de un vistazo** qué está vencido, qué falta por pagar este periodo, y qué se viene en el próximo
- **Compartir cuentas** con tu pareja o roomie en un Espacio Compartido aparte de tu cuenta Personal
- **Recibir avisos** push y dentro de la app antes de que algo se venza

---

## Características

### 💳 Tipos de pago
- **Único** — un solo pago en una fecha específica
- **Recurrente** — se repite automáticamente (semanal, quincenal, mensual, bimestral, trimestral, semestral o anual)
- **Parcialidades** — N pagos del mismo compromiso, con fecha de inicio real
- **Variable** — el monto cambia cada periodo (luz, agua, tarjeta de crédito); se captura en cuanto se sabe, sin afectar pagos pasados ni futuros de la misma serie

### 📅 Periodo de cobro inteligente
La app organiza tus pagos según tu día de cobro (semanal, quincenal o mensual), no según el mes de calendario. Un switch en Inicio separa claramente **Periodo actual** (vencidos, pendientes y ya pagados) de **Próximo periodo** — sin mezclar los dos.

### 👥 Espacios Compartidos
Lleva las cuentas de la casa, la renta o el súper junto con tu pareja o roomie, en un espacio aparte de tu cuenta Personal:
- El dueño invita con un código de 6 dígitos y decide qué puede hacer cada invitado — agregar pagos, editarlos, marcarlos como pagados, eliminarlos, o agregar ingresos extra, cada permiso por separado
- **Fondo Compartido** — un ahorro común del espacio, del que se puede pagar directo o completar un pago junto con la nómina de alguien más
- Divide un gasto entre los miembros del espacio, con abonos parciales de cada quien
- Todo se sincroniza al instante entre quienes comparten el espacio, sin recargar la app
- Notificaciones propias del espacio — quién agregó, pagó, aportó o cambió algo, con su foto y nombre reales

### 🔔 Notificaciones
- Alerta de pagos vencidos y recordatorio de los que vencen hoy
- Aviso anticipado configurable (1, 2, 3, 5 o 7 días antes)
- Resumen del día de cobro
- Hora de notificación configurable por usuario
- Notificaciones in-app y push (nativas del sistema) para todo lo anterior, más los eventos de Espacio Compartido

### 🎨 Personalización
- Categorías propias, con ícono y color a elegir (además de las 11 predefinidas)
- Foto de perfil — sube la tuya o elige uno de los 8 avatares prediseñados
- Tema claro, oscuro, o según el sistema

### 👑 Premium
Crea tu propio Espacio Compartido con periodo de cobro propio (sin Premium, puedes unirte a hasta 3 con un código). Planes mensual y anual.

### 📱 PWA instalable
Instálala en tu celular como una app nativa — ícono, splash screen y notificaciones push incluidos, sin pasar por ninguna tienda de aplicaciones.

---

## Stack

| | Tecnología |
|---|---|
| **Frontend** | React 18 + Vite 5 |
| **Estilos** | CSS Variables + CSS Modules (DM Sans, Lucide React) |
| **Base de datos** | Supabase (PostgreSQL + Row Level Security) |
| **Autenticación** | Supabase Auth (Email + Google OAuth) |
| **Storage** | Supabase Storage |
| **Deploy** | Vercel (serverless functions + auto-deploy desde `main`) |
| **Push notifications** | Web Push API + VAPID + Service Worker |
| **Automatización** | GitHub Actions (cron de recordatorios) |
| **PWA** | Service Worker + Web App Manifest |

---

## Estructura del proyecto

```
├── public/          # Assets estáticos, Service Worker, manifest
├── api/             # Vercel serverless functions
├── .github/         # GitHub Actions (cron de notificaciones)
└── src/
    ├── components/  # Componentes reutilizables
    ├── hooks/       # Custom hooks (datos, notificaciones, espacios compartidos, etc.)
    ├── lib/         # Cliente Supabase + utilidades
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

> Para documentación técnica detallada ver `CONTEXT.md`

---

<div align="center">
  Hecho con ☕ en Culiacán, Sinaloa
</div>
