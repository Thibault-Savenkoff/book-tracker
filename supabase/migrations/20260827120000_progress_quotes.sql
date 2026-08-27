-- Statut "abandonné" + suivi de pages lues, pour le volet de fiche livre
alter table books drop constraint if exists books_status_check;
alter table books add constraint books_status_check check (status in ('wishlist', 'reading', 'read', 'abandoned'));

alter table books add column if not exists pages_read integer not null default 0 check (pages_read >= 0);

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
