-- v0.9.1041 — «Ajustar fecha de cobro»: mueve UN solo cobro (p. ej. el del
-- domingo 15 que te pagan el viernes 13). Mapa { 'AAAA-MM-DD' programada :
-- 'AAAA-MM-DD' real }. Correr UNA vez en el SQL Editor de Supabase.
-- Hasta que se corra, la app sigue funcionando igual, pero guardar un ajuste
-- falla (se revierte y avisa) y no se manda el aviso previo.
alter table public.profiles
  add column if not exists cobro_overrides jsonb;
grant update (cobro_overrides) on public.profiles to authenticated;
