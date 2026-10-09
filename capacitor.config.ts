/// <reference types="@capacitor-firebase/authentication" />

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.luna_pay.mobile',
  appName: 'LunaPay',
  webDir: 'dist',
  // FirebaseAuthentication.providers: NUEVO (octubre 2026) — sin esto el
  // plugin rechaza signInWithGoogle() en tiempo de ejecución con "Google
  // sign-in provider is not enabled..." (error real encontrado vía Logcat
  // en la primera prueba de Johnatan en dispositivo, v0.9.536/537). No
  // basta con habilitar el proveedor Google en Firebase Console — el
  // plugin nativo también necesita la lista explícita acá, es la config
  // del lado del cliente de qué providers carga.
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
    // Barra de estado transparente (v0.9.592): 'disable' = Capacitor NO pone
    // padding en el decor view; MainActivity gestiona los insets a mano
    // (arriba 0 + inyecta --sat, abajo respeta la barra de navegación).
    SystemBars: {
      insetsHandling: 'disable',
    },
  },
};

export default config;
