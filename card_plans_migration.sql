-- v0.9.587 — Compras a meses ligadas a la tarjeta ("Enlazar a fecha de tarjeta").
-- Correr UNA vez en el SQL Editor de Supabase ANTES de usar la versión nueva.
--
-- payment_methods.plans: arreglo de planes de la tarjeta
--   [{ id, name, total, n, cuota, charged, paid, start, settled, created_at }]
-- payments.plan_items: cuotas que lleva un estado de cuenta (o una liquidación)
--   [{ plan_id, n, amount }]  /  [{ plan_id, settle: true, amount }]
--
-- ALTER TABLE sobre tablas ya existentes: conservan sus grants y RLS (Regla 25.1 no aplica).
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS plans jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.payments        ADD COLUMN IF NOT EXISTS plan_items jsonb DEFAULT NULL;
