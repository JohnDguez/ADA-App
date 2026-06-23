# Ada — App de control de pagos

## Setup local

```bash
npm install
cp .env.example .env
# Edita .env con tus keys de Supabase
npm run dev
```

## Variables de entorno

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

## Deploy en Vercel

1. Sube el proyecto a GitHub
2. Importa el repo en vercel.com
3. En "Environment Variables" agrega las mismas dos variables del .env
4. Deploy

## Estructura

```
src/
  lib/
    supabase.js     — cliente de Supabase
    utils.js        — lógica de fechas, cobro y formateo
  hooks/
    useAuth.js      — sesión de usuario
    usePayments.js  — CRUD de pagos
    useProfile.js   — perfil y configuración
  components/
    PayCard.jsx     — tarjeta de pago reutilizable
    PaymentModal.jsx — modal agregar/editar
    BottomNav.jsx   — navegación inferior
    Toast.jsx       — notificaciones
  pages/
    AuthPage.jsx
    HomePage.jsx
    PaymentsPage.jsx
    BudgetPage.jsx
    SettingsPage.jsx
```
