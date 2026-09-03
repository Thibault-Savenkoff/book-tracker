# Database

## Setup

- Supabase Postgres, reached with `supabase-js` directly from the browser (`src/lib/supabase.ts`). No ORM and no query builder of our own.
- Row shapes are hand-written TypeScript types in `src/lib/supabase.ts` (`Book`, `Quote`). They are not generated, so a migration means editing them by hand.

## Main entities

```mermaid
erDiagram
    USERS ||--o{ BOOKS : owns
    BOOKS ||--o{ QUOTES : has
```

- `books`: one row per owned or wished-for volume — metadata, category, status, rating, review, page progress.
- `quotes`: highlighted passages, cascade-deleted with their book.

## Conventions

- Migrations are plain SQL in `supabase/migrations/`, named `<timestamp>_<slug>.sql`, applied through the Supabase SQL editor. Every statement is written idempotently (`if not exists`, `drop constraint if exists`).
- `supabase/schema.sql` is a snapshot for first-time setup and has drifted from the migrations. Read the migrations for the current shape; update the snapshot when you touch it.
- Enum-like columns are `text` with a `check` constraint, not Postgres enums — changing one means dropping and re-adding the constraint.
- There is no seed data.
