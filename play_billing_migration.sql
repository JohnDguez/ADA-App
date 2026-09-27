-- Google Play Billing (Android/Capacitor) — v0.9.525
-- Columnas nuevas en profiles para el pago dual (Stripe web/PWA + Play Billing Android).
-- Correr en el SQL Editor de Supabase ANTES de desplegar el código de esta sesión
-- (api/verify-play-purchase.js falla si intenta escribir en columnas que no existen).
-- ALTER TABLE sobre tabla existente: sin bloque GRANT (Regla 25.1).

ALTER TABLE profiles ADD COLUMN subscription_platform text DEFAULT NULL
  CHECK (subscription_platform IN ('stripe', 'google_play'));
ALTER TABLE profiles ADD COLUMN google_play_purchase_token text DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN google_play_product_id text DEFAULT NULL;
