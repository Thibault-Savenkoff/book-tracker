export type BookLookupResult = {
  isbn: string | null
  title: string
  subtitle?: string | null
  authors: string[]
  publisher: string | null
  publishedDate?: string | null
  language?: string | null
  categories?: string[]
  description?: string | null
  cover_url: string | null
  pages: number | null
}

export class LookupNetworkError extends Error {}

const GOOGLE_BOOKS_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY as string | undefined

/** fetch() n'a pas de timeout par défaut — sans ça, une requête qui traîne bloque la recherche indéfiniment.
 * Lève une erreur sur échec réseau/timeout (distinct d'une réponse HTTP valide sans résultat). */
async function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      console.error('bookLookup HTTP error:', url, res.status, await res.text().catch(() => ''))
      throw new LookupNetworkError(`HTTP ${res.status}`)
    }
    return await res.json()
  } catch (e) {
    if (e instanceof LookupNetworkError) throw e
    console.error('bookLookup fetch failed:', url, e)
    throw new LookupNetworkError('fetch failed')
  } finally {
    clearTimeout(timeout)
  }
}

async function lookupByIsbnOpenLibrary(isbn: string): Promise<BookLookupResult | null> {
  const data = await fetchJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`)
  const entry = data?.[`ISBN:${isbn}`]
  if (!entry) return null
  return {
    isbn,
    title: entry.title,
    subtitle: entry.subtitle ?? null,
    authors: (entry.authors ?? []).map((a: { name: string }) => a.name),
    publisher: entry.publishers?.[0]?.name ?? null,
    publishedDate: entry.publish_date ?? null,
    categories: (entry.subjects ?? []).map((s: { name: string }) => s.name).slice(0, 6),
    cover_url: entry.cover?.large ?? entry.cover?.medium ?? null,
    pages: entry.number_of_pages ?? null,
  }
}

async function lookupByIsbnGoogleBooks(isbn: string): Promise<BookLookupResult | null> {
  const key = GOOGLE_BOOKS_KEY ? `&key=${GOOGLE_BOOKS_KEY}` : ''
  const data = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${key}`)
  const item = data?.items?.[0]
  if (!item) return null
  const info = item.volumeInfo
  return {
    isbn,
    title: info.title,
    subtitle: info.subtitle ?? null,
    authors: info.authors ?? [],
    publisher: info.publisher ?? null,
    publishedDate: info.publishedDate ?? null,
    language: info.language ?? null,
    categories: info.categories ?? [],
    description: info.description ?? null,
    cover_url: info.imageLinks?.thumbnail?.replace('http://', 'https://') ?? null,
    pages: info.pageCount ?? null,
  }
}

async function searchOpenLibrary(query: string): Promise<BookLookupResult[]> {
  const data = await fetchJson(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=40&fields=title,author_name,publisher,isbn,cover_i,number_of_pages_median,first_publish_year,language`,
  )
  return (data?.docs ?? []).map(
    (doc: {
      title: string
      author_name?: string[]
      publisher?: string[]
      isbn?: string[]
      cover_i?: number
      number_of_pages_median?: number
      first_publish_year?: number
      language?: string[]
    }) => ({
      isbn: doc.isbn?.[0] ?? null,
      title: doc.title,
      authors: doc.author_name ?? [],
      publisher: doc.publisher?.[0] ?? null,
      publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : null,
      language: doc.language?.[0] ?? null,
      cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      pages: doc.number_of_pages_median ?? null,
    }),
  )
}

async function searchGoogleBooks(query: string): Promise<BookLookupResult[]> {
  const key = GOOGLE_BOOKS_KEY ? `&key=${GOOGLE_BOOKS_KEY}` : ''
  const data = await fetchJson(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&langRestrict=fr&maxResults=40${key}`,
  )
  return (data?.items ?? []).map(
    (item: {
      volumeInfo: {
        title: string
        subtitle?: string
        authors?: string[]
        publisher?: string
        publishedDate?: string
        language?: string
        categories?: string[]
        description?: string
        imageLinks?: { thumbnail?: string }
        industryIdentifiers?: { identifier: string }[]
        pageCount?: number
      }
    }) => ({
      isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier ?? null,
      title: item.volumeInfo.title,
      subtitle: item.volumeInfo.subtitle ?? null,
      authors: item.volumeInfo.authors ?? [],
      publisher: item.volumeInfo.publisher ?? null,
      publishedDate: item.volumeInfo.publishedDate ?? null,
      language: item.volumeInfo.language ?? null,
      categories: item.volumeInfo.categories ?? [],
      description: item.volumeInfo.description ?? null,
      cover_url: item.volumeInfo.imageLinks?.thumbnail?.replace('http://', 'https://') ?? null,
      pages: item.volumeInfo.pageCount ?? null,
    }),
  )
}

/** Les deux sources sont interrogées en parallèle (pas l'une après l'autre) : une source down
 * ne rajoute pas son propre timeout à l'attente. Open Library est préféré si les deux répondent.
 * Ne lève que si les deux échouent réseau (une des deux qui répond "pas trouvé" suffit). */
export async function lookupByIsbn(isbn: string): Promise<BookLookupResult | null> {
  const [ol, gb] = await Promise.allSettled([lookupByIsbnOpenLibrary(isbn), lookupByIsbnGoogleBooks(isbn)])
  if (ol.status === 'fulfilled' && ol.value) return ol.value
  if (gb.status === 'fulfilled' && gb.value) return gb.value
  if (ol.status === 'rejected' && gb.status === 'rejected') throw ol.reason
  return null
}

/** Google Books est préféré ici (contrairement à lookupByIsbn) : son classement par pertinence
 * est bien meilleur qu'OpenLibrary sur une recherche plein-texte (nom d'auteur, titre partiel...). */
export async function searchByTitle(query: string): Promise<BookLookupResult[]> {
  const [ol, gb] = await Promise.allSettled([searchOpenLibrary(query), searchGoogleBooks(query)])
  if (gb.status === 'fulfilled' && gb.value.length > 0) return gb.value
  if (ol.status === 'fulfilled' && ol.value.length > 0) return ol.value
  if (ol.status === 'rejected' && gb.status === 'rejected') throw gb.reason
  return []
}
