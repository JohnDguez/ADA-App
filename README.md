<div align="center">

  <img src="https://raw.githubusercontent.com/JohnDguez/ADA-App/main/public/ADA-Pay-logo.svg" alt="ADA Pay" height="120" />

  # ADA Pay
  
  **Track. Pay. Relax.**
  
  App personal de control de pagos y recordatorios financieros.
  
  ![Version](https://img.shields.io/badge/version-0.8.0-blue)
  ![Status](https://img.shields.io/badge/status-Pre--Alpha-orange)
  ![Stack](https://img.shields.io/badge/stack-React%20%2B%20Supabase-green)

</div>

---

## ¿Qué es ADA Pay?

ADA Pay es una PWA (Progressive Web App) de control financiero personal. Te ayuda a:

- **Registrar** todos tus compromisos de pago
- **Organizar** los pagos por tu periodo de cobro (semanal, quincenal o mensual)
- **Recordar** qué tienes que pagar antes de que llegue tu próximo día de cobro
- **Historial** de pagos con métricas mensuales

---

## Características

### 💳 Tipos de pago
- **Pago único** — un solo pago en una fecha específica
- **Recurrente** — se repite automáticamente (semanal, quincenal, mensual, bimestral, trimestral, semestral o anual)
- **Parcialidades** — N pagos del mismo compromiso, con fecha de inicio real
- **Variable** — el monto cambia cada periodo

### 📅 Periodo de cobro inteligente
La app organiza tus pagos según tu día de cobro. Te muestra qué tienes que cubrir antes del próximo cobro, separando claramente los vencidos, los urgentes y los próximos.

### 🔔 Notificaciones push
- Alerta de pagos vencidos
- Recordatorio de pagos que vencen hoy
- Aviso anticipado configurable (1, 2, 3, 5 o 7 días antes)
- Resumen del día de cobro
- Hora de notificación configurable por usuario

### 📊 Historial
- Gráfica de gasto mensual (últimos 3, 6 o 12 meses)
- Filtro por nombre de pago
- Total y promedio mensual

---

## Stack

| | Tecnología |
|---|---|
| **Frontend** | React 18 + Vite 5 |
| **Base de datos** | Supabase (PostgreSQL) |
| **Autenticación** | Supabase Auth (Email + Google OAuth) |
| **Storage** | Supabase Storage |
| **Deploy** | Vercel |
| **Push notifications** | Web Push API + VAPID |
| **PWA** | Service Worker + Web App Manifest |

---

## Estructura del proyecto

```
├── public/          # Assets estáticos, Service Worker, manifest
├── api/             # Vercel serverless functions
└── src/
    ├── components/  # Componentes reutilizables
    ├── hooks/       # Custom hooks
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

### Correr en local

```bash
npm run dev
```

> Para documentación técnica detallada ver `CONTEXT.md`

---

<div align="center">
  Hecho con ☕ en Culiacán, Sinaloa
</div>
