# Project Brief

## What it is

- BiblioLog: a personal PWA to log novels, BD, manga and comics read, with a rating and a written review.
- Single-user by design, installed on iPhone via Safari "Add to Home Screen", and usable as-is on desktop.

## Why it exists

- Replace a Goodreads-style tracker with something private: no social feed, no friends, no sharing. One person, one library.
- French-speaking library first: search is biased to French editions, and the UI copy is in French.

## Domain language

| Term | Meaning |
| ---- | ------- |
| Category | `roman`, `bd`, `manga`, `comics`, `autre` — the book's genre bucket, drives the accent colour |
| Status | `wishlist`, `reading`, `read`, `abandoned` — where the book sits in the reading cycle |
| Series / volume | Parsed out of the title (`One Piece T05`), never provided by the external sources. See `src/lib/series.ts` |
| Collector edition | `is_collector_edition`, a flag on a book, not a separate entity |
| Quote | A highlighted passage attached to a book, with an optional page number |
| Reading goal | Yearly target number of books. A device preference in `localStorage`, not collection data |

## Key features

- Collection browsing with search, category filter, and a series view that surfaces missing volumes.
- Add a book by barcode scan (ISBN), by title search, or manually with an uploaded cover.
- Book detail panel: rating, review, page progress, quotes.
- Planning and Stats screens over the collection.
