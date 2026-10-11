-- v0.9.675 — Tocar una notificación lleva al espacio y al pago.
-- Correr UNA vez en el SQL Editor de Supabase. Hasta que se corra, las
-- notificaciones nuevas se siguen guardando (el código reintenta sin estas
-- columnas) pero sin destino exacto.
alter table public.notifications
  add column if not exists space_id uuid,
  add column if not exists payment_id uuid;
