-- Statut de lecture (wishlist/reading/read) et nombre de pages, pour l'écran Statistiques
alter table books add column if not exists status text not null default 'wishlist'
  check (status in ('wishlist', 'reading', 'read'));
alter table books add column if not exists pages integer;

update books set status = 'read' where date_read is not null and status = 'wishlist';

create index if not exists books_status_idx on books(status);
