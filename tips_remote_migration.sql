-- v0.9.701 — Consejos de Inicio editables sin hacer build.
-- Correr UNA vez en el SQL Editor de Supabase. La app lee esta tabla al abrir
-- (con respaldo a los 15 consejos incluidos y caché local si no hay red).
--
-- Una fila con el MISMO id que un consejo incluido (remToday, remFood, remChanged,
-- remExtra, remNext, remCash, voice, scan, variable, postpone, pause, goals,
-- shared, export, installments) lo REEMPLAZA; con active = false lo APAGA.
create table if not exists public.tips (
  id               text primary key,
  kind             text not null default 'feature' check (kind in ('reminder', 'feature')),
  -- Qué hace el botón del consejo (o null = sin botón): add | addmenu | voice | scan
  -- | tab:<pestaña> (home, payments, recurrents, goals) | settings:<sección>
  -- (sharedspace, export, cards, categories). Cualquier otro valor se ignora.
  action           text,
  title_es         text not null default '',
  text_es          text not null default '',
  action_label_es  text not null default '',
  title_en         text not null default '',
  text_en          text not null default '',
  action_label_en  text not null default '',
  active           boolean not null default true,
  platform         text not null default 'all' check (platform in ('all', 'android', 'web')),
  min_build        integer not null default 0,   -- Android: versionCode mínimo (1.9 = 19)
  starts_at        timestamptz,
  ends_at          timestamptz,
  created_at       timestamptz not null default now()
);

alter table public.tips enable row level security;

-- Solo lectura para la app (cualquier usuario con sesión); se escribe desde el panel.
drop policy if exists "tips_read" on public.tips;
create policy "tips_read" on public.tips for select to anon, authenticated using (true);

-- Ejemplo (descomenta para probar):
-- insert into public.tips (id, kind, action, title_es, text_es, action_label_es, title_en, text_en, action_label_en)
-- values ('ejemplo', 'feature', 'tab:goals', 'Título', 'Texto del consejo.', 'Ir a Metas',
--         'Title', 'Tip text.', 'Go to Goals');
