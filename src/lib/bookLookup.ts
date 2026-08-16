export type BookLookupResult = {
  isbn: string | null
  title: string
  authors: string[]
  publisher: string | null
  cover_url: string | null
}

const GOOGLE_BOOKS_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY as string | undefined

async function lookupByIsbnOpenLibrary(isbn: string): Promise<BookLookupResult | null> {
  const res = await fetch(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
  )
  if (!res.ok) return null
  const data = await res.json()
  const entry = data[`ISBN:${isbn}`]
  if (!entry) return null
  return {
    isbn,
    title: entry.title,
    authors: (entry.authors ?? []).map((a: { name: string }) => a.name),
    publisher: entry.publishers?.[0]?.name ?? null,
    cover_url: entry.cover?.large ?? entry.cover?.medium ?? null,
  }
}

async function lookupByIsbnGoogleBooks(isbn: string): Promise<BookLookupResult | null> {
  const key = GOOGLE_BOOKS_KEY ? `&key=${GOOGLE_BOOKS_KEY}` : ''
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${key}`)
  if (!res.ok) return null
  const data = await res.json()
  const item = data.items?.[0]
  if (!item) return null
  const info = item.volumeInfo
  return {
    isbn,
    title: info.title,
    authors: info.authors ?? [],
    publisher: info.publisher ?? null,
    cover_url: info.imageLinks?.thumbnail?.replace('http://', 'https://') ?? null,
  }
}

/** Open Library en premier essai, fallback Google Books si rien trouvé. */
export async function lookupByIsbn(isbn: string): Promise<BookLookupResult | null> {
  return (await lookupByIsbnOpenLibrary(isbn)) ?? (await lookupByIsbnGoogleBooks(isbn))
}

export async function searchByTitle(query: string): Promise<BookLookupResult[]> {
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=15&fields=title,author_name,publisher,isbn,cover_i`,
  )
  if (!res.ok) return []
  const data = await res.json()
  const results: BookLookupResult[] = (data.docs ?? []).map(
    (doc: {
      title: string
      author_name?: string[]
      publisher?: string[]
      isbn?: string[]
      cover_i?: number
    }) => ({
      isbn: doc.isbn?.[0] ?? null,
      title: doc.title,
      authors: doc.author_name ?? [],
      publisher: doc.publisher?.[0] ?? null,
      cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
    }),
  )
  if (results.length > 0) return results

  const key = GOOGLE_BOOKS_KEY ? `&key=${GOOGLE_BOOKS_KEY}` : ''
  const gRes = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}${key}`,
  )
  if (!gRes.ok) return []
  const gData = await gRes.json()
  return (gData.items ?? []).map(
    (item: {
      volumeInfo: {
        title: string
        authors?: string[]
        publisher?: string
        imageLinks?: { thumbnail?: string }
        industryIdentifiers?: { identifier: string }[]
      }
    }) => ({
      isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier ?? null,
      title: item.volumeInfo.title,
      authors: item.volumeInfo.authors ?? [],
      publisher: item.volumeInfo.publisher ?? null,
      cover_url: item.volumeInfo.imageLinks?.thumbnail?.replace('http://', 'https://') ?? null,
    }),
  )
}
