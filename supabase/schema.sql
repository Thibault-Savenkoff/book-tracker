-- Snapshot de la base pour une installation neuve. Doit rester le reflet exact de
-- supabase/migrations/ — mettre à jour ici dès qu'une migration est ajoutée.

-- Table des livres, un utilisateur = ses propres livres uniquement (RLS)
create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  isbn text,
  title text not null,
  authors text[] not null default '{}',
  publisher text,
  series text,
  category text not null default 'roman', -- roman | bd | manga | comics | autre
  cover_url text,
  is_collector_edition boolean not null default false,
  rating smallint check (rating between 0 and 5),
  review text,
  date_added timestamptz not null default now(),
  date_read date,
  status text not null default 'wishlist' check (status in ('wishlist', 'reading', 'read', 'abandoned')),
  pages integer,
  pages_read integer not null default 0 check (pages_read >= 0)
);

create index if not exists books_user_id_idx on books(user_id);
create index if not exists books_category_idx on books(category);
create index if not exists books_series_idx on books(series);
create index if not exists books_publisher_idx on books(publisher);
create index if not exists books_status_idx on books(status);

alter table books enable row level security;

create policy "books_select_own" on books for select using (auth.uid() = user_id);
create policy "books_insert_own" on books for insert with check (auth.uid() = user_id);
create policy "books_update_own" on books for update using (auth.uid() = user_id);
create policy "books_delete_own" on books for delete using (auth.uid() = user_id);

-- Citations surlignées, une par ligne, liées à un livre
create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  text text not null,
  page integer,
  created_at timestamptz not null default now()
);

create index if not exists quotes_book_id_idx on quotes(book_id);

alter table quotes enable row level security;

create policy "quotes_select_own" on quotes for select using (auth.uid() = user_id);
create policy "quotes_insert_own" on quotes for insert with check (auth.uid() = user_id);
create policy "quotes_delete_own" on quotes for delete using (auth.uid() = user_id);

-- Storage pour les couvertures uploadées manuellement (fallback si aucune API ne trouve le livre)
insert into storage.buckets (id, name, public) values ('covers', 'covers', true)
on conflict (id) do nothing;

create policy "covers_public_read" on storage.objects for select using (bucket_id = 'covers');
create policy "covers_own_write" on storage.objects for insert with check (
  bucket_id = 'covers' and auth.uid()::text = (storage.foldername(name))[1]
);
