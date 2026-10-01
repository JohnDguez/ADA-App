// Login nativo de Google en Android (Capacitor) vía Firebase Authentication —
// NUEVO. El flujo de Google Identity Services (GIS, ver src/lib/googleAuth.js)
// usado en web/PWA depende de FedCM corriendo dentro de un navegador normal;
// Google bloquea/restringe ese flujo dentro del WebView embebido de Capacitor
// — mismo tipo de restricción ya documentada para Google Play Billing en
// playBilling.js. Resultado real visto por Johnatan: el botón de Google en
// la app empaquetada queda deshabilitado o nunca completa el selector.
//
// Fix: @capacitor-firebase/authentication usa el SDK nativo de Google
// Sign-In de Android (Credential Manager) — abre el selector de cuentas del
// SISTEMA, no un WebView — y regresa un idToken de Google que se manda a
// Supabase exactamente igual que el flujo web (`signInWithIdToken`), así que
// del lado de Supabase no hay nada nuevo que mantener: es el mismo backend,
// solo cambia cómo se obtiene el idToken en Android.
//
// Requiere, fuera de código (ver CONTEXT.md → "Plan de esta semana"):
// 1. Crear el proyecto de Firebase (el mismo que push notifications, ver
//    src/hooks/usePushNotifications.js) y agregar la app Android con el
//    mismo applicationId (app.luna_pay.mobile, ver capacitor.config.ts /
//    ANDROID_PACKAGE_NAME en lib/constants.js).
// 2. Bajar `google-services.json` desde Firebase Console y copiarlo a
//    `android/app/google-services.json` — android/app/build.gradle YA lo
//    busca ahí de forma condicional (bloque `apply plugin:
//    'com.google.gms.google-services'`), no hace falta tocar Gradle.
// 3. En Firebase Console → Authentication → Sign-in method, habilitar el
//    proveedor Google — Firebase genera un "Web client ID" propio (DISTINTO
//    al VITE_GOOGLE_CLIENT_ID que ya usa la web) que @capacitor-firebase/
//    authentication necesita conocer; se configura del lado nativo según la
//    guía del plugin (normalmente basta con que google-services.json ya lo
//    traiga — revisar la consola del plugin si el selector no aparece).
//
// SIN PROBAR TODAVÍA — requiere build real de Android + google-services.json,
// ninguno de los 2 existe en esta sesión (mismo aviso que playBilling.js).

import { supabase } from './supabase'

export function isNativeAndroid() {
  return typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'android'
}

// Import dinámico (mismo patrón que @capacitor/push-notifications en
// usePushNotifications.js) — @capacitor-firebase/authentication trae su
// propio fallback web que depende del SDK completo de `firebase/auth`
// (~214KB minificado, confirmado en el build). Un import estático lo mete
// en el mismo chunk que AuthPage.jsx para TODO visitante, incluso en
// web/PWA donde este código nunca corre (isNativeAndroid() lo descarta
// antes de llegar aquí) — con import() dinámico, ese peso solo se descarga
// si de verdad se entra a esta función, es decir, solo dentro de la app de
// Android.
export async function signInWithGoogleNative() {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication')
  const { credential } = await FirebaseAuthentication.signInWithGoogle()
  if (!credential?.idToken) throw new Error('Google no devolvió credencial')

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: credential.idToken,
  })
  if (error) throw error
}
